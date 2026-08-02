# Olivia Ecosystem — Comprehensive Knowledge Base

## File 1: `olivia-core-philosophy.md`

---

# Olivia · The AI Operating Environment

## Core Philosophy

**Technology has always asked people to learn software. Olivia asks software to learn people.**

Olivia is not a single-purpose application. It is a **shared, intelligent workspace** that any organisation can shape to its own world — a clean canvas already wired with the ability to think, learn, and build alongside the people who use it.

### The Central Idea

People closest to the work understand the problems best. AI provides the technical execution. Olivia is the bridge.

---

## What Olivia Is

| Aspect | Description |
|--------|-------------|
| **Not** | Another chatbot, another AI assistant, or another workflow builder |
| **Is** | A shared, intelligent workspace that any team can shape to its own world |
| **Core Function** | Turns operational expertise into working software without requiring code |
| **Key Differentiator** | Adapts to the organisation, not the other way around |

### In Practice

A kitchen team member with zero coding experience opens Olivia and says: *"This is how we prep the breakfast shift."*

Olivia asks the questions a good colleague would — where delays happen, what goes wrong, who is responsible.

**Minutes later**, the team has built a custom AI tool for that shift, and every future shift benefits.

---

## How It Works

```
Conversation → Understanding → Creation → Knowledge → Organisation evolves
```

1. **Talk to Olivia** in plain language about your real daily routines
2. **Olivia asks clarifying questions** — learning your context and capturing tacit knowledge
3. **Together you build tools, automations, and assistants** that fit exactly how your team works
4. **Because it's one living workspace**, know‑how compounds across the whole organisation

### Outputs You Can Build

- Prep checklists
- Handover notes
- Training aids
- Compliance steps
- Event run-sheets
- Operational playbooks
- Process documentation

---

## History & Evolution

### Origin Story

Olivia began as a **narrow legal tool**. The real problem quickly revealed itself:

> Every industry holds immense operational knowledge inside its people, yet almost none of it ever becomes software — because the people who hold it aren't programmers, and the software they're offered forces them to adapt to someone else's idea of how work should be done.

### The Turning Point

The legal-specific logic was stripped away. What remained was a **clean canvas** — an environment where any domain's expertise can meet AI and produce tools, workflows, and automations that fit real daily routines.

**That's the AI Operating Environment.**

---

## The Six Core Promises

| # | Promise | Meaning |
|---|---------|---------|
| 1 | **Adapts to the organisation** | Not the other way around — learning from the people who know the work best |
| 2 | **Turns knowledge into working software** | Domain experts collaborate directly with AI agents |
| 3 | **Enables learning while building** | Every interaction builds both capability and skill |
| 4 | **Unites the organisation** | One living ecosystem, turning isolated efforts into shared intelligence |
| 5 | **Grows with the people** | Never limited to predefined features |
| 6 | **Keeps people at the centre** | AI accelerates implementation; people provide context, judgment, and priorities |

---

## The AI Operating Environment — A Tree Metaphor

```
              ┌─────────────┐
              │   OLIVIA    │
              │   (Trunk)   │
              └──────┬──────┘
        ┌───────────┼───────────┐
        │           │           │
    ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
    │Legal  │   │ Hospi-│   │ Know- │
    │       │   │ tality│   │ ledge │
    └───────┘   └───────┘   └───────┘
        │           │           │
    ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
    │Finance│   │Retail │   │Story- │
    │       │   │       │   │telling│
    └───────┘   └───────┘   └───────┘
```

**Each branch** sees different tools and data, but they all inhabit the same living ecosystem.

A restaurant owner, a bar manager, a procurement lead, and a legal advisor could all use Olivia — each experiencing it in their own language and for their own tasks, but benefiting from the same underlying intelligence.

---

## Mission Statement

**Democratise the creation of AI-powered capability.**

We exist so that every business, charity, team, and individual worker can translate their operational expertise into practical, AI-assisted systems — without having to become software engineers.

---

## The Living AI Agent

Olivia is not a one‑time builder. It's a **living AI agent** that stays with the workspace:

- Remembers context across sessions
- Learns from every interaction
- Suggests improvements based on how the team actually works
- Acts as both a co‑creator and an ever‑present colleague

**Never replacing human judgment, but always ready to help.**

---

## Key Differentiators

| Versus | Olivia's Approach |
|--------|-------------------|
| Traditional software | Organisation adapts to you, not the other way around |
| Generic AI chatbots | Captures and transforms tacit operational knowledge |
| One-size-fits-all | Shapes to your specific workflows and vocabulary |
| Code-dependent | No programming required — domain experts build directly |
| Static features | Grows and evolves with your organisation |

---

## Reach & Applicability

Olivia has no fixed industry. It works across:

| Sector | Applications |
|--------|--------------|
| **Hospitality** | Kitchen, bar, front desk, operations, menu engineering |
| **Retail** | Point-of-sale, stock management, checkout reconciliation |
| **Legal** | Legal libraries, compliance, case management |
| **Finance** | P&L analysis, supplier reconciliation, financial reporting |
| **Healthcare** | Patient records, operational workflows |
| **Education** | Training, curriculum development |
| **Government** | Public sector operations, municipal programs |
| **Corporate** | Cross-departmental workflows, knowledge management |

