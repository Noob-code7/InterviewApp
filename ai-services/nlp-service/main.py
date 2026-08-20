import os
import re
import math
import json
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

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
    evaluationEngine: str = "local_nlp"


# ── Local NLP Concept & Semantic Analysis Engine ────────────────────────────────

STOPWORDS = {
  "a", "an", "the", "and", "or", "but", "if", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "to", "from",
  "in", "out", "on", "off", "over", "under", "again", "further", "then", "once",
  "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "should",
  "now", "i", "me", "my", "we", "our", "you", "your", "it", "its", "they", "them",
  "what", "different", "between", "explain", "describe", "list", "difference"
}

NUM_WORDS = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
  "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5"
}

ACTION_VERBS = {
  "is", "are", "was", "were", "uses", "used", "provides", "provided", "enables",
  "allows", "connects", "guarantees", "combines", "divides", "runs", "executes",
  "operates", "stores", "manages", "allocates", "transmits", "handles", "ensures",
  "works", "maintains", "tracks", "holds", "returns", "implements", "requires"
}

CONNECTORS = {
  "because", "therefore", "however", "consequently", "specifically", "for instance",
  "for example", "furthermore", "in addition", "such as", "as a result", "firstly",
  "secondly", "finally", "means", "defined as", "used for", "allows us to", "on the other hand"
}

STAR_INDICATORS = {
  "situation": ["when i", "in my previous", "during my", "at my", "project where", "working on"],
  "task": ["my goal", "my task", "we needed to", "responsible for", "had to"],
  "action": ["i implemented", "i created", "i designed", "i resolved", "i led", "i refactored", "i communicated"],
  "result": ["as a result", "outcome", "improved", "increased", "reduced", "successfully", "learned"]
}

ABSURD_MARKERS = {
    "pizza", "unicorn", "fairy dust", "magic", "alien", "banana", "chocolate",
    "refrigerator", "clown", "superhero", "dragon", "spaceships", "wizard", "penguin"
}

def normalize_text(text: str) -> str:
    text_clean = text.lower()
    for num, word in [("3-way", "three way"), ("3 way", "three way"), ("2-way", "two way"), ("4-way", "four way")]:
        text_clean = text_clean.replace(num, word)
    return text_clean

def tokenize(text: str) -> List[str]:
    text_clean = re.sub(r"[^\w\s]", " ", normalize_text(text))
    return [w for w in text_clean.split() if w and w not in STOPWORDS]

def stem_match(w1: str, w2: str) -> bool:
    w1, w2 = w1.lower(), w2.lower()
    if w1 == w2: return True
    if w1 in NUM_WORDS and NUM_WORDS[w1] == w2: return True
    if w2 in NUM_WORDS and NUM_WORDS[w2] == w1: return True
    if len(w1) >= 4 and len(w2) >= 4:
        min_len = min(len(w1), len(w2), 4)
        if w1[:min_len] == w2[:min_len]: return True
    return False

def calculate_cosine_similarity(vec1: dict, vec2: dict) -> float:
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])

    sum1 = sum([vec1[x]**2 for x in vec1.keys()])
    sum2 = sum([vec2[x]**2 for x in vec2.keys()])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)

    if not denominator:
        return 0.0

    return float(numerator) / denominator

