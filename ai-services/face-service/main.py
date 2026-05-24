import os
import cv2
import tempfile
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from deepface import DeepFace

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
    Accept a video file, extract frames, run DeepFace analysis.
    """
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Set up temp file to save the uploaded video
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
        content = await video.read()
        temp_video.write(content)
        temp_video_path = temp_video.name

    cap = cv2.VideoCapture(temp_video_path)
    if not cap.isOpened():
        os.remove(temp_video_path)
        raise HTTPException(status_code=400, detail="Could not open video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30  # Default fallback
        
    frame_interval = int(fps) # Sample 1 frame per second
    
    total_frames_analyzed = 0
    faces_detected_count = 0
    emotions = {
        "happy": 0, "neutral": 0, "sad": 0, "fear": 0, "angry": 0, "surprise": 0, "disgust": 0
    }
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_idx % frame_interval == 0:
            total_frames_analyzed += 1
            print(f"Analyzing frame {frame_idx}")
            try:
                # With enforce_detection=True it throws exception if no face is found
                res = DeepFace.analyze(frame, actions=["emotion"], enforce_detection=True)
                print(f"DeepFace res: {res}")
                # res is usually a list of faces. We'll just look at the first (main) face.
                if isinstance(res, list):
                    face_info = res[0]
                else:
                    face_info = res
                faces_detected_count += 1
                dom_emotion = face_info.get("dominant_emotion")
                if dom_emotion in emotions:
                    emotions[dom_emotion] += 1
                elif dom_emotion:
                    emotions[dom_emotion] = 1

            except ValueError as e:
                # No face detected in this frame
                print("Face Error:", e)
                pass
            except Exception as e:
                print("Other Error:", e)
                pass
                
        frame_idx += 1

    cap.release()
    if os.path.exists(temp_video_path):
        os.remove(temp_video_path)

    # Calculate metrics
    if total_frames_analyzed == 0:
        total_frames_analyzed = 1 # avoid div zero
        
    attentionScore = (faces_detected_count / total_frames_analyzed) * 100.0
    eyeContactScore = attentionScore * 0.95 # Proxy correlation for now
    
    # Confidence correlates positively with happy/neutral, negatively with fear/sad/angry
    positive_frames = emotions.get("happy", 0) + emotions.get("neutral", 0)
    negative_frames = emotions.get("fear", 0) + emotions.get("sad", 0) + emotions.get("angry", 0)
    
    if faces_detected_count > 0:
        confidenceScore = 50.0 + ((positive_frames - negative_frames) / faces_detected_count) * 50.0
        nervousnessScore = (negative_frames / faces_detected_count) * 100.0
    else:
        confidenceScore = 0.0
        nervousnessScore = 0.0

    # Ensure bounds
    confidenceScore = max(0.0, min(100.0, confidenceScore))
    nervousnessScore = max(0.0, min(100.0, nervousnessScore))

    notes = []
    if attentionScore < 50:
        notes.append("Candidate was frequently away from the camera or not looking forward.")
    if nervousnessScore > 50:
        notes.append("Candidate displayed signs of stress or negative emotions.")
    if confidenceScore > 75:
        notes.append("Candidate appeared very confident and calm.")

    if not notes and faces_detected_count > 0:
        notes.append("Good eye contact and maintained attention throughout.")

    result = FaceAnalysisResult(
        confidenceScore=round(confidenceScore, 1),
        nervousnessScore=round(nervousnessScore, 1),
        attentionScore=round(attentionScore, 1),
        eyeContactScore=round(eyeContactScore, 1),
        notes=notes,
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
