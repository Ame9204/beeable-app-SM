import { useState, type KeyboardEvent } from "react";
import { api } from "../api";
import { Icon, type IconName } from "../components/Icon";
import { MapView, type MapFocus } from "../components/MapView";
import { useReports } from "../hooks/useReports";
import type { AISource, Priority, Report, ReportStatus } from "../types";

const AI_SOURCE_LABEL: Record<AISource, string> = {
  live: "Live AI",
  cached: "Cached AI",
  fallback: "No AI — needs categorising",
  simulated: "Simulated AI",
};

const TILES: { status: ReportStatus; label: string; icon: IconName }[] = [
  { status: "unverified", label: "To review", icon: "question" },
  { status: "verified", label: "Verified", icon: "alert" },
  { status: "in_progress", label: "Being fixed", icon: "wrench" },
  { status: "resolved", label: "Resolved", icon: "check" },
];

// Flagged items go to the top of the review queue (see CLAUDE.md > AI report intake).
function flags(r: Report): string[] {
  const out: string[] = [];
  if (r.ai.confidence === "low") out.push("Low AI confidence");
  if (r.ai.category === "not_a_barrier") out.push("AI: not a barrier");
  if (r.ai.privacy_flag) out.push("Privacy: faces or plates");
  if (r.ai.possible_duplicate_of !== null) out.push(`Possible duplicate of ${r.ai.possible_duplicate_of}`);
  return out;
}

type Tab = "queue" | "priorities";
const TAB_IDS: Tab[] = ["queue", "priorities"];