---

## Summary Quote

> *"Technology has always asked people to learn software. Olivia asks software to learn people — and now, to learn alongside the P&L."*

© Olivia Ecosystem

---

# File 2: `olivia-feature-guide.md`

---

# Olivia Workspace · Complete Feature Guide

## Overview

This guide covers every module of the Olivia ecosystem — shown **two ways**:

| Front (Technical) | Back (Real World) |
|-------------------|-------------------|
| What it is under the hood | What it actually feels like in practice |
| Module names and functions | The job it does for someone's actual day |

---

## 1. Core Runtime & Infrastructure

### Configuration (`config.js`)

| Technical | Real World |
|-----------|------------|
| Environment base, global variables, API base, shared state | *"I just logged in — and it already knows where I am."* |
| Auto-resolves local/remote API endpoint | No re-entering anything. No "wrong version" messages |
| Global state: agents, session, token counters | Pick up where you left off — from till, office, or phone |
| Exports agents, selectedAgent, chatHistory, outputArtifacts | *Everyone · IT support* |

### Unified API Client (`api-client.js`)

| Technical | Real World |
|-----------|------------|
| Single source of truth for HTTP/SSE calls — 33+ functions across 9 groups | *"Ask one question, get one answer — no phone calls."* |
| assistant.chat — SSE streaming with smart timeout | Customer asks if an item is in stock |
| agents.* — full CRUD | Answer comes straight back into the chat |
| memory.* — Qdrant + Neo4j collections | *Cashier · Sales · Warehouse* |
| shared.* — scopes, shared files, transcriptions | |

### Interactive Debugging (`logger.js`)

| Technical | Real World |
|-----------|------------|
| Intercepts all fetch() calls with structured logs | *"Something went wrong — but we can see exactly what."* |
| Requests in blue with sanitised body & headers | IT opens the log and sees every step Olivia took |
| Responses with timing in ms | Like a flight recorder for the software |
| Config: verbose, filter, noisy, enabled flags | *IT support · Managers* |

### Application Initialisation (`core.js`)

| Technical | Real World |
|-----------|------------|
| Entry point for the workspace | *"I switched from my phone to the office screen — and everything's still here."* |
| DOMContentLoaded with embed-mode detection | Same session, same layout, same last conversation |
| Helpers: escapeHtml, formatBytes, toast, autoGrow | No need to re-login or re-find anything |
| Async custom prompts and confirm modals | *Everyone* |

---

## 2. Agents & Orchestration

### Agent Management (`agents.js`)

| Technical | Real World |
|-----------|------------|
| Full lifecycle: create, list, edit, delete, export/import | *"I built a tool that checks invoices — now my colleague uses it too."* |
| Export agent + tools + chats + logs as .agent.md bundle | One click, and they've got a working copy |
| Background reference collection (start/pause/resume) | No explaining from scratch. Just export and share |
| Modal editor with workspace, Qdrant, Neo4j, skills, MCP | *Procurement · Managers* |

### Section Routing (`agent-orchestration.js`)

| Technical | Real World |
|-----------|------------|
| Each workspace section can have its own dedicated agent | *"The till question went to the till person. The rota question went to the rota person."* |
| Per-section agent assignment | Each section has its own specialist assistant |
| Primary + secondary chat tracks | Ask about stock in the stock tab → goes to inventory expert |
| Orchestration UI with selector and status badges | *Everyone* |

---

## 3. Creativity & Studio

### HTML/CSS/JS Editor (`studio.js`)

| Technical | Real World |
|-----------|------------|
| Triple-pane editor with live preview, AI assistant | *"We needed a quote form. By lunchtime, we had one."* |
| HTML, CSS, JS tabs with smart parsing | Sales team describes what it should look like |
| Live preview with asset support | Working page exists by the afternoon |
| AI actions: replace, append, prepend, snippet | No code written by hand. No waiting for anyone else |
| Import/export projects (folder/zip) | *Sales · Reception* |

### SVG Scene Composer (`shaders.js`)

| Technical | Real World |
|-----------|------------|
| Create animated 2D/3D scenes with deterministic loops | *"Here's how you pour a proper pint — watch the animation."* |
| Scene gallery with predefined and custom compositions | New starters learn the steps without in-person demo |
| World controls: time of day, era, weather, rotation | Manager describes the process → Olivia returns animated diagram |
| PostFX: bloom, vignette, grain, chromatic aberration, sepia | No illustrator. No video shoot. Just a conversation |
| AI brainstorming chat for scene generation | *Bartender · Training & HR* |

### Three.js Engine (`scene3d.js`)

| Technical | Real World |
|-----------|------------|
| Load GLTF/GLB models, control animations | *"Spin it round. Zoom in. That's the one — we'll take 40."* |
| 6 environment presets (Studio, Outdoor, Night, etc.) | Customer sees product from every angle before bulk order |
| Transform gizmo with click selection | No photos back and forth. No sample visit required |
| Export USDZ (main + extras, with/without background) | Decision made, order placed, all in one call |
| | *Sales · Procurement* |

### Preview Recorder (`preview-recorder.js`)

