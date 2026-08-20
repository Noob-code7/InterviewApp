import { Router } from "express";
import axios from "axios";
import { protect } from "../middleware/auth.js";

const router = Router();

const VOICE_SERVICE_URL =
  process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002";
const MAX_TEXT_LENGTH = 2000;

// POST /api/tts — synthesize speech via the voice-service, streaming WAV back
router.post("/", protect, async (req, res) => {
  try {
    const { text, voice, rate } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "text is required" });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `text must be ${MAX_TEXT_LENGTH} characters or fewer`,
      });
    }

    const voiceResponse = await axios.post(
      `${VOICE_SERVICE_URL}/tts`,
      {
        text: text.trim(),
        voice: voice || undefined,
        rate: typeof rate === "number" ? rate : 1.0,
      },
      {
        responseType: "arraybuffer",
        timeout: 60000,
        validateStatus: (status) => status < 500,
      },
    );

    if (voiceResponse.status >= 400) {
      let detail = "Voice service error";
      try {
        const parsed = JSON.parse(
          Buffer.from(voiceResponse.data).toString("utf-8"),
        );
        detail = parsed.detail || parsed.error || detail;
      } catch (e) {}
      return res
        .status(voiceResponse.status)
        .json({ success: false, error: detail });
    }

    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(voiceResponse.data.length));
    res.send(Buffer.from(voiceResponse.data));
  } catch (error) {
    console.error("TTS proxy error:", error.message);
    res
      .status(503)
      .json({ success: false, error: "TTS service unavailable" });
  }
});

export default router;