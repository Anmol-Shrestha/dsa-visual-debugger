"""Abstract trace manager contract and its in-memory implementation.

The ExecutionEngine records steps through this interface only, so how the
timeline is stored (memory, disk, stream) can change without touching the
engine.
"""

from abc import ABC, abstractmethod
from typing import Any


class TraceManager(ABC):
    """Contract for recording execution state, one entry per 'line' event."""

    @abstractmethod
    def reset(self) -> None:
        """Discard any previously recorded history before a new run."""

    @abstractmethod
    def record(
        self,
        line_number: int,
        frame_name: str,
        local_variables: dict[str, Any],
    ) -> None:
        """Append one execution step to the timeline."""

    @property
    @abstractmethod
    def history(self) -> list[dict[str, Any]]:
        """The recorded timeline, in execution order."""


class InMemoryTraceManager(TraceManager):
    """Accumulates the timeline in a plain list — one instance per run."""

    def __init__(self) -> None:
        self._history: list[dict[str, Any]] = []

    def reset(self) -> None:
        self._history = []

    def record(
        self,
        line_number: int,
        frame_name: str,
        local_variables: dict[str, Any],
    ) -> None:
        # The step index is derived from the current length, so entries are
        # guaranteed contiguous and ordered without extra bookkeeping.
        self._history.append(
            {
                "step": len(self._history),
                "line_number": line_number,
                "frame_name": frame_name,
                "local_variables": local_variables,
            }
        )

    @property
    def history(self) -> list[dict[str, Any]]:
        return self._history