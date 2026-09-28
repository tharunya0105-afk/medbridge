"""
MedBridge extraction pipeline  —  app/extract.py

Flow:
  image_bytes
    → OCR (text + bboxes)
    → LLM structuring (strict JSON schema)
    → normalize (brand→generic, parse dose/freq/duration)
    → confidence merge
    → flag low-confidence fields

DEMO MODE: when DEMO_MODE=true, OCR and LLM calls are skipped and
           cached results from demo/cached_extractions.json are returned.
           The rules engine always runs live.

The LLM never makes a safety decision.  It only structures text.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from .models import BoundingBox, ExtractedMed
from .normalize import normalise_drug_name, parse_dose, parse_duration, parse_frequency
from .ocr import TextBlock, get_engine

logger = logging.getLogger(__name__)

_DEMO_CACHE_PATH = Path(__file__).parent.parent.parent / "demo" / "cached_extractions.json"
_CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", "0.6"))
_DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"
_LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
_LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-flash-latest")


# ── LLM system prompt ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a medical document parser. Extract medicines from the text below.
Return ONLY valid JSON — no prose, no markdown, no explanation.
Return null for any field you cannot read clearly.
Never infer or guess a dose, drug name, or frequency.
Self-report your confidence (0.0 to 1.0) for each field.

Output schema (array of objects):
[
  {
    "name_raw": "exact drug name as written",
    "dose_text": "e.g. 500 mg  or null",
    "frequency_text": "e.g. twice daily  or null",
    "duration_text": "e.g. 5 days  or null",
    "route": "e.g. oral  or null",
    "instructions": "verbatim patient instructions or null",
    "confidence": 0.85
  }
]

If you cannot parse any medicines, return an empty array: []
"""


# ── LLM call ──────────────────────────────────────────────────────────────────

def _call_llm(ocr_text: str) -> list[dict]:
    """
    Call Gemini to structure the OCR text into a list of medicine dicts.
    Retries once on invalid JSON, then returns [] (manual-entry fallback).
    """
    if not _LLM_API_KEY:
        logger.warning("No LLM_API_KEY — skipping LLM extraction.")
        return []

    try:
        from google import genai
        client = genai.Client(api_key=_LLM_API_KEY)

        prompt = f"{_SYSTEM_PROMPT}\n\nDOCUMENT TEXT:\n{ocr_text}"

        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=_LLM_MODEL,
                    contents=prompt,
                )
                raw = response.text.strip()
                # Strip markdown code fences if present
                if raw.startswith("```"):
                    raw = "\n".join(raw.split("\n")[1:])
                if raw.endswith("```"):
                    raw = "\n".join(raw.split("\n")[:-1])
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return parsed
                logger.warning("LLM returned non-list JSON on attempt %d", attempt + 1)
            except json.JSONDecodeError as e:
                logger.warning("LLM returned invalid JSON (attempt %d): %s", attempt + 1, e)

        logger.error("LLM extraction failed after 2 attempts — dropping to manual entry.")
        return []

    except Exception as e:
        logger.error("LLM call failed: %s", e)
        return []


# ── Bounding box helper ────────────────────────────────────────────────────────

def _find_bbox_for_text(name: str, blocks: list[TextBlock]) -> Optional[BoundingBox]:
    """Find the first OCR block whose text approximately matches the drug name."""
    name_lower = name.lower()
    for block in blocks:
        if name_lower in block.text.lower() or block.text.lower() in name_lower:
            return BoundingBox(
                x=block.x, y=block.y,
                width=block.width, height=block.height,
            )
    return None


# ── Main pipeline ──────────────────────────────────────────────────────────────

def run_extraction(
    image_bytes: bytes,
    demo_case_id: Optional[str] = None,
    conf_threshold: float = _CONF_THRESHOLD,
) -> tuple[list[ExtractedMed], list[str]]:
    """
    Full extraction pipeline.

    Args:
        image_bytes: raw image file bytes
        demo_case_id: if set, load cached result from demo/cached_extractions.json
        conf_threshold: fields below this are flagged low-confidence

    Returns:
        (meds, warnings)
        meds: list of ExtractedMed (may be empty — never crashes)
        warnings: list of human-readable warning strings for the UI
    """
    warnings: list[str] = []

    # ── DEMO MODE ──────────────────────────────────────────────────────────────
    if demo_case_id or _DEMO_MODE:
        cached = _load_demo_cache(demo_case_id)
        if cached is not None:
            logger.info("Using cached demo extraction for case: %s", demo_case_id)
            return cached, []
        warnings.append("Demo cache not found; attempting live extraction.")

    # ── OCR ────────────────────────────────────────────────────────────────────
    engine = get_engine()
    ocr_text, blocks = engine.extract(image_bytes)

    if not ocr_text.strip():
        warnings.append(
            "Could not read any text from the image. "
            "Please retake the photo or enter medicines manually."
        )
        return [], warnings

    ocr_avg_conf = (
        sum(b.confidence for b in blocks) / len(blocks) if blocks else 0.5
    )

    # ── LLM structuring ────────────────────────────────────────────────────────
    llm_items = _call_llm(ocr_text)

    if not llm_items:
        warnings.append(
            "Automatic extraction could not structure the document. "
            "Please check each medicine below and edit as needed."
        )
        # Return a single placeholder so the UI shows the manual entry table
        return [], warnings

    # ── Build ExtractedMed objects ─────────────────────────────────────────────
    meds: list[ExtractedMed] = []
    for idx, item in enumerate(llm_items):
        name_raw: str = (item.get("name_raw") or "").strip()
        if not name_raw:
            continue

        llm_conf: float = float(item.get("confidence", 0.5))
        combined_conf = min(llm_conf, ocr_avg_conf)

        # Normalize drug name
        name_generic, norm_conf = normalise_drug_name(name_raw)
        if norm_conf < conf_threshold:
            name_generic = None   # abstain

        # Parse dose
        dose_val, dose_unit = parse_dose(item.get("dose_text") or "")

        # Parse frequency
        freq = parse_frequency(item.get("frequency_text") or "")

        # Parse duration
        dur = parse_duration(item.get("duration_text") or "")

        # Find bbox
        bbox = _find_bbox_for_text(name_raw, blocks)

        med = ExtractedMed(
            id=f"med-{idx}",
            name_raw=name_raw,
            name_generic=name_generic,
            dose_value=dose_val,
            dose_unit=dose_unit,
            frequency_per_day=freq,
            duration_days=dur,
            route=item.get("route"),
            instructions=item.get("instructions"),
            confidence=round(combined_conf, 3),
            source_span=name_raw,
            bbox=bbox,
            flagged_low_confidence=combined_conf < conf_threshold,
            confirmed=False,
        )
        meds.append(med)

    return meds, warnings


# ── Demo cache ─────────────────────────────────────────────────────────────────

def _load_demo_cache(case_id: Optional[str]) -> Optional[list[ExtractedMed]]:
    """Load pre-baked extraction from demo/cached_extractions.json."""
    if not _DEMO_CACHE_PATH.exists():
        return None
    try:
        with open(_DEMO_CACHE_PATH, encoding="utf-8") as f:
            cache = json.load(f)
        key = case_id or "case-1"
        if key not in cache:
            return None
        return [ExtractedMed(**m) for m in cache[key]["meds"]]
    except Exception as e:
        logger.warning("Failed to load demo cache: %s", e)
        return None
