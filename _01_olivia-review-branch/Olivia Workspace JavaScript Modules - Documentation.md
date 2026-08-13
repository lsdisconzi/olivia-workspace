

# Olivia Workspace JavaScript Modules \- Documentation

## Directory Structure

js/modules/

├── core/                       \# Core functionality

│   ├── config.js              \# Global configuration & state

│   ├── core.js                \# Main application core

│   ├── api-client.js          \# API communication layer

│   └── i18n.js                \# Internationalization

│

├── chat/                      \# Chat system

│   ├── chat.js                \# Chat UI & interaction

│   ├── stream.js              \# SSE streaming & agent execution

│   └── history.js             \# Chat history management

│

├── sidebar/                   \# Navigation

│   ├── tabs.js                \# Sidebar tabs & navigation

│   └── endpoint-widget.js     \# Endpoint quick access widget

│

├── panels/                    \# Workspace panels

│   ├── output.js              \# Output artifacts panel

│   ├── docs.js                \# Document tree & preview

│   ├── shared.js              \# Shared resources & context

│   └── files.js               \# File system operations

│

├── agents/                    \# Agent system

│   ├── agents.js              \# Agent CRUD & management

│   ├── agent-orchestration.js \# Section-agent routing

│   └── agent-functions-registry.js \# Function catalog

│

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

│

├── legal/                     \# Legal intelligence

│   ├── violations.js          \# Violations explorer

│   ├── law\_library.js         \# Statute library

│   ├── legal-router.js        \# Legal route resolver

│   └── master\_index.js        \# Jurisprudence index

│

├── projects/                  \# Project management

│   └── projects.js

│

└── utils/                     \# Utilities

    ├── user-prefs.js          \# User preferences

    ├── health.js              \# Health monitoring

    └── background-workers.js  \# Background job management

---

## Core Modules

### `config.js`

**Module Overview:** Central configuration and shared state for the Olivia Workspace. Defines global variables, constants, and shared data structures used across all modules.

**Key Functions:**

- `getConfig()` \- Retrieves workspace configuration from localStorage  
- `setConfig()` \- Updates configuration and persists to localStorage  
- `escapeHtml()` \- HTML entity encoding utility  
- `formatBytes()` \- Human-readable file size formatting  
- `toast()` \- Global notification system

---

### `stream.js`

**Module Overview:** Manages SSE (Server-Sent Events) streaming for agent/assistant chat responses. Handles tool calls, permission requests, and real-time message streaming.

**Key Functions:**

- `sendMessage()` \- Main entry point for sending user messages  
- `sendAssistantMessage()` \- Sends message to /api/assistant/chat  
- `runStream()` \- Manages SSE connection for /run endpoint  
- `stopStream()` \- Terminates active stream  
- `onToolCall()` \- Handles tool execution events  
- `onToolResult()` \- Processes tool results  
- `enrichChatFileLinks()` \- Converts file references to interactive pills

---

### `history.js`

**Module Overview:** Chat history persistence, loading, and export. Manages both local (localStorage) and server-side (agent-based) conversation storage.

**Key Functions:**

- `loadChatHistory()` \- Loads saved chats list  
- `saveChat()` \- Saves current conversation  
- `loadSavedChatByName()` \- Loads specific chat session  
- `exportChatTxt()` \- Exports chat as plain text  
- `exportChatJson()` \- Exports chat as JSON

---

## Sidebar Modules

### `tabs.js`

**Module Overview:** Sidebar tab navigation, collapse/expand functionality, and view switching between workspace sections.

**Key Functions:**

- `switchSidebarTab()` \- Activates a sidebar tab and shows corresponding view  
- `toggleSidebar()` \- Collapses/expands sidebar  
- `openSidebarToTab()` \- Opens sidebar and navigates to specific tab  
- `initSidebarResize()` \- Enables drag-to-resize sidebar  
- `toggleFocusMode()` \- Hides sidebar for focused work

---

## Panel Modules

### `output.js`

**Module Overview:** Output panel for displaying artifacts (files, documents, generated content). Includes grid/list views, artifact preview, and download functionality.

