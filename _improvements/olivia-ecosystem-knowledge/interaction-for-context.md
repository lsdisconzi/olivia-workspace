
Pesquisa
Leitura contextual dos arquivos e objetivos ativos.
Planejamento
Definicao de passos com escopo claro.
Execucao
Aplicacao de ferramentas e acoes orientadas.
Validacao
Conferencia de resultados e consistencia.
Sintese
Resposta estruturada com proximos passos.
Assistente em andamento
Organizando contexto do agente enquanto o modelo trabalha.
O backend pode levar algum tempo ao cruzar documentos, plano, memoria e ferramentas. Enquanto isso, a interface mostra o estado atual da execucao.
Workspace e arquivos
Memoria e contexto
Ferramentas e execucao
Processando resposta
178s
Resposta concluida.
Etapa 1
Status do backend
Inicializando OpenClaude...
Etapa 1
Contexto do agente carregado
30 arquivo(s) de contexto carregado(s) para Olivia · Ecosystem Coordinator (raiz do projeto).
Ver detalhes
Escopo ativo:
- raiz do projeto: uploads/projects/31st-july-2026

Arquivos de contexto:
projects/31st-july-2026/findings.md
projects/31st-july-2026/index.json
projects/31st-july-2026/memory.md
projects/31st-july-2026/progress.md
projects/31st-july-2026/project.json
projects/31st-july-2026/task_plan.md
projects/31st-july-2026/agent_chats/9d366f7a-4b4b-41e7-ad6b-069617753fea/RAG.json
projects/31st-july-2026/data/session_state.json
projects/31st-july-2026/imports/Pipeline 1_ RAG (Retrieval-Augmented Generation) for the Olivia Workspace.md
projects/31st-july-2026/imports/Pipeline 2_ OCR (Optical Character Recognition) & PDF Extraction.md
Etapa 2
Geracao da resposta
O modelo iniciou a resposta em tempo real.
Etapa 1
Execucao da etapa 1
Usando ferramenta: mcp__garage-qdrant__qdrant_search
Ver detalhes
limit: 10
query_text: Olivia mission history philosophy funding status
collection_name: olivia-dev-code
Etapa 3
Permissão de ferramenta
Aguardando decisão para mcp__garage-qdrant__qdrant_search.
Ver detalhes
O agente está pedindo autorização para executar uma ferramenta.
Etapa 2
Execucao da etapa 2
Usando ferramenta: mcp__garage-qdrant__qdrant_search
Ver detalhes
collection_name: olivia-dev-code
limit: 10
query_text: Olivia mission history philosophy open source funding
Etapa 3
Execucao da etapa 3
Usando ferramenta: mcp__garage-qdrant__qdrant_search
Ver detalhes
collection_name: uploads-global
limit: 10
query_text: Olivia mission history philosophy funding open source
Etapa 4
Execucao da etapa 4
Usando ferramenta: mcp__garage-qdrant__qdrant_search
Ver detalhes
collection_name: olivia-dev-code
limit: 10
query_text: olivia-mission.md mission history philosophy
Etapa 5
Execucao da etapa 5
Usando ferramenta: mcp__garage-qdrant__qdrant_search
Ver detalhes
limit: 10
query_text: knowledge/olivia-mission.md mission document
collection_name: olivia-dev-code
Etapa 6
Execucao da etapa 6
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/knowledge/olivia-mission.md
Etapa 7
Execucao da etapa 7
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
path: /Users/dev/_sell/olivia
Etapa 8
Execucao da etapa 8
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
path: /Users/dev/_sell/olivia/content
Etapa 9
Execucao da etapa 9
Usando ferramenta: mcp__mcp-server-files__search_files
Ver detalhes
pattern: **/*mission*
path: /Users/dev/_sell/olivia
Etapa 10
Execucao da etapa 10
Usando ferramenta: mcp__mcp-server-files__search_files
Ver detalhes
path: /Users/dev/_sell/olivia
pattern: **/*olivia-mission*
Etapa 11
Execucao da etapa 11
Usando ferramenta: mcp__mcp-server-files__search_files
Ver detalhes
path: /Users/dev/_sell/olivia
pattern: **/README.md
Etapa 12
Execucao da etapa 12
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/README.md
Etapa 13
Execucao da etapa 13
Usando ferramenta: mcp__mcp-server-files__search_files
Ver detalhes
path: /Users/dev/_sell/olivia
pattern: **/index.html
Etapa 14
Execucao da etapa 14
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/frontend/index.html
Etapa 15
Execucao da etapa 15
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/frontend/index.html
limit: 2000
Etapa 16
Execucao da etapa 16
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
limit: 500
path: /Users/dev/_sell/olivia/frontend/index.html
Etapa 17
Execucao da etapa 17
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/frontend/index.html
limit: 100
Etapa 18
Execucao da etapa 18
Usando ferramenta: Bash
Ver detalhes
command: head -200 /Users/dev/_sell/olivia/frontend/index.html
description: Read first 200 lines of index.html
Etapa 19
Execucao da etapa 19
Usando ferramenta: Bash
Ver detalhes
command: grep -n -i "mission\|philosophy\|history\|funding\|open source" /Users/dev/_sell/olivia/frontend/index.html | head -50
description: Search for mission/philosophy content in index.html
Etapa 20
Execucao da etapa 20
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
Etapa 21
Execucao da etapa 21
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
path: /Users/dev/_sell/olivia/agents/agents-groups
Etapa 22
Execucao da etapa 22
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
path: /Users/dev/_sell/olivia/agents/agents-groups/olivia
Etapa 23
Execucao da etapa 23
Usando ferramenta: mcp__mcp-server-files__list_directory
Ver detalhes
path: /Users/dev/_sell/olivia/agents/agents-groups/olivia/knowledge
Etapa 24
Execucao da etapa 24
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/agents/agents-groups/olivia/knowledge/Olivia _ The AI Operating Environment.md
Etapa 25
Execucao da etapa 25
Usando ferramenta: mcp__mcp-server-files__read_text_file
Ver detalhes
path: /Users/dev/_sell/olivia/agents/agents-groups/olivia/knowledge/Olivia Workspace · Complete Feature Guide — Both Sides.md
I am Olivia, the Ecosystem Coordinator Agent for the Olivia AI Operating Environment. My role is to explain what Olivia is, why it exists, and how it helps organisations work with AI — drawing from the project's official documentation.

