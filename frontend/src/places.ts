// Destinations for the search bar: named campus places from OpenStreetMap (source "imported") plus the
// demo POIs (source "simulated"). Rebuild with `python -m routing.build_places` in /backend.
import data from "../../data/processed/places.json";
import { distanceM } from "./hooks/useLocation";

export type PlaceType =
  | "clinic" | "mosque_surau" | "bus_stop" | "library" | "food" | "residence" | "sport" | "building";

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  source: "imported" | "simulated" | "surveyed";
}

export const PLACES = data.places as Place[];

// Labels for each type: i18n.ts (place.<type>).

// Extra words people might type (English and Malay), so "clinic" finds "Unit Kesihatan".
const ALIASES: Record<PlaceType, string[]> = {
  clinic: ["clinic", "klinik", "health", "kesihatan", "doctor", "doktor", "sick"],
  mosque_surau: ["surau", "mosque", "masjid", "pray", "solat", "islam"],
  bus_stop: ["bus", "bas", "stop", "depo", "transport"],
  library: ["library", "perpustakaan", "books", "buku", "study"],
  food: ["food", "makan", "cafe", "kafe", "eat", "drink", "minum", "canteen", "kantin"],
  residence: ["kolej", "college", "hostel", "dorm", "asrama"],
  sport: ["stadium", "sport", "sukan", "field", "padang"],
  building: ["building", "bangunan", "office", "pejabat"],
};

/** Shown as quick picks before the user types anything. */
export const KEY_PLACE_TYPES: PlaceType[] = ["clinic", "mosque_surau", "bus_stop", "library", "food"];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function score(p: Place, q: string): number {
  const name = norm(p.name);
  if (name === q) return 10;
  if (name.startsWith(q)) return 6;
  const words = name.split(" ");
  if (words.some((w) => w.startsWith(q))) return 4;
  if (name.includes(q)) return 3;
  if (ALIASES[p.type].some((a) => a.startsWith(q) || q.startsWith(a))) return 2;
  // every typed word appears somewhere ("akad 2" -> "Bangunan Akademik 2")
  const parts = q.split(" ");
  if (parts.length > 1 && parts.every((part) => words.some((w) => w.startsWith(part)))) return 3.5;
  return 0;
}

/** Places matching `query`, best first; ties go to the closest one when we know where the user is. */
export function searchPlaces(query: string, from?: [number, number] | null, limit = 8): Place[] {
  const q = norm(query);
  if (!q) return [];
  return PLACES.map((p) => ({ p, s: score(p, q), d: from ? distanceM(from, [p.lat, p.lng]) : 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

/** The closest place of each key type (clinic, surau, bus stop, …). */
export function keyPlaces(from?: [number, number] | null): Place[] {
  return KEY_PLACE_TYPES.flatMap((t) => {
    const of = PLACES.filter((p) => p.type === t);
    if (!of.length) return [];
    return [from ? of.reduce((a, b) => (distanceM(from, [a.lat, a.lng]) <= distanceM(from, [b.lat, b.lng]) ? a : b)) : of[0]];
  });
}

const RECENT_KEY = "beeable.recentPlaces";

export function recentPlaces(): Place[] {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    return ids.map((id) => PLACES.find((p) => p.id === id)).filter((p): p is Place => !!p);
  } catch {
    return [];
  }
}

export function rememberPlace(p: Place) {
  try {
    const ids = [p.id, ...recentPlaces().map((r) => r.id).filter((id) => id !== p.id)].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    /* not essential */
  }
}

export const findPlace = (id: string) => PLACES.find((p) => p.id === id);
