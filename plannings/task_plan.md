# Restructuring Implementation Plan

> **Purpose:** Detailed task-level plan for executing each phase. This is the working document — update as tasks are completed.
>
> For phase status and decisions, see `TRACKING.md`. For context and rationale, see `memory.md` and `findings.md`.

**Branch:** `olivia-review`
**Principle:** Make implicit architecture explicit. No framework migration.

---

## Architectural Guardrails (Active Throughout)

1. Do not introduce a frontend framework (React, Vue, etc.)
2. Do not rewrite working feature modules unnecessarily
3. Do not move MCP execution into the browser solely for convenience
4. Do not treat frontend permissions as authoritative security — backend enforcement is canonical
5. Do not create duplicate sources of truth
6. Do not rename public APIs without migration aliases
7. Do not combine unrelated state domains
8. Do not make generated documentation authoritative — code/registries are the source of truth
9. Do not attempt a "big bang" migration — one module at a time

---

## Phase 1: Sanitize and Clarify ✅ COMPLETE

**Commit:** `aa93b1a`
**Risk:** Low

| # | Action | Files | Done |
|---|--------|-------|------|
| 1.1 | Delete dead stubs | `frontend/js/state.js`, `frontend/js/utils.js` | ✓ |
| 1.2 | Remove dead script tags | `frontend/index.html` | ✓ |
| 1.3 | Fix broken function reference | `frontend/js/trunk.js` | ✓ |
| 1.4 | Fix spelling error | `config/ecosystem_metadata.json` | ✓ |
| 1.5 | Verify + delete misplaced backend file | `frontend/js/gdrive.js` | ✓ |
| 1.6 | Remove duplicate CDN load | `frontend/index.html` | ✓ |
| 1.7 | Clean .gitignore | `.gitignore` | ✓ |

### Smoke-Test Checklist (before Phase 2)
- [ ] Page loads without console errors
- [ ] Chat → send message
- [ ] Docs → open document
- [ ] Agent → select agent
- [ ] Memory → search
- [ ] Legal → open section
- [ ] Listening → load
- [ ] Studio → preview
- [ ] Mobile viewport → navigation works
- [ ] Sidebar → all sections navigate correctly

### Rollback
`git revert aa93b1a`

---

## Phase 2: Map the Existing Architecture ✅ COMPLETE

**Goal:** Make the implicit architecture fully explicit via documentation and inventories.
**Risk:** Very Low (no runtime changes)

### Deliverables

| # | Action | Output File | Done |
|---|--------|-------------|------|
| 2.1 | **Module manifest** — every JS module: path, load order, exports, imports, endpoints, apiClient usage | `frontend/js/modules/module-manifest.json` | ✓ |
| 2.2 | **Global symbol inventory** — ~400+ window.* symbols across 56 modules | `docs/GLOBAL_SYMBOLS.md` | ✓ |
| 2.3 | **Event contract inventory** — 11 custom events (4 namespaces), 2 postMessage protocols | `docs/EVENT_CONTRACTS.md` | ✓ |
| 2.4 | **Execution model** — 3-layer taxonomy: interaction paths, pipelines, transports | `docs/EXECUTION_MODEL.md` | ✓ |
| 2.5 | **API route taxonomy** — ~150 endpoints across 15 categories from serve.py | `docs/API_ROUTES.md` | ✓ |
| 2.6 | **Glossary** — canonical terminology | `docs/GLOSSARY.md` | ✓ |
| 2.7 | **Source of Truth map** — three-truth model, conflict resolution | `docs/SOURCE_OF_TRUTH.md` | ✓ |
| 2.8 | **ADR 0001** — 12 architecture principles with three-truth model | `docs/ADR/0001-architecture-principles.md` | ✓ |
| 2.9 | **drive.js header comment** — note backend router location and Phase 1 cleanup | `frontend/js/modules/drive.js` | ✓ |

### Execution Architecture (actual, from 2.4)

3 interaction paths + 3 supporting pipelines + 4 transport mechanisms. See `docs/EXECUTION_MODEL.md`.

### Verification
- All docs reviewed against actual code for accuracy
- No runtime changes

---

## Phase 2.5: Architecture Consistency Pass ✅ COMPLETE

**Trigger:** `_01_olivia-review-branch/updated-review-2.md` (20 observations)

**Goal:** Resolve 10+ contradictions among the 4 core architecture docs before building Phase 3 primitives.

| # | Action | Done |
|---|--------|------|
| 2.5.1 | Expand ADR from 10 to 12 principles (three-truth model, behavioral compatibility, no speculative abstractions) | ✓ |
| 2.5.2 | Restructure Execution Model from "5 paths" to 3-layer taxonomy with confidence markers | ✓ |
| 2.5.3 | Clarify capability ≠ tool identity in Glossary and Source-of-Truth map | ✓ |
| 2.5.4 | Canonicalize Garage naming (human-facing) vs garage_* runtime identifiers | ✓ |
| 2.5.5 | Soften "two authorization checks" claim to "may occur at multiple layers" | ✓ |
| 2.5.6 | Reclassify SSE as transport mechanism, not execution path | ✓ |
| 2.5.7 | Add three-truth model with drift rule to Source-of-Truth map | ✓ |
| 2.5.8 | Add confidence markers (verified/observed/inferred/planned) to Execution Model | ✓ |
| 2.5.9 | Update planning documents with new decisions (D-011 through D-016) | ✓ |

**Files revised:** ADR/0001, EXECUTION_MODEL.md, GLOSSARY.md, SOURCE_OF_TRUTH.md, TRACKING.md, progress.md, task_plan.md

---

## Phase 3: Establish Platform Primitives and Contracts ✅ COMPLETE