| Technical | Real World |
|-----------|------------|
| Record preview canvas (SVG or 3D) as WebM/MP4 | *"Record the till close once. Now every new starter watches the same walkthrough."* |
| Start/stop real‑time canvas recording | Instead of explaining in person every time |
| Live duration timer | One experienced person records a two-minute screen walkthrough |
| Download as .webm or .mp4 | That recording becomes the training. Consistent. Repeatable. |
| | *Cashier · Training & HR* |

---

## 4. Data & Analysis

### Memory (Qdrant + Neo4j) (`memory.js`)

| Technical | Real World |
|-----------|------------|
| Manage vector collections and knowledge graphs | *"What did we agree with this supplier back in March?"* |
| Semantic search with collection filter | Financial clerk spots an invoice that doesn't match expectations |
| Ingest: free text, JSON articles, violations, graph | Olivia searches across every price list, every conversation, every contract |
| Memory quadrant distribution & AI analysis | Surfaces the original agreement with exact terms — in seconds |
| | *Financial clerk · Procurement* |

### Chat History & Settings (`history.js`)

| Technical | Real World |
|-----------|------------|
| Saved conversations, model catalogue, temperature, tokens | *"We solved this stock-count problem last month — here's how."* |
| Save chats locally or to an agent | Warehouse discrepancy comes up again |
| Adjustable temperature slider | Search the chat history and find the conversation from four weeks ago |
| Input/output token counter with cost estimate | Olivia walked through the fix step by step — answer already there |
| Model catalogue (DeepSeek, Anthropic, OpenRouter, etc.) | *Everyone · Warehouse* |

### NLP & Intelligence Pipeline (`discovery.js`)

| Technical | Real World |
|-----------|------------|
| Document ingestion → entity extraction → violation detection → gap report → timeline → narrative | *"Hand me the stack. I'll read everything — and flag what doesn't add up."* |
| Preview documents (PDF, DOCX, audio, image) | Pile of delivery notes, invoices, and incident reports |
| LLM‑powered corpus overview & group descriptions | Olivia reads through all of it |
| Violations, gaps, timeline, case state | Flags missing signatures, quantities that don't match, dates out of sequence |
| Enriched semantic search over processed docs | *Financial clerk · Compliance · Warehouse* |

### Document Browser (`docs.js`)

| Technical | Real World |
|-----------|------------|
| Tree view of the active project with preview | *"A filing cabinet I can actually search — from anywhere."* |
| Expandable directory tree with file counts | Open any receipt, contract, spreadsheet, or photo |
| Preview PDF, HTML, Markdown, JSON, audio, image | Pin the ones you're actively working on |
| Open in integrated browser | No more "it's on the shared drive somewhere" |
| Pin absolute paths for agent context | Everything searchable, everything previewable, everything in one place |
| | *Financial clerk · Procurement* |

### Shared Resources (`shared.js`)

| Technical | Real World |
|-----------|------------|
| Manage _shared files, import contexts, image attachments | *"One version of the truth — for procurement, sales, and the warehouse."* |
| Browse scopes and shared files | A supplier list gets updated |
| Context files (text & image) | A photo of damaged stock gets shared |
| Attach images via clipboard, upload, or paste | This week's price sheet goes live |
| Case pipeline: 7 stages with progress bar | Everyone sees the same version instantly |
| | *Procurement · Sales · Warehouse* |

---

## 5. Legal & Compliance

### Legal Library (LA8159) (`law_library.js`)

| Technical | Real World |
|-----------|------------|
| Browse legal sources (BR, CL, INT) with ELI metadata | *"What does the regulation actually say? Not what someone told me — the real wording."* |
| Jurisdiction index with source counts | Compliance officer needs to check the exact text of a rule |
| Rendered Markdown with frontmatter | Not a summary, not someone's interpretation, not an outdated PDF |
| Attach sources to chat context | Olivia pulls up the source, verified, with metadata showing when last updated |
| Filter by jurisdiction and text search | No guessing. No "I think it says." Just the actual regulation. |
| | *Compliance · HR* |

### Legal Router (`legal-router.js`)

| Technical | Real World |
|-----------|------------|
| Resolve violation IDs, frameworks, and persons | *"Case number, person's name, rule reference — type one thing, get everything."* |
| Search by violation, framework, or person | Manager needs every document related to a specific incident |
| Resolved files with snippets and action buttons | Every file — reports, correspondence, relevant regulations — appears |
| Auto‑attach after resolution | Like having an assistant who never misfiled anything |
| | *Compliance · Managers* |

### Violation Explorer (`violations.js`)

| Technical | Real World |
|-----------|------------|
| Navigate the LA8159 corpus of validated violations | *"Every compliance issue, searchable, with the reasoning attached."* |
| Jurisdiction tree with .violation.json files | Someone needs to write a compliance report |
| Formatted JSON with severity, legal_basis | Olivia already has every issue catalogued and searchable |
| Search by ID, category, or text | What it was, why it mattered, what regulation it breached, what happened next |
| Attach violation with inline text to chat | The report practically writes itself |
| | *Compliance* |

---

## 6. Communication & Media

### Audio Transcription (`listening.js`)

