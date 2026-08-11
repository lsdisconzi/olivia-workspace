# Source of Truth Map

> For each domain, this document declares the canonical source and how that information propagates through the system. When two sources disagree, the canonical source wins.

## Data Domains

| Domain | Canonical Source | Propagation | Notes |
|--------|-----------------|-------------|-------|
| Agent definitions | garge (assistants API) | → agent-orchestration.js → agent selector UI | Agents are created/managed server-side. Frontend is read-only consumer. |
| User preferences | garge (/api/user/me) | → config.js → trunk.js, tabs.js, all modules | Includes allowed sections, language, theme. |
| Section registry | garge (/api/user/me → available_sections) | → trunk.js → sidebar rendering | Server defines which sections exist and their metadata. |
| Section allow-list | garge (/api/user/me → sections) | → trunk.js → sidebar filtering | Per-user. Admin-controlled via auth_users.sections_json. |
| Chat history | garge file system (primary) / localStorage (cache) | → history.js → chat UI | Server is canonical; localStorage is offline cache. |
| Project files | Filesystem (via serve.py) | → files.js → file tree UI | serve.py exposes filesystem through REST endpoints. |
| Context selection | Context Manager (Python) | → shared.js → context-client.js → agent prompt | Layered: RagRetriever, HistoryManager, SummaryGenerator. |
| Qdrant vectors | Qdrant database (via garge-qdrant, port 8114) | → memory.js → vector search UI | Managed by garge-qdrant MCP server. |
| Neo4j relationships | Neo4j database (via violation-refiner, port 8124) | → violations.js → graph visualization | Legal knowledge graph. |
| Violation bundles | violation-refiner filesystem output | → violations.js → bundle viewer | Generated JSON bundles stored on server filesystem. |
| Service health | Each MCP server (/health endpoint) | → health.js → service-registry.js → UI indicators | Polled periodically by health monitoring. |
| MCP tool catalog | Each MCP server (list_tools) | → agent-functions-registry.js → stream.js tool resolution | Auto-discovered at init. |
| Legal statutes | juris-search MCP (port 8116) | → law_library.js, master_index.js → legal panels | Search and index served by juris-search. |
| Transcriptions | transcription MCP (ports 8121-8123) | → listening.js → transcription UI | Audio processing results. |
| Document intelligence | discovery MCP (port 3010, stdio) | → discovery.js → intelligence panels | Entity extraction, gap analysis. |
| 3D assets | comfyui MCP (port 8188) | → shaders.js, scene3d.js | Generated/processed 3D content. |
| Static configuration | config.js (API_BASE, defaults) | → api-client.js, all modules | The only true config file. Split planned in Phase 4. |
| Application state | config.js (currently; → app-state.js in Phase 4) | → all modules via window.* | Agents, selectedAgent, user prefs. |
| Session state | config.js (currently; → session-state.js in Phase 4) | → chat.js, stream.js via window.* | chatHistory, activeStream, current context. |

## Documentation Domains

| Domain | Canonical Source | Propagation | Notes |
|--------|-----------------|-------------|-------|
| Module inventory | module-manifest.json | → docs, capability registry | Generated from code inspection. |
| Capability inventory | capability-manifest.json | → Capability Registry, docs | Authored, not generated. |
| API routes | serve.py route definitions | → API_ROUTES.md | Generated documentation, not authoritative. |
| Global symbols | GLOBAL_SYMBOLS.md | → developer reference | Snapshot of current state. |
| Architecture decisions | ADR files in docs/ADR/ | → all planning documents | Authoritative for decisions. |

## Conflict Resolution

When two sources disagree about the same information:

1. **Code over documentation** — serve.py route handlers over API_ROUTES.md
2. **Server over client** — garge agent definitions over frontend cache
3. **ADR over informal docs** — ADR decisions over meeting notes or chat logs
4. **Manifest over code comments** — capability-manifest.json over inline comments
5. **Current behavior over historical** — what the code does now over what docs say it should do
