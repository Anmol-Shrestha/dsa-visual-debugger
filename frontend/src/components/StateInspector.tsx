import type { SerializedValue, TraceStep } from "../types";
import CallStackViewer from "./CallStackViewer";
import TimelineSlider from "./TimelineSlider";
import VariableStateTracker from "./VariableStateTracker";

/** Right panel: timeline scrubber, call stack, and variable state. */
export default function StateInspector({
  timeline,
  currentStep,
  onStepChange,
  previousVariables,
}: {
  timeline: TraceStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  previousVariables: Record<string, SerializedValue> | null;
}) {
  const frame = timeline[currentStep];
  return (
    <div className="space-y-4">
      <TimelineSlider
        length={timeline.length}
        current={currentStep}
        onChange={onStepChange}
      />
      <CallStackViewer
        frameName={frame.frame_name}
        lineNumber={frame.line_number}
      />
      <VariableStateTracker
        variables={frame.local_variables}
        previousVariables={previousVariables}
      />
    </div>
  );
}
