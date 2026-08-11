# Global Symbols Inventory

> Auto-generated: 2026-08-11 | Project: Olivia Ecosystem (frontend SPA)
> **Confidence:** [verified] = line numbers confirmed in source; [inferred] = pattern-based identification.

---

## 1. Load Order

The HTML file `frontend/index.html` loads scripts in this exact order. A `<base href="/olivia/" />` tag is set on line 8.

### 1.1 External CDN dependencies (lines 23-27)

| # | Source |
|---|--------|
| 1 | `cdn.jsdelivr.net/npm/marked@9/marked.min.js` |
| 2 | `cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js` |
| 3 | `cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js` |
| 4 | `cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` |
| 5 | `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` |

### 1.2 Three.js import map (lines 29-87)

| # | Description |
|---|-------------|
| 6 | `<script type="importmap">` — Three.js CDN import map |

### 1.3 Inline scripts (non-module)

| # | Lines | Description |
|---|-------|-------------|
| 7 | 88-107 | `btoa` / `atob` polyfill for non-browser environments |
| 8 | 109 | Mermaid.js initialization |
| 9 | 139 | i18n init + `window.t()` translation function |
| 10 | 6861 | Voice recording (SpeechRecognition) panel: `window.voiceTogglePanel`, `window.voiceToggleQuick`, `window.voiceOpenPanel` |
| 11 | 7294 | TTS (Text-to-Speech) panel: `window.ttsReadText`, `window.ttsReadMessage`, `window.ttsPlayPause`, `window.ttsStop`, `window.ttsSkipForward`, `window.ttsSkipBack`, `window.ttsSetSpeed`, `window.ttsToggleAuto` |
| 12 | 7671 | Pinned paths bar renderer (listens to `Kout_Stream:pinned-paths-updated`) |
| 13 | 7746 | `window.copyPanelContent()` utility |

### 1.4 Renderer/editor CDN (lines 108-145)

| # | Source |
|---|--------|
| 14 | `cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js` |
| 15 | `cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js` |
| 16 | `cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cypher.min.js` |

### 1.5 Editor CDN (lines 6754-6756)

| # | Source |
|---|--------|
| 17 | `cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js` |
| 18 | `.../codemirror/6.65.7/addon/edit/matchbrackets.js` |
| 19 | `.../codemirror/6.65.7/addon/edit/closebrackets.js` |

### 1.6 Application modules (load order, lines 6739-6806)

