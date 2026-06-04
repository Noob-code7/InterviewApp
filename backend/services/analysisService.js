import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import axios from "axios";
import path from "path";
import fs from "fs";
import FormData from "form-data";
import { fileURLToPath } from "url";
import Session from "../models/Session.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 1000, 5000);
  },
});

// Log Redis connection errors
connection.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL || "http://127.0.0.1:8001";
const VOICE_SERVICE_URL =
  process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002";
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

// Setup BullMQ Queues
export const analysisQueue = new Queue("analysis-queue", { connection });
const dlqQueue = new Queue("analysis-queue-dlq", { connection });

/**
 * Triggers analysis. Uses atomic updates to enforce idempotency.
 */
export const startAnalysis = async (sessionId) => {
  if (connection.status !== "ready" && connection.status !== "connecting") {
    throw new Error("Redis is unavailable");
  }

  const session = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      jobStatus: { $nin: ["processing", "completed", "queued"] },
    },
    { $set: { jobStatus: "queued", status: "processing" } },
    { new: true },
  );

  if (!session) {
    console.log(
      `[Job] Session ${sessionId} is already queued, processing, or completed.`,
    );
    return false;
  }

  try {
    await analysisQueue.add(
      "process-session",
      { sessionId },
      {
        timeout: 300000, // 5 minutes
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 }, // 1000, 2000, 4000
      },
    );
    return true;
  } catch (err) {
    console.error(`[Job] Failed to enqueue session ${sessionId}:`, err.message);
    // Rollback and mark failed
    await Session.updateOne(
      { _id: sessionId },
      { $set: { jobStatus: "failed", status: "failed" } },
    );
    throw new Error("Failed to connect to job queue");
  }
};

/**
 * Startup recovery routine to resume any session stuck in 'processing'
 */
export const recoverJobs = async () => {
  const stuckSessions = await Session.find({
    jobStatus: { $in: ["processing", "queued"] },
  });
  for (const session of stuckSessions) {
    console.log(`[Job Recovery] Re-queuing stuck session: ${session._id}`);
    session.jobStatus = "queued";
    await session.save();
    await analysisQueue.add(
      "process-session",
      { sessionId: session._id },
      {
        timeout: 300000,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );
  }
};

/**
 * Validates and canonicalizes file path.
 * Must be within UPLOADS_DIR and be a .webm file without null bytes.
 */
const getValidatedFilePath = async (filename) => {
  if (!filename) return null;
  if (filename.includes("\0"))
    throw new Error("Null bytes not allowed in filename");
  if (!filename.toLowerCase().endsWith(".webm"))
    throw new Error("Only .webm files are allowed");

  // Prevent path traversal
  const resolvedPath = path.resolve(UPLOADS_DIR, filename);
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error("Path traversal detected");
  }

  try {
    await fs.promises.access(resolvedPath, fs.constants.R_OK);
  } catch (err) {
    throw new Error(`File not found or unreadable: ${filename}`);
  }

  return resolvedPath;
};

/**
 * Sends a file to the microservice via Axios.
 */
export const sendToAnalyzer = async (filePath, targetUrl, fieldName, referenceImagePath = null) => {
  if (!filePath) return {};

  const formData = new FormData();
  formData.append(fieldName, fs.createReadStream(filePath));

  if (referenceImagePath) {
    formData.append("reference_image", fs.createReadStream(referenceImagePath));
  }

  const response = await axios.post(`${targetUrl}/analyze`, formData, {
    headers: formData.getHeaders(),
    timeout: 45000, // 45s timeout
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Non-2xx status code: ${response.status}`);
  }

  return response.data.data || {};
};

/**
 * Sends text to the NLP microservice and returns parsed analysis.
 */
const sendTextToAnalyzer = async (text, targetUrl) => {
  if (!text) return {};
  const response = await axios.post(
    `${targetUrl}/analyze`,
    { text },
    { timeout: 45000 },
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Non-2xx status code: ${response.status}`);
  }
  return response.data.data || {};
};

