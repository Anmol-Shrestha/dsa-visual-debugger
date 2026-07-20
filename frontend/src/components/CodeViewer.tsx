import { useEffect, useRef } from "react";

/** Left panel: raw code with a highlight overlay on the active line. */
export default function CodeViewer({
  code,
  activeLine,
}: {
  code: string;
  activeLine: number | null;
}) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeLine]);

  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div className="h-full overflow-auto rounded-lg bg-slate-900 py-2 font-mono text-sm text-slate-100">
      {lines.map((line, i) => {
        const lineNumber = i + 1;
        const active = lineNumber === activeLine;
        return (
          <div
            key={lineNumber}
            ref={active ? activeRef : null}
            className={`flex border-l-2 px-3 ${
              active
                ? "border-amber-400 bg-amber-400/20"
                : "border-transparent"
            }`}
          >
            <span className="w-10 shrink-0 select-none pr-4 text-right text-slate-500">
              {lineNumber}
            </span>
            <pre className="whitespace-pre">{line || " "}</pre>
          </div>
        );
      })}
    </div>
  );
}
