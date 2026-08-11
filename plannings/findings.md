# Architecture Assessment Findings

> **Source:** `_01_olivia-review-branch/` — especially "Olivia is no longer simply a JavaScript workspace.md"
> **Date of assessment:** 2026-08-11

## Executive Summary

Olivia has outgrown its implicit architecture. What started as a JavaScript workspace is now a frontend orchestration environment sitting on a distributed MCP/service ecosystem. The system developed architecture through growth, not through design. The result is a codebase that works but is increasingly hard to change safely.

## The Core Problem

**The system has outgrown the implicit architecture that allowed it to grow quickly.**

There is no single integration architecture:
- 44+ frontend JS modules load via `<script>` tags with no module system
- 744 `window.*` references across 25 files create an invisible dependency graph
- 148 function definitions are exposed to the global `window` object
- 100+ `typeof fn === 'function'` guards create an implicit, fragile dependency chain
- ~60% of API calls bypass the centralized `api-client.js`, using raw `fetch()` calls

## 13 Dimensions Assessed

| Dimension | Assessment |
|-----------|-----------|
| Frontend module system | None — script tags + window globals |
| State management | Ad-hoc — config.js uses Object.defineProperty magic for bidirectional sync |
| API communication | Fragmented — api-client.js exists but most modules use raw fetch() |
| Configuration | Spread across config.js, window globals, inline defaults |
| Agent system | Federated model — 5 groups, 60+ agents, policy-driven routing |
| Backend architecture | serve.py is a 21,500-line monolithic HTTP server |
| MCP integration | Comprehensive — 9 MCP servers bridged through garge/garage hub |
| Context management | Layered Python design (RagRetriever, HistoryManager, SummaryGenerator) — but frontend coupling is implicit |
| Security/permissions | Implicit — trunk.js section allow-list is the only access control |
| Error handling | Inconsistent — mix of try/catch, console.warn, silent failures |
| Testing | None for frontend modules |
| Documentation | Sparse — architecture docs exist in `_01_olivia-review-branch/` but not inline |
| Build/deployment | Ad-hoc — no bundler, no versioning, no CI/CD |

## Key Architectural Gaps

### 1. No Module System
- Everything communicates through `window.*` globals
- Load order is determined by `<script>` tag placement in index.html
- Changing load order can silently break functionality
- No way to know which module depends on which global

### 2. Implicit Dependency Graph
- `typeof fn === 'function'` guards are defensive checks, not contracts
- If a module fails to load, downstream modules silently degrade
- No way to trace "who calls this function?"

### 3. Monolithic Backend
- serve.py at 21,500 lines handles HTTP, routing, file serving, MCP proxying, agent orchestration, and more
- Route handlers, business logic, and infrastructure concerns are interleaved
- Adding a new endpoint requires understanding the entire file

### 4. Fragmented API Communication
- api-client.js exists as a centralized HTTP client
- But ~60% of API calls are raw `fetch(API_BASE + '/api/...')` in feature modules
- No consistent error handling, retry logic, or request tracking

### 5. State Management Anti-Patterns
- config.js uses `Object.defineProperty` to sync window globals bidirectionally
- This is clever but invisible — consumers don't know they're using reactive state
- Multiple modules can overwrite the same global (e.g., initMobile defined 3 times)

### 6. Missing Security Model
- Section visibility (trunk.js allow-list) is the only access control
- No distinction between "can see this section" and "can execute this capability"
- No server-side authorization enforcement for tool/capability execution

### 7. No Execution Tracing
- No correlation IDs flow through the stack
- Debugging a chat interaction requires tracing through: frontend → API → MCP proxy → MCP server → model → back
- Impossible to answer "why did this agent produce this answer?" without manual reconstruction

### 8. Dead Code
- state.js and utils.js were 3-line stubs with zero references (removed in Phase 1)
- gdrive.js was a 366-line Node.js Express router misplaced in the frontend directory (removed in Phase 1)
- Likely more dead code exists in large feature modules

### 9. Duplicate Definitions
- initMobile defined 3 times across core.js, nav.js, sidebar/tabs.js
- Whichever loads last wins — implicit runtime behavior
- Duplicate xlsx CDN load in index.html (removed in Phase 1)

### 10. Generated vs. Canonical Confusion
- `generated/` now in .gitignore, but no clear distinction between what is generated and what is authored
- Documentation mentions "garge" (typo, fixed in Phase 1) suggesting some docs were written from memory, not code

## Target Architecture

The restructuring aims to transition from:

```
Frontend modules → implicit globals → mixed APIs → MCP/services
```

To:

```
Frontend → Application intent → Capability → Policy/Context → Integration adapter → MCP/REST/external → Resource
```

The critical move: **Module → Capability + Policy** rather than Module → Service.
