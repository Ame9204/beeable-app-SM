"""The intake JSON schema (see CLAUDE.md > AI report intake). LLM output must validate against this."""

from typing import Literal

from pydantic import BaseModel

from config import BARRIER_CATEGORIES

Category = Literal[BARRIER_CATEGORIES]  # type: ignore[valid-type]
Level = Literal["low", "medium", "high"]
AISource = Literal["live", "cached", "fallback", "simulated"]


class AISuggestion(BaseModel):
    """A suggestion only — never sets report status."""

    is_accessibility_barrier: bool
    category: Category
    severity: Level
    affects: list[Literal["wheelchair", "stroller", "elderly", "low_vision"]]
    summary_en: str
    language_detected: Literal["ms", "en", "zh", "ta"]
    possible_duplicate_of: str | None = None
    privacy_flag: bool = False
    confidence: Level
    reason: str
