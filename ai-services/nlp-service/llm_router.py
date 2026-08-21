import os
import re
import json
import asyncio
import httpx
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
CONFIGURED_MODEL = os.getenv("LLM_MODEL", "liquid/lfm-2.5-2.6b:free")

FALLBACK_MODELS = [
    CONFIGURED_MODEL,
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openrouter/free"
]

def parse_llm_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Robustly extract and parse JSON from LLM responses with sanitization."""
    if not raw_text:
        return None
    try:
        # Strip <think> tags if any
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw_text)
        # Strip markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned.strip(), flags=re.MULTILINE | re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
        # Normalize smart quotes and special unicode dashes
        cleaned = cleaned.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
        cleaned = cleaned.replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')

        # 1. Direct attempt
        try:
            return json.loads(cleaned.strip())
        except Exception:
            pass

        # 2. Strip trailing commas before brackets
        cleaned_no_commas = re.sub(r",\s*([\]}])", r"\1", cleaned)
        try:
            return json.loads(cleaned_no_commas.strip())
        except Exception:
            pass

        # 3. Extract between first { and last }
        start = cleaned_no_commas.find("{")
        end = cleaned_no_commas.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned_no_commas[start:end+1])
            except Exception:
                pass
    except Exception as e:
        print(f"[LLMRouter] JSON Parse Error: {e}")
    return None

async def call_llm_json_with_retry(
    prompt: str,
    system_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 1500,
    timeout: float = 18.0
) -> Optional[Dict[str, Any]]:
    """
    Call the LLM and parse JSON. On parse failure (e.g. truncated reasoning-model
    output), retry ONCE with force_json and a doubled token budget before giving up.
    Never returns a silently-degraded result: callers fall back explicitly.
    """
    raw = await call_llm_with_fallback(
        prompt, system_prompt=system_prompt, temperature=temperature,
        max_tokens=max_tokens, timeout=timeout, force_json=False
    )
    parsed = parse_llm_json(raw) if raw else None
    if parsed is not None:
        return parsed

    print(f"[LLMRouter] JSON parse failed on first attempt (raw_len={len(raw) if raw else 0}); retrying with force_json + doubled tokens")
    raw = await call_llm_with_fallback(
        prompt, system_prompt=system_prompt, temperature=temperature,
        max_tokens=max_tokens * 2, timeout=timeout, force_json=True
    )
    parsed = parse_llm_json(raw) if raw else None
    if parsed is None:
        print(f"[LLMRouter] JSON parse failed on retry as well (raw_len={len(raw) if raw else 0})")
    return parsed

async def call_llm_with_fallback(
    prompt: str,
    system_prompt: str = "You are a backend JSON API. You MUST output ONLY valid JSON without markdown fences, thoughts, or preambles.",
    temperature: float = 0.3,
    max_tokens: int = 1500,
    timeout: float = 24.0,
    force_json: bool = False
) -> Optional[str]:
    """Call LLM with support for Groq, Google Gemini, OpenAI, and OpenRouter."""
    groq_key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
    gemini_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    openai_key = os.getenv("OPENAI_API_KEY") or OPENAI_API_KEY
    openrouter_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY") or OPENROUTER_API_KEY

    # 1. Try Groq API if key is present (Fastest: ~500 tokens/s, 14,400 req/day free)
    if groq_key:
        # Verified against live catalog (2026-08): llama-3.3-70b-versatile and
        # llama-3.1-8b-instant return 404 (decommissioned).
        # gpt-oss models are reasoning models: without reasoning_effort=low they burn
        # ~3000 hidden tokens before emitting content, truncating JSON output.
        groq_models = [
            ("groq/compound-mini", False),
            ("openai/gpt-oss-20b", True),
            ("openai/gpt-oss-120b", True),
            ("allam-2-7b", False),
            ("qwen/qwen3.6-27b", False),
        ]
        for model, is_reasoning in groq_models:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if is_reasoning:
                    payload["reasoning_effort"] = "low"
                if force_json and not model.startswith("groq/"):
                    payload["response_format"] = {"type": "json_object"}
                async with httpx.AsyncClient(timeout=min(12.0, timeout)) as client:
                    # 429s are transient per-minute org limits: back off once and
                    # retry the same model instead of degrading to templates.
                    resp = None
                    for attempt in range(2):
                        resp = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                            json=payload
                        )
                        if resp.status_code == 429 and attempt == 0:
                            try:
                                wait_s = min(6.0, float(resp.headers.get("retry-after") or 2.5))
                            except (TypeError, ValueError):
                                wait_s = 2.5
                            print(f"[LLMRouter] Groq 429 rate limit on {model}; backing off {wait_s:.1f}s then retrying")
                            await asyncio.sleep(wait_s)
                            continue
                        break
                    if resp.status_code == 200:
                        data = resp.json()
                        choice = data.get("choices", [{}])[0]
                        content = choice.get("message", {}).get("content", "")
                        if content and len(content.strip()) > 10:
                            return content
                        print(f"[LLMRouter] Groq empty content from {model} (finish={choice.get('finish_reason')})")
                    else:
                        print(f"[LLMRouter] Groq error ({resp.status_code}) on {model}: {resp.text[:100]}")
            except Exception as e:
                print(f"[LLMRouter] Groq exception on {model}: {e}")

    # 2. Try Google Gemini API if key is present (1,500 req/day free)
    if gemini_key:
        for gemini_model in ["gemini-1.5-flash", "gemini-2.0-flash"]:
            try:
                async with httpx.AsyncClient(timeout=min(7.0, timeout)) as client:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                    resp = await client.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json={
                            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                            "generationConfig": {
                                "temperature": temperature,
                                "maxOutputTokens": max_tokens,
                            }
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                content = parts[0]["text"]
                                if content and len(content.strip()) > 10:
                                    return content
                    else:
                        print(f"[LLMRouter] Gemini error ({resp.status_code}): {resp.text[:100]}")
            except Exception as e:
                print(f"[LLMRouter] Gemini exception: {e}")

    # 3. Try OpenAI API if key is present
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=min(7.0, timeout)) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if content and len(content.strip()) > 10:
                        return content
        except Exception as e:
            print(f"[LLMRouter] OpenAI exception: {e}")

    # 4. Try OpenRouter API
    if openrouter_key:
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "HTTP-Referer": "http://localhost:5000",
            "X-Title": "InterviewApp-AI-Service",
            "Content-Type": "application/json"
        }

        models_to_try = []
        for m in FALLBACK_MODELS:
            if m and m not in models_to_try:
                models_to_try.append(m)

        per_model_timeout = min(4.5, timeout / max(1, min(len(models_to_try), 2)))

        for model in models_to_try[:2]:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if force_json:
                payload["response_format"] = {"type": "json_object"}

            try:
                async with httpx.AsyncClient(timeout=per_model_timeout) as client:
                    response = await client.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        headers=headers,
                        json=payload
                    )

                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices", [])
                        if choices and "message" in choices[0]:
                            content = choices[0]["message"].get("content", "")
                            if content and len(content.strip()) > 10:
                                return content
                    else:
                        print(f"[LLMRouter] OpenRouter status {response.status_code} on {model}: {response.text[:100]}")
            except Exception as e:
                print(f"[LLMRouter] OpenRouter error/timeout with {model}: {e}")
                continue

    return None

# ── 1. Grounded Project Question Generator (Track 3) ──────────────────────────

def generate_smart_fallback_question(project: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    """Offline fallback question grounded in candidate project details."""
    title = project.get("title", "Candidate Project")
    tech_stack = project.get("techStack", [])
    stack_str = ", ".join(tech_stack[:4]) if tech_stack else "the technical stack"
    primary_tech = tech_stack[0] if tech_stack else "the core backend"
    secondary_tech = tech_stack[1] if len(tech_stack) > 1 else primary_tech

    templates = [
        {
            "text": f"In your project '{title}', walk me through the end-to-end data flow and how components communicate across {stack_str}.",
            "dimension": "architecture",
            "concepts": [f"System Architecture of {title}", "Component Communication", "Data Flow"],
            "keywords": [s.lower() for s in tech_stack] + ["architecture", "data flow", "components"]
        },
        {
            "text": f"In '{title}', what would be the primary performance bottleneck if concurrent user requests increased significantly, and how would you optimize {secondary_tech} to handle the load?",
            "dimension": "scalability",
            "concepts": [f"Scalability Bottlenecks in {title}", "Concurrency Handling", "Optimization"],
            "keywords": [s.lower() for s in tech_stack] + ["scalability", "bottleneck", "concurrency", "optimization"]
        },
        {
            "text": f"For '{title}', explain a specific technical implementation challenge you solved regarding {primary_tech} and how you structured the business logic.",
            "dimension": "implementation",
            "concepts": [f"Implementation Details in {title}", "Design Patterns", "Logic Structure"],
            "keywords": [s.lower() for s in tech_stack] + ["implementation", "logic", "structure", "challenge"]
        }
    ]

    selected = templates[index % len(templates)]
    return {
        "questionText": selected["text"],
        "track": "project",
        "dimension": selected["dimension"],
        "expectedConcepts": selected["concepts"],
        "expectedKeywords": selected["keywords"],
        "referenceAnswer": f"Candidate should explain concrete engineering choices, data flow, and trade-offs in {title}.",
        "projectContext": project
    }

async def generate_project_questions_llm(
    projects: List[Dict[str, Any]],
    role: str = "Software Engineer",
    count: int = 2,
    session_id: Optional[str] = None,
    session_index: int = 0,
    previous_questions: Optional[List[str]] = None,
    resume_text: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Generate technical interview questions grounded strictly in candidate resume projects."""
    if not projects and not resume_text:
        return []

    valid_projects = [p for p in projects if p.get("title") and len(p.get("title", "")) >= 2]
    if not valid_projects and projects:
        valid_projects = projects

    context_str = ""
    if resume_text and len(resume_text.strip()) > 50:
        context_str = f"CANDIDATE RESUME TEXT:\n{resume_text.strip()[:4000]}"
    else:
        project_summaries = []
        for idx, p in enumerate(valid_projects[:3]):
            title = p.get("title", f"Project {idx+1}")
            tech = ", ".join(p.get("techStack", [])) or "Technical Stack"
            desc = p.get("description", "").strip()
            project_summaries.append(f"PROJECT #{idx+1}: {title}\nTechnologies: {tech}\nDetails: {desc}")
        context_str = "CANDIDATE PROJECTS:\n" + "\n\n".join(project_summaries)

    prompt = f"""You are a Principal Technical Interviewer conducting an interview for a {role} role.
Based strictly on the candidate's real projects and experience provided below, generate {count} specific, deeply technical interview questions.

{context_str}

GUIDELINES:
1. Identify the candidate's actual projects (e.g. Essay Evaluation Platform, Docent Notebook, or systems they built).
2. Ask deep, scenario-based engineering questions: architecture, concurrency, database indexing, caching strategies, state management, API latency, or failure recovery.
3. Every question must directly probe what the candidate actually implemented with their tech stack.
4. Do NOT ask generic questions like "Walk me through your project". Ask specific "how" and "why" questions with technical depth.

Respond STRICTLY with valid JSON in this exact schema:
{{
  "questions": [
    {{
      "questionText": "Detailed question string grounded in the candidate's actual project features and tech stack.",
      "dimension": "architecture",
      "projectTitle": "Name of the Project",
      "expectedConcepts": ["concept1", "concept2"],
      "keywords": ["keyword1", "keyword2"],
      "referenceAnswer": "Brief 1-2 sentence summary of what a strong response should articulate."
    }}
  ]
}}"""

    parsed = await call_llm_json_with_retry(
        prompt,
        system_prompt="You are a Principal Software Engineering Interviewer. Output valid JSON only.",
        temperature=0.3,
        max_tokens=2500,
        timeout=18.0
    )

    if parsed and isinstance(parsed.get("questions"), list):
        valid_items = [
            q for q in parsed["questions"]
            if isinstance(q, dict) and str(q.get("questionText", "")).strip()
        ]
        if valid_items:
            final_qs = []
            for item in valid_items[:count]:
                p_title = item.get("projectTitle", "")
                matching_proj = next((p for p in valid_projects if p.get("title", "").lower() in p_title.lower() or p_title.lower() in p.get("title", "").lower()), (valid_projects[0] if valid_projects else {"title": p_title}))
                final_qs.append({
                    "questionText": item.get("questionText", ""),
                    "track": "project",
                    "dimension": item.get("dimension", "architecture"),
                    "expectedConcepts": item.get("expectedConcepts", []),
                    "expectedKeywords": item.get("keywords", item.get("expectedKeywords", [])),
                    "referenceAnswer": item.get("referenceAnswer", ""),
                    "projectContext": matching_proj
                })
            if len(final_qs) > 0:
                return final_qs[:count]

    # Fallback to smart generator if LLM fails or is unavailable
    fallback_qs = []
    for idx in range(count):
        target_proj = valid_projects[idx % len(valid_projects)] if valid_projects else {"title": "Candidate Project", "techStack": []}
        fallback_qs.append(generate_smart_fallback_question(target_proj, index=idx))
    return fallback_qs

