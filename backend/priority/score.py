import math

from config import SEVERITY_SCORE


def priority_score(
    severity: str, route_criticality: float, poi_proximity: int, report_count: int
) -> float:
    """priority = severity(1–3) * (1 + route_criticality + poi_proximity) * sqrt(report_count)"""
    return (
        SEVERITY_SCORE[severity]
        * (1 + route_criticality + poi_proximity)
        * math.sqrt(report_count)
    )
