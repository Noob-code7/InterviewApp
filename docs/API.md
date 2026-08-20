# Core REST API Specification — InterviewAI

## 1. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new student or faculty account | No |
| `POST` | `/api/auth/login` | Authenticate user & set secure HTTP-only JWT cookie | No |
| `POST` | `/api/auth/logout` | Clear authentication cookie | Yes |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & permissions | Yes |

---

## 2. Interview & Session Endpoints (`/api/sessions`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/sessions` | Create interview session (Track, Subject, Q Count, Writing Opt-In) | Yes |
| `GET` | `/api/sessions/:id` | Fetch session state and question list | Yes |
| `POST` | `/api/sessions/:id/answers` | Submit candidate answer transcript and media URL | Yes |
| `POST` | `/api/sessions/upload-resume` | Upload PDF/DOCX resume & generate personalized questions | Yes |
| `GET` | `/api/sessions/history` | List all historical interview sessions for current user | Yes |

---

## 3. Multi-Modal Analysis Endpoints (`/api/analysis`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/analysis/:id/process` | Trigger parallelized multi-modal AI evaluation (Face, Voice, NLP) | Yes |
| `GET` | `/api/reports/:id` | Fetch full aggregated performance report & breakdown | Yes |

---

## 4. TTS Proxy Endpoints (`/api/tts`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tts/synthesize` | Proxy request to Kokoro-82M voice-service; streams WAV audio | Yes |
