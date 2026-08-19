import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { authApi } from "../api/auth.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", college: "", targetRole: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: "" }));
    setServerError("");
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    return e;
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setServerError("");
    try {
      const { data } = await authApi.register({
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        college: form.college.trim(),
        targetRole: form.targetRole.trim(),
      });
      const { accessToken, user } = data.data;
      localStorage.setItem("accessToken", accessToken);
      setAuth(user, accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.error || "Registration failed. Please try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const ROLES = ["Software Engineer", "Frontend Developer", "Backend Engineer", "Product Manager", "Data Analyst"];

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans flex flex-col justify-between">
      {/* Top Header */}
      <div className="border-b border-[#E0DFD9] bg-white/70 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-extrabold tracking-wider text-[#111110] flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#1D5DFF] rounded-sm inline-block" />
          <span>INTERVIEWAI</span>
        </Link>
        <span className="text-sm text-[#4B5563] font-medium">
          Already registered?{" "}
          <Link to="/login" className="text-[#1D5DFF] hover:underline font-bold">
            Sign in
          </Link>
        </span>
      </div>

      {/* Centered Register Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-[#E0DFD9] rounded-2xl p-8 sm:p-10 shadow-sm hover:shadow-md transition-all duration-300">

          {/* Clean Geometric Step Tracker */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-2">
              <span className={step === 1 ? "text-[#1D5DFF]" : "text-[#111110]"}>01. ACCOUNT CREDENTIALS</span>
              <span className={step === 2 ? "text-[#1D5DFF]" : "text-[#6B7280]"}>02. CANDIDATE PROFILE</span>
            </div>
            <div className="w-full bg-[#FAF9F5] border border-[#E0DFD9] h-1.5 rounded-sm overflow-hidden">
              <div
                className="bg-[#1D5DFF] h-full transition-all duration-300 ease-out"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111110] tracking-tight">
              {step === 1 ? "Create Candidate Account" : "Customize Practice Profile"}
            </h1>
            <p className="text-sm text-[#4B5563] mt-1 font-medium">
              {step === 1
                ? "Start practicing with real-time multimodal evaluation."
                : "Help us ground questions in your university and target role."}
            </p>
          </div>

          {serverError && (
            <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded-lg">
              {serverError}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} noValidate className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={update("name")}
                  autoComplete="name"
                  autoFocus
                  className={`w-full bg-[#FAF9F5] border px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                    errors.name ? "border-red-400 bg-red-50/30" : "border-[#E0DFD9]"
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs font-semibold text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="reg-email" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update("email")}
                  autoComplete="email"
                  className={`w-full bg-[#FAF9F5] border px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                    errors.email ? "border-red-400 bg-red-50/30" : "border-[#E0DFD9]"
                  }`}
                />
                {errors.email && <p className="mt-1 text-xs font-semibold text-red-600">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-password" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={update("password")}
                    autoComplete="new-password"
                    className={`w-full bg-[#FAF9F5] border px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                      errors.password ? "border-red-400" : "border-[#E0DFD9]"
                    }`}
                  />
                  {errors.password && <p className="mt-1 text-xs font-semibold text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                    Confirm
                  </label>
                  <input
                    id="reg-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    autoComplete="new-password"
                    className={`w-full bg-[#FAF9F5] border px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all ${
                      errors.confirmPassword ? "border-red-400" : "border-[#E0DFD9]"
                    }`}
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs font-semibold text-red-600">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button
                id="reg-step1-submit"
                type="submit"
                className="w-full bg-[#111110] text-[#F6F5F0] py-3.5 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 shadow-sm active:scale-98 mt-3"
              >
                Continue to Profile Setup →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="reg-college" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                  College / University
                </label>
                <input
                  id="reg-college"
                  type="text"
                  placeholder="e.g. IIT Delhi, Stanford Engineering"
                  value={form.college}
                  onChange={update("college")}
                  className="w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all"
                />
              </div>

              <div>
                <label htmlFor="reg-role" className="block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5">
                  Target Engineering Role
                </label>
                <input
                  id="reg-role"
                  type="text"
                  placeholder="e.g. Fullstack Systems Engineer"
                  value={form.targetRole}
                  onChange={update("targetRole")}
                  className="w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-medium placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all"
                />
              </div>

              <div>
                <span className="block font-mono text-xs font-bold uppercase text-[#6B7280] tracking-wide mb-2">
                  Quick Select Role
                </span>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, targetRole: r }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        form.targetRole === r
                          ? "bg-[#111110] text-white border-[#111110]"
                          : "bg-[#FAF9F5] text-[#4B5563] border-[#E0DFD9] hover:border-[#111110] hover:text-[#111110]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-white border border-[#E0DFD9] text-[#111110] py-3 text-sm font-bold rounded-lg hover:border-[#111110] transition-colors"
                >
                  ← Back
                </button>
                <button
                  id="reg-submit"
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#111110] text-[#F6F5F0] py-3 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 disabled:opacity-50 shadow-sm active:scale-98"
                >
                  {loading ? "Creating..." : "Complete & Launch →"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      <div className="border-t border-[#E0DFD9] py-4 text-center text-xs font-medium text-[#6B7280]">
        By continuing, you agree to InterviewAI Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}
