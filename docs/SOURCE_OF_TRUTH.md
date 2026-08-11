# Source of Truth Map

> For each domain, this document declares the canonical source and how that information propagates through the system.

## Truth Dimensions

The system has three distinct truth dimensions (see ADR 0001, Principle 8):

| Dimension | What It Answers | Authority |
|-----------|----------------|-----------|
| **Runtime truth** | What does the system actually do right now? | Code and actual behavior | 
| **Contract truth** | What does the system promise to expose? | Capability manifest, Context Manager contract |
| **Decision truth** | What should the architecture look like? | ADR records |

**Drift Rule:** A discrepancy between runtime behavior and contract/ADR intent is a drift condition — not evidence that the contract or ADR is wrong. The architecture work exists partly to detect and eliminate this drift.

---

## Data Domains

| Domain | Canonical Source | Propagation (interface boundaries) | Notes |
|--------|-----------------|-------------------------------------|-------|
| Agent definitions | Garage (assistants API) | → agent-orchestration.js → agent selector UI | Agents are created/managed server-side. Frontend is read-only consumer. |
| User preferences | Garage (/api/user/me) | → config.js → trunk.js, tabs.js, all modules | Includes allowed sections, language, theme. |
| Section registry | Garage (/api/user/me → available_sections) | → trunk.js → sidebar rendering | Server defines which sections exist and their metadata. |
| Section allow-list | Garage (/api/user/me → sections) | → trunk.js → sidebar filtering | Per-user. Admin-controlled. UI filtering only (not authorization). |
| Chat history | Garage file system (primary) / localStorage (cache) | → history.js → chat UI | Server is canonical; localStorage is offline cache. |
| Project files | Filesystem (via serve.py REST endpoint) | → files.js → file tree UI | serve.py exposes filesystem; frontend does not access filesystem directly. |
| Context selection | Context Manager (Python) | → shared.js → context-client.js → agent prompt | Layered: RagRetriever, HistoryManager, SummaryGenerator. |
| Qdrant vectors | Qdrant database | → garage-qdrant MCP server (port 8114) → capability API → memory.js | Frontend accesses through garage-qdrant, not Qdrant directly. |
| Neo4j relationships | Neo4j database | → violation-refiner MCP (port 8124) → capability API → violations.js | Frontend accesses through violation-refiner, not Neo4j directly. |
| Violation bundles | violation-refiner filesystem output | → violations.js → bundle viewer | Generated JSON bundles; frontend reads via REST/API. |
| Service health | Each MCP server (/health endpoint) | → health.js → service-registry.js → UI indicators | Polled periodically by health monitoring. |
| MCP tool catalog | Each MCP server (list_tools) | → agent-functions-registry.js → stream.js tool resolution | Auto-discovered at init. Tool resolution is routing, not authorization. |
| Legal statutes | juris-search MCP (port 8116) | → law_library.js, master_index.js → legal panels | Search and index served by juris-search. |
| Transcriptions | transcription MCP (ports 8121-8123) | → listening.js → transcription UI | Audio processing results. |
| Document intelligence | discovery MCP (port 3010, stdio) | → discovery.js → intelligence panels | Entity extraction, gap analysis. |
| 3D assets | comfyui MCP (port 8188) | → shaders.js, scene3d.js | Generated/processed 3D content. |
| Static configuration | config.js (API_BASE, defaults) | → api-client.js, all modules | Currently conflated with state; split planned in Phase 4. |
| Application state | config.js (currently; → app-state.js in Phase 4) | → all modules via window.* | Agents, selectedAgent, user prefs. Legacy conflated model. |
| Session state | config.js (currently; → session-state.js in Phase 4) | → chat.js, stream.js via window.* | chatHistory, activeStream, current context. Legacy conflated model. |

---

## Documentation Domains

| Domain | Canonical Source | Propagation | Notes |
|--------|-----------------|-------------|-------|
| Module inventory | module-manifest.json | → developer reference | Generated from code inspection (runtime truth). |
| Capability inventory | capability-manifest.json (declared contract) | → Capability Registry, docs | Authored. Must be independently verifiable against runtime. Drift = detected/flagged. |
| API routes | serve.py route definitions (runtime truth) | → API_ROUTES.md (derived, not authoritative) | API_ROUTES.md is generated documentation — code is the source. |
| Global symbols | GLOBAL_SYMBOLS.md | → developer reference | Snapshot of current runtime state. |
| Architecture decisions | ADR files in docs/ADR/ | → all planning documents | Decision truth. Drift from runtime = condition to resolve. |

---

## Conflict Resolution

When two sources disagree about the same information, resolve in this order:

### For current-state questions ("does this work?")

1. **Runtime behavior** — what the code actually does
2. **Deployed configuration** — live server state
3. **Documentation** — is known to lag; fix it when you find drift

### For intended-state questions ("how should this work?")

1. **ADR** — architectural decisions (decision truth)
2. **Explicit contracts** — capability manifest, context contract (contract truth)
3. **Implementation** — code may not yet conform to decisions/contracts

### Cross-dimension rule

A discrepancy between runtime behavior and an ADR or contract is a **drift condition** — it must be resolved, not ignored. The ADR/contract describes intent; the runtime describes reality. Either the ADR/contract needs updating, or the code needs fixing, or both.

### Additional rules

- **Server over client** — Garage agent definitions over frontend cache (for agent state)
- **Manifest over code comments** — capability-manifest.json (declared contract) over inline code comments (for intended interfaces)
- **Current runtime over historical docs** — what the code does now over what docs say it should do
