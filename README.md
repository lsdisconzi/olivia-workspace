# Olivia — Workspace Runtime

Olivia is the central assistant and agent-communication layer for the Olivia legal workspace: UI/chat orchestration, an MCP bridge that exposes VPS endpoints as tools, case-context injection into every run, and planning continuity.

## First run / Initial setup

After starting the server for the first time and logging in, you'll see the **Setup Wizard** — a guided, 11-step onboarding flow that lets you connect Olivia to your preferred AI providers, databases, and local document directories.

You can reach it at `http://localhost:3229/olivia/setup` or it will open automatically on first login.

The wizard steps:

| Step | What you configure | Required? |
|------|--------------------|-----------|
| 1. Welcome | Overview — skip or get started | No |
| 2. Language | Response language preference | No |
| 3. AI Provider | Choose your **primary** AI (Fireworks, OpenRouter, DeepSeek, Ollama local, or Custom) | No |
| 4. API Key + Model | Enter key for the primary provider and select a default model | No |
| 5. Additional AI Keys | Optional keys for other providers you may switch to later | No |
| 6. Qdrant | Vector DB for semantic search / long-term memory | No |
| 7. Neo4j | Graph DB for the legal knowledge graph | No |
| 8. Google Drive | OAuth credentials so Olivia can ingest Drive documents | No |
| 9. Local directories | Paths for law library, violations, jurisprudence, master files | No |
| 10. Optional backends | ComfyUI endpoint (for image/document generation) | No |
| 11. Review & Finish | Confirm your selections — written to `.env` via the backend | — |

**Every step can be skipped** — you can always complete configuration later by re-running the setup wizard (`/olivia/setup`) or editing your `.env` file directly.

When you finish, the wizard sends the configuration to `POST /api/setup/save`, which writes the non-null values to your `.env` file and stores a safe (non-secret) snapshot in your user preferences. On subsequent runs, the wizard loads your existing preferences (`/api/user/preferences`) and pre-fills fields you've already configured, so you can update individual keys without re-entering everything.

If the app is embedded (e.g., inside the Electron desktop client), the wizard detects modal mode and communicates completion back to the host window via `postMessage`.

## Quick start

```bash
# Start the full stack: venv setup, deps, serve.py on :3229, Electron desktop
./runtime/start-all.sh

# Useful flags (see runtime/start-all.sh for the full list)
./runtime/start-all.sh --smoke            # run smoke checks after boot
./runtime/start-all.sh --ollama           # auto-start Ollama
./runtime/start-all.sh --index            # rebuild project-index.json
./runtime/start-all.sh --reindex-qdrant   # rebuild + push Qdrant indexes
```

Primary URLs:

- UI: `http://localhost:3229/olivia/`
- API root: `http://localhost:3229/api`
- Health: `http://localhost:3229/api/health`

To stop: `./runtime/stop-all.sh`.

## Prerequisites

- Node.js ≥ 20 (OpenClaude CLI runtime)
- Python ≥ 3.10
- Optional: Ollama (`--ollama`), Qdrant (`--reindex-qdrant`)

## Authentication

First access redirects to `GET /olivia/login`. If no users exist yet, the first login creates the initial admin account. After login users land at `GET /olivia/mode-select` to choose `Workspace`, `Mobile Remote`, or `Agent Mobile`. Logout: `GET /olivia/logout`.

## Configuration

Create a `.env` file at the project root. `runtime/config_doctor.py` validates it at startup (`--skip-config-doctor` bypasses). Key variables:

| Group | Variables |
|-------|-----------|
| Model providers | `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `DEEPSEEK_API_KEY`, `FIREWORKS_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` |
| VPS gateway / MCP | `VPS_GATEWAY_URL`, `MCP_SERVER_RUNPOD_API`, `RUNPOD_API_KEY` |
| Shared data | `SHARED_DIR`, `AWARENESS_SHARED_DIR`, `LEGAL_ROUTER_ROOT`, `AWARENESS_LAW_LIBRARY_ROOT`, `AWARENESS_VIOLATIONS_ROOT` |
| Ollama | `OLLAMA_HOST`, `OLLAMA_MODEL_URLS`, `OLLAMA_KEEP_ALIVE`, `OLLAMA_NUM_CTX` |
| Qdrant | `QDRANT_URL`, `QDRANT_API_KEY` |
| Admin | `ADMIN_USERNAME`, `ADMIN_PASSWORD` |

Runtime-tunable config lives at the root as `ollama-servers.json` (Ollama discovery endpoints) and `models-overrides.json` (model/base-url overrides).

## Repository layout

| Path | Purpose |
|------|---------|
| `serve.py` | Main HTTP server (`http.server`), serves the UI from `frontend/` under `/olivia/*`, plus `/api` endpoints, SSE chat, and the MCP bridge |
| `runtime/` | Launcher scripts (`start-all.sh`, `stop-all.sh`) and `config_doctor.py` |
| `src/` | Python packages — MCP bridge, orchestration contracts, runtime config |
| `frontend/` | Web UI served at `/olivia/` (no build step) |
| `desktop/` | Electron desktop wrapper |
| `agents/` | Agent groups, skills, and knowledge |
| `context/` | System prompt (`context/sys_prompt.txt`) |
| `context_manager/` | Context, history, and RAG management |
| `scripts/` | Tooling: indexing, i18n, smoke tests |
| `config/` | Runtime config, `requirements.txt`, index-project, ecosystem metadata |
| `tests/` | Pytest suite |
| `translations/` | Generated i18n dictionaries |
| `generated/` | Generated bundles, schemas, policies |
| `content/` | Case/project content (runtime data) |
| `deploy/` | Deployment scripts (`deploy/vps/`) |
| `planning/` | Planning artifacts (`task_plan.md`, `progress.md`, `findings.md`) |
| `pluggins/craudio` | Git submodule (`craudio-para-adevogados`) |

Runtime-only directories — created locally and gitignored: `.venv/`, `_shared/`, `uploads/`, `data/`, `outputs/`, `context_snapshots/`, `_improvements/`, `project-index.json`.

> Note: `.openclaude-runtime/` (the vendored OpenClaude CLI runtime) is tracked in the repo, not runtime-only.

## Indexing (Qdrant / project index)

- `scripts/index_project.py` — builds `project-index.json`; `--push-to-qdrant` also indexes dev code into Qdrant.
- `scripts/index_uploads_to_qdrant.py` — indexes uploaded documents (Tier 2/3).
- `scripts/fetch_ecosystem.py` — refreshes `config/ecosystem_metadata.json`.

## i18n

`scripts/i18n_mapper.py` is the unified extractor; regenerate `translations/` with:

```bash
python scripts/i18n_mapper.py --project-root . --output-dir translations
```

## Tests

```bash
./.venv/bin/python -m pytest tests/
```

## Notes

- MCP tools are exposed via `src/mcp/`; the VPS gateway endpoints are bridged as tools for OpenClaude.
- `start-all.sh` installs the prebuilt `@gitlawb/openclaude` CLI into `.openclaude-runtime/` when no local `openclaude/` source build exists.
- Function-catalog reload endpoint: `POST /api/functions/reload`.