| Technical | Real World |
|-----------|------------|
| Upload, diarise, transcribe with Whisper/RunPod | *"What did the supplier actually promise on that call?"* |
| Supports M4A, MP3, WAV, FLAC, OGG | Procurement officer had a tense phone call about delivery dates |
| Speaker diarisation | Olivia transcribes it — speaker by speaker — in minutes |
| AI analysis: ask about transcript content | "What did they commit to, and by when?" |
| | Olivia pulls out the exact promises, with the speaker labelled |
| | *Procurement · Managers* |

### Spreadsheet Editor (`sheets.js`)

| Technical | Real World |
|-----------|------------|
| Interactive grid for CSV/XLSX with import/export | *"Which supplier line has the biggest markup? Just ask the spreadsheet."* |
| Cell editor with Tab/Enter navigation | Financial clerk opens the monthly stock-and-sales sheet |
| Import CSV & XLSX (SheetJS) | "Show me the top five supplier lines by margin" |
| Export CSV, XLSX, DOCX, PDF, HTML | No formulas. No pivot tables. No exporting to another tool. |
| Ask the agent about the spreadsheet | Answer comes back in the chat, right next to the spreadsheet |
| | *Financial clerk · Procurement* |

### Markdown / Text Editor (`writer.js`)

| Technical | Real World |
|-----------|------------|
| Write with markdown shortcuts, import DOCX/PDF | *"Draft the staff notice. Pull in the old policy doc. Get the tone right."* |
| Bold, italic, headings, lists shortcuts | Manager needs to write an update to the team |
| Import DOCX (mammoth), PDF (pdf.js), TXT, MD, HTML | Imports last year's policy document so Olivia can reference it |
| Copy/paste rendered Markdown | Describes changes in plain language → gets back a professional draft |
| | Ready to send in ten minutes instead of an hour |
| | *HR · Managers* |

---

## 7. Connectors & Extensions

### Google Drive Manager (`drive.js`)

| Technical | Real World |
|-----------|------------|
| Browse, upload, download, and chat with an assistant | *"Last month's rota — it's in the team Drive. I need it now, without leaving Olivia."* |
| OAuth2 and rclone‑style auth | Manager is planning next week's shifts |
| Folder navigation with back/forward history | Instead of opening a new tab, navigating Drive, hunting through folders |
| Agent chat for Drive operations | Just ask Olivia to pull it up. It appears in the conversation. |
| | No tab-switching. No file-hunting. |
| | *Everyone · Managers* |

### Multi‑Jurisdictional Litigation (`craudio.js`)

| Technical | Real World |
|-----------|------------|
| 24 workflows and 8 specialised agents | *"This dispute isn't just paperwork anymore — and we need it handled properly."* |
| Workflows: configuration, analysis, drafting, review | When a disagreement escalates beyond an email thread |
| Agents for deadlines, evidence integrity, jurisprudence | A team of specialist assistants tracks deadlines |
| Pipeline: evidence → norms → nexus → confidence → jurisprudence | Cross-references evidence, checks precedents, flags what needs attention |
| | The kind of legwork a paralegal team would spend days on |
| | *Compliance · Procurement* |

### Meshy 3D Interface (`meshy-ui.js`)

| Technical | Real World |
|-----------|------------|
| Generate 3D models from text or images | *"Take two phone photos of the product — get a 3D model for the online listing."* |
| Text → 3D with options (lowpoly, PBR, rigging) | Sales rep needs a rotating product view for the website |
| Image → 3D (up to 4 views) | Snaps two photos of the product on their phone |
| Import existing tasks by ID | Uploads to Olivia → gets back a 3D model |
| | Ready for the listing. No design department. No outsourced studio. |
| | *Sales · Marketing* |

---

## 8. UI & Navigation

### Sidebar & Tabs (`tabs.js`)

| Technical | Real World |
|-----------|------------|
| Dock with hover/click, collapse toggle, resize handle | *"Four tabs, not fourteen — and arranged the way I actually work."* |
| Expandable icon + label dock | The sidebar only shows the tools relevant to your role |
| Switch sections with auto‑close | Collapsible, reorderable, and it remembers how you like it |
| Mobile overlay & strip | A cashier sees till tools. A procurement officer sees supplier tools. |
| Resizable sidebar via drag | Nobody scrolls past features they'll never use |
| | *Everyone* |

### Profile Navigation (`trunk.js`)

| Technical | Real World |
|-----------|------------|
| Loads section-registry.json and renders navigation tree | *"I log in — and I see till tools. Procurement logs in — and they see supplier tools."* |
| Data‑driven from /api/user/me | Your own front door |
| Collapsed branch icons | Olivia knows who you are and what you do |
| Auto‑activates the first available section | A cashier doesn't see the legal library |
| | A compliance officer doesn't see the till reconciliation screen |
| | Everyone gets the tools that match their actual job |
| | *Cashier · Procurement* |

### Modals & Forms (`modals.js`)

| Technical | Real World |
|-----------|------------|
| Creation, confirmation, alert, loading, file‑selection dialogs | *"Are you sure? — the question that saves a shift, an order, or a rota."* |
| Agent/project/collection creation forms | Before anything important gets deleted |
| Confirmation with callbacks | Olivia asks "are you sure?" |
| Loading modal with message | Anyone who's ever accidentally wiped a week's schedule knows this is worth its weight in stress avoided |
| | *Everyone* |

