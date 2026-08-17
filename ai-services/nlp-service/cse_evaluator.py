import os
import json
import re
from typing import Dict, Any, Optional

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_FILENAME = "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf"
MODEL_PATH = os.path.join(MODEL_DIR, MODEL_FILENAME)

slm_instance = None
slm_loaded = False

def get_or_download_model_path() -> Optional[str]:
    """Check if quantized GGUF model exists, or download from HuggingFace Hub."""
    if os.path.exists(MODEL_PATH):
        return MODEL_PATH

    os.makedirs(MODEL_DIR, exist_ok=True)
    try:
        from huggingface_hub import hf_hub_download
        print(f"[CSE SLM Evaluator] Downloading 4-bit Quantized Qwen2.5-Coder-1.5B (~1.1 GB) to {MODEL_DIR}...")
        downloaded_path = hf_hub_download(
            repo_id="Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
            filename=MODEL_FILENAME,
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False
        )
        print(f"[CSE SLM Evaluator] Model downloaded successfully to {downloaded_path}")
        return downloaded_path
    except Exception as err:
        print(f"[CSE SLM Evaluator] Warning: Failed to download model: {err}")
        return None

def init_cse_slm_evaluator() -> bool:
    """Initialize ctransformers GGUF model instance on CPU."""
    global slm_instance, slm_loaded
    if slm_loaded and slm_instance is not None:
        return True

    model_file = get_or_download_model_path()
    if not model_file or not os.path.exists(model_file):
        print("[CSE SLM Evaluator] Model file unreadable. Hybrid local NLP will act as primary engine.")
        return False

    try:
        from ctransformers import AutoModelForCausalLM
        print(f"[CSE SLM Evaluator] Loading Qwen2.5-Coder-1.5B into CPU memory via ctransformers...")
        slm_instance = AutoModelForCausalLM.from_file(
            model_file,
            model_type="qwen2",
            context_length=2048,
            threads=max(1, (os.cpu_count() or 4) - 1)
        )
        slm_loaded = True
        print("[CSE SLM Evaluator] ✅ Qwen2.5-Coder CSE Model loaded successfully into memory!")
        return True
    except Exception as err:
        print(f"[CSE SLM Evaluator] Note: ctransformers engine loading note: {err}")
        try:
            from llama_cpp import Llama
            slm_instance = Llama(
                model_path=model_file,
                n_ctx=2048,
                n_threads=max(1, (os.cpu_count() or 4) - 1),
                verbose=False
            )
            slm_loaded = True
            print("[CSE SLM Evaluator] ✅ Qwen2.5-Coder CSE Model loaded via llama-cpp!")
            return True
        except Exception as llama_err:
            print(f"[CSE SLM Evaluator] llama-cpp engine note: {llama_err}")
            return False

def evaluate_with_cse_slm(
    question: str,
    transcript: str,
    role: str = "Software Engineer",
    keywords: Optional[list] = None,
    reference_answer: str = ""
) -> Optional[Dict[str, Any]]:
    """Evaluate candidate technical response using local quantized CSE SLM."""
    global slm_instance, slm_loaded

    if not slm_loaded or slm_instance is None:
        if not init_cse_slm_evaluator():
            return None

    if not transcript or len(transcript.strip().split()) < 3:
        return {
            "relevanceScore": 0.0,
            "correctnessScore": 0.0,
            "completenessScore": 0.0,
            "communicationScore": 0.0,
            "structureScore": 0.0,
            "grammarScore": 0.0,
            "overallScore": 0.0,
            "feedback": "No verbal response provided.",
            "strengths": [],
            "improvements": ["Provide a clear spoken answer to the technical question."]
        }

    keywords_str = ", ".join(keywords) if keywords else "None specified"
    
    prompt = f"""<|im_start|>system
You are a Senior Principal Software Engineer & CSE Academic Examiner evaluating a candidate's verbal interview answer for a {role} position.
Evaluate the candidate's answer for technical accuracy, domain correctness (DSA, DBMS, OOPS, OS, System Design, Web Development), and completeness.

Question: {question}
Expected Keywords / Concepts: {keywords_str}
Reference Answer Concept: {reference_answer if reference_answer else "Technical best practices"}
Candidate Verbal Transcript: "{transcript}"

Respond strictly with a valid JSON object matching this structure (no markdown fences, raw JSON only):
{{
  "relevanceScore": <float 0-100>,
  "correctnessScore": <float 0-100>,
  "completenessScore": <float 0-100>,
  "communicationScore": <float 0-100>,
  "structureScore": <float 0-100>,
  "grammarScore": <float 0-100>,
  "overallScore": <float 0-100>,
  "feedback": "<1-2 sentence technical assessment summary>",
  "strengths": ["<specific technical strength 1>", "<specific technical strength 2>"],
  "improvements": ["<actionable technical growth recommendation 1>", "<actionable technical growth recommendation 2>"]
}}
<|im_end|>
<|im_start|>assistant
"""

    try:
        if hasattr(slm_instance, "__call__"):
            output = slm_instance(prompt, max_new_tokens=300, temperature=0.2)
            text = output if isinstance(output, str) else output.get("choices", [{}])[0].get("text", "")
        else:
            text = str(slm_instance)
        
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            return {
                "relevanceScore": max(0.0, min(100.0, float(data.get("relevanceScore", 70.0)))),
                "correctnessScore": max(0.0, min(100.0, float(data.get("correctnessScore", 70.0)))),
                "completenessScore": max(0.0, min(100.0, float(data.get("completenessScore", 70.0)))),
                "communicationScore": max(0.0, min(100.0, float(data.get("communicationScore", 70.0)))),
                "structureScore": max(0.0, min(100.0, float(data.get("structureScore", 70.0)))),
                "grammarScore": max(0.0, min(100.0, float(data.get("grammarScore", 70.0)))),
                "overallScore": max(0.0, min(100.0, float(data.get("overallScore", 70.0)))),
                "feedback": str(data.get("feedback", "Technical evaluation completed.")),
                "strengths": list(data.get("strengths", ["Demonstrated domain familiarity"])),
                "improvements": list(data.get("improvements", ["Elaborate further on architectural trade-offs"]))
            }
    except Exception as err:
        print(f"[CSE SLM Evaluator] Error during inference: {err}")

    return None
