import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../api";
import { Icon, type IconName } from "../components/Icon";
import { MapView, type MapFocus } from "../components/MapView";
import { CATEGORIES, INSIGHTS_REFRESH_MS } from "../config";
import { useReports } from "../hooks/useReports";
import type { AISource, Priority, Report, ReportEdits, ReportStatus } from "../types";

const AI_SOURCE_LABEL: Record<AISource, string> = {
  live: "Live AI",
  cached: "Cached AI",
  fallback: "No AI — needs categorising",
  simulated: "Simulated AI",
};

const STATUS: Record<ReportStatus, { label: string; icon: IconName }> = {
  unverified: { label: "To review", icon: "question" },
  verified: { label: "Verified", icon: "alert" },
  in_progress: { label: "Being fixed", icon: "wrench" },
  resolved: { label: "Resolved", icon: "check" },
  rejected: { label: "Rejected", icon: "x" },
};
const TILE_STATUSES: ReportStatus[] = ["unverified", "verified", "in_progress", "resolved"];
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 } as const;
const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 } as const;
const STATUS_ORDER: ReportStatus[] = ["unverified", "verified", "in_progress", "resolved", "rejected"];

const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id.replaceAll("_", " ");

// Flagged items go to the top of the review queue (see CLAUDE.md > AI report intake).
function flags(r: Report): string[] {
  const out: string[] = [];
  if (r.ai.confidence === "low") out.push("Low AI confidence");
  if (r.ai.category === "not_a_barrier") out.push("AI: not a barrier");
  if (r.ai.privacy_flag) out.push("Privacy: faces or plates");
  const likely = (r.similar ?? []).filter((m) => m.match === "likely");
  if (likely.length) out.push(`Likely same as ${likely.map((m) => m.reference_number).join(", ")}`);
  else if (r.similar?.length) out.push("Possible duplicate");
  else if (r.ai.possible_duplicate_of !== null) out.push(`AI: possible duplicate of ${r.ai.possible_duplicate_of}`);
  if (r.ai_source === "fallback") out.push("No AI answer");
  return out;
}

const isDuplicateFlag = (f: string) => f === "Possible duplicate" || f.startsWith("Likely same as");

