import CodeEditor from "./CodeEditor";

const PLACEHOLDER =
  "# FUNCTION calculate_total(cart)\n#\n# INPUT: list of items, each with a price field\n# OUTPUT: total price after any applicable discount\n#\n# Initialize total\nSET total TO 0\n#\n# FOR LOOP to iterate through all items\nFOR each item IN cart\n    ADD item.price to total\nENDFOR\n#\n# Subtract discount if conditions are met\nIF total > 100\n    SET discount TO total * 0.1\n    SUBTRACT discount FROM total\nENDIF\n#\nRETURN total";

/** Workspace tab: plain-language plan, saved per viewer. */
export default function PseudocodePanel({
  value,
  onChange,
  onInsert,
  fontSize,
  onZoom,
}: {
  value: string;
  onChange: (value: string) => void;
  onInsert: () => void;
  fontSize: number;
  onZoom: (delta: -1 | 0 | 1) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b1120]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
        <p className="text-xs text-slate-400">
          Plan in plain language first, then turn it into code.
        </p>
        <button
          onClick={onInsert}
          disabled={!value.trim()}
          className="shrink-0 rounded-md bg-indigo-500 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          Insert as comments
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          language="text"
          placeholder={PLACEHOLDER}
          fontSize={fontSize}
          onZoom={onZoom}
          ariaLabel="Pseudocode"
        />
      </div>
      <div className="border-t border-slate-800 px-4 py-1.5 text-[11px] text-slate-500">
        Saved automatically in this browser.
      </div>
    </div>
  );
}
