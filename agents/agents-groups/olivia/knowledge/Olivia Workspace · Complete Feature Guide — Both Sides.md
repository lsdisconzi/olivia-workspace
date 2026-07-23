# Olivia Workspace · Complete Feature Guide — Both Sides

**Complete Feature Reference · Two Sides To Every Tool**

---

## Hero
**Olivia Workspace**

Every module, every capability — shown two ways. What it is under the hood, and what it actually feels like at the till, behind the bar, or closing the books.

---

## Vision
**The Vision**

### Technology has always asked people to learn software. *Olivia asks software to learn people.*

Olivia is not a single-purpose application. She is a shared, intelligent workspace that any team can shape to its own world — a blank canvas already equipped with the ability to think, learn, and build alongside the people who use it. Everything documented below is real and already built. This guide simply shows it from two angles.

---

## Imagine
**Imagine**

### A cashier, a bartender, a financial clerk — *all building their own tools*.

None of them have written a line of code. The cashier tells Olivia how the till reconciles at close. The bartender explains how a Friday night rota actually falls apart. The financial clerk describes what a supplier invoice should look like before it's approved. A procurement officer explains why one supplier keeps missing deadlines. A sales rep explains what makes a quote take too long to turn around. A warehouse picker explains how stock goes missing between the shelf and the dispatch note.

> *“This is how I do this job today. Here's what goes wrong. Here's what good looks like. How could we make a tool that helps?”*

Olivia asks the questions a good colleague would — where do delays happen, what usually goes wrong, who's responsible, how do you know when it's done right. Five minutes later, each of them has built their first AI tool — and learned AI without ever studying it.

Experience → Conversation → Understanding → Creation → Knowledge → Organisation evolves

---

## How to read this guide
**Two sides, one workspace**

### Every card below tells two stories — *what it is, and what it does for someone's actual day*.

The front of each card is the technical reference — the module name, the functions, the architecture. That's what's already documented. But flip any card and you'll find the same capability translated into a real moment on the ground: a cashier balancing the till at close, a bartender three-deep on a Friday night, a financial clerk chasing a month-end discrepancy, a procurement officer on Monday morning working out which supplier to call first, a sales rep pulling a quote together while the customer waits on the phone, a warehouse picker wondering why the count doesn't match the sheet — and everyone else in between.

- **🟠 Technical** (module & mechanics)
- **🟢 Real world** (the job it does)

Every real-world title is written the way someone would actually say it — not a feature name, but a relief, a question answered, a problem solved. Click any card to flip it, or Tab to it and press Enter. Or flip everything at once with **Flip every card**.

### Who you’ll meet on the back of the cards

| Role | Moment |
|------|--------|
| **Cashier** | End of shift, till needs balancing, and the numbers from the card machine don't match the drawer. Olivia helps reconcile before you lock up. |
| **Bartender** | Friday night, three deep at the bar, and you're running low on house gin. Is there more in the cellar or do you need to tell the floor staff to push something else? |
| **Financial Clerk** | Month-end close, and a supplier invoice from March doesn't match the agreed price. You need the original quote, the delivery note, and the email thread — now. |
| **Procurement Officer** | Monday morning, three suppliers overdue. Which one is actually critical, and which can wait until Wednesday? Olivia knows the difference. |
| **Sales Rep** | Customer on the phone, needs a quote for 200 units by end of call. Olivia pulls the latest pricing, checks stock, and formats the proposal — while you're still talking. |
| **Warehouse Picker** | Dispatch says 14 cases went out, but the shelf says 16 were picked. Where did those two go? Olivia traces the discrepancy from shelf to van. |

### Try it — this one's just for practice
**example.js** — *Try flipping this card*  
This is a practice card. Its front reads exactly like the technical cards further down the page — module name, functions, bullet points.  
- Click anywhere on the card  
- Or Tab to it and press Enter or Space  

*Tap to see the real-world side*