| # | File | Category |
|---|------|----------|
| 1 | `js/lib/logger.js` | core |
| 2 | `js/config.js` | core |
| 3 | `js/lib/api-client.js` | core |
| 4 | `js/core.js` | core |
| 5 | `js/nav.js` | core |
| 6 | `js/trunk.js` | sidebar |
| 7 | `js/modals.js` | core |
| 8 | `js/sidebar/tabs.js` | sidebar |
| 9 | `js/chat/stream.js` | chat |
| 10 | `js/modules/agents.js` | agents |
| 11 | `js/modules/background-workers.js` | agents |
| 12 | `js/modules/agent-orchestration.js` | agents |
| 13 | `js/modules/architecture.js` | panels |
| 14 | `js/modules/docs.js` | sidebar |
| 15 | `js/modules/mermaid.js` | feature |
| 16 | `js/modules/shared.js` | sidebar |
| 17 | `js/modules/section-views.js` | panels |
| 18 | `js/modules/legal-router.js` | legal |
| 19 | `js/modules/violations.js` | legal |
| 20 | `js/modules/law_library.js` | legal |
| 21 | `js/modules/master_index.js` | legal |
| 22 | `js/modules/memory.js` | panels |
| 23 | `js/modules/history.js` | feature |
| 24 | `js/modules/files.js` | sidebar |
| 25 | `js/modules/projects.js` | projects |
| 26 | `js/modules/output.js` | feature |
| 27 | `js/modules/studio.js` | feature |
| 28 | `js/modules/discovery.js` | panels |
| 29 | `js/modules/listening.js` | panels |
| 30 | `js/modules/drive.js` | panels |
| 31 | `js/modules/sheets.js` | panels |
| 32 | `js/modules/social-media.js` | panels |
| 33 | `js/modules/endpoints.js` | feature |
| 34 | `js/modules/endpoints-config.js` | feature |
| 35 | `js/modules/endpoint-widget.js` | feature |
| 36 | `js/modules/api-explorer.js` | feature |
| 37 | `js/modules/agent-functions-registry.js` | feature |
| 38 | `js/modules/writer.js` | panels |
| 39 | `js/modules/meshy-ui.js` | feature |
| 40 | `js/modules/floating-chat.js` | feature |
| 41 | `js/modules/fullscreen-controls.js` | feature |
| 42 | `js/modules/preview-recorder.js` | feature |
| 43 | `js/modules/runpod-workspace-ui.js` | feature |
| 44 | `js/modules/comfyui-workflow.js` | feature |
| 45 | `js/modules/remote-bus-desktop.js` | feature |
| 46 | `js/modules/case-dossier.js` | legal |
| 47 | `js/modules/case-dossier-view.js` | legal |
| 48 | `js/modules/craudio.js` | panels |
| 49 | `js/modules/context-config.js` | feature |
| 50 | `js/modules/section-generator.js` | feature |
| 51 | `js/modules/health.js` | panels |
| 52 | `js/modules/outreach.js` | panels |
| 53 | `js/modules/user-prefs.js` | feature |
| 54 | `js/scene3d.js` | feature |
| 55 | `js/shaders.js` | panels |
| 56 | `js/spaces.js` | panels |
| 57 | `js/mobile.js` | core |
| 58 | `js/chat/olivia-pdf-export.js` | feature |

---

## 2. Window Exports by File

### 2.1 Foundation (core.js, config.js, api-client.js)

**core.js:**
- `window.Olivia` (obj) — runtime config namespace
- `window.LA8159` (obj) — alt runtime config namespace (merged: LA8159 === Olivia === OliviaLegal)
- `window.selectedAgent` (obj) — current selected agent state
- `window._previewState` (obj) — file preview state
- `window.escapeHtml` (fn) — HTML escaping
- `window.toast` (fn) — toast notification
- `window.addSystemBubble` (fn) — system chat bubble
- `window.customConfirm` (fn) — custom confirm dialog
- `window.sendMessage` (fn) — send chat message
- `window.getCustomApiKey` (fn) — get API key
- `window.formatBytes` (fn) — byte formatting
- `window.t` (fn) — i18n translation

**config.js:**
- `window.API_BASE` (str)
- `window.OLIVIA_TOKEN` (str)

**api-client.js:**
- `window.apiClient` (obj)
- `window.LA8159API` (obj) — 28 functions in 10 namespaces
- `window.OliviaAPI` (obj) — alias for LA8159API

**logger.js:**
- `window.Logger` (obj)
- `window.logger` (obj)

### 2.2 modals.js (line 6745)

| Symbol | Type |
|--------|------|
| `window.mvCreateCollection` | fn |
| `window.showCreateModal` | fn |
| `window.closeModal` | fn |
| `window.createProject` | fn |
| `window.createQdrantCollection` | fn |
| `window.createNeo4jDb` | fn |
| `window.studioOpenCfgModal` | fn |
| `window.closeBundleImportModal` | fn |
| `window.renderCsvTable` | fn |
| `window.loadSharedScopes` | fn |
| `window.loadExistingQdrantCollections` | fn |
| `window.showConfirmationModal` / `window.closeConfirmationModal` | fn |
| `window.showAlertModal` / `window.closeAlertModal` | fn |
| `window.showLoadingModal` / `window.hideLoadingModal` | fn |
| `window.showFilePickerModal` / `window.closeFilePickerModal` | fn |
| `window.showSettingsModal` / `window.closeSettingsModal` | fn |
| `window.toggleModalSection` | fn |
| `window.validateModalForm` / `window.resetModalForm` | fn |

### 2.3 chat/stream.js

