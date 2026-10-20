// Turn-by-turn guidance worked out from the recommended route's geometry (pure functions, no I/O).
// The route's features come from the server in walking order and orientation (backend/routing/router.py).
import type { RouteGeoJSON } from "./types";

export type LatLng = [number, number];

export interface PathPoint {
  at: LatLng;
  /** metres from the start of the route */
  along: number;
}

export interface RouteBarrier {
  along: number;
  text: string;
  impassable: boolean;
}

export type ManeuverKind =
  | "slight_left" | "left" | "sharp_left" | "slight_right" | "right" | "sharp_right" | "uturn" | "arrive";

export interface Maneuver {
  along: number;
  kind: ManeuverKind;
}

export interface NavPath {
  points: PathPoint[];
  length: number;
  maneuvers: Maneuver[];
  barriers: RouteBarrier[];
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b, 0–360 (0 = north). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Signed change of direction, -180..180; positive = turning right. */
export function turnAngle(inBearing: number, outBearing: number): number {
  return ((outBearing - inBearing + 540) % 360) - 180;
}

export function classifyTurn(angle: number): ManeuverKind | null {
  const a = Math.abs(angle);
  if (a < 30) return null; // gentle bends: just keep walking
  const side = angle > 0 ? "right" : "left";
  if (a < 60) return `slight_${side}`;
  if (a < 135) return side;
  if (a < 165) return `sharp_${side}`;
  return "uturn";
}

/** Point `along` metres into the path (clamped to its ends). */
export function pointAt(points: PathPoint[], along: number): LatLng {
  if (along <= 0) return points[0].at;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (b.along >= along) {
      const t = b.along === a.along ? 0 : (along - a.along) / (b.along - a.along);
      return [a.at[0] + (b.at[0] - a.at[0]) * t, a.at[1] + (b.at[1] - a.at[1]) * t];
    }
  }
  return points[points.length - 1].at;
}

// Bearings are measured over this distance either side of a corner, so short GPS-ish zigzags in the
// map data don't become instructions.
const LOOK_M = 12;
// Corners closer than this that turn the same way are merged into one instruction (the sharper one).
// A left followed closely by a right stays as two (shown as "then …").
const MERGE_M = 20;

export function buildNavPath(route: RouteGeoJSON): NavPath {
  const points: PathPoint[] = [];
  const barriers: RouteBarrier[] = [];
  let along = 0;
  for (const f of route.features) {
    const startAlong = along;
    for (const [lng, lat] of f.geometry.coordinates) {
      const at: LatLng = [lat, lng];
      const prev = points[points.length - 1];
      if (prev) {
        const d = distance(prev.at, at);
        if (d < 0.5) continue; // repeated vertex where two edges meet
        along += d;
      }
      points.push({ at, along });
    }
    if (f.properties.barrier) {
      barriers.push({ along: (startAlong + along) / 2, text: f.properties.barrier, impassable: !!f.properties.impassable });
    }
  }

  const corners: Maneuver[] = [];
  const angles: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (p.along < LOOK_M / 2 || along - p.along < LOOK_M / 2) continue;
    const before = pointAt(points, p.along - LOOK_M);
    const after = pointAt(points, p.along + LOOK_M);
    const angle = turnAngle(bearing(before, p.at), bearing(p.at, after));
    const kind = classifyTurn(angle);
    if (!kind) continue;
    const last = corners[corners.length - 1];
    if (last && p.along - last.along < MERGE_M && Math.sign(angle) === Math.sign(angles[angles.length - 1])) {
      if (Math.abs(angle) > Math.abs(angles[angles.length - 1])) {
        corners[corners.length - 1] = { along: p.along, kind };
        angles[angles.length - 1] = angle;
      }
      continue;
    }
    corners.push({ along: p.along, kind });
    angles.push(angle);
  }
  return { points, length: along, maneuvers: [...corners, { along, kind: "arrive" }], barriers };
}

/** Where `pos` is relative to the path: metres along it, and metres off it. */
export function locateOnPath(points: PathPoint[], pos: LatLng, minAlong = 0): { along: number; offset: number } {
  // Local flat projection (metres) around the user: plenty accurate over a 1 km campus.
  const kx = R * Math.cos(rad(pos[0])) * (Math.PI / 180);
  const ky = R * (Math.PI / 180);
  const xy = (p: LatLng) => [(p[1] - pos[1]) * kx, (p[0] - pos[0]) * ky];
  let best = { along: 0, offset: Infinity };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (b.along < minAlong) continue; // don't snap back to a part already walked
    const [ax, ay] = xy(a.at), [bx, by] = xy(b.at);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx, py = ay + t * dy;
    const offset = Math.hypot(px, py);
    if (offset < best.offset) best = { along: a.along + t * (b.along - a.along), offset };
  }
  return best;
}

const TURN_TEXT: Record<ManeuverKind, string> = {
  slight_left: "Bear left",
  left: "Turn left",
  sharp_left: "Sharp left",
  slight_right: "Bear right",
  right: "Turn right",
  sharp_right: "Sharp right",
  uturn: "Turn around",
  arrive: "Arrive",
};

export function maneuverText(m: Maneuver, destination: string): string {
  return m.kind === "arrive" ? `Arrive at ${destination}` : TURN_TEXT[m.kind];
}

/** "40 m", "120 m", "1.2 km": rounded the way people say it. */
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 100) return `${Math.round(m / 10) * 10} m`;
  return `${Math.max(5, Math.round(m / 5) * 5)} m`;
}

/** Same, for speech ("40 metres"). */
export function spokenDistance(m: number): string {
  return formatDistance(m).replace(" km", " kilometres").replace(" m", " metres");
}
