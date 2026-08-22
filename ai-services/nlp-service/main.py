import os
import re
import threading
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from spacy_evaluator import (
    nlp as spacy_nlp,
    phrase_matches_text,
    compute_concept_coverage_spacy,
    analyze_answer_substance,
    is_keyword_dump,
    detect_misconceptions
)
from semantic_evaluator import (
    get_semantic_model,
    compute_semantic_similarity,
    compute_semantic_concept_alignment,
    compute_semantic_keyword_matches
)
from deterministic_evaluator import (
    DETERMINISTIC_ANSWER_TYPES,
    evaluate_deterministic_answer,
)

load_dotenv()

app = FastAPI(title="Intelligent NLP & Answer Evaluation Service", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")


class NLPRequest(BaseModel):
    text: Optional[str] = None
    question: Optional[str] = None
    transcript: Optional[str] = None
    questionType: Optional[str] = "mixed"  # 'technical', 'hr', 'mixed', 'resume', 'company'
    keywords: Optional[List[str]] = None
    expectedConcepts: Optional[List[str]] = None
    acceptablePatterns: Optional[List[str]] = None
    commonMisconceptions: Optional[List[str]] = None
    scoringRubric: Optional[Dict[str, Any]] = None
    referenceAnswer: Optional[str] = None
    # Question-aware answer routing (Phase: answer-type architecture)
    answerType: Optional[str] = "explanatory"  # 'warmup'|'binary'|'single_answer'|'short_answer'|'multiple_choice_style'|'explanatory'
    isWarmup: Optional[bool] = False
    canonicalAnswer: Optional[str] = None
    acceptedAnswers: Optional[List[str]] = None


class NLPResult(BaseModel):
    relevanceScore: float
    correctnessScore: float
    completenessScore: float
    communicationScore: float
    structureScore: float = 0.0
    grammarScore: float = 0.0
    overallScore: float
    feedback: str
    strengths: List[str]
    improvements: List[str]
    semanticSimilarity: float = 0.0
    semanticConceptsMatched: List[str] = []
    misconceptionsDetected: List[str] = []
    evaluationEngine: str = "spacy_semantic_nlp"
    answerType: str = "explanatory"
    isWarmup: bool = False


_semantic_model_ready = threading.Event()

@app.on_event("startup")
async def startup_event():
    """Warm the Sentence Transformer model in a background thread so the
    service starts accepting requests immediately instead of blocking
    uvicorn's startup for ~10s. /analyze waits on the readiness event."""
    def _warm():
        try:
            get_semantic_model()
            _semantic_model_ready.set()
            print("[NLP-Service] spaCy and SentenceTransformer (all-MiniLM-L6-v2) successfully loaded.")
        except Exception as e:
            print(f"[NLP-Service] Warning during model warmup: {e}")
    threading.Thread(target=_warm, daemon=True).start()


# ── Local NLP Concept & Semantic Analysis Engine ────────────────────────────────

CONNECTORS = {
  "because", "therefore", "however", "consequently", "specifically", "for instance",
  "for example", "furthermore", "in addition", "such as", "as a result", "firstly",
  "secondly", "finally", "means", "defined as", "used for", "allows us to", "on the other hand"
}

STAR_INDICATORS = {
  "situation": ["when i", "in my previous", "during my", "at my", "project where", "working on"],
  "task": ["my goal", "my task", "we needed to", "responsible for", "had to"],
  "action": ["i implemented", "i created", "i designed", "i resolved", "i led", "i refactored", "i communicated",
             "i owned", "owned the", "took ownership", "i fixed", "i automated", "i escalated",
             "rolled back", "root cause analysis", "my mistake"],
  "result": ["as a result", "outcome", "improved", "increased", "reduced", "successfully", "learned",
             "never happen again", "prevented", "since then"]
}

ABSURD_MARKERS = {
    "pizza", "unicorn", "fairy dust", "magic", "alien", "banana", "chocolate",
    "refrigerator", "clown", "superhero", "dragon", "spaceships", "wizard", "penguin"
}

def calculate_structure_score(text: str) -> float:
    if not text or len(text.strip()) < 10:
        return 0.0

    score = 30.0
    cleaned = text.strip()
    lower = cleaned.lower()
    lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

    if len(lines) >= 3:
        score += 20
    elif len(lines) == 2:
        score += 10

    connector_hits = sum(1 for c in CONNECTORS if c in lower)
    score += min(20.0, connector_hits * 4.0)

    if any(k in lower for k in ["firstly", "first ", "to begin", "introduction", "overview", "initially"]):
        score += 8
    if any(k in lower for k in ["finally", "in conclusion", "to conclude", "summary", "to summarize", "overall"]):
        score += 8

    if re.search(r"(^|\n)\s*[-*•]|\d+\.\s", cleaned):
        score += 8

    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if s.strip()]
    if len(sentences) >= 3:
        starters = set(s.split()[0].lower() for s in sentences if s.split())
        variety = len(starters) / len(sentences)
        score += min(6.0, variety * 10.0)

    return max(0.0, min(100.0, round(score, 1)))

