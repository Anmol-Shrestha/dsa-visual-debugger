/** JSON-safe value shapes produced by the backend serializer (ADR-002). */
export type SerializedValue =
  | null
  | boolean
  | number
  | string
  | SerializedValue[]
  | SerializedObject;

export interface SerializedObject {
  [key: string]: SerializedValue;
}

/** One entry of the execution timeline returned by POST /v1/debug/trace. */
export interface TraceStep {
  step: number;
  line_number: number;
  frame_name: string;
  local_variables: Record<string, SerializedValue>;
}

/** Result of POST /v1/debug/complexity (empirical Big-O analysis). */
export interface ComplexityFit {
  complexity: string;
  r_squared: number;
  coefficients: [number, number];
}

export interface ComplexityResult {
  measurements: { n: number; steps: number }[];
  truncated: boolean;
  best_fit: string;
  r_squared: number;
  coefficients: [number, number];
  fits: ComplexityFit[];
}

/** One user-code frame in a failed run's stack trace (outermost first). */
export interface StackFrameInfo {
  frame_name: string;
  line_number: number;
  /** 0-based, end-exclusive columns of the failing expression (null if unknown). */
  col_start: number | null;
  col_end: number | null;
}

/** Structured failure detail returned by POST /v1/debug/trace (HTTP 400). */
export interface RunErrorInfo {
  message: string;
  error_type: string | null;
  line_number: number | null;
  stack: StackFrameInfo[];
}