| Symbol | Description |
|--------|-------------|
| `window.sendMessage` | Send chat message (overrides core.js) |
| `window.koutPinPath` / `window.koutUnpinPath` / `window.koutTogglePin` | Path pinning |
| `window.koutIsPinned` / `window.koutPinnedPaths` / `window.koutClearPinnedPaths` | Pinned paths |
| `window.buildPinnedPathsContext` | Build pinned context |
| `window.loadSavedChat` / `window.copyLastAssistantMessage` | Chat loading |
| `window.exportLastMessageTxt` / `window.downloadLastResponseAsPdf` | Export |
| `window.clearChat` | Clear chat |
| `window.setPanelContextEnabled` / `window.refreshPanelContextStatus` | Panel context |
| `window.getPanelContextSelectionSummary` / `window.formatPanelContextLabel` | Context labels |
| `window.buildSelectedPanelContext` | Build context payload |
| `window.toggleAssistantContextPreviewDebug` / `window.setAssistantContextPreviewDebug` / `window.getAssistantContextPreviewDebugEnabled` | Debug |
| `window.onStep` / `window.onCheckpoint` / `window.onAwaitingGuidance` | Stream callbacks |
| `window.addOutputArtifact` / `window.showOutputArtifactInPanel` | Output artifacts |
| `window.openStreamArtifact` / `window.openArtifactInBrowser` | Artifact display |

### 2.4 modules/shared.js

| Symbol | Description |
|--------|-------------|
| `window._checkedShared` (obj) | Checked shared state |
| `window._importedFiles` (arr) | Imported files |
| `window._contextSessionFiles` (obj) | Context session files |
| `window._sessionStateScheduleSave` / `window._sessionStateSaveNow` / `window._sessionStateHydrate` | Session persistence |
| `window._sessionSetFilter` / `window._sessionSetSort` | Session UI state |
| `window._sessionToggleContext` / `window._sessionToggleBulk` | Session toggles |
| `window._sessionBulkAttach` / `window._sessionBulkDelete` / `window._sessionBulkDownload` | Bulk operations |
| `window.getImportedFilesContext` / `window.getSharedContext` | Context accessors |
| `window.handleFileUpload` / `window.handleCaseFiles` / `window.handleBundleFile` | File import |
| `window.previewSharedFile` / `window.renderCaseFiles` / `window.renderSessionFiles` | Rendering |
| `window.downloadFile` / `window.clearCaseFiles` | File management |
| `window.attachContextBadgeHandlers` / `window.showContextBadgeModal` | Context badges |
| `window.updateComposeContextBar` / `window.updateSharedContextBar` | Context bars |
| `window.addSharedContextItem` / `window.clearAllSharedContext` | Context management |

### 2.5 modules/history.js

| Symbol | Description |
|--------|-------------|
| `window._modelCatalog` (obj) | Model catalog cache |
| `window._currentModel` (str) | Current model ID |
| `window.loadChatHistory` / `window.loadChatFromServer` | History loading |
| `window.renderSavedChatsList` | History UI |
| `window.loadSavedChat` / `window.loadSavedChatByName` | Load chat |
| `window.saveChat` / `window.autoSaveChat` / `window.saveToServer` | Save chat |
| `window.exportChatTxt` / `window.exportChatJson` | Export |
| `window.deleteSavedChat` | Delete chat |
| `window.loadModelCatalog` / `window.switchModel` / `window.renderModelCards` | Model management |
| `window.selectProvider` / `window.getCustomApiKey` / `window.verifyApiKey` | Provider/auth |
| `window.normalizeTemperature` / `window.normalizeMaxTokens` / `window.normalizeInvestigationRangeHours` | Params |
| `window.setModelTemperature` / `window.setMaxTokens` / `window.setInvestigationRangeHours` | Setters |
| `window.getConfig` | Config getter |
| `window.updateCostBadge` / `window.resetCostBadge` | Cost tracking |
| `window.formatDuration` | Formatting |

### 2.6 modules/projects.js

