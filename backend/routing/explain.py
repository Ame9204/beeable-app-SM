"""Plain-language "Why this route?" lines, built from the same penalties used for cost."""

from dataclasses import dataclass, field

from config import ROUTING_PENALTIES, WALK_SPEED_MPS, Profile
from routing.weights import Penalty

PROFILE_LABEL = {"step_free": "step-free", "easy_walking": "easy walking"}


@dataclass
class PathSummary:
    edge_ids: list[str]
    length_m: float
    cost: float | None  # None = passes an impassable edge for this profile
    unknown_m: float = 0.0
    # (penalty, metres affected) for known barriers, in path order
    barriers: list[tuple[Penalty, float]] = field(default_factory=list)

    @property
    def blocking(self) -> list[tuple[Penalty, float]]:
        return [(p, m) for p, m in self.barriers if p.value is None]


def _describe(p: Penalty, metres: float) -> str:
    weight = "impassable" if p.value is None else f"penalty +{p.value:g}"
    return f"{p.label} over {metres:.0f} m ({weight})"


def _minutes(m: float) -> int:
    return max(1, round(m / WALK_SPEED_MPS / 60))


def explain(shortest: PathSummary, best: PathSummary, profile: Profile, least_bad: bool) -> list[str]:
    who = PROFILE_LABEL[profile]
    lines: list[str] = []
    same = shortest.edge_ids == best.edge_ids

    if least_bad:
        p, m = best.blocking[0]
        lines.append(
            f"No route avoids every hard barrier for {who}. This is the least-bad option: "
            f"it passes {_describe(p, m)}."
        )
    elif same:
        lines.append(f"The shortest route ({shortest.length_m:.0f} m) is also the best option for {who}.")
    elif shortest.blocking:
        p, m = shortest.blocking[0]
        lines.append(f"The shortest route ({shortest.length_m:.0f} m) has {_describe(p, m)} for {who}, so it is avoided.")
    else:
        worst = max(shortest.barriers, key=lambda pm: (pm[0].value or 0) * pm[1], default=None)
        reason = f" because of {_describe(*worst)}" if worst else ""
        lines.append(
            f"The shortest route ({shortest.length_m:.0f} m) scores {shortest.cost:.0f} for {who}{reason}; "
            f"this route scores {best.cost:.0f}."
        )

    if not same:
        extra = best.length_m - shortest.length_m
        lines.append(
            f"This route is {best.length_m:.0f} m — {extra:.0f} m longer, about {_minutes(extra)} min more."
            if extra > 0
            else f"This route is {best.length_m:.0f} m."
        )

    remaining = [(p, m) for p, m in best.barriers if p.value is not None]
    if remaining:
        listed = "; ".join(_describe(p, m) for p, m in remaining[:3])
        lines.append(f"It still passes {listed}.")

    if best.length_m and best.unknown_m:
        share = round(100 * best.unknown_m / best.length_m)
        lines.append(
            f"{share}% of this route has no data yet on steps or slope "
            f"(penalty +{ROUTING_PENALTIES[profile]['attribute_unknown']:g}), so conditions there are unknown."
        )
    return lines
