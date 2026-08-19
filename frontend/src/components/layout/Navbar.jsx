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
    <header className="sticky top-0 z-50 bg-[#F6F5F0]/95 backdrop-blur-md border-b border-[#E0DFD9] transition-all">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="font-mono text-sm font-extrabold tracking-wider text-[#111110] flex items-center gap-2 hover:opacity-85 transition-opacity"
        >
          <span className="w-2.5 h-2.5 bg-[#1D5DFF] rounded-sm inline-block" />
          <span>INTERVIEWAI</span>
        </Link>

        {/* Nav links - when authenticated */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={label}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-all duration-150 relative py-1 ${
                    isActive
                      ? "text-[#111110] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1D5DFF]"
                      : "text-[#4B5563] hover:text-[#111110]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/faculty"
              className={({ isActive }) =>
                `text-sm font-semibold transition-all duration-150 relative py-1 ${
                  isActive
                    ? "text-[#111110] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1D5DFF]"
                    : "text-[#4B5563] hover:text-[#111110]"
                }`
              }
            >
              Faculty Portal
            </NavLink>
          </nav>
        )}

        {/* Right action area */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="w-9 h-9 rounded-lg bg-[#111110] text-[#F6F5F0] flex items-center justify-center text-xs font-bold font-mono hover:bg-[#1D5DFF] transition-all duration-200 shadow-sm"
                title={user?.name || "Profile"}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </Link>

              <button
                onClick={handleLogout}
                className="text-xs font-bold text-[#4B5563] hover:text-red-600 transition-colors px-2 py-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/login")}
                className="text-sm font-bold text-[#4B5563] hover:text-[#111110] transition-colors px-3 py-2"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("/register")}
                className="bg-[#111110] text-[#F6F5F0] text-sm px-5 py-2.5 rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 font-bold shadow-sm active:scale-98"
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
