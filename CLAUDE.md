# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **web-based visual code execution debugger** designed specifically for practicing Python Data Structures and Algorithms (DSA). Users input a Python function, then step forward and backward through its execution timeline while visually tracing variables, function call stack frames, and code line-by-line execution.

## Technology Stack

- **Backend**: Python 3.11+, FastAPI
- **Frontend**: React, Vite, Tailwind CSS
- **Execution Tracing**: `sys.settrace` with custom tracking hooks

## Architecture

### Backend Architecture (Python / FastAPI)

The backend follows **clean Domain-Driven Design (DDD)** principles with strict separation of concerns:

1. **Service Layer**: Contains core business logic
   - `ExecutionEngine` service: Takes code string, target function name, and input arguments; orchestrates code execution and trace collection
   - Abstract `TraceManager`: Defines the interface for recording execution state
   
2. **Adapter Layer**: Contains HTTP/external integrations
   - FastAPI HTTP router with `POST /v1/debug/trace` endpoint
   - Concrete execution runner that bridges FastAPI requests to the service layer
   - Storage adapters for persistence (repository pattern)

3. **Persistence Architecture** (Repository & Adapter Pattern):
   - Define an abstract `CodeRepository` interface (using Python `typing.Protocol` or `abc.ABC`)
   - Implement concrete `LocalFileSystemAdapter` conforming to the interface
   - Inject the repository into FastAPI services via dependency injection
   - Architecture must allow swapping implementations (e.g., S3, MongoDB) with **zero changes** to business logic

### Execution Tracing

Use `sys.settrace` to instrument code execution:
- Hook into line-by-line execution events
- Capture state at each step:
  - Current line number (`frame.f_lineno`)
  - Active function scope (`frame.f_code.co_name`)
  - Deep copy snapshot of local variables (`frame.f_locals`), **excluding all dunder keys** (\_\_*)
- Include safeguards against infinite loops and recursion depth limits
- Return a unified JSON timeline array from `/v1/debug/trace` endpoint

### Frontend Architecture (React + Vite + Tailwind)

Two-column responsive dashboard layout:

**Left Panel**: Code Viewer
- Displays raw Python code
- Visual highlight overlay showing the active line matching current timeline index

**Right Panel**: State Inspection Area
- **Timeline Scrubber**: Slider from 0 to len(history)-1 for step-forward/step-back navigation
- **Call Stack Viewer**: Shows current active frame name
- **Variable State Tracker**: 
  - Primitives rendered as text
  - Lists/dictionaries rendered as visual structured grids (block layouts), **not raw JSON strings**

### File Export Feature

- Prominent "Save to Desktop" button in the UI
- Triggers client-side file download of the Python script to user's local machine
- Backend supports code persistence via injected repository adapter

## Code Patterns & Design Principles

1. **Dependency Injection**: Pass repository and service dependencies explicitly, do not use global singletons
2. **Clean Architecture**: Business logic in Service layer has zero coupling to FastAPI/HTTP concerns
3. **Repository Pattern**: All persistence is abstracted behind an interface contract
4. **Domain-Driven Design**: Service layer names and methods reflect domain concepts (execution, tracing, storage)
5. **Explicit Over Implicit**: Inline comments in Service layer explain execution state mutations
6. **Production-Ready**: Minimal, focused code without over-engineering

## Getting Started (Once Project Structure is Created)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Run Backend
```bash
cd backend
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Run Frontend (Development)
```bash
cd frontend
npm run dev
```

### Build Frontend (Production)
```bash
cd frontend
npm run build
```

## Key Files & Directories (To Be Created)

**Backend Structure** (to be created):
```
backend/
  ├── services/
  │   ├── execution_engine.py
  │   ├── trace_manager.py
  │   └── __init__.py
  ├── adapters/
  │   ├── http_router.py
  │   ├── local_storage_adapter.py
  │   ├── repository.py  (abstract interface)
  │   └── __init__.py
  ├── main.py  (FastAPI app entry point)
  ├── requirements.txt
  └── README.md
```

**Frontend Structure** (to be created):
```
frontend/
  ├── src/
  │   ├── components/
  │   │   ├── CodeViewer.tsx
  │   │   ├── StateInspector.tsx
  │   │   ├── TimelineSlider.tsx
  │   │   ├── CallStackViewer.tsx
  │   │   └── VariableStateTracker.tsx
  │   ├── App.tsx
  │   └── main.tsx
  ├── package.json
  ├── vite.config.ts
  └── tailwind.config.js
```

## API Contract

### POST /v1/debug/trace

**Request Body**:
```json
{
  "code": "def fibonacci(n):\n    ...",
  "function_name": "fibonacci",
  "args": [5],
  "kwargs": {}
}
```

**Response** (execution timeline):
```json
[
  {
    "step": 0,
    "line_number": 1,
    "frame_name": "fibonacci",
    "local_variables": {"n": 5}
  },
  {
    "step": 1,
    "line_number": 2,
    "frame_name": "fibonacci",
    "local_variables": {"n": 5, "result": 0}
  }
]
```

## Guiding Principles for Future Work

1. **Domain-First**: Understand the DSA execution model before implementing
2. **Test-Driven for Business Logic**: Service layer should be testable without FastAPI or HTTP concerns
3. **Progressive Enhancement**: Build core tracing → API → UI, not all at once
4. **Strict Interface Contracts**: Any new adapter or service must conform to its protocol/ABC
5. **Avoid Tight Coupling**: If it requires touching multiple layers to make one change, refactor toward interfaces