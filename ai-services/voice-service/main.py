import os
import re
import io
import asyncio
import tempfile
import hashlib
import urllib.request
import pathlib
import torch
import numpy as np
import soundfile as sf
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv
from pydantic import BaseModel

from model import Speech_emotion
from kokoro_tts import TtsEngine, ensure_model_files

load_dotenv()

app = FastAPI(title="Voice Analysis & STT Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EMOTION_LABELS = [
    "neutral",
    "calm",
    "happy",
    "sad",
    "angry",
    "fearful",
    "disgust",
    "surprised",
]

# Global model instances
model = None
whisper_stt_model = None
tts_engine = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def ensure_ser_model(model_path: str):
    if os.path.exists(model_path):
        return model_path
    url = os.getenv("SER_MODEL_URL")
    expected = os.getenv("SER_MODEL_SHA256", "").strip().lower()
    if not url:
        return None
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    tmp = model_path + ".part"
    urllib.request.urlretrieve(url, tmp)
    if expected and hashlib.sha256(pathlib.Path(tmp).read_bytes()).hexdigest() != expected:
        os.remove(tmp)
        print("[Voice Service] SER model checksum mismatch - refusing to load.")
        return None
    os.replace(tmp, model_path)
    return model_path


@app.on_event("startup")
def load_models():
    global model, whisper_stt_model

    # 1. Load Speech Emotion Recognition (SER) PyTorch model
    model_path = os.getenv(
        "SER_MODEL_PATH",
        os.path.join(os.path.dirname(__file__), "../../SER_model/best_model_path.pth"),
    )
    if os.path.exists(model_path):
        try:
            print(f"[Voice Service] Loading SER model from {model_path}...")
            model_inst = Speech_emotion()
            state_dict = torch.load(model_path, map_location=device)
            model_inst.load_state_dict(state_dict, strict=True)
            model_inst.to(device)
            model_inst.eval()
            model = model_inst
            print("[Voice Service] SER model loaded successfully!")
        except Exception as e:
            print(f"[Voice Service] Warning: Failed to load SER model: {e}")
    else:
        fetched = ensure_ser_model(model_path)
        if fetched and os.path.exists(fetched):
            try:
                print(f"[Voice Service] Downloaded SER model to {fetched}...")
                model_inst = Speech_emotion()
                state_dict = torch.load(fetched, map_location=device)
                model_inst.load_state_dict(state_dict, strict=True)
                model_inst.to(device)
                model_inst.eval()
                model = model_inst
                print("[Voice Service] SER model loaded successfully!")
            except Exception as e:
                print(f"[Voice Service] Warning: Failed to load downloaded SER model: {e}")
        else:
            print(f"[Voice Service] Warning: SER Model file not found at {model_path}")

    # 2. Load Faster-Whisper Speech-To-Text (STT) model
    try:
        from faster_whisper import WhisperModel
        print("[Voice Service] Loading Faster-Whisper base.en model...")
        whisper_stt_model = WhisperModel("base.en", device="cpu", compute_type="int8")
        print("[Voice Service] Faster-Whisper STT model loaded successfully!")
    except Exception as e:
        print(f"[Voice Service] Faster-Whisper initialization note: {e}")
        try:
            import whisper
            print("[Voice Service] Fallback: Loading OpenAI Whisper base model...")
            whisper_stt_model = whisper.load_model("base", device=device)
            print("[Voice Service] OpenAI Whisper loaded successfully!")
        except Exception as fallback_err:
            print(f"[Voice Service] Whisper fallback note: {fallback_err}")

    # 3. Kokoro TTS: ensure model files exist (non-fatal), lazy-load the engine
    global tts_engine
    model_path, voices_path = ensure_model_files()
    if model_path and voices_path:
        tts_engine = TtsEngine(
            model_path=model_path,
            voices_path=voices_path,
            voice=os.getenv("KOKORO_VOICE", "af_heart").strip() or "af_heart",
            cache_enabled=os.getenv("KOKORO_CACHE_ENABLED", "true").lower() == "true",
            num_threads=int(os.getenv("KOKORO_NUM_THREADS", "16").strip() or 0),
        )
        print("[Voice Service] Kokoro TTS engine ready (lazy model load on first request)")

        # Preload the model in the background so the first real request is fast.
        import threading

        def _preload_kokoro():
            try:
                tts_engine._load()
                print("[Voice Service] Kokoro TTS model preloaded (background)")
            except Exception as e:
                print(f"[Voice Service] Kokoro TTS preload failed: {e}")

        threading.Thread(target=_preload_kokoro, daemon=True).start()
    else:
        print("[Voice Service] Kokoro TTS unavailable - model files could not be ensured (frontend will fall back to speechSynthesis)")


