---
id: 01-PLAN-root-config
wave: 2
depends_on:
  - 01-PLAN-frontend-scaffold
  - 01-PLAN-backend-scaffold
  - 01-PLAN-ai-services-scaffold
files_modified:
  - .env.example
  - .gitignore
  - README.md
  - docker-compose.yml
autonomous: true
requirements:
  - REQ-platform-arch
---

# Plan: Root Configuration & docker-compose

## Goal
Create the root-level .gitignore, README.md, a root .env.example, and a docker-compose.yml that wires Redis + MongoDB for local development. This is the glue that makes the full stack runnable with a single `docker-compose up`.

## Tasks

<task id="4.1">
  <title>Create root .gitignore</title>
  <action>
    Create .gitignore at workspace root:
    ```
    # Dependencies
    node_modules/
    __pycache__/
    *.pyc
    .venv/
    venv/

    # Build outputs
    dist/
    build/
    *.egg-info/

    # Environment files
    .env
    .env.local
    .env.*.local

    # Logs
    *.log
    npm-debug.log*

    # OS
    .DS_Store
    Thumbs.db

    # IDE
    .vscode/
    .idea/

    # Docker volumes
    mongo-data/
    redis-data/
    ```
  </action>
  <acceptance_criteria>
    - .gitignore exists at workspace root
    - .gitignore contains `node_modules/`
    - .gitignore contains `.env`
    - .gitignore contains `__pycache__/`
  </acceptance_criteria>
</task>

<task id="4.2">
  <title>Create root .env.example</title>
  <read_first>
    - backend/.env.example
    - ai-services/nlp-service/.env.example
  </read_first>
  <action>
    Create .env.example at workspace root (for reference — each service has its own .env):
    ```
    # ==============================================
    # AI Interview Practice Platform — Environment
    # ==============================================
    # Copy to .env and fill in values.
    # Each service (backend/, frontend/, ai-services/*/)
    # also has its own .env.example.

    # --- Backend ---
    PORT=5000
    MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/interviewapp
    JWT_ACCESS_SECRET=change_me_access_secret_min_32_chars
    JWT_REFRESH_SECRET=change_me_refresh_secret_min_32_chars
    JWT_ACCESS_EXPIRES=15m
    JWT_REFRESH_EXPIRES=7d
    FRONTEND_URL=http://localhost:5173
    REDIS_URL=redis://localhost:6379

    # --- Cloudinary (media storage) ---
    CLOUDINARY_CLOUD_NAME=
    CLOUDINARY_API_KEY=
    CLOUDINARY_API_SECRET=

    # --- AI Services ---
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-ant-...
    AI_PROVIDER=openai
    GOOGLE_TTS_KEY=

    # --- Frontend ---
    VITE_API_URL=http://localhost:5000
    ```
  </action>
  <acceptance_criteria>
    - .env.example exists at workspace root
    - .env.example contains `MONGODB_URI`
    - .env.example contains `OPENAI_API_KEY`
    - .env.example contains `REDIS_URL`
  </acceptance_criteria>
</task>

