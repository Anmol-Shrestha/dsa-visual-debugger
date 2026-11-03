"""Claude adapter for the ChatModel port (Anthropic Messages API).

Uses only the standard library so no SDK is required. Configuration:
  ANTHROPIC_API_KEY  — required; without it the adapter reports unconfigured.
  ANTHROPIC_MODEL    — optional model id override.
"""

import json
import os
import urllib.error
import urllib.request

from services.chat_model import ChatMessage, ChatModelError

API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5-5"
REQUEST_TIMEOUT_SECONDS = 60


class ClaudeChatAdapter:
    def __init__(self, api_key: str | None, model: str = DEFAULT_MODEL, max_tokens: int = 1024) -> None:
        self._api_key = api_key
        self._model = model
        self._max_tokens = max_tokens

    @property
    def provider(self) -> str:  # type: ignore[override]
        return "claude"

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def complete(self, system: str, messages: list[ChatMessage]) -> str:
        if not self._api_key:
            raise ChatModelError("ANTHROPIC_API_KEY is not set")

        # The Messages API takes the system prompt as a top-level field and
        # the conversation as a list of role/content pairs.
        payload = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        request = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "x-api-key": self._api_key,
                "anthropic-version": API_VERSION,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ChatModelError(f"Claude API returned HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ChatModelError(f"Could not reach Claude API: {exc}") from exc

        # Concatenate the text blocks; ignore any non-text content.
        text = "".join(
            block.get("text", "") for block in body.get("content", []) if block.get("type") == "text"
        )
        if not text:
            raise ChatModelError("Claude API returned no text content")
        return text

    @classmethod
    def from_env(cls) -> "ClaudeChatAdapter":
        return cls(
            api_key=os.getenv("ANTHROPIC_API_KEY") or None,
            model=os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL),
        )