# ── 2. Live Conversational Project Follow-Up Generator (Track 4) ───────────────

def generate_smart_fallback_followup(
    project_context: Dict[str, Any],
    original_question: str,
    candidate_answer: str,
    turn_count: int = 1
) -> Optional[Dict[str, Any]]:
    """Contextual fallback follow-up extracting spoken terms from candidate's answer."""
    title = project_context.get("title", "the system")
    words = [w for w in re.findall(r'\b[A-Za-z0-9\-]{4,}\b', candidate_answer) if w.lower() not in {
        "this", "that", "with", "from", "have", "were", "used", "also", "some", "like", "about", "into"
    }]
    key_phrase = words[0] if words else "that architecture"

    if turn_count == 1:
        return {
            "questionText": f"You mentioned {key_phrase} in your answer for '{title}'. How does your system guarantee data integrity and failure recovery if that component crashes during peak traffic?",
            "track": "project_followup",
            "turn": 1,
            "expectedConcepts": ["Failure Recovery", "Data Integrity", "Fault Tolerance"],
            "keywords": [key_phrase.lower(), "failure", "recovery", "fault tolerance"],
            "reasoning": f"Probing failure recovery around candidate's mention of {key_phrase}."
        }
    else:
        return {
            "questionText": f"Given your implementation of '{title}', what was the biggest architectural trade-off or limitation you had to accept, and how would you address it in version 2?",
            "track": "project_followup",
            "turn": 2,
            "expectedConcepts": ["Architectural Trade-offs", "Limitations", "System Evolution"],
            "keywords": ["trade-offs", "limitations", "evolution"],
            "reasoning": "Probing architectural self-awareness and trade-offs."
        }

