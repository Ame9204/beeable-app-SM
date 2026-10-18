"""Report intake: one LLM call, validated against the schema, retried once, with cached/fallback paths."""

import hashlib
import json
import logging
import math
from datetime import datetime, timezone
from functools import lru_cache
from typing import Iterable

from pydantic import ValidationError

from config import DEMO_INTAKE_PATH, DEMO_PHOTO_PATH
from intake.images import process_image
from intake.prompt import build_user_message
from intake.providers import CachedProvider, Provider, get_provider
from intake.schema import AISource, AISuggestion

log = logging.getLogger("beeable.intake")

OPEN_STATUSES = ("unverified", "verified", "in_progress")
# Last intake problem, shown on /health so a failing deployment is easy to diagnose (never contains the key).
LAST_ERROR: dict[str, str] | None = None


def _record_error(reason: str) -> None:
    global LAST_ERROR
    LAST_ERROR = {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "reason": reason[:300]}
    log.warning("intake fallback: %s", reason)
MALAY_HINTS = (
    "rosak", "jalan", "tangga", "tiada", "kaki lima", "tak ", "boleh", "susah", "pecah",
    "tinggi", "laluan", "longkang", "kerusi roda", "curam", "halang", "lubang",
)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_open(reports: Iterable, lat: float, lng: float, k: int = 3) -> list[dict]:
    """Nearest k open reports as [{id, category, distance_m}], for duplicate detection."""
    scored = [
        {"id": r.id, "category": r.ai.category, "distance_m": haversine_m(lat, lng, r.lat, r.lng)}
        for r in reports
        if r.status in OPEN_STATUSES
    ]
    return sorted(scored, key=lambda n: n["distance_m"])[:k]


def guess_language(text: str) -> str:
    """Crude fallback only; the LLM detects language on the live path."""
    t = text.lower()
    if any("一" <= ch <= "鿿" for ch in t):
        return "zh"
    if any("஀" <= ch <= "௿" for ch in t):
        return "ta"
    if any(w in t for w in MALAY_HINTS):
        return "ms"
    return "en"


def fallback_suggestion(text: str) -> AISuggestion:
    """Used when the AI is unavailable. Low confidence puts it at the top of the staff queue."""
    return AISuggestion(
        is_accessibility_barrier=True,
        category="other",
        severity="medium",
        affects=[],
        summary_en=text.strip()[:200] or "Report received without automatic classification.",
        language_detected=guess_language(text),  # type: ignore[arg-type]
        confidence="low",
        reason="Automatic classification unavailable; staff to categorise.",
    )


@lru_cache(maxsize=1)
def demo_photo_hash() -> str | None:
    if not DEMO_PHOTO_PATH.exists():
        return None
    processed, _ = process_image(DEMO_PHOTO_PATH.read_bytes())
    return hashlib.sha256(processed).hexdigest()


def is_demo_photo(image: bytes | None) -> bool:
    return bool(image) and DEMO_INTAKE_PATH.exists() and hashlib.sha256(image).hexdigest() == demo_photo_hash()


def _parse(raw: str) -> AISuggestion:
    raw = raw.strip()
    if raw.startswith("```"):  # tolerate a fenced reply
        raw = raw.strip("`").removeprefix("json").strip()
    return AISuggestion.model_validate(json.loads(raw))


def run_intake(
    *,
    image: bytes | None,
    text: str,
    lat: float,
    lng: float,
    nearby: list[dict],
    provider: Provider | None = None,
    mime: str = "image/jpeg",
) -> tuple[AISuggestion, AISource]:
    """Returns (suggestion, ai_source). Never raises for model problems."""
    source: AISource = "live"
    if is_demo_photo(image):
        provider, source = CachedProvider(), "cached"
    elif provider is None:
        provider = get_provider()
        if isinstance(provider, CachedProvider):
            source = "cached"
    if provider is None:
        _record_error("no AI provider configured (INTAKE_PROVIDER / GEMINI_API_KEY not set on the server)")
        return fallback_suggestion(text), "fallback"

    prompt = build_user_message(text, lat, lng, nearby)
    for attempt in (1, 2):  # validate; retry once on invalid output
        try:
            raw = provider.suggest(image, mime, prompt)
        except Exception as exc:  # timeout, auth, quota: don't retry, so the resident isn't kept waiting
            _record_error(f"{provider.name} call failed: {type(exc).__name__}: {exc}")
            break
        try:
            suggestion = _parse(raw)
        except (json.JSONDecodeError, ValidationError) as exc:
            _record_error(f"{provider.name} attempt {attempt} returned invalid JSON: {exc}")
            continue
        if suggestion.possible_duplicate_of not in {n["id"] for n in nearby}:
            suggestion.possible_duplicate_of = None  # never trust an id we didn't send
        return suggestion, source
    return fallback_suggestion(text), "fallback"
