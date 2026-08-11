# API Routes

> Generated from `serve.py` inspection. The code is the source of truth — this document is derived documentation.
> **Confidence:** [verified] = confirmed in serve.py dispatch.

---

## Route Dispatch Architecture

`serve.py` uses a custom `do_GET` / `do_POST` / `do_DELETE` / `do_PATCH` handler (not a framework). Routes are dispatched via if/elif chains with sub-dispatchers for API path prefixes.

- `do_GET` — lines 11830-12044
- `do_POST` — lines 12046-12148
- `do_DELETE` — lines 12150-12175
- `do_PATCH` — lines 12177-12196
- `_api_get(path)` sub-dispatcher — lines 16681-16993
- `_api_post(path)` sub-dispatcher — lines 16995-17218

---

## Summary Table

### Auth / Session

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/olivia/login` (aliases) | `_auth_login_get` | Login page |
| POST | `/olivia/login` (aliases) | `_auth_login_post` | Login form submit |
| GET | `/olivia/logout` (aliases) | `_auth_logout_get` | Logout |
| POST | `/olivia/api/activity/client` | `_auth_activity_client_post` | Activity tracking |

### User / Preferences

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/user/me` | trunk.js (fetched at init) | User profile + sections allow-list |
| GET | `/api/user/preferences` | `_user_preferences_get` | User preferences |
| POST | `/api/user/preferences` | `_user_preferences_post` | Update user preferences |
| GET | `/api/user/context-files` | `_user_context_files_get` | User context file list |
| POST | `/api/user/context-files` | `_user_context_files_post` | Save user context files |

### Chat / Assistant

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/api/assistant/chat` | `_assistant_chat` | Main chat (SSE streaming to Garage) |
| POST | `/run`, `/api/olivia/run` | `_agent_run` | Agent run (legacy) |
| GET | `/api/assistant/context-preview` | `_assistant_context_preview_api_get` | Context preview for run |
| GET | `/api/models/catalog` | `_models_api_catalog_get` | Available model catalog |
| POST | `/api/agent/stop` | `_stop_active_agent_processes` | Stop running agent |
| POST | `/api/guided/stop` | `_stop_active_agent_processes` | Stop guided session |
| POST | `/api/auditor/stop` | `_stop_active_agent_processes` | Stop auditor session |
| POST | `/api/permission-response` | (inline) | Frontend permission allow/deny |

### Agents

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/agents/list` | `_agents_api_list` | List all agents |
| GET | `/api/agents/{id}` | `_agents_api_get` | Get agent detail |
| POST | `/api/agents/create` | `_agents_api_create` | Create agent |
| POST | `/api/agents/{id}/activate` | `_agents_api_post_action` | Activate agent |
| POST | `/api/agents/{id}/deactivate` | `_agents_api_post_action` | Deactivate agent |
| POST | `/api/agents/import/bundle` | `_agents_api_import_bundle` | Import agent bundle |
| GET | `/api/agents/{id}/bundle/export` | `_agents_api_get` | Export agent bundle |
| DELETE | `/api/agents/{id}` | `_agents_api_delete` | Delete agent |
| POST | `/api/agents/{id}/workspace/upload` | `_handle_upload` | Upload to agent workspace |
| POST | `/api/agents/workspace/resolve` | `_agents_api_workspace_resolve` | Resolve workspace path |
| POST | `/api/agents/generate-config` | `_agents_api_generate_config` | Generate agent config |
| PATCH | `/api/agents/{id}` | `_agents_api_patch` | Update agent |
| GET | `/api/agents/background/status` | `_agents_background_status_get` | Background agent status |
| GET | `/api/agents/investigation/board` | `_agents_investigation_board_get` | Investigation board |

