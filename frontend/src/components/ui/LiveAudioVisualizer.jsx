import { useEffect, useRef, useState } from "react";

const WAVEFORM_BAR_TEMPLATE = [
  6, 14, 22, 18, 28, 10, 24, 16, 8, 26, 20, 12, 30, 18, 10, 24, 16, 22, 8, 18, 28, 14, 20, 10, 26,
  12, 24, 16, 30, 14, 22, 18, 28, 10, 26, 16, 20, 8, 18, 28, 12, 24, 10, 22, 16, 30, 14, 20, 8, 18
];

export default function LiveAudioVisualizer({
  audioStream = null,
  isRecording = false,
  isSpeaking = false,
  rms = 0,
  active = false,
  barCount = 40,
  height = 32,
  color = "#1D5DFF",
  inactiveColor = "#4A4944",
}) {
  const [barHeights, setBarHeights] = useState(() => new Array(barCount).fill(3));

  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const smoothedRef = useRef(new Float32Array(barCount).fill(3));
  const timeRef = useRef(0);
  const rmsRef = useRef(rms);
  rmsRef.current = rms;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  useEffect(() => {
    let isLoopActive = true;

    // CASE 1: Web Audio API Analyser via direct MediaStream
    if (audioStream && (isRecording || active)) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }

        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks[0].readyState === "live") {
          const micStream = new MediaStream([audioTracks[0]]);
          const source = audioCtx.createMediaStreamSource(micStream);
          const analyser = audioCtx.createAnalyser();

          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          analyserRef.current = analyser;
          sourceRef.current = source;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateFrequencyData = () => {
            if (!isLoopActive || !analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avgVol = sum / bufferLength;
            const currentRmsVal = rmsRef.current || 0;
            const effectiveVol = Math.max(avgVol, currentRmsVal * 300);

            timeRef.current += 0.15;
            const nextHeights = new Float32Array(barCount);

            for (let i = 0; i < barCount; i++) {
              let targetH = 3;
              if (effectiveVol > 3 || isSpeakingRef.current) {
                const volScale = Math.min(1.4, Math.max(0.2, effectiveVol / 28));
                const wave = Math.sin(timeRef.current + i * 0.4) * 0.3 + 0.85;
                const templateH = WAVEFORM_BAR_TEMPLATE[i % WAVEFORM_BAR_TEMPLATE.length];
                targetH = Math.max(3, Math.min(28, templateH * volScale * wave));
              }

              if (targetH > smoothedRef.current[i]) {
                smoothedRef.current[i] = smoothedRef.current[i] * 0.3 + targetH * 0.7;
              } else {
                smoothedRef.current[i] = smoothedRef.current[i] * 0.7 + targetH * 0.3;
              }

              if (smoothedRef.current[i] < 3.2) {
                smoothedRef.current[i] = 3;
              }
              nextHeights[i] = smoothedRef.current[i];
            }

            setBarHeights(Array.from(nextHeights));
            animFrameRef.current = requestAnimationFrame(updateFrequencyData);
          };

          animFrameRef.current = requestAnimationFrame(updateFrequencyData);

          return () => {
            isLoopActive = false;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (sourceRef.current) {
              try { sourceRef.current.disconnect(); } catch (e) {}
            }
            if (analyserRef.current) {
              try { analyserRef.current.disconnect(); } catch (e) {}
            }
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
              try { audioCtxRef.current.close(); } catch (e) {}
            }
          };
        }
      } catch (err) {
        console.warn("[LiveAudioVisualizer] Audio analyser fallback:", err);
      }
    }

    // CASE 2: RMS-Driven Fluid Waveform (When stream is active or VAD RMS is passed)
    if (isRecording || active) {
      const renderRmsFrame = () => {
        if (!isLoopActive) return;
        const currentRmsVal = rmsRef.current || 0;
        const speaking = isSpeakingRef.current;
        timeRef.current += 0.15;

        const nextHeights = new Float32Array(barCount);

        for (let i = 0; i < barCount; i++) {
          let targetH = 3;
          if (currentRmsVal > 0.015 || speaking) {
            const volScale = Math.min(1.4, Math.max(0.3, currentRmsVal * 30));
            const wave = Math.sin(timeRef.current + i * 0.4) * 0.3 + 0.85;
            const templateH = WAVEFORM_BAR_TEMPLATE[i % WAVEFORM_BAR_TEMPLATE.length];
            targetH = Math.max(3, Math.min(28, templateH * volScale * wave));
          }

          if (targetH > smoothedRef.current[i]) {
            smoothedRef.current[i] = smoothedRef.current[i] * 0.3 + targetH * 0.7;
          } else {
            smoothedRef.current[i] = smoothedRef.current[i] * 0.7 + targetH * 0.3;
          }

          if (smoothedRef.current[i] < 3.2) {
            smoothedRef.current[i] = 3;
          }
          nextHeights[i] = smoothedRef.current[i];
        }

        setBarHeights(Array.from(nextHeights));
        animFrameRef.current = requestAnimationFrame(renderRmsFrame);
      };

      animFrameRef.current = requestAnimationFrame(renderRmsFrame);

      return () => {
        isLoopActive = false;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }

    // CASE 3: Inactive Flat Line
    setBarHeights(new Array(barCount).fill(3));
    smoothedRef.current.fill(3);

    return () => {
      isLoopActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioStream, isRecording, active, barCount]);

  return (
    <div
      className="w-full flex items-center justify-center gap-[3px]"
      style={{ height: `${height}px` }}
      aria-label="Live Audio Visualizer"
    >
      {barHeights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-all duration-75 ease-out min-w-[2px] max-w-[4px]"
          style={{
            height: `${Math.max(3, Math.min(28, h))}px`,
            backgroundColor: (isRecording || active) && h > 3.5 ? color : inactiveColor,
          }}
        />
      ))}
    </div>
  );
}
