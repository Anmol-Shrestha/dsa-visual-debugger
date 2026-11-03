"""ChatService routing, prompt building, and error mapping.

Uses a fake ChatModel so no network call is made. Also checks that the two
real adapters report unconfigured without credentials.
"""

import pytest

from adapters.claude_chat_adapter import ClaudeChatAdapter
from adapters.custom_chat_adapter import CustomChatAdapter
from services.chat_model import ChatMessage, ChatModelError
from services.chat_service import ChatService, ChatServiceError


class FakeModel:
    def __init__(self, name: str, configured: bool = True, reply: str = "ok") -> None:
        self._name = name
        self._configured = configured
        self._reply = reply
        self.calls: list[tuple[str, list[ChatMessage]]] = []

    @property
    def provider(self) -> str:
        return self._name

    def is_configured(self) -> bool:
        return self._configured

    def complete(self, system: str, messages: list[ChatMessage]) -> str:
        self.calls.append((system, messages))
        return self._reply


class FailingModel(FakeModel):
    def complete(self, system: str, messages: list[ChatMessage]) -> str:
        raise ChatModelError("boom")


def make_service(*models: FakeModel, default: str = "claude") -> ChatService:
    return ChatService({m.provider: m for m in models}, default_provider=default)


def test_ask_uses_default_provider_and_inlines_code():
    claude = FakeModel("claude", reply="looks good")
    service = make_service(claude)

    result = service.ask("Is this O(n)?", code="def f(xs):\n    return xs")

    assert result.provider == "claude"
    assert result.reply == "looks good"
    system, messages = claude.calls[0]
    assert "def f(xs):" in system
    assert messages == [ChatMessage(role="user", content="Is this O(n)?")]


def test_ask_routes_to_requested_provider():
    claude = FakeModel("claude", reply="from claude")
    custom = FakeModel("custom", reply="from custom")
    service = make_service(claude, custom)

    result = service.ask("hi", provider="custom")

    assert result.provider == "custom"
    assert result.reply == "from custom"
    assert claude.calls == []


def test_history_is_sent_before_the_new_question():
    claude = FakeModel("claude")
    service = make_service(claude)
    history = [
        ChatMessage(role="user", content="first"),
        ChatMessage(role="assistant", content="answer"),
    ]

    service.ask("second", history=history)

    _, messages = claude.calls[0]
    assert [m.content for m in messages] == ["first", "answer", "second"]


def test_unknown_provider_is_rejected():
    service = make_service(FakeModel("claude"))
    with pytest.raises(ChatServiceError, match="Unknown provider"):
        service.ask("hi", provider="gpt")


def test_unconfigured_provider_is_rejected_before_calling_it():
    claude = FakeModel("claude", configured=False)
    service = make_service(claude)
    with pytest.raises(ChatServiceError, match="not configured"):
        service.ask("hi")
    assert claude.calls == []


def test_adapter_errors_are_wrapped_as_service_errors():
    service = make_service(FailingModel("claude"))
    with pytest.raises(ChatServiceError, match="boom"):
        service.ask("hi")


def test_providers_reports_configuration_and_default():
    service = make_service(FakeModel("claude"), FakeModel("custom", configured=False))
    assert service.providers() == [
        {"provider": "claude", "configured": True, "default": True},
        {"provider": "custom", "configured": False, "default": False},
    ]


def test_default_provider_must_be_registered():
    with pytest.raises(ValueError):
        ChatService({"claude": FakeModel("claude")}, default_provider="custom")


def test_claude_adapter_unconfigured_without_key():
    adapter = ClaudeChatAdapter(api_key=None)
    assert adapter.provider == "claude"
    assert not adapter.is_configured()
    with pytest.raises(ChatModelError, match="ANTHROPIC_API_KEY"):
        adapter.complete("sys", [ChatMessage(role="user", content="hi")])


def test_custom_adapter_unconfigured_without_url():
    adapter = CustomChatAdapter(url=None)
    assert adapter.provider == "custom"
    assert not adapter.is_configured()
    with pytest.raises(ChatModelError, match="CUSTOM_MODEL_URL"):
        adapter.complete("sys", [ChatMessage(role="user", content="hi")])
