import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import { interviewApi } from "../api/interview.js";
import { analysisApi } from "../api/analysis.js";
import LiveAudioVisualizer from "../components/ui/LiveAudioVisualizer.jsx";
import { useVoiceActivityDetector } from "../hooks/useVoiceActivityDetector.js";
import { speak, cancelTTS, preSynthesize } from "../utils/ttsService.js";
import {
  INTERVIEW_GREETINGS,
  GREETING_ACKNOWLEDGEMENTS,
  QUESTION_TRANSITIONS,
  CLOSING_STATEMENTS,
  classifyInterruption,
  getRandomItem,
  mergeTranscripts,
} from "../utils/interviewConversationalPatterns.js";

// Diagnostic trace function (dev-only: no-ops in production builds)
const trace = (event, data = {}) => {
  if (import.meta.env && import.meta.env.DEV === false) return;
  console.log(`[LIVE-TRACE ${performance.now().toFixed(0)}] ${event}`, data);
};

// Single-Owner Interview State Machine
export const INTERVIEW_STATES = {
  INITIALIZING: "INITIALIZING",
  GREETING_SPEAKING: "GREETING_SPEAKING",
  GREETING_LISTENING: "GREETING_LISTENING",
  GREETING_ACK: "GREETING_ACK",
  AI_SPEAKING: "AI_SPEAKING",
  LISTENING: "LISTENING",
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

  // Reactive MediaStream State
  const [mediaStream, setMediaStream] = useState(null);

  // Single-Owner State Machine State
  const [interviewState, setInterviewState] = useState(INTERVIEW_STATES.INITIALIZING);

  // Conversational Lifecycle Text States
  const [greetingText, setGreetingText] = useState("");
  const [transitionText, setTransitionText] = useState("");
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

  // Hardware & DOM Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognizerRef = useRef(null);
  const timerRef = useRef(null);
  const greetingTimeoutRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // State Mirror Refs (Guarantees fresh data access in async callbacks without re-render cascades)
  const questionsRef = useRef([]);
  questionsRef.current = questions;

  const currentQIndexRef = useRef(0);
  currentQIndexRef.current = currentQuestionIndex;

  const activeFollowUpRef = useRef(null);
  activeFollowUpRef.current = activeFollowUp;

  const liveTranscriptRef = useRef("");
  liveTranscriptRef.current = liveTranscript;

  // Question-indexed persistent transcript buffer across barge-ins and continuations
  const questionTranscriptsRef = useRef({});

  const interviewStateRef = useRef(interviewState);
  interviewStateRef.current = interviewState;

  const isUploadingRef = useRef(false);
  const transitionLockRef = useRef(false);
  const lastSpokenTransitionIndexRef = useRef(-1);

  // Unique Generation ID: Tracks the currently active AI utterance
  const speechGenerationIdRef = useRef(0);
  const ttsStartTimeRef = useRef(0);

  // Target question index that candidate speech belongs to (for continuation of previous question)
  const continuationTargetQuestionIndexRef = useRef(null);

  // Question index that was interrupted by candidate and must be replayed after continuation
  const questionToReplayIndexRef = useRef(null);

  // Track whether we're in a barge-in continuation flow
  const isBargeInContinuationRef = useRef(false);

  // Handler Delegates (Stable function references for decoupling)
  const startAnswerRecordingRef = useRef(null);
  const playQuestionTTSRef = useRef(null);
  const transitionFromGreetingToQ1Ref = useRef(null);
  const executeQuestionTransitionRef = useRef(null);
  const executeNaturalClosingRef = useRef(null);
  const resetBargeInEngineRef = useRef(null);

  const currentQ = questions[currentQuestionIndex];
  const displayedQuestionText = activeFollowUp
    ? activeFollowUp.questionText
    : currentQ?.questionText || "";

  // --------------------------------------------------------------------------
  // Camera & Stream Controls
  // --------------------------------------------------------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
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
  // Recording Initiation (Starts MediaRecorder, SpeechRecognition & Countdown)
  // --------------------------------------------------------------------------
  const startAnswerRecording = useCallback((initialText = "", isBargeInRecovery = false) => {
    const stream = streamRef.current;
    if (!stream) {
      trace("startAnswerRecording_no_stream");
      return;
    }

    if (!isBargeInRecovery && !isBargeInContinuationRef.current) {
      // Normal question start - clear any continuation tracking
      continuationTargetQuestionIndexRef.current = null;
      questionToReplayIndexRef.current = null;
      isBargeInContinuationRef.current = false;
    }

    const isContinuation = isBargeInContinuationRef.current;
    const targetIdx = (isContinuation && continuationTargetQuestionIndexRef.current !== null)
      ? continuationTargetQuestionIndexRef.current
      : currentQIndexRef.current;

    const existingTargetTranscript = isContinuation
      ? (questionTranscriptsRef.current[targetIdx] || questionsRef.current[targetIdx]?.voiceAnalysis?.transcript || questionsRef.current[targetIdx]?.transcript || "")
      : "";

    trace("startAnswerRecording", {
      questionIndex: currentQIndexRef.current + 1,
      hasInitialText: !!initialText,
      isBargeInRecovery,
      isContinuation,
      targetIndex: targetIdx,
      replayIndex: questionToReplayIndexRef.current,
      hasExistingTranscript: !!existingTargetTranscript
    });

    try {
      chunksRef.current = [];
      // If continuing a previous question, merge existing partial transcript with any barge-in initial text
      const transcriptToUse = isBargeInRecovery
        ? (isContinuation && existingTargetTranscript
            ? mergeTranscripts(existingTargetTranscript, initialText || "")
            : (initialText || ""))
        : "";
      trace("startAnswerRecording_transcript", { transcriptToUse, isBargeInRecovery, isContinuation });
      setLiveTranscript(transcriptToUse);
      liveTranscriptRef.current = transcriptToUse;

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
            const currentSpokenText = (accumulated + " " + interim).trim();
            const fullText = isContinuation && existingTargetTranscript
              ? mergeTranscripts(existingTargetTranscript, currentSpokenText)
              : currentSpokenText;
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

  startAnswerRecordingRef.current = startAnswerRecording;

  // --------------------------------------------------------------------------
  // Question TTS Player Function
  // --------------------------------------------------------------------------
  const playQuestionTTS = useCallback((questionIndex, customPrefix = "") => {
    const qList = questionsRef.current;
    const q = qList[questionIndex];
    if (!q) {
      trace("playQuestionTTS_no_question", { questionIndex });
      return;
    }

    // Synchronize UI displayed question state and mirror ref atomically
    setCurrentQuestionIndex(questionIndex);
    currentQIndexRef.current = questionIndex;

    const currentGenId = ++speechGenerationIdRef.current;
    const followUp = activeFollowUpRef.current;
    const rawQuestionText = followUp ? followUp.questionText : q.questionText;
    const textToSpeak = customPrefix ? `${customPrefix} ${rawQuestionText}` : rawQuestionText;

    trace("playQuestionTTS_start", { questionIndex: questionIndex + 1, textPreview: textToSpeak.slice(0, 45), genId: currentGenId });

    resetBargeInEngineRef.current?.();
    setInterviewState(INTERVIEW_STATES.AI_SPEAKING);
    setAiSpeaking(true);
    ttsStartTimeRef.current = Date.now();
    setTtsStartTime(Date.now());

    // Split-prefix playback: the acknowledgment phrase and the bare question are
    // each pre-cached at room entry, so playing them sequentially avoids the
    // multi-second synthesis miss of the combined "{prefix} {question}" key.
    const speechPromise = customPrefix
      ? speak(customPrefix).then(() => {
          // Barge-in may have cancelled us during the prefix - never start the question then.
          if (currentGenId !== speechGenerationIdRef.current) return;
          return speak(rawQuestionText);
        })
      : speak(rawQuestionText);

    speechPromise
      .then(() => {
        if (currentGenId !== speechGenerationIdRef.current) {
          trace("playQuestionTTS_cancelled", { genId: currentGenId, currentGenId: speechGenerationIdRef.current });
          return;
        }
        trace("playQuestionTTS_completed", { genId: currentGenId });
        setAiSpeaking(false);
        setInterviewState(INTERVIEW_STATES.LISTENING);
        // Clear continuation tracking when starting a fresh question
        continuationTargetQuestionIndexRef.current = null;
        questionToReplayIndexRef.current = null;
        isBargeInContinuationRef.current = false;
        // Record question history when question is genuinely delivered
        recordQuestionHistoryOnce();

        // Proactively pre-synthesize the NEXT question in background while candidate speaks!
        const nextQ = questionsRef.current[questionIndex + 1];
        if (nextQ?.questionText) {
          preSynthesize(nextQ.questionText);
        }

        vad.startSession?.();
        startAnswerRecordingRef.current?.();
      })
      .catch((err) => {
        console.warn("[TTS] Speech playback error:", err);
        if (currentGenId !== speechGenerationIdRef.current) return;
        trace("playQuestionTTS_error", { err: err?.message });
        setAiSpeaking(false);
        setInterviewState(INTERVIEW_STATES.LISTENING);
        vad.startSession?.();
        startAnswerRecordingRef.current?.();
      });
  }, []);

  playQuestionTTSRef.current = playQuestionTTS;

  // Question-history recorder with signature dedupe: both the question-completion
  // and transition paths previously re-upserted the identical full list on every
  // question, causing N× redundant DB writes per interview.
  const questionHistorySignatureRef = useRef("");
  const recordQuestionHistoryOnce = useCallback(() => {
    try {
      const signature = (questionsRef.current || [])
        .map((q) => `${q.questionId || q._id || ""}:${q.questionText || ""}`)
        .join("|");
      if (!signature || signature === questionHistorySignatureRef.current) return;
      questionHistorySignatureRef.current = signature;
      interviewApi.recordQuestionHistory(sessionId, questionsRef.current).catch((err) => {
        console.warn("[InterviewEngine] Failed to record question history:", err);
      });
    } catch (e) {}
  }, [sessionId]);

  // --------------------------------------------------------------------------
  // Transition from Greeting to Question 1
  // --------------------------------------------------------------------------
  const transitionFromGreetingToQ1 = useCallback(() => {
    trace("transition_greeting_to_q1_start");
    if (greetingTimeoutRef.current) {
      clearTimeout(greetingTimeoutRef.current);
      greetingTimeoutRef.current = null;
    }

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    chunksRef.current = [];
    setLiveTranscript("");
    liveTranscriptRef.current = "";

    const ackPhrase = getRandomItem(GREETING_ACKNOWLEDGEMENTS);

    // Clear continuation tracking when starting Question 1
    continuationTargetQuestionIndexRef.current = null;
    questionToReplayIndexRef.current = null;
    isBargeInContinuationRef.current = false;

    // Seamless single utterance: "Great, let's begin. [Question 1 Text]"
    playQuestionTTSRef.current?.(0, ackPhrase);
  }, []);

  transitionFromGreetingToQ1Ref.current = transitionFromGreetingToQ1;

  // --------------------------------------------------------------------------
  // Automatic Question Transition Execution
  // --------------------------------------------------------------------------
  const executeQuestionTransition = useCallback((nextIndex) => {
    trace("execute_question_transition_start", { nextIndex: nextIndex + 1 });
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    lastSpokenTransitionIndexRef.current = nextIndex;
    const currentGenId = ++speechGenerationIdRef.current;

    const chosenTransition = getRandomItem(QUESTION_TRANSITIONS);
    setTransitionText(chosenTransition);
    resetBargeInEngineRef.current?.();
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
        // Clear continuation tracking when transitioning to next question
        continuationTargetQuestionIndexRef.current = null;
        questionToReplayIndexRef.current = null;
        isBargeInContinuationRef.current = false;
        // Record question history for the next question
        recordQuestionHistoryOnce();
        vad.startSession?.();
        playQuestionTTSRef.current?.(nextIndex);
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
        // Clear interrupted question index when starting a new question
        questionToReplayIndexRef.current = null;
        isBargeInContinuationRef.current = false;
        vad.startSession?.();
        playQuestionTTSRef.current?.(nextIndex);
      });
  }, []);

  executeQuestionTransitionRef.current = executeQuestionTransition;

  // --------------------------------------------------------------------------
  // Natural Interview Closing Execution
  // --------------------------------------------------------------------------
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
      try {
        await sessionsApi.updateStatus(sessionId, "processing");
      } catch (statusErr) {
        console.warn("Status update error:", statusErr);
      }
      // Check if writing test is enabled for this session
      const shouldIncludeWriting = session?.includeWritingTest !== false;
      trace("execute_natural_closing", { shouldIncludeWriting, sessionIncludeWritingTest: session?.includeWritingTest });
      if (shouldIncludeWriting) {
        navigate("/interview/writing/" + sessionId);
      } else {
        navigate("/interview/processing", { state: { sessionId } });
      }
    };

    speak(chosenClosing)
      .then(finalizeAndNavigate)
      .catch(finalizeAndNavigate);
  }, [sessionId, navigate, session]);

  executeNaturalClosingRef.current = executeNaturalClosing;

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

      const currentState = interviewStateRef.current;
      trace("bargein_confirmed", { source, currentState, rms, text, latencyMs: endToEndLatencyMs });

      setAiSpeaking(false);
      transitionLockRef.current = false;

      // Determine question association for barge-in:
      // If AI is reading Q2+ (currentQIndex >= 1) or transitioning between questions,
      // candidate interruption is a continuation of the preceding question (e.g. Q1).
      if (currentState === INTERVIEW_STATES.AI_SPEAKING && currentQIndexRef.current > 0) {
        continuationTargetQuestionIndexRef.current = currentQIndexRef.current - 1; // Belongs to Q1
        questionToReplayIndexRef.current = currentQIndexRef.current;             // Replay Q2
        isBargeInContinuationRef.current = true;
      } else if (currentState === INTERVIEW_STATES.TRANSITION_SPEAKING) {
        continuationTargetQuestionIndexRef.current = Math.max(0, lastSpokenTransitionIndexRef.current - 1);
        questionToReplayIndexRef.current = lastSpokenTransitionIndexRef.current;
        isBargeInContinuationRef.current = true;
      } else {
        // Interrupted while reading Question 1 itself: candidate is answering Q1 directly
        continuationTargetQuestionIndexRef.current = currentQIndexRef.current;
        questionToReplayIndexRef.current = null;
        isBargeInContinuationRef.current = false;
      }

      trace("bargein_question_association", {
        currentState,
        currentIndex: currentQIndexRef.current,
        targetQuestionIndex: continuationTargetQuestionIndexRef.current,
        questionToReplay: questionToReplayIndexRef.current,
        isContinuation: isBargeInContinuationRef.current
      });

      setAiSpeaking(false);
      transitionLockRef.current = false;

      // Interrupted during greeting
      if (currentState === INTERVIEW_STATES.GREETING_SPEAKING || currentState === INTERVIEW_STATES.GREETING_ACK) {
        trace("state_transition", { from: currentState, to: "GREETING_LISTENING" });
        setInterviewState(INTERVIEW_STATES.GREETING_LISTENING);
        chunksRef.current = [];
        setLiveTranscript(text || "");
        liveTranscriptRef.current = text || "";
        setIsRecording(true);
        startAnswerRecordingRef.current?.(text || "", true);

        // Safety: if the candidate just made a barge-in noise but goes quiet,
        // do not let the greeting stall. Advance to Q1 after a short window.
        if (greetingTimeoutRef.current) clearTimeout(greetingTimeoutRef.current);
        greetingTimeoutRef.current = setTimeout(() => {
          transitionFromGreetingToQ1Ref.current?.();
        }, 4000);
        return;
      }

      // Interrupted during closing
      if (currentState === INTERVIEW_STATES.CLOSING_SPEAKING) {
        setInterviewState(INTERVIEW_STATES.COMPLETED);
        stopCamera();
        navigate("/interview/processing", { state: { sessionId } });
        return;
      }

      // Interrupted during question, transition, or other speaking states
      trace("state_transition", { from: currentState, to: "LISTENING" });
      setInterviewState(INTERVIEW_STATES.LISTENING);
      vad.startSession?.();

      if (text) {
        const intent = classifyInterruption(text);
        trace("midquestion_interruption_text", { text, intent });
        const targetIdx = continuationTargetQuestionIndexRef.current;
        const existingForTarget = (isBargeInContinuationRef.current && targetIdx !== null)
          ? (questionTranscriptsRef.current[targetIdx] || questionsRef.current[targetIdx]?.voiceAnalysis?.transcript || questionsRef.current[targetIdx]?.transcript || "")
          : "";
        const mergedLive = isBargeInContinuationRef.current && existingForTarget
          ? mergeTranscripts(existingForTarget, text)
          : text;
        setLiveTranscript(mergedLive);
        liveTranscriptRef.current = mergedLive;
      }

      startAnswerRecordingRef.current?.(text || "", true);
    },
    [sessionId, navigate]
  );

  // --------------------------------------------------------------------------
  // Barge-In Candidate Handler (RMS triggered, awaiting STT confirmation)
  // --------------------------------------------------------------------------
  const handleBargeInCandidate = useCallback(({ source, rms, noiseFloor, onsetTime, timestamp, spectral }) => {
    const currentState = interviewStateRef.current;
    trace("bargein_candidate", { currentState, rms, spectral });

    // Clear any existing recovery timeout
    if (bargeInRecoveryTimeoutRef.current) {
      clearTimeout(bargeInRecoveryTimeoutRef.current);
      bargeInRecoveryTimeoutRef.current = null;
    }

    // If we're in a speaking state, cancel TTS and prepare for potential answer
    if (isAISpeakingState(currentState)) {
      try {
        cancelTTS();
      } catch (e) {}
      
      // Increment generation ID so the pending TTS promise chain is cancelled
      speechGenerationIdRef.current += 1;
      trace("generation_id_incremented", { newGenId: speechGenerationIdRef.current });
      
      // Determine which question was interrupted
      let interruptedIndex = null;
      if (currentState === INTERVIEW_STATES.AI_SPEAKING) {
        interruptedIndex = currentQIndexRef.current;
      } else if (currentState === INTERVIEW_STATES.TRANSITION_SPEAKING) {
        interruptedIndex = Math.max(0, currentQIndexRef.current - 1);
      }
      questionToReplayIndexRef.current = interruptedIndex;
      isBargeInContinuationRef.current = interruptedIndex !== null;
      
      trace("bargein_candidate_interrupted_index", { interruptedIndex, currentState });
      
      // We don't change state yet - we wait for STT confirmation
      // The candidate ref in VAD tracks this state
    }
  }, []);

  // --------------------------------------------------------------------------
  // Barge-In Recovery Mechanism
  // --------------------------------------------------------------------------
  // If a barge-in candidate expires without STT confirmation, replay the question
  const bargeInRecoveryTimeoutRef = useRef(null);

  const triggerBargeInRecovery = useCallback(() => {
    const currentState = interviewStateRef.current;
    trace("bargein_recovery_triggered", { currentState });

    // Only recover if we're in a state where a question was interrupted
    if (
      currentState === INTERVIEW_STATES.LISTENING ||
      currentState === INTERVIEW_STATES.AI_SPEAKING ||
      currentState === INTERVIEW_STATES.TRANSITION_SPEAKING ||
      currentState === INTERVIEW_STATES.GREETING_ACK ||
      currentState === INTERVIEW_STATES.GREETING_SPEAKING
    ) {
      trace("bargein_recovery_executing", { currentState });

      // Add 1.5s delay before replay as per requirement
      if (bargeInRecoveryTimeoutRef.current) {
        clearTimeout(bargeInRecoveryTimeoutRef.current);
      }
      bargeInRecoveryTimeoutRef.current = setTimeout(() => {
        trace("bargein_recovery_replay", { currentState });

        // Clear any pending recording
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

        // Reset recording state
        setIsRecording(false);
        chunksRef.current = [];
        setLiveTranscript("");
        liveTranscriptRef.current = "";
        clearInterval(timerRef.current);

        // Determine what to replay based on state
        // If we have an interrupted question index, replay that specific question
        const interruptedIndex = questionToReplayIndexRef.current;
        if (interruptedIndex !== null) {
          trace("bargein_recovery_replay_question", { interruptedIndex });
          playQuestionTTSRef.current?.(interruptedIndex);
        } else if (currentState === INTERVIEW_STATES.GREETING_SPEAKING || currentState === INTERVIEW_STATES.GREETING_ACK) {
          // Replay greeting ack then question
          transitionFromGreetingToQ1Ref.current?.();
        } else if (currentState === INTERVIEW_STATES.TRANSITION_SPEAKING) {
          // Replay transition then question
          executeQuestionTransitionRef.current?.(lastSpokenTransitionIndexRef.current);
        } else {
          // Replay current question
          playQuestionTTSRef.current?.(currentQIndexRef.current);
        }
        // Clear the interrupted index after recovery
        questionToReplayIndexRef.current = null;
      }, 1500); // 1.5 second delay before replay
    }
  }, []);

  // --------------------------------------------------------------------------
  // Answer Completion Trigger
  // --------------------------------------------------------------------------
  const triggerAnswerCompletion = useCallback((source = "auto") => {
    const state = interviewStateRef.current;
    if (
      state === INTERVIEW_STATES.PROCESSING_ANSWER ||
      state === INTERVIEW_STATES.ADVANCING ||
      state === INTERVIEW_STATES.COMPLETED ||
      state === INTERVIEW_STATES.TRANSITION_SPEAKING ||
      state === INTERVIEW_STATES.CLOSING_SPEAKING
    ) {
      trace("answer_completion_dropped", { source, state });
      return;
    }

    trace("answer_completion_triggered", { source, state });
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
  }, []);

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
    speechThreshold: 0.022,
    bargeInThreshold: 0.026,
    bargeInSustainMs: 200,
    silenceThresholdMs: 1800,
    thinkingGracePeriodMs: 2800,
    minAnswerDurationMs: 800,
    minWordCount: 1,
    ttsStartTime,
    onSpeechStart: () => {
      // User is actively speaking — cancel any inactivity timeout so they are never interrupted
      if (interviewStateRef.current === INTERVIEW_STATES.GREETING_LISTENING) {
        if (greetingTimeoutRef.current) {
          clearTimeout(greetingTimeoutRef.current);
          greetingTimeoutRef.current = null;
        }
      }
    },
    onAnswerComplete: ({ reason, silenceDuration, wordCount, duration }) => {
      if (interviewStateRef.current === INTERVIEW_STATES.GREETING_LISTENING) {
        console.log(`[GreetingEngine] Greeting response detected (${wordCount} words, duration ${duration}ms). Transitioning to Question 1.`);
        if (greetingTimeoutRef.current) {
          clearTimeout(greetingTimeoutRef.current);
          greetingTimeoutRef.current = null;
        }
        transitionFromGreetingToQ1Ref.current?.();
      } else if (interviewStateRef.current === INTERVIEW_STATES.LISTENING) {
        console.log(`[VAD Engine] Auto-completing answer: ${reason} (silence: ${silenceDuration}ms, words: ${wordCount}, duration: ${duration}ms)`);
        triggerAnswerCompletion(`vad_${reason}`);
      }
    },
    onBargeIn: handleBargeInInterruption,
  });

  const notifyTranscriptUpdateRef = useRef(vad.notifyTranscriptUpdate);
  notifyTranscriptUpdateRef.current = vad.notifyTranscriptUpdate;

  resetBargeInEngineRef.current = vad.resetBargeInEngine;

  // Forward live transcript updates to VAD for barge-in detection
  useEffect(() => {
    if (liveTranscript) {
      notifyTranscriptUpdateRef.current?.(liveTranscript);
    }
  }, [liveTranscript]);

  // --------------------------------------------------------------------------
  // Handle Answer Upload & Automatic Progression
  // --------------------------------------------------------------------------
  const handleUpload = async () => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploading(true);

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      
      // If this is a continuation of previous question, associate with continuation target
      const isContinuation = isBargeInContinuationRef.current;
      const questionIndex = (isContinuation && continuationTargetQuestionIndexRef.current !== null)
        ? continuationTargetQuestionIndexRef.current
        : currentQIndexRef.current;
      const currentQ = questionsRef.current[questionIndex];

      // Retrieve any existing stored transcript for this question
      const existingTranscript = questionTranscriptsRef.current[questionIndex] ||
        currentQ?.voiceAnalysis?.transcript ||
        currentQ?.transcript ||
        "";

      // Merge current live transcript with existing transcript to prevent truncation
      const currentAnswerText = isContinuation && existingTranscript
        ? mergeTranscripts(existingTranscript, liveTranscriptRef.current || "")
        : (liveTranscriptRef.current || "");

      // Update question transcripts store with the consolidated text
      questionTranscriptsRef.current[questionIndex] = currentAnswerText;

      if (!currentQ) {
        console.warn("[InterviewEngine] No current question found during upload");
        return;
      }

      trace("handleUpload", {
        questionIndex,
        isContinuation,
        targetQuestionId: currentQ.questionId,
        questionToReplay: questionToReplayIndexRef.current,
        currentAnswerTextPreview: currentAnswerText.slice(0, 45)
      });

      // 1. Dispatch Video Upload & Analysis in the Background (Non-blocking)
      const uploadPayload = activeFollowUpRef.current
        ? {
            isFollowUp: true,
            turn: followUpTurn,
            questionText: activeFollowUpRef.current.questionText,
            clientTranscript: currentAnswerText,
          }
        : {
            questionIndex,
            questionText: currentQ.questionText,
            clientTranscript: currentAnswerText,
            isContinuation,
          };

      interviewApi
        .uploadAnswer(sessionId, currentQ.questionId, blob, uploadPayload)
        .catch((err) => console.error("[InterviewEngine] Background upload error:", err));

      // 2. Dispatch Live STT Telemetry in Background
      try {
        const fd = new FormData();
        fd.append("audio", blob, "answer.webm");
        fd.append("sessionId", sessionId);
        fd.append("questionId", activeFollowUpRef.current ? `${currentQ.questionId}-followup-${followUpTurn}` : currentQ.questionId);
        fd.append("questionIndex", String(questionIndex));
        fd.append("questionText", currentQ.questionText || "");
        fd.append("clientTranscript", currentAnswerText);
        if (isContinuation) {
          fd.append("isContinuation", "true");
        }
        if (currentQ.expectedKeywords) {
          fd.append("keywords", JSON.stringify(currentQ.expectedKeywords));
        }
        analysisApi.transcribe(fd).catch((err) => console.error("Transcription error:", err));
      } catch (err) {
        console.error("Transcription setup error:", err);
      }

      // 3. Dynamic Interactive Follow-Up Logic (Project & Technical Questions)
      const isFollowUpEligible =
        (currentQ.track === "project" || currentQ.projectContext != null || currentQ.track === "subject") &&
        currentQIndexRef.current > 0;

      if (isFollowUpEligible && followUpTurn < 2 && currentAnswerText.trim().split(/\s+/).length >= 4) {
        setIsFollowUpLoading(true);
        try {
          const currentFollowUpList = [
            ...previousFollowUps,
            {
              question: activeFollowUpRef.current?.questionText || currentQ.questionText,
              answer: currentAnswerText,
            },
          ];

          const res = await sessionsApi.generateProjectFollowUp(sessionId, {
            questionId: currentQ.questionId,
            questionText: activeFollowUpRef.current?.questionText || currentQ.questionText,
            answerText: currentAnswerText,
            projectContext: currentQ.projectContext || { title: currentQ.questionText },
            turnCount: followUpTurn + 1,
            previousFollowUps: currentFollowUpList,
          });

          if (res.data?.data?.hasFollowUp && res.data?.data?.followUp?.questionText) {
            const nextFollowUp = res.data.data.followUp;
            setPreviousFollowUps(currentFollowUpList);
            setFollowUpTurn((prev) => prev + 1);
            setActiveFollowUp(nextFollowUp);
            activeFollowUpRef.current = nextFollowUp;
            setIsFollowUpLoading(false);
            setUploading(false);
            isUploadingRef.current = false;
            chunksRef.current = [];
            setLiveTranscript("");
            liveTranscriptRef.current = "";
            // Pre-synthesize the follow-up NOW so playback starts without a
            // multi-second synthesis gap after the LLM latency already paid.
            if (nextFollowUp.questionText) preSynthesize(nextFollowUp.questionText);
            playQuestionTTSRef.current?.(currentQIndexRef.current);
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
      activeFollowUpRef.current = null;
      setPreviousFollowUps([]);

      // Capture continuation parameters before resetting
      const wasContinuation = isBargeInContinuationRef.current;
      const replayIndex = questionToReplayIndexRef.current;

      // Clear continuation state
      isBargeInContinuationRef.current = false;
      continuationTargetQuestionIndexRef.current = null;
      questionToReplayIndexRef.current = null;

      if (wasContinuation && replayIndex !== null) {
        // Candidate finished answering continuation for preceding question.
        // Replay Question 2 with an acknowledgment prefix in a single seamless utterance.
        trace("bargein_continuation_complete", { replayIndex });

        const acknowledgments = ["Okay, got it.", "Alright, understood.", "Got it, thanks."];
        const acknowledgment = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

        chunksRef.current = [];
        setLiveTranscript("");
        liveTranscriptRef.current = "";

        // Single seamless conversational handoff: "Okay, got it. [Question 2 Text]"
        playQuestionTTSRef.current?.(replayIndex, acknowledgment);
      } else {
        // Normal flow - proceed to next question or closing
        setFollowUpTurn(0);
        setActiveFollowUp(null);
        activeFollowUpRef.current = null;
        setPreviousFollowUps([]);

        const nextIndex = currentQIndexRef.current + 1;

        if (nextIndex < questionsRef.current.length) {
          trace("auto_transition_next_question", { nextIndex: nextIndex + 1 });
          executeQuestionTransitionRef.current?.(nextIndex);
        } else {
          trace("all_questions_completed", { totalQuestions: questionsRef.current.length });
          executeNaturalClosingRef.current?.();
        }
      }
    } catch (uploadErr) {
      console.error("[InterviewEngine] Error during answer upload:", uploadErr);
    } finally {
      setUploading(false);
      isUploadingRef.current = false;
    }
  };

  // --------------------------------------------------------------------------
  // Session Initialization & Welcome Greeting Execution
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      try {
        const chosenGreeting = getRandomItem(INTERVIEW_GREETINGS);
        setGreetingText(chosenGreeting);

        // 1. Immediately kick off background audio pre-synthesis for greeting & standard phrases
        // Greeting goes FIRST so it wins the synthesis queue; the remaining room
        // phrases follow staggered. Closing statements are deferred entirely -
        // they are not needed until the interview ends.
        preSynthesize(chosenGreeting);
        setTimeout(() => {
          [
            ...GREETING_ACKNOWLEDGEMENTS,
            ...QUESTION_TRANSITIONS,
          ].forEach((phrase) => preSynthesize(phrase));
        }, 400);

        // 2. Concurrently initialize camera hardware, fetch session data, and generate questions
        const [stream, sessionRes, qRes] = await Promise.all([
          startCamera(),
          sessionsApi.get(sessionId),
          interviewApi.generateQuestions(sessionId),
        ]);
        if (isCancelled) return;

        const fetchedSession = sessionRes?.data?.data?.session;
        if (!fetchedSession) {
          setError("Session not found");
          setLoading(false);
          return;
        }

        setSession(fetchedSession);

        const fetchedQuestions =
          qRes?.data?.data?.questions ||
          qRes?.data?.data?.session?.answers ||
          fetchedSession?.answers ||
          [];

        if (fetchedQuestions.length === 0) {
          setError("No interview questions available for this session.");
          setLoading(false);
          return;
        }

        setQuestions(fetchedQuestions);
        questionsRef.current = fetchedQuestions;
        // Pre-populate question transcript ref with any existing answers
        fetchedQuestions.forEach((q, idx) => {
          const t = q.voiceAnalysis?.transcript || q.transcript || "";
          if (t) questionTranscriptsRef.current[idx] = t;
        });
        setLoading(false);

        // 3. Proactively pre-synthesize Question 0 (and Question 1) immediately in background
        if (fetchedQuestions[0]?.questionText) preSynthesize(fetchedQuestions[0].questionText);
        if (fetchedQuestions[1]?.questionText) preSynthesize(fetchedQuestions[1].questionText);

        // 4. Start Greeting Delivery immediately (audio is already cached in memory)
        const currentGenId = ++speechGenerationIdRef.current;
        setInterviewState(INTERVIEW_STATES.GREETING_SPEAKING);
        setAiSpeaking(true);
        ttsStartTimeRef.current = Date.now();
        setTtsStartTime(Date.now());

        const startGreetingListening = () => {
          if (isCancelled || currentGenId !== speechGenerationIdRef.current) return;
          setAiSpeaking(false);
          setInterviewState(INTERVIEW_STATES.GREETING_LISTENING);
          chunksRef.current = [];
          setLiveTranscript("");
          liveTranscriptRef.current = "";
          setIsRecording(true);

          vad.startSession?.();
          startAnswerRecordingRef.current?.("", false);

          // Greeting inactivity fallback: 4.5 seconds if candidate stays silent
          greetingTimeoutRef.current = setTimeout(() => {
            if (!isCancelled) {
              trace("greeting_timeout_fallback", { reason: "max_greeting_time_reached" });
              transitionFromGreetingToQ1Ref.current?.();
            }
          }, 4500);
        };

        speak(chosenGreeting)
          .then(startGreetingListening)
          .catch(startGreetingListening);
      } catch (err) {
        if (isCancelled) return;
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        } else if (err.response?.status === 404) {
          setError("Interview session not found");
        } else {
          setError(err.response?.data?.error || "Failed to load interview session");
        }
        setLoading(false);
      }
    };

    init();

    return () => {
      isCancelled = true;
      stopCamera();
      clearInterval(timerRef.current);
      if (greetingTimeoutRef.current) clearTimeout(greetingTimeoutRef.current);
      cancelTTS();
    };
  }, [sessionId, navigate]);

  // Bind video element whenever mediaStream is ready
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

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
                {currentQ.isWarmup === true || currentQ.answerType === "warmup"
                  ? "Warm-up / Introduction"
                  : currentQ.track === "project"
                    ? "Project Track"
                    : currentQ.track === "hr"
                      ? "HR Track"
                      : "Technical Subject"}
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
                  "{interviewState === INTERVIEW_STATES.INITIALIZING || interviewState === INTERVIEW_STATES.GREETING_SPEAKING || interviewState === INTERVIEW_STATES.GREETING_LISTENING || interviewState === INTERVIEW_STATES.GREETING_ACK ? greetingText : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? closingText : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING ? transitionText : displayedQuestionText}"
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
                        ? vad.isSpeaking
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
                    audioStream={mediaStream}
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
                        : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING
                        ? "(Finalizing session results...)"
                        : interviewState === INTERVIEW_STATES.TRANSITION_SPEAKING
                        ? "(Transitioning to next question...)"
                        : isRecording
                        ? "(Speak your answer naturally...)"
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
                  <div className="space-y-2 w-full">
                    <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Listening: Speak naturally
                    </div>
                    <div className="flex justify-center items-center px-1 pt-1">
                      <button
                        onClick={() => transitionFromGreetingToQ1Ref.current?.()}
                        className="text-[11px] font-mono text-[#6E6D68] hover:text-[#1D5DFF] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>→ Begin Question 1</span>
                      </button>
                    </div>
                  </div>
                ) : interviewState === INTERVIEW_STATES.CLOSING_SPEAKING ? (
                  <div className="w-full py-3 bg-[#161615] text-emerald-400 rounded-xl font-mono text-xs tracking-wider uppercase border border-emerald-500/40 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Interview Concluded — Generating Report
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
