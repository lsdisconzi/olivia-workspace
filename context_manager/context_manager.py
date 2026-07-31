"""Context Manager — main class (Phase 0, 1, 2, 3, 4, 5, 6).

Assembles prompts using:
- A lightweight, tool-exposing system prompt
- Auto-generated project summaries from live planning files
- Server-side RAG retrieval (Qdrant) for always-on context injection
- Smart conversation history truncation and de-duplication
- Panel content filtering (inject only when relevant)
- Version-stamped context snapshots for debugging

Usage
-----
    from context_manager import ContextManager

    cm = ContextManager(
        project_root="/path/to/olivia",
        session_id="sess_01",
    )
    prompt = cm.build_prompt("What phase are we in?")

    # With panel content
    prompt = cm.build_prompt(
        "Look at this output",
        panel_content="[Browser panel] File listing...",
        panel_name="browser",
    )
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .history_manager import deduplicate_user_quote, truncate_history
from .rag_integration import RagRetriever, format_retrieved_chunks
from .summary_generator import generate_summary

# Default path for the system prompt template
DEFAULT_SYS_PROMPT_PATH = Path(__file__).resolve().parent.parent / "context" / "sys_prompt.txt"

# Token budget for routine turns (in tokens, roughly 4 chars each)
DEFAULT_TOKEN_BUDGET = 1200  # tokens

# Directory for context snapshots
SNAPSHOTS_DIR = Path(__file__).resolve().parent.parent / "context_snapshots"


DEFAULT_PROJECT_ID = "olivia-memory-capture-agent"

RETRIEVAL_SCOPE_AUTO = "auto"
RETRIEVAL_SCOPE_ALL = "all"
RETRIEVAL_SCOPE_NONE = "none"

VALID_RETRIEVAL_SCOPES = {RETRIEVAL_SCOPE_AUTO, RETRIEVAL_SCOPE_ALL, RETRIEVAL_SCOPE_NONE}


class ContextManager:
    """Assembles prompts with layered context for Olivia agents.

    Parameters
    ----------
    project_root : str or Path
        Path to the Olivia workspace root.
    session_id : str
        Unique session identifier for this conversation.
    project_id : str, optional
        Project identifier used to resolve planning files directory.
        Defaults to ``"olivia-memory-capture-agent"``.
    agent_role : str, optional
        Role label injected into the system prompt (e.g. ``"Memory Capture Agent"``).
        Defaults to ``"Memory Capture Agent"``.
    phase_tag : str, optional
        Current phase tag for retrieval biasing and system prompt annotation
        (e.g. ``"Phase 7 — Orchestrator Integration"``).
    force_retrieval_scope : str, optional
        One of ``"auto"`` (default — heuristic based on query length),
        ``"all"`` (always force RAG), or ``"none"`` (never force RAG).
    sys_prompt_path : str or Path, optional
        Path to the system prompt template. Defaults to
        ``<workspace>/context/sys_prompt.txt``.
    rag_collection : str, optional
        Qdrant collection name for RAG retrieval. Defaults to
        ``"olivia-memory-capture-agent"``.
    token_budget : int, optional
        Maximum tokens for the assembled prompt (default 1200).
    enable_snapshots : bool, optional
        Whether to write context snapshots to disk (default True).
    """

    def __init__(
        self,
        project_root: str | Path,
        session_id: str,
        project_id: str | None = None,
        agent_role: str | None = None,
        phase_tag: str | None = None,
        force_retrieval_scope: str = RETRIEVAL_SCOPE_AUTO,
        sys_prompt_path: str | Path | None = None,
        rag_collection: str = "olivia-memory-capture-agent",
        rag_base_url: str | None = None,
        token_budget: int = DEFAULT_TOKEN_BUDGET,
        enable_snapshots: bool = True,
    ):
        self.project_root = Path(project_root).resolve()
        self.session_id = session_id
        self.project_id = project_id or DEFAULT_PROJECT_ID
        self.agent_role = agent_role or "Memory Capture Agent"
        self.phase_tag = phase_tag
        self.force_retrieval_scope = force_retrieval_scope if force_retrieval_scope in VALID_RETRIEVAL_SCOPES else RETRIEVAL_SCOPE_AUTO
        self.token_budget = token_budget
        self.enable_snapshots = enable_snapshots
        self._turn_counter: int = 0

        # Resolve system prompt path
        if sys_prompt_path:
            self.sys_prompt_path = Path(sys_prompt_path)
        else:
            self.sys_prompt_path = DEFAULT_SYS_PROMPT_PATH

        # Determine project directory for planning files
        self._project_dir = self._resolve_project_dir()

        # Initialise RAG retriever — wired to live Garage API
        self.retriever = RagRetriever(
            collection_name=rag_collection,
            base_url=rag_base_url,
        )

        # Validate paths
        if not self.sys_prompt_path.is_file():
            raise FileNotFoundError(
                f"System prompt template not found: {self.sys_prompt_path}\n"
                f"Create it at: {self.sys_prompt_path}"
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_effective_config(self) -> dict[str, Any]:
        """Return the effective configuration dict for this instance.

        Useful for diagnostics and snapshot metadata.
        """
        return {
            "project_root": str(self.project_root),
            "session_id": self.session_id,
            "project_id": self.project_id,
            "agent_role": self.agent_role,
            "phase_tag": self.phase_tag,
            "force_retrieval_scope": self.force_retrieval_scope,
            "rag_collection": self.retriever.collection_name,
            "rag_base_url": self.retriever.base_url,
            "token_budget": self.token_budget,
            "enable_snapshots": self.enable_snapshots,
            "project_dir": str(self._project_dir),
            "sys_prompt_path": str(self.sys_prompt_path),
        }

    def build_prompt(
        self,
        user_message: str,
        phase_hint: Optional[str] = None,
        panel_content: Optional[str] = None,
        panel_name: Optional[str] = None,
        force_retrieval: Optional[bool] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> list[dict[str, str]]:
        """Assemble the full prompt for the LLM.

        Steps:
        1. Build system message with auto-generated project summary,
           agent role, and optional phase context.
        2. Run server-side RAG retrieval (always-on default path).
        3. Filter and inject panel content if relevant.
        4. Truncate conversation history.
        5. De-duplicate user quote (fuzzy-match against last assistant reply).
        6. Assemble into message list.
        7. Log version-stamped context snapshot.
        8. Check token budget (warn if over).

        Parameters
        ----------
        user_message : str
            The user's current input.
        phase_hint : str, optional
            Per-call phase tag override.  Falls back to instance-level
            ``phase_tag`` if not provided.  Prepended to the RAG query to
            bias retrieval toward the active phase.
        panel_content : str, optional
            Content from a UI panel (e.g., browser preview).
        panel_name : str, optional
            Name of the panel (e.g., "browser", "preview").
        force_retrieval : bool, optional
            Override the instance-level ``force_retrieval_scope``:
            - ``True`` forces RAG regardless of query length
            - ``False`` skips RAG
            - ``None`` (default) defers to instance-level scope
        history : list[dict], optional
            Previous conversation turns as list of {'role', 'content'}.

        Returns
        -------
        list[dict]
            Messages list ready for the LLM API.
        """
        self._turn_counter += 1
        history = history or []

        # Resolve effective phase hint
        effective_phase = phase_hint or self.phase_tag

        # 1. Build system message with project summary, role, phase context
        project_summary = generate_summary(self._project_dir)
        phase_context = (
            f"Active phase: {effective_phase}"
            if effective_phase
            else ""
        )
        system_msg = self._load_system_template().format(
            agent_role=self.agent_role,
            project_summary=project_summary,
            phase_context=phase_context,
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_msg},
        ]

        # 2. RAG retrieval — determine whether to search
        should_retrieve = self._resolve_retrieval_flag(force_retrieval, user_message)
        if should_retrieve:
            # Bias query with phase tag if available
            rag_query = (
                f"[{effective_phase}] {user_message}"
                if effective_phase
                else user_message
            )
            retrieved = self.retriever.search(rag_query)
            rag_block = format_retrieved_chunks(retrieved)
            if rag_block:
                messages.append({"role": "system", "content": rag_block})

        # 3. Conversation history — truncate and de-duplicate
        truncated = truncate_history(history)
        user_message = deduplicate_user_quote(truncated, user_message)

        # Add history after system messages, before the new user message
        for msg in truncated:
            # Skip adding system messages from history (they're regenerated)
            if msg.get("role") != "system":
                messages.append(msg)

        # 4. Panel content — inject as user-like message if relevant
        if panel_content and panel_name:
            # Only inject if panel has actual content
            panel_text = panel_content.strip()
            if panel_text and len(panel_text) > 20:
                messages.append({
                    "role": "user",
                    "content": f"[Panel: {panel_name}]\n{panel_text}",
                })

        # 5. Add the current user message
        messages.append({"role": "user", "content": user_message})

        # 6. Log context snapshot
        if self.enable_snapshots:
            self._snapshot_context(messages)

        # 7. Token budget check
        self._check_token_budget(messages)

        return messages

    def update_project_summary(self, new_decisions: Optional[dict[str, Any]] = None) -> str:
        """Regenerate the project summary after important turns.

        This is a lightweight trigger that re-runs summary extraction.
        In the future, it could also trigger Qdrant re-indexing of changed files.

        Parameters
        ----------
        new_decisions : dict, optional
            Any new decisions to note (currently a placeholder).

        Returns
        -------
        str
            The freshly generated project summary.
        """
        summary = generate_summary(self._project_dir)
        return summary

    def index_planning_files(self) -> dict[str, Any]:
        """One-time job to ensure all planning files are in Qdrant.

        Returns
        -------
        dict
            Summary of indexed files.
        """
        return self.retriever.index_planning_files(self._project_dir)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_project_dir(self) -> Path:
        """Determine the project directory for planning files.

        Resolution order:
        1. ``uploads/projects/{project_id}/``  (primary)
        2. ``uploads/projects/{session_id}/``  (fallback)
        3. ``project_root``                    (last resort)
        """
        # 1. Try project_id (primary key for Phase 7)
        id_path = (
            self.project_root / "uploads" / "projects" / self.project_id
        )
        if id_path.is_dir():
            return id_path

        # 2. Try session_id as project name
        session_project = (
            self.project_root / "uploads" / "projects" / self.session_id
        )
        if session_project.is_dir():
            return session_project

        return self.project_root

    def _resolve_retrieval_flag(
        self,
        force_override: Optional[bool],
        user_message: str,
    ) -> bool:
        """Determine whether RAG retrieval should run.

        Priority:
        1. Explicit ``force_override`` (True/False) wins.
        2. Instance-level ``force_retrieval_scope``:
           - ``"all"`` → always retrieve
           - ``"none"`` → never retrieve
           - ``"auto"`` → retrieve only if query > 10 chars
        """
        if force_override is not None:
            return force_override

        if self.force_retrieval_scope == RETRIEVAL_SCOPE_ALL:
            return True
        if self.force_retrieval_scope == RETRIEVAL_SCOPE_NONE:
            return False

        # Auto: heuristic based on query length
        return len(user_message.strip()) > 10

    def _load_system_template(self) -> str:
        """Read the system prompt template from disk."""
        return self.sys_prompt_path.read_text(encoding="utf-8")

    def _snapshot_context(self, messages: list[dict[str, str]]) -> None:
        """Write the assembled prompt to a snapshot file for debugging.

        Writes to: context_snapshots/<session_id>/<turn_id>.json
        """
        snapshot_dir = SNAPSHOTS_DIR / self.session_id
        snapshot_dir.mkdir(parents=True, exist_ok=True)

        snapshot = {
            "session_id": self.session_id,
            "turn_id": self._turn_counter,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "token_budget": self.token_budget,
            "message_count": len(messages),
            "roles": [m.get("role") for m in messages],
            "messages": messages,
        }

        snapshot_path = snapshot_dir / f"turn_{self._turn_counter:04d}.json"
        snapshot_path.write_text(
            json.dumps(snapshot, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _check_token_budget(self, messages: list[dict[str, str]]) -> None:
        """Rough token count check — warns if over budget.

        Uses 1 token ≈ 4 characters approximation.
        """
        total_chars = sum(len(m.get("content", "")) for m in messages)
        estimated_tokens = total_chars // 4

        # Only warn, don't block — the LLM API will handle hard limits
        if estimated_tokens > self.token_budget:
            print(
                f"[ContextManager] ⚠ Token budget warning: "
                f"~{estimated_tokens} tokens estimated "
                f"(budget: {self.token_budget}). "
                f"Consider increasing token_budget or trimming context."
            )
