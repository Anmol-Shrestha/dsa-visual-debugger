import type { TraceStep } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function runTrace(code: string): Promise<TraceStep[]> {
  return request<TraceStep[]>("/v1/debug/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
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
