"""
MedBridge Rules Engine  —  app/rules/engine.py

DESIGN PRINCIPLES
-----------------
* Pure functions only.  No I/O, no network, no database calls.
* Deterministic: identical input → identical output, always.
* The LLM never touches this file.  Every alert is traceable to a rule ID
  and to a data-file row that carries a `source_to_verify` field.
* Language rules:
    - Never say "stop taking" or "change your dose".
    - Allowed actions: "Ask your pharmacist" | "Contact your doctor" | "Seek urgent care"

RULES
-----
R-OCR-01  Field confidence below CONF_THRESHOLD — abstain, exclude from rules.
R-DUP-01  Same generic name appears more than once (brand aliasing included).
R-DOSE-01 Summed daily dose of a generic exceeds the table max.
R-FREQ-01 Frequency > 6 doses/day or frequency is 0 — implausible, needs confirmation.
R-INT-xx  Drug-pair interactions (bidirectional, generic + class matching).
R-RED-01+ Per-drug red-flag symptom lists.

DEMO DATASET — not clinically validated.  Must be reviewed by a pharmacist
or clinician before any real use.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from rapidfuzz import fuzz

from ..models import Alert, ExtractedMed, Severity

# ── Load rule data ─────────────────────────────────────────────────────────────
_DATA = Path(__file__).parent / "data"


def _load_json(filename: str) -> dict | list:
    path = _DATA / filename
    with open(path, encoding="utf-8") as f:
        return json.load(f)


_INTERACTIONS_DATA: list[dict] = _load_json("interactions.json")["interactions"]
_DOSE_LIMITS_DATA: list[dict] = _load_json("dose_limits.json")["dose_limits"]
_RED_FLAGS_DATA: list[dict] = _load_json("red_flags.json")["red_flags"]

# Build fast-lookup maps
_DOSE_MAP: dict[str, dict] = {row["generic"]: row for row in _DOSE_LIMITS_DATA}
_RED_FLAG_MAP: dict[str, dict] = {row["generic"]: row for row in _RED_FLAGS_DATA}

CONF_THRESHOLD_DEFAULT = 0.6


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalise(name: Optional[str]) -> str:
    """Lower-case, strip whitespace, return empty string on None."""
    if name is None:
        return ""
    return name.strip().lower()


def _fuzzy_match(a: str, b: str, threshold: int = 85) -> bool:
    """True when token_sort_ratio ≥ threshold (handles word-order differences)."""
    return fuzz.token_sort_ratio(a, b) >= threshold


def _generics(meds: list[ExtractedMed]) -> list[str]:
    """Return the normalised generic name for every med that has one."""
    return [_normalise(m.name_generic) for m in meds if m.name_generic]


# ── R-OCR-01: Low-confidence abstention ───────────────────────────────────────

def rule_ocr_confidence(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Flag every field whose confidence is below conf_threshold.
    These meds are EXCLUDED from all other rule evaluations.

    Tests:
    - med with confidence 0.5 (threshold 0.6) → alert fires
    - med with confidence 0.9 → no alert
    - edge: confidence exactly equal to threshold → no alert (inclusive lower bound)
    """
    alerts: list[Alert] = []
    for med in meds:
        if med.confidence < conf_threshold:
            alerts.append(
                Alert(
                    rule_id="R-OCR-01",
                    severity=Severity.INFO,
                    meds_involved=[med.name_raw],
                    message_key="ocr_low_confidence",
                    params={
                        "name": med.name_raw,
                        "confidence": f"{med.confidence:.0%}",
                    },
                    action="Ask your pharmacist",
                    source_to_verify="Internal rule: OCR confidence threshold",
                    why_detail=(
                        f"The text '{med.name_raw}' was read with "
                        f"{med.confidence:.0%} confidence, which is below the "
                        f"{conf_threshold:.0%} threshold. The app cannot safely "
                        "use this item."
                    ),
                )
            )
    return alerts


