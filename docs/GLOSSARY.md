# Olivia Glossary

> Canonical terminology for the Olivia project. Use these terms consistently in code, documentation, and conversation.

## System Components

**Olivia Workspace**
The browser-based frontend application loaded from `frontend/index.html`. A single-page application where ~44 JavaScript modules communicate through `window.*` globals. Provides the unified user interface for all capabilities.

**Olivia Server**
The Python backend (`serve.py`, ~21,500 lines). Handles HTTP routing, static file serving, MCP proxy, agent orchestration, and user management. A monolithic server that grew organically with the project.

**OpenClaude**
A separate CLI coding agent used for development. Not part of the Olivia runtime. Referenced in documentation only to distinguish from Olivia's own agent system.

## Architecture Concepts

**Module**
A single JavaScript file loaded via a `<script>` tag in `index.html`. Modules expose functions and state on the `window` object. There is no import/export system. Modules are the unit of frontend functionality.

**Section**
A sidebar-navigable feature area (e.g., Memory, Docs, Legal, Studio). Sections are defined by the server's section registry and filtered per-user by allow-lists. The trunk.js navigation system renders sections as sidebar tabs.

**Capability**
What Olivia can do, independent of which module triggers it. Examples: `memory.search`, `transcription.transcribe`, `juris.search`. A capability is a user-facing intent — it is NOT synonymous with its backend implementation.

A capability:
- May be implemented by REST endpoints
- May be implemented by MCP tools
- May combine multiple backend operations
- May eventually have multiple transports

Example: `memory.search` maps to `garage_qdrant_search` — but they are distinct concepts. The capability is the interface; the MCP tool is one implementation.

**Context**
The set of files, documents, memory vectors, and legal references attached to the current conversation or workspace session. Managed by the Python Context Manager and surfaced in the frontend through shared.js and context-client.js.

**Execution Architecture**
Olivia has three interaction paths (Chat/Assistant, Direct Capability Call, Remote Bus), three supporting pipelines (Context Resolution, History Persistence, Auth/Session Management), and four transport mechanisms (HTTP REST, SSE, MCP, Remote Bus polling). See `docs/EXECUTION_MODEL.md`.

## Agent System

**Agent**
A named AI assistant configuration stored in Garage (the assistants API). Each agent has a system prompt, model selection, tool permissions, and routing policy. Olivia has 60+ agents across 5 groups.

**Agent Group**
A named collection of related agents. Current groups: olivia, legal, government, coremu, la8159. Groups define routing policies and shared capabilities.

**Agent Orchestration**
The system that routes user messages to the appropriate agent. Configured in `agent-orchestration.js` and enforced by Garage's assistant routing.

**Tool**
An individual function an agent can call during execution. Tools are MCP-registered functions exposed by backend services. The `agent-functions-registry.js` maps tool names to their MCP server and transport. Tool resolution (mapping name to server) is distinct from authorization (permission to execute).

## MCP Ecosystem

**MCP (Model Context Protocol)**
A standardized protocol for AI-model-to-tool communication. Olivia uses MCP to connect frontend capabilities to backend services.

**MCP Server**
A backend process that exposes tools via the MCP protocol. Each server runs on a specific port and registers its tools with Garage, which proxies them to the frontend.

**MCP Tool**
A single function exposed by an MCP server. Example: `garage_qdrant_search` is a tool on the garage-qdrant server. Tools are backend implementations; capabilities are frontend intents — the mapping is not an identity.

**Garage** (hub service)
The main MCP hub service (ports 8110-8114, runtime identifiers: `garage_*`). Handles chat, file storage, ingestion, prompts, and Qdrant vector database access.
- **Human-facing term:** "Garage"
- **Runtime identifiers:** `garage_assistant_chat`, `garage_qdrant_search`, `garage_health`, etc.
- **Historical note:** Previously spelled "garge" in some older code/docs (corrected in Phase 1 cleanup).

## State Management

**config.js** — Legacy Conflated Model
Currently handles three distinct concerns in one file:
- Static configuration (API_BASE, defaults)
- Application state (agents, selectedAgent)
- Session state (chatHistory, activeStream)

Scheduled for split into config.js + app-state.js + session-state.js in Phase 4.

**window.* globals**
The primary communication mechanism between frontend modules. All module exports and shared state live on the `window` object. This creates an implicit dependency graph without contracts.

**app-state.js** (Phase 4 planned)
Will hold application-level state: agent list, selected agent, user preferences.

**session-state.js** (Phase 4 planned)
Will hold transient session state: chat history, active stream, current context.

## Data Flow

**SSE (Server-Sent Events)**
A transport mechanism — a long-lived HTTP connection used primarily by Chat/Assistant for streaming responses and tool call events.

**Remote Bus**
A transport mechanism — command relay between mobile and desktop Olivia instances. Implemented via `remote-bus-desktop.js` long-polling `/api/olivia/remote-bus`.

**API Client**
The centralized HTTP communication layer (`api-client.js`). Currently underused — ~60% of API calls bypass it in favor of raw `fetch()` calls. Standardization is a Phase 4 goal.

## Permissions

**Permission Interface** (Phase 3 planned)
A frontend advisory layer that asks: "can I display this section? can I invoke this capability?" Frontend permissions are UI gating only — the backend enforces authorization before any capability or tool executes.

**Section Allow-List**
The server-controlled list of sections a user may see, returned by `/api/user/me`. Rendered by trunk.js. This is UI filtering, not authorization.

## Truth Dimensions

The system has three distinct truth dimensions:

1. **Runtime truth** — what the code actually does (current behavior). Authoritative for "does this work right now?"
2. **Contract truth** — what manifests and contracts declare (intended interfaces).
3. **Decision truth** — what ADRs record (architectural intent).

Discrepancies between these are drift conditions to be detected and resolved. See ADR 0001, Principle 8.

## Documents and Planning

**ADR (Architecture Decision Record)**
A lightweight document capturing a significant architectural decision, its context, and its consequences. Stored in `docs/ADR/`.

**Module Manifest**
A JSON inventory of every frontend module: path, load order, exports, imports, backend endpoints. Generated from code inspection. Stored at `frontend/js/modules/module-manifest.json`.

**Capability Manifest**
A JSON inventory of every capability Olivia offers: identity, transport, permissions, availability. Authored (declared contract), not generated from module scanning. Must be independently verifiable against runtime reality. Stored at `frontend/js/lib/capability-manifest.json`.
