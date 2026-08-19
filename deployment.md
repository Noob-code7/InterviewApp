# InterviewAI — Cloud + College LAN Deployment Architecture

> One canonical codebase. Two environments. No `DEPLOYMENT_MODE` branching.
> All college-specific behavior is driven by **environment variables**; college-only
> infrastructure lives in dedicated files (`ecosystem.college.config.cjs`,
> `scripts/deploy-college.ps1`, `scripts/backup-college.ps1`).

---

## 1. The Two Environments

| Aspect | Cloud (production) | College LAN (self-hosted) |
|--------|--------------------|---------------------------|
| Frontend | Separate nginx / static host | Served by Node itself from one LAN origin (`SERVE_FRONTEND=true`) |
| Database | MongoDB Atlas | Local `mongod` on the lab PC (`127.0.0.1:27017`) |
| Process manager | Docker Compose / host | PM2 (5 apps), PM2 startup task for reboot recovery |
| Rate limits | Dev 2000 / Prod 300 per IP/window | Higher per-IP budget (many students share one public IP) |
| Analysis load | Unrestricted (scale-out) | Capped with `ANALYSIS_SESSION_CONCURRENCY` (one machine) |
| Media | Streamed to object storage (S3/R2) | Local files, auto-deleted after analysis |
| LLM (project answers) | OpenRouter via nlp-service | Same code path (OpenRouter key in nlp-service `.env`) |

Both deployments use the **identical application code**; the only differences are
`.env` values and which infra files you run.

---

## 2. Architecture

### 2.1 Cloud
```
Internet
   └── nginx (serves frontend/dist)
   └── backend  (Node :5000, SERVE_FRONTEND=false)
          ├── MongoDB Atlas
          └── ai-services (Python microservices)
                ├── face-service  :8001  (emotion/attention/eye-contact)
                ├── voice-service :8002  (STT + SER emotion)
                └── nlp-service   :8003  (LLM project eval + local NLP)
```

### 2.2 College (single lab desktop, Windows)
```
LAN clients  http://<lab-ip>:5000
   └── college-backend (Node :5000, SERVE_FRONTEND=true)
          ├── serves frontend/dist (SPA fallback)
          ├── college-mongod (127.0.0.1:27017, dbpath college-data/db)
          └── ai-services (Python microservices)
                ├── college-face  :8001
                ├── college-voice :8002
                └── college-nlp   :8003

Reboot recovery:  pm2-windows-startup → pm2 save restore → backend runs
recoverJobs() + startRecoverySweep() (re-queues stale 'processing' jobs).
```

All college services are supervised by PM2 with `restart_delay: 5000`,
`max_restarts: 50`, `kill_timeout: 15000`, `max_memory_restart: 4G`.

---

## 3. Full Plan & Phases

### Phase 0 — Foundation (DONE, prior work)
- Full platform: multimodal evaluation, writing test, reports, faculty/history/profile pages.
- Multi-track interview engine (HR / subject / technical / mixed) + resume parser.
- Report aggregation (face + voice + written + strengths/improvements).

### Phase 1 — Face & Voice Pipeline Fixes (DONE, verified)
**Problem:** face/voice analysis returned 0% / empty scores in production E2E.
**Fixes implemented:**
- Face service: robust emotion normalization + multi-frame sampling + confidence computation.
- Voice service: checksummed SER model auto-download from GitHub release (`feat(voice-service)` commit `0e2e5b4`).
- Backend: persisted `faceAnalysis` / `voiceAnalysis` onto answers; report controller aggregates them.
- Storage resolution: local path / relative uploads / remote object key all handled.

**Verification:** `fv2-e2e.mjs` full pass — face `conf=27.7`, attention `100`, eye-contact `90`;
voice transcript `len=279`, dominant `calm`, non-zero emotion probabilities persisted;
report `faceVisualScore=28`, `voiceSerScore=42`, `voiceEmotions.dominant=calm`.

### Phase 2 — College Self-Hosting Scaffolding (DONE)
Single codebase made environment-driven so one LAN origin works without touching cloud.

