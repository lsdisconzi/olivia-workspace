# Context Manager Contract

> **Status:** Contract draft — Phase 3.0b
> **Companion to:** `docs/EXECUTION_MODEL.md` §Context Resolution, `frontend/js/lib/context-client.js`
> **Principle:** Contracts defined before implementations expanded (guardrail: no speculative abstractions — every method below maps to an observed pattern in `stream.js`, `shared.js`, or `context-config.js`).

---

## 1. Purpose

The Context Manager is the **frontend-side contract** for building, mutating, and previewing the context payload that accompanies agent interactions. It is the browser half of the Context Resolution pipeline:

```
User action triggers context resolution
    ▼
context-client.js (browser) ── collects: selected files, active docs, memory refs
    ▼
Context Manager (Python) ──── RagRetriever, HistoryManager, SummaryGenerator
    ▼
Resolved context ──────────── injected into agent prompt via stream.js
```

This document defines the **interface contract only**. The browser implementation lives in `context-client.js` (Phase 3.2); the Python Context Manager is server-side and out of scope here.

---

## 2. Context Sources (observed, [verified])

These are the existing context inputs the contract must unify. All are [verified] in code:

| Source | Module | State | Notes |
|--------|--------|-------|-------|
| Session files | `stream.js` | `_contextSessionFiles` (Set) | Files checked for the session |
| Active docs | `stream.js` | `_checkedDocs` (Set) | Docs attached as context |
| Imported files | `stream.js` | `_importedFiles` (Set) | Files imported via UI |
| Shared data | `stream.js` | `_checkedShared` (Set) | Shared scopes count |
| Panel context | `stream.js` | `probe.panel_context` | `{selected_labels, available_count, selected_count}` — dispatched via `olivia:panel-context-updated` / `LA8159:panel-context-updated` |
| User context files | `context-config.js` | `_ctxConfig` | From `GET /api/user/context-files` |
| Context preview | `stream.js` | `GET /api/assistant/context-preview?run_id=` | Server-side preview of resolved context |

---

## 3. Contract

### 3.1 Runtime namespace

Exposed as `window.OliviaContext` (aliased to `window.LA8159Context`). Loaded after `config.js` + `api-client.js`, before feature modules.

### 3.2 Methods

| Method | Signature | Returns | Behavior |
|--------|-----------|---------|----------|
| `getActive()` | `() → ContextState` | Snapshot | Returns `{ files: [], docs: [], shared: [], panel: {...}, labels: [] }` merged from live sources. Reads current globals, does not cache. |
| `add(kind, items)` | `(kind, items) → number` | New count | Adds items to the matching Set (`files`, `docs`, `shared`). Dispatches `olivia:panel-context-updated`. |
| `remove(kind, item)` | `(kind, item) → boolean` | Removed? | Removes a single item. Dispatches `olivia:panel-context-updated`. |
| `clear(kind?)` | `(kind?) → void` | — | Clears one source or all. Dispatches `olivia:panel-context-updated`. |
| `preview()` | `() → Promise<string>` | Rendered preview | Calls `GET /api/assistant/context-preview` if a `run_id` exists; otherwise returns a local textual summary of `getActive()`. |
| `resolve()` | `() → ResolvedContext` | Struct | Builds the full context payload for a request — the shape that `stream.js` sends as `panel_context` / attached context. |

### 3.3 ContextState shape

```js
{
  files:   Array<{ name, contextEligible, path? }>,
  docs:    Array<{ name, path? }>,
  shared:  Array<string>,          // shared scope ids
  panel:   { selected_labels: [], available_count: 0, selected_count: 0 },
  labels:  Array<string>,          // flattened selected_labels
}
```

### 3.4 Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `olivia:panel-context-updated` | dispatched by client | `{ files, docs, shared, panel, labels }` |
| `LA8159:panel-context-updated` | dispatched by client (legacy alias) | same |

Consumers today ([verified]): `shaders.js:462`, `studio.js:1417`, `endpoint-widget.js:96`, `memory.js:81`, `api-explorer.js:96`.

---

## 4. Non-Goals / Guardrails

1. **No server-side context management from the browser.** The Context Manager (Python) owns retrieval and summarization. `context-client.js` only assembles/annotates the *request-side* context.
2. **No new context source of truth.** The contract *reads* existing module state (`_contextSessionFiles`, `_checkedDocs`, `_importedFiles`, `_checkedShared`, `probe.panel_context`) — it does not fork storage. Existing module setters remain authoritative.
3. **No speculative API surface.** Methods are limited to the observed interaction patterns (select, attach, clear, preview, resolve).
4. **Advisory only — backend authorizes.** The client may *request* files/docs; the backend decides whether the agent may access them (§EXECUTION_MODEL: "File access, document access, memory access" is backend-authorized).
5. **Additive, non-breaking.** Existing modules continue to mutate their own state. `context-client.js` is opt-in: it is loaded but feature modules are NOT rewired in Phase 3 (wiring happens in Phase 4 one module at a time).

---

## 5. Open Questions

| # | Question | Notes |
|---|----------|-------|
| 1 | Should `resolve()` also emit the prepared payload on `olivia:context-resolved`? | Would standardize the handoff to `stream.js`; defer until a Phase 4 consumer exists. |
| 2 | Where does the Python Context Manager contract live? | Sibling doc (`docs/CONTEXT_MANAGER_CONTRACT.md` covers the browser contract; server-side contract to be documented when Phase 4 touches it). |

---

## 6. Acceptance Criteria

- [ ] `window.OliviaContext` loads without console errors, no dependency on feature modules.
- [ ] `getActive()` returns a snapshot consistent with live module state.
- [ ] `add`/`remove`/`clear` dispatch both panel-context events.
- [ ] `preview()` returns a string; uses server preview when `run_id` exists.
- [ ] No existing module behavior changes (additive only).
