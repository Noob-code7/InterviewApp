import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import api from "../utils/api.js";
import { Card } from "../components/ui/index.js";

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
        navigate("/dashboard");
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
    timerRef.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!text || text.trim().length === 0) {
      setError("Please write your answer before submitting.");
      return;
    }
    if (text.length > 5000) {
      setError("Answer exceeds 5000 character limit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/sessions/${sessionId}/writing`, { text });
      navigate("/interview/processing", { state: { sessionId } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit writing test");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-brand-bg">
      <Card className="max-w-3xl w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Writing Test — 10 minutes</h1>
          <div className="text-sm text-brand-muted">
            Time left: {formatTime(timeLeft)}
          </div>
        </div>

        {error && <div className="mb-4 text-red-500">{error}</div>}

        <textarea
          className="w-full min-h-[300px] p-4 bg-black/5 border border-white/10 rounded-md text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
        />

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-brand-muted">
            {text.length} / 5000 chars
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setText("");
                setError(null);
              }}
              className="px-4 py-2 bg-white/5 rounded"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-primary text-white rounded"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
