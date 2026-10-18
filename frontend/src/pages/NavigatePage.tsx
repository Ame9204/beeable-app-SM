import { useState } from "react";
import { Icon, POI_ICON } from "../components/Icon";
import { MapView, type MapFocus } from "../components/MapView";
import { ProfilePicker } from "../components/ProfilePicker";
import { RouteCard, RouteSkeleton } from "../components/RouteCard";
import { RouteLegend } from "../components/RouteLegend";
import { DESTINATIONS } from "../config";
import { LOCATION_MESSAGE, distanceM, useLocation } from "../hooks/useLocation";
import { useReports } from "../hooks/useReports";
import { useRoute } from "../hooks/useRoute";
import { useSheet } from "../hooks/useSheet";
import type { Profile } from "../types";

const PROFILE_KEY = "beeable.profile";
const POI_LABEL: Record<string, string> = { clinic: "Clinic", mosque_surau: "Surau", bus_stop: "Bus stop" };

function savedProfile(): Profile {
  try {
    const p = localStorage.getItem(PROFILE_KEY);
    if (p === "step_free" || p === "easy_walking") return p;
  } catch {
    /* storage blocked: fall through */
  }
  return "step_free";
}

export function NavigatePage() {
  const [profile, setProfileState] = useState<Profile>(savedProfile);
  const [destId, setDestId] = useState<string>("");
  const [legendOpen, setLegendOpen] = useState(false);
  const [focus, setFocus] = useState<MapFocus>();
  const dest = DESTINATIONS.find((d) => d.id === destId);
  const to: [number, number] | null = dest ? [dest.lat, dest.lng] : null;
  const location = useLocation();
  const { route, loading, error, version } = useRoute(location.position, to, profile);
  const { reports } = useReports();
  const sheet = useSheet("half");

  function setProfile(p: Profile) {
    setProfileState(p);
    try {
      localStorage.setItem(PROFILE_KEY, p);
    } catch {
      /* not essential */
    }
  }

  function chooseDestination(id: string) {
    setDestId(id);
    sheet.setSnap("half");
    // Ask for location the first time it's needed, not on app start.
    if (location.status !== "ok") location.locate();
  }

  async function locateMe() {
    const at = await location.locate();
    setFocus({ at, key: Date.now() });
  }

  const locationNote =
    location.status !== "idle" && location.status !== "ok" ? LOCATION_MESSAGE[location.status] : null;

  return (
    <div className="navigate">
      <MapView
        route={route}
        reports={reports}
        origin={location.position}
        destination={to}
        destinationType={dest?.type}
        focus={focus}
        routeKey={String(version)}
      />

      <div className="map-tools">
        <button type="button" className="fab" onClick={locateMe} aria-label="Show my location">
          <Icon name="locate" />
        </button>
        <button
          type="button"
          className="fab"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-controls="map-key"
          aria-label="Map key"
        >
          <Icon name="layers" />
        </button>
        {legendOpen && (
          <div id="map-key" className="map-key card" role="region" aria-label="Map key">
            <div className="map-key-head">
              <h2>Map key</h2>
              <button type="button" className="icon-button" onClick={() => setLegendOpen(false)} aria-label="Close map key">
                <Icon name="x" />
              </button>
            </div>
            <RouteLegend />
          </div>
        )}
      </div>

      <section className={`sheet sheet-${sheet.snap}`} aria-labelledby="nav-heading">
        <button type="button" className="sheet-handle" {...sheet.handleProps}>
          <span className="sheet-grip" aria-hidden="true" />
          <span className="visually-hidden">{sheet.snap === "full" ? "Shrink panel" : "Expand panel"}</span>
        </button>

        {!dest ? (
          <>
            <h1 id="nav-heading" className="sheet-title">
              Where would you like to go?
            </h1>
            <ProfilePicker profile={profile} onChange={setProfile} />
            <h2 className="list-heading">Destination</h2>
            {/* Buttons, not radios: arrowing through radios would start a route for each one. */}
            <ul className="dest-list">
              {DESTINATIONS.map((d) => (
                <li key={d.id}>
                  <button type="button" className="dest" onClick={() => chooseDestination(d.id)}>
                    <span className="dest-icon">
                      <Icon name={POI_ICON[d.type] ?? "pin"} />
                    </span>
                    <span className="dest-text">
                      <span className="dest-name">{d.name}</span>
                      <span className="dest-meta">
                        {POI_LABEL[d.type] ?? "Place"}
                        {location.status === "ok" && ` · ${Math.round(distanceM(location.position, [d.lat, d.lng]))} m away`}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="dest-go" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="trip">
              <span className="trip-icon">
                <Icon name={POI_ICON[dest.type] ?? "pin"} />
              </span>
              <div className="trip-text">
                <span className="trip-label">Route to</span>
                <h1 id="nav-heading" className="trip-name">
                  {dest.name}
                </h1>
              </div>
              <button type="button" className="secondary small" onClick={() => setDestId("")}>
                Change
              </button>
            </div>
            <ProfilePicker profile={profile} onChange={setProfile} compact />
            <div aria-live="polite" className="route-area">
              {locationNote && (
                <p className="hint">
                  <Icon name="pin" size={18} /> {locationNote}
                </p>
              )}
              {error && (
                <p className="notice notice-error" role="alert">
                  Could not load a route: {error}
                </p>
              )}
              {loading && (
                <>
                  <p className="visually-hidden">Finding a route…</p>
                  <RouteSkeleton />
                </>
              )}
              {route && !loading && <RouteCard route={route} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
