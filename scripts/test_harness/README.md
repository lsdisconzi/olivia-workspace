# Test Harness

Automated testing, documentation, and validation for the 1,447 VPS API endpoints.

## Overview

Three tools that work as a pipeline:

```
endpoints.json
     │
     ▼
┌─────────────────────────┐
│ 1. test_orchestrator.py │  ← hits the VPS, records live results
└───────────┬─────────────┘
            │ test_results.json
            ▼
┌─────────────────────────┐
│ 2. validation_updater.py│  ← updates scores, function files, triage
└───────────┬─────────────┘
            │ enriched data
            ▼
┌─────────────────────────┐
│ 3. openapi_generator.py │  ← produces per-service OpenAPI 3.1 specs
└─────────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
pip install aiohttp
```

### 2. Dry-run to see what would be tested

```bash
python test_harness/test_orchestrator.py \
  --base-url https://your-vps.example.com \
  --dry-run
```

This prints every endpoint with its resolved URL and test layer — no HTTP calls made.

### 3. Run tests (GET endpoints only)

```bash
python test_harness/test_orchestrator.py \
  --base-url https://your-vps.example.com \
  --concurrency 10
```

Output goes to `test_harness/output/test_results.json` and `test_summary.json`.

### 3b. Retest only untested/unknown VPS functions (detailed)

When you already have `test_results.json` and want concrete status for assignable
VPS capabilities, run the focused retest script:

```bash
python scripts/test_harness/retest_vps_functions.py \
  --base-url http://72.60.143.139:8080 \
  --statuses untested,unknown \
  --concurrency 20 \
  --timeout 25
```

It writes `scripts/test_harness/output/retest_untested_vps_functions.json` with:
- per-function method/url/full_url
- HTTP code, latency, content-type
- response preview/body snapshot
- status distribution and pass rate

Useful flags:

```bash
# include routes with placeholders like /api/foo/{id}
--include-template-routes

# cap batch size while iterating
--max-functions 300

# include write methods if you explicitly want mutation testing
--allow-write-methods

# authenticated endpoints
--bearer-token "$Olivia_ADMIN_API_TOKEN"
```

### 4. Update validation data

```bash
python test_harness/validation_updater.py
```

This updates:
- `agent_functions/validation_report.json` — scores + checks
- `agent_functions/functions/*.json` — per-function test status, HTTP code, fix suggestions
- `agent_functions/triage_report.json` + `.md` — regenerated triage

### 5. Generate OpenAPI 3.1 specs

```bash
python test_harness/openapi_generator.py
```

Per-service specs land in `vps_functions_endpoints/openapi/`.

## Tool Reference

### test_orchestrator.py

```
python test_orchestrator.py --base-url URL [options]

Options:
  --base-url URL       VPS base URL (required)
  --endpoints-json     Path to endpoints.json (auto-detected)
  --output-dir         Output directory (default: test_harness/output/)
  --layer N            Only test layer N (0=smoke, 1=path, 2=query, 3=hybrid)
                       Repeatable: --layer 0 --layer 1
  --concurrency N      Max parallel requests (default: 10)
  --timeout N          Request timeout seconds (default: 30)
  --dry-run            Print what would be tested, no HTTP calls
```

**Test Layers:**

| Layer | Description | Example |
|-------|-------------|---------|
| 0 — Smoke | No path or query params | `/health`, `/api/agents/list` |
| 1 — Path params | Path vars like `{agent_id}` | `/api/agents/{agent_id}` |
| 2 — Query params | Query string only | `/api/search?q=test` |
| 3 — Hybrid | Both path + query params | `/api/agents/{agent_id}/logs?limit=10` |

Layer 0 runs first. If it discovers real agent IDs, those are reused in later layers.

### validation_updater.py

```
python validation_updater.py [--test-results PATH] [--dry-run]
```

Updates three data sources:
1. **validation_report.json** — recalculates `validation_score`, sets `validation_checks` (method_defined, url_defined, tested, working, etc.)
2. **Individual function files** — sets `test_status`, `test_http_code`, `fix_suggestion`, and captures live `response_schema`
3. **triage_report** — regenerates both `.json` and `.md` with categorized results

### openapi_generator.py

```
python openapi_generator.py [options]

Options:
  --endpoints-json PATH
  --test-results PATH   Enriches specs with live response schemas
  --output-dir PATH     Default: ../openapi/
  --service NAME        Generate only for one service (e.g., 'gateway')
```

Output: per-service OpenAPI 3.1 JSON files with:
- Paths, methods, parameters, request bodies, response schemas
- `x-test-status` and `x-test-latency-ms` extensions for tested endpoints
- Live response schemas (when test_results.json is provided)

## File Map

```
vps_functions_endpoints/
├── endpoints.json              # 1,447 raw endpoints (input)
├── agent_functions/
│   ├── validation_report.json  # per-function scores (updated)
│   ├── triage_report.json      # triage data (regenerated)
│   ├── triage_report.md        # triage markdown (regenerated)
│   └── functions/*.json        # 1,314 function defs (updated)
├── openapi/                    # per-service OpenAPI 3.1 specs (generated)
│   ├── awareness.openapi.json
│   ├── gateway.openapi.json
│   └── ...
└── test_harness/
    ├── test_orchestrator.py
    ├── openapi_generator.py
    ├── validation_updater.py
    └── output/
        ├── test_results.json   # full test run data
        └── test_summary.json   # counts by status
```

## What Gets Tested

- Only **GET** endpoints are tested (mutations skipped per safety policy)
- **1,447** total endpoints → **1,000** GET endpoints
- Currently **98** are validated OK, **~1,200** untested

## Interpreting Results

After a test run, each endpoint gets a status:

| Status | Meaning |
|--------|---------|
| `ok` | HTTP 2xx — working |
| `not_found` | HTTP 404 — route missing or wrong URL |
| `client_error` | HTTP 4xx — bad params, auth required, etc. |
| `server_error` | HTTP 5xx — backend failure |
| `timeout` | No response within timeout window |
| `connection_error` | VPS unreachable or DNS failure |

Validation scores are computed 0–100:
- 10 pts: method defined
- 10 pts: URL defined
- 10 pts: parameters defined
- 10 pts: body schema (for writes) or N/A (for reads)
- 20 pts: response schema documented
- 15 pts: tested
- 25 pts: tested + working (HTTP 2xx)

## MCP Validation

The 97 MCP-ready tools in `mcp_tools_ready.json` were pre-validated. After a test run, the validation updater can identify additional functions that now meet the strict gate criteria (validation_score = 100, tested + working, full schema coverage) and could be promoted to MCP-ready status.