class VoiceAnalysisResult(BaseModel):
    transcript: str
    confidenceScore: float
    fluencyScore: float
    fillerWordCount: int
    speakingSpeed: float  # words per minute
    clarityScore: float
    emotionProbabilities: dict
    dominantEmotion: str
    audioDecoded: bool = True  # False = audio could not be decoded; SER output is not trustworthy


class TtsRequest(BaseModel):
    text: str
    voice: str | None = None
    rate: float = 1.0


def transcribe_audio_file(audio_path: str):
    """
    Transcribes audio file using faster-whisper (or fallback whisper).
    Returns (transcript, avg_logprob) where avg_logprob is Whisper's own
    per-segment acoustic confidence signal (higher = clearer speech).
    Handles silence, empty audio, background noise, and non-speech artifacts.
    """
    global whisper_stt_model
    if whisper_stt_model is None:
        return "Audio recorded. STT transcription processing.", -1.0

    try:
        # Check if faster-whisper model
        if hasattr(whisper_stt_model, "transcribe"):
            segments, info = whisper_stt_model.transcribe(
                audio_path,
                beam_size=5,
                language="en",
                vad_filter=True,  # Voice activity detection to filter silence
            )
            text_parts = []
            logprobs = []
            for segment in segments:
                if segment.text:
                    text_parts.append(segment.text.strip())
                    if segment.avg_logprob is not None:
                        logprobs.append(segment.avg_logprob)
            transcript = " ".join(text_parts).strip()
            avg_logprob = sum(logprobs) / len(logprobs) if logprobs else -1.0
            return (transcript if transcript else "Candidate provided verbal response."), avg_logprob
        else:
            # Fallback openai-whisper
            res = whisper_stt_model.transcribe(audio_path)
            transcript = res.get("text", "").strip()
            return (transcript if transcript else "Candidate provided verbal response."), -1.0
    except Exception as err:
        print(f"[Voice Service] STT Transcription error: {err}")
        return "Audio recorded. Transcription completed with fallback.", -1.0


def _decode_with_av(audio_path: str, target_sr: int = 16000):
    """Decode any container (webm/opus, mp3, m4a...) using bundled FFmpeg libs via PyAV."""
    import av
    container = av.open(audio_path)
    resampler = av.AudioResampler(format="s16", layout="mono", rate=target_sr)
    frames = []
    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            arr = resampled.to_ndarray()
            if arr.ndim > 1:
                arr = arr.mean(axis=1)
            frames.append(arr)
    container.close()
    if not frames:
        raise ValueError("no audio frames decoded")
    y = np.concatenate(frames).astype("float32") / 32768.0
    return y, target_sr


