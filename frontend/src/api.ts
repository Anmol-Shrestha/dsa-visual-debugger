import type { RunErrorInfo, TraceStep } from "./types";

/** A failed trace run, carrying line numbers and the stack for the UI. */
export class RunError extends Error {
  info: RunErrorInfo;

  constructor(info: RunErrorInfo) {
    super(info.message);
    this.name = "RunError";
    this.info = info;
  }
}

/**
 * Backend origin. Empty in local dev (the Vite proxy forwards /v1); set
 * VITE_API_BASE at build time for a separately hosted backend, e.g.
 * https://dsa-debugger-api.onrender.com
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    // Trace failures arrive as a structured object; other errors as a string.
    if (detail && typeof detail === "object" && "message" in detail) {
      throw new RunError(detail as RunErrorInfo);
    }
    throw new Error(
      typeof detail === "string" ? detail : `Request failed with status ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

/** One health check with a short timeout. True only if the server answered. */
async function pingBackend(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/v1/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Polls until the backend answers. Free hosts sleep when idle and can take
 * 30–60 s to wake, so this reports progress via onWaiting while it retries.
 */
export async function waitForBackend({
  onWaiting,
  maxWaitMs = 120_000,
}: {
  onWaiting?: (elapsedSeconds: number) => void;
  maxWaitMs?: number;
}): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await pingBackend()) return true;
    onWaiting?.(Math.round((Date.now() - start) / 1000));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
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
