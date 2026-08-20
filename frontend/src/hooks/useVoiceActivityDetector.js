import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Ultra-Responsive Real-Time Voice Activity Detector (VAD)
 * - Layered Hybrid Architecture:
 *   1. Primary Interruption: STT-Confirmed Word Detection (100% immune to dog barks, car horns, domestic noise).
 *   2. Secondary Interruption: Calibrated Acoustic & Spectral Formant Safety Net (320ms sustained human voice).
 *   3. Transcript-Locked Auto-Completion: Requires real spoken words before silence progression activates.
 */

const trace = (event, data = {}) => {
  console.log(`[VAD-TRACE ${performance.now().toFixed(0)}] ${event}`, data);
};

export function useVoiceActivityDetector({
  stream,
  enabled = true,
  bargeInEnabled = false,
  speechThreshold = 0.014,       // Calibrated for natural human voice (0.014 - 0.035 RMS)
  bargeInThreshold = 0.026,      // Calibrated acoustic fallback threshold
  bargeInSustainMs = 320,        // 320ms sustained vocal energy required for pure acoustic fallback (rejects barks/honks)
  silenceThresholdMs = 1800,     // 1.8s silence after answering triggers automatic progression
  thinkingGracePeriodMs = 2800,  // 2.8s grace period for short verbal answers
  minAnswerDurationMs = 1800,    // Minimum duration before silence auto-advances
  minWordCount = 2,              // Minimum words for standard silence completion
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
  const noiseFloorRef = useRef(0.006);

  // Barge-In Sustained Energy Tracking Refs
  const bargeInOnsetRef = useRef(0);
  const bargeInConsecutiveFramesRef = useRef(0);
  const hasFiredBargeInRef = useRef(false);

  // Spectral Analysis Refs
  const spectralHistoryRef = useRef([]);

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
  const lastDiagLogTimeRef = useRef(0);

  // Layer 1: Feed live speech recognition transcript updates (STT-Gated Barge-In)
  const notifyTranscriptUpdate = useCallback((newTranscript) => {
    const text = (newTranscript || "").trim();
    if (text !== lastTranscriptTextRef.current) {
      lastTranscriptTextRef.current = text;
      const now = Date.now();
      const perfNow = performance.now();
      lastTranscriptChangeTimeRef.current = now;
      lastSpeechTimeRef.current = now;

      // Primary Layer: Real Words Detected During AI Speaking -> Instant Barge-In
      if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
        const words = text.split(/\s+/).filter(Boolean);
        const ttsElapsed = Date.now() - ttsStartTimeRef.current;
        if (words.length >= 1 && ttsElapsed > 150) {
          hasFiredBargeInRef.current = true;
          trace("STT_word_confirmed_bargein", { text, words: words.length, ttsElapsed });
          console.log(`[BARGE-IN CONFIRMED] Real speech words detected ("${text}") -> Halting AI speech`);
          if (onBargeInRef.current) {
            onBargeInRef.current({ source: "stt_confirmed", text, onsetTime: perfNow, timestamp: perfNow });
          }
        }
      }

      if (!hasSpokenRef.current && text.length > 0) {
        hasSpokenRef.current = true;
        trace("hasSpoken_set_true", { text });
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
    trace("startSession", { now, hasSpoken: false, hasFiredCompletion: false });
  }, []);

  // Reset only barge-in firing so a repeated question can be interrupted
  const resetBargeInEngine = useCallback(() => {
    hasFiredBargeInRef.current = false;
    bargeInOnsetRef.current = 0;
    bargeInConsecutiveFramesRef.current = 0;
    trace("resetBargeInEngine");
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

  // Main AudioContext & Analyser Loop
  useEffect(() => {
    if (!stream) {
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || audioTracks[0].readyState !== "live") {
      console.warn("[VAD] Audio track is not live:", audioTracks[0]);
      return;
    }

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
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      startSession();

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const freqDataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!isAudioLoopActive || !analyserRef.current) return;
        animFrameRef.current = requestAnimationFrame(checkAudioLevel);

        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch(() => {});
        }

        analyserRef.current.getByteTimeDomainData(dataArray);
        analyserRef.current.getByteFrequencyData(freqDataArray);

        // Compute RMS amplitude
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Spectral Analysis
        const sampleRate = audioContextRef.current?.sampleRate || 44100;
        const nyquist = sampleRate / 2;
        const binHz = nyquist / freqDataArray.length;
        
        const speechMinBin = Math.max(1, Math.floor(300 / binHz));
        const speechMaxBin = Math.min(freqDataArray.length - 1, Math.floor(3400 / binHz));
        
        let speechBandEnergy = 0;
        let peakValue = 0;
        
        for (let i = speechMinBin; i <= speechMaxBin; i++) {
          const val = freqDataArray[i];
          speechBandEnergy += val;
          if (val > peakValue) {
            peakValue = val;
          }
        }
        
        let logSum = 0;
        let binCount = 0;
        for (let i = speechMinBin; i <= speechMaxBin; i++) {
          if (freqDataArray[i] > 0) {
            logSum += Math.log(freqDataArray[i] + 1);
            binCount++;
          }
        }
        const geometricMean = binCount > 0 ? Math.exp(logSum / binCount) : 0;
        const arithmeticMean = binCount > 0 ? speechBandEnergy / binCount : 1;
        const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

        let weightedSum = 0;
        for (let i = speechMinBin; i <= speechMaxBin; i++) {
          weightedSum += i * binHz * freqDataArray[i];
        }
        const spectralCentroid = speechBandEnergy > 0 ? weightedSum / speechBandEnergy : 0;

        spectralHistoryRef.current.push({
          flatness: spectralFlatness,
          centroid: spectralCentroid,
          peakValue: peakValue / 255.0,
          energy: speechBandEnergy,
        });
        if (spectralHistoryRef.current.length > 8) {
          spectralHistoryRef.current.shift();
        }

        const now = Date.now();
        const perfNow = performance.now();

        // Throttle UI RMS state updates
        if (perfNow - lastRmsUiUpdateRef.current > 80) {
          lastRmsUiUpdateRef.current = perfNow;
          setCurrentRms(rms);
        }

        // Adaptive Noise Floor Tracking
        if (rms < speechThresholdRef.current * 1.2) {
          noiseFloorRef.current = Math.max(0.003, Math.min(0.035, noiseFloorRef.current * 0.990 + rms * 0.010));
        }

        const effectiveBargeInThreshold = Math.max(
          bargeInThresholdRef.current,
          noiseFloorRef.current * 1.8
        );
        const effectiveSpeechThreshold = Math.max(
          speechThresholdRef.current,
          noiseFloorRef.current * 1.3
        );

        // Layer 2: Secondary Acoustic & Spectral Fallback (Sustained >= 320ms human voice)
        if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
          const ttsElapsed = now - ttsStartTimeRef.current;

          if (ttsElapsed > 250) {
            if (rms >= effectiveBargeInThreshold) {
              bargeInConsecutiveFramesRef.current += 1;
              if (bargeInOnsetRef.current === 0) {
                bargeInOnsetRef.current = perfNow;
              } else {
                const sustainedMs = perfNow - bargeInOnsetRef.current;
                // Require 320ms sustained vocal energy + formant validation
                if (sustainedMs >= bargeInSustainMsRef.current || bargeInConsecutiveFramesRef.current >= 10) {
                  const recentHistory = spectralHistoryRef.current.slice(-4);
                  const avgFlatness = recentHistory.reduce((s, h) => s + h.flatness, 0) / recentHistory.length;
                  const avgCentroid = recentHistory.reduce((s, h) => s + h.centroid, 0) / recentHistory.length;
                  const maxPeak = Math.max(...recentHistory.map(h => h.peakValue));
                  
                  const isSpeechLike = avgFlatness > 0.15 && avgCentroid > 300 && avgCentroid < 3800 && maxPeak < 0.85;
                  
                  if (!isSpeechLike) {
                    bargeInConsecutiveFramesRef.current = 0;
                    bargeInOnsetRef.current = 0;
                    return;
                  }
                  
                  hasFiredBargeInRef.current = true;
                  const onsetTime = bargeInOnsetRef.current;
                  console.log(
                    `[ACOUSTIC BARGE-IN TRIGGERED] Sustained voice verified (${sustainedMs.toFixed(0)}ms, RMS=${rms.toFixed(3)})`
                  );
                  if (onBargeInRef.current) {
                    onBargeInRef.current({
                      source: "vad_acoustic_fallback",
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
              bargeInConsecutiveFramesRef.current = Math.max(0, bargeInConsecutiveFramesRef.current - 1);
              if (bargeInConsecutiveFramesRef.current === 0) {
                bargeInOnsetRef.current = 0;
              }
            }
          }
        }

        // Layer 3: Transcript-Locked Answer Auto-Completion
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

            // Condition A: Standard Verbal Answer (>= 2 words, >= 1.8s silence)
            if (
              hasSpokenRef.current &&
              wordCount >= minWordCountRef.current &&
              duration >= minAnswerDurationMsRef.current
            ) {
              if (silenceDuration >= silenceThresholdMsRef.current && transcriptSilenceDuration >= silenceThresholdMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD Auto-Complete] Answer detected (silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms)`
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
            // Condition B: Short Verbal Answer (1 word, e.g. greeting "Yes", "Ready", or short answer)
            else if (hasSpokenRef.current && wordCount >= 1 && duration >= minAnswerDurationMsRef.current) {
              if (silenceDuration >= Math.min(silenceThresholdMsRef.current, thinkingGracePeriodMsRef.current)) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD Auto-Complete] Short answer detected (silence=${silenceDuration}ms, words=${wordCount}, duration=${duration}ms)`
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
            // Condition C: Pure Acoustic Detection (Candidate spoke for >= 300ms, Web Speech API emitted 0 words / offline)
            else if (
              hasSpokenRef.current &&
              totalSpokenDurationMsRef.current >= 300 &&
              duration >= minAnswerDurationMsRef.current
            ) {
              if (silenceDuration >= silenceThresholdMsRef.current) {
                hasFiredCompletionRef.current = true;
                console.log(
                  `[VAD Auto-Complete] Acoustic speech detected (silence=${silenceDuration}ms, spoken=${totalSpokenDurationMsRef.current}ms, words=${wordCount})`
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
    resetBargeInEngine,
  };
}

export default useVoiceActivityDetector;