**Key Functions:**

- `toggleOutputPanel()` \- Shows/hides output panel  
- `addOutputArtifact()` \- Adds artifact to output panel  
- `showOutputArtifactInPanel()` \- Displays artifact content  
- `renderOutputTabs()` \- Renders artifact tabs  
- `removeArtifact()` \- Removes artifact from output  
- `openPreviewUrl()` \- Opens file in preview panel

---

### `docs.js`

**Module Overview:** Document tree, file preview, and document context management. Handles project file browsing, document opening, and context selection.

**Key Functions:**

- `loadDocsTree()` \- Loads project document tree  
- `docsOpenFilePreview()` \- Opens file in preview panel  
- `docsOpenFileOutput()` \- Opens file in output panel  
- `toggleDocContext()` \- Toggles document in chat context  
- `getCheckedDocsContext()` \- Builds context from selected documents  
- `renderRichMarkdownHtml()` \- Renders markdown with enhanced features

---

### `shared.js`

**Module Overview:** Shared resource management (\_shared directory). Handles file selection, context building, and resource sharing across agents.

**Key Functions:**

- `getSharedContext()` \- Builds context from selected \_shared files  
- `addSharedContextItem()` \- Adds item to shared context  
- `clearAllSharedContext()` \- Clears all shared context  
- `handleContextFileImport()` \- Imports files for context  
- `renderSessionFiles()` \- Renders imported session files

---

## Agent Modules

### `agents.js`

**Module Overview:** Agent management \- creation, editing, activation, deletion. Includes agent list rendering, background worker status, and bundle import/export.

**Key Functions:**

- `loadAgents()` \- Fetches and renders agent list  
- `selectAgent()` \- Activates an agent for chat  
- `toggleAgentStatus()` \- Activates/deactivates agent  
- `deleteAgent()` \- Removes agent  
- `exportAgentMd()` \- Exports agent as .agent.md  
- `showCreateModal()` \- Opens agent creation modal  
- `submitCreateAgent()` \- Creates new agent

---

### `agent-orchestration.js`

**Module Overview:** Section-agent routing. Assigns agents to specific workspace sections (Studio, Shaders, Discovery, etc.) and manages main/secondary chat lanes.

**Key Functions:**

- `oliviaResolveSectionAgentContext()` \- Gets agent context for section  
- `oliviaSetSectionAgentAssignment()` \- Assigns agent to section  
- `oliviaOnPrimaryAgentSelected()` \- Handles primary agent selection  
- `_sendSecondaryMessage()` \- Sends message via secondary lane

---

### `agent-functions-registry.js`

**Module Overview:** Registry of API functions for agent tool use. Maps endpoints, capabilities, and ownership.

**Key Functions:**

- `init()` \- Loads function registry  
- `matchEndpoint()` \- Matches URL to registered function  
- `search()` \- Searches functions by keyword  
- `getById()` \- Gets function by ID  
- `toSystemPrompt()` \- Generates AI prompt from registry

---

## Feature Modules

### `studio.js`

**Module Overview:** HTML/CSS/JS editor with live preview. Supports AI code generation, template management, and multi-file project import.

**Key Functions:**

- `studioShowView()` \- Opens Studio view  
- `studioSendAiMsg()` \- Sends AI code generation request  
- `studioApplyAction()` \- Applies AI-suggested code change  
- `studioUpdatePreview()` \- Refreshes preview iframe  
- `studioSaveCurrentFile()` \- Saves current file to project  
- `studioImportProject()` \- Imports project files

---

### `listening.js`

**Module Overview:** Audio transcription with speaker diarization. Supports local and RunPod providers, speaker labeling, and transcript management.

**Key Functions:**

- `lsHandleFile()` \- Loads audio file for preview  
- `lsRun()` \- Starts transcription  
- `lsToggleSpeakerEdit()` \- Enables speaker name editing  
- `lsCopyTranscript()` \- Copies transcript to clipboard  
- `lsDownloadJson()` \- Downloads transcript as JSON

