"""
Deterministic Answer-Type Evaluation Layer
==========================================
Question-aware routing layer that runs BEFORE the explanatory NLP pipeline for
questions explicitly annotated with a structured answerType:

    binary / single_answer / short_answer / multiple_choice_style

Design rules (approved architecture):
- Correct concise deterministic answers must NOT be treated as incomplete merely
  because they are short (bypasses the explanatory "<3 words => 0" gate).
- Deterministic matching establishes correctness FIRST; semantic similarity is a
  supporting mechanism only and must never inflate clearly incorrect answers.
- Expanded correct answers earn extra credit via misconception-checked
  elaboration; wrong or irrelevant elaboration cannot reach a perfect score.
- The existing strict pipeline is untouched for "explanatory" questions.
"""

import re
from typing import Any, Dict, List, Optional

from spacy_evaluator import (
    nlp,
    phrase_matches_text,
    normalize_phrase,
)
from semantic_evaluator import compute_semantic_similarity

DETERMINISTIC_ANSWER_TYPES = {
    "binary",
    "single_answer",
    "short_answer",
    "multiple_choice_style",
}

# ── Binary polarity detection ───────────────────────────────────────────────────

_AFFIRMATIVE_MARKERS = {
    "yes", "yeah", "yep", "yup", "true", "correct", "right", "sure",
    "absolutely", "definitely", "indeed", "affirmative", "certainly",
}

_NEGATIVE_MARKERS = {
    "no", "nope", "false", "never", "cannot", "can't", "cant", "incorrect",
    "wrong", "nah",
}

_AFFIRMATIVE_CONSTRUCTIONS = [
    "you can", "we can", "it is possible", "it's possible", "they can",
    "are allowed", "is allowed", "are permitted", "is permitted", "can be used",
    "can be written", "can be done", "yes we can", "one can",
]

_NEGATIVE_CONSTRUCTIONS = [
    "not possible", "not allowed", "not permitted", "cannot be overridden",
    "cannot be overriden", "you cannot", "we cannot", "they cannot",
    "it is not", "it's not", "there is no way", "no way to", "not supported",
]


def _tokens_lower(doc) -> List[str]:
    return [t.lower_ for t in doc if not t.is_punct and not t.is_space]


def detect_binary_polarity(transcript: str, doc) -> Optional[str]:
    """Detect yes/no polarity of a transcript.
    Returns 'affirmative' | 'negative' | None."""
    words = _tokens_lower(doc)
    if not words:
        return None

    # 1. Leading polarity token wins (candidate answering directly).
    for w in words[:5]:
        wl = w.strip("',.\"!?")
        if wl in _AFFIRMATIVE_MARKERS or wl in ("yeah",):
            return "affirmative"
        if wl in _NEGATIVE_MARKERS or wl == "not":
            return "negative"

    # 2. Modal construction anywhere (e.g. "multiple catch blocks are allowed").
    norm = normalize_phrase(transcript)
    neg_hit = any(c in norm for c in _NEGATIVE_CONSTRUCTIONS)
    aff_hit = any(c in norm for c in _AFFIRMATIVE_CONSTRUCTIONS)
    # Earliest construction occurrence decides when both appear.
    if aff_hit and neg_hit:
        first_aff = min(norm.find(c) for c in _AFFIRMATIVE_CONSTRUCTIONS if c in norm)
        first_neg = min(norm.find(c) for c in _NEGATIVE_CONSTRUCTIONS if c in norm)
        return "affirmative" if first_aff < first_neg else "negative"
    if aff_hit:
        return "affirmative"
    if neg_hit:
        return "negative"

    # 3. Bare single-token answers ("Yes." / "No.").
    if len(words) <= 2:
        bare = words[0].strip("',.\"!?")
        if bare in _AFFIRMATIVE_MARKERS:
            return "affirmative"
        if bare in _NEGATIVE_MARKERS:
            return "negative"
    return None


