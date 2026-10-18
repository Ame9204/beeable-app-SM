import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Priority, Report } from "../types";

/**
 * Reports + priorities. With `refreshMs`, re-fetches on that interval while the browser tab is visible
 * (and right away when it becomes visible again), so the staff dashboard picks up new reports by itself.
 */
export function useReports({ refreshMs }: { refreshMs?: number } = {}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const [r, p] = await Promise.all([api.listReports(), api.priorities()]);
      setReports(r);
      setPriorities(p);
      setUpdatedAt(new Date());
    } catch {
      /* keep the last good data; the next tick tries again */
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!refreshMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = window.setInterval(tick, refreshMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, refreshMs]);

  return { reports, priorities, refresh, updatedAt, refreshing };
}
