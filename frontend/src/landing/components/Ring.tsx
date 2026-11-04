import { useEffect, useRef } from "react";
import { STEPS } from "../data";

const CX = 200;
const CY = 200;
const R = 150;

function pos(i: number) {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
}

interface RingProps {
  active: number;
  onSelect: (i: number) => void;
}

// The loop as an orbiting signal. The dot keeps circling; clicking a node selects that step.
export default function Ring({ active, onSelect }: RingProps) {
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let angle = 0;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      angle = (angle + 0.6) % 360;
      const a = ((angle - 90) * Math.PI) / 180;
      dotRef.current?.setAttribute("cx", (CX + R * Math.cos(a)).toFixed(2));
      dotRef.current?.setAttribute("cy", (CY + R * Math.sin(a)).toFixed(2));
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const current = STEPS[active];

  return (
    <svg viewBox="0 0 400 400" className="loop-ring" role="group" aria-label="Framework loop">
      <defs>
        <linearGradient id="ld-ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#cfd5dd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#4a505a" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="ld-core" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#2a2e36" />
          <stop offset="100%" stopColor="#0b0c0f" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#ld-ringGrad)" strokeWidth="1.2" className="ring-track" />
      <circle cx={CX} cy={CY} r="96" fill="url(#ld-core)" stroke="rgba(230,234,240,0.06)" />

      <text x={CX} y={CY - 14} textAnchor="middle" className="ring-core-eyebrow">step</text>
      <text x={CX} y={CY + 14} textAnchor="middle" className="ring-core-title">{current.title}</text>
      <text x={CX} y={CY + 38} textAnchor="middle" className="ring-core-num">{current.n} / 05</text>

      <circle ref={dotRef} cx={CX} cy={CY - R} r="5" className="ring-dot" />

      {STEPS.map((s, i) => {
        const p = pos(i);
        const on = i === active;
        return (
          <g
            key={s.id}
            className={`ring-node ${on ? "is-on" : ""}`}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(i)}
            tabIndex={0}
            role="button"
            aria-label={`Step ${s.n}: ${s.title}`}
            aria-pressed={on}
          >
            <circle cx={p.x} cy={p.y} r="27" className="ring-node-bg" />
            <text x={p.x} y={p.y + 5} textAnchor="middle" className="ring-node-num">{s.n}</text>
          </g>
        );
      })}
    </svg>
  );
}
