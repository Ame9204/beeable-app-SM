import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { WALK_SPEED_MPS } from "../config";
import { useVoice } from "../hooks/useVoice";
import { LOCALE, useT } from "../i18n";
import { useWatchPosition, type Fix, type GpsError } from "../hooks/useWatchPosition";
import {
  buildNavPath, distance, formatDistance, maneuverText, spokenDistance, locateOnPath,
  type LatLng, type Maneuver, type ManeuverKind, type RouteBarrier,
} from "../navigation";
import type { Profile, RouteResponse } from "../types";
import { Bee } from "./Bee";
import { Icon, type IconName } from "./Icon";

// Team choices, like the routing weights.
const OFF_ROUTE_M = 30; // further than this from the route (with a decent fix) counts as off route
const OFF_ROUTE_FIXES = 3; // ...for this many fixes in a row before we re-route
const ARRIVE_M = 15;
const ANNOUNCE_AHEAD_M = 60;
const ANNOUNCE_NOW_M = 15;
const OBSTACLE_AHEAD_M = 40;
const POOR_ACCURACY_M = 40;

export const MANEUVER_ICON: Record<ManeuverKind, IconName> = {
  slight_left: "slightLeft",
  left: "turnLeft",
  sharp_left: "turnLeft",
  slight_right: "slightRight",
  right: "turnRight",
  sharp_right: "turnRight",
  uturn: "uturn",
  arrive: "flag",
};

export interface Journey {
  route: RouteResponse;
  fix: Fix | null;
  gpsError: GpsError | null;
  along: number;
  offset: number;
  length: number;
  next: Maneuver | null;
  then: Maneuver | null;
  obstacle: RouteBarrier | null;
  arrived: boolean;
  rerouting: boolean;
}

