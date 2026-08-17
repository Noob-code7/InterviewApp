import { Link, NavLink, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore.js";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/interview/setup", label: "Start Practice" },
  { to: "/history", label: "History & Reports" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#F6F5F0]/95 backdrop-blur-sm border-b border-[#E0DFD9]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="font-mono text-sm font-semibold tracking-wider text-[#111110] flex items-center gap-1.5"
        >
          <span>INTERVIEWAI</span>
        </Link>

        {/* Nav links — only when authenticated */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={label}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "text-[#1D5DFF] font-semibold"
                      : "text-[#6E6D68] hover:text-[#111110]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/faculty"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "text-[#1D5DFF] font-semibold"
                    : "text-[#6E6D68] hover:text-[#111110]"
                }`
              }
            >
              Faculty Portal
            </NavLink>
          </nav>
        )}

        {/* Right section */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* User Avatar */}
              <Link
                to="/profile"
                className="w-9 h-9 rounded-full bg-[#111110] text-[#F6F5F0] flex items-center justify-center text-xs font-semibold font-mono hover:ring-2 hover:ring-[#1D5DFF] transition-all"
                title={user?.name || "Profile"}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </Link>

              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-[#6E6D68] hover:text-red-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/login")}
                className="text-sm text-[#6E6D68] hover:text-[#111110] transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("/register")}
                className="bg-[#111110] text-[#F6F5F0] text-sm px-4 py-2 rounded hover:bg-[#2A2A28] transition-colors font-medium"
              >
                Start practicing →
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
