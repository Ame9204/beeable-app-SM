"""Campus walk graph + routing. Loads the JSON built by routing.build_graph; needs only networkx."""

import json
import logging
import math
import random
import re
from functools import cached_property
from pathlib import Path

import networkx as nx

from config import (
    ALT_MAX_DETOUR, ALT_MAX_SHARED, ALT_REUSE_PENALTY, CRITICALITY_SAMPLE_NODES, EDGE_OVERRIDES_PATH, GRAPH_PATH,
    LEAST_BAD_MULTIPLIER, MAX_SNAP_M, POIS, Language, Profile,
)
from routing.explain import PathSummary, explain, explain_alternative
from routing.weights import EdgeAttrs, ReportEffect, edge_cost

log = logging.getLogger("beeable.routing")

Effects = dict[str, tuple[ReportEffect, ...]]  # edge_id -> open reports on that edge
M_PER_DEG = 111_320


class OffNetworkError(ValueError):
    """A from/to point is too far from any mapped path."""


def _attrs_from_osm(length_m: float, tags: dict[str, str]) -> EdgeAttrs:
    incline = re.match(r"^\s*-?(\d+(?:\.\d+)?)\s*%", tags.get("incline", ""))
    return EdgeAttrs(
        length_m=length_m,
        has_steps=True if "steps" in tags.get("highway", "") else None,
        slope_pct=float(incline.group(1)) if incline else None,
        shade=True if tags.get("covered") == "yes" else None,
        source="imported",
    )


