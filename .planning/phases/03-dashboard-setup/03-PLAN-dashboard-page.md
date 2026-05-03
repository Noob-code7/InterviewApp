---
id: 03-PLAN-dashboard-page
wave: 2
depends_on:
  - 03-PLAN-session-model
files_modified:
  - frontend/src/pages/DashboardPage.jsx
  - frontend/src/api/sessions.js
  - frontend/src/App.jsx
autonomous: true
requirements:
  - REQ-interview-flow
---

# Plan: Dashboard Page

## Goal
Build the Dashboard page matching the mockup — stats cards, interview type selector cards, weekly confidence bar chart, and recent reports panel. Data comes from `GET /api/sessions/stats`. Show skeleton loaders while fetching, placeholder zeros when no sessions exist yet.

## AI Model Slots Note
The Dashboard displays `confidenceScore` and `writingScore` — these are populated by the
video ML model (face-service) and audio ML model (voice-service) respectively.
Display `--` / `N/A` until a completed session with real model output exists.

## Tasks

<task id="6.1">
  <title>Create sessions API module</title>
  <action>
    Create `frontend/src/api/sessions.js`:
    ```js
    import api from './axios.js'

    export const sessionsApi = {
      create:       (data) => api.post('/api/sessions', data),
      list:         (params) => api.get('/api/sessions', { params }),
      get:          (id)  => api.get(`/api/sessions/${id}`),
      getStats:     ()    => api.get('/api/sessions/stats'),
      updateStatus: (id, status) => api.patch(`/api/sessions/${id}/status`, { status }),
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/api/sessions.js exists and exports `sessionsApi`
    - sessionsApi contains `create`, `list`, `get`, `getStats`, `updateStatus`
  </acceptance_criteria>
</task>

<task id="6.2">
  <title>Build DashboardPage component</title>
  <read_first>
    - frontend/src/components/ui/index.js
    - frontend/src/store/authStore.js
    - frontend/src/api/sessions.js
    - frontend/src/index.css (design tokens)
  </read_first>
  <action>
    Create `frontend/src/pages/DashboardPage.jsx` with these sections:

    **Imports + state:**
    ```jsx
    import { useState, useEffect } from 'react'
    import { useNavigate } from 'react-router-dom'
    import { sessionsApi } from '../api/sessions.js'
    import useAuthStore from '../store/authStore.js'
    import { Button, Card } from '../components/ui/index.js'
    ```

    **Hero section** — greeting + "Start Interview" CTA + placeholder AI coach image area:
    ```jsx
    <section className="bg-white border-b border-brand-border py-10">
      <div className="page-container flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold text-brand-text leading-tight mb-2">
            Practice Smarter.<br />
            <span className="text-primary">Get Hired Faster.</span>
          </h1>
          <p className="text-brand-muted mb-6 max-w-md">
            AI-powered mock interviews with voice, video, and writing analysis.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/interview/setup')}>Start Interview</Button>
            <Button variant="outline" onClick={() => navigate('/history')}>View Reports</Button>
          </div>
        </div>
        {/* AI Coach image placeholder — replaced when video model is integrated */}
        <div className="w-72 h-48 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white/40 text-sm font-medium shrink-0">
          <div className="text-center">
            <div className="text-3xl mb-2">🤖</div>
            <span>AI Coach Active</span>
          </div>
        </div>
      </div>
    </section>
    ```

    **Stats row** — 4 cards: Interviews Completed, Confidence Score, Writing Score, Readiness:
    Each card uses the `.card` class with `stat-label` for the uppercase label and large bold value.
    Confidence + Writing score bars use `.progress-bar` + `.progress-bar-fill`.
    Show skeleton (`.skeleton h-8 w-16`) while `loading === true`.
    Show `--` when value is null (no completed sessions yet).

    **Interview type cards** — 2×2 grid:
    | Card | Subtitle |
    |------|----------|
    | Start HR Interview | Behavioral & Cultural fit |
    | Start Technical Interview | Coding & Systems design |
    | Resume Based Interview | Deep dive into your past roles |
    | Company Specific Practice | FAANG & Fortune 500 patterns |

    Each card: white card with icon, title, subtitle. `onClick → navigate('/interview/setup', { state: { type } })`.

    **Bottom row** — left: weekly confidence bar chart (7 bars, Mon–Today using dummy data, real data in Phase 8) + AI Tip card. Right: Recent Reports list from `stats.recentSessions` (max 3).

    **Weekly chart** — pure CSS bars (no chart library needed for Phase 3):
    ```jsx
    const DAYS = ['MON','TUE','WED','THU','FRI','SAT','TODAY']
    const DUMMY_SCORES = [45, 52, 68, 72, 55, 78, 85]
    // Render as flex bar chart — height proportional to score
    ```

    **Recent reports list** — role name, date, duration, score badge (green if ≥80, orange if ≥60, red otherwise). "See All History →" link to `/history`.

    **Full component skeleton:**
    ```jsx
    export default function DashboardPage() {
      const { user } = useAuthStore()
      const navigate = useNavigate()
      const [stats, setStats] = useState(null)
      const [loading, setLoading] = useState(true)

      useEffect(() => {
        sessionsApi.getStats()
          .then(({ data }) => setStats(data.data))
          .catch(() => setStats(null))
          .finally(() => setLoading(false))
      }, [])

      // ... render sections above
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/pages/DashboardPage.jsx exists
    - DashboardPage contains "Practice Smarter" hero text
    - DashboardPage contains "Start Interview" button navigating to /interview/setup
    - DashboardPage contains 4 stat cards (interviews, confidence, writing, readiness)
    - DashboardPage contains 4 interview type cards in a grid
    - DashboardPage contains weekly bar chart with 7 bars
    - DashboardPage contains recent sessions list from API
    - DashboardPage calls `sessionsApi.getStats()` on mount
    - Shows skeleton while loading
  </acceptance_criteria>
</task>

<task id="6.3">
  <title>Wire DashboardPage into App.jsx</title>
  <read_first>
    - frontend/src/App.jsx
  </read_first>
  <action>
    In `frontend/src/App.jsx`, replace the Dashboard placeholder:
    ```jsx
    // Add import at top:
    import DashboardPage from './pages/DashboardPage.jsx'

    // Replace:
    // <WithNavbar><Placeholder name="Dashboard" /></WithNavbar>
    // With:
    // <WithNavbar><DashboardPage /></WithNavbar>
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/App.jsx imports DashboardPage
    - frontend/src/App.jsx renders DashboardPage inside ProtectedRoute + WithNavbar
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

## Verification
```bash
cd frontend && npm run build
```

## must_haves
- [ ] Dashboard loads stats from `/api/sessions/stats` with loading skeleton
- [ ] 4 stat cards: interviews completed, confidence score (video model slot), writing score (audio model slot), readiness
- [ ] 4 interview type cards navigate to /interview/setup
- [ ] Weekly confidence chart (dummy data, CSS bars)
- [ ] Recent sessions list (up to 3)
- [ ] `npm run build` passes
