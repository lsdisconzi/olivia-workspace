#!/usr/bin/env python3
"""One-shot scaffolder for the la8159 group manifest + agent files + bundles."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
AGENTS_DIR = ROOT / "agents"
AGENTS_DIR.mkdir(exist_ok=True)

REPO_ROOT = ROOT.parent.parent  # <project root>
BUNDLES_DIR = REPO_ROOT / "generated" / "la8159" / "bundles"
BUNDLES_DIR.mkdir(parents=True, exist_ok=True)

CATEGORIES = {
    "BR": "🇧🇷 Brazil",
    "CL": "🇨🇱 Chile",
    "INT": "🌐 International",
    "meta": "🧭 Meta / cross-framework",
}

# ID of the source meta-agent that becomes the group orchestrator.
ORCHESTRATOR_SOURCE_ID = "META_Orchestrator"


def slugify(agent_id: str) -> str:
    return agent_id.lower().replace("_", "-")


def first_heading(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def extract_summary(text: str) -> str:
    # Take the first non-heading paragraph or blockquote line as a one-liner.
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith(">"):
            s = s.lstrip("> ").strip()
        # Strip markdown emphasis/links roughly
        s = re.sub(r"[`*_]", "", s)
        s = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", s)
        return s[:280]
    return ""


def has_yaml_frontmatter(text: str) -> bool:
    return text.lstrip().startswith("---")


def ensure_frontmatter(body: str, name: str, description: str, tags: list[str]) -> str:
    if has_yaml_frontmatter(body):
        return body
    fm_lines = [
        "---",
        f"name: {json.dumps(name)}",
        f"description: {json.dumps(description)}",
        "agent_type: openclaude",
        f"tags: {json.dumps(tags)}",
        "---",
        "",
    ]
    return "\n".join(fm_lines) + body


def collect_specs():
    specs = []
    for category in ("BR", "CL", "INT", "meta"):
        cat_dir = SRC / category
        if not cat_dir.is_dir():
            continue
        for entry in sorted(cat_dir.iterdir()):
            if not entry.is_dir():
                continue
            agent_file = entry / "agent.md"
            if not agent_file.is_file():
                continue
            specs.append((category, entry.name, agent_file))
    return specs


def jurisdiction_for(category: str, agent_id: str) -> str:
    if category == "meta":
        return "cross-framework"
    return {"BR": "Brazil", "CL": "Chile", "INT": "International"}[category]


def language_focus_for(category: str) -> list[str]:
    return {
        "BR": ["pt-BR", "en"],
        "CL": ["es-CL", "en"],
        "INT": ["en"],
        "meta": ["en"],
    }[category]


def write_bundle(slug: str, name: str, description: str, body: str, agent_md_rel: str,
                 qdrant_collection: str | None, neo4j_database: str | None,
                 config: dict) -> str:
    """Write a single import-bundle JSON file. Returns repo-relative bundle path."""
    bundle = {
        "bundle": {
            "agent": {
                "name": name,
                "agent_type": "openclaude",
                "description": description,
                "tools": [
                    "str_replace_editor",
                    "bash",
                    "python_execute",
                    "context_assemble",
                    "terminate",
                ],
                "system_prompt": body,
                "neo4j_database": neo4j_database,
                "qdrant_collection": qdrant_collection,
                "linked_files": [agent_md_rel],
                "config": config,
            },
            "contract": {"path": None, "content": None},
            "knowledge": {"files": []},
            "chats": {"sessions": []},
            "artifacts": {"files": []},
            "logs": {"files": []},
            "metadata": {
                "bundle_version": "1.0.0",
                "profile_id": slug,
                "created_from": "agents-groups/la8159",
                "created_at": "2026-04-28",
            },
        }
    }
    out = BUNDLES_DIR / f"{slug}.bundle.import.json"
    out.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return f"generated/la8159/bundles/{slug}.bundle.import.json"


def main():
    specs = collect_specs()
    agents = []

    # Orchestrator + coordinator are written separately; placeholders here.
    orchestrator_slug = "la8159-orchestrator"
    coordinator_slug = "la8159-coordinator"
    agents.append({
        "slug": orchestrator_slug,
        "name": "LA8159 Orchestrator",
        "role": "orchestrator",
        "agent_file": f"agents-groups/la8159/agents/{orchestrator_slug}.agent.md",
        "bundle_file": f"generated/la8159/bundles/{orchestrator_slug}.bundle.import.json",
        "tags": ["promoted-from:META_Orchestrator"],
    })
    agents.append({
        "slug": coordinator_slug,
        "name": "LA8159 Coordinator",
        "role": "coordinator",
        "agent_file": f"agents-groups/la8159/agents/{coordinator_slug}.agent.md",
        "bundle_file": f"generated/la8159/bundles/{coordinator_slug}.bundle.import.json",
    })

    for category, agent_id, agent_file in specs:
        if agent_id == ORCHESTRATOR_SOURCE_ID:
            # This becomes the orchestrator; copy its body into orchestrator file later.
            continue

        slug = slugify(agent_id)
        body = agent_file.read_text(encoding="utf-8")
        title = first_heading(body) or agent_id
        summary = extract_summary(body) or f"{agent_id} legal grounding specialist."

        out_path = AGENTS_DIR / f"{slug}.agent.md"
        framed = ensure_frontmatter(
            body,
            name=title,
            description=summary,
            tags=[
                "la8159",
                f"category:{category.lower()}",
                f"jurisdiction:{jurisdiction_for(category, agent_id).lower().replace(' ', '-')}",
            ],
        )
        out_path.write_text(framed, encoding="utf-8")

        bundle_rel = write_bundle(
            slug=slug,
            name=title,
            description=summary,
            body=framed,
            agent_md_rel=f"agents-groups/la8159/agents/{slug}.agent.md",
            qdrant_collection="la8159_grounding",
            neo4j_database="la8159",
            config={
                "section": slug,
                "mode": "grounding-specialist",
                "category": category,
                "agent_id": agent_id,
                "jurisdiction": jurisdiction_for(category, agent_id),
                "source_file": f"agents-groups/la8159/source/{category}/{agent_id}/agent.md",
            },
        )

        role = "specialist"
        entry = {
            "slug": slug,
            "agent_id": agent_id,
            "name": title,
            "role": role,
            "specialty": f"{CATEGORIES[category]} — {agent_id}",
            "language_focus": language_focus_for(category),
            "shared_scopes": [
                "la8159",
                "legal-grounding",
                f"jurisdiction:{jurisdiction_for(category, agent_id).lower().replace(' ', '-')}",
            ],
            "agent_file": f"agents-groups/la8159/agents/{slug}.agent.md",
            "bundle_file": bundle_rel,
            "source_file": f"agents-groups/la8159/source/{category}/{agent_id}/agent.md",
            "tags": [f"category:{category.lower()}"],
        }
        agents.append(entry)

    # Write the orchestrator file body from META_Orchestrator source, with a group header prepended.
    meta_orch_src = SRC / "meta" / ORCHESTRATOR_SOURCE_ID / "agent.md"
    meta_orch_body = meta_orch_src.read_text(encoding="utf-8") if meta_orch_src.exists() else ""

    orchestrator_md = (
        '---\n'
        'name: "LA8159 Orchestrator"\n'
        'description: "Runtime router for the LA8159 grounding group. Routes facts and violation IDs (BR-NNN / CL-NNN / INT-NNN) to the correct jurisdiction or meta specialist. Promoted from META_Orchestrator in the upstream 0_agents library."\n'
        'agent_type: openclaude\n'
        'tags: ["la8159", "role:orchestrator"]\n'
        '---\n\n'
        '# LA8159 Orchestrator (group runtime)\n\n'
        '> This agent is the group-level runtime router. It supersedes (and embeds) the upstream `META_Orchestrator` spec from the 0_agents library. For governance, manifest, or knowledge-base questions, route to `la8159-coordinator`.\n\n'
        '## Group network (current)\n\n'
        f'- **{len(specs) - 1} specialists** under jurisdictions BR / CL / INT plus 6 remaining META cross-framework agents.\n'
        '- Authoritative routing table: [agents-groups/la8159/source/mapping.json](../source/mapping.json)\n'
        '- Authoritative inventory: [agents-groups/la8159/source/INDEX.md](../source/INDEX.md)\n'
        '- Source library docs: [agents-groups/la8159/source/PLAN.md](../source/PLAN.md), [agents-groups/la8159/source/DOC_agents.md](../source/DOC_agents.md)\n\n'
        '## Promoted META_Orchestrator spec\n\n'
        + (meta_orch_body or "_(source body unavailable)_\n")
    )
    (AGENTS_DIR / f"{orchestrator_slug}.agent.md").write_text(orchestrator_md, encoding="utf-8")

    # Coordinator (governance) — fresh content.
    coordinator_md = (
        '---\n'
        'name: "LA8159 Coordinator"\n'
        'description: "Governance owner of the la8159 group: maintains source library sync, INDEX.md / mapping.json freshness, personnel registry append-only discipline, source-cache coverage, and validate-pack regeneration. Defers runtime fact routing to la8159-orchestrator."\n'
        'agent_type: openclaude\n'
        'tags: ["la8159", "role:coordinator"]\n'
        '---\n\n'
        '# LA8159 Coordinator (governance)\n\n'
        'You own the **integrity of the la8159 group**: manifest, agent files, source caches, mapping table, personnel registry, and policy files. You do **not** route facts to specialists — that is `la8159-orchestrator`.\n\n'
        '## Owned scope\n\n'
        '- `agents-groups/la8159/index.json` — group manifest\n'
        '- `agents-groups/la8159/agents/**` — all `*.agent.md` specs\n'
        '- `agents-groups/la8159/source/**` — upstream library mirror (treat as the source of truth; resync from `<upstream>` when upstream changes)\n'
        '- `agents-groups/la8159/policies/**` — tool permissions and handoff routes\n'
        '- `agents-groups/la8159/knowledge/**` — knowledge manifest pointing at source caches\n\n'
        '## Operating rules\n\n'
        '1. **Append-only personnel registry** — never overwrite or rename existing dossier slugs in `source/personnel/`.\n'
        '2. **Verification status is sacred** — preserve ✅ / ⏳ / ⚠️ / ❌ flags as they appear in upstream specs. Never silently upgrade a flag.\n'
        '3. **mapping.json is canonical** for violation-ID → agents routing. If a new violation ID is introduced, add it there first, then propagate.\n'
        '4. **Re-run `node generated/validate-pack.mjs`** after any manifest or agent-file change.\n'
        '5. **Cross-group handoffs require user confirmation** before writing into another group folder.\n\n'
        '## Sync workflow (upstream → group)\n\n'
        '```bash\n'
        'rsync -a --delete --exclude .git <upstream>/ \\\n'
        '  agents-groups/la8159/source/\n'
        'python3 agents-groups/la8159/.build-index.py   # regenerates agents/ + manifest scaffolding\n'
        'node generated/validate-pack.mjs\n'
        '```\n\n'
        '## Handoff payload\n\n'
        '- `from_agent`: `la8159-coordinator`\n'
        '- `to_agent`: `la8159-orchestrator` | `meta-orchestrator`\n'
        '- `scope.owned_paths`: `["agents-groups/la8159/**"]`\n'
        '- `payload.verification`: validate-pack pass, mapping.json well-formed, personnel registry append-only respected.\n'
    )
    (AGENTS_DIR / f"{coordinator_slug}.agent.md").write_text(coordinator_md, encoding="utf-8")

    # Bundles for orchestrator + coordinator
    write_bundle(
        slug=orchestrator_slug,
        name="LA8159 Orchestrator",
        description="Runtime router for the LA8159 grounding group.",
        body=(AGENTS_DIR / f"{orchestrator_slug}.agent.md").read_text(encoding="utf-8"),
        agent_md_rel=f"agents-groups/la8159/agents/{orchestrator_slug}.agent.md",
        qdrant_collection="la8159_grounding",
        neo4j_database="la8159",
        config={
            "section": orchestrator_slug,
            "mode": "control-plane",
            "subordinate_agents": [a["slug"] for a in agents if a["role"] == "specialist"],
        },
    )
    write_bundle(
        slug=coordinator_slug,
        name="LA8159 Coordinator",
        description="Governance owner of the la8159 group.",
        body=(AGENTS_DIR / f"{coordinator_slug}.agent.md").read_text(encoding="utf-8"),
        agent_md_rel=f"agents-groups/la8159/agents/{coordinator_slug}.agent.md",
        qdrant_collection=None,
        neo4j_database="la8159",
        config={
            "section": coordinator_slug,
            "mode": "governance",
        },
    )

    # Bundles index file (mirrors generated/legal/bundles/index.json shape)
    bundle_files = sorted(p.name for p in BUNDLES_DIR.glob("*.bundle.import.json"))
    (BUNDLES_DIR / "index.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "format": "BundleImportRequest",
                "notes": [
                    "Generated from agents-groups/la8159/source (mirror of <upstream>).",
                    "Each file can be POSTed to /api/agents/import/bundle.",
                ],
                "files": bundle_files,
            },
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    # Manifest
    manifest = {
        "$schema": "../../generated/schemas/group-manifest.schema.json",
        "version": "1.0.0",
        "group": "la8159",
        "label": "LA8159 Grounding",
        "icon": "🛬",
        "color": "#7d4ea8",
        "description": "LA8159 incident legal grounding library: 33 jurisdiction specialists (BR / CL / INT) plus 6 META cross-framework agents, backed by 59 cached source files. Promoted from the LA8159 incident upstream library.",
        "language_focus": ["pt-BR", "es-CL", "en"],
        "source": {
            "manifest": "agents-groups/la8159/source/INDEX.md",
            "project_id": "la8159-grounding",
            "project_name": "LA8159 Legal Grounding Library",
            "workspace": "LA8159-incident",
            "upstream_path": "LA8159-incident/0_agents",
        },
        "orchestrator": {
            "slug": orchestrator_slug,
            "name": "LA8159 Orchestrator",
            "agent_file": f"agents-groups/la8159/agents/{orchestrator_slug}.agent.md",
        },
        "coordinator": {
            "slug": coordinator_slug,
            "name": "LA8159 Coordinator",
            "agent_file": f"agents-groups/la8159/agents/{coordinator_slug}.agent.md",
        },
        "agents": agents,
        "knowledge": {
            "folder": "agents-groups/la8159/knowledge",
            "manifest": "agents-groups/la8159/knowledge/manifest.json",
            "description": "Source caches (BR/CL/INT statutes), personnel dossiers, and routing tables imported from the upstream mirror (LA8159-incident/0_agents).",
        },
        "memory_defaults": {
            "qdrant_collections": ["la8159_grounding"],
            "neo4j_labels": ["MemoryEntry", "LegalArticle", "ViolationID", "PersonnelDossier"],
            "neo4j_databases": ["la8159"],
        },
        "policies": {
            "tool_permissions": "agents-groups/la8159/policies/tool-permissions.by-agent.json",
            "handoff_routes": "agents-groups/la8159/policies/handoff-routes.json",
        },
    }

    (ROOT / "index.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Knowledge manifest — entries-shaped per generated/schemas/knowledge-manifest.schema.json
    br_owners = [a["slug"] for a in agents if a.get("tags") and "category:br" in a["tags"]]
    cl_owners = [a["slug"] for a in agents if a.get("tags") and "category:cl" in a["tags"]]
    int_owners = [a["slug"] for a in agents if a.get("tags") and "category:int" in a["tags"]]
    meta_owners = [a["slug"] for a in agents if a.get("tags") and "category:meta" in a["tags"]]
    all_specialists = [a["slug"] for a in agents if a["role"] == "specialist"]

    knowledge_entries = [
        {
            "id": "la8159.index",
            "title": "LA8159 grounding library — INDEX.md",
            "path": "agents-groups/la8159/source/INDEX.md",
            "kind": "doc",
            "language": "en",
            "owner_agents": [coordinator_slug],
            "consumer_agents": [orchestrator_slug],
            "tags": ["la8159", "inventory"],
        },
        {
            "id": "la8159.plan",
            "title": "LA8159 grounding plan",
            "path": "agents-groups/la8159/source/PLAN.md",
            "kind": "doc",
            "language": "en",
            "owner_agents": [coordinator_slug],
            "consumer_agents": [orchestrator_slug],
            "tags": ["la8159", "plan"],
        },
        {
            "id": "la8159.routing",
            "title": "Violation-ID routing table (mapping.json)",
            "path": "agents-groups/la8159/source/mapping.json",
            "kind": "data",
            "language": "en",
            "owner_agents": [coordinator_slug],
            "consumer_agents": [orchestrator_slug] + meta_owners,
            "tags": ["la8159", "routing"],
        },
        {
            "id": "la8159.sources.br",
            "title": "Brazil statutory source caches",
            "path": "agents-groups/la8159/source/sources/BR",
            "kind": "corpus",
            "language": "pt-BR",
            "owner_agents": br_owners or [coordinator_slug],
            "consumer_agents": [orchestrator_slug] + meta_owners,
            "tags": ["la8159", "sources", "brazil"],
        },
        {
            "id": "la8159.sources.cl",
            "title": "Chile statutory source caches",
            "path": "agents-groups/la8159/source/sources/CL",
            "kind": "corpus",
            "language": "es-CL",
            "owner_agents": cl_owners or [coordinator_slug],
            "consumer_agents": [orchestrator_slug] + meta_owners,
            "tags": ["la8159", "sources", "chile"],
        },
        {
            "id": "la8159.sources.int",
            "title": "International instrument source caches",
            "path": "agents-groups/la8159/source/sources/INT",
            "kind": "corpus",
            "language": "en",
            "owner_agents": int_owners or [coordinator_slug],
            "consumer_agents": [orchestrator_slug] + meta_owners,
            "tags": ["la8159", "sources", "international"],
        },
        {
            "id": "la8159.personnel",
            "title": "Personnel registry + dossiers (append-only)",
            "path": "agents-groups/la8159/source/personnel",
            "kind": "registry",
            "language": "en",
            "owner_agents": [coordinator_slug],
            "consumer_agents": all_specialists or [orchestrator_slug],
            "tags": ["la8159", "personnel", "append-only"],
            "pii_sensitivity": "high",
        },
    ]
    knowledge_manifest = {
        "$schema": "../../../generated/schemas/knowledge-manifest.schema.json",
        "version": "1.0.0",
        "group": "la8159",
        "description": "LA8159 source-cache manifest: per-jurisdiction statutory caches plus personnel registry.",
        "defaults": {"pii_redaction": True},
        "entries": knowledge_entries,
    }
    (ROOT / "knowledge" / "manifest.json").write_text(
        json.dumps(knowledge_manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Tool permissions
    tool_permissions = {
        "version": "1.0.0",
        "group": "la8159",
        "default_policy": {
            "mode": "deny-by-default",
            "require_confirmation_for": [
                "cross_group_write",
                "destructive_file_delete",
                "personnel_dossier_overwrite",
                "verification_flag_upgrade",
            ],
        },
        "agents": {
            orchestrator_slug: {
                "allowed_tools": ["str_replace_editor", "bash", "python_execute", "context_assemble", "qdrant_search", "neo4j_query", "terminate"],
                "denied_tools": ["qdrant_ingest"],
                "require_confirmation_for": ["cross_group_write"],
                "notes": ["Runtime router. Always cite verification status from upstream specs."],
            },
            coordinator_slug: {
                "allowed_tools": ["str_replace_editor", "bash", "python_execute", "context_assemble", "terminate"],
                "denied_tools": ["qdrant_ingest"],
                "require_confirmation_for": [
                    "personnel_dossier_overwrite",
                    "verification_flag_upgrade",
                    "cross_group_write",
                ],
                "notes": [
                    "Governance + sync from upstream 0_agents.",
                    "Personnel registry is append-only.",
                ],
            },
        },
    }
    # Add a uniform default for every specialist
    for entry in agents:
        if entry["role"] == "specialist":
            tool_permissions["agents"][entry["slug"]] = {
                "allowed_tools": [
                    "str_replace_editor",
                    "bash",
                    "python_execute",
                    "context_assemble",
                    "qdrant_search",
                    "neo4j_query",
                    "terminate",
                ],
                "denied_tools": ["qdrant_ingest"],
                "require_confirmation_for": ["cross_group_write"],
                "notes": [
                    "Read-only against source caches; never modify upstream spec files.",
                    "Never silently upgrade a verification flag (✅/⏳/⚠️/❌).",
                ],
            }
    (ROOT / "policies" / "tool-permissions.by-agent.json").write_text(
        json.dumps(tool_permissions, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Handoff routes — synthesize from mapping.json
    mapping_path = SRC / "mapping.json"
    routing = []
    if mapping_path.exists():
        mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        for jur in ("BR", "CL", "INT"):
            block = mapping.get(jur, {})
            for vid, route in block.items():
                primary = [slugify(p) for p in route.get("primary", [])]
                supporting = [slugify(s) for s in route.get("supporting", [])]
                if not primary:
                    continue
                routing.append({
                    "route_id": f"la8159_orch_to_{slugify(vid)}",
                    "from": orchestrator_slug,
                    "to": primary[0],
                    "trigger": f"violation_id:{vid}",
                    "priority": "high",
                    "payload_template": {
                        "summary": f"Violation {vid} → primary specialist(s) {primary}",
                        "artifacts": [
                            {"type": "violation_id", "value": vid},
                            {"type": "primary_agents", "value": primary},
                            {"type": "supporting_agents", "value": supporting},
                        ],
                        "verification": [
                            "primary specialist NEVER-rules respected",
                            "verification flag preserved",
                            "Tier ordering (1→2→3) applied if multi-framework",
                        ],
                    },
                })

    routing.append({
        "route_id": "la8159_orch_to_coordinator",
        "from": orchestrator_slug,
        "to": coordinator_slug,
        "trigger": "governance_or_manifest_update",
        "priority": "low",
        "payload_template": {
            "summary": "Governance task (manifest, policy, knowledge, sync from upstream).",
            "verification": ["validate-pack.mjs passed"],
        },
    })
    routing.append({
        "route_id": "la8159_coordinator_to_meta_for_cross_group",
        "from": coordinator_slug,
        "to": "meta-orchestrator",
        "trigger": "cross_group_legal_overlap",
        "priority": "high",
        "requires_confirmation": True,
        "payload_template": {
            "summary": "LA8159 grounding overlap with the legal/government group requires meta-orchestrator coordination.",
            "verification": ["user confirmed cross-group handoff"],
        },
    })

    handoff = {
        "version": "1.0.0",
        "group": "la8159",
        "routing": routing,
    }
    (ROOT / "policies" / "handoff-routes.json").write_text(
        json.dumps(handoff, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(agents)} agents (incl. orchestrator + coordinator).")
    print(f"  Specialists: {sum(1 for a in agents if a['role'] == 'specialist')}")
    print(f"Manifest: {ROOT / 'index.json'}")


if __name__ == "__main__":
    main()
