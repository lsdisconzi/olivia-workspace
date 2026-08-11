# Olivia Execution Model

> Documents how user actions flow through the Olivia system. Organized by architectural layer: interaction paths, supporting pipelines, and transport mechanisms.
>
> **Confidence markers:** [verified] = confirmed in code; [observed] = seen during development; [inferred] = deduced from structure; [planned] = target for future phase.

---

## Interaction Paths

Three primary ways users interact with Olivia:

### 1. Chat / Assistant

The primary interaction path. A user sends a message and receives an AI assistant response.

```
User types message
    │
    ▼
chat.js ─────────────────────────────────────────────
    │  formats message + context
    │  calls stream.js
    ▼
stream.js ──────────────────────────────────────────
    │  opens SSE connection to Garage (port 8110) [verified]
    │  sends: message, agent_id, context, run_id
    ▼
Garage ─────────────────────────────────────────────
    │  resolves agent (garage_assistant_chat)
    │  [AUTHORIZATION: backend checks agent permissions] [verified]
    │  invokes LLM with system prompt + context + tools
    ▼
LLM response (streaming)
    │  may include tool_call events
    ▼
agent-functions-registry.js ────────────────────────
    │  TOOL RESOLUTION: maps tool name → MCP server + transport
    │  (NOT authorization — backend MCP server enforces permissions) [inferred]
    ▼
MCP tool execution ─────────────────────────────────
    │  e.g., garage_qdrant_search → garage-qdrant (8114)
    │  e.g., juris_search_start → juris-mcp (8116)
    ▼
Tool result → Garage → LLM (continues reasoning)
    │
    ▼
Final assistant response ───────────────────────────
    │  streamed back to stream.js
    ▼
chat.js renders response ───────────────────────────
    │
    ▼
history.js saves conversation ──────────────────────
    │  Garage file system (primary) + localStorage (cache)
```

**Authorization points (backend, authoritative):** Agent selection, tool execution [verified]
**Tool resolution (frontend, non-authoritative):** agent-functions-registry.js maps tool name to MCP server [inferred]
**State mutations:** chatHistory, activeStream (in config.js, eventually session-state.js)
**Observability:** run_id spans the entire execution; each tool call gets tool_call_id

### 2. Direct Capability Call

A feature module directly invokes a backend capability without going through the chat assistant.

```
User clicks action in feature module
    │  e.g., "Search memory" in memory.js
    ▼
Feature module ─────────────────────────────────────
    │  e.g., mvSearch() in memory.js
    │  calls backend endpoint (via api-client.js or raw fetch)
    ▼
api-client.js (when used) ──────────────────────────
    │  adds auth headers, correlation IDs
    │  handles retry, timeout, error mapping
    ▼
Garage REST endpoint ───────────────────────────────
    │  /api/memory/search → garage-qdrant (8114)
    │  [AUTHORIZATION: per-endpoint check] [verified]
    ▼
MCP tool execution ─────────────────────────────────
    │  garage_qdrant_search runs
    ▼
Result returned to feature module
    │
    ▼
Feature module renders result ──────────────────────
    │  e.g., memory.js populates search results list
```

**Authorization (backend, authoritative):** REST endpoint handler [verified]
**State mutations:** Feature-specific UI state
**Observability:** request_id per call; no run_id (not part of an agent execution)
**Note:** ~60% of these calls currently bypass api-client.js [verified]

### 3. Remote Bus

Command relay between mobile and desktop Olivia instances.

```
Mobile client ───────────────────────────────────────
    │  sends command (voice, text, gesture)
    ▼
Garage /api/olivia/remote-bus ──────────────────────
    │  [AUTHORIZATION: session token] [inferred]
    │  queues command
    ▼
remote-bus-desktop.js ──────────────────────────────
    │  long-polls /api/olivia/remote-bus
    │  receives command from queue
    ▼
Desktop Olivia executes command ────────────────────
    │  e.g., opens section, runs agent, searches
    ▼
Result returned to mobile (via same bus)
```

