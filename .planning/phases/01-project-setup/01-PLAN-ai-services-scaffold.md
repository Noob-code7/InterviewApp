---
id: 01-PLAN-ai-services-scaffold
wave: 1
depends_on: []
files_modified:
  - ai-services/face-service/main.py
  - ai-services/face-service/requirements.txt
  - ai-services/voice-service/main.py
  - ai-services/voice-service/requirements.txt
  - ai-services/nlp-service/main.py
  - ai-services/nlp-service/requirements.txt
  - ai-services/question-service/main.py
  - ai-services/question-service/requirements.txt
  - ai-services/report-service/main.py
  - ai-services/report-service/requirements.txt
  - ai-services/shared/models.py
autonomous: true
requirements:
  - REQ-platform-arch
  - REQ-ai-microservices
---

# Plan: AI Microservices Scaffold (Python FastAPI)

## Goal
Create 5 FastAPI microservice stubs — face-service (8001), voice-service (8002), nlp-service (8003), question-service (8004), report-service (8005). Each has a GET /health and primary POST endpoint stub, a requirements.txt, and a .env.example. Real AI logic is in Phase 5.

## Tasks

<task id="3.1">
  <title>Create shared models</title>
  <action>
    Create ai-services/shared/__init__.py (empty).
    Create ai-services/shared/models.py:
    ```python
    from pydantic import BaseModel
    from typing import Any

    class SuccessResponse(BaseModel):
        success: bool = True
        data: Any

    class ErrorResponse(BaseModel):
        success: bool = False
        error: str
    ```
  </action>
  <acceptance_criteria>
    - ai-services/shared/models.py exists and contains `SuccessResponse`
  </acceptance_criteria>
</task>

<task id="3.2">
  <title>Create face-service stub (port 8001)</title>
  <read_first>
    - ai-services/shared/models.py
  </read_first>
  <action>
    Create ai-services/face-service/requirements.txt with: fastapi==0.111.0, uvicorn[standard]==0.29.0, python-dotenv==1.0.1, python-multipart==0.0.9, pydantic==2.7.1, deepface==0.0.93, opencv-python-headless==4.9.0.80, numpy==1.26.4

    Create ai-services/face-service/.env.example: PORT=8001

    Create ai-services/face-service/main.py with FastAPI app on port 8001 with GET /health and POST /analyze endpoints. The /analyze endpoint accepts a video file upload and returns a stub FaceAnalysisResult with confidenceScore, nervousnessScore, attentionScore, eyeContactScore, notes fields all set to 0/stub values.
  </action>
  <acceptance_criteria>
    - ai-services/face-service/main.py exists and contains `FastAPI(`
    - ai-services/face-service/main.py contains `@app.get("/health")`
    - ai-services/face-service/main.py contains `@app.post("/analyze")`
    - ai-services/face-service/requirements.txt contains `fastapi`
    - ai-services/face-service/.env.example contains `PORT=8001`
  </acceptance_criteria>
</task>

<task id="3.3">
  <title>Create voice-service stub (port 8002)</title>
  <action>
    Create ai-services/voice-service/requirements.txt with: fastapi==0.111.0, uvicorn[standard]==0.29.0, python-dotenv==1.0.1, python-multipart==0.0.9, pydantic==2.7.1, openai-whisper==20231117, librosa==0.10.2, soundfile==0.12.1, numpy==1.26.4, torch==2.3.0

    Create ai-services/voice-service/.env.example: PORT=8002, OPENAI_API_KEY=

    Create ai-services/voice-service/main.py with FastAPI app on port 8002 with GET /health and POST /analyze. The /analyze endpoint accepts an audio file and returns a stub VoiceAnalysisResult with transcript, confidenceScore, fluencyScore, nervousnessScore, fillerWordCount, speakingSpeed, clarityScore.
  </action>
  <acceptance_criteria>
    - ai-services/voice-service/main.py exists and contains `@app.post("/analyze")`
    - ai-services/voice-service/requirements.txt contains `openai-whisper`
    - ai-services/voice-service/.env.example contains `PORT=8002`
  </acceptance_criteria>
