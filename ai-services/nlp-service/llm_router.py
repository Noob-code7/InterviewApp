import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Primary & High-Quality Free Fallback Models on OpenRouter
FALLBACK_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
]

def parse_llm_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Robustly extract and parse JSON from LLM markdown/text responses."""
    if not raw_text:
        return None
    try:
        clean_text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.MULTILINE)
        clean_text = re.sub(r"\s*```$", "", clean_text.strip(), flags=re.MULTILINE)
        return json.loads(clean_text)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", raw_text)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
    return None

async def call_llm_with_fallback(
    prompt: str,
    system_prompt: str = "You are a Senior Technical Interviewer evaluating software engineering candidates.",
    temperature: float = 0.3,
    max_tokens: int = 1000
) -> Optional[str]:
    if not OPENROUTER_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "InterviewApp-AI-Service",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in FALLBACK_MODELS:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            try:
                response = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload
                )

                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "")
                else:
                    print(f"[LLMRouter] OpenRouter status {response.status_code} on {model}")
            except Exception as e:
                print(f"[LLMRouter] OpenRouter error with {model}: {e}")
                continue

    return None

# ── 1. Project Question Generator (Track 3) ───────────────────────────────────

async def generate_project_questions_llm(
    projects: List[Dict[str, Any]],
    role: str = "Software Engineer",
    count: int = 2
) -> List[Dict[str, Any]]:
    if not projects:
        return []

    project_summaries = []
    for idx, p in enumerate(projects[:3]):
        title = p.get("title", f"Project {idx+1}")
        tech = ", ".join(p.get("techStack", []))
        desc = p.get("description", "")
        project_summaries.append(f"Project {idx+1}: {title}\nTech Stack: {tech}\nDescription: {desc}")

    projects_text = "\n\n".join(project_summaries)

    prompt = f"""
    You are an expert Technical Interviewer for a {role} role.
    Based ON THE CANDIDATE'S ACTUAL RESUME PROJECTS listed below, generate {count} specific, deeply technical interview questions.
    
    CANDIDATE PROJECTS:
    {projects_text}
    
    GUIDELINES:
    1. Ask about architecture, scalability, state management, database choices, error handling, or performance trade-offs.
    2. Ground each question directly in the candidate's chosen technology stack.
    3. Avoid generic questions like "Tell me about your project". Ask specific "how" and "why" engineering questions.
    
    Respond STRICTLY with valid JSON (no markdown fences):
    {{
      "questions": [
        {{
          "questionText": "Specific architectural question grounded in project...",
          "track": "project",
          "projectIndex": 0,
          "expectedConcepts": ["concept1", "concept2"],
          "keywords": ["key1", "key2"],
          "referenceAnswer": "Key technical points a strong engineer should address."
        }}
      ]
    }}
    """

    raw_response = await call_llm_with_fallback(prompt, system_prompt="You are a Principal Engineer creating rigorous technical interview questions.")
    parsed = parse_llm_json(raw_response)

    if parsed and isinstance(parsed, dict) and "questions" in parsed and len(parsed["questions"]) > 0:
        cleaned_questions = []
        for q in parsed["questions"]:
            proj_idx = q.get("projectIndex", 0)
            proj_ctx = projects[proj_idx] if 0 <= proj_idx < len(projects) else projects[0]
            cleaned_questions.append({
                "questionText": q.get("questionText", "Describe your project architecture."),
                "track": "project",
                "expectedConcepts": q.get("expectedConcepts", []),
                "expectedKeywords": q.get("keywords", []),
                "referenceAnswer": q.get("referenceAnswer", ""),
                "projectContext": proj_ctx
            })
        return cleaned_questions[:count]

    # Deterministic fallback if LLM is unavailable
    fallback_questions = []
    for p in projects[:count]:
        title = p.get("title", "your major project")
        stack_str = ", ".join(p.get("techStack", [])) or "the selected tech stack"
        fallback_questions.append({
            "questionText": f"In your project '{title}', explain the core architecture, data flow, and how {stack_str} handled performance bottlenecks.",
            "track": "project",
            "expectedConcepts": ["Architecture Design", "Data Flow", "Performance Optimization", "Trade-offs"],
            "expectedKeywords": [s.lower() for s in p.get("techStack", [])] + ["architecture", "scaling", "database"],
            "referenceAnswer": f"Candidate should describe hands-on architectural decisions and data flow in {title}.",
            "projectContext": p
        })
    return fallback_questions

# ── 2. Project Dynamic Follow-Up Generator (Track 4) ───────────────────────────

async def generate_project_followup_llm(
    project_context: Dict[str, Any],
    original_question: str,
    candidate_answer: str,
    previous_followups: Optional[List[Dict[str, str]]] = None,
    turn_count: int = 1
) -> Optional[Dict[str, Any]]:
    if turn_count > 2 or not candidate_answer or len(candidate_answer.strip().split()) < 4:
        return None

    prev_context = ""
    if previous_followups:
        for idx, f in enumerate(previous_followups):
            prev_context += f"\nFollow-up {idx+1}: {f.get('question', '')}\nCandidate Answer {idx+1}: {f.get('answer', '')}"

    proj_title = project_context.get("title", "Candidate Project")
    proj_stack = ", ".join(project_context.get("techStack", []))

    prompt = f"""
    You are an interviewer conducting a deep technical dive into the candidate's project: '{proj_title}' ({proj_stack}).
    
    ORIGINAL QUESTION: "{original_question}"
    CANDIDATE'S SPOKEN ANSWER: "{candidate_answer}"
    {f"PREVIOUS FOLLOW-UP CONVERSATION: {prev_context}" if prev_context else ""}
    
    TASK:
    Evaluate if a follow-up is necessary for Turn #{turn_count} (out of 2 max):
    - If the candidate's answer is already exceptionally comprehensive, deep, and leaves no technical ambiguities, return "hasFollowUp": false.
    - If the candidate made a technical claim (e.g. "We used Redis for caching"), drill into how they handled cache invalidation, race conditions, or memory overhead.
    - If the answer was vague or incomplete, ask them to clarify specific implementation details or failure scenarios.
    - Keep the question concise, direct, and professional (1-2 sentences).
    
    Respond STRICTLY with valid JSON (no markdown fences):
    {{
      "hasFollowUp": true,
      "followUpQuestion": "Specific, probing technical follow-up question...",
      "expectedConcepts": ["Key concept 1", "Key concept 2"],
      "keywords": ["keyword1", "keyword2"],
      "reasoning": "Why this follow-up is technically relevant based on what the candidate just said."
    }}
    """

    raw_response = await call_llm_with_fallback(prompt, system_prompt="You are a Principal Engineer drilling into candidate project implementations.")
    parsed = parse_llm_json(raw_response)

    if parsed and isinstance(parsed, dict):
        if parsed.get("hasFollowUp") is False or not parsed.get("followUpQuestion"):
            return None
        return {
            "questionText": parsed.get("followUpQuestion"),
            "track": "project_followup",
            "turn": turn_count,
            "expectedConcepts": parsed.get("expectedConcepts", []),
            "keywords": parsed.get("keywords", []),
            "reasoning": parsed.get("reasoning", "")
        }

    # Fallback follow-up if LLM is offline
    tech_first = project_context.get("techStack", ["this technology"])[0] if project_context.get("techStack") else "this architecture"
    if turn_count == 1:
        return {
            "questionText": f"Regarding your implementation with {tech_first} in '{proj_title}', what happens when this service encounters high concurrent traffic or network failure?",
            "track": "project_followup",
            "turn": 1,
            "expectedConcepts": ["High concurrency handling", "Error handling and fault tolerance"],
            "keywords": [tech_first.lower(), "concurrency", "error handling", "resilience"],
            "reasoning": "Probing concurrency and failure modes."
        }
    elif turn_count == 2:
        return {
            "questionText": f"If you had to redesign '{proj_title}' from scratch today with what you learned, what architectural choice would you change?",
            "track": "project_followup",
            "turn": 2,
            "expectedConcepts": ["Architectural reflection", "Technical debt resolution"],
            "keywords": ["trade-offs", "scalability", "redesign", "lessons"],
            "reasoning": "Assessing architectural maturity and lessons learned."
        }

    return None

# ── 3. Project Answer Evaluator ────────────────────────────────────────────────

async def evaluate_project_answer_llm(
    project_context: Dict[str, Any],
    question: str,
    answer: str,
    is_followup: bool = False
) -> Dict[str, Any]:
    if not answer or len(answer.strip().split()) < 3:
        return {
            "relevanceScore": 0.0,
            "correctnessScore": 0.0,
            "completenessScore": 0.0,
            "communicationScore": 0.0,
            "overallScore": 0.0,
            "feedback": "No technical answer provided to the project question.",
            "strengths": [],
            "improvements": ["Provide concrete technical details regarding project architecture and implementation choices."],
            "source": "llm",
            "evaluationEngine": "llm_openrouter"
        }

    proj_title = project_context.get("title", "Candidate Project")
    proj_stack = ", ".join(project_context.get("techStack", []))

    prompt = f"""
    Evaluate the candidate's answer to the following technical project question:
    
    PROJECT: '{proj_title}' (Technologies: {proj_stack})
    QUESTION: "{question}"
    CANDIDATE'S SPOKEN ANSWER: "{answer}"
    TYPE: {"Project Follow-up Deep Dive" if is_followup else "Project Primary Question"}
    
    EVALUATION CRITERIA:
    1. Relevance (0-100): Did the candidate answer the specific engineering question asked?
    2. Correctness (0-100): Are the technical claims accurate for the stated tech stack?
    3. Completeness (0-100): Did they explain trade-offs, architecture, or edge cases?
    4. Communication (0-100): Was the explanation structured, clear, and professional?
    
    Respond STRICTLY with valid JSON (no markdown):
    {{
      "relevanceScore": <float 0-100>,
      "correctnessScore": <float 0-100>,
      "completenessScore": <float 0-100>,
      "communicationScore": <float 0-100>,
      "overallScore": <float 0-100>,
      "feedback": "2-sentence objective technical feedback.",
      "strengths": ["Specific authentic project strength 1", "Specific project strength 2"],
      "improvements": ["Actionable engineering improvement 1", "Actionable engineering improvement 2"]
    }}
    """

    raw_response = await call_llm_with_fallback(prompt, system_prompt="You are a Principal Software Engineer evaluating project candidate technical answers.")
    parsed = parse_llm_json(raw_response)

    if parsed and isinstance(parsed, dict) and "overallScore" in parsed:
        return {
            "relevanceScore": float(parsed.get("relevanceScore", 70.0)),
            "correctnessScore": float(parsed.get("correctnessScore", 70.0)),
            "completenessScore": float(parsed.get("completenessScore", 70.0)),
            "communicationScore": float(parsed.get("communicationScore", 70.0)),
            "overallScore": float(parsed.get("overallScore", 70.0)),
            "feedback": str(parsed.get("feedback", "Project evaluation completed.")),
            "strengths": list(parsed.get("strengths", ["Demonstrated project familiarity"])),
            "improvements": list(parsed.get("improvements", ["Elaborate further on architectural trade-offs"])),
            "source": "llm",
            "evaluationEngine": "llm_openrouter"
        }

    # Fallback to local concept evaluation
    from main import evaluate_with_local_nlp
    local_res = evaluate_with_local_nlp(
        question=question,
        transcript=answer,
        q_type="technical",
        keywords=[s.lower() for s in project_context.get("techStack", [])]
    )
    res_dict = local_res.model_dump()
    res_dict["source"] = "local"
    res_dict["evaluationEngine"] = "local_nlp"
    return res_dict
