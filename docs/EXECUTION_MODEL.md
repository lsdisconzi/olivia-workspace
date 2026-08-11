# Olivia Execution Model

> Documents the five canonical execution paths through the Olivia system. Each path shows where authorization, state mutation, and observability boundaries occur.

---

## Path 1: Chat / Assistant Execution

The primary user interaction path. A user sends a message and receives an AI assistant response.

```
User types message
    │
    ▼
chat.js ─────────────────────────────────────────────
    │  formats message + context
    │  calls stream.js
    ▼
stream.js ──────────────────────────────────────────
    │  opens SSE connection to garge (port 8110)
    │  sends: message, agent_id, context, run_id
    ▼
garge ──────────────────────────────────────────────
    │  resolves agent (garage_assistant_chat)
    │  [AUTHORIZATION: checks agent permissions]
    │  invokes LLM with system prompt + context + tools
    ▼
LLM response (streaming)
    │  may include tool_call events
    ▼
agent-functions-registry.js ────────────────────────
    │  resolves tool name → MCP server + transport
    │  [AUTHORIZATION: checks tool permissions]
    ▼
MCP tool execution ─────────────────────────────────
    │  e.g., qdrant_search → garge-qdrant (8114)
    │  e.g., juris_search_start → juris-mcp (8116)
    ▼
Tool result → garge → LLM (continues reasoning)
    │
    ▼
Final assistant response ───────────────────────────
    │  streamed back to stream.js
    ▼
chat.js renders response ───────────────────────────
    │
    ▼
history.js saves conversation ──────────────────────
    │  garge file system (primary) + localStorage (cache)
```

**Authorization points:** Agent selection, tool execution
**State mutations:** chatHistory, activeStream (in config.js, eventually session-state.js)
**Observability:** run_id spans the entire execution; each tool call gets tool_call_id

---

## Path 2: Direct Capability Call

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
garge REST endpoint ────────────────────────────────
    │  /api/memory/search → garge-qdrant (8114)
    │  [AUTHORIZATION: per-endpoint check]
    ▼
MCP tool execution ─────────────────────────────────
    │  qdrant_search runs
    ▼
Result returned to feature module
    │
    ▼
Feature module renders result ──────────────────────
    │  e.g., memory.js populates search results list
```

**Authorization points:** REST endpoint handler
**State mutations:** Feature-specific UI state
**Observability:** request_id per call; no run_id (not part of an agent execution)
**Note:** ~60% of these calls currently bypass api-client.js

---

## Path 3: SSE Streaming

Long-lived Server-Sent Events connection for real-time updates. Used by chat, but also by health monitoring and background workers.

```
stream.js opens SSE connection ─────────────────────
    │  GET /api/chat/stream (or similar)
    │  headers: X-Run-Id, auth token
    ▼
garge holds connection open ────────────────────────
    │  sends events as they occur:
    │  - token events (streaming text)
    │  - tool_call events (tool invocation)
    │  - tool_result events (tool completion)
    │  - error events
    ▼
stream.js event handlers ───────────────────────────
    │  onToken → chat.js appends text
    │  onToolCall → agent-functions-registry.js resolves
    │  onToolResult → feeds back to agent
    │  onError → error handling
    │  onComplete → finalizes response
    ▼
Connection closes (or reconnects on error)
```

**Authorization points:** SSE connection establishment, each tool_call event
**State mutations:** activeStream, chatHistory
**Observability:** run_id persists for entire stream; tool_call_id for each individual tool
**Error handling:** auto-reconnect with exponential backoff

---

## Path 4: Remote Bus

Command relay between mobile and desktop Olivia instances.

```
Mobile client ───────────────────────────────────────
    │  sends command (voice, text, gesture)
    ▼
garge /api/olivia/remote-bus ───────────────────────
    │  [AUTHORIZATION: session token]
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

**Authorization points:** Bus connection, each command
**State mutations:** UI navigation, agent state
**Observability:** request_id per bus message

---

## Path 5: Context Resolution

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
    │  via stream.js → garge → LLM system prompt
```

**Authorization points:** File access, document access, memory access
**State mutations:** _contextSessionFiles, active context in session-state
**Observability:** context resolution is part of run_id scope

---

## Authorization Boundaries (Cross-Cutting)

Every execution path has at least two authorization checks:

| Check | Location | What It Controls |
|-------|----------|-----------------|
| Section visibility | trunk.js (from /api/user/me) | Can user see this section in sidebar? |
| Capability display | Permission Interface (Phase 3) | Can user see this capability button? (UI advisory) |
| Capability execution | REST endpoint / MCP tool handler | Can user actually execute this? (Authoritative) |
| Tool execution | agent-functions-registry.js + MCP server | Can this agent use this tool in this context? |
| Resource access | Filesystem / Qdrant / Neo4j / Drive | Can user access this specific resource? |

**Rule:** Frontend checks (section visibility, capability display) are UI gating only. Backend checks (capability execution, tool execution, resource access) are authoritative security.

---

## State Mutation Boundaries

| State | Readers | Writers | Lifecycle |
|-------|---------|---------|-----------|
| config (static) | all modules | config.js only | Page load |
| app state (agents, prefs) | agent-orchestration, chat, trunk | config.js → app-state.js | Page load, agent change |
| session state (chat, stream, context) | chat, stream, history | stream.js, chat.js | Per conversation |
| UI state (tabs, panels, modals) | specific modules | specific modules | Per interaction |
| Context (files, docs, memory) | shared.js, chat.js | context-client.js, user actions | Per session |
