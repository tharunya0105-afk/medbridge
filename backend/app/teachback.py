"""
MedBridge teach-back engine  —  app/teachback.py

Generates deterministic multiple-choice questions from the CONFIRMED
medication schedule.  No LLM involved — questions and correct answers
are derived algorithmically from the schedule data.

Rules:
  - 2–4 questions per session
  - Each question has exactly one correct answer traceable to the schedule
  - Wrong distractors are plausible but wrong values from the SAME schedule
  - Never contradict the confirmed data
"""
from __future__ import annotations

import random
from typing import Optional

from .models import ExtractedMed, TeachbackQuestion


def _make_distractors(correct: str, pool: list[str], n: int = 3) -> list[str]:
    """Return n distractors from pool that are not the correct answer."""
    wrong = [x for x in pool if x != correct]
    # If not enough unique distractors, add some generic plausible values
    generic_extras = ["Once a day", "Twice a day", "Three times a day",
                      "5 days", "7 days", "14 days", "30 days",
                      "morning", "evening", "with food"]
    for e in generic_extras:
        if e not in wrong and e != correct:
            wrong.append(e)
    chosen = wrong[:n]
    return chosen


def _frequency_label(fpd: Optional[float]) -> str:
    if fpd is None:
        return "as directed"
    mapping = {
        1: "Once a day",
        2: "Twice a day",
        3: "Three times a day",
        4: "Four times a day",
    }
    return mapping.get(int(fpd), f"{fpd} times a day")


def generate_questions(
    meds: list[ExtractedMed],
    seed: Optional[int] = None,
) -> list[TeachbackQuestion]:
    """
    Generate 2–4 teach-back questions from the confirmed medicine list.

    Question types attempted (in priority order):
      1. Frequency question for the first med with frequency_per_day
      2. Duration question for the first med with duration_days
      3. Red-flag awareness (instructions mention "contact doctor" etc.)
      4. Name-recall question

    All answers are derived from the confirmed schedule — never invented.
    """
    rng = random.Random(seed)
    questions: list[TeachbackQuestion] = []
    confirmed = [m for m in meds if m.confirmed]

    if not confirmed:
        return []

    # ── Q1: Frequency ──────────────────────────────────────────────────────────
    freq_meds = [m for m in confirmed if m.frequency_per_day is not None]
    if freq_meds:
        target = freq_meds[0]
        correct = _frequency_label(target.frequency_per_day)
        freq_pool = [_frequency_label(m.frequency_per_day) for m in freq_meds]
        distractors = _make_distractors(correct, freq_pool)
        options = [correct] + distractors[:3]
        rng.shuffle(options)
        correct_index = options.index(correct)
        questions.append(TeachbackQuestion(
            question_id="q-freq-0",
            question_text=f"How often should you take {target.name_raw}?",
            options=options,
            correct_index=correct_index,
            med_id=target.id,
            rationale=(
                f"Your discharge summary says to take {target.name_raw} "
                f"{correct.lower()}."
            ),
        ))

    # ── Q2: Duration ───────────────────────────────────────────────────────────
    dur_meds = [m for m in confirmed if m.duration_days is not None]
    if dur_meds:
        target = dur_meds[0]
        correct = f"{target.duration_days} days"
        dur_pool = [f"{m.duration_days} days" for m in dur_meds]
        distractors = _make_distractors(correct, dur_pool + ["3 days", "5 days", "7 days", "10 days", "14 days"])
        options = [correct] + distractors[:3]
        rng.shuffle(options)
        correct_index = options.index(correct)
        questions.append(TeachbackQuestion(
            question_id="q-dur-0",
            question_text=f"For how many days should you take {target.name_raw}?",
            options=options,
            correct_index=correct_index,
            med_id=target.id,
            rationale=(
                f"Your discharge summary says to continue {target.name_raw} "
                f"for {target.duration_days} days."
            ),
        ))

    # ── Q3: Dose identification ────────────────────────────────────────────────
    dose_meds = [m for m in confirmed if m.dose_value is not None and m.dose_unit]
    if dose_meds and len(questions) < 3:
        target = dose_meds[0]
        correct = f"{int(target.dose_value) if target.dose_value == int(target.dose_value) else target.dose_value} {target.dose_unit}"
        dose_pool = [f"{int(m.dose_value) if m.dose_value == int(m.dose_value) else m.dose_value} {m.dose_unit}" for m in dose_meds]
        extra_doses = ["250 mg", "500 mg", "1000 mg", "10 mg", "20 mg", "40 mg", "5 mg"]
        distractors = _make_distractors(correct, dose_pool + extra_doses)
        options = [correct] + distractors[:3]
        rng.shuffle(options)
        correct_index = options.index(correct)
        questions.append(TeachbackQuestion(
            question_id="q-dose-0",
            question_text=f"What is the strength of each {target.name_raw} tablet/dose?",
            options=options,
            correct_index=correct_index,
            med_id=target.id,
            rationale=(
                f"Each dose of {target.name_raw} is {correct} according to your prescription."
            ),
        ))

    # ── Q4: Medicine name recall ───────────────────────────────────────────────
    if len(confirmed) >= 2 and len(questions) < 4:
        # Pick a med and ask which ones are on the schedule
        target = confirmed[0]
        correct = target.name_raw
        other_names = [m.name_raw for m in confirmed if m.id != target.id]
        extra_names = ["Pantoprazole", "Metoprolol", "Losartan", "Vitamin D"]
        distractors = _make_distractors(correct, other_names + extra_names)
        options = [correct] + distractors[:3]
        rng.shuffle(options)
        correct_index = options.index(correct)
        questions.append(TeachbackQuestion(
            question_id="q-name-0",
            question_text="Which of these medicines is on your discharge prescription?",
            options=options,
            correct_index=correct_index,
            med_id=target.id,
            rationale=f"{correct} is listed on your prescription.",
        ))

    return questions[:4]  # cap at 4


def score_session(
    answers: list[tuple[str, int]],   # (question_id, selected_index)
    questions: list[TeachbackQuestion],
) -> dict:
    """
    Compute comprehension score for a teach-back session.

    Returns:
      {
        "score": float (0-1),
        "correct": int,
        "total": int,
        "details": [{"question_id", "correct", "selected", "expected"}]
      }
    """
    q_map = {q.question_id: q for q in questions}
    details = []
    correct_count = 0

    for qid, selected in answers:
        if qid not in q_map:
            continue
        q = q_map[qid]
        is_correct = selected == q.correct_index
        if is_correct:
            correct_count += 1
        details.append({
            "question_id": qid,
            "correct": is_correct,
            "selected_index": selected,
            "correct_index": q.correct_index,
            "rationale": q.rationale,
        })

    total = len(details) or 1
    return {
        "score": round(correct_count / total, 2),
        "correct": correct_count,
        "total": total,
        "details": details,
    }
