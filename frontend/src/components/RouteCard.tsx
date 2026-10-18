import { useEffect, useRef } from "react";
import { WALK_SPEED_MPS } from "../config";
import type { PathCost, RouteResponse } from "../types";
import { Icon, type IconName } from "./Icon";

const minutes = (m: number) => Math.max(1, Math.round(m / WALK_SPEED_MPS / 60));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function RouteCard({ route }: { route: RouteResponse }) {
  const ref = useRef<HTMLElement>(null);
  // On phones the card can start below the fold of the sheet; bring each new route into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [route]);
  const rec = route.costs.recommended;
  const surveyed = Math.round(route.surveyed_share * 100);

  // Never call a route "accessible" — see CLAUDE.md.
  let status: { tone: string; icon: IconName; text: string } = {
    tone: "ok",
    icon: "check",
    text: "No known barriers for your profile",
  };
  if (rec.least_bad) {
    status = { tone: "danger", icon: "alert", text: `No route avoids every barrier. Least-bad option: passes ${rec.blocked_by}` };
  } else if ((rec.known_barriers ?? 0) > 0) {
    status = { tone: "warn", icon: "alert", text: "Best route we found, but it still has known barriers" };
  }

  return (
    <article ref={ref} className="route-card" aria-label="Recommended route">
      <div className="route-head">
        <p className="route-time">
          ~{minutes(rec.length_m)} <span>min</span>
        </p>
        <p className="route-dist">{rec.length_m} m · BeeAble route</p>
      </div>

      <p className={`status status-${status.tone}`} role={status.tone === "danger" ? "alert" : undefined}>
        <Icon name={status.icon} size={20} /> <span>{status.text}</span>
      </p>

      <div className="meter-row">
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${surveyed}%` }} />
        </div>
        <p className="meter-label">
          <strong>{surveyed}%</strong> of this route checked in person. The rest is unknown (dashed on the map).
        </p>
      </div>

      <Compare shortest={route.costs.shortest} recommended={rec} />

      <details className="why" open>
        <summary>
          <Icon name="info" size={20} /> Why this route?
        </summary>
        <ul>
          {route.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/** One line on how the plain shortest path compares, so "the shortest has steps" is clear without the map. */
function Compare({ shortest, recommended }: { shortest: PathCost; recommended: PathCost }) {
  if (shortest.length_m === recommended.length_m && !shortest.blocked_by) {
    return <p className="compare">This is also the shortest route.</p>;
  }
  let issue = "no known barriers";
  if (shortest.blocked_by) issue = `passes ${shortest.blocked_by}`;
  else if ((shortest.known_barriers ?? 0) > 0) issue = plural(shortest.known_barriers!, "known barrier");
  const extra = recommended.length_m - shortest.length_m;
  return (
    <p className="compare">
      <span className="compare-swatch" aria-hidden="true" />
      <span>
        <strong>Shortest route:</strong> {shortest.length_m} m, {issue}.
        {extra > 0 && ` Ours adds about ${extra} m (~${minutes(extra)} min).`}
      </span>
    </p>
  );
}

export function RouteSkeleton() {
  return (
    <div className="route-card skeleton" aria-hidden="true">
      <span className="sk sk-lg" />
      <span className="sk" />
      <span className="sk" />
      <span className="sk sk-short" />
    </div>
  );
}