**In the real world** — *“Right, so how does this actually help me?”*  
Same tool. Different question. The back of every card answers the question nobody asks out loud but everybody thinks: what does this actually mean for my shift today?  
*Everyone*  
*Tap to see the technical side*

---

## Core Runtime & Infrastructure
**Core Runtime & Infrastructure**

### The foundation *every other module* rests on.

Global configuration, a unified API client, structured logging, application initialisation, and shared utilities — all designed to keep the workspace fast, observable, and consistent. None of it is visible day to day. All of it is why nothing breaks.

---

### Configuration (`config.js`)
**Technical side**  
Environment base for the entire application — global variables, API base, and shared state (agents, history, artefacts).  
- Auto-resolves local/remote API endpoint  
- Global state: agents, session, token counters  
- Exports agents, selectedAgent, chatHistory, outputArtifacts  

**Real-world side**  
*“I just logged in — and it already knows where I am.”*  
Open Olivia from the till, the office laptop, or your phone on the shop floor — and she already knows which branch you're at, what you were working on, and what settings you use. No re-entering anything. No “wrong version” messages. Just pick up where you left off.  
*Everyone · IT support*

---

### Unified API Client (`api-client.js`)
**Technical side**  
Single source of truth for all HTTP/SSE calls — 33+ functions across 9 groups.  
- assistant.chat — SSE streaming with smart timeout  
- agents.* — full CRUD (create, list, activate, deactivate)  
- memory.* — Qdrant + Neo4j collections, search, ingest, graph  
- shared.* — scopes, shared files, transcriptions  

**Real-world side**  
*“Ask one question, get one answer — no phone calls.”*  
A customer asks if an item is in stock. Instead of walking to the stockroom or calling the warehouse, you type it into Olivia and the answer comes straight back into the chat. This is the delivery route that carries every question to the right place and brings the answer home.  
*Cashier · Sales · Warehouse*

---

### Interactive Debugging (`logger.js`)
**Technical side**  
Intercepts all fetch() calls, providing structured, collapsible logs with colour coding and filters.  
- Requests in blue with sanitised body & headers  
- Responses with timing in ms  
- Config: verbose, filter, noisy, enabled flags  

**Real-world side**  
*“Something went wrong — but we can see exactly what.”*  
When a report won't load or a search comes back empty, your IT person doesn't need you to describe the problem. They open the log and see every step Olivia took — like a flight recorder for the software. You just say “this didn't work,” and they already know why.  
*IT support · Managers*

---

### Application Initialisation (`core.js`)
**Technical side**  
Entry point for the workspace — mobile layout, sidebar, panels, agent loading, and settings restoration.  
- DOMContentLoaded with embed-mode detection  
- Helpers: escapeHtml, formatBytes, toast, autoGrow  
- Async custom prompts and confirm modals  

**Real-world side**  
*“I switched from my phone to the office screen — and everything's still here.”*  
You check stock on your phone behind the bar at 6pm. At close, you open the office computer — same session, same layout, same last conversation, no need to re-login or re-find anything. Olivia remembers so you don't have to.  
*Everyone*

---

### Global Utilities (`state.js + utils.js`)
**Technical side**  
Helper functions for trees, files, and state — stubs ready for future integration.

**Real-world side**  
*“Dates, file sizes, messages — they all look the same everywhere.”*  
Whether you're checking a rota, reading stock levels, or opening a supplier contract, everything is formatted the same way across the whole workspace. One less thing to relearn every time you open a new tab. Consistency you never notice — until you use software that doesn't have it.  
*Everyone*

---

## Agents & Orchestration
**Agents & Orchestration**

### Manage, route, and *orchestrate* intelligent agents.

Create OpenClaude agents, assign them to workspace sections, and let them collaborate across chats and background tasks.

---

### Agent Management (`agents.js`)
**Technical side**  
Full lifecycle: create, list, edit, delete, export/import agent bundles, and manage background reference collection.  
- Grouped listing with active/inactive badges  
- Modal editor with workspace, Qdrant, Neo4j, skills, MCP  
- Export agent + tools + chats + logs as .agent.md bundle  
- Background reference collection (start/pause/resume)  

