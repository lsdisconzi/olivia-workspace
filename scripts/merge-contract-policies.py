#!/usr/bin/env python3
"""Merge per-group policy files into the single contract aggregate.

Single-source model (best-practices guide §2/§3):
  - Canonical source per group : agents/agents-groups/<group>/policies/{tool-permissions.by-agent.json, handoff-routes.json}
  - Derived aggregate          : agents/generated/policies/{tool-permissions.by-agent.json, handoff-routes.json}
    (consumed by src/orchestration_contracts.py build_orchestration_contract_report)
  - Mirror (byte-identical)    : generated/policies/...  (legacy root tree, kept in sync; canonical is agents/generated/)

Run:  python3 scripts/merge-contract-policies.py [--write]
Without --write, prints a dry-run summary and validates the merge would pass schema checks.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GROUPS_ROOT = ROOT / "agents" / "agents-groups"
AGG_TOOL = ROOT / "agents" / "generated" / "policies" / "tool-permissions.by-agent.json"
AGG_HANDOFF = ROOT / "agents" / "generated" / "policies" / "handoff-routes.json"
MIRROR_TOOL = ROOT / "generated" / "policies" / "tool-permissions.by-agent.json"
MIRROR_HANDOFF = ROOT / "generated" / "policies" / "handoff-routes.json"


def resolve(raw: str) -> Path | None:
    cand = (raw or "").strip()
    if not cand:
        return None
    candidates: list[Path] = []
    p = Path(cand)
    if p.is_absolute():
        candidates.append(p)
    else:
        candidates.append(ROOT / cand)
        if cand.startswith("agents/"):
            candidates.append(ROOT / cand[len("agents/"):])
        elif cand.startswith("agents-groups/"):
            candidates.append(ROOT / "agents" / cand)
        else:
            candidates.append(ROOT / "agents" / cand)
    for c in candidates:
        try:
            r = c.expanduser().resolve()
        except Exception:
            r = c.expanduser()
        if r.exists():
            return r
    return None


def read_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def merge_tool_permissions(groups: list[dict]) -> dict:
    agents: dict = {}
    groups_meta: dict = {}
    conf_reqs: set = set()
    for g in groups:
        src = resolve(g["tool_permissions"])
        if src is None:
            print(f"  !! missing tool-permissions for group {g['group']}: {g['tool_permissions']}")
            continue
        doc = read_json(src)
        groups_meta[g["group"]] = {
            "source": str(src.relative_to(ROOT)).replace("\\", "/"),
            "default_policy": doc.get("default_policy"),
        }
        dp = doc.get("default_policy") or {}
        conf_reqs.update(dp.get("require_confirmation_for") or [])
        for slug, perm in (doc.get("agents") or {}).items():
            entry = dict(perm)
            entry.setdefault("notes", []).append(f"group:{g['group']}")
            agents[slug] = entry
    merged = {
        "version": "1.0.0",
        "group": "all",
        "description": "Merged per-group tool permissions. Canonical source: agents/agents-groups/<group>/policies/tool-permissions.by-agent.json. Regenerate with scripts/merge-contract-policies.py.",
        "default_policy": {
            "mode": "deny-by-default",
            "require_confirmation_for": sorted(conf_reqs),
        },
        "groups": groups_meta,
        "agents": agents,
    }
    return merged


def merge_handoff_routes(groups: list[dict]) -> dict:
    routing: list = []
    seen: set = set()
    for g in groups:
        src = resolve(g["handoff_routes"])
        if src is None:
            print(f"  !! missing handoff-routes for group {g['group']}: {g['handoff_routes']}")
            continue
        doc = read_json(src)
        for r in doc.get("routing") or []:
            rid = r.get("route_id")
            if rid and rid in seen:
                print(f"  !! duplicate route_id {rid} (group {g['group']}) — skipping")
                continue
            if rid:
                seen.add(rid)
            routing.append(r)
    return {
        "version": "1.0.0",
        "group": "all",
        "description": "Merged per-group handoff routes. Canonical source: agents/agents-groups/<group>/policies/handoff-routes.json. Regenerate with scripts/merge-contract-policies.py.",
        "routing": routing,
    }


def main() -> int:
    write = "--write" in sys.argv
    groups: list[dict] = []
    for manifest_path in sorted(GROUPS_ROOT.glob("*/index.json")):
        if manifest_path.parent.name == "_meta":
            continue
        doc = read_json(manifest_path)
        gid = doc.get("group") or manifest_path.parent.name
        policies = doc.get("policies") or {}
        tp = policies.get("tool_permissions")
        hr = policies.get("handoff_routes")
        if not (tp and hr):
            print(f"  !! group {gid}: missing policies.tool_permissions / policies.handoff_routes in manifest")
            continue
        groups.append({"group": gid, "tool_permissions": tp, "handoff_routes": hr})

    print(f"Merging {len(groups)} groups: {', '.join(g['group'] for g in groups)}")
    tool = merge_tool_permissions(groups)
    handoff = merge_handoff_routes(groups)

    # sanity checks
    n_agents = len(tool["agents"])
    n_routes = len(handoff["routing"])
    froms = {r.get("from") for r in handoff["routing"]}
    unknown = sorted(a for a in froms if a not in tool["agents"] and a != "meta-orchestrator")
    print(f"  merged agents: {n_agents} | routes: {n_routes}")
    if unknown:
        print(f"  !! route 'from' agents missing from tool-permissions: {unknown}")
    else:
        print("  route 'from' coverage: OK")

    if not write:
        print("Dry-run only. Pass --write to write aggregates + mirrors.")
        return 0 if not unknown else 2

    for p in (AGG_TOOL, AGG_HANDOFF, MIRROR_TOOL, MIRROR_HANDOFF):
        p.parent.mkdir(parents=True, exist_ok=True)
    AGG_TOOL.write_text(json.dumps(tool, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AGG_HANDOFF.write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MIRROR_TOOL.write_text(json.dumps(tool, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MIRROR_HANDOFF.write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {AGG_TOOL.relative_to(ROOT)}")
    print(f"Wrote {AGG_HANDOFF.relative_to(ROOT)}")
    print(f"Wrote {MIRROR_TOOL.relative_to(ROOT)}")
    print(f"Wrote {MIRROR_HANDOFF.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
