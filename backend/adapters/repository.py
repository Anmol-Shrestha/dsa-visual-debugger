"""Abstract persistence contract for code snippets.

Any storage backend (local disk, S3, MongoDB, ...) implements this ABC;
services and routers depend only on this interface, so swapping backends
requires zero changes to business logic or HTTP endpoints.
"""

from abc import ABC, abstractmethod


class SnippetNotFoundError(Exception):
    """Raised when a requested snippet does not exist in storage."""


class CodeRepository(ABC):
    """Contract for saving and retrieving code payloads."""

    @abstractmethod
    def save(self, snippet_id: str, code: str) -> str:
        """Persist `code` under `snippet_id`; return a storage location string."""

    @abstractmethod
    def retrieve(self, snippet_id: str) -> str:
        """Return the code stored under `snippet_id`.

        Raises SnippetNotFoundError if it does not exist.
        """
