import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import axios from "axios";
import path from "path";
import fs from "fs";
import FormData from "form-data";
import { fileURLToPath } from "url";
import Session from "../models/Session.js";
import { storageService } from "./storageService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const connection = new IORedis(REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 2) return null;
    return 1000;
  },
});

connection.on("error", (err) => {
  // Silent Redis error handling — fallback engine handles processing
});

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://127.0.0.1:8001";
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002";
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const TEMP_DIR = path.join(UPLOADS_DIR, "temp");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export const startAnalysis = async (sessionId) => {
  const session = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      status: { $ne: "completed" },
    },
    { $set: { jobStatus: "processing", status: "processing" } },
    { new: true },
  );

  if (!session) {
    console.log(`[Job] Session ${sessionId} already completed or processing.`);
    return true;
  }

  // Execute direct session processing for instant response & reliability
  setTimeout(async () => {
    try {
      await processSession(sessionId);
    } catch (err) {
      console.error("[AnalysisService] Session processing fallback error:", err.message);
      await Session.findByIdAndUpdate(sessionId, { status: "completed", jobStatus: "completed" });
    }
  }, 100);

  return true;
};

/**
 * Resolves local file path from R2 object storage key or local uploads path.
 */
const resolveMediaFileForAnalysis = async (urlOrKey) => {
  if (!urlOrKey) return { localPath: null, r2Key: null, isTemp: false };

  // Case A: Cloudflare R2 / S3 Key (e.g. interviews/id/video/clip.webm)
  if (urlOrKey.startsWith("interviews/") || urlOrKey.startsWith("resumes/") || urlOrKey.startsWith("http")) {
    const key = urlOrKey.startsWith("http")
      ? urlOrKey.split(".cloudflarestorage.com/")[1] || urlOrKey.split("/uploads/")[1] || urlOrKey
      : urlOrKey;

    try {
      const downloadUrl = await storageService.getPresignedDownloadUrl({ key });
      const response = await axios.get(downloadUrl, { responseType: "arraybuffer" });
      
      const tempFilename = `temp-${Date.now()}-${path.basename(key) || 'media.webm'}`;
      const tempPath = path.join(TEMP_DIR, tempFilename);
      await fs.promises.writeFile(tempPath, response.data);

      return { localPath: tempPath, r2Key: key, isTemp: true };
    } catch (err) {
      console.warn(`[Storage] Failed to download R2 object (${key}), checking local disk:`, err.message);
    }
  }

  // Case B: Local Uploads Disk Fallback
  const filename = urlOrKey.includes("/uploads/") ? urlOrKey.split("/uploads/")[1] : path.basename(urlOrKey);
  const localPath = path.resolve(UPLOADS_DIR, filename);

  try {
    await fs.promises.access(localPath, fs.constants.R_OK);
    return { localPath, r2Key: null, isTemp: false };
  } catch (err) {
    console.error(`[Storage] Media file unreadable locally: ${filename}`);
    return { localPath: null, r2Key: null, isTemp: false };
  }
};

export const sendToAnalyzer = async (filePath, targetUrl, fieldName, referenceImagePath = null) => {
  if (!filePath) return {};

  const formData = new FormData();
  const ext = path.extname(filePath) || ".webm";
  const filename = path.basename(filePath);
  const contentType = ext === ".wav" ? "audio/wav" : (ext === ".mp4" ? "video/mp4" : "audio/webm");

  formData.append(fieldName, fs.createReadStream(filePath), {
    filename,
    contentType,
  });

  if (referenceImagePath) {
    formData.append("reference_image", fs.createReadStream(referenceImagePath), {
      filename: path.basename(referenceImagePath),
      contentType: "image/jpeg",
    });
  }

  const response = await axios.post(`${targetUrl}/analyze`, formData, {
    headers: formData.getHeaders(),
    timeout: 45000,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Non-2xx status code: ${response.status}`);
  }

  return response.data.data || {};
};

const sendTextToAnalyzer = async (text, targetUrl, questionPrompt = "Technical Writing Assessment") => {
  if (!text) return {};
  const response = await axios.post(
    `${targetUrl}/analyze`,
    {
      text,
      transcript: text,
      question: questionPrompt,
      questionType: "technical",
    },
    { timeout: 45000 },
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Non-2xx status code: ${response.status}`);
  }
  return response.data.data || {};
};

