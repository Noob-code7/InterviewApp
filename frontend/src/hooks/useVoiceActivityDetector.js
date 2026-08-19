import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Reliable Voice Activity Detector (VAD) with Barge-In Interruption Support.
 * Continuously computes Root-Mean-Square (RMS) amplitude and detects speech energy.
 */
export function useVoiceActivityDetector({
  stream,
  enabled = true,
  bargeInEnabled = false,
  speechThreshold = 0.025, // RMS threshold for human speech over background noise
  bargeInThreshold = 0.038, // Elevated threshold during TTS to reject speaker echo & background hum
  bargeInSustainMs = 120, // 120ms sustained speech for sub-150ms end-to-end barge-in latency
  silenceThresholdMs = 2200, // Standard silence duration after meaningful speech
  thinkingGracePeriodMs = 4000, // Extended grace period before candidate begins or during deep pauses
  minAnswerDurationMs = 3000, // Minimum recording time before silence cutoff can trigger
  minWordCount = 4, // Minimum words required for standard silence cutoff
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

  // VAD Timing Refs
  const recordingStartTimeRef = useRef(0);
  const lastSpeechTimeRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const lastTranscriptTextRef = useRef("");
  const lastTranscriptChangeTimeRef = useRef(0);
  const bargeInOnsetRef = useRef(0); // Exact timestamp when candidate speech onset was first detected
  const hasFiredBargeInRef = useRef(false);

  const isEnabledRef = useRef(enabled);
  isEnabledRef.current = enabled;
  const isBargeInEnabledRef = useRef(bargeInEnabled);
  isBargeInEnabledRef.current = bargeInEnabled;

  // Update transcript stability trackers & Web Speech-backed barge-in
  const notifyTranscriptUpdate = useCallback((newTranscript) => {
    const text = (newTranscript || "").trim();
    if (text !== lastTranscriptTextRef.current) {
      lastTranscriptTextRef.current = text;
      lastTranscriptChangeTimeRef.current = Date.now();
      lastSpeechTimeRef.current = Date.now();

      // If Web Speech recognizes text while barge-in is enabled, trigger immediately
      if (isBargeInEnabledRef.current && !hasFiredBargeInRef.current && text.length > 0) {
        hasFiredBargeInRef.current = true;
        const now = performance.now();
        console.log("[VAD] Web Speech detected candidate speech during TTS -> Barge-In Triggered");
        if (onBargeIn) onBargeIn({ source: "stt_interim", text, onsetTime: now, timestamp: now });
      }

      if (!hasSpokenRef.current && text.length > 0) {
        hasSpokenRef.current = true;
        if (onSpeechStart) onSpeechStart();
      }
    }
  }, [onBargeIn, onSpeechStart]);

  // Start / reset VAD session
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
    setIsSpeaking(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const stopSession = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if ((!enabled && !bargeInEnabled) || !stream) {
      stopSession();
      return;
    }

    hasFiredBargeInRef.current = false;
    bargeInOnsetRef.current = 0;

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
        if ((!isEnabledRef.current && !isBargeInEnabledRef.current) || !analyserRef.current) return;

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
        if (isBargeInEnabledRef.current && !hasFiredBargeInRef.current) {
          if (rms >= bargeInThreshold) {
            if (bargeInOnsetRef.current === 0) {
              bargeInOnsetRef.current = perfNow;
            } else if (perfNow - bargeInOnsetRef.current >= bargeInSustainMs) {
              hasFiredBargeInRef.current = true;
              const onsetTime = bargeInOnsetRef.current;
              console.log(`[VAD] Sustained candidate voice detected during TTS (RMS=${rms.toFixed(3)}, duration=${(perfNow - onsetTime).toFixed(1)}ms) -> Triggering Barge-In`);
              if (onBargeIn) onBargeIn({ source: "vad_rms", rms, onsetTime, timestamp: perfNow });
              return;
            }
          } else {
            // Reset onset tracker if audio drops below threshold
            bargeInOnsetRef.current = 0;
          }
        }

        // 2. ANSWER COMPLETION DETECTION (Active while Candidate is answering)
        if (isEnabledRef.current) {
          const duration = now - recordingStartTimeRef.current;
          const words = lastTranscriptTextRef.current.split(/\s+/).filter(Boolean);
          const wordCount = words.length;

          if (rms >= speechThreshold) {
            lastSpeechTimeRef.current = now;
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              hasSpokenRef.current = true;
              setIsSpeaking(true);
              if (onSpeechStart) onSpeechStart();
            }
          } else {
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              if (onSpeechEnd) onSpeechEnd();
            }

            const silenceDuration = now - lastSpeechTimeRef.current;
            const transcriptSilenceDuration = now - lastTranscriptChangeTimeRef.current;

            if (hasSpokenRef.current && wordCount >= minWordCount && duration >= minAnswerDurationMs) {
              if (silenceDuration >= silenceThresholdMs && transcriptSilenceDuration >= silenceThresholdMs) {
                console.log(`[VAD] Answer completion detected: silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms`);
                if (onAnswerComplete) onAnswerComplete({ reason: "silence_stable", silenceDuration, wordCount, duration });
                return;
              }
            } else if (hasSpokenRef.current && wordCount > 0) {
              if (silenceDuration >= thinkingGracePeriodMs && transcriptSilenceDuration >= thinkingGracePeriodMs && duration >= minAnswerDurationMs) {
                console.log(`[VAD] Short answer completion detected after thinking grace period: silence=${silenceDuration}ms, words=${wordCount}`);
                if (onAnswerComplete) onAnswerComplete({ reason: "grace_period_complete", silenceDuration, wordCount, duration });
                return;
              }
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      animFrameRef.current = requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn("[VAD] Failed to initialize Web Audio Analyser:", err);
    }

    return () => {
      stopSession();
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, [stream, enabled, bargeInEnabled, speechThreshold, bargeInThreshold, bargeInSustainMs, silenceThresholdMs, thinkingGracePeriodMs, minAnswerDurationMs, minWordCount, onSpeechStart, onSpeechEnd, onAnswerComplete, onBargeIn, startSession, stopSession]);

  return {
    isSpeaking,
    currentRms,
    notifyTranscriptUpdate,
    startSession,
    stopSession,
  };
}
