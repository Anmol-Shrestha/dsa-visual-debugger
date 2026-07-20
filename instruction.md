Target Objective: Build a lightweight, web-based visual code execution debugger specifically designed for practicing Python Data Structures and Algorithms (DSA). The user should be able to input a Python function, step forward and backward through its execution timeline, and visually trace variables and function call stack frames.

Architectural Requirements:
1. Implement a top-down, completely decoupled backend architecture using Python 3.11+ and FastAPI.
2. Structure the backend using clean Domain-Driven patterns:
   - Service Layer: Holds the core execution engine and abstract trace managers.
   - Adapter Layer: Houses the FastAPI HTTP router and execution runner endpoints.
3. The frontend must be a single-page interface using React, Vite, and Tailwind CSS.

Technical Implementation Blueprint:

Backend Architecture (Python / FastAPI):
- Create an execution engine service that takes a code string, target function name, and input arguments.
- Use `sys.settrace` or a custom tracking hook to record execution line-by-line.
- On every 'line' event, capture:
  - Current line number (`frame.f_lineno`)
  - Active function scope/frame name (`frame.f_code.co_name`)
  - A deep copy snapshot of local variables (`frame.f_locals`), completely omitting system dunder keys.
- Ensure the tracing hook explicitly prevents infinite loops or malicious recursion depth limits.
- Expose a single `POST /v1/debug/trace` endpoint that accepts the code string + inputs and returns a unified JSON execution history timeline array.

Frontend Architecture (React + Tailwind CSS):
- Create a clean two-column dashboard layout:
  - Left Panel: Code view. Displays the raw Python code with a visual highlight overlay highlighting the active line matching the current timeline index.
  - Right Panel: State Inspection Area containing:
    1. Timeline Scrubbing Slider: A step slider from 0 to len(history)-1 allowing step-forward/step-back navigation.
    2. Call Stack Viewer: Displays the current active frame name.
    3. Variable State Tracker: Evaluates the local variables at the selected index. If a variable is a primitive, show it as text. If it is a list or a dictionary, render it visually inside structured layout grids (like an array of blocks) rather than raw JSON strings.


Additional Feature Requirement: File Export & Decoupled Storage Pattern
- Implement a saving/exporting mechanism for the written code snippets.
- The UI must feature a prominent action button initially labeled "Save to Desktop". Clicking this button must trigger an immediate client-side file download of the Python script directly to the user's local machine.

Decoupled Persistence Architecture (Repository & Adapter Pattern):
- To avoid cloud database costs for now, the backend must abstract all persistence logic behind a strict interface layer.
- Define an abstract storage contract (e.g., using Python `typing.Protocol` or `abc.ABC`) called `CodeRepository` with clear methods for saving and retrieving code payloads.
- Implement a concrete local file-system adapter class (`LocalFileSystemAdapter`) that conforms to `CodeRepository`, handling saving snippets directly to a local directory configuration on disk.
- Inject this repository interface into your FastAPI router/services via dependency injection.
- Ensure the architecture is written so that swapping the storage implementation from the local file-system adapter to a cloud-based service adapter (such as AWS S3 or MongoDB) later requires zero modifications to the underlying core business logic or HTTP controller endpoints—only a clean swap of the injected adapter class.


Deliverable Guidelines:
Provide the complete, end-to-end code files. Ensure the business logic in the Service layer is fully modular and has zero tight coupling to FastAPI components. Write minimal, clean, production-ready code with explicit inline comments explaining the execution state mutations.