# Architectural Decision Record

## ADR-001: Use `sys.settrace` with a custom tracking hook (not `bdb`) for execution tracing

**Status:** Accepted
**Date:** 2026-07-19

### Context

The debugger must record a complete execution timeline of a user-submitted Python
function so the frontend can scrub forward **and backward** through every step,
inspecting line numbers, call stack frames, and local variable snapshots. Two
candidates were evaluated:

1. Raw `sys.settrace` with a custom trace hook
2. Python's built-in `bdb` (Breakpoint Debugger) framework

### Decision

Use **raw `sys.settrace` with a custom tracking hook**.

### Rationale

**1. `bdb` is the wrong abstraction for timeline recording.**
`bdb` is itself a wrapper around `sys.settrace`, designed for *interactive*
debugging: breakpoints, stop/continue semantics, stepping on user command. Our
model is the opposite — execute the function to completion once, record every
`line` event unconditionally into a history array, and let all "stepping" happen
afterward on the frontend as pure index navigation. Using `bdb` would mean
subclassing `Bdb` and fighting its breakpoint bookkeeping and stop-logic for
zero benefit.

**2. Direct control over frame filtering and data capture.**
On `call` events we inspect `frame.f_code.co_filename` and only trace frames
belonging to the user's submitted code (compiled with filename `"<user_code>"`),
skipping stdlib/internal frames cleanly. Raw access to `frame.f_lineno`,
`frame.f_code.co_name`, and `frame.f_locals` maps 1:1 onto our API contract.

**3. Neither option is a sandbox — safety is ours to implement either way.**
`bdb` provides no additional isolation or memory safety over raw `settrace`.
The actual safeguards live in our hook:

- **Never store frame objects.** Local variables are deep-copied immediately at
  each `line` event; holding `frame` / `frame.f_locals` references creates
  reference cycles that keep entire call stacks alive (the classic leak).
- **Safe deep-copy wrapper** with a `repr()` fallback for uncopyable objects;
  dunder keys are stripped before copying.
- **Hard step ceiling** (`MAX_STEPS ≈ 10,000`) raised as a controlled exception —
  serves as both the infinite-loop guard and the memory bound on timeline size.
- **Recursion depth cap** via a frame-depth counter in the hook itself.

**4. Pedagogically superior for DSA learning.**
- A complete recorded timeline enables *bidirectional* time travel — students can
  scrub backward to see exactly when a value changed. `bdb`'s stop-and-inspect
  model is forward-only; state stepped past is gone.
- Distinct `call` / `line` / `return` events make control flow visible: `call`
  shows recursion unfolding frame by frame, `return` shows the unwind where
  recursive results combine, `line` shows data mutation within a frame.
- One execution pass produces a deterministic JSON timeline; exploration on the
  frontend is instant array indexing with no re-execution and no live debugger
  session state.

### Consequences

- The `ExecutionEngine` service owns a custom trace hook and its safety guards;
  these must be covered by service-layer tests independent of FastAPI.
- Timeline size is bounded by `MAX_STEPS`; very long executions are truncated
  with an explicit error rather than streamed.
- Interactive features (live breakpoints, conditional stops) are out of scope by
  design; if ever needed they would be a new service, not a retrofit of this one.

---

## ADR-002: Two-stage snapshot → recursive JSON-safe serialization for variable state

**Status:** Accepted
**Date:** 2026-07-19

### Context

Local variables in DSA code include custom classes (`Node`, `TreeNode`, graph
adjacency objects), cyclic references (doubly-linked lists, graphs), and
non-JSON types (sets, tuples, non-string dict keys). Naive `json.dumps` on
deep-copied `f_locals` would crash or hang. The timeline must serialize to
clean JSON without ever raising.

### Decision

Serialize in two stages, entirely within the service layer:

**Stage 1 — Snapshot at trace time.** Safe-deepcopy `f_locals` at each `line`
event (dunders stripped), falling back to `repr()` for uncopyable objects
(file handles, locks, generators).

**Stage 2 — Recursive `serialize_value()` sanitizer** applied before the
timeline leaves the service layer, mapping by type:

- Primitives → as-is (`inf`/`nan` → strings; JSON forbids them)
- `list`/`tuple` → JSON array (tuples tagged for UI labeling)
- `dict` → JSON object, non-string keys coerced via `str(key)`
- `set`/`frozenset` → sorted JSON array, tagged as a set
- Custom class instance → `{"__type__": "<ClassName>", "attrs": {…serialized
  vars(obj)…}}` (`__slots__` handled via `getattr`) — this is what lets the
  frontend render a `Node` as a visual block instead of an opaque repr string
