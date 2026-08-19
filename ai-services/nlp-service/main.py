import os
import re
import math
import json
import asyncio
import httpx
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Intelligent NLP & Answer Evaluation Service", version="2.0.0")

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

CONNECTORS = {
  "because", "therefore", "however", "consequently", "specifically", "for instance",
  "for example", "furthermore", "in addition", "such as", "as a result", "firstly",
  "secondly", "finally", "means", "defined as", "used for", "allows us to"
}

STAR_INDICATORS = {
  "situation": ["when i", "in my previous", "during my", "at my", "project where", "working on"],
  "task": ["my goal", "my task", "we needed to", "responsible for", "had to"],
  "action": ["i implemented", "i created", "i designed", "i resolved", "i led", "i refactored", "i communicated"],
  "result": ["as a result", "outcome", "improved", "increased", "reduced", "successfully", "learned"]
}

def tokenize(text: str) -> List[str]:
    text_clean = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in text_clean.split() if w and w not in STOPWORDS]

def extract_ngrams(text: str, n: int = 2) -> List[str]:
    words = [w for w in re.sub(r"[^\w\s]", " ", text.lower()).split() if w and w not in STOPWORDS and len(w) > 1]
    if len(words) < n:
        return words if words else []
    return [" ".join(words[i:i+n]) for i in range(len(words)-n+1)]

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
    word_count = len(words)

    # Handle Silence / Empty response
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

    q_tokens = tokenize(question)
    q_tf = get_tf_vector(q_tokens)
    ans_tf = get_tf_vector(words)

    # 1. Relevance Score
    raw_q_sim = calculate_cosine_similarity(q_tf, ans_tf)
    raw_ref_sim = 0.0
    if reference_answer:
        ref_tokens = tokenize(reference_answer)
        ref_tf = get_tf_vector(ref_tokens)
        raw_ref_sim = calculate_cosine_similarity(ref_tf, ans_tf)

    relevance_sim = max(raw_q_sim, raw_ref_sim) if reference_answer else raw_q_sim

    # 2. Concept Matching & Correctness Score
    matched_concepts = []
    missing_concepts = []
    ans_lower = transcript_clean.lower()

    target_list = expected_concepts or keywords or []
    if not target_list:
        target_list = extract_ngrams(question, 2) + q_tokens[:5]

    for item in target_list:
        item_clean = item.lower().strip()
        item_words = tokenize(item_clean)
        if item_clean in ans_lower or (item_words and sum(1 for w in item_words if w in ans_lower) >= max(1, len(item_words) * 0.6)):
            matched_concepts.append(item)
        else:
            missing_concepts.append(item)

    concept_match_ratio = len(matched_concepts) / len(target_list) if target_list else 0.0

    # Misconception Check
    detected_misconceptions = []
    misconception_penalty = 0.0
    if common_misconceptions:
        for misc in common_misconceptions:
            m_words = tokenize(misc.lower())
            if m_words and sum(1 for w in m_words if w in ans_lower) >= max(2, len(m_words) * 0.7):
                detected_misconceptions.append(misc)
                misconception_penalty += 15.0

    # Strict check for gibberish or non-relevant input
    if relevance_sim < 0.05 and concept_match_ratio == 0:
        return NLPResult(
            relevanceScore=0.0,
            correctnessScore=0.0,
            completenessScore=0.0,
            communicationScore=0.0,
            structureScore=0.0,
            grammarScore=0.0,
            overallScore=0.0,
            feedback="Response contains invalid, non-relevant, or gibberish text.",
            strengths=[],
            improvements=["Provide a meaningful technical answer addressing the question prompt."],
            evaluationEngine="local_nlp"
        )

    relevance_score = min(98.0, round(relevance_sim * 100, 1))
    correctness_score = min(98.0, max(0.0, round((concept_match_ratio * 100.0) - misconception_penalty, 1)))

    # 3. Completeness Score
    if word_count >= 50 and concept_match_ratio >= 0.5:
        completeness_score = 92.0
    elif word_count >= 30 and concept_match_ratio >= 0.3:
        completeness_score = 78.0
    elif word_count >= 15:
        completeness_score = 60.0
    elif word_count >= 5:
        completeness_score = 35.0
    else:
        completeness_score = 10.0

    # 4. Communication & Structure Score
    connector_matches = [c for c in CONNECTORS if c in ans_lower]
    star_score = 0
    for category, indicators in STAR_INDICATORS.items():
        if any(ind in ans_lower for ind in indicators):
            star_score += 1

    structure_bonus = min(20.0, len(connector_matches) * 5.0 + star_score * 5.0)
    communication_score = min(96.0, round((concept_match_ratio * 30.0) + structure_bonus + 40.0, 1))

    structure_score = calculate_structure_score(transcript_clean)
    grammar_score = calculate_grammar_score(transcript_clean)

    # 5. Dynamic Weighted Composite Score
    rubric = scoring_rubric or {}
    r_wt = rubric.get("relevanceWeight", 0.25)
    c_wt = rubric.get("conceptWeight", 0.35)
    comp_wt = rubric.get("completenessWeight", 0.20)
    s_wt = rubric.get("structureWeight", 0.20)

    overall_score = round(
        (relevance_score * r_wt) +
        (correctness_score * c_wt) +
        (completeness_score * comp_wt) +
        (communication_score * s_wt),
        1
    )

    # 6. Dynamic Strengths & Actionable Improvements
    strengths = []
    improvements = []

    if matched_concepts:
        clean_strengths = [c for c in matched_concepts if c.lower() not in STOPWORDS]
        if clean_strengths:
            strengths.append(f"Successfully incorporated key domain concepts: {', '.join(clean_strengths[:3])}.")
    if len(connector_matches) > 0:
        strengths.append("Used structured transition connectors to articulate technical reasoning.")
    if word_count >= 35 and concept_match_ratio >= 0.5:
        strengths.append("Provided a comprehensive answer with strong technical depth.")
    if not strengths:
        strengths.append("Attempted the technical prompt directly.")

    if missing_concepts:
        clean_missing = [c for c in missing_concepts if c.lower() not in STOPWORDS]
        if clean_missing:
            improvements.append(f"Consider explicitly detailing: {', '.join(clean_missing[:3])}.")
    if detected_misconceptions:
        for misc in detected_misconceptions:
            improvements.append(f"Clarify distinction: {misc}.")
    if word_count < 25:
        improvements.append("Elaborate further with specific architectural or code implementation examples.")
    if len(connector_matches) == 0:
        improvements.append("Use structured connective phrases (e.g. 'specifically', 'for instance', 'consequently') to improve clarity.")

    feedback = (
        f"Technical response evaluated. "
        f"{'Key concepts like ' + ', '.join(matched_concepts[:2]) + ' were explained accurately.' if matched_concepts else 'Elaborate further on core principles.'}"
    ).strip()

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