| Symbol | Description |
|--------|-------------|
| `window._agentProjectBindings` (obj) | Agent-project bindings |
| `window.OliviaProjectId` (str) | Current project ID |
| `window._PLANNING_FILES` (obj) | Planning files list |
| `window.loadProjects` / `window.createProject` / `window.selectProject` | Project CRUD |
| `window.getCurrentProjectId` / `window.refreshProjectIndex` | Accessors |
| `window.triggerProjectUpload` / `window.uploadProjectFiles` | Upload |
| `window.loadProjectFiles` / `window.syncProjectFromAgent` | Loading |
| `window.attachAgentToProject` | Agent binding |
| `window.exportProject` / `window.archiveProject` / `window.deleteProject` | Management |
| `window.fetchProjectFilesSnapshot` / `window.clearProjectFilesSnapshotCache` | Snapshots |
| `window.renderArquivosPanel` / `window.refreshArquivosPanel` | Panel UI |

### 2.7 modules/discovery.js (53 exports — largest surface)

`window.discShowView`, `window.discHideView`, `window.discLoadFiles`, `window.discLoadOverview`, `window.discLoadInsights`, `window.discLoadIntelligence`, `window.discLoadPipeline`, `window.discRefreshAll`, `window.discRenderFileList`, `window.discRenderFileTable`, `window.discRenderCategories`, `window.discRenderLanguages`, `window.discRenderDomains`, `window.discRenderTags`, `window.discRenderEntityList`, `window.discRenderEvents`, `window.discRenderTimeline`, `window.discRenderCaseState`, `window.discRenderNarrative`, `window.discRenderViolations`, `window.discRenderGapReport`, `window.discRenderComprehendOverview`, `window.discRenderComprehendGroups`, `window.discRenderCasePhase`, `window.discRenderCaseFindings`, `window.discRenderCaseNextSteps`, `window.discOpenFilePreview`, `window.discOpenFileOutput`, `window.discOpenFileBrowser`, `window.discFilterFiles`, `window.discFilterByCategory`, `window.discHandleDrop`, `window.discHandleFileSelect`, `window.discHandleFolderSelect`, `window.discHandleFiles`, `window.discClearFiles`, `window.discRemoveFile`, `window.discDeleteProjectFile`, `window.discStartProcessing`, `window.discRunIntelPipeline`, `window.discRunComprehension`, `window.discLoadComprehension`, `window.discExportData`, `window.discToggleMaximize`, `window.discToggleSub`, `window.discShowSection`, `window.discShowInsightsSub`, `window.discShowIntelSub`, `window.discSelectEtype`, `window.discUpdateStats`, `window.discEnrichedSearchRun`, `window.discLoadEvents`, `window.discUpdateActiveProjectLabel`

### 2.8 modules/spaces.js (46 exports)

`window.spacesShowView`, `window.spacesHideView`, `window.spToggleSection`, `window.spSetFilter`, `window.spSearch`, `window.spSelectContract`, `window.spToggleContractSection`, `window.spShowWelcome`, `window.spShowOntology`, `window.spToggleLayer`, `window.spShowValidation`, `window.spShowTools`, `window.spAddToContext`, `window.spRemoveFromContext`, `window.spRunValidation`, `window.spValidateAll`, `window.spResetValidation`, `window.spAnalyzeWith`, `window.spCopyContract`, `window.spLoadRawSource`, `window.spSendChat`, `window.spChatKeydown`, `window.spToggleChat`, `window.spSetChatMode`, `window.spHandleToolFiles`, `window.spHandleToolDrop`, `window.spToolExtract`, `window.spToolCompare`, `window.spToolChainTrace`, `window.spToolGapAnalysis`, `window.spToolBriefGen`, `window.spToolValidateDoc`, `window.spacesOpenContract`, `window.spacesRefresh`, `window.spacesCloseView`, `window.spacesToggleLeftPanel`, `window.spacesClosePreview`, `window.spacesClearContext`, `window.spacesSendMessage`, `window.spacesHandleCaseFiles`, `window.spacesValidateContracts`, `window.spacesExtractEntities`, `window.spacesGenerateReport`, `window.spBuildTree`, `window.spUpdateStats`, `window.spRenderChat`

