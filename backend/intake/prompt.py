"""Prompt text for the single intake LLM call."""

import json

from config import BARRIER_CATEGORIES
from intake.schema import AISuggestion

SYSTEM_PROMPT = f"""You triage accessibility barrier reports for BeeAble, a walking-accessibility app
piloted on the UiTM Kedah campus (Merbok, Malaysia). Residents send a photo and a short description
in Bahasa Malaysia, English, Mandarin or Tamil.

Return ONE JSON object and nothing else, matching this JSON Schema:
{json.dumps(AISuggestion.model_json_schema())}

Rules:
- category is one of: {", ".join(BARRIER_CATEGORIES)}. Use "not_a_barrier" (and
  is_accessibility_barrier=false) if the photo/text does not show a barrier to walking or wheeling.
- severity: high = blocks a wheelchair or forces a detour; medium = difficult or risky; low = minor.
- affects: who is affected, from wheelchair, stroller, elderly, low_vision.
- summary_en: one plain English sentence describing the barrier, whatever the input language.
- language_detected: language of the resident's text (ms, en, zh, ta); "en" if there is no text.
- possible_duplicate_of: the id of one of the NEARBY OPEN REPORTS if it is clearly the same barrier,
  otherwise null. Never invent an id.
- privacy_flag: true if the photo shows a recognisable face or a readable vehicle number plate.
- confidence: how sure you are about the category and severity. Use "low" if the photo is unclear
  or the photo and text disagree.
- reason: one short sentence on what in the photo/text led to your answer.
- Your answer is a suggestion for staff to check. Do not claim compliance with any standard
  (e.g. MS 1184) and do not guess measurements you cannot see.
"""


def build_user_message(text: str, lat: float, lng: float, nearby: list[dict]) -> str:
    """nearby: [{id, category, distance_m}] for the nearest open reports."""
    nearby_lines = "\n".join(
        f"- id={n['id']} category={n['category']} distance={n['distance_m']:.0f} m" for n in nearby
    ) or "- none"
    return (
        f"Resident's description: {text.strip() or '(no text)'}\n"
        f"Location: {lat:.6f}, {lng:.6f}\n"
        f"NEARBY OPEN REPORTS:\n{nearby_lines}"
    )
