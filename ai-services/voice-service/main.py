import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Voice Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class VoiceAnalysisResult(BaseModel):
    transcript: str
    confidenceScore: float
    fluencyScore: float
    nervousnessScore: float
    fillerWordCount: int
    speakingSpeed: float  # words per minute
    clarityScore: float


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "voice-service", "port": 8002}}


@app.post("/analyze")
async def analyze_voice(audio: UploadFile = File(...)):
    """
    Accept an audio file (.wav/.webm), run Whisper for transcript + Librosa for audio features.
    STUB: Returns placeholder scores. Real implementation in Phase 5.
    """
    allowed = ["audio/wav", "audio/webm", "audio/mpeg", "audio/ogg", "audio/webm;codecs=opus"]
    if audio.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {audio.content_type}"
        )

    # Placeholder — Phase 5 implements real Whisper + Librosa logic
    result = VoiceAnalysisResult(
        transcript="Stub transcript — real Whisper transcription in Phase 5",
        confidenceScore=0.0,
        fluencyScore=0.0,
        nervousnessScore=0.0,
        fillerWordCount=0,
        speakingSpeed=0.0,
        clarityScore=0.0,
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8002))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
