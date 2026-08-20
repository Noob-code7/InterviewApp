Manual startup commands (all from repo root C:\Workspace\Workspace\InterviewApp)
1. MongoDB (already running as native service — if you need to restart):
net start MongoDB   (or the MongoDB Windows service name)

2. Backend (backend folder):
cd backend
npm run dev        # or: npm start

3. Voice service (ai-services\voice-service) — Kokoro TTS + SER + STT:
cd ai-services\voice-service
python -m uvicorn main:app --host 0.0.0.0 --port 8002

4. NLP service (ai-services\nlp-service):
cd ai-services\nlp-service
python -m uvicorn main:app --host 0.0.0.0 --port 8003

5. Face service (ai-services\face-service):
cd ai-services\face-service
python -m uvicorn main:app --host 0.0.0.0 --port 8001

6. Frontend (frontend folder):
cd frontend
npm run dev

7. Redis (optional) — needed only for BullMQ job queues:
- Start Docker Desktop, then: docker compose up redis — or run a local redis-server on 6379.