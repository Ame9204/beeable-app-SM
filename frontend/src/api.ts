// API client. Falls back to in-browser mocks when the backend is unreachable or USE_MOCKS is set.
import { API_URL, USE_MOCKS } from "./config";
import * as mocks from "./mocks";
import type { Priority, Profile, Report, ReportCreate, ReportStatus, RouteResponse } from "./types";

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
  route: (from: [number, number], to: [number, number], profile: Profile) =>
    request<RouteResponse>(
      `/route?from=${from.join(",")}&to=${to.join(",")}&profile=${profile}`,
      undefined,
      () => mocks.mockRoute(from, to, profile),
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

  createReport: (body: ReportCreate) =>
    request<Report>("/reports", { method: "POST", body: JSON.stringify(body) }, () =>
      mocks.mockCreateReport(body),
    ),

  patchReport: (id: string, status: Exclude<ReportStatus, "unverified">) =>
    request<Report>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, () =>
      mocks.mockPatchReport(id, status),
    ),

  priorities: () => request<Priority[]>("/priorities", undefined, mocks.mockPriorities),
};