---

### `discovery.js`

**Module Overview:** Document analysis, intelligence pipeline, and comprehension. Wired to TheBridge API for file processing, entity extraction, and gap analysis.

**Key Functions:**

- `discLoadFiles()` \- Loads project discovery files  
- `discStartProcessing()` \- Uploads and processes files  
- `discRunIntelPipeline()` \- Runs L5-L7 intelligence analysis  
- `discLoadComprehension()` \- Loads corpus comprehension  
- `discOpenFilePreview()` \- Opens file in preview panel

---

### `memory.js`

**Module Overview:** Vector (Qdrant) and Graph (Neo4j) memory management. Handles ingestion, search, and memory distribution analysis.

**Key Functions:**

- `mvLoadOverview()` \- Loads memory overview stats  
- `mvSearch()` \- Semantic search across memories  
- `mvDoIngest()` \- Ingests text into Qdrant  
- `mvLoadConfig()` \- Loads memory configuration  
- `mvAnalyzeWithAI()` \- AI-powered memory analysis

---

### `violations.js`

**Module Overview:** LA8159 validated violations explorer. Displays violation data with legal basis, transcript segments, and cross-references.

**Key Functions:**

- `violationsInit()` \- Loads violation index  
- `violationsSelect()` \- Opens violation detail  
- `violationsAttachActive()` \- Attaches violation to context  
- `_vRenderViolationHtml()` \- Renders violation detail view  
- `violationsOpenBranded()` \- Opens branded HTML view

---

### `law_library.js`

**Module Overview:** Statute/framework library explorer. Displays legal frameworks, articles, and metadata from LA8159 law sources.

**Key Functions:**

- `lawLibInit()` \- Loads law library index  
- `lawLibSelect()` \- Opens framework source  
- `lawLibAttachActive()` \- Attaches source to context  
- `_llRenderSourceHtml()` \- Renders source with markdown

---

### `projects.js`

**Module Overview:** Project management \- creation, selection, file upload, and archival. Manages project-absolute paths and agent-project binding.

**Key Functions:**

- `loadProjects()` \- Fetches project list  
- `selectProject()` \- Activates a project  
- `createProject()` \- Creates new project  
- `uploadProjectFiles()` \- Uploads files to project  
- `attachAgentToProject()` \- Binds agent to project  
- `archiveProject()` \- Archives project

---

### `drive.js`

**Module Overview:** Google Drive integration. File browsing, upload/download, and chat assistant for Drive operations.

**Key Functions:**

- `driveRefreshFiles()` \- Lists Drive files  
- `driveUploadFile()` \- Uploads file to Drive  
- `driveDeleteFile()` \- Moves file to trash  
- `driveAuthAction()` \- Handles OAuth authentication  
- `driveRcloneStart()` \- Initiates manual credential setup

---

### `sheets.js`

**Module Overview:** Spreadsheet editor with CSV/XLSX support. Grid editing, import/export, and chat integration.

**Key Functions:**

- `sheetsImportFile()` \- Imports CSV/XLSX  
- `sheetsExport()` \- Exports as CSV/XLSX  
- `sheetsAddRow()` \- Adds row to grid  
- `sheetsSendChat()` \- Sends chat about sheet

---

### `writer.js`

**Module Overview:** Markdown/TXT editor. Document management, export, and chat integration.

**Key Functions:**

- `writerSaveActive()` \- Saves document  
- `writerExport()` \- Exports as MD/TXT/HTML  
- `writerImportFile()` \- Imports files (DOCX, PDF, etc.)  
- `writerSendChat()` \- Sends chat about document

---

## Utility Modules

### `user-prefs.js`

**Module Overview:** User preferences management (provider, model, API keys) with server sync.

**Key Functions:**

- `loadUserPrefs()` \- Loads preferences from server  
- `saveUserPrefs()` \- Saves preferences to server  
- `getActiveProvider()` \- Gets active provider  
- `getApiKey()` \- Gets API key for provider

---

### `health.js`