def preprocess_audio(audio_path: str, target_sr: int = 16000, max_len: int = 64000):
    """
    Returns (chunks, duration_seconds, decoded_flag).
    Never raises: on total decode failure returns zero-chunk with decoded_flag=False
    so callers can flag the analysis instead of silently scoring silence.
    """
    duration_seconds = 0.0
    try:
        try:
            y, sr = sf.read(audio_path, dtype="float32")
            if y.ndim > 1:
                y = y.mean(axis=1)
        except Exception:
            # soundfile cannot handle webm/opus containers -> PyAV (bundled ffmpeg)
            y, sr = _decode_with_av(audio_path, target_sr)
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        duration_seconds = len(y) / float(target_sr)
    except Exception as decode_err:
        print(f"[Voice Service] AUDIO DECODE FAILED for {audio_path}: {decode_err} "
              f"- SER will be flagged as not-decoded instead of analyzing silence.")
        return [np.zeros(max_len, dtype="float32")], 0.0, False

    total_samples = len(y)

    if total_samples < max_len:
        padded = np.pad(y, (0, max_len - total_samples), mode="constant")
        std = padded.std()
        normalized = (padded - padded.mean()) / (std if std > 1e-7 else 1e-7)
        return [normalized], duration_seconds, True

    chunks = []
    for start in range(0, total_samples, max_len):
        chunk = y[start : start + max_len]
        if len(chunk) < max_len:
            chunk = np.pad(chunk, (0, max_len - len(chunk)), mode="constant")

        std = chunk.std()
        normalized_chunk = (chunk - chunk.mean()) / (std if std > 1e-7 else 1e-7)
        chunks.append(normalized_chunk)

    return chunks, duration_seconds, True


@app.get("/health")
async def health():
    return {
        "success": True,
        "data": {
            "status": "OK",
            "service": "voice-service",
            "port": 8002,
            "ser_model_loaded": model is not None,
            "stt_model_loaded": whisper_stt_model is not None,
            "tts_model_loaded": tts_engine is not None and tts_engine.is_ready(),
            "tts_voice": tts_engine.default_voice if tts_engine is not None else None,
        },
    }


@app.post("/tts")
async def synthesize_speech(req: TtsRequest):
    """
    Synthesize speech from text using Kokoro TTS and return a WAV file.
    Returns 503 when TTS is unavailable (frontend should fall back to speechSynthesis).
    """
    if tts_engine is None:
        raise HTTPException(
            status_code=503,
            detail="TTS unavailable: model files could not be ensured on startup",
        )

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must not be empty")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="text too long (max 2000 chars)")

    # Offload to a worker thread: Kokoro inference is CPU-bound and would
    # otherwise freeze the event loop, head-of-line blocking every other
    # /tts request (including the greeting) behind pre-synthesis bursts.
    wav_bytes = await asyncio.to_thread(tts_engine.synth_wav, text, req.voice, req.rate)
    if wav_bytes is None:
        raise HTTPException(status_code=503, detail="TTS synthesis failed")

    return Response(content=wav_bytes, media_type="audio/wav")


@app.post("/transcribe")
async def transcribe_only(audio: UploadFile = File(...)):
    """
    Accepts an audio file and returns the exact speech-to-text transcript.
    """
    ext = ".webm" if "webm" in (audio.content_type or "") else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
        content = await audio.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    try:
        transcript = transcribe_audio_file(temp_audio_path)
        return {"success": True, "data": {"transcript": transcript}}
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)