def calculate_grammar_score(text: str) -> float:
    if not text or len(text.strip()) < 10:
        return 0.0

    score = 100.0
    cleaned = text.strip()
    words = cleaned.split()
    total_words = len(words)
    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if s.strip()]

    if sentences and total_words:
        avg_sent = total_words / len(sentences)
        if avg_sent > 35:
            score -= (avg_sent - 35) * 1.5
        elif avg_sent < 4:
            score -= 10

    if sentences:
        bad_caps = sum(1 for s in sentences if s and not s[0].isupper())
        score -= (bad_caps / len(sentences)) * 25

    repeats = len(re.findall(r"\b(\w+)\s+\1\b", cleaned.lower()))
    score -= min(20.0, repeats * 5.0)

    if not re.search(r"[,\.!?;:]", cleaned):
        score -= 15

    return max(0.0, min(100.0, round(score, 1)))

def evaluate_warmup_answer(
    question: str,
    transcript: str,
    structure_fn=None,
    grammar_fn=None,
) -> NLPResult:
    """
    Warm-up / Introduction evaluation (answerType == 'warmup').
    Communication-only analysis: delivery, structure, fluency, substance.
    NO technical correctness is claimed - the backend excludes warm-up answers
    from all technical/verbal aggregates.
    """
    transcript_clean = (transcript or "").strip()
    if not transcript_clean:
        return NLPResult(
            relevanceScore=0.0, correctnessScore=0.0, completenessScore=0.0,
            communicationScore=0.0, structureScore=0.0, grammarScore=0.0,
            overallScore=0.0, feedback="No verbal response provided.",
            strengths=[], improvements=["Deliver your introduction clearly."],
            semanticSimilarity=0.0, semanticConceptsMatched=[],
            evaluationEngine="warmup_communication", answerType="warmup", isWarmup=True,
        )

    doc = spacy_nlp(transcript_clean)
    words = [t for t in doc if not t.is_punct and not t.is_space]
    word_count = len(words)

    structure_score = structure_fn(transcript_clean) or 0.0
    grammar_score = grammar_fn(transcript_clean) or 0.0

    lowered = transcript_clean.lower()
    from spacy_evaluator import ABSURD_MARKERS
    import re as _re
    absurd = any(_re.search(r"\b" + _re.escape(m) + r"\b", lowered) for m in ABSURD_MARKERS)

    sentences = [s.strip() for s in re.split(r"[.!?]+", transcript_clean) if s.strip()]
    has_structure = len(sentences) >= 2

    strengths = []
    improvements = []

    # Communication clarity proxy from verbal content (voice telemetry is scored separately).
    if absurd:
        communication_score = 10.0
        feedback = "Introduction contained non-professional content."
        improvements.append("Keep the introduction professional and relevant.")
    else:
        length_component = min(70.0, word_count * 1.1)
        structure_component = 15.0 if has_structure else 0.0
        communication_score = min(96.0, round(20.0 + length_component + structure_component, 1))
        feedback = "Communication warm-up captured - not part of the technical score."
        if word_count >= 60:
            strengths.append("Delivered a substantial introduction with sufficient detail.")
        elif word_count >= 25:
            strengths.append("Provided a reasonable spoken introduction.")
            improvements.append("Add more detail about projects, skills, and goals.")
        else:
            improvements.append("Introduce yourself with education, skills, projects, and goals.")

    if has_structure:
        strengths.append("Structured the introduction in multiple clear statements.")
    if grammar_score >= 80.0:
        strengths.append("Clear grammatical delivery.")

    overall = round(min(98.0, communication_score * 0.55 + structure_score * 0.25 + max(grammar_score, communication_score * 0.6) * 0.20), 1)

    return NLPResult(
        relevanceScore=min(90.0, communication_score),
        correctnessScore=0.0,  # warm-up carries no technical correctness claim
        completenessScore=min(92.0, communication_score),
        communicationScore=communication_score,
        structureScore=structure_score,
        grammarScore=grammar_score,
        overallScore=overall,
        feedback=feedback,
        strengths=strengths or ["Spoken input was captured."],
        improvements=improvements,
        semanticSimilarity=0.0,
        semanticConceptsMatched=[],
        evaluationEngine="warmup_communication",
        answerType="warmup",
        isWarmup=True,
    )


