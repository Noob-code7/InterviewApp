import { Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import InterviewSetupPage from './pages/InterviewSetupPage.jsx'
import LiveInterviewPage from './pages/LiveInterviewPage.jsx'
import ProcessingPage from './pages/ProcessingPage.jsx'

// ── Placeholder for pages built in future phases ──────────────────────────────
const Placeholder = ({ name }) => (
  <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-brand-bg">
    <div className="card p-12 text-center max-w-sm w-full mx-4">
      <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-xl font-bold text-brand-text mb-2">{name}</h1>
      <p className="text-sm text-brand-muted">Coming in a future phase</p>
    </div>
  </div>
)

// ── Layout wrapper: page with top Navbar ──────────────────────────────────────
const WithNavbar = ({ children }) => (
  <>
    <Navbar />
    <main>{children}</main>
  </>
)

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      {/* Public routes — no Navbar */}
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes — with Navbar */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <WithNavbar><DashboardPage /></WithNavbar>
        </ProtectedRoute>
      } />
      <Route path="/interview/setup" element={
        <ProtectedRoute>
          <WithNavbar><InterviewSetupPage /></WithNavbar>
        </ProtectedRoute>
      } />
      <Route path="/interview/live/:sessionId" element={
        <ProtectedRoute>
          <LiveInterviewPage />
        </ProtectedRoute>
      } />
      <Route path="/interview/writing/:sessionId" element={
        <ProtectedRoute>
          <Placeholder name="Writing Test" />
        </ProtectedRoute>
      } />
      <Route path="/interview/processing" element={
        <ProtectedRoute>
          <WithNavbar><ProcessingPage /></WithNavbar>
        </ProtectedRoute>
      } />
      <Route path="/report/:sessionId" element={
        <ProtectedRoute>
          <WithNavbar><Placeholder name="Interview Report" /></WithNavbar>
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
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-brand-bg">
            <div className="card p-12 text-center max-w-sm w-full mx-4">
              <h1 className="text-6xl font-extrabold text-primary mb-4">404</h1>
              <p className="text-brand-muted">Page not found.</p>
            </div>
          </div>
        </WithNavbar>
      } />
    </Routes>
  )
}

export default App
