const buttonClass =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40";

/** Scrubber over the recorded timeline: 0 .. length-1 (ADR-004). */
export default function TimelineSlider({
  length,
  current,
  onChange,
}: {
  length: number;
  current: number;
  onChange: (step: number) => void;
}) {
  const max = length - 1;
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Timeline
        </h2>
        <span className="font-mono text-sm text-slate-500">
          step {current} / {max}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          onClick={() => onChange(0)}
          disabled={current === 0}
          title="Jump to start"
        >
          ⏮
        </button>
        <button
          className={buttonClass}
          onClick={() => onChange(Math.max(0, current - 1))}
          disabled={current === 0}
          title="Step back"
        >
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={max}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-indigo-600"
        />
        <button
          className={buttonClass}
          onClick={() => onChange(Math.min(max, current + 1))}
          disabled={current === max}
          title="Step forward"
        >
          ▶
        </button>
        <button
          className={buttonClass}
          onClick={() => onChange(max)}
          disabled={current === max}
          title="Jump to end"
        >
          ⏭
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Tip: use ← / → arrow keys to step.
      </p>
    </div>
  );
}
