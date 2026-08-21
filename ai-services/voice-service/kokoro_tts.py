import os
import hashlib
import pathlib
import tempfile
import urllib.request
import threading
import io

try:
    import numpy as np
except ImportError:
    np = None

# Expected byte sizes from the official kokoro-onnx model-files-v1.1 release
# (verified via HTTP HEAD on 2026-08-20). Used as an idempotency + integrity
# check so a truncated/corrupt file is never treated as a valid download.
#
# Default is the FP16 variant (kokoro-v1.0.fp16.onnx, 163,527,961 bytes):
# benchmarked on this project's dev machine it is ~5-9x faster than the INT8
# build (1220ms vs 6800ms for a short phrase; ~2s vs ~19s for a question) at
# near-identical quality (0.999 spectral correlation vs fp32, per the release).
DEFAULT_MODEL_SIZE = 163527961
DEFAULT_VOICES_SIZE = 28214398

DEFAULT_MODEL_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
    "model-files-v1.1/kokoro-v1.0.fp16.onnx"
)
DEFAULT_VOICES_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
    "model-files-v1.1/voices-v1.0.bin"
)

DEFAULT_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

_lock = threading.Lock()


def _env_or(key, default):
    return os.getenv(key, "").strip() or default


def _fetch_to_path(url, dest_path, expected_size, sha256_hex):
    """
    Download `url` to `dest_path` atomically. Verifies expected byte size and,
    if provided, a SHA-256 hex digest. Returns True on success.
    """
    dest = pathlib.Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    part_path = dest_path + ".part"
    try:
        print(f"[Kokoro TTS] Downloading {url} -> {dest_path}")
        urllib.request.urlretrieve(url, part_path)
    except Exception as e:
        print(f"[Kokoro TTS] Download failed: {e}")
        if os.path.exists(part_path):
            try:
                os.remove(part_path)
            except OSError:
                pass
        return False

    try:
        actual_size = os.path.getsize(part_path)
        if expected_size and actual_size != expected_size:
            print(
                f"[Kokoro TTS] Size mismatch for {os.path.basename(dest_path)}: "
                f"expected {expected_size}, got {actual_size} - refusing to use."
            )
            os.remove(part_path)
            return False

        if sha256_hex:
            sha = hashlib.sha256()
            with open(part_path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    sha.update(chunk)
            if sha.hexdigest().lower() != sha256_hex.lower():
                print(f"[Kokoro TTS] SHA256 mismatch for {os.path.basename(dest_path)} - refusing to use.")
                os.remove(part_path)
                return False
    except OSError as e:
        print(f"[Kokoro TTS] Verification error for {dest_path}: {e}")
        try:
            os.remove(part_path)
        except OSError:
            pass
        return False

    os.replace(part_path, dest_path)
    print(f"[Kokoro TTS] Stored model file at {dest_path} ({actual_size} bytes)")
    return True


def ensure_model_files():
    """
    Idempotently ensure Kokoro model + voices files are available locally.

    Resolution order:
      1. If KOKORO_MODEL_PATH / KOKORO_VOICES_PATH are explicitly set, use those
         exact paths as the cache target (download into them if missing).
      2. Otherwise use the default cache dir under the voice-service.

    Never raises: on any failure it logs and returns (None, None) so the service
    keeps running and the frontend can fall back to speechSynthesis.
    """
    model_path = _env_or("KOKORO_MODEL_PATH", os.path.join(DEFAULT_CACHE_DIR, "kokoro-v1.0.fp16.onnx"))
    voices_path = _env_or("KOKORO_VOICES_PATH", os.path.join(DEFAULT_CACHE_DIR, "voices-v1.0.bin"))

    model_url = _env_or("KOKORO_MODEL_URL", DEFAULT_MODEL_URL)
    voices_url = _env_or("KOKORO_VOICES_URL", DEFAULT_VOICES_URL)
    model_sha = os.getenv("KOKORO_MODEL_SHA256", "").strip()
    voices_sha = os.getenv("KOKORO_VOICES_SHA256", "").strip()
    model_size = int(os.getenv("KOKORO_MODEL_SIZE", str(DEFAULT_MODEL_SIZE)) or 0)
    voices_size = int(os.getenv("KOKORO_VOICES_SIZE", str(DEFAULT_VOICES_SIZE)) or 0)

    def file_ok(path, expected_size):
        try:
            return os.path.isfile(path) and os.path.getsize(path) == expected_size
        except OSError:
            return False

    with _lock:
        if not file_ok(model_path, model_size):
            if not _fetch_to_path(model_url, model_path, model_size, model_sha):
                return None, None
        if not file_ok(voices_path, voices_size):
            if not _fetch_to_path(voices_url, voices_path, voices_size, voices_sha):
                return None, None

    return model_path, voices_path


class TtsEngine:
    """
    Thin wrapper around kokoro-onnx with lazy model loading, an in-memory
    (text|voice|rate) cache, and WAV serialization.
    """

    def __init__(self, model_path, voices_path, voice="af_heart", cache_enabled=True, num_threads=None):
        self.model_path = model_path
        self.voices_path = voices_path
        self.default_voice = voice
        self.cache_enabled = cache_enabled
        self.num_threads = num_threads
        self._kokoro = None
        self._cache = {}
        self._load_lock = threading.Lock()
        # Bounds concurrent ONNX inference so a burst of pre-synthesis requests
        # cannot thrash CPU; cache hits bypass this entirely.
        self._infer_semaphore = threading.Semaphore(2)

    def is_ready(self):
        return self._kokoro is not None

    def _load(self):
        with self._load_lock:
            if self._kokoro is not None:
                return self._kokoro
            try:
                from kokoro_onnx import Kokoro
            except ImportError as e:
                print(f"[Kokoro TTS] kokoro-onnx not installed: {e}")
                return None
            try:
                session = None
                if self.num_threads:
                    import onnxruntime as ort
                    sess_options = ort.SessionOptions()
                    sess_options.intra_op_num_threads = self.num_threads
                    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                    session = ort.InferenceSession(self.model_path, sess_options=sess_options)
                    kokoro = Kokoro.from_session(session, self.voices_path)
                else:
                    kokoro = Kokoro(self.model_path, self.voices_path)
            except Exception as e:
                print(f"[Kokoro TTS] Failed to load model: {e}")
                return None
            self._kokoro = kokoro
            print("[Kokoro TTS] Model loaded successfully")
            return kokoro

    def list_voices(self):
        kokoro = self._load()
        if kokoro is None:
            return []
        try:
            return sorted(kokoro.get_voices())
        except Exception as e:
            print(f"[Kokoro TTS] Failed to list voices: {e}")
            return []

    def synth_wav(self, text, voice=None, speed=1.0):
        """
        Synthesize `text` and return WAV bytes (16-bit PCM, Kokoro sample rate).
        Returns None if synthesis is unavailable.
        """
        voice = voice or self.default_voice
        cache_key = (text, voice, float(speed))

        if self.cache_enabled and cache_key in self._cache:
            return self._cache[cache_key]

        kokoro = self._load()
        if kokoro is None:
            return None

        try:
            with self._infer_semaphore:
                samples, sample_rate = kokoro.create(text=text, voice=voice, speed=float(speed), lang="en-us")
        except Exception as e:
            print(f"[Kokoro TTS] Synthesis failed: {e}")
            return None

        if samples is None or len(samples) == 0:
            return None

        wav_bytes = _float32_to_wav(samples, sample_rate)
        if self.cache_enabled:
            self._cache[cache_key] = wav_bytes
        return wav_bytes


def _float32_to_wav(samples, sample_rate):
    """Convert float32 samples in [-1, 1] to a 16-bit PCM WAV file in memory."""
    if np is None:
        return None
    samples = np.asarray(samples, dtype=np.float32)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")

    num_channels = 1
    bytes_per_sample = 2
    data_size = pcm.nbytes

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write((36 + data_size).to_bytes(4, "little"))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write((16).to_bytes(4, "little"))
    buf.write((1).to_bytes(2, "little"))  # PCM
    buf.write((num_channels).to_bytes(2, "little"))
    buf.write((sample_rate).to_bytes(4, "little"))
    buf.write((sample_rate * num_channels * bytes_per_sample).to_bytes(4, "little"))
    buf.write((num_channels * bytes_per_sample).to_bytes(2, "little"))
    buf.write((bytes_per_sample * 8).to_bytes(2, "little"))
    buf.write(b"data")
    buf.write(data_size.to_bytes(4, "little"))
    buf.write(pcm.tobytes())
    return buf.getvalue()