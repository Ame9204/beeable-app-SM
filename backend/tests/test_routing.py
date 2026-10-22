import pytest

from config import ROUTING_PENALTIES
from routing.router import CampusGraph, OffNetworkError
from routing.weights import EdgeAttrs, ReportEffect, edge_cost

KNOWN = dict(has_steps=False, slope_pct=0.0, shade=True)  # fully known, no barriers


def cost(profile, reports=(), **attrs):
    return edge_cost(EdgeAttrs(length_m=100, **{**KNOWN, **attrs}), profile, tuple(reports))[0]


# --- one test per row of the CLAUDE.md cost table ----------------------------------------------
@pytest.mark.parametrize(
    "attrs, step_free, easy_walking",
    [
        (dict(has_steps=True, steps_verified=True), None, 300),  # verified steps
        (dict(slope_pct=6), 250, 200),  # slope 5–8 %
        (dict(slope_pct=9), None, 300),  # slope > 8 %
        (dict(shade=False), 100, 130),  # no shade
        (dict(slope_pct=None), 150, 150),  # attribute unknown
        (dict(has_steps=None), 150, 150),  # attribute unknown
    ],
)
def test_cost_table(attrs, step_free, easy_walking):
    assert cost("step_free", **attrs) == (None if step_free is None else pytest.approx(step_free))
    assert cost("easy_walking", **attrs) == (None if easy_walking is None else pytest.approx(easy_walking))


def test_open_unverified_report_is_soft():
    r = [ReportEffect("r", "broken_paving", verified=False)]
    assert cost("step_free", r) == pytest.approx(400)
    assert cost("easy_walking", r) == pytest.approx(200)


def test_verified_steps_report_is_hard_for_step_free_only():
    r = [ReportEffect("r", "steps_no_ramp", verified=True)]
    assert cost("step_free", r) is None
    assert cost("easy_walking", r) == pytest.approx(100 * (1 + ROUTING_PENALTIES["easy_walking"]["verified_steps"]))


def test_not_a_barrier_report_has_no_effect():
    assert cost("step_free", [ReportEffect("r", "not_a_barrier", verified=True)]) == pytest.approx(100)


def test_unknown_is_never_cheaper_than_known():
    assert cost("step_free", slope_pct=None) > cost("step_free")


# --- routing on the real campus graph ----------------------------------------------------------
CENTER = (5.714050829302482, 100.45039616486677)
CLINIC = (5.709855420465538, 100.44663876053161)
STEPS_EDGE = "3782986676-7694553553"  # on the shortest path to Unit Kesihatan


@pytest.fixture(scope="module")
def campus():
    return CampusGraph.load()


def edges_of(fc):
    return [f["properties"]["edge_id"] for f in fc["features"]]


def steps(verified=True):
    return {STEPS_EDGE: (ReportEffect("r-steps", "steps_no_ramp", verified=verified),)}


def test_step_free_avoids_verified_steps(campus):
    r = campus.route(CENTER, CLINIC, "step_free", steps())
    assert STEPS_EDGE in edges_of(r["shortest"])
    assert STEPS_EDGE not in edges_of(r["recommended"])
    assert r["costs"]["shortest"]["cost"] is None
    assert "steps with no ramp" in r["explanation"][0]


def test_easy_walking_route_differs_on_same_data(campus):
    sf = campus.route(CENTER, CLINIC, "step_free", steps())
    ew = campus.route(CENTER, CLINIC, "easy_walking", steps())
    assert edges_of(sf["recommended"]) != edges_of(ew["recommended"])


def test_resolving_the_report_reopens_the_path(campus):
    blocked = campus.route(CENTER, CLINIC, "step_free", steps())
    open_ = campus.route(CENTER, CLINIC, "step_free", {})
    assert STEPS_EDGE in edges_of(open_["recommended"])
    assert open_["costs"]["recommended"]["length_m"] < blocked["costs"]["recommended"]["length_m"]


def test_least_bad_route_names_the_barrier(campus):
    # Block the clinic's final edge, which has no alternative.
    last = edges_of(campus.route(CENTER, CLINIC, "step_free", {})["recommended"])[-1]
    effects = {last: (ReportEffect("r-door", "steps_no_ramp", verified=True),)}
    r = campus.route(CENTER, CLINIC, "step_free", effects)
    assert r["costs"]["recommended"]["least_bad"] is True
    assert r["costs"]["recommended"]["blocked_by"] == "steps with no ramp"
    assert "best option" in r["explanation"][0] and "steps with no ramp" in r["explanation"][0]


def test_explanation_numbers_match_costs(campus):
    r = campus.route(CENTER, CLINIC, "step_free", steps())
    sh, rec = r["costs"]["shortest"], r["costs"]["recommended"]
    assert f"{sh['length_m']} m" in r["explanation"][0]
    assert f"{rec['length_m']} m" in r["explanation"][1]
    assert f"{rec['length_m'] - sh['length_m']} m longer" in r["explanation"][1]


def test_geojson_segments_carry_source_labels(campus):
    r = campus.route(CENTER, CLINIC, "step_free", steps())
    props = [f["properties"] for f in r["recommended"]["features"]]
    assert {p["source"] for p in props} <= {"surveyed", "imported", "reported", "simulated"}
    assert all(p["surveyed"] == (p["source"] == "surveyed") for p in props)


def test_off_network_point_rejected(campus):
    with pytest.raises(OffNetworkError):
        campus.route((5.80, 100.50), CLINIC, "step_free", {})


def test_criticality_is_a_share(campus):
    crit = campus.criticality
    assert crit and all(0 < v <= 1 for v in crit.values())


def test_alternative_takes_a_different_way_and_obeys_the_profile(campus):
    r = campus.route(CENTER, CLINIC, "step_free", steps())
    alt = r["alternative"]
    assert alt is not None
    rec, other = set(edges_of(r["recommended"])), edges_of(alt["route"])
    assert set(other) != rec
    assert STEPS_EDGE not in other  # still never through a hard block
    rec_m, alt_m = r["costs"]["recommended"]["length_m"], alt["costs"]["length_m"]
    assert f"{alt_m} m" in alt["explanation"][0] and f"{abs(alt_m - rec_m)} m" in alt["explanation"][0]


def test_route_text_in_malay(campus):
    r = campus.route(CENTER, CLINIC, "step_free", steps(), lang="ms")
    assert "tangga tanpa ramp" in r["explanation"][0]
    assert r["costs"]["shortest"].get("blocked_by") is None or "tangga" in r["costs"]["shortest"]["blocked_by"]
    assert "laluan BeeAble" in r["alternative"]["explanation"][0]


def test_explanation_has_no_scores_or_penalties(campus):
    for profile in ("step_free", "easy_walking"):
        for lang in ("en", "ms"):
            r = campus.route(CENTER, CLINIC, profile, steps(), lang=lang)
            text = " ".join(r["explanation"] + (r["alternative"]["explanation"] if r["alternative"] else []))
            for word in ("score", "skor", "penalty", "penalti", "+0.", "impassable"):
                assert word not in text.lower(), (profile, lang, word, text)
