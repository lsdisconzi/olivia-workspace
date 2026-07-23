#!/usr/bin/env python3
"""Shared orchestration contracts and validation helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CORE_GROUPS = ("olivia", "legal", "government", "coremu")
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


def _validate_policy_coverage(tool_permissions: dict[str, Any], handoff_routes: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    agents = tool_permissions.get("agents") if isinstance(tool_permissions, dict) else {}
    if not isinstance(agents, dict):
        agents = {}

    routes = handoff_routes.get("routing") if isinstance(handoff_routes, dict) else []
    if not isinstance(routes, list):
        routes = []

    known_agents = set(str(name) for name in agents.keys())
    known_agents.add("meta-orchestrator")
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

    policy = _validate_policy_coverage(tool_permissions, handoff_routes)
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