def canonical_polarity(canonical_answer: str) -> Optional[str]:
    c = (canonical_answer or "").strip().lower()
    if not c:
        return None
    if c.startswith(("yes", "true")):
        return "affirmative"
    if c.startswith(("no", "false")):
        return "negative"
    return None


def match_accepted_answers(transcript: str, accepted_answers: Optional[List[str]], doc) -> Optional[str]:
    """Literal/lemma-tolerant containment check of accepted answers.
    Returns the matched accepted answer, or None."""
    for ans in accepted_answers or []:
        a = (ans or "").strip()
        if not a:
            continue
        if phrase_matches_text(a, transcript, doc):
            return a
    return None


# ── Result assembly helpers ─────────────────────────────────────────────────────

def _result(overall, correctness, relevance, completeness, communication,
            structure_score, grammar_score, feedback, strengths=None,
            improvements=None, engine="deterministic_answer_match",
            semantic_similarity=0.0, misconceptions=None) -> Dict[str, Any]:
    return {
        "relevanceScore": round(float(relevance), 1),
        "correctnessScore": round(float(correctness), 1),
        "completenessScore": round(float(completeness), 1),
        "communicationScore": round(float(communication), 1),
        "structureScore": round(float(structure_score), 1),
        "grammarScore": round(float(grammar_score), 1),
        "overallScore": round(max(0.0, min(98.0, float(overall))), 1),
        "feedback": feedback,
        "strengths": strengths or [],
        "improvements": improvements or [],
        "semanticSimilarity": round(float(semantic_similarity), 4),
        "semanticConceptsMatched": [],
        "misconceptionsDetected": misconceptions or [],
        "evaluationEngine": engine,
    }


ZERO_RESULT = _result(
    overall=0.0, correctness=0.0, relevance=0.0, completeness=0.0,
    communication=0.0, structure_score=0.0, grammar_score=0.0,
    feedback="No verbal response provided.",
    improvements=["Provide a clear spoken answer to the question prompt."],
)


# ── Main deterministic evaluation ───────────────────────────────────────────────

