import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { Card, Button } from "../components/ui/index.js";

const DEFAULT_WRITING_PROMPTS = {
  frontend: "Explain how you would design a responsive, accessible component architecture for a real-time web application. Detail your state management and performance optimization strategy.",
  backend: "Describe how you would design a scalable, fault-tolerant rate limiting service for high-traffic REST APIs. Detail database indexing, caching strategies, and concurrency handling.",
  fullstack: "Walk through the architectural design of an end-to-end web application handling real-time audio/video streaming. Cover API gateway setup, backend queue workers, and database schemas.",
  default: "Describe a complex technical challenge you solved recently. Explain your problem-solving process, architectural trade-offs made, and the key lessons learned."
};

export default function WritingTestPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await sessionsApi.get(sessionId);
        setSession(data.data.session);
      } catch (err) {
        console.error("Failed to load session:", err);
        navigate("/");
      }
    };

    init();

    return () => clearInterval(timerRef.current);
  }, [sessionId, navigate]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!text || text.trim().length === 0) {
      setError("Please write your technical answer before submitting.");
      return;
    }
    if (text.length > 5000) {
      setError("Answer exceeds 5,000 character limit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await interviewApi.submitWriting(sessionId, text);
      navigate("/interview/processing", { state: { sessionId } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit writing test.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const writingPrompt =
    session?.writingTask ||
    DEFAULT_WRITING_PROMPTS[(session?.role || "").toLowerCase()] ||
    DEFAULT_WRITING_PROMPTS.default;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F6F5F0] py-10 px-4 sm:px-6 lg:px-8 text-[#161615]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-100">
              Technical Writing Assessment
            </span>
            <h1 className="text-2xl font-extrabold text-[#161615] tracking-tight mt-2">
              Writing Evaluation ({session?.role || "Engineering Candidate"})
            </h1>
            <p className="text-xs text-[#6E6D68] mt-1">
              Demonstrate your technical communication, architectural reasoning, and clarity of thought.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#FAF9F5] border border-[#E2DFD8] px-4 py-2 rounded-xl text-right">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#6E6D68] block">Time Remaining</span>
              <span className="text-xl font-bold font-mono text-[#161615]">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Writing Prompt Card */}
        <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#1D5DFF]">
            Technical Writing Prompt
          </div>
          <h2 className="text-base font-bold text-[#161615] leading-relaxed">
            "{writingPrompt}"
          </h2>
          <p className="text-xs text-[#6E6D68]">
            Structure your answer clearly with introduction, key technical decisions, trade-offs, and concrete examples.
          </p>
        </Card>

        {/* Input Area */}
        <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
              ⚠️ {error}
            </div>
          )}

          <textarea
            className="w-full min-h-[320px] p-4 bg-[#FAF9F5] border border-[#E2DFD8] rounded-xl text-sm leading-relaxed focus:outline-none focus:border-[#1D5DFF] focus:bg-white transition-colors"
            placeholder="Type your technical response here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-[#6E6D68] font-mono">
              {text.length} / 5,000 characters
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setText("");
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#E2DFD8] text-xs font-medium text-[#6E6D68] hover:bg-[#FAF9F5] transition-colors"
              >
                Clear
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-[#1D5DFF] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-[#1D5DFF]/20"
              >
                {submitting ? "Submitting Evaluation..." : "Submit Technical Writing Test →"}
              </button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
