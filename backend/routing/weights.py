"""Edge cost: cost(e) = length_m * (1 + Σ penalties), or None when a hard constraint makes it impassable.

Pure functions only. Each penalty is returned with a label so explanations use the same numbers as the cost.
"""

from dataclasses import dataclass

from config import ROUTING_PENALTIES, VERIFIED_REPORT_PENALTY, DataSource, Language, Profile

LABELS = {
    "verified_steps": "steps with no ramp (verified)",
    "unverified_steps": "steps (not yet verified)",
    "open_unverified_report": "an unverified barrier report",
    "slope_5_8": "a 5–8% slope",
    "slope_over_8": "a slope steeper than 8%",
    "no_shade": "no shade",
    "attribute_unknown": "conditions not yet surveyed",
    "verified_kerb_barrier": "a high kerb or missing ramp (verified)",
    "verified_other_barrier": "a verified barrier",
}
LABELS_MS = {
    "verified_steps": "tangga tanpa ramp (disahkan)",
    "unverified_steps": "tangga (belum disahkan)",
    "open_unverified_report": "laporan halangan yang belum disahkan",
    "slope_5_8": "cerun 5–8%",
    "slope_over_8": "cerun lebih curam daripada 8%",
    "no_shade": "tiada teduhan",
    "attribute_unknown": "keadaan yang belum ditinjau",
    "verified_kerb_barrier": "kerb tinggi atau tiada ramp (disahkan)",
    "verified_other_barrier": "halangan yang disahkan",
}


@dataclass(frozen=True)
class EdgeAttrs:
    length_m: float
    has_steps: bool | None = None  # None = unknown
    steps_verified: bool = False
    slope_pct: float | None = None
    shade: bool | None = None
    source: DataSource = "imported"


@dataclass(frozen=True)
class ReportEffect:
    report_id: str
    category: str
    verified: bool  # verified / in_progress; unverified reports are soft


@dataclass(frozen=True)
class Penalty:
    key: str
    value: float | None  # None = impassable for this profile
    report_id: str | None = None

    @property
    def label(self) -> str:
        return LABELS[self.key]

    def label_in(self, lang: Language) -> str:
        return (LABELS_MS if lang == "ms" else LABELS)[self.key]

    @property
    def is_barrier(self) -> bool:
        """Known problems (everything except 'not surveyed' and zero-weight factors)."""
        return self.key != "attribute_unknown" and (self.value is None or self.value > 0)


def penalties(attrs: EdgeAttrs, profile: Profile, reports: tuple[ReportEffect, ...] = ()) -> list[Penalty]:
    table = ROUTING_PENALTIES[profile]
    out: list[Penalty] = []

    def add(key: str, report_id: str | None = None) -> None:
        out.append(Penalty(key, table[key], report_id))

    if attrs.has_steps:
        add("verified_steps" if attrs.steps_verified else "unverified_steps")
    if attrs.slope_pct is not None:
        if attrs.slope_pct > 8:
            add("slope_over_8")
        elif attrs.slope_pct >= 5:
            add("slope_5_8")
    if attrs.shade is False:
        add("no_shade")
    if attrs.has_steps is None or attrs.slope_pct is None:  # never treat unknown as safe
        add("attribute_unknown")
    for r in reports:
        if r.category == "not_a_barrier":
            continue
        if r.verified:
            add(VERIFIED_REPORT_PENALTY.get(r.category, "verified_other_barrier"), r.report_id)
        else:
            add("open_unverified_report", r.report_id)
    return out


def edge_cost(
    attrs: EdgeAttrs, profile: Profile, reports: tuple[ReportEffect, ...] = ()
) -> tuple[float | None, list[Penalty]]:
    ps = penalties(attrs, profile, reports)
    if any(p.value is None for p in ps):
        return None, ps
    return attrs.length_m * (1 + sum(p.value for p in ps)), ps  # type: ignore[misc]
