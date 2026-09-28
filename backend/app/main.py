"""
MedBridge FastAPI backend  —  app/main.py

All safety decisions are made by app/rules/engine.py (pure functions).
The LLM is only used for extraction and explanation.
Every response from /api/check carries a disclaimer.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .extract import run_extraction
from .models import (
    Alert,
    CheckRequest,
    CheckResponse,
    ExplainItem,
    ExplainRequest,
    ExplainResponse,
    ExtractedMed,
    Session,
    TeachbackAnswer,
    TeachbackAnswerResponse,
    TeachbackQuestion,
)
from .rules.engine import run_all_rules
from .teachback import generate_questions, score_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", "0.6"))
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-flash-latest")
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

MAX_IMAGE_BYTES = 10 * 1024 * 1024   # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

# In-memory session store (demo prototype — no persistence by default)
_sessions: dict[str, dict] = {}
_teachback_questions: dict[str, list[TeachbackQuestion]] = {}

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MedBridge API",
    description=(
        "NOT a medical device. Decision-support tool only. "
        "All safety data is an unvalidated demo dataset."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISCLAIMER = (
    "Not medical advice. This is an unvalidated demo dataset. "
    "Confirm all results with your pharmacist or doctor."
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Environment status — used by check_env.py and the frontend."""
    tess_ok = False
    tess_langs: list[str] = []
    try:
        import pytesseract
        tess_langs = pytesseract.get_languages()
        tess_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "demo_mode": DEMO_MODE,
        "tesseract_available": tess_ok,
        "tesseract_languages": tess_langs,
        "llm_key_present": bool(LLM_API_KEY),
        "llm_model": LLM_MODEL,
        "conf_threshold": CONF_THRESHOLD,
        "disclaimer": DISCLAIMER,
    }


# ── Session ───────────────────────────────────────────────────────────────────

@app.post("/api/session")
async def create_session(lang: str = "en"):
    """Create a new session. Returns session_id."""
    sid = str(uuid.uuid4())
    _sessions[sid] = {"id": sid, "meds": [], "alerts": [], "lang": lang}
    return {"session_id": sid}


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete all session data (Privacy — 'Delete my data' button)."""
    _sessions.pop(session_id, None)
    _teachback_questions.pop(session_id, None)
    return {"deleted": True, "session_id": session_id}


# ── Extract ────────────────────────────────────────────────────────────────────

@app.post("/api/extract")
async def extract(
    file: Optional[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    demo_case_id: Optional[str] = Form(None),
):
    """
    POST /api/extract (multipart)
    Upload a discharge summary image.
    Returns extracted medicines and any warnings.
    """
    image_bytes = b""

    if demo_case_id:
        # Demo mode: load from cached_extractions.json, no image needed
        pass
    elif file:
        # Validate file type and size
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                400,
                f"Unsupported file type '{file.content_type}'. "
                "Please upload JPEG, PNG, or PDF.",
            )
        image_bytes = await file.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                400, "File too large. Maximum size is 10 MB."
            )
    else:
        raise HTTPException(400, "No file uploaded and no demo_case_id provided.")

    # Quality check (skip for demo)
    if image_bytes and not demo_case_id:
        from .ocr import quality_check
        ok, reason = quality_check(image_bytes)
        if not ok:
            return JSONResponse(
                status_code=200,
                content={
                    "quality_fail": True,
                    "reason": reason,
                    "meds": [],
                    "warnings": [reason],
                    "demo_mode": False,
                },
            )

    meds, warnings = run_extraction(
        image_bytes,
        demo_case_id=demo_case_id,
        conf_threshold=CONF_THRESHOLD,
    )

    # Store in session if provided
    if session_id and session_id in _sessions:
        _sessions[session_id]["meds"] = [m.model_dump() for m in meds]

    return {
        "meds": [m.model_dump() for m in meds],
        "warnings": warnings,
        "demo_mode": bool(demo_case_id) or DEMO_MODE,
        "disclaimer": DISCLAIMER,
    }


# ── Check (rules engine) ───────────────────────────────────────────────────────

@app.post("/api/check", response_model=CheckResponse)
async def check(body: CheckRequest):
    """
    POST /api/check
    Run the deterministic rules engine on the confirmed medicine list.
    No LLM involved. Every alert has a rule_id.
    """
    alerts = run_all_rules(body.meds, conf_threshold=CONF_THRESHOLD)

    # Store alerts in session
    if body.session_id in _sessions:
        _sessions[body.session_id]["alerts"] = [a.model_dump() for a in alerts]

    return CheckResponse(alerts=alerts)


# ── Explain ────────────────────────────────────────────────────────────────────

@app.post("/api/explain")
async def explain(body: ExplainRequest):
    """
    POST /api/explain
    Generate plain-language explanations for confirmed medicines.
    Uses LLM (template-constrained) or cached demo explanations.
    """
    items = _generate_explanations(body.meds, body.lang)
    return ExplainResponse(items=items, demo_cached=DEMO_MODE)


def _generate_explanations(
    meds: list[ExtractedMed], lang: str
) -> list[ExplainItem]:
    """
    Generate Grade-6 reading level explanations.
    Only mentions what is in the confirmed schedule — no added medical facts.
    """
    items: list[ExplainItem] = []
    confirmed = [m for m in meds if m.confirmed]

    for med in confirmed:
        # Build a simple template-based explanation (no free-form medical advice)
        parts = []
        if med.instructions:
            parts.append(f"Your prescription says: {med.instructions}.")
        if med.dose_value and med.dose_unit:
            dose_str = f"{int(med.dose_value) if med.dose_value == int(med.dose_value) else med.dose_value} {med.dose_unit}"
            parts.append(f"Take {dose_str}")
        if med.frequency_per_day:
            freq_map = {1: "once a day", 2: "twice a day", 3: "three times a day", 4: "four times a day"}
            freq_str = freq_map.get(int(med.frequency_per_day), f"{med.frequency_per_day} times a day")
            parts.append(freq_str)
        if med.route:
            parts.append(f"by {med.route}")
        if med.duration_days:
            parts.append(f"for {med.duration_days} days")

        text_en = ". ".join(parts) + "." if parts else "Please ask your pharmacist about this medicine."

        # Try LLM for better phrasing if key is available
        if LLM_API_KEY and not DEMO_MODE:
            text_en = _llm_explain_one(med, lang="en") or text_en

        items.append(ExplainItem(
            med_id=med.id,
            name=med.name_raw,
            text=text_en,
        ))

    return items


def _llm_explain_one(med: ExtractedMed, lang: str = "en") -> Optional[str]:
    """Generate a single plain-language explanation via LLM."""
    try:
        from google import genai
        client = genai.Client(api_key=LLM_API_KEY)

        schedule_facts = []
        if med.dose_value and med.dose_unit:
            schedule_facts.append(f"Dose: {med.dose_value} {med.dose_unit}")
        if med.frequency_per_day:
            schedule_facts.append(f"Frequency: {med.frequency_per_day} times per day")
        if med.duration_days:
            schedule_facts.append(f"Duration: {med.duration_days} days")
        if med.instructions:
            schedule_facts.append(f"Instructions: {med.instructions}")

        prompt = f"""Write a 1-2 sentence explanation for a patient about their medicine.
