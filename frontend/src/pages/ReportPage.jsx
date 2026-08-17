import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { interviewApi } from "../api/interview.js";

export default function ReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const { data } = await interviewApi.getReport(sessionId);
        const rawReport = data.data?.report || data.data || {};
        
        const detailed = rawReport.detailedScores || {};
        const mappedDimensionScores = rawReport.dimensionScores || {
          faceScore: detailed.faceVisualScore ?? rawReport.breakdown?.confidence ?? 0,
          voiceScore: detailed.voiceSerScore ?? rawReport.breakdown?.communication ?? 0,
          nlpScore: detailed.nlpVerbalScore ?? rawReport.breakdown?.technicalAccuracy ?? 0,
          writingScore: detailed.writingTestScore ?? 0,
        };

        setReport({
          ...rawReport,
          dimensionScores: mappedDimensionScores,
        });
      } catch (err) {
        console.error("Failed to load report:", err);
        setError(err.response?.data?.message || "Failed to load candidate performance report.");
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchReport();
    }
  }, [sessionId]);

  const handlePrint = () => {
    window.print();
  };

  const getReadinessBadge = (level) => {
    switch (level) {
      case "market-ready":
        return { label: "Market Ready", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
      case "high":
        return { label: "High Readiness", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "medium":
        return { label: "Moderate Readiness", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      default:
        return { label: "Needs Development", color: "bg-red-500/10 text-red-600 border-red-500/20" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#F6F5F0]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1D5DFF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-[#111110]/70">Generating candidate analytics report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-[#F6F5F0]">
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
          <h2 className="text-xl font-bold text-[#111110] mb-2">Report Unavailable</h2>
          <p className="text-sm text-[#111110]/60 mb-6">{error || "Could not find the requested interview report."}</p>
          <Link to="/" className="px-6 py-2.5 bg-[#1D5DFF] text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors inline-block">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const badge = getReadinessBadge(report.readinessLevel);
  const { faceScore, voiceScore, nlpScore, writingScore } = report.dimensionScores;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F6F5F0] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111110] text-white">
                {report.interviewType} Interview
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#111110] tracking-tight">{report.role} Candidate Assessment</h1>
            <p className="text-xs text-[#111110]/50 mt-1">
              Session ID: {report.sessionId} • Completed on {new Date(report.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-[#F6F5F0] hover:bg-[#E0DFD9] text-[#111110] border border-[#E0DFD9] rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <span>📄</span> Print / Save PDF
            </button>
            <Link
              to="/interview/setup"
              className="px-5 py-2.5 bg-[#1D5DFF] hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Retake Interview →
            </Link>
          </div>
        </div>

        {/* Critical Alert Banner if Face Substitution Detected */}
        {report.faceSubstitutionAlert && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-red-600 flex items-start gap-4">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-bold text-sm">Security Alert: Face Substitution / Multiple Identity Detected</h3>
              <p className="text-xs mt-1 opacity-90">
                The visual AI verification engine flagged mismatching facial biometric signatures across frames during this session. Review individual answer recordings carefully.
              </p>
            </div>
          </div>
        )}

        {/* Hero Score Gauge Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Overall Score Card */}
          <div className="bg-[#111110] text-white rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#1D5DFF]/20 rounded-full blur-2xl"></div>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">Overall Candidate Index</span>
            <div className="text-6xl font-black text-white my-3 tracking-tight">
              {report.overallScore}<span className="text-2xl font-bold text-[#1D5DFF]">%</span>
            </div>
            <p className="text-xs text-white/70 max-w-xs mt-1">
              Weighted composite evaluation across visual, audio, verbal, and technical writing indicators.
            </p>
          </div>

          {/* Multimodal Dimension Scores Grid (2 cols) */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            {/* Face Score */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111110]/60 uppercase tracking-wider">Visual & Facial</span>
                <span className="text-xl">🎥</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110]">{faceScore}%</div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-[#1D5DFF] h-full rounded-full" style={{ width: `${faceScore}%` }}></div>
                </div>
              </div>
              <span className="text-xs text-[#111110]/60">Eye contact, attention & composure</span>
            </div>

            {/* Voice Score */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111110]/60 uppercase tracking-wider">Voice & Speech</span>
                <span className="text-xl">🎙️</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110]">{voiceScore}%</div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${voiceScore}%` }}></div>
                </div>
              </div>
              <span className="text-xs text-[#111110]/60">Pacing, pitch & Speech Emotion model</span>
            </div>

            {/* Verbal NLP Score */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111110]/60 uppercase tracking-wider">Verbal Answer NLP</span>
                <span className="text-xl">💬</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110]">{nlpScore}%</div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${nlpScore}%` }}></div>
                </div>
              </div>
              <span className="text-xs text-[#111110]/60">Relevance & domain completeness</span>
            </div>

            {/* Writing Score */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111110]/60 uppercase tracking-wider">Written Test</span>
                <span className="text-xl">✍️</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110]">{writingScore}%</div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${writingScore}%` }}></div>
                </div>
              </div>
              <span className="text-xs text-[#111110]/60">Syntax, clarity & technical writing</span>
            </div>
          </div>
        </div>

        {/* Voice SER 8-Emotion Spectrum Card */}
        {report.voiceEmotions && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0DFD9] pb-3">
              <h2 className="text-lg font-bold text-[#111110] flex items-center gap-2">
                <span>🎤</span> Speech Emotion Recognition (8-Emotion Spectrum)
              </h2>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full capitalize">
                Dominant: {report.voiceEmotions.dominant || "Neutral"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {[
                { label: "Neutral", key: "neutral", icon: "😐", color: "bg-gray-500" },
                { label: "Calm", key: "calm", icon: "😌", color: "bg-emerald-500" },
                { label: "Happy", key: "happy", icon: "😊", color: "bg-amber-500" },
                { label: "Sad", key: "sad", icon: "😔", color: "bg-blue-500" },
                { label: "Angry", key: "angry", icon: "😠", color: "bg-rose-500" },
                { label: "Fearful", key: "fearful", icon: "😨", color: "bg-purple-500" },
                { label: "Disgust", key: "disgust", icon: "🤢", color: "bg-lime-600" },
                { label: "Surprised", key: "surprised", icon: "😲", color: "bg-sky-500" },
              ].map((emo) => {
                const pct = report.voiceEmotions[emo.key] || 0;
                return (
                  <div key={emo.key} className="bg-[#FAF9F5] border border-[#E2DFD8] p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#161615]">
                      <span>{emo.icon} {emo.label}</span>
                      <span className="font-mono font-bold">{pct}%</span>
                    </div>
                    <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#E2DFD8]">
                      <div className={`h-full ${emo.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Written Submission Details Section */}
        {report.writingSubmission && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#111110] mb-4 flex items-center gap-2">
              <span>✍️</span> Written Evaluation Response
            </h2>
            <div className="bg-[#F6F5F0] p-4 rounded-xl text-xs text-[#111110]/80 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto border border-[#E0DFD9]">
              {report.writingSubmission}
            </div>
          </div>
        )}

        {/* Candidate Resume Background Card */}
        {report.resumeText && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-bold text-[#111110] flex items-center gap-2">
              <span>📄</span> Candidate Resume Background & Extracted Text
            </h2>
            <div className="bg-[#F6F5F0] p-4 rounded-xl text-xs text-[#111110]/80 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto border border-[#E0DFD9]">
              {report.resumeText}
            </div>
          </div>
        )}

        {/* Consolidated Strengths & Areas of Improvement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths Card */}
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-600 font-bold text-base border-b border-[#E0DFD9] pb-3">
              <span>✨</span> Key Candidate Strengths
            </div>
            <ul className="space-y-2 text-xs text-[#111110]/80">
              {(report.strengths || ["Demonstrated good domain readiness"]).map((s, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement Card */}
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 font-bold text-base border-b border-[#E0DFD9] pb-3">
              <span>🚀</span> Actionable Growth Recommendations
            </div>
            <ul className="space-y-2 text-xs text-[#111110]/80">
              {(report.improvements || ["Practice technical architecture depth"]).map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <span className="text-amber-500 font-bold">→</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Per-Question Answer Analytics Accordion */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#111110] mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>📋</span> Recorded Answer Breakdown ({(report.answers || []).length} Questions)
            </span>
            <span className="text-xs font-normal text-[#111110]/50">Click to expand details</span>
          </h2>

          <div className="space-y-4">
            {(report.answers || []).map((answer, index) => {
              const isExpanded = expandedQuestion === index;
              return (
                <div key={index} className="border border-[#E0DFD9] rounded-xl overflow-hidden transition-all">
                  <button
                    onClick={() => setExpandedQuestion(isExpanded ? null : index)}
                    className="w-full p-4 bg-[#F6F5F0]/50 hover:bg-[#F6F5F0] flex items-center justify-between text-left transition-colors"
                  >
                    <div>
                      <span className="text-xs font-semibold text-[#1D5DFF]">Question {index + 1}</span>
                      <h3 className="text-sm font-bold text-[#111110] mt-0.5">{answer.questionText}</h3>
                    </div>
                    <span className="text-sm text-[#111110]/40">{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#E0DFD9] bg-white space-y-4 text-xs">
                      {/* Transcript */}
                      {answer.voiceAnalysis?.transcript && (
                        <div>
                          <span className="font-semibold text-[#111110]/60 uppercase tracking-wider block mb-1">Automated Transcript</span>
                          <p className="bg-[#F6F5F0] p-3 rounded-lg text-[#111110]/90 leading-relaxed font-sans border border-[#E0DFD9]">
                            "{answer.voiceAnalysis.transcript}"
                          </p>
                        </div>
                      )}

                      {/* Emotion & Facial Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {answer.voiceAnalysis?.dominantEmotion && (
                          <div className="bg-[#F6F5F0] p-3 rounded-lg border border-[#E0DFD9]">
                            <span className="font-semibold text-[#111110]/60 uppercase tracking-wider block mb-1">Dominant Audio Emotion</span>
                            <span className="text-sm font-bold text-[#1D5DFF] capitalize">
                              {answer.voiceAnalysis.dominantEmotion}
                            </span>
                          </div>
                        )}

                        {answer.faceAnalysis?.notes?.length > 0 && (
                          <div className="bg-[#F6F5F0] p-3 rounded-lg border border-[#E0DFD9]">
                            <span className="font-semibold text-[#111110]/60 uppercase tracking-wider block mb-1">Visual AI Notes</span>
                            <ul className="list-disc list-inside space-y-1 text-[#111110]/80">
                              {answer.faceAnalysis.notes.map((note, nIdx) => (
                                <li key={nIdx}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between pt-4">
          <Link to="/" className="text-xs font-semibold text-[#111110]/60 hover:text-[#111110] transition-colors">
            ← Return to Home
          </Link>
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-[#111110] hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Export Candidate Report (PDF)
          </button>
        </div>

      </div>
    </div>
  );
}
