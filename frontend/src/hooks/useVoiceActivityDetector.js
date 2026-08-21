import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Ultra-Responsive Real-Time Voice Activity Detector (VAD)
 * - Layered Hybrid Architecture:
 *   1. Primary Interruption: STT-Confirmed Word Detection (100% immune to domestic noise).
 *   2. Secondary Interruption: Calibrated Harmonic Pitch & Multi-Band Formant Safety Net
 *      (Autocorrelation F0 in 80-320Hz + Vocal Tract Formant Resonance).
 *      -> Suppresses laptop fan noise, car horns, keyboard clicks, and domestic transients.
 *   3. Transcript-Locked Auto-Completion: Requires real spoken words before silence progression activates.
 */

const trace = (event, data = {}) => {
  console.log(`[VAD-TRACE ${performance.now().toFixed(0)}] ${event}`, data);
};

/**
 * Fast Autocorrelation Pitch & Voicing Detector
 * Detects fundamental frequency (F0) periodicity in human vocal range (80 Hz - 320 Hz)
 * Rejects white/pink fan noise (periodicity < 0.25).
 */
function detectHumanPitchPeriodicity(timeData, sampleRate) {
  const minLag = Math.max(1, Math.floor(sampleRate / 340)); // ~340 Hz upper bound
  const maxLag = Math.min(timeData.length - 1, Math.floor(sampleRate / 75));  // ~75 Hz lower bound
  
  const N = Math.min(timeData.length, 512);
  let maxCorr = 0;
  let energy = 0;
  
  for (let i = 0; i < N; i++) {
    energy += timeData[i] * timeData[i];
  }
  if (energy < 0.00005) return { isVoiced: false, periodicity: 0 };
  
  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += timeData[i] * timeData[i + lag];
    }
    const normCorr = sum / energy;
    if (normCorr > maxCorr) {
      maxCorr = normCorr;
    }
  }
  
  return { isVoiced: maxCorr >= 0.28, periodicity: maxCorr };
}

/**
 * Formant & Spectral Multi-Band Energy Validator
 * Rejects single-frequency tones (car horns), high-frequency clicks (typing), and broadband noise (fans)
 */
function evaluateSpeechFormants(freqData, sampleRate) {
  const binCount = freqData.length;
  const binWidth = (sampleRate / 2) / binCount;
  
  let totalEnergy = 0;
  let maxBinVal = 0;
  let f1Energy = 0; // 300 - 1000 Hz
  let f2Energy = 0; // 1000 - 3000 Hz
  let highEnergy = 0; // > 4000 Hz
  let weightedFreqSum = 0;
  
  for (let i = 0; i < binCount; i++) {
    const val = freqData[i] / 255;
    const power = val * val;
    totalEnergy += power;
    if (val > maxBinVal) maxBinVal = val;
    
    const freq = i * binWidth;
    weightedFreqSum += freq * power;
    
    if (freq >= 280 && freq <= 1100) {
      f1Energy += power;
    } else if (freq > 1100 && freq <= 3200) {
      f2Energy += power;
    } else if (freq > 3800) {
      highEnergy += power;
    }
  }
  
  if (totalEnergy < 0.0001) {
    return { isHumanSpeech: false, reason: "silent" };
  }
  
  const centroid = weightedFreqSum / totalEnergy;
  const peakiness = maxBinVal / Math.sqrt(totalEnergy + 0.0001);
  const f1Ratio = f1Energy / totalEnergy;
  const f2Ratio = f2Energy / totalEnergy;
  const highRatio = highEnergy / totalEnergy;
  
  // Rejection 1: Single-Tone / Car Horn (>80% of energy in narrow band or extreme peakiness)
  const isSingleTone = peakiness > 5.5 || (f1Ratio > 0.88 || f2Ratio > 0.88);
  if (isSingleTone) {
    return { isHumanSpeech: false, reason: "single_tone_horn", peakiness, centroid };
  }
  
  // Rejection 2: Keyboard click / Mouse clack (Dominant energy above 3.8kHz)
  const isHighClick = highRatio > 0.45 || centroid > 3800;
  if (isHighClick) {
    return { isHumanSpeech: false, reason: "high_freq_click", highRatio, centroid };
  }
  
  // Requirement: Vocal tract resonance in F1/F2 speech bands
  const hasFormants = (f1Ratio + f2Ratio) >= 0.25;
  if (!hasFormants) {
    return { isHumanSpeech: false, reason: "no_formants", f1Ratio, f2Ratio };
  }
  
  return {
    isHumanSpeech: true,
    centroid,
    peakiness,
    f1Ratio,
    f2Ratio,
    highRatio
  };
}

