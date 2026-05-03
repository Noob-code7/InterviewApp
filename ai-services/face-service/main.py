import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Face Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class FaceAnalysisResult(BaseModel):
    confidenceScore: float
    nervousnessScore: float
    attentionScore: float
    eyeContactScore: float
    notes: list[str]


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "face-service", "port": 8001}}


@app.post("/analyze")
async def analyze_face(video: UploadFile = File(...)):
    """
    Accept a video file, extract frames, run DeepFace/MediaPipe analysis.
    STUB: Returns placeholder scores. Real implementation in Phase 5.
    """
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Placeholder — Phase 5 implements real DeepFace logic
    result = FaceAnalysisResult(
        confidenceScore=0.0,
        nervousnessScore=0.0,
        attentionScore=0.0,
        eyeContactScore=0.0,
        notes=["Stub response — real analysis implemented in Phase 5"],
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
