# AI Interview Practice Platform

A real-time AI-powered interview simulator with facial analysis, voice analysis, NLP answer scoring, and a comprehensive performance report.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, Tailwind CSS, Zustand, React Router v6 |
| Backend | Node.js, Express.js, MongoDB Atlas, BullMQ + Redis |
| AI Services | Python FastAPI (×5 microservices) |
| Media Storage | Cloudinary |
| Async Queues | BullMQ + Redis |

## Project Structure

```
/
├── frontend/                # React Vite app (port 5173)
│   └── src/
│       ├── pages/           # Route-level page components
│       ├── components/      # Reusable UI components
│       ├── store/           # Zustand state stores
│       ├── hooks/           # Custom React hooks
│       ├── utils/           # Utility helpers
│       └── api/             # Axios API client + endpoints
│
├── backend/                 # Node/Express API (port 5000)
│   ├── routes/              # Express route definitions
│   ├── controllers/         # Request handlers
│   ├── models/              # Mongoose schemas
│   ├── middleware/          # Auth, error, validation middleware
│   ├── jobs/                # BullMQ worker jobs
│   ├── services/            # External API integrations
│   └── utils/               # Shared helpers
│
├── ai-services/
│   ├── face-service/        # Facial analysis — DeepFace/MediaPipe (port 8001)
│   ├── voice-service/       # Voice/transcript — Whisper + Librosa (port 8002)
│   ├── nlp-service/         # NLP answer scoring — GPT-4o/Claude (port 8003)
│   ├── question-service/    # Question + TTS generation (port 8004)
│   └── report-service/      # Report generation — GPT-4o/Claude (port 8005)
│
└── docker-compose.yml
```

## Quick Start (Local Dev)

### 1. Start infrastructure (Redis + MongoDB)
```bash
docker-compose up redis mongo -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT secrets etc.
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 4. AI Services (each in a separate terminal, Python 3.11+)
```bash
cd ai-services/question-service
pip install -r requirements.txt
cp .env.example .env    # fill in OPENAI_API_KEY
python main.py
```

Repeat for any other AI services you need running locally.

## Environment Variables

See `.env.example` at root and each service's `.env.example` for required variables.

## API Ports

| Service | Port |
|---------|------|
| Backend (Node) | 5000 |
| Face Service | 8001 |
| Voice Service | 8002 |
| NLP Service | 8003 |
| Question Service | 8004 |
| Report Service | 8005 |
| Frontend (dev) | 5173 |

## Build Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project Setup | ✅ Done |
| 2 | Auth System | 🔜 Next |
| 3 | Dashboard + Setup | 🔜 |
| 4 | Live Interview | 🔜 |
| 5 | AI Analysis Services | 🔜 |
| 6 | Writing Test | 🔜 |
| 7 | Report Generation | 🔜 |
| 8 | History + Profile | 🔜 |
| 9 | Polish | 🔜 |
| 10 | Deploy | 🔜 |
