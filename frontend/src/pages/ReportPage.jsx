import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { reportsApi } from "../api/reports.js";

export default function ReportPage() {
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState(0);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { data } = await reportsApi.get(sessionId);
        setReport(data.data.report || data.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load candidate interview report");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [sessionId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center font-sans">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-[#E0DFD9]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1D5DFF] animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-[#111110] font-semibold uppercase tracking-widest">
              Aggregating Multimodal Analytics
            </p>
            <p className="text-xs text-[#6E6D68]">Synthesizing verbal NLP, voice acoustic SER, and facial telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#E0DFD9] rounded-2xl max-w-md w-full text-center p-8 space-y-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl font-mono">
            !
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#111110]">Report Unavailable</h2>
            <p className="text-xs text-[#6E6D68] leading-relaxed">
              {error || "Could not retrieve candidate performance record for this session."}
            </p>
          </div>
          <Link
            to="/"
            className="inline-block w-full py-3 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl text-xs font-semibold transition-colors duration-200"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const faceScore = report.detailedScores?.faceVisualScore ?? report.breakdown?.confidence ?? report.dimensionScores?.faceScore ?? 0;
  const voiceScore = report.detailedScores?.voiceSerScore ?? report.breakdown?.communication ?? report.dimensionScores?.voiceScore ?? 0;
  const nlpScore = report.detailedScores?.nlpVerbalScore ?? report.breakdown?.technicalAccuracy ?? report.dimensionScores?.nlpScore ?? 0;
  const writingScore = report.detailedScores?.writingTestScore ?? report.dimensionScores?.writingScore ?? 0;

  const trackBreakdown = report.trackBreakdown || {};

  const getReadinessBadge = (level) => {
    switch (level) {
      case "market-ready":
        return { label: "Market Ready", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "high":
        return { label: "High Readiness", bg: "bg-blue-50 text-blue-700 border-blue-200" };
      case "medium":
        return { label: "Moderate Readiness", bg: "bg-amber-50 text-amber-700 border-amber-200" };
      default:
        return { label: "Foundation Building", bg: "bg-gray-100 text-gray-700 border-gray-200" };
    }
  };

  const readiness = getReadinessBadge(report.readinessLevel);

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pb-20">
      {/* Top Banner Navigation */}
      <header className="border-b border-[#E0DFD9] bg-white/95 backdrop-blur-sm sticky top-0 z-30 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-mono text-sm font-black tracking-wider text-[#111110] hover:text-[#1D5DFF] transition-colors">
              INTERVIEWAI
            </Link>
            <span className="text-[#E0DFD9]">|</span>
            <span className="font-mono text-xs text-[#6E6D68] uppercase tracking-widest hidden sm:inline">
              Candidate Performance Evaluation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-[#E0DFD9] hover:border-[#111110] hover:bg-[#F6F5F0] text-[#111110] rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Export PDF
            </button>
            <Link
              to="/interview/setup"
              className="px-4 py-2 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl text-xs font-semibold transition-colors duration-200 shadow-sm"
            >
              Start New Practice →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-fade-in">

        {/* Security / Proctoring Flag Alert (if flagged) */}
        {report.faceSubstitutionAlert && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-800 flex items-start gap-4 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold">
              !
            </div>
            <div>
              <h3 className="font-bold text-sm text-red-900">Security Alert: Facial Identity Anomaly Flagged</h3>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                The visual biometric verification engine detected potential face substitution or multiple candidates across evaluation frames. Individual answer telemetry should be audited.
              </p>
            </div>
          </div>
        )}

        {/* Candidate Profile Bar */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111110] tracking-tight">
                {report.candidateName || "Candidate"}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold font-mono uppercase bg-blue-50 text-[#1D5DFF] border border-blue-200">
                {report.role}
              </span>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold font-mono uppercase bg-gray-100 text-gray-700 border border-gray-200">
                {report.interviewType} Interview
              </span>
            </div>
            <div className="text-xs text-[#6E6D68] flex flex-wrap items-center gap-4 font-inter">
              <span>Department: <strong className="text-[#111110] font-semibold">{report.department || "General Engineering"}</strong></span>
              <span>Roll No: <strong className="text-[#111110] font-semibold">{report.rollNo || "N/A"}</strong></span>
              <span>Session: <strong className="font-mono text-[#111110]">{String(sessionId).slice(-8)}</strong></span>
              <span>Date: <strong className="text-[#111110] font-semibold">{new Date(report.createdAt || Date.now()).toLocaleDateString()}</strong></span>
            </div>
          </div>

          {/* Readiness Level Badge */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#E0DFD9] pt-4 md:pt-0 md:pl-6 shrink-0">
            <div className="text-left md:text-right">
              <span className="text-[10px] uppercase font-mono font-bold text-[#6E6D68] tracking-widest block mb-1">
                Readiness Index
              </span>
              <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-extrabold font-mono border ${readiness.bg}`}>
                {readiness.label}
              </span>
            </div>
          </div>
        </div>

        {/* Hero Score Gauge Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Overall Score Card */}
          <div className="bg-[#111110] text-[#F0EEE8] border border-[#2A2A28] rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl group hover:border-[#1D5DFF]/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#1D5DFF]/20 rounded-full blur-3xl pointer-events-none transition-opacity group-hover:opacity-100 opacity-60" />
            <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#9A9990] mb-2">
              Overall Candidate Score
            </span>
            <div className="text-6xl sm:text-7xl font-black text-white my-3 tracking-tight font-mono group-hover:scale-105 transition-transform duration-300">
              {report.overallScore}<span className="text-3xl font-bold text-[#1D5DFF]">%</span>
            </div>
            <p className="text-xs text-[#9A9990] max-w-xs mt-2 leading-relaxed font-inter">
              Weighted composite evaluating spoken technical NLP depth, Speech Emotion characteristics, visual composure, and written clarity.
            </p>
          </div>

          {/* Multimodal Dimension Scores Grid */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Verbal NLP */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1D5DFF]/40 hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider">
                  Verbal Answer NLP
                </span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110] font-mono flex items-baseline gap-1">
                  {nlpScore}<span className="text-sm font-semibold text-[#6E6D68]">%</span>
                </div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden border border-[#E0DFD9]">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${nlpScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[#6E6D68] font-inter">Technical depth, concept mastery & completeness</span>
            </div>

            {/* Voice & Speech */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1D5DFF]/40 hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider">
                  Voice Acoustic SER
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110] font-mono flex items-baseline gap-1">
                  {voiceScore}<span className="text-sm font-semibold text-[#6E6D68]">%</span>
                </div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden border border-[#E0DFD9]">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${voiceScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[#6E6D68] font-inter">Pacing, pitch stability & emotional fluency</span>
            </div>

            {/* Visual & Facial */}
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1D5DFF]/40 hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider">
                  Visual Composure
                </span>
                <span className="w-2 h-2 rounded-full bg-[#1D5DFF]" />
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110] font-mono flex items-baseline gap-1">
                  {faceScore}<span className="text-sm font-semibold text-[#6E6D68]">%</span>
                </div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden border border-[#E0DFD9]">
                  <div
                    className="bg-[#1D5DFF] h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${faceScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[#6E6D68] font-inter">Eye engagement, camera attention & confidence</span>
            </div>

            {/* Technical Writing */}
            {report.includeWritingTest !== false && (
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1D5DFF]/40 hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider">
                  Technical Writing
                </span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <div className="my-3">
                <div className="text-3xl font-extrabold text-[#111110] font-mono flex items-baseline gap-1">
                  {writingScore}<span className="text-sm font-semibold text-[#6E6D68]">%</span>
                </div>
                <div className="w-full bg-[#F6F5F0] h-2 rounded-full mt-2 overflow-hidden border border-[#E0DFD9]">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${writingScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[#6E6D68] font-inter">Grammar, logical flow & technical explanation</span>
            </div>
            )}

          </div>
        </div>

        {/* Multi-Track Performance Breakdown */}
        {(trackBreakdown.hrScore != null || trackBreakdown.subjectScore != null || trackBreakdown.projectScore != null) && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0DFD9] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D5DFF]" />
                <h2 className="text-base font-bold text-[#111110]">Multi-Track Syllabus Breakdown</h2>
              </div>
              <span className="font-mono text-[10px] uppercase text-[#6E6D68] tracking-widest">
                Domain Competencies
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F6F5F0] rounded-xl border border-[#E0DFD9] hover:border-[#111110] transition-colors space-y-2">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider block">
                  HR & Behavioral Track
                </span>
                <div className="text-2xl font-black text-[#111110] font-mono">
                  {trackBreakdown.hrScore != null ? `${trackBreakdown.hrScore}%` : "N/A"}
                </div>
                <p className="text-xs text-[#6E6D68]">STAR framing, ownership attitude, and teamwork scenarios.</p>
              </div>

              <div className="p-4 bg-[#F6F5F0] rounded-xl border border-[#E0DFD9] hover:border-[#111110] transition-colors space-y-2">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider block">
                  Subject Knowledge Track
                </span>
                <div className="text-2xl font-black text-[#111110] font-mono">
                  {trackBreakdown.subjectScore != null ? `${trackBreakdown.subjectScore}%` : "N/A"}
                </div>
                <p className="text-xs text-[#6E6D68]">Core syllabus (OS, DBMS, OOP, System Design, Data Structures).</p>
              </div>

              <div className="p-4 bg-[#F6F5F0] rounded-xl border border-[#E0DFD9] hover:border-[#111110] transition-colors space-y-2">
                <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-wider block">
                  Project Architecture Track
                </span>
                <div className="text-2xl font-black text-[#111110] font-mono">
                  {trackBreakdown.projectScore != null ? `${trackBreakdown.projectScore}%` : "N/A"}
                </div>
                <p className="text-xs text-[#6E6D68]">Grounded resume exploration, engineering trade-offs, and live defense.</p>
              </div>
            </div>
          </div>
        )}

        {/* Speech Emotion Recognition (8-Emotion Spectrum) */}
        {report.voiceEmotions && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DFD9] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="text-base font-bold text-[#111110]">
                  Speech Emotion Recognition (8-Emotion Wav2Vec Acoustic Model)
                </h2>
              </div>
              <span className="px-3 py-0.5 bg-blue-50 text-[#1D5DFF] border border-blue-200 text-xs font-bold font-mono rounded-full capitalize self-start sm:self-auto">
                Dominant Tone: {report.voiceEmotions.dominant || "Neutral"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {[
                { label: "Neutral", key: "neutral", color: "bg-gray-600" },
                { label: "Calm", key: "calm", color: "bg-emerald-500" },
                { label: "Happy", key: "happy", color: "bg-amber-500" },
                { label: "Sad", key: "sad", color: "bg-blue-500" },
                { label: "Angry", key: "angry", color: "bg-rose-500" },
                { label: "Fearful", key: "fearful", color: "bg-purple-500" },
                { label: "Disgust", key: "disgust", color: "bg-lime-600" },
                { label: "Surprised", key: "surprised", color: "bg-sky-500" },
              ].map((emo) => {
                const pct = report.voiceEmotions[emo.key] || 0;
                return (
                  <div key={emo.key} className="bg-[#FAF9F5] border border-[#E0DFD9] hover:border-[#111110] p-3 rounded-xl space-y-1.5 transition-colors">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#111110]">
                      <span className="text-[#6E6D68]">{emo.label}</span>
                      <span className="font-mono font-bold">{pct}%</span>
                    </div>
                    <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#E0DFD9]">
                      <div
                        className={`h-full ${emo.color} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Consolidated Strengths & Growth Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Strengths */}
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm border-b border-[#E0DFD9] pb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Demonstrated Candidate Strengths</span>
            </div>
            <ul className="space-y-2.5 text-xs text-[#111110]">
              {(report.strengths || ["Demonstrated good domain readiness and clear communication"]).map((s, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 leading-relaxed">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm border-b border-[#E0DFD9] pb-3">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Actionable Growth Recommendations</span>
            </div>
            <ul className="space-y-2.5 text-xs text-[#111110]">
              {(report.improvements || ["Structure architecture answers with concrete operational trade-offs"]).map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-amber-50/60 p-3 rounded-xl border border-amber-100 leading-relaxed">
                  <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Question-by-Question Deep Analysis Accordion */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DFD9] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111110] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D5DFF]" />
                Question-by-Question Analysis & Follow-Up Defense
              </h2>
              <p className="text-xs text-[#6E6D68] mt-0.5">
                Detailed rubric evaluation across {(report.answers || []).length} recorded questions
              </p>
            </div>
            <span className="font-mono text-[10px] text-[#6E6D68] uppercase tracking-wider">
              Click row to toggle breakdown
            </span>
          </div>

          <div className="space-y-3">
            {(report.answers || []).map((answer, index) => {
              const isExpanded = expandedQuestion === index;
              const nlp = answer.nlpAnalysis;
              const trackLabel = answer.track === "project" ? "Project Track" : answer.track === "hr" ? "HR Behavioral" : "Technical Subject";

              return (
                <div
                  key={index}
                  className="border border-[#E0DFD9] rounded-xl overflow-hidden transition-all duration-200 hover:border-[#111110]"
                >
                  <button
                    onClick={() => setExpandedQuestion(isExpanded ? null : index)}
                    className="w-full p-4 bg-[#FAF9F5] hover:bg-[#F6F5F0] flex items-center justify-between text-left transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1D5DFF]">Question {index + 1}</span>
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-gray-200/80 text-gray-800 font-semibold">
                          {trackLabel}
                        </span>
                        {nlp?.overallScore != null && (
                          <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                            {nlp.overallScore}% Score
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#111110] leading-snug">{answer.questionText}</h3>
                    </div>
                    <div className="shrink-0 text-xs font-mono text-[#6E6D68] flex items-center gap-1">
                      <span>{isExpanded ? "Collapse" : "Details"}</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#E0DFD9] bg-white space-y-5 text-xs animate-fade-in">
                      
                      {/* Spoken Transcript */}
                      {answer.voiceAnalysis?.transcript && (
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-widest block mb-1.5">
                            Candidate Spoken Transcript
                          </span>
                          <p className="bg-[#FAF9F5] p-3.5 rounded-xl text-[#111110] leading-relaxed font-sans border border-[#E0DFD9] italic">
                            &ldquo;{answer.voiceAnalysis.transcript}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Multimodal NLP Rubrics Breakdown */}
                      {nlp && (
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-widest block mb-2">
                            NLP Dimension Evaluation
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              { label: "Technical Accuracy", value: nlp.technicalAccuracy },
                              { label: "Completeness", value: nlp.completeness },
                              { label: "Clarity of Thought", value: nlp.clarity },
                              { label: "Architectural Depth", value: nlp.depth },
                              { label: "Candidate Confidence", value: nlp.confidence },
                              { label: "Overall Question Score", value: nlp.overallScore },
                            ].filter((d) => d.value != null).map((d) => (
                              <div key={d.label} className="bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl p-3 space-y-1">
                                <div className="font-mono text-[10px] text-[#6E6D68] uppercase">{d.label}</div>
                                <div className="text-xl font-bold font-mono text-[#111110]">{d.value}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Structured Feedback */}
                      {nlp?.feedback && (
                        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-1">
                          <span className="font-mono text-[10px] font-bold text-[#1D5DFF] uppercase tracking-wider block">
                            Evaluator Feedback
                          </span>
                          <p className="text-xs text-blue-950 leading-relaxed">{nlp.feedback}</p>
                        </div>
                      )}

                      {/* Dynamic Follow-Up Question & Candidate Defense */}
                      {answer.followUpQuestion && (
                        <div className="border-t border-[#E0DFD9] pt-4 space-y-2">
                          <span className="font-mono text-[10px] font-bold text-[#6E6D68] uppercase tracking-widest block">
                            Dynamic AI Follow-Up Probe
                          </span>
                          <div className="p-3 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl space-y-1">
                            <p className="text-xs font-bold text-[#111110]">{answer.followUpQuestion}</p>
                            {answer.followUpAnswer && (
                              <p className="text-xs text-[#6E6D68] leading-relaxed pt-1 italic">
                                Candidate response: &ldquo;{answer.followUpAnswer}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="border-t border-[#E0DFD9] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs text-[#6E6D68]">
            Assessment ID: <span className="font-semibold text-[#111110]">{String(sessionId)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/history"
              className="px-5 py-2.5 bg-white border border-[#E0DFD9] hover:border-[#111110] text-[#111110] text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              ← View All History
            </Link>
            <Link
              to="/interview/setup"
              className="px-5 py-2.5 bg-[#111110] hover:bg-[#1D5DFF] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              Start New Practice →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
