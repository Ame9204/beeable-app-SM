"""Flag open reports that may describe the same barrier: close in place and time, same or related type.

Pure functions, no I/O. The result is a hint for staff on the dashboard; nothing is merged automatically.
"""

from typing import Iterable

from config import (
    RELATED_CATEGORIES, SIMILAR_LIKELY_RADIUS_M, SIMILAR_LIKELY_WINDOW_DAYS, SIMILAR_RADIUS_M, SIMILAR_WINDOW_DAYS,
)
from intake.service import haversine_m
from schemas import Report, SimilarReport

CLOSED = ("rejected", "resolved")
# "other" (or an AI fallback) says nothing about the type, so it can match anything, but only as "possible".
UNKNOWN_CATEGORIES = ("other",)


def category_relation(a: str, b: str) -> str | None:
    """'same', 'related', 'unknown' or None (different kinds of barrier)."""
    if "not_a_barrier" in (a, b):
        return None
    if a in UNKNOWN_CATEGORIES or b in UNKNOWN_CATEGORIES:
        return "unknown"
    if a == b:
        return "same"
    if any(a in group and b in group for group in RELATED_CATEGORIES):
        return "related"
    return None


def _when(hours: float) -> str:
    if hours < 1:
        return "under an hour apart"
    if hours < 48:
        return f"{round(hours)} h apart"
    return f"{round(hours / 24)} days apart"


def compare(r: Report, other: Report) -> SimilarReport | None:
    """How `other` relates to `r`, or None if it's not a plausible match."""
    if other.id == r.id or other.status in CLOSED:
        return None
    relation = category_relation(r.ai.category, other.ai.category)
    if relation is None:
        return None
    distance = haversine_m(r.lat, r.lng, other.lat, other.lng)
    same_edge = bool(r.edge_id) and r.edge_id == other.edge_id
    if distance > SIMILAR_RADIUS_M and not (same_edge and distance <= 2 * SIMILAR_RADIUS_M):
        return None
    hours = abs((r.created_at - other.created_at).total_seconds()) / 3600
    if hours > SIMILAR_WINDOW_DAYS * 24:
        return None

    likely = (
        relation == "same"
        and (distance <= SIMILAR_LIKELY_RADIUS_M or same_edge)
        and hours <= SIMILAR_LIKELY_WINDOW_DAYS * 24
    )
    type_text = {"same": "same type", "related": "related type", "unknown": "type unclear"}[relation]
    where = f"{round(distance)} m apart" + (", same path" if same_edge else "")
    return SimilarReport(
        id=other.id,
        reference_number=other.reference_number,
        match="likely" if likely else "possible",
        distance_m=round(distance, 1),
        hours_apart=round(hours, 1),
        same_category=relation == "same",
        reason=f"{where} · {_when(hours)} · {type_text}",
    )


def find_similar(r: Report, reports: Iterable[Report]) -> list[SimilarReport]:
    """Open reports that may be the same barrier as `r`, likely matches first, then nearest.
    Also keeps the AI's own `possible_duplicate_of` guess if the rule didn't already find it."""
    if r.status in CLOSED:
        return []
    pool = list(reports)
    matches = [m for o in pool if (m := compare(r, o))]
    ai_dup = r.ai.possible_duplicate_of
    if ai_dup and ai_dup not in {m.id for m in matches}:
        other = next((o for o in pool if o.id == ai_dup and o.status not in CLOSED), None)
        if other:
            hours = abs((r.created_at - other.created_at).total_seconds()) / 3600
            distance = haversine_m(r.lat, r.lng, other.lat, other.lng)
            matches.append(SimilarReport(
                id=other.id,
                reference_number=other.reference_number,
                match="possible",
                distance_m=round(distance, 1),
                hours_apart=round(hours, 1),
                same_category=r.ai.category == other.ai.category,
                reason=f"AI thinks it's the same · {round(distance)} m apart · {_when(hours)}",
            ))
    return sorted(matches, key=lambda m: (m.match != "likely", m.distance_m))