- Everything else (functions, modules, generators) → `repr()` string

### Safety guards

- **Cycle detection:** a `seen: set[int]` of `id()`s along the current recursion
  path; revisits emit `{"__cycle__": "<ClassName>"}` instead of recursing.
  Required for doubly-linked lists and graphs with back-edges.
- **Depth/size caps:** `MAX_DEPTH ≈ 10`, `MAX_ITEMS ≈ 100` per collection, with
  `{"__truncated__": true}` markers beyond — bounds payload size against huge
  structures at every timeline step.
- **Never-raise invariant:** the serializer is wrapped in a last-resort
  `try/except` degrading to `repr()`; worst case a value renders as a string,
  and the timeline always returns intact.

### Consequences

- `serialize_value()` is a pure service-layer function: unit-testable with no
  FastAPI coupling.
- The frontend Variable State Tracker keys off the `__type__` / `__cycle__` /
  `__truncated__` tags to render structured grids and linked-node visuals.
- Extremely large structures render truncated rather than complete — an
  accepted trade-off for a learning tool with small practice inputs.

---

## ADR-003: Recursive DOM/Tailwind renderer with single-index state — no canvas/3D libraries

**Status:** Accepted
**Date:** 2026-07-19

### Context

The frontend must visually render 1D arrays, 2D matrices, dicts, and linked
node structures as interactive blocks, re-projected at every position of the
timeline slider. Canvas/WebGL/3D libraries were considered and rejected.

### Decision

**Rendering — a recursive `ValueRenderer` dispatcher** that mirrors ADR-002's
serializer tags one-to-one (backend adds a tag → frontend adds a branch):

- primitive → `PrimitiveChip` (inline text badge)
- array of equal-length arrays → `MatrixGrid` (CSS `grid`, repeat(cols) template)
- flat array → `ArrayBlocks` (flex row of bordered cells with index labels —
  the textbook array diagram)
- dict → `KeyValueGrid` (two-column grid)
- `{__type__}` → `NodeCard` (bordered card, class-name header, attrs recursed;
  pointer attrs like `next` nest naturally, chained cards joined by an `→`
  glyph or tiny inline SVG — zero dependencies)
- `{__cycle__}` → `CycleBadge`; `{__truncated__}` → `TruncatedBadge`

**State — one immutable array plus one integer:**

1. `timeline`: the fetched JSON history, immutable per run.
2. `currentStep`: a single `useState<number>` in `App`.

Every panel (code highlight, call stack viewer, variable tracker) is a pure
projection of `timeline[currentStep]` passed as props. No Redux/Zustand/context
stores. Time travel = array indexing (the payoff of ADR-001's recorded-timeline
model).

### Rationale

- Serialized JSON is structured data; DOM + Tailwind flex/grid is the natural
  fit. Canvas discards accessibility, text selection, and hover semantics for
  no benefit at this scale.
- Only one frame's variables render at a time, and ADR-002 caps collection
  sizes (~100 items) — a few hundred divs per step, far below any need for
  virtualization or canvas performance.
- Mutation highlighting: `useMemo` diff of current vs previous frame; changed
  cells flash (`bg-amber-100 transition-colors`) so students see the swap
  happen.

### Consequences

- Zero visualization dependencies; the entire render layer is plain React +
  Tailwind and unit-testable per renderer component.
- New serializer tags require a matching `ValueRenderer` branch — an explicit,
  two-sided contract.
- Free-form graph layouts (force-directed node positioning) are out of scope;
  adjacency lists/matrices render as their underlying dict/array structures.

---

## ADR-004: Load the full execution timeline in one response — no streaming

**Status:** Accepted
**Date:** 2026-07-19

### Context

The frontend needs the execution frame history to drive the timeline slider.
Options: fetch the complete JSON array in one `POST /v1/debug/trace` response,
or stream frames sequentially (SSE/WebSocket).

### Decision

**Single full-payload load.** The client POSTs the code, shows a loading state,
and receives the complete timeline array in one JSON response. All subsequent
navigation is local array indexing.

### Rationale

1. **The backend model precludes meaningful streaming.** ADR-001 executes the
   function to completion in one pass; the full history exists before the
   response is sent. Streaming would chunk an already-finished array.
2. **Scrubbing requires random access.** Bidirectional slider jumps demand the
   whole array in memory. Streaming adds buffering, ordering, completion
   signaling, and reconnect handling only to converge on the same in-memory
   array later.