@app.post("/generate-resume-questions")
async def generate_resume_questions_endpoint(body: ResumeQuestionRequest):
    resume_text = body.resumeText or ""
    role = body.role or "Software Engineer"
    count = body.count or 5

    res = synthesize_questions_from_resume(resume_text, role, count)
    return {
        "success": True,
        "data": {
            "questions": res["questions"],
            "domainTags": res["domainTags"],
            "skills": res["skills"],
            "projects": res.get("projects", []),
            "rawText": resume_text,
            "summary": res["summary"]
        }
    }


@app.post("/extract-and-generate-resume-questions")
async def extract_and_generate_resume_questions_endpoint(
    file: UploadFile = File(...),
    role: str = Form("Software Engineer"),
    count: int = Form(5)
):
    file_bytes = await file.read()
    extracted_text = extract_text_from_bytes(file_bytes, file.filename or "resume.pdf")
    res = synthesize_questions_from_resume(extracted_text, role, count)
    return {
        "success": True,
        "data": {
            "extractedText": extracted_text,
            "rawText": extracted_text,
            "questions": res.get("questions", []),
            "domainTags": res.get("domainTags", []),
            "skills": res.get("skills", []),
            "projects": res.get("projects", []),
            "summary": res.get("summary", "")
        }
    }


# ── LLM Router Endpoints for Project Context & Dynamic Follow-ups ───────────────
from llm_router import (
    generate_project_questions_llm,
    generate_project_followup_llm,
    evaluate_project_answer_llm
)

class ProjectQuestionsRequest(BaseModel):
    projects: List[Dict[str, Any]]
    role: Optional[str] = "Software Engineer"
    count: Optional[int] = 2

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

@app.post("/generate-project-questions")
async def generate_project_questions_endpoint(body: ProjectQuestionsRequest):
    questions = await generate_project_questions_llm(body.projects, body.role or "Software Engineer", body.count or 2)
    return {"success": True, "data": {"questions": questions}}

@app.post("/generate-project-followup")
async def generate_project_followup_endpoint(body: ProjectFollowUpRequest):
    followup = await generate_project_followup_llm(
        project_context=body.projectContext,
        original_question=body.question,
        candidate_answer=body.answer,
        previous_followups=body.previousFollowUps,
        turn_count=body.turnCount or 1
    )
    return {"success": True, "data": followup}

@app.post("/evaluate-project-answer")
async def evaluate_project_answer_endpoint(body: ProjectEvaluateRequest):
    eval_res = await evaluate_project_answer_llm(
        project_context=body.projectContext,
        question=body.question,
        answer=body.answer,
        is_followup=body.isFollowUp or False
    )
    return {"success": True, "data": eval_res}

if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('PORT', 8003))
    uvicorn.run('main:app', host='0.0.0.0', port=port, reload=True)
