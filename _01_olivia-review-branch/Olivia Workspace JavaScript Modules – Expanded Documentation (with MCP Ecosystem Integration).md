  
---

# Olivia Workspace JavaScript Modules – Expanded Documentation (with MCP Ecosystem Integration)

> **Purpose:** This document unifies the frontend JavaScript module architecture with the backend MCP server landscape.  
> Each module’s description now includes its backend MCP dependencies, the tools it consumes, and the data flow between the UI and the services.

---

## Directory Structure (unchanged)

js/modules/

├── core/                       \# Core functionality

│   ├── config.js              \# Global configuration & state

│   ├── core.js                \# Main application core

│   ├── api-client.js          \# API communication layer

│   └── i18n.js                \# Internationalization

├── chat/                      \# Chat system

│   ├── chat.js                \# Chat UI & interaction

│   ├── stream.js              \# SSE streaming & agent execution

│   └── history.js             \# Chat history management

├── sidebar/                   \# Navigation

│   ├── tabs.js                \# Sidebar tabs & navigation

│   └── endpoint-widget.js     \# Endpoint quick access widget

├── panels/                    \# Workspace panels

│   ├── output.js              \# Output artifacts panel

│   ├── docs.js                \# Document tree & preview

│   ├── shared.js              \# Shared resources & context

│   └── files.js               \# File system operations

├── agents/                    \# Agent system

│   ├── agents.js              \# Agent CRUD & management

│   ├── agent-orchestration.js \# Section-agent routing

│   └── agent-functions-registry.js \# Function catalog

├── modules/                   \# Feature modules

│   ├── studio/                \# HTML/CSS/JS editor

│   │   └── studio.js

│   ├── shaders/               \# 3D/2D scene editor

│   │   └── shaders.js

│   ├── discovery/             \# Document intelligence

│   │   └── discovery.js

│   ├── listening/             \# Audio transcription

│   │   └── listening.js

│   ├── memory/                \# Vector/Graph memory

│   │   └── memory.js

│   ├── drive/                 \# Google Drive integration

│   │   └── drive.js

│   └── ...

├── legal/                     \# Legal intelligence

│   ├── violations.js          \# Violations explorer

│   ├── law\_library.js         \# Statute library

│   ├── legal-router.js        \# Legal route resolver

│   └── master\_index.js        \# Jurisprudence index

├── projects/                  \# Project management

│   └── projects.js

└── utils/                     \# Utilities

    ├── user-prefs.js          \# User preferences

    ├── health.js              \# Health monitoring

    └── background-workers.js  \# Background job management

---

## Core Modules (with backend integration)

### `config.js`

**MCP Backend:** All modules reference `API_BASE` which points to the `garge` service (the main API hub).  
**Tools used:** Global configuration loaded from the `garge` REST API; health checks via `garage_health` tool.

### `api-client.js`

**MCP Backend:** Acts as the unified HTTP client for the whole workspace.

- Routes calls to the correct MCP server through `garge`’s proxy endpoints or directly to project-specific APIs.  
- Implements functions like `LA8159API` that wrap MCP tool invocations (e.g., `juris_search_start`, `garage_chat_completions`).

### `stream.js`

**MCP Backend:** SSE streaming for chat relies on `garge`’s `garage_assistant_chat` and `garage_deepseek_stream_proxy` tools.

- Tool calls during streaming are dispatched to the registered MCP tools via `agent-functions-registry.js`.  
- For example, a code-generation request can trigger `garage_execute_tool` or `prompt_generate`.

---

## Chat Modules

### `chat.js`

**MCP Backend:** The main chat interface communicates exclusively with `garge` (port 8110\) using tools:

- `garage_assistant_chat` for basic completions  
- `garage_create_thread` / `garage_add_thread_message` for threaded conversations  
- `garage_list_assistants` to populate agent selector

### `history.js`

**MCP Backend:** Persists conversations via `garge` file tools:

- `files_upload` / `files_read` to store/load chat history JSON  
- Alternatively uses browser localStorage but can sync to server with `garage_list_files`.

---

## Sidebar & Navigation

### `trunk.js`

**MCP Backend:** Fetches user profile from `garge` (`/api/user/me`) to determine allowed sections.

- Each section’s availability may depend on which MCP services are UP (e.g., if `transcription` is down, “Listening” tab is hidden). Health checks via `garage_health` and project-specific `/health` endpoints.

