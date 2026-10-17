"""Run the intake over the labelled test set and report accuracy.

    backend/.venv/Scripts/python -m eval.run      (from the repo root; macOS/Linux: backend/.venv/bin/python)

labels.csv columns: photo (file in eval/photos/), text, language, category, severity,
is_accessibility_barrier (true/false). Results go to eval/results/<timestamp>.json.
"""

import csv
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR.parent / "backend"))

from config import INTAKE_MODEL, INTAKE_PROVIDER, PRECINCT_CENTER  # noqa: E402
from intake.images import process_image  # noqa: E402
from intake.service import run_intake  # noqa: E402


def main() -> None:
    rows = list(csv.DictReader(open(EVAL_DIR / "labels.csv", encoding="utf-8")))
    if not rows:
        sys.exit("eval/labels.csv has no rows yet — add labelled photos first.")

    results, hits, sources = [], Counter(), Counter()
    for row in rows:
        photo = EVAL_DIR / "photos" / row["photo"] if row["photo"] else None
        image = process_image(photo.read_bytes())[0] if photo and photo.exists() else None
        ai, source = run_intake(
            image=image, text=row["text"], lat=PRECINCT_CENTER[0], lng=PRECINCT_CENTER[1], nearby=[]
        )
        sources[source] += 1
        checks = {
            "category": ai.category == row["category"],
            "severity": ai.severity == row["severity"],
            "language": ai.language_detected == row["language"],
            "is_barrier": ai.is_accessibility_barrier == (row["is_accessibility_barrier"].lower() == "true"),
        }
        hits.update(k for k, ok in checks.items() if ok)
        results.append({"photo": row["photo"], "expected": row, "got": ai.model_dump(), "source": source, **checks})
        print(f"{'OK ' if checks['category'] else 'MISS'} {row['photo'] or '-':30} {row['category']:15} -> {ai.category} ({source})")

    n = len(rows)
    summary = {k: round(hits[k] / n, 3) for k in ("category", "severity", "language", "is_barrier")}
    print(f"\n{n} items | provider={INTAKE_PROVIDER} model={INTAKE_MODEL} | sources={dict(sources)}")
    for k, v in summary.items():
        print(f"  {k:10} accuracy {v:.0%}")
    if sources["fallback"]:
        print("  note: fallback answers count as misses — check the API key / rate limits.")

    out = EVAL_DIR / "results" / f"{datetime.now():%Y%m%d-%H%M%S}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"summary": summary, "provider": INTAKE_PROVIDER, "model": INTAKE_MODEL,
                               "sources": sources, "items": results}, indent=1, ensure_ascii=False))
    print(f"saved {out.relative_to(EVAL_DIR.parent)}")


if __name__ == "__main__":
    main()
