import re
import math
import spacy
from typing import List, Dict, Any, Optional, Set, Tuple

# Load spaCy pipeline once at module load
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Technical stop words to ignore when extracting core concept requirements
CONCEPT_IGNORE_TOKENS = {
    "what", "is", "are", "explain", "describe", "compare", "difference", "between",
    "when", "would", "you", "use", "each", "how", "does", "work", "why", "needed",
    "give", "example", "examples", "detail", "details", "overview", "note", "also",
    "defined", "used", "allows", "enables", "provides", "system", "systems", "algorithm",
    "technique", "method", "approach", "concept", "concepts", "principle", "principles",
    "tree", "vertex", "vertices", "edge", "edges", "graph", "graphs", "node", "nodes",
    "data", "structure", "structures", "function", "variable", "object", "operation",
    "connect", "connects", "connected", "connecting", "manage", "manages", "managed",
    "managing", "program", "programming", "device", "devices", "packet", "packets",
    "condition", "conditions", "property", "properties"
}

GENERIC_FILLER_PHRASES = [
    "basically used for",
    "managing things",
    "very important concept",
    "handles everything",
    "used to manage",
    "important in computer science",
    "nobody really knows",
    "just flips coins",
    "bad vibes",
    "magically decide",
    "magically freezes",
    "random magic",
    "gets tired",
    "random boxes",
    "who knows",
    "magic wizard",
    "spicy noodles",
    "fresh apples"
]

ABSURD_MARKERS = {
    "pizza", "unicorn", "fairy dust", "alien", "banana", "chocolate",
    "refrigerator", "clown", "superhero", "dragon", "spaceships", "wizard", "penguin",
    "supermarket", "apples", "oranges", "spicy noodles", "football", "bad vibes",
    "black magic", "magic trick", "magic spell"
}


def normalize_phrase(text: str) -> str:
    """Lowercase and normalize whitespace, numbers, and dashes."""
    text_clean = text.lower().strip()
    for num, word in [("3-way", "three way"), ("3 way", "three way"), ("2-way", "two way"), ("4-way", "four way")]:
        text_clean = text_clean.replace(num, word)
    text_clean = re.sub(r"[^\w\s-]", " ", text_clean)
    return re.sub(r"\s+", " ", text_clean).strip()


def get_content_lemmas(doc_or_text) -> List[str]:
    """Extract content-carrying lemmas (excluding stopwords, punctuation, and generic filler)."""
    if isinstance(doc_or_text, str):
        doc = nlp(doc_or_text)
    else:
        doc = doc_or_text
    return [
        token.lemma_.lower()
        for token in doc
        if not token.is_stop and not token.is_punct and not token.is_space and len(token.lemma_) > 1
    ]


def extract_noun_phrases(doc) -> List[str]:
    """Extract lemmatized noun phrases (compounds) representing technical entities."""
    phrases = []
    for chunk in doc.noun_chunks:
        clean = " ".join([t.lemma_.lower() for t in chunk if not t.is_stop and not t.is_punct])
        if clean and len(clean.split()) >= 2:
            phrases.append(clean)
    return phrases


def _derivational_stem(word: str) -> str:
    """Strip common derivational/inflectional suffixes for coarse family matching.
    Conservative: only strips when remaining stem length >= 3, max 2 passes
    ("ownership" -> "owner" -> "own")."""
    suffixes = ("ationship", "ship", "ment", "ness", "ation", "ition", "ings", "ing", "ers", "er", "est", "ed", "es", "s")
    result = word
    for _ in range(2):
        changed = False
        for suf in sorted(suffixes, key=len, reverse=True):
            if result.endswith(suf) and len(result) - len(suf) >= 3:
                result = result[: len(result) - len(suf)]
                changed = True
                break
        if not changed:
            break
    return result


