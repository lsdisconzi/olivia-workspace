#!/usr/bin/env python3
"""
Fetch MCP Ecosystem Metadata and generate structured outputs.

Fetches ecosystem metadata from the garage API and writes:
  1. config/ecosystem_metadata.json  — raw metadata (IP-substituted)
  2. config/ecosystem_report.md       — latest service report
  3. config/ecosystem_agents.json     — agent directions + MCP tool inventory
     for use by agent system prompts and frontend MCP server display.

Usage:
    python3 scripts/fetch_ecosystem.py
    python3 scripts/fetch_ecosystem.py --skip-report   # metadata only
"""

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

ECOSYSTEM_BASE = os.environ.get("ECOSYSTEM_BASE_URL", "http://35.239.183.104:8066")
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_DIR = PROJECT_ROOT / "config"

METADATA_PATH = CONFIG_DIR / "ecosystem_metadata.json"
REPORT_PATH = CONFIG_DIR / "ecosystem_report.md"
AGENTS_PATH = CONFIG_DIR / "ecosystem_agents.json"


def _fetch_json(path: str) -> dict:
    url = f"{ECOSYSTEM_BASE}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_text(path: str) -> str:
    url = f"{ECOSYSTEM_BASE}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def _substitute_url(text: str) -> str:
    """Substitute the ecosystem base host (35.239.183.104) with localhost
    in all URLs so agents can reference services locally."""
    return text.replace("35.239.183.104", "127.0.0.1")


def _build_agent_directions(metadata: dict) -> dict:
    """Build per-project agent direction prompts from ecosystem metadata.

    Returns a dict keyed by project name, each containing:
      - description: human-readable service summary
      - agents: list of LLM-facing agents with role + tools
      - mcp_servers: all MCP servers with their tool lists
      - qdrant_collections: collections this project owns (if known)
      - parameters: configurable params for this service
    """
    directions: dict = {}

    for project_name, project_data in metadata.items():
        if not isinstance(project_data, dict):
            continue

        description = project_data.get("description", "")
        agents_raw = project_data.get("agents", [])
        mcp_servers_raw = project_data.get("mcp_servers", [])
        parameters = project_data.get("parameters", [])
        human_interfaces = project_data.get("human_interfaces", [])

        # Build normalized agent list
        agents_out = []
        for ag in agents_raw:
            agents_out.append({
                "name": ag.get("name", ""),
                "role": ag.get("role", ""),
                "tools": ag.get("tools", []),
            })

        # Build normalized MCP server list
        servers_out = []
        for srv in mcp_servers_raw:
            servers_out.append({
                "name": srv.get("name", ""),
                "port": srv.get("port", ""),
                "transport": srv.get("transport", "sse"),
                "tool_count": len(srv.get("tools", [])),
                "tools": srv.get("tools", []),
            })

        # Build human interface list
        interfaces_out = []
        for hi in human_interfaces:
            url = hi.get("url", hi.get("endpoint", ""))
            interfaces_out.append({
                "type": hi.get("type", ""),
                "url": _substitute_url(url) if isinstance(url, str) else url,
            })

        directions[project_name] = {
            "description": description,
            "agents": agents_out,
            "mcp_servers": servers_out,
            "parameters": parameters,
            "interfaces": interfaces_out,
        }

    return directions


def _build_mcp_tool_summary(metadata: dict) -> list[dict]:
    """Build a flat list of all MCP servers across all projects with tool counts."""
    all_servers: list[dict] = []
    seen_names: set[str] = set()

    for project_name, project_data in metadata.items():
        if not isinstance(project_data, dict):
            continue
        for srv in project_data.get("mcp_servers", []):
            name = srv.get("name", "")
            port = srv.get("port", "")
            if name in seen_names and port == "":
                continue  # skip if stdio and already seen by name
            all_servers.append({
                "name": name,
                "project": project_name,
                "port": port,
                "transport": srv.get("transport", "sse"),
                "tools": srv.get("tools", []),
                "tool_count": len(srv.get("tools", [])),
                "description": project_data.get("description", ""),
            })
            seen_names.add(name)

    return sorted(all_servers, key=lambda s: (s["project"], s["name"]))


