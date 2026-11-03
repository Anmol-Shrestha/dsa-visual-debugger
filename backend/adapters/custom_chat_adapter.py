"""Custom-model adapter for the ChatModel port.

Talks to any HTTP endpoint that accepts the contract below, so a self-hosted
or fine-tuned model can be plugged in without changing the service layer.

Request  (POST CUSTOM_MODEL_URL):
    {"system": "<prompt>", "messages": [{"role": "user"|"assistant", "content": "..."}]}
Response (JSON):
    {"reply": "<text>"}

Configuration:
  CUSTOM_MODEL_URL      — required; without it the adapter reports unconfigured.
  CUSTOM_MODEL_TOKEN    — optional bearer token sent as Authorization.
"""

import json
import os
import urllib.error
import urllib.request

from services.chat_model import ChatMessage, ChatModelError

REQUEST_TIMEOUT_SECONDS = 60


class CustomChatAdapter:
    def __init__(self, url: str | None, token: str | None = None) -> None:
        self._url = url
        self._token = token

    @property
    def provider(self) -> str:  # type: ignore[override]
        return "custom"

    def is_configured(self) -> bool:
        return bool(self._url)

    def complete(self, system: str, messages: list[ChatMessage]) -> str:
        if not self._url:
            raise ChatModelError("CUSTOM_MODEL_URL is not set")

        payload = {
            "system": system,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        headers = {"content-type": "application/json"}
        if self._token:
            headers["authorization"] = f"Bearer {self._token}"
        request = urllib.request.Request(
            self._url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ChatModelError(f"Custom model endpoint returned HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ChatModelError(f"Could not reach custom model endpoint: {exc}") from exc

        reply = body.get("reply")
        if not isinstance(reply, str) or not reply:
            raise ChatModelError("Custom model response is missing a 'reply' string")
        return reply

    @classmethod
    def from_env(cls) -> "CustomChatAdapter":
        return cls(
            url=os.getenv("CUSTOM_MODEL_URL") or None,
            token=os.getenv("CUSTOM_MODEL_TOKEN") or None,
        )
