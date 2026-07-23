#!/usr/bin/env python3
"""
streamable_bridge.py — minimal stdio <-> Streamable HTTP MCP bridge.

Usage:
    streamable_bridge.py <http-url>

Runs as an MCP server on stdio: reads JSON-RPC messages (one per line) from
stdin, forwards them to a remote Streamable-HTTP MCP endpoint, and writes the
upstream `data:` SSE payloads back to stdout as newline-delimited JSON.

Designed for servers that:
  - accept `POST <url>` with `Content-Type: application/json`
  - respond with `text/event-stream` (`event: message` / `data: {...}`)
  - do NOT strictly require an Mcp-Session-Id (re-sends initialize per call-safe
    session; if the server returns a session id we reuse it).

Intentionally dependency-free (stdlib only).
"""
import sys
import json
import urllib.request
import urllib.error
import threading
import uuid


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("usage: streamable_bridge.py <http-url>\n")
        sys.exit(2)

    base_url = sys.argv[1].strip()
    if not base_url.startswith("http://") and not base_url.startswith("https://"):
        sys.stderr.write("invalid url: %s\n" % base_url)
        sys.exit(2)

    session_id = [None]
    lock = threading.Lock()

    def post(payload):
        body = json.dumps(payload).encode("utf-8")
        msg_id = payload.get("id")
        # Each request is independent; include session id only if we have one.
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if session_id[0]:
            headers["Mcp-Session-Id"] = session_id[0]
        req = urllib.request.Request(base_url, data=body, headers=headers, method="POST")
        try:
            resp = urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            # Surface error as a JSON-RPC error so the client doesn't hang.
            detail = ""
            try:
                detail = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            err_msg = "upstream HTTP %s: %s" % (e.code, detail[:500])
            out = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32000, "message": err_msg},
            }
            return [out]
        sid = resp.headers.get("Mcp-Session-Id") or resp.headers.get("mcp-session-id")
        if sid:
            session_id[0] = sid
        ct = resp.headers.get("Content-Type", "")
        raw = resp.read().decode("utf-8", "replace")
        results = []
        if "text/event-stream" in ct:
            for line in raw.splitlines():
                line = line.strip()
                if line.startswith("data:"):
                    data = line[len("data:"):].strip()
                    if data:
                        try:
                            results.append(json.loads(data))
                        except Exception:
                            pass
                # ignore "event:" lines and blank lines
        else:
            try:
                results.append(json.loads(raw))
            except Exception:
                if raw.strip():
                    results.append({"raw": raw})
        if not results:
            results.append({"jsonrpc": "2.0", "id": msg_id, "result": {}})
        return results

    # Read loop: one JSON-RPC message per line from stdin.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        if not isinstance(msg, dict):
            continue
        # Respond to server-initiated pings locally.
        method = msg.get("method")
        if method == "ping":
            pong = {"jsonrpc": "2.0", "id": msg.get("id"), "result": {}}
            sys.stdout.write(json.dumps(pong) + "\n")
            sys.stdout.flush()
            continue
        try:
            with lock:
                outs = post(msg)
        except Exception as e:
            outs = [{"jsonrpc": "2.0", "id": msg.get("id"),
                     "error": {"code": -32603, "message": "bridge error: %s" % e}}]
        for o in outs:
            sys.stdout.write(json.dumps(o) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
