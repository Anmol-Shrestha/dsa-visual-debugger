import type { ComplexityResult, TraceStep } from "./types";

interface TraceRequest {
  code: string;
  function_name: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function runTrace(payload: TraceRequest): Promise<TraceStep[]> {
  return request<TraceStep[]>("/v1/debug/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function analyzeComplexity(payload: {
  code: string;
  function_name: string;
  generator_name?: string;
}): Promise<ComplexityResult> {
  return request<ComplexityResult>("/v1/debug/complexity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function saveToServer(
  filename: string,
  code: string,
): Promise<{ snippet_id: string; location: string }> {
  return request("/v1/code/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, code }),
  });
}
