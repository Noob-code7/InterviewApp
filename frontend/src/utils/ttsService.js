import api from "../api/axios";

export const DEFAULT_INTERVIEW_VOICE = "af_heart";
export const DEFAULT_TTS_RATE = 1.0;

const CACHE_LIMIT = 200;
const RESOLVE_SAFETY_TIMEOUT = 15000;

let activeGenerationId = 0;
let abortControllerRef = null;
let cache = new Map();

let audioContext = null;
let currentAudioSource = null;

function getCacheKey(text, voice, rate) {
  return `${voice}|${rate}|${text}`;
}

function ensureAudioContext() {
  if (!audioContext) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioContext = new AC();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playWav(wav) {
  return new Promise((resolve) => {
    const ctx = ensureAudioContext();
    if (!ctx) return resolve();

    ctx.decodeAudioData(
      wav.buffer.slice(0),
      (buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        currentAudioSource = source;
        source.onended = () => {
          if (currentAudioSource === source) currentAudioSource = null;
          resolve();
        };
        try {
          source.start();
        } catch (e) {
          resolve();
        }
      },
      () => resolve()
    );
  });
}

function fallbackSpeak(text, rate) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
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

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

async function synthesize(text, voice, rate, signal) {
  const cacheKey = getCacheKey(text, voice, rate);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const { data } = await api.post(
    "/api/tts",
    { text, voice, rate },
    { responseType: "arraybuffer", signal, timeout: 60000 }
  );

  const wav = new Uint8Array(data);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(cacheKey, wav);
  return wav;
}

export function cancelTTS() {
  activeGenerationId += 1;
  if (abortControllerRef) {
    try {
      abortControllerRef.abort();
    } catch (e) {}
    abortControllerRef = null;
  }
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
    } catch (e) {}
    currentAudioSource = null;
  }
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {}
}

export function preSynthesize(text, voice = DEFAULT_INTERVIEW_VOICE, rate = DEFAULT_TTS_RATE) {
  const key = getCacheKey(text, voice, rate);
  if (!text || cache.has(key)) return;
  const controller = new AbortController();
  synthesize(text, voice, rate, controller.signal).catch(() => {});
}

export async function speak(
  text,
  { voice = DEFAULT_INTERVIEW_VOICE, rate = DEFAULT_TTS_RATE, allowFallback = true } = {}
) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  cancelTTS();
  const generationId = activeGenerationId;
  const controller = new AbortController();
  abortControllerRef = controller;

  let wav = null;
  try {
    wav = await synthesize(trimmed, voice, rate, controller.signal);
  } catch (e) {
    if (generationId !== activeGenerationId) return;
    if (!allowFallback) return;
    return fallbackSpeak(trimmed, rate);
  }

  if (generationId !== activeGenerationId) return;

  await Promise.race([
    playWav(wav),
    new Promise((resolve) => setTimeout(resolve, RESOLVE_SAFETY_TIMEOUT)),
  ]);
}

export const ttsService = {
  speak,
  cancelTTS,
  preSynthesize,
  DEFAULT_INTERVIEW_VOICE,
  DEFAULT_TTS_RATE,
};

export default ttsService;
