import { useEffect, useState } from "react";
import { api } from "../api";
import type { Profile, RouteResponse } from "../types";

export function useRoute(from: [number, number], to: [number, number] | null, profile: Profile) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // bumps on every new response; used as a React key so map layers redraw
  const [version, setVersion] = useState(0);

  const fromKey = from.join(",");
  const toKey = to?.join(",");

  useEffect(() => {
    if (!to) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .route(from, to, profile)
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setVersion((v) => v + 1);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey, profile]);

  return { route, error, loading, version };
}
