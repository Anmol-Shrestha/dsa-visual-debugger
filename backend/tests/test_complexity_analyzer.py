"""Tests for the empirical Big-O analyzer (ADR-005)."""

import pytest

from services.complexity_analyzer import ComplexityAnalyzer
from services.execution_engine import ExecutionEngineError

CONSTANT = """
def first(arr):
    return arr[0]

def gen_input(n):
    return [list(range(n))]
"""

LINEAR = """
def total(arr):
    s = 0
    for x in arr:
        s = s + x
    return s

def gen_input(n):
    return [list(range(n))]
"""

QUADRATIC = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def gen_input(n):
    return [list(range(n, 0, -1))]
"""


def analyze(code, function_name, **kwargs):
    return ComplexityAnalyzer().analyze(
        code=code,
        function_name=function_name,
        generator_name="gen_input",
        **kwargs,
    )


def test_constant_function_reports_o1():
    result = analyze(CONSTANT, "first")
    assert result["best_fit"] == "O(1)"


def test_linear_function_reports_on():
    result = analyze(LINEAR, "total")
    assert result["best_fit"] == "O(n)"
    assert result["r_squared"] > 0.99


def test_quadratic_function_reports_on2():
    result = analyze(QUADRATIC, "bubble_sort")
    assert result["best_fit"] == "O(n²)"
    assert result["r_squared"] > 0.99


def test_measurements_grow_with_n():
    result = analyze(LINEAR, "total")
    steps = [m["steps"] for m in result["measurements"]]
    assert steps == sorted(steps)
    assert len(result["measurements"]) == 6  # default sizes


def test_custom_sizes_respected():
    result = analyze(LINEAR, "total", sizes=[10, 20, 30, 40])
    assert [m["n"] for m in result["measurements"]] == [10, 20, 30, 40]


def test_missing_generator_reported():
    code = "def f(arr):\n    return arr\n"
    with pytest.raises(ExecutionEngineError, match="not found"):
        analyze(code, "f")


def test_invalid_sizes_rejected():
    with pytest.raises(ExecutionEngineError, match="between"):
        analyze(LINEAR, "total", sizes=[0, 5, 10])


def test_generator_steps_not_counted_in_measurement():
    # The generator itself is linear in n; a constant-time target must
    # still report O(1) because generation is measured separately.
    result = analyze(CONSTANT, "first")
    steps = {m["steps"] for m in result["measurements"]}
    assert len(steps) == 1  # identical count at every size
