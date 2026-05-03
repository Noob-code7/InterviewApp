import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth.js'
import useAuthStore from '../store/authStore.js'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated } = useAuthStore()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    college: '', targetRole: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const update = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: '' }))
    setServerError('')
  }

  const validateStep1 = () => {
    const e = {}
    if (!form.name.trim())                           e.name = 'Full name is required'
    if (!form.email)                                  e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email))       e.email = 'Enter a valid email'
    if (!form.password)                               e.password = 'Password is required'
    else if (form.password.length < 6)                e.password = 'At least 6 characters'
    if (form.password !== form.confirmPassword)       e.confirmPassword = 'Passwords do not match'
    return e
  }

  const handleStep1 = (e) => {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setServerError('')
    try {
      const { data } = await authApi.register({
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        college: form.college.trim(),
        targetRole: form.targetRole.trim(),
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
          <Link to="/">
            <span className="text-3xl font-bold">
              <span className="text-brand-text">Interview</span>
              <span className="text-primary">AI</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-brand-muted">Create your free account</p>
        </div>

        <div className="card p-8">
          {/* Step progress bar */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <h1 className="text-2xl font-bold text-brand-text mb-1">
            {step === 1 ? 'Create your account' : 'Almost there!'}
          </h1>
          <p className="text-sm text-brand-muted mb-6">
            {step === 1
              ? 'Start practicing with AI-powered interviews'
              : 'Tell us a bit more (optional — you can skip)'}
          </p>

          {/* Server error */}
          {serverError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="flex flex-col gap-4" noValidate>
              <Input
                id="reg-name"
                label="Full name"
                placeholder="Jane Doe"
                value={form.name}
                onChange={update('name')}
                error={errors.name}
                autoComplete="name"
                autoFocus
              />
              <Input
                id="reg-email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update('email')}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                id="reg-password"
                label="Password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={update('password')}
                error={errors.password}
                hint="Minimum 6 characters"
                autoComplete="new-password"
              />
              <Input
                id="reg-confirm"
                label="Confirm password"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              <Button
                id="reg-step1-submit"
                type="submit"
                className="w-full mt-2"
                size="lg"
              >
                Continue →
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                id="reg-college"
                label="College / University"
                placeholder="e.g. IIT Delhi, Anna University"
                value={form.college}
                onChange={update('college')}
                hint="Optional — helps us personalise your experience"
              />
              <Input
                id="reg-role"
                label="Target role"
                placeholder="e.g. Software Engineer, Product Manager"
                value={form.targetRole}
                onChange={update('targetRole')}
                hint="Optional — we'll tailor interview questions for this role"
              />

              {/* Role quick-picks */}
              <div className="flex flex-wrap gap-2">
                {['Software Engineer', 'Product Manager', 'Data Analyst', 'Marketing'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, targetRole: r }))}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      form.targetRole === r
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-brand-muted border-brand-border hover:border-primary hover:text-primary'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </Button>
                <Button
                  id="reg-submit"
                  type="submit"
                  loading={loading}
                  className="flex-1"
                >
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
