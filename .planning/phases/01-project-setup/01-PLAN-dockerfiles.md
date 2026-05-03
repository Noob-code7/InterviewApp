---
id: 01-PLAN-dockerfiles
wave: 3
depends_on:
  - 01-PLAN-root-config
files_modified:
  - backend/Dockerfile
  - frontend/Dockerfile
  - ai-services/face-service/Dockerfile
  - ai-services/voice-service/Dockerfile
  - ai-services/nlp-service/Dockerfile
  - ai-services/question-service/Dockerfile
  - ai-services/report-service/Dockerfile
autonomous: true
requirements:
  - REQ-platform-arch
---

# Plan: Dockerfiles for All Services

## Goal
Write production-ready Dockerfiles for all 7 services (backend, frontend, 5 AI services) so docker-compose.yml can build and run them.

## Tasks

<task id="5.1">
  <title>Backend Dockerfile</title>
  <read_first>
    - backend/package.json
    - backend/server.js
  </read_first>
  <action>
    Create backend/Dockerfile:
    ```dockerfile
    FROM node:20-alpine

    WORKDIR /app

    # Install dependencies first (layer caching)
    COPY package*.json ./
    RUN npm ci --only=production

    # Copy source
    COPY . .

    EXPOSE 5000

    CMD ["node", "server.js"]
    ```

    Create backend/.dockerignore:
    ```
    node_modules
    .env
    .env.*
    npm-debug.log
    ```
  </action>
  <acceptance_criteria>
    - backend/Dockerfile exists
    - backend/Dockerfile contains `FROM node:20-alpine`
    - backend/Dockerfile contains `EXPOSE 5000`
    - backend/Dockerfile contains `CMD ["node", "server.js"]`
    - backend/.dockerignore exists and contains `node_modules`
  </acceptance_criteria>
</task>

<task id="5.2">
  <title>Frontend Dockerfile (Nginx for production)</title>
  <read_first>
    - frontend/package.json
    - frontend/vite.config.js
  </read_first>
  <action>
    Create frontend/Dockerfile (multi-stage build — build with Node, serve with nginx):
    ```dockerfile
    # Stage 1: Build
    FROM node:20-alpine AS builder

    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build

    # Stage 2: Serve
    FROM nginx:alpine

    COPY --from=builder /app/dist /usr/share/nginx/html

    # nginx config for SPA routing
    RUN printf 'server {\n\
      listen 80;\n\
      root /usr/share/nginx/html;\n\
      index index.html;\n\
      location / {\n\
        try_files $uri $uri/ /index.html;\n\
      }\n\
    }\n' > /etc/nginx/conf.d/default.conf

    EXPOSE 80

    CMD ["nginx", "-g", "daemon off;"]
    ```

    Create frontend/.dockerignore:
    ```
    node_modules
    dist
    .env
    .env.*
    ```
  </action>
  <acceptance_criteria>
    - frontend/Dockerfile exists
    - frontend/Dockerfile contains `FROM node:20-alpine AS builder`
    - frontend/Dockerfile contains `FROM nginx:alpine`
    - frontend/Dockerfile contains `try_files $uri $uri/ /index.html`
    - frontend/Dockerfile contains `EXPOSE 80`
  </acceptance_criteria>
</task>

<task id="5.3">
  <title>Python AI service Dockerfiles (shared pattern)</title>
  <read_first>
    - ai-services/face-service/requirements.txt
    - ai-services/face-service/main.py
  </read_first>
  <action>
    Each AI service uses the same Dockerfile pattern. Create for all 5 services:

    ai-services/face-service/Dockerfile:
    ```dockerfile
    FROM python:3.11-slim

    WORKDIR /app

    # System deps for OpenCV and audio libs
    RUN apt-get update && apt-get install -y \
        libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1-mesa-glx ffmpeg \
        && rm -rf /var/lib/apt/lists/*

    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt

    COPY . .

    EXPOSE 8001

    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
    ```

    ai-services/voice-service/Dockerfile:
    Same as above but EXPOSE 8002 and CMD port 8002. Add additional apt packages: libsndfile1

    ai-services/nlp-service/Dockerfile:
    Same pattern, EXPOSE 8003, CMD port 8003. No extra apt packages needed.

    ai-services/question-service/Dockerfile:
    Same pattern, EXPOSE 8004, CMD port 8004. No extra apt packages needed.

    ai-services/report-service/Dockerfile:
    Same pattern, EXPOSE 8005, CMD port 8005. No extra apt packages needed.

    Create a .dockerignore inside each ai-service directory:
    ```
    __pycache__
    *.pyc
    .env
    .venv
    venv
    ```
  </action>
  <acceptance_criteria>
    - ai-services/face-service/Dockerfile exists and contains `EXPOSE 8001`
    - ai-services/voice-service/Dockerfile exists and contains `EXPOSE 8002`
    - ai-services/nlp-service/Dockerfile exists and contains `EXPOSE 8003`
    - ai-services/question-service/Dockerfile exists and contains `EXPOSE 8004`
    - ai-services/report-service/Dockerfile exists and contains `EXPOSE 8005`
    - All Dockerfiles contain `FROM python:3.11-slim`
    - All Dockerfiles contain `pip install --no-cache-dir -r requirements.txt`
  </acceptance_criteria>
</task>

## Verification

```bash
# Validate docker-compose can parse all Dockerfiles
docker-compose config | grep "image\|build" && echo "Compose config OK"
```

## must_haves
- [ ] backend/Dockerfile uses node:20-alpine and exposes port 5000
- [ ] frontend/Dockerfile is multi-stage (Node build + nginx serve) and handles SPA routing
- [ ] All 5 AI service Dockerfiles use python:3.11-slim with correct port exposures
- [ ] All .dockerignore files exclude node_modules, .env, __pycache__