export function Insights() {
  const { reports, priorities, refresh } = useReports();
  const [tab, setTab] = useState<Tab>("queue");
  const [selected, setSelected] = useState<string>();
  const [focus, setFocus] = useState<MapFocus>();
  const [busy, setBusy] = useState<string | null>(null);
  const queue = reports
    .filter((r) => r.status === "unverified")
    .sort((a, b) => Number(flags(b).length > 0) - Number(flags(a).length > 0));

  function show(r: Report) {
    setSelected(r.id);
    setFocus({ at: [r.lat, r.lng], key: Date.now() });
  }

  async function decide(r: Report, status: Exclude<ReportStatus, "unverified">) {
    setBusy(r.id);
    try {
      await api.patchReport(r.id, status);
      await refresh();
      // Demo step 4: a verified barrier jumps straight into the ranked list.
      if (status === "verified") {
        setTab("priorities");
        show(r);
      }
    } finally {
      setBusy(null);
    }
  }

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + 1) % TAB_IDS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <div className="layout">
      <section className="panel" aria-labelledby="insights-heading">
        <header className="panel-head">
          <h1 id="insights-heading">Insights</h1>
          <p className="muted">Check new reports, then fix the barriers that block the most trips.</p>
        </header>

        <ul className="tiles" aria-label="Reports by status">
          {TILES.map((t) => (
            <li key={t.status} className={`tile tile-${t.status}`}>
              <Icon name={t.icon} size={18} />
              <span className="tile-num">{reports.filter((r) => r.status === t.status).length}</span>
              <span className="tile-label">{t.label}</span>
            </li>
          ))}
        </ul>

        <div className="tabs" role="tablist" aria-label="Dashboard sections" onKeyDown={onTabKey}>
          <button
            id="tab-queue"
            role="tab"
            aria-selected={tab === "queue"}
            aria-controls="panel-queue"
            tabIndex={tab === "queue" ? 0 : -1}
            onClick={() => setTab("queue")}
          >
            Review queue <span className="count">{queue.length}</span>
          </button>
          <button
            id="tab-priorities"
            role="tab"
            aria-selected={tab === "priorities"}
            aria-controls="panel-priorities"
            tabIndex={tab === "priorities" ? 0 : -1}
            onClick={() => setTab("priorities")}
          >
            Priorities <span className="count">{priorities.length}</span>
          </button>
        </div>

        {tab === "queue" ? (
          <div id="panel-queue" role="tabpanel" aria-labelledby="tab-queue">
            {queue.length === 0 && (
              <p className="empty">
                <Icon name="check" /> Nothing waiting for review.
              </p>
            )}
            <ul className="cards">
              {queue.map((r) => (
                <ReviewCard
                  key={r.id}
                  report={r}
                  selected={selected === r.id}
                  busy={busy === r.id}
                  onShow={() => show(r)}
                  onDecide={(s) => decide(r, s)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div id="panel-priorities" role="tabpanel" aria-labelledby="tab-priorities">
            <p className="muted formula">
              Score = severity × (1 + route criticality + near a key place) × √reports
            </p>
            {priorities.length === 0 && <p className="empty">No verified barriers yet.</p>}
            <ol className="cards">
              {priorities.map((p) => (
                <PriorityCard
                  key={p.report.id}
                  p={p}
                  max={priorities[0]?.score || 1}
                  selected={selected === p.report.id}
                  busy={busy === p.report.id}
                  onShow={() => show(p.report)}
                  onDecide={(s) => decide(p.report, s)}
                />
              ))}
            </ol>
          </div>
        )}
      </section>

      <MapView route={null} reports={reports} focus={focus} highlightId={selected} />
    </div>
  );
}

interface CardProps {
  selected: boolean;
  busy: boolean;
  onShow: () => void;
  onDecide: (s: Exclude<ReportStatus, "unverified">) => void;
}

function ReviewCard({ report: r, selected, busy, onShow, onDecide }: CardProps & { report: Report }) {
  const f = flags(r);
  return (
    <li className={`card review${selected ? " selected" : ""}${f.length ? " flagged" : ""}`}>
      <div className="review-top">
        {r.photo_url && <img src={r.photo_url} alt={`Photo for report ${r.reference_number}`} className="photo-thumb" />}
        <div className="review-text">
          <p className="review-title">
            {r.ai.category.replaceAll("_", " ")} <span className={`pill pill-${r.ai.severity}`}>{r.ai.severity}</span>
          </p>
          <p className="muted small-text">
            {r.reference_number} · AI confidence {r.ai.confidence}
          </p>
          <p className="quote">“{r.original_text}”</p>
        </div>
      </div>
      <div className="badges">
        {f.map((x) => (
          <span key={x} className="flag">
            <Icon name="alert" size={14} /> {x}
          </span>
        ))}
        {r.source === "simulated" && <span className="badge">Simulated</span>}
        <span className="badge">{AI_SOURCE_LABEL[r.ai_source]}</span>
      </div>
      <p className="muted small-text">{r.ai.reason}</p>
      <div className="actions">
        <button onClick={() => onDecide("verified")} disabled={busy}>
          <Icon name="check" size={18} /> Verify
        </button>
        <button className="secondary" onClick={() => onDecide("rejected")} disabled={busy}>
          <Icon name="x" size={18} /> Reject
        </button>
        <button className="secondary icon-only" onClick={onShow} aria-label={`Show ${r.reference_number} on map`}>
          <Icon name="pin" size={18} />
        </button>
      </div>
    </li>
  );
}

function PriorityCard({ p, max, selected, busy, onShow, onDecide }: CardProps & { p: Priority; max: number }) {
  const b = p.breakdown;
  const inProgress = p.report.status === "in_progress";
  return (
    <li className={`card priority${selected ? " selected" : ""}`}>
      <div className="priority-top">
        <span className="rank" aria-label={`Rank ${p.rank}`}>
          {p.rank}
        </span>
        <div className="priority-text">
          <p className="review-title">
            {p.report.ai.summary_en}
            {p.report.source === "simulated" && <span className="badge">Simulated</span>}
          </p>
          {inProgress && (
            <p className="small-text in-progress">
              <Icon name="wrench" size={14} /> Being fixed
            </p>
          )}
        </div>
        <span className="score">
          <span className="visually-hidden">Score </span>
          {p.score}
        </span>
      </div>
      <div className="score-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((100 * p.score) / max)}%` }} />
      </div>
      <dl className="breakdown">
        <div>
          <dt>Severity</dt>
          <dd>{b.severity}</dd>
        </div>
        <div>
          <dt>Route criticality</dt>
          <dd>{b.route_criticality}</dd>
        </div>
        <div>
          <dt>Near key place</dt>
          <dd>{b.poi_proximity ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Reports</dt>
          <dd>{b.report_count}</dd>
        </div>
      </dl>
      <p className="muted small-text">
        {b.severity} × (1 + {b.route_criticality} + {b.poi_proximity}) × √{b.report_count} = {p.score}
      </p>
      <div className="actions">
        {!inProgress && (
          <button className="secondary" onClick={() => onDecide("in_progress")} disabled={busy}>
            <Icon name="wrench" size={18} /> Start work
          </button>
        )}
        <button onClick={() => onDecide("resolved")} disabled={busy}>
          <Icon name="check" size={18} /> Mark resolved
        </button>
        <button className="secondary icon-only" onClick={onShow} aria-label={`Show ${p.report.reference_number} on map`}>
          <Icon name="pin" size={18} />
        </button>
      </div>
    </li>
  );
}
