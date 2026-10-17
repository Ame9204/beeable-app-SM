import { api } from "../api";
import { MapView } from "../components/MapView";
import { useReports } from "../hooks/useReports";
import type { AISource, Report, ReportStatus } from "../types";

const AI_SOURCE_LABEL: Record<AISource, string> = {
  live: "Live AI",
  cached: "Cached AI",
  fallback: "No AI — needs categorising",
  simulated: "Simulated AI",
};

// Flagged items go to the top of the review queue (see CLAUDE.md > AI report intake).
const needsAttention = (r: Report) =>
  r.ai.confidence === "low" ||
  r.ai.category === "not_a_barrier" ||
  r.ai.privacy_flag ||
  r.ai.possible_duplicate_of !== null;

export function Insights() {
  const { reports, priorities, refresh } = useReports();
  const queue = reports
    .filter((r) => r.status === "unverified")
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));

  async function decide(id: string, status: Exclude<ReportStatus, "unverified">) {
    await api.patchReport(id, status);
    await refresh();
  }

  return (
    <div className="layout">
      <section className="panel" aria-labelledby="insights-heading">
        <h1 id="insights-heading">Insights</h1>

        <h2>Review queue ({queue.length})</h2>
        {queue.length === 0 && <p>Nothing waiting for review.</p>}
        <ul className="cards">
          {queue.map((r) => (
            <li key={r.id} className="card">
              <p>
                <strong>{r.reference_number}</strong> · AI suggests{" "}
                <strong>{r.ai.category.replaceAll("_", " ")}</strong> ({r.ai.severity}, confidence{" "}
                {r.ai.confidence})
                {needsAttention(r) && <span className="flag"> ⚠ Needs attention</span>}
                {r.source === "simulated" && <span className="badge">Simulated</span>}
                <span className="badge">{AI_SOURCE_LABEL[r.ai_source]}</span>
              </p>
              {r.photo_url && <img src={r.photo_url} alt={`Photo for report ${r.reference_number}`} className="photo-thumb" />}
              <p>“{r.original_text}”</p>
              <p className="muted">{r.ai.reason}</p>
              <div className="actions">
                <button onClick={() => decide(r.id, "verified")}>Verify</button>
                <button className="secondary" onClick={() => decide(r.id, "rejected")}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>

        <h2>Priorities</h2>
        <div className="table-wrap">
          <table>
            <caption>Verified barriers ranked by priority score</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Barrier</th>
                <th scope="col">Score</th>
                <th scope="col">Breakdown</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map((p) => (
                <tr key={p.report.id}>
                  <td>{p.rank}</td>
                  <td>
                    {p.report.ai.summary_en}
                    {p.report.source === "simulated" && <span className="badge">Simulated</span>}
                  </td>
                  <td>{p.score}</td>
                  <td className="muted">
                    severity {p.breakdown.severity} × (1 + criticality {p.breakdown.route_criticality} + POI{" "}
                    {p.breakdown.poi_proximity}) × √{p.breakdown.report_count} reports
                  </td>
                  <td>
                    <button onClick={() => decide(p.report.id, "resolved")}>Mark resolved</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <MapView route={null} reports={reports} />
    </div>
  );
}
