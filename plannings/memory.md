# Institutional Memory

> **Purpose:** Context for anyone working on Olivia restructuring. Read this first if you're new to the project.

## What is Olivia?

Olivia is a legal practice operating system. It provides a unified workspace that orchestrates:
- **Frontend:** ~44 JS modules loaded via `<script>` tags in a single-page application (`frontend/index.html`)
- **Backend:** A Python server (`serve.py`, ~21,500 lines) that handles HTTP, routing, file serving, and MCP proxying
- **MCP Ecosystem:** 9 Model Context Protocol servers providing AI capabilities (transcription, legal search, document intelligence, memory, etc.)
- **Agent System:** 60+ AI agents organized into 5 groups (olivia, legal, government, coremu, la8159) with policy-driven routing

The frontend is an orchestration layer — it doesn't do the heavy lifting itself. It routes user intent to the right backend capability via the right transport.

## MCP Ecosystem

| Service | Port | Purpose | Frontend Module |
|---------|------|---------|----------------|
| garge (hub) | 8110-8114 | Chat, files, ingestion, prompts, Qdrant | chat.js, agents.js, memory.js |
| transcription | 8121-8123 | Audio transcription, diarization, translation | listening.js |
| juris-search | 8116 | Legal statute search, master index, citations | law_library.js, legal-router.js, master_index.js |
| violation-refiner | 8124 | Violation pipeline, evidence/norms/nexus layers | violations.js |
| OCR | 8125-8126 | PDF text extraction, batch OCR | health.js, docs.js |
| discovery | 3010 (stdio) | Document intelligence, entity extraction, gap analysis | discovery.js |
| audio | 8765 | Audio info, resampling, feature extraction | listening.js |
| comfyui | 8188 | Image/3D generation, model management | shaders.js, scene3d.js |
| ops-dashboard | 9000 | Health monitoring (no MCP) | background-workers.js |

## Why Restructure?

The system works. But it has reached a point where:
- Changes are risky because dependencies are implicit
- New features require understanding the entire codebase
- Debugging requires manual trace reconstruction
- No one can answer "what depends on what?" without grep

The goal is not to add a framework or rewrite. The goal is to **make the existing architecture explicit** so that:
1. Dependencies are visible (Phase 2: mapping)
2. Capabilities have defined contracts (Phase 3: primitives)
3. Hotspots are decoupled incrementally (Phase 4: migration)
4. Execution is traceable (Phase 5: observability)

## Key Architectural Decisions

See `TRACKING.md` for the full decision log (D-001 through D-010). The most important:

1. **No framework migration** — the problem is implicit architecture, not missing tech
2. **Documentation first** — Phase 2 (mapping) must complete before any code changes
3. **Frontend permissions are advisory only** — backend enforces authorization
4. **One module at a time** — no big bang migration

## How the Frontend Works

```
index.html loads scripts in order:
  1. Third-party libs (marked, xlsx, Font Awesome, etc.)
  2. config.js — global configuration
  3. api-client.js — HTTP layer
  4. i18n.js — internationalization
  5. Core modules (core.js, nav.js, trunk.js, tabs.js)
  6. Feature modules (memory.js, docs.js, chat.js, etc.)
  7. Chat core (chat.js, stream.js, history.js)

All modules communicate through window.* globals.
There is no import/export, no require, no ES modules.
```

## Review Feedback Summary

The restructuring plan was reviewed via `_01_olivia-review-branch/updated-review.md` (rated ~8.5/10). Key changes incorporated:
- Module manifest separated from capability manifest
- Global symbol and event contract inventories added to Phase 2
- Permission Manager renamed to Permission Interface (advisory only)
- Service health separated from capability availability
- Correlation IDs expanded from 2 to 5 scopes
- config.js split uses session-state.js (not model-catalog.js)
- Context resolution added as 5th execution path
- initMobile consolidation before config.js split
- Architectural guardrails formalized

## Glossary (Quick Reference)

| Term | Meaning |
|------|---------|
| Olivia Workspace | The browser-based frontend application |
| Olivia Server | The Python backend (serve.py) |
| OpenClaude | The CLI coding agent (not the same as Olivia) |
| MCP | Model Context Protocol — standardized AI-tool interface |
| garge / garage | The main MCP hub service (ports 8110-8114) |
| Agent Group | A named collection of AI agents (olivia, legal, etc.) |
| Capability | What Olivia can do (e.g., memory.search) — independent of which module triggers it |
| Section | A sidebar-navigable feature area (e.g., Memory, Docs, Legal) |
| Context | The set of files, documents, and references attached to a conversation |
| Trunk | The sidebar navigation system (trunk.js) |