def phrase_matches_text(keyword: str, candidate_text: str, candidate_doc) -> bool:
    """
    Check if a keyword/phrase matches candidate text via:
    1. Exact or normalized subphrase substring match
    2. Contiguous lemmatized sequence match (no scattered words across distant sentences)
    """
    kw_norm = normalize_phrase(keyword)
    cand_norm = normalize_phrase(candidate_text)

    if not kw_norm or not cand_norm:
        return False

    # 1. Exact or normalized substring match
    if kw_norm in cand_norm:
        return True

    # 2. Contiguous lemmatized token match
    kw_doc = nlp(kw_norm)
    kw_lemmas = [t.lemma_.lower() for t in kw_doc if not t.is_punct and not t.is_space]
    cand_lemmas = [t.lemma_.lower() for t in candidate_doc if not t.is_punct and not t.is_space]

    if not kw_lemmas:
        return False

    if len(kw_lemmas) == 1:
        # Single token lemma match (with derivational family fallback:
        # "owned" matches "ownership", "learned" matches "learning")
        target = kw_lemmas[0]
        target_stem = _derivational_stem(target)
        for cl in cand_lemmas:
            if cl == target:
                return True
            if target_stem and _derivational_stem(cl) == target_stem:
                return True
        return False

    # Multi-word: must appear contiguously (or with at most 1 intervening token)
    k_len = len(kw_lemmas)
    for i in range(len(cand_lemmas) - k_len + 1):
        window = cand_lemmas[i:i + k_len]
        if window == kw_lemmas:
            return True
        # Allow 1 intervening word (e.g., "top-down recursive approach" matches "top down approach")
        if len(kw_lemmas) == 2 and i + 2 < len(cand_lemmas):
            if cand_lemmas[i] == kw_lemmas[0] and cand_lemmas[i + 2] == kw_lemmas[1]:
                return True

    return False


def is_keyword_dump(candidate_doc, matched_keywords: List[str]) -> bool:
    """Detect if the candidate's answer is an unstructured bag of technical keywords with no explanatory glue."""
    cand_words = [t.text.lower() for t in candidate_doc if not t.is_punct and not t.is_space]
    if len(cand_words) < 4 or not matched_keywords:
        return False

    kw_words = set()
    for kw in matched_keywords:
        for w in normalize_phrase(kw).split():
            if len(w) > 2:
                kw_words.add(w.lower())

    kw_word_hits = sum(1 for w in cand_words if w in kw_words)
    kw_density = kw_word_hits / len(cand_words)

    # Check for connective explanatory glue
    connective_glue = sum(
        1 for t in candidate_doc
        if t.pos_ in ("ADP", "CCONJ", "SCONJ", "AUX")
        or t.lemma_ in (
            "occur", "happen", "define", "mean", "allow", "enable", "require",
            "guarantee", "store", "manage", "use", "cause", "lead", "solve",
            "handle", "connect", "sort", "grow", "traverse", "insert", "delete"
        )
    )
    glue_ratio = connective_glue / len(cand_words)

    return kw_density >= 0.60 and glue_ratio < 0.18