3. **Payload is bounded by construction.** MAX_STEPS ≈ 10,000 (ADR-001) ×
   capped frame size (ADR-002) keeps typical DSA runs at a few hundred KB and
   the worst case in the low tens of MB — trivial for a browser to hold.
4. **Simplicity and pedagogy.** State stays `timeline + currentStep` (ADR-003);
   after one fetch, every step is instant and offline — a student replaying
   steps never waits on the network.

### Consequences

- The UI needs a loading indicator during execution and a clear error state
  for step-ceiling / timeout rejections; nothing else changes on the client.
- Live tracing of long-running processes or unbounded timelines is explicitly
  out of scope; if ever needed it would be a new streaming endpoint, not a
  retrofit of this one.

---

## ADR-005: Empirical Big-O analysis via step-counting across input sizes

**Status:** Accepted
**Date:** 2026-07-19

### Context

Users want to *test* an algorithm's complexity, not just watch one run. Static
analysis of arbitrary Python is intractable; empirical measurement is not —
the trace hook already counts line events per run.

### Decision

A `ComplexityAnalyzer` service (`services/complexity_analyzer.py`) exposed at
`POST /v1/debug/complexity`:

1. The user's code defines a **generator convention**: `gen_input(n)` returns
   the positional-arguments list for input size n.
2. For each size (default `[4, 8, 16, 32, 64, 128]`), the analyzer runs the
   generator and the target in **separate engine runs** (generator steps never
   pollute the measurement) using a `CountingTraceManager` that counts line
   events without storing entries, and `capture_variables=False` so no
   deep-copying occurs. This makes a 500,000-step budget affordable.
3. Measurements are least-squares fitted (`steps ≈ a·f(n) + b`) against
   candidate models — O(1), O(log n), O(n), O(n log n), O(n²), O(n³), O(2ⁿ) —
   highest R² wins, with near-ties (1e-6) resolved toward the simpler class.
4. If a larger size trips a safety limit, the collected points are kept and
   the result is flagged `truncated` (≥3 points required to fit).

The frontend renders a verdict badge, an SVG dot-plot of measured steps with
the fitted curve dashed in the same hue (per the dataviz reference palette),
a table view of the raw measurements, and runner-up fits.

### Consequences

- Step counts measure *traced line events*, a proxy for operations: work done
  inside C builtins (`sorted`, `sum`) is invisible, consistent with the
  tracer's teaching model — write the loops you want measured.
- O(n) vs O(n log n) can be statistically close on small ranges; runner-up
  R² values are surfaced so users see when the verdict is tight.
- The engine gained `capture_variables` and `last_result`; both default to
  prior behavior, so the trace endpoint is unchanged.

---

## ADR-006: Planning tools — pseudocode notepad + React Flow flowchart canvas

**Status:** Accepted
**Date:** 2026-07-19

### Context

Users want to structure their thinking before coding: write pseudocode and
draw flowcharts. A diagramming library was needed for interactive flowchart
creation with high visual quality.

### Decision

A planning modal (two tabs, opened by dedicated "PseudoCode" and "Flow Chart"
header buttons), entirely client-side — no backend involvement:

- **Pseudocode tab**: plain textarea persisted to localStorage, with an
  "insert into editor as comments" action that prefixes each line with `#`
  and prepends it to the code editor.
- **Flowchart tab**: **React Flow (`@xyflow/react` v12)** — chosen over
  Mermaid because the requirement was *creating* charts interactively
  (drag-and-drop nodes, drag-to-connect edges, zoom/pan/minimap), whereas
  Mermaid only renders text-defined diagrams. React Flow is MIT-licensed,
  the de-facto standard for React node editors, and visually polished.
- Custom node set mirrors classic flowchart vocabulary: terminal (oval),
  process (rectangle), decision (diamond with auto-labeled Yes/No exit
  handles), input/output (parallelogram). Labels are edited inline.
- Nodes/edges persist to localStorage; a two-sum sample chart seeds the
  first visit.

### Consequences

- First runtime frontend dependency beyond React itself (+~200 kB gzipped
  bundle); accepted for the interaction quality required.
- ADR-003's "zero visualization dependencies" now applies to *data-state
  rendering* (timeline/variables/Big-O chart remain dependency-free); the
  planning canvas is a separate concern with different needs.
- Plans are per-browser (localStorage), not per-snippet; attaching plans to
  saved snippets via the CodeRepository would be a future, backend-touching
  step.