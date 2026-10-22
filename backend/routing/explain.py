"""Plain-language "Why this route?" lines, built from the same penalties used for cost. English or Malay."""

from dataclasses import dataclass, field

from config import ROUTING_PENALTIES, WALK_SPEED_MPS, Language, Profile
from routing.weights import Penalty

PROFILE_LABEL = {
    "en": {"step_free": "step-free", "easy_walking": "easy walking"},
    "ms": {"step_free": "tanpa tangga", "easy_walking": "jalan mudah"},
}

TEXT = {
    "en": {
        "describe": "{label} over {m} m ({weight})",
        "impassable": "impassable",
        "penalty": "penalty +{v}",
        "least_bad": "No route avoids every hard barrier for {who}. This is the least-bad option: it passes {d}.",
        "same": "The shortest route ({m} m) is also the best option for {who}.",
        "blocked": "The shortest route ({m} m) has {d} for {who}, so it is avoided.",
        "because": " because of {d}",
        "scores": "The shortest route ({m} m) scores {c} for {who}{reason}; this route scores {c2}.",
        "longer": "This route is {m} m — {x} m longer, about {n} min more.",
        "length": "This route is {m} m.",
        "still": "It still passes {listed}.",
        "passes": "It passes {d}.",
        "unknown": "{s}% of this route has no data yet on steps or slope (penalty +{p}), so conditions there are unknown.",
        "alt_longer": "This alternative is {m} m — {x} m longer than the BeeAble route, about {n} min more.",
        "alt_shorter": "This alternative is {m} m — {x} m shorter than the BeeAble route.",
        "alt_scores": "It scores {c} for {who}; the BeeAble route scores {c2}.",
    },
    "ms": {
        "describe": "{label} sepanjang {m} m ({weight})",
        "impassable": "tidak boleh dilalui",
        "penalty": "penalti +{v}",
        "least_bad": "Tiada laluan yang mengelak semua halangan utama untuk profil {who}. "
        "Ini pilihan paling kurang buruk: ia melalui {d}.",
        "same": "Laluan terpendek ({m} m) juga pilihan terbaik untuk profil {who}.",
        "blocked": "Laluan terpendek ({m} m) ada {d} untuk profil {who}, jadi ia dielakkan.",
        "because": " kerana {d}",
        "scores": "Laluan terpendek ({m} m) mendapat skor {c} untuk profil {who}{reason}; laluan ini mendapat skor {c2}.",
        "longer": "Laluan ini {m} m — {x} m lebih panjang, kira-kira {n} min lagi.",
        "length": "Laluan ini {m} m.",
        "still": "Ia masih melalui {listed}.",
        "passes": "Ia melalui {d}.",
        "unknown": "{s}% laluan ini belum ada data tentang tangga atau cerun (penalti +{p}), "
        "jadi keadaannya tidak diketahui.",
        "alt_longer": "Laluan alternatif ini {m} m — {x} m lebih panjang daripada laluan BeeAble, kira-kira {n} min lagi.",
        "alt_shorter": "Laluan alternatif ini {m} m — {x} m lebih pendek daripada laluan BeeAble.",
        "alt_scores": "Skornya {c} untuk profil {who}; laluan BeeAble mendapat skor {c2}.",
    },
}


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


def _describe(p: Penalty, metres: float, lang: Language = "en") -> str:
    t = TEXT[lang]
    weight = t["impassable"] if p.value is None else t["penalty"].format(v=f"{p.value:g}")
    return t["describe"].format(label=p.label_in(lang), m=f"{metres:.0f}", weight=weight)


def _minutes(m: float) -> int:
    return max(1, round(m / WALK_SPEED_MPS / 60))


def _conditions(path: PathSummary, profile: Profile, lang: Language) -> list[str]:
    """Soft barriers still on the path, and how much of it is unsurveyed."""
    t = TEXT[lang]
    lines: list[str] = []
    remaining = [(p, m) for p, m in path.barriers if p.value is not None]
    if remaining:
        lines.append(t["still"].format(listed="; ".join(_describe(p, m, lang) for p, m in remaining[:3])))
    if path.length_m and path.unknown_m:
        share = round(100 * path.unknown_m / path.length_m)
        lines.append(t["unknown"].format(s=share, p=f"{ROUTING_PENALTIES[profile]['attribute_unknown']:g}"))
    return lines


def explain(
    shortest: PathSummary, best: PathSummary, profile: Profile, least_bad: bool, lang: Language = "en"
) -> list[str]:
    t, who = TEXT[lang], PROFILE_LABEL[lang][profile]
    lines: list[str] = []
    same = shortest.edge_ids == best.edge_ids
    m = f"{shortest.length_m:.0f}"

    if least_bad:
        lines.append(t["least_bad"].format(who=who, d=_describe(*best.blocking[0], lang)))
    elif same:
        lines.append(t["same"].format(m=m, who=who))
    elif shortest.blocking:
        lines.append(t["blocked"].format(m=m, d=_describe(*shortest.blocking[0], lang), who=who))
    else:
        worst = max(shortest.barriers, key=lambda pm: (pm[0].value or 0) * pm[1], default=None)
        reason = t["because"].format(d=_describe(*worst, lang)) if worst else ""
        lines.append(t["scores"].format(m=m, c=f"{shortest.cost:.0f}", who=who, reason=reason, c2=f"{best.cost:.0f}"))

    if not same:
        extra = best.length_m - shortest.length_m
        lines.append(
            t["longer"].format(m=f"{best.length_m:.0f}", x=f"{extra:.0f}", n=_minutes(extra))
            if extra > 0
            else t["length"].format(m=f"{best.length_m:.0f}")
        )
    return lines + _conditions(best, profile, lang)


def explain_alternative(best: PathSummary, alt: PathSummary, profile: Profile, lang: Language = "en") -> list[str]:
    """How the alternative compares with the recommended (BeeAble) route."""
    t, who = TEXT[lang], PROFILE_LABEL[lang][profile]
    diff = alt.length_m - best.length_m
    m = f"{alt.length_m:.0f}"
    lines = [
        t["alt_longer"].format(m=m, x=f"{diff:.0f}", n=_minutes(diff))
        if diff > 0
        else t["alt_shorter"].format(m=m, x=f"{-diff:.0f}")
        if diff < 0
        else t["length"].format(m=m)
    ]
    if alt.blocking:
        lines.append(t["passes"].format(d=_describe(*alt.blocking[0], lang)))
    elif alt.cost is not None and best.cost is not None:
        lines.append(t["alt_scores"].format(c=f"{alt.cost:.0f}", who=who, c2=f"{best.cost:.0f}"))
    return lines + _conditions(alt, profile, lang)
