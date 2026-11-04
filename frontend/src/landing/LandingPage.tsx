import { useEffect, useRef, useState, type ReactNode } from "react";
import Background from "./components/Background";
import Lab from "./components/Lab";
import Metrics from "./components/Metrics";
import Ring from "./components/Ring";
import StepPanel from "./components/StepPanel";
import { STEPS } from "./data";
import "./landing.css";

interface RevealProps {
  id: string;
  children: ReactNode;
}

function Reveal({ id, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.12 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <section id={id} ref={ref} className={`section reveal ${on ? "in" : ""}`}>
      <div className="wrap">{children}</div>
    </section>
  );
}

interface LandingPageProps {
  /** Hash that opens the debugger. */
  appHref: string;
}

export default function LandingPage({ appHref }: LandingPageProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="landing">
      <Background />
      <div className="grain" aria-hidden="true" />

      <main>
        <header className="nav wrap">
          <span className="brand">The Metric Loop</span>
          <nav>
            <a href="#loop">Loop</a>
            <a href="#lab">Lab</a>
            <a href="#metrics">Metrics</a>
            <a href={appHref}>Debugger</a>
          </nav>
        </header>

        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">Framework · Draft</p>
            <h1>A metric-driven loop for practical problem solving.</h1>
            <p className="lead">
              Name the problem, measure what matters, set a goal, build a first version, compare, then adjust one
              component at a time until the goal is met.
            </p>
            <div className="chips">
              <span className="chip is-on">Framework: complete</span>
            </div>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#loop">Walk the loop</a>
              <a className="btn" href="#lab">Open the lab</a>
              <a className="btn" href={appHref}>Open the debugger</a>
            </div>
          </div>
          <div className="hero-visual">
            <Ring active={active} onSelect={setActive} />
            <p className="hint">Click a node</p>
          </div>
        </section>

        <Reveal id="loop">
          <p className="eyebrow">The process</p>
          <h2>Five steps, one loop.</h2>
          <p className="section-lead">
            Select a step to see what it asks of you. The loop is the point: the first solution is rarely the last.
          </p>
          <StepPanel active={active} onSelect={setActive} />
        </Reveal>

        <Reveal id="lab">
          <p className="eyebrow">Interactive lab</p>
          <h2>Run the loop yourself.</h2>
          <p className="section-lead">
            A simulated lookup problem with a goal of 1 µs. Change components, measure, adjust, or let the loop run.
            Notice which component moves the number most.
          </p>
          <Lab />
        </Reveal>

        <Reveal id="metrics">
          <p className="eyebrow">Step 02 in practice</p>
          <h2>Metrics driven by the problem.</h2>
          <p className="section-lead">Each problem gets a primary metric, a goal, and at most two supporting metrics.</p>
          <Metrics />
        </Reveal>

        <footer className="footer wrap">
          <span>Draft · not yet validated</span>
          <span>{STEPS.length} steps · 3 metric examples</span>
        </footer>
      </main>
    </div>
  );
}