def evaluate_deterministic_answer(
    question: str,
    transcript: str,
    answer_type: str,
    canonical_answer: str = "",
    accepted_answers: Optional[List[str]] = None,
    common_misconceptions: Optional[List[str]] = None,
    reference_answer: str = "",
    structure_fn=None,
    grammar_fn=None,
) -> Optional[Dict[str, Any]]:
    """Route + score binary/single_answer/short_answer/multiple_choice_style.

    Returns one of:
      {"status": "scored", ...nlp fields}      – fully scored deterministically
      {"status": "fallback_standard", cap_overall, cap_correctness} – hand off to
        the standard strict pipeline with an inflation cap applied by the caller
      {"status": "unscored", ...zero result}   – empty/nonsense transcript
      None – invalid routing input (caller should use the standard pipeline)
    """
    transcript_clean = (transcript or "").strip()
    if not transcript_clean:
        zero = dict(ZERO_RESULT)
        zero["status"] = "unscored"
        return zero

    if answer_type not in DETERMINISTIC_ANSWER_TYPES:
        return None

    structure_score = structure_fn(transcript_clean) if structure_fn else 0.0
    grammar_score = grammar_fn(transcript_clean) if grammar_fn else 0.0

    doc = nlp(transcript_clean)
    word_count = len(_tokens_lower(doc))
    canonical = (canonical_answer or "").strip()

    # Nonsense guards still apply before any credit.
    lowered = transcript_clean.lower()
    from spacy_evaluator import ABSURD_MARKERS, GENERIC_FILLER_PHRASES
    absurd_hits = sum(1 for m in ABSURD_MARKERS if re.search(r"\b" + re.escape(m) + r"\b", lowered))
    filler_hits = sum(1 for f in GENERIC_FILLER_PHRASES if f in lowered)
    if absurd_hits >= 1 or (filler_hits >= 1 and word_count < 35):
        res = _result(
            overall=2.0, correctness=0.0, relevance=0.0, completeness=0.0,
            communication=5.0, structure_score=structure_score,
            grammar_score=grammar_score,
            feedback="Response contains non-technical or meaningless content.",
            improvements=["Give the specific answer being asked for."],
        )
        res["status"] = "scored"
        return res

    detected_misc = []
    try:
        from spacy_evaluator import detect_misconceptions as _dm
        detected_misc = _dm(doc, transcript_clean, common_misconceptions or [])
    except Exception:
        detected_misc = []

    # ── BINARY: deterministic polarity verdict ──────────────────────────────────
    if answer_type == "binary" and canonical:
        expected = canonical_polarity(canonical)
        accepted_hit = match_accepted_answers(transcript_clean, accepted_answers, doc)

        if accepted_hit:
            return _correct_binary(
                transcript_clean, word_count, structure_score, grammar_score,
                detected_misc, reference_answer, reason=f"accepted formulation '{accepted_hit}'")

        detected = detect_binary_polarity(transcript_clean, doc)
        if detected is not None and expected is not None and detected != expected:
            # Opposite polarity stated up-front. Long answers may still contain a
            # valid affirmation later - do not hard-zero those without checking.
            if word_count < 10:
                res = _result(
                    overall=8.0, correctness=5.0, relevance=25.0, completeness=10.0,
                    communication=20.0, structure_score=structure_score,
                    grammar_score=grammar_score,
                    feedback=f"Incorrect answer. The question expects "
                             f"'{canonical}' but the response indicated otherwise.",
                    improvements=["Double-check the factual yes/no of this concept."],
                )
                res["status"] = "scored"
                return res
            return {"status": "fallback_standard", "cap_correctness": 30.0, "cap_overall": 40.0}
        if detected is not None and detected == expected:
            return _correct_binary(
                transcript_clean, word_count, structure_score, grammar_score,
                detected_misc, reference_answer, reason="correct polarity")
        # No verdict possible -> let semantics judge a substantive attempt.
        if word_count >= 10:
            return {"status": "fallback_standard", "cap_correctness": 30.0, "cap_overall": 40.0}
        res = _result(
            overall=6.0, correctness=3.0, relevance=20.0, completeness=5.0,
            communication=15.0, structure_score=structure_score,
            grammar_score=grammar_score,
            feedback="Response did not clearly state whether the answer is yes or no.",
            improvements=["State the definitive answer first, then explain."],
        )
        res["status"] = "scored"
        return res

    # ── SINGLE / SHORT / MCQ: canonical + accepted-answer matching ──────────────
    if not accepted_answers and not canonical:
        return None  # misconfigured question -> standard pipeline

    accepted_hit = match_accepted_answers(transcript_clean, accepted_answers, doc)

    if accepted_hit:
        return _correct_entity(
            transcript_clean, word_count, structure_score, grammar_score,
            detected_misc, reference_answer, reason=f"accepted answer '{accepted_hit}'")

    # Semantic paraphrase support ONLY when the candidate attempted substance.
    sim_target = reference_answer if reference_answer and len(reference_answer.split()) >= 4 else canonical
    raw_sim, _credit = (0.0, 0.0)
    if sim_target and word_count >= 6:
        raw_sim, _credit = compute_semantic_similarity(transcript_clean, sim_target)

    if raw_sim >= 0.70:
        return _correct_entity(
            transcript_clean, word_count, structure_score, grammar_score,
            detected_misc, reference_answer,
            reason="semantically equivalent phrasing", semantic_similarity=raw_sim)

    if 0.55 <= raw_sim < 0.70 and word_count >= 8:
        # Paraphrase band: conceptually right without naming the key term.
        # Scaled strictly below the deterministic-correct floor (>76) so naming
        # the precise term stays rewarded; clearly wrong entities never enter
        # this band (they measure ~0.0 similarity - verified empirically).
        band_t = (raw_sim - 0.55) / 0.15
        correctness = 55.0 + band_t * 15.0          # 55 -> 70
        overall = correctness * 0.83                # ~46 -> 58
        res = _result(
            overall=overall, correctness=correctness, relevance=60.0,
            completeness=min(50.0, correctness * 0.7), communication=55.0,
            structure_score=structure_score, grammar_score=grammar_score,
            feedback="Conceptually correct explanation, but the expected key term was not stated.",
            improvements=[f"Name the precise term in your answer: {canonical or accepted_answers[0]}."],
            semantic_similarity=raw_sim, misconceptions=detected_misc,
        )
        res["status"] = "scored"
        return res

    # Wrong entity / no recognizable answer.
    if word_count <= 5:
        res = _result(
            overall=6.0, correctness=3.0, relevance=18.0, completeness=5.0,
            communication=15.0, structure_score=structure_score,
            grammar_score=grammar_score,
            feedback="Incorrect answer. That is not the term this concept asks for.",
            improvements=[f"The expected answer relates to: {canonical or accepted_answers[0]}."],
            semantic_similarity=raw_sim, misconceptions=detected_misc,
        )
        res["status"] = "scored"
        return res

    # Longer topical attempt -> strict pipeline judges it, capped against inflation.
    return {"status": "fallback_standard", "cap_correctness": 30.0, "cap_overall": 40.0}