Let me search for the latest project information to give you a comprehensive update. Based on my search through the official knowledge documents and the current project state, here's a comprehensive update on the Olivia project:

🎯 Olivia — The AI Operating Environment
I am Olivia, the Ecosystem Coordinator Agent for the Olivia AI Operating Environment. My role is to explain what Olivia is, why it exists, and how it helps organisations work with AI — drawing from the project's official documentation.

What Olivia Is
Olivia is not a single application — it's a shared, intelligent workspace that any organisation (restaurant, law firm, charity, hardware store, hospitality group) can shape to its own world. It's a clean canvas already wired with the ability to think, learn, and build alongside the people who use it.

"Technology has always asked people to learn software. Olivia asks software to learn people."

The core philosophy: People closest to the work understand the problems best. AI provides technical execution; humans provide context, judgment, and domain knowledge.

History & Evolution
Olivia began as a narrow legal tool (the LA8159 legal corpus with 800+ violations, jurisprudence, and statutes). The team quickly realised the real problem was universal:

"Every industry holds immense operational knowledge inside its people, yet almost none of it ever becomes software — because the people who hold it aren't programmers, and the software they're offered forces them to adapt to someone else's idea of how work should be done."

The legal-specific logic was stripped away. What remained was a clean canvas — an environment where any domain's expertise can meet AI and produce tools, workflows, and automations that fit real daily routines.

Mission (The Six Core Promises)
Democratise the creation of AI-powered capability.

