import { useMemo, useState } from "react";
import type { ComplexityResult } from "../types";

/* Chart chrome from the reference dataviz palette (light mode). */
const SERIES = "#2a78d6";
const INK_PRIMARY = "#0b0b0b";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";
const BASELINE = "#c3c2b7";

/** Growth models mirrored from the backend, keyed by complexity label,
 * used to draw the fitted curve from the returned coefficients. */
const MODEL_FN: Record<string, (n: number) => number> = {
  "O(1)": () => 1,
  "O(log n)": (n) => (n > 1 ? Math.log2(n) : 1),
  "O(n)": (n) => n,
  "O(n log n)": (n) => (n > 1 ? n * Math.log2(n) : 1),
  "O(n²)": (n) => n * n,
  "O(n³)": (n) => n * n * n,
  "O(2ⁿ)": (n) => 2 ** n,
};

const WIDTH = 460;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 34, left: 56 };

export default function BigOPanel({
  result,
  onClose,
}: {
  result: ComplexityResult;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { points, curve, yTicks, xTicks } = useMemo(() => {
    const ms = result.measurements;
    const maxN = Math.max(...ms.map((m) => m.n));
    const minN = Math.min(...ms.map((m) => m.n));
    const [a, b] = result.coefficients;
    const fn = MODEL_FN[result.best_fit] ?? ((n: number) => n);
    const fitAt = (n: number) => Math.max(0, a * fn(n) + b);
    const maxY = Math.max(...ms.map((m) => m.steps), fitAt(maxN)) * 1.05;

    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const sx = (n: number) => PAD.left + ((n - minN) / (maxN - minN)) * plotW;
    const sy = (y: number) => PAD.top + plotH - (y / maxY) * plotH;

    const pts = ms.map((m) => ({ ...m, x: sx(m.n), y: sy(m.steps) }));

    const curvePts: string[] = [];
    const samples = 60;
    for (let i = 0; i <= samples; i++) {
      const n = minN + ((maxN - minN) * i) / samples;
      curvePts.push(`${sx(n).toFixed(1)},${sy(fitAt(n)).toFixed(1)}`);
    }

    const yTickValues = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
    return {
      points: pts,
      curve: curvePts.join(" "),
      yTicks: yTickValues.map((v) => ({ v, y: sy(v) })),
      xTicks: ms.map((m) => ({ n: m.n, x: sx(m.n) })),
    };
  }, [result]);

  const formatSteps = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Big-O Analysis
        </h2>
        <button
          onClick={onClose}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          ✕ Close
        </button>
      </div>

      {/* Verdict */}
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <span className="rounded-full bg-indigo-600 px-4 py-1 font-mono text-lg font-bold text-white">
          {result.best_fit}
        </span>
        <span className="text-sm text-slate-500">
          best fit · R² = {result.r_squared.toFixed(4)}
        </span>
        {result.truncated && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            larger sizes hit the safety limit — partial data
          </span>
        )}
      </div>

      {/* Chart: measured steps (dots) vs fitted curve (dashed) */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Traced steps versus input size; best fit ${result.best_fit}`}
      >
        {yTicks.map(({ v, y }, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              stroke={GRIDLINE}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y + 3.5}
              textAnchor="end"
              fontSize={10}
              fill={INK_MUTED}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatSteps(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          stroke={BASELINE}
          strokeWidth={1}
        />
        {xTicks.map(({ n, x }) => (
          <text
            key={n}
            x={x}
            y={HEIGHT - PAD.bottom + 14}
            textAnchor="middle"
            fontSize={10}
            fill={INK_MUTED}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {n}
          </text>
        ))}
        <text
          x={(PAD.left + WIDTH - PAD.right) / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize={10}
          fill={INK_MUTED}
        >
          input size n
        </text>
        <text
          x={12}
          y={PAD.top + 4}
          fontSize={10}
          fill={INK_MUTED}
        >
          steps
        </text>

        {/* Fitted curve: dashed, direct-labeled at its end */}
        <polyline
          points={curve}
          fill="none"
          stroke={SERIES}
          strokeWidth={2}
          strokeDasharray="5 4"
          opacity={0.7}
        />
        <text
          x={WIDTH - PAD.right}
          y={PAD.top + 12}
          textAnchor="end"
          fontSize={10}
          fill={INK_PRIMARY}
        >
          fit: {result.best_fit}
        </text>

        {/* Measured points with per-mark hover */}
        {points.map((p, i) => (
          <g key={p.n}>
            {/* oversized invisible hit target */}
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={hovered === i ? 6 : 4.5}
              fill={SERIES}
              stroke="#ffffff"
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        ))}
        {hovered !== null && (
          <g pointerEvents="none">
            <rect
              x={Math.min(points[hovered].x + 10, WIDTH - 130)}
              y={Math.max(points[hovered].y - 34, 4)}
              width={120}
              height={28}
              rx={4}
              fill="#ffffff"
              stroke={GRIDLINE}
            />
            <text
              x={Math.min(points[hovered].x + 18, WIDTH - 122)}
              y={Math.max(points[hovered].y - 16, 22)}
              fontSize={11}
              fill={INK_PRIMARY}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              n = {points[hovered].n} · {points[hovered].steps.toLocaleString()} steps
            </text>
          </g>
        )}
      </svg>

      {/* Table view of the same data */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-1 pr-4">n</th>
              <th className="py-1 pr-4">traced steps</th>
            </tr>
          </thead>
          <tbody className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
            {result.measurements.map((m) => (
              <tr key={m.n} className="border-b border-slate-100">
                <td className="py-1 pr-4">{m.n}</td>
                <td className="py-1 pr-4">{m.steps.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Runner-up fits */}
      <div className="mt-3 text-xs text-slate-500">
        Other candidates:{" "}
        {result.fits.slice(1).map((f) => (
          <span key={f.complexity} className="mr-3 font-mono">
            {f.complexity} (R² {f.r_squared.toFixed(3)})
          </span>
        ))}
      </div>
    </div>
  );
}