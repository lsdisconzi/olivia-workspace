# Pinocchio MCP Bootstrap Instructions

Project root: /Users/leandrodisconzi/2026/pinocchio-main
MCP folder: /Users/leandrodisconzi/2026/pinocchio-main/mcp

Use the standard in docs/MCP_BOOTSTRAP_STANDARD.md.

## Required Pattern

- Pattern: node-mcp-single
- Main server file: mcp/pinocchio_mcp_server.js
- Tool prefix: pinocchio_

## Deliverables

1. mcp/pinocchio_mcp_server.js
2. mcp/generate_readiness_artifacts.js
3. mcp/mcp_readiness_report.md
4. mcp/mcpServers.example.json
5. mcp/MCP_ARCHITECTURE.md
6. mcp/README.md

## Scope Checklist

- Expose all in-scope Pinocchio backend endpoints as MCP tools.
- Add destructive confirmation guard where applicable.
- Read config from env vars (`PINOCHIO_BASE_URL`, token if used).
- Produce readiness report with totals, mapped, missing, coverage.

## Completion Check

- `node --check mcp/pinocchio_mcp_server.js`
- `node mcp/generate_readiness_artifacts.js`
- Readiness status is `ready` with no missing in-scope endpoints.
