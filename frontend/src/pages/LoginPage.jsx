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
  const [showPassword, setShowPassword] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, from, navigate])

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    return e
  }

  const update = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: '' }))
    setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

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
      <div className="w-full max-w-md animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <span className="text-3xl font-bold">
              <span className="text-brand-text">Interview</span>
              <span className="text-primary">AI</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-brand-muted">Sign in to continue your practice</p>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-brand-text mb-1">Welcome back</h1>
          <p className="text-sm text-brand-muted mb-6">Pick up right where you left off</p>

          {/* Server error */}
          {serverError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="login-email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update('email')}
              error={errors.email}
              autoComplete="email"
              autoFocus
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-brand-text">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update('password')}
                  autoComplete="current-password"
                  className={`
                    w-full px-3.5 py-2.5 pr-10 text-sm bg-white border rounded-lg
                    text-brand-text placeholder:text-brand-subtle
                    transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    ${errors.password
                      ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                      : 'border-brand-border'}
                  `}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-subtle hover:text-brand-muted transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">⚠ {errors.password}</p>
              )}
            </div>

            <Button
              id="login-submit"
              type="submit"
              loading={loading}
              className="w-full mt-2"
              size="lg"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-brand-muted">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Get started free
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-brand-subtle">
          Trusted by 10,000+ job seekers · No credit card required
        </p>
      </div>
    </div>
  )
}