**Real-world side**  
*“I built a tool that checks invoices — now my colleague at the other site uses it too.”*  
A procurement officer spends ten minutes teaching Olivia how to spot invoice errors for one supplier. A week later, a colleague at another branch needs the same thing — one click, and they've got a working copy. No explaining from scratch. No “let me show you how I set mine up.” Just export and share.  
*Procurement · Managers*

---

### Section Routing (`agent-orchestration.js`)
**Technical side**  
Each workspace section (Studio, Shaders, Discovery, etc.) can have its own dedicated agent, with fallback and preferences.  
- Per-section agent assignment  
- Primary + secondary chat tracks  
- Orchestration UI with selector and status badges  

**Real-world side**  
*“The till question went to the till person. The rota question went to the rota person.”*  
You don't ask the chef about the wine list, and you don't ask the accountant about the broken glasswasher. Olivia works the same way — each section has its own specialist assistant. Ask about stock in the stock tab, and it goes to the assistant that actually knows inventory, not one that's trying to be an expert in everything.  
*Everyone*

---

## Creativity & Studio
**Creativity & Studio**

### Build, edit, and refine *interfaces and 3D scenes* with AI assistance.

From live HTML/CSS/JS editing to SVG shader compositions and full 3D environments — all with integrated agents that understand your code.

---

### HTML/CSS/JS Editor (`studio.js`)
**Technical side**  
Triple-pane editor with live preview, AI assistant, and multi‑file project support.  
- HTML, CSS, JS tabs with smart parsing  
- Live preview with asset support  
- AI actions: replace, append, prepend, snippet  
- Import/export projects (folder/zip)  

**Real-world side**  
*“We needed a quote form. By lunchtime, we had one.”*  
The sales team needs a simple form for custom quotes — but there's no budget for a web designer and no time for an IT ticket. The team lead describes what it should look like to Olivia, and a working page exists by the afternoon. No code written by hand. No waiting for anyone else.  
*Sales · Reception*

---

### SVG Scene Composer (`shaders.js`)
**Technical side**  
Create animated 2D/3D scenes with deterministic loops, palettes, and post‑processing effects.  
- Scene gallery with predefined and custom compositions  
- World controls: time of day, era, weather, rotation  
- PostFX: bloom, vignette, grain, chromatic aberration, sepia  
- AI brainstorming chat for scene generation  

**Real-world side**  
*“Here's how you pour a proper pint — watch the animation.”*  
New starters need to learn the steps: angle the glass, pull the tap, let it settle, top it off. Instead of demonstrating in person every single time, a manager describes the process to Olivia and gets back a short animated diagram that every new hire can watch on their first shift. No illustrator. No video shoot. Just a conversation that turns into a training visual.  
*Bartender · Training & HR*

---

### Three.js Engine (`scene3d.js`)
**Technical side**  
Load GLTF/GLB models, control animations, apply environments, and export USDZ.  
- GLB upload with local preview  
- Animation mixer with multiple clips  
- 6 environment presets (Studio, Outdoor, Night, etc.)  
- Transform gizmo with click selection  
- Export USDZ (main + extras, with/without background)  

**Real-world side**  
*“Spin it round. Zoom in. That's the one — we'll take 40.”*  
A customer wants to see a product from every angle before committing to a bulk order. Instead of sending photos back and forth or arranging a sample visit, the sales rep pulls up a 3D model right in the browser — rotate it, zoom into the detail, check the finish. Decision made, order placed, all in one call.  
*Sales · Procurement*

---

### Preview Recorder (`preview-recorder.js`)
**Technical side**  
Record the preview canvas (SVG or 3D) as WebM/MP4 video.  
- Start/stop real‑time canvas recording  
- Live duration timer  
- Download as .webm or .mp4  

