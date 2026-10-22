"""Whether the AI may confirm a new report on its own, without a staff Verify step."""

from typing import Iterable

from config import AI_CONFIRM_CONFIDENCE
from intake.schema import AISource, AISuggestion


def ai_confirms(ai: AISuggestion, ai_source: AISource, similar: Iterable) -> bool:
    """A clear barrier from a real AI answer. Doubtful, private or possibly duplicate reports go to staff."""
    return (
        ai_source in ("live", "cached")
        and ai.is_accessibility_barrier
        and ai.category != "not_a_barrier"
        and ai.confidence in AI_CONFIRM_CONFIDENCE
        and not ai.privacy_flag
        and ai.possible_duplicate_of is None
        and not any(m.match == "likely" for m in similar)
    )
