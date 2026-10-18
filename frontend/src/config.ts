// Single place for front-end config. Mirrors backend/config.py where relevant.

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
// "true" forces mocks; otherwise mocks are used only when the API is unreachable.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// Pilot site centre: UiTM Kedah campus, Merbok. Keep in sync with backend/config.py.
export const PRECINCT_CENTER: [number, number] = [5.714050829302482, 100.45039616486677];
export const DEFAULT_ZOOM = 17;
// GPS positions further than this from the centre are treated as off campus (route starts at the centre).
// Matches the walk graph's coverage (GRAPH_RADIUS_M in backend/config.py); further out, /route can't snap.
export const CAMPUS_RADIUS_M = 700;
// Conservative walking/wheeling speed for time estimates (same as backend/config.py).
export const WALK_SPEED_MPS = 1.0;

export const PROFILES = [
  { id: "step_free", label: "Step-free", hint: "Avoids steps and steep slopes" },
  { id: "easy_walking", label: "Easy walking", hint: "Fewer steps, gentler slopes, more shade" },
] as const;

// Demo destinations on the UiTM Kedah campus (source: simulated) until /data/processed is seeded.
export const DESTINATIONS = [
  { id: "clinic", name: "Unit Kesihatan", type: "clinic", lat: 5.709855420465538, lng: 100.44663876053161 },
  { id: "surau", name: "Pusat Islam", type: "mosque_surau", lat: 5.710421138824264, lng: 100.44729553127485 },
  { id: "bus", name: "Depo Bas", type: "bus_stop", lat: 5.7131192808178195, lng: 100.4492427039137 },
] as const;
// Barrier categories from the AI schema (backend/config.py BARRIER_CATEGORIES), with staff-facing labels.
export const CATEGORIES = [
  { id: "steps_no_ramp", label: "Steps, no ramp" },
  { id: "high_kerb", label: "High kerb" },
  { id: "damaged_kerb", label: "Damaged kerb" },
  { id: "missing_ramp", label: "Missing ramp" },
  { id: "broken_paving", label: "Broken paving" },
  { id: "obstruction", label: "Obstruction" },
  { id: "steep_slope", label: "Steep slope" },
  { id: "no_crossing", label: "No safe crossing" },
  { id: "other", label: "Other" },
  { id: "not_a_barrier", label: "Not a barrier" },
] as const;

// Staff dashboard polls for new reports this often (only while the tab is visible).
export const INSIGHTS_REFRESH_MS = 15_000;