async def generate_project_followup_llm(
    project_context: Dict[str, Any],
    original_question: str,
    candidate_answer: str,
    previous_followups: Optional[List[Dict[str, str]]] = None,
    turn_count: int = 1
) -> Optional[Dict[str, Any]]:
    """Generate an authentic, probing follow-up referencing candidate's spoken response."""
    if turn_count > 2 or not candidate_answer or len(candidate_answer.strip().split()) < 4:
        return None

    proj_title = project_context.get("title", "Candidate Project")
    proj_stack = ", ".join(project_context.get("techStack", [])) or "technical stack"

    prev_context = ""
    if previous_followups:
        for idx, f in enumerate(previous_followups):
            prev_context += f"\nPrior Question #{idx+1}: {f.get('question', '')}\nCandidate Answer #{idx+1}: {f.get('answer', '')}"

    prompt = f"""You are an expert Technical Interviewer conducting a live follow-up on the candidate's project: '{proj_title}' ({proj_stack}).

ORIGINAL QUESTION: "{original_question}"
CANDIDATE'S SPOKEN ANSWER: "{candidate_answer}"
{f"PREVIOUS CONVERSATION: {prev_context}" if prev_context else ""}

INSTRUCTIONS:
1. Formulate ONE follow-up question (Turn #{turn_count} of 2) that EXPLICITLY REFERENCES a specific technical claim, architecture choice, or statement they just made.
2. If the answer was vague, ask them to clarify specific implementation details or failure scenarios.
3. Keep the question direct and concise (1-2 sentences).

Respond STRICTLY with valid JSON:
{{
  "hasFollowUp": true,
  "followUpQuestion": "Specific follow-up referencing candidate's actual statement...",
  "expectedConcepts": ["concept1", "concept2"],
  "keywords": ["keyword1", "keyword2"],
  "reasoning": "Why this follow-up probes their technical reasoning."
}}"""

    parsed = await call_llm_json_with_retry(
        prompt,
        system_prompt="You are a Principal Engineer drilling into candidate project implementations. Output valid JSON only.",
        temperature=0.4,
        max_tokens=1500,
        timeout=15.0
    )

    if parsed and isinstance(parsed, dict):
        if parsed.get("hasFollowUp") is False:
            return None
        q_text = parsed.get("followUpQuestion") or parsed.get("questionText")
        if q_text:
            return {
                "questionText": q_text,
                "track": "project_followup",
                "turn": turn_count,
                "expectedConcepts": parsed.get("expectedConcepts", []),
                "keywords": parsed.get("keywords", []),
                "reasoning": parsed.get("reasoning", "")
            }

    # Fallback to smart contextual follow-up
    return generate_smart_fallback_followup(project_context, original_question, candidate_answer, turn_count)

