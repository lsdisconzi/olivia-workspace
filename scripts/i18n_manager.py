#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import json
import glob
import argparse
from bs4 import BeautifulSoup

KNOWN_KEYS = {
    # Navigation
    "Olivia": "brandName",
    "Workspace": "brandSub",
    "Home": "navHome",
    "Architecture": "navArchitecture",
    "Mobile Agent": "navAgent",
    "Workspace": "navWorkspace",      # duplicate but okay
    # Sidebar
    "Agents": "sidebarAgents",
    "Configuration": "sidebarConfig",
    "Documents": "sidebarDocs",
    "Shared Data (_shared)": "sidebarShared",
    "Legal Router": "sidebarLegalRouter",
    "Case Dossier": "sidebarCaseDossier",
    "Violations": "sidebarViolations",
    "Law Library": "sidebarLawLib",
    "Memory": "sidebarMemory",
    "History": "sidebarHistory",
    "Session Files": "sidebarFiles",
    "Projects": "sidebarProjects",
    "Case Builder": "sidebarCaseBuilder",
    "Studio": "sidebarStudio",
    "Descoberta": "sidebarDescoberta",
    "Listening": "sidebarListening",
    "API Explorer": "sidebarAPIExplorer",
    "Architecture": "sidebarArchitecture",   # duplicate
    "Shaders": "sidebarShaders",
    "Spaces": "sidebarSpaces",
    "Craudio": "sidebarCraudio",
    "Drive": "sidebarDrive",
    # Chat
    "Assistant Olivia": "chatAgentName",
    "idle": "chatBadgeIdle",
    "route: detecting": "chatRuntimeRoute",
    "Thinking": "chatThinking",
    "Send": "sendButton",
    "Stop": "stopButton",
    "Add Context": "addContextLabel",
    "Export": "exportButton",
    "Clear": "clearChat",
    "Focus Mode": "focusMode",
    "Output Panel": "outputPanel",
    "Browser Panel": "browserPanel",
    "Session cost": "costBadge",
    "More options": "headerDots",
    # Config
    "Model Selection": "modelSelection",
    "DeepSeek": "providerDeepSeek",
    "Anthropic": "providerAnthropic",
    "Ollama": "providerOllama",
    "API Key": "apiKeyLabel",
    "Uses server variable if empty": "apiKeyPlaceholder",
    "Verify key": "verifyApiKey",
    "Model Temperature": "temperatureLabel",
    "Current temperature:": "temperatureStatus",
    "Max response tokens": "maxTokensLabel",
    "Current max tokens:": "maxTokensStatus",
    "Investigation Operations: activity window (hours)": "investigationRangeLabel",
    "Current window:": "investigationRangeStatus",
    "Voice Configuration": "voiceConfigTitle",
    "Transcription language": "voiceLangLabel",
    "Continuous mode (auto-restart)": "voiceContinuousLabel",
    "Use the microphone button in chat to start and stop. Transcription appears live in the message field.": "voiceHint",
    "Section Generator": "sectionGeneratorTitle",
    "Generate new section": "sectionGeneratorButton",
    "Quickly create a new sidebar tab with auto-generated JS/CSS.": "sectionGeneratorDesc",
    # Docs
    "files as context": "docsContextBar",
    "Clear": "docsClearAll",
    # Shared
    "Search _shared...": "sharedSearchPlaceholder",
    "Sync Law": "sharedSyncLaw",
    "Compare Parsing": "sharedCompareParsing",
    # Legal Router
    "Legal Router OliviaLegal": "legalRouterTitle",
    "Resolves violation IDs, frameworks, and person dossiers from Agents Source.": "legalRouterDesc",
    "Open full view": "legalRouterOpen",
    # Case Dossier
    "Case Dossier": "caseDossierTitle",
    "Consolidated case documentation for LA8159: master index, violations, evidence, narratives, and legal foundations.": "caseDossierDesc",
    "Open dossier": "caseDossierOpen",
    # Violations
    "OliviaLegal Violations": "violationsTitle",
    "71 validated violations (BR/CL/INT) with legal basis, actors, and incident segments.": "violationsDesc",
    "Open full view": "violationsOpen",
    # Law Library
    "OliviaLegal Law Library": "lawLibTitle",
    "59 legal sources (codes, laws, regulations, treaties) with verbatim text and SHA-256.": "lawLibDesc",
    "Open full view": "lawLibOpen",
    # Memory
    "OliviaLegal Memory": "memoryTitle",
    "Explore, query, and configure all OliviaLegal memory. Vector, semantic, graph, short-term, and long-term.": "memoryDesc",
    "Open Memory Space": "memoryOpen",
    "Vectors": "memoryVectorStat",
    "Graph Nodes": "memoryGraphStat",
    "Short-term": "memoryShortTermStat",
    "Collections": "memoryCollectionsStat",
    "Search memory...": "memorySearchPlaceholder",
    "Free Text": "memoryIngestFreeText",
    "Law Articles": "memoryIngestArticles",
    "Violation": "memoryIngestViolation",
    "Graph": "memoryIngestGraph",
    "Analyze with AI": "memoryAnalyzeWithAI",
    "Refresh": "memoryRefresh",
    "New Collection": "memoryCreateCollection",
    "Qdrant": "memoryQdrantConfig",
    "Neo4j": "memoryNeo4jConfig",
    "Routing and Access": "memoryRoutingConfig",
    "Save Config": "memorySaveConfig",
    # History
    "Saved Conversations": "historyTitle",
    "Select an agent to see saved conversations.": "historyEmpty",
    "Save Current Conversation": "historySave",
    # Files
    "Session Files": "filesTitle",
    "Saved Transcriptions": "filesTranscriptions",
    "Imported Files": "filesImported",
    "Generated Artifacts": "filesGenerated",
    "Clear All": "filesClearAll",
    # Projects
    "Projects": "projectsTitle",
    "New Project": "projectsNew",
    "Reload projects": "projectsReload",
    "Current project:": "projectsCurrent",
    "Upload to Project": "projectsUpload",
    "View Files": "projectsViewFiles",
    "Project Destination": "projectsDestination",
    # Case Builder
    "Case Builder": "caseBuilderTitle",
    "Start here — upload your data": "caseUploadZoneTitle",
    "Drag files or a folder, or use the buttons below": "caseUploadSub",
    "PDFs · document photos · emails · contracts\nAny format. Any amount. Any level of organization.": "caseUploadHint",
    "Select Files": "caseSelectFiles",
    "Select Folder": "caseSelectFolder",
    "Destination inside Case": "caseDestinationLabel",
    "No minimum. 1 file or 1,000 — we organize it for you.": "caseUploadReassure",
    "Scan & Extract": "caseScanExtract",
    "Clear": "caseClear",
    "Pipeline Progress": "stageTrackerTitle",
    "Intake — submit your data": "stageIntake",
    "Indexing — L0 ingest & hash": "stageOrganize",
    "Extraction — L1-L3 metadata & entities": "stageUnderstand",
    "Relationships — L4 graph between files": "stageGoal",
    "Intelligence — L5-L7 deep analysis": "stageGaps",
    "Case state — findings & next steps": "stageBuild",
    "Ready — agent can query results": "stageOutput",
    "Agent Actions": "agentActionsTitle",
    "Send to Agent for Analysis": "sendToAgent",
    "Run Deep Intelligence (L5-L7)": "runIntelligence",
    "Browser Panel": "browserPanelTitle",
    "URL to load...": "browserUrlPlaceholder",
    # Studio
    "Web Builder": "studioTitle",
    "LLM Assisted": "studioBadge",
    "New Project": "studioNewProject",
    "Start from scratch": "studioNewProjectDesc",
    "Import HTML": "studioImportHtml",
    "Load local file": "studioImportHtmlDesc",
    "Templates": "studioTemplates",
    "Landing Page": "studioLandingPage",
    "Conversion page": "studioLandingDesc",
    "Dashboard": "studioDashboard",
    "Admin panel": "studioDashboardDesc",
    "Portfolio": "studioPortfolio",
    "Personal showcase": "studioPortfolioDesc",
    "Blog": "studioBlog",
    "Article layout": "studioBlogDesc",
    "Components": "studioComponents",
    "Navbar": "studioNavbar",
    "Responsive navigation": "studioNavbarDesc",
    "Hero Section": "studioHero",
    "Feature banner": "studioHeroDesc",
    "Card Grid": "studioCards",
    "Card grid": "studioCardsDesc",
    "Footer": "studioFooter",
    "Full footer": "studioFooterDesc",
    "OliviaLegal Assistant": "studioAiAssistant",
    "Configure AI Assistant": "studioConfigAssistant",
    "DeepSeek": "studioProviderDeepSeek",
    "Claude": "studioProviderClaude",
    "OpenAI": "studioProviderOpenAI",
    "OpenRouter": "studioProviderOpenRouter",
    "Ollama": "studioProviderOllama",
    "Model": "studioModelLabel",
    "API Key (optional)": "studioApiKeyOptional",
    "sk-... (leave empty to use server key)": "studioApiKeyPlaceholder",
    "Save": "studioSaveConfig",
    "Cancel": "studioCancel",
    "Save": "studioSave",
    # Descoberta
    "Discovery": "descobertaTitle",
    "INPUT": "descobertaInput",
    "Upload Data": "descobertaUploadData",
    "Overview": "descobertaOverview",
    "ORGANIZATION": "descobertaOrganization",
    "Categories": "descobertaCategories",
    "All Files": "descobertaAllFiles",
    "Pipeline": "descobertaPipeline",
    "INSIGHTS": "descobertaInsights",
    "Analytics": "descobertaAnalytics",
    "Entities": "descobertaEntities",
    "Timeline": "descobertaTimeline",
    "Search": "descobertaSearch",
    "INTELLIGENCE": "descobertaIntelligence",
    "Deep IA": "descobertaDeepAI",
    "Narrative": "descobertaNarrative",
    "Violations": "descobertaViolations",
    "Events": "descobertaEvents",
    "Case State": "descobertaCaseState",
    "Gaps": "descobertaGaps",
    "INTEGRATION": "descobertaIntegration",
    "API & Endpoints": "descobertaApiEndpoints",
    # Listening
    "Olivia Listens": "listeningTitle",
    "Local": "listeningProviderLocal",
    "RunPod": "listeningProviderRunpod",
    "Configuration": "listeningConfig",
    "API Endpoint": "listeningEndpoint",
    "CORS Mode": "listeningCorsMode",
    "Language": "listeningLanguage",
    "Model": "listeningModel",
    "Min Speakers": "listeningMinSpeakers",
    "Max Speakers": "listeningMaxSpeakers",
    "Advanced Endpoint Parameters": "listeningAdvancedParams",
    "Diarization": "listeningDiarization",
    "Align Output": "listeningAlignOutput",
    "Noise Reduce": "listeningNoiseReduce",
    "Voice Enhance": "listeningVoiceEnhance",
    "Remove Silence": "listeningRemoveSilence",
    "Word Timestamps": "listeningWordTimestamps",
    "VAD Threshold": "listeningVadThreshold",
    "Whisper Temp": "listeningWhisperTemp",
    "Beam Size": "listeningBeamSize",
    "Best Of": "listeningBestOf",
    "Chunk Size": "listeningChunkSize",
    "Batch Size": "listeningBatchSize",
    "Initial Prompt (optional)": "listeningInitialPrompt",
    "Qdrant Indexing (parameters + segments)": "listeningQdrantIndexing",
    "Save to Qdrant": "listeningSaveToQdrant",
    "Qdrant Collection (optional)": "listeningQdrantCollection",
    "RunPod Configuration": "listeningRunpodFields",
    "RunPod API Key": "listeningRunpodApiKey",
    "Endpoint ID": "listeningRunpodEndpointId",
    "HuggingFace Token": "listeningHfToken",
    "Exec Mode": "listeningRunpodExecMode",
    "Poll (ms)": "listeningRunpodPoll",
    "Timeout (s)": "listeningRunpodTimeout",
    "Test": "listeningTestHealth",
    "Audio": "listeningAudioUpload",
    "Drag or click to select": "listeningDragDrop",
    "Transcribe": "listeningTranscribe",
    "Stop": "listeningStop",
    "Context (Qdrant + Transcriptions)": "listeningContext",
    "Qdrant Collections": "listeningQdrantCollections",
    "Saved Transcripts": "listeningSavedTranscripts",
    "Clear": "listeningClearContext",
    "Save selection": "listeningSaveSelection",
    "Progress": "listeningProgress",
    "Upload": "listeningUploadStage",
    "Preprocess": "listeningPreprocessStage",
    "Diarization": "listeningDiarizationStage",
    "Transcription": "listeningTranscriptionStage",
    "Speakers": "listeningSpeakers",
    "Transcription": "listeningTranscript",
    "AI Analysis": "listeningAiAnalysis",
    "Default endpoint": "listeningAiEndpoint",
    "Default model": "listeningAiModel",
    "Analysis prompt": "listeningAiPrompt",
    # Memory (again)
    "Overview": "memoryOverview",
    "Search": "memorySearch",
    "Ingest": "memoryIngest",
    "Quadrants": "memoryQuadrants",
    "Redistribute": "memoryRedistribute",
    "Collections": "memoryCollections",
    "Chat": "memoryChat",
    "Config": "memoryConfig",
    # API Explorer
    "Functions": "apiFunctions",
    "Map": "apiDiagram",
    "MCP": "apiMCP",
    "Agent": "apiAgent",
    "Expand": "apiExpand",
    "Stats": "apiStats",
    "Search functions…": "apiSearchFunctions",
    "Category": "apiFilterCategory",
    "Status": "apiFilterStatus",
    "Service Port": "apiFilterServicePort",
    "Owner Group": "apiFilterOwnerGroup",
    "Function list": "apiFunctionList",
    "Detail": "apiFunctionDetail",
    "Diagram Actions": "apiDiagramActions",
    "Reload": "apiReloadDiagram",
    "Map Mode": "apiMapMode",
    "MCP Inventory": "apiMCPInventory",
    "MCP Servers": "apiMCPServers",
    "MCP Tools": "apiMCPTools",
    "Search tool, server, route...": "apiMCPToolSearch",
    "All servers": "apiMCPServerFilter",
    "Hide likely stale": "apiMCPHideStale",
    "List": "apiMCPViewList",
    "Table": "apiMCPViewTable",
    "MCP Tool Test": "apiMCPToolTest",
    "Execute": "apiMCPExecute",
    "Clear result": "apiMCPClearResult",
    "API Agent": "apiAgentChat",
    "Ask about any endpoint…": "apiAgentChatPlaceholder",
    "Send": "apiAgentSend",
    # Architecture
    "Agent Architecture": "architectureTitle",
    "Open Agent Map": "architectureAgentMap",
    "Open LA8159 Ops Console (8120)": "architectureConsoleLA8159",
    "Reload specs": "architectureReloadSpecs",
    "API endpoints": "architectureApiEndpoints",
    # Shaders
    "Shaders Space": "shadersTitle",
    "New Scene": "shadersCreateScene",
    "Catalog": "shadersCatalog",
    "Import Scene": "shadersImportScene",
    "Workbench": "shadersWorkbench",
    "Scene Gallery": "shadersSceneGallery",
    "Preview": "shadersPreview",
    "Editor": "shadersEditor",
    "Brainstorm": "shadersBrainstorm",
    "Settings": "shadersSettings",
    "Time": "shadersTimeSlider",
    "Outline": "shadersOutlineSlider",
    "Morph": "shadersMorphSlider",
    "Day/Night": "shadersDayNightToggle",
    "Capture PNG": "shadersCapturePNG",
    "Configure Fullscreen": "shadersFullscreenConfig",
    # Spaces
    "Contract Space": "spacesTitle",
    "Golden Case suite contracts, ontology v2.4, and analysis tools.": "spacesContractSpace",
    "Search contracts...": "spacesSearchContracts",
    "All": "spacesFilterAll",
    "Spec": "spacesFilterSpec",
    "Framework": "spacesFilterFramework",
    "Evidence": "spacesFilterEvidence",
    "Contract Tree": "spacesContractTree",
    "Total": "spacesStatsTotal",
    "Layers": "spacesStatsLayers",
    "Context": "spacesStatsContext",
    "Contract Chat": "spacesChatContracts",
    "Analysis": "spacesAnalysis",
    # Craudio
    "Craudio": "craudioTitle",
    "Multi-jurisdictional civil litigation — 24 workflows, 8 scheduled agents, and a dedicated case chat.": "craudioDescription",
    # Drive
    "Drive": "driveTitle",
    "Google Account": "driveGoogleAccount",
    "Loading…": "driveAuthStatus",
    "Connect": "driveConnectButton",
    "Manage your Google Drive files directly from the Olivia Workspace — browse, upload, download, and chat with the Drive assistant.": "driveDescription",
    "Open Drive": "driveOpenDrive",
}

