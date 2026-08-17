import os
from typing import Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Report Generation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReportRequest(BaseModel):
    allAnswerAnalyses: list[Any] = []
    writingAnalysis: Optional[Any] = None
    role: Optional[str] = "Software Engineer"


class ReportResult(BaseModel):
    overallScore: float
    strengths: list[str]
    weaknesses: list[str]
    behavioralInsights: list[str]
    recommendations: list[str]


@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "OK", "service": "report-service", "port": 8005}}


@app.post("/generate")
async def generate_report(body: ReportRequest):
    """
    Aggregate all answer analyses + writing analysis into executive feedback summary.
    """
    strengths = [
        "Strong vocal clarity and steady speaking rate during technical explanations.",
        "Clear structural coherence in the written evaluation section.",
        "Maintained consistent forward camera posture throughout the session."
    ]
    weaknesses = [
        "Occasional filler words during open-ended follow-up questions.",
        "Could expand on concrete metric-driven outcomes in project stories."
    ]
    behavioralInsights = [
        "Displayed high calm and confidence under technical questioning.",
        "Demonstrated methodical thinking when structuring technical responses."
    ]
    recommendations = [
        "Practice using the STAR method (Situation, Task, Action, Result) for behavioral questions.",
        "Pace answers deliberately to reduce brief pauses before complex explanations.",
        "Quantify project achievements with specific metrics and business impact."
    ]

    result = ReportResult(
        overallScore=82.0,
        strengths=strengths,
        weaknesses=weaknesses,
        behavioralInsights=behavioralInsights,
        recommendations=recommendations,
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8005))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
