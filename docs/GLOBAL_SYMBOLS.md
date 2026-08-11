# Global Symbols

> Every symbol on `window.*` in the Olivia frontend. Generated from code inspection.
> **Confidence:** [verified] = confirmed in source; [inferred] = deduced from module structure.

---

## Runtime Namespace

```
window.LA8159 === window.Olivia === window.OliviaLegal   (merged object in config.js)
```

`config.js` merges all three into one object so modules can reference any name and hit the same namespace.

---

## API Client

| Symbol | Defined in | Description |
|--------|-----------|-------------|
| `window.LA8159API` | api-client.js | Central HTTP/SSE client. 28 functions in 10 namespaces. |
| `window.OliviaAPI` | api-client.js | Alias for LA8159API |

**LA8159API Namespaces:**
- `assistant` — `chat`, `models`, `resetSession`
- `agents` — `list`, `create`, `delete`, `activate`, `deactivate`, `export`, `import`
- `agent` — `run`, `stop`, `respond`
- `guided` — `resume`, `stop`
- `auditor` — `resume`, `stop`
- `chat` — `list`, `load`, `save`
- `memory` — `collections`, `createCollection`, `search`, `ingest`, `graphStats`
- `shared` — `scopes`, `file`
- `transcription` — `list`, `transcribe`, `whisperModels`, `search`

---

## Core Utilities (core.js)

| Symbol | Description |
|--------|-------------|
| `window.escapeHtml` | HTML entity escaping |
| `window.formatBytes` | Byte size formatting |
| `window.toast` | Toast notification |
| `window.Olivia_EMBED_MODE` | Embed mode flag |
| `window.initMobile` | Mobile init (also defined in nav.js, mobile.js) |
| `window.applyMobileLayout` | Mobile layout application |
| `window.customPrompt` | Custom prompt dialog |
| `window.customConfirm` | Custom confirm dialog |
| `window.linkifyPaths` | Path linkification |
| `window.autoGrow` | Textarea auto-grow |
| `window.makeEl` | DOM element factory |

## Navigation (nav.js)

| Symbol | Description |
|--------|-------------|
| `window.toggleMobileMenu` | Mobile menu toggle |
| `window.initMobile` | Mobile init -- **duplicate**: also in core.js, mobile.js |
| `window.applyMobileLayout` | Mobile layout -- **duplicate**: also in core.js |
| `window.updateActiveNavLink` | Update active nav link |
| `window.switchNavTab` | Switch nav tab |

## Sidebar (trunk.js, tabs.js)

| Symbol | Description |
|--------|-------------|
| `window.trunkRender` | Render sidebar from /api/user/me |
| `window.__trunkLoaded` | Trunk loaded flag |
| `window.initTabsDock` | Init tabs dock |
| `window.switchSidebarTab` | Switch sidebar tab |
| `window.toggleSidebar` | Toggle sidebar |
| `window.openSidebarToTab` | Open sidebar to specific tab |
| `window.toggleMobileSidebar` | Mobile sidebar toggle |
| `window.showMobileTrunk` | Show mobile trunk |
| `window.toggleFocusMode` | Toggle focus mode |
| `window.initSidebarResize` | Init sidebar resize |
| `window.initSidebarClickOutside` | Init click-outside handler |
| `window.updateActiveBranch` | Update active branch indicator |

## Chat Engine (stream.js)

| Symbol | Description |
|--------|-------------|
| `window.showChatView` | Show chat view |
| `window.showWelcomeView` | Show welcome view |
| `window.sendMessage` | Send a chat message |
| `window.runStream` | Start SSE stream |
| `window.stopStream` | Stop current stream |
| `window.stopActiveStream` | Stop active stream |
| `window.useHint` | Use a hint |
| `window.addSystemBubble` | Add system bubble |
| `window.loadSavedChat` | Load saved chat |
| `window.copyLastAssistantMessage` | Copy last assistant message |
| `window.exportLastMessageTxt` | Export last message as text |
| `window.clearChat` | Clear chat |
| `window.buildSelectedPanelContext` | Build panel context payload |
| `window.getPanelContextSelectionSummary` | Get context selection summary |
| `window.formatPanelContextLabel` | Format context label |
| `window.cflOpenPreview` | Open CFL preview |
| `window.cflOpenOutput` | Open CFL output |
| `window.cflOpenBrowser` | Open CFL browser |
| `window.koutPinPath` | Pin a path |
| `window.koutUnpinPath` | Unpin a path |
| `window.koutIsPinned` | Check if path is pinned |
| `window.onStep` | Stream step callback |
| `window.onCheckpoint` | Stream checkpoint callback |
| `window.onToolCall` | Tool call callback |
| `window.onToolResult` | Tool result callback |
| `window.onDone` | Stream done callback |
| `window.onError` | Stream error callback |

