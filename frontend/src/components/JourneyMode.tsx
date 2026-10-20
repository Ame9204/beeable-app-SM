import { useMemo } from "react";
import type { Place } from "../places";
import type { Profile, Report, RouteResponse } from "../types";
import { JourneyPanel, useJourney } from "./Journey";
import { MapView, type MapFocus } from "./MapView";

/** Full-screen "Start journey" mode: the map follows the bee while the panel gives turn-by-turn directions. */
export function JourneyMode({
  route, dest, profile, reports, onEnd,
}: {
  route: RouteResponse;
  dest: Place;
  profile: Profile;
  reports: Report[];
  onEnd: () => void;
}) {
  const { journey, voice, lastSpoken } = useJourney({
    initial: route,
    dest: [dest.lat, dest.lng],
    destName: dest.name,
    profile,
    active: true,
  });
  const fix = journey.fix;
  // Follow the user: re-centre on every new GPS fix.
  const focus: MapFocus | undefined = useMemo(() => (fix ? { at: fix.at, key: fix.time } : undefined), [fix]);

  return (
    <div className="navigate journey">
      <MapView
        route={journey.route}
        reports={reports}
        origin={fix?.at}
        destination={[dest.lat, dest.lng]}
        destinationType={dest.type}
        focus={focus}
        routeKey={`journey-${journey.route.costs.recommended.length_m}-${journey.route.recommended.features.length}`}
      />
      <JourneyPanel journey={journey} destName={dest.name} voice={voice} lastSpoken={lastSpoken} onEnd={onEnd} />
    </div>
  );
}
