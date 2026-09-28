"""
MedBridge drug normalizer  —  app/normalize.py

Maps raw drug names (brand or generic, possibly misspelled) to canonical
generic names using:
  1. Exact match against brands.csv (case-insensitive)
  2. Fuzzy match with rapidfuzz (token_sort_ratio >= threshold)
  3. Frequency / route / unit parsing helpers

Returns None when confidence is below threshold — never guesses.
"""
from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

from rapidfuzz import fuzz, process

_BRANDS_CSV = Path(__file__).parent / "rules" / "data" / "brands.csv"
_FUZZY_THRESHOLD = 85   # token_sort_ratio score (0-100)


# ── Load formulary ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_formulary() -> list[dict]:
    rows = []
    with open(_BRANDS_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "brand":   row["brand_name"].strip().lower(),
                "generic": row["generic_name"].strip().lower(),
                "class":   row["drug_class"].strip().lower(),
            })
    return rows


def _formulary_choices() -> list[str]:
    return [r["brand"] for r in _load_formulary()]


# ── Core normalisation ─────────────────────────────────────────────────────────

def normalise_drug_name(
    raw: str,
    threshold: int = _FUZZY_THRESHOLD,
) -> tuple[Optional[str], float]:
    """
    Return (generic_name, confidence) where confidence is 0-1.
    Returns (None, 0.0) when no match meets the threshold.

    Steps:
      1. Strip dosage info from the raw name (e.g. "Crocin 500mg" → "Crocin").
      2. Exact lower-case match against brand column.
      3. Exact lower-case match against generic column.
      4. Fuzzy match against brands using token_sort_ratio.
      5. If score < threshold: return (None, 0.0) — abstain.
    """
    if not raw:
        return None, 0.0

    # Strip trailing dose/strength info for matching
    clean = re.sub(r"\s+\d+\s*(mg|mcg|ml|g|iu|%)\b.*", "", raw, flags=re.IGNORECASE).strip().lower()

    formulary = _load_formulary()

    # 1. Exact brand match
    for row in formulary:
        if row["brand"] == clean:
            return row["generic"], 1.0

    # 2. Exact generic match
    for row in formulary:
        if row["generic"] == clean:
            return row["generic"], 1.0

    # 3. Fuzzy match against brands
    choices = _formulary_choices()
    result = process.extractOne(
        clean,
        choices,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=threshold,
    )
    if result:
        matched_brand, score, idx = result
        generic = formulary[idx]["generic"]
        confidence = score / 100.0
        return generic, confidence

    return None, 0.0


# ── Frequency / unit parsers ───────────────────────────────────────────────────

_FREQ_MAP: dict[str, float] = {
    "od": 1, "once daily": 1, "once a day": 1, "qd": 1, "q24h": 1,
    "bd": 2, "bid": 2, "twice daily": 2, "twice a day": 2, "q12h": 2,
    "tds": 3, "tid": 3, "three times daily": 3, "thrice daily": 3, "q8h": 3,
    "qid": 4, "four times daily": 4, "q6h": 4,
    "q4h": 6, "five times daily": 5, "six times daily": 6,
    "weekly": 1/7, "once weekly": 1/7,
    "sos": 0,   # as needed — mark as 0 (no fixed frequency)
    "prn": 0,
}


def parse_frequency(text: str) -> Optional[float]:
    """
    Parse a frequency string into doses per day.
    Returns None if not parseable.

    Examples: "BD" → 2.0, "TDS" → 3.0, "Once daily" → 1.0
    """
    if not text:
        return None
    lower = text.strip().lower()
    if lower in _FREQ_MAP:
        return _FREQ_MAP[lower]

    # "x times daily"  / "x/day"
    m = re.search(r"(\d+)\s*(?:times?\s*(?:daily|a\s*day)|/day)", lower)
    if m:
        return float(m.group(1))

    # "every X hours"
    m = re.search(r"every\s+(\d+)\s*hours?", lower)
    if m:
        hours = float(m.group(1))
        return round(24 / hours, 2) if hours > 0 else None

    return None


def parse_dose(text: str) -> tuple[Optional[float], Optional[str]]:
    """
    Parse "500 mg", "2.5mg", "250mcg", "10 ml" → (value, unit).
    Returns (None, None) if not parseable.
    """
    if not text:
        return None, None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu|%)", text, re.IGNORECASE)
    if m:
        return float(m.group(1)), m.group(2).lower()
    return None, None


def parse_duration(text: str) -> Optional[int]:
    """
    Parse "5 days", "2 weeks", "1 month" → days.
    Returns None if not parseable.
    """
    if not text:
        return None
    text = text.lower()
    m = re.search(r"(\d+)\s*days?", text)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*weeks?", text)
    if m:
        return int(m.group(1)) * 7
    m = re.search(r"(\d+)\s*months?", text)
    if m:
        return int(m.group(1)) * 30
    return None