### 2.9 js/scene3d.js (42+ exports)

`window.THREE` (obj), `window.sh3dActivate`, `window.sh3dDeactivate`, `window.sh3dIsActive`, `window.sh3dLoadGLB`, `window.sh3dUploadGLB`, `window.sh3dHandleFileInput`, `window.sh3dSetEnvironment`, `window.sh3dResetCamera`, `window.sh3dToggleWireframe`, `window.sh3dToggleAnimation`, `window.sh3dSetAnimSpeed`, `window.sh3dSelectClip`, `window.sh3dSetExposure`, `window.sh3dSetBgColor`, `window.sh3dToggleGrid`, `window.sh3dToggleGround`, `window.sh3dApplyConfig`, `window.sh3dExportConfig`, `window.sh3dExportUSDZ`, `window.sh3dGetState`, `window.sh3dRestoreState`, `window.sh3dGenerateCode`, `window.sh3dBuildBrainPrompt`, `window.sh3dCleanup`, `window.sh3dSetBackgroundImage`, `window.sh3dClearBackgroundImage`, `window.sh3dAddModel`, `window.sh3dAddPrimitive`, `window.sh3dClearExtras`, `window.sh3dListExtras`, `window.sh3dGetMainInfo`, `window.sh3dSelect`, `window.sh3dGetSelected`, `window.sh3dListObjects`, `window.sh3dSetTransformMode`, `window.sh3dGetTransformMode`, `window.sh3dSetGizmoVisible`, `window.sh3dToggleSelectionBox`, `window.sh3dPruneExtraByUrl`, `window.sh3dFocusExtra`, `window.sh3dSetHybrid2D`

### 2.10 Other notable exports

**section-views.js:** `window.vwArticleCard`, `window.vwBuildViolationBrandedHtml`, `window.vwBuildReportBrandedHtml`, `window.vwOpenBrandedHtml`, `window.vwEnter`, `window.vwLeave`, `window.vwFilePills`, `window.vwTextPills`, `window.vwInitResize`, `window.vwInitEdgeResize`

**violations.js:** `window.violationsInit`, `window.violationsRefresh`, `window.violationsSelect`, `window.violationsSelectById`, `window.violationsShowView`, `window.violationsHideView`, `window.violationsFilterJur`, `window.violationsFilterSeverity`, `window.violationsFilterPhase`, `window.violationsSearch`, `window.violationsAttachActive`, `window.violationsAttachReport`, `window.violationsClearContext`

**listening.js:** `window.listeningShowView`, `window.listeningHideView`, `window.lsSetProvider`, `window.lsToggleConfig`, `window.lsSaveConfig`, `window.lsTestRunpodHealth`, `window.lsHandleFileSelect`, `window.lsHandleDrop`, `window.lsRun`, `window.lsStop`

**endpoints-config.js:** `window.Olivia_ENDPOINTS` (arr — 19 service categories), `window.Olivia_BASE_URLS` (obj)

**agent-functions-registry.js:** `window.Olivia_FUNCTIONS` (obj — runtime function registry)

**olivia-pdf-export.js:** `window.OLIVIA_PDF_BRAND` (obj), `window.downloadLastResponseAsPdf` (fn)

**mobile.js:** `window.isMobileDevice` (fn)

---

## 3. Consumer Analysis (typeof window.X guards)

### 3.1 Guarded consumers (safe cross-module calls)