**Real-world side**  
*“Record the till close once. Now every new starter watches the same walkthrough.”*  
Instead of explaining the end-of-day till process to every new cashier in person — which button, which order, what to do if the numbers don't match — one experienced person records a two-minute screen walkthrough. That recording becomes the training. Consistent. Repeatable. Never off sick.  
*Cashier · Training & HR*

---

## Data & Analysis
**Data & Analysis**

### Vector memory, knowledge graphs, *document intelligence*.

Semantic search, chat history, document pipelines, and shared resources — turning raw information into actionable context.

---

### Memory (Qdrant + Neo4j) (`memory.js`)
**Technical side**  
Manage vector collections and knowledge graphs. Ingest text, legal articles, violations, and structured data.  
- Collection list with stats  
- Semantic search with collection filter  
- Ingest: free text, JSON articles, violations, graph  
- Memory quadrant distribution & AI analysis  

**Real-world side**  
*“What did we agree with this supplier back in March?”*  
Month-end, and a financial clerk spots an invoice that doesn't match expectations. Instead of digging through email threads, shared drives, and paper files, they ask Olivia. She searches across every price list, every past conversation, every signed contract — and surfaces the original agreement from March, with the exact terms. Ten seconds. Answer found.  
*Financial clerk · Procurement*

---

### Chat History & Settings (`history.js`)
**Technical side**  
Saved conversations, model catalogue, temperature, tokens, and persistence.  
- Save chats locally or to an agent  
- Adjustable temperature slider  
- Input/output token counter with cost estimate  
- Model catalogue (DeepSeek, Anthropic, OpenRouter, etc.)  

**Real-world side**  
*“We solved this stock-count problem last month — here's how.”*  
A warehouse discrepancy comes up again. Instead of solving it from scratch, someone searches the chat history and finds the conversation from four weeks ago where Olivia walked through the fix step by step. The answer is already there. No one has to remember. No one has to be the person who “knows how we did it last time.”  
*Everyone · Warehouse*

---

### NLP & Intelligence Pipeline (`discovery.js`)
**Technical side**  
Document ingestion → entity extraction → violation detection → gap report → timeline → narrative.  
- Preview documents (PDF, DOCX, audio, image)  
- LLM‑powered corpus overview & group descriptions  
- Violations, gaps, timeline, case state  
- Enriched semantic search over processed docs  

**Real-world side**  
*“Hand me the stack. I'll read everything — and flag what doesn't add up.”*  
A pile of delivery notes, invoices, and incident reports lands on the financial clerk's desk. Olivia reads through all of it — flagging a missing signature on page 14, a quantity that doesn't match the order, a date that's out of sequence. The kind of thing a sharp-eyed clerk would catch, if they had unlimited time, a perfect memory, and no distractions. Now they do.  
*Financial clerk · Compliance · Warehouse*

---

### Document Browser (`docs.js`)
**Technical side**  
Tree view of the active project with preview, output panel, and built‑in browser.  
- Expandable directory tree with file counts  
- Preview PDF, HTML, Markdown, JSON, audio, image  
- Open in integrated browser  
- Pin absolute paths for agent context  

**Real-world side**  
*“A filing cabinet I can actually search — from anywhere.”*  
Open any receipt, contract, spreadsheet, or photo straight in the browser. Pin the ones you're actively working on so Olivia keeps them close in the conversation. No more “it's on the shared drive somewhere” or “I think Sarah has the PDF.” Everything searchable, everything previewable, everything in one place.  
*Financial clerk · Procurement*

---

### Shared Resources (`shared.js`)
**Technical side**  
Manage _shared files, import contexts, image attachments, and case pipelines.  
- Browse scopes and shared files  
- Context files (text & image)  
- Attach images via clipboard, upload, or paste  
- Case pipeline: 7 stages with progress bar  