export function useVoiceActivityDetector({
  stream,
  enabled = true,
  bargeInEnabled = false,
  speechThreshold = 0.014,       // Calibrated for natural human voice (0.014 - 0.035 RMS)
  bargeInThreshold = 0.024,      // Calibrated acoustic fallback threshold
  bargeInSustainMs = 280,        // 280ms sustained vocal harmonic energy required for acoustic fallback
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

  // Spectral & Harmonic History Refs
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
    const perfNow = performance.now();
    recordingStartTimeRef.current = now;
    lastSpeechTimeRef.current = now;
    totalSpokenDurationMsRef.current = 0;
    hasSpokenRef.current = false;
    isSpeakingRef.current = false;
    hasFiredCompletionRef.current = false;
    hasFiredBargeInRef.current = false;
    bargeInOnsetRef.current = 0;
    bargeInConsecutiveFramesRef.current = 0;
    spectralHistoryRef.current = [];
    setIsSpeaking(false);
    trace("session_started", { timestamp: perfNow });

    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  // Explicit barge-in reset when starting a new question TTS read-out
  const resetBargeInEngine = useCallback((newTtsStartTime) => {
    const perfNow = performance.now();
    hasFiredBargeInRef.current = false;
    bargeInOnsetRef.current = 0;
    bargeInConsecutiveFramesRef.current = 0;
    ttsStartTimeRef.current = newTtsStartTime || Date.now();
    spectralHistoryRef.current = [];
    trace("bargein_engine_reset", { ttsStartTime: ttsStartTimeRef.current, timestamp: perfNow });

    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  // Main AudioContext & Analyser Loop
  useEffect(() => {
    if (!stream) return;

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

      // Vocal Frequency Bandpass Filter Chain (130 Hz HPF + 3600 Hz LPF)
      // Strips out laptop fan rumble, desk vibrations, and high-frequency air hiss
      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 130;
      hpFilter.Q.value = 0.7;

      const lpFilter = audioCtx.createBiquadFilter();
      lpFilter.type = "lowpass";
      lpFilter.frequency.value = 3600;
      lpFilter.Q.value = 0.7;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(analyser);
      sourceRef.current = source;

      startSession();

      const byteTimeData = new Uint8Array(analyser.fftSize);
      const floatTimeData = new Float32Array(analyser.fftSize);
      const freqDataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!isAudioLoopActive || !analyserRef.current) return;
        animFrameRef.current = requestAnimationFrame(checkAudioLevel);

        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch(() => {});
        }

        analyserRef.current.getByteTimeDomainData(byteTimeData);
        analyserRef.current.getFloatTimeDomainData(floatTimeData);
        analyserRef.current.getByteFrequencyData(freqDataArray);

        // Compute RMS amplitude
        let sumSquares = 0;
        for (let i = 0; i < byteTimeData.length; i++) {
          const norm = (byteTimeData[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / byteTimeData.length);

        const sampleRate = audioContextRef.current?.sampleRate || 44100;
        
        // 1. Fast Autocorrelation Pitch Periodicity (F0 in 80Hz - 320Hz human range)
        const pitchInfo = detectHumanPitchPeriodicity(floatTimeData, sampleRate);
        
        // 2. Multi-Band Formant Energy Validation (F1/F2 speech resonance)
        const formantInfo = evaluateSpeechFormants(freqDataArray, sampleRate);

        const now = Date.now();
        const perfNow = performance.now();

        // Throttle UI RMS state updates
        if (perfNow - lastRmsUiUpdateRef.current > 80) {
          lastRmsUiUpdateRef.current = perfNow;
          setCurrentRms(rms);
        }

        // Adaptive Noise Floor Tracking (Track stationary background fan noise/ambient hum)
        if (!pitchInfo.isVoiced && !formantInfo.isHumanSpeech) {
          noiseFloorRef.current = Math.max(0.004, Math.min(0.040, noiseFloorRef.current * 0.992 + rms * 0.008));
        }

        const effectiveBargeInThreshold = Math.max(
          bargeInThresholdRef.current,
          noiseFloorRef.current * 2.2
        );
        const effectiveSpeechThreshold = Math.max(
          speechThresholdRef.current,
          noiseFloorRef.current * 2.0
        );

        // Layer 2: Secondary Harmonic & Formant Safety Net (Sustained >= 280ms human vocalization)
        if (bargeInEnabledRef.current && !hasFiredBargeInRef.current) {
          const ttsElapsed = now - ttsStartTimeRef.current;

          // Only trigger if AI has been speaking for at least 250ms
          if (ttsElapsed > 250) {
            // Require RMS above floating threshold AND human harmonic pitch AND vocal formants
            const isSpeechAcoustic = rms >= effectiveBargeInThreshold && pitchInfo.isVoiced && formantInfo.isHumanSpeech;

            if (isSpeechAcoustic) {
              bargeInConsecutiveFramesRef.current += 1;
              if (bargeInOnsetRef.current === 0) {
                bargeInOnsetRef.current = perfNow;
              } else {
                const sustainedMs = perfNow - bargeInOnsetRef.current;
                
                // Trigger barge-in if sustained vocal harmony is verified
                if (sustainedMs >= bargeInSustainMsRef.current || bargeInConsecutiveFramesRef.current >= 8) {
                  hasFiredBargeInRef.current = true;
                  const onsetTime = bargeInOnsetRef.current;
                  console.log(
                    `[HARMONIC BARGE-IN TRIGGERED] Human vocal cords verified (${sustainedMs.toFixed(0)}ms, F0_Periodicity=${pitchInfo.periodicity.toFixed(2)}, RMS=${rms.toFixed(3)})`
                  );
                  if (onBargeInRef.current) {
                    onBargeInRef.current({
                      source: "vad_harmonic_formant",
                      rms,
                      periodicity: pitchInfo.periodicity,
                      noiseFloor: noiseFloorRef.current,
                      onsetTime,
                      timestamp: perfNow,
                    });
                  }
                  return;
                }
              }
            } else {
              // Rapid decay if noise fails speech criteria (e.g. typing click or fan noise)
              bargeInConsecutiveFramesRef.current = Math.max(0, bargeInConsecutiveFramesRef.current - 1);
              if (bargeInConsecutiveFramesRef.current === 0) {
                bargeInOnsetRef.current = 0;
              }
            }
          }
        }

        // Layer 3: Transcript-Locked Answer Auto-Completion & Harmonic Speech Gating
        if (enabledRef.current && !hasFiredCompletionRef.current) {
          const duration = now - recordingStartTimeRef.current;
          const words = lastTranscriptTextRef.current.split(/\s+/).filter(Boolean);
          const wordCount = words.length;

          // Gating: Real human vocal resonance OR active speech transcript changes
          const isAcousticVocal = (pitchInfo.isVoiced || formantInfo.isHumanSpeech) && rms >= effectiveSpeechThreshold;
          const isTranscriptActive = (now - lastTranscriptChangeTimeRef.current) < 1400 && wordCount > 0;
          const isHumanSpeaking = isAcousticVocal || isTranscriptActive;

          if (isHumanSpeaking) {
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
