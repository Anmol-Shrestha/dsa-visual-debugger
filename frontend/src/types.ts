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