def evaluate_with_local_nlp(
    question: str,
    transcript: str,
    q_type: str = "mixed",
    keywords: Optional[List[str]] = None,
    expected_concepts: Optional[List[str]] = None,
    acceptable_patterns: Optional[List[str]] = None,
    common_misconceptions: Optional[List[str]] = None,
    scoring_rubric: Optional[Dict[str, Any]] = None,
    reference_answer: Optional[str] = None
) -> NLPResult:
    transcript_clean = transcript.strip()
    if not transcript_clean:
        return NLPResult(
            relevanceScore=0.0,
            correctnessScore=0.0,
            completenessScore=0.0,
            communicationScore=0.0,
            structureScore=0.0,
            grammarScore=0.0,
            overallScore=0.0,
            feedback="No verbal response provided.",
            strengths=[],
            improvements=["Provide a clear spoken answer to the technical question prompt."],
            semanticSimilarity=0.0,
            semanticConceptsMatched=[],
            evaluationEngine="spacy_semantic_nlp"
        )

    # 1. spaCy Linguistic & Syntactic Parsing
    doc = spacy_nlp(transcript_clean)
    words = [t for t in doc if not t.is_punct and not t.is_space]
    word_count = len(words)

    if word_count < 3:
        return NLPResult(
            relevanceScore=0.0,
            correctnessScore=0.0,
            completenessScore=0.0,
            communicationScore=0.0,
            structureScore=0.0,
            grammarScore=0.0,
            overallScore=0.0,
            feedback="No verbal response provided.",
            strengths=[],
            improvements=["Provide a clear spoken answer to the technical question prompt."],
            semanticSimilarity=0.0,
            semanticConceptsMatched=[],
            evaluationEngine="spacy_semantic_nlp"
        )

    # 2. Substance & Structure Diagnostics
    substance = analyze_answer_substance(doc, transcript_clean, question, keywords, q_type=q_type)
    is_absurd = substance["is_absurd"]
    is_filler = substance["is_mostly_filler"]
    is_kw_stuffing = substance["is_keyword_stuffing"]
    is_personal_evasion = substance.get("is_personal_evasion", False)
    is_prompt_echo = substance["is_prompt_echo"]
    has_subject_verb = substance["has_subject_verb"]

    # 3. spaCy Contiguous Keyword Matching
    # Sanitize: some bank entries contain stopword keywords ("the", "and", "are")
    # which lemma-match any transcript and leak into strengths feedback as
    # "key domain principles". Strip them before matching.
    _STOPWORD_KEYWORDS = {
        "the", "a", "an", "and", "or", "of", "is", "are", "was", "were", "be",
        "for", "in", "on", "with", "what", "how", "why", "does", "do", "did",
        "it", "its", "to", "that", "this", "these", "those", "by", "at", "as",
        "not", "no", "yes", "can", "will", "which", "when", "from", "about",
    }
    matched_keywords = []
    missing_keywords = []
    clean_keywords = [
        k.strip() for k in (keywords or [])
        if k and k.strip() and k.strip().lower() not in _STOPWORD_KEYWORDS
    ]
    if clean_keywords:
        for kw in clean_keywords:
            if phrase_matches_text(kw, transcript_clean, doc):
                matched_keywords.append(kw)
            else:
                missing_keywords.append(kw)
        # Semantic fallback for morphology/paraphrase misses (e.g. "owned" vs "ownership")
        if missing_keywords and not (is_absurd or is_filler):
            for kw in compute_semantic_keyword_matches(transcript_clean, missing_keywords):
                matched_keywords.append(kw)
                missing_keywords.remove(kw)
        kw_ratio = len(matched_keywords) / len(clean_keywords)
    else:
        kw_ratio = 0.0

    # 4. Keyword Dumping Detection
    is_kw_dump = is_keyword_dump(doc, matched_keywords) or is_kw_stuffing

    # 5. Semantic Concept-Level Alignment (Prerequisite: Passes Substance Checks)
    semantic_concept_scores = {}
    semantic_concepts_matched = []
    if expected_concepts and not (is_absurd or is_filler or is_personal_evasion or is_kw_dump):
        concept_alignments = compute_semantic_concept_alignment(transcript_clean, expected_concepts)
        for c_text, raw_sim, credit in concept_alignments:
            semantic_concept_scores[c_text] = raw_sim
            if raw_sim >= 0.62 or credit >= 0.35:
                semantic_concepts_matched.append(c_text)

    # 6. spaCy Substantive Concept Coverage with Semantic Fallback
    concept_ratio, matched_concepts, missing_concepts = compute_concept_coverage_spacy(
        expected_concepts or [], doc, transcript_clean, semantic_concept_scores=semantic_concept_scores
    )

    # 7. Global Reference Answer Semantic Similarity
    raw_semantic_sim = 0.0
    semantic_credit = 0.0
    if reference_answer and not (is_absurd or is_filler or is_personal_evasion or is_kw_dump):
        raw_semantic_sim, semantic_credit = compute_semantic_similarity(transcript_clean, reference_answer)

    # Anti-inflation guardrail: if zero concepts and zero/low keywords, zero out semantic credit
    if concept_ratio == 0.0 and kw_ratio <= 0.20:
        semantic_credit = 0.0
    elif concept_ratio < 0.60:
        semantic_credit = min(semantic_credit, concept_ratio + 0.15)

    # 8. Combined Multi-Signal Coverage Calculation (No Artificial Floors!)
    if keywords and expected_concepts and reference_answer:
        if (concept_ratio >= 0.40 or (semantic_credit >= 0.45 and has_subject_verb)) and not (concept_ratio <= 0.50 and kw_ratio <= 0.50 and word_count < 14):
            # Genuine technical explanation with high conceptual or semantic alignment
            base_coverage = max(
                (kw_ratio * 0.25) + (concept_ratio * 0.45) + (semantic_credit * 0.30),
                (concept_ratio * 0.50) + (semantic_credit * 0.50)
            )
        elif concept_ratio <= 0.50 and kw_ratio <= 0.50:
            # Partial answer capping
            base_coverage = min(0.48, (kw_ratio * 0.30) + (concept_ratio * 0.45) + (semantic_credit * 0.25))
        else:
            base_coverage = (kw_ratio * 0.25) + (concept_ratio * 0.45) + (semantic_credit * 0.30)
    elif keywords and expected_concepts:
        base_coverage = (kw_ratio * 0.40) + (concept_ratio * 0.60)
    elif keywords and reference_answer:
        base_coverage = (kw_ratio * 0.50) + (semantic_credit * 0.50)
    elif expected_concepts and reference_answer:
        base_coverage = (concept_ratio * 0.65) + (semantic_credit * 0.35)
    elif expected_concepts:
        base_coverage = concept_ratio
    elif reference_answer:
        base_coverage = semantic_credit
    elif keywords:
        base_coverage = kw_ratio
    else:
        base_coverage = 0.5

    # Acceptable alternative patterns check
    if acceptable_patterns:
        for pat in acceptable_patterns:
            if phrase_matches_text(pat, transcript_clean, doc):
                base_coverage = min(1.0, base_coverage + 0.15)
                break

    # STAR framework credit for behavioral answers: proportional to how many of the
    # four STAR components (situation/task/action/result) the answer demonstrates.
    if q_type in ("hr", "behavioral"):
        star_hits = sum(
            1 for indicators in STAR_INDICATORS.values()
            if any(ind in transcript_clean.lower() for ind in indicators)
        )
        base_coverage = min(1.0, base_coverage + (star_hits / len(STAR_INDICATORS)) * 0.25)

    # 9. Factual Contradiction Detection
    # 9a. Hardcoded inverted-fact rules (zero tolerance)
    misconception_penalty = 0.0
    ans_lower = transcript_clean.lower()
    if "tcp and udp" in question.lower():
        if any(bad in ans_lower for bad in [
            "udp is connection oriented", "udp uses a three way handshake",
            "udp is connection-oriented", "tcp is connectionless",
            "udp is reliable", "udp guarantees delivery"
        ]):
            misconception_penalty += 100.0

    # 9b. Question-bank misconception detection (Phase 3)
    # -40 per confirmed known misconception (cap 80): degrades correctness through
    # the EXISTING gates below; cannot be bypassed by surrounding correct keywords
    # because detection matches the incorrect claim itself, not keywords.
    detected_misconceptions = detect_misconceptions(doc, transcript_clean, common_misconceptions or [])
    if detected_misconceptions and not is_absurd:
        misconception_penalty += min(80.0, 40.0 * len(detected_misconceptions))

    # 10. Strict Score Computations
    if is_absurd or is_filler or misconception_penalty >= 80.0:
        relevance_score = 0.0
        correctness_score = 0.0
    elif is_personal_evasion:
        relevance_score = min(8.0, round(base_coverage * 15.0, 1))
        correctness_score = 0.0
    elif is_prompt_echo:
        relevance_score = min(15.0, round(base_coverage * 20.0, 1))
        correctness_score = min(10.0, round(base_coverage * 15.0, 1))
    elif is_kw_dump:
        relevance_score = min(25.0, round(base_coverage * 30.0, 1))
        correctness_score = min(15.0, round(base_coverage * 20.0, 1))
    elif kw_ratio == 0 and concept_ratio == 0 and semantic_credit == 0:
        relevance_score = 0.0
        correctness_score = 0.0
    elif base_coverage < 0.15 and not has_subject_verb:
        relevance_score = min(10.0, round(base_coverage * 30.0, 1))
        correctness_score = 0.0
    elif concept_ratio <= 0.50 and kw_ratio <= 0.50:
        # Strict capping for partial answers
        relevance_score = min(60.0, max(0.0, round((base_coverage * 85.0) + (13.0 if base_coverage > 0.2 else 0.0), 1)))
        correctness_score = min(52.0, max(0.0, round((base_coverage * 100.0) - misconception_penalty, 1)))
    else:
        relevance_score = min(98.0, max(0.0, round((base_coverage * 85.0) + (13.0 if base_coverage > 0.2 else 0.0), 1)))
        correctness_score = min(98.0, max(0.0, round((base_coverage * 100.0) - misconception_penalty, 1)))

    # 11. Completeness Score
    if is_absurd or is_filler or is_personal_evasion or is_prompt_echo or is_kw_dump or correctness_score == 0.0:
        completeness_score = 0.0
    elif concept_ratio <= 0.50 or kw_ratio <= 0.50 or word_count < 14:
        completeness_score = min(50.0, round(correctness_score * 0.9, 1))
    elif correctness_score >= 70.0 and word_count >= 18:
        completeness_score = 95.0
    elif correctness_score >= 50.0 and word_count >= 12:
        completeness_score = 80.0
    elif correctness_score >= 20.0 and word_count >= 6:
        completeness_score = 50.0
    else:
        completeness_score = min(30.0, round(correctness_score * 0.5, 1))

    # 12. Communication & Structural Analysis
    structure_score = calculate_structure_score(transcript_clean)
    grammar_score = calculate_grammar_score(transcript_clean)

    if is_absurd or is_filler or is_personal_evasion or is_prompt_echo or is_kw_dump or correctness_score == 0.0:
        communication_score = 5.0
    elif correctness_score < 20.0:
        communication_score = min(35.0, round((base_coverage * 30.0) + 15.0, 1))
    else:
        communication_score = min(96.0, round((base_coverage * 40.0) + (45.0 if has_subject_verb else 25.0), 1))

    # 13. Strict Dynamic Weighted Composite Score
    rubric = scoring_rubric or {}
    r_wt = rubric.get("relevanceWeight", 0.25)
    c_wt = rubric.get("conceptWeight", 0.40)
    comp_wt = rubric.get("completenessWeight", 0.20)
    s_wt = rubric.get("structureWeight", 0.15)

    raw_overall = (
        (relevance_score * r_wt) +
        (correctness_score * c_wt) +
        (completeness_score * comp_wt) +
        (communication_score * s_wt)
    )

    # 14. Strict Correctness Gating
    if is_absurd or is_filler or is_personal_evasion or correctness_score == 0.0:
        overall_score = 0.0
    elif is_prompt_echo:
        overall_score = min(12.0, round(raw_overall, 1))
    elif is_kw_dump:
        overall_score = min(15.0, round(raw_overall, 1))
    elif correctness_score < 15.0:
        overall_score = min(15.0, round(raw_overall * 0.50, 1))
    elif correctness_score < 30.0:
        overall_score = min(35.0, round(raw_overall, 1))
    elif correctness_score < 50.0:
        overall_score = min(50.0, round(raw_overall, 1))
    else:
        overall_score = round(raw_overall, 1)

    overall_score = min(98.0, max(0.0, overall_score))

    # 15. Dynamic Strengths & Actionable Feedback
    strengths = []
    improvements = []

    if matched_keywords and not is_kw_dump and not is_absurd and not is_personal_evasion:
        strengths.append(f"Accurately addressed key domain principles: {', '.join(matched_keywords[:3])}.")
    if kw_ratio < 0.35 and (semantic_credit >= 0.40 or len(semantic_concepts_matched) >= 1) and correctness_score >= 50.0:
        strengths.append("Successfully articulated core technical mechanisms using independent conceptual phrasing.")
    if has_subject_verb and correctness_score >= 50 and not is_kw_dump:
        strengths.append("Structured technical assertions with clear cause-and-effect relationships.")
    if correctness_score >= 80.0:
        strengths.append("Demonstrated authoritative mastery of the core concept.")
    if not strengths:
        if is_absurd or is_prompt_echo or is_filler or is_personal_evasion:
            strengths.append("Spoken input was captured.")
        else:
            strengths.append("Attempted the technical prompt directly.")

    if is_absurd:
        improvements.append("Avoid non-technical, irrelevant, or humorous content in technical interview responses.")
        feedback = "Response contains non-technical or absurd content."
    elif is_filler:
        improvements.append("Provide concrete technical mechanisms rather than vague high-level generalities.")
        feedback = "Response is overly vague and lacks concrete technical substance."
    elif is_personal_evasion:
        improvements.append("Frame your answer as an objective technical explanation rather than personal monologue.")
        feedback = "Response does not provide an objective technical explanation."
    elif is_kw_dump:
        improvements.append("Connect technical terminology into coherent sentences explaining 'how' and 'why'.")
        feedback = "Avoid simply listing technical keywords without explanatory syntax."
    elif is_prompt_echo:
        improvements.append("Avoid repeating the question prompt; explain the underlying technical mechanism.")
        feedback = "Response repeats the question prompt without providing an explanatory answer."
    elif missing_keywords and not is_absurd:
        improvements.append(f"Detail essential technical pillars: {', '.join(missing_keywords[:3])}.")
        if correctness_score >= 80:
            feedback = f"Excellent technical explanation. Core concepts ({', '.join(matched_keywords[:2]) if matched_keywords else 'fundamental principles'}) were accurately articulated with sound reasoning."
        elif correctness_score >= 50:
            feedback = f"Partially correct answer. Covered key ideas but would benefit from greater detail regarding {missing_keywords[0]}."
        else:
            feedback = f"Incomplete or inaccurate explanation. Review foundational concepts regarding {question}."
    elif correctness_score >= 80:
        feedback = f"Excellent technical explanation. Core concepts ({', '.join(matched_keywords[:2]) if matched_keywords else 'fundamental principles'}) were accurately articulated with sound reasoning."
    elif correctness_score >= 50:
        feedback = "Partially correct answer. Covered basic principles but lacked full depth on technical trade-offs."
    else:
        feedback = f"Incomplete explanation. Review foundational concepts regarding {question}."

    return NLPResult(
        relevanceScore=relevance_score,
        correctnessScore=correctness_score,
        completenessScore=completeness_score,
        communicationScore=communication_score,
        structureScore=structure_score,
        grammarScore=grammar_score,
        overallScore=overall_score,
        feedback=feedback,
        strengths=strengths,
        improvements=improvements,
        semanticSimilarity=raw_semantic_sim,
        semanticConceptsMatched=semantic_concepts_matched,
        misconceptionsDetected=detected_misconceptions,
        evaluationEngine="spacy_semantic_nlp"
    )


