#!/usr/bin/env python3
"""
MCP Bridge Server — Exposes registered VPS API endpoints as MCP tools.

Runs as a stdio-based MCP server that openclaude connects to via --mcp-config.
Discovers endpoints from two sources (merged, deduplicated):

  1. Static  — endpoints-config.js (curated ~60 endpoints)
  2. Dynamic — OpenAPI spec fetched from the VPS gateway at startup

Environment variables:
  VPS_GATEWAY_URL    — Base URL for the VPS gateway (default: http://localhost:8183)
  MCP_ENDPOINTS_FILE — Path to endpoints-config.js (auto-detected if omitted)
  MCP_OPENAPI_URL    — Full URL to fetch OpenAPI JSON (default: {VPS_GATEWAY_URL}/openapi.json)
  MCP_SKIP_OPENAPI   — Set to "1" to skip OpenAPI discovery
  MCP_MAX_TOOLS      — Maximum number of tools to register (default: 200)
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GATEWAY_URL = os.environ.get("VPS_GATEWAY_URL", "http://localhost:8183").rstrip("/")
OPENAPI_URL = os.environ.get("MCP_OPENAPI_URL", f"{GATEWAY_URL}/openapi.json")
SKIP_OPENAPI = os.environ.get("MCP_SKIP_OPENAPI", "") == "1"
MAX_TOOLS = int(os.environ.get("MCP_MAX_TOOLS", "200"))

_HERE = os.path.dirname(os.path.abspath(__file__))
_ENDPOINTS_CANDIDATES = [
    os.environ.get("MCP_ENDPOINTS_FILE", ""),
    os.path.join(_HERE, "olivia", "js", "modules", "endpoints-config.js"),
]

# Paths to skip (internal, admin, or dangerous)
_SKIP_PATH_PATTERNS = [
    re.compile(r"/health$"),
    re.compile(r"/openapi\.json$"),
    re.compile(r"/docs$"),
    re.compile(r"/redoc$"),
    re.compile(r"/_internal/"),
    re.compile(r"/admin/shutdown"),
    re.compile(r"/admin/restart"),
]


def _log(msg: str):
    """Write to stderr (visible in debug mode, does not interfere with protocol)."""
    sys.stderr.write(f"[mcp-bridge] {msg}\n")
    sys.stderr.flush()

# ---------------------------------------------------------------------------
# Endpoint Loading — Static (endpoints-config.js)
# ---------------------------------------------------------------------------

_EP_RE = re.compile(
    r'\{p:\s*"([^"]+)"\s*,\s*m:\s*"([^"]+)"\s*,\s*t:\s*"([^"]+)"\s*,'
    r'\s*s:\s*"([^"]+)"\s*,\s*d:\s*"([^"]*)"\s*\}'
)


def _load_static_endpoints() -> list[dict]:
    """Parse endpoints-config.js into endpoint dicts."""
    for path in _ENDPOINTS_CANDIDATES:
        if path and os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                text = f.read()
            endpoints = []
            for m in _EP_RE.finditer(text):
                endpoints.append({
                    "path": m.group(1),
                    "method": m.group(2),
                    "topic": m.group(3),
                    "summary": m.group(4),
                    "description": m.group(5),
                    "source": "static",
                })
            return endpoints
    return []


# ---------------------------------------------------------------------------
# Endpoint Loading — Dynamic (OpenAPI from gateway)
# ---------------------------------------------------------------------------

def _infer_topic(path: str, tags: list[str]) -> str:
    """Infer a topic/category from OpenAPI tags or path prefix."""
    if tags:
        return tags[0]
    # Infer from path: /api/bridge/... -> Bridge
    parts = path.strip("/").split("/")
    if len(parts) >= 2 and parts[0] == "api":
        return parts[1].replace("_", " ").title()
    return "API"


def _load_openapi_endpoints() -> list[dict]:
    """Fetch OpenAPI JSON from the gateway and convert paths to endpoint dicts."""
    if SKIP_OPENAPI:
        return []
    try:
        req = urllib.request.Request(OPENAPI_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            spec = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        _log(f"OpenAPI discovery skipped: {e}")
        return []

    endpoints = []
    paths = spec.get("paths", {})
    for path, methods in paths.items():
        for method, operation in methods.items():
            method_upper = method.upper()
            if method_upper not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
                continue
            # Skip filtered paths
            if any(pat.search(path) for pat in _SKIP_PATH_PATTERNS):
                continue

            tags = operation.get("tags", [])
            summary = operation.get("summary", "")
            description = operation.get("description", "")
            if not summary:
                # Generate summary from operationId or path
                op_id = operation.get("operationId", "")
                summary = op_id.replace("_", " ").title() if op_id else f"{method_upper} {path}"

            # Extract parameter schemas from OpenAPI spec
            params_schema = {}
            for param in operation.get("parameters", []):
                pname = param.get("name", "")
                if pname and param.get("in") in ("path", "query"):
                    params_schema[pname] = {
                        "in": param["in"],
                        "type": param.get("schema", {}).get("type", "string"),
                        "description": param.get("description", ""),
                        "required": param.get("required", False),
                    }

            # Extract request body schema hint
            body_hint = ""
            req_body = operation.get("requestBody", {})
            if req_body:
                content = req_body.get("content", {})
                json_schema = content.get("application/json", {}).get("schema", {})
                if json_schema:
                    # Include property names as a hint
                    props = json_schema.get("properties", {})
                    if props:
                        body_hint = "Fields: " + ", ".join(props.keys())

            ep = {
                "path": path,
                "method": method_upper,
                "topic": _infer_topic(path, tags),
                "summary": summary[:120],
                "description": (description[:200] + (" | " + body_hint if body_hint else "")),
                "source": "openapi",
                "params_schema": params_schema,
            }
            endpoints.append(ep)

    _log(f"OpenAPI discovery: {len(endpoints)} endpoints from {OPENAPI_URL}")
    return endpoints


# ---------------------------------------------------------------------------
# Merge & Deduplicate
# ---------------------------------------------------------------------------

def _merge_endpoints(static: list[dict], dynamic: list[dict]) -> list[dict]:
    """Merge static and dynamic endpoints, preferring static (curated) definitions."""
    seen: set[str] = set()  # (method, path)
    merged = []

    # Static first — they take priority
    for ep in static:
        key = (ep["method"], ep["path"])
        if key not in seen:
            seen.add(key)
            merged.append(ep)

    # Dynamic endpoints fill in the gaps
    for ep in dynamic:
        key = (ep["method"], ep["path"])
        if key not in seen:
            seen.add(key)
            merged.append(ep)

    return merged[:MAX_TOOLS]


def _slugify(text: str) -> str:
    """Convert text to a valid tool name component."""
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _make_tool_name(ep: dict) -> str:
    """Generate a unique, descriptive tool name from an endpoint.

    openclaude prefixes MCP tools with ``mcp__<server>__`` (10 chars for
    server="vps").  The OpenAI API enforces a 64-char limit on
    ``tools[].function.name``, so we cap at 54 to leave room.
    """
    MAX_LEN = 54
    topic = _slugify(ep["topic"])
    summary = _slugify(ep["summary"])
    name = f"{topic}__{summary}"
    if len(name) > MAX_LEN:
        name = name[:MAX_LEN].rstrip("_")
    return name


# ---------------------------------------------------------------------------
# Build Tool Definitions
# ---------------------------------------------------------------------------

# Maps tool_name -> endpoint dict
_TOOL_MAP: dict[str, dict] = {}
# List of MCP tool definitions
_TOOLS: list[dict] = []


def _build_tools():
    """Build MCP tool definitions from merged endpoints."""
    static = _load_static_endpoints()
    dynamic = _load_openapi_endpoints()
    endpoints = _merge_endpoints(static, dynamic)

    _log(f"Building tools: {len(static)} static + {len(dynamic)} openapi = {len(endpoints)} merged")

    seen_names: dict[str, int] = {}

    for ep in endpoints:
        name = _make_tool_name(ep)
        # Deduplicate names
        if name in seen_names:
            seen_names[name] += 1
            suffix = f"_{seen_names[name]}"
            name = name[:54 - len(suffix)] + suffix
        else:
            seen_names[name] = 1

        # Build JSON Schema for input
        properties: dict = {}
        required: list[str] = []

        # Use OpenAPI param schemas if available, else infer from path
        params_schema = ep.get("params_schema", {})
        if params_schema:
            for pname, pinfo in params_schema.items():
                prop = {
                    "type": pinfo.get("type", "string"),
                    "description": pinfo.get("description", f"{pinfo.get('in', 'path')} parameter: {pname}"),
                }
                properties[pname] = prop
                if pinfo.get("required") or pinfo.get("in") == "path":
                    required.append(pname)
        else:
            # Fallback: extract path parameters like {id}, {code}
            path_params = re.findall(r"\{(\w+)\}", ep["path"])
            for param in path_params:
                properties[param] = {
                    "type": "string",
                    "description": f"Path parameter: {param}",
                }
                required.append(param)

        # POST/PUT/PATCH get a body parameter
        if ep["method"] in ("POST", "PUT", "PATCH"):
            properties["body"] = {
                "type": "object",
                "description": "JSON request body to send",
            }

        # GET can have optional query parameters (only if not already from OpenAPI)
        if ep["method"] == "GET" and not params_schema:
            properties["query_params"] = {
                "type": "object",
                "description": "Optional query string parameters (key-value pairs)",
            }

        source_tag = " [curated]" if ep.get("source") == "static" else ""
        tool_def = {
            "name": name,
            "description": (
                f"[{ep['method']} {ep['path']}] {ep['summary']}{source_tag}\n"
                f"{ep['description']}\n"
                f"Service: {ep['topic']} | Gateway: {GATEWAY_URL}"
            ),
            "inputSchema": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }

        _TOOLS.append(tool_def)
        _TOOL_MAP[name] = ep


_build_tools()

# ---------------------------------------------------------------------------
# HTTP Proxy
# ---------------------------------------------------------------------------


def _execute_api_call(ep: dict, arguments: dict) -> dict:
    """Make the actual HTTP request to the VPS and return the result."""
    url = GATEWAY_URL + ep["path"]

    # Replace path parameters
    for param in re.findall(r"\{(\w+)\}", ep["path"]):
        value = arguments.get(param, "")
        url = url.replace(f"{{{param}}}", urllib.parse.quote(str(value), safe=""))

    # Add query parameters for GET
    if ep["method"] == "GET" and arguments.get("query_params"):
        qp = arguments["query_params"]
        if isinstance(qp, dict):
            url += "?" + urllib.parse.urlencode(qp)

    # Build request
    body_data = None
    headers = {"Accept": "application/json"}

    if ep["method"] in ("POST", "PUT", "PATCH"):
        body = arguments.get("body", {})
        body_data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url,
        data=body_data,
        headers=headers,
        method=ep["method"],
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode("utf-8", errors="replace")
            status = resp.status
            # Try to parse as JSON for clean output
            try:
                parsed = json.loads(resp_body)
                return {
                    "status": status,
                    "data": parsed,
                }
            except json.JSONDecodeError:
                # Truncate very large text responses
                if len(resp_body) > 10000:
                    resp_body = resp_body[:10000] + "\n... [truncated]"
                return {
                    "status": status,
                    "text": resp_body,
                }
    except urllib.error.HTTPError as e:
        body_text = ""
        try:
            body_text = e.read().decode("utf-8", errors="replace")[:2000]
        except Exception:
            pass
        return {
            "error": True,
            "status": e.code,
            "reason": e.reason,
            "body": body_text,
        }
    except urllib.error.URLError as e:
        return {
            "error": True,
            "reason": str(e.reason),
            "hint": f"Could not reach {GATEWAY_URL}. Is the VPS gateway running?",
        }
    except Exception as e:
        return {"error": True, "reason": str(e)}


# ---------------------------------------------------------------------------
# MCP JSON-RPC Protocol (stdio)
# ---------------------------------------------------------------------------

SERVER_INFO = {
    "name": "vps-api-bridge",
    "version": "1.0.0",
}

PROTOCOL_VERSION = "2024-11-05"


def _send(msg: dict):
    """Write a JSON-RPC message to stdout."""
    line = json.dumps(msg, ensure_ascii=False)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def _handle_initialize(req_id, _params):
    _send({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        },
    })


def _handle_tools_list(req_id, _params):
    _send({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"tools": _TOOLS},
    })


def _handle_tools_call(req_id, params):
    name = params.get("name", "")
    arguments = params.get("arguments", {})

    ep = _TOOL_MAP.get(name)
    if not ep:
        _send({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [{
                    "type": "text",
                    "text": json.dumps({"error": f"Unknown tool: {name}"}),
                }],
                "isError": True,
            },
        })
        return

    result = _execute_api_call(ep, arguments)

    _send({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "content": [{
                "type": "text",
                "text": json.dumps(result, ensure_ascii=False, indent=2),
            }],
            "isError": bool(result.get("error")),
        },
    })


_HANDLERS = {
    "initialize": _handle_initialize,
    "notifications/initialized": None,  # notification, no response
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
    "ping": lambda rid, _: _send({"jsonrpc": "2.0", "id": rid, "result": {}}),
}


def main():
    """Main loop — read JSON-RPC from stdin, dispatch handlers."""
    _log(f"MCP Bridge started — {len(_TOOLS)} tools from {GATEWAY_URL}")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _log(f"Invalid JSON: {line[:100]}")
            continue

        method = msg.get("method", "")
        req_id = msg.get("id")
        params = msg.get("params", {})

        handler = _HANDLERS.get(method)
        if handler is None:
            if req_id is not None:
                # Unknown method with id — respond with error
                _send({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}",
                    },
                })
            # Notifications (no id) are silently ignored
            continue

        try:
            handler(req_id, params)
        except Exception as e:
            _log(f"Handler error for {method}: {e}")
            if req_id is not None:
                _send({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": f"Internal error: {e}",
                    },
                })


if __name__ == "__main__":
    main()