**Module Overview:** Personal health memory pipeline. Document upload, OCR extraction, timeline, and health assistant chat.

**Key Functions:**

- `healthRunPipeline()` \- Runs OCR/extraction pipeline  
- `healthLoadTimeline()` \- Loads health timeline  
- `healthSend()` \- Sends chat message to health assistant  
- `healthLoadReports()` \- Loads health reports

---

### `background-workers.js`

**Module Overview:** Background worker management. Monitors and controls background agents running in the system.

**Key Functions:**

- `fetchBackgroundWorkersStatus()` \- Gets worker status  
- `renderBackgroundWorkersPanel()` \- Renders worker panel  
- `handleBackgroundWorkerAction()` \- Controls worker (pause/resume/stop)  
- `stopAllBackgroundWorkers()` \- Stops all workers

---

## Documentation Notes

### Naming Conventions

- `_privateFunction()` \- Private/internal functions  
- `window.moduleFunction()` \- Public API exposed globally  
- `_state` \- Module internal state  
- `API_BASE` \- Global API endpoint base

### State Storage

- `localStorage` \- Client-side persistence  
- `sessionStorage` \- Session-only data  
- `_importedFiles`, `_checkedShared` \- In-memory state maps

### Event System

- `olivia:lang-changed` \- Language change event  
- `LA8159:panel-context-updated` \- Panel context update  
- `LA8159:pinned-paths-updated` \- Pinned paths update

# 

# 

# Olivia Workspace JavaScript Modules \- Complete Documentation (Part 2\)

## Navigation & Core UI Modules

### `trunk.js`

**Module Overview:** Data-driven navigation "tree trunk" that replaces hardcoded sidebar sections. Fetches user profile from `/api/user/me` to determine which sections the user can see and renders both collapsed tree-branches and expanded tabs-dock.

**Key Functions:**

- `trunkRender()` \- Re-renders sidebar using last-loaded section data (called on language change)  
- `init()` \- Fetches user sections and builds navigation  
- `buildBranch()` \- Creates collapsed strip leaf for a section  
- `buildTab()` \- Creates expanded dock tab for a section  
- `render()` \- Renders both branches and tabs from allowed section IDs

---

### `nav.js`

**Module Overview:** Navigation bar and mobile menu functionality. Handles hamburger menu toggle, mobile layout adaptation, and active navigation link management.

**Key Functions:**

- `toggleMobileMenu()` \- Toggles mobile dropdown menu  
- `initMobile()` \- Initializes mobile event listeners  
- `applyMobileLayout()` \- Applies responsive layout based on viewport width  
- `updateActiveNavLink()` \- Highlights active navigation link  
- `switchNavTab()` \- Switches between top navigation tabs

---

### `modals.js`

**Module Overview:** Modal dialogs, forms, and UI overlays. Provides a unified API for showing confirmation, alert, loading, file picker, and settings modals.

**Key Functions:**

- `showCreateModal()` \- Opens agent creation modal  
- `closeModal()` \- Closes modal and resets fields  
- `showConfirmationModal()` \- Shows confirmation dialog with callbacks  
- `showAlertModal()` \- Shows alert dialog  
- `showLoadingModal()` / `hideLoadingModal()` \- Loading overlay  
- `validateModalForm()` \- Validates form inputs  
- `resetModalForm()` \- Resets form to initial state

---

## Feature Modules

### `spaces.js`

**Module Overview:** AURA Spaces \- Contracts, Ontology & Analysis Workspace. Manages a registry of 24 contracts organized in 5 layers (Foundation, Input Processing, Pipeline Synthesis, Human Interface, Ecosystem Integration). Provides contract browsing, validation, ontology exploration, and analysis tools.

**Key Functions:**

- `spacesShowView()` \- Opens Spaces view  
- `spBuildTree()` \- Builds sidebar contract tree  
- `spSelectContract()` \- Opens contract detail  
- `spValidateAll()` \- Runs validation across all contracts  
- `spAddToContext()` \- Adds contract to chat context  
- `spSendChat()` \- Sends message to Spaces assistant  
- `spShowOntology()` \- Displays pipeline ontology view  
- `spShowTools()` \- Shows analysis tools panel

