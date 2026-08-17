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
    if any(w in lower_text for w in ["dbms", "database", "sql", "mysql", "postgresql", "mongodb", "acid", "relational", "nosql"]):
        tags.update(["dbms", "sql", "database"])

    # Operating Systems
    if any(w in lower_text for w in ["os", "operating system", "deadlock", "process", "thread", "concurrency", "semaphore", "virtual memory"]):
        tags.update(["os", "operating-systems"])

    # Networking
    if any(w in lower_text for w in ["networking", "tcp", "udp", "ip", "http", "https", "socket", "dns", "osi"]):
        tags.update(["networking", "networks"])

    # Data Structures & Algorithms
    if any(w in lower_text for w in ["data structure", "algorithm", "tree", "graph", "linked list", "array", "stack", "queue", "binary search"]):
        tags.update(["ds", "data-structures", "algorithms"])

    # Web & Fullstack
    if any(w in lower_text for w in ["react", "node", "express", "fastapi", "django", "javascript", "typescript", "html", "css", "web"]):
        tags.update(["web", "fullstack", "frontend", "backend"])

    return list(tags)

def synthesize_questions_from_resume(text: str, role: str = "Software Engineer", count: int = 5) -> Dict[str, Any]:
    """Synthesize candidate-specific interview questions grounded in extracted resume text."""
    if not text:
        text = role

    domain_tags = detect_domain_tags_from_text(text)

    # Known technical skills dictionary
    known_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
        "FastAPI", "Django", "Flask", "MongoDB", "PostgreSQL", "MySQL", "Redis",
        "Docker", "Kubernetes", "AWS", "Cloudflare", "Java", "C++", "C#", "Spring Boot",
        "Tailwind", "HTML", "CSS", "Git", "REST API", "GraphQL", "Microservices",
        "Machine Learning", "PyTorch", "TensorFlow", "OpenCV", "NLP", "Operating Systems",
        "Database Systems", "Data Structures", "Algorithms", "DBMS", "OOP", "OOPS"
    ]

    found_skills = []
    for skill in known_skills:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found_skills.append(skill)

    # Extract potential project or bullet lines
    lines = [line.strip() for line in text.split("\n") if line.strip() and len(line.strip()) > 15]
    project_lines = [l for l in lines if any(w in l.lower() for w in ["project", "developed", "built", "implemented", "system", "app", "model", "platform"])]

    questions = []

    # Question 1: Primary Skill Walkthrough
    if found_skills:
        skill1 = found_skills[0]
        questions.append({
            "questionText": f"According to your resume, you have experience with {skill1}. Can you walk us through a key system or project where you implemented {skill1}?",
            "keywords": [skill1.lower(), "architecture", "implementation", "design", "workflow"],
            "referenceAnswer": f"Candidate should describe technical architecture and hands-on implementation using {skill1}."
        })

    # Question 2: Project Deep Dive
    if project_lines:
        proj_sample = project_lines[0][:90]
        questions.append({
            "questionText": f"In your resume experience, you mentioned: '{proj_sample}'. What were the main architectural trade-offs you considered during this work?",
            "keywords": ["trade-offs", "architecture", "performance", "design"],
            "referenceAnswer": "Candidate should articulate architectural trade-offs, technical decisions, and impact."
        })

    # Question 3: Secondary Skill / Bottlenecks
    if len(found_skills) > 1:
        skill2 = found_skills[1]
        questions.append({
            "questionText": f"You listed {skill2} in your background. What was the most challenging technical bottleneck or bug you resolved when working with {skill2}?",
            "keywords": [skill2.lower(), "bottleneck", "debugging", "optimization"],
            "referenceAnswer": f"Candidate should explain root cause analysis, performance bottlenecks, and solutions in {skill2}."
        })

    # Question 4: Behavioral Problem Solving
    questions.append({
        "questionText": f"As a candidate targeting {role} positions, describe a situation from your past resume experience where project requirements changed unexpectedly. How did you adapt?",
        "keywords": ["adaptability", "communication", "requirements", "problem solving"],
        "referenceAnswer": "Candidate should demonstrate flexibility, clear stakeholder communication, and technical agility."
    })

    # Question 5: SDLC, Testing & Deployment
    questions.append({
        "questionText": "Based on the technical stack in your resume, how do you handle unit testing, code reviews, and automated deployment pipelines?",
        "keywords": ["testing", "ci/cd", "code review", "best practices", "deployment"],
        "referenceAnswer": "Candidate should detail test coverage, continuous integration pipelines, and code quality standards."
    })

    return {
        "questions": questions[:count],
        "domainTags": domain_tags,
        "skills": found_skills
    }
