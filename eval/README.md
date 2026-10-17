# AI evaluation

Labelled test set for the report-intake prompt (`backend/intake`).

- `photos/` — test photos (the team's own campus photos; no identifiable people)
- `labels.csv` — one row per photo: `photo, text, language, category, severity, is_accessibility_barrier`
- `run.py` — runs the real intake over every row and prints category / severity / language accuracy;
  full results go to `results/<timestamp>.json`

Run from the repo root (uses the provider in `backend/.env`):

    backend/.venv/Scripts/python -m eval.run

Fallback answers (no key, rate limit) count as misses, and the run says how many there were.
