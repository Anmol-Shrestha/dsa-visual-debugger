import type { MouseEvent } from "react";

/** Draggable gutter between two panes. `axis="x"` is a vertical bar. */
export default function Divider({
  axis,
  onMouseDown,
}: {
  axis: "x" | "y";
  onMouseDown: (e: MouseEvent) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      className={`group relative shrink-0 bg-slate-800 ${
        axis === "x" ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
      }`}
    >
      {/* Wider invisible hit area, with a highlight while hovering. */}
      <div
        className={`absolute ${
          axis === "x" ? "inset-y-0 -left-1 w-2" : "inset-x-0 -top-1 h-2"
        } group-hover:bg-indigo-500/40`}
      />
    </div>
  );
}
