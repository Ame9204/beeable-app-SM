from fastapi.testclient import TestClient

from main import app
from priority.score import priority_score

client = TestClient(app)


def test_route_shape():
    r = client.get("/route", params={"from": "5.7141,100.4504", "to": "5.7099,100.4466", "profile": "step_free"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"shortest", "recommended", "costs", "explanation", "surveyed_share", "alternative"}
    assert body["recommended"]["type"] == "FeatureCollection"


def test_route_rejects_bad_coords():
    assert client.get("/route", params={"from": "nope", "to": "5.71,100.45"}).status_code == 422


def test_new_report_is_unverified_then_patchable():
    r = client.post("/reports", json={"text": "Kerb rosak", "lat": 5.7141, "lng": 100.4504})
    assert r.status_code == 201
    report = r.json()
    assert report["status"] == "unverified"
    assert report["ai"]["language_detected"] == "ms"

    p = client.patch(f"/reports/{report['id']}", json={"status": "verified"})
    assert p.json()["status"] == "verified"
    ids = [x["report"]["id"] for x in client.get("/priorities").json()]
    assert report["id"] in ids


def test_priorities_sorted_desc():
    scores = [p["score"] for p in client.get("/priorities").json()]
    assert scores == sorted(scores, reverse=True)


def test_priority_formula():
    assert priority_score("high", 0.5, 1, 4) == 3 * 2.5 * 2


def test_upload_then_report_with_photo():
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2000, 1500), "red").save(buf, format="JPEG")
    up = client.post("/uploads", files={"file": ("kerb.jpg", buf.getvalue(), "image/jpeg")})
    assert up.status_code == 200
    url = up.json()["photo_url"]
    assert client.get(url).status_code == 200

    r = client.post("/reports", json={"photo_url": url, "text": "Kerb pecah", "lat": 5.7141, "lng": 100.4504})
    body = r.json()
    assert body["status"] == "unverified" and body["ai_source"] == "fallback"


def test_upload_rejects_non_image():
    r = client.post("/uploads", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_staff_edits_are_validated():
    rid = client.post("/reports", json={"text": "x", "lat": 5.71, "lng": 100.45}).json()["id"]
    bad = client.patch(f"/reports/{rid}", json={"status": "verified", "edits": {"category": "pothole"}})
    assert bad.status_code == 422
    ok = client.patch(f"/reports/{rid}", json={"status": "verified", "edits": {"category": "high_kerb"}})
    assert ok.json()["ai"]["category"] == "high_kerb"


def test_reports_persist_to_store():
    import json

    from config import STORE_PATH

    rid = client.post("/reports", json={"text": "saved?", "lat": 5.71, "lng": 100.45}).json()["id"]
    saved = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    assert rid in {r["id"] for r in saved["reports"]}


def test_resolve_changes_route_end_to_end():
    params = {"from": "5.714050829302482,100.45039616486677", "to": "5.709855420465538,100.44663876053161",
              "profile": "step_free"}
    client.patch("/reports/r-001", json={"status": "verified"})
    before = client.get("/route", params=params).json()["costs"]["recommended"]["length_m"]
    client.patch("/reports/r-001", json={"status": "resolved"})
    after = client.get("/route", params=params).json()["costs"]["recommended"]["length_m"]
    assert after < before


def test_reports_get_an_edge_id():
    r = client.post("/reports", json={"text": "x", "lat": 5.7119, "lng": 100.4484}).json()
    assert r["edge_id"]


def test_route_off_campus_is_422():
    r = client.get("/route", params={"from": "5.80,100.50", "to": "5.7099,100.4466"})
    assert r.status_code == 422


def test_health_reports_intake_status_without_the_key():
    client.post("/reports", json={"text": "x", "lat": 5.71, "lng": 100.45})  # INTAKE_PROVIDER=none in tests
    intake = client.get("/health").json()["intake"]
    assert intake["key_set"] in (True, False)
    assert "not set" in intake["last_error"]["reason"]


def _upload_red_photo() -> str:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (800, 600), "red").save(buf, format="JPEG")
    return client.post("/uploads", files={"file": ("kerb.jpg", buf.getvalue(), "image/jpeg")}).json()["photo_url"]


