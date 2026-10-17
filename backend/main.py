"""BeeAble API. Endpoints follow the agreed contract in CLAUDE.md. /route and priority inputs are still mocked."""

import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import UnidentifiedImageError
from pydantic import ValidationError

import mock_data
import store
from config import (
    CORS_ORIGINS, SEVERITY_SCORE, STORE_PATH, UPLOAD_DIR, UPLOAD_MAX_BYTES, Profile, ReportStatus,
)
from intake.images import process_image
from intake.service import nearest_open, run_intake
from priority.score import priority_score
from schemas import AISuggestion, Priority, Report, ReportCreate, ReportPatch, RouteResponse, ScoreBreakdown

app = FastAPI(title="BeeAble API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=UPLOAD_DIR), name="photos")

# In-memory, saved to a JSON file on every write, until Supabase is wired up.
# DECISIONS logs each staff decision next to the AI suggestion (agreement-rate metric).
REPORTS, DECISIONS = store.load(STORE_PATH, mock_data.seed_reports())

PHOTO_NAME = re.compile(r"^[0-9a-f]{32}\.jpg$")


def _persist() -> None:
    store.save(STORE_PATH, REPORTS, DECISIONS)


def _local_photo(photo_url: str | None) -> bytes | None:
    """Bytes of a photo we stored via /uploads; None for anything else (never fetch remote URLs)."""
    if not photo_url:
        return None
    path = urlparse(photo_url).path
    name = path.removeprefix("/photos/")
    if path.startswith("/photos/") and PHOTO_NAME.match(name):
        file = UPLOAD_DIR / name
        if file.exists():
            return file.read_bytes()
    return None


def _parse_latlng(value: str, name: str) -> tuple[float, float]:
    try:
        lat, lng = (float(x) for x in value.split(","))
    except ValueError:
        raise HTTPException(422, f"`{name}` must be 'lat,lng'")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(422, f"`{name}` out of range")
    return lat, lng


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/route", response_model=RouteResponse)
def get_route(
    from_: str = Query(..., alias="from", description="lat,lng"),
    to: str = Query(..., description="lat,lng"),
    profile: Profile = "step_free",
) -> dict:
    return mock_data.mock_route(_parse_latlng(from_, "from"), _parse_latlng(to, "to"), profile)


@app.post("/uploads")
async def upload_photo(file: UploadFile, request: Request) -> dict:
    data = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(data) > UPLOAD_MAX_BYTES:
        raise HTTPException(413, "photo too large (max 10 MB)")
    try:
        jpeg, _ = process_image(data)  # resized, EXIF stripped
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "not an image")
    name = f"{uuid.uuid4().hex}.jpg"
    (UPLOAD_DIR / name).write_bytes(jpeg)
    return {"photo_url": str(request.url_for("photos", path=name))}


@app.post("/reports", response_model=Report, status_code=201)
def create_report(body: ReportCreate) -> Report:
    ai, ai_source = run_intake(
        image=_local_photo(body.photo_url),
        text=body.text,
        lat=body.lat,
        lng=body.lng,
        nearby=nearest_open(REPORTS.values(), body.lat, body.lng),
    )
    rid = f"r-{uuid.uuid4().hex[:8]}"
    report = Report(
        id=rid,
        reference_number=f"BEE-{rid[2:].upper()}",
        lat=body.lat,
        lng=body.lng,
        photo_url=body.photo_url,
        original_text=body.text,
        language=ai.language_detected,
        ai=ai,
        ai_source=ai_source,
        status="unverified",  # AI output never verifies
        created_at=datetime.now(timezone.utc),
    )
    REPORTS[rid] = report
    _persist()
    return report


@app.get("/reports", response_model=list[Report])
def list_reports(status: ReportStatus | None = None) -> list[Report]:
    return [r for r in REPORTS.values() if status is None or r.status == status]


@app.patch("/reports/{report_id}", response_model=Report)
def update_report(report_id: str, body: ReportPatch) -> Report:
    report = REPORTS.get(report_id)
    if report is None:
        raise HTTPException(404, "report not found")
    now = datetime.now(timezone.utc)
    updates: dict = {"status": body.status}
    if body.status == "verified":
        updates["verified_at"] = now
    elif body.status == "resolved":
        updates["resolved_at"] = now
    if body.edits:
        try:
            updates["ai"] = AISuggestion.model_validate({**report.ai.model_dump(), **body.edits})
        except ValidationError as exc:
            raise HTTPException(422, f"invalid edits: {exc.errors()[0]['msg']}")
    DECISIONS.append({
        "report_id": report_id,
        "ai": report.ai.model_dump(),
        "decision": body.status,
        "edits": body.edits,
        "at": now.isoformat(),
    })
    REPORTS[report_id] = report.model_copy(update=updates)
    _persist()
    return REPORTS[report_id]


@app.get("/priorities", response_model=list[Priority])
def list_priorities() -> list[Priority]:
    scored: list[tuple[float, Report, ScoreBreakdown]] = []
    for r in REPORTS.values():
        if r.status not in ("verified", "in_progress"):
            continue
        crit, poi, count = mock_data.MOCK_PRIORITY_INPUTS.get(r.id, (0.0, 0, 1))
        breakdown = ScoreBreakdown(
            severity=SEVERITY_SCORE[r.ai.severity],
            route_criticality=crit,
            poi_proximity=poi,
            report_count=count,
        )
        scored.append((priority_score(r.ai.severity, crit, poi, count), r, breakdown))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        Priority(rank=i, report=r, score=round(s, 2), breakdown=b)
        for i, (s, r, b) in enumerate(scored, start=1)
    ]
