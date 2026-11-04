import { useCallback, useEffect, useMemo, useState } from "react";
import { RunError, runTrace, saveToServer, waitForBackend } from "./api";
import BottomDrawer, { type RunStatus } from "./components/BottomDrawer";
import CodeEditor from "./components/CodeEditor";
import Divider from "./components/Divider";
import FileTree from "./components/FileTree";
import Workspace, { type WorkspaceTabId } from "./components/Workspace";
import { IS_DEMO, type DemoSample } from "./demo";
import { useResizable } from "./hooks/useResizable";
import {
  loadActiveFileId,
  loadFiles,
  newFileId,
  saveActiveFileId,
  saveFiles,
  type ProjectFile,
} from "./lib/projectFiles";
import type { RunErrorInfo, TraceStep } from "./types";

const SAMPLE_CODE = `def calculate_total(prices):
    total = 0
    for price in prices:
        total = total + price

    if total > 100:
        discount = total * 0.1
        total = total - discount

    return total

prices = [35, 45, 30]
final_total = calculate_total(prices)
`;

const PSEUDO_KEY = "dsa-debugger.pseudocode";
const FONT_KEY = "dsa-debugger.editorFontSize";
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;

const clampFont = (n: number) =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));

function uniqueFileName(files: ProjectFile[]): string {
  const names = new Set(files.map((f) => f.name));
  let i = 1;
  while (names.has(`untitled${i}.py`)) i++;
  return `untitled${i}.py`;
}