---

## Panel Modules

### `output.js`

**MCP Backend:** Output artifacts (generated PDFs, images, etc.) are stored in `garge` file system (`files_upload`).

- Downloads leverage `garge` download endpoints or direct MCP tools like `juris_download` for legal documents.

### `docs.js`

**MCP Backend:** File preview and context selection for documents managed by:

- `discovery` MCP for document intelligence (`discovery_files`, `discovery_search`)  
- `ocr` MCP for PDF text extraction (`pdf_extract_text`, `ocr_run_batch`)  
- `garge` ingestion tools (`ingestion_ingest_files`, `garage_ingest_knowledge_file`) to add docs to vector memory.

### `shared.js`

**MCP Backend:** Shared resources are typically Qdrant-stored vectors or Garage files.

- Uses `qdrant_search` and `qdrant_structured_ingest` from `garge-qdrant` (port 8114\) to retrieve or ingest shared context items.

---

## Agent Modules

### `agents.js`

**MCP Backend:** Agent CRUD maps to `garge` assistant endpoints:

- `garage_list_assistants`  
- `garage_create_assistant` / `garage_update_assistant` / `garage_delete_assistant`  
- `garage_attach_file_to_assistant` for knowledge base  
- Agent export uses `garage_get_assistant` and local `exportAgentMd()`.

### `agent-orchestration.js`

**MCP Backend:** Routes messages to different MCP-backed “lanes”:

- Primary agent: `garage_assistant_chat` with the selected assistant.  
- Secondary lane (section-specific): calls `garage_deepseek_engineer_chat` or directly invokes tools like `transcription_transcribe_audio` for Listening.

### `agent-functions-registry.js`

**MCP Backend:** This registry is a client-side mirror of the MCP tools available across the ecosystem.

- Populated at init from `garge`’s `garage_list_tools` endpoint and static configurations.  
- Used by `stream.js` to resolve tool calls to the correct MCP server during chat execution.

---

## Feature Modules – Detailed MCP Integration

### `studio.js`

**MCP Backend:**

- **Code generation:** Uses `prompt_generate` from `garge-prompt` (port 8113\) or `garage_deepseek_engineer_chat`.  
- **Project import/export:** Saves to `garge` file system via `files_upload` / `files_read`.  
- **Live preview:** Not directly MCP; runs client-side in iframe.

### `shaders.js` / `scene3d.js`

**MCP Backend:**

- **VFX agent chat:** Calls `garage_assistant_chat` with a specialised assistant.  
- **3D model loading:** May use `comfyui` MCP for generating/processing 3D assets (e.g., Tripo, Meshy partners).  
- **Remote control:** `remote-bus-desktop.js` long-polls `/api/olivia/remote-bus` from `garge` for commands.

### `discovery.js`

**MCP Backend:** This module is the UI for the **discovery** MCP project (port 3010, stdio transport).

- **Tools consumed:**  
  - `discovery_files`, `discovery_tree`, `discovery_search`  
  - `discovery_intelligence_run`, `discovery_intelligence_summary`  
  - `discovery_pipeline_entities`, `discovery_pipeline_relationships`  
  - `discovery_intelligence_gap_report`  
- **Flow:** `discLoadFiles()` → `discovery_files` → `discStartProcessing()` → `discovery_intelligence_run` → `discLoadComprehension()` → `discovery_intelligence_summary`.

### `listening.js`

**MCP Backend:** Directly controls the **transcription** MCP project (ports 8121‑8123).

- **Tools consumed:**  
  - `transcription_transcribe_audio` (core)  
  - `transcription_diarize`, `transcription_speaker_id` (diarization)  
  - `transcription_translate`, `transcription_summarize` (translate)  
- **UI:** The Pinocchio Transcription UI is at localhost:8049; the module can also call the REST API directly.  
- **Speaker editing:** `lsToggleSpeakerEdit()` manipulates diarization segments then re-runs `transcription_diarize`.

### `memory.js`

**MCP Backend:** Manages **Qdrant (via garge-qdrant)** and **Neo4j (via violation-refiner)**.

