"""
MedBridge data models (Pydantic v2).
All schemas used across the API and rules engine live here.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Extraction ────────────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    """Pixel coordinates of extracted text in the source image."""
    x: int
    y: int
    width: int
    height: int


class ExtractedMed(BaseModel):
    """
    One medicine line as extracted from the discharge document.
    Fields can be None when the model could not read them reliably.
    confidence is a 0-1 float (min of OCR and LLM field confidence).
    source_span is the raw OCR text that produced this record.
    """
    id: str = Field(description="Stable per-session identifier, e.g. 'med-0'")
    name_raw: str = Field(description="Drug name exactly as read from document")
    name_generic: Optional[str] = Field(
        None, description="Normalised generic name; None if below threshold"
    )
    dose_value: Optional[float] = Field(None, description="Numeric dose quantity")
    dose_unit: Optional[str] = Field(None, description="e.g. mg, ml, mcg")
    frequency_per_day: Optional[float] = Field(
        None, description="Times per 24 hours (e.g. 2 for BD)"
    )
    duration_days: Optional[int] = Field(None, description="Course length in days")
    route: Optional[str] = Field(None, description="e.g. oral, topical")
    instructions: Optional[str] = Field(
        None, description="Verbatim patient instructions from document"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Overall field confidence")
    source_span: Optional[str] = Field(
        None, description="Raw OCR text this record was extracted from"
    )
    bbox: Optional[BoundingBox] = Field(
        None, description="Bounding box in source image"
    )
    flagged_low_confidence: bool = Field(
        False, description="True when confidence < CONF_THRESHOLD"
    )
    confirmed: bool = Field(
        False, description="True after user confirms on Confirm screen"
    )


# ── Rules engine output ───────────────────────────────────────────────────────

class Severity(str, Enum):
    MAJOR = "major"
    MODERATE = "moderate"
    INFO = "info"


class Alert(BaseModel):
    """
    One safety flag raised by the rules engine.
    Every alert is fully traceable: rule_id + meds_involved + source_to_verify.
    """
    rule_id: str = Field(description="e.g. R-INT-01, R-DUP-01")
    severity: Severity
    meds_involved: list[str] = Field(
        description="Generic names of the medicines that triggered this rule"
    )
    message_key: str = Field(
        description="i18n key for the user-facing message"
    )
    params: dict = Field(
        default_factory=dict,
        description="Template parameters for the message (e.g. drug names)"
    )
    action: str = Field(
        description="One of: Ask your pharmacist / Contact your doctor / Seek urgent care"
    )
    source_to_verify: str = Field(
        description="Citation the rule data came from — NOT clinically validated"
    )
    why_detail: Optional[str] = Field(
        None, description="Plain-language mechanism for the 'Show me why' expansion"
    )


# ── Session ───────────────────────────────────────────────────────────────────

class Session(BaseModel):
    """Transient session object (not persisted unless user opts in)."""
    id: str
    created_at: str
    meds: list[ExtractedMed] = Field(default_factory=list)
    alerts: list[Alert] = Field(default_factory=list)
    lang: str = Field("en", description="'en' or 'ta'")
    quiz_score: Optional[float] = Field(
        None, description="0-1 comprehension score after teach-back"
    )
    demo_mode: bool = False


# ── API request / response shapes ─────────────────────────────────────────────

class CheckRequest(BaseModel):
    """POST /api/check — user's confirmed medicine list."""
    session_id: str
    meds: list[ExtractedMed]


class CheckResponse(BaseModel):
    alerts: list[Alert]
    disclaimer: str = (
        "Not medical advice. This is an unvalidated demo dataset. "
        "Confirm all results with your pharmacist or doctor."
    )


class ExplainRequest(BaseModel):
    session_id: str
    meds: list[ExtractedMed]
    lang: str = "en"


class ExplainItem(BaseModel):
    med_id: str
    name: str
    text: str
    text_ta: Optional[str] = None


class ExplainResponse(BaseModel):
    items: list[ExplainItem]
    demo_cached: bool = False


class TeachbackQuestion(BaseModel):
    question_id: str
    question_text: str
    options: list[str]
    correct_index: int
    med_id: str
    rationale: str


class TeachbackAnswer(BaseModel):
    session_id: str
    question_id: str
    selected_index: int


class TeachbackAnswerResponse(BaseModel):
    correct: bool
    correct_index: int
    feedback: str
    rationale: str