**Authorization (backend, authoritative):** Bus connection, each command [inferred]
**State mutations:** UI navigation, agent state
**Observability:** request_id per bus message

---

## Supporting Pipelines

### Context Resolution

Building the context payload that accompanies agent interactions.

```
User action triggers context resolution
    │  e.g., selecting files, attaching docs
    ▼
shared.js / context-client.js ──────────────────────
    │  collects: _contextSessionFiles, active docs, memory references
    ▼
Context Manager (Python) ───────────────────────────
    │  RagRetriever: fetches relevant vectors from Qdrant
    │  HistoryManager: loads recent conversation
    │  SummaryGenerator: produces context summary
    ▼
Resolved context ───────────────────────────────────
    │  structured payload: files + docs + memory + legal + project + metadata
    ▼
Injected into agent prompt ─────────────────────────
    │  via stream.js → Garage → LLM system prompt
```

**Authorization (backend):** File access, document access, memory access [inferred]
**State mutations:** _contextSessionFiles, active context in session-state
**Observability:** context resolution is part of run_id scope (when triggered by chat)

### History Persistence

```
Conversation ends → history.js saves
    │  primary: Garage file system [inferred]
    │  cache: localStorage [verified]
    │
Conversation loaded → history.js reads
    │  from Garage file system (or localStorage cache)
```

### Authentication / Session Management

```
App loads → /api/user/me → user profile + sections
    │  [AUTHORIZATION: Garage session token] [inferred]
    │
trunk.js renders allowed sections [verified]
config.js stores user state [verified]
```

---

## Transport Mechanisms

These are HOW data moves, not WHAT the user is doing:

| Transport | Used By | Characteristics |
|-----------|---------|----------------|
| **HTTP REST** | Direct capability calls, file operations, config | Request/response, request_id scoped |
| **SSE (Server-Sent Events)** | Chat/Assistant streaming [verified] | Long-lived connection, run_id scoped, auto-reconnect |
| **MCP (Model Context Protocol)** | Tool execution, agent orchestration | Tool call/result pairs within SSE or direct |
| **Remote Bus polling** | Mobile ↔ Desktop relay | Long-poll, request_id per message |

---

## Authorization Layers

Authorization may occur at multiple layers depending on the execution path. Frontend visibility and capability gating are advisory; backend capability, tool, and resource checks are authoritative where applicable.

| Layer | Location | Scope | Authoritative? |
|-------|----------|-------|---------------|
| **Section visibility** | trunk.js (from /api/user/me) | Can user see this section in sidebar? | No — UI filtering only |
| **Capability display** | Permission Interface (Phase 3 planned) | Can user see this capability button? | No — UI advisory |
| **Capability execution** | REST endpoint / MCP tool handler | Can user actually execute this? | **Yes** — backend enforced |
| **Tool resolution** | agent-functions-registry.js | Which MCP server handles this tool? | No — routing only |
| **Tool execution** | MCP server | Can this agent use this tool in this context? | **Yes** — MCP server enforced |
| **Resource access** | Filesystem / Qdrant / Neo4j / Drive | Can user access this specific resource? | **Yes** — resource-level enforced |

**Rule:** Frontend checks are UI gating only. Backend checks are authoritative security. Tool resolution (agent-functions-registry.js) is routing, not authorization.

---

## State Mutation Boundaries

### Current (Legacy Conflated Model)

```
config.js
 ├── static configuration (API_BASE, defaults)
 ├── application state (agents, selectedAgent)
 └── session state (chatHistory, activeStream)
```

### Target (Phase 4)

```
config.js       — static only
app-state.js    — application-level (agents, prefs)
session-state.js — transient (chat, stream, context)
```

### Current State Table

| State | Readers | Writers | Lifecycle |
|-------|---------|---------|-----------|
| Legacy config (all three) | all modules | config.js | Page load → conversation |
| UI state (tabs, panels, modals) | specific modules | specific modules | Per interaction |
| Context (files, docs, memory) | shared.js, chat.js | shared.js, user actions | Per session |
