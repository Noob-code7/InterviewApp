import os
import re
import math
import json
import httpx
from typing import Optional, List
from fastapi import FastAPI, HTTPException
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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class NLPRequest(BaseModel):
    text: Optional[str] = None
    question: Optional[str] = None
    transcript: Optional[str] = None
    questionType: Optional[str] = "mixed"  # 'technical', 'hr', 'mixed', 'resume', 'company'
    keywords: Optional[List[str]] = None
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


# ── Local NLP Concept & Semantic Analysis Engine ─────────────────────────────

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

    score = 30.0  # baseline for a coherent multi-word response
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
    keywords: Optional[List[str]] = None
) -> NLPResult:
    transcript_clean = transcript.strip()
    words = tokenize(transcript_clean)
    word_count = len(words)

    if not transcript_clean or word_count < 3:
        return NLPResult(
            relevanceScore=15.0,
            correctnessScore=10.0,
            completenessScore=10.0,
            communicationScore=20.0,
            structureScore=0.0,
            grammarScore=0.0,
            overallScore=13.8,
            feedback="The response was too short or quiet to evaluate.",
            strengths=["Attempted response"],
            improvements=["Provide a detailed explanation answering the question prompt."]
        )

    q_tokens = tokenize(question)
    q_tf = get_tf_vector(q_tokens)
    ans_tf = get_tf_vector(words)

    # 1. Relevance Score (Cosine similarity + keyword overlap)
    raw_sim = calculate_cosine_similarity(q_tf, ans_tf)

    # 2. Concept Matching & Correctness Score
    matched_keywords = []
    missing_keywords = []

    target_concepts = keywords or []
    if not target_concepts:
        # Fallback to non-stopword bigrams/unigrams from question
        target_concepts = extract_ngrams(question, 2) + q_tokens[:5]

    if target_concepts:
        ans_lower = transcript_clean.lower()
        for concept in target_concepts:
            c_clean = concept.lower().strip()
            if c_clean in ans_lower or any(word in ans_lower for word in c_clean.split()):
                matched_keywords.append(concept)
            else:
                missing_keywords.append(concept)

        match_ratio = len(matched_keywords) / len(target_concepts) if target_concepts else 0.0
    else:
        match_ratio = 0.0

    # Strict check for gibberish or non-relevant input
    if raw_sim < 0.05 and match_ratio == 0:
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
            improvements=["Provide a meaningful technical answer addressing the question prompt."]
        )

    relevance_score = min(98.0, round((raw_sim * 100), 1))
    correctness_score = min(98.0, round((match_ratio * 100.0), 1))

    # 3. Completeness Score
    if word_count >= 60:
        completeness_score = 90.0
    elif word_count >= 30:
        completeness_score = 80.0
    elif word_count >= 15:
        completeness_score = 65.0
    elif word_count >= 5:
        completeness_score = 40.0
    else:
        completeness_score = 10.0

    # 4. Communication & Structure Score
    connector_matches = [c for c in CONNECTORS if c in transcript_clean.lower()]
    star_score = 0
    for category, indicators in STAR_INDICATORS.items():
        if any(ind in transcript_clean.lower() for ind in indicators):
            star_score += 1

    structure_bonus = min(20.0, len(connector_matches) * 5.0 + star_score * 5.0)
    communication_score = min(96.0, round((match_ratio * 40.0) + structure_bonus + 30.0, 1))

    # 4b. Structure & Grammar Scores (heuristic, zero-dependency)
    structure_score = calculate_structure_score(transcript_clean)
    grammar_score = calculate_grammar_score(transcript_clean)

    # 5. Composite Overall Score
    overall_score = round(
        (relevance_score * 0.25) +
        (correctness_score * 0.35) +
        (completeness_score * 0.20) +
        (communication_score * 0.20),
        1
    )

    # 6. Dynamic Strengths & Improvements Generation
    strengths = []
    improvements = []

    if matched_keywords:
        strengths.append(f"Successfully incorporated key domain concepts: {', '.join(matched_keywords[:3])}.")
    if len(connector_matches) > 0:
        strengths.append("Used logical transition connectors to structure the response.")
    if word_count >= 40:
        strengths.append("Provided a comprehensive answer with sufficient detail.")

    if not strengths:
        strengths.append("Addressed the question prompt directly.")

    if missing_keywords:
        improvements.append(f"Consider explicitly mentioning concepts like: {', '.join(missing_keywords[:3])}.")
    if word_count < 30:
        improvements.append("Elaborate further with specific examples or technical implementation details.")
    if len(connector_matches) == 0:
        improvements.append("Use structured connective phrases (e.g. 'firstly', 'specifically', 'as a result') to improve verbal clarity.")
    if grammar_score < 65:
        improvements.append("Review sentence construction: fix run-on sentences, capitalization, and punctuation for clearer grammar.")
    if structure_score < 55:
        improvements.append("Organize the response into clear sections with transitions (intro, body, conclusion).")

    if not improvements:
        improvements.append("Maintain this high level of technical precision and structured communication.")

    feedback = (
        f"Solid response. You demonstrated understanding of the prompt. "
        f"{'Key concepts like ' + ', '.join(matched_keywords[:2]) + ' were explained well.' if matched_keywords else ''}"
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
        improvements=improvements
    )