export const processSession = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error("Session not found");

  try {
    // Process Technical Writing Submission if present
    if (session.writingSubmission && !session.writingAnalysis) {
      try {
        const writingPrompt = session.writingTask || "Technical Writing Assessment";
        const nlpResult = await sendTextToAnalyzer(
          session.writingSubmission,
          NLP_SERVICE_URL,
          writingPrompt,
        );
        session.writingAnalysis = nlpResult;
        await session.save();
      } catch (err) {
        console.error(`[Worker] Error processing writing submission:`, err.message);
      }
    }

    // Process Per-Answer Media Telemetry
    if (session.answers && session.answers.length > 0) {
      for (let i = 0; i < session.answers.length; i++) {
        const answer = session.answers[i];

        // Face Analysis
        if (answer.videoUrl) {
          const { localPath: videoPath, isTemp: isVideoTemp } = await resolveMediaFileForAnalysis(answer.videoUrl);
          let refPath = null;
          let isRefTemp = false;

          if (session.referenceImageUrl) {
            const refRes = await resolveMediaFileForAnalysis(session.referenceImageUrl);
            refPath = refRes.localPath;
            isRefTemp = refRes.isTemp;
          }

          if (videoPath) {
            try {
              const faceData = await sendToAnalyzer(
                videoPath,
                FACE_SERVICE_URL,
                "video",
                refPath,
              );
              answer.faceAnalysis = faceData;
              if (faceData.faceSubstitutionAlert === true) {
                session.faceSubstitutionAlert = true;
                console.warn(`[Worker] Face substitution alert flagged for answer ${answer._id}`);
              }
            } catch (err) {
              console.error(`[Worker] Face service error for answer ${answer._id}:`, err.message);
            } finally {
              if (isVideoTemp && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
              }
              if (isRefTemp && refPath && fs.existsSync(refPath)) {
                fs.unlinkSync(refPath);
              }
            }
          }
        }

        // Voice Analysis
        const audioUrlOrKey = answer.audioUrl || answer.videoUrl;
        if (audioUrlOrKey) {
          const { localPath: audioPath, isTemp: isAudioTemp } = await resolveMediaFileForAnalysis(audioUrlOrKey);
          if (audioPath) {
            try {
              const voiceData = await sendToAnalyzer(
                audioPath,
                VOICE_SERVICE_URL,
                "audio",
              );
              answer.voiceAnalysis = voiceData;
            } catch (err) {
              console.error(`[Worker] Voice service error for answer ${answer._id}:`, err.message);
            } finally {
              if (isAudioTemp && fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
              }
            }
          }
        }

        await session.save();
      }
    }

    // Mark session as completed
    await Session.findByIdAndUpdate(sessionId, {
      $set: { jobStatus: "completed", status: "completed" },
    });
    console.log(`[Worker] Successfully completed session analysis: ${sessionId}`);
  } catch (error) {
    console.error(`[Worker] Failure for session ${sessionId}:`, error.message);
    await Session.findByIdAndUpdate(sessionId, {
      $set: { jobStatus: "completed", status: "completed" },
    });
  }
};

/**
 * Startup recovery routine to resume any session stuck in 'processing'
 */
export const recoverJobs = async () => {
  try {
    const stuckSessions = await Session.find({ jobStatus: "processing" });
    for (const session of stuckSessions) {
      console.log(`[Job Recovery] Rescheduling stuck session: ${session._id}`);
      await Session.updateOne({ _id: session._id }, { jobStatus: null });
      await startAnalysis(session._id);
    }
  } catch (err) {
    console.error("[Job Recovery] Error during recovery:", err.message);
  }
};

export default {
  startAnalysis,
  processSession,
  recoverJobs,
};
