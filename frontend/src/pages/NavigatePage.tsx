import { useState } from "react";
import { Icon, POI_ICON } from "../components/Icon";
import { MapView, type MapFocus } from "../components/MapView";
import { ProfilePicker } from "../components/ProfilePicker";
import { RouteCard, RouteSkeleton } from "../components/RouteCard";
import { RouteLegend } from "../components/RouteLegend";
import { JourneyMode } from "../components/JourneyMode";
import { PlaceSearch } from "../components/PlaceSearch";
import { useLocation } from "../hooks/useLocation";
import { findPlace, rememberPlace, type Place } from "../places";
import { useReports } from "../hooks/useReports";
import { useRoute } from "../hooks/useRoute";
import { useSheet } from "../hooks/useSheet";
import { useT } from "../i18n";
import { chooseRoute, type RouteChoice } from "../routeChoice";
import type { Profile } from "../types";

const PROFILE_KEY = "beeable.profile";

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
  const [journey, setJourney] = useState(false);
  const [choice, setChoice] = useState<RouteChoice>("recommended");
  const { t, lang } = useT();
  const dest = findPlace(destId);
  const to: [number, number] | null = dest ? [dest.lat, dest.lng] : null;
  const location = useLocation();
  const { route, loading, error, version } = useRoute(location.position, to, profile, lang);
  // Each new route starts on the BeeAble route; `shown` has the picked one in `recommended`.
  const [choiceFor, setChoiceFor] = useState(version);
  if (choiceFor !== version) {
    setChoiceFor(version);
    setChoice("recommended");
  }
  const shown = route && chooseRoute(route, choice);
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

  function chooseDestination(p: Place) {
    rememberPlace(p);
    setDestId(p.id);
    sheet.setSnap("half");
    // Ask for location the first time it's needed, not on app start.
    if (location.status !== "ok") location.locate();
  }

  async function locateMe() {
    const at = await location.locate();
    setFocus({ at, key: Date.now() });
  }

  if (journey && shown && dest) {
    return (
      <JourneyMode
        route={shown}
        dest={dest}
        profile={profile}
        reports={reports}
        onEnd={() => {
          setJourney(false);
          location.locate(); // fresh start point for the route shown after the trip
        }}
      />
    );
  }

  const canStart = location.status === "ok";

  const locationNote =
    location.status !== "idle" && location.status !== "ok" ? t(`loc.${location.status}`) : null;

  return (
    <div className="navigate">
      <MapView
        route={shown}
        reports={reports}
        origin={location.position}
        destination={to}
        destinationType={dest?.type}
        focus={focus}
        routeKey={`${version}-${choice}`}
        onPickAlternative={() => setChoice((c) => (c === "alternative" ? "recommended" : "alternative"))}
      />

      <div className="map-tools">
        <button type="button" className="fab" onClick={locateMe} aria-label={t("nav.locateMe")}>
          <Icon name="locate" />
        </button>
        <button
          type="button"
          className="fab"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-controls="map-key"
          aria-label={t("nav.mapKey")}
        >
          <Icon name="layers" />
        </button>
        {legendOpen && (
          <div id="map-key" className="map-key card" role="region" aria-label={t("nav.mapKey")}>
            <div className="map-key-head">
              <h2>{t("nav.mapKey")}</h2>
              <button type="button" className="icon-button" onClick={() => setLegendOpen(false)} aria-label={t("nav.closeKey")}>
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
          <span className="visually-hidden">{t(sheet.snap === "full" ? "nav.shrink" : "nav.expand")}</span>
        </button>

        {!dest ? (
          <>
            <h1 id="nav-heading" className="sheet-title">
              {t("nav.where")}
            </h1>
            <ProfilePicker profile={profile} onChange={setProfile} />
            <PlaceSearch from={location.status === "ok" ? location.position : null} onPick={chooseDestination} />
          </>
        ) : (
          <>
            <div className="trip">
              <span className="trip-icon">
                <Icon name={POI_ICON[dest.type] ?? "pin"} />
              </span>
              <div className="trip-text">
                <span className="trip-label">{t("nav.routeTo", { type: t(`place.${dest.type}`) })}</span>
                <h1 id="nav-heading" className="trip-name">
                  {dest.name}
                </h1>
              </div>
              <button type="button" className="secondary small" onClick={() => setDestId("")}>
                {t("nav.change")}
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
                  {t("nav.couldNotLoad", { error })}
                </p>
              )}
              {loading && (
                <>
                  <p className="visually-hidden">{t("nav.finding")}</p>
                  <RouteSkeleton />
                </>
              )}
              {route && !loading && (
                <>
                  <button type="button" className="primary big start-journey" onClick={() => setJourney(true)} disabled={!canStart}>
                    <Icon name="route" /> {t("nav.start")}
                  </button>
                  {!canStart && (
                    <p className="hint">
                      <Icon name="info" size={18} /> {t("nav.needGps")}{" "}
                      {location.status !== "locating" && (
                        <button type="button" className="link-button small" onClick={() => location.locate()}>
                          {t("nav.tryAgain")}
                        </button>
                      )}
                    </p>
                  )}
                  <RouteCard route={route} choice={choice} onChoose={setChoice} />
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
