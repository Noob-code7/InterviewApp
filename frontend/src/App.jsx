import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/layout/Navbar.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import InterviewSetupPage from "./pages/InterviewSetupPage.jsx";
import LiveInterviewPage from "./pages/LiveInterviewPage.jsx";
import ProcessingPage from "./pages/ProcessingPage.jsx";
import AdminQuestionsPage from "./pages/AdminQuestionsPage.jsx";
import WritingTestPage from "./pages/WritingTestPage.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

import FacultyHubPage from "./pages/FacultyHubPage.jsx";
import FacultyDashboardPage from "./pages/FacultyDashboardPage.jsx";
import FacultyReportsPage from "./pages/FacultyReportsPage.jsx";

// ── Layout wrapper: page with top Navbar ──────────────────────────────────────
const WithNavbar = ({ children }) => (
  <>
    <Navbar />
    <main>{children}</main>
  </>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      {/* Primary Home — Landing & Authenticated Hub */}
      <Route
        path="/"
        element={
          <WithNavbar>
            <LandingPage />
          </WithNavbar>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Redirect old /dashboard route to new primary Home */}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />

      {/* Protected features */}
      <Route
        path="/interview/setup"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <InterviewSetupPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/live/:sessionId"
        element={
          <ProtectedRoute>
            <LiveInterviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/writing/:sessionId"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <WritingTestPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <FacultyHubPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <FacultyDashboardPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/dashboard"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <FacultyDashboardPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/reports"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <FacultyReportsPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/processing"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <ProcessingPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/report/:sessionId"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <ReportPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <HistoryPage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <WithNavbar>
              <ProfilePage />
            </WithNavbar>
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={
          <WithNavbar>
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#F6F5F0]">
              <div className="bg-white border border-[#E0DFD9] rounded-2xl p-12 text-center max-w-sm w-full mx-4 shadow-sm">
                <h1 className="text-6xl font-extrabold text-[#111110] mb-4">
                  404
                </h1>
                <p className="text-sm text-[#111110]/60">Page not found.</p>
              </div>
            </div>
          </WithNavbar>
        }
      />
    </Routes>
  );
}

export default App;
