---
id: 02-PLAN-design-system
wave: 1
depends_on: []
files_modified:
  - frontend/src/index.css
  - frontend/tailwind.config.js
  - frontend/src/components/ui/Button.jsx
  - frontend/src/components/ui/Input.jsx
  - frontend/src/components/ui/Card.jsx
  - frontend/src/components/layout/Navbar.jsx
  - frontend/src/components/layout/ProtectedRoute.jsx
  - frontend/src/api/auth.js
  - frontend/src/store/authStore.js
autonomous: true
requirements:
  - REQ-auth-jwt
---

# Plan: Frontend Design System + Auth Store + API Client

## Goal
Establish the global design system (CSS variables, typography, Tailwind extension) that matches the UI mockup: clean white background, indigo-blue primary (#4F46E5), slate grays, Inter font. Build reusable Button, Input, and Card components. Create the auth Zustand store with persist, the axios auth API module, the Navbar, and the ProtectedRoute HOC.

## Design Reference (from user screenshots)
- **Primary:** Indigo `#4F46E5` (hover: `#4338CA`)
- **Background:** White `#FFFFFF` with `#F8FAFC` page backgrounds
- **Text:** Slate `#0F172A` (headings) / `#475569` (body) / `#94A3B8` (muted)
- **Accent:** Light purple badge background `#EEF2FF`
- **Font:** Inter (Google Fonts)
- **Border radius:** `0.75rem` cards, `0.5rem` inputs/buttons
- **Shadow:** Subtle `shadow-sm` on cards, `shadow-md` on modals

## Tasks

<task id="3.1">
  <title>Update global CSS — design tokens, Inter font, base styles</title>
  <read_first>
    - frontend/src/index.css (current state — only Tailwind directives)
    - frontend/tailwind.config.js
  </read_first>
  <action>
    Replace `frontend/src/index.css` with the full design system:
    ```css
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    /* ── CSS Custom Properties ──────────────────────────────────────── */
    :root {
      --color-primary:       #4F46E5;
      --color-primary-dark:  #4338CA;
      --color-primary-light: #EEF2FF;
      --color-bg:            #F8FAFC;
      --color-surface:       #FFFFFF;
      --color-border:        #E2E8F0;
      --color-text:          #0F172A;
      --color-text-muted:    #475569;
      --color-text-subtle:   #94A3B8;
      --color-success:       #10B981;
      --color-warning:       #F59E0B;
      --color-danger:        #EF4444;
      --radius-sm:           0.375rem;
      --radius-md:           0.5rem;
      --radius-lg:           0.75rem;
      --radius-xl:           1rem;
      --shadow-card:         0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06);
      --shadow-modal:        0 10px 25px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
      --transition:          150ms cubic-bezier(0.4,0,0.2,1);
    }

    /* ── Base ───────────────────────────────────────────────────────── */
    * { box-sizing: border-box; }

    html { font-size: 16px; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--color-bg);
      color: var(--color-text);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Scrollbar ──────────────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }

    /* ── Focus ring ─────────────────────────────────────────────────── */
    :focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* ── Page container ──────────────────────────────────────────────── */
    .page-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    /* ── Card ───────────────────────────────────────────────────────── */
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
    }

    /* ── Stat badge ─────────────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-primary { background: var(--color-primary-light); color: var(--color-primary); }
    .badge-success { background: #ECFDF5; color: #059669; }
    .badge-warning { background: #FFFBEB; color: #D97706; }
    .badge-danger  { background: #FEF2F2; color: #DC2626; }

    /* ── Progress bar ───────────────────────────────────────────────── */
    .progress-bar {
      height: 6px;
      background: var(--color-border);
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
      background: var(--color-primary);
      transition: width 0.6s ease;
    }

    /* ── Animations ─────────────────────────────────────────────────── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
      50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    }
    @keyframes shimmer {
      0%   { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }

    .animate-fade-in { animation: fadeIn 0.3s ease forwards; }
    .animate-pulse-ring { animation: pulse-ring 1.5s ease infinite; }

    /* ── Skeleton loader ────────────────────────────────────────────── */
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200px 100%;
      animation: shimmer 1.2s ease-in-out infinite;
      border-radius: var(--radius-md);
    }
    ```

    Update `frontend/tailwind.config.js` to extend theme with brand colors:
    ```js
    /** @type {import('tailwindcss').Config} */
    export default {
      content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
      theme: {
        extend: {
          colors: {
            primary: {
              DEFAULT: '#4F46E5',
              dark:    '#4338CA',
              light:   '#EEF2FF',
              50:      '#EEFCFF',
            },
            brand: {
              bg:      '#F8FAFC',
              surface: '#FFFFFF',
              border:  '#E2E8F0',
              text:    '#0F172A',
              muted:   '#475569',
              subtle:  '#94A3B8',
            },
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
          },
          borderRadius: {
            DEFAULT: '0.5rem',
            lg:      '0.75rem',
            xl:      '1rem',
          },
          boxShadow: {
            card:  '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06)',
            modal: '0 10px 25px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
          },
        },
      },
      plugins: [],
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/index.css contains `@import url('https://fonts.googleapis.com/css2?family=Inter`
    - frontend/src/index.css contains `--color-primary:       #4F46E5`
    - frontend/src/index.css contains `.card {`
    - frontend/src/index.css contains `@keyframes fadeIn`
    - frontend/tailwind.config.js contains `primary:` color extension
    - frontend/tailwind.config.js contains `fontFamily: { sans: ['Inter'`
    - `npm run build` exits with code 0
  </acceptance_criteria>
</task>

<task id="3.2">
  <title>Build reusable UI components — Button, Input, Card</title>
  <read_first>
    - frontend/src/index.css (design tokens defined above)
    - frontend/src/components/ (confirm directory exists)
  </read_first>
  <action>
    Create `frontend/src/components/ui/Button.jsx`:
    ```jsx
    import { forwardRef } from 'react'

    const variants = {
      primary:  'bg-primary text-white hover:bg-primary-dark shadow-sm active:scale-[0.98]',
      outline:  'bg-white text-primary border border-primary hover:bg-primary-light active:scale-[0.98]',
      ghost:    'bg-transparent text-brand-muted hover:bg-gray-100 active:scale-[0.98]',
      danger:   'bg-red-500 text-white hover:bg-red-600 shadow-sm active:scale-[0.98]',
    }
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const Button = forwardRef(({
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      className = '',
      disabled,
      ...props
    }, ref) => {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={`
            inline-flex items-center justify-center gap-2
            font-medium rounded-lg transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${variants[variant]} ${sizes[size]} ${className}
          `}
          {...props}
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          )}
          {children}
        </button>
      )
    })
    Button.displayName = 'Button'
    export default Button
    ```

    Create `frontend/src/components/ui/Input.jsx`:
    ```jsx
    import { forwardRef } from 'react'

    const Input = forwardRef(({
      label,
      error,
      hint,
      className = '',
      containerClassName = '',
      ...props
    }, ref) => {
      return (
        <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
          {label && (
            <label className="text-sm font-medium text-brand-text">
              {label}
            </label>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3.5 py-2.5 text-sm
              bg-white border rounded-lg
              text-brand-text placeholder:text-brand-subtle
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              disabled:bg-gray-50 disabled:cursor-not-allowed
              ${error ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : 'border-brand-border'}
              ${className}
            `}
            {...props}
          />
          {error && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
          {hint && !error && <p className="text-xs text-brand-subtle">{hint}</p>}
        </div>
      )
    })
    Input.displayName = 'Input'
    export default Input
    ```

    Create `frontend/src/components/ui/Card.jsx`:
    ```jsx
    const Card = ({ children, className = '', padding = true, ...props }) => (
      <div
        className={`card ${padding ? 'p-6' : ''} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
    export default Card
    ```

    Create `frontend/src/components/ui/index.js` (barrel export):
    ```js
    export { default as Button } from './Button.jsx'
    export { default as Input } from './Input.jsx'
    export { default as Card } from './Card.jsx'
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/components/ui/Button.jsx exists and contains `forwardRef`
    - frontend/src/components/ui/Button.jsx contains `loading` prop with spinner
    - frontend/src/components/ui/Input.jsx exists and contains `error` prop styling
    - frontend/src/components/ui/Card.jsx exists
    - frontend/src/components/ui/index.js exists and exports Button, Input, Card
  </acceptance_criteria>
</task>

<task id="3.3">
  <title>Build Navbar component matching mockup style</title>
  <read_first>
    - frontend/src/store/authStore.js
    - frontend/src/components/ui/Button.jsx
    - frontend/src/index.css (color tokens)
  </read_first>
  <action>
    Create `frontend/src/components/layout/Navbar.jsx`:
    ```jsx
    import { Link, NavLink, useNavigate } from 'react-router-dom'
    import useAuthStore from '../../store/authStore.js'
    import Button from '../ui/Button.jsx'

    const NAV_LINKS = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/history',   label: 'History' },
      { to: '/report',    label: 'Reports' },
    ]

    export default function Navbar() {
      const { user, isAuthenticated, logout } = useAuthStore()
      const navigate = useNavigate()

      const handleLogout = () => {
        logout()
        navigate('/login')
      }

      return (
        <header className="sticky top-0 z-50 bg-white border-b border-brand-border">
          <div className="page-container flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                <span className="text-brand-text">Interview</span>
                <span className="text-primary">AI</span>
              </span>
            </Link>

            {/* Nav links — only when authenticated */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
                {NAV_LINKS.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                        isActive
                          ? 'text-primary border-b-2 border-primary rounded-none pb-[calc(0.5rem-2px)]'
                          : 'text-brand-muted hover:text-brand-text hover:bg-gray-50'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            )}

            {/* Right section */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {/* Notification bell */}
                  <button className="p-2 text-brand-muted hover:text-brand-text rounded-lg hover:bg-gray-50 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>

                  {/* Avatar */}
                  <div className="relative group">
                    <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    </button>
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-1 w-48 card shadow-modal py-1 hidden group-focus-within:block">
                      <Link to="/profile"
                        className="block px-4 py-2 text-sm text-brand-muted hover:text-brand-text hover:bg-gray-50">
                        Profile
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                    Log in
                  </Button>
                  <Button size="sm" onClick={() => navigate('/register')}>
                    Get started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>
      )
    }
    ```

    Create `frontend/src/components/layout/ProtectedRoute.jsx`:
    ```jsx
    import { Navigate, useLocation } from 'react-router-dom'
    import useAuthStore from '../../store/authStore.js'

    /**
     * Wraps routes that require authentication.
     * Redirects to /login with the attempted URL saved as state.
     */
    export default function ProtectedRoute({ children }) {
      const { isAuthenticated } = useAuthStore()
      const location = useLocation()

      if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
      }

      return children
    }
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/components/layout/Navbar.jsx exists
    - frontend/src/components/layout/Navbar.jsx contains `InterviewAI` brand text
    - frontend/src/components/layout/Navbar.jsx contains `NavLink` for Dashboard, History, Reports
    - frontend/src/components/layout/Navbar.jsx contains avatar dropdown with logout
    - frontend/src/components/layout/ProtectedRoute.jsx exists
    - frontend/src/components/layout/ProtectedRoute.jsx contains `Navigate to="/login"`
  </acceptance_criteria>
</task>

<task id="3.4">
  <title>Update auth Zustand store with persistence + update auth API module</title>
  <read_first>
    - frontend/src/store/authStore.js (current stub)
    - frontend/src/api/axios.js
  </read_first>
  <action>
    Replace `frontend/src/store/authStore.js`:
    ```js
    import { create } from 'zustand'
    import { persist } from 'zustand/middleware'

    const useAuthStore = create(
      persist(
        (set, get) => ({
          user: null,
          token: null,
          isAuthenticated: false,

          setAuth: (user, token) => set({
            user,
            token,
            isAuthenticated: true,
          }),

          setToken: (token) => set({ token }),

          updateUser: (updates) => set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
          })),

          logout: () => {
            localStorage.removeItem('accessToken')
            set({ user: null, token: null, isAuthenticated: false })
          },
        }),
        {
          name: 'auth-storage',
          partialize: (state) => ({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            // Note: token NOT persisted — fetched fresh via /refresh on page load
          }),
        }
      )
    )

    export default useAuthStore
    ```

    Create `frontend/src/api/auth.js`:
    ```js
    import api from './axios.js'

    export const authApi = {
      register: (data) => api.post('/api/auth/register', data),
      login: (data) => api.post('/api/auth/login', data),
      logout: () => api.post('/api/auth/logout'),
      refresh: () => api.post('/api/auth/refresh'),
      me: () => api.get('/api/auth/me'),
    }
    ```

    Update `frontend/src/api/axios.js` — add a refresh token interceptor that retries on 401:
    Replace the file content:
    ```js
    import axios from 'axios'

    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      withCredentials: true,
    })

    // Request interceptor — attach access token
    api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken')
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    }, Promise.reject)

    // Response interceptor — auto-refresh on 401, then retry once
    let isRefreshing = false
    let refreshQueue = []

    const processQueue = (error, token = null) => {
      refreshQueue.forEach(({ resolve, reject }) =>
        error ? reject(error) : resolve(token)
      )
      refreshQueue = []
    }

    api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config
        if (error.response?.status === 401 && !original._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              refreshQueue.push({ resolve, reject })
            }).then((token) => {
              original.headers.Authorization = `Bearer ${token}`
              return api(original)
            })
          }

          original._retry = true
          isRefreshing = true

          try {
            const { data } = await api.post('/api/auth/refresh')
            const newToken = data?.data?.accessToken
            if (newToken) {
              localStorage.setItem('accessToken', newToken)
              api.defaults.headers.common.Authorization = `Bearer ${newToken}`
              processQueue(null, newToken)
              original.headers.Authorization = `Bearer ${newToken}`
              return api(original)
            }
          } catch (refreshError) {
            processQueue(refreshError, null)
            localStorage.removeItem('accessToken')
            window.location.href = '/login'
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        }
        return Promise.reject(error)
      }
    )

    export default api
    ```
  </action>
  <acceptance_criteria>
    - frontend/src/store/authStore.js contains `persist(`
    - frontend/src/store/authStore.js contains `setAuth: (user, token)`
    - frontend/src/store/authStore.js contains `partialize`
    - frontend/src/api/auth.js exists and contains `register`, `login`, `logout`, `refresh`, `me`
    - frontend/src/api/axios.js contains `isRefreshing` queue pattern
    - frontend/src/api/axios.js contains `api.post('/api/auth/refresh')`
  </acceptance_criteria>
</task>

## Verification

```bash
cd frontend && npm run build
```

Exit code 0 with no errors.

## must_haves
- [ ] Design tokens in CSS: `--color-primary: #4F46E5`, Inter font imported
- [ ] Tailwind config extended with `primary` color and `Inter` font family
- [ ] Button component has `loading` spinner, 4 variants, 3 sizes
- [ ] Input component has error/hint states
- [ ] Navbar shows brand, nav links (auth'd only), avatar dropdown
- [ ] ProtectedRoute redirects unauthenticated users to `/login`
- [ ] Auth store uses zustand/persist (user persisted, token not)
- [ ] Axios interceptor auto-refreshes token on 401 with queue
