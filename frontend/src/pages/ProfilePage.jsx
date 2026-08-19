import { useState, useEffect } from "react";
import useAuthStore from "../store/authStore.js";
import { authApi } from "../api/auth.js";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [formData, setFormData] = useState({ name: "", email: "", college: "", targetRole: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        college: user.college || "",
        targetRole: user.targetRole || "",
        password: "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = { name: formData.name, college: formData.college, targetRole: formData.targetRole };
      if (formData.password) {
        if (formData.password.length < 6) {
          setError("New password must be at least 6 characters.");
          setSaving(false);
          return;
        }
        payload.password = formData.password;
      }
      const { data } = await authApi.updateProfile(payload);
      setUser(data.data.user);
      setMessage("Profile credentials updated successfully.");
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-semibold placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all";
  const labelCls = "block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5";

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-10 pb-20 px-6">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">

        {/* Top Header */}
        <div className="border-b border-[#E0DFD9] pb-6">
          <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
            ACCOUNT CREDENTIALS
          </span>
          <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
            Candidate Profile & Settings
          </h1>
          <p className="text-xs text-[#4B5563] font-medium mt-1">
            Manage university affiliation, target specialization, and account credentials.
          </p>
        </div>

        {/* Profile Identity Card */}
        <div className="bg-[#111110] text-[#F6F5F0] rounded-2xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-xl bg-[#1D5DFF] flex items-center justify-center text-2xl font-black font-mono shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="space-y-0.5">
            <div className="text-xl font-extrabold text-white">{user?.name || "Candidate"}</div>
            <div className="text-xs text-[#9CA3AF] font-mono">{user?.email}</div>
            {user?.targetRole && (
              <div className="text-xs font-bold text-[#1D5DFF] mt-1">{user.targetRole}</div>
            )}
          </div>
        </div>

        {message && (
          <div className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-800 text-xs font-bold rounded-xl">
            ! {error}
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#111110] border-b border-[#E0DFD9] pb-3">
              Personal Information
            </h2>
            <div>
              <label className={labelCls}>Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Email (Identifier)</label>
              <input type="email" name="email" value={formData.email} disabled className="w-full bg-[#E5E7EB]/50 border border-[#E0DFD9] px-4 py-3 text-sm text-[#6B7280] font-semibold rounded-lg cursor-not-allowed" />
            </div>
          </div>

          <div className="space-y-4 border-t border-[#E0DFD9] pt-6">
            <h2 className="text-base font-extrabold text-[#111110] border-b border-[#E0DFD9] pb-3">
              Career & Campus Placement
            </h2>
            <div>
              <label className={labelCls}>College / University</label>
              <input type="text" name="college" value={formData.college} onChange={handleChange} placeholder="e.g. Stanford Engineering" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Target Engineering Specialization</label>
              <input type="text" name="targetRole" value={formData.targetRole} onChange={handleChange} placeholder="e.g. Fullstack Systems Engineer" className={inputCls} />
            </div>
          </div>

          <div className="space-y-4 border-t border-[#E0DFD9] pt-6">
            <h2 className="text-base font-extrabold text-[#111110] border-b border-[#E0DFD9] pb-3">
              Update Security Password
            </h2>
            <div>
              <label className={labelCls}>New Password (Optional)</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Leave blank to keep current password" className={inputCls} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-8 py-3 text-sm font-bold rounded-lg transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Profile Settings →"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
