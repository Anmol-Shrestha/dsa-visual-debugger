# DSA Visual Debugger — Backend

FastAPI service that executes a user-submitted Python function under a
`sys.settrace` hook and returns a step-by-step execution timeline.
Architecture decisions are recorded in `../ARCHITECTURAL_DECISION.md`.

## Layout

- `services/` — pure business logic (no FastAPI imports)
  - `execution_engine.py` — runs code under the trace hook, enforces safety limits
  - `trace_manager.py` — abstract `TraceManager` + in-memory implementation
  - `serialization.py` — JSON-safe serializer (cycles, custom classes, caps)
- `adapters/` — HTTP and storage integrations
  - `http_router.py` — `/v1` endpoints + dependency providers
  - `repository.py` — abstract `CodeRepository` contract
  - `local_storage_adapter.py` — file-system implementation
- `main.py` — FastAPI app entry point

## Run

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload        # http://localhost:8000
```

Saved snippets land in `./saved_snippets` (override with `CODE_STORAGE_DIR`).

## Test

```bash
python -m pytest tests -q
```

## Endpoints

- `POST /v1/debug/trace` — `{code, function_name, args, kwargs}` → timeline array
- `POST /v1/code/save` — `{filename, code}` → `{snippet_id, location}`
- `GET /v1/code/{snippet_id}` — retrieve a saved snippet

## Safety notes

The trace hook enforces a step ceiling (10,000), frame-depth cap (64), and a
5-second wall clock; the abort signal derives from `BaseException` so user
code with `except Exception` cannot swallow it. This is a safety net for a
local learning tool — production multi-tenant use would additionally isolate
each run in a resource-limited subprocess.