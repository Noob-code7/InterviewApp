import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Production-Grade Voice Activity Detector (VAD) with Stable AudioContext.
 * Uses persistent refs for callbacks and configuration to prevent React re-render
 * dependency cascades from tearing down the Web Audio API loop or resetting timing state.
 */
export function useVoiceActivityDetector({
  stream,
  enabled = true,
  bargeInEnabled = false,
  speechThreshold = 0.025,
  bargeInThreshold = 0.038,
  bargeInSustainMs = 120,
  silenceThresholdMs = 2200,
  thinkingGracePeriodMs = 4000,
  minAnswerDurationMs = 3000,
  minWordCount = 4,
  onSpeechStart,
  onSpeechEnd,
  onAnswerComplete,
  onBargeIn,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentRms, setCurrentRms] = useState(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animFrameRef = useRef(null);

  // Persistent Callback & Config Refs (Prevents useEffect teardown on re-render)
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const bargeInEnabledRef = useRef(bargeInEnabled);
  bargeInEnabledRef.current = bargeInEnabled;

  const speechThresholdRef = useRef(speechThreshold);
  speechThresholdRef.current = speechThreshold;

  const bargeInThresholdRef = useRef(bargeInThreshold);
  bargeInThresholdRef.current = bargeInThreshold;

  const bargeInSustainMsRef = useRef(bargeInSustainMs);
  bargeInSustainMsRef.current = bargeInSustainMs;

  const silenceThresholdMsRef = useRef(silenceThresholdMs);
  silenceThresholdMsRef.current = silenceThresholdMs;

  const thinkingGracePeriodMsRef = useRef(thinkingGracePeriodMs);
  thinkingGracePeriodMsRef.current = thinkingGracePeriodMs;

  const minAnswerDurationMsRef = useRef(minAnswerDurationMs);
  minAnswerDurationMsRef.current = minAnswerDurationMs;

  const minWordCountRef = useRef(minWordCount);
  minWordCountRef.current = minWordCount;

  const onSpeechStartRef = useRef(onSpeechStart);
  onSpeechStartRef.current = onSpeechStart;

  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;

  const onAnswerCompleteRef = useRef(onAnswerComplete);
  onAnswerCompleteRef.current = onAnswerComplete;

  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;

  // Persistent VAD Timing & State Refs Across Re-renders
  const recordingStartTimeRef = useRef(0);
  const lastSpeechTimeRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastTranscriptTextRef = useRef("");
  const lastTranscriptChangeTimeRef = useRef(0);
  const bargeInOnsetRef = useRef(0);
  const hasFiredBargeInRef = useRef(false);
  const hasFiredCompletionRef = useRef(false);

  // Update transcript stability trackers & STT-backed barge-in
  const notifyTranscriptUpdate = useCallback((newTranscript) => {
    const text = (newTranscript || "").trim();
    if (text !== lastTranscriptTextRef.current) {
      lastTranscriptTextRef.current = text;
      const now = Date.now();
      lastTranscriptChangeTimeRef.current = now;
      lastSpeechTimeRef.current = now;

      // STT-backed barge-in
      if (bargeInEnabledRef.current && !hasFiredBargeInRef.current && text.length > 0) {
        hasFiredBargeInRef.current = true;
        const perfNow = performance.now();
        console.log("[VAD] Web Speech detected candidate speech during TTS -> Barge-In Triggered");
        if (onBargeInRef.current) {
          onBargeInRef.current({ source: "stt_interim", text, onsetTime: perfNow, timestamp: perfNow });
        }
      }

      if (!hasSpokenRef.current && text.length > 0) {
        hasSpokenRef.current = true;
        if (onSpeechStartRef.current) onSpeechStartRef.current();
      }
    }
  }, []);

  // Explicit Session Lifecycle Managers
  const startSession = useCallback(() => {
    const now = Date.now();
    recordingStartTimeRef.current = now;
    lastSpeechTimeRef.current = now;
    lastTranscriptChangeTimeRef.current = now;
    lastTranscriptTextRef.current = "";
    hasSpokenRef.current = false;
    isSpeakingRef.current = false;
    bargeInOnsetRef.current = 0;
    hasFiredBargeInRef.current = false;
    hasFiredCompletionRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Whenever enabled shifts from false -> true (e.g. entering LISTENING mode), start a fresh session without tearing down AudioContext
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    if (!prevEnabledRef.current && enabled) {
      console.log("[VAD Engine] Entering active listening session -> Resetting VAD session timers.");
      startSession();
    }
    prevEnabledRef.current = enabled;
  }, [enabled, startSession]);

  // Audio Context & Analyser Loop (DEPENDS ONLY ON stream)
  useEffect(() => {
    if (!stream) return;

    let isAudioLoopActive = true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      startSession();

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!isAudioLoopActive || !analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArray);

        // Compute RMS amplitude
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        setCurrentRms(rms);

        const now = Date.now();
        const perfNow = performance.now();

        // 1. BARGE-IN DETECTION (Active while AI is speaking)
        if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
          if (rms >= bargeInThresholdRef.current) {
            if (bargeInOnsetRef.current === 0) {
              bargeInOnsetRef.current = perfNow;
            } else if (perfNow - bargeInOnsetRef.current >= bargeInSustainMsRef.current) {
              hasFiredBargeInRef.current = true;
              const onsetTime = bargeInOnsetRef.current;
              console.log(`[VAD] Sustained candidate voice detected during TTS (RMS=${rms.toFixed(3)}) -> Triggering Barge-In`);
              if (onBargeInRef.current) {
                onBargeInRef.current({ source: "vad_rms", rms, onsetTime, timestamp: perfNow });
              }
            }
          } else {
            bargeInOnsetRef.current = 0;
          }
        }

        // 2. ANSWER COMPLETION DETECTION (Active while candidate is answering)
        if (enabledRef.current && !hasFiredCompletionRef.current) {
          const duration = now - recordingStartTimeRef.current;
          const words = lastTranscriptTextRef.current.split(/\s+/).filter(Boolean);
          const wordCount = words.length;

          if (rms >= speechThresholdRef.current) {
            lastSpeechTimeRef.current = now;
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              hasSpokenRef.current = true;
              setIsSpeaking(true);
              if (onSpeechStartRef.current) onSpeechStartRef.current();
            }
          } else {
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              if (onSpeechEndRef.current) onSpeechEndRef.current();
            }

            const silenceDuration = now - lastSpeechTimeRef.current;
            const transcriptSilenceDuration = now - lastTranscriptChangeTimeRef.current;

            // Standard Completion: 4+ words, 3s duration, 2.2s silence
            if (hasSpokenRef.current && wordCount >= minWordCountRef.current && duration >= minAnswerDurationMsRef.current) {
              if (silenceDuration >= silenceThresholdMsRef.current && transcriptSilenceDuration >= silenceThresholdMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(`[VAD] Answer completion detected: silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms`);
                if (onAnswerCompleteRef.current) {
                  onAnswerCompleteRef.current({ reason: "silence_stable", silenceDuration, wordCount, duration });
                }
                return;
              }
            }
            // Short Answer / Thinking Pause Grace Period Completion
            else if (hasSpokenRef.current && wordCount > 0) {
              if (silenceDuration >= thinkingGracePeriodMsRef.current && transcriptSilenceDuration >= thinkingGracePeriodMsRef.current && duration >= minAnswerDurationMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(`[VAD] Short answer completion detected after thinking grace period: silence=${silenceDuration}ms, words=${wordCount}`);
                if (onAnswerCompleteRef.current) {
                  onAnswerCompleteRef.current({ reason: "grace_period_complete", silenceDuration, wordCount, duration });
                }
                return;
              }
            }
          }
        }

        if (isAudioLoopActive) {
          animFrameRef.current = requestAnimationFrame(checkAudioLevel);
        }
      };

      animFrameRef.current = requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn("[VAD] Failed to initialize Web Audio Analyser:", err);
    }

    return () => {
      isAudioLoopActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, [stream, startSession]);

  return {
    isSpeaking,
    currentRms,
    notifyTranscriptUpdate,
    startSession,
  };
}