def _confident_meds(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[ExtractedMed]:
    """Return only the meds whose confidence meets the threshold AND are confirmed."""
    return [
        m for m in meds
        if m.confidence >= conf_threshold and m.confirmed
    ]


# ── R-DUP-01: Duplicate generic ───────────────────────────────────────────────

def rule_duplicate_generic(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Detect the same generic name (or fuzzy-match) appearing more than once.
    Reason: two brand names for the same drug = double-dosing risk.

    Tests:
    - [Crocin→paracetamol, Dolo→paracetamol] → R-DUP-01 fires
    - [paracetamol, ibuprofen] → no alert
    - edge: single-item list → no alert
    """
    alerts: list[Alert] = []
    eligible = _confident_meds(meds, conf_threshold)
    seen: dict[str, str] = {}   # generic → first raw name

    for med in eligible:
        gen = _normalise(med.name_generic)
        if not gen:
            continue
        # Fuzzy-match against already-seen generics
        matched_key: Optional[str] = None
        for k in seen:
            if _fuzzy_match(gen, k, threshold=90):
                matched_key = k
                break
        if matched_key:
            alerts.append(
                Alert(
                    rule_id="R-DUP-01",
                    severity=Severity.MODERATE,
                    meds_involved=[seen[matched_key], med.name_raw],
                    message_key="duplicate_generic",
                    params={
                        "generic": gen,
                        "drug_a": seen[matched_key],
                        "drug_b": med.name_raw,
                    },
                    action="Ask your pharmacist",
                    source_to_verify="Internal rule: duplicate generic detection",
                    why_detail=(
                        f"'{seen[matched_key]}' and '{med.name_raw}' both contain "
                        f"{gen}. Taking them together may mean you are taking "
                        "the same medicine twice."
                    ),
                )
            )
        else:
            seen[gen] = med.name_raw

    return alerts


# ── R-DOSE-01: Daily dose above table limit ────────────────────────────────────

def rule_dose_limit(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Sum the daily dose per generic and compare to dose_limits.json.
    daily_dose = dose_value * frequency_per_day (uses confidence-filtered meds).

    Tests:
    - metformin 1000mg TDS (3x) = 3000mg → at limit, no alert
    - metformin 1500mg TDS = 4500mg → exceeds 3000mg → R-DOSE-01 fires
    - no dose_value → skip (cannot evaluate)
    - edge: two paracetamols 500mg BD each → 2000mg → within adult limit, no alert
    """
    alerts: list[Alert] = []
    eligible = _confident_meds(meds, conf_threshold)

    # Accumulate daily dose per generic
    daily: dict[str, float] = {}
    for med in eligible:
        gen = _normalise(med.name_generic)
        if not gen or med.dose_value is None or med.frequency_per_day is None:
            continue
        dose = med.dose_value * med.frequency_per_day
        daily[gen] = daily.get(gen, 0.0) + dose

    for gen, total in daily.items():
        limit_row = _DOSE_MAP.get(gen)
        if not limit_row:
            continue
        max_dose = limit_row["max_daily_dose_mg"]
        if total > max_dose:
            alerts.append(
                Alert(
                    rule_id="R-DOSE-01",
                    severity=Severity.MODERATE,
                    meds_involved=[gen],
                    message_key="dose_above_limit",
                    params={
                        "generic": gen,
                        "total": str(total),
                        "max": str(max_dose),
                        "unit": limit_row.get("unit", "mg"),
                    },
                    action="Ask your pharmacist",
                    source_to_verify=limit_row.get("source_to_verify", ""),
                    why_detail=(
                        f"Your prescription adds up to {total} {limit_row.get('unit','mg')} "
                        f"of {gen} per day. The typical adult maximum is "
                        f"{max_dose} {limit_row.get('unit','mg')} per day "
                        f"({limit_row.get('note', '')}). "
                        "This app cannot change your prescription — ask your pharmacist."
                    ),
                )
            )

    return alerts


# ── R-FREQ-01: Implausible frequency ─────────────────────────────────────────

def rule_implausible_frequency(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Flag frequency > 6/day or frequency == 0 for confirmed meds.

    Tests:
    - frequency_per_day = 8 → R-FREQ-01 fires
    - frequency_per_day = 0 → R-FREQ-01 fires
    - frequency_per_day = 3 → no alert
    - None frequency → skip (not enough info, already handled by abstention)
    """
    alerts: list[Alert] = []
    eligible = _confident_meds(meds, conf_threshold)

    for med in eligible:
        fpd = med.frequency_per_day
        if fpd is None:
            continue
        if fpd > 6 or fpd == 0:
            alerts.append(
                Alert(
                    rule_id="R-FREQ-01",
                    severity=Severity.INFO,
                    meds_involved=[med.name_raw],
                    message_key="implausible_frequency",
                    params={"name": med.name_raw, "frequency": str(fpd)},
                    action="Ask your pharmacist",
                    source_to_verify="Internal rule: plausibility check",
                    why_detail=(
                        f"A frequency of {fpd} doses per day for '{med.name_raw}' "
                        "is unusual for most oral medicines. Please confirm this "
                        "with your pharmacist."
                    ),
                )
            )

    return alerts


# ── R-INT-xx: Drug-pair interactions ─────────────────────────────────────────

def rule_interactions(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Check every pair of confident generics against interactions.json.
    Matching is bidirectional and uses fuzzy string comparison.
    Class-level matching: if either interaction slot names a class, check
    all meds whose name_generic fuzzy-matches that class (not yet implemented
    in this version — per-name matching only).

    Tests:
    - [warfarin, aspirin] → R-INT-01 fires (major)
    - [lisinopril, spironolactone] → R-INT-02 fires (major)
    - [amlodipine, atorvastatin] → no interaction alert
    - edge: single-item list → no alert (no pairs possible)
    - edge: same drug listed twice → DUP rule fires, not INT
    """
    alerts: list[Alert] = []
    eligible = _confident_meds(meds, conf_threshold)
    generics = [_normalise(m.name_generic) for m in eligible if m.name_generic]

    for rule in _INTERACTIONS_DATA:
        drug_a = _normalise(rule["drug_a"])
        drug_b = _normalise(rule["drug_b"])

        a_present = any(_fuzzy_match(g, drug_a) for g in generics)
        b_present = any(_fuzzy_match(g, drug_b) for g in generics)

        if a_present and b_present:
            alerts.append(
                Alert(
                    rule_id=rule["rule_id"],
                    severity=Severity(rule["severity"]),
                    meds_involved=[rule["drug_a"], rule["drug_b"]],
                    message_key=rule["message_key"],
                    params={"drug_a": rule["drug_a"], "drug_b": rule["drug_b"]},
                    action=rule["action"],
                    source_to_verify=rule["source_to_verify"],
                    why_detail=rule.get("mechanism"),
                )
            )

    return alerts


# ── R-RED-xx: Per-drug red-flag symptoms ─────────────────────────────────────

def rule_red_flags(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    For each confirmed, confident med that appears in red_flags.json,
    attach the relevant red-flag watch-for alert.

    These are *informational* watch-for alerts — they always fire for the
    listed drugs so the patient knows what symptoms to report urgently.

    Tests:
    - [digoxin] → R-RED-01 fires
    - [warfarin] → R-RED-02 fires
    - [amlodipine] → no red-flag alert (not in data file)
    - edge: low-confidence digoxin → excluded → no alert
    """
    alerts: list[Alert] = []
    eligible = _confident_meds(meds, conf_threshold)

    for med in eligible:
        gen = _normalise(med.name_generic)
        flag_row = _RED_FLAG_MAP.get(gen)
        if not flag_row:
            continue
        symptoms_str = ", ".join(flag_row["symptoms"])
        alerts.append(
            Alert(
                rule_id=flag_row["rule_id"],
                severity=Severity(flag_row["severity"]),
                meds_involved=[gen],
                message_key=flag_row["message_key"],
                params={
                    "generic": gen,
                    "symptoms": symptoms_str,
                },
                action=flag_row["action"],
                source_to_verify=flag_row["source_to_verify"],
                why_detail=(
                    f"Watch for these symptoms while taking {gen}: {symptoms_str}. "
                    "If any appear, seek care as directed."
                ),
            )
        )

    return alerts


# ── Master runner ─────────────────────────────────────────────────────────────

def run_all_rules(
    meds: list[ExtractedMed],
    conf_threshold: float = CONF_THRESHOLD_DEFAULT,
) -> list[Alert]:
    """
    Run all rules and return a combined, deduplicated alert list sorted by
    severity (major → moderate → info).

    This is the ONLY public entry point for the rules engine.
    No I/O, no network.  Call from the FastAPI /api/check endpoint.
    """
    all_alerts: list[Alert] = []
    all_alerts.extend(rule_ocr_confidence(meds, conf_threshold))
    all_alerts.extend(rule_duplicate_generic(meds, conf_threshold))
    all_alerts.extend(rule_dose_limit(meds, conf_threshold))
    all_alerts.extend(rule_implausible_frequency(meds, conf_threshold))
    all_alerts.extend(rule_interactions(meds, conf_threshold))
    all_alerts.extend(rule_red_flags(meds, conf_threshold))

    # Dedup by rule_id + sorted meds_involved (same rule can't fire twice for same pair)
    seen: set[str] = set()
    unique: list[Alert] = []
    for alert in all_alerts:
        key = alert.rule_id + "|" + "|".join(sorted(alert.meds_involved))
        if key not in seen:
            seen.add(key)
            unique.append(alert)

    severity_order = {Severity.MAJOR: 0, Severity.MODERATE: 1, Severity.INFO: 2}
    unique.sort(key=lambda a: severity_order[a.severity])
    return unique
