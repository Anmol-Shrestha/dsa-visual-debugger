"""Core execution engine service (ADR-001).

Runs a target function from a user-submitted code string under a
``sys.settrace`` hook and records a step-by-step execution timeline through
an injected TraceManager. Pure business logic — zero FastAPI/HTTP coupling.

NOTE: this is a safety net for a local learning tool, not a hardened
multi-tenant sandbox; production isolation would run each trace in a
resource-limited subprocess.
"""

import copy
import sys
import time
from typing import Any

from services.serialization import serialize_value
from services.trace_manager import TraceManager

# Filename stamped onto the compiled user code; the trace hook uses it to
# trace *only* user frames and skip stdlib/internal ones.
USER_CODE_FILENAME = "<user_code>"

DEFAULT_MAX_STEPS = 10_000
DEFAULT_MAX_DEPTH = 64
DEFAULT_MAX_SECONDS = 5.0


class ExecutionEngineError(Exception):
    """Any failure the caller should surface as a bad run: compile error,
    missing function, user-code crash, or a tripped safety limit."""


class _SafetyLimitExceeded(BaseException):
    """Raised from inside the trace hook to abort runaway user code.

    Derives from BaseException deliberately: user code wrapping its loop in
    a broad ``except Exception`` must not be able to swallow the abort.
    """


class ExecutionEngine:
    """Executes a target function and returns its JSON-safe timeline."""

    def __init__(
        self,
        trace_manager: TraceManager,
        *,
        max_steps: int = DEFAULT_MAX_STEPS,
        max_depth: int = DEFAULT_MAX_DEPTH,
        max_seconds: float = DEFAULT_MAX_SECONDS,
        capture_variables: bool = True,
    ) -> None:
        self._trace_manager = trace_manager
        self._max_steps = max_steps
        self._max_depth = max_depth
        self._max_seconds = max_seconds
        # When False, line events are recorded without variable snapshots —
        # used by the complexity analyzer, which only needs step counts.
        self._capture_variables = capture_variables
        # Per-run mutable state, reset at the top of every run().
        self._steps = 0
        self._depth = 0
        self._deadline = 0.0

    def run(self, code: str) -> list[dict[str, Any]]:
        """Execute the code from top to bottom and return the full timeline."""
        # Fresh budgets per run: step count, frame depth, and wall clock.
        self._trace_manager.reset()
        self._steps = 0
        self._depth = 0
        self._deadline = time.monotonic() + self._max_seconds

        try:
            compiled = compile(code, USER_CODE_FILENAME, "exec")
        except SyntaxError as exc:
            raise ExecutionEngineError(
                f"Syntax error on line {exc.lineno}: {exc.msg}"
            ) from exc

        namespace: dict[str, Any] = {}

        # Trace is active from the start of exec() through completion.
        sys.settrace(self._global_trace)
        try:
            exec(compiled, namespace)
        except _SafetyLimitExceeded as exc:
            raise ExecutionEngineError(str(exc)) from exc
        except Exception as exc:
            # The user's own code crashed — report it as a run failure.
            raise ExecutionEngineError(
                f"Execution raised {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            sys.settrace(None)

        # ADR-002 stage 2: sanitize the deep-copied snapshots into JSON-safe
        # values before the timeline leaves the service layer.
        return [
            {
                **entry,
                "local_variables": {
                    name: serialize_value(value)
                    for name, value in entry["local_variables"].items()
                },
            }
            for entry in self._trace_manager.history
        ]


    # ------------------------------------------------------------------
    # Trace hooks
    # ------------------------------------------------------------------

    def _global_trace(self, frame: Any, event: str, arg: Any):
        # Only frames compiled from the user's code string are traced.
        if frame.f_code.co_filename != USER_CODE_FILENAME:
            return None
        if event == "call":
            self._depth += 1
            if self._depth > self._max_depth:
                raise _SafetyLimitExceeded(
                    f"Frame depth limit of {self._max_depth} exceeded "
                    "(runaway recursion?)"
                )
            return self._local_trace
        return None

    def _local_trace(self, frame: Any, event: str, arg: Any):
        if event == "line":
            self._steps += 1
            if self._steps > self._max_steps:
                raise _SafetyLimitExceeded(
                    f"Step limit of {self._max_steps} exceeded (infinite loop?)"
                )
            if time.monotonic() > self._deadline:
                raise _SafetyLimitExceeded(
                    f"Wall-clock limit of {self._max_seconds}s exceeded"
                )
            # ADR-002 stage 1: snapshot immediately; the frame object is
            # never stored, so no reference cycles keep stacks alive.
            self._trace_manager.record(
                line_number=frame.f_lineno,
                frame_name=frame.f_code.co_name,
                local_variables=(
                    self._snapshot_locals(frame.f_locals)
                    if self._capture_variables
                    else {}
                ),
            )
        elif event == "return":
            self._depth -= 1
        return self._local_trace

    @staticmethod
    def _snapshot_locals(local_vars: dict[str, Any]) -> dict[str, Any]:
        """Deep-copy locals at this instant, omitting dunder/system keys."""
        snapshot: dict[str, Any] = {}
        for name, value in local_vars.items():
            if name.startswith("__"):
                continue
            try:
                snapshot[name] = copy.deepcopy(value)
            except Exception:
                # Uncopyable (file handles, locks, ...): degrade to repr.
                snapshot[name] = repr(value)
        return snapshot