def compute_concept_coverage_spacy(
    expected_concepts: List[str],
    candidate_doc,
    candidate_text: str,
    semantic_concept_scores: Optional[Dict[str, float]] = None
) -> Tuple[float, List[str], List[str]]:
    """
    Strict yet comprehensive concept verification using spaCy + Semantic Embedding Alignment:
    - Analyzes structured concept clauses (header + definition body)
    - Leverages true lemmatization, noun-phrase chunk matching, and semantic paraphrase alignment
    - Credits full credit for substantive mastery and half credit for partial concept grasp
    """
    if not expected_concepts:
        return 0.0, [], []

    matched_concepts = []
    missing_concepts = []
    cand_content_lemmas = set(get_content_lemmas(candidate_doc))
    cand_noun_phrases = extract_noun_phrases(candidate_doc)
    cand_norm = normalize_phrase(candidate_text)

    total_hits = 0.0

    for concept in expected_concepts:
        header = ""
        body = concept
        if ":" in concept:
            parts = concept.split(":", 1)
            header = parts[0].strip()
            body = parts[1].strip()

        # 1. Header check (e.g., "Memoization (Top-Down)")
        h_lemmas = []
        header_hit = False
        header_partial = False
        if header:
            h_lemmas = [
                t.lemma_.lower()
                for t in nlp(header)
                if not t.is_stop and not t.is_punct and t.lemma_.lower() not in CONCEPT_IGNORE_TOKENS and len(t.lemma_) > 2
            ]
            if h_lemmas:
                matched_h = [hl for hl in h_lemmas if hl in cand_content_lemmas]
                h_ratio = len(matched_h) / len(h_lemmas)
                header_hit = (h_ratio == 1.0)
                header_partial = (h_ratio >= 0.60)

        # 2. Body content check
        b_lemmas = [
            t.lemma_.lower()
            for t in nlp(body)
            if not t.is_stop and not t.is_punct and t.lemma_.lower() not in CONCEPT_IGNORE_TOKENS and len(t.lemma_) > 2
        ]
        matched_b = [bl for bl in b_lemmas if bl in cand_content_lemmas]
        b_ratio = len(matched_b) / max(1, len(b_lemmas))

        # 3. Overall concept lemmas
        all_lemmas = [
            t.lemma_.lower()
            for t in nlp(concept)
            if not t.is_stop and not t.is_punct and t.lemma_.lower() not in CONCEPT_IGNORE_TOKENS and len(t.lemma_) > 2
        ]
        matched_all = [l for l in all_lemmas if l in cand_content_lemmas]
        all_ratio = len(matched_all) / max(1, len(all_lemmas))

        concept_np = extract_noun_phrases(nlp(concept))
        np_hit = any(np in cand_norm or any(np in c_np for c_np in cand_noun_phrases) for np in concept_np)

        # 4. Semantic Similarity Alignment Score (if available)
        sem_score = (semantic_concept_scores or {}).get(concept, 0.0)

        # Combined multi-signal logic:
        # Full Match:
        # 1. Lexical Lemma match (Header + Body or high Lemma ratio, min 2 matched lemmas
        #    to prevent single generic words like "condition" from crediting a concept)
        # 2. Header Hit + Semantic Alignment (>= 0.44)
        # 3. Strong Semantic match (>= 0.72)
        # 4. Partial Header (>= 60% of header tokens) + Substantial Semantic match (>= 0.48)
        # 5. Matched Body Action Lemma (>= 2) + Substantial Semantic match (>= 0.48)
        if ((header_hit and (b_ratio >= 0.20 or len(matched_b) >= 2 or sem_score >= 0.44)) or
            (b_ratio >= 0.45 and len(matched_b) >= 2) or
            (all_ratio >= 0.35 and len(matched_all) >= 2) or
            (all_ratio >= 0.25 and len(matched_all) >= 2 and np_hit) or
            (sem_score >= 0.72) or
            (header_partial and sem_score >= 0.48) or
            (len(matched_b) >= 2 and sem_score >= 0.48)):
            total_hits += 1.0
            matched_concepts.append(concept)
        elif (all_ratio >= 0.20 or
              (header_partial and len(matched_b) >= 1) or
              (header_hit and len(matched_b) >= 1) or
              np_hit or
              (sem_score >= 0.60) or
              (header_partial and sem_score >= 0.40) or
              (len(matched_b) >= 2 and sem_score >= 0.40)):
            total_hits += 0.5
            missing_concepts.append(concept)
        else:
            missing_concepts.append(concept)

    ratio = min(1.0, total_hits / max(1, len(expected_concepts)))
    return ratio, matched_concepts, missing_concepts


# ── Phase 3: Question-Specific Misconception / Contradiction Detection ─────────