async def evaluate_with_llm(
    question: str,
    transcript: str,
    q_type: str = "mixed",
    keywords: Optional[List[str]] = None
) -> Optional[NLPResult]:
    """
    Evaluates transcript using OpenRouter / OpenAI API if configured in .env.
    """
    api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
    if not api_key:
        return None

    endpoint = "https://openrouter.ai/api/v1/chat/completions" if OPENROUTER_API_KEY else "https://api.openai.com/v1/chat/completions"
    model_name = "google/gemini-2.5-flash" if OPENROUTER_API_KEY else "gpt-4o-mini"

    prompt = f"""
    You are an expert technical and HR interviewer evaluating a candidate's answer.
    
    QUESTION: "{question}"
    QUESTION TYPE: {q_type}
    EXPECTED CONCEPTS/KEYWORDS: {json.dumps(keywords or [])}
    CANDIDATE TRANSCRIPT: "{transcript}"
    
    Evaluate the response and return ONLY valid JSON matching this exact structure:
    {{
      "relevanceScore": 0-100,
      "correctnessScore": 0-100,
      "completenessScore": 0-100,
      "communicationScore": 0-100,
      "structureScore": 0-100,
      "grammarScore": 0-100,
      "overallScore": 0-100,
      "feedback": "Constructive 2-sentence summary feedback.",
      "strengths": ["Strength 1", "Strength 2"],
      "improvements": ["Improvement 1", "Improvement 2"]
    }}
    """

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"} if not OPENROUTER_API_KEY else None
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(endpoint, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                # Parse JSON block
                clean_json = re.sub(r"```json|```", "", content).strip()
                parsed = json.loads(clean_json)
                return NLPResult(**parsed)
    except Exception as e:
        print(f"[NLP Service] LLM API evaluation error: {e}. Falling back to Local NLP.")
        return None


@app.get("/health")
async def health():
    return {
        "success": True,
        "data": {
            "status": "OK",
            "service": "nlp-service",
            "port": 8003,
            "has_llm_key": bool(OPENROUTER_API_KEY or OPENAI_API_KEY)
        }
    }


from fastapi import File, UploadFile, Form
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
            "extractedText": resume_text
        }
    }


@app.post("/extract-and-generate-resume-questions")
async def extract_and_generate_resume(
    file: UploadFile = File(...),
    role: Optional[str] = Form("Software Engineer"),
    count: Optional[int] = Form(5)
):
    try:
        content = await file.read()
        extracted_text = extract_text_from_bytes(content, file.filename or "resume.docx")
        res = synthesize_questions_from_resume(extracted_text, role, count)
        return {
            "success": True,
            "data": {
                "questions": res["questions"],
                "domainTags": res["domainTags"],
                "skills": res["skills"],
                "extractedText": extracted_text,
                "filename": file.filename
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume file: {str(e)}")


from cse_evaluator import evaluate_with_cse_slm, init_cse_slm_evaluator


@app.post("/analyze")
async def analyze_nlp(body: NLPRequest):
    input_transcript = body.transcript or body.text or ""
    input_question = body.question or "Interview Practice Question"

    # 1. Try Local Quantized Qwen2.5-Coder CSE SLM Model (100% Free Local CPU Engine)
    try:
        slm_result = evaluate_with_cse_slm(
            question=input_question,
            transcript=input_transcript,
            role=body.questionType or "Software Engineer",
            keywords=body.keywords,
            reference_answer=body.referenceAnswer or ""
        )
        if slm_result:
            return {"success": True, "data": slm_result}
    except Exception as slm_err:
        print(f"[NLP Service] CSE SLM fallback trigger: {slm_err}")

    # 2. Try LLM API evaluation if key configured
    if OPENROUTER_API_KEY or OPENAI_API_KEY:
        llm_result = await evaluate_with_llm(
            question=input_question,
            transcript=input_transcript,
            q_type=body.questionType or "mixed",
            keywords=body.keywords
        )
        if llm_result:
            return {"success": True, "data": llm_result.model_dump()}

    # 3. Local Hybrid NLP Engine Fallback
    local_result = evaluate_with_local_nlp(
        question=input_question,
        transcript=input_transcript,
        q_type=body.questionType or "mixed",
        keywords=body.keywords
    )

    return {"success": True, "data": local_result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8003))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
