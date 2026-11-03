import { IS_DEMO, DEMO_SAMPLES, type DemoSample } from "../demo";
import type { ProjectFile } from "../lib/projectFiles";

/** Collapsible explorer: the project's Python snippets, plus demo traces. */
export default function FileTree({
  files,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onCollapse,
  onLoadSample,
}: {
  files: ProjectFile[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
  onLoadSample: (sample: DemoSample) => void;
}) {
  return (
    <nav className="flex h-full min-h-0 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreate}
            aria-label="New file"
            title="New file"
            className="rounded px-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            +
          </button>
          <button
            onClick={onCollapse}
            aria-label="Collapse explorer"
            title="Collapse explorer (Ctrl/⌘+B)"
            className="rounded px-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ⟨
          </button>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" role="tree">
        {files.map((file) => {
          const active = file.id === activeId;
          return (
            <li key={file.id} role="treeitem" aria-selected={active} className="group">
              <div
                className={`flex items-center rounded-md ${
                  active ? "bg-slate-700/70 text-white" : "hover:bg-slate-800"
                }`}
              >
                <button
                  onClick={() => onSelect(file.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                >
                  <span aria-hidden className="text-slate-500">📄</span>
                  <span className="truncate font-code text-[13px]">{file.name}</span>
                </button>
                {files.length > 1 && (
                  <button
                    onClick={() => onDelete(file.id)}
                    aria-label={`Delete ${file.name}`}
                    className="mr-1 hidden rounded px-1.5 text-xs text-slate-500 hover:bg-slate-600 hover:text-white group-hover:block"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}

        {IS_DEMO && (
          <li className="mt-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pre-recorded traces
            </p>
            <ul>
              {DEMO_SAMPLES.map((sample) => (
                <li key={sample.key}>
                  <button
                    onClick={() => onLoadSample(sample)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-800"
                  >
                    <span aria-hidden className="text-sky-400">▶</span>
                    <span className="truncate">{sample.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
}
