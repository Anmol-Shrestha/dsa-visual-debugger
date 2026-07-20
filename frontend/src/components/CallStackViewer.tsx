/** Shows the currently active frame name and executing line. */
export default function CallStackViewer({
  frameName,
  lineNumber,
}: {
  frameName: string;
  lineNumber: number;
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
        Call Stack
      </h2>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-indigo-600 px-3 py-1 font-mono text-sm text-white">
          {frameName}()
        </span>
        <span className="font-mono text-sm text-slate-500">
          line {lineNumber}
        </span>
      </div>
    </div>
  );
}
