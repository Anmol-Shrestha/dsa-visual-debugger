import { useEffect, useState } from "react";

// Simulated lookup latency. The numbers are illustrative, chosen so the loop has real work to do.
const GOAL = 1; // µs
type DsKey = "list" | "bst" | "hash";
const DS: Record<DsKey, { label: string; base: number }> = {
  list: { label: "Linear list", base: 1200 },
  bst: { label: "Balanced BST", base: 180 },
  hash: { label: "Hash set", base: 6 },
};
const ORDER: DsKey[] = ["list", "bst", "hash"];

interface LabState {
  ds: DsKey;
  cache: number;
  batch: number;
}

const START: LabState = { ds: "list", cache: 0, batch: 8 };
const MAX_MEASURES = 15;

export function latency({ ds, cache, batch }: LabState): number {
  return (DS[ds].base / (1 + cache * 0.6)) * (1 + 0.05 * batch);
}

interface Proposal {
  label: string;
  next: LabState;
}

// Candidate single-component changes. Adjust picks the one that helps most.
function proposals(s: LabState): Proposal[] {
  const out: Proposal[] = [];
  const i = ORDER.indexOf(s.ds);
  if (i < ORDER.length - 1) {
    const ds = ORDER[i + 1];
    out.push({ label: `Structure → ${DS[ds].label}`, next: { ...s, ds } });
  }
  if (s.cache < 10) out.push({ label: `Cache → ${s.cache + 1}`, next: { ...s, cache: s.cache + 1 } });
  if (s.batch > 0) out.push({ label: `Batch → ${s.batch - 1}`, next: { ...s, batch: s.batch - 1 } });
  return out;
}

function bestAdjustment(s: LabState): Proposal | null {
  const current = latency(s);
  const options = proposals(s).filter((p) => latency(p.next) < current);
  if (!options.length) return null;
  return options.reduce((a, b) => (latency(b.next) < latency(a.next) ? b : a));
}

type LogEntry =
  | { type: "measure"; value: number; met: boolean }
  | { type: "adjust"; text: string }
  | { type: "note"; text: string };

const LOG_MIN = -1;
const LOG_MAX = 4; // 0.1 µs to 10,000 µs on a log scale
const yFor = (v: number, H: number, top: number) =>
  top + ((LOG_MAX - Math.log10(v)) / (LOG_MAX - LOG_MIN)) * H;
const fmt = (v: number) => (v < 10 ? v.toFixed(2) : String(Math.round(v)));

export default function Lab() {
  const [s, setS] = useState<LabState>(START);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);

  const value = latency(s);
  const met = value <= GOAL;
  const measures = log.filter((e): e is Extract<LogEntry, { type: "measure" }> => e.type === "measure");

  const measure = () => setLog((l) => [...l, { type: "measure", value, met }]);

  const adjust = () => {
    const best = bestAdjustment(s);
    if (!best) {
      setLog((l) => [...l, { type: "note", text: "No single change improves latency. The framing may be wrong." }]);
      return;
    }
    setS(best.next);
    setLog((l) => [...l, { type: "adjust", text: best.label }]);
  };

  // Auto-run: measure, stop if met, otherwise adjust once, then repeat.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      const v = latency(s);
      const ok = v <= GOAL;
      setLog((l) => [...l, { type: "measure", value: v, met: ok }]);
      if (ok || measures.length + 1 >= MAX_MEASURES) {
        setRunning(false);
        return;
      }
      const best = bestAdjustment(s);
      if (!best) {
        setLog((l) => [...l, { type: "note", text: "Stuck: no single change helps. Reframe the problem." }]);
        setRunning(false);
        return;
      }
      setS(best.next);
      setLog((l) => [...l, { type: "adjust", text: best.label }]);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, s, log.length]);

  const reset = () => {
    setRunning(false);
    setS(START);
    setLog([]);
  };

  // Chart geometry
  const W = 600;
  const H = 200;
  const top = 16;
  const left = 44;
  const bw = 28;
  const goalY = yFor(GOAL, H, top);

  return (
    <div className="lab">
      <div className="card lab-controls">
        <p className="eyebrow">Components</p>

        <div className="seg" role="radiogroup" aria-label="Data structure">
          {ORDER.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={s.ds === k}
              className={s.ds === k ? "is-on" : ""}
              onClick={() => setS({ ...s, ds: k })}
            >
              {DS[k].label}
            </button>
          ))}
        </div>

        <label className="slider">
          <span>Cache size <b>{s.cache}</b></span>
          <input type="range" min="0" max="10" value={s.cache} onChange={(e) => setS({ ...s, cache: +e.target.value })} />
        </label>
        <label className="slider">
          <span>Batch size <b>{s.batch}</b></span>
          <input type="range" min="0" max="10" value={s.batch} onChange={(e) => setS({ ...s, batch: +e.target.value })} />
        </label>

        <div className="lab-actions">
          <button className="btn" onClick={measure} disabled={running}>Measure</button>
          <button className="btn" onClick={adjust} disabled={running}>Adjust one</button>
          <button className="btn btn-primary" onClick={() => setRunning((r) => !r)} disabled={met && !running}>
            {running ? "Pause loop" : "Run loop"}
          </button>
          <button className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="card lab-chart">
        <div className="readout">
          <div>
            <p className="eyebrow">Lookup latency</p>
            <p className={`big ${met ? "is-met" : ""}`}>
              {fmt(value)}
              <span> µs</span>
            </p>
          </div>
          <span className={`badge ${met ? "badge-met" : ""}`}>
            {met ? "Goal met" : `${(value / GOAL).toFixed(value / GOAL > 10 ? 0 : 1)}× above goal`}
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H + 40}`} className="chart" role="img" aria-label="Measured latency per iteration against goal">
          {[0.1, 1, 10, 100, 1000, 10000].map((v) => (
            <g key={v}>
              <line x1={left} x2={W} y1={yFor(v, H, top)} y2={yFor(v, H, top)} className="lab-gridline" />
              <text x={left - 8} y={yFor(v, H, top) + 4} textAnchor="end" className="axis">
                {v >= 1 ? v : v.toFixed(1)}
              </text>
            </g>
          ))}
          <line x1={left} x2={W} y1={goalY} y2={goalY} className="goal-line" />
          <text x={W - 4} y={goalY - 6} textAnchor="end" className="goal-text">goal 1 µs</text>
          {measures.map((m, i) => {
            const x = left + 12 + i * (bw + 10);
            const y = yFor(m.value, H, top);
            return (
              <g key={i}>
                <rect x={x} y={y} width={bw} height={H + top - y} rx="4" className={m.met ? "bar bar-met" : "bar"} />
                <text x={x + bw / 2} y={H + top + 16} textAnchor="middle" className="axis">{i + 1}</text>
              </g>
            );
          })}
        </svg>

        <ol className="log">
          {log.length === 0 && <li className="muted">Nothing measured yet. Try Measure, or Run loop.</li>}
          {log.slice(-8).map((e, i) => (
            <li key={i} className={`log-${e.type}`}>
              {e.type === "measure" && (
                <>Measured <b>{fmt(e.value)} µs</b> {e.met ? "· goal met" : "· above goal"}</>
              )}
              {e.type === "adjust" && <>Adjusted: {e.text}</>}
              {e.type === "note" && <>{e.text}</>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
