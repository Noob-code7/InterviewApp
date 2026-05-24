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
    faceSubstitutionAlert: bool


def compute_confidence(emotion_dict):
    high = (emotion_dict.get("neutral",  0)
          + emotion_dict.get("happy",    0)
          + emotion_dict.get("surprise", 0) * 0.5)
    low  = (emotion_dict.get("fear",    0)
          + emotion_dict.get("sad",     0)
          + emotion_dict.get("angry",   0)
          + emotion_dict.get("disgust", 0))
    return max(0, min(100, int(high - low)))


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "face-service", "port": 8001}}


@app.post("/analyze")
async def analyze_face(video: UploadFile = File(...), reference_image: UploadFile = File(None)):
    """
    Accept a video file and an optional reference image.
    Extract frames, run DeepFace analysis for emotions and identity verification.
    """
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Save video
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
        content = await video.read()
        temp_video.write(content)
        temp_video_path = temp_video.name

    ref_img_path = None
    if reference_image:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_ref:
            ref_content = await reference_image.read()
            temp_ref.write(ref_content)
            ref_img_path = temp_ref.name

    cap = cv2.VideoCapture(temp_video_path)
    if not cap.isOpened():
        os.remove(temp_video_path)
        if ref_img_path: os.remove(ref_img_path)
        raise HTTPException(status_code=400, detail="Could not open video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30  # Default fallback
        
    frame_interval = int(fps) # Sample 1 frame per second
    
    total_frames_analyzed = 0
    faces_detected_count = 0
    
    confidence_scores = []
    nervousness_scores = []
    
    substitution_flags = 0
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_idx % frame_interval == 0:
            total_frames_analyzed += 1
            print(f"Analyzing frame {frame_idx}")
            try:
                # Emotion Analysis
                res = DeepFace.analyze(frame, actions=["emotion"], enforce_detection=True, silent=True)
                if isinstance(res, list):
                    face_info = res[0]
                else:
                    face_info = res
                    
                faces_detected_count += 1
                raw_emotions = face_info.get("emotion", {})
                
                # Calculate metrics for this frame
                score = compute_confidence(raw_emotions)
                confidence_scores.append(score)
                
                # Nervousness is roughly the inverse/negative emotions
                nervousness = raw_emotions.get("fear", 0) + raw_emotions.get("sad", 0) + raw_emotions.get("angry", 0)
                nervousness_scores.append(nervousness)
                
                # Identity Verification (if reference provided)
                if ref_img_path:
                    try:
                        verify_res = DeepFace.verify(
                            frame,
                            ref_img_path,
                            enforce_detection=False,
                            silent=True
                        )
                        if not verify_res.get("verified", False):
                            substitution_flags += 1
                    except Exception as e:
                        # If verification completely fails (e.g., face not found by verify model), flag it
                        substitution_flags += 1

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
    if ref_img_path and os.path.exists(ref_img_path):
        os.remove(ref_img_path)

    # Calculate final metrics
    if total_frames_analyzed == 0:
        total_frames_analyzed = 1 # avoid div zero
        
    attentionScore = (faces_detected_count / total_frames_analyzed) * 100.0
    eyeContactScore = attentionScore * 0.95 # Proxy correlation for now
    
    if len(confidence_scores) > 0:
        confidenceScore = sum(confidence_scores) / len(confidence_scores)
        nervousnessScore = sum(nervousness_scores) / len(nervousness_scores)
    else:
        confidenceScore = 0.0
        nervousnessScore = 0.0

    # Ensure bounds
    confidenceScore = max(0.0, min(100.0, confidenceScore))
    nervousnessScore = max(0.0, min(100.0, nervousnessScore))

    # Alert if substitution detected in more than 20% of the detected frames
    faceSubstitutionAlert = False
    if faces_detected_count > 0 and (substitution_flags / faces_detected_count) > 0.20:
        faceSubstitutionAlert = True

    notes = []
    if faceSubstitutionAlert:
        notes.append("CRITICAL: Face substitution or multiple different faces detected during the answer.")
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
        faceSubstitutionAlert=faceSubstitutionAlert
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
