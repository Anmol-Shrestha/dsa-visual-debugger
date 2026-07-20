import { useCallback, useEffect, useMemo, useState } from "react";
import { analyzeComplexity, runTrace, saveToServer } from "./api";
import BigOPanel from "./components/BigOPanel";
import CodeViewer from "./components/CodeViewer";
import { DEMO_SAMPLES, IS_DEMO, type DemoSample } from "./demo";
import PlanningModal, { type PlanTab } from "./components/PlanningModal";
import StateInspector from "./components/StateInspector";
import type { ComplexityResult, TraceStep } from "./types";

const SAMPLE_CODE = `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

# Used by "Analyze Big-O": returns the args list for input size n
def gen_input(n):
    return [list(range(n, 0, -1))]
`;

export default function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [functionName, setFunctionName] = useState("bubble_sort");
  const [argsText, setArgsText] = useState("[[5, 2, 9, 1, 7]]");
  const [kwargsText, setKwargsText] = useState("{}");
  // The entire debug session state: one immutable array + one index (ADR-003).
  const [timeline, setTimeline] = useState<TraceStep[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bigO, setBigO] = useState<ComplexityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [planTab, setPlanTab] = useState<PlanTab | null>(null);
  const [pseudocode, setPseudocode] = useState(
    () => localStorage.getItem("dsa-debugger.pseudocode") ?? "",
  );

  useEffect(() => {
    localStorage.setItem("dsa-debugger.pseudocode", pseudocode);
  }, [pseudocode]);

  const insertPseudocode = () => {
    const commented = pseudocode
      .trimEnd()
      .split("\n")
      .map((line) => (line.trim() ? `# ${line}` : "#"))
      .join("\n");
    setCode((prev) => `${commented}\n\n${prev}`);
    setPlanTab(null);
    setNotice("Pseudocode inserted at the top of the editor as comments.");
  };

  const debugging = timeline !== null && timeline.length > 0;
  const frame = debugging ? timeline![currentStep] : null;

  const loadDemoSample = (sample: DemoSample) => {
    setCode(sample.code);
    setFunctionName(sample.functionName);
    setArgsText(sample.argsText);
    setKwargsText("{}");
    setTimeline(sample.timeline);
    setCurrentStep(0);
    setBigO(null);
    setError(null);
    setNotice(`Loaded pre-recorded trace: ${sample.label}`);
  };

  const handleRun = async () => {
    setError(null);
    setNotice(null);
    if (IS_DEMO) {
      setError(
        "This is a static demo — the tracing backend isn't deployed. " +
          "Load one of the pre-recorded samples above, or clone the repo " +
          "and run the FastAPI backend locally for live tracing.",
      );
      return;
    }
    let args: unknown[];
    let kwargs: Record<string, unknown>;
    try {
      args = JSON.parse(argsText || "[]");
      kwargs = JSON.parse(kwargsText || "{}");
      if (!Array.isArray(args)) throw new Error("Arguments must be a JSON array");
    } catch (e) {
      setError(`Invalid arguments: ${(e as Error).message}`);
      return;
    }
    setLoading(true);
    try {
      // Full-load strategy (ADR-004): one request, whole timeline in memory.
      const steps = await runTrace({
        code,
        function_name: functionName,
        args,
        kwargs,
      });
      if (steps.length === 0) {
        setError("Execution produced no trace steps.");
        return;
      }
      setTimeline(steps);
      setCurrentStep(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeBigO = async () => {
    setError(null);
    setNotice(null);
    if (IS_DEMO) {
      const sample = DEMO_SAMPLES.find(
        (s) => s.functionName === functionName && s.bigO,
      );
      if (sample?.bigO) {
        setBigO(sample.bigO);
        setNotice(`Pre-recorded Big-O analysis for ${sample.label}.`);
      } else {
        setError(
          "Live Big-O analysis needs the backend — in this demo it is " +
            "pre-recorded for Bubble Sort only. Load that sample and try again.",
        );
      }
      return;
    }
    if (!code.includes("def gen_input")) {
      setError(
        'Big-O analysis needs a generator in your code: define e.g. ' +
          '"def gen_input(n): return [list(range(n, 0, -1))]" — it must ' +
          "return the positional-arguments list for input size n.",
      );
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeComplexity({
        code,
        function_name: functionName,
      });
      setBigO(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Minimal Python-aware editing: keep indentation on Enter (one extra
  // level after a trailing ":"), and make Tab insert spaces instead of
  // moving focus out of the textarea.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    const insertText = (text: string) => {
      e.preventDefault();
      const next =
        value.slice(0, selectionStart) + text + value.slice(selectionEnd);
      setCode(next);
      const caret = selectionStart + text.length;
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = caret;
      });
    };

    if (e.key === "Tab") {
      insertText("    ");
    } else if (e.key === "Enter") {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = value.slice(lineStart, selectionStart);
      let indent = currentLine.match(/^[ \t]*/)?.[0] ?? "";
      if (currentLine.trimEnd().endsWith(":")) indent += "    ";
      insertText("\n" + indent);
    }
  };

  const handleSaveToDesktop = () => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${functionName || "snippet"}.py`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToServer = async () => {
    setError(null);
    if (IS_DEMO) {
      setError(
        "Server-side saving needs the backend — use Save to Desktop here.",
      );
      return;
    }
    try {
      const result = await saveToServer(functionName || "snippet", code);
      setNotice(`Saved on server: ${result.location}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const step = useCallback(
    (delta: number) => {
      if (!timeline) return;
      setCurrentStep((s) =>
        Math.min(timeline.length - 1, Math.max(0, s + delta)),
      );
    },
    [timeline],
  );

  useEffect(() => {
    if (!debugging || planTab !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugging, planTab, step]);

  const previousVariables = useMemo(
    () =>
      debugging && currentStep > 0
        ? timeline![currentStep - 1].local_variables
        : null,
    [debugging, timeline, currentStep],
  );

  const inputClass =
    "rounded border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-800">
            DSA Visual Debugger
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} w-36`}
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              placeholder="function name"
              title="Target function name"
            />
            <input
              className={`${inputClass} w-48`}
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder="args (JSON array)"
              title="Positional arguments as a JSON array"
            />
            <input
              className={`${inputClass} w-28`}
              value={kwargsText}
              onChange={(e) => setKwargsText(e.target.value)}
              placeholder="kwargs"
              title="Keyword arguments as a JSON object"
            />
            <button
              onClick={handleRun}
              disabled={loading}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Tracing…" : "▶ Run & Trace"}
            </button>
            <button
              onClick={() => setPlanTab("pseudo")}
              className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              📝 PseudoCode
            </button>
            <button
              onClick={() => setPlanTab("flow")}
              className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              🔀 Flow Chart
            </button>
            <button
              onClick={handleAnalyzeBigO}
              disabled={analyzing}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {analyzing ? "Measuring…" : "📈 Analyze Big-O"}
            </button>
            <button
              onClick={handleSaveToDesktop}
              className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              ⬇ Save to Desktop
            </button>
            <button
              onClick={handleSaveToServer}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Save to Server
            </button>
          </div>
        </div>
        {IS_DEMO && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <span className="font-semibold">Static demo</span>
            <span>— explore pre-recorded traces:</span>
            {DEMO_SAMPLES.map((sample) => (
              <button
                key={sample.key}
                onClick={() => loadDemoSample(sample)}
                className="rounded border border-sky-400 bg-white px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                {sample.label}
              </button>
            ))}
            <span className="text-xs text-sky-600">
              (clone the repo to trace your own code live)
            </span>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        )}
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Left panel: code editor / highlighted viewer */}
        <section className="flex min-h-[420px] flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Code
            </h2>
            {debugging && (
              <button
                onClick={() => setTimeline(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                ✎ Edit Code
              </button>
            )}
          </div>
          {debugging ? (
            <CodeViewer code={code} activeLine={frame!.line_number} />
          ) : (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              className="h-full min-h-[420px] flex-1 resize-none rounded-lg border border-slate-300 bg-slate-900 p-4 font-mono text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          )}
        </section>

        {/* Right panel: state inspection */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            State Inspector
          </h2>
          <div className="space-y-4">
            {bigO && <BigOPanel result={bigO} onClose={() => setBigO(null)} />}
            {debugging ? (
              <StateInspector
                timeline={timeline!}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                previousVariables={previousVariables}
              />
            ) : (
              !bigO && (
                <div className="rounded-lg border-2 border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
                  Run a trace to inspect execution state step by step.
                </div>
              )
            )}
          </div>
        </section>
      </main>

      {planTab !== null && (
        <PlanningModal
          tab={planTab}
          onTabChange={setPlanTab}
          onClose={() => setPlanTab(null)}
          pseudocode={pseudocode}
          onPseudocodeChange={setPseudocode}
          onInsertPseudocode={insertPseudocode}
        />
      )}
    </div>
  );
}
