# Olivia Restructuring — Tracking Document

> **Purpose:** Track all phases, decisions, and accomplishments of the Olivia project restructuring.
> **Companion to:** `plannings/restructuring-plan.md` (detailed implementation plan)

**Started:** 2026-08-11
**Branch:** `olivia-review`
**Principle:** Make implicit architecture explicit. No framework migration.

---

## Phase Summary

| Phase | Name | Status | Started | Completed | Commit |
|-------|------|--------|---------|-----------|--------|
| 1 | Sanitize and Clarify | Done | 2026-08-11 | 2026-08-11 | `aa93b1a` |
| 2 | Map the Architecture | Done | 2026-08-11 | 2026-08-11 | pending |
| 2.5 | Architecture Consistency Pass | Done | 2026-08-11 | 2026-08-11 | pending |
| 3 | Platform Primitives | Next | — | — | — |
| 4 | Reduce Coupling | Pending | — | — | — |
| 5 | Observability | Pending | — | — | — |

---

## Key Decisions Log

### D-001: No framework migration
**Date:** 2026-08-11
**Decision:** Do not introduce React, Vue, TypeScript, or any frontend framework during restructuring.
**Rationale:** The problem is not lack of a framework — it's implicit architecture from growth. Adding a framework would solve the wrong problem and create parallel migration risk.
**Source:** Architecture assessment + updated-review.md 1

### D-002: Documentation-first approach
**Date:** 2026-08-11
**Decision:** Phase 2 (mapping/documenting) must complete before any runtime abstractions (Phase 3) or module migrations (Phase 4).
**Rationale:** Building CapabilityRegistry, ServiceRegistry, PermissionInterface on undocumented legacy behavior encodes wrong assumptions. Phase 2 is the highest-value work.
**Source:** updated-review.md 5, 39

### D-003: Module manifest != Capability manifest
**Date:** 2026-08-11
**Decision:** These are separate artifacts. Module manifest answers "what is this frontend module?" Capability manifest answers "what can Olivia do?"
**Rationale:** Conflating them makes the module manifest the capability source of truth, which is architecturally incorrect.
**Source:** updated-review.md 7-8

### D-004: Frontend permissions are advisory only
**Date:** 2026-08-11
**Decision:** The Permission Interface (not "Manager") gates UI only. Authoritative authorization occurs server-side before capability/tool execution.
**Rationale:** A frontend PermissionManager implies a security boundary that doesn't exist. The frontend asks "can I display/invoke this?" — the backend decides.
**Source:** updated-review.md 11

### D-005: Service health != Capability availability
**Date:** 2026-08-11
**Decision:** ServiceRegistry tracks service UP/DOWN. CapabilityRegistry derives availability from service health + permissions + schema compatibility + downstream dependencies. UI shows capability availability, not raw service health.
**Rationale:** Qdrant=UP does not mean memory.ingest=AVAILABLE (collection may not exist, permission missing, schema incompatible).
**Source:** updated-review.md 13

### D-006: Correlation IDs use 5 hierarchical scopes
**Date:** 2026-08-11
**Decision:** session_id -> page_id -> run_id -> request_id / tool_call_id. X-Request-Id and X-Run-Id are semantically separate headers.
**Rationale:** Enables complete execution tracing: run -> model -> context -> tool -> service -> result -> final response.
**Source:** updated-review.md 21-23

### D-007: config.js split uses session-state.js, not model-catalog.js
**Date:** 2026-08-11
**Decision:** config.js splits into config.js (static), app-state.js (application), session-state.js (transient). model-catalog.js only if genuinely justified.
**Rationale:** The architectural diagnosis identified configuration, application state, and session state as separate concerns. model-catalog.js doesn't match that diagnosis.
**Source:** updated-review.md 17

### D-008: initMobile consolidation before config.js split
**Date:** 2026-08-11
**Decision:** Phase 4.1 (initMobile) must run before 4.2 (config split). initMobile defined 3 times — whichever loads last wins. Fix this implicit hazard before touching high-centrality config.js.
**Source:** updated-review.md 16

### D-009: gdrive.js confirmed unused before deletion
**Date:** 2026-08-11
**Decision:** Verified gdrive.js was a 366-line Node.js Express router (`require('express')`, `require('googleapis')`) with zero frontend references. Frontend uses `frontend/js/modules/drive.js` instead.
**Source:** updated-review.md 3

### D-010: Context resolution is a first-class execution path
**Date:** 2026-08-11
**Decision:** Added Context resolution as a supporting pipeline (alongside History Persistence and Auth/Session) rather than a separate execution path. Execution paths are now: interaction paths (3), supporting pipelines (3), transport mechanisms (4).
**Rationale:** If context remains an implicit side channel, the architecture won't become fully explicit.
**Source:** updated-review.md 27; refined by updated-review-2.md