def generate_key(text):
    """Create a clean key from text, avoiding duplicates."""
    key = re.sub(r'[^\w\s]', '', text).strip()
    key = re.sub(r'\s+', '_', key).lower()
    if not key:
        key = 'unnamed'
    if len(key) > 50:
        key = key[:50]
    return key

def parse_html_for_keys(html_content, existing_keys, used_keys):
    """Extract keys from HTML and add data-i18n tags."""
    soup = BeautifulSoup(html_content, 'html.parser')
    extracted = {}
    
    for el in soup.find_all(True):
        if el.name in ['script', 'style', 'noscript', 'svg', 'path', 'circle', 'ellipse', 'g', 'defs', 'linearGradient', 'stop']:
            continue
        if len(el.contents) != 1 or not isinstance(el.contents[0], str):
            continue

        text = el.string.strip()
        if not text or len(text) < 2:
            continue

        key = existing_keys.get(text)
        if key is None:
            key = generate_key(text)
            if key in used_keys:
                base_key = key
                suffix = 1
                while key in used_keys:
                    key = f"{base_key}_{suffix}"
                    suffix += 1
            used_keys.add(key)
        
        extracted[key] = text
        
        # Add span if not already present
        if el.name != 'span' or not el.get('data-i18n'):
            new_tag = soup.new_tag('span')
            new_tag['data-i18n'] = key
            new_tag.string = text
            el.string.replace_with(new_tag)
        else:
            el['data-i18n'] = key

    return extracted, str(soup)