def main():
    parser = argparse.ArgumentParser(
        description="Fetch ecosystem metadata and generate agent directions + MCP inventory."
    )
    parser.add_argument(
        "--skip-report", action="store_true",
        help="Skip fetching the markdown report (metadata only).",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=CONFIG_DIR,
        help="Output directory for generated files (default: config/).",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Fetch ecosystem metadata
    log.info(f"Fetching ecosystem metadata from {ECOSYSTEM_BASE}/v1/ecosystem/metadata ...")
    try:
        metadata = _fetch_json("/v1/ecosystem/metadata")
    except Exception as e:
        log.error(f"Failed to fetch ecosystem metadata: {e}")
        sys.exit(1)

    # Substitute IPs in descriptions and names for local access
    metadata_str = json.dumps(metadata)
    metadata_str = _substitute_url(metadata_str)
    metadata = json.loads(metadata_str)

    meta_path = args.output_dir / "ecosystem_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    log.info(f"Metadata written to {meta_path}")

    # 2. Build agent directions
    directions = _build_agent_directions(metadata)
    agents_path = args.output_dir / "ecosystem_agents.json"

    flat_servers = _build_mcp_tool_summary(metadata)

    # Build name map from MCP bridge config names → ecosystem canonical names.
    # The .mcp-bridge-config.json uses legacy names; the ecosystem uses canonical names.
    # This map lets the frontend/backend look up ecosystem enrichment by either name.
    mcp_bridge_cfg_path = args.output_dir / ".mcp-bridge-config.json"
    # Manual overrides for known config-name → ecosystem-name mismatches
    # that fuzzy matching gets wrong.
    NAME_OVERRIDES: dict[str, str] = {
        "mcp-server-files": "",                              # stdio filesystem, not in ecosystem
        "ocr-main-ocr": "ocr-core",
        "ocr-main-pdf": "pdf-server",
        "transcription-meta": "transcription-core",
        "transcription-transcription": "transcription-core",
        "transcription-transcripts": "transcription-core",
    }
    name_map: dict[str, str] = {}
    if mcp_bridge_cfg_path.is_file():
        try:
            mcp_cfg = json.loads(mcp_bridge_cfg_path.read_text(encoding="utf-8"))
            eco_byname = {s["name"]: s for s in flat_servers}
            for cfg_name in mcp_cfg.get("mcpServers", {}):
                # 1. Check manual override first
                if cfg_name in NAME_OVERRIDES:
                    mapped = NAME_OVERRIDES[cfg_name]
                    if not mapped:
                        continue  # explicitly excluded
                    name_map[cfg_name] = mapped
                    continue
                # 2. Direct match
                if cfg_name in eco_byname:
                    name_map[cfg_name] = cfg_name
                else:
                    # 3. Fuzzy: token overlap heuristic
                    best = None
                    for eco_name in eco_byname:
                        cfg_parts = cfg_name.lower().replace("-", "_").split("_")
                        eco_parts = eco_name.lower().replace("-", "_").split("_")
                        common = set(cfg_parts) & set(eco_parts)
                        if len(common) >= max(1, min(len(cfg_parts), len(eco_parts)) // 2):
                            best = eco_name
                            break
                    if best:
                        name_map[cfg_name] = best
        except Exception:
            log.warning("Failed to read .mcp-bridge-config.json for name mapping")

    agents_out = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "project_count": len(directions),
        "projects": directions,
        "mcp_servers_flat": flat_servers,
        "name_map": name_map,
    }
    # Add a global agent summary text for system prompt injection
    summary_lines = ["[Available MCP Ecosystem Services]", ""]
    for proj_name, proj_info in sorted(directions.items()):
        summary_lines.append(f"## {proj_name}")
        summary_lines.append(f"  {proj_info['description']}")
        srv_summary = ", ".join(
            f"{s['name']} ({s['tool_count']} tools)" for s in proj_info["mcp_servers"]
        )
        if srv_summary:
            summary_lines.append(f"  MCP servers: {srv_summary}")
        ag_summary = ", ".join(
            f"{a['name']}: {a['role']}" for a in proj_info["agents"]
        )
        if ag_summary:
            summary_lines.append(f"  Agents: {ag_summary}")
        summary_lines.append("")
    agents_out["summary_text"] = "\n".join(summary_lines)

    with open(agents_path, "w", encoding="utf-8") as f:
        json.dump(agents_out, f, indent=2, ensure_ascii=False)
    log.info(f"Agent directions written to {agents_path}")

    # 3. Optionally fetch report
    if not args.skip_report:
        log.info(f"Fetching ecosystem report from {ECOSYSTEM_BASE}/v1/ecosystem/report ...")
        try:
            report = _fetch_text("/v1/ecosystem/report")
            report = _substitute_url(report)
            report_path = args.output_dir / "ecosystem_report.md"
            report_path.write_text(report, encoding="utf-8")
            log.info(f"Report written to {report_path}")
        except Exception as e:
            log.warning(f"Failed to fetch report (non-fatal): {e}")

    total_tools = sum(
        len(s.get("tools", []))
        for p in directions.values()
        for s in p.get("mcp_servers", [])
    )
    log.info(f"Done. {len(directions)} projects, {total_tools} total tools across "
             f"{sum(len(p.get('mcp_servers', [])) for p in directions.values())} MCP servers.")


if __name__ == "__main__":
    main()