# ── 3. Project Answer Evaluator ────────────────────────────────────────────────

async def evaluate_project_answer_llm(
    project_context: Dict[str, Any],
    question: str,
    answer: str,
    is_followup: bool = False
) -> Dict[str, Any]:
    """Evaluate candidate's verbal project response."""
    if not answer or len(answer.strip().split()) < 3:
        return {
            "relevanceScore": 20.0,
            "correctnessScore": 20.0,
            "completenessScore": 15.0,
            "communicationScore": 30.0,
            "overallScore": 20.0,
            "feedback": "Answer was too brief to demonstrate technical depth.",
            "strengths": [],
            "improvements": ["Elaborate on specific architectural components and trade-offs."],
            "evaluationEngine": "rule_based_fallback"
        }

    proj_title = project_context.get("title", "Project")
    proj_stack = ", ".join(project_context.get("techStack", [])) or "tech stack"

    prompt = f"""Evaluate the candidate's answer to this technical project question:

PROJECT: '{proj_title}' ({proj_stack})
QUESTION: "{question}"
CANDIDATE'S ANSWER: "{answer}"
TYPE: {"Project Follow-up" if is_followup else "Project Primary Question"}

Respond STRICTLY with valid JSON:
{{
  "relevanceScore": <float 0-100>,
  "correctnessScore": <float 0-100>,
  "completenessScore": <float 0-100>,
  "communicationScore": <float 0-100>,
  "overallScore": <float 0-100>,
  "feedback": "Objective technical feedback.",
  "strengths": ["Strength 1"],
  "improvements": ["Improvement 1"]
}}"""

    parsed = await call_llm_json_with_retry(
        prompt,
        system_prompt="You are a Principal Software Engineer evaluating project answers. Output valid JSON only.",
        temperature=0.3,
        max_tokens=1500,
        timeout=18.0
    )

    if parsed and isinstance(parsed, dict) and "overallScore" in parsed:
            return {
                "relevanceScore": float(parsed.get("relevanceScore", 70.0)),
                "correctnessScore": float(parsed.get("correctnessScore", 70.0)),
                "completenessScore": float(parsed.get("completenessScore", 70.0)),
                "communicationScore": float(parsed.get("communicationScore", 70.0)),
                "overallScore": float(parsed.get("overallScore", 70.0)),
                "feedback": str(parsed.get("feedback", "Project evaluation completed.")),
                "strengths": list(parsed.get("strengths", ["Addressed the technical question directly."])),
                "improvements": list(parsed.get("improvements", ["Continue articulating trade-offs clearly."])),
                "evaluationEngine": "llm_openrouter"
            }

    # Heuristic score calculation
    words = answer.strip().split()
    word_count = len(words)
    tech_stack = project_context.get("techStack", [])
    matched_stack = [t for t in tech_stack if t.lower() in answer.lower()]
    base_score = min(92.0, 50.0 + (word_count * 1.2) + (len(matched_stack) * 10.0))

    strengths = []
    if matched_stack:
        strengths.append(f"Accurately addressed key technical components: {', '.join(matched_stack[:3])}.")
    if word_count >= 30:
        strengths.append("Provided a detailed explanation with concrete technical context.")

    improvements = []
    if word_count < 25:
        improvements.append("Detail specific edge cases, failure recovery, or system trade-offs.")

    return {
        "relevanceScore": round(min(95.0, base_score + 2.0), 1),
        "correctnessScore": round(min(94.0, base_score), 1),
        "completenessScore": round(min(90.0, base_score - 4.0), 1),
        "communicationScore": round(min(95.0, base_score + 3.0), 1),
        "overallScore": round(min(95.0, base_score), 1),
        "feedback": f"Demonstrated practical familiarity with {proj_title}." if base_score >= 70 else "Provide more architectural depth.",
        "strengths": strengths or ["Addressed the technical question."],
        "improvements": improvements or ["Continue articulating system trade-offs."],
        "evaluationEngine": "smart_nlp_engine"
    }

