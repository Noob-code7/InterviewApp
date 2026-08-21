import math
import threading
from typing import List, Tuple, Optional
import numpy as np

# Global singleton for SentenceTransformer model
_SEMANTIC_MODEL = None
_MODEL_LOCK = threading.Lock()


def get_semantic_model():
    """Lazy-load and cache the SentenceTransformer model singleton on CPU.
    Lock-guarded so concurrent first requests can never double-load."""
    global _SEMANTIC_MODEL
    if _SEMANTIC_MODEL is None:
        with _MODEL_LOCK:
            if _SEMANTIC_MODEL is None:
                from sentence_transformers import SentenceTransformer
                _SEMANTIC_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _SEMANTIC_MODEL


def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Compute cosine similarity between two 1D embedding vectors."""
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
    return max(0.0, min(1.0, sim))


def calculate_calibrated_semantic_credit(raw_similarity: float) -> float:
    """
    Non-linear calibration curve for semantic similarity:
    - Below 0.35: Unrelated or superficial domain noise -> 0.0 credit
    - 0.35 to 0.50: Conceptual explanation with different vocabulary -> 0.20 to 0.55 credit
    - 0.50 to 0.70: Solid semantic paraphrase -> 0.55 to 0.85 credit
    - 0.70 to 1.00: High conceptual equivalence -> 0.85 to 1.00 credit
    """
    if raw_similarity < 0.35:
        return 0.0
    elif raw_similarity < 0.50:
        t = (raw_similarity - 0.35) / (0.50 - 0.35)
        return round(0.20 + (t * 0.35), 3)
    elif raw_similarity < 0.70:
        t = (raw_similarity - 0.50) / (0.70 - 0.50)
        return round(0.55 + (t * 0.30), 3)
    else:
        t = (raw_similarity - 0.70) / (1.0 - 0.70)
        return round(min(1.0, 0.85 + (t * 0.15)), 3)


def compute_semantic_similarity(candidate_text: str, reference_text: str) -> Tuple[float, float]:
    """
    Compute raw cosine similarity and calibrated semantic credit
    between candidate response and model reference answer.
    """
    cand_clean = candidate_text.strip()
    ref_clean = reference_text.strip()

    if not cand_clean or not ref_clean or len(cand_clean.split()) < 3:
        return 0.0, 0.0

    try:
        model = get_semantic_model()
        embeddings = model.encode([cand_clean, ref_clean], convert_to_numpy=True)
        raw_sim = compute_cosine_similarity(embeddings[0], embeddings[1])
        calibrated_credit = calculate_calibrated_semantic_credit(raw_sim)
        return round(raw_sim, 4), calibrated_credit
    except Exception as e:
        print(f"[SemanticEvaluator] Error computing semantic similarity: {e}")
        return 0.0, 0.0


def compute_semantic_keyword_matches(
    candidate_text: str,
    missing_keywords: List[str],
    threshold: float = 0.60
) -> List[str]:
    """
    Semantic fallback for keywords missed by lexical matching due to morphology or
    paraphrasing (e.g. candidate says "owned" while keyword is "ownership").
    Returns the subset of missing_keywords whose embedding similarity with the
    candidate answer exceeds the threshold.
    """
    cand_clean = candidate_text.strip()
    if not cand_clean or not missing_keywords or len(cand_clean.split()) < 3:
        return []

    try:
        model = get_semantic_model()
        texts = [cand_clean] + [k.strip() for k in missing_keywords if k.strip()]
        embeddings = model.encode(texts, convert_to_numpy=True)
        cand_emb = embeddings[0]
        matched = []
        for i, kw in enumerate(missing_keywords):
            if i + 1 < len(embeddings):
                if compute_cosine_similarity(cand_emb, embeddings[i + 1]) >= threshold:
                    matched.append(kw)
        return matched
    except Exception as e:
        print(f"[SemanticEvaluator] Error computing keyword matches: {e}")
        return []


def compute_semantic_concept_alignment(
    candidate_text: str,
    expected_concepts: List[str]
) -> List[Tuple[str, float, float]]:
    """
    Compute semantic similarity between candidate answer and each expected concept clause.
    Returns a list of tuples: (concept_text, raw_sim, calibrated_credit).
    """
    cand_clean = candidate_text.strip()
    if not cand_clean or not expected_concepts or len(cand_clean.split()) < 3:
        return []

    try:
        model = get_semantic_model()
        texts = [cand_clean] + [c.strip() for c in expected_concepts if c.strip()]
        if len(texts) <= 1:
            return []

        embeddings = model.encode(texts, convert_to_numpy=True)
        cand_emb = embeddings[0]
        concept_embs = embeddings[1:]

        results = []
        for i, concept in enumerate(expected_concepts):
            if i < len(concept_embs):
                raw_sim = compute_cosine_similarity(cand_emb, concept_embs[i])
                credit = calculate_calibrated_semantic_credit(raw_sim)
                results.append((concept, round(raw_sim, 4), credit))

        return results
    except Exception as e:
        print(f"[SemanticEvaluator] Error computing concept alignment: {e}")
        return []
