import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api.js";

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const sessionId = state?.sessionId;
  const [error, setError] = useState(null);
  const errorRef = useRef(null);

  const setAndRefError = (errMsg) => {
    errorRef.current = errMsg;
    setError(errMsg);
  };

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
        if (!isCancelled) {
          // If analysis is already processing or completed, don't show error
          if (err.response?.status !== 400) {
            setAndRefError(err.response?.data?.message || "Failed to start analysis");
          }
        }
      }
    };

    const checkStatus = async () => {
      try {
        const { data } = await api.get(`/api/sessions/${sessionId}`);
        const currentSession = data.data?.session;

        if (currentSession?.status === "completed") {
          if (!isCancelled) navigate(`/report/${sessionId}`);
        } else if (currentSession?.status === "failed") {
          if (!isCancelled) setAndRefError("Analysis failed. Please try again.");
        }
      } catch (err) {
        console.error("Status check error:", err);
      }
    };

    triggerAnalysis().then(() => {
      if (!isCancelled) {
        // Poll status every 2 seconds
        intervalId = setInterval(() => {
          if (!errorRef.current) checkStatus();
        }, 2000);
      }
    });

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [navigate, sessionId]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-[#F6F5F0] p-4 font-sans">
        <div className="bg-white border border-[#E0DFD9] rounded-2xl max-w-md w-full text-center p-8 space-y-6 shadow-sm">
          <div className="text-5xl mb-2">⚠️</div>
          <h1 className="text-xl font-bold text-[#111110]">Analysis Alert</h1>
          <p className="text-xs text-[#111110]/60">{error}</p>
          <button
            onClick={() => {
              setError(null);
              navigate("/");
            }}
            className="px-6 py-2.5 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl font-semibold text-xs transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-[#F6F5F0] p-4 font-sans">
      <div className="bg-white border border-[#E0DFD9] rounded-2xl max-w-md w-full text-center p-8 space-y-6 shadow-sm">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1D5DFF] border-r-[#1D5DFF] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            🤖
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-[#111110] mb-1">
            Analyzing Candidate Telemetry
          </h1>
          <p className="text-xs text-[#111110]/60">
            Multimodal AI engines are evaluating video posture, Speech Emotion model probabilities, and answer quality...
          </p>
        </div>

        <div className="pt-2">
          <div className="w-full bg-[#F6F5F0] h-2 rounded-full overflow-hidden border border-[#E0DFD9]">
            <div className="bg-[#1D5DFF] h-full rounded-full animate-pulse w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
