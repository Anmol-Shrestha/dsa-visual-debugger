"""Local file-system implementation of the CodeRepository contract."""

import re
from pathlib import Path

from adapters.repository import CodeRepository, SnippetNotFoundError


class LocalFileSystemAdapter(CodeRepository):
    """Stores snippets as .py files inside a configured directory."""

    def __init__(self, storage_dir: Path) -> None:
        self._storage_dir = Path(storage_dir)
        self._storage_dir.mkdir(parents=True, exist_ok=True)

    def save(self, snippet_id: str, code: str) -> str:
        path = self._path_for(snippet_id)
        path.write_text(code, encoding="utf-8")
        return str(path)

    def retrieve(self, snippet_id: str) -> str:
        path = self._path_for(snippet_id)
        if not path.exists():
            raise SnippetNotFoundError(snippet_id)
        return path.read_text(encoding="utf-8")

    def _path_for(self, snippet_id: str) -> Path:
        # Whitelist filename characters — blocks path traversal by construction.
        safe = re.sub(r"[^A-Za-z0-9_-]", "_", snippet_id) or "snippet"
        return self._storage_dir / f"{safe}.py"
