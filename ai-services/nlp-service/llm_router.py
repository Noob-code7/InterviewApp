import os
import re
import json
import random
import httpx
from typing import List, Dict, Any, Optional

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Verified active live models on OpenRouter
FALLBACK_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-26b-a4b-it:free",
    "openrouter/free"
]

TECHNICAL_DIMENSIONS = [
    {
        "dimension": "architecture",
        "directive": "Focus on high-level system architecture, service boundaries, data flow between components, and synchronous vs asynchronous communication patterns.",
        "sample_angle": "How do components communicate and maintain state?"
    },
    {
        "dimension": "scalability",
        "directive": "Focus on high throughput, database indexing, caching strategies, horizontal scaling bottlenecks, and load handling.",
        "sample_angle": "What breaks when traffic increases by 50x?"
    },
    {
        "dimension": "implementation",
        "directive": "Focus on low-level implementation details, algorithm choices, concurrency primitives, data serialization, and state management.",
        "sample_angle": "How did you implement the specific core engine logic?"
    },
    {
        "dimension": "debugging",
        "directive": "Focus on complex edge cases, unexpected runtime failures, race conditions, memory leaks, and production telemetry.",
        "sample_angle": "What was the most difficult bug or failure mode you diagnosed?"
    },
    {
        "dimension": "tradeoffs",
        "directive": "Focus on architectural alternatives, why specific technologies/patterns were selected over alternatives, and technical debt.",
        "sample_angle": "Why did you choose this design over simpler or standard alternatives?"
    },
    {
        "dimension": "ownership",
        "directive": "Focus on the candidate's personal contribution, the most complex module they individually wrote, and difficult trade-offs they navigated.",
        "sample_angle": "Which specific part of the system did you personally design and build?"
    },
    {
        "dimension": "critical_thinking",
        "directive": "Focus on architectural retrospectives, design limitations, edge cases, and how they would redesign the system today with lessons learned.",
        "sample_angle": "If redesigning this from scratch today, what would you change and why?"
    }
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

def compute_similarity(q1: str, q2: str) -> float:
    """Compute normalized word-level Jaccard similarity between two questions."""
    stop_words = {"in", "your", "project", "the", "how", "did", "you", "what", "why", "and", "to", "of", "a", "an", "is", "for", "with"}
    words1 = {w.lower() for w in re.findall(r'\b\w+\b', q1) if w.lower() not in stop_words and len(w) > 2}
    words2 = {w.lower() for w in re.findall(r'\b\w+\b', q2) if w.lower() not in stop_words and len(w) > 2}
    if not words1 or not words2:
        return 0.0
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    return intersection / union

async def call_llm_with_fallback(
    prompt: str,
    system_prompt: str = "You are a Senior Technical Interviewer evaluating software engineering candidates.",
    temperature: float = 0.75,
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

    async with httpx.AsyncClient(timeout=8.0) as client:
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
                        content = choices[0]["message"].get("content", "")
                        if content and len(content.strip()) > 10:
                            return content
                else:
                    print(f"[LLMRouter] Status {response.status_code} for {model}")
            except Exception as e:
                print(f"[LLMRouter] Error with {model}: {e}")
                continue

    return None

def generate_smart_fallback_question(project: Dict[str, Any], dimension_key: str, role: str) -> Dict[str, Any]:
    """Generate an authentic, grounded fallback question matching the assigned dimension and real project details."""
    title = project.get("title", "Featured Project")
    tech_stack = project.get("techStack", [])
    stack_str = ", ".join(tech_stack[:3]) if tech_stack else "the chosen stack"

    dim_templates = {
        "architecture": {
            "text": f"In your project '{title}', walk me through the end-to-end data flow and how components communicate across {stack_str}.",
            "concepts": [f"System Architecture of {title}", "Component Communication", "Data Flow"],
            "keywords": [s.lower() for s in tech_stack] + ["architecture", "data flow", "components"]
        },
        "scalability": {
            "text": f"In '{title}', what would be the primary performance bottleneck if concurrent user requests increased by 50x, and how would you optimize {tech_stack[0] if tech_stack else 'the database'} to handle it?",
            "concepts": [f"Scalability Bottlenecks in {title}", "Concurrency Handling", "Optimization"],
            "keywords": [s.lower() for s in tech_stack] + ["scalability", "bottleneck", "concurrency", "optimization"]
        },
        "implementation": {
            "text": f"For '{title}', explain a specific technical implementation decision you made regarding {tech_stack[0] if tech_stack else 'state management'} and how you structured the core business logic.",
            "concepts": [f"Implementation Details in {title}", "Design Patterns", "Logic Structure"],
            "keywords": [s.lower() for s in tech_stack] + ["implementation", "logic", "structure"]
        },
        "debugging": {
            "text": f"What was the most challenging technical bug, race condition, or edge case you encountered while building '{title}', and how did you diagnose and resolve it?",
            "concepts": [f"Debugging in {title}", "Root Cause Analysis", "Failure Resolution"],
            "keywords": [s.lower() for s in tech_stack] + ["debugging", "troubleshooting", "edge cases", "resolution"]
        },
        "tradeoffs": {
            "text": f"When building '{title}', what architectural or technology trade-offs did you consider before deciding on {stack_str} over alternative approaches?",
            "concepts": [f"Technical Trade-offs in {title}", "Design Choices", "Alternative Evaluation"],
            "keywords": [s.lower() for s in tech_stack] + ["trade-offs", "alternatives", "design choices"]
        },
        "ownership": {
            "text": f"In '{title}', what specific architectural module or feature did you personally engineer from scratch, and what technical challenges did you individually overcome?",
            "concepts": [f"Individual Ownership in {title}", "Core Engineering Contribution", "Problem Solving"],
            "keywords": [s.lower() for s in tech_stack] + ["ownership", "contribution", "engineering"]
        },
        "critical_thinking": {
            "text": f"Looking back at '{title}', if you were tasked with re-architecting the system from scratch today, what design decision would you change and why?",
            "concepts": [f"Architectural Retrospective on {title}", "Technical Debt", "System Evolution"],
            "keywords": [s.lower() for s in tech_stack] + ["redesign", "retrospective", "technical debt", "evolution"]
        }
    }

    selected = dim_templates.get(dimension_key, dim_templates["architecture"])
    return {
        "questionText": selected["text"],
        "track": "project",
        "dimension": dimension_key,
        "expectedConcepts": selected["concepts"],
        "expectedKeywords": selected["keywords"],
        "referenceAnswer": f"Candidate should demonstrate concrete knowledge of {title}, detailing {dimension_key} trade-offs and implementation realities.",
        "projectContext": project
    }

# 1. Project Question Generator (Track 3)

async def generate_project_questions_llm(
    projects: List[Dict[str, Any]],
    role: str = "Software Engineer",
    count: int = 2,
    session_id: Optional[str] = None,
    session_index: int = 0,
    previous_questions: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Generate diverse, deeply technical project questions grounded strictly in candidate's actual projects.
    Rotates dimensions across sessions and guarantees semantic deduplication.
    """
    if not projects:
        return []

    valid_projects = [p for p in projects if p.get("title") and len(p.get("title", "")) >= 2]
    if not valid_projects:
        valid_projects = projects

    # Deterministic session-driven dimension offset for cross-session diversity
    entropy_seed = hash(str(session_id) + str(session_index)) if session_id else random.randint(0, 1000)
    dim_offset = abs(entropy_seed) % len(TECHNICAL_DIMENSIONS)

    selected_dimensions = []
    for i in range(count):
        dim = TECHNICAL_DIMENSIONS[(dim_offset + i) % len(TECHNICAL_DIMENSIONS)]
        selected_dimensions.append(dim)

    # Format project context
    project_blocks = []
    for idx, p in enumerate(valid_projects):
        title = p.get("title", f"Project {idx+1}")
        tech = ", ".join(p.get("techStack", [])) or "Technical Stack"
        desc = p.get("description", "").strip()
        project_blocks.append(f"PROJECT #{idx+1}: {title}\nTechnologies: {tech}\nDetails & Features: {desc}")

    projects_context_text = "\n\n".join(project_blocks)

    dimension_instructions = []
    for idx, dim in enumerate(selected_dimensions):
        target_proj = valid_projects[idx % len(valid_projects)]
        dimension_instructions.append(
            f"Question {idx+1}: Target Project '{target_proj.get('title')}' on Dimension '{dim['dimension']}'. {dim['directive']}"
        )
    dimension_text = "\n".join(dimension_instructions)

    prev_text = ""
    if previous_questions:
        prev_text = "DO NOT repeat or paraphrase these questions already asked in this session:\n- " + "\n- ".join(previous_questions)

    prompt = f"""
You are a Principal Software Engineering Interviewer conducting a rigorous interview for a {role} role.
Based ON THE CANDIDATE'S ACTUAL RESUME PROJECTS listed below, generate {count} specific, non-repetitive technical interview questions.

CANDIDATE PROJECTS:
{projects_context_text}

ASSIGNED QUESTION DIMENSIONS:
{dimension_text}

{prev_text}

CRITICAL RULES:
1. NEVER treat a technology stack as a project. Every question MUST explicitly state the actual project name (e.g., "In InterviewAI...", "In CloudScale Metrics...").
2. Ground every question in the candidate's actual features, architecture, and problem description.
3. Vary the technical angle strictly according to each assigned dimension.
4. Avoid generic questions like "Why did you use React?". Ask deep "how", "why", and "what trade-off" engineering questions.

Respond STRICTLY with valid JSON (no markdown fences, no explanation):
{{
  "questions": [
    {{
      "questionText": "Explicit project question referencing project name and technical detail...",
      "track": "project",
      "projectIndex": 0,
      "dimension": "architecture",
      "expectedConcepts": ["Key concept 1", "Key concept 2"],
      "keywords": ["keyword1", "keyword2"],
      "referenceAnswer": "What an experienced engineer should discuss."
    }}
  ]
}}
"""

    raw_response = await call_llm_with_fallback(
        prompt,
        system_prompt="You are a Principal Technical Interviewer drilling into candidate project architecture and implementation.",
        temperature=0.8
    )

    parsed = parse_llm_json(raw_response)

    assembled = []
    if parsed and isinstance(parsed, dict) and "questions" in parsed and len(parsed["questions"]) > 0:
        for idx, q in enumerate(parsed["questions"]):
            proj_idx = q.get("projectIndex", idx % len(valid_projects))
            proj_ctx = valid_projects[proj_idx] if 0 <= proj_idx < len(valid_projects) else valid_projects[0]
            q_text = q.get("questionText", "").strip()

            proj_title = proj_ctx.get("title", "")
            if proj_title and proj_title.lower() not in q_text.lower():
                q_text = f"In your project '{proj_title}', {q_text[0].lower() + q_text[1:] if q_text else 'explain your architecture.'}"

            assembled.append({
                "questionText": q_text,
                "track": "project",
                "dimension": q.get("dimension", selected_dimensions[idx % len(selected_dimensions)]["dimension"]),
                "expectedConcepts": q.get("expectedConcepts", [f"Architecture of {proj_ctx.get('title')}"]),
                "expectedKeywords": q.get("keywords", [s.lower() for s in proj_ctx.get("techStack", [])]),
                "referenceAnswer": q.get("referenceAnswer", f"Candidate should explain architectural decisions in {proj_ctx.get('title')}."),
                "projectContext": proj_ctx
            })

    # Deduplication check against previous questions & within current batch
    final_questions = []
    seen_texts = list(previous_questions or [])

    for q in assembled:
        is_dup = False
        for seen in seen_texts:
            if compute_similarity(q["questionText"], seen) > 0.60:
                is_dup = True
                break
        if not is_dup:
            final_questions.append(q)
            seen_texts.append(q["questionText"])

    while len(final_questions) < count:
        missing_idx = len(final_questions)
        target_proj = valid_projects[missing_idx % len(valid_projects)]
        target_dim = selected_dimensions[missing_idx % len(selected_dimensions)]["dimension"]
        fb_q = generate_smart_fallback_question(target_proj, target_dim, role)

        if not any(compute_similarity(fb_q["questionText"], s) > 0.60 for s in seen_texts):
            final_questions.append(fb_q)
            seen_texts.append(fb_q["questionText"])
        else:
            alt_dim = TECHNICAL_DIMENSIONS[(dim_offset + missing_idx + 3) % len(TECHNICAL_DIMENSIONS)]["dimension"]
            alt_q = generate_smart_fallback_question(target_proj, alt_dim, role)
            final_questions.append(alt_q)
            seen_texts.append(alt_q["questionText"])

    return final_questions[:count]


# 2. Project Dynamic Follow-Up Generator (Track 4)

async def generate_project_followup_llm(
    project_context: Dict[str, Any],
    original_question: str,
    candidate_answer: str,
    previous_followups: Optional[List[Dict[str, str]]] = None,
    turn_count: int = 1
) -> Optional[Dict[str, Any]]:
    """
    Generate an authentic, probing follow-up strictly referencing what the candidate actually stated.
    """
    if turn_count > 2 or not candidate_answer or len(candidate_answer.strip().split()) < 4:
        return None

    proj_title = project_context.get("title", "Candidate Project")
    proj_stack = ", ".join(project_context.get("techStack", []))

    prev_context = ""
    if previous_followups:
        for idx, f in enumerate(previous_followups):
            prev_context += f"\nPrior Follow-up #{idx+1}: {f.get('question', '')}\nCandidate Answer #{idx+1}: {f.get('answer', '')}"

    prompt = f"""
You are an expert Technical Interviewer conducting a live interactive follow-up on the candidate's project: '{proj_title}' ({proj_stack}).

ORIGINAL QUESTION: "{original_question}"
CANDIDATE'S ACTUAL SPOKEN ANSWER: "{candidate_answer}"
{f"PREVIOUS DIALOGUE: {prev_context}" if prev_context else ""}

INSTRUCTIONS:
1. Read the candidate's actual answer carefully.
2. If the answer is exceptionally complete and leaves no engineering ambiguity, return "hasFollowUp": false.
3. Otherwise, formulate a follow-up question (Turn #{turn_count} of 2) that EXPLICITLY REFERENCES a specific technical claim, architecture choice, or statement they just made.
   (e.g., "You mentioned using Saga orchestrators for eventual consistency; how did you handle compensations when the payment gateway timed out?")
4. Never ask a disconnected question. The follow-up MUST directly challenge or probe the implications of their previous statement.
5. Keep the question direct and concise (1-2 sentences).

Respond STRICTLY with valid JSON (no markdown fences, no explanation):
{{
  "hasFollowUp": true,
  "followUpQuestion": "Specific follow-up referencing candidate's actual statement...",
  "referencedClaim": "The specific statement from candidate's answer being probed",
  "expectedConcepts": ["Key concept 1", "Key concept 2"],
  "keywords": ["keyword1", "keyword2"],
  "reasoning": "Why this follow-up probes their actual technical reasoning."
}}
"""

    raw_response = await call_llm_with_fallback(
        prompt,
        system_prompt="You are a Principal Engineer conducting live conversational follow-ups based on candidate statements.",
        temperature=0.75
    )

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

    # Intelligent contextual fallback referencing candidate's words
    words = [w for w in re.findall(r'\b[A-Za-z0-9\-]{4,}\b', candidate_answer) if w.lower() not in {"this", "that", "with", "from", "have", "were", "used", "also"}]
    key_phrase = words[0] if words else "that architecture"

    if turn_count == 1:
        return {
            "questionText": f"You mentioned {key_phrase} in your answer for '{proj_title}'. How does your system handle failure recovery and data integrity if that component crashes during peak traffic?",
            "track": "project_followup",
            "turn": 1,
            "expectedConcepts": ["Failure Recovery", "Data Integrity", "Fault Tolerance"],
            "keywords": [key_phrase.lower(), "failure", "recovery", "fault tolerance"],
            "reasoning": f"Probing failure recovery around candidate's mention of {key_phrase}."
        }
    else:
        return {
            "questionText": f"Given your explanation of '{proj_title}', what is the biggest trade-off or limitation of this design that you would address in version 2?",
            "track": "project_followup",
            "turn": 2,
            "expectedConcepts": ["Architectural Trade-offs", "Limitations", "System Evolution"],
            "keywords": ["trade-offs", "limitations", "evolution"],
            "reasoning": "Probing architectural self-awareness and trade-offs."
        }


# 3. Project Answer Evaluator

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
