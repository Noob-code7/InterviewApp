import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { analysisApi } from "../api/analysis.js";
import { Button } from "../components/ui/index.js";
import LiveAudioVisualizer from "../components/ui/LiveAudioVisualizer.jsx";
import { useVoiceActivityDetector } from "../hooks/useVoiceActivityDetector.js";
import { speak, cancelTTS, preSynthesize } from "../utils/ttsService.js";
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

// Single-Owner Interview State Machine
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

export const isAISpeakingState = (state) =>
  state === INTERVIEW_STATES.AI_SPEAKING ||
  state === INTERVIEW_STATES.GREETING_SPEAKING ||
  state === INTERVIEW_STATES.GREETING_ACK ||
  state === INTERVIEW_STATES.TRANSITION_SPEAKING ||
  state === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ||
  state === INTERVIEW_STATES.CLARIFICATION_SPEAKING ||
  state === INTERVIEW_STATES.CLOSING_SPEAKING;

export default function LiveInterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Session & Question States
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Reactive MediaStream State (Ensures VAD receives stream reference reactively)
  const [mediaStream, setMediaStream] = useState(null);

  // Single-Owner State Machine State
  const [interviewState, setInterviewState] = useState(INTERVIEW_STATES.INITIALIZING);

  // Conversational Lifecycle Text States
  const [greetingText, setGreetingText] = useState("");
  const [transitionText, setTransitionText] = useState("");
  const [repeatAckText, setRepeatAckText] = useState("");
  const [clarificationText, setClarificationText] = useState("");
  const [closingText, setClosingText] = useState("");
  const [lastBargeInLatency, setLastBargeInLatency] = useState(null);

  // Dynamic Follow-Up States (Project Track)
  const [activeFollowUp, setActiveFollowUp] = useState(null);
  const [followUpTurn, setFollowUpTurn] = useState(0);
  const [previousFollowUps, setPreviousFollowUps] = useState([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  // Media & Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [ttsStartTime, setTtsStartTime] = useState(0);

  // Refs for State Synchronization & Hardware Tracks
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognizerRef = useRef(null);
  const timerRef = useRef(null);
  const greetingTimeoutRef = useRef(null);

  // Concurrency & Generation ID Lifecycle Guards
  const isUploadingRef = useRef(false);
  const transitionLockRef = useRef(false);
  const lastSpokenTransitionIndexRef = useRef(-1);
  const repeatCountRef = useRef(0);
  const liveTranscriptRef = useRef("");
  const currentQIndexRef = useRef(currentQuestionIndex);
  currentQIndexRef.current = currentQuestionIndex;

  // Unique Generation ID: Tracks the currently active AI utterance
  const speechGenerationIdRef = useRef(0);
  const ttsStartTimeRef = useRef(0);

  const currentQ = questions[currentQuestionIndex];
  const displayedQuestionText = activeFollowUp
    ? activeFollowUp.questionText
    : currentQ?.questionText || "";

  // --------------------------------------------------------------------------
  // Recording Initiation (Starts MediaRecorder, SpeechRecognition & Countdown)
  // --------------------------------------------------------------------------
  const startAnswerRecording = useCallback((initialText = "") => {
    const stream = streamRef.current;
    if (!stream) {
      console.warn("[InterviewEngine] Cannot start recording: streamRef is null");
      return;
    }

    console.log(`[InterviewEngine] Starting answer recording for Question ${currentQIndexRef.current + 1}`);

    try {
      chunksRef.current = [];
      setLiveTranscript(initialText || "");
      liveTranscriptRef.current = initialText || "";

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp8,opus",
        });
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        handleUpload();
      };

      // Initialize Speech Recognition
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          if (recognizerRef.current) {
            try {
              recognizerRef.current.onend = null;
              recognizerRef.current.stop();
            } catch (e) {}
            recognizerRef.current = null;
          }

          let networkErrorCount = 0;
          const recog = new SpeechRec();
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
            liveTranscriptRef.current = fullText;
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

          try {
            recog.start();
            recognizerRef.current = recog;
          } catch (recogErr) {
            console.warn("[LiveSpeechRecognition] Start error:", recogErr.message);
          }
        } catch (e) {
          console.warn("[LiveSpeechRecognition] Init error:", e.message);
        }
      }

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
  }, []);

  // --------------------------------------------------------------------------
  // Answer Completion Trigger
  // --------------------------------------------------------------------------
  const triggerAnswerCompletion = useCallback((source = "auto") => {
    if (
      interviewState === INTERVIEW_STATES.PROCESSING_ANSWER ||
      interviewState === INTERVIEW_STATES.ADVANCING ||
      interviewState === INTERVIEW_STATES.COMPLETED ||
      interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ||
      interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
    ) {
      console.log(`[InterviewEngine] Transition/upload in progress, dropping trigger from ${source}`);
      return;
    }

    const intent = classifyInterruption(liveTranscriptRef.current);
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
  }, [interviewState]);

  // --------------------------------------------------------------------------
  // Repeat Question Handler
  // --------------------------------------------------------------------------
  const handleRepeatQuestion = useCallback(() => {
    console.log(`[RepeatEngine] Repeating current Question ${currentQIndexRef.current + 1}`);
    repeatCountRef.current += 1;
    const currentGenId = ++speechGenerationIdRef.current;

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
    liveTranscriptRef.current = "";
    clearInterval(timerRef.current);

    const chosenAck = getRandomItem(REPEAT_ACKNOWLEDGEMENTS);
    setRepeatAckText(chosenAck);
    setInterviewState(INTERVIEW_STATES.REPEAT_ACK_SPEAKING);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    speak(chosenAck).then(() => {
      if (currentGenId !== speechGenerationIdRef.current) return;
      playQuestionTTS(currentQIndexRef.current);
    }).catch(() => {
      if (currentGenId !== speechGenerationIdRef.current) return;
      playQuestionTTS(currentQIndexRef.current);
    });
  }, []);

  // --------------------------------------------------------------------------
  // Clarification Request Handler
  // --------------------------------------------------------------------------
  const handleClarificationRequest = useCallback(() => {
    console.log(`[ClarificationEngine] Handling clarification for Question ${currentQIndexRef.current + 1}`);
    const currentGenId = ++speechGenerationIdRef.current;

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

    const candidateQuery = liveTranscriptRef.current;
    setIsRecording(false);
    chunksRef.current = [];
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    clearInterval(timerRef.current);

    const response = generateClarificationResponse(displayedQuestionText, candidateQuery);
    setClarificationText(response);
    setInterviewState(INTERVIEW_STATES.CLARIFICATION_SPEAKING);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    speak(response).then(() => {
      if (currentGenId !== speechGenerationIdRef.current) return;
      setAiSpeaking(false);
      setInterviewState(INTERVIEW_STATES.LISTENING);
      startAnswerRecording();
    }).catch(() => {
      if (currentGenId !== speechGenerationIdRef.current) return;
      setAiSpeaking(false);
      setInterviewState(INTERVIEW_STATES.LISTENING);
      startAnswerRecording();
    });
  }, [displayedQuestionText, startAnswerRecording]);

  // --------------------------------------------------------------------------
  // Centralized Barge-In Interruption Handler (Active for ALL AI Speech)
  // --------------------------------------------------------------------------
  const handleBargeInInterruption = useCallback(
    ({ source, text, rms, noiseFloor, onsetTime, timestamp }) => {
      speechGenerationIdRef.current += 1;

      try {
        cancelTTS();
      } catch (e) {}

      const tCompleted = performance.now();
      const referenceOnset = onsetTime || timestamp || tCompleted;
      const endToEndLatencyMs = Math.max(0, tCompleted - referenceOnset);
      setLastBargeInLatency(endToEndLatencyMs);

      console.log(
        `[BargeIn Engine] Interrupted during ${interviewState} in ${endToEndLatencyMs.toFixed(1)}ms (Source: ${source}, RMS: ${rms?.toFixed(3) || 'N/A'}, NoiseFloor: ${noiseFloor?.toFixed(3) || 'N/A'})`
      );

      setAiSpeaking(false);
      transitionLockRef.current = false;

      // Interrupted during greeting
      if (interviewState === INTERVIEW_STATES.GREETING_SPEAKING || interviewState === INTERVIEW_STATES.GREETING_ACK) {
        setInterviewState(INTERVIEW_STATES.GREETING_LISTENING);
        chunksRef.current = [];
        setLiveTranscript(text || "");
        liveTranscriptRef.current = text || "";
        setIsRecording(true);
        startAnswerRecording(text || "");
        return;
      }

      // Interrupted during closing
      if (interviewState === INTERVIEW_STATES.CLOSING_SPEAKING) {
        setInterviewState(INTERVIEW_STATES.COMPLETED);
        stopCamera();
        navigate("/interview/processing", { state: { sessionId } });
        return;
      }

      // Interrupted during question, transition, repeat ack, or clarification
      setInterviewState(INTERVIEW_STATES.LISTENING);

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
        liveTranscriptRef.current = text;
      }

      startAnswerRecording(text || "");
    },
    [interviewState, sessionId, navigate, handleRepeatQuestion, handleClarificationRequest, startAnswerRecording]
  );

  // --------------------------------------------------------------------------
  // Voice Activity Detector Hook
  // --------------------------------------------------------------------------
  const isCandidateActiveListening =
    isRecording &&
    (interviewState === INTERVIEW_STATES.LISTENING ||
      interviewState === INTERVIEW_STATES.GREETING_LISTENING);

  const isBargeInActive = isAISpeakingState(interviewState);

  const vad = useVoiceActivityDetector({
    stream: mediaStream,
    enabled: isCandidateActiveListening,
    bargeInEnabled: isBargeInActive,
    speechThreshold: 0.030,
    bargeInThreshold: 0.055,
    bargeInSustainMs: 260,
    silenceThresholdMs: 2200,
    thinkingGracePeriodMs: 4000,
    minAnswerDurationMs: interviewState === INTERVIEW_STATES.GREETING_LISTENING ? 1500 : 3000,
    minWordCount: interviewState === INTERVIEW_STATES.GREETING_LISTENING ? 1 : 4,
    ttsStartTime,
    onAnswerComplete: ({ reason, silenceDuration, wordCount, duration }) => {
      if (interviewState === INTERVIEW_STATES.GREETING_LISTENING) {
        console.log(`[GreetingEngine] Greeting response detected (${wordCount} words, duration ${duration}ms). Transitioning to ack.`);
        transitionFromGreetingToQ1();
      } else if (interviewState === INTERVIEW_STATES.LISTENING) {
        console.log(`[VAD Engine] Auto-completing answer: ${reason} (silence: ${silenceDuration}ms, words: ${wordCount}, duration: ${duration}ms)`);
        triggerAnswerCompletion(`vad_${reason}`);
      }
    },
    onBargeIn: handleBargeInInterruption,
  });

  // Check live transcript for voice commands (repeat / clarify) while listening
  useEffect(() => {
    if (liveTranscript) {
      vad.notifyTranscriptUpdate(liveTranscript);

      if (interviewState === INTERVIEW_STATES.LISTENING) {
        const intent = classifyInterruption(liveTranscriptRef.current);
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

  // --------------------------------------------------------------------------
  // Question TTS Player Function
  // --------------------------------------------------------------------------
  const playQuestionTTS = useCallback((questionIndex) => {
    const q = questions[questionIndex];
    if (!q) return;

    const currentGenId = ++speechGenerationIdRef.current;
    const textToSpeak = activeFollowUp ? activeFollowUp.questionText : q.questionText;

    console.log(`[InterviewEngine] Playing Question ${questionIndex + 1} TTS: "${textToSpeak.slice(0, 45)}..."`);

    setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    speak(textToSpeak)
      .then(() => {
        if (currentGenId !== speechGenerationIdRef.current) return;
        setAiSpeaking(false);
        setInterviewState(INTERVIEW_STATES.LISTENING);
        startAnswerRecording();
      })
      .catch((err) => {
        console.warn("[TTS] Speech playback error:", err);
        if (currentGenId !== speechGenerationIdRef.current) return;
        setAiSpeaking(false);
        setInterviewState(INTERVIEW_STATES.LISTENING);
        startAnswerRecording();
      });
  }, [questions, activeFollowUp, startAnswerRecording]);

  // --------------------------------------------------------------------------
  // Transition from Greeting to Question 1
  // --------------------------------------------------------------------------
  const transitionFromGreetingToQ1 = useCallback(() => {
    if (greetingTimeoutRef.current) clearTimeout(greetingTimeoutRef.current);
    const currentGenId = ++speechGenerationIdRef.current;

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
    liveTranscriptRef.current = "";
    setInterviewState(INTERVIEW_STATES.GREETING_ACK);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    const ackPhrase = getRandomItem(GREETING_ACKNOWLEDGEMENTS);

    speak(ackPhrase)
      .then(() => {
        if (currentGenId !== speechGenerationIdRef.current) return;
        playQuestionTTS(0);
      })
      .catch(() => {
        if (currentGenId !== speechGenerationIdRef.current) return;
        playQuestionTTS(0);
      });
  }, [playQuestionTTS]);

  // --------------------------------------------------------------------------
  // Automatic Question Transition Execution
  // --------------------------------------------------------------------------
  const executeQuestionTransition = useCallback(
    (nextIndex) => {
      if (transitionLockRef.current) return;
      transitionLockRef.current = true;
      lastSpokenTransitionIndexRef.current = nextIndex;
      const currentGenId = ++speechGenerationIdRef.current;

      const chosenTransition = getRandomItem(QUESTION_TRANSITIONS);
      setTransitionText(chosenTransition);
      setInterviewState(INTERVIEW_STATES.TRANSITION_SPEAKING);
      setAiSpeaking(true);
      ttsStartTimeRef.current = Date.now();
      setTtsStartTime(Date.now());

      speak(chosenTransition)
        .then(() => {
          if (currentGenId !== speechGenerationIdRef.current) return;
          setAiSpeaking(false);
          setCurrentQuestionIndex(nextIndex);
          setUploading(false);
          isUploadingRef.current = false;
          transitionLockRef.current = false;
          chunksRef.current = [];
          setLiveTranscript("");
          liveTranscriptRef.current = "";
          playQuestionTTS(nextIndex);
        })
        .catch(() => {
          if (currentGenId !== speechGenerationIdRef.current) return;
          setAiSpeaking(false);
          setCurrentQuestionIndex(nextIndex);
          setUploading(false);
          isUploadingRef.current = false;
          transitionLockRef.current = false;
          chunksRef.current = [];
          setLiveTranscript("");
          liveTranscriptRef.current = "";
          playQuestionTTS(nextIndex);
        });
    },
    [playQuestionTTS]
  );

  // --------------------------------------------------------------------------
  // Natural Interview Closing Execution
  // --------------------------------------------------------------------------
  const executeNaturalClosing = useCallback(async () => {
    const currentGenId = ++speechGenerationIdRef.current;
    const chosenClosing = getRandomItem(CLOSING_STATEMENTS);
    setClosingText(chosenClosing);
    setInterviewState(INTERVIEW_STATES.CLOSING_SPEAKING);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    const finalizeAndNavigate = async () => {
      if (currentGenId !== speechGenerationIdRef.current) return;
      setAiSpeaking(false);
      stopCamera();
      setInterviewState(INTERVIEW_STATES.COMPLETED);
      if (session?.includeWritingTest) {
        navigate(`/interview/writing/${sessionId}`);
        return;
      }
      try {
        await sessionsApi.updateStatus(sessionId, "processing");
      } catch (statusErr) {
        console.warn("Status update error:", statusErr);
      }
      navigate("/interview/processing", { state: { sessionId } });
    };

    speak(chosenClosing)
      .then(finalizeAndNavigate)
      .catch(finalizeAndNavigate);
  }, [sessionId, navigate, session]);

  // --------------------------------------------------------------------------
  // Handle Answer Upload & Automatic Progression
  // --------------------------------------------------------------------------
  const handleUpload = async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploading(true);

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const currentQ = questions[currentQIndexRef.current];
      const currentAnswerText = liveTranscriptRef.current || "";

      if (!currentQ) {
        console.warn("[InterviewEngine] No current question found during upload");
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
            liveTranscriptRef.current = "";
            playQuestionTTS(currentQIndexRef.current);
            return;
          }
        } catch (fErr) {
          console.warn("[ProjectFollowUp] Error generating follow-up:", fErr.message);
        }
        setIsFollowUpLoading(false);
      }

      // 4. Automatic Question Progression or Natural Closing
      setFollowUpTurn(0);
      setActiveFollowUp(null);
      setPreviousFollowUps([]);

      const nextIndex = currentQIndexRef.current + 1;

      if (nextIndex < questions.length) {
        console.log(`[InterviewEngine] Auto-transitioning to Question ${nextIndex + 1} of ${questions.length}`);
        executeQuestionTransition(nextIndex);
      } else {
        console.log(`[InterviewEngine] All ${questions.length} questions completed. Starting Natural Closing...`);
        executeNaturalClosing();
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload answer. Moving forward...");
    } finally {
      isUploadingRef.current = false;
      setUploading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Camera & Stream Controls
  // --------------------------------------------------------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      setError("Camera/Microphone access denied. Please enable it in browser settings.");
      return null;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // --------------------------------------------------------------------------
  // Session Initialization & Welcome Greeting Execution
  // --------------------------------------------------------------------------
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

        const chosenGreeting = getRandomItem(INTERVIEW_GREETINGS);
        if (isMounted) {
          setQuestions(fetchedQuestions);
          setGreetingText(chosenGreeting);
          setLoading(false);
        }

        preSynthesize(chosenGreeting);
        [
          ...GREETING_ACKNOWLEDGEMENTS,
          ...QUESTION_TRANSITIONS,
          ...REPEAT_ACKNOWLEDGEMENTS,
          ...CLOSING_STATEMENTS,
        ].forEach((phrase) => preSynthesize(phrase));

        await startCamera();

        // Start Greeting Delivery after camera is initialized
        if (isMounted) {
          const currentGenId = ++speechGenerationIdRef.current;
          setInterviewState(INTERVIEW_STATES.GREETING_SPEAKING);
          setAiSpeaking(true);
          ttsStartTimeRef.current = Date.now();
          setTtsStartTime(Date.now());

          const startGreetingListening = () => {
            if (currentGenId !== speechGenerationIdRef.current) return;
            setAiSpeaking(false);
            setInterviewState(INTERVIEW_STATES.GREETING_LISTENING);
            chunksRef.current = [];
            setLiveTranscript("");
            liveTranscriptRef.current = "";
            setIsRecording(true);

            greetingTimeoutRef.current = setTimeout(() => {
              transitionFromGreetingToQ1();
            }, 4500);
          };

          speak(chosenGreeting)
            .then(startGreetingListening)
            .catch(startGreetingListening);
        }
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
      cancelTTS();
    };
  }, [sessionId, navigate, transitionFromGreetingToQ1]);

  // Bind video element whenever loading finishes or stream is ready
  useEffect(() => {
    if (!loading && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [loading, mediaStream]);

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
            onClick={() => navigate("/interview/setup")}
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
      {/* Top Header */}
      <header className="h-16 border-b border-[#2A2A28] px-6 flex items-center justify-between bg-[#111110]/95 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#1D5DFF]" />
          <span className="font-mono text-sm tracking-wider uppercase font-bold text-[#F0EEE8]">
            INTERVIEWAI <span className="text-[#6E6D68] font-normal">| LIVE ASSESSMENT</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {interviewState !== INTERVIEW_STATES.INITIALIZING &&
            interviewState !== INTERVIEW_STATES.GREETING_SPEAKING &&
            interviewState !== INTERVIEW_STATES.GREETING_LISTENING &&
            interviewState !== INTERVIEW_STATES.GREETING_ACK &&
            currentQ?.track && (
              <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded bg-[#161615] border border-[#2A2A28] text-[#1D5DFF]">
                {currentQ.track === "project" ? "Project Track" : currentQ.track === "hr" ? "HR Track" : "Technical Subject"}
              </span>
            )}
          <div className="font-mono text-xs text-[#6E6D68]">
            {interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
              ? "Interview Closing"
              : interviewState === INTERVIEW_STATES.INITIALIZING ||
                interviewState === INTERVIEW_STATES.GREETING_SPEAKING ||
                interviewState === INTERVIEW_STATES.GREETING_LISTENING ||
                interviewState === INTERVIEW_STATES.GREETING_ACK
              ? "Interview Welcome"
              : `Question ${currentQuestionIndex + 1} / ${questions.length}`}
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

        {/* Right Sidebar: Question & AI Conversational Display */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0">
          <div className="bg-[#161615] border border-[#2A2A28] rounded-2xl p-6 flex-1 flex flex-col justify-between shadow-2xl relative">
            {/* Countdown Progress Bar */}
            {isRecording &&
              interviewState !== INTERVIEW_STATES.GREETING_LISTENING && (
                <div
                  className="absolute top-0 left-0 h-1 bg-[#1D5DFF] transition-all duration-1000 ease-linear rounded-t-2xl"
                  style={{ width: `${(timeLeft / 120) * 100}%` }}
                />
              )}

            <div className="space-y-6">
              {/* Question / AI Phrase Card */}
              <div className="bg-[#0D0D0C] border border-[#2A2A28] rounded-xl p-5 shadow-inner relative">
                {interviewState === INTERVIEW_STATES.INITIALIZING ||
                interviewState === INTERVIEW_STATES.GREETING_SPEAKING ||
                interviewState === INTERVIEW_STATES.GREETING_LISTENING ||
                interviewState === INTERVIEW_STATES.GREETING_ACK ? (
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
                    AI Transition Bridge
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
                  "{interviewState === INTERVIEW_STATES.INITIALIZING || interviewState === INTERVIEW_STATES.GREETING_SPEAKING || interviewState === INTERVIEW_STATES.GREETING_LISTENING || interviewState === INTERVIEW_STATES.GREETING_ACK ? greetingText : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? closingText : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING ? clarificationText : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING ? repeatAckText : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ? transitionText : displayedQuestionText}"
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
                        ? "AI Speaking (Speak anytime to interrupt)..."
                        : "Microphone Idle"}
                    </span>
                  </div>
                </div>

                <div className="h-10 bg-[#0D0D0C] border border-[#2A2A28] rounded-lg flex items-center justify-center px-4">
                  <LiveAudioVisualizer
                    isRecording={isRecording || isBargeInActive}
                    isSpeaking={vad.isSpeaking}
                    rms={vad.currentRms}
                  />
                </div>
              </div>

              {/* Live Transcript Display */}
              <div className="pt-1">
                <div className="min-h-[48px] text-xs leading-relaxed text-[#F0EEE8]">
                  {liveTranscript || (
                    <span className="text-[#6E6D68] italic text-[11px]">
                      {interviewState === INTERVIEW_STATES.INITIALIZING || interviewState === INTERVIEW_STATES.GREETING_SPEAKING
                        ? "(Listening to AI welcome...)"
                        : interviewState === INTERVIEW_STATES.GREETING_LISTENING
                        ? "(Say hello or ready to get started...)"
                        : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
                        ? "(Finalizing session results...)"
                        : interviewState === INTERVIEW_STATES.CLARIFICATION_SPEAKING
                        ? "(AI providing brief clarification...)"
                        : interviewState === INTERVIEW_STATES.REPEAT_ACK_SPEAKING
                        ? "(Preparing to repeat question...)"
                        : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING
                        ? "(Transitioning to next question...)"
                        : isRecording
                        ? "(Speak your answer naturally... or ask 'Can you repeat?' / 'Can you clarify?')"
                        : isFollowUpLoading
                        ? "Formulating project follow-up question..."
                        : uploading
                        ? "Uploading answer telemetry..."
                        : aiSpeaking
                        ? "(Listening to AI speech...)"
                        : "(Preparing next question...)"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Continuous Flow Status & Fallback Controls */}
            <div className="mt-6 pt-5 border-t border-[#2A2A28] flex flex-col items-center space-y-4">
              <div className="text-3xl font-bold font-mono text-[#F0EEE8]">
                {interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
                  ? "00:00"
                  : interviewState === INTERVIEW_STATES.GREETING_SPEAKING ||
                    interviewState === INTERVIEW_STATES.GREETING_LISTENING ||
                    interviewState === INTERVIEW_STATES.GREETING_ACK
                  ? "--:--"
                  : formatTime(timeLeft)}
              </div>

              {/* Voice-First Conversational Status Bar */}
              <div className="w-full space-y-2">
                {interviewState === INTERVIEW_STATES.GREETING_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-[#9A9990] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D5DFF] animate-pulse" />
                    AI Welcome Greeting
                  </div>
                ) : interviewState === INTERVIEW_STATES.GREETING_LISTENING ? (
                  <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Listening: Say "Hello" or "I'm ready"
                  </div>
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
                    AI Transitioning
                  </div>
                ) : interviewState === INTERVIEW_STATES.AI_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-[#9A9990] rounded-xl font-mono text-xs tracking-wider uppercase border border-[#2A2A28] flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D5DFF] animate-pulse" />
                    AI Asking Question (Speak to interrupt)
                  </div>
                ) : interviewState === INTERVIEW_STATES.PROCESSING_ANSWER || uploading || isFollowUpLoading ? (
                  <div className="w-full py-3 bg-[#161615] text-[#1D5DFF] rounded-xl font-mono text-xs tracking-wider uppercase border border-blue-900/40 flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#1D5DFF] border-t-transparent rounded-full animate-spin" />
                    {isFollowUpLoading ? "Formulating Follow-Up Question..." : "Answer Captured — Transitioning..."}
                  </div>
                ) : isRecording ? (
                  <div className="space-y-2 w-full">
                    <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Listening: Speak your answer naturally
                    </div>

                    {/* Secondary Fallback Controls (Accessible, non-intrusive) */}
                    <div className="flex justify-between items-center px-1 pt-1">
                      <button
                        onClick={handleRepeatQuestion}
                        className="text-[11px] font-mono text-[#6E6D68] hover:text-amber-400 transition-colors flex items-center gap-1"
                      >
                        <span>↺ Repeat Question</span>
                      </button>
                      <button
                        onClick={() => triggerAnswerCompletion("manual_done")}
                        className="text-[11px] font-mono text-[#6E6D68] hover:text-[#F0EEE8] transition-colors flex items-center gap-1"
                      >
                        <span>✓ Done Answering (Manual)</span>
                      </button>
                    </div>
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
