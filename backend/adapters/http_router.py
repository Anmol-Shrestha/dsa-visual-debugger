"""FastAPI HTTP router — the only layer aware of HTTP concerns.

Services and repositories arrive via dependency injection; swapping the
storage backend means changing one provider function, nothing else.
"""

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from adapters.local_storage_adapter import LocalFileSystemAdapter
from adapters.repository import CodeRepository, SnippetNotFoundError
from services.complexity_analyzer import ComplexityAnalyzer
from services.execution_engine import ExecutionEngine, ExecutionEngineError
from services.trace_manager import InMemoryTraceManager

router = APIRouter(prefix="/v1")


# ----------------------------------------------------------------------
# Dependency providers (the composition root for this router)
# ----------------------------------------------------------------------

def get_code_repository() -> CodeRepository:
    """Provide the storage backend. Swapping to S3/MongoDB later means
    returning a different CodeRepository implementation here — the
    endpoints and services below stay untouched."""
    storage_dir = Path(os.getenv("CODE_STORAGE_DIR", "saved_snippets"))
    return LocalFileSystemAdapter(storage_dir)


def get_execution_engine() -> ExecutionEngine:
    """Provide a fresh engine per request; the trace manager accumulates
    per-run state, so it must never be shared across requests."""
    return ExecutionEngine(InMemoryTraceManager())


def get_complexity_analyzer() -> ComplexityAnalyzer:
    return ComplexityAnalyzer()


# ----------------------------------------------------------------------
# Request/response schemas
# ----------------------------------------------------------------------

class TraceRequest(BaseModel):
    code: str
    function_name: str
    args: list[Any] = Field(default_factory=list)
    kwargs: dict[str, Any] = Field(default_factory=dict)


class SaveCodeRequest(BaseModel):
    filename: str
    code: str


class ComplexityRequest(BaseModel):
    code: str
    function_name: str
    generator_name: str = "gen_input"
    sizes: list[int] | None = None


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------

@router.post("/debug/trace")
def trace_execution(
    request: TraceRequest,
    engine: ExecutionEngine = Depends(get_execution_engine),
) -> list[dict[str, Any]]:
    """Execute the submitted function and return its full timeline array."""
    try:
        return engine.run(
            code=request.code,
            function_name=request.function_name,
            args=request.args,
            kwargs=request.kwargs,
        )
    except ExecutionEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/debug/complexity")
def analyze_complexity(
    request: ComplexityRequest,
    analyzer: ComplexityAnalyzer = Depends(get_complexity_analyzer),
) -> dict[str, Any]:
    """Measure step counts across input sizes and fit a Big-O growth curve."""
    try:
        return analyzer.analyze(
            code=request.code,
            function_name=request.function_name,
            generator_name=request.generator_name,
            sizes=request.sizes,
        )
    except ExecutionEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/code/save")
def save_code(
    request: SaveCodeRequest,
    repository: CodeRepository = Depends(get_code_repository),
) -> dict[str, str]:
    """Persist a snippet through the injected repository."""
    snippet_id = request.filename.removesuffix(".py")
    location = repository.save(snippet_id, request.code)
    return {"snippet_id": snippet_id, "location": location}


@router.get("/code/{snippet_id}")
def get_code(
    snippet_id: str,
    repository: CodeRepository = Depends(get_code_repository),
) -> dict[str, str]:
    """Retrieve a previously saved snippet."""
    try:
        return {"snippet_id": snippet_id, "code": repository.retrieve(snippet_id)}
    except SnippetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail=f"Snippet '{snippet_id}' not found"
        ) from exc