- **Qdrant operations:** `qdrant_search`, `qdrant_ingest_file`, `qdrant_structured_ingest`, `qdrant_collection_summary`.  
- **Graph memory:** Leverages `violation-refiner`’s `neo4j_upsert_violation_tool` and `neo4j_walk_implications_tool` for legal graph, but also plans generic graph memory via Neo4j.  
- **AI analysis:** Uses `garage_deep_reasoning` or `garage_chat_completions` with context from vector search.

### `violations.js`

**MCP Backend:** Powered by the **violation-refiner** MCP project (port 8124, SSE).

- **Tools consumed:**  
  - `init_violation`, `build_evidence_layer_tool`, `build_norms_layer_tool`, `build_nexus_layer_tool`  
  - `verify_statute_in_bundle_tool`, `derive_confidence_tool`, `run_pipeline_tool`  
  - `write_violation_json_tool`, `zip_bundle_tool`  
  - Qdrant/Neo4j tools for indexing and searching violations.  
- **UI flow:** `violationsInit()` → loads violation index from `violation-refiner`’s generated bundles; `violationsSelect()` fetches full bundle via `get` on the stored path.

### `law_library.js` / `legal-router.js` / `master_index.js`

**MCP Backend:** All three depend on the **juris-search** MCP project (port 8116, SSE).

- **Tools consumed:**  
  - `juris_search_start`, `juris_results`, `juris_download`  
  - `juris_master_index_documents`, `juris_master_index_search`  
  - `juris_legal_framework_search`, `juris_citations`, `juris_relator_network`  
  - `juris_upload_file` for adding new sources.  
- **Document preview:** Uses `juris_docx_index`, `juris_json_index` to render content.  
- **Context attachment:** Attaches selected law snippets to chat via `garage_attach_file_to_thread` or by injecting text.

### `drive.js`

**MCP Backend:** Implements the client-side for the **gdrive** Express router (which is not an MCP server but a conventional REST API).

- No MCP tools directly; integrates with Google Drive OAuth2.  
- Can be used in conjunction with `garge` file tools for hybrid workflows.

### `sheets.js` / `writer.js`

**MCP Backend:** These are document editors that can call `garage_ingest_knowledge_text` or `prompt_analyze` on the content.

- `writerSendChat()` sends the document content as context to the active assistant.

---

## Utility Modules – MCP Integration

### `health.js`

**MCP Backend:** The health memory pipeline uses:

- `ocr` MCP (`pdf_extract_text`, `ocr_run_batch`) for document text extraction.  
- `garage_deep_reasoning` for timeline analysis.  
- Health assistant chat via `garage_assistant_chat` with a dedicated assistant.

### `background-workers.js`

**MCP Backend:** Background workers are long-running agents managed through `garge`:

- Uses `garage_list_assistants` to discover workers.  
- Control actions (pause/resume/stop) call `garage_update_assistant` to modify state or `garage_execute_tool` to signal the worker.

---

## MCP Ecosystem Overview – Integrated with Olivia Workspace

| Project | MCP Servers / Ports | Key Tools Used by Olivia | Frontend Module(s) |
| :---- | :---- | :---- | :---- |
| **transcription** | core:8121, diarization:8122, translate:8123 | transcription\_transcribe\_audio, diarize, translate, summarise | listening.js |
| **juris-search** | juris-mcp:8116 | juris\_search\_start, juris\_results, juris\_master\_index\_search, framework\_search | law\_library.js, legal-router.js, master\_index.js |
| **garge** (main hub) | garage-core:8110, files:8111, ingestion:8112, prompt:8113, qdrant:8114 | garage\_assistant\_chat, garage\_list\_assistants, qdrant\_search, qdrant\_ingest\_\*, prompt\_generate, files\_upload | chat.js, agents.js, stream.js, memory.js, discovery.js, studio.js, writer.js, etc. |
| **violation-refiner** | violation-mcp:8124 | init\_violation, run\_pipeline\_tool, verify\_*, qdrant\_index\_violation\_tool, neo4j\_* | violations.js |
| **ocr** | ocr-core:8125, pdf-server:8126 | pdf\_extract\_text, ocr\_run\_batch, pdf\_analyze\_pdf | health.js, docs.js (preview) |
| **discovery** | discovery-mcp (stdio on port 3010\) | discovery\_intelligence\_run, discovery\_files, discovery\_tree, discovery\_gap\_report | discovery.js |
| **audio** | audio-mcp:8765 | transcription\_audio\_info, resample\_audio, extract\_features | listening.js (pre‑processing) |
| **comfyui** | model:8188, node:8188, system:8188, workflow:8188 (stdio via localhost) | comfyui\_list\_models, comfyui\_get\_job, comfyui\_system\_stats | shaders.js, scene3d.js (3D asset generation), potential future studio integration |
| **ops‑dashboard** | port 9000 (no MCP) | – | background-workers.js (monitoring) |

