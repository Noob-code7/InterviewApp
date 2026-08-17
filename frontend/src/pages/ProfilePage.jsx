import { useState, useEffect } from "react";
import useAuthStore from "../store/authStore.js";
import { authApi } from "../api/auth.js";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    college: "",
    targetRole: "",
    password: "",
  });

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
      const payload = {
        name: formData.name,
        college: formData.college,
        targetRole: formData.targetRole,
      };

      if (formData.password) {
        if (formData.password.length < 6) {
          setError("New password must be at least 6 characters.");
          setSaving(false);
          return;
        }
        payload.password = formData.password;
      }

      const { data } = await authApi.updateProfile(payload);
      const updatedUser = data.data.user;

      setUser(updatedUser);
      setMessage("Profile updated successfully!");
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-8 pb-16 px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header Title */}
        <div className="border-b border-[#E0DFD9] pb-6">
          <div className="font-mono text-xs text-[#1D5DFF] tracking-widest uppercase mb-1 font-semibold">
            ACCOUNT SETTINGS
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111110]">
            Candidate Profile
          </h1>
          <p className="text-xs text-[#6E6D68] mt-1">
            Manage your account credentials, university affiliation, and target career path.
          </p>
        </div>

        {/* Success / Error Banners */}
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-mono">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-[#E0DFD9] rounded-2xl p-6 space-y-6 shadow-sm">
          
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider mb-2 font-medium">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-[#F6F5F0] border border-[#E0DFD9] focus:border-[#1D5DFF] rounded-xl px-4 py-3 text-xs text-[#111110] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider mb-2 font-medium">
                Email Address (Account Identifier)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full bg-[#E0DFD9]/30 border border-[#E0DFD9] rounded-xl px-4 py-3 text-xs text-[#6E6D68] outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider mb-2 font-medium">
                College / University
              </label>
              <input
                type="text"
                name="college"
                value={formData.college}
                onChange={handleChange}
                placeholder="e.g. Stanford University"
                className="w-full bg-[#F6F5F0] border border-[#E0DFD9] focus:border-[#1D5DFF] rounded-xl px-4 py-3 text-xs text-[#111110] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider mb-2 font-medium">
                Target Role / Specialization
              </label>
              <input
                type="text"
                name="targetRole"
                value={formData.targetRole}
                onChange={handleChange}
                placeholder="e.g. Full Stack Engineer"
                className="w-full bg-[#F6F5F0] border border-[#E0DFD9] focus:border-[#1D5DFF] rounded-xl px-4 py-3 text-xs text-[#111110] outline-none transition-colors"
              />
            </div>

            <div className="pt-2 border-t border-[#E0DFD9]">
              <label className="block font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider mb-2 font-medium">
                Update Password (Optional)
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
                className="w-full bg-[#F6F5F0] border border-[#E0DFD9] focus:border-[#1D5DFF] rounded-xl px-4 py-3 text-xs text-[#111110] outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {saving ? "Saving Changes..." : "Save Profile Changes"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
