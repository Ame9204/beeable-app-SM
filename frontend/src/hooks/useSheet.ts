import { useCallback, useRef, useState, type PointerEvent } from "react";

export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["peek", "half", "full"];
const DRAG_PX = 40;

/**
 * Bottom-sheet height on phones. The handle is a real button (tap cycles peek → half → full → peek,
 * so keyboard and TalkBack users get every state); dragging it up or down also works.
 */
export function useSheet(initial: SheetSnap = "half") {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);

  const step = useCallback((dir: 1 | -1) => {
    setSnap((s) => ORDER[Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(s) + dir))]);
  }, []);

  const handleProps = {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.clientY;
      dragged.current = false;
    },
    onPointerUp: (e: PointerEvent) => {
      if (start.current === null) return;
      const dy = e.clientY - start.current;
      start.current = null;
      if (Math.abs(dy) < DRAG_PX) return;
      dragged.current = true;
      step(dy < 0 ? 1 : -1);
    },
    onClick: () => {
      if (dragged.current) return void (dragged.current = false); // the drag already moved it
      setSnap((s) => (s === "full" ? "peek" : ORDER[ORDER.indexOf(s) + 1]));
    },
    "aria-expanded": snap === "full",
  };

  return { snap, setSnap, handleProps };
}