**Real-world side**  
*“One version of the truth — for procurement, sales, and the warehouse.”*  
A supplier list gets updated. A photo of damaged stock gets shared. This week's price sheet goes live. Everyone — procurement, sales, finance, the warehouse — sees the same version instantly. No “which spreadsheet is the latest?” No email attachments with “FINAL_v3_REVISED” in the filename. One drawer. One truth.  
*Procurement · Sales · Warehouse*

---

## Legal & Compliance
**Legal & Compliance**

### Navigate legal sources, resolve violations, *attach context instantly*.

---

### Legal Library (LA8159) (`law_library.js`)
**Technical side**  
Browse legal sources (BR, CL, INT) with ELI metadata, SHA‑256, and full article text.  
- Jurisdiction index with source counts  
- Rendered Markdown with frontmatter  
- Attach sources to chat context  
- Filter by jurisdiction and text search  

**Real-world side**  
*“What does the regulation actually say? Not what someone told me — the real wording.”*  
A compliance officer needs to check the exact text of a rule — not a summary, not someone's interpretation, not an outdated PDF that's been forwarded six times. Olivia pulls up the source, verified, with metadata showing when it was last updated. No guessing. No “I think it says.” Just the actual regulation, on screen, in seconds.  
*Compliance · HR*

---

### Legal Router (`legal-router.js`)
**Technical side**  
Resolve violation IDs, frameworks, and persons — auto‑attaches relevant files to the chat.  
- Search by violation, framework, or person  
- Resolved files with snippets and action buttons  
- Auto‑attach after resolution  

**Real-world side**  
*“Case number, person's name, rule reference — type one thing, get everything.”*  
A manager needs every document related to a specific incident. They type the case reference into Olivia, and every file — reports, correspondence, relevant regulations — appears in the conversation at once. Like having an assistant who never misfiled anything and never went home.  
*Compliance · Managers*

---

### Violation Explorer (`violations.js`)
**Technical side**  
Navigate the LA8159 corpus of validated violations (BR, CL, INT) with severity and legal basis.  
- Jurisdiction tree with .violation.json files  
- Formatted JSON with severity, legal_basis  
- Search by ID, category, or text  
- Attach violation with inline text to chat  

**Real-world side**  
*“Every compliance issue, searchable, with the reasoning attached — not buried in a folder.”*  
Someone needs to write a compliance report and they don't have a week to dig through filing systems. Olivia already has every issue catalogued and searchable — what it was, why it mattered, what regulation it breached, and what happened next. The report practically writes itself.  
*Compliance*

---

## Communication & Media
**Communication & Media**

### Transcribe audio, edit spreadsheets, *compose documents* — all with agent assistance.

---

### Audio Transcription (`listening.js`)
**Technical side**  
Upload, diarise, transcribe with Whisper/RunPod, and ask questions about the content.  
- Supports M4A, MP3, WAV, FLAC, OGG  
- Speaker diarisation  
- RunPod GPU support  
- AI analysis: ask about transcript content  

**Real-world side**  
*“What did the supplier actually promise on that call?”*  
A procurement officer had a tense phone call with a supplier about delivery dates. They recorded it. Olivia transcribes it — speaker by speaker — in minutes. Then the officer asks: “What did they commit to, and by when?” Olivia pulls out the exact promises, with the speaker labelled. No he-said-she-said. No memory gaps. Just the record.  
*Procurement · Managers*

---

### Spreadsheet Editor (`sheets.js`)
**Technical side**  
Interactive grid for CSV/XLSX with import/export, agent chat, and “HAVAN document” export.  
- Cell editor with Tab/Enter navigation  
- Import CSV & XLSX (SheetJS)  
- Export CSV, XLSX, DOCX, PDF, HTML  
- Ask the agent about the spreadsheet  

**Real-world side**  
*“Which supplier line has the biggest markup? Just ask the spreadsheet.”*  
A financial clerk opens the monthly stock-and-sales sheet and types: “Show me the top five supplier lines by margin, and flag any that have dropped more than 5% since last month.” No formulas. No pivot tables. No exporting to another tool. The answer comes back in the chat, right next to the spreadsheet.  
*Financial clerk · Procurement*

