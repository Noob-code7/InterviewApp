import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Literal

load_dotenv()

app = FastAPI(title="Question Generation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionGenerateRequest(BaseModel):
    role: str
    type: Literal["hr", "technical", "mixed"]
    count: int = 5


class TTSRequest(BaseModel):
    text: str


class Question(BaseModel):
    id: str
    text: str
    type: str


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "question-service", "port": 8004}}


@app.post("/generate")
async def generate_questions(body: QuestionGenerateRequest):
    """
    Generate interview questions using GPT-4o or Claude API.
    STUB: Returns placeholder questions. Real implementation in Phase 5.
    """
    if body.count < 1 or body.count > 20:
        raise HTTPException(status_code=400, detail="count must be between 1 and 20")

    questions = [
        Question(
            id=f"q{i + 1}",
            text=f"Stub question {i + 1} for {body.role} role ({body.type} type)",
            type=body.type
        )
        for i in range(body.count)
    ]
    return {"success": True, "data": {"questions": [q.model_dump() for q in questions]}}


@app.post("/tts")
async def text_to_speech(body: TTSRequest):
    """
    Convert question text to speech audio URL using Google TTS or ElevenLabs.
    STUB: Returns placeholder URL. Real implementation in Phase 5.
    """
    if not body.text:
        raise HTTPException(status_code=400, detail="text is required")

    return {
        "success": True,
        "data": {"audioUrl": "https://stub-audio-placeholder.example.com/audio.mp3"}
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8004))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