@app.post("/analyze")
async def analyze_voice(audio: UploadFile = File(...)):
    """
    Accept an audio file (.wav/.webm), execute Faster-Whisper STT transcription,
    run PyTorch Speech Emotion Recognition model, and return combined analysis.
    """
    ext = ".webm"
    if audio.filename:
        ext = os.path.splitext(audio.filename)[1] or ".webm"
    elif audio.content_type and "wav" in audio.content_type:
        ext = ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
        content = await audio.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    transcript = "Candidate provided verbal response."
    avg_logprob = -1.0
    try:
        # 1. Faster-Whisper Speech-To-Text Transcription
        transcript, avg_logprob = transcribe_audio_file(temp_audio_path)

        # 2. Audio preprocessing for SER PyTorch model
        chunks, audio_duration_s, audio_decoded = preprocess_audio(temp_audio_path)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to process audio file: {str(e)}"
        )
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

    # 3. Emotion predictions across chunks
    avg_probs = np.zeros(len(EMOTION_LABELS))

    if model is not None:
        with torch.no_grad():
            for chunk in chunks:
                input_tensor = torch.from_numpy(chunk).float().unsqueeze(0).to(device)
                logits = model(input_tensor)
                probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                avg_probs += probs
        avg_probs /= len(chunks)
    else:
        avg_probs = np.ones(len(EMOTION_LABELS)) / len(EMOTION_LABELS)

    emotion_probs_dict = {
        EMOTION_LABELS[i]: float(round(avg_probs[i] * 100, 2))
        for i in range(len(EMOTION_LABELS))
    }
    dominant_idx = int(np.argmax(avg_probs))
    dominant_emotion = EMOTION_LABELS[dominant_idx]

    word_count = len(transcript.split()) if transcript and not transcript.startswith("Audio recorded") and not transcript.startswith("Candidate provided") else 0

    # Real filler-word count from the actual transcript (not derived from emotions)
    FILLER_PATTERN = re.compile(r"\b(um+|uh+|erm|hmm+|like|basically|actually|literally|you know|i mean|sort of|kind of)\b", re.IGNORECASE)
    filler_word_count = len(FILLER_PATTERN.findall(transcript)) if word_count >= 3 else 0

    if word_count < 3:
        # Silence or no speech input detected
        confidence_score = 0.0
        fluency_score = 0.0
        clarity_score = 0.0
        speaking_speed = 0.0
    else:
        positive_score = (
            emotion_probs_dict.get("neutral", 0)
            + emotion_probs_dict.get("calm", 0)
            + emotion_probs_dict.get("happy", 0)
        )
        negative_score = (
            emotion_probs_dict.get("fearful", 0) * 1.5
            + emotion_probs_dict.get("sad", 0) * 1.2
            + emotion_probs_dict.get("angry", 0) * 1.5
            + emotion_probs_dict.get("disgust", 0) * 1.5
        )
        confidence_score = float(np.clip(positive_score - negative_score, 0.0, 100.0))

        # Real speaking pace: words per minute measured against actual audio duration
        if audio_decoded and audio_duration_s >= 1.0:
            speaking_speed = float(np.clip(round(word_count / audio_duration_s * 60.0, 1), 60.0, 220.0))
        else:
            speaking_speed = float(round(min(180.0, max(110.0, word_count * 4.0)), 1))

        # Fluency: penalize deviation from a natural 100-160 WPM band plus real fillers
        fillers_per_10 = (filler_word_count / word_count) * 10.0
        wpm_deviation = abs(speaking_speed - 130.0)
        fluency_score = float(np.clip(98.0 - (wpm_deviation * 0.25) - (fillers_per_10 * 2.5), 40.0, 98.0))

        # Clarity: grounded in Whisper's own acoustic confidence (avg_logprob ~[-1.5, 0.3])
        if avg_logprob > -1.0:
            clarity_score = float(np.clip(70.0 + (avg_logprob + 1.0) * 30.0, 30.0, 98.0))
        else:
            clarity_score = float(np.clip(88.0 - (emotion_probs_dict.get("disgust", 0) * 0.5), 0.0, 98.0))

    result = VoiceAnalysisResult(
        transcript=transcript if word_count >= 3 else "",
        confidenceScore=round(confidence_score, 1),
        fluencyScore=round(fluency_score, 1),
        fillerWordCount=int(filler_word_count),
        speakingSpeed=speaking_speed,
        clarityScore=round(clarity_score, 1),
        emotionProbabilities=emotion_probs_dict,
        dominantEmotion=dominant_emotion,
        audioDecoded=bool(audio_decoded),
    )

    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8002))
    reload = os.getenv("UVICORN_RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
