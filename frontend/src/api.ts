// API client. Falls back to in-browser mocks when the backend is unreachable or USE_MOCKS is set.
import { API_URL, USE_MOCKS } from "./config";
import * as mocks from "./mocks";
import type { Language } from "./account";
import type {
  AnalyseRequest, Analysis, Priority, Profile, Report, ReportCreate, ReportEdits, ReportStatus, RouteResponse,
} from "./types";

/** Fired when a request falls back to in-browser sample data, so the UI can say so. */
export const MOCK_FALLBACK_EVENT = "beeable:mock-fallback";

async function request<T>(path: string, init: RequestInit | undefined, fallback: () => T): Promise<T> {
  if (USE_MOCKS) return fallback();
  try {
    const isJson = typeof init?.body === "string";
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(isJson ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof TypeError) {
      // network error: API not running
      console.warn(`[api] ${path} unreachable, using mock data`);
      window.dispatchEvent(new Event(MOCK_FALLBACK_EVENT));
      return fallback();
    }
    throw err;
  }
}

export const api = {
  /** `lang` picks the language of the explanation and barrier text. */
  route: (from: [number, number], to: [number, number], profile: Profile, lang: Language = "en") =>
    request<RouteResponse>(
      `/route?from=${from.join(",")}&to=${to.join(",")}&profile=${profile}&lang=${lang}`,
      undefined,
      () => mocks.mockRoute(from, to, profile, lang),
    ),

  listReports: (status?: ReportStatus) =>
    request<Report[]>(`/reports${status ? `?status=${status}` : ""}`, undefined, () =>
      mocks.mockListReports(status),
    ),

  /** Server resizes to ≤1024 px and strips EXIF. Mock mode keeps no photo. */
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ photo_url: string | null }>("/uploads", { method: "POST", body: form }, () => ({
      photo_url: null,
    }));
  },

  /** AI reads the uploaded photo (and any text) before sending. A suggestion only. */
  analyse: (body: AnalyseRequest) =>
    request<Analysis>("/reports/analyse", { method: "POST", body: JSON.stringify(body) }, () =>
      mocks.mockAnalyse(body),
    ),

  createReport: (body: ReportCreate) =>
    request<Report>("/reports", { method: "POST", body: JSON.stringify(body) }, () =>
      mocks.mockCreateReport(body),
    ),

  /** `edits` are staff corrections to the AI fields (e.g. category, severity); logged next to the AI answer. */
  patchReport: (id: string, status: Exclude<ReportStatus, "unverified">, edits?: ReportEdits) =>
    request<Report>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status, edits }) }, () =>
      mocks.mockPatchReport(id, status, edits),
    ),

  priorities: () => request<Priority[]>("/priorities", undefined, mocks.mockPriorities),
};
