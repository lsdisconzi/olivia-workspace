"""RAG integration layer for the Context Manager (Phase 3).

Provides two-tier retrieval:
1. **Default path (always-on):** Server-side Qdrant search via Garage API.
2. **Fallback (explicit tool):** Abstract tool descriptions mapped to MCP tools.

The default path runs automatically on every build_prompt() call, injecting
the top-K relevant chunks as a supplementary system message.

Garage API connectivity
-----------------------
The retriever calls the Garage API at ``GARAGE_BASE_URL`` (default
http://127.0.0.1:8066) via POST /v1/qdrant/search.  If the API is
unreachable, the search degrades gracefully to an empty result set.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional


# Default Garage API URL (same as mcp-servers.registry.json)
DEFAULT_GARAGE_BASE_URL = "http://127.0.0.1:8066"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _garage_search(
    collection_name: str,
    query_text: str,
    *,
    limit: int = 3,
    min_score: float = 0.2,
    base_url: str = DEFAULT_GARAGE_BASE_URL,
) -> list[dict[str, Any]]:
    """Call the Garage Qdrant search API via synchronous HTTP POST.

    Parameters
    ----------
    collection_name : str
        Qdrant collection to search.
    query_text : str
        Natural-language query.
    limit : int
        Maximum number of results (default 3).
    min_score : float
        Minimum similarity threshold (default 0.2).
    base_url : str
        Garage API base URL.

    Returns
    -------
    list[dict]
        Raw results from the API, each a dict with ``id``, ``score``,
        ``payload`` keys.  Returns an empty list on any error (graceful
        degradation — the prompt assembly should never crash due to a
        downed retrieval backend).
    """
    url = f"{base_url.rstrip('/')}/v1/qdrant/search"
    body = {
        "collection_name": collection_name,
        "query_text": query_text,
        "limit": limit,
        "min_score": min_score,
    }

    try:
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            response_data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError,
            json.JSONDecodeError, OSError, TimeoutError) as exc:
        print(f"[RagRetriever] ⚠ Garage API search failed: {exc}")
        return []

    # The Garage API returns the result directly (no "result" wrapper):
    #   { "status": "success", "count": 1, "results": [...] }
    # The MCP server wraps it in { "result": {...} }, but we call the raw API.
    if not isinstance(response_data, dict):
        return []
    if response_data.get("status") != "success":
        return []

    raw_results = response_data.get("results", [])
    return raw_results if isinstance(raw_results, list) else []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def format_retrieved_chunks(chunks: list[dict[str, Any]]) -> str:
    """Format retrieved chunks into a compact context block.

    Parameters
    ----------
    chunks : list[dict]
        Each chunk should have keys: 'text' (str), 'source' (str, optional),
        'score' (float, optional).

    Returns
    -------
    str
        Formatted context block like::

            [Retrieved from Olivia docs]
            task_plan.md (score: 0.796): "## Current Phase..."
            memory.md (score: 0.520): "## Decisions..."
    """
    if not chunks:
        return ""

    lines: list[str] = ["[Retrieved from Olivia docs]"]
    for i, chunk in enumerate(chunks):
        text = chunk.get("text", "").strip()
        if not text:
            continue

        source = chunk.get("source", f"chunk #{i + 1}")
        score = chunk.get("score")
        score_str = f" (score: {score:.3f})" if score is not None else ""

        # Truncate very long chunks
        if len(text) > 300:
            text = text[:297] + "..."

        lines.append(f"{source}{score_str}: {text}")

    return "\n".join(lines)


class RagRetriever:
    """Handles Qdrant retrieval for the Context Manager.

    Calls the Garage API HTTP endpoint (``POST /v1/qdrant/search``) to
    perform semantic search over the configured collection.  Designed for
    synchronous use inside ``ContextManager.build_prompt()``.

    Parameters
    ----------
    collection_name : str
        Qdrant collection to search (e.g. ``"olivia-memory-capture-agent"``).
    top_k : int
        Number of chunks to retrieve (default 3).
    min_score : float
        Minimum cosine-similarity score threshold (default 0.2).
    base_url : str, optional
        Garage API base URL.  Falls back to the ``GARAGE_BASE_URL`` env
        variable, then ``http://127.0.0.1:8066``.
    """

    def __init__(
        self,
        collection_name: str = "olivia-memory-capture-agent",
        top_k: int = 3,
        min_score: float = 0.2,
        base_url: Optional[str] = None,
    ):
        self.collection_name = collection_name
        self.top_k = top_k
        self.min_score = min_score
        self.base_url = base_url or os.getenv(
            "GARAGE_BASE_URL", DEFAULT_GARAGE_BASE_URL
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(self, query: str) -> list[dict[str, Any]]:
        """Search Qdrant via the Garage API.

        Parameters
        ----------
        query : str
            The user's natural-language query.

        Returns
        -------
        list[dict]
            Retrieved chunks normalised to ``{'text', 'source', 'score'}``.
        """
        raw_results = _garage_search(
            collection_name=self.collection_name,
            query_text=query,
            limit=self.top_k,
            min_score=self.min_score,
            base_url=self.base_url,
        )
        return self._parse_results(raw_results)

    def index_planning_files(self, project_dir: Path) -> dict[str, Any]:
        """Report which planning files are ready for indexing.

        .. note::

            Actual ingestion into Qdrant should be performed at the
            orchestrator level using the ``qdrant_ingest_file`` MCP tool,
            which handles multipart upload to the Garage API.  This method
            scans the project directory and returns a report of what would
            be indexed.

        Parameters
        ----------
        project_dir : Path
            Path to the project directory containing planning files.

        Returns
        -------
        dict
            ``{collection, indexed_count, indexed_files, error_count, errors,
            note}``
        """
        planning_files = [
            "task_plan.md",
            "memory.md",
            "findings.md",
            "progress.md",
        ]

        found: list[str] = []
        missing: list[str] = []

        for filename in planning_files:
            filepath = project_dir / filename
            if filepath.is_file():
                found.append(filename)
            else:
                missing.append(filename)

        return {
            "collection": self.collection_name,
            "indexed_count": len(found),
            "indexed_files": found,
            "error_count": len(missing),
            "errors": [f"{f}: file not found" for f in missing],
            "note": (
                "Use orchestrator-level MCP tool qdrant_ingest_file to "
                "perform actual Qdrant ingestion."
            ),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_results(self, raw_results: list) -> list[dict[str, Any]]:
        """Parse raw Qdrant results into standardised chunk dicts.

        Expected raw shape (from Garage API ``/v1/qdrant/search``)::

            {
                "score": 0.796,
                "payload": {
                    "text": "chunk text here",
                    "metadata": {"file_path": "task_plan.md"},
                    "file_path": "task_plan.md",       # optional fallback
                }
            }
        """
        chunks: list[dict[str, Any]] = []

        if not raw_results or not isinstance(raw_results, list):
            return chunks

        for item in raw_results:
            if not isinstance(item, dict):
                continue

            payload = item.get("payload", {})
            if not isinstance(payload, dict):
                payload = {}

            metadata = payload.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}

            text = (payload.get("text") or "").strip()
            source = (
                metadata.get("file_path")
                or payload.get("file_path")
                or "unknown"
            )
            score = item.get("score", 0.0)

            if text:
                chunks.append({
                    "text": text,
                    "source": source,
                    "score": score,
                })

        return chunks
