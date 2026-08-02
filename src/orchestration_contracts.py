#!/usr/bin/env python3
"""Shared orchestration contracts and validation helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Phase 7 — Context Manager for orchestrator prompt assembly
try:
    from context_manager import ContextManager
except ImportError:
    # Allow the module to be imported without context_manager during
    # contract validation (ContextManager is only needed for build_agent_prompt)
    ContextManager = None  # type: ignore



CORE_GROUPS = ("olivia", "legal", "government")
BROADCAST_TARGET_ALIASES = {"all specialists", "all-specialists", "all_specialists", "*"}

META_ROUTE_REQUEST_SCHEMA: dict[str, Any] = {
    "$id": "orchestration.meta_route.request.v1",
    "type": "object",
    "required": ["message"],
    "properties": {
        "message": {"type": "string", "minLength": 1, "maxLength": 32000},
        "session_id": {"type": "string", "minLength": 1, "maxLength": 256},
        "trace_id": {"type": "string", "minLength": 1, "maxLength": 256},
        "agent_id": {"type": "string", "minLength": 1, "maxLength": 128},
        "active_user": {"type": "string", "minLength": 1, "maxLength": 256},
        "metadata": {"type": "object"},
    },
    "additionalProperties": True,
}

META_ROUTE_RESPONSE_SCHEMA: dict[str, Any] = {
    "$id": "orchestration.meta_route.response.v1",
    "type": "object",
    "required": ["ok"],
    "properties": {
        "ok": {"type": "boolean"},
        "selected_group": {"type": "string"},
        "selected_agent": {"type": "string"},
        "decision": {"type": "object"},
        "reasoning": {"type": "string"},
        "fallback": {
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "reason": {"type": "string"},
                "target": {"type": "string"},
            },
            "additionalProperties": True,
        },
        "error": {"type": "string"},
        "trace_id": {"type": "string"},
        "session_id": {"type": "string"},
    },
    "additionalProperties": True,
}

SESSION_CONTINUITY_SCHEMA: dict[str, Any] = {
    "$id": "orchestration.session_continuity.v1",
    "type": "object",
    "required": ["session_id", "trace_id"],
    "properties": {
        "session_id": {"type": "string", "minLength": 1, "maxLength": 256},
        "trace_id": {"type": "string", "minLength": 1, "maxLength": 256},
        "parent_trace_id": {"type": "string", "minLength": 1, "maxLength": 256},
        "handoff_chain": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["from", "to", "at"],
                "properties": {
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "at": {"type": "string"},
                },
                "additionalProperties": True,
            },
        },
    },
    "additionalProperties": True,
}

ERROR_TAXONOMY = {
    "orchestrator_unreachable",
    "orchestrator_http",
    "tool_not_allowed",
    "route_not_found",
    "group_unavailable",
    "memory_profile_not_found",
    "validation_error",
}


def _read_json(path: Path) -> dict[str, Any]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {}


def _project_contract_paths(project_root: Path) -> dict[str, Path]:
    root = project_root.resolve()
    return {
        "groups_index": root / "agents" / "agents-groups" / "_meta" / "groups.index.json",
        "tool_permissions": root / "agents" / "generated" / "policies" / "tool-permissions.by-agent.json",
        "handoff_routes": root / "agents" / "generated" / "policies" / "handoff-routes.json",
        "memory_assignments": root / "agents" / "generated" / "memory-group-assignments.json",
    }


def validate_meta_route_request(payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        errors.append("payload must be an object")
        return {"ok": False, "errors": errors}

    message = str(payload.get("message") or "").strip()
    if not message:
        errors.append("message is required")

    for key in ("session_id", "trace_id", "agent_id", "active_user"):
        if key in payload and not isinstance(payload.get(key), str):
            errors.append(f"{key} must be a string when present")

    return {"ok": not errors, "errors": errors}


def validate_meta_route_response(payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        errors.append("response must be an object")
        return {"ok": False, "errors": errors}

    if "ok" not in payload:
        errors.append("ok is required")
    elif not isinstance(payload.get("ok"), bool):
        errors.append("ok must be boolean")

    if payload.get("error") and str(payload.get("error")) not in ERROR_TAXONOMY:
        errors.append("error must be part of declared error taxonomy")

    if payload.get("fallback") is not None and not isinstance(payload.get("fallback"), dict):
        errors.append("fallback must be an object")

    return {"ok": not errors, "errors": errors}


def _validate_policy_coverage(
    tool_permissions: dict[str, Any],
    handoff_routes: dict[str, Any],
    meta_agent_slugs: set[str] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    agents = tool_permissions.get("agents") if isinstance(tool_permissions, dict) else {}
    if not isinstance(agents, dict):
        agents = {}

    routes = handoff_routes.get("routing") if isinstance(handoff_routes, dict) else []
    if not isinstance(routes, list):
        routes = []

    known_agents = set(str(name) for name in agents.keys())
    # Known cross-group targets are derived from the registry (single source of
    # truth: groups.index.json -> meta_orchestrator.slug). Fallback keeps the
    # historical literal when the registry block is absent.
    known_agents.update(meta_agent_slugs or {"meta-orchestrator"})
    route_participants: set[str] = set()

    for route in routes:
        if not isinstance(route, dict):
            continue
        source = str(route.get("from") or "").strip()
        target = str(route.get("to") or "").strip()
        route_id = str(route.get("route_id") or "unknown-route")
        if source:
            route_participants.add(source)
        if target:
            route_participants.add(target)

        if source and source not in known_agents:
            errors.append(f"route {route_id}: unknown source agent '{source}'")
        if target and target not in known_agents and target.lower() not in BROADCAST_TARGET_ALIASES:
            errors.append(f"route {route_id}: unknown target agent '{target}'")

    orphan_agents = sorted(name for name in agents.keys() if name not in route_participants)
    if orphan_agents:
        warnings.append("Agents without handoff route participation: " + ", ".join(orphan_agents[:20]))

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "agent_count": len(agents),
        "route_count": len(routes),
    }


def _validate_memory_assignments(groups_index: dict[str, Any], memory_assignments: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    groups = groups_index.get("groups") if isinstance(groups_index, dict) else []
    if not isinstance(groups, list):
        groups = []

    group_names = [str(item.get("group") or "").strip() for item in groups if isinstance(item, dict)]
    group_names = [g for g in group_names if g]

    assigned = memory_assignments.get("groups") if isinstance(memory_assignments, dict) else {}
    if not isinstance(assigned, dict):
        assigned = {}

    for core in CORE_GROUPS:
        if core not in assigned:
            errors.append(f"missing memory assignment for core group '{core}'")

    for name in group_names:
        if name not in assigned:
            warnings.append(f"group '{name}' exists in groups.index but has no memory assignment")

    for name, cfg in assigned.items():
        if not isinstance(cfg, dict):
            errors.append(f"memory assignment for group '{name}' must be an object")
            continue
        for key in ("qdrant_collections", "neo4j_labels", "neo4j_databases"):
            value = cfg.get(key)
            if value is not None and not isinstance(value, list):
                errors.append(f"memory assignment {name}.{key} must be an array when present")

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "indexed_groups": group_names,
        "assigned_group_count": len(assigned),
    }


def build_orchestration_contract_report(project_root: Path) -> dict[str, Any]:
    paths = _project_contract_paths(project_root)
    missing = [name for name, path in paths.items() if not path.is_file()]

    if missing:
        return {
            "ok": False,
            "error": "missing_contract_sources",
            "missing": missing,
            "paths": {k: str(v) for k, v in paths.items()},
        }

    groups_index = _read_json(paths["groups_index"])
    tool_permissions = _read_json(paths["tool_permissions"])
    handoff_routes = _read_json(paths["handoff_routes"])
    memory_assignments = _read_json(paths["memory_assignments"])

    # Derive the meta-orchestrator known-agent from the registry so it stays the
    # single source of truth (P1.7). Empty set falls back to the historical
    # literal inside _validate_policy_coverage.
    meta_block = groups_index.get("meta_orchestrator") if isinstance(groups_index, dict) else None
    meta_agent_slugs: set[str] = set()
    if isinstance(meta_block, dict):
        slug = str(meta_block.get("slug") or "").strip()
        if slug:
            meta_agent_slugs.add(slug)

    policy = _validate_policy_coverage(tool_permissions, handoff_routes, meta_agent_slugs)
    memory = _validate_memory_assignments(groups_index, memory_assignments)

    ok = bool(policy.get("ok")) and bool(memory.get("ok"))
    return {
        "ok": ok,
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "policy_coverage": policy,
        "memory_assignments": memory,
        "paths": {k: str(v) for k, v in paths.items()},
    }


def build_orchestration_contract_bundle(project_root: Path) -> dict[str, Any]:
    report = build_orchestration_contract_report(project_root)
    return {
        "ok": report.get("ok", False),
        "version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schemas": {
            "meta_route_request": META_ROUTE_REQUEST_SCHEMA,
            "meta_route_response": META_ROUTE_RESPONSE_SCHEMA,
            "session_continuity": SESSION_CONTINUITY_SCHEMA,
        },
        "error_taxonomy": sorted(ERROR_TAXONOMY),
        "validation": report,
    }


# ---------------------------------------------------------------------------
# Phase 7 — Orchestrator Integration: build_agent_prompt
# ---------------------------------------------------------------------------


def build_agent_prompt(
    project_root: str | Path,
    session_id: str,
    user_message: str,
    project_id: str | None = None,
    agent_role: str | None = None,
    phase_tag: str | None = None,
    panel_content: str | None = None,
    panel_name: str | None = None,
    planning_context: str | None = None,
    history: list[dict[str, str]] | None = None,
    force_retrieval: bool | None = None,
    rag_collection: str = "olivia_ecosystem",
    token_budget: int = 1200,
    enable_snapshots: bool = True,
    sys_prompt_path: str | Path | None = None,
) -> dict[str, Any]:
    """Build an assembled prompt for an orchestrator-managed agent.

    This is the primary entry point for the orchestrator to get a fully
    assembled, RAG-augmented prompt for any agent.  It creates an isolated
    ``ContextManager`` instance, builds the prompt, and returns both the
    messages and detailed metadata (token count, character count, config,
    snapshot path, etc.).

    Parameters
    ----------
    project_root : str or Path
        Path to the Olivia workspace root.
    session_id : str
        Unique session identifier for this conversation.
    user_message : str
        The user's current input.
    project_id : str, optional
        Project identifier.  Defaults to ``"olivia-memory-capture-agent"``.
    agent_role : str, optional
        Role label for the agent (e.g. ``"Memory Capture Agent"``).
    phase_tag : str, optional
        Current phase tag for retrieval biasing.
    panel_content : str, optional
        Content from a UI panel.
    panel_name : str, optional
        Panel name for annotation.
    planning_context : str, optional
        Pre-collected planning context (task plans, findings, etc.) to inject.
    history : list[dict], optional
        Previous conversation turns.
    force_retrieval : bool, optional
        Override automatic retrieval decision.
    rag_collection : str
        Qdrant collection for RAG retrieval.
    token_budget : int
        Maximum estimated tokens for the prompt.
    enable_snapshots : bool
        Whether to write context snapshots to disk.
    sys_prompt_path : str or Path, optional
        Path to a custom system prompt template file.  If not provided,
        defaults to ``<workspace>/context/sys_prompt.txt``.

    Returns
    -------
    dict
        ``{
            "ok": True,
            "messages": [...],          # Assembled LLM messages
            "config": {...},            # Effective ContextManager config
            "token_estimate": int,      # Estimated token count
            "char_count": int,          # Total character count
            "message_count": int,       # Number of messages
            "snapshot_path": str,       # Path to snapshot file
            "project_summary": str,     # Auto-generated summary
        }``
    """
    cm = ContextManager(
        project_root=project_root,
        session_id=session_id,
        project_id=project_id,
        agent_role=agent_role,
        phase_tag=phase_tag,
        token_budget=token_budget,
        enable_snapshots=enable_snapshots,
        rag_collection=rag_collection,
        sys_prompt_path=sys_prompt_path,
    )

    messages = cm.build_prompt(
        user_message=user_message,
        phase_hint=phase_tag,
        panel_content=panel_content,
        panel_name=panel_name,
        planning_context=planning_context,
        force_retrieval=force_retrieval,
        history=history,
    )

    # Compute metadata
    total_chars = sum(len(m.get("content", "")) for m in messages)
    total_tokens = total_chars // 4

    # Build the project summary separately for the return payload
    project_summary = ""
    for m in messages:
        if m.get("role") == "system" and "[Phase]" in m.get("content", ""):
            # Extract the summary line from the first system message
            for line in m["content"].splitlines():
                if line.startswith("[Phase]") or line.startswith("[Decisions]"):
                    project_summary += line + "\n"
            break

    config = cm.get_effective_config()
    snapshot_id = f"turn_{cm._turn_counter:04d}"
    snapshot_path = str(
        Path(project_root) / "context_snapshots" / session_id / f"{snapshot_id}.json"
    )

    return {
        "ok": True,
        "messages": messages,
        "config": config,
        "token_estimate": total_tokens,
        "char_count": total_chars,
        "message_count": len(messages),
        "snapshot_path": snapshot_path,
        "project_summary": project_summary.strip(),
    }
