// Shapes follow the API contract in CLAUDE.md.
import type { FeatureCollection, LineString } from "geojson";

export type Profile = "step_free" | "easy_walking";
export type ReportStatus = "unverified" | "verified" | "rejected" | "in_progress" | "resolved";
export type DataSource = "surveyed" | "imported" | "reported" | "simulated";
/** Where a report's AI fields came from — shown to staff for data honesty. */
export type AISource = "live" | "cached" | "fallback" | "simulated";

export interface SegmentProps {
  edge_id: string;
  source: DataSource;
  surveyed: boolean;
  barrier?: string;
  barrier_verified?: boolean;
}

export type RouteGeoJSON = FeatureCollection<LineString, SegmentProps>;

export interface RouteResponse {
  shortest: RouteGeoJSON;
  recommended: RouteGeoJSON;
  costs: Record<string, { length_m: number; cost: number | null; blocked_by?: string }>;
  explanation: string[];
  surveyed_share: number;
}

export interface AISuggestion {
  is_accessibility_barrier: boolean;
  category: string;
  severity: "low" | "medium" | "high";
  affects: string[];
  summary_en: string;
  language_detected: "ms" | "en" | "zh" | "ta";
  possible_duplicate_of: string | null;
  privacy_flag: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
}

export interface Report {
  id: string;
  reference_number: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  original_text: string;
  language: string;
  ai: AISuggestion;
  ai_source: AISource;
  status: ReportStatus;
  edge_id: string | null;
  source: "reported" | "simulated";
  created_at: string;
  verified_at: string | null;
  resolved_at: string | null;
}

export interface ReportCreate {
  photo_url: string | null;
  text: string;
  lat: number;
  lng: number;
}

export interface Priority {
  rank: number;
  report: Report;
  score: number;
  breakdown: {
    severity: number;
    route_criticality: number;
    poi_proximity: number;
    report_count: number;
  };
}