## Agent System (agents.js, agent-orchestration.js)

| Symbol | Description |
|--------|-------------|
| `window.loadAgents` | Load agent list |
| `window.renderAgentList` | Render agent list UI |
| `window.selectAgent` | Select an agent |
| `window.deleteAgent` | Delete agent |
| `window.importAgentMd` | Import agent from markdown |
| `window.exportAgentMd` | Export agent to markdown |
| `window.showCreateModal` | Show create agent modal |
| `window.showEditModal` | Show edit agent modal |
| `window.closeModal` | Close modal |
| `window.submitCreateAgent` | Submit create agent form |
| `window.runPluginSetup` | Run plugin setup |
| `window.refreshInvestigationBoard` | Refresh investigation board |
| `window.oliviaSyncSectionAgentRuntime` | Sync section agent runtime |
| `window.oliviaResolveSectionAgentContext` | Resolve section agent context |
| `window.oliviaOnPrimaryAgentSelected` | Handle primary agent selection |
| `window.oliviaSetSectionAgentAssignment` | Set section agent assignment |
| `window.oliviaGetSectionAgentAssignment` | Get section agent assignment |
| `window.oliviaGetAssignedAgentForSection` | Get assigned agent for section |
| `window.oliviaRefreshSectionRuntimeUi` | Refresh section runtime UI |
| `window.LA8159ResolveSectionAgentContext` | LA8159 section agent context |
| `window.LA8159SetSectionAgentAssignment` | LA8159 set section agent |
| `window.LA8159GetSectionAgentAssignment` | LA8159 get section agent |

## Documents (docs.js)

| Symbol | Description |
|--------|-------------|
| `window.openPreviewUrl` | Open preview URL |
| `window.openDocFile` | Open document file |
| `window.resolvePreviewFileType` | Resolve preview file type |
| `window.renderRichMarkdownHtml` | Render markdown to HTML |
| `window.renderDocxIntoElement` | Render DOCX into element |
| `window.loadDocsTree` | Load docs tree |
| `window.renderDocsNodes` | Render docs nodes |
| `window.toggleDocsDir` | Toggle docs directory |
| `window.toggleLawFileArticles` | Toggle law file articles |
| `window.loadSharedDataTree` | Load shared data tree |
| `window.toggleSharedDir` | Toggle shared directory |
| `window.searchSharedData` | Search shared data |
| `window.togglePreviewPanel` | Toggle preview panel |
| `window.sharedOpenFilePreview` | Open shared file preview |
| `window.sharedOpenFileOutput` | Open shared file output |
| `window.sharedOpenFileBrowser` | Open shared file browser |
| `window.sharedOpenLawArticlePreview` | Open law article preview |
| `window._previewState` | Preview state object |

## Shared Resources (shared.js)

| Symbol | Description |
|--------|-------------|
| `window._checkedShared` | Checked shared items |
| `window._importedFiles` | Imported files |
| `window._contextSessionFiles` | Context session files |
| `window._sessionBulkSelection` | Session bulk selection |
| `window._sessionStateScheduleSave` | Schedule session state save |
| `window._sessionStateSaveNow` | Save session state now |
| `window._sessionStateHydrate` | Hydrate session state |
| `window._sessionSetFilter` | Set session filter |
| `window._sessionSetSort` | Set session sort |
| `window._sessionToggleContext` | Toggle context |
| `window._sessionToggleBulk` | Toggle bulk mode |
| `window._sessionBulkAttach` | Bulk attach |
| `window._sessionBulkDelete` | Bulk delete |
| `window._sessionBulkDownload` | Bulk download |
| `window.getImportedFilesContext` | Get imported files context |
| `window.getSharedContext` | Get shared context |
| `window.handleFileUpload` | Handle file upload |
| `window.handleCaseFiles` | Handle case files |
| `window.handleBundleFile` | Handle bundle file |
| `window.previewSharedFile` | Preview shared file |
| `window.renderCaseFiles` | Render case files |
| `window.renderSessionFiles` | Render session files |
| `window.downloadFile` | Download file |
| `window.clearCaseFiles` | Clear case files |
| `window.attachContextBadgeHandlers` | Attach context badge handlers |
| `window.showContextBadgeModal` | Show context badge modal |