### Agent Groups

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/agent-groups` | inline | Agent groups catalog |
| GET | `/api/agent-groups/file?path=` | inline | Agent group file content |

### Architecture

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/architecture` | `_architecture_api_get` | Architecture proxy (visualizer on :8120) |
| GET | `/api/architecture/{path}` | `_architecture_api_get` | Architecture sub-resource |
| GET | `/api/skills/tree` | `_architecture_skills_tree` | Skills tree |
| GET | `/api/skills/manifest` | `_skills_manifest` | Skills manifest from agents/skills/manifest.json |
| POST | `/api/skills/generate-section` | `_skills_generate_section_post` | Generate workspace section |

### Orchestration

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/orchestration/contracts` | inline | Orchestration contract bundle |
| GET | `/api/orchestration/ready` | `_serve_ready` | Orchestration readiness check |

### MCP / Functions

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/functions` | `_api_functions_get` | Function catalog |
| POST | `/api/functions/reload` | inline | Reload function catalog |
| GET | `/api/mcp/servers` | `_mcp_servers_payload` | MCP server list |
| GET | `/api/mcp/tools` | `_mcp_registry_tools_filtered` | MCP tools (filterable: ?server=, ?q=, ?limit=) |
| GET | `/api/mcp/runtime` | `_mcp_runtime_info_payload` | MCP runtime info |
| POST | `/api/mcp/tools/execute` | inline | Execute MCP tool directly |

### Memory / Qdrant

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/memory/collections` | `_memory_api_get` | List collections |
| GET | `/api/memory/collections/{name}` | `_memory_api_get` | Collection detail |
| GET | `/api/memory/sources` | `_memory_api_get` | Memory sources |
| GET | `/api/memory/graph/stats` | `_memory_api_get` | Neo4j graph stats |
| POST | `/api/memory/search` | `_memory_api_post` | Vector search |
| POST | `/api/memory/ingest` | `_memory_api_post` | Ingest documents |
| POST | `/api/memory/ingest/articles` | `_memory_api_post` | Ingest articles |
| POST | `/api/memory/ingest/violation` | `_memory_api_post` | Ingest violation |
| POST | `/api/memory/graph/ingest` | `_memory_api_post` | Ingest to Neo4j graph |
| GET/POST | `/api/memory/routing` | `_memory_api_get`/`_memory_api_post` | Memory routing config |
| GET/POST | `/api/memory/config` | `_memory_api_get`/`_memory_api_post` | Memory configuration |

### Chat History

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/agents/{agentId}/chat/list` | `_agents_api_get` | List saved chats |
| GET | `/api/agents/{agentId}/chat/load` | `_agents_api_get` | Load saved chat |
| POST | `/api/agents/{agentId}/chat/save` | `_agents_api_post_action` | Save chat |

### Shared Resources

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/shared/scopes` | `_shared_api_get` | Shared resource scopes |
| GET | `/api/shared/file?path=` | `_shared_api_get` | Get shared file content |

### Legal

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/legal-router/resolve` | `_legal_router_api_get` | Resolve legal route |
| GET | `/api/legal-router/status` | `_legal_router_api_get` | Legal router status |
| GET | `/api/violations/index` | `_violations_api_get` | Violations index |
| GET | `/api/violations/file?path=` | `_violations_api_get` | Violation file |
| POST | `/api/violations/actions` | (violations sub-dispatcher) | Violation actions |
| POST | `/api/violations/convert` | (violations sub-dispatcher) | Convert violation |
| GET | `/api/law-library/index` | `_law_library_api_get` | Law library index |
| GET | `/api/law-library/file?path=` | `_law_library_api_get` | Law library file |
| GET | `/api/master-index/status` | `_master_index_api_get` | Master index status |

### Case Dossier

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/case/dossier` | `_case_dossier_get` | Case dossier summary + indices |
| GET | `/api/case/documents` | `_case_dossier_documents_get` | Case documents scan |

### Transcripts / Transcription

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/transcripts/list` | (stubs return `[]`) | Transcript list (stub) |
| GET | `/api/transcripts` | `_transcripts_api_get` | Transcript listing |
| GET | `/api/transcripts/{path}` | `_transcripts_api_get` | Transcript file |
| POST | `/api/transcripts/save` | `_transcripts_api_save` | Save transcript |
| GET | `/api/diarization/models/whisper` | (api-client.js) | Whisper model list |
| POST | `/api/diarization/transcribe` | (api-client.js) | Run transcription |