### D-011: Three-truth model — runtime, contract, decision
**Date:** 2026-08-11
**Decision:** Every architectural question must distinguish: runtime truth (what the code does), contract truth (what manifests declare), and decision truth (what ADRs record). Discrepancies between these are drift conditions to detect and resolve — not evidence that contracts or ADRs are wrong.
**Rationale:** Without this distinction, documentation and code drift apart silently.
**Source:** updated-review-2.md 2

### D-012: Phase 2.5 consistency pass before Phase 3
**Date:** 2026-08-11
**Decision:** A consistency pass (Phase 2.5) must resolve contradictions among the 4 core architecture docs before building Phase 3 runtime abstractions. Phase 3 primitives built on inconsistent docs would encode contradictions.
**Rationale:** 10+ internal contradictions found across ADR, Glossary, Execution Model, and Source-of-Truth map.
**Source:** updated-review-2.md (core recommendation)

### D-013: Execution Model taxonomy — 3 layers, not 5 paths
**Date:** 2026-08-11
**Decision:** Execution model uses 3-layer taxonomy: 3 interaction paths, 3 supporting pipelines, 4 transport mechanisms. SSE is a transport, not an execution path. Context resolution is a pipeline, not an interaction path.
**Rationale:** The original "5 execution paths" conflated user intent (what), processing (how), and transport (medium).
**Source:** updated-review-2.md 5

### D-014: Garage naming canonicalized
**Date:** 2026-08-11
**Decision:** Human-facing term: "Garage". Runtime identifiers: `garage_*` prefix (garage_assistant_chat, garage_qdrant_search, etc.). "garge" was a historical typo corrected in Phase 1.
**Rationale:** Inconsistent naming between docs and runtime caused confusion.
**Source:** updated-review-2.md 1

### D-015: Confidence markers required in architecture docs
**Date:** 2026-08-11
**Decision:** All execution model claims carry confidence markers: [verified] = confirmed in code, [observed] = seen during development, [inferred] = deduced from structure, [planned] = target for future phase.
**Rationale:** Without confidence markers, readers can't distinguish facts from assumptions.
**Source:** updated-review-2.md 9

### D-016: Capability != MCP tool identity
**Date:** 2026-08-11
**Decision:** A capability (user-facing intent, e.g., memory.search) is not synonymous with its MCP tool implementation (e.g., garage_qdrant_search). Capabilities may be implemented by REST endpoints, MCP tools, or multiple backend operations. The capability-manifest.json is an authored contract, not generated from module scanning.
**Rationale:** Conflating capability identity with tool identity creates tight coupling between frontend concepts and backend implementations.
**Source:** updated-review-2.md 6, 8

---

## Phase 1 - Sanitize and Clarify (COMPLETED)

**Commit:** `aa93b1a`
**Files changed:** 7 (+6 / -381 lines)

### Actions completed
- [x] 1.1 — Deleted `frontend/js/state.js` (3-line dead stub, zero references)
- [x] 1.2 — Deleted `frontend/js/utils.js` (3-line dead stub, zero references)
- [x] 1.3 — Removed dead script tags from `frontend/index.html`
- [x] 1.4 — Fixed `switchSidebarView` -> `switchSidebarTab` in `frontend/js/trunk.js`
- [x] 1.5 — Fixed "garge" -> "garage" in `config/ecosystem_metadata.json`
- [x] 1.6 — Verified + deleted `frontend/js/gdrive.js` (Node.js Express router, not frontend code)
- [x] 1.7 — Removed duplicate xlsx CDN load from `frontend/index.html`
- [x] 1.8 — Cleaned `.gitignore` (removed duplicate `.env`, added `generated/`)

### Verification results
- `grep -r "state\.js\|utils\.js" frontend/` -> zero results
- `grep -r "switchSidebarView" frontend/` -> zero results (one doc comment line 11 remains, non-functional)
- `grep -r "garge" config/` -> zero results
- 7 files changed, +6/-381 lines

### Smoke-test checklist (pending before Phase 2)
- [ ] Page loads without console errors
- [ ] Chat -> send message
- [ ] Docs -> open document
- [ ] Agent -> select agent
- [ ] Memory -> search
- [ ] Legal -> open section
- [ ] Listening -> load
- [ ] Studio -> preview
- [ ] Mobile viewport -> navigation works
- [ ] Sidebar -> all sections navigate correctly

---

## Phase 2 — Map the Architecture ✅

