import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await sessionsApi.getHistory();
        setSessions(data.data.sessions || []);
        setStats(data.data.stats || null);
      } catch (err) {
        console.error("Failed to load session history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (filter === "completed") return s.status === "completed";
    if (filter === "in-progress") return s.status === "in-progress" || s.status === "processing";
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-8 pb-16 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Title & CTA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0DFD9] pb-6">
          <div>
            <div className="font-mono text-xs text-[#1D5DFF] tracking-widest uppercase mb-1 font-semibold">
              CANDIDATE TELEMETRY LOGS
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#111110]">
              Interview Practice History
            </h1>
            <p className="text-xs text-[#6E6D68] mt-1">
              Review past practice sessions, AI score breakdowns, and readiness trajectory.
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-[#1D5DFF] hover:bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-[#1D5DFF]/20 transition-all self-start md:self-auto"
          >
            + Start New Practice
          </button>
        </div>

        {/* Top Summary Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider font-medium">
              Total Practice Sessions
            </div>
            <div className="text-2xl font-bold font-mono text-[#111110]">
              {loading ? "..." : stats?.totalSessions || 0}
            </div>
          </div>

          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider font-medium">
              Completed Assessments
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {loading ? "..." : stats?.completedCount || 0}
            </div>
          </div>

          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider font-medium">
              Average AI Score
            </div>
            <div className="text-2xl font-bold font-mono text-[#1D5DFF]">
              {loading ? "..." : stats?.averageScore ? `${stats.averageScore}%` : "—"}
            </div>
          </div>

          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider font-medium">
              Current Readiness Trajectory
            </div>
            <div className="text-xs font-semibold font-mono text-amber-600 truncate pt-1">
              {loading ? "..." : stats?.readinessLevel || "Not Evaluated"}
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 border-b border-[#E0DFD9] pb-4">
          <span className="font-mono text-xs text-[#6E6D68] mr-2">Filter:</span>
          {["all", "completed", "in-progress"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors ${
                filter === t
                  ? "bg-[#1D5DFF] text-white font-medium shadow-sm"
                  : "bg-white text-[#6E6D68] hover:text-[#111110] border border-[#E0DFD9]"
              }`}
            >
              {t === "in-progress" ? "In Progress" : t}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#1D5DFF] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mono text-xs text-[#6E6D68]">Loading practice logs...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-12 text-center space-y-4 shadow-sm">
            <div className="text-4xl">📁</div>
            <h3 className="text-base font-bold text-[#111110]">No sessions found</h3>
            <p className="text-xs text-[#6E6D68] max-w-sm mx-auto">
              You haven't completed any practice sessions matching this filter yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div
                key={session._id}
                className="bg-white border border-[#E0DFD9] hover:border-[#1D5DFF]/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#111110]">
                      {session.role || "General Role"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#F6F5F0] border border-[#E0DFD9] text-[10px] font-mono text-[#1D5DFF] capitalize font-medium">
                      {session.interviewType || "mixed"}
                    </span>
                  </div>
                  <div className="text-xs text-[#6E6D68] flex items-center gap-3">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>•</span>
                    <span>{session.questionCount || 5} Questions</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end md:self-auto">
                  {session.status === "completed" ? (
                    <div className="text-right">
                      <div className="font-mono text-[10px] text-[#6E6D68]">OVERALL SCORE</div>
                      <div className="font-mono text-lg font-bold text-[#1D5DFF]">
                        {session.overallScore != null ? `${session.overallScore}%` : "—"}
                      </div>
                    </div>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-mono capitalize">
                      {session.status}
                    </span>
                  )}

                  {session.status === "completed" && (
                    <button
                      onClick={() => navigate(`/report/${session._id}`)}
                      className="px-4 py-2 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                    >
                      View Report →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
