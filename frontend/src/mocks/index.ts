// In-browser mocks matching the API contract. Used when VITE_USE_MOCKS=true or the API is down.
// Keep in step with backend/mock_data.py.
import type {
  AnalyseRequest, Analysis, Priority, Profile, Report, ReportCreate, ReportEdits, ReportStatus, RouteResponse,
  SegmentProps,
} from "../types";

type LatLng = [number, number];

const line = (coords: LatLng[], props: SegmentProps) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates: coords.map(([lat, lng]) => [lng, lat]) },
  properties: props,
});

export function mockRoute(from: LatLng, to: LatLng, profile: Profile): RouteResponse {
  const mid: LatLng = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const off = profile === "step_free" ? 0.0015 : 0.0008;
  const detour: LatLng = [mid[0] + off, mid[1] - off];
  const stepFree = profile === "step_free";
  return {
    shortest: {
      type: "FeatureCollection",
      features: [
        line([from, mid], { edge_id: "e1", source: "surveyed", surveyed: true }),
        line([mid, to], { edge_id: "e2", source: "surveyed", surveyed: true, barrier: "steps_no_ramp", barrier_verified: true }),
      ],
    },
    recommended: {
      type: "FeatureCollection",
      features: [
        line([from, detour], { edge_id: "e3", source: "surveyed", surveyed: true }),
        line([detour, to], { edge_id: "e4", source: "imported", surveyed: false }),
      ],
    },
    costs: stepFree
      ? { shortest: { length_m: 420, cost: null, blocked_by: "verified steps on e2" }, recommended: { length_m: 510, cost: 637.5 } }
      : { shortest: { length_m: 420, cost: 1260 }, recommended: { length_m: 470, cost: 587.5 } },
    explanation: stepFree
      ? [
          "The shortest route has verified steps with no ramp, so it is avoided for step-free.",
          "This route uses the ramp, adding about 90 m (about 2 min).",
          "Part of this route has not been surveyed, so conditions there are unknown.",
        ]
      : [
          "The shortest route has steps, which add effort for easy walking.",
          "This route is about 50 m longer but avoids the steps.",
          "Part of this route has not been surveyed, so conditions there are unknown.",
        ],
    surveyed_share: 0.62,
  };
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let reports: Report[] = [
  {
    id: "r-001", reference_number: "BEE-001", lat: 5.7119793, lng: 100.4484015, photo_url: null,
    original_text: "Tangga tiada ramp di laluan ke Unit Kesihatan", language: "ms", status: "verified", edge_id: null,
    source: "simulated", ai_source: "simulated", created_at: daysAgo(2), verified_at: daysAgo(1), resolved_at: null,
    ai: {
      is_accessibility_barrier: true, category: "steps_no_ramp", severity: "high",
      affects: ["wheelchair", "stroller", "elderly"], summary_en: "Steps with no ramp on the main path to Unit Kesihatan.",
      language_detected: "ms", possible_duplicate_of: null, privacy_flag: false, confidence: "high",
      reason: "Steps clearly visible; no ramp in frame.",
    },
  },
  {
    id: "r-002", reference_number: "BEE-002", lat: 5.7130, lng: 100.4491, photo_url: null,
    original_text: "Paving broken at Depo Bas", language: "en", status: "unverified", edge_id: null,
    source: "simulated", ai_source: "simulated", created_at: daysAgo(3), verified_at: null, resolved_at: null,
    ai: {
      is_accessibility_barrier: true, category: "broken_paving", severity: "medium",
      affects: ["wheelchair", "low_vision"], summary_en: "Several loose paving tiles beside the Depo Bas shelter.",
      language_detected: "en", possible_duplicate_of: null, privacy_flag: false, confidence: "medium",
      reason: "Uneven tiles visible; extent unclear.",
    },
  },
];

const priorityInputs: Record<string, [number, number, number]> = {
  "r-001": [0.45, 1, 4],
  "r-002": [0.2, 1, 2],
};
const SEVERITY = { low: 1, medium: 2, high: 3 } as const;

export function mockListReports(status?: ReportStatus): Report[] {
  return reports.filter((r) => !status || r.status === status);
}

// Simulated: the real AI can't run without the API.
export function mockAnalyse(_body: AnalyseRequest): Analysis {
  return {
    analysis_id: `a-mock-${Math.random().toString(16).slice(2, 10)}`,
    ai_source: "simulated",
    ai: {
      is_accessibility_barrier: true, category: "damaged_kerb", severity: "medium",
      affects: ["wheelchair", "stroller"],
      summary_en: "Broken kerb edge at the crossing makes it hard to get onto the pavement.",
      language_detected: "en", possible_duplicate_of: null, privacy_flag: false, confidence: "medium",
      reason: "Sample answer: the BeeAble server is offline.",
    },
  };
}

export function mockCreateReport({ analysis_id: _analysis, ...body }: ReportCreate): Report {
  const id = `r-${Math.random().toString(16).slice(2, 10)}`;
  const report: Report = {
    id, reference_number: `BEE-${id.slice(2).toUpperCase()}`, ...body,
    original_text: body.text, language: "en", status: "unverified", edge_id: null, source: "reported",
    ai_source: "simulated",
    created_at: new Date().toISOString(), verified_at: null, resolved_at: null,
    ai: {
      is_accessibility_barrier: true, category: "damaged_kerb", severity: "medium",
      affects: ["wheelchair", "stroller"],
      summary_en: "Broken kerb edge at the crossing makes it hard to get onto the pavement.",
      language_detected: "en", possible_duplicate_of: null, privacy_flag: false, confidence: "medium",
      reason: "Mock AI response.",
    },
  };
  reports = [...reports, report];
  return report;
}

export function mockPatchReport(id: string, status: Exclude<ReportStatus, "unverified">, edits?: ReportEdits): Report {
  const now = new Date().toISOString();
  reports = reports.map((r) =>
    r.id === id
      ? {
          ...r, status, ai: { ...r.ai, ...edits },
          verified_at: status === "verified" ? now : r.verified_at, resolved_at: status === "resolved" ? now : r.resolved_at,
        }
      : r,
  );
  return reports.find((r) => r.id === id)!;
}

export function mockPriorities(): Priority[] {
  return reports
    .filter((r) => r.status === "verified" || r.status === "in_progress")
    .map((r) => {
      const [crit, poi, count] = priorityInputs[r.id] ?? [0, 0, 1];
      const sev = SEVERITY[r.ai.severity];
      return {
        rank: 0, report: r,
        score: Math.round(sev * (1 + crit + poi) * Math.sqrt(count) * 100) / 100,
        breakdown: { severity: sev, route_criticality: crit, poi_proximity: poi, report_count: count },
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
