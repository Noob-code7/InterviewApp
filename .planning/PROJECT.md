# AI Interview Practice Platform

## What This Is
A real-time AI-powered interview simulator where the user sits in front of their camera and microphone, listens to AI-generated voice questions, and responds verbally. The platform analyzes facial expressions, voice confidence, and spoken answer quality. It includes an email writing test and generates a comprehensive performance report.

## Target Users
College students, freshers, job seekers preparing for HR + technical interview rounds.

## Core Value
Provides realistic, high-pressure interview practice with objective AI feedback on both technical answers and behavioral signals (confidence, eye contact, fluency).

## Context & Constraints
- Frontend: React.js (Vite), Tailwind CSS, Zustand
- Backend: Node.js + Express.js, MongoDB Atlas
- AI Services: Python FastAPI microservices (Face, Voice, NLP, Question, Report)
- Media: MediaStream API, Web Audio API
- Async: BullMQ + Redis

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate Python microservices for AI | AI tasks (DeepFace, Librosa, Whisper) require Python ecosystem; keeping them separate from Node backend ensures scalability | — |
| BullMQ for async processing | Audio/video analysis takes time; async queues prevent blocking the main backend thread | — |
