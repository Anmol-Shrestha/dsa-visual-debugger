import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";

type FlowNodeData = { label: string };
type FlowNode = Node<FlowNodeData>;

const STORAGE_KEY = "dsa-debugger.flowchart";

/* ------------------------------------------------------------------ */
/* Node shapes: terminal (oval), process (rect), decision (diamond),   */
/* io (parallelogram) — the classic flowchart vocabulary.              */
/* ------------------------------------------------------------------ */

function LabelInput({
  id,
  value,
  className = "",
}: {
  id: string;
  value: string;
  className?: string;
}) {
  const { updateNodeData } = useReactFlow();
  return (
    <input
      className={`nodrag w-full bg-transparent text-center text-xs font-medium focus:outline-none ${className}`}
      value={value}
      onChange={(e) => updateNodeData(id, { label: e.target.value })}
      placeholder="label…"
    />
  );
}

const handleClass = "!h-2.5 !w-2.5 !border-2 !border-white !bg-indigo-500";

function TerminalNode({ id, data }: NodeProps<FlowNode>) {
  return (
    <div className="flex h-10 w-32 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 px-3 shadow-sm">
      <Handle type="target" position={Position.Top} className={handleClass} />
      <LabelInput id={id} value={data.label} className="text-emerald-800" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

function ProcessNode({ id, data }: NodeProps<FlowNode>) {
  return (
    <div className="flex h-11 w-40 items-center justify-center rounded-md border-2 border-slate-400 bg-white px-3 shadow-sm">
      <Handle type="target" position={Position.Top} className={handleClass} />
      <LabelInput id={id} value={data.label} className="text-slate-700" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

function DecisionNode({ id, data }: NodeProps<FlowNode>) {
  const diamond = { clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" };
  return (
    <div className="relative flex h-24 w-40 items-center justify-center">
      <div className="absolute inset-0 bg-amber-400" style={diamond} />
      <div className="absolute inset-[2px] bg-amber-50" style={diamond} />
      <LabelInput
        id={id}
        value={data.label}
        className="relative z-10 px-6 text-amber-800"
      />
      <Handle type="target" position={Position.Top} className={handleClass} />
      {/* Two labeled exits: bottom = Yes, right = No */}
      <Handle
        id="yes"
        type="source"
        position={Position.Bottom}
        className={handleClass}
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        className={handleClass}
      />
    </div>
  );
}

function IONode({ id, data }: NodeProps<FlowNode>) {
  return (
    <div className="relative flex h-11 w-40 items-center justify-center">
      <div
        className="absolute inset-0 rounded-sm border-2 border-sky-400 bg-sky-50 shadow-sm"
        style={{ transform: "skewX(-12deg)" }}
      />
      <Handle type="target" position={Position.Top} className={handleClass} />
      <LabelInput
        id={id}
        value={data.label}
        className="relative z-10 px-3 text-sky-800"
      />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

const nodeTypes = {
  terminal: TerminalNode,
  process: ProcessNode,
  decision: DecisionNode,
  io: IONode,
};

/* ------------------------------------------------------------------ */

const SAMPLE_NODES: FlowNode[] = [
  { id: "n1", type: "terminal", position: { x: 160, y: 0 }, data: { label: "Start" } },
  { id: "n2", type: "io", position: { x: 156, y: 80 }, data: { label: "Input: nums, target" } },
  { id: "n3", type: "process", position: { x: 156, y: 160 }, data: { label: "seen = {}" } },
  { id: "n4", type: "decision", position: { x: 156, y: 240 }, data: { label: "complement in seen?" } },
  { id: "n5", type: "process", position: { x: 156, y: 380 }, data: { label: "return indices" } },
  { id: "n6", type: "process", position: { x: 380, y: 246 }, data: { label: "add num to seen" } },
  { id: "n7", type: "terminal", position: { x: 160, y: 460 }, data: { label: "End" } },
];

const SAMPLE_EDGES: Edge[] = [
  { id: "e1", source: "n1", target: "n2" },
  { id: "e2", source: "n2", target: "n3" },
  { id: "e3", source: "n3", target: "n4" },
  { id: "e4", source: "n4", sourceHandle: "yes", target: "n5", label: "Yes" },
  { id: "e5", source: "n4", sourceHandle: "no", target: "n6", label: "No" },
  { id: "e6", source: "n6", target: "n4" },
  { id: "e7", source: "n5", target: "n7" },
];

function loadSaved(): { nodes: FlowNode[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return { nodes: parsed.nodes, edges: parsed.edges ?? [] };
      }
    }
  } catch {
    /* corrupted storage — fall through to the sample */
  }
  return { nodes: SAMPLE_NODES, edges: SAMPLE_EDGES };
}

const toolButtonClass =
  "rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100";

export default function FlowchartEditor() {
  const saved = loadSaved();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(saved.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(saved.edges);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            // Decision exits are auto-labeled by which handle they left from.
            label:
              connection.sourceHandle === "yes"
                ? "Yes"
                : connection.sourceHandle === "no"
                  ? "No"
                  : undefined,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const addNode = (type: keyof typeof nodeTypes, label: string) => {
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type,
        position: { x: 80 + (nds.length % 4) * 90, y: 40 + (nds.length % 6) * 90 },
        data: { label },
      },
    ]);
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
        <button className={toolButtonClass} onClick={() => addNode("terminal", "Start / End")}>
          ⬭ Start/End
        </button>
        <button className={toolButtonClass} onClick={() => addNode("process", "do something")}>
          ▭ Process
        </button>
        <button className={toolButtonClass} onClick={() => addNode("decision", "condition?")}>
          ◇ Decision
        </button>
        <button className={toolButtonClass} onClick={() => addNode("io", "input / output")}>
          ▱ Input/Output
        </button>
        <span className="mx-2 h-4 w-px bg-slate-300" />
        <button className={toolButtonClass} onClick={clearAll}>
          Clear
        </button>
        <span className="ml-auto text-xs text-slate-400">
          type inside a shape to rename · drag between dots to connect · select + ⌫ to delete
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            style: { strokeWidth: 1.5 },
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} />
          <Controls />
          <MiniMap pannable zoomable className="!h-24 !w-36" />
        </ReactFlow>
      </div>
    </div>
  );
}