Use only the facts below. Do not add any medical facts not listed.
Do not promise outcomes. Do not suggest dosing changes.
Target reading level: Grade 6 English.
Language: {"English" if lang == "en" else "Tamil"}

Medicine: {med.name_raw}
Facts from prescription:
{chr(10).join(schedule_facts) if schedule_facts else "No specific details available."}

Reply with ONLY the explanation text, no labels or bullet points."""

        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.warning("LLM explain failed for %s: %s", med.name_raw, e)
        return None


# ── Teach-back ─────────────────────────────────────────────────────────────────

@app.get("/api/teachback")
async def get_teachback_questions(session_id: str):
    """GET /api/teachback?session_id= — return generated questions."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    meds = [ExtractedMed(**m) for m in session.get("meds", [])]
    questions = generate_questions(meds, seed=42)
    _teachback_questions[session_id] = questions

    return {
        "questions": [q.model_dump() for q in questions],
        "total": len(questions),
    }


@app.post("/api/teachback/answer")
async def submit_answer(body: TeachbackAnswer):
    """POST /api/teachback/answer — check a single answer."""
    questions = _teachback_questions.get(body.session_id, [])
    q_map = {q.question_id: q for q in questions}

    if body.question_id not in q_map:
        raise HTTPException(404, "Question not found")

    q = q_map[body.question_id]
    correct = body.selected_index == q.correct_index

    return TeachbackAnswerResponse(
        correct=correct,
        correct_index=q.correct_index,
        feedback=(
            "Correct!" if correct
            else f"Not quite. The right answer is: {q.options[q.correct_index]}"
        ),
        rationale=q.rationale,
    )


@app.post("/api/teachback/score")
async def submit_score(
    session_id: str,
    answers: list[dict],
):
    """POST /api/teachback/score — compute final session comprehension score."""
    questions = _teachback_questions.get(session_id, [])
    answer_tuples = [(a["question_id"], a["selected_index"]) for a in answers]
    result = score_session(answer_tuples, questions)

    if session_id in _sessions:
        _sessions[session_id]["quiz_score"] = result["score"]

    return {
        **result,
        "low_score": result["score"] < 0.6,
        "caregiver_prompt": result["score"] < 0.6,
    }


# ── Summary ────────────────────────────────────────────────────────────────────

@app.get("/api/summary/{session_id}")
async def get_summary(session_id: str):
    """GET /api/summary/{session_id} — pharmacist/nurse read-only summary."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    meds = [ExtractedMed(**m) for m in session.get("meds", [])]
    alerts = [Alert(**a) for a in session.get("alerts", [])]
    quiz_score = session.get("quiz_score")

    confirmed = [m for m in meds if m.confirmed]
    unsure = [m for m in meds if not m.confirmed]
    low_conf = [m for m in meds if m.flagged_low_confidence]

    return {
        "session_id": session_id,
        "confirmed_meds": [m.model_dump() for m in confirmed],
        "unsure_meds": [m.model_dump() for m in unsure],
        "low_confidence_meds": [m.model_dump() for m in low_conf],
        "alerts": [a.model_dump() for a in alerts],
        "quiz_score": quiz_score,
        "disclaimer": DISCLAIMER,
        "unvalidated_note": (
            "DEMO DATASET — Not clinically validated. "
            "Must be reviewed by a pharmacist before any real use."
        ),
    }