---

### `shaders.js`

**Module Overview:** Scene Creation, Editing & VFX Workspace. Manages SVG scene gallery, preview rendering, post-processing effects, world state (time of day, era, weather), and brainstorm chat with AI agent. Supports both 2D SVG and 3D/WebGL modes.

**Key Functions:**

- `shadersShowView()` \- Opens Shaders view  
- `shSelectScene()` \- Selects and renders a scene  
- `shRenderPreview()` \- Renders SVG scene with animation  
- `shStartPreviewLoop()` \- Starts animated preview loop  
- `shBrainSend()` \- Sends message to VFX agent  
- `shApplyPostFxObject()` \- Applies post-processing effects  
- `shSetWorldTimeSpeed()` \- Controls animation speed  
- `shSetEra()` \- Changes scene era (1200-2025)  
- `shExportScene()` \- Exports scene as JSON

---

### `scene3d.js`

**Module Overview:** Three.js / WebGL 3D Scene Engine for Kout Shaders. Loads GLB models, manages environment presets, animation mixing, orbit controls, transform controls (gizmo), and hybrid 2D+3D overlay mode.

**Key Functions:**

- `sh3dActivate()` \- Initializes 3D renderer and starts loop  
- `sh3dLoadGLB()` \- Loads GLB model from URL  
- `sh3dUploadGLB()` \- Uploads and loads GLB file  
- `sh3dSetEnvironment()` \- Applies environment preset  
- `sh3dToggleAnimation()` \- Play/pause animation  
- `sh3dAddModel()` \- Adds GLB without clearing scene  
- `sh3dAddPrimitive()` \- Adds built-in primitive (box, sphere, etc.)  
- `sh3dGetState()` \- Returns full 3D state snapshot  
- `sh3dRestoreState()` \- Restores 3D state from snapshot

---

### `mobile.js`

**Module Overview:** Mobile touch enhancements for Olivia Workspace. Provides swipe-to-open sidebar, auto-resize textareas, lazy loading, and keyboard shortcuts.

**Key Functions:**

- Touch gesture handling for sidebar swipe  
- `autoResize()` \- Auto-resizes textarea on input  
- `isMobileDevice()` \- Detects mobile device  
- Lazy loading for heavy panels

---

### `logger.js`

**Module Overview:** AURA Debug Logger \- Intercepts all fetch() calls and provides structured console output. Color-coded groups for requests, responses, registry events, and streaming events.

**Key Functions:**

- Configurable via `OliviaLegal.verbose`, `OliviaLegal.enabled`, `OliviaLegal.filter`, `OliviaLegal.noisy`  
- Intercepts fetch() and wraps with logging  
- Redacts sensitive headers (Authorization, API keys)  
- Suppresses high-frequency logs (remote-bus, blob URLs)  
- `OliviaLegal.log()` \- Structured logger API

---

### `generate-section.js`

**Module Overview:** CLI tool for generating new workspace sections. Creates a fully functional section JS file, matching CSS stylesheet, and updates the section registry.

**Usage:** `node generate-section.js --spec='{"id":"kanban","label":"Kanban","icon":"fa-columns"}' --outDir=./sections --registry=./registry.json`

**Key Functions:**

- `generateJS()` \- Generates section JavaScript template  
- `generateCSS()` \- Generates section CSS template  
- `updateRegistry()` \- Updates section registry JSON

---

### `modals.js` (additional details)

**Key Functions (continued):**

- `createProject()` \- Creates new project  
- `createQdrantCollection()` \- Creates Qdrant vector collection  
- `createNeo4jDb()` \- Configures Neo4j database  
- `renderCsvTable()` \- Renders CSV as HTML table  
- `loadSharedScopes()` \- Loads shared scopes for modal  
- `loadExistingQdrantCollections()` \- Populates collection dropdown

---

## Data Files

### `skill-index.json`

**Module Overview:** Static skill index for agent skill dropdown. Contains IDs of available skills for agent configuration.