<task id="4.3">
  <title>Create docker-compose.yml for local dev (Redis + MongoDB)</title>
  <action>
    Create docker-compose.yml at workspace root:
    ```yaml
    version: '3.9'

    services:
      # ─── Infrastructure ───────────────────────────────
      redis:
        image: redis:7-alpine
        container_name: interview_redis
        ports:
          - "6379:6379"
        volumes:
          - redis-data:/data
        command: redis-server --appendonly yes
        healthcheck:
          test: ["CMD", "redis-cli", "ping"]
          interval: 10s
          timeout: 5s
          retries: 5

      mongo:
        image: mongo:7
        container_name: interview_mongo
        ports:
          - "27017:27017"
        environment:
          MONGO_INITDB_DATABASE: interviewapp
        volumes:
          - mongo-data:/data/db
        healthcheck:
          test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
          interval: 10s
          timeout: 5s
          retries: 5

      # ─── Backend ──────────────────────────────────────
      backend:
        build:
          context: ./backend
          dockerfile: Dockerfile
        container_name: interview_backend
        ports:
          - "5000:5000"
        env_file:
          - ./backend/.env
        depends_on:
          redis:
            condition: service_healthy
          mongo:
            condition: service_healthy
        restart: unless-stopped

      # ─── AI Microservices ─────────────────────────────
      face-service:
        build:
          context: ./ai-services/face-service
          dockerfile: Dockerfile
        container_name: interview_face
        ports:
          - "8001:8001"
        env_file:
          - ./ai-services/face-service/.env
        restart: unless-stopped

      voice-service:
        build:
          context: ./ai-services/voice-service
          dockerfile: Dockerfile
        container_name: interview_voice
        ports:
          - "8002:8002"
        env_file:
          - ./ai-services/voice-service/.env
        restart: unless-stopped

      nlp-service:
        build:
          context: ./ai-services/nlp-service
          dockerfile: Dockerfile
        container_name: interview_nlp
        ports:
          - "8003:8003"
        env_file:
          - ./ai-services/nlp-service/.env
        restart: unless-stopped

      question-service:
        build:
          context: ./ai-services/question-service
          dockerfile: Dockerfile
        container_name: interview_questions
        ports:
          - "8004:8004"
        env_file:
          - ./ai-services/question-service/.env
        restart: unless-stopped

      report-service:
        build:
          context: ./ai-services/report-service
          dockerfile: Dockerfile
        container_name: interview_report
        ports:
          - "8005:8005"
        env_file:
          - ./ai-services/report-service/.env
        restart: unless-stopped

      # ─── Frontend ─────────────────────────────────────
      frontend:
        build:
          context: ./frontend
          dockerfile: Dockerfile
        container_name: interview_frontend
        ports:
          - "5173:80"
        depends_on:
          - backend
        restart: unless-stopped

    volumes:
      redis-data:
      mongo-data:
    ```
  </action>
  <acceptance_criteria>
    - docker-compose.yml exists at workspace root
    - docker-compose.yml contains `redis:` service
    - docker-compose.yml contains `mongo:` service
    - docker-compose.yml contains `backend:` service
    - docker-compose.yml contains `face-service:` service
    - docker-compose.yml contains `ports:\n          - "8001:8001"`
  </acceptance_criteria>
</task>

<task id="4.4">
  <title>Create README.md</title>
  <action>
    Create README.md at workspace root:
    ```markdown
    # AI Interview Practice Platform

    A real-time AI-powered interview simulator with facial analysis, voice analysis, NLP answer scoring, and a comprehensive performance report.

    ## Tech Stack

    | Layer | Technology |
    |-------|-----------|
    | Frontend | React + Vite, Tailwind CSS, Zustand |
    | Backend | Node.js, Express.js, MongoDB Atlas |
    | AI Services | Python FastAPI (×5 microservices) |
    | Async | BullMQ + Redis |
    | Media Storage | Cloudinary |

    ## Project Structure

    ```
    /
    ├── frontend/          # React Vite app (port 5173)
    ├── backend/           # Node/Express API (port 5000)
    ├── ai-services/
    │   ├── face-service/     # Facial analysis (port 8001)
    │   ├── voice-service/    # Voice/transcript analysis (port 8002)
    │   ├── nlp-service/      # NLP answer analysis (port 8003)
    │   ├── question-service/ # Question + TTS generation (port 8004)
    │   └── report-service/   # Report generation (port 8005)
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
    cp .env.example .env   # fill in your values
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

    ### 4. AI Services (each in a separate terminal)
    ```bash
    cd ai-services/question-service
    pip install -r requirements.txt
    cp .env.example .env
    python main.py
    ```

    ## Environment Variables

    See `.env.example` at root and each service's `.env.example` for required variables.

    ## Build Phases

    | Phase | Description | Status |
    |-------|-------------|--------|
    | 1 | Project Setup | ✅ |
    | 2 | Auth System | 🔜 |
    | 3 | Dashboard + Setup | 🔜 |
    | 4 | Live Interview | 🔜 |
    | 5 | AI Analysis Services | 🔜 |
    | 6 | Writing Test | 🔜 |
    | 7 | Report Generation | 🔜 |
    | 8 | History + Profile | 🔜 |
    | 9 | Polish | 🔜 |
    | 10 | Deploy | 🔜 |
    ```
  </action>
  <acceptance_criteria>
    - README.md exists at workspace root
    - README.md contains `AI Interview Practice Platform`
    - README.md contains `docker-compose up redis mongo -d`
    - README.md contains the port table listing all 5 AI services
  </acceptance_criteria>
</task>

## Verification

```bash
# Validate docker-compose.yml syntax
docker-compose config --quiet && echo "docker-compose OK"
```

## must_haves
- [ ] .gitignore covers node_modules, .env, __pycache__, dist
- [ ] docker-compose.yml defines redis and mongo with healthchecks
- [ ] docker-compose.yml maps correct ports for all 7 services
- [ ] README.md documents quick start commands
- [ ] Root .env.example covers all required secrets