---

## Data Flow Patterns

### 1\. Chat with Agent

User types message in chat.js

→ stream.js calls garage\_assistant\_chat (garge:8110) via SSE

→ Agent (LLM) may request tool calls

→ agent-functions-registry.js resolves tool name to MCP server

→ stream.js executes tool via HTTP to the appropriate MCP port (e.g., juris\_search\_start on 8116\)

→ Result is sent back to agent

→ Final assistant response streamed to chat UI

→ history.js saves conversation using files\_upload or localStorage.

### 2\. Document Intelligence Pipeline

discovery.js calls discStartProcessing()

→ discovery\_intelligence\_run on discovery MCP (port 3010\)

→ discovery MCP reads project files, extracts entities, runs gap analysis

→ results cached and returned to UI

→ discLoadComprehension() fetches summary via discovery\_intelligence\_summary.

### 3\. Violation Refinement

violations.js triggers run\_pipeline\_tool via violation-refiner (8124)

→ Refiner builds evidence, norms, nexus layers, verifies statutes

→ Writes violation JSON bundle to file system

→ Qdrant/Neo4j indexing performed by tools in same server

→ violations.js loads the finished bundle for display.

### 4\. Real‑time Audio Transcription

listening.js calls transcription\_transcribe\_audio (8121)

→ Backend processes audio with Whisper, returns segments

→ If diarization needed, calls transcription\_diarize (8122)

→ Speaker labels edited in UI, then transcript sent to agent chat via garage\_assistant\_chat.

---

## MCP Tool Mapping Reference for Key Modules

### `memory.js` ↔ `garge-qdrant` (port 8114\)

| JS Function | MCP Tool |
| :---- | :---- |
| `mvSearch()` | `qdrant_search` |
| `mvDoIngest()` | `qdrant_ingest_file` / `qdrant_structured_ingest` |
| `mvLoadOverview()` | `qdrant_collection_summary` |
| `mvAnalyzeWithAI()` | `garage_deep_reasoning` |

### `discovery.js` ↔ `discovery-mcp` (stdio)

| JS Function | MCP Tool |
| :---- | :---- |
| `discLoadFiles()` | `discovery_files` |
| `discStartProcessing()` | `discovery_intelligence_run` |
| `discRunIntelPipeline()` | `discovery_intelligence_run` (with parameters) |
| `discLoadComprehension()` | `discovery_intelligence_summary` |

### `violations.js` ↔ `violation-mcp` (8124)

| JS Function | MCP Tool |
| :---- | :---- |
| `violationsInit()` | reads generated bundle JSON (no direct tool) |
| `violationsSelect()` | N/A (fetches bundle) |
| `violationsAttachActive()` | attaches to chat context (not MCP) |
| backend pipeline (triggered elsewhere) | `run_pipeline_tool` |

---

## Health & Status Integration

The **ops-dashboard** (port 9000\) and the **start-all.sh** report are consumed by `background-workers.js` and `config.js` to show service status in the UI.

- `fetchBackgroundWorkersStatus()` polls `/api/health` on each MCP project.  
- The ecosystem report (like the one provided) can be displayed inside an “Admin” panel, giving real‑time tool counts and UP/DOWN states.

---

## Adding a New Module – MCP Checklist

When adding a new frontend module that requires backend processing:

1. Identify or create an MCP server providing the required tools.  
2. Register tools in `agent-functions-registry.js` (or let it auto‑discover via `garage_list_tools`).  
3. If the module needs its own chat lane, configure `agent-orchestration.js` to route to a specialised assistant.  
4. Implement direct MCP tool calls via `api-client.js` using the correct server URL/port.  
5. Update the ecosystem report (start-all.sh) to include the new service.

---

*This expanded documentation ties together the entire Olivia Workspace architecture: JavaScript modules, MCP tool servers, human interfaces, and configuration parameters. It provides a clear, actionable map for further development.*  
