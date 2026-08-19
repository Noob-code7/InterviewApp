import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { authApi } from "../api/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    return e;
  };

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: "" }));
    setServerError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setServerError("");
    try {
      const { data } = await authApi.login(form);
      const { accessToken, user } = data.data;
      localStorage.setItem("accessToken", accessToken);
      setAuth(user, accessToken);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.error || "Invalid credentials. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans flex flex-col justify-between">
      {/* Top Header */}
      <div className="border-b border-[#E0DFD9] bg-white/70 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-extrabold tracking-wider text-[#111110] flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#1D5DFF] rounded-sm inline-block" />
          <span>INTERVIEWAI</span>
        </Link>
        <span className="text-sm text-[#4B5563] font-medium">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-[#1D5DFF] hover:underline font-bold">
            Get started
          </Link>
        </span>
      </div>

      {/* Centered Auth Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-[#E0DFD9] rounded-2xl p-8 sm:p-10 shadow-sm hover:shadow-md transition-all duration-300">
          
          <div className="mb-8">
            <div className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider mb-2">
              AUTHENTICATED ACCESS
            </div>
            <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
              Sign in to InterviewAI
            </h1>
            <p className="text-sm text-[#4B5563] mt-2 font-medium">
              Continue your AI-powered interview practice and performance review.
            </p>
          </div>

          {serverError && (
            <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded-lg flex items-start gap-2">
              <span className="text-red-600 font-bold">!</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-2">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update("email")}
                autoComplete="email"
                autoFocus
                className={`w-full bg-[#FAF9F5] border px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                  errors.email ? "border-red-400 bg-red-50/30" : "border-[#E0DFD9]"
                }`}
              />
              {errors.email && <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="font-mono text-xs font-bold uppercase text-[#111110] tracking-wide">
                  Password
                </label>
                <button type="button" className="text-xs font-bold text-[#1D5DFF] hover:underline" tabIndex={-1}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update("password")}
                  autoComplete="current-password"
                  className={`w-full bg-[#FAF9F5] border px-4 py-3 pr-11 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                    errors.password ? "border-red-400 bg-red-50/30" : "border-[#E0DFD9]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111110] p-1 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.password}</p>}
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#111110] text-[#F6F5F0] py-3.5 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 disabled:opacity-50 shadow-sm active:scale-98 mt-2"
            >
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-[#E0DFD9] py-4 text-center text-xs font-medium text-[#6B7280]">
        InterviewAI Telemetry Platform • Enterprise & Candidate Portal
      </div>
    </div>
  );
}