**Universal code changes (defaults = today's cloud behavior):**
- `backend/app.js` — configurable rate limits; optional static frontend serving + SPA fallback (guarded, excludes `/api` + `/uploads`).
- `backend/controllers/sessionController.js` — added `getSessionStatus` (`GET /api/sessions/:id/status` returns `{status, jobStatus, overallScore}`).
- `backend/routes/sessions.js` — rewritten: `statusLimiter` + `/status` route registered **before** `/:id`.
- `backend/services/analysisService.js` — cross-session concurrency limiter, idempotent `startAnalysis`, `failed` transition (was wrongly `completed` on error), periodic 60s recovery sweep.
- `backend/server.js` — `startRecoverySweep()` wired after `recoverJobs()`.
- `frontend/src/pages/ProcessingPage.jsx` — polls lightweight `/status` endpoint every 5s (was full session doc every 2s).
- `backend/.env.example` — new vars documented with safe defaults.

### Phase 3 — College-Only Infrastructure (DONE, created + parse-validated)
- `ecosystem.college.config.cjs` — 5 PM2 apps (mongod / backend / face / voice / nlp), Windows paths, overridable via env.
- `scripts/deploy-college.ps1` — idempotent deploy: preflight, installs, frontend build (`VITE_API_URL=/`), SER model pre-seed, `pm2 startOrRestart` + `save`, `pm2-startup install`, netsh firewall rule, health checks, prints LAN URL.
- `scripts/backup-college.ps1` — `mongodump --archive --gzip` + `Compress-Archive uploads`, timestamped, prune (14 days), optional `schtasks` registration.
- `scripts/college.env.example` — placeholder template (no real secrets/IPs).

### Phase 4 — Cloud Regression (DONE, API-level verified)
Backend restarted with **zero new env vars** (dev `.env` untouched).
- `/health` OK, `/status` endpoint OK, full `GET /:id` unaffected.
- `fu-e2e.mjs` — follow-ups 2/2 evaluated, report 200.
- `fv2-e2e.mjs` — full face+voice pass (results above).
- `frontend npm run build` — succeeded.

### Phase 5 — College Verification (PARTIAL — in progress)
**Done on this dev machine (via throwaway backend on :5099):**
- Static serving: root → `index.html`; `/api/nonexistent` → JSON 404; `/reports/xyz123` → SPA fallback; `/uploads/test.jpg` → 404.
- Cross-session cap with `ANALYSIS_SESSION_CONCURRENCY=2`:
  - 3 sessions started simultaneously → exactly **2 in `processing`**, 3rd held `queued` for ~45 s until a slot freed, then all completed. `maxConcurrentProcessing=2`, `sawQueued=true`.
  - This also **validated the pump fix** (`queuedSessions.push` at `analysisService.js:145`); before the fix sessions stuck at `queued` forever.

**Not yet done — requires the lab PC (see §6 Todo):**
- Full `deploy-college.ps1` run, LAN access from a 2nd machine, backup smoke test, reboot recovery.

### Phase 6 — Final Deliverable (DONE — this document)

---

## 4. New Environment Variables (all optional)

| Var | Default (cloud) | College value | Purpose |
|-----|-----------------|---------------|---------|
| `SERVE_FRONTEND` | `false` | `true` | Node serves built frontend + SPA fallback |
| `FRONTEND_DIST_DIR` | `../frontend/dist` | same | Path to built React app |
| `RATE_LIMIT_MAX` | dev 2000 / prod 300 | `3000` | Per-IP request budget / window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | `900000` | Window length |
| `STATUS_RATE_LIMIT_MAX` | falls back to `RATE_LIMIT_MAX` | `1500` | Status-poll budget |
| `STATUS_RATE_LIMIT_WINDOW_MS` | falls back to global | `900000` | Status window |
| `ANALYSIS_CONCURRENCY` | `2` (unchanged) | `2` | Parallel answers within one session |
| `ANALYSIS_SESSION_CONCURRENCY` | **unset = unlimited** | `2` | Max simultaneous sessions analyzed |

None of these are required in the cloud `.env`. Unset ⇒ exactly today's behavior.

---

## 5. Verification Report (actual results)

### 5.1 Face / Voice pipeline (`fv2-e2e.mjs`, dev backend :5000, zero new env vars)
| Check | Result |
|-------|--------|
| Face `confidenceScore` | 27.7 (>0) ✅ |
| Face `attentionScore` / `eyeContactScore` | 100 / 90 ✅ |
| Voice transcript length | 279 (>0) ✅ |
| `emotionProbabilities` persisted | calm 51.49, disgust 29.32, … (non-zero) ✅ |
| Report `faceVisualScore` / `voiceSerScore` | 28 / 42 (>0) ✅ |
| Report `voiceEmotions.dominant` | `calm` ✅ |

### 5.2 Follow-up / LLM+local eval (`fu-e2e.mjs`, dev backend :5000)
Follow-up questions evaluated 2/2; report 200.

### 5.3 College static serving + SPA fallback (backend :5099, college env)
| Request | Result |
|---------|--------|
| `GET /` | `index.html` ✅ |
| `GET /api/nonexistent` | JSON 404 (API precedence) ✅ |
| `GET /reports/xyz123` | SPA fallback `index.html` ✅ |
| `GET /uploads/test.jpg` | 404 static ✅ |

### 5.4 Cross-session concurrency cap (backend :5099, `ANALYSIS_SESSION_CONCURRENCY=2`)
3 sessions started together: `processingNow` held at **2**, 3rd `queued` 45 s, then all `completed`. ✅

### 5.5 Cloud regression (dev backend :5000, unchanged `.env`)
`/health`, `/status`, full session GET, face+voice E2E, frontend build — all pass. ✅

---

## 6. Todo — Remaining Work

### 6.1 Must run on the lab PC (college only — user is not at college)
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/deploy-college.ps1` on a clean Windows lab PC
- [ ] Verify all 5 services healthy (`pm2 list`, `http://<lab-ip>:5000/health`, 8001/8002/8003)
- [ ] LAN access from a **2nd machine** on the same network
- [ ] First backup run + `schtasks` registration (`scripts/backup-college.ps1`) — requires `mongodump` (part of MongoDB Server tools) on the lab PC
- [ ] Reboot test: restart Windows → `pm2-windows-startup` restores all 5 apps → stale `processing` jobs re-queued by `recoverJobs`/`startRecoverySweep`

### 6.2 Known issue to fix before/at college deploy
- [ ] **`reload=True` is hardcoded** in `ai-services/face-service/main.py:223` and
  `ai-services/voice-service/main.py:323`. In dev this tangles reloader/worker processes
  (face service on :8001 became unresponsive; voice degraded the same way during testing).
  Under PM2 this is wasteful and can orphan watchers. **Recommended:** gate reload on env,
  e.g. `reload=os.getenv("UVICORN_RELOAD", "false").lower() == "true"` (PM2 runs without it).
- [ ] Decide `ANALYSIS_SESSION_CONCURRENCY` value by benchmarking the actual lab hardware
  (`backend/scripts/benchmark_concurrency_levels.js`) — current `college.env.example` uses 2.

### 6.3 Open user decisions (outside college deploy)
- [ ] Commit pending working-tree changes (~70+ modified/untracked files from Phases 1–3)
- [ ] Option A handover kit (previously discussed)
- [ ] Adaptive interview feature (previously discussed)

### 6.4 Verification notes / flakiness
- AI Python services can die or go unresponsive in dev (uvicorn reload + TF/Torch model load).
  They are **not** supervised on this dev machine; on the college PC PM2 handles restart.
- During the last `fv2-e2e` rerun, face asserted OK (`conf=25.9`) but voice transcript was empty
  because the voice service had just been restarted and was mid-model-load. Re-run after services
  are healthy to confirm.

---

## 7. Switching Between Environments

```powershell
# Cloud  — nothing to do, existing .env is correct (SERVE_FRONTEND=false, Atlas URI)
# College — copy template, fill placeholders, deploy
Copy-Item scripts\college.env.example backend\.env
# edit backend\.env  (secrets, <lab-ip>, optional tuning)
powershell -ExecutionPolicy Bypass -File scripts\deploy-college.ps1
```

## 8. Key Files

| File | Role |
|------|------|
| `backend/app.js` | env-driven rate limits + optional static serving/SPA fallback |
| `backend/routes/sessions.js` | `statusLimiter`, `GET /:id/status` before `/:id` |
| `backend/controllers/sessionController.js` | `getSessionStatus` |
| `backend/services/analysisService.js` | session concurrency pump, `failed` transition, recovery sweep |
| `backend/server.js` | `recoverJobs` + `startRecoverySweep` |
| `frontend/src/pages/ProcessingPage.jsx` | 5s `/status` polling |
| `ecosystem.college.config.cjs` | PM2 college app definitions |
| `scripts/deploy-college.ps1` | idempotent college deploy |
| `scripts/backup-college.ps1` | mongodump + uploads archive + prune |
| `scripts/college.env.example` | college `.env` template |
| `backend/.env.example` | universal env reference (new vars) |