_MISCONCEPTION_CLAIM_PREFIXES = (
    "thinking", "believing", "assuming", "mistaking", "saying",
)
_MISCONCEPTION_SKIP_PREFIXES = (
    # Placeholder templates ("Misunderstanding the core definition or scope of X")
    # and behavioral error descriptions cannot be matched against transcripts
    # without false positives - explicitly skipped.
    "misunderstanding the core definition",
    "forgetting", "swapping", "catching", "overusing", "over-engineering", "overriding",
)
_NEGATION_TOKENS = {
    "not", "no", "never", "neither", "nor", "unlike", "rather", "instead",
    "without", "incorrect", "wrong", "false", "myth", "n't", "not",
}
_EQUIVALENCE_MARKERS = [
    # Strong equivalence phrases only - a bare "same" matches innocent
    # collocations like "the same clock cycle" in correct answers.
    "same thing",
    "are the same",
    "is the same",
    "mean the same",
    "means the same",
    "meant the same",
    "no difference",
    "not different",
    "one and the same",
    "exactly alike",
    "essentially identical",
    "virtually identical",
    "are interchangeable",
    "is interchangeable",
    "used interchangeably",
    "use them interchangeably",
    "synonymous",
]

_GENERIC_CLAIM_TOKENS = {
    "core", "definition", "scope", "concept", "idea", "purpose", "use",
    "usage", "working", "meaning", "difference", "type", "types", "kind",
}


def _claim_lemmas(text: str) -> List[str]:
    return [
        t.lemma_.lower()
        for t in nlp(text)
        if not t.is_stop and not t.is_punct and not t.is_space
        and len(t.lemma_) > 1 and t.lemma_.lower() not in _GENERIC_CLAIM_TOKENS
    ]


def _match_claim_in_span(claim_lemmas: List[str], cand_lemmas: List[str], max_gap: int = 2):
    """
    Find an in-order occurrence of claim lemmas inside candidate lemmas allowing
    small gaps (spoken fillers). Returns (start_idx, end_idx, matched_count)
    of the best window, or None. Requires >=75% of claim lemmas (min 3).
    """
    if not claim_lemmas or not cand_lemmas:
        return None
    required = max(3, math.ceil(len(claim_lemmas) * 0.75))
    best = None
    for start in range(len(cand_lemmas)):
        ci = 0
        idx = start
        gaps = 0
        matched = 0
        while idx < len(cand_lemmas) and ci < len(claim_lemmas):
            if cand_lemmas[idx] == claim_lemmas[ci]:
                ci += 1
                matched += 1
                gaps = 0
            else:
                gaps += 1
                if gaps > max_gap:
                    break
            idx += 1
        if matched >= required:
            span_len = idx - start
            if best is None or matched > best[2]:
                best = (start, min(idx, len(cand_lemmas)), matched, span_len)
    if best is None:
        return None
    return best[0], best[1], best[2]


def _has_negation_before(cand_doc_tokens_lower: List[str], start_idx: int, lookback: int = 4) -> bool:
    window = cand_doc_tokens_lower[max(0, start_idx - lookback): start_idx]
    return any(w in _NEGATION_TOKENS for w in window)


def _term_present(term: str, content_set: Set[str]) -> bool:
    """Fuzzy membership test: spaCy sometimes mangles gerund lemmas
    ('multitasking' -> 'multitaske'). Compares vowel-stripped stems plus
    a >=0.85 similarity fallback."""
    import difflib
    if term in content_set:
        return True
    stem = term[:-1] if term and term[-1] in "aeiou" else term
    for c in content_set:
        c_stem = c[:-1] if c and c[-1] in "aeiou" else c
        if len(stem) >= 6 and (c_stem.startswith(stem) or stem.startswith(c_stem)):
            return True
        if abs(len(c) - len(term)) <= 4 and difflib.SequenceMatcher(None, term, c).ratio() >= 0.85:
            return True
    return False


def _extract_confusion_terms(concept_text: str):
    """Extract the two anchor terms from 'Confusing X with Y...' style strings."""
    lowered = concept_text.lower()
    body = re.sub(r"^\s*confusing\s+", "", lowered)
    parts = re.split(r"\s+with\s+", body, maxsplit=1)
    if len(parts) != 2:
        return None
    term_a_lemmas = _claim_lemmas(parts[0])
    # Term B: leading terms before qualifier prepositions
    term_b_raw = re.split(r"\s+(?:on|in|for|by|within|across)\s+", parts[1])[0]
    term_b_lemmas = _claim_lemmas(term_b_raw)
    if not term_a_lemmas or not term_b_lemmas:
        return None
    return term_a_lemmas, term_b_lemmas