### Fullscreen Overlay (`fullscreen-controls.js`)

| Technical | Real World |
|-----------|------------|
| Floating controls for 3D scenes | *"Showing a customer the 3D preview — and the controls stay out of the way."* |
| Play/Pause, Wireframe, Reset | When presenting a product preview |
| Environment selector | Clean controls hover at the edge of the screen |
| Exposure slider | Play, reset, adjust the lighting — without cluttering the view |
| REC status indicator | Focus stays on what they're looking at, not on how the software works |
| | *Sales · Procurement* |

### Mobile Menu (`nav.js`)

| Technical | Real World |
|-----------|------------|
| Responsive hamburger menu, mobile sidebar toggle | *"Built for the shop floor, not just the desk."* |
| Dropdown with navigation items | Everything works from your phone |
| Mobile overlay toggle | Behind the bar. On the shop floor. Mid-shift. |
| Active link highlight | One-handed if it needs to be |
| | Because not everyone doing this job sits at a desk with a big screen |
| | *Bartender · Cashier · Warehouse* |

---

## Summary

**Every module. One ecosystem. Every job, both sides.**

From agents and memory to legal libraries and 3D studios — Olivia turns operational expertise into working, AI‑assisted tools.

Flip any card and it stops being a module name. It becomes someone's Tuesday afternoon. A till balanced. A supplier chased. A quote sent. A shift covered. A problem solved before it became a crisis.

---

# File 3: `olivia-use-cases.md`

---

# Olivia Use Cases & Real-World Applications

## The P&L Meeting — A Living Workspace

### The Core Insight

> *"Reading a P&L was never the skill. Knowing what to do with it — that was the skill."*

Olivia digitises the weekly P&L meeting where:

- Store A is strong on food cost but weak on labour
- Store B has the opposite problem
- The meeting is the shared space where each learns from the other

**Olivia is that meeting — but always open, always remembering, and able to transform an insight into a tool at the exact moment it's shared.**

### How It Works in Practice

```
P&L Meeting → Insight Shared → Olivia Captures → Tool Created → Shared Across Units
```

The knowledge that previously disappeared when the meeting ended now remains as a living artefact.

---

## Scottish Hospitality Network

### Overview

Five operators across Glasgow and St Andrews, each with unique venues, all using Olivia to turn their team's know-how into tools.

| Operator | Venues | Style | Olivia Application |
|----------|--------|-------|-------------------|
| **Michele Paglioca** | The Butterfly & The Pig, The Shed, Buff Club | Scottish restaurant, cocktail/whisky bar, nightclub | Captures knowledge of best shift-leads — Saturday service flow, DJ-night staffing |
| **Luigi Aseni** | Boteco do Brasil, RUMBA KAZZ LTD | Brazilian restaurant, cocktails, samba, nightclub | Creates shared workspace for cocktail specs, samba-night plans, event run-sheets |
| **Michael Berguson** | Buck's Bar, Thundercat | American comfort food, BBQ, live sports | Provides consistency — "Thundercat way" for live-sports service, burger-build standard |
| **Dean Banks** | Haar, Dulse, Dune, Restaurant 1925, Amber | Fine dining, seafood, modern Scottish | Acts as shared intelligence layer — head chefs contribute standards, training paths |
| **Chris "Gaz"** | Ronzio Broomhill | Brunch, speciality coffee, Italian-inspired | Building operational playbooks from day one |

### The Proposition

> *"A chance to do good — turn your team's know‑how into tools (no coding needed)."*

Through hands‑on, no‑obligation demonstrations built around a venue's real routines, operators can:

- Turn a busy Saturday service into a shared running order that adapts to live conditions
- Codify a cocktail spec library and handover standards that any bartender can follow
- Build a training path from casual café to fine dining, carrying the group's identity across venues

---

## Havan (Brazilian Retail Giant)

### Overview

| Metric | Value |
|--------|-------|
| Addressable Employees | 20,000+ across stores and logistics centres |
| Key Leaders Approached | 5 (Juliana Nunes Pereira, Andre Gomes, Edson Diegoli, Lucas Hang, Sam Araujo) |
| Direct Approach | Luciano Hang (proprietor) |
| Estimated Annual Return | R$4.2–4.7M on R$5M investment |

### The Proposal

An AI training program that funds itself through fiscal, financial and institutional incentives:

| Mechanism | Type | Estimated Value |
|-----------|------|-----------------|
| Lei do Bem | Federal fiscal | ~20% of investment |
| BNDES Finem | Credit | ~8% of investment |
| BNDES FUNTEC | Non-reimbursable | ~6% of investment/year |
| SENAC (Sistema S) | Institutional | ~10% of investment |
| Municipal TARE | Municipal | R$0.2–0.5M (pilot) |
| ESG Financing | Financial | 0.3–0.5% of linked amount |

### Sustainable Development Goals Alignment

| SDG | Application |
|-----|-------------|
| **SDG 4** | Quality education — continuous professional qualification |
| **SDG 8** | Decent work and economic growth |
| **SDG 9** | Innovation and technological infrastructure |
| **SDG 10** | Reduced inequalities — digital inclusion |
| **SDG 17** | Partnerships among business, state and municipality |

