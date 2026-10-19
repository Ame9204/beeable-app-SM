from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from intake.service import fallback_suggestion
from main import app
from schemas import Report
from similar import category_relation, find_similar

T0 = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)
# ~1.1 m per 0.00001 deg of latitude
BASE = (5.71405, 100.45040)


def make(rid: str, category: str = "damaged_kerb", d_lat: float = 0.0, hours: float = 0, status: str = "unverified",
         edge: str | None = None, dup: str | None = None) -> Report:
    ai = fallback_suggestion("").model_copy(update={"category": category, "possible_duplicate_of": dup})
    return Report(
        id=rid, reference_number=f"BEE-{rid}", lat=BASE[0] + d_lat, lng=BASE[1], photo_url=None, original_text="",
        language="en", ai=ai, status=status, edge_id=edge, created_at=T0 + timedelta(hours=hours),  # type: ignore[arg-type]
    )


def test_category_relation():
    assert category_relation("high_kerb", "high_kerb") == "same"
    assert category_relation("high_kerb", "damaged_kerb") == "related"
    assert category_relation("other", "steep_slope") == "unknown"
    assert category_relation("other", "other") == "unknown"
    assert category_relation("obstruction", "steep_slope") is None
    assert category_relation("not_a_barrier", "not_a_barrier") is None


def test_close_same_type_same_day_is_likely():
    a, b = make("a"), make("b", d_lat=0.0001, hours=3)  # ~11 m, 3 h
    [m] = find_similar(a, [a, b])
    assert m.id == "b" and m.match == "likely" and m.same_category
    assert "11 m apart" in m.reason and "3 h apart" in m.reason and "same type" in m.reason


def test_related_type_is_only_possible():
    a, b = make("a", "high_kerb"), make("b", "damaged_kerb", d_lat=0.0001)
    [m] = find_similar(a, [a, b])
    assert m.match == "possible" and not m.same_category


def test_far_away_old_or_different_type_is_not_a_match():
    a = make("a")
    far = make("far", d_lat=0.001)  # ~110 m
    old = make("old", hours=24 * 20)
    other_kind = make("kind", "steep_slope", d_lat=0.0001)
    assert find_similar(a, [a, far, old, other_kind]) == []


def test_closed_reports_are_ignored_both_ways():
    a, done = make("a"), make("done", d_lat=0.0001, status="resolved")
    assert find_similar(a, [a, done]) == []
    assert find_similar(done, [a, done]) == []


def test_same_path_stretches_the_radius():
    a, b = make("a", edge="e1"), make("b", d_lat=0.0006, edge="e1")  # ~66 m, same edge
    [m] = find_similar(a, [a, b])
    assert m.match == "likely" and "same path" in m.reason


def test_ai_duplicate_guess_is_kept():
    a, b = make("a", "obstruction", dup="b"), make("b", "steep_slope", d_lat=0.002)
    [m] = find_similar(a, [a, b])
    assert m.id == "b" and m.match == "possible" and m.reason.startswith("AI thinks")


def test_likely_matches_sort_first():
    a = make("a")
    near_related = make("rel", "high_kerb", d_lat=0.00005)
    likely = make("same", d_lat=0.0002)
    assert [m.id for m in find_similar(a, [a, near_related, likely])] == ["same", "rel"]


def test_api_returns_similar_reports():
    client = TestClient(app)
    first = client.post("/reports", json={"text": "Kerb rosak", "lat": 5.71500, "lng": 100.45100}).json()
    second = client.post("/reports", json={"text": "Kerb pecah", "lat": 5.71502, "lng": 100.45100}).json()
    assert first["id"] in [s["id"] for s in second["similar"]]  # both fall back to "other": type unclear
    listed = {r["id"]: r for r in client.get("/reports").json()}
    assert second["id"] in [s["id"] for s in listed[first["id"]]["similar"]]
