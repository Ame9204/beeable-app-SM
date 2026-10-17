import { useEffect, useRef, useState } from "react";
import { MapView } from "../components/MapView";
import { RouteLegend } from "../components/RouteLegend";
import { DESTINATIONS, PROFILES, WALK_SPEED_MPS } from "../config";
import { LOCATION_MESSAGE, useLocation } from "../hooks/useLocation";
import { useReports } from "../hooks/useReports";
import { useRoute } from "../hooks/useRoute";
import type { Profile, RouteResponse } from "../types";

const PROFILE_ICON: Record<Profile, string> = { step_free: "♿", easy_walking: "🚶" };
const DEST_ICON: Record<string, string> = { clinic: "🏥", mosque_surau: "🕌", bus_stop: "🚌" };

export function NavigatePage() {
  const [profile, setProfile] = useState<Profile>("step_free");
  const [destId, setDestId] = useState<string>("");
  const dest = DESTINATIONS.find((d) => d.id === destId);
  const to: [number, number] | null = dest ? [dest.lat, dest.lng] : null;
  const location = useLocation();
  const { route, loading, error, version } = useRoute(location.position, to, profile);
  const { reports } = useReports();

  function chooseDestination(id: string) {
    setDestId(id);
    // Ask for location the first time it's needed, not on app start.
    if (location.status !== "ok") location.locate();
  }

  return (
    <div className="navigate">
      <MapView
        route={route}
        reports={reports}
        origin={location.position}
        destination={to}
        routeKey={String(version)}
      />

      <section className="sheet" aria-labelledby="nav-heading">
        <div className="sheet-handle" aria-hidden="true" />
        <h1 id="nav-heading" className="sheet-title">
          Plan a walk
        </h1>

        <fieldset className="segmented">
          <legend>How do you get around?</legend>
          {PROFILES.map((p) => (
            <label key={p.id} className="segment">
              <input
                type="radio"
                name="profile"
                value={p.id}
                checked={profile === p.id}
                onChange={() => setProfile(p.id)}
              />
              <span className="segment-body">
                <span className="segment-icon" aria-hidden="true">
                  {PROFILE_ICON[p.id]}
                </span>
                <span className="segment-label">{p.label}</span>
                <span className="segment-hint">{p.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="chips">
          <legend>Where to?</legend>
          <div className="chip-row">
            {DESTINATIONS.map((d) => (
              <label key={d.id} className="chip">
                <input
                  type="radio"
                  name="destination"
                  value={d.id}
                  checked={destId === d.id}
                  onChange={() => chooseDestination(d.id)}
                />
                <span>
                  <span aria-hidden="true">{DEST_ICON[d.type] ?? "📍"}</span> {d.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="route-area">
          {!destId && <p className="hint">Pick a destination to see the route that suits you.</p>}
          {destId && location.status !== "idle" && location.status !== "ok" && (
            <p className="hint">📍 {LOCATION_MESSAGE[location.status]}</p>
          )}
          {loading && <p className="hint">Finding a route…</p>}
          {error && (
            <p className="notice notice-error" role="alert">
              Could not load a route: {error}
            </p>
          )}
          {route && !loading && <RouteCard route={route} />}
        </div>
      </section>
    </div>
  );
}

function RouteCard({ route }: { route: RouteResponse }) {
  const ref = useRef<HTMLElement>(null);
  // On phones the card starts below the fold of the sheet; bring each new route into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [route]);
  const rec = route.costs.recommended;
  const minutes = Math.max(1, Math.round(rec.length_m / WALK_SPEED_MPS / 60));
  const surveyed = Math.round(route.surveyed_share * 100);

  // Never call a route "accessible" — see CLAUDE.md.
  let status = { tone: "ok", icon: "✓", text: "No known barriers for your profile" };
  if (rec.least_bad) {
    status = { tone: "danger", icon: "⚠", text: `No route avoids every barrier. Least-bad option: passes ${rec.blocked_by}` };
  } else if ((rec.known_barriers ?? 0) > 0) {
    status = { tone: "warn", icon: "⚠", text: "Best route we found, but it still has known barriers" };
  }

  return (
    <article ref={ref} className="route-card" aria-label="Recommended route">
      <dl className="stats">
        <div>
          <dt>Distance</dt>
          <dd>{rec.length_m} m</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>~{minutes} min</dd>
        </div>
        <div>
          <dt>Surveyed</dt>
          <dd>{surveyed}%</dd>
        </div>
      </dl>
      <p className={`status status-${status.tone}`} role={status.tone === "danger" ? "alert" : undefined}>
        <span aria-hidden="true">{status.icon}</span> {status.text}
      </p>
      <details className="why" open>
        <summary>Why this route?</summary>
        <ul>
          {route.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <details className="why">
        <summary>Map key</summary>
        <RouteLegend />
      </details>
    </article>
  );
}
