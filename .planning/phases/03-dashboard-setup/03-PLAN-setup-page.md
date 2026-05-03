---
id: 03-PLAN-setup-page
wave: 2
depends_on:
  - 03-PLAN-session-model
files_modified:
  - frontend/src/pages/InterviewSetupPage.jsx
  - frontend/src/App.jsx
autonomous: true
requirements:
  - REQ-interview-flow
---

# Plan: Interview Setup Page

## Goal
Build the multi-step Interview Setup page where users configure their session before starting.
Step 1: choose interview type. Step 2: enter role + question count. Step 3: permission check
(camera + mic). On completion, call `POST /api/sessions` then navigate to
`/interview/live/:sessionId`.

## AI Model Slots Note
Step 3 (permissions) is the camera/mic gate that the two ML models depend on:
- 🎥 **Video model** (face-service) — needs camera access. The permission check here
  ensures the browser grants `video: true` before the live interview starts.
- 🎙️ **Audio model** (voice-service) — needs microphone access. Same permission step
  grants `audio: true`.
Both streams are opened in Phase 4. This page only confirms permission grants and shows
the user a preview so they know the camera is working.

## Tasks

<task id="7.1">
  <title>Build InterviewSetupPage — 3-step wizard</title>
  <read_first>
    - frontend/src/components/ui/Button.jsx
    - frontend/src/components/ui/Input.jsx
    - frontend/src/api/sessions.js
    - frontend/src/index.css
  </read_first>
  <action>
    Create `frontend/src/pages/InterviewSetupPage.jsx`:

    **Steps:**
    - **Step 1 — Interview Type** (4 type cards, same as Dashboard cards):
      `hr` / `technical` / `mixed` / `resume` / `company`
      Clicking a card selects it (highlighted border). "Continue →" advances to step 2.

    - **Step 2 — Role & Questions**:
      - Role text input (e.g. "Software Engineer")
      - Question count: 5 / 8 / 10 / 15 pill selector
      - Optional: company name input (shown only when type === 'company')
      - "Continue →" advances to step 3

    - **Step 3 — Camera & Mic Check**:
      - Button "Allow Camera & Microphone"
      - Calls `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
      - On success: shows green ✅ badge + live `<video>` preview (muted, mirrored)
      - On denied: shows red error with instructions to enable in browser settings
      - "Start Interview" button (disabled until permissions granted)
      - On click: calls `sessionsApi.create({ role, interviewType, questionCount })`
        then `navigate('/interview/live/' + session._id)`

    **Step indicator** — 3 dots or progress bar at top, same style as Register page.

    **Layout:**
    ```jsx
    <div className="min-h-screen bg-brand-bg">
      <div className="page-container py-12 max-w-2xl mx-auto">
        {/* Step indicator */}
        {/* Step content card */}
        {/* Navigation buttons */}
      </div>
    </div>
    ```

    **Camera preview cleanup** — stop the media stream on component unmount:
    ```js
    useEffect(() => {
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
        }
      }
    }, [])
    ```

    **Full state:**
    ```js
    const [step, setStep] = useState(1)
    const [interviewType, setInterviewType] = useState('')
    const [role, setRole] = useState('')
    const [questionCount, setQuestionCount] = useState(5)
    const [permissionGranted, setPermissionGranted] = useState(false)
    const [permissionError, setPermissionError] = useState('')
    const [creating, setCreating] = useState(false)
    const streamRef = useRef(null)
    const videoRef = useRef(null)
    ```

    **Type cards data:**
    ```js
    const INTERVIEW_TYPES = [
      { id: 'hr',        label: 'HR Interview',              desc: 'Behavioral & Cultural fit',        icon: '👥' },
      { id: 'technical', label: 'Technical Interview',        desc: 'Coding & Systems design',          icon: '💻' },
      { id: 'resume',    label: 'Resume Based Interview',     desc: 'Deep dive into your past roles',   icon: '📄' },
      { id: 'company',   label: 'Company Specific Practice',  desc: 'FAANG & Fortune 500 patterns',     icon: '🏢' },
    ]
    ```

    **Question count pills:**
    ```jsx
    {[5, 8, 10, 15].map(n => (
      <button key={n}
        onClick={() => setQuestionCount(n)}
        className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
          questionCount === n
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-brand-muted border-brand-border hover:border-primary'
        }`}
      >{n} questions</button>
    ))}
    ```

    **Permission handler:**
    ```js
    const requestPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setPermissionGranted(true)
        setPermissionError('')
      } catch {
        setPermissionError('Camera or microphone access was denied. Please allow access in your browser settings and try again.')
      }
    }
    ```

    **Start handler:**
    ```js
    const handleStart = async () => {
      setCreating(true)
      try {
        const { data } = await sessionsApi.create({ role, interviewType, questionCount })
        navigate('/interview/live/' + data.data.session._id)
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to create session')
      } finally {
        setCreating(false)
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/pages/InterviewSetupPage.jsx exists
    - InterviewSetupPage contains 3-step flow (type → role → permissions)
    - InterviewSetupPage contains `navigator.mediaDevices.getUserMedia`
    - InterviewSetupPage contains `streamRef.current.getTracks().forEach(t => t.stop())` cleanup
    - InterviewSetupPage contains `sessionsApi.create(` call
    - InterviewSetupPage contains `navigate('/interview/live/'` on session created
    - InterviewSetupPage contains question count pill selector [5, 8, 10, 15]
    - InterviewSetupPage contains all 4 INTERVIEW_TYPES cards
  </acceptance_criteria>
</task>

<task id="7.2">
  <title>Wire InterviewSetupPage into App.jsx</title>
  <read_first>
    - frontend/src/App.jsx
  </read_first>
  <action>
    In `frontend/src/App.jsx`:
    ```jsx
    // Add import:
    import InterviewSetupPage from './pages/InterviewSetupPage.jsx'

    // Replace:
    // <WithNavbar><Placeholder name="Interview Setup" /></WithNavbar>
    // With:
    // <WithNavbar><InterviewSetupPage /></WithNavbar>
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/App.jsx imports InterviewSetupPage
    - frontend/src/App.jsx renders InterviewSetupPage inside ProtectedRoute + WithNavbar
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

## Verification
```bash
cd frontend && npm run build
```

## must_haves
- [ ] 3-step wizard: type selection → role + count → camera/mic check
- [ ] Camera preview via getUserMedia with mirrored `<video>` element
- [ ] Media stream stopped on unmount (no resource leak)
- [ ] Disabled "Start Interview" until permissions granted
- [ ] `sessionsApi.create()` called on start → navigate to live interview
- [ ] `npm run build` passes
