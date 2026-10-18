import { useEffect, useRef } from "react";

/** Moves focus to the page heading on mount so screen readers announce the new screen. */
export function useFocusHeading<T extends HTMLElement = HTMLHeadingElement>(key?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}
