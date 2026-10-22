import { useEffect, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { LatLng } from "../navigation";

export interface Fix {
  at: LatLng;
  /** metres (68% radius) */
  accuracy: number;
  time: number;
}

/** "lost" = signal dropped (it may come back); "denied" = GPS can't be used at all. */
export type GpsError = "lost" | "denied";

/** Live GPS while `active` (native GPS in the app, browser geolocation on the web). */
export function useWatchPosition(active: boolean) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<GpsError | null>(null);

  useEffect(() => {
    if (!active) return;
    let id: string | null = null;
    let cancelled = false;
    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 2_000 }, (pos, err) => {
      if (cancelled) return;
      if (err || !pos) {
        setError("lost");
        return;
      }
      setError(null);
      setFix({ at: [pos.coords.latitude, pos.coords.longitude], accuracy: pos.coords.accuracy, time: pos.timestamp });
    })
      .then((watchId) => {
        id = watchId;
        if (cancelled) Geolocation.clearWatch({ id: watchId });
      })
      .catch(() => setError("denied"));
    return () => {
      cancelled = true;
      if (id) Geolocation.clearWatch({ id });
    };
  }, [active]);

  return { fix, error };
}
