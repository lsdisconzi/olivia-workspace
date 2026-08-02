# Olivia Group — Changelog

All notable changes to the Olivia agent group are documented here.

## 2026-07-27 — Agent directory audit and path standardization

**Changes:**
- Fixed inconsistent `agent_file` path in `olivia/index.json` — the orchestrator entry in `agents[]` used a relative format (`agents-groups/...`) while all other entries used `agents/agents-groups/...`. Standardized to the latter.
- Created `generated/schemas/` with 4 schema files: group-manifest, tool-permissions, handoff-payload, knowledge-manifest.
- Created `generated/policies/` with 3 policy files: tool-permissions.by-agent.json, handoff-routes.json, orchestrator-policy.yaml.
- Created `generated/bundles/index.json` as placeholder index.
- Created `agents/agents-groups/olivia/policies/` directory (was missing).

**Files:** agents-groups/olivia/index.json, generated/schemas/*, generated/policies/*, generated/bundles/index.json, agents-groups/olivia/policies/
**Validation:** pending Phase 2

## 2026-07-27 — Inline speaker editor in listening section

**Changes:**
- Replaced `prompt()`-based speaker rename with an inline editor in the listening transcript view.
- Added Edit button to the speaker panel header — toggles edit mode on/off.
- In edit mode, each speaker card renders a text input pre-filled with the current name, with Save/Cancel controls at the bottom of the panel.
- `lsRenderSpeakers()` now conditionally renders view-mode cards (clickable, static) vs. edit-mode cards (inputs, non-clickable).
- Edit mode resets automatically when a new transcription starts.

**Files:** frontend/css/listening.css, frontend/index.html, frontend/js/modules/listening.js
**Validation:** pass (node -c, validate-pack.mjs)

## 2026-07-27 — Phase 2 verification + la8159 path cleanup

**Changes:**
- Verified `olivia/index.json` paths — all 10 `agent_file` entries consistent ✅
- Fixed `groups.index.json` (`_meta/`) — corrected `$schema` path depth and added missing `agents/` prefix on 6 paths.
- Replaced deprecated `10_violations_json` paths in 27 la8159 agent `.agent.md` files — 62 report links and 1 coordinator text reference updated to `../source/la8159/01-violations/`.

**Files:** agents-groups/_meta/groups.index.json, agents-groups/la8159/agents/*.agent.md (27 files)
**Validation:** pass (validate-pack.mjs, grep -c zero remaining)

## 2026-07-30 — Apply best-practices guide: canonicalize contract paths + memory assignments

**Changes:**
- Created canonical `agents/generated/` contract tree (runtime resolves contract sources under `agents/generated/`, not root `generated/`):
  - `agents/generated/policies/` — tool-permissions.by-agent.json, handoff-routes.json, orchestrator-policy.yaml
  - `agents/generated/schemas/` — 4 schema files (fixes `../../generated/schemas/...` `$schema` refs in olivia/la8159 manifests)
  - `agents/generated/memory-group-assignments.json` — NEW; maps all 5 groups (olivia, legal, government, coremu, la8159) to Qdrant collections / Neo4j labels; satisfies CORE_GROUPS requirement.
- Aligned `tool-permissions.by-agent.json` with agent.md tool declarations: added `browser_use` to discovery, listening, studio; added `qdrant_ingest` to memory.
- Synced root `generated/policies/tool-permissions.by-agent.json` to keep copies identical.

**Impact:** `build_orchestration_contract_report()` now returns `ok: true` (was `missing_contract_sources`); both validator scripts pass.

**Files:** agents/generated/* (new), generated/policies/tool-permissions.by-agent.json
**Validation:** pass (contract report: 0 errors, 0 warnings; validate-olivia-pack.mjs; validate-pack.mjs)

## 2026-07-30 — Review new agent groups (legal/government/coremu) + single-source policy merge

**Changes:**
- Reviewed the added `legal`, `government`, `coremu` group folders under `agents/agents-groups/`:
  - Scaffolded 12 coremu agent files (`agents/agents-groups/coremu/agents/`) — orchestrator, NDAE coordinator, 10 residents (5 specialties).
  - Scaffolded 8 legal specialist agent files (`agents/agents-groups/legal/agents/`) — 4 jurisdiction experts, international/consumer/criminal coordinators, legacy la8159-cult-workspace-coordinator.
  - Added `agents/agents-groups/legal/policies/legal-orchestration.policy.json`.
  - Canonicalized `agent_file` / `bundle_file` / `orchestrator_policy` paths in coremu + legal manifests; all agent/policy refs now resolve (0 missing).
- Gave the olivia group a canonical per-group policy source: `agents/agents-groups/olivia/policies/{tool-permissions.by-agent.json, handoff-routes.json, orchestrator-policy.yaml}`; olivia manifest `policies` block updated to reference it.
- Added `scripts/merge-contract-policies.py` — single-source generator: per-group policies → merged `agents/generated/policies/` aggregate (76 agents, 109 routes) → byte-identical root `generated/policies/` mirror.
- Updated the best-practices guide §1/§2/§3/§7 to the single-source layout.

**Validation:** contract report ok (76 agents, 109 routes, 0 errors; 17 informational route-coverage warnings); validate-olivia-pack + validate-pack pass; root vs `agents/generated` policies byte-identical; merge idempotent.

**Files:** agents/agents-groups/{coremu,legal,olivia}/**, scripts/merge-contract-policies.py, agents/generated/policies/*, generated/policies/*

## 2026-08-02 — Consolidated Olivia knowledge hub + agent routing

**Changes:**
- Created a canonical Olivia knowledge entrypoint at `agents/agents-groups/olivia/knowledge/README.md`.
- Added a consolidated knowledge reference at `agents/agents-groups/olivia/knowledge/olivia-canonical-knowledge.md`.
- Expanded `agents/agents-groups/olivia/knowledge/manifest.json` so the hub and canonical summary are explicitly discoverable by agents.
- Wired the Olivia ecosystem coordinator and specialist agents to use the canonical knowledge hub for mission, philosophy, and public-facing positioning questions.
- Kept the original narrative and feature docs in the knowledge folder as supporting references, while making the entry path clear and tidy.

**Files:** agents/agents-groups/olivia/knowledge/*, agents/agents-groups/olivia/agents/*.agent.md
**Validation:** pass (JSON validation for Olivia manifests)
