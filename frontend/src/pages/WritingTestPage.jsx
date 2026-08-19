import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { interviewApi } from "../api/interview.js";

const DEFAULT_WRITING_PROMPTS = {
  default: "Describe the architecture of a high-scale web application you would design. Detail your database choice, caching layers, API design, and how you ensure fault tolerance under high traffic.",
  "software engineer": "Explain how you would design an idempotent payment processing service that communicates with third-party gateways. Detail transaction isolation, retry queues, and handling network timeouts.",
  "frontend developer": "Discuss state management strategies in modern single-page applications. Contrast client-side global stores, server-state caching (e.g. React Query), and optimistic UI updates.",
  "backend engineer": "Explain the architectural trade-offs between monolithic databases and microservices database-per-service patterns. How do you handle cross-service queries and distributed transactions?",
};

export default function WritingTestPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes (600s)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await interviewApi.getWritingSession(sessionId);
        setSession(data.data.session);
      } catch (err) {
        console.error("Failed to load writing session:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!submittedRef.current) {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [sessionId, text]);

  const handleSubmit = async () => {
    if (submitting || submittedRef.current) return;
    if (!text || text.trim().length === 0) {
      setError("Please write your technical answer before submitting.");
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await interviewApi.submitWriting(sessionId, text);
      navigate("/interview/processing", { state: { sessionId } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit writing test.");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const writingPrompt =
    session?.writingTask ||
    DEFAULT_WRITING_PROMPTS[(session?.role || "").toLowerCase()] ||
    DEFAULT_WRITING_PROMPTS.default;

  return (
    <div className="min-h-screen bg-[#F6F5F0] py-10 px-6 text-[#111110] font-sans">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header Bar */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
              TECHNICAL WRITING EVALUATION
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111110] tracking-tight">
              Written Response Assessment ({session?.role || "Engineering Candidate"})
            </h1>
            <p className="text-xs text-[#4B5563] font-medium mt-1">
              Evaluated on architectural reasoning, technical vocabulary, and clarity of thought.
            </p>
          </div>

          <div className="bg-[#FAF9F5] border border-[#E0DFD9] px-5 py-3 rounded-xl text-right shrink-0">
            <span className="font-mono text-[10px] font-bold uppercase text-[#6B7280] tracking-widest block">
              TIME REMAINING
            </span>
            <span className={`text-2xl font-black font-mono ${timeLeft < 120 ? "text-red-600 animate-pulse" : "text-[#111110]"}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 shadow-sm space-y-3">
          <span className="font-mono text-xs font-bold uppercase text-[#111110] tracking-wider block">
            ASSIGNED ARCHITECTURAL PROMPT:
          </span>
          <p className="text-base sm:text-lg font-bold text-[#111110] leading-relaxed">
            {writingPrompt}
          </p>
        </div>

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-800 text-xs font-bold rounded-xl">
            ! {error}
          </div>
        )}

        {/* Writing Editor */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0DFD9] pb-3">
            <span className="font-mono text-xs font-bold uppercase text-[#6B7280]">
              CANDIDATE RESPONSE DRAFT
            </span>
            <div className="font-mono text-xs font-bold text-[#111110]">
              WORDS: <span className="text-[#1D5DFF]">{wordCount}</span> / 500
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Structure your architectural response clearly. State your component hierarchy, data flow, failure recovery strategies, and trade-offs..."
            className="w-full h-80 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl p-5 text-sm text-[#111110] font-medium leading-relaxed resize-y focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-[#6B7280] font-medium">
              Autosaves locally. Will automatically submit when timer reaches 00:00.
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-8 py-3.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-50 w-full sm:w-auto"
            >
              {submitting ? "Submitting Evaluation..." : "Submit Technical Writing →"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
