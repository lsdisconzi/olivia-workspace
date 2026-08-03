# LegalPipeline MCP Bootstrap Instructions

Project root: <project>/legalpipeline
MCP folder: <project>/legalpipeline/mcp

Use the standard in docs/MCP_BOOTSTRAP_STANDARD.md.

## Required Pattern

- Pattern: node-mcp-single
- Main server file: mcp/legalpipeline_mcp_server.js
- Tool prefix: legalpipeline_

## Deliverables

1. mcp/legalpipeline_mcp_server.js
2. mcp/generate_readiness_artifacts.js
3. mcp/mcp_readiness_report.md
4. mcp/mcpServers.example.json
5. mcp/MCP_ARCHITECTURE.md
6. mcp/README.md

## Scope Checklist

- Expose all in-scope LegalPipeline backend endpoints as MCP tools.
- Add destructive confirmation guard where applicable.
- Read config from env vars (`LEGALPIPELINE_BASE_URL`, token if used).
- Produce readiness report with totals, mapped, missing, coverage.

## Completion Check

- `node --check mcp/legalpipeline_mcp_server.js`
- `node mcp/generate_readiness_artifacts.js`
- Readiness status is `ready` with no missing in-scope endpoints.