**Content:** Array of skill IDs: "code-generation", "file-system", "refactoring", "testing", "vite-builder", "vue3-migration"

---

### `section-registry.json`

**Module Overview:** Canonical section registry for the sidebar. Defines all available workspace sections with their IDs, labels, icons, and optional onclick handlers.

**Content:** 22 sections including agents, config, docs, shared, legalrouter, violations, lawlib, masterindex, memory, history, files, projects, casebuilder, studio, descoberta, listening, spaces, shaders, apiexplorer, craudio, drive, writer.

---

### `gdrive.js`

**Module Overview:** Google Drive backend router (Express). Handles OAuth2 authentication, file listing, upload, download, deletion, folder creation, and statistics.

**Key Functions (server-side):**

- `/auth` \- Initiates OAuth2 flow  
- `/oauth2callback` \- OAuth callback handler  
- `/status` \- Returns auth status  
- `/files` \- Lists files in folder  
- `/upload` \- Uploads file  
- `/download` \- Downloads file by ID  
- `/delete` \- Trashes file  
- `/mkdir` \- Creates folder  
- `/stats` \- Returns storage usage stats  
- `/rclone-auth-url` \- Returns OAuth URL for manual setup  
- `/rclone-auth-code` \- Exchanges code for tokens

---

## Legal & Intelligence Modules

### `legal-router.js`

**Module Overview:** Legal route resolver for LA8159 0\_agents. Resolves violation IDs, framework codes, and person IDs to structured context with files.

**Key Functions:**

- `legalRouterInit()` \- Checks availability  
- `legalRouterResolve()` \- Resolves query to route  
- `legalRouterAttachResolved()` \- Attaches resolved context to chat  
- `legalRouterSetRoleFilter()` \- Filters by role  
- `legalRouterSelectAllVisible()` \- Selects/deselects visible files  
- `legalRouterShowView()` \- Opens Legal Router view

---

### `master_index.js`

**Module Overview:** Jurisprudence Index Explorer. Loads `master_index.json` and `master_index.md` from `data/master_index/` and provides sidebar navigation, tribunal/search filters, and detail viewer with attach-to-chat actions.

**Key Functions:**

- `masterIndexInit()` \- Loads index data  
- `masterIndexFilterCourt()` \- Filters by tribunal  
- `masterIndexSearch()` \- Searches documents  
- `masterIndexSelectDoc()` \- Opens document detail  
- `masterIndexAttachActive()` \- Attaches to chat context  
- `masterIndexShowView()` \- Opens Master Index view

---

### `violations.js` (additional details)

**Key Functions (additional):**

- `violationsOpenBranded()` \- Opens branded HTML view  
- `violationsOpenEvidenceSource()` \- Opens evidence source file  
- `violationsAttachReport()` \- Attaches report to context  
- `violationsClearContext()` \- Clears all attached context  
- `violationsToggleSidebar()` \- Toggles sidebar visibility

---

### `law_library.js` (additional details)

**Key Functions (additional):**

- `lawLibRefresh()` \- Refreshes library data  
- `lawLibFilterJur()` \- Filters by jurisdiction  
- `lawLibSearch()` \- Searches sources  
- `lawLibShowWelcome()` \- Returns to welcome view  
- `lawLibAttachActive()` \- Attaches source to context

---

## Utility Modules

### `context-config.js`

**Module Overview:** User-facing context file selector. Allows users to configure which files are injected as context for the agent. Supports workspace+project, project-only, and custom selection modes.

**Key Functions:**

- `toggleContextConfigPanel()` \- Toggles panel visibility  
- `loadContextConfig()` \- Loads configuration from backend  
- `renderContextConfig()` \- Renders file selection UI  
- `onContextScopeChange()` \- Handles scope selection  
- `toggleContextFile()` \- Toggles individual file selection  
- `previewContextContent()` \- Previews what agent will receive  
- `saveContextConfig()` \- Saves configuration to backend

---

### `architecture.js`

