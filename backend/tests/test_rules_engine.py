"""
Comprehensive unit tests for MedBridge rules engine.

Every rule has at minimum:
  - A test that the rule FIRES (true positive)
  - A test that the rule DOES NOT FIRE (true negative)
  - At least one edge case

Run: pytest backend/tests/test_rules_engine.py -v --cov=backend/app/rules/engine
"""
from __future__ import annotations
import sys
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pytest
from backend.app.models import ExtractedMed, Severity
from backend.app.rules.engine import (
    run_all_rules,
    rule_duplicate_generic,
    rule_dose_limit,
    rule_implausible_frequency,
    rule_interactions,
    rule_ocr_confidence,
    rule_red_flags,
)

THRESHOLD = 0.6


# ── Helpers ───────────────────────────────────────────────────────────────────

def _med(
    name_raw: str,
    name_generic: str | None = None,
    dose_value: float | None = None,
    dose_unit: str = "mg",
    frequency_per_day: float | None = None,
    duration_days: int | None = None,
    confidence: float = 0.95,
    confirmed: bool = True,
    id: str = "med-0",
) -> ExtractedMed:
    return ExtractedMed(
        id=id,
        name_raw=name_raw,
        name_generic=name_generic,
        dose_value=dose_value,
        dose_unit=dose_unit,
        frequency_per_day=frequency_per_day,
        duration_days=duration_days,
        confidence=confidence,
        confirmed=confirmed,
    )


def ids_in(alerts, *rule_ids) -> bool:
    found = {a.rule_id for a in alerts}
    return all(r in found for r in rule_ids)


# ═══════════════════════════════════════════════════════════════════════════════
# R-OCR-01  Low-confidence abstention
# ═══════════════════════════════════════════════════════════════════════════════

class TestOCRConfidence:
    def test_fires_below_threshold(self):
        meds = [_med("Crocin", "paracetamol", confidence=0.5)]
        alerts = rule_ocr_confidence(meds, THRESHOLD)
        assert ids_in(alerts, "R-OCR-01")

    def test_no_alert_above_threshold(self):
        meds = [_med("Crocin", "paracetamol", confidence=0.9)]
        alerts = rule_ocr_confidence(meds, THRESHOLD)
        assert not alerts

    def test_no_alert_at_exact_threshold(self):
        """Confidence exactly equal to threshold is accepted (inclusive lower bound)."""
        meds = [_med("Crocin", "paracetamol", confidence=0.6)]
        alerts = rule_ocr_confidence(meds, THRESHOLD)
        assert not alerts

    def test_multiple_low_confidence_meds(self):
        meds = [
            _med("???", "unknown", confidence=0.3, id="med-0"),
            _med("Dolo", "paracetamol", confidence=0.9, id="med-1"),
            _med("???2", None, confidence=0.1, id="med-2"),
        ]
        alerts = rule_ocr_confidence(meds, THRESHOLD)
        assert len(alerts) == 2

    def test_zero_confidence_fires(self):
        meds = [_med("unreadable", None, confidence=0.0)]
        alerts = rule_ocr_confidence(meds, THRESHOLD)
        assert len(alerts) == 1
        assert alerts[0].rule_id == "R-OCR-01"


# ═══════════════════════════════════════════════════════════════════════════════
# R-DUP-01  Duplicate generic
# ═══════════════════════════════════════════════════════════════════════════════

