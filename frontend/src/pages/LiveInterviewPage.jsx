import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { analysisApi } from "../api/analysis.js";
import { Button, Card } from "../components/ui/index.js";

export default function LiveInterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [startEnabled, setStartEnabled] = useState(false);
  const [answerUploaded, setAnswerUploaded] = useState(false);

  // Media & Recording state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes max per answer
  const recognizerRef = useRef(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [evaluation, setEvaluation] = useState(null);

  // Timer reference
  const timerRef = useRef(null);

  // 1. Initialize session and questions
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await sessionsApi.get(sessionId);
        let sess = data.data.session;

        if (!sess.answers || sess.answers.length === 0) {
          try {
            const res = await interviewApi.generateQuestions(sessionId);
            sess = res.data.data.session;
          } catch (genErr) {
            // If generate failed due to auth or other reasons, surface a helpful error
            if (genErr.response?.status === 401) {
              // Not authenticated — redirect user to login so they can retry
              navigate("/login");
              return;
            }
            setError(
              "Failed to generate questions for this session. Please try again later.",
            );
            setLoading(false);
            return;
          }
        }

        setSession(sess);

        // Find the first unanswered question
        const firstUnanswered = sess.answers.findIndex((a) => !a.videoUrl);
        if (firstUnanswered === -1) {
          // All questions answered
          navigate("/interview/processing");
          return;
        }

        setQuestions(sess.answers);
        setCurrentQuestionIndex(firstUnanswered);

        // Request camera permissions
        await startCamera();

        setLoading(false);
      } catch (err) {
        if (err.response?.status === 401) {
          // Redirect to login so user can obtain a fresh access token
          navigate("/login");
          return;
        } else if (err.response?.status === 404) {
          setError("Interview session not found");
        } else {
          setError(
            err.response?.data?.error || "Failed to load interview session",
          );
        }
        setLoading(false);
      }
    };

    init();

    return () => {
      stopCamera();
      clearInterval(timerRef.current);
    };
  }, [sessionId, navigate]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(
        "Camera/Microphone access denied. Please enable it in browser settings.",
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleStopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const handleStartRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm;codecs=vp8,opus",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);

        // ── AI MODEL INTEGRATION SLOT ───────────────────────────────────────
        // In Phase 5, you will send these chunks over a WebSocket to the
        // FastAPI video/audio services for real-time analysis:
        // ws.send(e.data)
        // ────────────────────────────────────────────────────────────────────
      }
    };

    mediaRecorder.onstop = handleUpload;

    // Start Web Speech API for live transcript (optional)
    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        // Delay a short time to avoid capturing the TTS audio playing the question
        setTimeout(() => {
          try {
            const recog = new SpeechRecognition();
            recog.lang = "en-US";
            recog.interimResults = true;
            recog.continuous = true;
            recog.onresult = (ev) => {
              const results = [];
              for (let i = 0; i < ev.results.length; i++) {
                results.push(ev.results[i][0].transcript);
              }
              const combined = results.join(" ");
              setLiveTranscript(combined);

              // If last result is final, push to finalTranscript (optimistic)
              const last = ev.results[ev.results.length - 1];
              if (last && last.isFinal) {
                setFinalTranscript((prev) =>
                  prev ? prev + " " + last[0].transcript : last[0].transcript,
                );
              }
            };
            recog.onerror = () => {};
            recog.onend = () => {
              // Auto-restart while we're recording
              if (isRecording) {
                try {
                  recog.start();
                } catch (e) {
                  /* ignore */
                }
              }
            };
            recog.start();
            mediaRecorder.recognizer = recog;
            recognizerRef.current = recog;
          } catch (inner) {
            // ignore recognition start errors
          }
        }, 700);
      }
    } catch (e) {
      // ignore
    }
    // Start the recorder and set refs/state
    try {
      mediaRecorderRef.current = mediaRecorder;
      // Request data every 1000ms for real-time streaming capability later
      mediaRecorder.start(1000);
      setIsRecording(true);
      setTimeLeft(120);
    } catch (startErr) {
      console.error("Failed to start MediaRecorder:", startErr);
    }
  };

  const handleStopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // Stop speech recognizer if active
      const recog =
        recognizerRef.current || mediaRecorderRef.current?.recognizer;
      if (recog) {
        try {
          recog.onend = null;
        } catch (e) {}
        try {
          recog.stop();
        } catch (e) {}
        recognizerRef.current = null;
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const currentQ = questions[currentQuestionIndex];

      // Upload answer (saves video/audio URL)
      await interviewApi.uploadAnswer(sessionId, currentQ.questionId, blob);

      // Send audio for immediate transcription + evaluation
      try {
        const fd = new FormData();
        fd.append("audio", blob, "answer.webm");
        fd.append("sessionId", sessionId);
        fd.append("questionId", currentQ.questionId);
        // Include client-side live transcript to help the stub
        fd.append("clientTranscript", liveTranscript || "");
        // If question has expectedKeywords property (admin-provided), include it
        if (currentQ.expectedKeywords) {
          fd.append("keywords", JSON.stringify(currentQ.expectedKeywords));
        }

        const { data } = await analysisApi.transcribe(fd);
        const { voiceData, evaluation: evalRes } = data.data;
        setFinalTranscript(voiceData.transcript || "");
        setEvaluation(evalRes || null);
        // mark uploaded so user can click Next
        setAnswerUploaded(true);
      } catch (err) {
        console.error("Transcription error", err);
      }

      // Move to next question or finish
      // Do not auto-advance; user will click Next after reviewing transcript/evaluation
    } catch (err) {
      alert("Failed to upload answer. Please try again.");
    } finally {
      setUploading(false);
      chunksRef.current = [];
      setLiveTranscript("");
    }
  };

  const currentQ = questions[currentQuestionIndex];

  useEffect(() => {
    // when question changes, reset controls and play question after 3s
    setStartEnabled(false);
    setFinalTranscript("");
    setEvaluation(null);
    setAnswerUploaded(false);

    if (!currentQ?.questionText) return;

    const synth = window.speechSynthesis;
    // always wait 3s before enabling the start button; if TTS available, enable after speech ends
    setStartEnabled(false);
    const timeout = setTimeout(() => {
      if (!synth) {
        setStartEnabled(true);
        return;
      }

      // cancel and speak
      try {
        synth.cancel();
      } catch (e) {}
      const utter = new SpeechSynthesisUtterance(currentQ.questionText);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.lang = "en-US";
      utter.onend = () => setStartEnabled(true);
      try {
        synth.speak(utter);
      } catch (e) {
        setStartEnabled(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      try {
        synth.cancel();
      } catch (e) {}
    };
  }, [currentQ?.questionText]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="skeleton w-16 h-16 rounded-full mx-auto mb-4"></div>
          <p className="text-brand-muted">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-brand-muted mb-6">{error}</p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">
      {/* Background ambient light */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 blur-[100px] rounded-full transition-colors duration-1000 pointer-events-none ${isRecording ? "bg-red-500" : "bg-primary"}`}
      ></div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"}`}
          ></div>
          <span className="text-white font-medium text-sm">
            {isRecording ? "RECORDING" : "READY"}
          </span>
        </div>

        {/* debug panel removed */}

        <div className="text-white/60 text-sm font-medium">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
      </header>

      {/* Main Content Area */}
      {/* question overlay removed - question will be shown inside the right card */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 relative z-10 max-w-7xl mx-auto w-full">
        {/* Left: Video Feed */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex flex-col">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* AI Overlay elements (stub for Phase 5) */}
          {isRecording && (
            <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
              <div className="bg-black/40 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-white/80 border border-white/10 font-mono flex items-center gap-2">
                <span className="text-primary animate-pulse">⚲</span>{" "}
                FACE_TRACKING_ACTIVE
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-white/80 border border-white/10 font-mono flex items-center gap-2">
                <span className="text-green-400 animate-pulse">〰</span>{" "}
                AUDIO_STREAMING
              </div>
            </div>
          )}
        </div>

        {/* Right: Question & Controls */}
        <div className="w-full md:w-96 flex flex-col gap-4 shrink-0">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white flex-1 flex flex-col relative overflow-hidden">
            {/* Timer visual bar at top */}
            {isRecording && (
              <div
                className="absolute top-0 left-0 h-1 bg-red-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(timeLeft / 120) * 100}%` }}
              ></div>
            )}

            <div className="mb-auto mt-2">
              <div className="text-white/60 text-xs font-semibold tracking-wider mb-3 uppercase">
                Current Question
              </div>
              <div className="bg-white rounded-md p-4 mb-3 shadow-sm max-h-40 overflow-auto text-left">
                <div className="text-xs text-gray-500 uppercase mb-1">
                  Question
                </div>
                <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                  {currentQ?.questionText}
                </h2>
              </div>

              {/* Live Transcript */}
              <div className="mt-3 text-sm text-white/60">
                <div className="uppercase text-xs text-white/40 mb-1">
                  Live transcript
                </div>
                <div className="min-h-[48px] p-2 bg-black/30 rounded text-white text-sm">
                  {liveTranscript || (
                    <span className="text-white/40">
                      (Speak after you start recording...)
                    </span>
                  )}
                </div>
              </div>

              {/* Final Transcript & Evaluation */}
              {finalTranscript && (
                <div className="mt-3 text-sm text-white/80">
                  <div className="uppercase text-xs text-white/40 mb-1">
                    Final transcript
                  </div>
                  <div className="p-2 bg-black/30 rounded text-white text-sm">
                    {finalTranscript}
                  </div>
                  {evaluation && (
                    <div className="mt-2 text-xs text-white/60">
                      <div>
                        Combined score:{" "}
                        {(evaluation.combinedScore || 0).toFixed(2)}
                      </div>
                      <div>
                        Keyword matches:{" "}
                        {evaluation.matchedKeywords?.join(", ") || "—"}
                      </div>
                      <div>Correct: {evaluation.isCorrect ? "Yes" : "No"}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col items-center">
              <div className="text-4xl font-mono font-light mb-6">
                {formatTime(timeLeft)}
              </div>

              {!isRecording ? (
                <Button
                  size="lg"
                  onClick={handleStartRecording}
                  disabled={!startEnabled || uploading}
                  loading={uploading}
                  className="w-full bg-primary hover:bg-primary-dark border-none shadow-lg shadow-primary/20"
                >
                  {uploading
                    ? "Uploading..."
                    : startEnabled
                      ? "Start Answering"
                      : "Prepare to ask..."}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handleStopRecording}
                  variant="danger"
                  className="w-full shadow-lg shadow-red-500/20 animate-pulse-ring"
                >
                  Stop Recording
                </Button>
              )}

              {/* Next button - shown after upload completes */}
              {answerUploaded && (
                <Button
                  size="md"
                  onClick={async () => {
                    // move to next question or finish
                    if (currentQuestionIndex < questions.length - 1) {
                      setCurrentQuestionIndex((prev) => prev + 1);
                      setStartEnabled(false);
                      setFinalTranscript("");
                      setEvaluation(null);
                    } else {
                      await sessionsApi.updateStatus(sessionId, "processing");
                      navigate("/interview/processing");
                    }
                  }}
                  className="w-full mt-3 bg-white text-primary border-none shadow-sm"
                >
                  Next
                </Button>
              )}
            </div>
          </Card>

          {/* Instructions card */}
          <Card className="bg-white/5 backdrop-blur-md border-white/10 p-4">
            <h4 className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
              <span>💡</span> Tips
            </h4>
            <ul className="text-white/50 text-xs space-y-1.5 list-disc pl-4">
              <li>
                Look directly at the camera to maintain eye contact score.
              </li>
              <li>Speak clearly and at a moderate pace.</li>
              <li>Use the STAR method (Situation, Task, Action, Result).</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
