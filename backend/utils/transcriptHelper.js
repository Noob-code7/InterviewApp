/**
 * Safely merges an existing partial transcript with a continuation transcript after barge-in.
 * 
 * Handles:
 * 1. Empty strings (returns the non-empty one)
 * 2. Full containment (if T2 already contains T1 or T1 contains T2)
 * 3. Word-level sliding window overlap deduplication (if candidate repeats overlapping words)
 * 4. Clean concatenation with proper spacing
 */
export function mergeTranscripts(existingText = "", newText = "") {
  const t1 = (existingText || "").trim();
  const t2 = (newText || "").trim();

  if (!t1) return t2;
  if (!t2) return t1;

  // Case 1: Identical strings
  if (t1.toLowerCase() === t2.toLowerCase()) {
    return t1;
  }

  const t1Lower = t1.toLowerCase();
  const t2Lower = t2.toLowerCase();

  // Case 2: Direct containment
  if (t2Lower.startsWith(t1Lower)) {
    return t2;
  }
  if (t1Lower.endsWith(t2Lower)) {
    return t1;
  }
  if (t2Lower.includes(t1Lower)) {
    return t2;
  }

  // Case 3: Word-level overlap detection between suffix of t1 and prefix of t2
  const words1 = t1.split(/\s+/);
  const words2 = t2.split(/\s+/);

  const cleanWord = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

  const maxOverlap = Math.min(words1.length, words2.length, 12);
  let overlapCount = 0;

  for (let len = maxOverlap; len >= 1; len--) {
    const endSlice1 = words1.slice(words1.length - len).map(cleanWord).join(" ");
    const startSlice2 = words2.slice(0, len).map(cleanWord).join(" ");

    if (endSlice1 && endSlice1 === startSlice2) {
      overlapCount = len;
      break;
    }
  }

  if (overlapCount > 0) {
    const remainingWords2 = words2.slice(overlapCount).join(" ");
    if (!remainingWords2) return t1;
    return `${t1} ${remainingWords2}`.trim();
  }

  // Case 4: No overlap detected - concatenate cleanly
  return `${t1} ${t2}`.trim();
}

/**
 * Fallback transcript evaluator when NLP microservice is unreachable.
 */
export function evaluateTranscriptFallback(transcript, keywords = null) {
  const words = (transcript || "").split(/\s+/).filter(Boolean);
  const count = words.length;
  
  return {
    relevanceScore: count > 5 ? 80.0 : 40.0,
    correctnessScore: count > 10 ? 82.0 : 50.0,
    completenessScore: count > 15 ? 85.0 : 45.0,
    communicationScore: count > 5 ? 84.0 : 60.0,
    overallScore: count > 10 ? 82.8 : 48.8,
    feedback: count > 5 ? "Response captured and evaluated." : "Response too short for deep feedback.",
    strengths: count > 5 ? ["Responded to prompt"] : [],
    improvements: count <= 5 ? ["Provide more detail"] : [],
  };
}

