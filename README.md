# BeeAble

BeeAble is an AI-assisted accessibility platform for a Sime Darby Property (SDP) township, built for the SDP University Hackathon "Township of Tomorrow" (People track, Accessibility & Inclusion).

It is one closed loop: **Navigate → Report → Verify → Rank → Fix → Route improves.**

- **Navigate**: personalised walking routes (profiles: `step_free`, `easy_walking`) to a place picked from the search or tapped on the map, with a plain-language "why this route" and flags on unverified or unknown segments.
- **Report**: camera photo + text (the AI reads BM, English, Mandarin and Tamil) → the AI makes a structured ticket. The AI confirms a clear barrier straight away and auto-rejects a non-barrier. Staff review the doubtful ones.
- **Language**: the resident app is in English or Bahasa Melayu. Route explanations come from the API in the same language. The staff dashboard is in English.
- **Insights**: a staff dashboard to review, rank, reject, assign and resolve barriers. Resolving a barrier updates the routing graph immediately.

**Pilot site: UiTM Kedah campus (Merbok, Sungai Petani)**, about 1 km². We chose it because the team can survey it in person and recruit test users there. The pipeline (OSMnx → survey → reports) doesn't depend on the site, so it can be redeployed on an SDP township precinct.

## Stack

| Layer | Choice |
|---|---|
| Front end | React (Vite) + Leaflet/OSM tiles. `/` Navigate, `/report` Report, `/insights` staff dashboard. The resident app ships as an Android app (Capacitor) and as a web PWA |
| Backend | Python, FastAPI |
| Routing | OSMnx walk network → NetworkX graph with a custom weight function |
| AI | Multimodal LLM (Gemini) with strict JSON output |
| Hosting | API on Render (`render.yaml`), Android debug APK, dashboard on a static host |

## Repository layout

```
/frontend        React PWA (resident app + /insights dashboard) and Android project
/backend         FastAPI app
  /routing       graph build, weight functions, explanations
  /intake        LLM prompt, JSON schema, validation, AI confirmation
  /priority      priority score
  /tests         pytest suite
/data/processed  walk graph, path attributes, place list
/eval            AI test-set labels and evaluation script
```

## Running it

```
# backend (http://localhost:8000, API docs at /docs)
# copy .env.example to backend/.env and set GEMINI_API_KEY (INTAKE_PROVIDER=cached|none for offline)
cd backend && python -m venv .venv && .venv/Scripts/activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
python -m pytest

# frontend (http://localhost:5173; /insights = staff dashboard)
cd frontend && npm install && npm run dev
# falls back to in-browser sample data (a banner shows) if the API is down; VITE_USE_MOCKS=true forces it

# Android app (needs the Android SDK; set VITE_API_URL in frontend/.env.android first)
cd frontend && npm run build:android
npm run apk                 # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android             # open in Android Studio

# rebuild the routing graph from OSM (needs the dev dependencies)
cd backend && pip install -r requirements-dev.txt && python -m routing.build_graph
python -m routing.build_places   # destination search places -> data/processed/places.json

# AI evaluation on the test set (from the repo root; rows in eval/labels.csv, photos in eval/photos/)
backend/.venv/Scripts/python -m eval.run
```

## API

- `GET /route?from=lat,lng&to=lat,lng&profile=step_free|easy_walking&lang=en|ms` → shortest and recommended routes (GeoJSON), costs, explanation, surveyed share, and an alternative route when one exists.
- `POST /reports/analyse` `{ photo_url, text?, lat, lng }` → AI preview before sending.
- `POST /reports` `{ photo_url, text, lat, lng, analysis_id? }` → report with AI fields. The status is `verified` (by the AI), `rejected` (by the AI), or `unverified`.
- `PATCH /reports/{id}` `{ status, edits? }` → staff decision.
- `GET /reports?status=` → reports for the map and dashboard. Each one lists similar nearby reports.
- `GET /priorities` → verified barriers ranked, each with its score breakdown.

## Routing

```
cost(e) = length_m(e) * (1 + Σ penalties)     # or impassable on a hard constraint
```

| Factor | step_free | easy_walking |
|---|---|---|
| Verified steps | impassable | +2.0 |
| Open unverified report on edge | +3.0 | +1.0 |
| Slope 5–8% | +1.5 | +1.0 |
| Slope > 8% | impassable | +2.0 |
| No shade | 0 | +0.3 |
| Attribute unknown | +0.5 | +0.5 |

These weights are our own choices, not standards. They live in `backend/config.py`. Unknown segments are never treated as safe, and a route is never labelled "accessible": the app says "no known barriers for your profile" and shows the surveyed share.

## Priority score

```
priority = severity(1–3) * (1 + route_criticality + poi_proximity) * sqrt(report_count)
```

`route_criticality` is the share of sampled trips whose step-free route uses the edge. `poi_proximity` is 1 when the barrier is within 100 m of a clinic, bus stop, school or place of worship.

## Data honesty and privacy

- Every data point carries a source label: surveyed, imported, reported or simulated. Simulated data is labelled as such in the UI.
- We make no claims of MS 1184 compliance from photos.
- There are no server accounts. The optional profile stays on the device, and reports never carry the reporter's identity.