def detect_misconceptions(
    candidate_doc,
    candidate_text: str,
    common_misconceptions: Optional[List[str]] = None,
) -> List[str]:
    """
    Question-specific factual-contradiction detection using the question bank's
    commonMisconceptions data.

    Tier 1 - Affirmative wrong claims ("Thinking RAID 1 increases storage capacity"):
        strip the cognitive prefix, match the remaining claim as an in-order lemma
        sequence in the answer (small gaps allowed), skip when a negation precedes
        the claim (candidate correctly refuting it).

    Tier 2 - Conflation claims ("Confusing multi-tasking with multi-processing"):
        penalize only when BOTH anchor terms appear AND an equivalence marker
        ("same", "interchangeable", ...) is present - so correct contrastive
        answers mentioning both terms are never penalized.

    Returns list of detected misconception strings.
    """
    if not common_misconceptions:
        return []

    cand_lower = candidate_text.lower()
    cand_lemmas = [t.lower_ for t in candidate_doc if not t.is_punct and not t.is_space]
    cand_lemmatized = [t.lemma_.lower() for t in candidate_doc if not t.is_punct and not t.is_space]

    detected = []
    for misc in common_misconceptions:
        if not misc or not isinstance(misc, str):
            continue
        misc_clean = misc.strip()
        misc_lower = misc_clean.lower()

        if any(misc_lower.startswith(p) for p in _MISCONCEPTION_SKIP_PREFIXES):
            continue

        detected_flag = False

        # Tier 2a: explicit interchangeability phrasing
        if misc_lower.startswith("using") and "interchang" in misc_lower:
            terms = [t for t in _claim_lemmas(misc_clean) if t != "interchangeably"]
            if len(terms) >= 2:
                content_set = set(get_content_lemmas(candidate_doc))
                present = sum(1 for t in terms if _term_present(t, content_set))
                has_marker = any(re.search(r"\b" + re.escape(m) + r"\b", cand_lower) for m in _EQUIVALENCE_MARKERS)
                if present >= 2 and has_marker:
                    detected.append(misc_clean)
                    detected_flag = True

        # Tier 2b: "Confusing X with Y"
        elif misc_lower.startswith("confusing"):
            parsed = _extract_confusion_terms(misc_clean)
            if parsed:
                term_a, term_b = parsed
                content_set = set(get_content_lemmas(candidate_doc))
                a_present = all(_term_present(t, content_set) for t in term_a[:2]) or sum(
                    _term_present(t, content_set) for t in term_a) >= max(1, len(term_a) - 1)
                b_present = any(_term_present(t, content_set) for t in term_b[:3])
                has_marker = any(re.search(r"\b" + re.escape(m) + r"\b", cand_lower) for m in _EQUIVALENCE_MARKERS)
                if a_present and b_present and has_marker:
                    detected.append(misc_clean)
                    detected_flag = True

        # Tier 1: affirmative wrong claims (parenthetical qualifiers stripped -
        # they inflate claim length without appearing in spoken answers)
        prefix_hit = next((p for p in _MISCONCEPTION_CLAIM_PREFIXES if misc_lower.startswith(p + " ")), None)
        if not detected_flag and prefix_hit:
            claim_raw = misc_clean[len(prefix_hit) + 1:]
            claim_raw = re.sub(r"^\s*that\s+", "", claim_raw, flags=re.IGNORECASE)
            claim_raw = re.sub(r"\([^)]*\)", " ", claim_raw)
            claim_lemmas = _claim_lemmas(claim_raw)
            if claim_lemmas:
                match = _match_claim_in_span(claim_lemmas, cand_lemmatized)
                if match:
                    start_idx, _, matched = match
                    if not _has_negation_before(cand_lemmas, start_idx):
                        detected.append(misc_clean)
                        detected_flag = True

    return detected