### Projects

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/projects/{pid}` | `_projects_api_get` | Project detail |
| GET | `/api/projects/{pid}/files` | `_projects_api_get` | Project files |
| POST | `/api/projects/{pid}/upload` | `_handle_upload` | Upload to project |
| DELETE | `/api/projects/{pid}` | `_projects_api_delete` | Delete project |
| POST | `/api/projects/{pid}/export` | (projects sub-dispatcher) | Export project |
| POST | `/api/projects/{pid}/convert` | (projects sub-dispatcher) | Convert project files |

### Bridge / Discovery

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/bridge/pipeline/stats` | (stubs return `{total:0}`) | Pipeline stats (stub) |
| GET | `/api/bridge/{path}` | `_bridge_api_get` | Bridge sub-resource |
| POST | `/api/bridge/upload` | `_handle_upload` | Upload to bridge |

### Google Drive

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/api/drive/upload` | `_drive_upload_post` | Upload to Google Drive |
| POST | `/api/drive/delete` | `_drive_delete_post` | Delete from Google Drive |
| POST | `/api/drive/mkdir` | `_drive_mkdir_post` | Create folder |
| POST | `/api/drive/rclone-auth-code` | `_drive_rclone_auth_code_post` | Rclone auth |

### Health

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/health/documents-detail` | `_health_api_get` | Health documents |
| GET | `/api/health/outputs` | `_health_api_get` | Health outputs |
| POST | `/api/health/{path}` | `_health_api_post` | Health module POST |

### ComfyUI / Workflows

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/api/comfyui/upload-image` | `_comfyui_upload_image` | Upload image to ComfyUI |
| POST | `/api/comfyui/queue` | `_comfyui_queue_prompt` | Queue ComfyUI prompt |
| POST | `/api/workflows/save` | `_workflows_api_save` | Save workflow |
| POST | `/api/workflows/test-mask-chain` | `_workflows_test_mask_chain` | Test mask chain |

### RunPod

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/runpod/gpus` | `_runpod_list_gpus_get` | List available GPUs |
| GET | `/api/runpod/workspaces/{id}/status` | `_runpod_workspace_status_get` | Workspace status |
| POST | `/api/runpod/workspaces` | `_runpod_create_workspace_post` | Create workspace |
| POST | `/api/runpod/validate` | `_runpod_validate_post` | Validate RunPod config |
| DELETE | `/api/runpod/workspaces/{id}` | `_runpod_workspace_delete` | Delete workspace |
| GET | `/api/runpod/logs/{id}` | `_runpod_logs_get` | Get workspace logs |
| POST | `/api/runpod/logs` | `_runpod_log_post` | Receive log stream |