# ── 4. Dynamic Technical & HR Question Generators ──────────────────────────────

async def generate_technical_questions_llm(
    role: str = "Software Engineer",
    topics: Optional[List[str]] = None,
    count: int = 4
) -> List[Dict[str, Any]]:
    """Generate dynamic scenario-based technical interview questions tailored to candidate role and topics."""
    topics_str = ", ".join(topics) if topics else "Operating Systems, Computer Networks, DBMS, System Design, Concurrency, Algorithms"
    prompt = f"""You are a Principal Software Engineering Interviewer conducting a rigorous technical interview for a {role} position.
Generate {count} distinct, deep, practical technical interview questions covering topics such as: {topics_str}.

GUIDELINES:
1. Ask practical, scenario-based, architectural, and edge-case questions rather than simple textbook definitions.
2. Focus on system trade-offs, concurrency, memory management, database indexing, caching strategies, and protocols.
3. Every question must be clear, rigorous, and relevant to a modern {role}.

Respond STRICTLY with valid JSON in this exact schema:
{{
  "questions": [
    {{
      "questionText": "Rigorous scenario-based technical question text...",
      "track": "subject",
      "expectedConcepts": ["concept 1", "concept 2"],
      "expectedKeywords": ["keyword 1", "keyword 2"],
      "referenceAnswer": "1-2 sentence reference guide of what a strong answer entails."
    }}
  ]
}}"""

    parsed = await call_llm_json_with_retry(
        prompt,
        system_prompt="You are a Principal Software Engineering Interviewer. Output valid JSON only.",
        temperature=0.4,
        max_tokens=2500,
        timeout=18.0
    )

    if parsed and isinstance(parsed.get("questions"), list):
        valid_items = [
            q for q in parsed["questions"]
            if isinstance(q, dict) and str(q.get("questionText", "")).strip()
        ]
        if valid_items:
            return valid_items[:count]

    return []