# ── Correct-answer scorers ──────────────────────────────────────────────────────

def _apply_expansion_credit(base_overall: float, base_correctness: float,
                            word_count: int, detected_misc: List[str],
                            reference_answer: str, transcript_clean: str) -> Dict[str, Any]:
    """Correct canonical answer + optional elaboration.
    Misconceptions inside the expansion always reduce the score."""
    misc_penalty = min(40.0, 20.0 * len(detected_misc))

    if word_count > 6:
        # Expansion present: allow the strong-correct band, scaled down by penalties.
        correctness = max(70.0, 97.0 - misc_penalty)
        overall = max(78.0, 95.0 - misc_penalty)
        completeness = 92.0 if len(detected_misc) == 0 else 80.0
        communication = min(94.0, 88.0)
        feedback = "Correct answer with supporting explanation."
        strengths = ["Gave the correct answer and expanded on it."]
    else:
        # Bare concise correct answer - brevity is NOT penalized.
        correctness = max(70.0, 95.0 - misc_penalty)
        overall = max(76.0, 91.0 - misc_penalty)
        completeness = 85.0
        communication = 82.0
        feedback = "Correct and complete."
        strengths = ["Answered correctly and concisely."]

    if detected_misc:
        feedback += " Note: part of the explanation contained a known misconception."
        improvements = ["Review the conceptual detail mentioned in your explanation."]
    else:
        improvements = []

    return {
        "correctness": correctness,
        "overall": overall,
        "completeness": completeness,
        "communication": communication,
        "feedback": feedback,
        "strengths": strengths,
        "improvements": improvements,
    }


def _correct_binary(transcript_clean, word_count, structure_score, grammar_score,
                    detected_misc, reference_answer, reason, semantic_similarity=0.0):
    s = _apply_expansion_credit(0, 0, word_count, detected_misc, reference_answer, transcript_clean)
    res = _result(
        overall=s["overall"], correctness=s["correctness"], relevance=s["overall"],
        completeness=s["completeness"], communication=s["communication"],
        structure_score=structure_score, grammar_score=grammar_score,
        feedback=s["feedback"], strengths=s["strengths"],
        improvements=s["improvements"], semantic_similarity=semantic_similarity,
        misconceptions=detected_misc,
    )
    res["status"] = "scored"
    return res


def _correct_entity(transcript_clean, word_count, structure_score, grammar_score,
                    detected_misc, reference_answer, reason, semantic_similarity=0.0):
    s = _apply_expansion_credit(0, 0, word_count, detected_misc, reference_answer, transcript_clean)
    res = _result(
        overall=s["overall"], correctness=s["correctness"], relevance=s["overall"],
        completeness=s["completeness"], communication=s["communication"],
        structure_score=structure_score, grammar_score=grammar_score,
        feedback=s["feedback"], strengths=s["strengths"],
        improvements=s["improvements"], semantic_similarity=semantic_similarity,
        misconceptions=detected_misc,
    )
    res["status"] = "scored"
    return res
