# Edge Cases Before Public Deployment

Status legend: **Open** = not handled yet · **Partial** = some protection exists · **Done** = handled and tested.

This list covers what happens when someone runs very large, slow, or hostile code through the
tracer. Each item lists the current behavior (checked against the code on 2026-11-02), the proposed
fix, and the questions to settle before implementing it.

---

## 1. CPU-bound code that never reaches a traced line
**Status:** Partial
**Current:** The wall-clock limit (`DEFAULT_MAX_SECONDS = 5.0`) is checked only inside the trace hook,
which runs on each Python line event.
**Risk:** `sum(range(10**12))`, `sorted(huge_list)`, or `"x" * 10**10` run inside one C call, so no
line event fires and the limit is never checked. The request hangs.
**Proposed fix:** Run each trace in a child process. The parent kills the child after a hard timeout
(e.g. 5 s). Killing from outside works even when the code is stuck in C.
**Questions:** Timeout length (5 s?). Should the trace limit and the kill limit be the same value?

## 2. Memory exhaustion
**Status:** Open
**Current:** Nothing caps memory. Code can allocate as much as the host allows.
**Risk:** `x = [0] * 10**10` or a loop that appends forever can crash the whole server, not just
the one run.
**Proposed fix:** Child process with `resource.setrlimit(RLIMIT_AS, ...)` set at startup (enforced by
Linux, which Render uses; macOS ignores this limit, so local tests won't catch it).
**Questions:** Memory cap per run (e.g. 256 MB)?

## 3. Huge timelines and snapshots
**Status:** Partial
**Current:** `DEFAULT_MAX_STEPS = 10_000` caps step count. Each step deep-copies every local
variable, with no size limit on each copy, and the full timeline is returned in one response.
**Risk:** 10,000 steps × a 100,000-element list = a multi-hundred-megabyte JSON response. A single
`copy.deepcopy` of a huge object can also exceed the wall-clock limit, because the time check
runs before the copy, not during it.
**Proposed fix:** (a) Cap the total number of serialized values or bytes, and stop recording
with a clear message. (b) Truncate large lists/dicts in snapshots (e.g. first 100 items plus a
"... N more" marker). (c) Cap the response size.
**Questions:** Truncation length for lists and dicts? Should truncated runs still be shown, with a
warning?

## 4. Oversized request body
**Status:** Open
**Current:** `TraceRequest.code` has no length limit.
**Risk:** A multi-megabyte paste is compiled and traced. Compile time alone can be large for
pathological inputs (deeply nested expressions).
**Proposed fix:** Pydantic `max_length` on `code` (e.g. 20,000 characters) plus a body-size limit
at the server level.
**Questions:** Maximum code length? 20,000 characters is enough for a DSA function, but tell me if
you expect longer files.

## 5. Blocking input and sleeps
**Status:** Open
**Current:** Nothing intercepts `input()`, `time.sleep()`, or blocking I/O.
**Risk:** `input()` on the server waits on server stdin and can hang the worker. `time.sleep(10**6)`
blocks inside one C call, so the wall-clock check never runs.
**Proposed fix:** Child process timeout (see item 1). Replace `input` with a function that raises
a clear error. Remove or stub `time.sleep` for trace runs.
**Questions:** Should `input()` be supported later (with a prompt box in the UI)? For now, raise an error?

## 6. Many concurrent runs
**Status:** Open
**Current:** Every request starts its own trace. There is no limit on concurrent runs or requests
per user.
**Risk:** Several heavy runs at once exhaust CPU and memory, and every visitor's request slows down.
**Proposed fix:** Limit concurrent child processes (e.g. a semaphore of 2–4). Return HTTP 429 when
the limit is reached. Add a per-IP rate limit.
**Questions:** Limits per minute per visitor (e.g. 30 runs/min)? Where should rate limiting live
(Render, or application code)?

## 7. Access to the server's files and network
**Status:** Open
**Current:** User code runs inside the server process with full access to the file system,
environment variables, and network. `import os; os.system(...)` works.
**Risk:** This is the largest item. Anyone can read secrets (such as `ANTHROPIC_API_KEY` from the
environment), delete files, or use the server to reach other hosts.
**Proposed fix:** Child process started with a stripped environment (no secrets), run as an
unprivileged user, in a directory with no write access, with network access blocked. Module
imports can be restricted to an allow-list (e.g. `collections`, `heapq`, `math`, `itertools`).
A container per run is the strongest option, but is heavier.
**Questions:** Allowed imports list? Run in a container per trace, or a locked-down child process?

## 8. Frontend slowdown from large results
**Status:** Open
**Current:** The UI renders every variable at every step with `ValueRenderer`, with no virtualization.
**Risk:** A large list in the state view can freeze the browser tab, even when the backend response
is fine.
**Proposed fix:** Show a summary for large values ("list of 100,000 items") and render items on
demand. Limit the number of rendered cells.
**Questions:** Limit on rendered items per list (e.g. 200)?

## 9. Infinite recursion and deep nesting
**Status:** Partial
**Current:** `DEFAULT_MAX_DEPTH = 64` caps call depth in user frames.
**Risk:** Low. Deep recursion in C code (e.g. `repr` of a self-referencing list) is not covered by
the depth counter.
**Proposed fix:** Cover `repr` and serialization of cyclic structures in the serializer (check
the existing `serialization.py` behavior). Keep the depth limit.
**Questions:** None yet.

## 10. Partial failure in the response
**Status:** Partial
**Current:** Errors return HTTP 400 with a structured detail. The server crash case (e.g. out of
memory) would return a generic 500 with no detail.
**Risk:** The UI shows a generic error and the user can't tell what happened.
**Proposed fix:** Map child-process crashes and timeouts to specific error types (`Timeout`,
`MemoryLimit`, `Crashed`) so the console can explain them.
**Questions:** None yet.

---

## Suggested order for tomorrow
1. Item 4 (code length limit) and item 5 (block `input`, `sleep`): small, no new infrastructure.
2. Item 1, 2, 5 via a child-process runner with timeout and memory cap (one change covers three items).
3. Item 3 and item 8 (output size and frontend rendering limits).
4. Item 6 (concurrency and rate limits).
5. Item 7 (file and network isolation) last, since it needs the most decisions.
