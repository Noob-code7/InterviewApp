import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import { Card } from "../components/ui/index.js";

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
    <div className="min-h-screen bg-[#F6F5F0] text-[#161615] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E2DFD8] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to="/faculty/dashboard" className="text-xs font-semibold text-[#1D5DFF] hover:underline">
                ← Back to Placement Drives & Question Settings
              </Link>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-[#1D5DFF] border border-blue-100">
              Faculty Command Center
            </span>
            <h1 className="text-3xl font-extrabold text-[#161615] tracking-tight mt-2">
              Student Assessment Roster & Analytics Reports
            </h1>
            <p className="text-xs text-[#6E6D68] mt-1">
              Primary student identification roster showing student name, roll number, department, evaluation scores, and visual proctoring alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="px-4 py-2.5 bg-white border border-[#E2DFD8] text-[#161615] hover:bg-[#FAF9F5] rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <span>📊</span> Export Roster (CSV)
            </button>
          </div>
        </div>

        {/* Candidate Student Roster Table */}
        <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#161615]">Student Roster ({filteredSessions.length} Candidates)</h2>
              <p className="text-xs text-[#6E6D68]">Identified by Student Name, Roll Number, and Department.</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search student name, roll no, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none w-full md:w-64"
              />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none"
              >
                <option value="all">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">IT</option>
                <option value="Electronics">Electronics (ECE)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#6E6D68]">Loading student roster...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6E6D68]">No student interview sessions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DFD8] bg-[#FAF9F5] text-[#6E6D68] uppercase font-mono tracking-wider text-[10px]">
                    <th className="py-3 px-4">Student Name (Primary)</th>
                    <th className="py-3 px-4">Roll No / ID</th>
                    <th className="py-3 px-4">Department & Year</th>
                    <th className="py-3 px-4">Target Role</th>
                    <th className="py-3 px-4">Score %</th>
                    <th className="py-3 px-4">Readiness</th>
                    <th className="py-3 px-4">Proctoring Flag</th>
                    <th className="py-3 px-4 text-right">Student Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DFD8]">
                  {filteredSessions.map((s) => (
                    <tr key={s._id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#161615]">
                        {s.candidateName || s.userId?.name || "Student Candidate"}
                        <div className="text-[10px] text-[#6E6D68] font-normal">{s.userId?.email || ""}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#161615] font-semibold">
                        {s.rollNo || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-[#161615]">
                        <div>{s.department || "General CSE"}</div>
                        <div className="text-[10px] text-[#6E6D68]">Class of {s.graduationYear || "2026"}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#161615]">{s.role || "General"}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#161615]">
                        {s.overallScore ? `${s.overallScore}%` : "Pending"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          s.readinessLevel === 'market-ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          s.readinessLevel === 'high' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                          {s.readinessLevel || "Processing"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.faceSubstitutionAlert ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 w-fit">
                            🚨 Mismatch Flag
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 w-fit">
                            ✓ Verified
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/report/${s._id}`}
                          className="px-3 py-1.5 bg-[#1D5DFF] hover:bg-blue-600 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm inline-block"
                        >
                          View Report →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