@app.post("/analyze")
async def analyze_nlp(body: NLPRequest):
    input_transcript = body.transcript or body.text or ""
    input_question = body.question or "Interview Practice Question"

    # Wait for background semantic-model warmup (bounded); falls back to the
    # lazy-load path inside the evaluator if warmup is still unfinished.
    _semantic_model_ready.wait(timeout=30)

    req_answer_type = (body.answerType or "explanatory").strip()
    if body.isWarmup:
        req_answer_type = "warmup"

    # ── Warm-up routing: communication-only, no technical score claim ──────────
    if req_answer_type == "warmup":
        warmup_result = evaluate_warmup_answer(
            question=input_question,
            transcript=input_transcript,
            structure_fn=calculate_structure_score,
            grammar_fn=calculate_grammar_score,
        )
        return {"success": True, "data": warmup_result.model_dump()}

    # ── Deterministic answer-type routing (binary/single/short/mcq) ───────────
    if req_answer_type in DETERMINISTIC_ANSWER_TYPES and (
        body.acceptedAnswers or body.canonicalAnswer or req_answer_type == "binary"
    ):
        det = evaluate_deterministic_answer(
            question=input_question,
            transcript=input_transcript,
            answer_type=req_answer_type,
            canonical_answer=body.canonicalAnswer or "",
            accepted_answers=body.acceptedAnswers or [],
            common_misconceptions=body.commonMisconceptions or [],
            reference_answer=body.referenceAnswer or "",
            structure_fn=calculate_structure_score,
            grammar_fn=calculate_grammar_score,
        )
        if det is not None:
            if det.get("status") == "fallback_standard":
                local_result = evaluate_with_local_nlp(
                    question=input_question,
                    transcript=input_transcript,
                    q_type=body.questionType or "mixed",
                    keywords=body.keywords,
                    expected_concepts=body.expectedConcepts,
                    acceptable_patterns=body.acceptablePatterns,
                    common_misconceptions=body.commonMisconceptions,
                    scoring_rubric=body.scoringRubric,
                    reference_answer=body.referenceAnswer,
                )
                data = local_result.model_dump()
                cap_c = float(det.get("cap_correctness", 45.0))
                cap_o = float(det.get("cap_overall", 40.0))
                if data["correctnessScore"] > cap_c:
                    data["correctnessScore"] = cap_c
                if data["overallScore"] > cap_o:
                    data["overallScore"] = cap_o
                data["answerType"] = req_answer_type
                return {"success": True, "data": data}
            det.setdefault("answerType", req_answer_type)
            det.pop("status", None)
            return {"success": True, "data": NLPResult(**det).model_dump()}

    local_result = evaluate_with_local_nlp(
        question=input_question,
        transcript=input_transcript,
        q_type=body.questionType or "mixed",
        keywords=body.keywords,
        expected_concepts=body.expectedConcepts,
        acceptable_patterns=body.acceptablePatterns,
        common_misconceptions=body.commonMisconceptions,
        scoring_rubric=body.scoringRubric,
        reference_answer=body.referenceAnswer
    )

    return {"success": True, "data": local_result.model_dump()}


