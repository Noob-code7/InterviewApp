import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { analysisApi } from "../api/analysis.js";
import { Button, Card } from "../components/ui/index.js";
import LiveAudioVisualizer from "../components/ui/LiveAudioVisualizer.jsx";

export default function LiveInterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [answerUploaded, setAnswerUploaded] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const autoStartRef = useRef(false);

  // Media & Recording state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Live Speech Recognition & Timer state
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [evaluation, setEvaluation] = useState(null);

  const timerRef = useRef(null);
  const recognizerRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await sessionsApi.get(sessionId);
        const fetchedSession = data.data.session;

        if (!fetchedSession) {
          setError("Session not found");
          setLoading(false);
          return;
        }

        setSession(fetchedSession);

        // Fetch or generate questions
        const qRes = await interviewApi.generateQuestions(sessionId);
        const fetchedQuestions =
          qRes.data?.data?.questions ||
          qRes.data?.data?.session?.answers ||
          fetchedSession?.answers ||
          [];

        if (fetchedQuestions.length === 0) {
          setError("No interview questions available for this session.");
          setLoading(false);
          return;
        }

        setQuestions(fetchedQuestions);
        setLoading(false);

        // Request camera & mic permission
        await startCamera();
      } catch (err) {
        if (err.response?.status === 401) {
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

  // Bind video element whenever loading finishes or stream is ready
  useEffect(() => {
    if (!loading && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [loading]);

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
      }
    };

    mediaRecorder.onstop = handleUpload;

    // Start Web Speech API for live transcript
    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setTimeout(() => {
          try {
            const recog = new SpeechRecognition();
            recog.lang = "en-US";
            recog.interimResults = true;
            recog.continuous = true;
            recog.maxAlternatives = 1;

            recog.onresult = (ev) => {
              const results = [];
              for (let i = 0; i < ev.results.length; i++) {
                results.push(ev.results[i][0].transcript);
              }
              const combined = results.join(" ").trim();
              if (combined) {
                setLiveTranscript(combined);
              }
            };

            let networkErrorCount = 0;

            recog.onerror = (errEv) => {
              if (errEv.error === 'network') {
                networkErrorCount++;
                if (networkErrorCount >= 3) {
                  recognizerRef.current = null;
                  setLiveTranscript("🎙️ Audio Recording Active — AI Faster-Whisper will transcribe your response upon submission.");
                }
              } else if (errEv.error === 'not-allowed') {
                recognizerRef.current = null;
                setLiveTranscript("⚠️ Microphone permission disabled. Recording for Faster-Whisper...");
              }
            };

            recog.onend = () => {
              // Automatically restart recognition if active and network count is low
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording" && networkErrorCount < 3) {
                try {
                  recog.start();
                } catch (e) {}
              }
            };

            recog.start();
            recognizerRef.current = recog;
          } catch (recogErr) {
            console.warn("[LiveSpeechRecognition] Start error:", recogErr.message);
          }
        }, 150);
      } else {
        console.warn("[LiveSpeechRecognition] Browser does not support Web Speech API");
      }
    } catch (e) {
      console.warn("[LiveSpeechRecognition] Init error:", e.message);
    }

    try {
      mediaRecorderRef.current = mediaRecorder;
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

      await interviewApi.uploadAnswer(sessionId, currentQ.questionId, blob);

      try {
        const fd = new FormData();
        fd.append("audio", blob, "answer.webm");
        fd.append("sessionId", sessionId);
        fd.append("questionId", currentQ.questionId);
        fd.append("clientTranscript", liveTranscript || "");
        if (currentQ.expectedKeywords) {
          fd.append("keywords", JSON.stringify(currentQ.expectedKeywords));
        }
        analysisApi.transcribe(fd).catch((err) => console.error("Transcription error:", err));
      } catch (err) {
        console.error("Transcription setup error:", err);
      }

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        if (session?.includeWritingTest !== false) {
          navigate(`/interview/writing/${sessionId}`);
        } else {
          await sessionsApi.updateStatus(sessionId, "processing");
          navigate("/interview/processing", { state: { sessionId } });
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload answer. Please try again.");
    } finally {
      setUploading(false);
      chunksRef.current = [];
      setLiveTranscript("");
    }
  };

  const currentQ = questions[currentQuestionIndex];

  useEffect(() => {
    setFinalTranscript("");
    setEvaluation(null);
    setAnswerUploaded(false);
    autoStartRef.current = false;
    setAiSpeaking(true);

    if (!currentQ?.questionText) return;

    const synth = window.speechSynthesis;
    let fallbackTimeout;
    let retryStreamInterval;

    const autoStartRecordingWhenReady = () => {
      if (autoStartRef.current) return;
      autoStartRef.current = true;
      setAiSpeaking(false);

      const attemptStart = () => {
        if (streamRef.current) {
          handleStartRecording();
        } else {
          retryStreamInterval = setTimeout(attemptStart, 300);
        }
      };
      setTimeout(attemptStart, 400);
    };

    if (!synth) {
      fallbackTimeout = setTimeout(autoStartRecordingWhenReady, 2000);
      return;
    }

    try {
      synth.cancel();
    } catch (e) {}

    const utter = new SpeechSynthesisUtterance(currentQ.questionText);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.lang = "en-US";

    utter.onend = () => {
      autoStartRecordingWhenReady();
    };

    utter.onerror = () => {
      autoStartRecordingWhenReady();
    };

    const wordCount = currentQ.questionText.split(" ").length;
    const estimatedMs = Math.max(3000, (wordCount / 2.8) * 1000 + 2000);
    fallbackTimeout = setTimeout(autoStartRecordingWhenReady, estimatedMs);

    try {
      synth.speak(utter);
    } catch (e) {
      autoStartRecordingWhenReady();
    }

    return () => {
      clearTimeout(fallbackTimeout);
      clearTimeout(retryStreamInterval);
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
      <div className="min-h-screen bg-[#0D0D0C] text-[#F0EEE8] flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#1D5DFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs text-[#6E6D68] uppercase tracking-widest">
            Preparing AI Interview Room...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D0D0C] text-[#F0EEE8] flex items-center justify-center p-4 font-sans">
        <div className="bg-[#161615] border border-[#2A2A28] rounded-2xl max-w-md w-full text-center p-8 space-y-6 shadow-2xl">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold text-red-400">System Alert</h2>
          <p className="text-xs text-[#9A9990]">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0C] text-[#F0EEE8] flex flex-col relative overflow-hidden font-sans">
      {/* Top Bar Navigation */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-[#2A2A28] bg-[#0D0D0C]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold tracking-wider text-[#F0EEE8]">
            INTERVIEWAI
          </span>
          <span className="text-[#3A3A38] text-xs">|</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isRecording ? "bg-red-500 animate-pulse" : "bg-[#1D5DFF]"
              }`}
            />
            <span className="font-mono text-xs text-[#9A9990] tracking-widest uppercase">
              {isRecording ? "LIVE RECORDING" : "LIVE ROOM"}
            </span>
          </div>
        </div>

        <div className="font-mono text-xs text-[#6E6D68]">
          Question {currentQuestionIndex + 1} / {questions.length}
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 relative z-10 max-w-7xl mx-auto w-full">
        
        {/* Left Viewport: Live Camera Feed */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#161615] border border-[#2A2A28] shadow-2xl flex flex-col min-h-[380px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Real-Time Telemetry Overlays */}
          {isRecording && (
            <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
              <div className="bg-[#0D0D0C]/80 backdrop-blur-md rounded-lg px-3 py-1.5 text-[10px] text-[#F0EEE8] border border-[#2A2A28] font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D5DFF] animate-pulse" />
                VISION_MODEL_ACTIVE
              </div>
              <div className="bg-[#0D0D0C]/80 backdrop-blur-md rounded-lg px-3 py-1.5 text-[10px] text-[#F0EEE8] border border-[#2A2A28] font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VOICE_SER_MODEL_ACTIVE
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Question & AI Controls */}
        <div className="w-full lg:w-[400px] flex flex-col gap-4 shrink-0">
          <div className="bg-[#161615] border border-[#2A2A28] rounded-2xl p-6 flex-1 flex flex-col justify-between shadow-2xl relative">
            
            {/* Countdown Progress Bar */}
            {isRecording && (
              <div
                className="absolute top-0 left-0 h-1 bg-[#1D5DFF] transition-all duration-1000 ease-linear rounded-t-2xl"
                style={{ width: `${(timeLeft / 120) * 100}%` }}
              />
            )}

            <div className="space-y-6">
              {/* Question Card */}
              <div className="bg-[#0D0D0C] border border-[#2A2A28] rounded-xl p-5 shadow-inner">
                <div className="font-mono text-[10px] text-[#6E6D68] tracking-widest uppercase mb-2">
                  AI Question {currentQuestionIndex + 1}
                </div>
                <h2 className="text-lg font-bold text-[#F0EEE8] leading-relaxed">
                  "{currentQ?.questionText}"
                </h2>
              </div>

              {/* Functional Live Audio Visualizer resting on platform */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${
                      isRecording ? "bg-[#1D5DFF] animate-pulse" : "bg-[#6E6D68]"
                    }`}
                  />
                  <span className="font-mono text-xs text-[#1D5DFF] tracking-wider uppercase font-medium">
                    {isRecording ? "Listening..." : "Microphone Idle"}
                  </span>
                </div>

                <div className="w-full pt-1">
                  <LiveAudioVisualizer
                    audioStream={streamRef.current}
                    isRecording={isRecording}
                    active={isRecording}
                    barCount={50}
                    color="#1D5DFF"
                    inactiveColor="#3A3A38"
                  />
                </div>
              </div>

              {/* Live Transcript Text resting directly on platform */}
              <div className="pt-2">
                <div className="min-h-[48px] text-xs leading-relaxed text-[#F0EEE8]">
                  {liveTranscript || (
                    <span className="text-[#6E6D68] italic text-[11px]">
                      {isRecording
                        ? "(Speak into microphone...)"
                        : "(Waiting for AI question to finish...)"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Timer & Controls Section */}
            <div className="mt-8 pt-6 border-t border-[#2A2A28] flex flex-col items-center space-y-4">
              <div className="text-3xl font-bold font-mono text-[#F0EEE8]">
                {formatTime(timeLeft)}
              </div>

              {!isRecording ? (
                <button
                  disabled
                  className="w-full py-3.5 bg-[#2A2A28] text-[#9A9990] rounded-xl font-mono text-xs tracking-wider uppercase cursor-not-allowed border border-[#3A3A38]"
                >
                  {uploading
                    ? "Uploading Answer..."
                    : aiSpeaking
                    ? "🔊 AI Asking Question..."
                    : "Preparing Recording..."}
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="w-full py-3.5 bg-[#1D5DFF] hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-[#1D5DFF]/25 flex items-center justify-center gap-2"
                >
                  {currentQuestionIndex < questions.length - 1
                    ? "Next Question →"
                    : "Finish Interview →"}
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
