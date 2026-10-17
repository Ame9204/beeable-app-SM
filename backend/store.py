"""Tiny JSON-file persistence for reports and staff decisions until Supabase lands (2–6 Nov sprint)."""

import json
import logging
from pathlib import Path

from schemas import Report

log = logging.getLogger("beeable.store")


def load(path: Path, seed: dict[str, Report]) -> tuple[dict[str, Report], list[dict]]:
    if not path.exists():
        return dict(seed), []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        reports = {r["id"]: Report.model_validate(r) for r in data["reports"]}
        return reports, data.get("decisions", [])
    except (ValueError, KeyError) as exc:
        log.warning("could not read %s (%s); starting from seed data", path, exc)
        return dict(seed), []


def save(path: Path, reports: dict[str, Report], decisions: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "reports": [r.model_dump(mode="json") for r in reports.values()],
        "decisions": decisions,
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)  # atomic on the same filesystem
