#!/usr/bin/env python3
"""Remote-bus MCP server.

Exposes a single tool `remote_bus__invoke` that posts a control message to
the OliviaLegal remote bus (`/api/OliviaLegal/remote-bus`). The bus is consumed by the
desktop shaders view (and/or the mobile page) to drive UI controls
programmatically — this lets the agent say "set environment to cyberpunk"
and actually push the command.

Env:
    OliviaLegal_BUS_URL  — full URL of the bus (default http://127.0.0.1:3229/api/OliviaLegal/remote-bus)
    OliviaLegal_BUS_TIMEOUT_S — HTTP timeout (default 10)

MCP framing: stdio JSON-RPC 2.0, protocolVersion 2024-11-05.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

_default_port = os.environ.get("OliviaLegal_PORT", "3229").strip() or "3229"
BUS_URL = os.environ.get(
    "OliviaLegal_BUS_URL",
    f"http://127.0.0.1:{_default_port}/api/OliviaLegal/remote-bus",
)
TIMEOUT = float(os.environ.get("OliviaLegal_BUS_TIMEOUT_S", "10"))

# Whitelists MUST mirror remote-bus-desktop.js so docs and enforcement match.
SH3D_FUNCS = [
    # animation + camera
    "sh3dToggleAnimation", "sh3dSelectClip", "sh3dSetAnimSpeed",
    "sh3dToggleWireframe", "sh3dResetCamera",
    # environment / background
    "sh3dSetEnvironment", "sh3dSetExposure", "sh3dSetBgColor",
    "sh3dToggleGrid", "sh3dToggleGround",
    # hybrid 2D+3D overlay
    "sh3dSetHybrid2D",
    # objects / primitives
    "sh3dAddPrimitive", "sh3dClearExtras", "sh3dLoadGLB",
    # selection (for targeted actions on specific models)
    "sh3dSelect", "sh3dSetTransformMode",
]
SH_FUNCS = [
    # view / scene switching
    "shToggleFullscreen", "shSwitchTab", "shLoadScene", "shRunEditorCode",
    "shSetSceneMode", "shSetViewMode",
    # post-fx
    "shSetPostFxSlider", "shResetPostFx",
    # world / weather / era
    "shToggleNight", "shSetDayNightCycle", "shSetWorldTimeSpeed",
    "shSetWorldWeather", "shSetWorldRotation", "shSetEra", "shSetWeatherType",
    # environment fx
    "shSetEnvFx", "shToggleEnvFlag",
    # presets + capture + export
    "shApplyPreset", "shCapturePNG", "shExportScene", "shExportFxPreset",
]


def _post_bus(payload: dict) -> dict:
    body = json.dumps({"role": "agent", "payload": payload}).encode("utf-8")
    req = urllib.request.Request(
        BUS_URL,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "OliviaLegal-remote-bus-mcp/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as e:
        return {"status": e.code, "error": e.reason, "body": e.read().decode("utf-8", errors="replace")[:500]}
    except Exception as e:  # network / timeout
        return {"status": 0, "error": str(e)}
    try:
        data = json.loads(raw)
    except Exception:
        data = {"raw": raw[:500]}
    return {"status": status, "data": data}


def _call_tool(name: str, args: dict) -> dict:
    if name != "remote_bus__invoke":
        return {"error": f"unknown tool: {name}"}

    kind = args.get("kind")
    if kind not in {"sh3d-call", "sh-call", "meshy-open", "send-chat", "fullscreen", "rec", "request-snapshot"}:
        return {"error": f"invalid kind: {kind!r}"}

    payload: dict = {"kind": kind}

    if kind == "sh3d-call":
        fn = args.get("name")
        if fn not in SH3D_FUNCS:
            return {"error": f"name must be one of {SH3D_FUNCS}"}
        payload["name"] = fn
        if "args" in args:
            if not isinstance(args["args"], list):
                return {"error": "args must be a list"}
            payload["args"] = args["args"]
    elif kind == "sh-call":
        fn = args.get("name")
        if fn not in SH_FUNCS:
            return {"error": f"name must be one of {SH_FUNCS}"}
        payload["name"] = fn
        if "args" in args:
            if not isinstance(args["args"], list):
                return {"error": "args must be a list"}
            payload["args"] = args["args"]
    elif kind == "fullscreen":
        act = args.get("action", "toggle")
        if act not in {"on", "off", "toggle"}:
            return {"error": "action must be on/off/toggle"}
        payload["action"] = act
    elif kind == "rec":
        payload["action"] = args.get("action", "toggle")
    elif kind == "send-chat":
        text = args.get("text")
        if not isinstance(text, str) or not text.strip():
            return {"error": "text required"}
        payload["text"] = text
    elif kind == "meshy-open" or kind == "request-snapshot":
        pass

    return _post_bus(payload)


TOOLS = [
    {
        "name": "remote_bus__invoke",
        "description": (
            "Push a control message to the OliviaLegal remote bus. The desktop "
            "shaders view (and the mobile page) long-poll this bus and apply "
            "commands — use this to drive UI controls on the user's screen "
            "without them having to tap anything. Prefer this over asking "
            "the user to click buttons when they are in fullscreen/recording."
            "\n\nKinds:\n"
            "  sh3d-call    → invoke a whitelisted window.sh3d* function on desktop.\n"
            "                 name ∈ " + ", ".join(SH3D_FUNCS) + "\n"
            "                 Examples: sh3dSetEnvironment(['cyberpunk']), "
            "sh3dSetExposure(['1.6']), sh3dToggleAnimation().\n"
            "  sh-call      → invoke a whitelisted window.sh* function. "
            "name ∈ " + ", ".join(SH_FUNCS) + "\n"
            "  fullscreen   → action: on|off|toggle.\n"
            "  rec          → toggle/start/stop preview recording (fullscreen only).\n"
            "  meshy-open   → open the Meshy modal on the desktop.\n"
            "  send-chat    → relay a chat message (text) into the desktop chat.\n"
            "  request-snapshot → ask the desktop to re-publish its preview snapshot."
        ),
        "inputSchema": {
            "type": "object",
            "required": ["kind"],
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": [
                        "sh3d-call", "sh-call", "meshy-open",
                        "send-chat", "fullscreen", "rec", "request-snapshot",
                    ],
                },
                "name": {"type": "string", "description": "Function name (for sh3d-call / sh-call)"},
                "args": {"type": "array", "description": "Positional args for the function"},
                "action": {"type": "string", "enum": ["on", "off", "toggle", "start", "stop"]},
                "text": {"type": "string", "description": "Message text (for send-chat)"},
            },
            "additionalProperties": False,
        },
    },
]


# ── JSON-RPC stdio loop ────────────────────────────────────────────────────
def _send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main() -> None:
    print(
        f"[remote-bus-mcp] started — bus={BUS_URL} timeout={TIMEOUT}s tool=remote_bus__invoke",
        file=sys.stderr,
    )
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        rid = req.get("id")
        method = req.get("method")
        params = req.get("params") or {}

        if method == "initialize":
            _send({
                "jsonrpc": "2.0",
                "id": rid,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "OliviaLegal-remote-bus", "version": "1.0.0"},
                },
            })
        elif method == "notifications/initialized":
            continue
        elif method == "tools/list":
            _send({"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            name = params.get("name", "")
            args = params.get("arguments") or {}
            result = _call_tool(name, args)
            is_error = bool(result.get("error")) or (isinstance(result.get("status"), int) and result["status"] >= 400)
            _send({
                "jsonrpc": "2.0",
                "id": rid,
                "result": {
                    "content": [{"type": "text", "text": json.dumps(result, indent=2)}],
                    "isError": is_error,
                },
            })
        else:
            _send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "method not found"}})


if __name__ == "__main__":
    main()