def parse_code_for_keys(content):
    """Scan JS/Python files for t('key', 'default') pattern."""
    extracted = {}
    # Pattern looks for t('namespace.key', 'Default text') or t("namespace.key", "Default text")
    pattern = r"t\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)"
    matches = re.findall(pattern, content)
    for key, text in matches:
        extracted[key] = text
    return extracted

def generate_docs(en_dict, output_path):
    """Generates markdown documentation from the i18n taxonomy."""
    # Group keys by their root namespace (e.g., 'chat', 'sidebar', 'studio')
    taxonomy = {}
    for key, text in en_dict.items():
        parts = key.split('.')
        # If it doesn't have a dot, we put it in 'legacy' or use the first word if it was camelCase
        if len(parts) == 1:
            # simple heurustic for legacy keys (e.g. sidebarDocs -> sidebar)
            if key.startswith('sidebar'): root = 'sidebar'
            elif key.startswith('chat'): root = 'chat'
            elif key.startswith('studio'): root = 'studio'
            else: root = 'general'
        else:
            root = parts[0]
            
        if root not in taxonomy:
            taxonomy[root] = {}
        taxonomy[root][key] = text
        
    doc = ["# Olivia Project UI Taxonomy\n", "This document is auto-generated from the i18n translation keys.\n"]
    
    for root in sorted(taxonomy.keys()):
        doc.append(f"## {root.title()}\n")
        doc.append("| Key | Default English |")
        doc.append("| --- | --- |")
        for key, text in sorted(taxonomy[root].items()):
            # Escape pipes in text
            safe_text = text.replace('|', '\\|').replace('\n', ' ')
            doc.append(f"| `{key}` | {safe_text} |")
        doc.append("\n")
        
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(doc))