async def generate_hr_questions_llm(
    role: str = "Software Engineer",
    count: int = 4
) -> List[Dict[str, Any]]:
    """Generate dynamic behavioral and cultural interview questions using the STAR framework."""
    prompt = f"""You are an Executive Hiring Manager conducting an HR & Behavioral interview for a {role} candidate.
Generate {count} insightful behavioral and situational interview questions designed for the STAR framework (Situation, Task, Action, Result).

GUIDELINES:
1. Ask about handling conflicts, technical trade-off disagreements, ambiguous requirements, or leading challenging deliveries.
2. Formulate questions that probe leadership, ownership, and communication.

Respond STRICTLY with valid JSON in this exact schema:
{{
  "questions": [
    {{
      "questionText": "Insightful behavioral question text...",
      "track": "hr",
      "expectedConcepts": ["STAR structured response", "Ownership and collaboration"],
      "expectedKeywords": ["situation", "task", "action", "result", "ownership"],
      "referenceAnswer": "Candidate should describe a structured situation, specific actions taken, and measurable impact."
    }}
  ]
}}"""

    parsed = await call_llm_json_with_retry(
        prompt,
        system_prompt="You are an Executive Hiring Manager. Output valid JSON only.",
        temperature=0.4,
        max_tokens=2000,
        timeout=18.0
    )

    if parsed and isinstance(parsed.get("questions"), list):
        valid_items = [
            q for q in parsed["questions"]
            if isinstance(q, dict) and str(q.get("questionText", "")).strip()
        ]
        if valid_items:
            return valid_items[:count]

    return []