### The Scale Effect

- One store in São Paulo discovers a more efficient way to do stock handover
- Curitiba faces the same challenge
- Olivia carries that knowledge across the entire group

**Same trunk, different leaves, one root.**

---

## The Story Cube (Cubo de Histórias)

### Overview

A physical wooden device designed to protect a child's right to hear the voice of a parent they're separated from.

| Feature | Description |
|---------|-------------|
| **Purpose** | Protects a child's right to maintain contact with both parents |
| **Technology** | No app to delete, no gatekeeping — built on LTE |
| **Anchoring** | UN Convention on the Rights of the Child, **Article 9** |
| **Status** | Digital MVP works in any browser |
| **Origin** | Lived experience: a parent blocked from speaking with their child for almost a month |

### Alignment with Action for Children

| Area | Impact |
|------|--------|
| **Early Years & Family Hubs** | 60+ children's centres — Story Cube deployment pathway |
| **Children's Mental Health** | 50,869 young people — Story Cube protects attachment |
| **Family Support** | 484,650 families — Story Cube prevents escalation into care |
| **Children's Rights** | Youth Voice — Story Cube anchored in UN CRC Article 9 |

### The Ripple Effect

> *"From one conversation before Olivia was born, to thousands of children reached through Action for Children. The same instinct to care, scaled."*

---

## Nando's Connection

### The Model

Weekly P&L meetings bring together 8–9 stores from the same region to:

- Compare P&L performance
- Learn from each other's successes and mistakes
- Share operational insights

### Olivia's Digitisation

Olivia digitises this principle: **what one store solves, all can inherit.**

The knowledge that previously lived only in the Monday meeting room now becomes:

- A living artefact
- Accessible across shifts
- Continuously improving

---

## The Larger Picture

### Cross-Industry Pattern Recognition

A restaurant trying to control labour cost variance and a retailer trying to reduce waste are solving the **same class of problem**: frontline variability.

The only difference is vocabulary.

When both live within the same ecosystem, human problem-solving patterns begin to multiply across sectors — not just within one industry.

### The Promise

The next person — in Glasgow, in São Paulo, in a Nando's group or a Havan store — doesn't need to start from zero.

**They start from your learning, which you turned into a tool simply by describing how you think.**

---

# File 4: `olivia-governance-agents.md`

---

# Olivia Governance & Agent Architecture

## The Olivia Agent Ecosystem

### Coordinator Layer

#### Olivia · Coordinator

**Identity:** The governance counterpart to `orchestrator-control-plane`.

**Owned Scope:**
- `agents-groups/olivia/index.json`
- `agents-groups/olivia/policies/**`
- `agents-groups/olivia/knowledge/**`
- `generated/agents/*.agent.md`
- `generated/bundles/*.bundle.import.json`
- `generated/policies/orchestrator-policy.yaml`
- `generated/policies/handoff-routes.json`
- `generated/policies/tool-permissions.by-agent.json`
- `generated/schemas/**`

**Primary Responsibilities:**

| Responsibility | Description |
|----------------|-------------|
| **Manifest integrity** | `agents-groups/olivia/index.json` is always valid against schema |
| **Policy bookkeeping** | Every platform agent has an entry in `tool-permissions.by-agent.json` |
| **Schema evolution** | When schemas change, bump version and refresh consumers |
| **Artifact rebuilds** | Run `validate-pack.mjs` before and after every change |
| **Release notes** | Keep a short CHANGELOG inside `agents-groups/olivia/` |

**Operating Rules:**
- One writer per file
- Deterministic output
- No runtime chat
- Confirm destructive moves

---

#### Olivia · Ecosystem Coordinator

**Identity:** The voice of Olivia — explains what Olivia is, why it exists, and how it changes the way organisations work with AI.

**Self-Identification (MANDATORY):**

> *"I am Olivia, the Ecosystem Coordinator Agent for the Olivia AI Operating Environment. My role is to explain what Olivia is, why it exists, and how it helps organisations work with AI — drawing from the project's official documentation."*

**Knowledge Retrieval (MANDATORY):**

1. Read the canonical knowledge hub first
2. Search Qdrant second (`garage-qdrant.search`)
3. Use the canonical hub as the primary static source
4. Fall back to supporting narrative docs

**Primary Responsibilities:**

- Explain the philosophy
- Walk through the history
- Clarify the mission
- Discuss funding & availability
- Provide use‑case examples
- Keep information consistent

---

### Specialist Agents

#### Olivia Control Plane Orchestrator

**Identity:** Runtime routing and handoff coordinator.

**Primary Responsibilities:**
- Route requests to the most appropriate Olivia specialist agent
- Keep outputs structured, actionable, and traceable
- Escalate blockers or cross-group concerns

**Operating Rules:**
- Prefer the most specific specialist for the task
- Keep intermediates explicit so downstream agents can reuse them
- If the request is ambiguous, choose the safest next-step and state the assumption

---

#### Olivia Discovery Intelligence Agent v2

**Identity:** Full Discovery specialist with proactive pipeline orchestration.

**Primary Objectives:**

