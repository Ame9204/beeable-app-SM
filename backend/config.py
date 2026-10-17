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
    },
    "easy_walking": {
        "verified_steps": 2.0,
        "open_unverified_report": 1.0,
        "slope_5_8": 1.0,
        "slope_over_8": 2.0,
        "no_shade": 0.3,
        "attribute_unknown": 0.5,
    },
}

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

# Pilot site centre (lat, lng): UiTM Kedah campus, Merbok. Keep in sync with frontend/src/config.ts.
PRECINCT_CENTER = (5.714050829302482, 100.45039616486677)

# https://localhost is the Android app (Capacitor WebView); :5173 is the Vite dev server.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://localhost,http://localhost:5173").split(",")

# Paths
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", DATA_DIR / "uploads"))
STORE_PATH = Path(os.getenv("STORE_PATH", DATA_DIR / "runtime" / "store.json"))
DEMO_PHOTO_PATH = DATA_DIR / "processed" / "demo_photo.jpg"
DEMO_INTAKE_PATH = DATA_DIR / "processed" / "demo_intake.json"

# AI intake
INTAKE_PROVIDER = os.getenv("INTAKE_PROVIDER", "gemini")  # gemini | cached | none
INTAKE_MODEL = os.getenv("INTAKE_MODEL", "gemini-2.5-flash")
INTAKE_TIMEOUT_S = float(os.getenv("INTAKE_TIMEOUT_S", "8"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Uploads
UPLOAD_MAX_PX = 1024
UPLOAD_MAX_BYTES = 10 * 1024 * 1024
