import os
import re
import io
from typing import Dict, List, Any
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
    if any(w in lower_text for w in ["dbms", "database", "sql", "mysql", "postgresql", "mongodb", "acid", "relational", "nosql", "redis"]):
        tags.update(["dbms", "sql", "database"])

    # Operating Systems
    if any(w in lower_text for w in ["os", "operating system", "deadlock", "process", "thread", "concurrency", "semaphore", "virtual memory", "linux"]):
        tags.update(["os", "operating-systems"])

    # Networking
    if any(w in lower_text for w in ["networking", "tcp", "udp", "ip", "http", "https", "socket", "dns", "osi", "rest api"]):
        tags.update(["networking", "networks"])

    # Data Structures & Algorithms
    if any(w in lower_text for w in ["data structure", "algorithm", "tree", "graph", "linked list", "array", "stack", "queue", "binary search", "dsa"]):
        tags.update(["ds", "data-structures", "algorithms"])

    # Web & Fullstack
    if any(w in lower_text for w in ["react", "node", "express", "fastapi", "django", "javascript", "typescript", "html", "css", "web", "next.js"]):
        tags.update(["web", "fullstack", "frontend", "backend"])

    return list(tags)

def extract_skills_from_text(text: str) -> List[str]:
    """Extract list of recognized technical skills from resume text."""
    known_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
        "FastAPI", "Django", "Flask", "MongoDB", "PostgreSQL", "MySQL", "Redis",
        "Docker", "Kubernetes", "AWS", "Cloudflare", "Java", "C++", "C#", "Spring Boot",
        "Tailwind", "HTML", "CSS", "Git", "REST API", "GraphQL", "Microservices",
        "Machine Learning", "PyTorch", "TensorFlow", "OpenCV", "NLP", "Operating Systems",
        "Database Systems", "Data Structures", "Algorithms", "DBMS", "OOP", "OOPS", "SQL"
    ]
    found = []
    for skill in known_skills:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found.append(skill)
    return found

def extract_projects_from_text(text: str) -> List[Dict[str, Any]]:
    """Extract candidate project titles, technologies, and descriptions from resume text."""
    projects = []
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    project_section_started = False
    current_proj = None

    section_headers = ["projects", "academic projects", "personal projects", "key projects", "technical projects", "experience", "work experience"]
    stop_headers = ["education", "certifications", "achievements", "interests", "activities", "skills", "technical skills"]

    for line in lines:
        lower_line = line.lower()

        # Check section boundaries
        if any(lower_line.startswith(h) or lower_line == h for h in section_headers):
            project_section_started = True
            continue
        elif project_section_started and any(lower_line.startswith(h) or lower_line == h for h in stop_headers):
            project_section_started = False
            if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
                projects.append(current_proj)
            current_proj = None
            continue

        # Look for project entry candidates
        if project_section_started:
            if any(sep in line for sep in ["|", "–", "-", "•", ":"]) and len(line) < 120 and not line.startswith("•"):
                if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
                    projects.append(current_proj)

                parts = re.split(r"\||–|-|:", line, maxsplit=1)
                title = parts[0].strip()
                tech_snippet = parts[1].strip() if len(parts) > 1 else ""
                proj_skills = extract_skills_from_text(line)

                current_proj = {
                    "title": title if len(title) >= 3 else "Featured Project",
                    "techStack": proj_skills if proj_skills else extract_skills_from_text(tech_snippet),
                    "description": "",
                    "role": "Developer"
                }
            elif current_proj:
                current_proj["description"] = (current_proj["description"] + " " + line).strip()
                for s in extract_skills_from_text(line):
                    if s not in current_proj["techStack"]:
                        current_proj["techStack"].append(s)

    if current_proj and (len(current_proj["description"]) > 10 or current_proj["techStack"]):
        projects.append(current_proj)

    # Fallback: If no structured project section was parsed, construct from prominent action lines
    if not projects:
        action_lines = [l for l in lines if any(w in l.lower() for w in ["developed", "built", "implemented", "system", "platform", "app", "model"])]
        if action_lines:
            sample_desc = " ".join(action_lines[:3])
            projects.append({
                "title": "Resume Featured Project",
                "techStack": extract_skills_from_text(sample_desc) or ["Full Stack", "System Architecture"],
                "description": sample_desc[:250],
                "role": "Developer"
            })

    return projects[:3]

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
        for proj in extracted_projects[:2]:
            stack_str = ", ".join(proj["techStack"]) if proj["techStack"] else "relevant technologies"
            questions.append({
                "questionText": f"In your project '{proj['title']}' utilizing {stack_str}, can you explain the overall system architecture and the biggest technical bottleneck you resolved?",
                "track": "project",
                "expectedConcepts": [f"Architecture of {proj['title']}", f"Usage of {stack_str}", "Performance optimization or debugging"],
                "keywords": [s.lower() for s in proj["techStack"]] + ["architecture", "bottleneck", "optimization"],
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
