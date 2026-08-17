import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";

const clampScore = (val) => Math.max(0, Math.min(100, Number(val) || 0));

/**
 * ── GET /api/reports/:sessionId ──────────────────────────────────────────────
 * Aggregates candidate multimodal evaluations and returns/persists a consistent report.
 * Enforces strict DBMS rules:
 *   - Type checking & boundary validation (0-100)
 *   - Atomic MongoDB document updates
 *   - Real voice emotion distribution (8 emotions) & facial analysis
 *   - Deduplicated consolidated feedback lists
 */
export const getReport = async (req, res) => {
  try {
    const { sessionId } = req.params;

    let session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) {
      session = await Session.findById(sessionId);
    }

    if (!session) {
      return sendError(res, "Session not found", 404);
    }

    const answers = session.answers || [];

    // 1. Aggregate Face Emotion & Posture Confidence Scores
    let faceScoreSum = 0;
    let validFaceCount = 0;
    let faceNotes = [];
    answers.forEach((ans) => {
      if (ans.faceAnalysis && typeof ans.faceAnalysis.confidenceScore === "number") {
        faceScoreSum += ans.faceAnalysis.confidenceScore;
        validFaceCount++;
        if (Array.isArray(ans.faceAnalysis.notes)) {
          faceNotes.push(...ans.faceAnalysis.notes);
        }
      }
    });
    const faceScore = validFaceCount > 0
      ? clampScore(Math.round(faceScoreSum / validFaceCount))
      : 0.0;

    // 2. Aggregate Voice SER Emotion Distribution (8 Emotions)
    let voiceScoreSum = 0;
    let validVoiceCount = 0;
    const emotionTotals = {
      neutral: 0,
      calm: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgust: 0,
      surprised: 0,
    };
    let emotionCount = 0;

    answers.forEach((ans) => {
      const v = ans.voiceAnalysis;
      if (v) {
        if (typeof v.confidenceScore === "number" && v.confidenceScore > 0) {
          voiceScoreSum += v.confidenceScore;
          validVoiceCount++;
        } else if (typeof v.overallToneScore === "number") {
          voiceScoreSum += v.overallToneScore;
          validVoiceCount++;
        } else if (typeof v.fluencyScore === "number") {
          voiceScoreSum += v.fluencyScore;
          validVoiceCount++;
        }

        if (v.emotionProbabilities && typeof v.emotionProbabilities === "object") {
          Object.keys(emotionTotals).forEach((key) => {
            if (typeof v.emotionProbabilities[key] === "number") {
              emotionTotals[key] += v.emotionProbabilities[key];
            }
          });
          emotionCount++;
        }
      }
    });

    const voiceScore = validVoiceCount > 0
      ? clampScore(Math.round(voiceScoreSum / validVoiceCount))
      : 0.0;

    // Calculate normalized 8-emotion spectrum percentages
    const voiceEmotions = {};
    let topEmotion = "neutral";
    let topVal = -1;

    Object.keys(emotionTotals).forEach((key) => {
      const avg = emotionCount > 0 ? (emotionTotals[key] / emotionCount) : 0;
      const pct = Math.round(avg * 100);
      voiceEmotions[key] = pct;
      if (avg > topVal) {
        topVal = avg;
        topEmotion = key;
      }
    });
    voiceEmotions.dominant = topEmotion;

    // 3. Aggregate Verbal NLP Evaluation Scores (Phase 5 Engine)
    let nlpScoreSum = 0;
    let validNlpCount = 0;
    const allStrengths = [];
    const allImprovements = [];

    answers.forEach((ans) => {
      const nlp = ans.nlpAnalysis;
      if (nlp) {
        if (typeof nlp.overallScore === "number") {
          nlpScoreSum += nlp.overallScore;
          validNlpCount++;
        } else if (typeof nlp.relevanceScore === "number") {
          nlpScoreSum += nlp.relevanceScore;
          validNlpCount++;
        }

        if (Array.isArray(nlp.strengths)) {
          allStrengths.push(...nlp.strengths);
        }
        if (Array.isArray(nlp.improvements)) {
          allImprovements.push(...nlp.improvements);
        }
      }
    });

    const nlpScore = validNlpCount > 0
      ? clampScore(Math.round(nlpScoreSum / validNlpCount))
      : 0.0;

    // Deduplicate feedback arrays for DB consistency
    const consolidatedStrengths = [...new Set(allStrengths)];
    const consolidatedImprovements = [...new Set(allImprovements)];

    if (consolidatedStrengths.length === 0) {
      if (validNlpCount > 0) {
        consolidatedStrengths.push("Demonstrated response attempt during interview session.");
      } else {
        consolidatedStrengths.push("Attempted interview setup and video recording.");
      }
    }
    if (consolidatedImprovements.length === 0) {
      consolidatedImprovements.push("Provide deeper technical architectural details in responses.");
      consolidatedImprovements.push("Ensure microphone and camera capture clear audio and visual telemetry.");
    }

    // 4. Aggregate Writing Test Scores if present
    let writingScore = 0.0;
    let validWriting = false;
    if (session.writingAnalysis) {
      const w = session.writingAnalysis;
      const subScores = [
        w.relevanceScore,
        w.structureScore,
        w.grammarScore,
        w.completenessScore,
      ].filter((s) => typeof s === "number");
      if (subScores.length > 0) {
        writingScore = clampScore(
          Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length)
        );
        validWriting = true;
      }
    }

    // 5. Compute Weighted Overall Composite Score
    // Weight Distribution: NLP (35%) + Voice (30%) + Face (25%) + Writing (10%)
    let overallScore = 0;
    if (validNlpCount > 0 || validVoiceCount > 0 || validFaceCount > 0 || validWriting) {
      const activeWeights = [];
      let totalWeighted = 0;
      let weightSum = 0;

      if (validNlpCount > 0) {
        totalWeighted += nlpScore * 0.35;
        weightSum += 0.35;
      }
      if (validVoiceCount > 0) {
        totalWeighted += voiceScore * 0.30;
        weightSum += 0.30;
      }
      if (validFaceCount > 0) {
        totalWeighted += faceScore * 0.25;
        weightSum += 0.25;
      }
      if (validWriting) {
        totalWeighted += writingScore * 0.10;
        weightSum += 0.10;
      }

      overallScore = weightSum > 0 ? clampScore(Math.round(totalWeighted / weightSum)) : 0;
    }

    // 6. Compute Readiness Level Category
    let readinessLevel = "low";
    if (overallScore >= 85) readinessLevel = "market-ready";
    else if (overallScore >= 75) readinessLevel = "high";
    else if (overallScore >= 60) readinessLevel = "medium";

    // 7. Atomic DB Update to guarantee MongoDB consistency
    const reportPayload = {
      sessionId: session._id,
      role: session.role || "General Engineer",
      interviewType: session.interviewType || "mixed",
      status: session.status,
      overallScore,
      readinessLevel,
      breakdown: {
        relevance: nlpScore,
        technicalAccuracy: nlpScore,
        communication: voiceScore > 0 ? voiceScore : nlpScore,
        confidence: faceScore > 0 ? faceScore : voiceScore,
      },
      detailedScores: {
        nlpVerbalScore: nlpScore,
        voiceSerScore: voiceScore,
        faceVisualScore: faceScore,
        writingTestScore: writingScore,
      },
      voiceEmotions,
      faceNotes: [...new Set(faceNotes)],
      strengths: consolidatedStrengths,
      improvements: consolidatedImprovements,
      faceSubstitutionAlert: Boolean(session.faceSubstitutionAlert),
      answers: session.answers || [],
      candidateName: session.candidateName || "Candidate Student",
      department: session.department || "",
      rollNo: session.rollNo || "",
      graduationYear: session.graduationYear || "",
      resumeText: session.resumeText || "",
      writingSubmission: session.writingSubmission || "",
    };

    // Update MongoDB document atomically
    await Session.findByIdAndUpdate(
      session._id,
      {
        $set: {
          reportData: reportPayload,
          overallScore,
          readinessLevel,
        },
      },
      { new: true }
    );

    return sendSuccess(res, reportPayload, 200);
  } catch (err) {
    console.error("[ReportController] Error generating candidate report:", err.message);
    return sendError(res, err.message, 500);
  }
};
