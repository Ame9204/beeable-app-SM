"""Inputs to the priority score that come from geography, not the report itself."""

import math

from config import POI_PRIORITY_TYPES, POI_PROXIMITY_M, POIS


def _metres(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    kx = 111_320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lat1 - lat2) * 111_320, (lng1 - lng2) * kx)


def poi_proximity(lat: float, lng: float) -> int:
    """1 if within POI_PROXIMITY_M of a clinic, bus stop, school or place of worship."""
    return int(
        any(
            p["type"] in POI_PRIORITY_TYPES and _metres(lat, lng, p["lat"], p["lng"]) <= POI_PROXIMITY_M
            for p in POIS
        )
    )
