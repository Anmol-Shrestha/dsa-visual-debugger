/**
 * Browser-side project files shown in the explorer. Each file is one Python
 * snippet; the active one is what the editor shows and what runs.
 * Stored per-viewer in localStorage (a convenience, not shared state).
 */

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
}

const FILES_KEY = "dsa-debugger.files";
const ACTIVE_KEY = "dsa-debugger.activeFile";

export function newFileId(): string {
  return crypto.randomUUID();
}

export function loadFiles(seedContent: string): ProjectFile[] {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as ProjectFile[];
    }
  } catch {
    /* corrupted storage — fall back to a fresh file below */
  }
  return [{ id: newFileId(), name: "snippet.py", content: seedContent }];
}

export function saveFiles(files: ProjectFile[]): void {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch {
    /* storage full or blocked — the editor keeps working in memory */
  }
}

export function loadActiveFileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveFileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}