## Memory (memory.js)

| Symbol | Description |
|--------|-------------|
| `window.memoryShowView` / `window.memoryHideView` | Memory panel visibility |
| `window.mvRefreshAll` | Refresh all memory |
| `window.mvRefreshCollections` | Refresh collections |
| `window.mvSearch` | Search memory |
| `window.mvDoIngest` | Ingest documents |
| `window.mvDoIngestArticles` | Ingest articles |
| `window.mvDoIngestViolation` | Ingest violation |
| `window.mvDoIngestGraph` | Ingest to graph |
| `window.mvSwitchPanel` | Switch memory panel |
| `window.mvLoadRoutingConfig` | Load routing config |
| `window.mvSaveRoutingConfig` | Save routing config |
| `window.mvOpenQdrantDashboard` | Open Qdrant dashboard |
| `window.mvOpenNeo4jConsole` | Open Neo4j console |
| `window.mvOpenCollectionDetails` | Open collection details |
| `window.mvCreateCollection` | Create collection |
| `window.mvQuickSearch` | Quick search |
| `window.mvSendChat` | Send chat from memory |
| `window.mvAddToShortMemory` | Add to short memory |
| `window.renderAgentMemoryInfo` | Render agent memory info |
| `window.mvLoadOverview` / `window.mvLoadConfig` / `window.mvSaveConfig` | Memory config |

## Legal System

| Symbol | Description |
|--------|-------------|
| `window.violationsInit` | Init violations |
| `window.violationsRefresh` | Refresh violations |
| `window.violationsSelect` / `window.violationsSelectById` | Select violation |
| `window.violationsShowView` / `window.violationsHideView` | Violations visibility |
| `window.violationsFilterJur` / `window.violationsFilterSeverity` / `window.violationsFilterPhase` | Filters |
| `window.violationsSearch` | Search violations |
| `window.violationsAttachActive` / `window.violationsAttachReport` | Attach to context |
| `window.violationsClearContext` | Clear violations context |
| `window.lawLibInit` / `window.lawLibRefresh` / `window.lawLibSelect` | Law library |
| `window.lawLibShowView` / `window.lawLibHideView` | Law library visibility |
| `window.masterIndexInit` / `window.masterIndexRefresh` / `window.masterIndexSelectDoc` | Master index |
| `window.masterIndexShowView` / `window.masterIndexHideView` | Master index visibility |
| `window.legalRouterInit` / `window.legalRouterResolve` | Legal router |
| `window.legalRouterShowView` / `window.legalRouterHideView` | Legal router visibility |
| `window.caseDossierOpen` / `window.caseDossierClose` / `window.caseDossierRefresh` | Case dossier |
| `window.caseDossierShowView` / `window.caseDossierHideView` | Case dossier view |

## History & Config (history.js)

| Symbol | Description |
|--------|-------------|
| `window.loadChatHistory` | Load chat history |
| `window.loadChatFromServer` | Load chat from server |
| `window.renderSavedChatsList` | Render saved chats |
| `window.loadSavedChat` / `window.loadSavedChatByName` | Load saved chat |
| `window.saveChat` / `window.autoSaveChat` / `window.saveToServer` | Save chat |
| `window.exportChatTxt` / `window.exportChatJson` | Export chat |
| `window.deleteSavedChat` | Delete saved chat |
| `window.loadModelCatalog` | Load model catalog |
| `window.switchModel` | Switch model |
| `window.renderModelCards` | Render model cards |
| `window.selectProvider` | Select provider |
| `window.getCustomApiKey` | Get custom API key |
| `window.getConfig` | Get config |
| `window.updateCostBadge` / `window.resetCostBadge` | Cost tracking |
| `window.setModelTemperature` / `window.setMaxTokens` | Model params |

## 3D / Shaders (shaders.js, scene3d.js)

