import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const FILTERS = [
    { id: "all", label: "ALL SESSIONS" },
    { id: "completed", label: "COMPLETED" },
    { id: "in-progress", label: "IN PROGRESS" },
  ];

  const STAT_ITEMS = stats ? [
    { label: "PRACTICE SESSIONS", value: stats.totalSessions ?? 0 },
    { label: "COMPLETED EVALUATIONS", value: stats.completedSessions ?? 0 },
    { label: "AVERAGE SCORE", value: stats.avgScore != null ? `${stats.avgScore}%` : "--" },
    { label: "PEAK PERFORMANCE", value: stats.bestScore != null ? `${stats.bestScore}%` : "--", highlight: true },
  ] : [];

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-10 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DFD9] pb-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
              CANDIDATE LOGS
            </span>
            <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
              Interview History & Reports
            </h1>
            <p className="text-xs text-[#4B5563] font-medium mt-1">
              Audit historical practice sessions, multimodal scores, and readiness trajectories.
            </p>
          </div>
          <button
            onClick={() => navigate("/interview/setup")}
            className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-6 py-3 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm active:scale-98 shrink-0 self-start sm:self-auto"
          >
            + Start New Practice
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STAT_ITEMS.map((s) => (
              <div key={s.label} className="bg-white border border-[#E0DFD9] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="font-mono text-[10px] font-bold uppercase text-[#6B7280] tracking-wider mb-2">
                  {s.label}
                </div>
                <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${s.highlight ? "text-[#1D5DFF]" : "text-[#111110]"}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E0DFD9] pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                filter === f.id
                  ? "bg-[#111110] text-white"
                  : "bg-white text-[#4B5563] border border-[#E0DFD9] hover:border-[#111110] hover:text-[#111110]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Session Cards List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E0DFD9] rounded-xl p-5 animate-pulse space-y-2">
                <div className="h-4 bg-[#E0DFD9] rounded w-1/3" />
                <div className="h-3 bg-[#E0DFD9] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-12 text-center space-y-4">
            <div className="font-mono text-xs font-bold uppercase text-[#6B7280] tracking-wider">
              NO RECORDS FOUND
            </div>
            <p className="text-sm text-[#4B5563] font-medium max-w-sm mx-auto">
              You haven&apos;t completed any interview sessions matching this filter. Launch your first mock session!
            </p>
            <button
              onClick={() => navigate("/interview/setup")}
              className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-6 py-2.5 rounded-lg text-xs font-bold transition-colors"
            >
              Launch Interview Practice →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => {
              const isCompleted = session.status === "completed";
              return (
                <div
                  key={session._id}
                  onClick={() => isCompleted && navigate(`/report/${session._id}`)}
                  className={`p-5 bg-white rounded-xl border border-[#E0DFD9] transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCompleted
                      ? "hover:border-[#111110] hover:shadow-md cursor-pointer card-hover"
                      : "opacity-75"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-[#FAF9F5] text-[#111110] border border-[#E0DFD9]">
                        {session.interviewType || "Technical"}
                      </span>
                      {isCompleted ? (
                        <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          {session.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-[#111110] truncate">{session.role || "Engineering Practice"}</h3>
                    <div className="text-xs text-[#4B5563] font-medium flex items-center gap-3">
                      <span>Candidate: <strong>{session.candidateName || "Candidate"}</strong></span>
                      <span>•</span>
                      <span>Date: <strong>{formatDate(session.completedAt || session.createdAt)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                    {isCompleted && (
                      <div className="text-right">
                        <div className="font-mono text-[10px] font-bold text-[#6B7280] uppercase">SCORE</div>
                        <div className="text-2xl font-black font-mono text-[#111110]">
                          {session.overallScore != null ? `${session.overallScore}%` : "--"}
                        </div>
                      </div>
                    )}
                    <span className="text-sm font-bold text-[#1D5DFF] hidden sm:inline">
                      View Report →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
