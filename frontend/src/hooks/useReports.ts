import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Priority, Report } from "../types";

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  const refresh = useCallback(async () => {
    const [r, p] = await Promise.all([api.listReports(), api.priorities()]);
    setReports(r);
    setPriorities(p);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reports, priorities, refresh };
}