export default function App() {
  /* ---------------- project files ---------------- */
  const [files, setFiles] = useState<ProjectFile[]>(() => loadFiles(SAMPLE_CODE));
  const [activeId, setActiveId] = useState<string>(() => loadActiveFileId() ?? "");
  const activeFile = files.find((f) => f.id === activeId) ?? files[0];
  const code = activeFile.content;

  useEffect(() => saveFiles(files), [files]);
  useEffect(() => saveActiveFileId(activeFile.id), [activeFile.id]);

  const setCode = (value: string) =>
    setFiles((fs) =>
      fs.map((f) => (f.id === activeFile.id ? { ...f, content: value } : f)),
    );

  /* ---------------- execution session ---------------- */
  const [status, setStatus] = useState<RunStatus>("idle");
  const [timeline, setTimeline] = useState<TraceStep[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [runError, setRunError] = useState<RunErrorInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Backend connection while a free host wakes up from sleep.
  const [server, setServer] = useState<{
    state: "ready" | "waking" | "offline";
    seconds: number;
  }>({ state: "ready", seconds: 0 });

  const connectServer = async () => {
    setServer({ state: "waking", seconds: 0 });
    const awake = await waitForBackend({
      onWaiting: (seconds) => setServer({ state: "waking", seconds }),
    });
    setServer({ state: awake ? "ready" : "offline", seconds: 0 });
  };

  useEffect(() => {
    if (!IS_DEMO) void connectServer();
    // Connect once on load; Run checks again before each trace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which frame of a failed run is shown in the editor (null = innermost).
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  const debugging = status === "ok" && timeline !== null && timeline.length > 0;
  const frame = debugging ? timeline![currentStep] : null;
  const previousVariables = useMemo(
    () =>
      debugging && currentStep > 0
        ? timeline![currentStep - 1].local_variables
        : null,
    [debugging, timeline, currentStep],
  );

  const clearSession = () => {
    setSelectedFrame(null);
    setStatus("idle");
    setTimeline(null);
    setCurrentStep(0);
    setRunError(null);
  };

  const handleRun = async () => {
    setNotice(null);
    setDrawerOpen(true);
    if (IS_DEMO) {
      setStatus("error");
      setRunError({
        message:
          "This is a static demo — the tracing backend isn't deployed. " +
          "Pick a pre-recorded trace in the explorer, or run the FastAPI backend locally.",
        error_type: null,
        line_number: null,
        stack: [],
      });
      return;
    }
    setStatus("running");
    setTimeline(null);
    setRunError(null);
    // Each run waits for the server first, so a sleeping host doesn't fail the trace.
    const awake = await waitForBackend({
      onWaiting: (seconds) => setServer({ state: "waking", seconds }),
    });
    setServer({ state: awake ? "ready" : "offline", seconds: 0 });
    if (!awake) {
      setStatus("error");
      setRunError({
        message:
          "The server didn't respond after 2 minutes. Check that the backend is deployed, then try again.",
        error_type: null,
        line_number: null,
        stack: [],
      });
      return;
    }
    try {
      // Full-load strategy (ADR-004): one request, whole timeline in memory.
      const steps = await runTrace(code);
      if (steps.length === 0) {
        setStatus("error");
        setRunError({
          message: "Execution produced no trace steps.",
          error_type: null,
          line_number: null,
          stack: [],
        });
        return;
      }
      setTimeline(steps);
      setCurrentStep(0);
      setStatus("ok");
    } catch (e) {
      const info: RunErrorInfo =
        e instanceof RunError
          ? e.info
          : { message: (e as Error).message, error_type: null, line_number: null, stack: [] };
      setRunError(info);
      setStatus("error");
    }
  };

  const loadDemoSample = (sample: DemoSample) => {
    setCode(sample.code);
    setTimeline(sample.timeline);
    setCurrentStep(0);
    setRunError(null);
    setStatus("ok");
    setDrawerOpen(true);
    setNotice(`Loaded pre-recorded trace: ${sample.label}`);
  };

  const step = useCallback(
    (delta: number) => {
      if (!timeline) return;
      setCurrentStep((s) => Math.min(timeline.length - 1, Math.max(0, s + delta)));
    },
    [timeline],
  );

  /* ---------------- files ---------------- */
  const selectFile = (id: string) => {
    if (id === activeFile.id) return;
    setActiveId(id);
    clearSession();
  };

  const createFile = () => {
    const file: ProjectFile = {
      id: newFileId(),
      name: uniqueFileName(files),
      content: "",
    };
    setFiles((fs) => [...fs, file]);
    setActiveId(file.id);
    clearSession();
  };

  const deleteFile = (id: string) => {
    if (files.length <= 1) return;
    const target = files.find((f) => f.id === id);
    if (!target || !window.confirm(`Delete ${target.name}? This can't be undone.`)) return;
    const remaining = files.filter((f) => f.id !== id);
    setFiles(remaining);
    if (id === activeFile.id) {
      setActiveId(remaining[0].id);
      clearSession();
    }
  };

  /* ---------------- pseudocode & workspace tabs ---------------- */
  const [pseudocode, setPseudocode] = useState(
    () => localStorage.getItem(PSEUDO_KEY) ?? "",
  );
  useEffect(() => {
    try {
      localStorage.setItem(PSEUDO_KEY, pseudocode);
    } catch {
      /* ignore */
    }
  }, [pseudocode]);

  const [openTabs, setOpenTabs] = useState<WorkspaceTabId[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("pseudo");
  const workspaceOpen = openTabs.length > 0;

  const openTab = (id: WorkspaceTabId) => {
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
    setActiveTab(id);
  };
  const toggleTab = (id: WorkspaceTabId) => {
    if (openTabs.includes(id) && activeTab === id) closeTab(id);
    else openTab(id);
  };
  const closeTab = (id: WorkspaceTabId) => {
    const next = openTabs.filter((t) => t !== id);
    setOpenTabs(next);
    if (activeTab === id && next.length > 0) setActiveTab(next[next.length - 1]);
  };

  const insertPseudocode = () => {
    const commented = pseudocode
      .trimEnd()
      .split("\n")
      .map((line) => (line.trim() ? `# ${line}` : "#"))
      .join("\n");
    setCode(`${commented}\n\n${code}`);
    setNotice("Pseudocode inserted at the top of the editor as comments.");
  };

  /* ---------------- font zoom ---------------- */
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampFont(saved) : DEFAULT_FONT_SIZE;
  });
  useEffect(() => {
    try {
      localStorage.setItem(FONT_KEY, String(fontSize));
    } catch {
      /* ignore */
    }
  }, [fontSize]);
  const zoom = (delta: -1 | 0 | 1) =>
    setFontSize((s) => (delta === 0 ? DEFAULT_FONT_SIZE : clampFont(s + delta)));

  /* ---------------- panels ---------------- */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const sidebar = useResizable({
    storageKey: "dsa-debugger.sidebarWidth",
    initial: 224,
    min: 160,
    max: 420,
    axis: "x",
  });
  const workspace = useResizable({
    storageKey: "dsa-debugger.workspaceWidth",
    initial: 480,
    min: 320,
    max: 960,
    axis: "x",
    invert: true,
  });
  const drawer = useResizable({
    storageKey: "dsa-debugger.drawerHeight",
    initial: 260,
    min: 140,
    max: 640,
    axis: "y",
    invert: true,
  });

  /* ---------------- save ---------------- */
  const handleSaveToDesktop = useCallback(() => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = activeFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [code, activeFile.name]);

  const handleSaveToServer = async () => {
    setNotice(null);
    if (IS_DEMO) {
      setNotice("Server-side saving needs the backend — use Save to Desktop here.");
      return;
    }
    try {
      const result = await saveToServer(activeFile.name.replace(/\.py$/, ""), code);
      setNotice(`Saved on server: ${result.location}`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  /* ---------------- global shortcuts ---------------- */
  // Editor-level keys (Ctrl/⌘+Enter, +D, +F, zoom) are handled inside
  // CodeMirror and call preventDefault there. This listener runs after it,
  // so it skips anything already handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inTextField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (debugging && !mod && !inTextField && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        step(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (e.defaultPrevented) return;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      } else if (mod && !e.altKey && e.key === "`") {
        e.preventDefault();
        setDrawerOpen((o) => !o);
      } else if (mod && !e.altKey && e.key === "Enter") {
        e.preventDefault();
        void handleRun();
      } else if (mod && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveToDesktop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleRun is recreated each render; re-binding keeps it current.
  });

  // The red span in the editor: the selected stack frame's failing expression,
  // or the top-level error line when there is no stack (e.g. a syntax error).
  const errorRange = (() => {
    if (status !== "error" || !runError) return null;
    if (runError.stack.length > 0) {
      const frame = runError.stack[selectedFrame ?? runError.stack.length - 1];
      return {
        line: frame.line_number,
        startCol: frame.col_start,
        endCol: frame.col_end,
      };
    }
    return runError.line_number
      ? { line: runError.line_number, startCol: null, endCol: null }
      : null;
  })();

  const lineCount = code.split("\n").length;
  const statusText =
    status === "running"
      ? "Tracing…"
      : status === "ok" && timeline
        ? `Traced ${timeline.length} steps`
        : status === "error"
          ? `Error${runError?.line_number ? ` on line ${runError.line_number}` : ""}`
          : "Ready";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* ---------- top bar ---------- */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[linear-gradient(172deg,#16181d_0%,#0c0d10_100%)] px-4 py-2 text-zinc-200 shadow-[0_18px_40px_-24px_#000]">
        <a
          href="#/"
          className="rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          title="Back to the landing page"
        >
          ← Home
        </a>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle explorer"
          aria-pressed={sidebarOpen}
          title="Toggle explorer (Ctrl/⌘+B)"
          className="rounded-md px-2 py-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
        >
          ☰
        </button>
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-100">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-b from-[#d9dee6] to-[#9aa3af] text-xs text-[#0b0c0e] shadow-[0_0_12px_rgba(207,213,221,0.25)]">
            ▶
          </span>
          DSA Visual Debugger
        </h1>

        <div className="ml-2 flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={status === "running"}
            title="Run & trace (Ctrl/⌘+Enter)"
            className="rounded-md bg-gradient-to-b from-[#d9dee6] to-[#9aa3af] px-3.5 py-1.5 text-sm font-semibold text-[#0b0c0e] shadow-[0_0_18px_rgba(207,213,221,0.15)] transition hover:brightness-110 disabled:opacity-50"
          >
            {status === "running"
              ? server.state === "waking"
                ? `Waking server… ${server.seconds}s`
                : "Tracing…"
              : "▶ Run & Trace"}
          </button>
          <button
            onClick={handleSaveToDesktop}
            title="Save to Desktop (Ctrl/⌘+S)"
            className="rounded-md border border-white/15 bg-[linear-gradient(180deg,#2a2e36,#17191e)] px-3.5 py-1.5 text-sm font-semibold text-zinc-100 shadow-sm transition hover:border-white/30 hover:brightness-110"
          >
            ⬇ Save to Desktop
          </button>
          <button
            onClick={handleSaveToServer}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/30 hover:bg-white/10 hover:text-zinc-100"
          >
            Save to Server
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <PanelToggle
            active={workspaceOpen && activeTab === "pseudo"}
            onClick={() => toggleTab("pseudo")}
          >
            📝 PseudoCode
          </PanelToggle>
          <PanelToggle
            active={workspaceOpen && activeTab === "flow"}
            onClick={() => toggleTab("flow")}
          >
            🔀 Flow Chart
          </PanelToggle>
          <PanelToggle active={drawerOpen} onClick={() => setDrawerOpen((o) => !o)}>
            ▤ Execution
          </PanelToggle>
        </div>
      </header>

      {IS_DEMO && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-800">
          <span className="font-semibold">Static demo</span> — pick a pre-recorded
          trace in the explorer. Live tracing needs the backend running locally.
        </div>
      )}

      {server.state === "waking" && (
        <div
          role="status"
          className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"
        >
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
          />
          <span>
            <span className="font-semibold">Waking up the server.</span> The free
            backend sleeps when idle, so the first request can take 30–60 seconds.
            {server.seconds > 0 && (
              <span className="font-code"> ({server.seconds}s)</span>
            )}
          </span>
        </div>
      )}
      {server.state === "offline" && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700"
        >
          <span>Couldn’t reach the backend server.</span>
          <button
            onClick={connectServer}
            className="rounded border border-rose-300 bg-white px-2 py-0.5 font-medium hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ---------- explorer ---------- */}
        {sidebarOpen && (
          <>
            <aside style={{ width: sidebar.size }} className="min-h-0 shrink-0">
              <FileTree
                files={files}
                activeId={activeFile.id}
                onSelect={selectFile}
                onCreate={createFile}
                onDelete={deleteFile}
                onCollapse={() => setSidebarOpen(false)}
                onLoadSample={loadDemoSample}
              />
            </aside>
            <Divider axis="x" onMouseDown={sidebar.onMouseDown} />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {/* ---------- editor ---------- */}
            <section className="flex min-w-0 flex-1 flex-col bg-[#0b1120]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-2 pt-2">
                <div className="flex min-w-0 items-end gap-1">
                  <div className="flex items-center gap-2 rounded-t-lg bg-[#0b1120] px-3 py-1.5 text-sm font-medium text-slate-100">
                    <span className="font-code text-[13px]">{activeFile.name}</span>
                    {debugging && (
                      <span className="rounded bg-amber-400/20 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        read-only
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 pb-1.5 text-xs text-slate-400">
                  {debugging && (
                    <button
                      onClick={clearSession}
                      className="mr-2 rounded-md border border-slate-600 px-2.5 py-1 text-slate-200 hover:bg-slate-800"
                    >
                      ✎ Edit code
                    </button>
                  )}
                  <button
                    onClick={() => zoom(-1)}
                    aria-label="Smaller font"
                    title="Smaller (Ctrl/⌘+−)"
                    className="rounded px-1.5 py-0.5 hover:bg-slate-800 hover:text-white"
                  >
                    A−
                  </button>
                  <button
                    onClick={() => zoom(0)}
                    title="Reset font size (Ctrl/⌘+0)"
                    className="min-w-[3.25rem] rounded px-1.5 py-0.5 text-center font-code hover:bg-slate-800 hover:text-white"
                  >
                    {fontSize}px
                  </button>
                  <button
                    onClick={() => zoom(1)}
                    aria-label="Larger font"
                    title="Larger (Ctrl/⌘+=)"
                    className="rounded px-1.5 py-0.5 hover:bg-slate-800 hover:text-white"
                  >
                    A+
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  readOnly={debugging}
                  language="python"
                  activeLine={frame ? frame.line_number : null}
                  errorRange={errorRange}
                  fontSize={fontSize}
                  onZoom={zoom}
                  onRun={handleRun}
                  ariaLabel={`Code editor for ${activeFile.name}`}
                />
              </div>
            </section>

            {/* ---------- workspace (pseudocode / flow chart tabs) ---------- */}
            {workspaceOpen && (
              <>
                <Divider axis="x" onMouseDown={workspace.onMouseDown} />
                <aside style={{ width: workspace.size }} className="min-w-0 shrink-0">
                  <Workspace
                    openTabs={openTabs}
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                    onClose={closeTab}
                    pseudocode={pseudocode}
                    onPseudocodeChange={setPseudocode}
                    onInsertPseudocode={insertPseudocode}
                    fontSize={fontSize}
                    onZoom={zoom}
                  />
                </aside>
              </>
            )}
          </div>

          {/* ---------- execution drawer ---------- */}
          {drawerOpen && (
            <>
              <Divider axis="y" onMouseDown={drawer.onMouseDown} />
              <section style={{ height: drawer.size }} className="shrink-0">
                <BottomDrawer
                  status={status}
                  timeline={timeline}
                  currentStep={currentStep}
                  onStepChange={setCurrentStep}
                  previousVariables={previousVariables}
                  runError={runError}
                  code={code}
                  selectedFrame={selectedFrame}
                  onSelectFrame={setSelectedFrame}
                  onClose={() => setDrawerOpen(false)}
                />
              </section>
            </>
          )}
        </div>
      </div>

      {/* ---------- status bar ---------- */}
      <footer className="flex items-center justify-between gap-4 border-t border-slate-800 bg-slate-900 px-4 py-1 text-[11px] text-slate-400">
        <span className="font-code">
          {activeFile.name} · Python · {lineCount} lines · {files.length} file
          {files.length === 1 ? "" : "s"}
        </span>
        <span className="truncate">
          {notice ?? statusText}
        </span>
        <span className="hidden text-slate-500 md:inline">
          Ctrl/⌘+Enter run · Ctrl/⌘+F find · Ctrl/⌘+D next match · ←/→ step
        </span>
      </footer>
    </div>
  );
}

function PanelToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-white/25 bg-white/10 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/10 bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