---

### Markdown / Text Editor (`writer.js`)
**Technical side**  
Write with markdown shortcuts, import DOCX/PDF, and chat with the agent about your document.  
- Bold, italic, headings, lists shortcuts  
- Import DOCX (mammoth), PDF (pdf.js), TXT, MD, HTML  
- Copy/paste rendered Markdown  

**Real-world side**  
*“Draft the staff notice. Pull in the old policy doc. Get the tone right.”*  
A manager needs to write an update to the team about new opening hours. They import last year's policy document so Olivia can reference it, describe the changes in plain language, and get back a draft that sounds professional, matches the house style, and is ready to send in ten minutes instead of an hour.  
*HR · Managers*

---

## Connectors & Extensions
**Connectors & Extensions**

### Integrate Google Drive, multi‑jurisdictional litigation, *and 3D generation*.

---

### Google Drive Manager (`drive.js`)
**Technical side**  
Browse, upload, download, and chat with an assistant about your Drive files.  
- OAuth2 and rclone‑style auth  
- Folder navigation with back/forward history  
- Agent chat for Drive operations  

**Real-world side**  
*“Last month's rota — it's in the team Drive. I need it now, without leaving Olivia.”*  
A manager is planning next week's shifts and needs to reference last month's rota for comparison. Instead of opening a new tab, navigating Google Drive, hunting through folders, downloading, and re-uploading — they just ask Olivia to pull it up. It appears in the conversation. No tab-switching. No file-hunting.  
*Everyone · Managers*

---

### Multi‑Jurisdictional Litigation (`craudio.js`)
**Technical side**  
24 workflows and 8 specialised agents for civil litigation (BR, CL, international).  
- Workflows: configuration, analysis, drafting, review  
- Agents for deadlines, evidence integrity, jurisprudence  
- Pipeline: evidence → norms → nexus → confidence → jurisprudence  

**Real-world side**  
*“This dispute isn't just paperwork anymore — and we need it handled properly.”*  
When a disagreement with a supplier or customer escalates beyond an email thread, a team of specialist assistants tracks deadlines, cross-references evidence, checks precedents, and flags what needs attention next — the kind of legwork a paralegal team would normally spend days on, now running in the background while the team focuses on decisions.  
*Compliance · Procurement*

---

### Meshy 3D Interface (`meshy-ui.js`)
**Technical side**  
Generate 3D models from text or images via the Meshy MCP agent.  
- Text → 3D with options (lowpoly, PBR, rigging)  
- Image → 3D (up to 4 views)  
- Import existing tasks by ID  

**Real-world side**  
*“Take two phone photos of the product — get a 3D model for the online listing.”*  
A sales rep needs a rotating product view for the website, but there's no 3D designer on staff and no budget for one. They snap two photos of the product on their phone, upload them to Olivia, and get back a 3D model. Ready for the listing. No design department. No outsourced studio. Just a conversation and two photos.  
*Sales · Marketing*

---

## UI & Navigation
**UI & Navigation**

### The shell that holds *every workspace together*.

---

### Sidebar & Tabs (`tabs.js`)
**Technical side**  
Dock with hover/click, collapse toggle, resize handle, and cross‑section sync.  
- Expandable icon + label dock  
- Switch sections with auto‑close  
- Mobile overlay & strip  
- Resizable sidebar via drag  

**Real-world side**  
*“Four tabs, not fourteen — and arranged the way I actually work.”*  
The sidebar only shows the tools relevant to your role — collapsible, reorderable, and it remembers how you like it. A cashier sees till tools. A procurement officer sees supplier tools. Nobody has to scroll past features they'll never use to find the one they need right now.  
*Everyone*

---

### Profile Navigation (`trunk.js`)
**Technical side**  
Loads section-registry.json and renders the navigation tree based on user permissions.  
- Data‑driven from /api/user/me  
- Collapsed branch icons  
- Auto‑activates the first available section  

