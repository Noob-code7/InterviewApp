import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import Session from "../models/Session.js";
import { sendToAnalyzer } from "../services/analysisService.js";
import { sendSuccess, sendError } from "../utils/response.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage for temporary uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".webm");
    cb(null, `transcribe-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// POST /api/analysis/voice - accepts multipart audio and returns transcript + evaluation
export const transcribeAndEvaluate = [
  upload.single("audio"),
  async (req, res) => {
    try {
      const { sessionId, questionId } = req.body;
      if (!req.file) return sendError(res, "No audio file uploaded", 400);

      const audioPath = req.file.filename;
      const fullPath = path.resolve(__dirname, "../uploads", audioPath);

      // Forward to Voice Service (stub) and get transcript + metrics
      let voiceData = {};
      try {
        voiceData = await sendToAnalyzer(
          fullPath,
          process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002",
          "audio",
        );
      } catch (err) {
        console.error("Voice service error:", err.message);
        // Fallback: return client-provided transcript if available
        voiceData = {
          transcript: req.body.clientTranscript || "",
          confidenceScore: 0,
        };
      }

      // Evaluate transcript if keywords or reference provided
      const keywords = req.body.keywords ? JSON.parse(req.body.keywords) : null;
      const reference = req.body.reference || null;
      const evaluation = evaluateTranscript(voiceData.transcript || "", {
        keywords,
        reference,
      });

      // Persist on session answer if sessionId + questionId provided
      if (sessionId && questionId) {
        const session = await Session.findById(sessionId);
        if (session) {
          const idx = session.answers.findIndex(
            (a) => a.questionId === questionId,
          );
          if (idx !== -1) {
            session.answers[idx].voiceAnalysis = {
              ...voiceData,
              transcript: voiceData.transcript || "",
              evaluation,
            };
            await session.save();
          }
        }
      }

      // Cleanup uploaded file (we keep stored answer files via uploadAnswer route)
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        /* ignore */
      }

      return sendSuccess(res, { voiceData, evaluation });
    } catch (err) {
      console.error("Transcribe error:", err);
      return sendError(res, err.message, 500);
    }
  },
];

// Basic evaluation algorithm — keyword matching + simple token-overlap semantic score
export const evaluateTranscript = (
  transcript,
  { keywords = null, reference = null } = {},
) => {
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[\p{P}$+<=>^`|~]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const t = normalize(transcript);
  const tTokens = t ? t.split(" ") : [];

  let matchedKeywords = [];
  let keywordScore = null;
  if (keywords && Array.isArray(keywords) && keywords.length) {
    const req = keywords.map((k) => normalize(k));
    const matched = req.filter((k) => tTokens.includes(k));
    matchedKeywords = matched;
    keywordScore = matched.length / req.length;
  }

  let semanticScore = null;
  if (reference) {
    const r = normalize(reference);
    const rTokens = r ? r.split(" ") : [];
    if (rTokens.length && tTokens.length) {
      const intersection = tTokens.filter((v, i, a) => rTokens.includes(v));
      semanticScore =
        intersection.length / Math.max(rTokens.length, tTokens.length);
    } else {
      semanticScore = 0;
    }
  }

  // Combine scores
  let combined = null;
  if (keywordScore !== null && semanticScore !== null) {
    combined = 0.6 * keywordScore + 0.4 * semanticScore;
  } else if (keywordScore !== null) {
    combined = keywordScore;
  } else if (semanticScore !== null) {
    combined = semanticScore;
  }

  const isCorrect = combined !== null ? combined >= 0.6 : false;

  return {
    transcript: transcript || "",
    matchedKeywords,
    keywordScore,
    semanticScore,
    combinedScore: combined,
    isCorrect,
  };
};

// POST /api/analysis/evaluate — accept JSON and return evaluation without audio
export const evaluateOnly = async (req, res) => {
  try {
    const { transcript, keywords, reference, sessionId, questionId } = req.body;
    const keys = keywords || null;
    const evalResult = evaluateTranscript(transcript || "", {
      keywords: keys,
      reference,
    });

    // Optionally persist
    if (sessionId && questionId) {
      const session = await Session.findById(sessionId);
      if (session) {
        const idx = session.answers.findIndex(
          (a) => a.questionId === questionId,
        );
        if (idx !== -1) {
          session.answers[idx].voiceAnalysis = {
            transcript,
            evaluation: evalResult,
          };
          await session.save();
        }
      }
    }

    return sendSuccess(res, { evaluation: evalResult });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
