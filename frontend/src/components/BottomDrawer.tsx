import { useEffect, useState, type ReactNode } from "react";
import type { RunErrorInfo, SerializedValue, TraceStep } from "../types";
import StateInspector from "./StateInspector";
import VariableStateTracker from "./VariableStateTracker";

export type RunStatus = "idle" | "running" | "ok" | "error";

type SectionId = "console" | "stack";

/* Each section has its own accent so the two never read as the same panel. */
const ACCENT: Record<
  SectionId,
  { bar: string; header: string; ring: string; title: string; hint: string }
> = {
  console: {
    bar: "bg-sky-500",
    header: "bg-sky-50",
    ring: "ring-sky-400",
    title: "text-sky-800",
    hint: "text-sky-600",
  },
  stack: {
    bar: "bg-violet-500",
    header: "bg-violet-50",
    ring: "ring-violet-400",
    title: "text-violet-800",
    hint: "text-violet-600",
  },
};

const INFO: Record<SectionId, { title: string; body: string }> = {
  console: {
    title: "Console & result",
    body:
      "What the run produced. After a successful run it shows the step count and the final variable values. " +
      "If the run failed, it shows the error type, message and line number.",
  },
  stack: {
    title: "Stack trace & state",
    body:
      "Where execution stopped. After a failure it lists the function calls that led to the error, innermost last. " +
      "After a successful run it lets you step through the timeline and inspect variables at each step.",
  },
};

/**
 * Execution drawer with two sections. Left: console output and the run's
 * result. Right: the stack trace when a run fails, otherwise the step
 * scrubber and variable state.
 *
 * Focus: a failed run puts the stack trace in focus and dims the console.
 * Clicking either section pins focus to it until the next run.
 */
export default function BottomDrawer({
  status,
  timeline,
  currentStep,
  onStepChange,
  previousVariables,
  runError,
  code,
  selectedFrame,
  onSelectFrame,
  onClose,
}: {
  selectedFrame: number | null;
  onSelectFrame: (index: number) => void;
  status: RunStatus;
  timeline: TraceStep[] | null;
  currentStep: number;
  onStepChange: (step: number) => void;
  previousVariables: Record<string, SerializedValue> | null;
  runError: RunErrorInfo | null;
  code: string;
  onClose: () => void;
}) {
  const [pinned, setPinned] = useState<SectionId | null>(null);
  // A new run status clears any manual focus so the default emphasis returns.
  useEffect(() => setPinned(null), [status]);

  const autoFocus: SectionId | null = status === "error" ? "stack" : null;
  const focus = pinned ?? autoFocus;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Execution
        </span>
        <button
          onClick={onClose}
          aria-label="Hide execution panel"
          className="rounded px-2 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800"
        >
          ✕
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-slate-200 md:grid-cols-2">
        <Section
          id="console"
          focus={focus}
          onActivate={setPinned}
        >
          <ConsoleContent
            status={status}
            timeline={timeline}
            runError={runError}
          />
        </Section>
        <Section
          id="stack"
          focus={focus}
          onActivate={setPinned}
        >
          <StateContent
            status={status}
            timeline={timeline}
            currentStep={currentStep}
            onStepChange={onStepChange}
            previousVariables={previousVariables}
            runError={runError}
            code={code}
            selectedFrame={selectedFrame}
            onSelectFrame={onSelectFrame}
          />
        </Section>
      </div>
    </div>
  );
}

