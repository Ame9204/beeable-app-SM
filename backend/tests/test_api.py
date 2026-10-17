from fastapi.testclient import TestClient

from main import app
from priority.score import priority_score

client = TestClient(app)


def test_route_shape():
    r = client.get("/route", params={"from": "5.7141,100.4504", "to": "5.7099,100.4466", "profile": "step_free"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"shortest", "recommended", "costs", "explanation", "surveyed_share"}
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
