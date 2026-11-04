import type { StepInfo } from "../data";

// Small animated SVG per step. Pure decoration that mirrors the idea of each step.
export default function StepVisual({ id }: { id: StepInfo["id"] }) {
  if (id === "problem") {
    // Scattered unknowns, one cluster lit by a question boundary.
    const dots = Array.from({ length: 46 }, (_, i) => {
      const a = i * 2.399; // golden-angle spread
      const r = 18 + Math.sqrt(i) * 13;
      return { x: 200 + r * Math.cos(a), y: 110 + r * Math.sin(a) * 0.62, hot: r < 70 };
    });
    return (
      <svg viewBox="0 0 400 220" className="vis">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.hot ? 3.6 : 2.2}
            className={d.hot ? "vis-hot pulse" : "vis-dim"}
            style={{ animationDelay: `${(i % 9) * 0.15}s` }}
          />
        ))}
        <ellipse cx="200" cy="110" rx="78" ry="48" className="vis-boundary" />
        <text x="200" y="116" textAnchor="middle" className="vis-q">?</text>
      </svg>
    );
  }

  if (id === "metrics") {
    // Gauge: needle sweeps to the goal mark.
    return (
      <svg viewBox="0 0 400 220" className="vis">
        <path d="M 60 190 A 140 140 0 0 1 340 190" className="vis-track" />
        <path d="M 60 190 A 140 140 0 0 1 340 190" className="vis-track-fill" pathLength={100} />
        <line x1="200" y1="190" x2="200" y2="62" className="vis-needle" />
        <circle cx="200" cy="190" r="7" className="vis-hot" />
        <g className="vis-goal">
          <line x1="262" y1="78" x2="282" y2="62" />
          <text x="290" y="56">goal</text>
        </g>
      </svg>
    );
  }

  if (id === "logic") {
    // Component graph with signals flowing along edges.
    const nodes = [
      { x: 60, y: 110, t: "data" },
      { x: 170, y: 50, t: "algo" },
      { x: 170, y: 170, t: "threshold" },
      { x: 300, y: 110, t: "output" },
    ];
    const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3]];
    return (
      <svg viewBox="0 0 400 220" className="vis">
        {edges.map(([a, b], i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} className="vis-edge" />
        ))}
        {edges.map(([a, b], i) => (
          <circle key={`s${i}`} r="3.4" className="vis-hot">
            <animateMotion
              dur="2.6s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
              path={`M${nodes[a].x} ${nodes[a].y} L${nodes[b].x} ${nodes[b].y}`}
            />
          </circle>
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="22" className="vis-node" />
            <text x={n.x} y={n.y + 4} textAnchor="middle" className="vis-label">{n.t}</text>
          </g>
        ))}
      </svg>
    );
  }

  if (id === "compare") {
    // Actual bar rises above the goal line.
    return (
      <svg viewBox="0 0 400 220" className="vis">
        <line x1="40" y1="170" x2="360" y2="170" className="vis-axis" />
        <rect x="90" y="70" width="90" height="100" rx="6" className="vis-bar" />
        <rect x="230" y="110" width="90" height="60" rx="6" className="vis-bar-goal" />
        <line x1="40" y1="110" x2="360" y2="110" className="vis-goal-line" />
        <text x="135" y="190" textAnchor="middle" className="vis-label">attempt</text>
        <text x="275" y="190" textAnchor="middle" className="vis-label">goal</text>
        <text x="290" y="104" className="vis-goal">target</text>
      </svg>
    );
  }

  // adjust: three knobs that slide back and forth.
  return (
    <svg viewBox="0 0 400 220" className="vis">
      {[60, 110, 160].map((y, i) => (
        <g key={y}>
          <line x1="70" y1={y} x2="330" y2={y} className="vis-track-line" />
          <circle r="11" cy={y} className="vis-knob" style={{ animationDelay: `${i * 0.4}s` }} />
          <text x="340" y={y + 4} className="vis-label">c{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}