def main():
    parser = argparse.ArgumentParser(description="I18n Unified Manager for HTML and JS")
    parser.add_argument('--html', nargs='*', default=[], help="HTML files to parse and update")
    parser.add_argument('--js', nargs='*', default=[], help="JS/PY files to scan for t() function")
    parser.add_argument('--out-json', default='frontend/languages/english.index.json', help="Output JSON dictionary")
    parser.add_argument('--docs', default=None, help="Output markdown taxonomy docs path")
    args = parser.parse_args()

    en_dict = {}
    used_keys = set(KNOWN_KEYS.values())
    
    # Pre-fill known keys
    for text, key in KNOWN_KEYS.items():
        en_dict[key] = text

    # Process HTML
    for html_file in args.html:
        print(f"📄 Processing HTML: {html_file}")
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
        extracted, modified_content = parse_html_for_keys(content, KNOWN_KEYS, used_keys)
        en_dict.update(extracted)
        # Write back HTML
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(modified_content)
            
    # Process Code (JS/PY)
    for code_file in args.js:
        print(f"💻 Scanning Code: {code_file}")
        with open(code_file, 'r', encoding='utf-8') as f:
            content = f.read()
        extracted = parse_code_for_keys(content)
        en_dict.update(extracted)
        
    # Merge with existing JSON if it exists to preserve anything we missed
    if os.path.exists(args.out_json):
        try:
            with open(args.out_json, 'r', encoding='utf-8') as f:
                existing_json = json.load(f)
                for k, v in existing_json.items():
                    if k not in en_dict:
                        en_dict[k] = v
        except Exception as e:
            print(f"Warning: Could not read existing JSON {args.out_json}: {e}")

    # Write output JSON for the primary language (English)
    print(f"💾 Writing {len(en_dict)} keys to {args.out_json}")
    os.makedirs(os.path.dirname(args.out_json), exist_ok=True)
    with open(args.out_json, 'w', encoding='utf-8') as f:
        json.dump(en_dict, f, indent=2, ensure_ascii=False, sort_keys=True)
        
    # Synchronize keys to all other JSON files in the same directory
    lang_dir = os.path.dirname(args.out_json)
    if os.path.exists(lang_dir):
        for file_path in glob.glob(os.path.join(lang_dir, '*.index.json')):
            if os.path.abspath(file_path) == os.path.abspath(args.out_json):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lang_data = json.load(f)
                
                added = 0
                for k, v in en_dict.items():
                    if k not in lang_data:
                        lang_data[k] = v  # Fallback to English text
                        added += 1
                
                if added > 0:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(lang_data, f, indent=2, ensure_ascii=False, sort_keys=True)
                    print(f"🔄 Synced {added} new keys to {os.path.basename(file_path)}")
            except Exception as e:
                print(f"Warning: Could not sync {file_path}: {e}")
        
    if args.docs:
        print(f"📚 Generating documentation at {args.docs}")
        generate_docs(en_dict, args.docs)

    print("✅ Done!")

if __name__ == '__main__':
    main()