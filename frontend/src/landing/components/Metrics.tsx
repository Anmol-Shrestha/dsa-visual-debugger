import { useEffect, useRef, useState, type RefObject } from "react";
import { METRIC_EXAMPLES, type MetricExample } from "../data";

function useInView<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

function MetricCard({ m }: { m: MetricExample }) {
  const [ref, seen] = useInView<HTMLElement>();
  const [hover, setHover] = useState(false);
  return (
    <article
      ref={ref}
      className="card metric"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className="eyebrow">{m.problem}</p>
      <h4>{m.metric}</h4>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: seen ? `${m.fraction * 100}%` : "0%" }} />
        <div className="meter-goal" />
      </div>
      <div className="metric-foot">
        <span>goal · {m.goal}</span>
        <span className={hover ? "show" : ""}>support · {m.support}</span>
      </div>
      <p className="muted small">First attempt, illustrative position.</p>
    </article>
  );
}

export default function Metrics() {
  return (
    <div className="metrics">
      {METRIC_EXAMPLES.map((m) => (
        <MetricCard key={m.problem} m={m} />
      ))}
    </div>
  );
}
