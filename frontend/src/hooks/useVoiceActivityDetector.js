import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Production-Grade Voice Activity Detector (VAD) with Adaptive Noise Floor & Resilient AudioContext Lifecycle.
 * - Dynamically tracks ambient noise floor (fans, AC, laptop hum, mic static).
 * - Multi-question persistence (stays attached to active MediaStream across all questions).
 * - Auto-resumes suspended AudioContext state on Windows/Chrome.
 * - Multi-signal answer completion (verbal 2.2s, short-answer 3.5s grace, pure acoustic fallback).
 * - Throttles React state updates (~12Hz) to prevent 60fps parent re-renders.
 */
export function useVoiceActivityDetector({
  stream,
  enabled = true,
  bargeInEnabled = false,
  speechThreshold = 0.030,
  bargeInThreshold = 0.055,
  bargeInSustainMs = 260,
  silenceThresholdMs = 2200,
  thinkingGracePeriodMs = 4000,
  minAnswerDurationMs = 3000,
  minWordCount = 4,
  ttsStartTime = 0,
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

  // Persistent Callback & Config Refs
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

  const ttsStartTimeRef = useRef(ttsStartTime);
  ttsStartTimeRef.current = ttsStartTime;

  const onSpeechStartRef = useRef(onSpeechStart);
  onSpeechStartRef.current = onSpeechStart;

  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;

  const onAnswerCompleteRef = useRef(onAnswerComplete);
  onAnswerCompleteRef.current = onAnswerComplete;

  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;

  // Adaptive Noise Floor Tracking Refs
  const noiseFloorRef = useRef(0.018);

  // Barge-In Sustained Energy Tracking Refs
  const bargeInOnsetRef = useRef(0);
  const bargeInConsecutiveFramesRef = useRef(0);
  const hasFiredBargeInRef = useRef(false);

  // VAD Answer Timing & State Refs
  const recordingStartTimeRef = useRef(0);
  const lastSpeechTimeRef = useRef(0);
  const totalSpokenDurationMsRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastTranscriptTextRef = useRef("");
  const lastTranscriptChangeTimeRef = useRef(0);
  const hasFiredCompletionRef = useRef(false);
  const lastRmsUiUpdateRef = useRef(0);

  // Feed live speech recognition transcript updates into tracker
  const notifyTranscriptUpdate = useCallback((newTranscript) => {
    const text = (newTranscript || "").trim();
    if (text !== lastTranscriptTextRef.current) {
      lastTranscriptTextRef.current = text;
      const now = Date.now();
      const perfNow = performance.now();
      lastTranscriptChangeTimeRef.current = now;
      lastSpeechTimeRef.current = now;

      // Safe STT-Backed Barge-In
      if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
        const words = text.split(/\s+/).filter(Boolean);
        const ttsElapsed = Date.now() - ttsStartTimeRef.current;
        if (words.length >= 2 && ttsElapsed > 350) {
          hasFiredBargeInRef.current = true;
          console.log(`[VAD] Confirmed STT speech during TTS ("${text}") -> Triggering Barge-In`);
          if (onBargeInRef.current) {
            onBargeInRef.current({ source: "stt_interim", text, onsetTime: perfNow, timestamp: perfNow });
          }
        }
      }

      if (!hasSpokenRef.current && text.length > 0) {
        hasSpokenRef.current = true;
        if (onSpeechStartRef.current) onSpeechStartRef.current();
      }
    }
  }, []);

  // Explicit session start / reset
  const startSession = useCallback(() => {
    const now = Date.now();
    recordingStartTimeRef.current = now;
    lastSpeechTimeRef.current = now;
    totalSpokenDurationMsRef.current = 0;
    lastTranscriptChangeTimeRef.current = now;
    lastTranscriptTextRef.current = "";
    hasSpokenRef.current = false;
    isSpeakingRef.current = false;
    bargeInOnsetRef.current = 0;
    bargeInConsecutiveFramesRef.current = 0;
    hasFiredBargeInRef.current = false;
    hasFiredCompletionRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Reset timers when entering listening mode without tearing down AudioContext
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    if (!prevEnabledRef.current && enabled) {
      startSession();
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    }
    prevEnabledRef.current = enabled;
  }, [enabled, startSession]);

  // Reset barge-in flags when entering barge-in mode
  const prevBargeInRef = useRef(bargeInEnabled);
  useEffect(() => {
    if (!prevBargeInRef.current && bargeInEnabled) {
      hasFiredBargeInRef.current = false;
      bargeInOnsetRef.current = 0;
      bargeInConsecutiveFramesRef.current = 0;
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    }
    prevBargeInRef.current = bargeInEnabled;
  }, [bargeInEnabled]);

  // Main AudioContext & Analyser Loop (Lifecycle attached stably to MediaStream)
  useEffect(() => {
    if (!stream) return;

    let isAudioLoopActive = true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      startSession();

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!isAudioLoopActive || !analyserRef.current) return;

        // Auto-resume if suspended by browser
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch(() => {});
        }

        analyserRef.current.getByteTimeDomainData(dataArray);

        // Compute Root-Mean-Square (RMS) amplitude
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        const now = Date.now();
        const perfNow = performance.now();

        // Throttle UI RMS state updates to ~12Hz (every 80ms)
        if (perfNow - lastRmsUiUpdateRef.current > 80) {
          lastRmsUiUpdateRef.current = perfNow;
          setCurrentRms(rms);
        }

        // --- ADAPTIVE NOISE FLOOR TRACKING ---
        if (rms < speechThresholdRef.current * 1.5) {
          noiseFloorRef.current = Math.max(0.008, Math.min(0.080, noiseFloorRef.current * 0.992 + rms * 0.008));
        }

        const effectiveBargeInThreshold = Math.max(
          bargeInThresholdRef.current,
          noiseFloorRef.current * 2.6
        );
        const effectiveSpeechThreshold = Math.max(
          speechThresholdRef.current,
          noiseFloorRef.current * 1.6
        );

        // --- 1. ROBUST BARGE-IN DETECTION ---
        if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
          const ttsElapsed = now - ttsStartTimeRef.current;

          if (ttsElapsed > 350) {
            if (rms >= effectiveBargeInThreshold) {
              bargeInConsecutiveFramesRef.current += 1;
              if (bargeInOnsetRef.current === 0) {
                bargeInOnsetRef.current = perfNow;
              } else {
                const sustainedMs = perfNow - bargeInOnsetRef.current;
                if (sustainedMs >= bargeInSustainMsRef.current && bargeInConsecutiveFramesRef.current >= 12) {
                  hasFiredBargeInRef.current = true;
                  const onsetTime = bargeInOnsetRef.current;
                  console.log(
                    `[VAD] Sustained vocal barge-in verified (RMS=${rms.toFixed(3)}, NoiseFloor=${noiseFloorRef.current.toFixed(3)}, Duration=${sustainedMs.toFixed(0)}ms, Frames=${bargeInConsecutiveFramesRef.current})`
                  );
                  if (onBargeInRef.current) {
                    onBargeInRef.current({
                      source: "vad_rms",
                      rms,
                      noiseFloor: noiseFloorRef.current,
                      onsetTime,
                      timestamp: perfNow,
                    });
                  }
                  return;
                }
              }
            } else {
              bargeInConsecutiveFramesRef.current = Math.max(0, bargeInConsecutiveFramesRef.current - 2);
              if (bargeInConsecutiveFramesRef.current === 0) {
                bargeInOnsetRef.current = 0;
              }
            }
          }
        }

        // --- 2. ANSWER COMPLETION DETECTION ---
        if (enabledRef.current && !hasFiredCompletionRef.current) {
          const duration = now - recordingStartTimeRef.current;
          const words = lastTranscriptTextRef.current.split(/\s+/).filter(Boolean);
          const wordCount = words.length;

          if (rms >= effectiveSpeechThreshold) {
            lastSpeechTimeRef.current = now;
            totalSpokenDurationMsRef.current += 16;

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

            // Condition A: Standard Verbal Answer (4+ words, 3s duration, 2.2s silence)
            if (
              hasSpokenRef.current &&
              wordCount >= minWordCountRef.current &&
              duration >= minAnswerDurationMsRef.current
            ) {
              if (silenceDuration >= silenceThresholdMsRef.current && transcriptSilenceDuration >= silenceThresholdMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD] Standard answer completion detected (silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms)`
                );
                if (onAnswerCompleteRef.current) {
                  onAnswerCompleteRef.current({
                    reason: "silence_stable",
                    silenceDuration,
                    wordCount,
                    duration,
                  });
                }
                return;
              }
            }
            // Condition B: Short Verbal Answer (1-3 words, 2.5s duration, 3.5s thinking grace)
            else if (hasSpokenRef.current && wordCount > 0 && duration >= 2500) {
              if (silenceDuration >= thinkingGracePeriodMsRef.current && transcriptSilenceDuration >= thinkingGracePeriodMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD] Short answer grace completion detected (silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms)`
                );
                if (onAnswerCompleteRef.current) {
                  onAnswerCompleteRef.current({
                    reason: "grace_period_complete",
                    silenceDuration,
                    wordCount,
                    duration,
                  });
                }
                return;
              }
            }
            // Condition C: Pure Acoustic Fallback (Audible speech for >1.5s, STT dropped words)
            else if (
              hasSpokenRef.current &&
              totalSpokenDurationMsRef.current >= 1500 &&
              duration >= 3500
            ) {
              if (silenceDuration >= 3000) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD] Acoustic fallback completion detected (silence=${silenceDuration}ms, spoken=${totalSpokenDurationMsRef.current}ms, words=${wordCount})`
                );
                if (onAnswerCompleteRef.current) {
                  onAnswerCompleteRef.current({
                    reason: "acoustic_silence_fallback",
                    silenceDuration,
                    wordCount,
                    duration,
                  });
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
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
    };
  }, [stream, startSession]);

  return {
    isSpeaking,
    currentRms,
    noiseFloor: noiseFloorRef.current,
    notifyTranscriptUpdate,
    startSession,
  };
}

export default useVoiceActivityDetector;
