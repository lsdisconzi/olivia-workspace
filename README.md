# Olivia — Workspace Runtime

Olivia is the central assistant and agent communication layer for this workspace runtime.

## What Olivia centralizes

- UI and conversation entrypoint: `/olivia/`
- Agent/assistant chat and SSE orchestration
- MCP bridge exposure of VPS API endpoints as tools
- Case context injection into every run
- Planning continuity via `olivia/task_plan.md`, `findings.md`, `progress.md`

## Start

```bash
cd 
cp .env.example .env
# edit .env with VPS_GATEWAY_URL and API keys
./start-all.sh
```

Start with dynamic function-sync watcher enabled:

```bash
./start-all.sh --watch-functions --watch-interval 20
```

Primary URL:

- `http://localhost:3229/olivia/`

## Canonical Olivia Data Roots

To keep Olivia agent paths stable across backup/cleanup/redeploy cycles, set canonical roots in `.env`:

```bash
Olivia_SHARED_DIR=/Users/dev/services/_shared
Olivia_LEGAL_ROUTER_ROOT=/Users/dev/agents/agents-groups/olivia/source
Olivia_VIOLATIONS_ROOT=/Users/dev/services/_shared/cases/10_violations_json/validated
Olivia_LAW_LIBRARY_ROOT=/Users/dev/services/_shared/cases/law_md
```

When these are set, Olivia resolves Olivia data from shared/group-owned paths first and only falls back to legacy paths when needed.

## Authentication Flow

Olivia now supports first-access onboarding with session login.

1. First access redirects to `GET /olivia/login`.
2. If no users exist yet, the first login submission creates the initial admin account.
3. Login requires Google-style email format (`gmail.com`) and password.
4. After login, users land at `GET /olivia/mode-select` to choose:
   - `Workspace` (`/olivia/olivia.html`)
   - `Mobile Remote` (`/olivia/mobile.html`)
   - `Agent Mobile` (`/olivia/agent`)
5. Logout endpoint: `GET /olivia/logout`.

Admin routes:

- Activity dashboard: `GET /olivia/admin/activity`
- Activity API: `GET /olivia/admin/activity/api`
- Users UI: `GET /olivia/admin/users-ui`
- Users API: `GET/POST /olivia/admin/users`
- User management actions:
  - `DELETE /olivia/admin/users/<email>`
  - `POST /olivia/admin/users/<email>/reset-password`
  - `PATCH /olivia/admin/users/<email>/assistant-permissions`

## Core flow

1. User interacts with Olivia UI.
2. `serve.py` enriches prompts with workspace context and planning files.
3. OpenClaude executes with MCP tools from `src/mcp/vps_bridge.py`.
4. MCP bridge calls VPS gateway endpoints (`VPS_GATEWAY_URL`) for services.

## Notes

- Olivia reads function catalogs dynamically from the latest generated report in `reports/ecosystem/agent_functions`.
- Shaders agent operational contract and implementation guide: `docs/shaders-agent-system.md`.
- Historical shader upgrade notes are archived in `docs/shaders-archive/`.
- Live reload endpoint: `serve.py` exposes `POST /api/functions/reload`.
- Automatic sync watcher: `automation/watch_functions_sync.py`
  - Watches `reports/api-audit` for new `api_endpoint_catalog_*.json`
  - Regenerates catalogs via local `endpoint_mapper.py`
  - Calls Olivia reload endpoint so API Explorer reflects updates immediately
- Manual one-shot sync:

```bash
cd OliviaLegal
./.venv/bin/python automation/watch_functions_sync.py --once
```

- To pick up changed project docs for context, restart OliviaLegal.
- Endpoint catalog updates no longer require restarting OliviaLegal.
- If using a remote VPS gateway, ensure `VPS_GATEWAY_URL` points to the externally reachable gateway base URL.

## API Explorer Map Navigation

`API Explorer > Mapa` now supports map mode switching to improve navigation for large inventories:

- `Mapa: Funções`: renders the local function-catalog flow (`/api/functions/diagram`).
- `Mapa: VPS MCP`: renders a Mermaid topology grouped from live VPS MCP tools.
- `Mapa: Funções + VPS MCP`: renders a combined high-level view of local functions and VPS MCP runtime.

The selected map mode is persisted in browser local storage (`OliviaLegal.aex.diagram.mode`).

### Planned Layout Style Selector

To further improve readability at scale, the next UI step is a second selector for layout style:

- `Flow`: balanced graph for quick exploration.
- `Service-centric`: emphasize server/service nodes and their tool families.
- `Endpoint-centric`: emphasize route groups and endpoint density.

This is intended to sit alongside the existing map mode selector in the same `Mapa` toolbar.

### How To Verify In UI

1. Open `http://localhost:3229/olivia/olivia` and go to `API Explorer > Mapa`.
2. Change `aexMapMode` across all options and confirm the diagram updates for each mode.
3. Click `Recarregar` and confirm the currently selected mode remains active.
4. Refresh the page and confirm mode persistence from `OliviaLegal.aex.diagram.mode`.
5. For large inventories, validate that the map remains navigable with pan/scroll in each mode.
