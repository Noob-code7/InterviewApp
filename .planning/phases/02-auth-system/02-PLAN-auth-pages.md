---
id: 02-PLAN-auth-pages
wave: 2
depends_on:
  - 02-PLAN-auth-backend
  - 02-PLAN-design-system
files_modified:
  - frontend/src/pages/LoginPage.jsx
  - frontend/src/pages/RegisterPage.jsx
  - frontend/src/pages/LandingPage.jsx
  - frontend/src/App.jsx
autonomous: true
requirements:
  - REQ-auth-jwt
---

# Plan: Auth Pages — Login, Register, Landing + Wire Routes

## Goal
Build the Login, Register, and Landing pages to match the design reference — clean white with indigo accent, Inter font, subtle card shadows. Fully wire all routes in App.jsx using ProtectedRoute. The pages must handle loading states, server error messages, and redirect authenticated users away from auth pages.

## Design Direction (from mockup + user instructions)
- Clean white page, centered card with logo at top
- Indigo "Get started" / "Sign in" CTA buttons
- No heavy gradients on auth pages — keep it minimal and professional
- Form fields with clear labels and focus states
- Subtle "forgot password?" link (UI only for now)
- Social proof / trust line at bottom of card

## Tasks

<task id="4.1">
  <title>Build Login page</title>
  <read_first>
    - frontend/src/components/ui/Button.jsx
    - frontend/src/components/ui/Input.jsx
    - frontend/src/components/ui/Card.jsx
    - frontend/src/store/authStore.js
    - frontend/src/api/auth.js
  </read_first>
  <action>
    Create `frontend/src/pages/LoginPage.jsx`:
    ```jsx
    import { useState, useEffect } from 'react'
    import { Link, useNavigate, useLocation } from 'react-router-dom'
    import { authApi } from '../api/auth.js'
    import useAuthStore from '../store/authStore.js'
    import Button from '../components/ui/Button.jsx'
    import Input from '../components/ui/Input.jsx'

    export default function LoginPage() {
      const navigate = useNavigate()
      const location = useLocation()
      const { setAuth, isAuthenticated } = useAuthStore()

      const [form, setForm] = useState({ email: '', password: '' })
      const [errors, setErrors] = useState({})
      const [serverError, setServerError] = useState('')
      const [loading, setLoading] = useState(false)

      const from = location.state?.from?.pathname || '/dashboard'

      // Redirect if already logged in
      useEffect(() => {
        if (isAuthenticated) navigate(from, { replace: true })
      }, [isAuthenticated])

      const validate = () => {
        const e = {}
        if (!form.email) e.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
        if (!form.password) e.password = 'Password is required'
        return e
      }

      const handleSubmit = async (e) => {
        e.preventDefault()
        const e_ = validate()
        if (Object.keys(e_).length) { setErrors(e_); return }

        setLoading(true)
        setServerError('')
        try {
          const { data } = await authApi.login(form)
          const { accessToken, user } = data.data
          localStorage.setItem('accessToken', accessToken)
          setAuth(user, accessToken)
          navigate(from, { replace: true })
        } catch (err) {
          setServerError(err.response?.data?.error || 'Login failed. Please try again.')
        } finally {
          setLoading(false)
        }
      }

      return (
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
          {/* Card */}
          <div className="w-full max-w-md animate-fade-in">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <span className="text-3xl font-bold">
                  <span className="text-brand-text">Interview</span>
                  <span className="text-primary">AI</span>
                </span>
              </Link>
              <p className="mt-2 text-sm text-brand-muted">Sign in to continue your practice</p>
            </div>

            <div className="card p-8">
              <h1 className="text-2xl font-bold text-brand-text mb-6">Welcome back</h1>

              {serverError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Email"
                  type="email"
                  id="login-email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })) }}
                  error={errors.email}
                  autoComplete="email"
                />
                <div>
                  <Input
                    label="Password"
                    type="password"
                    id="login-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: '' })) }}
                    error={errors.password}
                    autoComplete="current-password"
                  />
                  <div className="mt-1.5 text-right">
                    <button type="button" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                </div>

                <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                  Sign in
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-brand-muted">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Get started free
                </Link>
              </p>
            </div>

            {/* Trust line */}
            <p className="mt-4 text-center text-xs text-brand-subtle">
              Trusted by 10,000+ job seekers · No credit card required
            </p>
          </div>
        </div>
      )
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/pages/LoginPage.jsx exists
    - frontend/src/pages/LoginPage.jsx contains `authApi.login(`
    - frontend/src/pages/LoginPage.jsx contains `setAuth(user, accessToken)`
    - frontend/src/pages/LoginPage.jsx contains `localStorage.setItem('accessToken', accessToken)`
    - frontend/src/pages/LoginPage.jsx contains `serverError` state and error display
    - frontend/src/pages/LoginPage.jsx contains redirect for already-authenticated users
    - frontend/src/pages/LoginPage.jsx contains `InterviewAI` brand text
  </acceptance_criteria>
</task>

<task id="4.2">
  <title>Build Register page</title>
  <read_first>
    - frontend/src/pages/LoginPage.jsx (use same pattern)
    - frontend/src/api/auth.js
    - frontend/src/store/authStore.js
  </read_first>
  <action>
    Create `frontend/src/pages/RegisterPage.jsx`:
    ```jsx
    import { useState, useEffect } from 'react'
    import { Link, useNavigate } from 'react-router-dom'
    import { authApi } from '../api/auth.js'
    import useAuthStore from '../store/authStore.js'
    import Button from '../components/ui/Button.jsx'
    import Input from '../components/ui/Input.jsx'

    export default function RegisterPage() {
      const navigate = useNavigate()
      const { setAuth, isAuthenticated } = useAuthStore()

      const [form, setForm] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        college: '', targetRole: '',
      })
      const [errors, setErrors] = useState({})
      const [serverError, setServerError] = useState('')
      const [loading, setLoading] = useState(false)
      const [step, setStep] = useState(1) // 2-step form for better UX

      useEffect(() => {
        if (isAuthenticated) navigate('/dashboard', { replace: true })
      }, [isAuthenticated])

      const updateField = (field) => (e) => {
        setForm(f => ({ ...f, [field]: e.target.value }))
        setErrors(er => ({ ...er, [field]: '' }))
      }

      const validateStep1 = () => {
        const e = {}
        if (!form.name.trim()) e.name = 'Full name is required'
        if (!form.email) e.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
        if (!form.password) e.password = 'Password is required'
        else if (form.password.length < 6) e.password = 'At least 6 characters'
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
        return e
      }

      const handleStep1 = (e) => {
        e.preventDefault()
        const e_ = validateStep1()
        if (Object.keys(e_).length) { setErrors(e_); return }
        setStep(2)
      }

      const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setServerError('')
        try {
          const { data } = await authApi.register({
            name: form.name,
            email: form.email,
            password: form.password,
            college: form.college,
            targetRole: form.targetRole,
          })
          const { accessToken, user } = data.data
          localStorage.setItem('accessToken', accessToken)
          setAuth(user, accessToken)
          navigate('/dashboard', { replace: true })
        } catch (err) {
          setServerError(err.response?.data?.error || 'Registration failed. Please try again.')
          setStep(1)
        } finally {
          setLoading(false)
        }
      }

      return (
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <span className="text-3xl font-bold">
                  <span className="text-brand-text">Interview</span>
                  <span className="text-primary">AI</span>
                </span>
              </Link>
              <p className="mt-2 text-sm text-brand-muted">
                Create your account — it's free
              </p>
            </div>

            <div className="card p-8">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2].map((s) => (
                  <div key={s} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${s <= step ? 'bg-primary' : 'bg-gray-200'}`} />
                ))}
              </div>

              <h1 className="text-2xl font-bold text-brand-text mb-1">
                {step === 1 ? 'Create your account' : 'Almost there!'}
              </h1>
              <p className="text-sm text-brand-muted mb-6">
                {step === 1
                  ? 'Start practicing with AI-powered interviews today'
                  : 'Tell us a bit about yourself (optional)'}
              </p>

              {serverError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              {step === 1 ? (
                <form onSubmit={handleStep1} className="flex flex-col gap-4" noValidate>
                  <Input id="reg-name" label="Full name" placeholder="Jane Doe"
                    value={form.name} onChange={updateField('name')} error={errors.name} autoComplete="name" />
                  <Input id="reg-email" label="Email" type="email" placeholder="you@example.com"
                    value={form.email} onChange={updateField('email')} error={errors.email} autoComplete="email" />
                  <Input id="reg-password" label="Password" type="password" placeholder="••••••••"
                    value={form.password} onChange={updateField('password')} error={errors.password}
                    hint="Minimum 6 characters" autoComplete="new-password" />
                  <Input id="reg-confirm" label="Confirm password" type="password" placeholder="••••••••"
                    value={form.confirmPassword} onChange={updateField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
                  <Button type="submit" className="w-full mt-2" size="lg">
                    Continue →
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                  <Input id="reg-college" label="College / University (optional)" placeholder="e.g. IIT Delhi"
                    value={form.college} onChange={updateField('college')} />
                  <Input id="reg-role" label="Target role (optional)" placeholder="e.g. Software Engineer"
                    value={form.targetRole} onChange={updateField('targetRole')} />
                  <div className="flex gap-3 mt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="submit" loading={loading} className="flex-1">
                      Create account
                    </Button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-center text-sm text-brand-muted">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <p className="mt-4 text-center text-xs text-brand-subtle">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      )
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/pages/RegisterPage.jsx exists
    - frontend/src/pages/RegisterPage.jsx contains `step === 1` and `step === 2` multi-step logic
    - frontend/src/pages/RegisterPage.jsx contains `authApi.register(`
    - frontend/src/pages/RegisterPage.jsx contains `setAuth(user, accessToken)`
    - frontend/src/pages/RegisterPage.jsx contains step indicator progress bar
  </acceptance_criteria>
</task>

<task id="4.3">
  <title>Build Landing page (hero + CTA)</title>
  <read_first>
    - frontend/src/components/ui/Button.jsx
    - frontend/src/index.css (design tokens)
  </read_first>
  <action>
    Create `frontend/src/pages/LandingPage.jsx`:
    ```jsx
    import { useNavigate } from 'react-router-dom'
    import Button from '../components/ui/Button.jsx'

    const FEATURES = [
      { icon: '🎥', title: 'Live Video Analysis', desc: 'AI watches your facial expressions and body language in real time' },
      { icon: '🎙️', title: 'Voice Confidence Score', desc: 'Whisper AI transcribes and scores your clarity, pace, and filler words' },
      { icon: '🧠', title: 'NLP Answer Scoring', desc: 'GPT-4 evaluates relevance, structure, and completeness of every answer' },
      { icon: '📝', title: 'Writing Assessment', desc: 'Timed email and communication tasks with live grammar scoring' },
      { icon: '📊', title: 'Detailed Reports', desc: 'Comprehensive PDF report with strengths, weaknesses, and action plans' },
      { icon: '📈', title: 'Progress Tracking', desc: 'Track improvement across multiple sessions over time' },
    ]

    export default function LandingPage() {
      const navigate = useNavigate()

      return (
        <div className="min-h-screen bg-brand-bg">
          {/* Hero */}
          <section className="page-container pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 badge badge-primary mb-6">
              <span>✨</span>
              <span>AI-Powered Interview Coach</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-brand-text leading-tight mb-6">
              Practice Smarter.<br />
              <span className="text-primary">Get Hired Faster.</span>
            </h1>
            <p className="text-lg text-brand-muted max-w-xl mx-auto mb-10">
              Real-time AI analyzes your face, voice, and answers during mock interviews.
              Get detailed feedback and improve with every session.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" onClick={() => navigate('/register')}>
                Start for free →
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </div>
            <p className="mt-4 text-xs text-brand-subtle">No credit card required · 3 free sessions included</p>
          </section>

          {/* Features grid */}
          <section className="page-container py-16">
            <h2 className="text-3xl font-bold text-brand-text text-center mb-12">
              Everything you need to ace your interview
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} className="card p-6 hover:shadow-modal transition-shadow duration-200">
                  <div className="text-3xl mb-4">{icon}</div>
                  <h3 className="font-semibold text-brand-text mb-2">{title}</h3>
                  <p className="text-sm text-brand-muted">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA footer */}
          <section className="page-container py-16 text-center">
            <div className="card p-12">
              <h2 className="text-3xl font-bold text-brand-text mb-4">
                Ready to land your dream job?
              </h2>
              <p className="text-brand-muted mb-8">Join thousands of candidates who improved their confidence with AI coaching.</p>
              <Button size="lg" onClick={() => navigate('/register')}>
                Get started for free
              </Button>
            </div>
          </section>
        </div>
      )
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/pages/LandingPage.jsx exists
    - frontend/src/pages/LandingPage.jsx contains `Practice Smarter`
    - frontend/src/pages/LandingPage.jsx contains `Get Hired Faster`
    - frontend/src/pages/LandingPage.jsx contains the FEATURES array with 6 items
    - frontend/src/pages/LandingPage.jsx contains navigate('/register') on CTA
  </acceptance_criteria>
</task>

<task id="4.4">
  <title>Wire all routes in App.jsx — protect dashboard + downstream pages</title>
  <read_first>
    - frontend/src/App.jsx (current state with placeholder routes)
    - frontend/src/components/layout/Navbar.jsx
    - frontend/src/components/layout/ProtectedRoute.jsx
    - frontend/src/pages/LoginPage.jsx
    - frontend/src/pages/RegisterPage.jsx
    - frontend/src/pages/LandingPage.jsx
  </read_first>
  <action>
    Replace `frontend/src/App.jsx`:
    ```jsx
    import { Routes, Route } from 'react-router-dom'
    import Navbar from './components/layout/Navbar.jsx'
    import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

    // Auth pages (no Navbar)
    import LoginPage from './pages/LoginPage.jsx'
    import RegisterPage from './pages/RegisterPage.jsx'
    import LandingPage from './pages/LandingPage.jsx'

    // Placeholder pages for future phases
    const Placeholder = ({ name }) => (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="card p-12 text-center">
          <h1 className="text-3xl font-bold text-brand-text mb-2">{name}</h1>
          <p className="text-brand-muted">Coming in a future phase</p>
        </div>
      </div>
    )

    // Layout wrapper for pages that need the Navbar
    const WithNavbar = ({ children }) => (
      <>
        <Navbar />
        <main>{children}</main>
      </>
    )

    function App() {
      return (
        <Routes>
          {/* ── Public routes (no navbar) ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Protected routes (with navbar) ── */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="Dashboard" /></WithNavbar>
            </ProtectedRoute>
          } />
          <Route path="/interview/setup" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="Interview Setup" /></WithNavbar>
            </ProtectedRoute>
          } />
          <Route path="/interview/live/:sessionId" element={
            <ProtectedRoute>
              <Placeholder name="Live Interview" />
            </ProtectedRoute>
          } />
          <Route path="/interview/writing/:sessionId" element={
            <ProtectedRoute>
              <Placeholder name="Writing Test" />
            </ProtectedRoute>
          } />
          <Route path="/interview/processing" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="Processing..." /></WithNavbar>
            </ProtectedRoute>
          } />
          <Route path="/report/:sessionId" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="Report" /></WithNavbar>
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="History" /></WithNavbar>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <WithNavbar><Placeholder name="Profile" /></WithNavbar>
            </ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={
            <WithNavbar>
              <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="card p-12 text-center">
                  <h1 className="text-6xl font-extrabold text-primary mb-4">404</h1>
                  <p className="text-brand-muted">Page not found</p>
                </div>
              </div>
            </WithNavbar>
          } />
        </Routes>
      )
    }

    export default App
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/App.jsx imports `Navbar`, `ProtectedRoute`, `LoginPage`, `RegisterPage`, `LandingPage`
    - frontend/src/App.jsx contains `<ProtectedRoute>` wrapping `/dashboard`, `/history`, `/profile`
    - frontend/src/App.jsx contains `<Route path="/" element={<LandingPage />}`
    - frontend/src/App.jsx contains `<Route path="/login" element={<LoginPage />}`
    - frontend/src/App.jsx contains `<Route path="*"` for 404
    - `npm run build` passes in frontend directory
  </acceptance_criteria>
</task>

## Verification

```bash
# Build must pass cleanly
cd frontend && npm run build

# Spot check pages exist
Test-Path frontend/src/pages/LoginPage.jsx
Test-Path frontend/src/pages/RegisterPage.jsx
Test-Path frontend/src/pages/LandingPage.jsx
```

## must_haves
- [ ] Login page: form validation, server error display, loading state, auth redirect
- [ ] Register page: 2-step UX, field validation, server error, auth redirect
- [ ] Landing page: hero, features grid, dual CTA buttons
- [ ] App.jsx: public routes (/, /login, /register), all protected routes wrapped in ProtectedRoute
- [ ] Navbar included via WithNavbar layout on all protected pages
- [ ] 404 catch-all route
- [ ] `npm run build` exits 0