| Symbol | Description |
|--------|-------------|
| `window.sh3dActivate` / `window.sh3dDeactivate` / `window.sh3dIsActive` | 3D lifecycle |
| `window.sh3dLoadGLB` / `window.sh3dUploadGLB` | Model loading |
| `window.sh3dSetEnvironment` / `window.sh3dResetCamera` | Environment |
| `window.sh3dApplyConfig` / `window.sh3dExportConfig` | Config |
| `window.sh3dExportUSDZ` | USDZ export |
| `window.sh3dSelect` / `window.sh3dGetSelected` / `window.sh3dListObjects` | Selection |
| `window.sh3dSetTransformMode` | Transform mode |
| `window.sh3dFocusExtra` / `window.sh3dRemoveExtra` / `window.sh3dClearExtras` | Extras |
| `window.shadersShowView` / `window.shadersHideView` | Shaders visibility |
| `window.shBrainSend` / `window.shBrainStop` | Brain chat |
| `window.shApplySceneFromChat` / `window.shApplyCodeFromChat` | Chat integration |
| `window.shCreateScene` / `window.shDeleteScene` | Scene CRUD |
| `window.shToggleFullscreen` | Fullscreen toggle |
| `window.shCapturePNG` | Capture PNG |
| `window.THREE` | Three.js library reference |

## Feature Modules (studio, api-explorer, output, comfyui, etc.)

| Symbol | Source | Description |
|--------|--------|-------------|
| `window.studioShowView` / `window.studioHideView` | studio.js | Studio visibility |
| `window.studioUpdatePreview` | studio.js | Update preview |
| `window.studioFormatCode` / `window.studioApplyCode` | studio.js | Code tools |
| `window.studioSendAiMsg` | studio.js | Send to AI |
| `window.aexInit` | api-explorer.js | Init API explorer |
| `window.aexSearchFunctions` | api-explorer.js | Search functions |
| `window.aexExecuteMcpTool` | api-explorer.js | Execute MCP tool |
| `window.aexHideMain` | api-explorer.js | Hide explorer |
| `window.comfyuiShowView` / `window.comfyuiHideView` | comfyui-workflow.js | ComfyUI visibility |
| `window.comfyuiImportWorkflow` / `window.comfyuiExportWorkflow` | comfyui-workflow.js | Import/export |
| `window.openBrowserPanel` / `window.closeBrowserPanel` | output.js | Browser panel |
| `window.shareBrowserPageWithAgent` | output.js | Share page with agent |
| `window._injectBrowserBridge` | output.js | Browser bridge injection |
| `window.writerShowView` / `window.writerHideView` | writer.js | Writer visibility |
| `window.writerExport` | writer.js | Export document |
| `window.sheetsShowView` / `window.sheetsHideView` | sheets.js | Sheets visibility |
| `window.sheetsExport` | sheets.js | Export sheet |
| `window.sectionGenOpenModal` | section-generator.js | Section generator modal |

## Panel Pattern (showView/hideView)

Every panel module follows the same visibility pattern:
- `{section}ShowView()` — show the section panel
- `{section}HideView()` — hide the section panel

Additional panels: `architecture`, `spaces`, `craudio`, `social-media`, `drive`, `health`, `outreach`, `discovery`, `listening`, `mermaid`

## Static Configuration

| Symbol | Defined in | Description |
|--------|-----------|-------------|
| `window.Olivia_ENDPOINTS` | endpoints-config.js | 19 service category configurations |
| `window.Olivia_BASE_URLS` | endpoints-config.js | Base URL mappings |
| `window.Olivia_FUNCTIONS` | agent-functions-registry.js | Runtime function registry from /api/functions |
| `window.isMobileDevice` | mobile.js | Mobile device detection |

---

## Duplicate Definitions (Phase 4 target)

| Symbol | Files | Risk |
|--------|-------|------|
| `window.initMobile` | core.js, nav.js, mobile.js | Last-load wins |
| `window.applyMobileLayout` | core.js, nav.js | Last-load wins |
| `window.formatBytes` | core.js, files.js | Last-load wins |

---

## Statistics

- **Total window.* symbols:** ~400+ across 56 modules
- **Most exported:** shaders.js (~100+), docs.js (~100+), stream.js (~70+)
- **No exports:** logger.js, modals.js, background-workers.js, fullscreen-controls.js, remote-bus-desktop.js
- **Bidirectional dependency:** shaders.js <-> scene3d.js