def test_report_needs_photo_or_text():
    r = client.post("/reports", json={"text": "  ", "lat": 5.71, "lng": 100.45})
    assert r.status_code == 422


def test_analyse_needs_an_uploaded_photo():
    r = client.post("/reports/analyse", json={"photo_url": "https://example.com/x.jpg", "lat": 5.71, "lng": 100.45})
    assert r.status_code == 422


def test_analyse_then_send_reuses_the_answer(monkeypatch):
    import main
    from intake.service import fallback_suggestion

    calls = []

    def fake_intake(**kwargs):
        calls.append(kwargs)
        return fallback_suggestion("").model_copy(update={"category": "damaged_kerb", "confidence": "high"}), "live"

    monkeypatch.setattr(main, "run_intake", fake_intake)
    url = _upload_red_photo()
    a = client.post("/reports/analyse", json={"photo_url": url, "lat": 5.7141, "lng": 100.4504}).json()
    assert a["ai"]["category"] == "damaged_kerb" and a["ai_source"] == "live"

    # photo only, no text: allowed, and the model is not called a second time
    r = client.post("/reports", json={"photo_url": url, "lat": 5.7141, "lng": 100.4504, "analysis_id": a["analysis_id"]})
    assert r.status_code == 201
    assert r.json()["ai"]["category"] == "damaged_kerb"
    assert len(calls) == 1
    # a clear, confident live answer: the AI confirms it and it is ranked straight away
    assert r.json()["status"] == "verified" and r.json()["verified_by"] == "ai"
    assert r.json()["id"] in [x["report"]["id"] for x in client.get("/priorities").json()]


def test_doubtful_ai_answer_stays_for_staff(monkeypatch):
    import main
    from intake.service import fallback_suggestion

    low = fallback_suggestion("").model_copy(update={"category": "damaged_kerb", "confidence": "low"})
    monkeypatch.setattr(main, "run_intake", lambda **kw: (low, "live"))
    r = client.post("/reports", json={"text": "Kerb rosak?", "lat": 5.7101, "lng": 100.4461}).json()
    assert r["status"] == "unverified" and r["verified_by"] is None


def test_analysis_not_reused_when_text_changes(monkeypatch):
    import main
    from intake.service import fallback_suggestion

    calls = []
    monkeypatch.setattr(main, "run_intake", lambda **kw: (calls.append(kw), (fallback_suggestion(""), "live"))[1])
    url = _upload_red_photo()
    a = client.post("/reports/analyse", json={"photo_url": url, "lat": 5.71, "lng": 100.45}).json()
    client.post("/reports", json={"photo_url": url, "text": "Tangga", "lat": 5.71, "lng": 100.45, "analysis_id": a["analysis_id"]})
    assert len(calls) == 2 and calls[1]["text"] == "Tangga"


def test_cors_allows_local_dashboard_on_any_port():
    for origin in ("http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:8080", "https://localhost"):
        r = client.get("/reports", headers={"Origin": origin})
        assert r.headers.get("access-control-allow-origin") == origin, origin
    for origin in ("http://evil.example", "http://localhost.evil.example", "https://localhost:5173.evil.example"):
        r = client.get("/reports", headers={"Origin": origin})
        assert "access-control-allow-origin" not in r.headers, origin


def test_non_barrier_is_auto_rejected_and_staff_can_re_accept(monkeypatch):
    import main
    from intake.service import fallback_suggestion

    no = fallback_suggestion("").model_copy(
        update={"is_accessibility_barrier": False, "category": "not_a_barrier", "confidence": "high"})
    monkeypatch.setattr(main, "run_intake", lambda **kw: (no, "live"))
    r = client.post("/reports", json={"text": "Nice tree", "lat": 5.7120, "lng": 100.4480}).json()
    assert r["status"] == "rejected" and r["rejected_by"] == "ai"

    p = client.patch(f"/reports/{r['id']}", json={"status": "verified"}).json()
    assert p["status"] == "verified" and p["verified_by"] == "staff"
    assert p["ai"]["is_accessibility_barrier"] and p["ai"]["category"] == "other"
