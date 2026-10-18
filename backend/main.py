"""BeeAble API. Endpoints follow the agreed contract in CLAUDE.md."""

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
    CORS_ORIGINS, GEMINI_API_KEY, INTAKE_MODEL, INTAKE_PROVIDER, SEVERITY_SCORE, STORE_PATH, UPLOAD_DIR,
    UPLOAD_MAX_BYTES, Profile, ReportStatus,
)
from intake.images import process_image
from intake.service import nearest_open, run_intake
from priority.inputs import poi_proximity
from priority.score import priority_score
from routing.router import CampusGraph, OffNetworkError
from routing.weights import ReportEffect
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

# Campus walk graph (built offline by `python -m routing.build_graph`). Reports are snapped to edges.
CAMPUS = CampusGraph.load()
for _rid, _r in REPORTS.items():
    if _r.edge_id is None:
        REPORTS[_rid] = _r.model_copy(update={"edge_id": CAMPUS.nearest_edge(_r.lat, _r.lng)[0]})

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
    # graph info makes it easy to tell which backend version a deployment is running
    from intake import service as intake_service  # LAST_ERROR changes at runtime

    return {
        "ok": True,
        "routing": "campus_graph",
        "graph_edges": len(CAMPUS.edges),
        "built_at": CAMPUS.meta["built_at"],
        "intake": {
            "provider": INTAKE_PROVIDER,
            "model": INTAKE_MODEL,
            "key_set": bool(GEMINI_API_KEY),
            "last_error": intake_service.LAST_ERROR,
        },
    }


@app.get("/route", response_model=RouteResponse)
def get_route(
    from_: str = Query(..., alias="from", description="lat,lng"),
    to: str = Query(..., description="lat,lng"),
    profile: Profile = "step_free",
) -> dict:
    try:
        return CAMPUS.route(_parse_latlng(from_, "from"), _parse_latlng(to, "to"), profile, _report_effects())
    except OffNetworkError as exc:
        raise HTTPException(422, str(exc))


def _report_effects() -> dict[str, tuple[ReportEffect, ...]]:
    """Open reports per edge. Unverified = soft penalty; verified/in progress = full effect;
    rejected/resolved = none, so resolving a report changes the next route."""
    effects: dict[str, list[ReportEffect]] = {}
    for r in REPORTS.values():
        if r.edge_id and r.status in ("unverified", "verified", "in_progress") and r.ai.is_accessibility_barrier:
            effects.setdefault(r.edge_id, []).append(
                ReportEffect(r.id, r.ai.category, verified=r.status != "unverified")
            )
    return {k: tuple(v) for k, v in effects.items()}


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
        edge_id=CAMPUS.nearest_edge(body.lat, body.lng)[0],
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
    open_reports = [r for r in REPORTS.values() if r.status not in ("rejected", "resolved")]
    scored: list[tuple[float, Report, ScoreBreakdown]] = []
    for r in open_reports:
        if r.status not in ("verified", "in_progress"):
            continue
        breakdown = ScoreBreakdown(
            severity=SEVERITY_SCORE[r.ai.severity],
            route_criticality=CAMPUS.criticality.get(r.edge_id or "", 0.0),
            poi_proximity=poi_proximity(r.lat, r.lng),
            report_count=max(1, sum(1 for o in open_reports if o.edge_id and o.edge_id == r.edge_id)),
        )
        b = breakdown
        scored.append((priority_score(r.ai.severity, b.route_criticality, b.poi_proximity, b.report_count), r, b))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        Priority(rank=i, report=r, score=round(s, 2), breakdown=b)
        for i, (s, r, b) in enumerate(scored, start=1)
    ]