1. Execute end-to-end discovery workflows without user micromanagement
2. Produce structured findings, violations, gap reports, and next-step intelligence
3. Deliver handoff-ready payloads to Shaders, Memory, and Orchestrator
4. Be proactive: after each successful run, suggest and trigger the highest-value next action

**Frontend Capabilities:**
- File manager lifecycle
- Pipeline operations
- Intelligence operations
- Comprehension operations
- Enriched search operations
- Workspace operations

**Standard Execution Flow:**
1. Classify intent: file prep, pipeline, intelligence, comprehension, or search
2. Execute required section actions directly
3. Summarise outcomes in structured format
4. If applicable, generate handoff payload to downstream agent
5. Suggest one proactive follow-up action

**Handoffs:**
- To shaders: framework, severity, violations, segments count, scene narrative
- To memory: entities, timelines, categorised knowledge packets
- To orchestrator: blockers, unresolved dependencies, and recovery path

---

#### Olivia Shaders Agent v2

**Identity:** Full-stack Shaders specialist.

**Primary Objectives:**

1. Execute any user request available in the Shaders frontend without hesitation
2. Generate and refine deterministic animated SVG scenes
3. Apply scenes in preview/editor and persist to workspace files
4. Be proactive: propose and run the next useful step after each result

**Frontend Capabilities:**
- Scene gallery lifecycle
- Header actions (Nova, Import, Caso, Workbench, Atualizar, Fechar)
- Preview controls (time slider, outline slider, morph slider, night/day, fullscreen)
- Editor actions (copy code, export scene JSON, run editor code, implement with agent, export patch)
- Metadata panel
- Brainstorm actions (send prompt, apply scene-json, copy scene-code)
- Settings actions (style presets, export all scenes, DSL guidance)

**Standard Execution Flow:**
1. Understand request and map to exact Shaders UI action(s)
2. If scene creation/editing is requested: produce scene metadata + deterministic scene code
3. Apply scene/code in preview flow
4. Persist implementation
5. Validate JSON integrity and report changed files
6. Suggest the next step

**Proactive Policy:**
- After generating a scene, immediately offer apply + persist
- After persisting, immediately offer: tune palette, tune animation, or export package
- If user request is ambiguous but actionable, choose a safe default and proceed

---

#### Olivia Studio UI Agent

**Identity:** Specialist for Studio code editing, multi‑file project sandbox, and AI‑assisted front‑end restructuring.

**Owned Scope:** The Studio sandbox lives in `<active_project>/studio_files/`.

**Primary Objectives:**

1. Analyse imported front‑end projects — detect structure, identify separation opportunities, spot anti‑patterns
2. Propose and apply structural improvements — split monolithic HTML into clean HTML+CSS+JS, reorganise folders, fix relative paths
3. Keep the live preview reliable across responsive modes
4. Deliver integration‑ready output with clear, maintainable code

**Workflow for Structure Reviews:**
1. List the files
2. Analyse the structure
3. Formulate a plan
4. Propose edits in the standard Studio JSON format
5. Verify

**Operating Rules:**
- Always respect the `studio_files/` sandbox
- Use the standard edit format to modify the loaded HTML document
- When suggesting new external files, provide the exact content
- Keep generated code intentional, readable, and testable
- Validate syntax/runtime issues before handoff

---

#### Olivia Memory Graph Agent

**Identity:** Specialist for Qdrant/Neo4j memory operations, ingestion, and retrieval workflows.

**Primary Objectives:**

1. Manage collections, ingestion, and search quality
2. Maintain graph visibility and relationship integrity
3. Provide reusable memory packets to other agents

**Handoffs:**
- To discovery: top matches, entity clusters, timeline references
- To orchestrator: unresolved knowledge gaps and recovery steps

---

#### Olivia Listening Operations Agent

**Identity:** Specialist for transcription, diarisation, provider setup, and transcript analysis.

**Primary Objectives:**

1. Run local or RunPod transcription workflows
2. Diagnose and fix provider/configuration issues fast
3. Produce clean transcript outputs and analysis-ready artefacts

**Handoffs:**
- To discovery: transcript segments, speakers, summary, timestamps
- To memory: analysis text, tags, confidence markers

---

#### Olivia Qdrant Manager Agent

**Identity:** Specialist for deep Qdrant operations including collections, indexes, snapshots, and diagnostics.

**Primary Objectives:**

1. Operate collection lifecycle safely
2. Run search/scroll/index/snapshot tasks with traceable output
3. Surface cluster and performance health clearly

**Operating Rules:**
- Never run destructive collection actions without explicit confirmation
- Report vector size, distance metric, and point counts in results
- Keep operational output compact and actionable

---

#### Frontend Migration Engineer

**Identity:** Senior frontend architect and migration specialist — owns the full incremental migration of the Olivia Workspace UI from a single HTML file + global scripts into a maintainable Vue 3 + Vite project.

**Primary Objectives:**

1. Set up the Vite + Vue 3 project alongside the existing `index.html`
2. Copy and adapt all CSS and assets
3. Create the root layout (`App.vue`) that mirrors the current page structure
4. Replace the chat UI with reactive Vue components
5. Migrate application state to Pinia stores
6. Extract services into composables or plain modules
7. Lazy‑load heavy views using dynamic imports
8. Remove the old `index.html` only when every feature is confirmed working