**Module Overview:** Agent Architecture browser. Surfaces agents from `vps_projects_/agent-architecture` as a launcher grid with deep-links into matching in-app modules. Talks to `/api/architecture/*` endpoints.

**Key Functions:**

- `archLoad()` \- Loads architecture data  
- `archDeployAgent()` \- Deploys agent bundle  
- `archDeployGroup()` \- Deploys group of agents  
- `archShowDetails()` \- Shows agent specification  
- `architectureOpenLa8159Console()` \- Opens full console  
- `architectureShowView()` \- Opens Architecture view

---

### `api-explorer.js`

**Module Overview:** API Explorer \- Interactive panel for browsing mapped functions, viewing endpoint flow diagrams, and chatting with API-aware agent. Integrates with `Olivia_FUNCTIONS` registry.

**Key Functions:**

- `aexInit()` \- Initializes API Explorer  
- `aexSearchFunctions()` \- Searches functions  
- `aexShowDetail()` \- Shows function detail  
- `aexTestInBrowser()` \- Opens interactive test form  
- `aexSendChat()` \- Sends API-related chat  
- `aexSwitchView()` \- Switches between views (functions, diagram, MCP, agent)  
- `aexShowMain()` \- Expands to main area

---

### `remote-bus-desktop.js`

**Module Overview:** Remote Bus Consumer for desktop. Long-polls `/api/olivia/remote-bus` for commands sent by mobile.html and applies them to shaders view. Supports sh3d-call, sh-call, meshy-open, send-chat, fullscreen, rec commands.

**Key Functions:**

- `invokeWhitelisted()` \- Invokes whitelisted functions  
- `apply()` \- Applies remote command  
- `publishSnapshot()` \- Periodically publishes preview state  
- `loop()` \- Long-polling loop

---

### `runpod-workspace-ui.js`

**Module Overview:** Olivia CEL RunPod Workspace UI \- Floating action button and modal for deploying GPU workspaces to RunPod. Supports repository URL, GPU selection, port configuration, and deployment.

**Key Functions:**

- `init()` \- Initializes UI components  
- `openModal()` \- Opens deployment wizard  
- `deployWorkspace()` \- Deploys workspace  
- `pollWorkspaceStatus()` \- Polls deployment status  
- `fetchGPUOptions()` \- Fetches available GPUs  
- `closeModal()` \- Closes modal

---

### `preview-recorder.js`

**Module Overview:** Records the visible preview canvas while in fullscreen mode. Uses `canvas.captureStream()` \+ `MediaRecorder` to capture webm video.

**Key Functions:**

- `toggle()` \- Start/stop recording  
- `drawCompositeFrame()` \- Captures SVG \+ 3D composite  
- `pickMime()` \- Selects supported MIME type  
- `_exportMermaidPng()` / `_exportMermaidSvg()` \- Diagram export

---

### `fullscreen-controls.js`

**Module Overview:** Auto-hiding overlay for essential actions while shaders preview is in fullscreen. Provides play/pause, wireframe toggle, environment selection, exposure control, record, chat, remote, and exit buttons.

**Key Functions:**

- `build()` \- Creates overlay controls  
- `bindHandlers()` \- Wire control buttons  
- `syncPlayIcon()` \- Syncs play/pause icon state  
- `bindRecMirror()` \- Mirrors REC button state

---

### `meshy-ui.js`

**Module Overview:** Shaders view integration for Meshy MCP server. Drafts natural-language instructions for the agent to call Meshy tools (text-to-3D, image-to-3D, rigging, task import).

**Key Functions:**

- `meshyOpenModal()` \- Opens Meshy modal  
- `meshyCloseModal()` \- Closes modal  
- `meshySwitchTab()` \- Switches between text/image/import tabs  
- `meshySubmit()` \- Submits request to agent

---

### `floating-chat.js`

**Module Overview:** Floating chat companion for shaders preview fullscreen. Mirrors shaders brainstorm chat (`_sh.brainMessages`) and routes input through `shBrainSend()`. Draggable and resizable.

**Key Functions:**

