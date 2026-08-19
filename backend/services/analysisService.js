import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import FormData from "form-data";
import mongoose from "mongoose";
import { Queue } from "bullmq";
import Session from "../models/Session.js";
import Question from "../models/Question.js";
import storageService from "./storageService.js";
import llmService from "./llmService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Queue definition – uses Redis if available, with resilient in-process fallback
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let analysisQueue = null;
try {
  const urlObj = new URL(REDIS_URL);
  analysisQueue = new Queue("analysis-processing", {
    connection: {
      host: urlObj.hostname || "127.0.0.1",
      port: Number(urlObj.port) || 6379,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
  analysisQueue.on("error", () => {});
} catch (err) {
  // Silent fallback to in-process execution
}

export { analysisQueue };

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://127.0.0.1:8001";
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8002";
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const TEMP_DIR = path.join(UPLOADS_DIR, "temp");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ── Cross-session analysis concurrency ─────────────────────────────────────────
// ANALYSIS_SESSION_CONCURRENCY caps how many sessions are analyzed in parallel
// on this machine. Unset => unlimited, matching the original behavior. Set it for
// single-box deployments (e.g. a college lab PC) so many simultaneous submissions
// do not overwhelm the CPU. ANALYSIS_CONCURRENCY (intra-session parallel answers)
// is configured separately inside processSession.
const SESSION_CONCURRENCY = (() => {
  const v = parseInt(process.env.ANALYSIS_SESSION_CONCURRENCY, 10);
  return Number.isFinite(v) && v > 0 ? v : null;
})();
const activeSessions = new Set();
const waitingSessions = new Set();
const queuedSessions = [];
let pumpRunning = false;

const pumpSessionQueue = async () => {
  if (pumpRunning) return;
  pumpRunning = true;
  try {
    while (
      queuedSessions.length > 0 &&
      (SESSION_CONCURRENCY === null || activeSessions.size < SESSION_CONCURRENCY)
    ) {
      const sessionId = queuedSessions.shift();
      waitingSessions.delete(sessionId);
      activeSessions.add(sessionId);
      try {
        await Session.findByIdAndUpdate(sessionId, { $set: { jobStatus: "processing" } });
      } catch (err) {
        console.error("[AnalysisService] Failed to mark session processing:", err.message);
        activeSessions.delete(sessionId);
        continue;
      }
      processSession(sessionId)
        .catch((procErr) => {
          console.error("[AnalysisService] In-process processing failed:", procErr.message);
        })
        .finally(() => {
          activeSessions.delete(sessionId);
          pumpSessionQueue();
        });
    }
  } finally {
    pumpRunning = false;
  }
};

export const startAnalysis = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const sid = session._id.toString();

  // Idempotency: a session already running or waiting in-process is not restarted.
  if (activeSessions.has(sid) || waitingSessions.has(sid)) {
    return { jobId: sid, status: activeSessions.has(sid) ? "processing" : "queued" };
  }

  // Attempt to add to BullMQ queue if Redis is alive (original behavior preserved)
  if (analysisQueue) {
    try {
      await Session.findByIdAndUpdate(sid, { $set: { jobStatus: "processing" } });
      const job = await analysisQueue.add(
        "process-session",
        { sessionId: sid },
        { jobId: sid },
      );
      return { jobId: job.id, status: "queued" };
    } catch (err) {
      // Fallback to in-process execution
    }
  }

  // Process asynchronously in-process (original behavior when no cap is set)
  if (SESSION_CONCURRENCY === null) {
    await Session.findByIdAndUpdate(sid, { $set: { jobStatus: "processing" } });
    setTimeout(() => {
      processSession(sid).catch((procErr) => {
        console.error("[AnalysisService] In-process processing failed:", procErr.message);
      });
    }, 100);
    return { jobId: sid, status: "processing_inline" };
  }

  // Cross-session cap: persist 'queued' and wait for a free slot.
  waitingSessions.add(sid);
  queuedSessions.push(sid);
  await Session.findByIdAndUpdate(sid, { $set: { jobStatus: "queued" } });
  pumpSessionQueue();
  return { jobId: sid, status: "queued" };
};

const resolveMediaFileForAnalysis = async (mediaUrlOrKey) => {
  if (!mediaUrlOrKey) return { localPath: null, isTemp: false };

  // Case 1: Local filesystem path
  if (fs.existsSync(mediaUrlOrKey)) {
    return { localPath: mediaUrlOrKey, isTemp: false };
  }

  // Case 2: Relative uploads path
  const localRelative = path.resolve(__dirname, "..", mediaUrlOrKey.replace(/^\//, ""));
  if (fs.existsSync(localRelative)) {
    return { localPath: localRelative, isTemp: false };
  }

  // Case 3: Remote Cloudflare R2 / S3 Object Key or URL
  try {
    const key =
      mediaUrlOrKey.split(".cloudflarestorage.com/")[1] ||
      mediaUrlOrKey.split("/uploads/")[1] ||
      mediaUrlOrKey;

    const ext = path.extname(key) || ".webm";
    const tempFilePath = path.join(TEMP_DIR, `temp-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);

    const buffer = await storageService.getObjectBuffer({ key });
    fs.writeFileSync(tempFilePath, buffer);
    return { localPath: tempFilePath, isTemp: true };
  } catch (err) {
    console.error(`[StorageResolution] Failed to fetch remote object ${mediaUrlOrKey}:`, err.message);
    return { localPath: null, isTemp: false };
  }
};

export const sendToAnalyzer = async (filePath, targetUrl, fieldName, referenceImagePath = null) => {
  if (!filePath) return {};

  const formData = new FormData();
  const ext = path.extname(filePath) || ".webm";
  const filename = path.basename(filePath);
  const isVideoField = fieldName === "video";
  const contentType = isVideoField
    ? (ext === ".mp4" ? "video/mp4" : "video/webm")
    : (ext === ".wav" ? "audio/wav" : "audio/webm");

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

const sendTextToAnalyzer = async (payloadOrText, targetUrl, fallbackPrompt = "Technical Assessment") => {
  if (!payloadOrText) return {};
  const payload = typeof payloadOrText === "string" ? {
    text: payloadOrText,
    transcript: payloadOrText,
    question: fallbackPrompt,
    questionType: "technical",
  } : payloadOrText;

  const response = await axios.post(
    `${targetUrl}/analyze`,
    payload,
    { timeout: 45000 },
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Non-2xx status code: ${response.status}`);
  }
  return response.data.data || {};
};

/**
 * Lightweight async concurrency pool / semaphore.
 */
export function createConcurrencyLimiter(limit = 2) {
  let active = 0;
  const queue = [];

  const runNext = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--;
        runNext();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

export const processSession = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error("Session not found");

  try {
    // 1. Process Technical Writing Submission concurrently if present
    const writingPromise = (async () => {
      if (session.writingSubmission && !session.writingAnalysis) {
        try {
          const writingPrompt = session.writingTask || "Technical Writing Assessment";
          const nlpResult = await sendTextToAnalyzer(
            {
              text: session.writingSubmission,
              transcript: session.writingSubmission,
              question: writingPrompt,
              questionType: "technical",
            },
            NLP_SERVICE_URL,
          );
          session.writingAnalysis = nlpResult;
          session.writingScore = nlpResult.overallScore || null;
        } catch (err) {
          console.error("[Worker] Error processing writing submission:", err.message);
        }
      }
    })();

    // 2. Process Per-Answer Media Telemetry & Multi-Track Evaluation with Controlled Concurrency
    const concurrencyLimit = parseInt(process.env.ANALYSIS_CONCURRENCY, 10) || 2;
    const limiter = createConcurrencyLimiter(concurrencyLimit);

    let sessionRefPath = null;
    let isSessionRefTemp = false;
    if (session.referenceImageUrl) {
      const refRes = await resolveMediaFileForAnalysis(session.referenceImageUrl);
      sessionRefPath = refRes.localPath;
      isSessionRefTemp = refRes.isTemp;
    }

    const questionPromises = (session.answers || []).map((answer) =>
      limiter(async () => {
        // 2a. Face Analysis (Video Telemetry)
        const facePromise = (async () => {
          if (!answer.videoUrl) return;
          const { localPath: videoPath, isTemp: isVideoTemp } = await resolveMediaFileForAnalysis(answer.videoUrl);
          if (videoPath) {
            try {
              const faceData = await sendToAnalyzer(
                videoPath,
                FACE_SERVICE_URL,
                "video",
                sessionRefPath,
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
                try { fs.unlinkSync(videoPath); } catch (_) {}
              }
            }
          }
        })();

        // 2b. Voice Analysis (Faster-Whisper STT & SER Speech Emotion)
        const voicePromise = (async () => {
          const audioUrlOrKey = answer.audioUrl || answer.videoUrl;
          if (!audioUrlOrKey) return;
          const { localPath: audioPath, isTemp: isAudioTemp } = await resolveMediaFileForAnalysis(audioUrlOrKey);
          if (audioPath) {
            try {
              const voiceData = await sendToAnalyzer(
                audioPath,
                VOICE_SERVICE_URL,
                "audio",
              );
              const sttTranscript = (voiceData.transcript && voiceData.transcript.trim()) || answer.voiceAnalysis?.transcript || answer.transcript || "";
              answer.voiceAnalysis = {
                ...(answer.voiceAnalysis || {}),
                ...voiceData,
                transcript: sttTranscript,
              };
              answer.transcript = sttTranscript;
            } catch (err) {
              console.error(`[Worker] Voice service error for answer ${answer._id}:`, err.message);
            } finally {
              if (isAudioTemp && fs.existsSync(audioPath)) {
                try { fs.unlinkSync(audioPath); } catch (_) {}
              }
            }
          }
        })();

        // Run Face and Voice analysis concurrently
        await Promise.all([facePromise, voicePromise]);

        // 2c. Intelligent Answer Evaluation Dispatcher (Verbal NLP / LLM)
        const transcript = answer.voiceAnalysis?.transcript || answer.transcript || "";
        const isProjectTrack = answer.track === "project" || Boolean(answer.projectContext);

        if (transcript) {
          try {
            if (isProjectTrack) {
              const projectEval = await llmService.evaluateProjectAnswer(
                answer.projectContext || {},
                answer.questionText,
                transcript,
                false
              );

              if (projectEval && projectEval.overallScore !== undefined) {
                answer.nlpAnalysis = projectEval;
              } else {
                const nlpPayload = {
                  transcript,
                  text: transcript,
                  question: answer.questionText,
                  questionType: "technical",
                  keywords: (answer.projectContext?.techStack || []).map((s) => s.toLowerCase()),
                };
                answer.nlpAnalysis = await sendTextToAnalyzer(nlpPayload, NLP_SERVICE_URL);
              }
            } else {
              let questionDoc = null;
              if (answer.questionId && mongoose.Types.ObjectId.isValid(answer.questionId)) {
                questionDoc = await Question.findById(answer.questionId).lean();
              }
              if (!questionDoc && answer.questionText) {
                questionDoc = await Question.findOne({ questionText: answer.questionText }).lean();
              }

              const nlpPayload = {
                transcript,
                text: transcript,
                question: answer.questionText || questionDoc?.questionText || "Interview Question",
                questionType: answer.track || (session.interviewType === "hr" ? "hr" : "technical"),
                keywords: questionDoc?.keywords || [],
                expectedConcepts: questionDoc?.expectedConcepts || [],
                acceptablePatterns: questionDoc?.acceptablePatterns || [],
                commonMisconceptions: questionDoc?.commonMisconceptions || [],
                scoringRubric: questionDoc?.scoringRubric || null,
                referenceAnswer: questionDoc?.referenceAnswer || "",
              };

              answer.nlpAnalysis = await sendTextToAnalyzer(nlpPayload, NLP_SERVICE_URL);
            }
          } catch (err) {
            console.error(`[Worker] NLP evaluation error for answer ${answer._id}:`, err.message);
          }
        }

        // 2d. Process Follow-Ups if present
        if (answer.followUps && answer.followUps.length > 0) {
          for (let fIdx = 0; fIdx < answer.followUps.length; fIdx++) {
            const followUp = answer.followUps[fIdx];
            const fAudioKey = followUp.audioUrl || followUp.videoUrl;

            if (fAudioKey && !followUp.voiceAnalysis?.transcript) {
              const { localPath: fPath, isTemp: isFTemp } = await resolveMediaFileForAnalysis(fAudioKey);
              if (fPath) {
                try {
                  followUp.voiceAnalysis = await sendToAnalyzer(fPath, VOICE_SERVICE_URL, "audio");
                } catch (vErr) {
                  console.error(`[Worker] Voice error for follow-up ${fIdx}:`, vErr.message);
                } finally {
                  if (isFTemp && fs.existsSync(fPath)) {
                    try { fs.unlinkSync(fPath); } catch (_) {}
                  }
                }
              }
            }

            const fTranscript = followUp.voiceAnalysis?.transcript || followUp.transcript || "";
            if (fTranscript && !followUp.nlpAnalysis?.overallScore) {
              try {
                const fEval = await llmService.evaluateProjectAnswer(
                  answer.projectContext || {},
                  followUp.questionText,
                  fTranscript,
                  true
                );
                if (fEval) followUp.nlpAnalysis = fEval;
              } catch (fEvalErr) {
                console.error(`[Worker] NLP error for follow-up ${fIdx}:`, fEvalErr.message);
              }
            }
          }
        }
      })
    );

    // Wait for writing analysis and all question analyses
    await Promise.all([writingPromise, ...questionPromises]);

    if (isSessionRefTemp && sessionRefPath && fs.existsSync(sessionRefPath)) {
      try { fs.unlinkSync(sessionRefPath); } catch (_) {}
    }

    // Atomic DB save after all parallel work completes
    await session.save();

    // 3. Compute Session-Wide Aggregate Scores
    let totalScoreSum = 0;
    let scoreCount = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const a of session.answers || []) {
      if (a.nlpAnalysis?.overallScore != null) {
        totalScoreSum += a.nlpAnalysis.overallScore;
        scoreCount += 1;
      }
      // Include follow-up evaluations in the session-wide aggregate (project track)
      for (const f of a.followUps || []) {
        if (f.nlpAnalysis?.overallScore != null) {
          totalScoreSum += f.nlpAnalysis.overallScore;
          scoreCount += 1;
        }
      }
      if (a.faceAnalysis?.confidenceScore != null) {
        confidenceSum += a.faceAnalysis.confidenceScore;
        confidenceCount += 1;
      }
      if (a.voiceAnalysis?.confidenceScore != null) {
        confidenceSum += a.voiceAnalysis.confidenceScore;
        confidenceCount += 1;
      }
    }

    const overallScore = scoreCount > 0 ? Math.round(totalScoreSum / scoreCount) : 0;
    const confidenceScore = confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 0;

    let readinessLevel = "low";
    if (overallScore >= 85) readinessLevel = "market-ready";
    else if (overallScore >= 75) readinessLevel = "high";
    else if (overallScore >= 60) readinessLevel = "medium";

    // Mark session as completed
    await Session.findByIdAndUpdate(sessionId, {
      $set: {
        jobStatus: "completed",
        status: "completed",
        overallScore,
        confidenceScore,
        readinessLevel,
        completedAt: new Date(),
      },
    });
    console.log(`[Worker] Successfully completed session analysis: ${sessionId} (Overall: ${overallScore}%, Readiness: ${readinessLevel})`);

    // Delete all recorded media now that analysis & scoring are complete
    try {
      await deleteSessionMedia(sessionId);
    } catch (err) {
      console.error(`[MediaCleanup] Cleanup failed for session ${sessionId}:`, err.message);
    }
  } catch (error) {
    console.error(`[Worker] Failure for session ${sessionId}:`, error.message);
    await Session.findByIdAndUpdate(sessionId, {
      $set: { jobStatus: "failed", status: "failed" },
    });
  }
};

/**
 * Deletes all recorded interview media after analysis & scoring have completed.
 */
export const deleteSessionMedia = async (sessionId) => {
  if (process.env.KEEP_MEDIA_AFTER_ANALYSIS === "true") {
    console.log(
      `[MediaCleanup] Skipping media deletion for session ${sessionId} (KEEP_MEDIA_AFTER_ANALYSIS=true)`,
    );
    return false;
  }

  const session = await Session.findById(sessionId);
  if (!session) return false;

  const failed = [];
  let deletedCount = 0;

  const deleteRef = async (urlOrKey) => {
    if (!urlOrKey) return true;
    const isRemoteKey =
      urlOrKey.startsWith("interviews/") ||
      urlOrKey.startsWith("resumes/") ||
      urlOrKey.startsWith("http");

    try {
      const { localPath } = await resolveMediaFileForAnalysis(urlOrKey);
      if (localPath && fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }

      if (isRemoteKey) {
        const key =
          urlOrKey.split(".cloudflarestorage.com/")[1] ||
          urlOrKey.split("/uploads/")[1] ||
          urlOrKey;
        await storageService.deleteObject({ key });
      }

      return true;
    } catch (err) {
      failed.push(urlOrKey);
      console.error(`[MediaCleanup] Failed to delete media ${urlOrKey}:`, err.message);
      return false;
    }
  };

  for (const answer of session.answers || []) {
    const videoGone = await deleteRef(answer.videoUrl);
    if (videoGone && answer.videoUrl) {
      answer.videoUrl = "";
      deletedCount += 1;
    }

    if (answer.audioUrl && answer.audioUrl !== answer.videoUrl) {
      const audioGone = await deleteRef(answer.audioUrl);
      if (audioGone) {
        answer.audioUrl = "";
        deletedCount += 1;
      }
    }

    for (const f of answer.followUps || []) {
      if (f.videoUrl) {
        await deleteRef(f.videoUrl);
        f.videoUrl = "";
      }
      if (f.audioUrl) {
        await deleteRef(f.audioUrl);
        f.audioUrl = "";
      }
    }
  }

  if (session.referenceImageUrl) {
    const refGone = await deleteRef(session.referenceImageUrl);
    if (refGone) {
      session.referenceImageUrl = "";
      deletedCount += 1;
    }
  }

  if (deletedCount > 0) {
    session.mediaDeleted = true;
    await session.save();
  }

  console.log(
    `[MediaCleanup] Session ${sessionId}: removed ${deletedCount} media reference(s)` +
      (failed.length ? `, ${failed.length} failed: ${failed.join(", ")}` : ""),
  );
  return true;
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

/**
 * Periodic recovery sweep: re-queues any session left in 'processing' past a
 * staleness threshold (e.g. after a crash/reboot mid-analysis) so sessions never
 * stay permanently stuck. Works alongside recoverJobs (boot-time recovery).
 */
export const startRecoverySweep = (intervalMs = 60_000, staleMs = 10 * 60_000) => {
  const interval = setInterval(async () => {
    try {
      const staleBefore = new Date(Date.now() - staleMs);
      const stuckSessions = await Session.find({
        jobStatus: "processing",
        updatedAt: { $lt: staleBefore },
      });
      for (const session of stuckSessions) {
        console.log(`[Job Recovery] Requeueing stale session: ${session._id}`);
        await Session.updateOne({ _id: session._id }, { jobStatus: null });
        await startAnalysis(session._id);
      }
    } catch (err) {
      console.error("[Job Recovery] Sweep error:", err.message);
    }
  }, intervalMs);
  if (interval.unref) interval.unref();
  return interval;
};

export default {
  startAnalysis,
  processSession,
  deleteSessionMedia,
  recoverJobs,
  startRecoverySweep,
};

