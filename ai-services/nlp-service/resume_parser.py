import os
import re
import io
from typing import Dict, List, Any, Optional
import docx
from pypdf import PdfReader

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extract text from DOCX, PDF, or TXT file bytes."""
    ext = os.path.splitext(filename.lower())[1]
    text = ""

    if ext == ".docx":
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join([cell.text.strip() for cell in row.cells if cell.text.strip()])
                    if row_text:
                        paragraphs.append(row_text)
            text = "\n".join(paragraphs)
        except Exception as err:
            print(f"[ResumeParser] Error reading DOCX file: {err}")

    elif ext == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    pages.append(extracted.strip())
            text = "\n".join(pages)
        except Exception as err:
            print(f"[ResumeParser] Error reading PDF file: {err}")

    else:
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception as err:
            print(f"[ResumeParser] Error decoding text file: {err}")

    return text.strip()

def detect_domain_tags_from_text(text: str) -> List[str]:
    """Detect core CS & engineering domain tags present in resume text."""
    lower_text = text.lower()
    tags = set()

    # OOP / Object Oriented
    if any(w in lower_text for w in ["oop", "oops", "object oriented", "inheritance", "polymorphism", "encapsulation", "class", "abstraction"]):
        tags.update(["oops", "oop", "object-oriented"])

    # DBMS / Database
    if any(w in lower_text for w in ["dbms", "database", "sql", "mysql", "postgresql", "mongodb", "acid", "relational", "nosql", "redis", "timescaledb"]):
        tags.update(["dbms", "sql", "database"])

    # Operating Systems
    if any(w in lower_text for w in ["os", "operating system", "deadlock", "process", "thread", "concurrency", "semaphore", "virtual memory", "linux"]):
        tags.update(["os", "operating-systems"])

    # Networking
    if any(w in lower_text for w in ["networking", "tcp", "udp", "ip", "http", "https", "socket", "dns", "osi", "rest api", "webrtc"]):
        tags.update(["networking", "networks"])

    # Data Structures & Algorithms
    if any(w in lower_text for w in ["data structure", "algorithm", "tree", "graph", "linked list", "array", "stack", "queue", "binary search", "dsa"]):
        tags.update(["ds", "data-structures", "algorithms"])

    # Web & Fullstack
    if any(w in lower_text for w in ["react", "node", "express", "fastapi", "django", "javascript", "typescript", "html", "css", "web", "next.js", "microservices"]):
        tags.update(["web", "fullstack", "frontend", "backend"])

    return list(tags)

def extract_skills_from_text(text: str) -> List[str]:
    """Extract list of recognized technical skills from resume text."""
    known_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
        "FastAPI", "Django", "Flask", "MongoDB", "PostgreSQL", "MySQL", "Redis",
        "Docker", "Kubernetes", "AWS", "Cloudflare", "Java", "C++", "C#", "Spring Boot",
        "Tailwind", "HTML", "CSS", "Git", "REST API", "GraphQL", "Microservices",
        "Kafka", "RabbitMQ", "PyTorch", "TensorFlow", "OpenCV", "NLP", "Operating Systems",
        "Database Systems", "Data Structures", "Algorithms", "DBMS", "OOP", "OOPS", "SQL",
        "WebRTC", "TimescaleDB", "Prometheus", "Grafana", "Go", "Golang", "Rust", "Linux"
    ]
    found = []
    for skill in known_skills:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            if skill not in found:
                found.append(skill)
    return found

def clean_project_title(raw_title: str) -> str:
    """Clean and extract a concise, authentic project title."""
    title = raw_title.strip()
    title = re.sub(r'^(?:project\s*\d*[:.-]?\s*|\d+[\.\)]\s*|[-•*–—]\s*)', '', title, flags=re.IGNORECASE).strip()
    title = re.sub(r'\s*\([^)]*\)$', '', title).strip()
    title = re.split(r'\s+[|–—]\s+', title)[0].strip()
    title = re.sub(r'^(?:title|name)[:\s]+', '', title, flags=re.IGNORECASE).strip()
    return title

def is_bullet_line(line: str) -> bool:
    """Check if a line represents a bullet point or action description."""
    trimmed = line.strip()
    if not trimmed:
        return False
    if re.match(r'^(?:[-•*–—+>]|\d+[\.\)])\s+', trimmed):
        return True
    first_word = trimmed.split()[0].lower()
    action_verbs = [
        "built", "developed", "architected", "engineered", "implemented", "designed",
        "created", "integrated", "optimized", "reduced", "scaled", "led", "managed",
        "utilized", "orchestrated", "deployed", "refactored", "migrated", "automated",
        "solved", "achieved", "configured", "spearheaded", "authored", "improved"
    ]
    if first_word in action_verbs:
        return True
    return False

def extract_projects_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Extract candidate project titles, technologies, and full descriptions from resume text.
    Strictly separates Projects from Tech Stacks and bullet points.
    """
    projects = []
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    project_section_started = False
    current_proj = None

    section_headers = [
        "projects", "academic projects", "personal projects", "key projects",
        "technical projects", "experience", "work experience", "professional experience",
        "selected projects", "relevant experience"
    ]
    stop_headers = [
        "education", "certifications", "achievements", "interests", "activities",
        "skills", "technical skills", "core competencies", "languages", "coursework",
        "honors", "publications", "leadership"
    ]
    
    invalid_titles = {
        "skills", "technical skills", "languages", "frameworks", "tools",
        "technologies", "databases", "core competencies", "education", "experience",
        "projects", "academic projects", "developer", "featured project"
    }

    for line in lines:
        lower_line = line.lower().strip()

        # Check section boundaries
        if any(lower_line == h or lower_line.startswith(h + ":") or lower_line.startswith(h + " -") for h in section_headers):
            project_section_started = True
            if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
                projects.append(current_proj)
            current_proj = None
            continue
        elif project_section_started and any(lower_line == h or lower_line.startswith(h + ":") for h in stop_headers):
            project_section_started = False
            if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
                projects.append(current_proj)
            current_proj = None
            continue

        if not project_section_started:
            continue

        # Inside project section: Check if line is a bullet point or a new project header
        if is_bullet_line(line):
            if current_proj:
                cleaned_line = re.sub(r'^(?:[-•*–—+>]|\d+[\.\)])\s*', '', line).strip()
                if current_proj["description"]:
                    current_proj["description"] += " " + cleaned_line
                else:
                    current_proj["description"] = cleaned_line
                
                for s in extract_skills_from_text(line):
                    if s not in current_proj["techStack"]:
                        current_proj["techStack"].append(s)
            else:
                cleaned_line = re.sub(r'^(?:[-•*–—+>]|\d+[\.\)])\s*', '', line).strip()
                current_proj = {
                    "title": "Technical Engineering Project",
                    "techStack": extract_skills_from_text(line),
                    "description": cleaned_line,
                    "role": "Developer"
                }
        else:
            clean_title = clean_project_title(line)
            if clean_title.lower() in invalid_titles or len(clean_title) < 2:
                continue

            if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
                projects.append(current_proj)

            proj_skills = extract_skills_from_text(line)
            current_proj = {
                "title": clean_title,
                "techStack": proj_skills,
                "description": "",
                "role": "Developer"
            }

    if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
        projects.append(current_proj)

    # Fallback if no structured project was extracted
    if not projects:
        action_lines = [l for l in lines if is_bullet_line(l) and any(w in l.lower() for w in ["developed", "built", "implemented", "system", "platform", "app", "model", "service"])]
        if action_lines:
            sample_desc = " ".join([re.sub(r'^(?:[-•*–—+>]|\d+[\.\)])\s*', '', l) for l in action_lines[:3]])
            skills = extract_skills_from_text(sample_desc)
            title_candidate = "Core Engineering System"
            match = re.search(r'\b(?:built|developed|implemented|architected)\s+(?:a|an|the)?\s*([A-Za-z0-9\-\s]{3,30}?)(?:\s+(?:using|with|in|to|for)\b|$)', sample_desc, re.IGNORECASE)
            if match and len(match.group(1).strip()) > 3:
                title_candidate = match.group(1).strip().title()

            projects.append({
                "title": title_candidate,
                "techStack": skills or ["Full Stack", "System Architecture"],
                "description": sample_desc[:400],
                "role": "Developer"
            })

    return projects[:4]

