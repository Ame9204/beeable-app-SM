"""Download the campus walk network from OpenStreetMap and save it as compact JSON.

    python -m routing.build_graph          (from /backend, with requirements-dev.txt installed)

Runs offline only: the API loads the saved file with plain networkx, so Render never needs OSMnx.
Map data © OpenStreetMap contributors (ODbL).
"""

import json
from datetime import datetime, timezone

import osmnx as ox

from config import GRAPH_PATH, GRAPH_RADIUS_M, PRECINCT_CENTER

# OSM way tags that matter for walking/wheeling access.
ACCESS_TAGS = ["highway", "incline", "surface", "width", "wheelchair", "covered", "kerb", "smoothness", "name"]


def _tag(value) -> str | None:
    """OSMnx merges tags of simplified ways into lists; keep a readable string."""
    if value is None or value != value:  # None or NaN
        return None
    if isinstance(value, list):
        return ";".join(sorted({str(v) for v in value}))
    return str(value)


def build() -> dict:
    ox.settings.useful_tags_way = sorted(set(ox.settings.useful_tags_way) | set(ACCESS_TAGS))
    G = ox.graph_from_point(PRECINCT_CENTER, dist=GRAPH_RADIUS_M, network_type="walk", simplify=True)
    G = ox.convert.to_undirected(G)

    nodes = {str(n): [round(d["y"], 7), round(d["x"], 7)] for n, d in G.nodes(data=True)}
    best: dict[tuple[str, str], dict] = {}  # keep the shortest of parallel ways between two nodes
    for u, v, _k, d in G.edges(keys=True, data=True):
        a, b = sorted((str(u), str(v)))
        if "geometry" in d:
            coords = [[round(y, 7), round(x, 7)] for x, y in d["geometry"].coords]
        else:
            coords = [nodes[str(u)], nodes[str(v)]]
        if coords[0] != nodes[a]:  # store geometry oriented a -> b
            coords.reverse()
        edge = {
            "id": f"{a}-{b}",
            "u": a,
            "v": b,
            "length_m": round(float(d["length"]), 1),
            "coords": coords,
            "tags": {t: _tag(d.get(t)) for t in ACCESS_TAGS if _tag(d.get(t)) is not None},
        }
        if (a, b) not in best or edge["length_m"] < best[(a, b)]["length_m"]:
            best[(a, b)] = edge

    lats = [p[0] for p in nodes.values()]
    lngs = [p[1] for p in nodes.values()]
    return {
        "meta": {
            "source": "OpenStreetMap contributors (ODbL)",
            "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "center": list(PRECINCT_CENTER),
            "radius_m": GRAPH_RADIUS_M,
            "bbox": [min(lats), min(lngs), max(lats), max(lngs)],  # south, west, north, east
        },
        "nodes": nodes,
        "edges": sorted(best.values(), key=lambda e: e["id"]),
    }


def main() -> None:
    graph = build()
    GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
    GRAPH_PATH.write_text(json.dumps(graph, separators=(",", ":")), encoding="utf-8")
    highways: dict[str, int] = {}
    for e in graph["edges"]:
        h = e["tags"].get("highway", "?")
        highways[h] = highways.get(h, 0) + 1
    print(f"saved {GRAPH_PATH} — {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
    print("bbox (S, W, N, E):", graph["meta"]["bbox"])
    print("highway types:", dict(sorted(highways.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