/** Live progress along `initial` towards `dest` while active: snapping, re-routing, arrival, voice. */
export function useJourney({
  initial, dest, destName, profile, active,
}: {
  initial: RouteResponse;
  dest: LatLng;
  destName: string;
  profile: Profile;
  active: boolean;
}) {
  const { fix, error: gpsError } = useWatchPosition(active);
  const { t, lang } = useT();
  const voice = useVoice(lang);
  const turn = (m: Maneuver) => maneuverText(m, destName, lang);
  const said = (m: number) => spokenDistance(m, lang);
  const [route, setRoute] = useState(initial);
  const [progress, setProgress] = useState({ along: 0, offset: 0 });
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [lastSpoken, setLastSpoken] = useState("");
  const offFixes = useRef(0);
  const rerouted = useRef(false);
  const spoken = useRef(new Set<string>());
  const path = useMemo(() => buildNavPath(route.recommended), [route]);

  // A new trip (or a fresh route while not navigating) starts from scratch.
  useEffect(() => {
    if (active) return;
    setRoute(initial);
    setProgress({ along: 0, offset: 0 });
    setArrived(false);
    spoken.current.clear();
  }, [initial, active]);

  function announce(key: string, text: string) {
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    voice.say(text);
    setLastSpoken(text);
  }

  // Keep the screen on while walking (where the browser/WebView supports it).
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [active]);

  useEffect(() => {
    if (!active || !fix || arrived) return;
    const loc = locateOnPath(path.points, fix.at, Math.max(0, progress.along - 30));
    setProgress(loc);

    const remaining = path.length - loc.along;
    if (remaining < ARRIVE_M || distance(fix.at, dest) < ARRIVE_M + 5) {
      setArrived(true);
      announce("arrive", t("journey.sayArrived", { dest: destName }));
      return;
    }

    // Off route: re-plan from here.
    if (loc.offset > OFF_ROUTE_M && fix.accuracy <= POOR_ACCURACY_M) offFixes.current += 1;
    else offFixes.current = 0;
    if (offFixes.current >= OFF_ROUTE_FIXES && !rerouting) {
      offFixes.current = 0;
      setRerouting(true);
      announce(`reroute-${Date.now()}`, t("journey.sayRerouting"));
      api
        .route(fix.at, dest, profile, lang)
        .then((r) => {
          spoken.current.clear();
          rerouted.current = true;
          setRoute(r);
          setProgress({ along: 0, offset: 0 });
        })
        .catch(() => {})
        .finally(() => setRerouting(false));
      return;
    }

    const next = path.maneuvers.find((m) => m.along > loc.along + 3);
    if (!spoken.current.has("start")) {
      // One opening sentence that already includes the first instruction (so it isn't cut off by it).
      let first = t("journey.sayWalk", { d: said(remaining) });
      if (next && next.kind !== "arrive") {
        const d = next.along - loc.along;
        first = t("journey.sayIn", { d: said(d), turn: turn(next).toLowerCase() });
        if (d <= ANNOUNCE_AHEAD_M) spoken.current.add(`ahead-${next.along}`);
      }
      const opening = rerouted.current ? t("journey.sayNewRoute") : t("journey.sayStarting", { dest: destName });
      announce("start", `${opening} ${first}`);
    }
    if (next && next.kind !== "arrive") {
      const d = next.along - loc.along;
      const text = turn(next);
      if (d <= ANNOUNCE_NOW_M) announce(`now-${next.along}`, t("journey.sayNow", { turn: text }));
      else if (d <= ANNOUNCE_AHEAD_M) announce(`ahead-${next.along}`, t("journey.sayIn", { d: said(d), turn: text.toLowerCase() }));
    }
    const ob = path.barriers.find((b) => b.along > loc.along && b.along - loc.along <= OBSTACLE_AHEAD_M);
    if (ob) announce(`ob-${ob.along}`, t("journey.sayObstacle", { d: said(ob.along - loc.along), text: ob.text }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, active, path]);

  const along = progress.along;
  const upcoming = path.maneuvers.filter((m) => m.along > along + 3);
  const journey: Journey = {
    route,
    fix,
    gpsError,
    along,
    offset: progress.offset,
    length: path.length,
    next: upcoming[0] ?? null,
    // Show "then …" only when the second turn comes soon after the first.
    then: upcoming[1] && upcoming[1].along - upcoming[0].along < 40 ? upcoming[1] : null,
    obstacle: path.barriers.find((b) => b.along > along && b.along - along <= OBSTACLE_AHEAD_M) ?? null,
    arrived,
    rerouting,
  };
  return { journey, voice, lastSpoken };
}

/** The on-screen part: turn banner at the top, trip info + controls at the bottom. */
export function JourneyPanel({
  journey: j, destName, voice, lastSpoken, onEnd,
}: {
  journey: Journey;
  destName: string;
  voice: ReturnType<typeof useVoice>;
  lastSpoken: string;
  onEnd: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [j.arrived]);
  const { t, lang } = useT();
  const turn = (m: Maneuver) => maneuverText(m, destName, lang);

  const remaining = Math.max(0, j.length - j.along);
  const mins = Math.max(1, Math.round(remaining / WALK_SPEED_MPS / 60));
  const eta = new Date(Date.now() + (remaining / WALK_SPEED_MPS) * 1000).toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" });

  if (j.arrived) {
    return (
      <section className="journey-arrived card" aria-labelledby="arrived-heading">
        <Bee size={64} className="bee-hover" />
        <h1 id="arrived-heading" ref={headingRef} tabIndex={-1}>
          {t("journey.arrived")}
        </h1>
        <p>{destName}</p>
        <button type="button" className="primary big" onClick={onEnd}>
          {t("journey.done")}
        </button>
      </section>
    );
  }

  const next = j.next;
  return (
    <>
      <section className="journey-banner" aria-labelledby="journey-heading">
        {!j.fix ? (
          <div className="jb-main">
            <span className="spinner jb-spinner" aria-hidden="true" />
            <h1 id="journey-heading" ref={headingRef} tabIndex={-1} className="jb-text">
              {t("journey.finding")}
            </h1>
          </div>
        ) : (
          next && (
            <div className="jb-main">
              <span className="jb-icon">
                <Icon name={MANEUVER_ICON[next.kind]} size={40} />
              </span>
              <div>
                <p className="jb-dist">{formatDistance(next.along - j.along)}</p>
                <h1 id="journey-heading" ref={headingRef} tabIndex={-1} className="jb-text">
                  {turn(next)}
                </h1>
              </div>
            </div>
          )
        )}
        {j.then && (
          <p className="jb-then">
            {t("journey.then")} <Icon name={MANEUVER_ICON[j.then.kind]} size={18} /> {turn(j.then).toLowerCase()}
          </p>
        )}
      </section>

      {j.obstacle && (
        <div className="journey-obstacle bee-alert status-warn" role="status">
          <Bee size={40} className="bee-wiggle" />
          <p>
            <strong className="bee-alert-title">
              <Icon name="alert" size={18} /> {t("journey.obstacleIn", { d: formatDistance(j.obstacle.along - j.along) })}
            </strong>
            <span>{j.obstacle.text}</span>
          </p>
        </div>
      )}

      <section className="journey-bottom" aria-label={t("journey.trip")}>
        {(j.rerouting || j.gpsError || (j.fix && j.fix.accuracy > POOR_ACCURACY_M)) && (
          <p className="hint journey-note" role="status">
            <Icon name="info" size={18} />{" "}
            {j.rerouting
              ? t("journey.leftRoute")
              : j.gpsError
                ? t(j.gpsError === "lost" ? "journey.gpsLost" : "journey.gpsDenied")
                : t("journey.weakGps", { m: Math.round(j.fix!.accuracy) })}
          </p>
        )}
        <div className="journey-row">
          <p className="journey-eta">
            <strong>
              {mins} {t("card.min")}
            </strong>
            <span>{t("journey.eta", { d: formatDistance(remaining), eta })}</span>
          </p>
          {voice.supported && (
            <button
              type="button"
              className="secondary icon-only"
              onClick={voice.toggle}
              aria-pressed={!voice.muted}
              aria-label={t(voice.muted ? "journey.voiceOff" : "journey.voiceOn")}
            >
              <Icon name={voice.muted ? "mute" : "volume"} />
            </button>
          )}
          <button type="button" className="secondary" onClick={onEnd}>
            <Icon name="x" size={18} /> {t("journey.end")}
          </button>
        </div>
        {/* Screen readers hear the same instructions as the voice. */}
        <p className="visually-hidden" aria-live="polite">
          {lastSpoken}
        </p>
      </section>
    </>
  );
}
