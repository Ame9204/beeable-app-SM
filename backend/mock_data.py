"""Mock data matching the API contract. Replace piece by piece as real modules land.

Seeded reports are labelled source="simulated".
"""

from datetime import datetime, timedelta, timezone

from config import Profile
from schemas import AISuggestion, Report

LatLng = tuple[float, float]


def _line(coords: list[LatLng], **props) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[lng, lat] for lat, lng in coords]},
        "properties": props,
    }


def mock_route(origin: LatLng, dest: LatLng, profile: Profile) -> dict:
    """Two plausible-looking routes between origin and dest, split into segments."""
    (lat1, lng1), (lat2, lng2) = origin, dest
    mid = ((lat1 + lat2) / 2, (lng1 + lng2) / 2)
    off = 0.0015 if profile == "step_free" else 0.0008
    detour = (mid[0] + off, mid[1] - off)

    shortest = {
        "type": "FeatureCollection",
        "features": [
            _line([origin, mid], edge_id="e1", source="surveyed", surveyed=True),
            _line([mid, dest], edge_id="e2", source="surveyed", surveyed=True,
                  barrier="steps_no_ramp", barrier_verified=True),
        ],
    }
    recommended = {
        "type": "FeatureCollection",
        "features": [
            _line([origin, detour], edge_id="e3", source="surveyed", surveyed=True),
            _line([detour, dest], edge_id="e4", source="imported", surveyed=False),
        ],
    }
    if profile == "step_free":
        costs = {
            "shortest": {"length_m": 420, "cost": None, "blocked_by": "verified steps on e2"},
            "recommended": {"length_m": 510, "cost": 637.5},
        }
        explanation = [
            "The shortest route has verified steps with no ramp, so it is avoided for step-free.",
            "This route uses the ramp, adding about 90 m (about 2 min).",
            "Part of this route has not been surveyed, so conditions there are unknown.",
        ]
    else:
        costs = {
            "shortest": {"length_m": 420, "cost": 1260.0},
            "recommended": {"length_m": 470, "cost": 587.5},
        }
        explanation = [
            "The shortest route has steps, which add effort for easy walking.",
            "This route is about 50 m longer but avoids the steps.",
            "Part of this route has not been surveyed, so conditions there are unknown.",
        ]
    return {
        "shortest": shortest,
        "recommended": recommended,
        "costs": costs,
        "explanation": explanation,
        "surveyed_share": 0.62,
    }


def seed_reports() -> dict[str, Report]:
    now = datetime.now(timezone.utc)
    seeds = [
        ("r-001", 5.7099, 100.4467, "Tangga tiada ramp depan Unit Kesihatan", "ms", "verified",
         AISuggestion(is_accessibility_barrier=True, category="steps_no_ramp", severity="high",
                      affects=["wheelchair", "stroller", "elderly"],
                      summary_en="Three steps at the Unit Kesihatan entrance with no ramp.",
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


# (route_criticality, poi_proximity, report_count) per report until routing exists.
MOCK_PRIORITY_INPUTS: dict[str, tuple[float, int, int]] = {
    "r-001": (0.45, 1, 4),
    "r-002": (0.20, 1, 2),
    "r-003": (0.10, 0, 1),
}
