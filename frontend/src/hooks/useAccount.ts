import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe } from "../account";

/** Current on-device account, session, profile and onboarding state. */
export function useAccount() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
