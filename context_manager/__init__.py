"""Context Manager — layered, retrieval-augmented context assembly for Olivia agents.

Exports
-------
ContextManager          : Main class for building prompts with RAG, summary
                          injection, history management, and context snapshots.
RagRetriever            : Qdrant retrieval wrapper (usage via CM recommended).
format_retrieved_chunks : Format raw Qdrant results into context blocks.
RETRIEVAL_SCOPE_AUTO    : Heuristic-based retrieval (query > 10 chars).
RETRIEVAL_SCOPE_ALL     : Always force RAG retrieval.
RETRIEVAL_SCOPE_NONE    : Never force RAG retrieval.
VALID_RETRIEVAL_SCOPES  : Set of all valid scope values.

Usage
-----
    from context_manager import ContextManager

    cm = ContextManager(project_root="/path/to/olivia", session_id="sess_01")
    prompt = cm.build_prompt("What is the current phase?")

    # With Phase 7 orchestration parameters:
    cm = ContextManager(
        project_root="/path/to/olivia",
        session_id="sess_01",
        project_id="my-project",
        agent_role="Legal Analyst",
        phase_tag="Phase 2 — Document Review",
        force_retrieval_scope="auto",
    )
"""

from __future__ import annotations

from .context_manager import (
    ContextManager,
    RETRIEVAL_SCOPE_ALL,
    RETRIEVAL_SCOPE_AUTO,
    RETRIEVAL_SCOPE_NONE,
    VALID_RETRIEVAL_SCOPES,
)
from .rag_integration import RagRetriever, format_retrieved_chunks

__all__ = [
    "ContextManager",
    "RagRetriever",
    "format_retrieved_chunks",
    "RETRIEVAL_SCOPE_AUTO",
    "RETRIEVAL_SCOPE_ALL",
    "RETRIEVAL_SCOPE_NONE",
    "VALID_RETRIEVAL_SCOPES",
]
