export interface StepInfo {
  id: "problem" | "metrics" | "logic" | "compare" | "adjust";
  n: string;
  title: string;
  short: string;
  body: string;
  practice: string[];
}

export const STEPS: StepInfo[] = [
  {
    id: "problem",
    n: "01",
    title: "Problem",
    short: "Say what you need, in user terms.",
    body:
      "Write the problem in one or two sentences, in terms of what the user or system needs, not how to build it. A good problem statement already hints at what to measure.",
    practice: [
      "Weak: “Write a binary search tree.”",
      "Stronger: “Check quickly whether an ID exists in a large, mostly static sorted list, on every request.”",
    ],
  },
  {
    id: "metrics",
    n: "02",
    title: "Metrics & Goal",
    short: "Pick the number that matters. Set the bar before building.",
    body:
      "A metric is a number that says how well the solution solves the problem. A goal is the threshold it must reach. Keep one primary metric and at most two supporting ones.",
    practice: [
      "Set the goal before the solution exists, or it drifts toward whatever you already achieved.",
      "Metrics must be observable. If you cannot measure it, you are guessing.",
    ],
  },
  {
    id: "logic",
    n: "03",
    title: "Develop Logic",
    short: "Build a first honest version. It exists to produce a measurement.",
    body:
      "Build the simplest solution that runs. Name its components explicitly: data structure, algorithm, threshold, feature set, batch size, cache policy. Step five depends on being able to point at one of them.",
    practice: ["The first version is a measuring instrument, not the final product."],
  },
  {
    id: "compare",
    n: "04",
    title: "Compare",
    short: "Measure it against the goal. Write the result down.",
    body:
      "Three outcomes are possible: the goal is met, the gap is small and tuning will likely close it, or the gap is large and a component choice is probably wrong.",
    practice: ["Record the date, the version of the logic, and the result. Memory is not a log."],
  },
  {
    id: "adjust",
    n: "05",
    title: "Adjust & Retry",
    short: "Find the responsible component. Change one. Loop.",
    body:
      "Ask which component is responsible for the gap, change one at a time, measure again against the same goal, and stop when the goal is met, or when nothing worth trying is left.",
    practice: [
      "Change one component at a time, or you will not know which change helped.",
      "Never move the goal to match the result.",
    ],
  },
];

export interface MetricExample {
  problem: string;
  metric: string;
  goal: string;
  support: string;
  /** Illustrative position of a first attempt, 0–1. Not measured data. */
  fraction: number;
}

export const METRIC_EXAMPLES: MetricExample[] = [
  {
    problem: "Find an ID in a sorted list",
    metric: "Average lookup time",
    goal: "< 1 µs for 1M IDs",
    support: "Memory overhead",
    fraction: 0.22,
  },
  {
    problem: "Compute a cart total with discounts",
    metric: "Correct totals on test cases",
    goal: "100% of cases",
    support: "Lines of logic",
    fraction: 0.64,
  },
  {
    problem: "Classify support tickets",
    metric: "F1 score on held-out set",
    goal: "≥ 0.85",
    support: "Inference latency",
    fraction: 0.71,
  },
];
