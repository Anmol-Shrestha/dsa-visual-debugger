import { STEPS } from "../data";
import StepVisual from "./StepVisual";

interface StepPanelProps {
  active: number;
  onSelect: (i: number) => void;
}

export default function StepPanel({ active, onSelect }: StepPanelProps) {
  const step = STEPS[active];
  return (
    <div className="steps">
      <div className="step-tabs" role="tablist" aria-label="Framework steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === active}
            className={`step-tab ${i === active ? "is-on" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="step-tab-n">{s.n}</span>
            <span className="step-tab-t">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="card step-card" key={step.id}>
        <div className="step-copy">
          <p className="eyebrow">Step {step.n}</p>
          <h3>{step.title}</h3>
          <p className="lead">{step.short}</p>
          <p className="body">{step.body}</p>
          <ul className="practice">
            {step.practice.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="step-visual">
          <StepVisual id={step.id} />
        </div>
      </div>
    </div>
  );
}