**Real-world side**  
*“I log in — and I see till tools. Procurement logs in — and they see supplier tools.”*  
Your own front door. Olivia knows who you are and what you do, so the navigation shows your world, not a generic menu that everyone has to wade through. A cashier doesn't see the legal library. A compliance officer doesn't see the till reconciliation screen. Everyone gets the tools that match their actual job.  
*Cashier · Procurement*

---

### Modals & Forms (`modals.js`)
**Technical side**  
Creation, confirmation, alert, loading, and file‑selection dialogs.  
- Agent/project/collection creation forms  
- Confirmation with callbacks  
- Loading modal with message  

**Real-world side**  
*“Are you sure? — the question that saves a shift, an order, or a rota.”*  
Before anything important gets deleted — a shift, an order, a rota, a supplier record — Olivia asks “are you sure?” It sounds simple, but anyone who's ever accidentally wiped a week's schedule or cancelled a delivery knows this one small confirmation is worth its weight in stress avoided.  
*Everyone*

---

### Fullscreen Overlay (`fullscreen-controls.js`)
**Technical side**  
Floating controls for 3D scenes — play, wireframe, environment, exposure, record, chat.  
- Play/Pause, Wireframe, Reset  
- Environment selector  
- Exposure slider  
- REC status indicator  

**Real-world side**  
*“Showing a customer the 3D preview — and the controls stay out of the way.”*  
When you're presenting a product preview to a customer or supplier, clean controls hover at the edge of the screen — play, reset, adjust the lighting — without cluttering the view. The focus stays on what they're looking at, not on how the software works.  
*Sales · Procurement*

---

### Mobile Menu (`nav.js`)
**Technical side**  
Responsive hamburger menu, mobile sidebar toggle, and tab navigation.  
- Dropdown with navigation items  
- Mobile overlay toggle  
- Active link highlight  

**Real-world side**  
*“Built for the shop floor, not just the desk.”*  
Everything above — the sidebar, the tools, the search, the chat — works from your phone. Behind the bar. On the shop floor. Mid-shift. One-handed if it needs to be. Because not everyone doing this job sits at a desk with a big screen, and the software shouldn't pretend they do.  
*Bartender · Cashier · Warehouse*

---

## Summary
**Summary**

### Every module. One ecosystem. *Every job, both sides.*

From agents and memory to legal libraries and 3D studios — Olivia turns operational expertise into working, AI‑assisted tools. Flip any card above and it stops being a module name. It becomes someone's Tuesday afternoon. A till balanced. A supplier chased. A quote sent. A shift covered. A problem solved before it became a crisis.

Cashiers · Bartenders · Financial clerks · Procurement · Sales · Warehouse & stock · Reception · Compliance & HR · Managers · IT support · Marketing

---

## Mission
**Mission**

### Democratise the creation of AI-powered *capability*.

We exist so that every business, charity, team, and individual worker can translate their operational expertise into practical, AI-assisted systems — without having to become software engineers.

1. **Adapts to the organisation**, not the other way around — learning from the people who know the work best.  
2. **Turns knowledge into working software**, with domain experts collaborating directly with AI agents.  
3. **Enables learning while building** — every interaction builds both capability and skill.  
4. **Unites the organisation** in one living ecosystem, turning isolated efforts into shared intelligence.  
5. **Grows with the people who use it** — never limited to predefined features.  
6. **Keeps people at the centre** — AI accelerates implementation, people provide context, judgment, and priorities.

*Olivia — Awareness · AI*

---

## Book a demonstration
**Book a demonstration**

### Where every job doesn't just use AI. *It grows with it.*

Technology has always asked people to learn software. Olivia asks software to learn people.

*Tell us about your team…*

---

© Olivia Ecosystem  
Vision · Imagine · Guide · Core · Agents · Creativity · Data · Legal · Media · Connectors · UI · Mission · Demo