</task>

<task id="3.4">
  <title>Create nlp-service stub (port 8003)</title>
  <action>
    Create ai-services/nlp-service/requirements.txt: fastapi==0.111.0, uvicorn[standard]==0.29.0, python-dotenv==1.0.1, pydantic==2.7.1, openai==1.30.1, anthropic==0.26.1

    Create ai-services/nlp-service/.env.example: PORT=8003, OPENAI_API_KEY=, ANTHROPIC_API_KEY=, AI_PROVIDER=openai

    Create ai-services/nlp-service/main.py with FastAPI app on port 8003. GET /health, POST /analyze accepting {question: str, transcript: str} body and returning stub NLPAnalysisResult with relevanceScore, structureScore, grammarScore, completenessScore, feedback.
  </action>
  <acceptance_criteria>
    - ai-services/nlp-service/main.py exists and contains `@app.post("/analyze")`
    - ai-services/nlp-service/requirements.txt contains `openai`
    - ai-services/nlp-service/.env.example contains `PORT=8003`
  </acceptance_criteria>
</task>

<task id="3.5">
  <title>Create question-service stub (port 8004)</title>
  <action>
    Create ai-services/question-service/requirements.txt: fastapi==0.111.0, uvicorn[standard]==0.29.0, python-dotenv==1.0.1, pydantic==2.7.1, openai==1.30.1, anthropic==0.26.1, google-cloud-texttospeech==2.16.3, aiofiles==23.2.1

    Create ai-services/question-service/.env.example: PORT=8004, OPENAI_API_KEY=, ANTHROPIC_API_KEY=, AI_PROVIDER=openai, GOOGLE_TTS_KEY=

    Create ai-services/question-service/main.py with FastAPI app on port 8004. GET /health, POST /generate accepting {role, type, count} and returning a list of stub questions, POST /tts accepting {text} and returning a stub audioUrl.
  </action>
  <acceptance_criteria>
    - ai-services/question-service/main.py contains `@app.post("/generate")`
    - ai-services/question-service/main.py contains `@app.post("/tts")`
    - ai-services/question-service/.env.example contains `PORT=8004`
  </acceptance_criteria>
</task>

<task id="3.6">
  <title>Create report-service stub (port 8005)</title>
  <action>
    Create ai-services/report-service/requirements.txt: fastapi==0.111.0, uvicorn[standard]==0.29.0, python-dotenv==1.0.1, pydantic==2.7.1, openai==1.30.1, anthropic==0.26.1

    Create ai-services/report-service/.env.example: PORT=8005, OPENAI_API_KEY=, ANTHROPIC_API_KEY=, AI_PROVIDER=openai

    Create ai-services/report-service/main.py with FastAPI app on port 8005. GET /health, POST /generate accepting {allAnswerAnalyses, writingAnalysis} and returning stub ReportResult with overallScore, strengths, weaknesses, behavioralInsights, recommendations.
  </action>
  <acceptance_criteria>
    - ai-services/report-service/main.py contains `@app.post("/generate")`
    - ai-services/report-service/.env.example contains `PORT=8005`
  </acceptance_criteria>
</task>

## Verification

```bash
python -m py_compile ai-services/face-service/main.py && echo "face-service OK"
python -m py_compile ai-services/voice-service/main.py && echo "voice-service OK"
python -m py_compile ai-services/nlp-service/main.py && echo "nlp-service OK"
python -m py_compile ai-services/question-service/main.py && echo "question-service OK"
python -m py_compile ai-services/report-service/main.py && echo "report-service OK"
```

## must_haves
- [ ] All 5 service main.py files exist with correct port assignments
- [ ] Every service has GET /health and primary POST endpoint
- [ ] All requirements.txt and .env.example files present
