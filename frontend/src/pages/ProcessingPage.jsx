import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../utils/api.js";

const PIPELINE_STAGES = [
  { id: "audio", label: "Speech-to-Text Transcription & Audio Extraction", detail: "Wav2Vec & Whisper parsing" },
  { id: "nlp",   label: "Natural Language Evaluation & Rubric Scoring", detail: "Technical depth, clarity & completeness" },
  { id: "face",  label: "Computer Vision & Composure Biometric Analysis", detail: "DeepFace posture & attention inference" },
  { id: "ser",   label: "Speech Emotion Recognition (8-Emotion Model)", detail: "Acoustic pitch & sentiment classification" },
  { id: "report", label: "Synthesizing Final Assessment Analytics", detail: "Generating multi-track candidate index" },
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const sessionId = state?.sessionId;
  const [error, setError] = useState(null);
  const [activeStage, setActiveStage] = useState(0);
  const errorRef = useRef(null);

  const setAndRefError = (errMsg) => {
    errorRef.current = errMsg;
    setError(errMsg);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((s) => (s < PIPELINE_STAGES.length - 1 ? s + 1 : s));
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }

    let intervalId;
    let isCancelled = false;

    const triggerAnalysis = async () => {
      try {
        await api.post(`/api/analysis/${sessionId}/start`);
      } catch (err) {
        if (!isCancelled && err.response?.status !== 400) {
          setAndRefError(err.response?.data?.message || "Failed to initiate background analysis pipeline.");
        }
      }
    };

    const checkStatus = async () => {
      try {
        const { data } = await api.get(`/api/sessions/${sessionId}/status`);
        const currentSession = data.data?.session;
        if (currentSession?.status === "completed") {
          if (!isCancelled) navigate(`/report/${sessionId}`);
        } else if (currentSession?.status === "failed") {
          if (!isCancelled) setAndRefError("Analysis failed to complete. Please check server telemetry.");
        }
      } catch (err) {
        console.error("Status check error:", err);
      }
    };

    triggerAnalysis().then(() => {
      if (!isCancelled) {
        intervalId = setInterval(() => {
          if (!errorRef.current) checkStatus();
        }, 4000);
      }
    });

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [navigate, sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-[#E0DFD9] rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#111110]">Analysis Alert</h1>
            <p className="text-xs text-[#4B5563] leading-relaxed">{error}</p>
          </div>
          <Link
            to="/"
            className="inline-block w-full py-3 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-lg text-xs font-bold transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round(((activeStage + 1) / PIPELINE_STAGES.length) * 100));

  return (
    <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full bg-white border border-[#E0DFD9] rounded-2xl p-8 sm:p-10 shadow-sm space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="font-mono text-xs font-extrabold uppercase text-[#1D5DFF] tracking-wider">
            MULTIMODAL AI PIPELINE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111110] tracking-tight">
            Synthesizing Candidate Telemetry
          </h1>
          <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
            Models are evaluating spoken audio SER, OpenCV face landmarks, and NLP technical rubrics.
          </p>
        </div>

        {/* Geometric Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-[#FAF9F5] border border-[#E0DFD9] h-2.5 rounded-md overflow-hidden">
            <div
              className="bg-[#1D5DFF] h-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[11px] font-bold text-[#6B7280]">
            <span>PIPELINE EXECUTION</span>
            <span className="text-[#1D5DFF]">{progressPercent}%</span>
          </div>
        </div>

        {/* Pipeline Stage Items */}
        <div className="space-y-3 pt-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isDone = idx < activeStage;
            const isCurrent = idx === activeStage;
            return (
              <div
                key={stage.id}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  isCurrent
                    ? "bg-[#FAF9F5] border-[#1D5DFF] shadow-sm"
                    : isDone
                    ? "bg-white border-[#E0DFD9] opacity-90"
                    : "bg-white border-[#E0DFD9]/60 opacity-40"
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-bold font-mono mt-0.5 ${
                  isDone
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                    ? "bg-[#1D5DFF] text-white animate-pulse"
                    : "bg-[#E0DFD9] text-[#6B7280]"
                }`}>
                  {isDone ? "✓" : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#111110] leading-snug">{stage.label}</div>
                  <div className="text-[11px] text-[#6B7280] font-medium mt-0.5">{stage.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
