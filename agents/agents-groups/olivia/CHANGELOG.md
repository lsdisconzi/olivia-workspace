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
