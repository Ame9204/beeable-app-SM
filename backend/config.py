"""Single source of truth for backend tunables: weights, categories, thresholds.

Numbers are team choices, not standards (see CLAUDE.md > Routing logic).
"""

import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")  # backend/.env, then repo-root .env; real env vars win
load_dotenv(Path(__file__).parent.parent / ".env")

Profile = Literal["step_free", "easy_walking"]
ReportStatus = Literal["unverified", "verified", "rejected", "in_progress", "resolved"]
DataSource = Literal["surveyed", "imported", "reported", "simulated"]

PROFILES: tuple[Profile, ...] = ("step_free", "easy_walking")

# Penalties added inside cost = length_m * (1 + Σ penalties). None = impassable.
ROUTING_PENALTIES: dict[Profile, dict[str, float | None]] = {
    "step_free": {
        "verified_steps": None,
        "open_unverified_report": 3.0,
        "slope_5_8": 1.5,
        "slope_over_8": None,
        "no_shade": 0.0,
        "attribute_unknown": 0.5,
        # Beyond the CLAUDE.md table — team to confirm:
        "unverified_steps": 3.0,  # steps tagged in OSM/survey but not yet verified
        "verified_kerb_barrier": None,  # verified high_kerb / missing_ramp report
        "verified_other_barrier": 2.0,  # any other verified barrier report
    },
    "easy_walking": {
        "verified_steps": 2.0,
        "open_unverified_report": 1.0,
        "slope_5_8": 1.0,
        "slope_over_8": 2.0,
        "no_shade": 0.3,
        "attribute_unknown": 0.5,
        "unverified_steps": 1.0,
        "verified_kerb_barrier": 1.0,
        "verified_other_barrier": 1.0,
    },
}

# Which penalty a *verified* report applies to its edge. Unverified reports always use
# "open_unverified_report"; not_a_barrier, rejected and resolved reports have no effect.
VERIFIED_REPORT_PENALTY = {
    "steps_no_ramp": "verified_steps",
    "steep_slope": "slope_over_8",
    "high_kerb": "verified_kerb_barrier",
    "missing_ramp": "verified_kerb_barrier",
}
LEAST_BAD_MULTIPLIER = 100  # impassable edges cost this × length when no route avoids them

BARRIER_CATEGORIES = (
    "steps_no_ramp",
    "high_kerb",
    "damaged_kerb",
    "missing_ramp",
    "broken_paving",
    "obstruction",
    "steep_slope",
    "no_crossing",
    "other",
    "not_a_barrier",
)

SEVERITY_SCORE = {"low": 1, "medium": 2, "high": 3}
POI_PROXIMITY_M = 100
POI_PRIORITY_TYPES = ("clinic", "bus_stop", "school", "mosque_surau")
# Demo destinations on the UiTM Kedah campus (same as frontend/src/config.ts), source: simulated.
POIS = (
    {"id": "clinic", "name": "Unit Kesihatan", "type": "clinic", "lat": 5.709855420465538, "lng": 100.44663876053161},
    {"id": "surau", "name": "Pusat Islam", "type": "mosque_surau", "lat": 5.710421138824264, "lng": 100.44729553127485},
    {"id": "bus", "name": "Depo Bas", "type": "bus_stop", "lat": 5.7131192808178195, "lng": 100.4492427039137},
)
# "Possibly the same problem": open reports close in place and time, with the same or a related type.
# Team choices, not standards. "likely" needs all three to be tight; "possible" is a looser match.
SIMILAR_RADIUS_M = 50
SIMILAR_WINDOW_DAYS = 14
SIMILAR_LIKELY_RADIUS_M = 25
SIMILAR_LIKELY_WINDOW_DAYS = 7
# Types a resident (or the AI) could easily mix up for the same barrier.
RELATED_CATEGORIES = (
    {"high_kerb", "damaged_kerb", "missing_ramp"},
    {"steps_no_ramp", "missing_ramp"},
    {"broken_paving", "damaged_kerb"},
)
CRITICALITY_SAMPLE_NODES = 25  # random graph nodes (seeded) added to POIs for O–D sampling

# Pilot site centre (lat, lng): UiTM Kedah campus, Merbok. Keep in sync with frontend/src/config.ts.
PRECINCT_CENTER = (5.714050829302482, 100.45039616486677)

# https://localhost is the Android app (Capacitor WebView); :5173 is the Vite dev server.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://localhost,http://localhost:5173").split(",")
# Plus the local dashboard on any port (Vite moves to 5174+ when 5173 is busy). Local-only origins.
CORS_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"

# Paths
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", DATA_DIR / "uploads"))
STORE_PATH = Path(os.getenv("STORE_PATH", DATA_DIR / "runtime" / "store.json"))
DEMO_PHOTO_PATH = DATA_DIR / "processed" / "demo_photo.jpg"
DEMO_INTAKE_PATH = DATA_DIR / "processed" / "demo_intake.json"
GRAPH_PATH = DATA_DIR / "processed" / "campus_walk.json"
EDGE_OVERRIDES_PATH = DATA_DIR / "processed" / "edge_overrides.json"
# Named campus places for the destination search (built by routing.build_places, bundled by the front end).
PLACES_PATH = DATA_DIR / "processed" / "places.json"

# Routing
GRAPH_RADIUS_M = 700  # walk network downloaded around PRECINCT_CENTER
MAX_SNAP_M = 300  # from/to further than this from any path → 422
WALK_SPEED_MPS = 1.0  # conservative (wheelchair / elderly) for "about N min" in explanations

# AI intake
INTAKE_PROVIDER = os.getenv("INTAKE_PROVIDER", "gemini")  # gemini | cached | none
INTAKE_MODEL = os.getenv("INTAKE_MODEL", "gemini-3.8-flash")  # 2.5 Flash is closed to new API keys
INTAKE_TIMEOUT_S = float(os.getenv("INTAKE_TIMEOUT_S", "20"))  # per attempt; Gemini rejects deadlines under 10 s
# How long the model "thinks" before answering. 3.8 Flash defaults to medium, which made intake time out (504).
# Supported: low | medium | high ("minimal" is rejected by 3.8 Flash). Empty = model default.
INTAKE_THINKING_LEVEL = os.getenv("INTAKE_THINKING_LEVEL", "low")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Uploads
UPLOAD_MAX_PX = 1024
UPLOAD_MAX_BYTES = 10 * 1024 * 1024
