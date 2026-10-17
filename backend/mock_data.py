"""Seed reports for the demo (all labelled source="simulated"). edge_id is filled in by main.py
by snapping each report to the campus graph."""

from datetime import datetime, timedelta, timezone

from schemas import AISuggestion, Report


def seed_reports() -> dict[str, Report]:
    now = datetime.now(timezone.utc)
    seeds = [
        # On the shortest path to Unit Kesihatan; resolving it reopens that path (demo step 5).
        ("r-001", 5.7119793, 100.4484015, "Tangga tiada ramp di laluan ke Unit Kesihatan", "ms", "verified",
         AISuggestion(is_accessibility_barrier=True, category="steps_no_ramp", severity="high",
                      affects=["wheelchair", "stroller", "elderly"],
                      summary_en="Steps with no ramp on the main path to Unit Kesihatan.",
                      language_detected="ms", confidence="high",
                      reason="Steps clearly visible; no ramp in frame.")),
        ("r-002", 5.7130, 100.4491, "Paving broken at Depo Bas", "en", "unverified",
         AISuggestion(is_accessibility_barrier=True, category="broken_paving", severity="medium",
                      affects=["wheelchair", "low_vision"],
                      summary_en="Several loose paving tiles beside the Depo Bas shelter.",
                      language_detected="en", confidence="medium",
                      reason="Uneven tiles visible; extent unclear.")),
        ("r-003", 5.7105, 100.4474, "Motorcycle parked on ramp near Pusat Islam", "en", "verified",
         AISuggestion(is_accessibility_barrier=True, category="obstruction", severity="medium",
                      affects=["wheelchair", "stroller"],
                      summary_en="Motorcycle blocking kerb ramp near Pusat Islam.",
                      language_detected="en", privacy_flag=True, confidence="high",
                      reason="Vehicle on ramp; number plate visible.")),
    ]
    return {
        rid: Report(
            id=rid, reference_number=f"BEE-{rid[-3:]}", lat=lat, lng=lng, photo_url=None,
            original_text=text, language=lang, ai=ai, ai_source="simulated", status=status,
            source="simulated",
            created_at=now - timedelta(days=i + 2),
            verified_at=now - timedelta(days=i + 1) if status == "verified" else None,
        )
        for i, (rid, lat, lng, text, lang, status, ai) in enumerate(seeds)
    }