**Goal:** Create lightweight, non-invasive runtime abstractions. No behavioral changes to existing modules.
**Risk:** Low/Medium
**Commit:** `*pending*`

### Contracts

| # | Action | Output | Done |
|---|--------|--------|------|
| 3.0a | Create capability manifest (what Olivia can do) | `frontend/js/lib/capability-manifest.json` | ✓ |
| 3.0b | Document Context Manager contract | `docs/CONTEXT_MANAGER_CONTRACT.md` | ✓ |

### Primitives

| # | Action | Output | Done |
|---|--------|--------|------|
| 3.1 | Capability Registry — capability identity, schema, transport, permissions, availability, timeout, retry, audit | `frontend/js/lib/capability-registry.js` | ✓ |
| 3.2 | Context Client — getActive(), add(), remove(), clear(), preview(), resolve() | `frontend/js/lib/context-client.js` | ✓ |
| 3.3 | Service Registry — health cache, distinct from capability availability | `frontend/js/lib/service-registry.js` | ✓ |
| 3.4 | Permission Interface — advisory UI gating: canViewSection(), canUseCapability(), canAccessResource(), canExecuteTool() | `frontend/js/lib/permission-interface.js` | ✓ |
| 3.5 | Wire new lib files into index.html (after config.js, before feature modules) | `frontend/index.html` | ✓ |
| 3.6 | Update tracking docs and commit | `plannings/TRACKING.md`, `plannings/progress.md`, `plannings/task_plan.md` | ✓ |

### Key Distinctions
- Module manifest ≠ Capability manifest
- Service health ≠ Capability availability
- Section visibility ≠ Permission
- Frontend permissions ≠ Security (advisory only)

### Rollback
Remove new script tags from index.html (additive, easy revert)

---

## Phase 4: Reduce Coupling ⬜ NEXT

**Goal:** Migrate coupling hotspots one module at a time. Order matters.
**Risk:** Medium/High (4.2 is the riskiest single action)

| # | Action | Files |
|---|--------|-------|
| 4.1 | **Consolidate initMobile** — 3 definitions → 1 canonical. Must run before 4.2. | `core.js`, `nav.js`, `sidebar/tabs.js` |
| 4.2 | **Split config.js** — config.js + app-state.js + session-state.js. Inventory consumers, then replace Object.defineProperty. | `config.js` → 3 files |
| 4.3 | **Standardize memory.js API calls** — raw fetch() → api-client.js where semantically equivalent. Add missing functions first. | `modules/memory.js`, `lib/api-client.js` |
| 4.4 | **Standardize docs.js API calls** — same pattern. | `modules/docs.js`, `lib/api-client.js` |
| 4.5 | **Pilot Capability Registry on memory.js** — test read, write, analysis, availability, error. | `modules/memory.js` |
| 4.6 | Update index.html for new split files | `frontend/index.html` |

### Rollback Criteria

| Action | Rollback If |
|--------|------------|
| 4.1 | Mobile navigation diverges from current behavior |
| 4.2 | Global state sync diverges, agent selection becomes stale, or SSE loses selected agent |
| 4.3-4.4 | api-client.js cannot provide equivalent semantics |
| 4.5 | Capability Registry adds latency or breaks error handling |

---

## Phase 5: Observability and Documentation Automation ⬜ PENDING

**Goal:** Correlation IDs, manifest verification, route generation, health UI.
**Risk:** Medium

| # | Action | Files |
|---|--------|-------|
| 5.1 | **Correlation ID module** — 5 scopes: session_id → page_id → run_id → request_id / tool_call_id | New: `lib/correlation.js` |
| 5.2 | Wire correlation IDs into api-client.js (X-Request-Id) and stream.js (X-Run-Id) | `lib/api-client.js`, `chat/stream.js` |
| 5.3 | Update serve.py to read/pass-through X-Request-Id, X-Run-Id | `serve.py` |
| 5.4 | Manifest verification script | New: `scripts/verify-manifest.py` |
| 5.5 | Route metadata generation (prefer introspection endpoint) | `serve.py` (+ /api/meta/routes), New: `scripts/generate-routes.py` |
| 5.6 | Health indicators in architecture.js (capability availability, not raw service health) | `modules/architecture.js` |

### Correlation ID Hierarchy
```
session_id → page_id → run_id → request_id / tool_call_id
```
X-Request-Id (HTTP) and X-Run-Id (execution) are semantically separate.

### Rollback
Remove header injection from api-client.js (additive, easy revert)

---

## Dependency Graph

```
Phase 1 ✅
   ↓
Phase 2 (Map)
   ↓
Phase 3 (Contracts + Primitives)
   ├── capability-manifest.json ──→ Phase 4.5
   ├── capability-registry.js ────→ Phase 4.5
   ├── context-client.js ─────────→ future context migration
   ├── service-registry.js ──────→ Phase 5.6
   └── permission-interface.js ──→ future authorization
        ↓
Phase 4 (Decouple)
   4.1 → 4.2 → 4.3/4.4 → 4.5
        ↓
Phase 5 (Observe)
```

Phase 4 migrations can begin as soon as their dependent Phase 3 primitive exists.

---

## Risk Summary

| Phase | Risk | Key Concern |
|-------|------|-------------|
| 1 | Low | gdrive.js verified before deletion |
| 2 | Very Low | Documentation only |
| 3 | Low/Medium | Init/order issues from globally loaded abstractions |
| 4 | Medium/High | 4.2 config.js split — high centrality, Object.defineProperty consumers need inventory |
| 5 | Medium | SSE streaming with correlation headers |

---

## Strategic Note

Optimize for **"the implicit architecture is no longer implicit."** Phase 2 is the highest-value work. Once inventories are accurate and contracts are in place, Phase 4 becomes mechanical, not architectural guesswork.