class CampusGraph:
    def __init__(self, data: dict, overrides: dict[str, dict] | None = None):
        self.meta = data["meta"]
        self.nodes: dict[str, tuple[float, float]] = {n: (p[0], p[1]) for n, p in data["nodes"].items()}
        lat0 = self.meta["center"][0]
        self._kx = M_PER_DEG * math.cos(math.radians(lat0))  # metres per degree of longitude here
        self.G = nx.Graph()
        self.edges: dict[str, dict] = {}
        overrides = overrides or {}
        for e in data["edges"]:
            attrs = _attrs_from_osm(e["length_m"], e["tags"])
            if e["id"] in overrides:
                o = {k: v for k, v in overrides[e["id"]].items() if k in EdgeAttrs.__dataclass_fields__}
                attrs = EdgeAttrs(**{**attrs.__dict__, **o})
            self.edges[e["id"]] = {**e, "attrs": attrs}
            self.G.add_edge(e["u"], e["v"], id=e["id"], attrs=attrs)
        for missing in set(overrides) - set(self.edges):
            log.warning("edge_overrides: unknown edge id %s (graph rebuilt?)", missing)

    @classmethod
    def load(cls, graph_path: Path = GRAPH_PATH, overrides_path: Path = EDGE_OVERRIDES_PATH) -> "CampusGraph":
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        overrides = {}
        if overrides_path.exists():
            overrides = json.loads(overrides_path.read_text(encoding="utf-8")).get("edges", {})
        return cls(data, overrides)

    # --- geometry -------------------------------------------------------------------------------
    def _xy(self, lat: float, lng: float) -> tuple[float, float]:
        return lng * self._kx, lat * M_PER_DEG

    def _dist(self, a: tuple[float, float], b: tuple[float, float]) -> float:
        (x1, y1), (x2, y2) = self._xy(*a), self._xy(*b)
        return math.hypot(x1 - x2, y1 - y2)

    def nearest_node(self, lat: float, lng: float) -> tuple[str, float]:
        node = min(self.nodes, key=lambda n: self._dist((lat, lng), self.nodes[n]))
        return node, self._dist((lat, lng), self.nodes[node])

    def nearest_edge(self, lat: float, lng: float) -> tuple[str, float]:
        px, py = self._xy(lat, lng)
        best, best_d = "", math.inf
        for eid, e in self.edges.items():
            pts = [self._xy(*c) for c in e["coords"]]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                dx, dy = x2 - x1, y2 - y1
                t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
                d = math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
                if d < best_d:
                    best, best_d = eid, d
        return best, best_d

    # --- routing --------------------------------------------------------------------------------
    def _weight(self, profile: Profile, effects: Effects, least_bad: bool = False):
        def w(_u, _v, d) -> float | None:
            cost, _ = edge_cost(d["attrs"], profile, effects.get(d["id"], ()))
            if cost is None and least_bad:
                return d["attrs"].length_m * LEAST_BAD_MULTIPLIER
            return cost  # None hides the edge from networkx

        return w

    def _summarise(self, path: list[str], profile: Profile, effects: Effects) -> PathSummary:
        s = PathSummary(edge_ids=[], length_m=0.0, cost=0.0)
        for u, v in zip(path, path[1:]):
            d = self.G[u][v]
            cost, ps = edge_cost(d["attrs"], profile, effects.get(d["id"], ()))
            length = d["attrs"].length_m
            s.edge_ids.append(d["id"])
            s.length_m += length
            s.cost = None if cost is None or s.cost is None else s.cost + cost
            if any(p.key == "attribute_unknown" for p in ps):
                s.unknown_m += length
            s.barriers += [(p, length) for p in ps if p.is_barrier]
        return s

    def _geojson(self, path: list[str], profile: Profile, effects: Effects, lang: Language = "en") -> dict:
        features = []
        for u, v in zip(path, path[1:]):
            d = self.G[u][v]
            e = self.edges[d["id"]]
            coords = e["coords"] if u == e["u"] else list(reversed(e["coords"]))
            cost, ps = edge_cost(d["attrs"], profile, effects.get(d["id"], ()))
            barriers = [p for p in ps if p.is_barrier]
            props = {
                "edge_id": d["id"],
                "source": d["attrs"].source,
                "surveyed": d["attrs"].source == "surveyed",
                "length_m": d["attrs"].length_m,
                "impassable": cost is None,
            }
            if barriers:
                props["barrier"] = "; ".join(p.label_in(lang) for p in barriers)
                props["barrier_verified"] = any(p.key.startswith("verified") for p in barriers)
            if "name" in e["tags"]:
                props["name"] = e["tags"]["name"]
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[lng, lat] for lat, lng in coords]},
                "properties": props,
            })
        return {"type": "FeatureCollection", "features": features}

    def _snap(self, point: tuple[float, float], name: str) -> str:
        node, d = self.nearest_node(*point)
        if d > MAX_SNAP_M:
            raise OffNetworkError(f"`{name}` is {d:.0f} m from the nearest mapped path (max {MAX_SNAP_M} m)")
        return node

    def _alternative(
        self, s: str, t: str, best: PathSummary, profile: Profile, effects: Effects, least_bad: bool
    ) -> tuple[list[str], PathSummary] | None:
        """Next-best route for the profile that mostly takes a different way, or None if there isn't one."""
        on_best = set(best.edge_ids)
        base = self._weight(profile, effects, least_bad)

        def w(u, v, d) -> float | None:
            cost = base(u, v, d)
            return None if cost is None else cost * (ALT_REUSE_PENALTY if d["id"] in on_best else 1)

        try:
            path = nx.shortest_path(self.G, s, t, weight=w)
        except nx.NetworkXNoPath:
            return None
        alt = self._summarise(path, profile, effects)
        if alt.edge_ids == best.edge_ids or not alt.length_m:
            return None
        shared = sum(self.edges[e]["attrs"].length_m for e in alt.edge_ids if e in on_best) / alt.length_m
        if shared > ALT_MAX_SHARED or alt.length_m > best.length_m * ALT_MAX_DETOUR:
            return None
        return path, alt

    def _surveyed_share(self, p: PathSummary) -> float:
        surveyed_m = sum(self.edges[e]["attrs"].length_m for e in p.edge_ids if self.edges[e]["attrs"].source == "surveyed")
        return round(surveyed_m / p.length_m, 3) if p.length_m else 0.0

    def route(
        self,
        origin: tuple[float, float],
        dest: tuple[float, float],
        profile: Profile,
        effects: Effects,
        lang: Language = "en",
    ) -> dict:
        s, t = self._snap(origin, "from"), self._snap(dest, "to")
        shortest = nx.shortest_path(self.G, s, t, weight=lambda _u, _v, d: d["attrs"].length_m)
        least_bad = False
        try:
            best = nx.shortest_path(self.G, s, t, weight=self._weight(profile, effects))
        except nx.NetworkXNoPath:
            least_bad = True
            best = nx.shortest_path(self.G, s, t, weight=self._weight(profile, effects, least_bad=True))

        sh, be = self._summarise(shortest, profile, effects), self._summarise(best, profile, effects)

        def cost_info(p: PathSummary) -> dict:
            info = {
                "length_m": round(p.length_m),
                "cost": None if p.cost is None else round(p.cost, 1),
                "known_barriers": len(p.barriers),
                "unknown_m": round(p.unknown_m),
            }
            if p.blocking:
                info["blocked_by"] = p.blocking[0][0].label_in(lang)
            return info

        found = self._alternative(s, t, be, profile, effects, least_bad)
        alternative = None
        if found:
            alt_path, alt = found
            alternative = {
                "route": self._geojson(alt_path, profile, effects, lang),
                "costs": cost_info(alt),
                "explanation": explain_alternative(be, alt, profile, lang),
                "surveyed_share": self._surveyed_share(alt),
            }
        return {
            "shortest": self._geojson(shortest, profile, effects, lang),
            "recommended": self._geojson(best, profile, effects, lang),
            "costs": {"profile": profile, "shortest": cost_info(sh), "recommended": {**cost_info(be), "least_bad": least_bad}},
            "explanation": explain(sh, be, profile, least_bad, lang),
            "surveyed_share": self._surveyed_share(be),
            "alternative": alternative,
        }

    # --- priority inputs ------------------------------------------------------------------------
    @cached_property
    def criticality(self) -> dict[str, float]:
        """Share of sampled O–D trips whose step_free route (no reports) uses each edge."""
        rng = random.Random(42)
        sample = {self.nearest_node(p["lat"], p["lng"])[0] for p in POIS}
        sample |= set(rng.sample(sorted(self.nodes), min(CRITICALITY_SAMPLE_NODES, len(self.nodes))))
        sample_list = sorted(sample)
        counts: dict[str, int] = {}
        trips = 0
        weight = self._weight("step_free", {})
        for i, a in enumerate(sample_list):
            paths = nx.single_source_dijkstra_path(self.G, a, weight=weight)
            for b in sample_list[i + 1 :]:
                if b not in paths:
                    continue
                trips += 1
                for u, v in zip(paths[b], paths[b][1:]):
                    eid = self.G[u][v]["id"]
                    counts[eid] = counts.get(eid, 0) + 1
        return {eid: round(c / trips, 3) for eid, c in counts.items()} if trips else {}
