"""FastAPI HTTP router — the only layer aware of HTTP concerns.

Services and repositories arrive via dependency injection; swapping the
storage backend means changing one provider function, nothing else.
"""

import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from adapters.claude_chat_adapter import ClaudeChatAdapter
from adapters.custom_chat_adapter import CustomChatAdapter
from adapters.local_storage_adapter import LocalFileSystemAdapter
from adapters.repository import CodeRepository, SnippetNotFoundError
from services.chat_model import ChatMessage
from services.chat_service import ChatService, ChatServiceError
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


def get_chat_service() -> ChatService:
    """Register every chat adapter; the UI picks one per message.
    Adding a model means one new adapter plus one line here."""
    models = [ClaudeChatAdapter.from_env(), CustomChatAdapter.from_env()]
    return ChatService({m.provider: m for m in models}, default_provider="claude")


# ----------------------------------------------------------------------
# Request/response schemas
# ----------------------------------------------------------------------

class TraceRequest(BaseModel):
    code: str


class SaveCodeRequest(BaseModel):
    filename: str
    code: str


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    code: str | None = Field(default=None, max_length=50_000)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=40)
    provider: str | None = None


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------

@router.post("/debug/trace")
def trace_execution(
    request: TraceRequest,
    engine: ExecutionEngine = Depends(get_execution_engine),
) -> list[dict[str, Any]]:
    """Execute the submitted code and return its full timeline array."""
    try:
        return engine.run(code=request.code)
    except ExecutionEngineError as exc:
        # Structured detail so the UI can highlight the failing line and
        # render the stack trace.
        raise HTTPException(
            status_code=400,
            detail={
                "message": exc.message,
                "error_type": exc.error_type,
                "line_number": exc.line_number,
                "stack": exc.stack,
            },
        ) from exc


@router.get("/health")
def health() -> dict[str, str]:
    """Lightweight liveness check; the frontend polls it while the host wakes."""
    return {"status": "ok"}


@router.get("/chat/providers")
def list_chat_providers(
    service: ChatService = Depends(get_chat_service),
) -> list[dict[str, Any]]:
    """List chat models and whether each is configured, for the UI switcher."""
    return service.providers()


@router.post("/chat")
def chat(
    request: ChatRequest,
    service: ChatService = Depends(get_chat_service),
) -> dict[str, str]:
    """Ask the selected model for feedback on the learner's code."""
    history = [ChatMessage(role=h.role, content=h.content) for h in request.history]
    try:
        result = service.ask(
            request.question,
            code=request.code,
            history=history,
            provider=request.provider,
        )
    except ChatServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"provider": result.provider, "reply": result.reply}


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
