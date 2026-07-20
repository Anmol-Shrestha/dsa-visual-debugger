import { useEffect } from "react";
import FlowchartEditor from "./FlowchartEditor";

export type PlanTab = "pseudo" | "flow";

/**
 * Popup for structured thinking before coding: a pseudocode notepad and a
 * drag-and-drop flowchart canvas. Both persist across sessions.
 */
export default function PlanningModal({
  tab,
  onTabChange,
  onClose,
  pseudocode,
  onPseudocodeChange,
  onInsertPseudocode,
}: {
  tab: PlanTab;
  onTabChange: (tab: PlanTab) => void;
  onClose: () => void;
  pseudocode: string;
  onPseudocodeChange: (value: string) => void;
  onInsertPseudocode: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabClass = (active: boolean) =>
    `rounded-t-md px-4 py-2 text-sm font-semibold ${
      active
        ? "border border-b-0 border-slate-200 bg-white text-indigo-700"
        : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-end justify-between border-b border-slate-200 bg-slate-50 px-4 pt-3">
          <div className="flex gap-1">
            <button className={tabClass(tab === "pseudo")} onClick={() => onTabChange("pseudo")}>
              📝 PseudoCode
            </button>
            <button className={tabClass(tab === "flow")} onClick={() => onTabChange("flow")}>
              🔀 Flow Chart
            </button>
          </div>
          <button
            onClick={onClose}
            className="mb-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            ✕ Close (Esc)
          </button>
        </div>

        {tab === "pseudo" ? (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <p className="mb-2 text-sm text-slate-500">
              Sketch your logic in plain language first — then turn it into code.
            </p>
            <textarea
              value={pseudocode}
              onChange={(e) => onPseudocodeChange(e.target.value)}
              spellCheck={false}
              placeholder={
                "e.g.\nfor each number in nums:\n    complement = target - number\n    if complement seen before:\n        return both indices\n    remember this number's index"
              }
              className="min-h-0 flex-1 resize-none rounded-lg border border-slate-300 p-4 font-mono text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Saved automatically — it will be here next session.
              </span>
              <button
                onClick={onInsertPseudocode}
                disabled={!pseudocode.trim()}
                className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Insert into editor as comments
              </button>
            </div>
          </div>
        ) : (
          <FlowchartEditor />
        )}
      </div>
    </div>
  );
}
