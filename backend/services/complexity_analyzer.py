"""Empirical Big-O analysis service (ADR-005).

Runs the target function at increasing input sizes, counts traced line
events per run, and fits the measurements against candidate growth curves.
The user's code must define a generator function (default `gen_input`) that
returns the positional-arguments list for a given size n.

Pure business logic — zero FastAPI coupling.
"""

import math
from typing import Any, Callable

from services.execution_engine import ExecutionEngine, ExecutionEngineError
from services.trace_manager import TraceManager

DEFAULT_SIZES = [4, 8, 16, 32, 64, 128]
MAX_SIZES = 12
MAX_SIZE_VALUE = 100_000
# Counting mode skips variable snapshots, so a much higher step budget is
# affordable — this is what lets quadratic growth stay measurable at n=128.
COUNTING_MAX_STEPS = 500_000
COUNTING_MAX_SECONDS = 10.0

# Candidate growth models, ordered simplest-first: on (near-)ties the
# simpler complexity class wins.
_MODELS: list[tuple[str, Callable[[int], float]]] = [
    ("O(1)", lambda n: 1.0),
    ("O(log n)", lambda n: math.log2(n) if n > 1 else 1.0),
    ("O(n)", lambda n: float(n)),
    ("O(n log n)", lambda n: n * math.log2(n) if n > 1 else 1.0),
    ("O(n²)", lambda n: float(n) ** 2),
    ("O(n³)", lambda n: float(n) ** 3),
    ("O(2ⁿ)", lambda n: 2.0**n if n <= 64 else math.inf),
]


class CountingTraceManager(TraceManager):
    """Counts recorded steps without storing any timeline entries."""

    def __init__(self) -> None:
        self.count = 0

    def reset(self) -> None:
        self.count = 0

    def record(
        self,
        line_number: int,
        frame_name: str,
        local_variables: dict[str, Any],
    ) -> None:
        self.count += 1

    @property
    def history(self) -> list[dict[str, Any]]:
        return []


class ComplexityAnalyzer:
    """Measures step counts across input sizes and fits a growth curve."""

    def analyze(
        self,
        code: str,
        function_name: str,
        generator_name: str,
        sizes: list[int] | None = None,
    ) -> dict[str, Any]:
        sizes = self._validate_sizes(sizes)

        measurements: list[dict[str, int]] = []
        truncated = False
        for n in sizes:
            try:
                args = self._build_args(code, generator_name, n)
                steps = self._count_steps(code, function_name, args)
            except ExecutionEngineError:
                # A later size tripping a safety limit is expected for fast-
                # growing functions: keep the points collected so far.
                if measurements:
                    truncated = True
                    break
                raise
            measurements.append({"n": n, "steps": steps})

        if len(measurements) < 3:
            raise ExecutionEngineError(
                "Need at least 3 successful runs to fit a growth curve; "
                "try smaller sizes."
            )

        fits = self._fit(measurements)
        best = fits[0]
        return {
            "measurements": measurements,
            "truncated": truncated,
            "best_fit": best["complexity"],
            "r_squared": best["r_squared"],
            "coefficients": best["coefficients"],
            "fits": fits[:3],
        }

    # ------------------------------------------------------------------

    @staticmethod
    def _validate_sizes(sizes: list[int] | None) -> list[int]:
        if not sizes:
            return DEFAULT_SIZES
        if len(sizes) > MAX_SIZES:
            raise ExecutionEngineError(f"At most {MAX_SIZES} sizes are allowed.")
        if any(n < 1 or n > MAX_SIZE_VALUE for n in sizes):
            raise ExecutionEngineError(
                f"Sizes must be between 1 and {MAX_SIZE_VALUE}."
            )
        return sorted(set(sizes))

    def _build_args(self, code: str, generator_name: str, n: int) -> list[Any]:
        """Run the user's generator (untraced-for-counting) to build args."""
        engine = ExecutionEngine(
            CountingTraceManager(),
            max_steps=COUNTING_MAX_STEPS,
            max_seconds=COUNTING_MAX_SECONDS,
            capture_variables=False,
        )
        engine.run(code, generator_name, [n], {})
        result = engine.last_result
        # Convention: the generator returns the positional-arguments list.
        if isinstance(result, tuple):
            return list(result)
        if isinstance(result, list):
            return result
        return [result]

    def _count_steps(self, code: str, function_name: str, args: list[Any]) -> int:
        manager = CountingTraceManager()
        engine = ExecutionEngine(
            manager,
            max_steps=COUNTING_MAX_STEPS,
            max_seconds=COUNTING_MAX_SECONDS,
            capture_variables=False,
        )
        engine.run(code, function_name, args, {})
        return manager.count

    def _fit(self, measurements: list[dict[str, int]]) -> list[dict[str, Any]]:
        """Least-squares fit steps ≈ a·f(n) + b for each candidate model."""
        ns = [m["n"] for m in measurements]
        ys = [float(m["steps"]) for m in measurements]
        y_mean = sum(ys) / len(ys)
        ss_tot = sum((y - y_mean) ** 2 for y in ys)

        fits: list[dict[str, Any]] = []
        for label, fn in _MODELS:
            xs = [fn(n) for n in ns]
            if any(not math.isfinite(x) or x > 1e15 for x in xs):
                continue  # model explodes over this size range
            a, b = self._linreg(xs, ys)
            predictions = [a * x + b for x in xs]
            ss_res = sum((y - p) ** 2 for y, p in zip(ys, predictions))
            r_squared = 1.0 if ss_tot == 0 else max(0.0, 1 - ss_res / ss_tot)
            fits.append(
                {
                    "complexity": label,
                    "r_squared": round(r_squared, 6),
                    "coefficients": [a, b],
                }
            )

        # Highest R² wins; _MODELS order breaks near-ties (1e-6) in favor of
        # the simpler class, so constant data reports O(1), not O(n³).
        best_r2 = max(fit["r_squared"] for fit in fits)
        fits.sort(
            key=lambda fit: (
                fit["r_squared"] < best_r2 - 1e-6,
                _MODELS_INDEX[fit["complexity"]],
            )
        )
        return fits

    @staticmethod
    def _linreg(xs: list[float], ys: list[float]) -> tuple[float, float]:
        n = len(xs)
        x_mean = sum(xs) / n
        y_mean = sum(ys) / n
        var_x = sum((x - x_mean) ** 2 for x in xs)
        if var_x == 0:
            return 0.0, y_mean  # constant predictor (the O(1) model)
        slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / var_x
        return slope, y_mean - slope * x_mean


_MODELS_INDEX = {label: i for i, (label, _) in enumerate(_MODELS)}