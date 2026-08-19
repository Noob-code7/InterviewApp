import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";

const clampScore = (score) => {
  if (typeof score !== "number" || isNaN(score)) return 0.0;
  return Math.min(100.0, Math.max(0.0, score));
};

/**
 * Multi-Track & Multimodal Report Aggregator (Phase 6)
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

    // 3. Multi-Track Verbal NLP Evaluation Aggregation
    let nlpScoreSum = 0;
    let validNlpCount = 0;
    const allStrengths = [];
    const allImprovements = [];

    const trackScores = {
      hr: { sum: 0, count: 0 },
      subject: { sum: 0, count: 0 },
      project: { sum: 0, count: 0 },
    };

    answers.forEach((ans) => {
      const nlp = ans.nlpAnalysis;
      const track = ans.track || "subject";

      if (nlp && typeof nlp.overallScore === "number") {
        nlpScoreSum += nlp.overallScore;
        validNlpCount++;

        if (trackScores[track]) {
          trackScores[track].sum += nlp.overallScore;
          trackScores[track].count += 1;
        }

        if (Array.isArray(nlp.strengths)) {
          allStrengths.push(...nlp.strengths);
        }
        if (Array.isArray(nlp.improvements)) {
          allImprovements.push(...nlp.improvements);
        }
      }

      // Also incorporate follow-up scores
      if (ans.followUps && ans.followUps.length > 0) {
        ans.followUps.forEach((f) => {
          if (f.nlpAnalysis && typeof f.nlpAnalysis.overallScore === "number") {
            nlpScoreSum += f.nlpAnalysis.overallScore;
            validNlpCount++;
            trackScores.project.sum += f.nlpAnalysis.overallScore;
            trackScores.project.count += 1;

            if (Array.isArray(f.nlpAnalysis.strengths)) allStrengths.push(...f.nlpAnalysis.strengths);
            if (Array.isArray(f.nlpAnalysis.improvements)) allImprovements.push(...f.nlpAnalysis.improvements);
          }
        });
      }
    });

    const nlpScore = validNlpCount > 0
      ? clampScore(Math.round(nlpScoreSum / validNlpCount))
      : 0.0;

    const trackBreakdown = {
      hrScore: trackScores.hr.count > 0 ? Math.round(trackScores.hr.sum / trackScores.hr.count) : null,
      subjectScore: trackScores.subject.count > 0 ? Math.round(trackScores.subject.sum / trackScores.subject.count) : null,
      projectScore: trackScores.project.count > 0 ? Math.round(trackScores.project.sum / trackScores.project.count) : null,
    };

    const consolidatedStrengths = [...new Set(allStrengths)];
    const consolidatedImprovements = [...new Set(allImprovements)];

    if (consolidatedStrengths.length === 0) {
      consolidatedStrengths.push("Demonstrated structured response attempt during interview session.");
    }
    if (consolidatedImprovements.length === 0) {
      consolidatedImprovements.push("Provide deeper technical architectural details and trade-offs.");
      consolidatedImprovements.push("Review core domain concepts and practice concise verbal explanations.");
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

    // 5. Compute Weighted Composite Score
    let overallScore = 0;
    if (validNlpCount > 0 || validVoiceCount > 0 || validFaceCount > 0 || validWriting) {
      let totalWeighted = 0;
      let weightSum = 0;

      if (validNlpCount > 0) {
        totalWeighted += nlpScore * 0.40;
        weightSum += 0.40;
      }
      if (validVoiceCount > 0) {
        totalWeighted += voiceScore * 0.25;
        weightSum += 0.25;
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

    // 7. Atomic DB Update
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
      trackBreakdown,
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
