import FlowchartEditor from "./FlowchartEditor";
import PseudocodePanel from "./PseudocodePanel";

export type WorkspaceTabId = "pseudo" | "flow";

const TAB_LABELS: Record<WorkspaceTabId, { icon: string; label: string }> = {
  pseudo: { icon: "📝", label: "PseudoCode" },
  flow: { icon: "🔀", label: "Flow Chart" },
};

/**
 * Right-hand pane with browser-style tabs. Pseudocode and the flowchart
 * open here beside the editor, so they can be read while coding. Closing
 * the last tab closes the pane.
 */
export default function Workspace({
  openTabs,
  activeTab,
  onSelect,
  onClose,
  pseudocode,
  onPseudocodeChange,
  onInsertPseudocode,
  fontSize,
  onZoom,
}: {
  openTabs: WorkspaceTabId[];
  activeTab: WorkspaceTabId;
  onSelect: (id: WorkspaceTabId) => void;
  onClose: (id: WorkspaceTabId) => void;
  pseudocode: string;
  onPseudocodeChange: (value: string) => void;
  onInsertPseudocode: () => void;
  fontSize: number;
  onZoom: (delta: -1 | 0 | 1) => void;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      {/* Browser-style tab strip */}
      <div
        role="tablist"
        className="flex items-end gap-1 overflow-x-auto bg-slate-200 px-2 pt-2"
      >
        {openTabs.map((id) => {
          const active = id === activeTab;
          const { icon, label } = TAB_LABELS[id];
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(id)}
              className={`group flex cursor-pointer select-none items-center gap-2 rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-slate-800 shadow-[0_-1px_0_rgba(0,0,0,0.04)]"
                  : "text-slate-500 hover:bg-slate-300/60 hover:text-slate-700"
              }`}
            >
              <span aria-hidden>{icon}</span>
              <span className="whitespace-nowrap">{label}</span>
              <button
                aria-label={`Close ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(id);
                }}
                className={`ml-1 flex h-4 w-4 items-center justify-center rounded text-xs leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700 ${
                  active ? "" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "pseudo" ? (
          <PseudocodePanel
            value={pseudocode}
            onChange={onPseudocodeChange}
            onInsert={onInsertPseudocode}
            fontSize={fontSize}
            onZoom={onZoom}
          />
        ) : (
          <div className="h-full">
            <FlowchartEditor />
          </div>
        )}
      </div>
    </div>
  );
}