def get_tf_vector(words: List[str]) -> dict:
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts

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
    words = tokenize(transcript_clean)
    all_raw_words = normalize_text(transcript_clean).split()
    word_count = len(words)

    # 1. Handle Silence / Empty response
    if not transcript_clean or word_count < 3:
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
            evaluationEngine="local_nlp"
        )

    ans_lower = normalize_text(transcript_clean)
    ans_set = set(words)
    ans_norm_str = " ".join(words)
    q_tokens = tokenize(question)

    # 2. Absurdity / Sarcasm Detection
    absurd_count = sum(1 for m in ABSURD_MARKERS if m in ans_lower)
    is_absurd = absurd_count >= 1

    # 3. Action Verbs for Buzzword-Dump Detection
    has_action_verbs = any(v in all_raw_words for v in ACTION_VERBS)

    # 4. Prompt-Echoing Detection (repeating the question without answering)
    novel_words = [w for w in words if not any(stem_match(w, qw) for qw in q_tokens)]
    echo_ratio = 1.0 - (len(novel_words) / len(words)) if words else 1.0
    is_mostly_echo = (echo_ratio > 0.65 and len(novel_words) < 4)

    # 5. Dual-Pillar Concept & Keyword Coverage Matching
    matched_concepts = []
    missing_concepts = []

    # A. Keyword Matching with Stemming & Subphrase
    kw_hits = 0
    if keywords:
        for kw in keywords:
            kw_clean = normalize_text(kw.strip())
            kw_w = tokenize(kw_clean)
            if not kw_w: continue
            if (all(any(stem_match(w, aw) for aw in ans_set) for w in kw_w) or 
                kw_clean in ans_norm_str or kw_clean in ans_lower):
                kw_hits += 1
                matched_concepts.append(kw)
            else:
                missing_concepts.append(kw)
        kw_ratio = kw_hits / len(keywords)
    else:
        kw_ratio = 0.0

    # B. Concept Sentence Matching
    concept_hits = 0
    if expected_concepts:
        for c in expected_concepts:
            c_w = tokenize(c)
            if not c_w: continue
            matched_w = sum(1 for w in c_w if any(stem_match(w, aw) for aw in ans_set))
            if matched_w >= max(1, math.ceil(len(c_w) * 0.28)):
                concept_hits += 1
        concept_ratio = concept_hits / len(expected_concepts)
    else:
        concept_ratio = 0.0

    # Base coverage calculation
    if keywords and expected_concepts:
        base_coverage = (kw_ratio * 0.40) + (concept_ratio * 0.60)
        if kw_hits >= 1 and base_coverage < 0.30 and word_count >= 5:
            base_coverage = 0.30
    elif keywords:
        base_coverage = kw_ratio
    elif expected_concepts:
        base_coverage = concept_ratio
    else:
        base_coverage = 0.5

    # Check acceptable alternative patterns
    if acceptable_patterns:
        for pat in acceptable_patterns:
            pat_clean = normalize_text(pat.strip())
            pat_words = tokenize(pat_clean)
            if pat_clean in ans_lower or (pat_words and sum(1 for w in pat_words if any(stem_match(w, aw) for aw in ans_set)) >= max(1, len(pat_words) * 0.5)):
                base_coverage = min(1.0, base_coverage + 0.10)

    # 6. Inverted Factual Contradictions Detection
    misconception_penalty = 0.0
    if "tcp and udp" in question.lower():
        if ("udp is connection oriented" in ans_lower or 
            "udp uses a three way handshake" in ans_lower or
            "udp is connection-oriented" in ans_lower or
            "tcp is connectionless" in ans_lower or
            "udp is reliable" in ans_lower or
            "udp guarantees delivery" in ans_lower):
            misconception_penalty += 60.0

    # 7. Buzzword-Only Detection
    connector_matches = [c for c in CONNECTORS if c in ans_lower]
    is_buzzword_dump = (kw_ratio >= 0.35 and not has_action_verbs and len(all_raw_words) < 22)

    # 8. Score Computations
    if is_absurd:
        relevance_score = min(5.0, round(base_coverage * 10.0, 1))
        correctness_score = 0.0
    elif is_mostly_echo:
        relevance_score = min(15.0, round(base_coverage * 20.0, 1))
        correctness_score = min(10.0, round(base_coverage * 15.0, 1))
    elif is_buzzword_dump:
        relevance_score = min(30.0, round(base_coverage * 40.0, 1))
        correctness_score = min(20.0, round(base_coverage * 25.0, 1))
    elif kw_hits == 0 and concept_hits == 0:
        relevance_score = 0.0
        correctness_score = 0.0
    elif kw_hits <= 1 and concept_hits == 0 and word_count >= 15:
        relevance_score = 10.0
        correctness_score = 5.0
    elif kw_hits >= 1 and concept_hits == 0 and word_count < 15:
        relevance_score = 35.0
        correctness_score = 30.0
    else:
        relevance_score = min(98.0, max(25.0, round((base_coverage * 85.0) + 15.0, 1)))
        correctness_score = min(98.0, max(0.0, round((base_coverage * 100.0) - misconception_penalty, 1)))

    # 9. Completeness Score
    if is_absurd or is_mostly_echo or is_buzzword_dump or correctness_score == 0.0:
        completeness_score = 0.0
    elif correctness_score >= 70.0 and word_count >= 25:
        completeness_score = 95.0
    elif correctness_score >= 50.0 and word_count >= 15:
        completeness_score = 75.0
    elif correctness_score >= 25.0 and word_count >= 6:
        completeness_score = 45.0
    else:
        completeness_score = min(25.0, round(correctness_score * 0.5, 1))

    # 10. Communication & Structure Score
    star_score = 0
    for category, indicators in STAR_INDICATORS.items():
        if any(ind in ans_lower for ind in indicators):
            star_score += 1

    structure_bonus = min(20.0, len(connector_matches) * 5.0 + star_score * 5.0)
    structure_score = calculate_structure_score(transcript_clean)
    grammar_score = calculate_grammar_score(transcript_clean)

    if is_absurd or is_mostly_echo or is_buzzword_dump or correctness_score == 0.0:
        communication_score = 5.0
    elif correctness_score < 35.0:
        communication_score = min(40.0, round((base_coverage * 30.0) + 20.0, 1))
    else:
        communication_score = min(96.0, round((base_coverage * 45.0) + structure_bonus + 35.0, 1))

    # 11. Strict Dynamic Weighted Composite Score
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

    # ── STRICT CORRECTNESS FLOOR & GATING ──────────────────────────────────────────
    if is_absurd:
        overall_score = min(5.0, round(raw_overall, 1))
    elif is_mostly_echo:
        overall_score = min(12.0, round(raw_overall, 1))
    elif is_buzzword_dump:
        overall_score = min(20.0, round(raw_overall, 1))
    elif correctness_score < 10.0:
        overall_score = min(8.0, round(correctness_score, 1))
    elif correctness_score < 25.0:
        overall_score = min(20.0, round(raw_overall * 0.50, 1))
    elif correctness_score < 40.0:
        overall_score = min(38.0, round(raw_overall, 1))
    else:
        overall_score = round(raw_overall, 1)

    overall_score = min(98.0, max(0.0, overall_score))

    # 12. Dynamic Strengths & Actionable Feedback
    strengths = []
    improvements = []

    if matched_concepts:
        clean_strengths = [c for c in matched_concepts if c.lower() not in STOPWORDS]
        if clean_strengths:
            strengths.append(f"Accurately addressed key domain principles: {', '.join(clean_strengths[:3])}.")
    if len(connector_matches) > 0 and not is_absurd:
        strengths.append("Used logical connective transitions to structure the technical explanation.")
    if correctness_score >= 80.0:
        strengths.append("Demonstrated clear, authoritative technical mastery of the core concept.")
    if not strengths:
        if is_absurd or is_mostly_echo:
            strengths.append("Spoken input was captured.")
        else:
            strengths.append("Attempted the technical prompt directly.")

    if is_absurd:
        improvements.append("Avoid non-technical, irrelevant, or humorous content in technical interview responses.")
    if is_mostly_echo:
        improvements.append("Avoid simply repeating the question prompt; explain the underlying technical mechanism.")
    if is_buzzword_dump:
        improvements.append("Connect technical terminology into coherent sentences explaining 'how' and 'why' rather than listing keywords.")
    if missing_concepts and not is_absurd:
        clean_missing = [c for c in missing_concepts if c.lower() not in STOPWORDS]
        if clean_missing:
            improvements.append(f"Detail essential technical pillars: {', '.join(clean_missing[:3])}.")
    if word_count < 25 and not is_absurd and not is_mostly_echo:
        improvements.append("Elaborate further with architectural details, complexity bounds, or code examples.")

    if is_absurd or is_mostly_echo:
        feedback = "Response does not provide an accurate or substantive answer to the technical question prompt."
    elif correctness_score >= 80:
        feedback = f"Excellent technical explanation. Core concepts ({', '.join(matched_concepts[:2]) if matched_concepts else 'fundamental principles'}) were accurately articulated with sound reasoning."
    elif correctness_score >= 50:
        feedback = f"Partially correct answer. Covered basic ideas but would benefit from greater precision regarding {missing_concepts[0] if missing_concepts else 'underlying mechanisms'}."
    else:
        feedback = f"Incomplete or inaccurate explanation. Review foundational concepts regarding {question}."

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
        evaluationEngine="local_nlp"
    )


@app.post("/analyze")
async def analyze_nlp(body: NLPRequest):
    input_transcript = body.transcript or body.text or ""
    input_question = body.question or "Interview Practice Question"

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

class ResumeQuestionRequest(BaseModel):
    resumeText: str
    role: Optional[str] = "Software Engineer"
    count: Optional[int] = 5

@app.post("/extract-resume-text")
async def extract_resume(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        filename = file.filename or "resume.pdf"
        text = extract_text_from_bytes(contents, filename)
        return {"success": True, "text": text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text from resume: {str(e)}")

@app.post("/generate-resume-questions")
async def generate_resume_qs(body: ResumeQuestionRequest):
    try:
        qs = synthesize_questions_from_resume(body.resumeText, role=body.role or "Software Engineer", count=body.count or 5)
        return {"success": True, "questions": qs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