// Setup BullMQ Worker
const worker = new Worker(
  "analysis-queue",
  async (job) => {
    const { sessionId } = job.data;
    console.log(`[Worker] Started processing session: ${sessionId}`);

    // Atomic state change to processing
    const session = await Session.findOneAndUpdate(
      { _id: sessionId, jobStatus: { $in: ["queued", "failed"] } },
      { $set: { jobStatus: "processing" } },
      { new: true },
    );

    if (!session)
      throw new Error(
        `Session ${sessionId} not found or already processing/completed`,
      );

    try {
      // If there's a writing submission, process it first (single-shot text analysis)
      if (session.writingSubmission && !session.writingAnalysis) {
        try {
          const nlpResult = await sendTextToAnalyzer(
            session.writingSubmission,
            NLP_SERVICE_URL,
          );
          session.writingAnalysis = nlpResult;
          await session.save();
        } catch (err) {
          console.error(
            `[Worker] Error processing writing submission for session ${session._id}:`,
            err.message,
          );
          throw err;
        }
      }

      for (let i = 0; i < session.answers.length; i++) {
        const answer = session.answers[i];

        // Face Analysis
        if (answer.videoUrl) {
          try {
            const videoFilename = answer.videoUrl.split("/uploads/")[1];
            const videoPath = await getValidatedFilePath(videoFilename);
            
            let referenceImagePath = null;
            if (session.referenceImageUrl) {
              const refFilename = session.referenceImageUrl.split("/uploads/")[1];
              try {
                referenceImagePath = await getValidatedFilePath(refFilename);
              } catch(e) {
                console.error(`[Worker] Reference image not found for session ${session._id}`);
              }
            }

            if (videoPath) {
              console.log(
                `[Worker] Sending video for answer ${answer._id} to Face Service`,
              );
              const faceData = await sendToAnalyzer(
                videoPath,
                FACE_SERVICE_URL,
                "video",
                referenceImagePath
              );
              answer.faceAnalysis = faceData;
              
              if (faceData.faceSubstitutionAlert) {
                session.faceSubstitutionAlert = true;
              }
            }
          } catch (err) {
            console.error(
              `[Worker] Error processing video for answer ${answer._id}:`,
              err.message,
            );
            throw err; // Treat violations/errors as job failures
          }
        }

        // Voice Analysis
        if (answer.audioUrl || answer.videoUrl) {
          try {
            // Fallback to video if audio not explicitly saved
            const audioUrl = answer.audioUrl || answer.videoUrl;
            const audioFilename = audioUrl.split("/uploads/")[1];
            const audioPath = await getValidatedFilePath(audioFilename);
            if (audioPath) {
              console.log(
                `[Worker] Sending audio for answer ${answer._id} to Voice Service`,
              );
              const voiceData = await sendToAnalyzer(
                audioPath,
                VOICE_SERVICE_URL,
                "audio",
              );
              answer.voiceAnalysis = voiceData;
            }
          } catch (err) {
            console.error(
              `[Worker] Error processing audio for answer ${answer._id}:`,
              err.message,
            );
            throw err; // Treat violations/errors as job failures
          }
        }

        // Persist intermediate progress
        await session.save();
      }

      session.jobStatus = "completed";
      session.status = "completed";
      await session.save();
      console.log(`[Worker] Successfully completed session: ${sessionId}`);
    } catch (error) {
      console.error(
        `[Worker] Unrecoverable failure for session ${sessionId}:`,
        error.message,
      );
      // We only mark as failed if retries are exhausted (BullMQ will retry if we throw,
      // but we need to track if it's the last attempt. For simplicity, we let BullMQ
      // retry and handle failure on the 'failed' event)
      throw error;
    }
  },
  { connection },
);

worker.on("failed", async (job, err) => {
  const { sessionId } = job.data;
  console.error(
    `[Worker] Job ${job.id} failed for session ${sessionId}: ${err.message}`,
  );

  if (job.attemptsMade >= job.opts.attempts) {
    console.error(`[Worker] Job ${job.id} exhausted retries. Moving to DLQ.`);
    await dlqQueue.add("dead-letter", job.data);

    const session = await Session.findById(sessionId);
    if (session) {
      session.jobStatus = "failed";
      session.status = "failed";
      await session.save();
    }
  }
});
