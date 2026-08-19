import { useEffect, useRef, useState } from "react";







const WAVEFORM_BAR_TEMPLATE = [



  6, 14, 22, 18, 28, 10, 24, 16, 8, 26, 20, 12, 30, 18, 10, 24, 16, 22, 8, 18, 28, 14, 20, 10, 26



];







export default function LiveAudioVisualizer({



  audioStream = null,



  isRecording = false,



  active = false,



  barCount = 50,



  height = 32,



  color = "#1D5DFF",



  inactiveColor = "#4A4944",



}) {



  const [barHeights, setBarHeights] = useState(() =>new Array(barCount).fill(3)



  );







  const animFrameRef = useRef(null);



  const audioCtxRef = useRef(null);



  const analyserRef = useRef(null);



  const sourceRef = useRef(null);



  const smoothedRef = useRef(new Float32Array(barCount).fill(3));



  const timeRef = useRef(0);







  useEffect(() => {



    //  CASE 1: REAL MICROPHONE INPUT VIA WEB AUDIO API 



    if (audioStream && (isRecording || active)) {



      try {



        const AudioContextClass = window.AudioContext || window.webkitAudioContext;



        if (!AudioContextClass) return;







        const audioCtx = new AudioContextClass();



        audioCtxRef.current = audioCtx;







        if (audioCtx.state === "suspended") {



          audioCtx.resume();



        }







        const audioTracks = audioStream.getAudioTracks();



        if (audioTracks.length === 0) return;







        const micStream = new MediaStream([audioTracks[0]]);



        const source = audioCtx.createMediaStreamSource(micStream);



        const analyser = audioCtx.createAnalyser();







        analyser.fftSize = 64;



        analyser.smoothingTimeConstant = 0.65;



        source.connect(analyser);







        analyserRef.current = analyser;



        sourceRef.current = source;







        const bufferLength = analyser.frequencyBinCount; // 32 bins



        const dataArray = new Uint8Array(bufferLength);







        const updateFrequencyData = () => {



          if (!analyserRef.current) return;



          analyserRef.current.getByteFrequencyData(dataArray);







          // Sum speech frequency bins (bins 0 to 12 cover human vocal frequencies 80Hz - 3.5kHz)



          let voiceEnergySum = 0;



          const speechBins = Math.min(12, bufferLength);



          for (let b = 0; b < speechBins; b++) {



            voiceEnergySum += dataArray[b];



          }



          const avgVoiceVolume = voiceEnergySum / speechBins;







          const nextHeights = new Float32Array(barCount);



          const noiseGate = 5; // Silence threshold







          timeRef.current += 0.12; // Continuous fluid wave motion tick







          for (let i = 0; i < barCount; i++) {



            let targetH = 3; // Default 3px flat line when silent







            if (avgVoiceVolume >noiseGate) {



              // Real-time voice amplitude scale factor (0.0 to 1.3)



              const volumeScale = Math.min(1.3, (avgVoiceVolume - noiseGate) / 35);







              // Map bar to voice frequency bin to add real-time pitch variation per bar



              const binIdx = i % speechBins;



              const binFreqScale = 0.75 + 0.5 * ((dataArray[binIdx] || 0) / 255);







              // Continuous organic wave oscillation while user is speaking



              const organicWave = Math.sin(timeRef.current + i * 0.35) * 0.2 + 0.85;







              // Modulate the exact landing-page wave template heights with real mic volume, pitch, & wave



              const templateH = WAVEFORM_BAR_TEMPLATE[i % WAVEFORM_BAR_TEMPLATE.length];



              targetH = Math.max(3, Math.min(30, templateH * volumeScale * binFreqScale * organicWave));



            }







            // Fast attack when speaking, smooth decay to flat line when silent



            if (targetH >smoothedRef.current[i]) {



              smoothedRef.current[i] = smoothedRef.current[i] * 0.35 + targetH * 0.65;



            } else {



              smoothedRef.current[i] = smoothedRef.current[i] * 0.7 + targetH * 0.3;



            }







            if (smoothedRef.current[i] < 3.1) {



              smoothedRef.current[i] = 3;



            }







            nextHeights[i] = smoothedRef.current[i];



          }







          setBarHeights(Array.from(nextHeights));



          animFrameRef.current = requestAnimationFrame(updateFrequencyData);



        };







        animFrameRef.current = requestAnimationFrame(updateFrequencyData);







        return () => {



          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);



          if (sourceRef.current) sourceRef.current.disconnect();



          if (analyserRef.current) analyserRef.current.disconnect();



          if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {



            audioCtxRef.current.close().catch(() => {});



          }



        };



      } catch (err) {



        console.error("Web Audio API visualizer error:", err);



      }



    }







    //  CASE 2: SIMULATED DEMO MODE (Landing Page preview without stream) 



    else if (active && !audioStream) {



      let step = 0;



      const interval = setInterval(() => {



        step += 0.15;



        const next = new Array(barCount).fill(0).map((_, i) => {



          const baseH = WAVEFORM_BAR_TEMPLATE[i % WAVEFORM_BAR_TEMPLATE.length];



          const wave = Math.sin(step + i * 0.4) * 0.5 + 0.5;



          return Math.max(3, Math.min(30, baseH * (0.4 + wave * 0.6)));



        });



        setBarHeights(next);



      }, 80);







      return () =>clearInterval(interval);



    }







    //  CASE 3: INACTIVE / SILENT (Pure 3px flat line) 



    else {



      setBarHeights(new Array(barCount).fill(3));



      smoothedRef.current.fill(3);



    }



  }, [audioStream, isRecording, active, barCount]);







  return (



    <div



      className="w-full flex items-center justify-between gap-[2px]"



      style={{ height: `${height}px` }}



      aria-label="Live Audio Visualizer"



    >



      {barHeights.map((h, i) => (



        <div



          key={i}



          className="flex-1 rounded-full transition-all duration-75 ease-out min-w-[2px] max-w-[4px]"



          style={{



            height: `${Math.max(3, Math.min(30, h))}px`,



            backgroundColor: (isRecording || active) && h >3.5 ? color : inactiveColor,



          }}



        />



      ))}



    </div>



  );



}