@app.get("/health")
async def health():
    return {
        "success": True,
        "data": {
            "status": "OK",
            "service": "nlp-service",
            "port": 8003,
            "has_llm_key": bool(OPENROUTER_API_KEY)
        }
    }


from resume_parser import extract_text_from_bytes, synthesize_questions_from_resume
from llm_router import (
    generate_project_questions_llm,
    generate_project_followup_llm,
    evaluate_project_answer_llm,
    generate_technical_questions_llm,
    generate_hr_questions_llm,
)

class ResumeQuestionRequest(BaseModel):
    resumeText: str
    role: Optional[str] = "Software Engineer"
    count: Optional[int] = 5

class ProjectQuestionsRequest(BaseModel):
    projects: Optional[List[Dict[str, Any]]] = []
    role: Optional[str] = "Software Engineer"
    count: Optional[int] = 2
    sessionId: Optional[str] = None
    sessionIndex: Optional[int] = 0
    previousQuestions: Optional[List[str]] = None
    resumeText: Optional[str] = None

class ProjectFollowUpRequest(BaseModel):
    projectContext: Dict[str, Any]
    question: str
    answer: str
    previousFollowUps: Optional[List[Dict[str, str]]] = None
    turnCount: Optional[int] = 1

class ProjectEvaluateRequest(BaseModel):
    projectContext: Dict[str, Any]
    question: str
    answer: str
    isFollowUp: Optional[bool] = False

