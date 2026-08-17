# AI Interview Practice Platform

## What This Is
A real-time AI-powered interview simulator where the user sits in front of their camera and microphone, listens to AI-generated voice questions, and responds verbally. The platform analyzes facial expressions (DeepFace), voice confidence/emotion (PyTorch), full answer speech-to-text (Faster-Whisper), answer quality evaluation, writing proficiency, and grounded resume-based interviews.

## Target Users
College students, freshers, job seekers preparing for HR, technical, and resume-grounded interview rounds (scaled for hundreds of concurrent candidates).

## Core Value
Provides realistic, high-pressure interview practice with objective AI feedback on both technical answers, resume claims, and behavioral signals (confidence, eye contact, fluency).

## Context & Constraints
- Frontend: React.js (Vite), Tailwind CSS, Zustand
- Backend: Node.js + Express.js, MongoDB Atlas
- Media Storage: Cloudflare R2 (S3-compatible presigned uploads, zero local filesystem production dependency)
- AI Services: Python FastAPI microservices (Face Emotion, Voice Emotion, Faster-Whisper STT, Answer Evaluator, Resume Grounded Question Generator, Report Engine)
- Async Job Engine: BullMQ + Redis

## Milestone History
- **Milestone 1 (MVP)**: Initial prototype with local file media, basic auth, live interview room, and report UI.
- **Milestone 2 (Production Scale & AI Intelligence)**: Cloudflare R2 object storage, Faster-Whisper STT, LLM answer evaluation, structured resume parsing & question grounding, database result aggregation, typography polish, and end-to-end load/resilience testing.
