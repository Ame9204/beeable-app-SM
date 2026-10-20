"""Download named campus places (buildings, amenities) from OpenStreetMap for the destination search.

    python -m routing.build_places          (from /backend, with requirements-dev.txt installed)

Writes data/processed/places.json, which the front end bundles. Offline only, like build_graph.
Map data © OpenStreetMap contributors (ODbL).
"""

import json
from datetime import datetime, timezone

import osmnx as ox

from config import GRAPH_RADIUS_M, PLACES_PATH, POIS, PRECINCT_CENTER

# The whole-campus outline isn't a destination (its centre point is somewhere in the middle).
EXCLUDE = {"universiti teknologi mara kedah"}

TAGS = {"building": True, "amenity": True, "leisure": True, "shop": True, "office": True}

# Map OSM tags to the app's place types (used for icons and the "key places" suggestions).
AMENITY_TYPE = {
    "place_of_worship": "mosque_surau",
    "clinic": "clinic",
    "doctors": "clinic",
    "hospital": "clinic",
    "bus_station": "bus_stop",
    "cafe": "food",
    "restaurant": "food",
    "fast_food": "food",
    "library": "library",
}
BUILDING_TYPE = {"dormitory": "residence", "university": "building", "mosque": "mosque_surau"}


def place_type(amenity: str | None, building: str | None, leisure: str | None, name: str) -> str:
    """Best-effort place type from OSM tags and the name (campus names are in Malay)."""
    lower = name.lower()
    if "perpustakaan" in lower:
        return "library"
    if "depo bas" in lower or "bus" in lower:
        return "bus_stop"
    if "kesihatan" in lower or "klinik" in lower:
        return "clinic"
    if amenity in AMENITY_TYPE:
        return AMENITY_TYPE[amenity]
    if leisure:
        return "sport"
    if building in BUILDING_TYPE:
        return BUILDING_TYPE[building]
    return "building"


def _str(v) -> str | None:
    return v if isinstance(v, str) else None


def build() -> dict:
    gdf = ox.features_from_point(PRECINCT_CENTER, tags=TAGS, dist=GRAPH_RADIUS_M)
    places: dict[str, dict] = {}
    for _, row in gdf.iterrows():
        name = _str(row.get("name"))
        if not name:
            continue
        c = row.geometry.centroid
        typ = place_type(_str(row.get("amenity")), _str(row.get("building")), _str(row.get("leisure")), name.strip())
        key = name.strip().lower()
        if key in EXCLUDE:
            continue
        # Several OSM shapes can share a name (wings of one department); keep the first.
        places.setdefault(key, {
            "id": f"osm-{len(places) + 1}",
            "name": name.strip(),
            "type": typ,
            "lat": round(c.y, 7),
            "lng": round(c.x, 7),
            "source": "imported",
        })
    # The demo POIs win: their coordinates are the ones the demo story and priority score use.
    for poi in POIS:
        key = poi["name"].lower()
        match = next((k for k in places if key in k or k in key), None)
        if match:
            places.pop(match)
        places[key] = {**{k: poi[k] for k in ("id", "name", "type", "lat", "lng")}, "source": "simulated"}
    return {
        "meta": {"built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "source": "OpenStreetMap"},
        "places": sorted(places.values(), key=lambda p: p["name"]),
    }


def main() -> None:
    data = build()
    PLACES_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved {len(data['places'])} places to {PLACES_PATH}")


if __name__ == "__main__":
    main()