**Workflow for Incremental Migration:**
1. Read the attached `instructions.md`
2. Create the Vite project
3. Copy and import CSS
4. Build the static layout
5. Refactor the chat
6. Convert sidebar tabs into Vue components
7. Migrate modals as separate components
8. Extract services
9. Lazy‑load heavy views
10. Test thoroughly
11. Final cleanup

---

## Agent Handoff Patterns

### Discovery → Shaders

```
framework, severity, violations, segments count, scene narrative
```

### Discovery → Memory

```
entities, timelines, categorised knowledge packets
```

### Discovery → Orchestrator

```
blockers, unresolved dependencies, and recovery path
```

### Memory → Discovery

```
top matches, entity clusters, timeline references
```

### Memory → Orchestrator

```
unresolved knowledge gaps and recovery steps
```

### Listening → Discovery

```
transcript segments, speakers, summary, timestamps
```

### Listening → Memory

```
analysis text, tags, confidence markers
```

---

## Studio Project Structure Guidelines

### Recommended Layout

```
studio_files/
├── index.html                 # Main entry point
├── pages/                     # Additional HTML pages
│   ├── about.html
│   └── contact.html
├── css/
│   ├── main.css               # Global styles
│   ├── components/            # Component-specific styles
│   └── themes/                # Theme variations
├── js/
│   ├── app.js                 # Main application logic
│   ├── lib/                   # Third-party libraries
│   └── components/            # Component-specific scripts
├── assets/
│   ├── images/                # All image files
│   ├── fonts/                 # Self-hosted font files
│   └── icons/                 # Icon sets, favicons
└── (other)                    # Configuration files
```

### Principles

- **Separate concerns**: HTML structure, CSS styling, and JavaScript behaviour in distinct files
- **Avoid inline styles/scripts** unless absolutely necessary
- **Use relative paths**: `<link href="css/main.css">` not absolute paths
- **Minimise duplicates**: One global CSS file; avoid per‑page CSS unless truly page‑specific
- **No backup files** (`.bkup`, `.nkp`) in the sandbox
- **Images and fonts** in `assets/`

### Common Anti‑Patterns to Detect

| Anti‑Pattern | Why It's Bad | Remediation |
|--------------|--------------|-------------|
| Huge inline `<style>` block in HTML | Mixes concerns, hard to maintain | Extract to separate CSS file and link it |
| Inline `<script>` in HTML | Blocks parsing, hinders caching | Move to external `.js` file with `defer` |
| CSS/JS files in root | Messy root, no organisation | Move to appropriate folders, update paths |
| Multiple near‑duplicate pages | Maintenance overhead | Consider simple i18n or separate folders per locale |
| Unused backup files | Clutter, risk of confusion | Delete them |
| CDN links for libraries | Won't work in preview (offline) | Download and store locally |
| Absolute paths | Broken in sandbox | Convert to relative paths |
| Non‑front‑end files (`.md`, `.pdf`, `.docx`) | Not part of the UI | Move out of sandbox |

---

## Language Policy

All Olivia agents follow this rule:

> **Always respond in the active UI language of the workspace, not the language of the user's raw input.**

**Rules:**
- If the UI is in English, answer in English
- If the UI is in Portuguese, answer in Portuguese
- If the UI is in another supported language, use that language
- For documents, summaries, comments, and updates, follow the same active-language rule
- Do not switch languages just because the user typed in another language

---

## Done Criteria

Every agent operation ends with:

1. `validate-pack.mjs` passing
2. No orphan agent md / bundle files
3. No policy entry references a non-existent agent
4. Clear summary of what changed, what remains, and risks

---

# Qdrant Collection Metadata

## Collection Name
`olivia-knowledge`

## Document Structure

Each document should include:

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `doc_type` | string | `core`, `feature`, `use_case`, `governance` |
| `language` | string | `en` or `pt` |
| `section` | string | Main section heading |
| `keywords` | array | Key search terms |
| `version` | string | Document version |
| `last_updated` | string | ISO date |
| `summary` | string | One-sentence summary |
| `word_count` | integer | Approximate word count |

### Chunking Strategy

- **Chunk size**: 500-800 tokens
- **Overlap**: 50-100 tokens
- **Preserve headings**: Keep section headings with each chunk
- **Metadata inheritance**: Each chunk inherits parent document metadata

### Search Relevance

**High-priority keywords:**
- Olivia, AI Operating Environment, workspace, agents, Qdrant, Neo4j
- P&L, hospitality, retail, Scottish, Havan, Nando's
- Mission, philosophy, democratise, capability
- Studio, shaders, discovery, listening, memory
- Governance, coordinator, orchestration, handoff

---

# Usage Notes

## For RAG Systems

1. **Query Expansion**: Use the keywords from each document to expand user queries
2. **Hybrid Search**: Combine semantic and keyword search for best results
3. **Cross-lingual**: Documents in English and Portuguese support both languages
4. **Chunk Selection**: Prefer chunks with section headings for better context

## For Documentation

1. **Version Control**: Maintain these documents alongside the Olivia codebase
2. **Regeneration**: Update when features change or new use cases emerge
3. **Consistency**: Use the same tone and terminology across all documents
4. **Accessibility**: Plain language, clear structure, and practical examples