import { useCallback, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { CAMPUS_RADIUS_M, PRECINCT_CENTER } from "../config";

export type LocationStatus = "idle" | "locating" | "ok" | "off_campus" | "unavailable";

export function distanceM([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/**
 * Device location via @capacitor/geolocation (native GPS in the app, browser geolocation on the web).
 * Asks for permission only when `locate()` is called. Positions off campus fall back to the campus
 * centre so routes stay inside the mapped area.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [position, setPosition] = useState<[number, number]>(PRECINCT_CENTER);

  const locate = useCallback(async (): Promise<[number, number]> => {
    setStatus("locating");
    try {
      const { coords } = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
      const here: [number, number] = [coords.latitude, coords.longitude];
      if (distanceM(here, PRECINCT_CENTER) > CAMPUS_RADIUS_M) {
        setStatus("off_campus");
        setPosition(PRECINCT_CENTER);
        return PRECINCT_CENTER;
      }
      setStatus("ok");
      setPosition(here);
      return here;
    } catch {
      setStatus("unavailable"); // denied, timed out, or no GPS
      setPosition(PRECINCT_CENTER);
      return PRECINCT_CENTER;
    }
  }, []);

  return { status, position, locate };
}
