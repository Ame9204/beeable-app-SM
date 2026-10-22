// In-browser mocks matching the API contract. Used when VITE_USE_MOCKS=true or the API is down.
// Keep in step with backend/mock_data.py.
import type {
  AnalyseRequest, Analysis, Priority, Profile, Report, ReportCreate, ReportEdits, ReportStatus, RouteResponse,
  SegmentProps,
} from "../types";

import type { Language } from "../account";

type LatLng = [number, number];

const line = (coords: LatLng[], props: SegmentProps) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates: coords.map(([lat, lng]) => [lng, lat]) },
  properties: props,
});

const MOCK_TEXT = {
  en: {
    steps: "steps with no ramp",
    stepFree: [
      "The shortest way (420 m) has steps with no ramp, so we take you around it.",
      "This route is 510 m — 90 m longer, about 2 min more.",
      "We haven't checked 38% of this route in person yet, so there might be things we don't know about.",
    ],
    easy: [
      "The shortest way (420 m) has steps with no ramp, so this route avoids it.",
      "This route is 470 m — 50 m longer, about 1 min more.",
      "We haven't checked 38% of this route in person yet, so there might be things we don't know about.",
    ],
    alt: [
      "This way is 640 m — 130 m longer than the BeeAble route, about 2 min more.",
      "We haven't checked this route in person yet, so there might be things we don't know about.",
    ],
  },
  ms: {
    steps: "tangga tanpa ramp",
    stepFree: [
      "Laluan terpendek (420 m) ada tangga tanpa ramp, jadi kami bawa anda mengelaknya.",
      "Laluan ini 510 m — 90 m lebih panjang, kira-kira 2 min lagi.",
      "Kami belum menyemak 38% laluan ini secara langsung, jadi mungkin ada perkara yang kami belum tahu.",
    ],
    easy: [
      "Laluan terpendek (420 m) ada tangga tanpa ramp, jadi laluan ini mengelaknya.",
      "Laluan ini 470 m — 50 m lebih panjang, kira-kira 1 min lagi.",
      "Kami belum menyemak 38% laluan ini secara langsung, jadi mungkin ada perkara yang kami belum tahu.",
    ],
    alt: [
      "Laluan ini 640 m — 130 m lebih panjang daripada laluan BeeAble, kira-kira 2 min lagi.",
      "Kami belum menyemak laluan ini secara langsung, jadi mungkin ada perkara yang kami belum tahu.",
    ],
  },
};

export function mockRoute(from: LatLng, to: LatLng, profile: Profile, lang: Language = "en"): RouteResponse {
  const mid: LatLng = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const off = profile === "step_free" ? 0.0015 : 0.0008;
  const detour: LatLng = [mid[0] + off, mid[1] - off];
  const other: LatLng = [mid[0] - off, mid[1] + off];
  const stepFree = profile === "step_free";
  const text = MOCK_TEXT[lang];
  return {
    shortest: {
      type: "FeatureCollection",
      features: [
        line([from, mid], { edge_id: "e1", source: "surveyed", surveyed: true }),
        line([mid, to], { edge_id: "e2", source: "surveyed", surveyed: true, barrier: text.steps, barrier_verified: true }),
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
      ? { shortest: { length_m: 420, cost: null, blocked_by: text.steps }, recommended: { length_m: 510, cost: 637.5 } }
      : { shortest: { length_m: 420, cost: 1260 }, recommended: { length_m: 470, cost: 587.5 } },
    explanation: stepFree ? text.stepFree : text.easy,
    surveyed_share: 0.62,
    alternative: {
      route: {
        type: "FeatureCollection",
        features: [
          line([from, other], { edge_id: "e5", source: "imported", surveyed: false }),
          line([other, to], { edge_id: "e6", source: "imported", surveyed: false }),
        ],
      },
      costs: { length_m: 640, cost: 960, known_barriers: 0 },
      explanation: text.alt,
      surveyed_share: 0,
    },
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
  {
    id: "r-003", reference_number: "BEE-003", lat: 5.7112, lng: 100.4478, photo_url: null,
    original_text: "Bangku baru depan Pusat Islam", language: "ms", status: "rejected", rejected_by: "ai", edge_id: null,
    source: "simulated", ai_source: "simulated", created_at: daysAgo(1), verified_at: null, resolved_at: null,
    ai: {
      is_accessibility_barrier: false, category: "not_a_barrier", severity: "low",
      affects: [], summary_en: "A new bench beside the path; the path itself is clear.",
      language_detected: "ms", possible_duplicate_of: null, privacy_flag: false, confidence: "high",
      reason: "Bench is off the walking line; nothing blocks the path.",
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
    // Mirrors the server: a clear, confident AI answer confirms the report without a staff step.
    original_text: body.text, language: "en", status: "verified", verified_by: "ai", edge_id: null, source: "reported",
    ai_source: "simulated",
    created_at: new Date().toISOString(), verified_at: new Date().toISOString(), resolved_at: null,
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

/** Like the server: staff accepting a report makes it a barrier, even if the AI said otherwise. */
function acceptedAi(ai: Report["ai"], status: ReportStatus): Report["ai"] {
  if (status !== "verified" || (ai.is_accessibility_barrier && ai.category !== "not_a_barrier")) return ai;
  return { ...ai, is_accessibility_barrier: true, category: ai.category === "not_a_barrier" ? "other" : ai.category };
}

export function mockPatchReport(id: string, status: Exclude<ReportStatus, "unverified">, edits?: ReportEdits): Report {
  const now = new Date().toISOString();
  reports = reports.map((r) =>
    r.id === id
      ? {
          ...r, status, ai: acceptedAi({ ...r.ai, ...edits }, status),
          verified_at: status === "verified" ? now : r.verified_at,
          verified_by: status === "verified" ? "staff" : r.verified_by,
          rejected_by: status === "rejected" ? "staff" : r.rejected_by, resolved_at: status === "resolved" ? now : r.resolved_at,
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
