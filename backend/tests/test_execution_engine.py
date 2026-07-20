"""Service-layer tests — no FastAPI or HTTP involved."""

import pytest

from services.execution_engine import ExecutionEngine, ExecutionEngineError
from services.trace_manager import InMemoryTraceManager


def make_engine(**overrides) -> ExecutionEngine:
    return ExecutionEngine(InMemoryTraceManager(), **overrides)


BUBBLE_SORT = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
"""


def test_timeline_records_contiguous_steps():
    timeline = make_engine().run(BUBBLE_SORT, "bubble_sort", [[3, 1, 2]], {})
    assert len(timeline) > 0
    assert [entry["step"] for entry in timeline] == list(range(len(timeline)))
    assert all(entry["frame_name"] == "bubble_sort" for entry in timeline)
    # Final recorded state shows the array sorted.
    assert timeline[-1]["local_variables"]["arr"] == [1, 2, 3]


def test_dunder_keys_are_omitted():
    timeline = make_engine().run(BUBBLE_SORT, "bubble_sort", [[2, 1]], {})
    for entry in timeline:
        assert not any(k.startswith("__") for k in entry["local_variables"])


def test_infinite_loop_hits_step_ceiling():
    code = "def spin():\n    while True:\n        pass\n"
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code, "spin", [], {})


def test_module_level_infinite_loop_is_bounded():
    code = "while True:\n    pass\n"
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code, "anything", [], {})


def test_runaway_recursion_hits_depth_cap():
    code = "def down(n):\n    return down(n + 1)\n"
    with pytest.raises(ExecutionEngineError, match="depth limit"):
        make_engine().run(code, "down", [0], {})


def test_broad_except_cannot_swallow_the_abort():
    code = (
        "def sneaky():\n"
        "    while True:\n"
        "        try:\n"
        "            x = 1\n"
        "        except Exception:\n"
        "            pass\n"
    )
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code, "sneaky", [], {})


def test_missing_function_reported():
    with pytest.raises(ExecutionEngineError, match="not found"):
        make_engine().run("x = 1\n", "nope", [], {})


def test_syntax_error_reported():
    with pytest.raises(ExecutionEngineError, match="Syntax error"):
        make_engine().run("def broken(:\n", "broken", [], {})


def test_user_exception_reported():
    code = "def boom():\n    raise ValueError('kaput')\n"
    with pytest.raises(ExecutionEngineError, match="kaput"):
        make_engine().run(code, "boom", [], {})


def test_linked_list_cycle_serializes_with_marker():
    code = (
        "class Node:\n"
        "    def __init__(self, val):\n"
        "        self.val = val\n"
        "        self.next = None\n"
        "\n"
        "def build():\n"
        "    a = Node(1)\n"
        "    b = Node(2)\n"
        "    a.next = b\n"
        "    b.next = a\n"
        "    done = True\n"
        "    return a\n"
    )
    timeline = make_engine().run(code, "build", [], {})
    final_vars = timeline[-1]["local_variables"]
    a = final_vars["a"]
    assert a["__type__"] == "Node"
    assert a["attrs"]["next"]["attrs"]["next"] == {"__cycle__": "Node"}


def test_recursion_records_call_frames():
    code = (
        "def fib(n):\n"
        "    if n <= 1:\n"
        "        return n\n"
        "    return fib(n - 1) + fib(n - 2)\n"
    )
    timeline = make_engine().run(code, "fib", [4], {})
    assert all(entry["frame_name"] == "fib" for entry in timeline)
    seen_n = {entry["local_variables"]["n"] for entry in timeline}
    assert {0, 1, 2, 3, 4} <= seen_n
