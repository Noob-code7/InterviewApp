import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { analysisApi } from "../api/analysis.js";
import { Button, Card } from "../components/ui/index.js";
import LiveAudioVisualizer from "../components/ui/LiveAudioVisualizer.jsx";
import { useVoiceActivityDetector } from "../hooks/useVoiceActivityDetector.js";
import {
  INTERVIEW_GREETINGS,
  GREETING_ACKNOWLEDGEMENTS,
  QUESTION_TRANSITIONS,
  REPEAT_ACKNOWLEDGEMENTS,
  CLOSING_STATEMENTS,
  INTERRUPTION_INTENTS,
  classifyInterruption,
  generateClarificationResponse,
  getRandomItem,
} from "../utils/interviewConversationalPatterns.js";

// Comprehensive Single-Owner Interview State Machine
export const INTERVIEW_STATES = {
  INITIALIZING: "INITIALIZING",
  GREETING_SPEAKING: "GREETING_SPEAKING",
  GREETING_LISTENING: "GREETING_LISTENING",
  GREETING_ACK: "GREETING_ACK",
  AI_SPEAKING: "AI_SPEAKING",
  LISTENING: "LISTENING",
  REPEAT_ACK_SPEAKING: "REPEAT_ACK_SPEAKING",
  CLARIFICATION_SPEAKING: "CLARIFICATION_SPEAKING",
  PROCESSING_ANSWER: "PROCESSING_ANSWER",
  TRANSITION_SPEAKING: "TRANSITION_SPEAKING",
  ADVANCING: "ADVANCING",
  CLOSING_SPEAKING: "CLOSING_SPEAKING",
  COMPLETED: "COMPLETED",
};