These use `typeof window.X === 'function'` checks before calling:
`window.renderAgentList`, `window.discOpenFilePreview`, `window.openPreviewUrl`, `window.discOpenFileOutput`, `window.discOpenFileBrowser`, `window.toggleBrowserPanel`, `window.vwOpenInOutput`, `window.addOutputArtifact`, `window.showOutputArtifactInPanel`, `window.toggleOutputPanel`, `window.addSharedContextItem`, `window.vwTextPills`, `window.vwFilePills`, `window.vwArticleCard`, `window.sendMessageToAgent`, `window.meshyOpenModal`, `window.sendMessage`, `window.shToggleFullscreen`, `window.buildSelectedPanelContext`, `window.formatPanelContextLabel`, `window.vwEnter`, `window.vwLeave`, `window.aexHideMain`, `window.vwInitResize`, `window.vwInitEdgeResize`, `window.violationsSelectById`, `window.vwOpenTextBrowser`, `window.oliviaRefreshSectionRuntimeUi`, `window.getCustomApiKey`, `window.escapeHtml`, `window.toast`, `window.addSystemBubble`, `window.koutPinnedPaths`, `window.sh3dBuildBrainPrompt`, `window.sh3dExportConfig`, `window.oliviaResolveSectionAgentContext`, `window.sh3dApplyConfig`, `window.shRegister3DScene`, `window.sh3dFocusExtra`, `window.sh3dClearExtras`, `window.sh3dPruneExtraByUrl`, `window.sh3dSetHybrid2D`, `window.downloadLastResponseAsPdf`, `window.updateSharedContextBar`, `window._checkedShared`, `window.selectAgent`

### 3.2 Unguarded consumers (assumes load order)

These are accessed without typeof guards — breaking load order would cause runtime errors:
- `window.selectedAgent` — agent-orchestration.js, output.js, stream.js
- `window._modelCatalog` / `window._currentModel` — history.js
- `window.Olivia` / `window.LA8159` — agent-functions-registry.js, scene3d.js
- `window.API_BASE` — projects.js
- `window.fetch` — endpoint-widget.js (monkey-patched)
- `window.customConfirm` — projects.js
- `window.SpeechRecognition` / `window.webkitSpeechRecognition` — inline voice script
- `window.speechSynthesis` — inline TTS script

---

## 4. DOM IDs

### 4.1 Modal system
`modalOverlay`, `createModal`, `modalAgentName`, `modalAgentDesc`, `modalSystemPrompt`, `modalImportStatus`, `sharedScopesGrid`, `modalWorkspaceScope`, `customScopeFoldersDiv`, `modalScopeFolders`, `modalOutputFolder`, `modalScopePermissions`, `modalQdrantShared`, `qdrantExistingDiv`, `qdrantDedicatedDiv`, `modalQdrantDedicatedName`, `modalNeo4jShared`, `neo4jDedicatedDiv`, `modalNeo4jDedicatedName`

### 4.2 Sidebar & Navigation
`sidebarEl`, `sidebarExpandBtn`, `mobileSidebarOverlay`

### 4.3 Chat
`chatBody`, `chatInput`, `sendBtn`, `contextBar`, `pinnedPathsBar`, `panelContextStatus`

### 4.4 Output / Preview / Browser
`outputBody`, `outputPanel`, `previewBody`, `browserFrame`, `browserPanel`

### 4.5 Voice & TTS
`voicePanel`, `voiceVisualizer`, `voiceStatusText`, `voiceLangSelect`, `voiceSupportedContent`, `cfgVoiceLang`, `voiceMicButton`, `ttsVoiceSelect`, `ttsPlayPauseBtn`, `ttsPlayer`, `ttsPlayerLabel`, `ttsAutoToggle`

### 4.6 Studio & Others
`studioOptSelection`, `violationsResize`, `violationsSidebar`, `violationsEdgeResize`, `violationsView`, `promptModalOverlay`, `promptModal`, `promptModalCancelBtn`

---

## 5. Storage Keys

### localStorage

| Key | Used In | Purpose |
|-----|---------|---------|
| `OliviaLegal.voice.settings.v1` | inline voice:6881 | Voice recording preferences |
| `kout.scene3d.last` | scene3d.js:2066 | Last 3D scene state |
| User prefs keys | user-prefs.js | User preferences, API keys, workspace config |
| Chat save keys | history.js | Saved chat histories (local caching) |

### sessionStorage

No `sessionStorage` keys found. Only `localStorage` is used.

