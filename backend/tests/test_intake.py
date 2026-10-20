import io
import json

from PIL import Image

from intake import service
from intake.images import process_image
from intake.service import nearest_open, run_intake
from mock_data import seed_reports

VALID = {
    "is_accessibility_barrier": True,
    "category": "high_kerb",
    "severity": "high",
    "affects": ["wheelchair"],
    "summary_en": "Kerb too high to mount.",
    "language_detected": "ms",
    "possible_duplicate_of": None,
    "privacy_flag": False,
    "confidence": "high",
    "reason": "Kerb visible, no dropped section.",
}
NEARBY = [{"id": "r-001", "category": "steps_no_ramp", "distance_m": 12.0}]


class FakeProvider:
    name = "fake"

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0

    def suggest(self, image, mime, prompt):
        self.calls += 1
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def intake(provider, **kw):
    args = dict(image=None, text="Kerb tinggi", lat=5.71, lng=100.45, nearby=NEARBY)
    return run_intake(provider=provider, **{**args, **kw})


def test_valid_reply_is_live():
    ai, source = intake(FakeProvider(json.dumps(VALID)))
    assert source == "live" and ai.category == "high_kerb"


def test_invalid_then_valid_retries_once():
    p = FakeProvider("not json", json.dumps(VALID))
    ai, source = intake(p)
    assert p.calls == 2 and source == "live"


def test_wrong_category_counts_as_invalid():
    p = FakeProvider(json.dumps({**VALID, "category": "pothole"}), json.dumps({**VALID, "category": "x"}))
    ai, source = intake(p)
    assert p.calls == 2 and source == "fallback" and ai.confidence == "low"


def test_auth_error_falls_back_without_retry():
    p = FakeProvider(RuntimeError("ClientError: 403 PERMISSION_DENIED"))
    ai, source = intake(p)
    assert p.calls == 1 and source == "fallback" and ai.language_detected == "ms"


def test_deadline_exceeded_is_retried_once():
    err = RuntimeError("ServerError: 504 DEADLINE_EXCEEDED. Deadline expired before operation could complete.")
    p = FakeProvider(err, json.dumps(VALID))
    ai, source = intake(p)
    assert p.calls == 2 and source == "live"


def test_two_timeouts_fall_back():
    p = FakeProvider(TimeoutError("slow"), TimeoutError("slow again"))
    _, source = intake(p)
    assert p.calls == 2 and source == "fallback"


def test_is_transient():
    assert service.is_transient(TimeoutError())
    assert service.is_transient(RuntimeError("503 UNAVAILABLE"))
    assert not service.is_transient(RuntimeError("429 RESOURCE_EXHAUSTED"))
    assert not service.is_transient(RuntimeError("400 INVALID_ARGUMENT"))


def test_no_provider_falls_back():
    assert intake(None)[1] == "fallback"  # INTAKE_PROVIDER=none in tests


def test_fenced_json_is_accepted():
    ai, source = intake(FakeProvider(f"```json\n{json.dumps(VALID)}\n```"))
    assert source == "live"


def test_unknown_duplicate_id_dropped_known_kept():
    ai, _ = intake(FakeProvider(json.dumps({**VALID, "possible_duplicate_of": "r-999"})))
    assert ai.possible_duplicate_of is None
    ai, _ = intake(FakeProvider(json.dumps({**VALID, "possible_duplicate_of": "r-001"})))
    assert ai.possible_duplicate_of == "r-001"


def test_demo_photo_uses_cache(tmp_path, monkeypatch):
    photo, cached = tmp_path / "demo.jpg", tmp_path / "demo.json"
    buf = io.BytesIO()
    Image.new("RGB", (50, 40), "grey").save(buf, format="JPEG")
    photo.write_bytes(buf.getvalue())
    cached.write_text(json.dumps({**VALID, "category": "damaged_kerb"}))
    monkeypatch.setattr(service, "DEMO_PHOTO_PATH", photo)
    monkeypatch.setattr(service, "DEMO_INTAKE_PATH", cached)
    monkeypatch.setattr("intake.providers.DEMO_INTAKE_PATH", cached)
    service.demo_photo_hash.cache_clear()

    uploaded, _ = process_image(buf.getvalue())  # same pipeline as /uploads
    ai, source = intake(FakeProvider(), image=uploaded)  # provider must not be called
    assert source == "cached" and ai.category == "damaged_kerb"
    service.demo_photo_hash.cache_clear()


def test_process_image_strips_exif_and_resizes():
    img = Image.new("RGB", (3000, 2000), "white")
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    out, size = process_image(buf.getvalue())
    assert max(size) == 1024
    assert not Image.open(io.BytesIO(out)).getexif()


def test_nearest_open_skips_closed_and_sorts():
    reports = seed_reports()
    near = nearest_open(reports.values(), 5.7119, 100.4484, k=2)
    assert near[0]["id"] == "r-001" and len(near) == 2
