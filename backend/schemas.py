"""Pydantic models matching the agreed API contract in CLAUDE.md."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from config import ReportStatus
from intake.schema import AISource, AISuggestion  # noqa: F401  (re-exported)


class RouteResponse(BaseModel):
    shortest: dict[str, Any]  # GeoJSON FeatureCollection
    recommended: dict[str, Any]  # GeoJSON FeatureCollection
    costs: dict[str, Any]
    explanation: list[str]
    surveyed_share: float = Field(ge=0, le=1)
    alternative: "AlternativeRoute | None" = None


class AlternativeRoute(BaseModel):
    """Next-best route for the profile that takes a mostly different way; the user can pick it instead."""

    route: dict[str, Any]  # GeoJSON FeatureCollection
    costs: dict[str, Any]
    explanation: list[str]
    surveyed_share: float = Field(ge=0, le=1)


RouteResponse.model_rebuild()


class ReportCreate(BaseModel):
    photo_url: str | None = None
    text: str = ""  # optional when there is a photo
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    # From POST /reports/analyse: reuse that AI answer instead of calling the model again.
    analysis_id: str | None = None


class AnalyseRequest(BaseModel):
    photo_url: str
    text: str = ""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Analysis(BaseModel):
    """AI suggestion shown to the resident before they send. Still only a suggestion."""

    analysis_id: str
    ai: AISuggestion
    ai_source: AISource


class SimilarReport(BaseModel):
    """Another open report that may be the same barrier (see similar.py). A hint for staff, never automatic."""

    id: str
    reference_number: str
    match: Literal["likely", "possible"]
    distance_m: float
    hours_apart: float
    same_category: bool
    reason: str


class Report(BaseModel):
    id: str
    reference_number: str
    lat: float
    lng: float
    photo_url: str | None
    original_text: str
    language: str
    ai: AISuggestion
    ai_source: AISource = "live"  # live | cached | fallback | simulated (data-honesty label)
    status: ReportStatus
    edge_id: str | None = None
    source: Literal["reported", "simulated"] = "reported"
    created_at: datetime
    verified_at: datetime | None = None
    verified_by: Literal["ai", "staff"] | None = None  # who confirmed it (data-honesty label)
    rejected_by: Literal["ai", "staff"] | None = None  # "ai" = auto-rejected as not a barrier
    resolved_at: datetime | None = None
    # Computed when the report is returned; not stored.
    similar: list[SimilarReport] = []


class ReportPatch(BaseModel):
    status: Literal["verified", "rejected", "in_progress", "resolved"]
    edits: dict[str, Any] | None = None


class ScoreBreakdown(BaseModel):
    severity: int
    route_criticality: float
    poi_proximity: int
    report_count: int


class Priority(BaseModel):
    rank: int
    report: Report
    score: float
    breakdown: ScoreBreakdown