---

## 6. Intercepted / Monkey-Patched Globals

| Global | Patcher | Purpose |
|--------|---------|---------|
| `window.fetch` | endpoint-widget.js:509 | Intercepts all fetch calls to record HTTP traffic for endpoint monitoring. Original saved to `window._epOrigFetch`. |

---

## 7. Custom Events

### Event Producer-Consumer Map

```
stream.js ──dispatch──> olivia:panel-context-updated      ──listen──> shaders.js, studio.js
stream.js ──dispatch──> LA8159:panel-context-updated      ──listen──> memory.js, api-explorer.js, endpoint-widget.js
stream.js ──dispatch──> Kout_Stream:pinned-paths-updated  ──listen──> docs.js, inline pinned paths
scene3d.js ──dispatch──> sh3d:extras-changed              ──listen──> shaders.js, remote-bus-desktop.js
scene3d.js ──dispatch──> sh3d:selection-changed           ──listen──> shaders.js, remote-bus-desktop.js
output.js ──dispatch──> olivia:browser-shared             ──listen──> (external iframe)
output.js ──dispatch──> olivia:browser-bridge-ready       ──listen──> (external iframe)
i18n inline ──dispatch──> olivia:lang-changed             ──listen──> agents.js, trunk.js, stream.js, agent-orchestration.js
(external) ──dispatch──> kout:tool-call                   ──listen──> meshy-ui.js
```

### Event Namespaces

- **`olivia:*`** — Primary (4 events: panel-context-updated, lang-changed, browser-shared, browser-bridge-ready)
- **`LA8159:*`** — Alternate (1 event: panel-context-updated, mirrored from olivia:*)
- **`Kout_Stream:*`** — Stream artifacts (1 event: pinned-paths-updated)
- **`sh3d:*`** — 3D scene (2 events: extras-changed, selection-changed)
- **`kout:*`** — Tool (1 event: tool-call)

---

## 8. Duplicate Definitions (Phase 4 target)

| Symbol | Files | Risk |
|--------|-------|------|
| `window.initMobile` | core.js, nav.js, mobile.js | Last-load wins |
| `window.applyMobileLayout` | core.js, nav.js | Last-load wins |
| `window.formatBytes` | core.js, files.js, discovery.js | Last-load wins |
| `window.sendMessage` | core.js, stream.js | stream.js overrides |

---

## 9. Statistics

| Category | Count |
|----------|-------|
| Total script entries | 78 (58 JS files + 19 CDN/inline/importmap) |
| Total window.* exports | ~550 across 40+ files |
| Files with no exports | ~10 (trunk.js, architecture.js, law_library.js, background-workers.js, fullscreen-controls.js, remote-bus-desktop.js, etc.) |
| Defensive typeof guards | 70+ occurrences |
| Unguarded consumers | 8 patterns |
| Unique DOM IDs | 80+ |
| localStorage keys | 2 explicit + dynamic user-prefs keys |
| sessionStorage keys | 0 (not used) |
| Custom events | 9 event types, 4 producers, 10 consumers |
| Monkey-patched globals | 1 (window.fetch) |

### Top Export Sources

| File | Count | File | Count |
|------|-------|------|-------|
| discovery.js | 53 | modals.js | 25 |
| spaces.js | 46 | listening.js | 23 |
| scene3d.js | 42+ | violations.js | 22 |
| shared.js | 42 | stream.js | ~20 |
| history.js | 39 | projects.js | 24 |

### Naming Patterns

- **`*ShowView` / `*HideView`** — Section panel visibility toggle (used by 14+ modules)
- **`olivia*`** / **`LA8159*`** — Application namespace prefix
- **`sh3d*`** — 3D scene functions
- **`window._*`** — Internal/private globals (`_modelCatalog`, `_epOrigFetch`, `_checkedShared`, etc.)
- **Module-scoped prefixes** — `disc*` (discovery), `sp*`/`spaces*` (spaces), `ls*` (listening), `mv*` (memory), `ep*` (endpoints), `vw*` (section views)
