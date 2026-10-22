from types import SimpleNamespace

from intake.confirm import ai_confirms
from intake.service import fallback_suggestion

CLEAR = fallback_suggestion("").model_copy(update={"category": "high_kerb", "confidence": "high"})


def test_clear_live_barrier_is_confirmed():
    assert ai_confirms(CLEAR, "live", [])
    assert ai_confirms(CLEAR, "cached", [])


def test_doubtful_reports_go_to_staff():
    assert not ai_confirms(CLEAR, "fallback", [])
    assert not ai_confirms(CLEAR.model_copy(update={"confidence": "low"}), "live", [])
    assert not ai_confirms(CLEAR.model_copy(update={"category": "not_a_barrier"}), "live", [])
    assert not ai_confirms(CLEAR.model_copy(update={"is_accessibility_barrier": False}), "live", [])
    assert not ai_confirms(CLEAR.model_copy(update={"privacy_flag": True}), "live", [])
    assert not ai_confirms(CLEAR.model_copy(update={"possible_duplicate_of": "r-001"}), "live", [])
    assert not ai_confirms(CLEAR, "live", [SimpleNamespace(match="likely")])
    assert ai_confirms(CLEAR, "live", [SimpleNamespace(match="possible")])


def test_non_barriers_are_auto_rejected():
    from intake.confirm import ai_rejects

    assert ai_rejects(CLEAR.model_copy(update={"category": "not_a_barrier"}), "live")
    assert ai_rejects(CLEAR.model_copy(update={"is_accessibility_barrier": False}), "cached")
    assert not ai_rejects(CLEAR, "live")
    assert not ai_rejects(CLEAR.model_copy(update={"category": "not_a_barrier"}), "fallback")
