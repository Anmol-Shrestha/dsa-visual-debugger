import { Fragment } from "react";
import type { SerializedObject, SerializedValue } from "../types";

/**
 * Recursive dispatcher mirroring the backend serializer tags (ADR-003):
 * when the backend adds a tag, this component adds a branch.
 */

type TaggedNode = SerializedObject & { __type__: string; attrs: SerializedObject };

const isObj = (v: SerializedValue): v is SerializedObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTaggedNode = (v: SerializedValue): v is TaggedNode =>
  isObj(v) && typeof v.__type__ === "string" && isObj(v.attrs);

const isTaggedSeq = (v: SerializedValue): boolean =>
  isObj(v) && typeof v.__type__ === "string" && Array.isArray(v.items);

const isCycle = (v: SerializedValue): boolean =>
  isObj(v) && "__cycle__" in v;

const isTruncated = (v: SerializedValue): boolean =>
  isObj(v) && v.__truncated__ === true && Object.keys(v).length === 1;

export default function ValueRenderer({ value }: { value: SerializedValue }) {
  if (value === null || typeof value !== "object") {
    return <PrimitiveChip value={value} />;
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((row) => Array.isArray(row))) {
      return <MatrixGrid rows={value as SerializedValue[][]} />;
    }
    return <ArrayBlocks items={value} />;
  }
  if (isCycle(value)) return <CycleBadge name={String(value.__cycle__)} />;
  if (isTruncated(value)) return <TruncatedBadge />;
  if (isTaggedSeq(value)) {
    return (
      <ArrayBlocks
        items={value.items as SerializedValue[]}
        label={String(value.__type__)}
      />
    );
  }
  if (isTaggedNode(value)) return <NodeChain node={value} />;
  return <KeyValueGrid obj={value} />;
}

/* ---------------------------------------------------------------- */

function PrimitiveChip({ value }: { value: null | boolean | number | string }) {
  if (value === null) {
    return <span className="font-mono text-sm italic text-slate-400">None</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className="font-mono text-sm text-purple-700">
        {value ? "True" : "False"}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-sm text-sky-700">{String(value)}</span>;
  }
  return <span className="font-mono text-sm text-emerald-700">'{value}'</span>;
}

function ArrayBlocks({
  items,
  label,
}: {
  items: SerializedValue[];
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </div>
      )}
      {items.length === 0 ? (
        <span className="text-sm italic text-slate-400">empty</span>
      ) : (
        <div className="flex flex-wrap items-stretch gap-1">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="flex min-w-[2.5rem] items-center justify-center rounded border border-indigo-200 bg-indigo-50 px-2 py-1.5">
                <ValueRenderer value={item} />
              </div>
              <span className="mt-0.5 text-[10px] text-slate-400">
                {isTruncated(item) ? "…" : i}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatrixGrid({ rows }: { rows: SerializedValue[][] }) {
  const cols = Math.max(...rows.map((row) => row.length), 0);
  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-px overflow-hidden rounded border border-slate-200 bg-slate-200"
        style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(2.5rem, auto))` }}
      >
        <div className="bg-slate-50" />
        {Array.from({ length: cols }).map((_, c) => (
          <div
            key={c}
            className="bg-slate-50 px-1 py-0.5 text-center text-[10px] text-slate-400"
          >
            {c}
          </div>
        ))}
        {rows.map((row, r) => (
          <Fragment key={r}>
            <div className="flex items-center bg-slate-50 px-1 text-[10px] text-slate-400">
              {r}
            </div>
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="flex items-center justify-center bg-white px-2 py-1"
              >
                {c < row.length ? <ValueRenderer value={row[c]} /> : null}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function KeyValueGrid({ obj }: { obj: SerializedObject }) {
  const entries = Object.entries(obj).filter(([k]) => k !== "__truncated__");
  const truncated = obj.__truncated__ === true;
  return (
    <div className="grid grid-cols-[auto,1fr] items-start gap-x-3 gap-y-1 rounded border border-slate-200 bg-slate-50 p-2">
      {entries.map(([key, value]) => (
        <Fragment key={key}>
          <span className="pt-1 font-mono text-xs text-slate-500">{key}</span>
          <ValueRenderer value={value} />
        </Fragment>
      ))}
      {truncated && (
        <span className="col-span-2 text-xs text-slate-400">… truncated</span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Custom objects: chained cards for linked structures (ADR-003)     */

function NodeChain({ node }: { node: TaggedNode }) {
  // Follow a single self-typed pointer attribute (e.g. `next`) to flatten
  // a linked chain into a horizontal row of cards joined by arrows.
  const chain: TaggedNode[] = [];
  let pointerKey: string | null = null;
  let terminator: SerializedValue | undefined;
  let current: TaggedNode | null = node;

  while (current && chain.length < 32) {
    chain.push(current);
    const attrs: SerializedObject = current.attrs;
    let key: string | null = pointerKey;
    if (!key) {
      const candidates = Object.keys(attrs).filter((k) => {
        const v = attrs[k];
        return (isTaggedNode(v) && v.__type__ === node.__type__) || isCycle(v);
      });
      key = candidates.length === 1 ? candidates[0] : null;
    }
    if (!key || !(key in attrs)) break;
    pointerKey = key;
    const next: SerializedValue = attrs[key];
    if (isTaggedNode(next) && next.__type__ === node.__type__) {
      current = next;
    } else {
      terminator = next;
      current = null;
    }
  }

  if (chain.length === 1 && pointerKey === null) {
    return <NodeCard node={node} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {chain.map((n, i) => (
        <Fragment key={i}>
          {i > 0 && <Arrow />}
          <NodeCard node={n} omitKey={pointerKey} />
        </Fragment>
      ))}
      {terminator !== undefined && (
        <>
          <Arrow />
          {isCycle(terminator) ? (
            <CycleBadge name={String((terminator as SerializedObject).__cycle__)} />
          ) : terminator === null ? (
            <span className="font-mono text-xs text-slate-400">None</span>
          ) : (
            <ValueRenderer value={terminator} />
          )}
        </>
      )}
    </div>
  );
}

function NodeCard({
  node,
  omitKey,
}: {
  node: TaggedNode;
  omitKey?: string | null;
}) {
  const entries = Object.entries(node.attrs).filter(([k]) => k !== omitKey);
  return (
    <div className="min-w-[3.5rem] overflow-hidden rounded-md border border-indigo-300 bg-white">
      <div className="bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
        {node.__type__}
      </div>
      <div className="space-y-1 p-2">
        {entries.length === 0 ? (
          <span className="text-xs italic text-slate-400">no fields</span>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-500">{key}</span>
              <ValueRenderer value={value} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Arrow() {
  return <span className="px-0.5 text-lg text-indigo-400">→</span>;
}

function CycleBadge({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-xs text-rose-700">
      ↩ cycle: {name}
    </span>
  );
}

function TruncatedBadge() {
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-xs text-slate-500">
      … truncated
    </span>
  );
}