### Remote Bus

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/olivia/remote-bus`, `/remote-bus` | `_remote_bus_get` | Long-poll for mobile commands |
| POST | `/api/olivia/remote-bus`, `/remote-bus` | `_remote_bus_post` | Send command to mobile |

### Admin

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/olivia/admin/users` | `_admin_users_get` | List users |
| POST | `/olivia/admin/users` | `_admin_users_create` | Create user |
| DELETE | `/olivia/admin/users/{email}` | `_admin_users_delete` | Delete user |
| PATCH | `/olivia/admin/users/{email}/assistant-permissions` | `_admin_users_permissions_patch` | Update user permissions |
| PATCH | `/olivia/admin/users/{email}/context-scope` | `_admin_users_context_scope_patch` | Update context scope |
| POST | `/olivia/admin/users/{email}/reset-password` | `_admin_users_reset_password` | Reset password |
| GET | `/olivia/admin/activity` | `_admin_activity_page_get` | Activity page |
| GET | `/olivia/admin/activity/api` | `_admin_activity_api_get` | Activity API |
| GET | `/olivia/admin/models` | `_admin_models_get` | List models |
| DELETE | `/olivia/admin/models/{id}` | `_admin_models_delete` | Delete model |
| POST | `/olivia/admin/models/{id}/restore` | `_admin_models_restore` | Restore model |
| GET | `/olivia/admin/ollama-servers` | `_admin_ollama_servers_get` | List Ollama servers |
| DELETE | `/olivia/admin/ollama-servers/{id}` | `_admin_ollama_servers_delete` | Delete Ollama server |
| GET | `/olivia/admin/notifications` | `_admin_notifications_get` | List notifications |
| POST | `/olivia/admin/notifications` | `_admin_notifications_create` | Create notification |
| POST | `/olivia/admin/notifications/{id}/read` | `_admin_notifications_mark_read` | Mark notification read |
| POST | `/olivia/admin/notifications/read-all` | `_admin_notifications_mark_all_read` | Mark all read |

### Miscellaneous

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/health` | `_serve_health` | Health check |
| GET | `/ready`, `/api/ready` | `_serve_ready` | Readiness check |
| GET | `/api/proxy?url=` | `_url_proxy` | Generic URL proxy |
| GET | `/api/ecosystem` | `_ecosystem_metadata_payload` | Ecosystem metadata |
| GET | `/api/ecosystem/agents` | `_ecosystem_agents_payload` | Ecosystem agents |
| GET | `/api/meshy/asset` | `_meshy_asset_proxy` | Meshy 3D asset proxy |
| GET | `/api/plugins/discover` | `_plugins_api_discover` | Plugin discovery |
| POST | `/api/plugins/import` | `_plugins_api_import` | Plugin import |
| GET | `/api/reference/links` | `_reference_links_get` | Reference links |
| POST | `/api/verify-key` | `_verify_key_post` | API key verification |
| POST | `/api/llm/completions` | `_llm_completions_post` | LLM completions proxy |
| GET | `/api/craudio/config` | `_craudio_config_get` | Craudio config |
| POST | `/api/craudio/config` | `_craudio_config_post` | Save craudio config |
| POST | `/api/craudio/import` | `_craudio_import_post` | Craudio import |
| POST | `/api/public/olivia-ask` | `_public_Olivia_ask` | Public ask endpoint |
| GET | `/get_notes` | `_get_notes_get` | Get notes |
| POST | `/add_note` | `_add_note_post` | Add note |
| POST | `/delete_note` | `_delete_note_post` | Delete note |
| GET | `/case_files/{path}` | `_serve_shared_raw` | Public case file serving |
| GET | `/api/permission-suggestions` | (inline) | Permission suggestions |

---

## Static / Page Routes

These serve HTML pages, not API responses:

| Path (aliases) | Serves | Notes |
|---------------|--------|-------|
| `/olivia/login`, `/login` | Login page | |
| `/olivia/mode-select` | Mode selection | |
| `/olivia/`, workspace aliases | `index.html` | Main SPA |
| Agent aliases | `agent.html` | Agent landing page |
| `/olivia/resident.html` aliases | `resident.html` | Resident workspaces |
| Language-specific aliases | `olivia-olivia-{lang}.html` | 8 languages supported |

---

## Notes

- Routes accept both `/api/olivia/` and `/api/` prefix forms (nginx proxy strips `/api/olivia/`)
- Some routes at lines 16883-16892 have stub handlers returning empty data (these are overridden by prefix-based dispatchers for memory/shared, but `/api/transcripts/list` and `/api/bridge/pipeline/stats` stubs are active)
- `_case_dossier_scan()` is an internal helper called by `_case_dossier_get` and `_case_dossier_documents_get` — it is NOT a public route
- Authorization is per-handler via `_auth_current_email()` checks
- ~150 distinct API routes across 15 categories