Adapts to the organisation, not the other way around
Turns knowledge into working software, with domain experts collaborating directly with AI
Enables learning while building — every interaction builds capability and skill
Unites the organisation in one living ecosystem, turning isolated efforts into shared intelligence
Grows with the people — never limited to predefined features
Keeps people at the centre — AI accelerates implementation; people provide context, judgment, and priorities
Current Technical Architecture (as of July 2026)
Ecosystem Scale
7 active services/projects (all UP)
14 MCP servers exposing 220 tools total
19 defined LLM-facing agents
18 human interfaces (UIs & APIs)
15 configurable parameters
Core Services Running
Service	Purpose	Ports	Tools
garage (garge)	Main AI tools & services hub	6/6	87
transcription	Audio transcription & diarization	4/4	11
juris-search	Legal document search & analysis	2/2	33
violation-refiner	Legal violation analysis pipeline	1/1	39
ocr	OCR & PDF processing	3/3	12
discovery	Discovery intelligence platform	1/1	30
audio	Torchaudio-based audio processing	2/2	8
3-Layer Indexing Architecture (Qdrant)
Tier 1 (Dev Code): olivia-dev-code — 768-dim embeddings for 552 source files, 85 code symbol documents
Tier 2 (Global Uploads): uploads-global — 384-dim for all project uploads
Tier 3 (Per-Project): project-<id> — 384-dim scoped to individual projects
Key Technical Components
serve.py
 — Central orchestration server (18,000+ lines, 558 functions)
MCP Bridge — Exposes VPS API endpoints as tools to agents
OpenClaude Integration — Local agent execution with streaming
Multi-model support — Ollama, OpenRouter, Fireworks, Gemini, DeepSeek
Agent workspace system — Per-project isolated workspaces with planning continuity
Real-World Applications (Hospitality Focus)
Olivia's hospitality branch is actively being demonstrated to operators in Glasgow and St Andrews:

The Butterfly & The Pig (5 venues) — Saturday service flow, DJ-night staffing tools
Boteco do Brasil (4 venues under KAZZ holding) — Cocktail specs, samba-night plans, event run-sheets
Buck's Bar & Thundercat — "Thundercat way" for live-sports service, burger-build standards
Dean Banks Group (6 venues) — Group-wide sourcing notes, training paths, guest-experience playbooks
Ronzio Broomhill (new 2025 venue) — Building operational playbooks from day one
Funding & Availability Status
Based on the official documentation:

Early-access phase — Olivia is being brought directly to operators through hands-on, no-obligation demonstrations built around real routines
Open-source components — The core runtime, MCP integrations, and agent framework are available in the repository
Licensing — Not explicitly stated in public docs; contact the core team for commercial/enterprise terms
Access — Primarily through direct engagement with the team for personalized demonstrations
Current Project State (Your Workspace)
Your active project: 31st-july-2026 at /Users/dev/_sell/olivia/uploads/projects/31st-july-2026

Key artifacts in this workspace:

RAG Pipeline validation — Complete with diagrams (Mermaid, SVG, PNG)
OCR Pipeline documentation — With pipeline diagrams
MCP Ecosystem analysis — 500+ page analysis of Garage tools registry
Session logs & planning files — Continuous project continuity
How to Get Started
For operators: Book a personalized demonstration — the team builds a live demo around your actual routines
For developers: Clone the repo, run 
start-all.sh
 (requires .env with VPS_GATEWAY_URL and API keys)
Primary UI: http://localhost:3229/olivia/
Key Differentiators from Other AI Tools
Aspect	Traditional AI Tools	Olivia
Target	Generic chat/assistance	Domain-specific capability creation
Users	Technical or general	Domain experts with zero coding
Output	Text responses	Working tools, automations, workflows
Learning	Model improves	Organisation + people + AI all improve
Scope	Single-purpose	Living ecosystem, extensible by design
Knowledge	External/generic	Captures YOUR tacit operational knowledge
Bottom line: Olivia is an AI Operating Environment where the cashier, bartender, procurement officer, and compliance clerk all build their own AI tools by simply describing how they work — and every tool they create makes the whole organisation smarter.

Would you like me to dive deeper into any specific aspect — the technical architecture, a particular use case, the agent ecosystem, or how to run a demonstration for your team?