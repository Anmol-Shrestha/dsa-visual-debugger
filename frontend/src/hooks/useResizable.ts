import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

/**
 * A panel size driven by dragging a divider. The size is remembered per
 * viewer in localStorage. `invert` is for panels whose divider sits on their
 * leading edge (the right pane and bottom drawer), where dragging toward the
 * panel should grow it.
 */
export function useResizable({
  storageKey,
  initial,
  min,
  max,
  axis,
  invert = false,
}: {
  storageKey: string;
  initial: number;
  min: number;
  max: number;
  axis: "x" | "y";
  invert?: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved > 0) return clamp(saved);
    } catch {
      /* storage blocked — use the default */
    }
    return initial;
  });
  const drag = useRef<{ start: number; size: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(size));
    } catch {
      /* ignore */
    }
  }, [size, storageKey]);

  const onMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    drag.current = { start: axis === "x" ? e.clientX : e.clientY, size };
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!drag.current) return;
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      const delta = pos - drag.current.start;
      setSize(clamp(drag.current.size + (invert ? -delta : delta)));
    };
    const onUp = () => {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { size, onMouseDown };
}
