import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import Session from "../models/Session.js";
import { sendToAnalyzer } from "../services/analysisService.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { mergeTranscripts, evaluateTranscriptFallback } from "../utils/transcriptHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".webm");
    cb(null, `transcribe-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";

// POST /api/analysis/voice - accepts multipart audio and returns transcript + evaluation
export const transcribeAndEvaluate = [
  upload.single("audio"),
  async (req, res) => {
    try {
      const { sessionId, questionId, questionIndex: bodyQuestionIndex } = req.body;
      // Client-provided spoken question text: only trusted when the slot identity
      // (questionId) matches the session's stored slot - see Strategy 1 below.
      const clientQuestionText = (req.body.questionText || "").trim();
      if (!req.file) return sendError(res, "No audio file uploaded", 400);

      const audioPath = req.file.filename;
      const fullPath = path.resolve(__dirname, "../uploads", audioPath);

      // 1. Forward audio to Voice Service for Faster-Whisper STT & PyTorch Voice SER
      let voiceData = {};
      try {
        voiceData = await sendToAnalyzer(
          fullPath,
          process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002",
          "audio",
        );
      } catch (err) {
        console.error("Voice service error:", err.message);
      }

      const keywords = req.body.keywords ? JSON.parse(req.body.keywords) : null;
      let questionText = "Interview Question";
      let questionType = "mixed";

      let session = null;
      let targetIndex = -1;
      let isFollowUp = false;
      let followUpTurn = 1;
      let existingSlotTranscript = "";

      if (sessionId) {
        session = await Session.findById(sessionId);
        if (session && Array.isArray(session.answers)) {
          questionType = session.interviewType || "mixed";
          let targetParentId = String(questionId || "");

          if (targetParentId.includes("-followup-")) {
            isFollowUp = true;
            const parts = targetParentId.split("-followup-");
            targetParentId = parts[0];
            if (parts[1]) followUpTurn = parseInt(parts[1], 10) || 1;
          }

          // Slot Match Strategy 1: questionId or subdoc _id
          targetIndex = session.answers.findIndex(
            (a) => String(a.questionId) === targetParentId || String(a._id) === targetParentId
          );

          // Slot Match Strategy 2: explicit questionIndex
          if (targetIndex === -1 && bodyQuestionIndex !== undefined && bodyQuestionIndex !== null) {
            const qIdx = parseInt(bodyQuestionIndex, 10);
            if (!isNaN(qIdx) && qIdx >= 0 && qIdx < session.answers.length) {
              targetIndex = qIdx;
            }
          }

          // Slot Match Strategy 3: trailing index
          if (targetIndex === -1 && targetParentId.includes("-")) {
            const trailing = targetParentId.split("-").pop();
            const trailingIdx = parseInt(trailing, 10);
            if (!isNaN(trailingIdx) && trailingIdx >= 0 && trailingIdx < session.answers.length) {
              targetIndex = trailingIdx;
            }
          }

          if (targetIndex !== -1) {
            const storedSlot = session.answers[targetIndex];
            if (storedSlot) {
              if (isFollowUp && Array.isArray(storedSlot.followUps) && storedSlot.followUps.length > 0) {
                const fIdx = Math.min(followUpTurn - 1, storedSlot.followUps.length - 1);
                existingSlotTranscript = storedSlot.followUps[fIdx]?.voiceAnalysis?.transcript || storedSlot.followUps[fIdx]?.transcript || "";
              } else {
                existingSlotTranscript = storedSlot.voiceAnalysis?.transcript || storedSlot.transcript || "";
              }
            }

            // Identity-validated spoken-question preference: the candidate was
            // asked what the frontend displayed. If the payload's questionId
            // resolves to this exact slot (Strategy 1 match on questionId/_id),
            // the client's questionText is the ground truth of what was spoken
            // and wins over stored text. Index-only matches (Strategies 2/3)
            // carry no identity proof, so stored text is kept.
            const identityMatched =
              targetParentId === String(storedSlot.questionId) ||
              targetParentId === String(storedSlot._id);
            if (identityMatched && clientQuestionText) {
              questionText = clientQuestionText;
              // Heal the stored slot if a stale/other assembly wrote different text
              // (targeted positional update - no full-document overwrite races)
              if (storedSlot.questionText !== clientQuestionText) {
                try {
                  await Session.updateOne(
                    { _id: session._id, "answers.questionId": String(storedSlot.questionId) },
                    { $set: { "answers.$.questionText": clientQuestionText } }
                  );
                } catch (e) {}
              }
            } else {
              questionText = storedSlot.questionText || questionText;
            }
          }
        }
      }

      // Safe Transcript Consolidation: Merge any existing partial answer with new speech segment
      const clientTranscript = (req.body.clientTranscript || "").trim();
      const whisperTranscript = (voiceData.transcript && voiceData.transcript.trim()) || "";

      let finalTranscript = "";
      if (whisperTranscript) {
        const mergedWhisper = mergeTranscripts(existingSlotTranscript, whisperTranscript);
        finalTranscript = mergeTranscripts(mergedWhisper, clientTranscript);
      } else {
        finalTranscript = mergeTranscripts(existingSlotTranscript, clientTranscript);
      }
      if (!finalTranscript) {
        finalTranscript = clientTranscript || whisperTranscript || "";
      }

      voiceData = {
        ...voiceData,
        transcript: finalTranscript,
        confidenceScore: voiceData.confidenceScore !== undefined && voiceData.confidenceScore !== null
          ? voiceData.confidenceScore
          : (finalTranscript ? 85 : 0),
      };

      // 2. Evaluate transcript using nlp-service (Hybrid Engine)
      let evaluation = {};
      try {
        const nlpRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
          question: questionText,
          transcript: finalTranscript,
          questionType,
          keywords,
        });
        evaluation = nlpRes.data.data || {};
      } catch (nlpErr) {
        console.error("NLP service error:", nlpErr.message);
        evaluation = evaluateTranscriptFallback(finalTranscript, keywords);
      }

      // 3. Persist on session answer slot
      if (session && targetIndex !== -1) {
        const parent = session.answers[targetIndex];
        if (isFollowUp && Array.isArray(parent.followUps) && parent.followUps.length > 0) {
          const fIdx = Math.min(followUpTurn - 1, parent.followUps.length - 1);
          parent.followUps[fIdx].voiceAnalysis = {
            ...voiceData,
            transcript: finalTranscript,
          };
          parent.followUps[fIdx].transcript = finalTranscript;
          parent.followUps[fIdx].nlpAnalysis = evaluation;
        } else {
          parent.voiceAnalysis = {
            ...voiceData,
            transcript: finalTranscript,
          };
          parent.transcript = finalTranscript;
          parent.nlpAnalysis = evaluation;
        }
        await session.save();
      }

      try {
        fs.unlinkSync(fullPath);
      } catch (e) {}

      return sendSuccess(res, { voiceData, evaluation });
    } catch (err) {
      console.error("Transcribe error:", err);
      return sendError(res, err.message, 500);
    }
  },
];

// POST /api/analysis/evaluate — accept transcript + keywords and evaluate (protected)
export const evaluateOnly = async (req, res) => {
  try {
    const { question, transcript, questionType, keywords } = req.body;
    if (!transcript) return sendError(res, "transcript is required", 400);

    try {
      const nlpRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
        question: question || "Interview Question",
        transcript,
        questionType: questionType || "mixed",
        keywords: keywords || null,
      });
      return sendSuccess(res, { evaluation: nlpRes.data.data });
    } catch (err) {
      const fallback = evaluateTranscriptFallback(transcript, keywords);
      return sendSuccess(res, { evaluation: fallback });
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

