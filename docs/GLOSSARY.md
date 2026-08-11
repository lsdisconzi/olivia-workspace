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
What Olivia can do, independent of which module triggers it. Examples: `memory.search`, `transcription.transcribe`, `juris.search`. Capabilities are defined in the capability manifest and implemented by MCP tools or REST endpoints. A capability is NOT the same as a module — one module may use multiple capabilities, and one capability may be called from multiple modules.

**Context**
The set of files, documents, memory vectors, and legal references attached to the current conversation or workspace session. Managed by the Python Context Manager and surfaced in the frontend through shared.js and context-client.js.

**Execution Path**
One of the five canonical ways a user action flows through the system: Chat/Assistant, Direct capability call, SSE streaming, Remote bus, Context resolution.

## Agent System

**Agent**
A named AI assistant configuration stored in garge (the assistants API). Each agent has a system prompt, model selection, tool permissions, and routing policy. Olivia has 60+ agents across 5 groups.

**Agent Group**
A named collection of related agents. Current groups: olivia, legal, government, coremu, la8159. Groups define routing policies and shared capabilities.

**Agent Orchestration**
The system that routes user messages to the appropriate agent. Configured in `agent-orchestration.js` and enforced by garge's assistant routing.

**Tool**
An individual function an agent can call during execution. Tools are MCP-registered functions exposed by backend services. The `agent-functions-registry.js` maps tool names to their MCP server and transport.

## MCP Ecosystem

**MCP (Model Context Protocol)**
A standardized protocol for AI-model-to-tool communication. Olivia uses MCP to connect frontend capabilities to backend services.

**MCP Server**
A backend process that exposes tools via the MCP protocol. Each server runs on a specific port and registers its tools with garge, which proxies them to the frontend.

**MCP Tool**
A single function exposed by an MCP server. Tools are the backend implementation of capabilities. Example: `qdrant_search` is a tool on the garge-qdrant server that implements the `memory.search` capability.

**garge / garage**
The main MCP hub service (ports 8110-8114). Sometimes spelled "garge" in older documentation — the canonical spelling is "garage." Handles chat, file storage, ingestion, prompts, and Qdrant vector database access.

## State Management

**config.js**
The main configuration file. Currently handles three conflated concerns: static configuration (API_BASE), application state (agents, selectedAgent), and session state (chatHistory, activeStream). Scheduled for split in Phase 4.

**window.* globals**
The primary communication mechanism between frontend modules. All module exports and shared state live on the `window` object. This creates an implicit dependency graph without contracts.

**app-state.js** (planned)
Will hold application-level state: agent list, selected agent, user preferences. Split from config.js in Phase 4.

**session-state.js** (planned)
Will hold transient session state: chat history, active stream, current context. Split from config.js in Phase 4.

## Data Flow

**SSE (Server-Sent Events)**
The streaming protocol used for chat interactions. The frontend opens a long-lived HTTP connection and receives assistant responses and tool call events as they happen.

**Remote Bus**
The command relay between mobile and desktop Olivia instances. Implemented via `remote-bus-desktop.js` long-polling `/api/olivia/remote-bus`.

**API Client**
The centralized HTTP communication layer (`api-client.js`). Currently underused — ~60% of API calls bypass it in favor of raw `fetch()` calls. Standardization is a Phase 4 goal.

## Permissions

**Permission Interface** (planned)
A frontend advisory layer that asks: "can I display this section? can I invoke this capability?" Frontend permissions are UI gating only — the backend enforces authorization before any capability or tool executes.

**Section Allow-List**
The server-controlled list of sections a user may see, returned by `/api/user/me`. Rendered by trunk.js. This is the only access control mechanism currently in place.

## Documents and Planning

**ADR (Architecture Decision Record)**
A lightweight document capturing a significant architectural decision, its context, and its consequences. Stored in `docs/ADR/`.

**Module Manifest**
A JSON inventory of every frontend module: path, load order, exports, imports, backend endpoints. Stored at `frontend/js/modules/module-manifest.json`.

**Capability Manifest**
A JSON inventory of every capability Olivia offers: identity, transport, permissions, availability. Distinct from the module manifest. Stored at `frontend/js/lib/capability-manifest.json`.