class TestDuplicateGeneric:
    def test_fires_for_two_brands_same_generic(self):
        """Crocin + Dolo → both paracetamol → R-DUP-01."""
        meds = [
            _med("Crocin", "paracetamol", id="med-0"),
            _med("Dolo 650", "paracetamol", id="med-1"),
        ]
        alerts = rule_duplicate_generic(meds, THRESHOLD)
        assert ids_in(alerts, "R-DUP-01")

    def test_no_alert_different_generics(self):
        meds = [
            _med("Crocin", "paracetamol", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = rule_duplicate_generic(meds, THRESHOLD)
        assert not alerts

    def test_single_med_no_alert(self):
        meds = [_med("Crocin", "paracetamol")]
        assert not rule_duplicate_generic(meds, THRESHOLD)

    def test_low_confidence_excluded_from_dup_check(self):
        """Low-confidence med should not trigger duplicate detection."""
        meds = [
            _med("Crocin", "paracetamol", confidence=0.95, id="med-0"),
            _med("Dolo", "paracetamol", confidence=0.3, id="med-1"),
        ]
        alerts = rule_duplicate_generic(meds, THRESHOLD)
        # med-1 is below threshold, so no duplicate fires
        assert not ids_in(alerts, "R-DUP-01")

    def test_unconfirmed_med_excluded(self):
        """Unconfirmed meds should not participate in duplicate checking."""
        meds = [
            _med("Crocin", "paracetamol", confirmed=True, id="med-0"),
            _med("Dolo", "paracetamol", confirmed=False, id="med-1"),
        ]
        alerts = rule_duplicate_generic(meds, THRESHOLD)
        assert not ids_in(alerts, "R-DUP-01")

    def test_empty_list(self):
        assert rule_duplicate_generic([], THRESHOLD) == []

    def test_no_generic_name_skipped(self):
        """Meds without a generic name should be skipped, not crash."""
        meds = [
            _med("SomeUnknown", None, id="med-0"),
            _med("AnotherUnknown", None, id="med-1"),
        ]
        assert rule_duplicate_generic(meds, THRESHOLD) == []


# ═══════════════════════════════════════════════════════════════════════════════
# R-DOSE-01  Daily dose above table limit
# ═══════════════════════════════════════════════════════════════════════════════

class TestDoseLimit:
    def test_fires_when_metformin_over_limit(self):
        """1500mg × 3 = 4500mg > 3000mg limit."""
        meds = [_med("Glycomet", "metformin", dose_value=1500, frequency_per_day=3)]
        alerts = rule_dose_limit(meds, THRESHOLD)
        assert ids_in(alerts, "R-DOSE-01")

    def test_no_alert_within_limit(self):
        """1000mg × 2 = 2000mg < 3000mg limit."""
        meds = [_med("Glycomet", "metformin", dose_value=1000, frequency_per_day=2)]
        alerts = rule_dose_limit(meds, THRESHOLD)
        assert not ids_in(alerts, "R-DOSE-01")

    def test_accumulates_two_entries_of_same_generic(self):
        """500mg BD + 500mg BD = 2000mg (paracetamol max 4000mg → no alert)."""
        meds = [
            _med("Crocin 500mg morn", "paracetamol", dose_value=500, frequency_per_day=2, id="med-0"),
            _med("Crocin 500mg night", "paracetamol", dose_value=500, frequency_per_day=2, id="med-1"),
        ]
        alerts = rule_dose_limit(meds, THRESHOLD)
        assert not ids_in(alerts, "R-DOSE-01")

    def test_accumulates_over_limit(self):
        """1000mg × 3 = 3000mg + 500mg × 2 = 1000mg → 4000mg = exactly at limit (no alert)."""
        meds = [
            _med("Crocin", "paracetamol", dose_value=1000, frequency_per_day=3, id="med-0"),
            _med("Dolo", "paracetamol", dose_value=500, frequency_per_day=2, id="med-1"),
        ]
        alerts = rule_dose_limit(meds, THRESHOLD)
        assert not ids_in(alerts, "R-DOSE-01")

    def test_no_dose_value_skipped(self):
        """Cannot evaluate dose if dose_value is None."""
        meds = [_med("Glycomet", "metformin", dose_value=None, frequency_per_day=3)]
        assert not rule_dose_limit(meds, THRESHOLD)

    def test_no_frequency_skipped(self):
        meds = [_med("Glycomet", "metformin", dose_value=1500, frequency_per_day=None)]
        assert not rule_dose_limit(meds, THRESHOLD)

    def test_unknown_generic_not_evaluated(self):
        """Drug not in dose_limits.json should not raise an error."""
        meds = [_med("RareDrug", "rare_unknown_drug", dose_value=9999, frequency_per_day=10)]
        alerts = rule_dose_limit(meds, THRESHOLD)
        assert not alerts   # no data → no alert (cannot evaluate)

    def test_low_confidence_excluded(self):
        meds = [_med("Glycomet", "metformin", dose_value=1500, frequency_per_day=3, confidence=0.3)]
        assert not rule_dose_limit(meds, THRESHOLD)


# ═══════════════════════════════════════════════════════════════════════════════
# R-FREQ-01  Implausible frequency
# ═══════════════════════════════════════════════════════════════════════════════

class TestImplausibleFrequency:
    def test_fires_for_high_frequency(self):
        meds = [_med("Crocin", "paracetamol", frequency_per_day=8)]
        alerts = rule_implausible_frequency(meds, THRESHOLD)
        assert ids_in(alerts, "R-FREQ-01")

    def test_fires_for_zero_frequency(self):
        meds = [_med("Crocin", "paracetamol", frequency_per_day=0)]
        alerts = rule_implausible_frequency(meds, THRESHOLD)
        assert ids_in(alerts, "R-FREQ-01")

    def test_no_alert_normal_frequency(self):
        meds = [_med("Crocin", "paracetamol", frequency_per_day=3)]
        assert not rule_implausible_frequency(meds, THRESHOLD)

    def test_boundary_six_is_ok(self):
        """6/day is the limit — should NOT fire."""
        meds = [_med("Crocin", "paracetamol", frequency_per_day=6)]
        assert not rule_implausible_frequency(meds, THRESHOLD)

    def test_seven_fires(self):
        meds = [_med("Crocin", "paracetamol", frequency_per_day=7)]
        assert ids_in(rule_implausible_frequency(meds, THRESHOLD), "R-FREQ-01")

    def test_none_frequency_skipped(self):
        meds = [_med("Crocin", "paracetamol", frequency_per_day=None)]
        assert not rule_implausible_frequency(meds, THRESHOLD)


# ═══════════════════════════════════════════════════════════════════════════════
# R-INT-xx  Drug-pair interactions
# ═══════════════════════════════════════════════════════════════════════════════

class TestInteractions:
    def test_warfarin_aspirin_fires(self):
        meds = [
            _med("Coumadin", "warfarin", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        assert ids_in(alerts, "R-INT-01")

    def test_lisinopril_spironolactone_fires(self):
        meds = [
            _med("Zestril", "lisinopril", id="med-0"),
            _med("Aldactone", "spironolactone", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        assert ids_in(alerts, "R-INT-02")

    def test_no_interaction_for_safe_pair(self):
        meds = [
            _med("Amlopres", "amlodipine", id="med-0"),
            _med("Atorva", "atorvastatin", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        assert not any(a.rule_id.startswith("R-INT-") for a in alerts)

    def test_single_drug_no_interaction(self):
        meds = [_med("Coumadin", "warfarin")]
        alerts = rule_interactions(meds, THRESHOLD)
        assert not any(a.rule_id.startswith("R-INT-") for a in alerts)

    def test_empty_list(self):
        assert rule_interactions([], THRESHOLD) == []

    def test_low_confidence_excluded_from_interaction(self):
        meds = [
            _med("Coumadin", "warfarin", confidence=0.95, id="med-0"),
            _med("Ecosprin", "aspirin", confidence=0.3, id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        # aspirin below threshold → interaction should not fire
        assert not ids_in(alerts, "R-INT-01")

    def test_digoxin_furosemide_fires(self):
        meds = [
            _med("Lanoxin", "digoxin", id="med-0"),
            _med("Lasix", "furosemide", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        assert ids_in(alerts, "R-INT-03")

    def test_interaction_alert_severity_major(self):
        """Warfarin-aspirin interaction must be classified as major."""
        meds = [
            _med("Coumadin", "warfarin", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        int_alerts = [a for a in alerts if a.rule_id == "R-INT-01"]
        assert int_alerts[0].severity == Severity.MAJOR

    def test_alert_has_action_phrase(self):
        """Action must be one of the three allowed phrases."""
        allowed = {"Ask your pharmacist", "Contact your doctor", "Seek urgent care"}
        meds = [
            _med("Coumadin", "warfarin", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = rule_interactions(meds, THRESHOLD)
        for a in alerts:
            assert a.action in allowed


# ═══════════════════════════════════════════════════════════════════════════════
# R-RED-xx  Red-flag symptoms
# ═══════════════════════════════════════════════════════════════════════════════

class TestRedFlags:
    def test_digoxin_fires_red_flag(self):
        meds = [_med("Lanoxin", "digoxin")]
        alerts = rule_red_flags(meds, THRESHOLD)
        assert ids_in(alerts, "R-RED-01")

    def test_warfarin_fires_red_flag(self):
        meds = [_med("Coumadin", "warfarin")]
        alerts = rule_red_flags(meds, THRESHOLD)
        assert ids_in(alerts, "R-RED-02")

    def test_no_red_flag_for_safe_drug(self):
        meds = [_med("Amlopres", "amlodipine")]
        alerts = rule_red_flags(meds, THRESHOLD)
        assert not alerts

    def test_low_confidence_no_red_flag(self):
        meds = [_med("Lanoxin", "digoxin", confidence=0.3)]
        alerts = rule_red_flags(meds, THRESHOLD)
        assert not alerts

    def test_red_flag_has_seek_urgent_care(self):
        meds = [_med("Lanoxin", "digoxin")]
        alerts = rule_red_flags(meds, THRESHOLD)
        assert alerts[0].action == "Seek urgent care"


# ═══════════════════════════════════════════════════════════════════════════════
# run_all_rules  — integration tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestRunAllRules:
    def test_polypharmacy_case_fires_multiple_rules(self):
        """Case 6: digoxin, furosemide, lisinopril, spironolactone, aspirin."""
        meds = [
            _med("Lanoxin", "digoxin", dose_value=0.25, frequency_per_day=1, id="med-0"),
            _med("Lasix", "furosemide", dose_value=40, frequency_per_day=2, id="med-1"),
            _med("Zestril", "lisinopril", dose_value=10, frequency_per_day=1, id="med-2"),
            _med("Aldactone", "spironolactone", dose_value=25, frequency_per_day=1, id="med-3"),
            _med("Ecosprin", "aspirin", dose_value=75, frequency_per_day=1, id="med-4"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        rule_ids = {a.rule_id for a in alerts}
        assert "R-INT-02" in rule_ids  # lisinopril + spironolactone
        assert "R-INT-03" in rule_ids  # digoxin + furosemide
        assert "R-RED-01" in rule_ids  # digoxin red flag

    def test_duplicate_case_fires_dup_and_possibly_dose(self):
        """Case 2: Crocin 500mg BD + Dolo 650mg BD = 2300mg < 4000mg → dup fires, dose does not."""
        meds = [
            _med("Crocin", "paracetamol", dose_value=500, frequency_per_day=2, id="med-0"),
            _med("Dolo 650", "paracetamol", dose_value=650, frequency_per_day=2, id="med-1"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        assert ids_in(alerts, "R-DUP-01")
        assert not ids_in(alerts, "R-DOSE-01")

    def test_clean_case_no_alerts(self):
        """Case 1: amlodipine + atorvastatin — no safety alerts."""
        meds = [
            _med("Amlopres", "amlodipine", dose_value=5, frequency_per_day=1, id="med-0"),
            _med("Atorva", "atorvastatin", dose_value=20, frequency_per_day=1, id="med-1"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        safety_alerts = [a for a in alerts if a.rule_id not in ("R-RED-01", "R-RED-02", "R-RED-03", "R-RED-04", "R-RED-05")]
        assert not safety_alerts

    def test_output_sorted_major_first(self):
        """Alerts must be sorted: major → moderate → info."""
        meds = [
            _med("Crocin", "paracetamol", confidence=0.4, id="med-0"),  # R-OCR-01 = info
            _med("Coumadin", "warfarin", confidence=0.95, id="med-1"),
            _med("Ecosprin", "aspirin", confidence=0.95, id="med-2"),    # R-INT-01 = major
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        severities = [a.severity for a in alerts]
        order = {Severity.MAJOR: 0, Severity.MODERATE: 1, Severity.INFO: 2}
        assert all(order[severities[i]] <= order[severities[i+1]] for i in range(len(severities)-1))

    def test_determinism(self):
        """Same input always produces the same output (no randomness)."""
        meds = [
            _med("Coumadin", "warfarin", dose_value=5, frequency_per_day=1, id="med-0"),
            _med("Ecosprin", "aspirin", dose_value=75, frequency_per_day=1, id="med-1"),
        ]
        result_a = run_all_rules(meds, THRESHOLD)
        result_b = run_all_rules(meds, THRESHOLD)
        assert [a.rule_id for a in result_a] == [a.rule_id for a in result_b]

    def test_no_banned_language_in_actions(self):
        """Actions must never say 'stop taking' or 'change your dose'."""
        meds = [
            _med("Lanoxin", "digoxin", dose_value=0.25, frequency_per_day=1, id="med-0"),
            _med("Lasix", "furosemide", dose_value=40, frequency_per_day=2, id="med-1"),
            _med("Zestril", "lisinopril", dose_value=10, frequency_per_day=1, id="med-2"),
            _med("Aldactone", "spironolactone", dose_value=25, frequency_per_day=1, id="med-3"),
            _med("Ecosprin", "aspirin", dose_value=75, frequency_per_day=1, id="med-4"),
            _med("Coumadin", "warfarin", dose_value=5, frequency_per_day=1, id="med-5"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        banned = ["stop taking", "change your dose", "discontinue", "do not take"]
        for alert in alerts:
            for phrase in banned:
                assert phrase not in alert.action.lower(), (
                    f"Rule {alert.rule_id} contains banned phrase '{phrase}' in action"
                )

    def test_all_alert_actions_are_allowed_phrases(self):
        allowed = {"Ask your pharmacist", "Contact your doctor", "Seek urgent care"}
        meds = [
            _med("Lanoxin", "digoxin", dose_value=0.25, frequency_per_day=1, id="med-0"),
            _med("Coumadin", "warfarin", dose_value=5, frequency_per_day=1, id="med-1"),
            _med("Ecosprin", "aspirin", dose_value=75, frequency_per_day=1, id="med-2"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        for alert in alerts:
            assert alert.action in allowed, f"Bad action '{alert.action}' in {alert.rule_id}"

    def test_every_alert_has_rule_id(self):
        meds = [
            _med("Coumadin", "warfarin", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        for alert in alerts:
            assert alert.rule_id, "Alert missing rule_id"
            assert alert.rule_id.startswith("R-"), f"Malformed rule_id: {alert.rule_id}"

    def test_source_to_verify_present(self):
        """Every alert must have a non-empty source_to_verify field."""
        meds = [
            _med("Coumadin", "warfarin", id="med-0"),
            _med("Ecosprin", "aspirin", id="med-1"),
        ]
        alerts = run_all_rules(meds, THRESHOLD)
        for alert in alerts:
            assert alert.source_to_verify, f"Missing source_to_verify on {alert.rule_id}"