def synthesize_questions_from_resume(text: str, role: str = "Software Engineer", count: int = 5) -> Dict[str, Any]:
    """Synthesize candidate-specific interview questions grounded in extracted resume text."""
    if not text:
        text = role

    domain_tags = detect_domain_tags_from_text(text)
    found_skills = extract_skills_from_text(text)
    extracted_projects = extract_projects_from_text(text)

    questions = []

    # 1. Project-Grounded Questions (Track 3)
    if extracted_projects:
        for idx, proj in enumerate(extracted_projects[:3]):
            stack_str = ", ".join(proj["techStack"]) if proj["techStack"] else "relevant technologies"
            questions.append({
                "questionText": f"In your project '{proj['title']}', walk me through the end-to-end architecture, data flow, and how you engineered the core features using {stack_str}.",
                "track": "project",
                "dimension": "architecture",
                "expectedConcepts": [f"Architecture of {proj['title']}", f"Usage of {stack_str}", "Performance optimization and system trade-offs"],
                "keywords": [s.lower() for s in proj["techStack"]] + ["architecture", "bottleneck", "data flow", "optimization"],
                "referenceAnswer": f"Candidate should describe hands-on architectural decisions, data flow, and trade-offs in {proj['title']}.",
                "projectContext": proj
            })

    # 2. Subject/Skill Walkthrough (Track 2)
    if found_skills:
        skill1 = found_skills[0]
        questions.append({
            "questionText": f"According to your resume, you have experience with {skill1}. Can you walk us through a key system or challenge where you implemented {skill1}?",
            "track": "subject",
            "expectedConcepts": [f"Deep practical familiarity with {skill1}", "Component design and workflow"],
            "keywords": [skill1.lower(), "architecture", "implementation", "design", "workflow"],
            "referenceAnswer": f"Candidate should demonstrate practical experience and sound design with {skill1}."
        })

    # 3. Behavioral / HR (Track 1)
    questions.append({
        "questionText": f"As a candidate targeting {role} positions, describe a situation from your project experience where technical requirements changed unexpectedly. How did you adapt?",
        "track": "hr",
        "expectedConcepts": ["Clear situational context (STAR)", "Adaptive problem solving", "Team/stakeholder communication"],
        "keywords": ["adaptability", "communication", "requirements", "problem solving"],
        "referenceAnswer": "Candidate should articulate flexibility, structured prioritization, and proactive communication."
    })

    return {
        "questions": questions[:count],
        "domainTags": domain_tags,
        "skills": found_skills,
        "projects": extracted_projects,
        "summary": f"Detected {len(found_skills)} skills across {len(domain_tags)} technical domains and {len(extracted_projects)} projects."
    }
