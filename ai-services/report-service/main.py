import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Any

load_dotenv()

app = FastAPI(title="Report Generation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReportRequest(BaseModel):
    allAnswerAnalyses: list[Any]
    writingAnalysis: Any


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
    Aggregate all answer analyses + writing analysis via GPT-4o/Claude.
    STUB: Returns placeholder report. Real implementation in Phase 7.
    """
    if not body.allAnswerAnalyses:
        raise HTTPException(status_code=400, detail="allAnswerAnalyses cannot be empty")

    # Placeholder — Phase 7 implements real aggregation + GPT-4o/Claude call
    result = ReportResult(
        overallScore=0.0,
        strengths=["Stub: real strengths from AI analysis in Phase 7"],
        weaknesses=["Stub: real weaknesses from AI analysis in Phase 7"],
        behavioralInsights=["Stub: real behavioral insights in Phase 7"],
        recommendations=["Stub: real actionable recommendations in Phase 7"],
    )
    return {"success": True, "data": result.model_dump()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8005))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
