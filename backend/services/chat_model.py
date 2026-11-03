"""Port for chat-capable language models (the service-layer contract).

Every model backend — Claude, a custom ML endpoint, a test fake — implements
this one protocol. The ChatService only ever talks to this interface, so an
adapter can be swapped without touching business logic.
"""

from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class ChatMessage:
    """One turn of conversation, in the provider-neutral shape."""

    role: Literal["user", "assistant"]
    content: str


class ChatModelError(Exception):
    """A model call failed (network, bad response, misconfiguration)."""


class ChatModel(Protocol):
    """Contract every chat adapter must satisfy.

    ``provider`` is the stable key the UI uses to switch models.
    ``is_configured`` lets the UI show a model as unavailable without a call.
    ``complete`` sends the system prompt plus conversation and returns the
    assistant's reply text.
    """

    @property
    def provider(self) -> str: ...

    def is_configured(self) -> bool: ...

    def complete(self, system: str, messages: list[ChatMessage]) -> str: ...
