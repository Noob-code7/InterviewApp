import os
import cv2
import tempfile
import numpy as np
from typing import Optional
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
    neutral = emotion_dict.get("neutral", 0)
    happy = emotion_dict.get("happy", 0)
    surprise = emotion_dict.get("surprise", 0)

    # Heavily penalize negative, distorted, or distressed facial expressions
    negative = (
        emotion_dict.get("fear", 0) * 1.2 +
        emotion_dict.get("sad", 0) * 1.2 +
        emotion_dict.get("angry", 0) * 1.5 +
        emotion_dict.get("disgust", 0) * 1.5
    )

    score = (neutral * 0.7 + happy * 0.9 + surprise * 0.3) - negative
    return max(0.0, min(100.0, float(score)))


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "face-service", "port": 8001}}


@app.post("/analyze")
async def analyze_face(
    video: UploadFile = File(...),
    reference_image: Optional[UploadFile] = File(None)
):
    """
    Accept a video file and an optional reference image.
    Extract frames, run DeepFace analysis for emotions and identity verification.
    Rigorous detection checking: penalizes missing face or distorted expressions.
    """
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Save video
    video_ext = os.path.splitext(video.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=video_ext) as temp_video:
        content = await video.read()
        temp_video.write(content)
        temp_video_path = temp_video.name

    ref_img_path = None
    ref_img_rgb = None
    if reference_image and hasattr(reference_image, "filename") and reference_image.filename:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_ref:
            ref_content = await reference_image.read()
            temp_ref.write(ref_content)
            ref_img_path = temp_ref.name
        
        ref_bgr = cv2.imread(ref_img_path)
        if ref_bgr is not None:
            ref_img_rgb = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2RGB)

    try:
        cap = cv2.VideoCapture(temp_video_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30
            
        sampling_interval_sec = float(os.getenv("FACE_SAMPLING_INTERVAL_SEC", "2.0"))
        frame_interval = max(1, int(fps * sampling_interval_sec))  # Sample 0.5 FPS (1 frame every 2 seconds)
        
        total_frames_analyzed = 0
        faces_detected_count = 0
        
        confidence_scores = []
        nervousness_scores = []
        substitution_flags = 0
        notes = []
        
        frame_idx = 0
        while True:
            ret, frame_bgr = cap.read()
            if not ret:
                break
                
            if frame_idx % frame_interval == 0:
                total_frames_analyzed += 1
                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                
                try:
                    res = DeepFace.analyze(frame_rgb, actions=["emotion"], enforce_detection=False, silent=True)
                    if isinstance(res, list):
                        face_info = res[0]
                    else:
                        face_info = res

                    region = face_info.get("region", {})
                    w = region.get("w", 0)
                    h = region.get("h", 0)

                    # Verify a real face was located in the frame
                    if w > 10 and h > 10:
                        faces_detected_count += 1
                        raw_emotions = face_info.get("emotion", {})
                        
                        score = compute_confidence(raw_emotions)
                        confidence_scores.append(score)
                        
                        nervousness = (
                            raw_emotions.get("fear", 0) +
                            raw_emotions.get("sad", 0) +
                            raw_emotions.get("angry", 0) +
                            raw_emotions.get("disgust", 0)
                        )
                        nervousness_scores.append(nervousness)

                        if raw_emotions.get("angry", 0) > 25 or raw_emotions.get("disgust", 0) > 25:
                            notes.append("Distorted or tense facial expression detected during response.")
                        if raw_emotions.get("fear", 0) > 30:
                            notes.append("Elevated candidate facial anxiety detected.")
                        
                        # Identity Verification against reference image
                        if ref_img_rgb is not None:
                            try:
                                verify_res = DeepFace.verify(
                                    frame_rgb,
                                    ref_img_rgb,
                                    enforce_detection=False,
                                    silent=True
                                )
                                if not verify_res.get("verified", False):
                                    substitution_flags += 1
                            except Exception:
                                substitution_flags += 1
                    else:
                        notes.append("Face not clearly centered in camera frame.")

                except Exception as e:
                    print("Face processing error on frame:", e)
                    
            frame_idx += 1

        cap.release()

    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
        if ref_img_path and os.path.exists(ref_img_path):
            os.remove(ref_img_path)

    # Calculate final metrics
    if total_frames_analyzed == 0:
        total_frames_analyzed = 1
        
    attentionScore = (faces_detected_count / total_frames_analyzed) * 100.0
    eyeContactScore = attentionScore * 0.90
    
    if faces_detected_count > 0 and len(confidence_scores) > 0:
        confidenceScore = sum(confidence_scores) / len(confidence_scores)
        nervousnessScore = sum(nervousness_scores) / len(nervousness_scores)
    else:
        confidenceScore = 0.0
        nervousnessScore = 50.0
        notes.append("No face detected in video telemetry stream.")

    confidenceScore = max(0.0, min(100.0, confidenceScore))
    nervousnessScore = max(0.0, min(100.0, nervousnessScore))

    face_substitution_alert = False
    if faces_detected_count > 0 and substitution_flags / faces_detected_count > 0.3:
        face_substitution_alert = True
        notes.append("🚨 Face substitution alert: Identity mismatch detected across frames.")

    unique_notes = list(dict.fromkeys(notes))
    if not unique_notes:
        if confidenceScore >= 70:
            unique_notes.append("Candidate maintained stable eye posture and calm posture.")
        else:
            unique_notes.append("Candidate showed posture fluctuations during recording.")

    result = FaceAnalysisResult(
        confidenceScore=round(confidenceScore, 1),
        nervousnessScore=round(nervousnessScore, 1),
        attentionScore=round(attentionScore, 1),
        eyeContactScore=round(eyeContactScore, 1),
        notes=unique_notes,
        faceSubstitutionAlert=face_substitution_alert
    )

    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