export default function LiveInterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Core Session & Question State
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewState, setInterviewState] = useState(INTERVIEW_STATES.INITIALIZING);

  // Status & Telemetry
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  // Conversational Greeting State
  const [greetingText, setGreetingText] = useState("");
  const [hasCompletedGreeting, setHasCompletedGreeting] = useState(false);
  const greetingTimeoutRef = useRef(null);

  // Automatic Question Transition State
  const [transitionText, setTransitionText] = useState("");
  const transitionLockRef = useRef(false);
  const lastSpokenTransitionIndexRef = useRef(-1);

  // Repeat & Clarification State
  const [repeatAckText, setRepeatAckText] = useState("");
  const [clarificationText, setClarificationText] = useState("");
  const repeatCountRef = useRef(0);

  // Closing State (Phase 10)
  const [closingText, setClosingText] = useState("");

  // Barge-In Telemetry & Ref
  const [lastBargeInLatency, setLastBargeInLatency] = useState(null);

  // Interactive Project Follow-Up Loop State
  const [followUpTurn, setFollowUpTurn] = useState(0);
  const [activeFollowUp, setActiveFollowUp] = useState(null);
  const [previousFollowUps, setPreviousFollowUps] = useState([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  // Media & Recording State
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Live Speech Recognition & Timer
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");

  const timerRef = useRef(null);
  const recognizerRef = useRef(null);
  const autoStartRef = useRef(false);

  // Concurrency & Duplicate Transition Guards
  const isAdvancingRef = useRef(false);
  const isUploadingRef = useRef(false);
  const currentQIndexRef = useRef(0);
  currentQIndexRef.current = currentQuestionIndex;

  const currentQ = questions[currentQuestionIndex];
  const displayedQuestionText = activeFollowUp?.questionText || currentQ?.questionText || "";

  // Single Authoritative Entry Point for Answer Completion
  const triggerAnswerCompletion = useCallback((source = "auto") => {
    if (
      isAdvancingRef.current ||
      isUploadingRef.current ||
      transitionLockRef.current ||
      interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
    ) {
      console.log(`[InterviewEngine] Transition/upload/dialogue in progress, dropping trigger from ${source}`);
      return;
    }

    const intent = classifyInterruption(liveTranscript);
    if (intent === INTERRUPTION_INTENTS.REPEAT_REQUEST) {
      console.log("[InterviewEngine] Spoken utterance classified as REPEAT_REQUEST. Triggering question replay.");
      handleRepeatQuestion();
      return;
    }
    if (intent === INTERRUPTION_INTENTS.CLARIFICATION_REQUEST) {
      console.log("[InterviewEngine] Spoken utterance classified as CLARIFICATION_REQUEST. Triggering clarification.");
      handleClarificationRequest();
      return;
    }

    console.log(`[InterviewEngine] Triggering answer completion from source: ${source}`);
    setInterviewState(INTERVIEW_STATES.PROCESSING_ANSWER);

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    } else {
      handleUpload();
    }

    setIsRecording(false);
    clearInterval(timerRef.current);
  }, [interviewState, liveTranscript]);

  // Repeat Question Handler
  const handleRepeatQuestion = useCallback(() => {
    console.log(`[RepeatEngine] Repeating current Question ${currentQIndexRef.current + 1}`);
    repeatCountRef.current += 1;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }

    setIsRecording(false);
    chunksRef.current = [];
    setLiveTranscript("");
    clearInterval(timerRef.current);

    const chosenAck = getRandomItem(REPEAT_ACKNOWLEDGEMENTS);
    setRepeatAckText(chosenAck);
    setInterviewState(INTERVIEW_STATES.REPEAT_ACK_SPEAKING);
    setAiSpeaking(true);

    const synth = window.speechSynthesis;

    const resumeQuestionTTS = () => {
      setTimeout(() => {
        setAiSpeaking(false);
        setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
      }, 400);
    };

    if (!synth) {
      resumeQuestionTTS();
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(chosenAck);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        resumeQuestionTTS();
      };
      utterance.onerror = () => {
        resumeQuestionTTS();
      };

      synth.speak(utterance);
    } catch (e) {
      resumeQuestionTTS();
    }
  }, []);

  // Clarification Request Handler
  const handleClarificationRequest = useCallback(() => {
    console.log(`[ClarificationEngine] Handling clarification for Question ${currentQIndexRef.current + 1}`);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }

    const candidateQuery = liveTranscript;
    setIsRecording(false);
    chunksRef.current = [];
    setLiveTranscript("");
    clearInterval(timerRef.current);

    const response = generateClarificationResponse(displayedQuestionText, candidateQuery);
    setClarificationText(response);
    setInterviewState(INTERVIEW_STATES.CLARIFICATION_SPEAKING);
    setAiSpeaking(true);

    const synth = window.speechSynthesis;

    const resumeCandidateListening = () => {
      setTimeout(() => {
        setAiSpeaking(false);
        handleStartRecording();
      }, 400);
    };

    if (!synth) {
      resumeCandidateListening();
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(response);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        resumeCandidateListening();
      };
      utterance.onerror = () => {
        resumeCandidateListening();
      };

      synth.speak(utterance);
    } catch (e) {
      resumeCandidateListening();
    }
  }, [displayedQuestionText, liveTranscript]);

  // Barge-In Interruption Handler
  const handleBargeInInterruption = useCallback(
    ({ source, text, onsetTime, timestamp }) => {
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {}
      const tCompleted = performance.now();
      const referenceOnset = onsetTime || timestamp || tCompleted;
      const endToEndLatencyMs = tCompleted - referenceOnset;
      setLastBargeInLatency(endToEndLatencyMs);
      console.log(`[BargeIn Engine] Full Pipeline Barge-In in ${endToEndLatencyMs.toFixed(2)}ms (Trigger: ${source})`);

      setAiSpeaking(false);
      autoStartRef.current = true;

      if (text) {
        const intent = classifyInterruption(text);
        if (intent === INTERRUPTION_INTENTS.REPEAT_REQUEST) {
          handleRepeatQuestion();
          return;
        }
        if (intent === INTERRUPTION_INTENTS.CLARIFICATION_REQUEST) {
          handleClarificationRequest();
          return;
        }
        console.log(`[MidQuestion Engine] Preserving opening answer words: "${text}"`);
        setLiveTranscript(text);
      }

      setInterviewState(INTERVIEW_STATES.LISTENING);
      if (!isRecording) {
        handleStartRecording(text || "");
      }
    },
    [isRecording, handleRepeatQuestion, handleClarificationRequest]
  );

  // Reliable Voice Activity Detector Integration
  const isCandidateActiveListening =
    isRecording &&
    (interviewState === INTERVIEW_STATES.LISTENING ||
      interviewState === INTERVIEW_STATES.GREETING_LISTENING);

  const isBargeInActive =
    interviewState === INTERVIEW_STATES.AI_SPEAKING ||
    interviewState === INTERVIEW_STATES.GREETING_SPEAKING ||
    interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING;

  const vad = useVoiceActivityDetector({
    stream: streamRef.current,
    enabled: isCandidateActiveListening,
    bargeInEnabled: isBargeInActive,
    speechThreshold: 0.025,
    bargeInThreshold: 0.038,
    bargeInSustainMs: 120,
    silenceThresholdMs: 2200,
    thinkingGracePeriodMs: 4000,
    minAnswerDurationMs: interviewState === INTERVIEW_STATES.GREETING_LISTENING ? 1500 : 3000,
    minWordCount: interviewState === INTERVIEW_STATES.GREETING_LISTENING ? 1 : 4,
    onAnswerComplete: ({ reason, silenceDuration, wordCount }) => {
      if (interviewState === INTERVIEW_STATES.GREETING_LISTENING) {
        console.log(`[GreetingEngine] Greeting response detected (${wordCount} words). Transitioning to ack.`);
        transitionFromGreetingToQ1();
      } else if (interviewState === INTERVIEW_STATES.LISTENING) {
        console.log(`[VAD Engine] Auto-completing answer: ${reason} (silence: ${silenceDuration}ms, words: ${wordCount})`);
        triggerAnswerCompletion(`vad_${reason}`);
      }
    },
    onBargeIn: handleBargeInInterruption,
  });

  // Feed live transcript into VAD tracker and check for real-time commands
  useEffect(() => {
    if (liveTranscript) {
      vad.notifyTranscriptUpdate(liveTranscript);

      if (interviewState === INTERVIEW_STATES.LISTENING) {
        const intent = classifyInterruption(liveTranscript);
        if (intent === INTERRUPTION_INTENTS.REPEAT_REQUEST) {
          console.log("[LiveListening] Recognized repeat question command. Triggering repeat.");
          handleRepeatQuestion();
        } else if (intent === INTERRUPTION_INTENTS.CLARIFICATION_REQUEST) {
          console.log("[LiveListening] Recognized clarification request. Triggering clarification.");
          handleClarificationRequest();
        }
      }
    }
  }, [liveTranscript, vad, interviewState, handleRepeatQuestion, handleClarificationRequest]);

  // Transition from Greeting to Question 1
  const transitionFromGreetingToQ1 = useCallback(() => {
    if (greetingTimeoutRef.current) clearTimeout(greetingTimeoutRef.current);

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    chunksRef.current = [];
    setLiveTranscript("");
    setHasCompletedGreeting(true);
    setInterviewState(INTERVIEW_STATES.GREETING_ACK);

    const ackPhrase = getRandomItem(GREETING_ACKNOWLEDGEMENTS);
    const synth = window.speechSynthesis;

    if (!synth) {
      setTimeout(() => {
        setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
      }, 1000);
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(ackPhrase);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        setTimeout(() => {
          setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
        }, 400);
      };
      utterance.onerror = () => {
        setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
      };

      synth.speak(utterance);
    } catch (e) {
      setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
    }
  }, []);

  // Initialize Session and Fetch Questions
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data } = await sessionsApi.get(sessionId);
        const fetchedSession = data?.data?.session;

        if (!fetchedSession) {
          if (isMounted) {
            setError("Session not found");
            setLoading(false);
          }
          return;
        }

        if (isMounted) setSession(fetchedSession);

        // Fetch or generate questions
        const qRes = await interviewApi.generateQuestions(sessionId);
        const fetchedQuestions =
          qRes.data?.data?.questions ||
          qRes.data?.data?.session?.answers ||
          fetchedSession?.answers ||
          [];

        if (fetchedQuestions.length === 0) {
          if (isMounted) {
            setError("No interview questions available for this session.");
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setQuestions(fetchedQuestions);
          const chosenGreeting = getRandomItem(INTERVIEW_GREETINGS);
          setGreetingText(chosenGreeting);
          setLoading(false);
        }

        await startCamera();
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        } else if (err.response?.status === 404) {
          if (isMounted) setError("Interview session not found");
        } else {
          if (isMounted) setError(err.response?.data?.error || "Failed to load interview session");
        }
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      stopCamera();
      clearInterval(timerRef.current);
      if (greetingTimeoutRef.current) clearTimeout(greetingTimeoutRef.current);
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {}
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
      setError("Camera/Microphone access denied. Please enable it in browser settings.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Conversational Greeting Lifecycle
  useEffect(() => {
    if (loading || !greetingText || hasCompletedGreeting || interviewState !== INTERVIEW_STATES.INITIALIZING) return;

    setInterviewState(INTERVIEW_STATES.GREETING_SPEAKING);
    setAiSpeaking(true);

    const synth = window.speechSynthesis;
    let fallbackTimeout;

    const startGreetingListening = () => {
      setAiSpeaking(false);
      setInterviewState(INTERVIEW_STATES.GREETING_LISTENING);
      chunksRef.current = [];
      setLiveTranscript("");
      setIsRecording(true);

      greetingTimeoutRef.current = setTimeout(() => {
        transitionFromGreetingToQ1();
      }, 4500);
    };

    if (!synth) {
      fallbackTimeout = setTimeout(startGreetingListening, 2000);
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(greetingText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        startGreetingListening();
      };
      utterance.onerror = () => {
        startGreetingListening();
      };

      synth.speak(utterance);
      fallbackTimeout = setTimeout(startGreetingListening, 8000);
    } catch (e) {
      fallbackTimeout = setTimeout(startGreetingListening, 1500);
    }

    return () => {
      clearTimeout(fallbackTimeout);
      try {
        synth?.cancel();
      } catch (e) {}
    };
  }, [loading, greetingText, hasCompletedGreeting, interviewState, transitionFromGreetingToQ1]);

  // Start Candidate Recording & Live STT for Questions
  const handleStartRecording = useCallback((initialText = "") => {
    if (
      !streamRef.current ||
      isAdvancingRef.current ||
      transitionLockRef.current ||
      interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
    )
      return;

    setInterviewState(INTERVIEW_STATES.LISTENING);
    chunksRef.current = [];
    if (initialText) {
      setLiveTranscript(initialText);
    } else {
      setLiveTranscript("");
    }
    let networkErrorCount = 0;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      handleUpload();
    };

    // Live Web Speech Recognition
    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        setTimeout(() => {
          try {
            const recog = new SpeechRecognition();
            recog.continuous = true;
            recog.interimResults = true;
            recog.lang = "en-US";

            let accumulated = initialText ? initialText + " " : "";

            recog.onresult = (e) => {
              let interim = "";
              for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                  accumulated += " " + e.results[i][0].transcript;
                } else {
                  interim += e.results[i][0].transcript;
                }
              }
              const fullText = (accumulated + " " + interim).trim();
              setLiveTranscript(fullText);
            };

            recog.onerror = (e) => {
              if (e.error === "network") networkErrorCount += 1;
            };

            recog.onend = () => {
              if (
                mediaRecorderRef.current &&
                mediaRecorderRef.current.state === "recording" &&
                networkErrorCount < 3
              ) {
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
      }
    } catch (e) {
      console.warn("[LiveSpeechRecognition] Init error:", e.message);
    }

    try {
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setTimeLeft(120);

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            triggerAnswerCompletion("timeout");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (startErr) {
      console.error("Failed to start MediaRecorder:", startErr);
    }
  }, [triggerAnswerCompletion, interviewState]);

  // Automatic Question Transition Execution
  const executeQuestionTransition = useCallback(
    (nextIndex) => {
      if (transitionLockRef.current) return;
      transitionLockRef.current = true;
      lastSpokenTransitionIndexRef.current = nextIndex;

      const chosenTransition = getRandomItem(QUESTION_TRANSITIONS);
      setTransitionText(chosenTransition);
      setInterviewState(INTERVIEW_STATES.TRANSITION_SPEAKING);
      setAiSpeaking(true);

      const synth = window.speechSynthesis;

      const proceedToNextQuestion = () => {
        setTimeout(() => {
          setAiSpeaking(false);
          setCurrentQuestionIndex(nextIndex);
          setUploading(false);
          isUploadingRef.current = false;
          transitionLockRef.current = false;
          chunksRef.current = [];
          setLiveTranscript("");
          setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
        }, 500);
      };

      if (!synth) {
        proceedToNextQuestion();
        return;
      }

      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(chosenTransition);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = synth.getVoices();
        const englishVoice = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

        utterance.onend = () => {
          proceedToNextQuestion();
        };
        utterance.onerror = () => {
          proceedToNextQuestion();
        };

        synth.speak(utterance);
      } catch (e) {
        proceedToNextQuestion();
      }
    },
    []
  );

  // Natural Interview Closing Execution (Phase 10)
  const executeNaturalClosing = useCallback(async () => {
    isAdvancingRef.current = true;
    const chosenClosing = getRandomItem(CLOSING_STATEMENTS);
    setClosingText(chosenClosing);
    setInterviewState(INTERVIEW_STATES.CLOSING_SPEAKING);
    setAiSpeaking(true);

    const synth = window.speechSynthesis;

    const finalizeAndNavigate = async () => {
      setAiSpeaking(false);
      stopCamera();
      setInterviewState(INTERVIEW_STATES.COMPLETED);
      try {
        await sessionsApi.updateStatus(sessionId, "processing");
      } catch (statusErr) {
        console.warn("Status update error:", statusErr);
      }
      navigate(`/processing/${sessionId}`);
    };

    if (!synth) {
      setTimeout(finalizeAndNavigate, 1500);
      return;
    }

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(chosenClosing);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        finalizeAndNavigate();
      };
      utterance.onerror = () => {
        finalizeAndNavigate();
      };

      synth.speak(utterance);
    } catch (e) {
      finalizeAndNavigate();
    }
  }, [sessionId, navigate]);

  // Handle Answer Upload & Automatic Progression
  const handleUpload = async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploading(true);

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const currentQ = questions[currentQIndexRef.current];
      const currentAnswerText = liveTranscript || "";

      if (!currentQ) {
        console.warn("[InterviewEngine] No current question found during upload");
        isUploadingRef.current = false;
        setUploading(false);
        return;
      }

      // 1. Upload Video Chunk
      if (activeFollowUp) {
        await interviewApi.uploadAnswer(sessionId, currentQ.questionId, blob, {
          isFollowUp: true,
          turn: followUpTurn,
          questionText: activeFollowUp.questionText,
        });
      } else {
        await interviewApi.uploadAnswer(sessionId, currentQ.questionId, blob, {
          questionIndex: currentQIndexRef.current,
          questionText: currentQ.questionText,
        });
      }

      // 2. Dispatch Live STT Telemetry
      try {
        const fd = new FormData();
        fd.append("audio", blob, "answer.webm");
        fd.append("sessionId", sessionId);
        fd.append("questionId", activeFollowUp ? `${currentQ.questionId}-followup-${followUpTurn}` : currentQ.questionId);
        fd.append("clientTranscript", currentAnswerText);
        if (currentQ.expectedKeywords) {
          fd.append("keywords", JSON.stringify(currentQ.expectedKeywords));
        }
        analysisApi.transcribe(fd).catch((err) => console.error("Transcription error:", err));
      } catch (err) {
        console.error("Transcription setup error:", err);
      }

      // 3. Dynamic Interactive Follow-Up Logic (Project Questions Only)
      const isProjectTrack = currentQ.track === "project" || currentQ.projectContext != null;

      if (isProjectTrack && followUpTurn < 2 && currentAnswerText.trim().split(/\s+/).length >= 4) {
        setIsFollowUpLoading(true);
        try {
          const currentFollowUpList = [
            ...previousFollowUps,
            {
              question: activeFollowUp?.questionText || currentQ.questionText,
              answer: currentAnswerText,
            },
          ];

          const res = await sessionsApi.generateProjectFollowUp(sessionId, {
            questionId: currentQ.questionId,
            questionText: activeFollowUp?.questionText || currentQ.questionText,
            answerText: currentAnswerText,
            projectContext: currentQ.projectContext || {},
            turnCount: followUpTurn + 1,
            previousFollowUps: currentFollowUpList,
          });

          if (res.data?.data?.hasFollowUp && res.data?.data?.followUp?.questionText) {
            const nextFollowUp = res.data.data.followUp;
            setPreviousFollowUps(currentFollowUpList);
            setFollowUpTurn((prev) => prev + 1);
            setActiveFollowUp(nextFollowUp);
            setIsFollowUpLoading(false);
            setUploading(false);
            isUploadingRef.current = false;
            chunksRef.current = [];
            setLiveTranscript("");
            setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
            return;
          }
        } catch (fErr) {
          console.warn("[ProjectFollowUp] Error generating follow-up:", fErr.message);
        }
        setIsFollowUpLoading(false);
      }

      // 4. Automatic Question Progression or Natural Closing (Phase 10)
      setFollowUpTurn(0);
      setActiveFollowUp(null);
      setPreviousFollowUps([]);

      const nextIndex = currentQIndexRef.current + 1;

      if (nextIndex < questions.length) {
        console.log(`[InterviewEngine] Auto-transitioning to Question ${nextIndex + 1} of ${questions.length}`);
        executeQuestionTransition(nextIndex);
      } else {
        console.log(`[InterviewEngine] All ${questions.length} questions completed. Starting Natural Closing...`);
        setUploading(false);
        isUploadingRef.current = false;
        executeNaturalClosing();
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload answer. Moving forward...");
      isUploadingRef.current = false;
      setUploading(false);
    }
  };

  // Question TTS & State Transition to Listening
  useEffect(() => {
    if (
      loading ||
      !hasCompletedGreeting ||
      !displayedQuestionText ||
      interviewState === INTERVIEW_STATES.COMPLETED ||
      interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ||
      interviewState === INTERVIEW_STATES.PROCESSING_ANSWER ||
      interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
    )
      return;

    if (interviewState !== INTERVIEW_STATES.AI_SPEAKING) return;

    setFinalTranscript("");
    autoStartRef.current = false;
    setAiSpeaking(true);

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
      const utterance = new SpeechSynthesisUtterance(displayedQuestionText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha"))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        autoStartRecordingWhenReady();
      };

      utterance.onerror = () => {
        autoStartRecordingWhenReady();
      };

      synth.speak(utterance);
      fallbackTimeout = setTimeout(autoStartRecordingWhenReady, 12000);
    } catch (e) {
      fallbackTimeout = setTimeout(autoStartRecordingWhenReady, 1500);
    }

    return () => {
      clearTimeout(fallbackTimeout);
      clearTimeout(retryStreamInterval);
      try {
        synth?.cancel();
      } catch (e) {}
    };
  }, [displayedQuestionText, loading, currentQuestionIndex, handleStartRecording, hasCompletedGreeting, interviewState]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#111110] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-10 h-10 border-2 border-[#1D5DFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold">Initializing Interview Room</h2>
          <p className="text-xs text-[#6E6D68]">Setting up secure video feed and questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#111110] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E5E4DE] rounded-xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-lg font-bold">!</div>
          <h2 className="text-lg font-bold">Interview Access Alert</h2>
          <p className="text-sm text-[#6E6D68] leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/setup")}
            className="w-full py-3 bg-[#111110] text-white rounded-lg font-semibold text-sm hover:bg-[#2A2A28] transition-colors"
          >
            Return to Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0C] text-[#F0EEE8] flex flex-col font-sans select-none overflow-hidden">
      {/* Editorial Top Navigation Header */}
      <header className="h-16 border-b border-[#2A2A28] px-6 flex items-center justify-between bg-[#111110]/95 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#1D5DFF]" />
          <span className="font-mono text-sm tracking-wider uppercase font-bold text-[#F0EEE8]">
            INTERVIEWAI <span className="text-[#6E6D68] font-normal">| LIVE ASSESSMENT</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {hasCompletedGreeting && currentQ?.track && (
            <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded bg-[#161615] border border-[#2A2A28] text-[#1D5DFF]">
              {currentQ.track === "project" ? "Project Track" : currentQ.track === "hr" ? "HR Track" : "Technical Subject"}
            </span>
          )}
          <div className="font-mono text-xs text-[#6E6D68]">
            {interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
              ? "Interview Closing"
              : hasCompletedGreeting
              ? `Question ${currentQuestionIndex + 1} / ${questions.length}`
              : "Interview Welcome"}
          </div>
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
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D5DFF] animate-pulse" />VISION_MODEL_ACTIVE
              </div>
              <div className="bg-[#0D0D0C]/80 backdrop-blur-md rounded-lg px-3 py-1.5 text-[10px] text-[#F0EEE8] border border-[#2A2A28] font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />VOICE_SER_MODEL_ACTIVE
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Question & AI Controls */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0">
          <div className="bg-[#161615] border border-[#2A2A28] rounded-2xl p-6 flex-1 flex flex-col justify-between shadow-2xl relative">
            {/* Countdown Progress Bar */}
            {isRecording && hasCompletedGreeting && (
              <div
                className="absolute top-0 left-0 h-1 bg-[#1D5DFF] transition-all duration-1000 ease-linear rounded-t-2xl"
                style={{ width: `${(timeLeft / 120) * 100}%` }}
              />
            )}

            <div className="space-y-6">
              {/* Question Card */}
              <div className="bg-[#0D0D0C] border border-[#2A2A28] rounded-xl p-5 shadow-inner relative">
                {!hasCompletedGreeting ? (
                  <div className="font-mono text-[10px] text-[#1D5DFF] tracking-widest uppercase mb-2">
                    AI Welcome & Orientation
                  </div>
                ) : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? (
                  <div className="font-mono text-[10px] text-emerald-400 tracking-widest uppercase mb-2 animate-pulse">
                    AI Interview Concluded
                  </div>
                ) : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ? (
                  <div className="font-mono text-[10px] text-emerald-400 tracking-widest uppercase mb-2 animate-pulse">
                    AI Question Clarification
                  </div>
                ) : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ? (
                  <div className="font-mono text-[10px] text-amber-400 tracking-widest uppercase mb-2 animate-pulse">
                    AI Repeating Question
                  </div>
                ) : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ? (
                  <div className="font-mono text-[10px] text-[#1D5DFF] tracking-widest uppercase mb-2">
                    AI Transition
                  </div>
                ) : activeFollowUp ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-400 font-mono text-[10px] uppercase tracking-wider mb-2 animate-pulse">
                    <span>AI Project Follow-Up (Turn {followUpTurn} of 2)</span>
                  </div>
                ) : (
                  <div className="font-mono text-[10px] text-[#6E6D68] tracking-widest uppercase mb-2">
                    AI Question {currentQuestionIndex + 1}
                  </div>
                )}

                <h2 className="text-base lg:text-lg font-bold text-[#F0EEE8] leading-relaxed">
                  "{!hasCompletedGreeting ? greetingText : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? closingText : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ? clarificationText : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ? repeatAckText : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ? transitionText : displayedQuestionText}"
                </h2>
              </div>

              {/* Functional Live Audio Visualizer */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        isRecording ? "bg-[#1D5DFF] animate-pulse" : "bg-[#6E6D68]"
                      }`}
                    />
                    <span className="font-mono text-xs text-[#1D5DFF] tracking-wider uppercase font-medium">
                      {isRecording
                        ? interviewState === INTERVIEW_STATES.GREETING_LISTENING
                          ? "Listening to greeting..."
                          : vad.isSpeaking
                          ? "Speaking..."
                          : "Listening to your answer..."
                        : aiSpeaking
                        ? interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
                          ? "AI Closing Statement..."
                          : "AI Speaking (Ask clarification or speak anytime)..."
                        : "Microphone Idle"}
                    </span>
                  </div>

                  {interviewState === INTERVIEW_STATES.PROCESSING_ANSWER && (
                    <span className="font-mono text-[10px] text-[#9A9990] animate-pulse">
                      Processing...
                    </span>
                  )}
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

              {/* Live Transcript Display */}
              <div className="pt-1">
                <div className="min-h-[48px] text-xs leading-relaxed text-[#F0EEE8]">
                  {liveTranscript || (
                    <span className="text-[#6E6D68] italic text-[11px]">
                      {!hasCompletedGreeting
                        ? interviewState === INTERVIEW_STATES.GREETING_SPEAKING
                          ? "(Listening to AI welcome...)"
                          : "(Say hello or ready to get started...)"
                        : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
                        ? "(Finalizing session results...)"
                        : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING
                        ? "(AI providing brief clarification...)"
                        : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING
                        ? "(Preparing to repeat question...)"
                        : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING
                        ? "(Transitioning to next question...)"
                        : isRecording
                        ? "(Speak your response naturally... or ask 'Can you clarify?')"
                        : isFollowUpLoading
                        ? "Formulating project follow-up question..."
                        : uploading
                        ? "Uploading answer telemetry..."
                        : aiSpeaking
                        ? "(Listening to question audio...)"
                        : "(Preparing next question...)"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Continuous Flow Status Section */}
            <div className="mt-6 pt-5 border-t border-[#2A2A28] flex flex-col items-center space-y-4">
              <div className="text-3xl font-bold font-mono text-[#F0EEE8]">
                {interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? "00:00" : hasCompletedGreeting ? formatTime(timeLeft) : "--:--"}
              </div>

              {/* Status Indicator */}
              <div className="w-full">
                {!hasCompletedGreeting ? (
                  interviewState === INTERVIEW_STATES.GREETING_SPEAKING ? (
                    <div className="w-full py-3 bg-[#161615] text-[#9A9990] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1D5DFF] animate-pulse" />
                      AI Welcome Greeting
                    </div>
                  ) : (
                    <button
                      onClick={transitionFromGreetingToQ1}
                      className="w-full py-3 bg-[#161615] hover:bg-[#20201F] text-[#1D5DFF] hover:text-white rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] hover:border-blue-500/40 transition-all flex items-center justify-center gap-2"
                    >
                      <span>I'm Ready (or speak to begin)</span>
                    </button>
                  )
                ) : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Interview Concluded — Generating Report
                  </div>
                ) : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    AI Clarifying Question
                  </div>
                ) : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-amber-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-amber-500/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Repeating Question
                  </div>
                ) : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-[#1D5DFF] rounded-xl font-mono text-xs tracking-wider uppercase border border-blue-900/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D5DFF] animate-pulse" />
                    AI Transition
                  </div>
                ) : interviewState === INTERVIEW_STATES.AI_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-[#9A9990] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D5DFF] animate-pulse" />
                    AI Asking Question
                  </div>
                ) : interviewState === INTERVIEW_STATES.PROCESSING_ANSWER || uploading || isFollowUpLoading ? (
                  <div className="w-full py-3 bg-[#161615] text-[#1D5DFF] rounded-xl font-mono text-xs tracking-wider uppercase border border-blue-900/40 flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#1D5DFF] border-t-transparent rounded-full animate-spin" />
                    {isFollowUpLoading ? "Generating Project Follow-Up..." : "Submitting Answer & Advancing..."}
                  </div>
                ) : isRecording ? (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={handleRepeatQuestion}
                      className="w-1/3 py-3 bg-[#161615] hover:bg-[#20201F] text-amber-400 hover:text-amber-300 rounded-xl font-mono text-xs tracking-wider uppercase border border-amber-900/40 hover:border-amber-700/50 transition-all flex items-center justify-center gap-1"
                    >
                      <span>Repeat</span>
                    </button>
                    <button
                      onClick={() => triggerAnswerCompletion("manual_done")}
                      className="w-2/3 py-3 bg-[#161615] hover:bg-[#20201F] text-[#9A9990] hover:text-[#F0EEE8] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] hover:border-[#3A3A38] transition-all flex items-center justify-center gap-2"
                    >
                      <span>Done Answering</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-3 bg-[#161615] text-[#6E6D68] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] flex items-center justify-center">
                    Preparing...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