**Status:** All 9 deliverables produced from code inspection.

### Deliverables
- [x] 2.1 — `frontend/js/modules/module-manifest.json` (56 modules, loads, exports, imports, endpoints)
- [x] 2.2 — `docs/GLOBAL_SYMBOLS.md` (~400+ window.* symbols across 56 modules)
- [x] 2.3 — `docs/EVENT_CONTRACTS.md` (11 custom events, 4 namespaces, 2 postMessage protocols)
- [x] 2.4 — `docs/EXECUTION_MODEL.md` (3-layer taxonomy with confidence markers)
- [x] 2.5 — `docs/API_ROUTES.md` (~150 endpoints from serve.py inspection)
- [x] 2.6 — `docs/GLOSSARY.md` (canonical terminology)
- [x] 2.7 — `docs/SOURCE_OF_TRUTH.md` (three-truth model, conflict resolution)
- [x] 2.8 — `docs/ADR/0001-architecture-principles.md` (12 principles)
- [x] 2.9 — Header comment in `frontend/js/modules/drive.js`

### Notes
- No runtime changes in this phase
- All docs revised during Phase 2.5 consistency pass

---

## Phase 2.5 — Architecture Consistency Pass ✅

**Trigger:** `_01_olivia-review-branch/updated-review-2.md` (20 observations, 10 must-resolve items)

### Actions completed
- [x] Expanded ADR from 10 to 12 principles (three-truth model, behavioral compatibility, no speculative abstractions)
- [x] Restructured Execution Model from "5 paths" to 3-layer taxonomy with confidence markers
- [x] Clarified capability ≠ tool identity in Glossary and Source-of-Truth map
- [x] Canonicalized Garage naming (human-facing) vs garage_* runtime identifiers
- [x] Softened "two authorization checks" claim to "may occur at multiple layers"
- [x] Reclassified SSE as transport mechanism, not execution path
- [x] Added three-truth model with drift rule to Source-of-Truth map
- [x] Resolved 10+ internal contradictions across 4 core docs
- [x] Added confidence markers ([verified]/[observed]/[inferred]/[planned]) to Execution Model
- [x] Updated planning documents (TRACKING.md, progress.md)

---

## Phase 3 — Platform Primitives (NEXT)

**Status:** Pending Phase 2 completion.
**Artifacts:** 0 / 6 created.

---

## Phase 4 - Reduce Coupling (PENDING)

**Status:** Pending Phase 3 completion.
**Artifacts:** 0 / 6 modified.

---

## Phase 5 - Observability (PENDING)

**Status:** Pending Phase 4 completion.
**Artifacts:** 0 / 6 created or modified.

---

## Architectural Guardrails (Active)

These constraints are in effect for all phases:

1. No frontend framework introduction
2. No rewriting working feature modules unnecessarily
3. No moving MCP execution into the browser for convenience
4. Frontend permissions are advisory only — backend is authoritative
5. No duplicate sources of truth
6. No renaming public APIs without migration aliases
7. No combining unrelated state domains
8. Generated documentation is not authoritative — code/registries are
9. No "big bang" migration — one module at a time

---

## Risk Tracker

| ID | Risk | Phase | Severity | Status |
|----|------|-------|----------|--------|
| R-001 | gdrive.js deletion breaks runtime | 1 | Low | Resolved — verified unused |
| R-002 | Abstractions cause init/order issues | 3 | Medium | Mitigated — new files only |
| R-003 | config.js split breaks state sync | 4 | High | Mitigated — consumer inventory first |
| R-004 | Correlation headers break SSE | 5 | Medium | Mitigated — additive, easy revert |

---

## Review Feedback Incorporated

All 12 substantive changes from `_01_olivia-review-branch/updated-review.md` have been incorporated:

1. Separate module manifest from capability manifest
2. Add source-of-truth documentation (Phase 2.7)
3. Inventory global symbols and custom events (Phase 2.2, 2.3)
4. Frontend permissions explicitly non-authoritative (Phase 3.4, D-004)
5. Separate service health from capability availability (Phase 3.3, D-005)
6. session-state.js not model-catalog.js in config split (Phase 4.2, D-007)
7. Correlation IDs with 5 distinct scopes (Phase 5.1, D-006)
8. config.js split rated Medium/High risk (Risk table, R-003)
9. gdrive.js verified before deletion (Phase 1.5, D-009)
10. Context as first-class execution path (Phase 2.4, D-010)
11. Architectural guardrails and ADRs added (Guardrails section, Phase 2.8)
12. Contracts defined before abstractions expanded (Phase 3.0a, 3.0b)
