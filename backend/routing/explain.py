"""Plain-language "Why this route?" lines, in English or Malay.

Built from the same penalties used for cost, but worded for residents: what is on the way and how much
longer it is, never scores or penalty weights.
"""

from dataclasses import dataclass, field

from config import WALK_SPEED_MPS, Language, Profile
from routing.weights import Penalty

PROFILE_LABEL = {
    "en": {"step_free": "step-free travel", "easy_walking": "easy walking"},
    "ms": {"step_free": "perjalanan tanpa tangga", "easy_walking": "jalan mudah"},
}

TEXT = {
    "en": {
        "and": " and ",
        "least_bad": "Every way there has something that's hard for {who}. This route is the best option, but it has {d}.",
        "same": "This is the shortest way, and the best one for {who}.",
        "blocked": "The shortest way ({m} m) has {d}, so we take you around it.",
        "avoid": "The shortest way ({m} m) has {d}, so this route avoids it.",
        "harder": "The shortest way ({m} m) is harder going for {who}, so this route takes an easier way.",
        "longer": "This route is {m} m — {x} m longer, about {n} min more.",
        "length": "This route is {m} m.",
        "still": "Heads up: this route still has {listed}.",
        "unknown_all": "We haven't checked this route in person yet, so there might be things we don't know about.",
        "unknown": "We haven't checked {s}% of this route in person yet, so there might be things we don't know about.",
        "alt_longer": "This way is {m} m — {x} m longer than the BeeAble route, about {n} min more.",
        "alt_shorter": "This way is {m} m — {x} m shorter than the BeeAble route, but harder going for {who}.",
        "alt_more": "It has more known problems than the BeeAble route.",
        "passes": "Heads up: it has {d}.",
    },
    "ms": {
        "and": " dan ",
        "least_bad": "Setiap laluan ke sana ada sesuatu yang sukar untuk {who}. Laluan ini pilihan terbaik, tetapi ia ada {d}.",
        "same": "Ini laluan terpendek, dan yang terbaik untuk {who}.",
        "blocked": "Laluan terpendek ({m} m) ada {d}, jadi kami bawa anda mengelaknya.",
        "avoid": "Laluan terpendek ({m} m) ada {d}, jadi laluan ini mengelaknya.",
        "harder": "Laluan terpendek ({m} m) lebih sukar untuk {who}, jadi laluan ini mengambil jalan yang lebih mudah.",
        "longer": "Laluan ini {m} m — {x} m lebih panjang, kira-kira {n} min lagi.",
        "length": "Laluan ini {m} m.",
        "still": "Perhatian: laluan ini masih ada {listed}.",
        "unknown_all": "Kami belum menyemak laluan ini secara langsung, jadi mungkin ada perkara yang kami belum tahu.",
        "unknown": "Kami belum menyemak {s}% laluan ini secara langsung, jadi mungkin ada perkara yang kami belum tahu.",
        "alt_longer": "Laluan ini {m} m — {x} m lebih panjang daripada laluan BeeAble, kira-kira {n} min lagi.",
        "alt_shorter": "Laluan ini {m} m — {x} m lebih pendek daripada laluan BeeAble, tetapi lebih sukar untuk {who}.",
        "alt_more": "Ia ada lebih banyak masalah yang diketahui berbanding laluan BeeAble.",
        "passes": "Perhatian: ia ada {d}.",
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


def _listed(penalties: list[Penalty], lang: Language, limit: int = 3) -> str:
    """"steps with no ramp and a very steep slope": each kind once, in path order."""
    labels = list(dict.fromkeys(p.label_in(lang) for p in penalties))[:limit]
    return labels[0] if len(labels) == 1 else ", ".join(labels[:-1]) + TEXT[lang]["and"] + labels[-1]


def _minutes(m: float) -> int:
    return max(1, round(m / WALK_SPEED_MPS / 60))


def _conditions(path: PathSummary, lang: Language) -> list[str]:
    """Problems still on the path, and how much of it nobody has checked in person."""
    t = TEXT[lang]
    lines: list[str] = []
    remaining = [p for p, _ in path.barriers if p.value is not None]
    if remaining:
        lines.append(t["still"].format(listed=_listed(remaining, lang)))
    if path.length_m and path.unknown_m:
        share = round(100 * path.unknown_m / path.length_m)
        lines.append(t["unknown_all"] if share >= 100 else t["unknown"].format(s=share))
    return lines


def explain(
    shortest: PathSummary, best: PathSummary, profile: Profile, least_bad: bool, lang: Language = "en"
) -> list[str]:
    t, who = TEXT[lang], PROFILE_LABEL[lang][profile]
    lines: list[str] = []
    same = shortest.edge_ids == best.edge_ids
    m = f"{shortest.length_m:.0f}"

    if least_bad:
        lines.append(t["least_bad"].format(who=who, d=_listed([p for p, _ in best.blocking], lang)))
    elif same:
        lines.append(t["same"].format(who=who))
    elif shortest.blocking:
        lines.append(t["blocked"].format(m=m, d=_listed([p for p, _ in shortest.blocking], lang)))
    else:
        # The worst thing on the shortest way is what this route avoids.
        worst = max(shortest.barriers, key=lambda pm: (pm[0].value or 0) * pm[1], default=None)
        lines.append(t["avoid"].format(m=m, d=worst[0].label_in(lang)) if worst else t["harder"].format(m=m, who=who))

    if not same:
        extra = best.length_m - shortest.length_m
        lines.append(
            t["longer"].format(m=f"{best.length_m:.0f}", x=f"{extra:.0f}", n=_minutes(extra))
            if extra > 0
            else t["length"].format(m=f"{best.length_m:.0f}")
        )
    return lines + _conditions(best, lang)


def explain_alternative(best: PathSummary, alt: PathSummary, profile: Profile, lang: Language = "en") -> list[str]:
    """How the alternative compares with the recommended (BeeAble) route."""
    t, who = TEXT[lang], PROFILE_LABEL[lang][profile]
    diff = alt.length_m - best.length_m
    m = f"{alt.length_m:.0f}"
    if diff > 0:
        lines = [t["alt_longer"].format(m=m, x=f"{diff:.0f}", n=_minutes(diff))]
    elif diff < 0:
        lines = [t["alt_shorter"].format(m=m, x=f"{-diff:.0f}", who=who)]
    else:
        lines = [t["length"].format(m=m)]
    if alt.blocking:
        lines.append(t["passes"].format(d=_listed([p for p, _ in alt.blocking], lang)))
    elif len(alt.barriers) > len(best.barriers) and diff >= 0:
        lines.append(t["alt_more"])
    return lines + _conditions(alt, lang)
