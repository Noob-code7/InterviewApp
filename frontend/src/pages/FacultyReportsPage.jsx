import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";

export default function FacultyReportsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("all");

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/sessions/history");
      setSessions(res.data?.data?.sessions || []);
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const exportCSV = () => {
    if (!sessions || sessions.length === 0) {
      alert("No candidate student records to export.");
      return;
    }

    const headers = [
      "Student Name",
      "Roll Number / ID",
      "Department",
      "Graduation Year",
      "Candidate Email",
      "Role",
      "Interview Type",
      "Overall Score %",
      "Readiness Level",
      "Proctoring Alert"
    ];

    const rows = sessions.map((s) => [
      s.candidateName || s.userId?.name || "Student Candidate",
      s.rollNo || "N/A",
      s.department || "General",
      s.graduationYear || "2026",
      s.userId?.email || "N/A",
      s.role || "General",
      s.interviewType || "mixed",
      s.overallScore ? `${s.overallScore}%` : "Pending",
      s.readinessLevel || "N/A",
      s.faceSubstitutionAlert ? "FLAGGED" : "CLEAN"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Student_Placement_Roster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSessions = sessions.filter((s) => {
    const nameStr = (s.candidateName || s.userId?.name || "").toLowerCase();
    const rollStr = (s.rollNo || "").toLowerCase();
    const roleStr = (s.role || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = nameStr.includes(query) || rollStr.includes(query) || roleStr.includes(query);
    const matchesDept = filterDept === "all" || (s.department || "").toLowerCase().includes(filterDept.toLowerCase());
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-10 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E0DFD9] pb-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
              FACULTY PLACEMENT COMMAND
            </span>
            <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
              Student Assessment Roster & Reports
            </h1>
            <p className="text-xs text-[#4B5563] font-medium mt-1">
              Candidate verification roster with evaluation scores, multi-modal metrics, and biometric proctoring alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="px-5 py-2.5 bg-white border border-[#E0DFD9] hover:border-[#111110] text-[#111110] rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              Export CSV Roster ↓
            </button>
            <Link
              to="/faculty/dashboard"
              className="px-5 py-2.5 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              Configure Drives →
            </Link>
          </div>
        </div>

        {/* Roster Table Card */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E0DFD9] pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#111110]">
                Candidate Roster ({filteredSessions.length} Students)
              </h2>
              <p className="text-xs text-[#4B5563] font-medium">Click on any completed student record to inspect the comprehensive report.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search candidate name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 rounded-lg border border-[#E0DFD9] bg-[#FAF9F5] text-xs font-semibold text-[#111110] focus:outline-none w-full sm:w-64"
              />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#E0DFD9] bg-[#FAF9F5] text-xs font-semibold text-[#111110] focus:outline-none"
              >
                <option value="all">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">IT</option>
                <option value="Electronics">Electronics (ECE)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-[#6B7280]">Loading student candidate roster...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-[#6B7280]">No student assessment records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E0DFD9] bg-[#FAF9F5] text-[#111110] font-mono text-[10px] uppercase font-bold">
                    <th className="py-3 px-4">Candidate Student</th>
                    <th className="py-3 px-4">Roll / ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Target Role</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4">Proctoring</th>
                    <th className="py-3 px-4 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0DFD9]">
                  {filteredSessions.map((s) => (
                    <tr key={s._id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#111110]">
                        {s.candidateName || s.userId?.name || "Student Candidate"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4B5563]">{s.rollNo || "N/A"}</td>
                      <td className="py-3.5 px-4 font-medium text-[#4B5563]">{s.department || "General"}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#111110]">{s.role || "Technical"}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-sm text-[#111110]">
                        {s.overallScore != null ? `${s.overallScore}%` : "--"}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.faceSubstitutionAlert ? (
                          <span className="font-mono text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                            FLAGGED
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            CLEAN
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/report/${s._id}`}
                          className="font-bold text-[#1D5DFF] hover:underline"
                        >
                          View Report →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