function timeAgo(iso: string | Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type SortKey = "reported" | "severity" | "status" | "category" | "confidence" | "score";
type Tab = "reports" | "priorities";
const TAB_IDS: Tab[] = ["reports", "priorities"];

interface Filters {
  q: string;
  status: ReportStatus | "open" | "all";
  category: string;
  severity: string;
  flaggedOnly: boolean;
  duplicatesOnly: boolean;
}
const DEFAULT_FILTERS: Filters = { q: "", status: "open", category: "", severity: "", flaggedOnly: false, duplicatesOnly: false };

export function Insights() {
  const { reports, priorities, refresh, updatedAt, refreshing } = useReports({ refreshMs: INSIGHTS_REFRESH_MS });
  const [tab, setTab] = useState<Tab>("reports");
  const [selectedId, setSelectedId] = useState<string>();
  const [focus, setFocus] = useState<MapFocus>();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "reported", dir: -1 });
  const [newIds, setNewIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const known = useRef<Set<string> | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  // Keep "x min ago" fresh between refreshes.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Spot reports that arrived since the page loaded.
  useEffect(() => {
    if (!updatedAt) return;
    if (known.current === null) {
      known.current = new Set(reports.map((r) => r.id));
      return;
    }
    const fresh = reports.filter((r) => !known.current!.has(r.id)).map((r) => r.id);
    if (fresh.length) {
      fresh.forEach((id) => known.current!.add(id));
      setNewIds((cur) => [...cur, ...fresh]);
    }
  }, [reports, updatedAt]);

  const scoreById = useMemo(() => new Map(priorities.map((p) => [p.report.id, p])), [priorities]);
  const selected = reports.find((r) => r.id === selectedId);

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = reports.filter((r) => {
      if (filters.status === "open" ? r.status === "rejected" || r.status === "resolved" : filters.status !== "all" && r.status !== filters.status)
        return false;
      if (filters.category && r.ai.category !== filters.category) return false;
      if (filters.severity && r.ai.severity !== filters.severity) return false;
      if (filters.flaggedOnly && flags(r).length === 0) return false;
      if (filters.duplicatesOnly && !r.similar?.length) return false;
      if (q && ![r.reference_number, r.original_text, r.ai.summary_en, categoryLabel(r.ai.category)].some((t) => t.toLowerCase().includes(q)))
        return false;
      return true;
    });
    const value = (r: Report): number | string => {
      switch (sort.key) {
        case "reported": return new Date(r.created_at).getTime();
        case "severity": return SEVERITY_RANK[r.ai.severity];
        case "confidence": return CONFIDENCE_RANK[r.ai.confidence];
        case "status": return STATUS_ORDER.indexOf(r.status);
        case "category": return categoryLabel(r.ai.category);
        case "score": return scoreById.get(r.id)?.score ?? -1;
      }
    };
    return [...list].sort((a, b) => {
      const va = value(a), vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [reports, filters, sort, scoreById]);

  function select(r: Report) {
    setSelectedId(r.id);
    setFocus({ at: [r.lat, r.lng], key: Date.now() });
    setNewIds((cur) => cur.filter((id) => id !== r.id));
    // On narrow screens the detail panel is below the table.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1099px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function showNew() {
    setTab("reports");
    setFilters({ ...DEFAULT_FILTERS, status: "unverified" });
    setSort({ key: "reported", dir: -1 });
    setNewIds([]);
  }

  async function decide(r: Report, status: Exclude<ReportStatus, "unverified">, edits?: ReportEdits) {
    await api.patchReport(r.id, status, edits);
    await refresh();
    // Demo step 4: a verified barrier jumps straight into the ranked list.
    if (status === "verified" && r.status === "unverified") setTab("priorities");
  }

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + 1) % TAB_IDS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  function exportCsv() {
    const header = ["reference", "status", "category", "severity", "ai_confidence", "ai_source", "flags", "score", "summary", "resident_text", "lat", "lng", "reported_at", "verified_at", "resolved_at"];
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = rows.map((r) =>
      [r.reference_number, r.status, r.ai.category, r.ai.severity, r.ai.confidence, r.ai_source, flags(r).join("; "),
        scoreById.get(r.id)?.score ?? "", r.ai.summary_en, r.original_text, r.lat, r.lng, r.created_at, r.verified_at, r.resolved_at]
        .map(esc).join(","),
    );
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `beeable-reports-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="insights">
      <section className="ins-main" aria-labelledby="insights-heading">
        <header className="ins-head">
          <div>
            <h1 id="insights-heading">Insights</h1>
            <p className="muted">Check new reports, then fix the barriers that block the most trips.</p>
          </div>
          <div className="sync">
            <span className="muted small-text" aria-live="off">
              {updatedAt ? `Updated ${timeAgo(updatedAt, now)}` : "Loading…"} · refreshes every {INSIGHTS_REFRESH_MS / 1000} s
            </span>
            <button type="button" className="secondary small" onClick={refresh} disabled={refreshing}>
              <Icon name="refresh" size={18} /> {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        <div aria-live="polite">
          {newIds.length > 0 && (
            <p className="new-banner">
              <Icon name="info" size={20} />
              <span>
                <strong>{newIds.length} new report{newIds.length > 1 ? "s" : ""}</strong> since you opened this page.
              </span>
              <button type="button" className="small" onClick={showNew}>
                Show
              </button>
            </p>
          )}
        </div>

        <ul className="tiles" aria-label="Reports by status (select to filter)">
          {TILE_STATUSES.map((s) => (
            <li key={s}>
              <button
                type="button"
                className={`tile tile-${s}`}
                aria-pressed={filters.status === s}
                onClick={() => {
                  setTab("reports");
                  setFilters((f) => ({ ...f, status: f.status === s ? "open" : s }));
                }}
              >
                <Icon name={STATUS[s].icon} size={18} />
                <span className="tile-num">{reports.filter((r) => r.status === s).length}</span>
                <span className="tile-label">{STATUS[s].label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="tabs" role="tablist" aria-label="Dashboard sections" onKeyDown={onTabKey}>
          <button id="tab-reports" role="tab" aria-selected={tab === "reports"} aria-controls="panel-reports" tabIndex={tab === "reports" ? 0 : -1} onClick={() => setTab("reports")}>
            All reports <span className="count">{reports.length}</span>
          </button>
          <button id="tab-priorities" role="tab" aria-selected={tab === "priorities"} aria-controls="panel-priorities" tabIndex={tab === "priorities" ? 0 : -1} onClick={() => setTab("priorities")}>
            Priorities <span className="count">{priorities.length}</span>
          </button>
        </div>

        {tab === "reports" ? (
          <div id="panel-reports" role="tabpanel" aria-labelledby="tab-reports">
            <div className="filters" role="search" aria-label="Filter reports">
              <div className="filter search-filter">
                <label htmlFor="f-q">Search</label>
                <input id="f-q" type="search" placeholder="Reference, text or summary" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              </div>
              <div className="filter">
                <label htmlFor="f-status">Status</label>
                <select id="f-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}>
                  <option value="open">Open (not closed)</option>
                  <option value="all">All</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="filter">
                <label htmlFor="f-cat">Category</label>
                <select id="f-cat" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                  <option value="">Any</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter">
                <label htmlFor="f-sev">Severity</label>
                <select id="f-sev" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
                  <option value="">Any</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <label className="filter-check">
                <input type="checkbox" checked={filters.flaggedOnly} onChange={(e) => setFilters({ ...filters, flaggedOnly: e.target.checked })} />
                Flagged only
              </label>
              <label className="filter-check">
                <input type="checkbox" checked={filters.duplicatesOnly} onChange={(e) => setFilters({ ...filters, duplicatesOnly: e.target.checked })} />
                Possible duplicates
              </label>
            </div>
            <div className="table-bar">
              <p className="muted small-text" role="status">
                Showing {rows.length} of {reports.length} reports
              </p>
              {filtersActive && (
                <button type="button" className="link-button small" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear filters
                </button>
              )}
              <button type="button" className="secondary small" onClick={exportCsv} disabled={rows.length === 0}>
                <Icon name="download" size={18} /> Export CSV
              </button>
            </div>

            <ReportsTable rows={rows} sort={sort} setSort={setSort} selectedId={selectedId} newIds={newIds} scoreById={scoreById} now={now} onSelect={select} />
          </div>
        ) : (
          <div id="panel-priorities" role="tabpanel" aria-labelledby="tab-priorities">
            <p className="muted formula">Score = severity × (1 + route criticality + near a key place) × √reports</p>
            <PrioritiesTable priorities={priorities} selectedId={selectedId} onSelect={select} />
          </div>
        )}
      </section>

      <aside className="ins-side" aria-label="Report details and map">
        <section ref={detailRef} className="detail-wrap" aria-labelledby="detail-heading" tabIndex={-1}>
          {selected ? (
            <ReportDetail
              key={selected.id}
              report={selected}
              priority={scoreById.get(selected.id)}
              allReports={reports}
              onSelect={select}
              onDecide={decide}
              onClose={() => setSelectedId(undefined)}
            />
          ) : (
            <div className="detail-empty">
              <h2 id="detail-heading">No report selected</h2>
              <p className="muted">Pick a row to see the photo, the AI suggestion and actions.</p>
            </div>
          )}
        </section>
        <div className="ins-map">
          <MapView route={null} reports={reports} focus={focus} highlightId={selectedId} />
        </div>
      </aside>
    </div>
  );
}

function SortHeader({ k, label, sort, setSort }: { k: SortKey; label: string; sort: { key: SortKey; dir: 1 | -1 }; setSort: (s: { key: SortKey; dir: 1 | -1 }) => void }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="sort" onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : k === "category" ? 1 : -1 })}>
        {label}
        <Icon name={active && sort.dir === 1 ? "chevronUp" : "chevronDown"} size={16} className={active ? undefined : "sort-idle"} />
      </button>
    </th>
  );
}

function StatusPill({ status }: { status: ReportStatus }) {
  return (
    <span className={`status-pill sp-${status}`}>
      <Icon name={STATUS[status].icon} size={14} /> {STATUS[status].label}
    </span>
  );
}

function ReportsTable({
  rows, sort, setSort, selectedId, newIds, scoreById, now, onSelect,
}: {
  rows: Report[];
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  selectedId?: string;
  newIds: string[];
  scoreById: Map<string, Priority>;
  now: number;
  onSelect: (r: Report) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        <Icon name="check" /> No reports match these filters.
      </p>
    );
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Reports. Select a reference to see details.</caption>
        <thead>
          <tr>
            <th scope="col">Report</th>
            <SortHeader k="category" label="Barrier" sort={sort} setSort={setSort} />
            <SortHeader k="severity" label="Severity" sort={sort} setSort={setSort} />
            <SortHeader k="status" label="Status" sort={sort} setSort={setSort} />
            <SortHeader k="confidence" label="AI" sort={sort} setSort={setSort} />
            <SortHeader k="score" label="Score" sort={sort} setSort={setSort} />
            <SortHeader k="reported" label="Reported" sort={sort} setSort={setSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // The duplicate chip already says this, so leave it out of the flag line.
            const f = flags(r).filter((x) => !(r.similar?.length && isDuplicateFlag(x)));
            const p = scoreById.get(r.id);
            return (
              <tr key={r.id} className={r.id === selectedId ? "row-selected" : undefined} onClick={() => onSelect(r)}>
                <td>
                  <div className="cell-report">
                    {r.photo_url ? <img src={r.photo_url} alt="" className="row-thumb" loading="lazy" /> : <span className="row-thumb no-photo" aria-hidden="true"><Icon name="image" size={18} /></span>}
                    <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); onSelect(r); }} aria-current={r.id === selectedId ? "true" : undefined}>
                      {r.reference_number}
                    </button>
                    {newIds.includes(r.id) && <span className="new-tag">New</span>}
                  </div>
                </td>
                <td>
                  <span className="cell-strong">{categoryLabel(r.ai.category)}</span>
                  <span className="cell-sub">{r.ai.summary_en}</span>
                  {r.similar && r.similar.length > 0 && (
                    <span className={`dup-chip${r.similar.some((m) => m.match === "likely") ? " dup-likely" : ""}`}>
                      <Icon name="copy" size={14} /> {r.similar.some((m) => m.match === "likely") ? "Likely duplicate" : "Possible duplicate"} ({r.similar.length})
                    </span>
                  )}
                  {f.length > 0 && (
                    <span className="cell-flags">
                      <Icon name="alert" size={14} /> {f.join(" · ")}
                    </span>
                  )}
                </td>
                <td><span className={`pill pill-${r.ai.severity}`}>{r.ai.severity}</span></td>
                <td><StatusPill status={r.status} /></td>
                <td>
                  <span className="cell-strong cap">{r.ai.confidence}</span>
                  <span className="cell-sub">{AI_SOURCE_LABEL[r.ai_source]}</span>
                </td>
                <td className="num">{p ? p.score : <span className="muted">—</span>}</td>
                <td>
                  <span title={fullDate(r.created_at)}>{timeAgo(r.created_at, now)}</span>
                  {r.source === "simulated" && <span className="badge">Simulated</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrioritiesTable({ priorities, selectedId, onSelect }: { priorities: Priority[]; selectedId?: string; onSelect: (r: Report) => void }) {
  if (priorities.length === 0) return <p className="empty">No verified barriers yet.</p>;
  const max = priorities[0]?.score || 1;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Verified barriers ranked by priority score</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Barrier</th>
            <th scope="col" className="num">Severity</th>
            <th scope="col" className="num">Route criticality</th>
            <th scope="col">Near key place</th>
            <th scope="col" className="num">Reports</th>
            <th scope="col">Score</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {priorities.map((p) => (
            <tr key={p.report.id} className={p.report.id === selectedId ? "row-selected" : undefined} onClick={() => onSelect(p.report)}>
              <td><span className="rank">{p.rank}</span></td>
              <td>
                <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); onSelect(p.report); }}>
                  {categoryLabel(p.report.ai.category)}
                </button>
                <span className="cell-sub">{p.report.reference_number} · {p.report.ai.summary_en}</span>
                {p.report.source === "simulated" && <span className="badge">Simulated</span>}
              </td>
              <td className="num">{p.breakdown.severity}</td>
              <td className="num">{p.breakdown.route_criticality}</td>
              <td>{p.breakdown.poi_proximity ? "Yes" : "No"}</td>
              <td className="num">{p.breakdown.report_count}</td>
              <td>
                <span className="score-cell">
                  <strong>{p.score}</strong>
                  <span className="score-bar" aria-hidden="true"><span style={{ width: `${Math.round((100 * p.score) / max)}%` }} /></span>
                </span>
              </td>
              <td><StatusPill status={p.report.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportDetail({
  report: r, priority, allReports, onSelect, onDecide, onClose,
}: {
  report: Report;
  priority?: Priority;
  allReports: Report[];
  onSelect: (r: Report) => void;
  onDecide: (r: Report, s: Exclude<ReportStatus, "unverified">, edits?: ReportEdits) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(r.ai.category);
  const [severity, setSeverity] = useState(r.ai.severity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = flags(r);
  const changed = category !== r.ai.category || severity !== r.ai.severity;

  async function act(status: Exclude<ReportStatus, "unverified">, duplicateOf?: string) {
    setBusy(true);
    setError(null);
    const edits: ReportEdits | undefined =
      changed || duplicateOf
        ? {
            ...(changed ? { category, severity, is_accessibility_barrier: category !== "not_a_barrier" } : {}),
            ...(duplicateOf ? { possible_duplicate_of: duplicateOf } : {}),
          }
        : undefined;
    try {
      await onDecide(r, status, edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the report.");
    } finally {
      setBusy(false);
    }
  }

  const b = priority?.breakdown;
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2 id="detail-heading">{r.reference_number}</h2>
          <StatusPill status={r.status} />
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close details">
          <Icon name="x" />
        </button>
      </div>

      {r.photo_url ? (
        <a href={r.photo_url} target="_blank" rel="noreferrer" className="detail-photo">
          <img src={r.photo_url} alt={`Photo for report ${r.reference_number}`} />
          <span className="visually-hidden"> (opens full size)</span>
        </a>
      ) : (
        <p className="muted small-text">No photo.</p>
      )}

      <h3>Resident wrote</h3>
      <p className="quote">{r.original_text.trim() ? `“${r.original_text}”` : "Nothing — photo only."}</p>

      <h3>AI suggestion</h3>
      <p>{r.ai.summary_en}</p>
      <p className="muted small-text">{r.ai.reason}</p>
      <div className="badges">
        <span className="badge">{AI_SOURCE_LABEL[r.ai_source]}</span>
        <span className="badge">Confidence: {r.ai.confidence}</span>
        {r.ai.affects.length > 0 && <span className="badge">Affects: {r.ai.affects.join(", ").replaceAll("_", " ")}</span>}
        {f.map((x) => (
          <span key={x} className="flag"><Icon name="alert" size={14} /> {x}</span>
        ))}
      </div>

      <div className="detail-edit">
        <div className="filter">
          <label htmlFor="d-cat">Category</label>
          <select id="d-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="d-sev">Severity</label>
          <select id="d-sev" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      {changed && (
        <p className="hint">
          <Icon name="info" size={16} /> Your correction is saved with the next action and logged next to the AI answer.
        </p>
      )}

      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="actions">
        {r.status === "unverified" && (
          <>
            <button type="button" onClick={() => act("verified")} disabled={busy}><Icon name="check" size={18} /> Verify</button>
            <button type="button" className="secondary" onClick={() => act("rejected")} disabled={busy}><Icon name="x" size={18} /> Reject</button>
          </>
        )}
        {r.status === "verified" && (
          <>
            <button type="button" className="secondary" onClick={() => act("in_progress")} disabled={busy}><Icon name="wrench" size={18} /> Start work</button>
            <button type="button" onClick={() => act("resolved")} disabled={busy}><Icon name="check" size={18} /> Mark resolved</button>
          </>
        )}
        {r.status === "in_progress" && (
          <button type="button" onClick={() => act("resolved")} disabled={busy}><Icon name="check" size={18} /> Mark resolved</button>
        )}
        {(r.status === "resolved" || r.status === "rejected") && (
          <button type="button" className="secondary" onClick={() => act("verified")} disabled={busy}><Icon name="refresh" size={18} /> Reopen</button>
        )}
      </div>
      {r.status === "verified" && (
        <button type="button" className="link-button small" onClick={() => act("rejected")} disabled={busy}>
          Reject instead
        </button>
      )}

      {r.similar && r.similar.length > 0 && (
        <>
          <h3>Possibly the same problem</h3>
          <p className="muted small-text">Open reports close by, sent around the same time, with the same or a related type.</p>
          <ul className="similar-list">
            {r.similar.map((m) => {
              const other = allReports.find((o) => o.id === m.id);
              return (
                <li key={m.id} className={m.match === "likely" ? "similar-likely" : undefined}>
                  <div className="similar-top">
                    <span className={`dup-chip${m.match === "likely" ? " dup-likely" : ""}`}>
                      {m.match === "likely" ? "Likely same" : "Possibly same"}
                    </span>
                    {other ? (
                      <button type="button" className="row-link" onClick={() => onSelect(other)}>
                        {m.reference_number}
                      </button>
                    ) : (
                      <strong>{m.reference_number}</strong>
                    )}
                    {other && <StatusPill status={other.status} />}
                  </div>
                  <p className="small-text">
                    {other ? `${categoryLabel(other.ai.category)} · ` : ""}
                    {m.reason}
                  </p>
                  {r.status === "unverified" && (
                    <button type="button" className="secondary small" onClick={() => act("rejected", m.id)} disabled={busy}>
                      <Icon name="copy" size={16} /> Reject as duplicate of {m.reference_number}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {b && priority && (
        <>
          <h3>Priority #{priority.rank} · score {priority.score}</h3>
          <dl className="breakdown">
            <div><dt>Severity</dt><dd>{b.severity}</dd></div>
            <div><dt>Route criticality</dt><dd>{b.route_criticality}</dd></div>
            <div><dt>Near key place</dt><dd>{b.poi_proximity ? "Yes" : "No"}</dd></div>
            <div><dt>Reports</dt><dd>{b.report_count}</dd></div>
          </dl>
          <p className="muted small-text">
            {b.severity} × (1 + {b.route_criticality} + {b.poi_proximity}) × √{b.report_count} = {priority.score}
          </p>
        </>
      )}

      <h3>History</h3>
      <ol className="history">
        <li><strong>Reported</strong> {fullDate(r.created_at)}</li>
        {r.verified_at && <li><strong>Verified</strong> {fullDate(r.verified_at)}</li>}
        {r.resolved_at && <li><strong>Resolved</strong> {fullDate(r.resolved_at)}</li>}
      </ol>
      <p className="muted small-text">
        Location {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
      </p>
    </div>
  );
}