@app.post("/extract-resume-text")
async def extract_resume(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        filename = file.filename or "resume.pdf"
        text = extract_text_from_bytes(contents, filename)
        return {"success": True, "extractedText": text, "text": text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text from resume: {str(e)}")

@app.post("/generate-resume-questions")
async def generate_resume_qs(body: ResumeQuestionRequest):
    try:
        qs = synthesize_questions_from_resume(body.resumeText, role=body.role or "Software Engineer", count=body.count or 5)
        return {
            "success": True,
            "data": {
                "questions": qs.get("questions", []),
                "domainTags": qs.get("domainTags", []),
                "skills": qs.get("skills", []),
                "projects": qs.get("projects", []),
                "rawText": body.resumeText,
                "summary": qs.get("summary", "")
            },
            "questions": qs.get("questions", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")

@app.post("/extract-and-generate-resume-questions")
async def extract_and_generate_resume_questions(
    file: UploadFile = File(...),
    role: Optional[str] = Form("Software Engineer"),
    count: Optional[int] = Form(5)
):
    try:
        contents = await file.read()
        filename = file.filename or "resume.docx"
        text = extract_text_from_bytes(contents, filename)
        synth = synthesize_questions_from_resume(text, role=role or "Software Engineer", count=count or 5)
        return {
            "success": True,
            "data": {
                "extractedText": text,
                "text": text,
                "skills": synth.get("skills", []),
                "projects": synth.get("projects", []),
                "domainTags": synth.get("domainTags", []),
                "questions": synth.get("questions", []),
                "summary": synth.get("summary", "")
            },
            "questions": synth.get("questions", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process resume: {str(e)}")

# ── LLM Router Endpoints for Project Defense & Dynamic Follow-ups ──────────────

@app.post("/generate-project-questions")
async def generate_project_questions_endpoint(body: ProjectQuestionsRequest):
    try:
        questions = await generate_project_questions_llm(
            projects=body.projects or [],
            role=body.role or "Software Engineer",
            count=body.count or 2,
            session_id=body.sessionId,
            session_index=body.sessionIndex or 0,
            previous_questions=body.previousQuestions or [],
            resume_text=body.resumeText
        )
        return {"success": True, "data": {"questions": questions}, "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate project questions: {str(e)}")

@app.post("/generate-project-followup")
async def generate_project_followup_endpoint(body: ProjectFollowUpRequest):
    try:
        followup = await generate_project_followup_llm(
            project_context=body.projectContext,
            original_question=body.question,
            candidate_answer=body.answer,
            previous_followups=body.previousFollowUps,
            turn_count=body.turnCount or 1
        )
        return {"success": True, "data": followup}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate project follow-up: {str(e)}")

@app.post("/evaluate-project-answer")
async def evaluate_project_answer_endpoint(body: ProjectEvaluateRequest):
    try:
        eval_res = await evaluate_project_answer_llm(
            project_context=body.projectContext,
            question=body.question,
            answer=body.answer,
            is_followup=body.isFollowUp or False
        )
        return {"success": True, "data": eval_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate project answer: {str(e)}")


class TechnicalQuestionsRequest(BaseModel):
    role: Optional[str] = "Software Engineer"
    topics: Optional[List[str]] = None
    count: Optional[int] = 4

@app.post("/generate-technical-questions")
async def generate_technical_questions_endpoint(body: TechnicalQuestionsRequest):
    try:
        questions = await generate_technical_questions_llm(
            role=body.role or "Software Engineer",
            topics=body.topics or [],
            count=body.count or 4
        )
        return {"success": True, "data": {"questions": questions}, "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate technical questions: {str(e)}")


class HRQuestionsRequest(BaseModel):
    role: Optional[str] = "Software Engineer"
    count: Optional[int] = 4

@app.post("/generate-hr-questions")
async def generate_hr_questions_endpoint(body: HRQuestionsRequest):
    try:
        questions = await generate_hr_questions_llm(
            role=body.role or "Software Engineer",
            count=body.count or 4
        )
        return {"success": True, "data": {"questions": questions}, "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate HR questions: {str(e)}")

