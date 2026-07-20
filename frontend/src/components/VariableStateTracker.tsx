import type { SerializedValue } from "../types";
import ValueRenderer from "./ValueRenderer";

/**
 * Renders every local variable at the selected step. A variable whose
 * serialized value differs from the previous step flashes amber, so
 * mutations (swaps, pointer moves) are visible while scrubbing.
 */
export default function VariableStateTracker({
  variables,
  previousVariables,
}: {
  variables: Record<string, SerializedValue>;
  previousVariables: Record<string, SerializedValue> | null;
}) {
  const names = Object.keys(variables);
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        Variables
      </h2>
      {names.length === 0 ? (
        <p className="text-sm text-slate-400">No local variables yet.</p>
      ) : (
        <div className="space-y-3">
          {names.map((name) => {
            const changed =
              previousVariables !== null &&
              JSON.stringify(previousVariables[name]) !==
                JSON.stringify(variables[name]);
            return (
              <div
                key={name}
                className={`rounded-md border p-2 transition-colors ${
                  changed
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200"
                }`}
              >
                <div className="mb-1 font-mono text-xs font-semibold text-slate-500">
                  {name}
                </div>
                <ValueRenderer value={variables[name]} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