def analyze_answer_substance(    candidate_doc,
    candidate_text: str,
    question_text: str,
    keywords: Optional[List[str]] = None,
    q_type: str = "mixed"
) -> Dict[str, Any]:
    """
    Syntactic & linguistic substance verification using spaCy:
    - Checks for real subject-verb-object technical assertions
    - Detects keyword stuffing (verbs/connectors missing)
    - Detects filler / non-technical narrative
    - Refined prompt-echo detection
    """
    cand_lower = candidate_text.lower().strip()
    words = [t for t in candidate_doc if not t.is_punct and not t.is_space]
    word_count = len(words)

    # 1. Absurdity check (word-boundary regex to avoid false positives like
    #    "magic numbers" or "banana problem" used in legitimate technical contexts)
    absurd_hits = sum(1 for m in ABSURD_MARKERS if re.search(r"\b" + re.escape(m) + r"\b", cand_lower))
    is_absurd = absurd_hits >= 1

    # 2. Generic filler phrases check
    filler_hits = sum(1 for f in GENERIC_FILLER_PHRASES if f in cand_lower)
    is_mostly_filler = (filler_hits >= 1 and word_count < 35)

    # 3. Part-of-speech & Syntactic Structure Analysis
    verbs = [t for t in candidate_doc if t.pos_ in ("VERB", "AUX")]
    nouns = [t for t in candidate_doc if t.pos_ in ("NOUN", "PROPN")]
    tech_content_lemmas = get_content_lemmas(candidate_doc)

    # Check for actual technical clauses (Subject -> Verb -> Object)
    has_subject_verb = False
    for token in candidate_doc:
        if token.dep_ in ("nsubj", "nsubjpass") and token.head.pos_ in ("VERB", "AUX"):
            has_subject_verb = True
            break

    # 4. Keyword stuffing detection
    # If high proportion of words are nouns with near-zero verbs or syntax structure
    verb_ratio = len(verbs) / max(1, word_count)
    noun_ratio = len(nouns) / max(1, word_count)
    is_keyword_stuffing = (noun_ratio > 0.60 and len(verbs) <= 1 and word_count >= 4 and not has_subject_verb)

    # 5. Personal Evasion Detection (personal narrative / monologue instead of technical explanation)
    #    Skipped for HR/behavioral tracks where first-person STAR storytelling is the expected format.
    pronouns = [t for t in candidate_doc if t.lower_ in ("i", "my", "me", "myself", "we", "us", "our")]
    subjects = [t for t in candidate_doc if "subj" in t.dep_]
    tech_subjects = [t for t in subjects if t.pos_ in ("NOUN", "PROPN")]
    is_personal_evasion = (
        q_type not in ("hr", "behavioral") and
        len(pronouns) >= 2 and
        len(tech_subjects) == 0 and
        (len(pronouns) / max(1, word_count) >= 0.12)
    )

    # 6. Prompt-echo detection (spaCy lemma based)
    q_doc = nlp(question_text)
    q_content_lemmas = set(get_content_lemmas(q_doc))
    ans_content_lemmas = get_content_lemmas(candidate_doc)
    
    novel_content_lemmas = [l for l in ans_content_lemmas if l not in q_content_lemmas]
    echo_ratio = 1.0 - (len(novel_content_lemmas) / max(1, len(ans_content_lemmas))) if ans_content_lemmas else 1.0

    # Stricter echo condition: must have high echo ratio AND very few novel content lemmas AND short length
    is_prompt_echo = (echo_ratio > 0.80 and len(novel_content_lemmas) < 3 and word_count < 18)

    return {
        "word_count": word_count,
        "is_absurd": is_absurd,
        "is_mostly_filler": is_mostly_filler,
        "is_keyword_stuffing": is_keyword_stuffing,
        "is_personal_evasion": is_personal_evasion,
        "is_prompt_echo": is_prompt_echo,
        "has_subject_verb": has_subject_verb,
        "verb_count": len(verbs),
        "noun_count": len(nouns),
        "content_lemma_count": len(tech_content_lemmas),
        "novel_lemma_count": len(novel_content_lemmas),
        "echo_ratio": echo_ratio
    }
