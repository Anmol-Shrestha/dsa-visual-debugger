"""ADR-002 stage 2: recursive JSON-safe serialization of variable snapshots.

Pure functions with a single invariant: `serialize_value` never raises.
Custom class instances become tagged objects the frontend renders visually;
cycles, depth, and size are all bounded.
"""

import math
import types
from typing import Any

MAX_DEPTH = 10
MAX_ITEMS = 100

# Callables/modules/classes carry no student-visible state worth walking.
_OPAQUE_TYPES = (
    type,
    types.ModuleType,
    types.FunctionType,
    types.BuiltinFunctionType,
    types.MethodType,
    types.GeneratorType,
)


def serialize_value(value: Any, _depth: int = 0, _seen: set[int] | None = None) -> Any:
    """Convert an arbitrary Python value into a JSON-safe structure."""
    if _seen is None:
        _seen = set()

    try:
        if value is None or isinstance(value, (bool, int, str)):
            return value
        if isinstance(value, float):
            # JSON forbids NaN/Infinity — degrade to their repr strings.
            if math.isnan(value) or math.isinf(value):
                return repr(value)
            return value

        if _depth >= MAX_DEPTH:
            return {"__truncated__": True}

        # Cycle guard: `_seen` holds ids along the *current* recursion path
        # only (added before descending, discarded after), so shared-but-
        # acyclic references still render while true cycles are cut.
        obj_id = id(value)
        if obj_id in _seen:
            return {"__cycle__": type(value).__name__}
        _seen.add(obj_id)
        try:
            if isinstance(value, list):
                return _serialize_items(value, _depth, _seen)
            if isinstance(value, tuple):
                return {"__type__": "tuple", "items": _serialize_items(value, _depth, _seen)}
            if isinstance(value, (set, frozenset)):
                # Sort by repr so output is deterministic even for mixed types.
                ordered = sorted(value, key=_safe_repr)
                return {"__type__": "set", "items": _serialize_items(ordered, _depth, _seen)}
            if isinstance(value, dict):
                out: dict[str, Any] = {}
                for i, (key, item) in enumerate(value.items()):
                    if i >= MAX_ITEMS:
                        out["__truncated__"] = True
                        break
                    out[str(key)] = serialize_value(item, _depth + 1, _seen)
                return out
            if isinstance(value, _OPAQUE_TYPES):
                return _safe_repr(value)

            attrs = _instance_attrs(value)
            if attrs is not None:
                # Tagged custom object: the frontend renders these as visual
                # node cards (e.g. LinkedList nodes) instead of repr strings.
                return {
                    "__type__": type(value).__name__,
                    "attrs": {
                        name: serialize_value(item, _depth + 1, _seen)
                        for name, item in attrs.items()
                        if not name.startswith("__")
                    },
                }
            return _safe_repr(value)
        finally:
            _seen.discard(obj_id)
    except Exception:
        # Never-raise invariant: worst case the value renders as a string.
        return _safe_repr(value)


def _serialize_items(items: Any, depth: int, seen: set[int]) -> list[Any]:
    out: list[Any] = []
    for i, item in enumerate(items):
        if i >= MAX_ITEMS:
            out.append({"__truncated__": True})
            break
        out.append(serialize_value(item, depth + 1, seen))
    return out


def _instance_attrs(value: Any) -> dict[str, Any] | None:
    """Instance attributes for a user-defined object, or None if opaque."""
    if hasattr(value, "__dict__"):
        return dict(vars(value))
    slots = getattr(type(value), "__slots__", None)
    if slots:
        if isinstance(slots, str):
            slots = (slots,)
        return {name: getattr(value, name, None) for name in slots}
    return None


def _safe_repr(value: Any) -> str:
    try:
        return repr(value)
    except Exception:
        return f"<unrepresentable {type(value).__name__}>"