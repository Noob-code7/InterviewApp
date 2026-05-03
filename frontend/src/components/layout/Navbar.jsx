import { Link, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import Button from '../ui/Button.jsx'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history',   label: 'History' },
  { to: '/history',   label: 'Reports' },
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
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2">
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
                key={label}
                to={to}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors duration-150 relative ${
                    isActive
                      ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full'
                      : 'text-brand-muted hover:text-brand-text rounded-lg hover:bg-gray-50'
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
              <button
                id="nav-notifications"
                className="p-2 text-brand-muted hover:text-brand-text rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              {/* Avatar dropdown */}
              <div className="relative group">
                <button
                  id="nav-avatar"
                  className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/30 transition-all"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold select-none">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </button>

                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-2 w-52 card shadow-modal py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                  <div className="px-4 py-2 border-b border-brand-border">
                    <p className="text-sm font-medium text-brand-text truncate">{user?.name}</p>
                    <p className="text-xs text-brand-subtle truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-brand-muted hover:text-brand-text hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                  <button
                    id="nav-logout"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
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
