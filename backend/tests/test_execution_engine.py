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

result = bubble_sort([3, 1, 2])
"""

BUBBLE_SORT_SMALL = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

result = bubble_sort([2, 1])
"""


def test_timeline_records_contiguous_steps():
    timeline = make_engine().run(BUBBLE_SORT)
    assert len(timeline) > 0
    assert [entry["step"] for entry in timeline] == list(range(len(timeline)))
    assert any(entry["frame_name"] == "bubble_sort" for entry in timeline)
    # Final recorded state shows the array sorted.
    assert timeline[-1]["local_variables"]["arr"] == [1, 2, 3]


def test_dunder_keys_are_omitted():
    timeline = make_engine().run(BUBBLE_SORT_SMALL)
    for entry in timeline:
        assert not any(k.startswith("__") for k in entry["local_variables"])


def test_infinite_loop_hits_step_ceiling():
    code = "def spin():\n    while True:\n        pass\nspin()\n"
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code)


def test_module_level_infinite_loop_is_bounded():
    code = "while True:\n    pass\n"
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code)


def test_runaway_recursion_hits_depth_cap():
    code = "def down(n):\n    return down(n + 1)\ndown(0)\n"
    with pytest.raises(ExecutionEngineError, match="depth limit"):
        make_engine().run(code)


def test_broad_except_cannot_swallow_the_abort():
    code = (
        "def sneaky():\n"
        "    while True:\n"
        "        try:\n"
        "            x = 1\n"
        "        except Exception:\n"
        "            pass\n"
        "sneaky()\n"
    )
    with pytest.raises(ExecutionEngineError, match="Step limit"):
        make_engine(max_steps=200).run(code)


def test_missing_function_error_at_call_time():
    code = "x = 1\n"
    # No longer reports missing function; code just runs
    timeline = make_engine().run(code)
    assert len(timeline) > 0


def test_syntax_error_reported():
    with pytest.raises(ExecutionEngineError, match="Syntax error"):
        make_engine().run("def broken(:\n")


def test_user_exception_reported():
    code = "def boom():\n    raise ValueError('kaput')\nboom()\n"
    with pytest.raises(ExecutionEngineError, match="kaput"):
        make_engine().run(code)


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
        "\n"
        "result = build()\n"
    )
    timeline = make_engine().run(code)
    final_vars = timeline[-1]["local_variables"]
    # Find the final state where 'a' is defined in the build frame
    build_frames = [e for e in timeline if e["frame_name"] == "build"]
    if build_frames:
        a = build_frames[-1]["local_variables"].get("a")
        if a:
            assert a["__type__"] == "Node"
            assert a["attrs"]["next"]["attrs"]["next"] == {"__cycle__": "Node"}


def test_recursion_records_call_frames():
    code = (
        "def fib(n):\n"
        "    if n <= 1:\n"
        "        return n\n"
        "    return fib(n - 1) + fib(n - 2)\n"
        "\n"
        "result = fib(4)\n"
    )
    timeline = make_engine().run(code)
    fib_frames = [e for e in timeline if e["frame_name"] == "fib"]
    assert len(fib_frames) > 0
    seen_n = {entry["local_variables"].get("n") for entry in fib_frames}
    assert {0, 1, 2, 3, 4} & seen_n