/** One drawer section: accent header, info tip, and focus/dim treatment. */
function Section({
  id,
  focus,
  onActivate,
  children,
}: {
  id: SectionId;
  focus: SectionId | null;
  onActivate: (id: SectionId) => void;
  children: ReactNode;
}) {
  const accent = ACCENT[id];
  const info = INFO[id];
  const isFocused = focus === id;
  const isDimmed = focus !== null && !isFocused;

  return (
    <section
      onMouseDown={() => onActivate(id)}
      aria-current={isFocused ? "true" : undefined}
      className={`flex min-h-0 flex-col bg-white transition-all duration-300 ${
        isFocused ? `ring-2 ring-inset ${accent.ring}` : ""
      } ${isDimmed ? "opacity-50 blur-[1.5px] saturate-50" : "opacity-100"}`}
    >
      <header
        className={`flex items-center gap-2 border-b border-slate-200 px-4 py-2 ${accent.header}`}
      >
        <span aria-hidden className={`h-4 w-1 rounded-full ${accent.bar}`} />
        <h2 className={`text-xs font-semibold uppercase tracking-wider ${accent.title}`}>
          {info.title}
        </h2>
        <InfoTip label={info.title}>{info.body}</InfoTip>
        {isFocused && focus !== null && (
          <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${accent.hint}`}>
            {id === "stack" && status === "error" ? "Focus: error" : "Focused"}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}

/** Small "i" button; the explanation appears on hover or keyboard focus. */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`About ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold text-slate-500 hover:border-slate-600 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-6 z-30 w-72 rounded-lg bg-slate-900 p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-100 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

function ConsoleContent({
  status,
  timeline,
  runError,
}: {
  status: RunStatus;
  timeline: TraceStep[] | null;
  runError: RunErrorInfo | null;
}) {
  if (status === "running") {
    return <p className="font-code text-sm text-slate-500">Tracing…</p>;
  }
  if (status === "error" && runError) {
    return (
      <div className="space-y-2 font-code text-sm">
        <p className="font-semibold text-rose-600">
          ✗ {runError.error_type ?? "Error"}
          {runError.line_number ? ` on line ${runError.line_number}` : ""}
        </p>
        <p className="whitespace-pre-wrap break-words text-rose-700">
          {runError.message}
        </p>
      </div>
    );
  }
  if (status === "ok" && timeline && timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    return (
      <div className="space-y-4">
        <p className="font-code text-sm text-emerald-700">
          ✓ Traced {timeline.length} steps
        </p>
        <div>
          <h3 className="mb-2 text-xs font-semibold text-slate-500">
            Final variables
          </h3>
          <VariableStateTracker
            variables={last.local_variables}
            previousVariables={null}
          />
        </div>
        <p className="text-xs text-slate-400">
          Note: print() output isn’t captured yet — the trace records variable
          state, not stdout.
        </p>
      </div>
    );
  }
  return (
    <p className="text-sm text-slate-400">
      Press <kbd className="rounded border border-slate-300 px-1 text-xs">Ctrl</kbd>/
      <kbd className="rounded border border-slate-300 px-1 text-xs">⌘</kbd>+
      <kbd className="rounded border border-slate-300 px-1 text-xs">Enter</kbd> to
      run and trace your code.
    </p>
  );
}

function StateContent({
  status,
  timeline,
  currentStep,
  onStepChange,
  previousVariables,
  runError,
  code,
  selectedFrame,
  onSelectFrame,
}: {
  status: RunStatus;
  timeline: TraceStep[] | null;
  currentStep: number;
  onStepChange: (step: number) => void;
  previousVariables: Record<string, SerializedValue> | null;
  runError: RunErrorInfo | null;
  code: string;
  selectedFrame: number | null;
  onSelectFrame: (index: number) => void;
}) {
  if (status === "error" && runError) {
    const codeLines = code.split("\n");
    // Show the innermost frame last, the same order Python prints tracebacks.
    const frames = runError.stack;
    // Default to the innermost frame, where the error was raised.
    const activeIndex = selectedFrame ?? frames.length - 1;
    return (
      <div className="space-y-3">
        {frames.length === 0 && (
          <p className="text-sm text-slate-500">
            No user-code frames were recorded for this failure.
          </p>
        )}
        <ol className="space-y-2">
          {frames.map((frame, i) => {
            const active = i === activeIndex;
            const text = codeLines[frame.line_number - 1] ?? "";
            const hasSpan =
              frame.col_start != null &&
              frame.col_end != null &&
              frame.col_end > frame.col_start;
            return (
              <li key={`${frame.frame_name}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSelectFrame(i)}
                  aria-pressed={active}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-violet-300 bg-violet-50 ring-1 ring-violet-300"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      in <span className="font-code">{frame.frame_name}</span>
                    </span>
                    <span className="font-code text-slate-500">
                      line {frame.line_number}
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre font-code text-xs text-slate-700">
                    {hasSpan ? (
                      <>
                        {text.slice(0, frame.col_start!)}
                        <mark className="rounded bg-rose-200 px-0.5 text-rose-900">
                          {text.slice(frame.col_start!, frame.col_end!)}
                        </mark>
                        {text.slice(frame.col_end!)}
                      </>
                    ) : (
                      text
                    )}
                  </pre>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  if (status === "ok" && timeline && timeline.length > 0) {
    return (
      <StateInspector
        timeline={timeline}
        currentStep={currentStep}
        onStepChange={onStepChange}
        previousVariables={previousVariables}
      />
    );
  }
  return (
    <p className="text-sm text-slate-400">
      Stack frames and variable state appear here after a run.
    </p>
  );
}
