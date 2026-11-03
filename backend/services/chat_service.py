"""Chat service: routes code-feedback questions to whichever model is selected.

Pure business logic — no FastAPI or HTTP imports. The service holds every
registered ChatModel adapter and a default provider; a request may name a
different provider to switch models per message.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from services.chat_model import ChatMessage, ChatModel, ChatModelError

# Instructions prepended to every conversation. The user's code is attached
# to the system prompt so the model always reviews the code currently in the
# editor, not a stale copy from an earlier turn.
SYSTEM_PROMPT = (
    "You are a patient tutor for Python data structures and algorithms. "
    "Review the learner's code and give concise, specific feedback: explain "
    "what the code does, point out bugs or inefficiencies, and suggest "
    "improvements with short examples. Do not rewrite the whole solution "
    "unless asked."
)


class ChatServiceError(Exception):
    """A request the service cannot route (unknown or unconfigured provider)."""


@dataclass(frozen=True)
class ChatReply:
    provider: str
    reply: str


class ChatService:
    """Owns the registered adapters and picks one per request."""

    def __init__(self, models: Mapping[str, ChatModel], default_provider: str) -> None:
        if default_provider not in models:
            raise ValueError(f"Default provider '{default_provider}' is not registered")
        self._models = dict(models)
        self._default = default_provider

    @property
    def default_provider(self) -> str:
        return self._default

    def providers(self) -> list[dict[str, Any]]:
        """List every registered model and whether it can answer right now."""
        return [
            {
                "provider": name,
                "configured": model.is_configured(),
                "default": name == self._default,
            }
            for name, model in self._models.items()
        ]

    def ask(
        self,
        question: str,
        *,
        code: str | None = None,
        history: Sequence[ChatMessage] = (),
        provider: str | None = None,
    ) -> ChatReply:
        """Answer a question about the learner's code with the chosen model."""
        name = provider or self._default
        model = self._models.get(name)
        if model is None:
            raise ChatServiceError(f"Unknown provider '{name}'")
        if not model.is_configured():
            raise ChatServiceError(f"Provider '{name}' is not configured")

        # Build the prompt in the service so every adapter receives the same
        # content. Code is inlined into the system prompt (see SYSTEM_PROMPT).
        system = SYSTEM_PROMPT
        if code:
            system += f"\n\nThe learner's current code:\n```python\n{code}\n```"

        messages = [*history, ChatMessage(role="user", content=question)]
        try:
            reply = model.complete(system, messages)
        except ChatModelError as exc:
            raise ChatServiceError(str(exc)) from exc
        return ChatReply(provider=name, reply=reply)