- `togglePanel()` \- Open/close floating chat  
- `sendFromFloating()` \- Sends message via shBrainSend  
- `syncMirror()` \- Syncs messages from shBrainLog  
- `makeDraggable()` \- Enables drag and resize

---

### `olivia-pdf-export.js`

**Module Overview:** Renders the last assistant/agent response as a branded, print-ready PDF document. Matches the Olivia design system with Fraunces, Plus Jakarta Sans, JetBrains Mono fonts and olive-branch mark.

**Key Functions:**

- `downloadLastResponseAsPdf()` \- Exports last response as PDF  
- Uses Olivia brand kit (`OLIVIA_PDF_BRAND`)  
- Creates iframe and triggers print dialog

---

### `case-dossier-view.js`

**Module Overview:** Consolidated case documentation surface. Loads from `/api/case/dossier` and `/api/case/documents` to display summary cards, indices catalog, and curated document list with group organization.

**Key Functions:**

- `caseDossierShowView()` \- Opens dossier view  
- `_load()` \- Loads dossier data  
- `_renderOverview()` \- Renders case summary  
- `_renderIndices()` \- Renders index catalog  
- `_renderTimeline()` \- Renders event timeline  
- `_exportBundle()` \- Exports selected documents as ZIP

---

### `section-views.js`

**Module Overview:** Shared helpers for `.vw-*` main views (violations, lawlib, legalrouter). Provides drag-to-resize sidebar, file action pills (Preview/Output/Browser), and article card rendering.

**Key Functions:**

- `vwInitResize()` \- Drag-to-resize sidebar  
- `vwFilePills()` \- Builds 3-pill action bar  
- `vwArticleCard()` \- Renders unified article card  
- `vwBuildViolationBrandedHtml()` \- Builds branded violation HTML  
- `vwOpenBrandedHtml()` \- Opens branded HTML in browser

---

### `section-generator.js`

**Module Overview:** Dynamic workspace section generator. Allows users to generate new sidebar sections via UI. Calls `/api/skills/generate-section` to create section files.

**Key Functions:**

- `sectionGenOpenModal()` \- Opens generation modal  
- `sectionGenSubmit()` \- Submits spec to backend  
- `buildModal()` \- Creates modal UI

---

## Stub/Utility Files

### `state.js`

Global state stub \- placeholder for state management logic.

### `utils.js`

Global utils stub \- placeholder for utility functions.

---

## Module Dependencies

core/

├── config.js          → API\_BASE, agents, selectedAgent, chatHistory

├── core.js            → escapeHtml, formatBytes, toast, customPrompt/Confirm

├── api-client.js      → LA8159API (33 functions across 9 groups)

└── logger.js          → fetch interceptor, OliviaLegal.\* config

chat/

├── stream.js          → sendMessage, runStream, tool handling

└── history.js         → chat persistence, load/save/export

sidebar/

├── tabs.js            → switchSidebarTab, toggleSidebar

└── trunk.js           → data-driven navigation

modules/

├── shaders.js         → SVG scene editor \+ brainstorm chat

├── scene3d.js         → Three.js 3D engine

├── spaces.js          → Contracts \+ ontology

├── discovery.js       → Document intelligence

└── listening.js       → Audio transcription

legal/

├── violations.js      → LA8159 violation explorer

├── law\_library.js     → Statute library

└── legal-router.js    → Legal route resolver

---

## Key State Variables

// From config.js

API\_BASE          // API endpoint base URL

agents            // Array of agent objects

selectedAgent     // Currently selected agent

chatHistory       // Chat message history

outputArtifacts   // Generated output artifacts

// From shaders.js

\_sh                // Full shaders state object

\_sh.previewState   // Time of day, era, weather, outline, morph

\_sh.postFx         // Bloom, vignette, grain, sepia, etc.

\_sh.customScenes   // User-created scenes

// From scene3d.js

\_s3                // 3D engine state (renderer, scene, camera, model)

\_s3.animActions    // Animation mixer actions

// From spaces.js

\_spContextContracts // Contracts in chat context

\_spValidationResults // Validation status per contract

