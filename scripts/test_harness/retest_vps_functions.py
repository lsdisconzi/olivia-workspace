#!/usr/bin/env python3
"""
Retest VPS function endpoints extracted from test_harness/output/test_results.json.

This is focused on turning "untested/unknown" function metadata into concrete runtime
status with per-function details that can feed assignment decisions.

Usage examples:
    python scripts/test_harness/retest_vps_functions.py \
      --base-url http://72.60.143.139:8080

    python scripts/test_harness/retest_vps_functions.py \
      --base-url http://72.60.143.139:8080 \
      --statuses untested,unknown,not_found \
      --max-functions 300

    python scripts/test_harness/retest_vps_functions.py \
      --base-url http://72.60.143.139:8080 \
      --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]


DEFAULT_SOURCE = Path(__file__).resolve().parent / "output" / "test_results.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output" / "retest_untested_vps_functions.json"

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Reuse conservative placeholder values from the harness conventions.
KNOWN_VALUES: dict[str, str] = {
    "agent_id": "test-agent-001",
    "assistant_id": "test-assistant-001",
    "case_id": "test-case-001",
    "session_id": "test-session-001",
    "collection_name": "default",
    "collection_id": "default",
    "project_id": "test-project-001",
    "id": "test-001",
    "name": "test",
    "service": "test",
    "filename": "test.txt",
    "file": "test.txt",
    "path": "health",
    "q": "test",
    "query": "test",
    "limit": "10",
    "offset": "0",
    "directory": ".",
    "extension": "txt",
}


@dataclass
class FunctionCandidate:
    function_id: str
    function_name: str
    method: str
    url: str
    category: str
    file: str
    test_status: str
    validation_score: int | None
    agent_ready: bool
    fix_suggestion: str


def _status_priority(status: str) -> int:
    """Lower means better confidence for dedupe decisions."""
    rank = {
        "ok": 0,
        "reachable": 1,
        "client_error": 2,
        "server_error": 3,
        "not_found": 4,
        "timeout": 5,
        "connection_error": 6,
        "untested": 7,
        "unknown": 8,
    }
    return rank.get((status or "").strip().lower(), 9)


def _is_template_url(url: str) -> bool:
    text = str(url or "")
    if not text:
        return True
    return bool(re.search(r"[{}<>*]", text))


def _resolve_value(name: str, fallback_prefix: str = "test") -> str:
    key = str(name or "").strip()
    if not key:
        return f"{fallback_prefix}-value"
    return KNOWN_VALUES.get(key, f"{fallback_prefix}-{key}")


def _replace_placeholders(text: str) -> tuple[str, list[str]]:
    missing: list[str] = []

    def repl_brace(match: re.Match[str]) -> str:
        raw = match.group(1)
        name = raw.split(":", 1)[-1].strip()
        if not name:
            missing.append(raw)
            return "test"
        return _resolve_value(name)

    def repl_angle(match: re.Match[str]) -> str:
        raw = match.group(1)
        name = raw.split(":", 1)[-1].strip()
        if not name:
            missing.append(raw)
            return "test"
        return _resolve_value(name)

    out = re.sub(r"\{([^{}]+)\}", repl_brace, text)
    out = re.sub(r"<([^<>]+)>", repl_angle, out)
    return out, missing


def _build_full_url(base_url: str, url_pattern: str) -> tuple[str, list[str]]:
    """Resolve placeholders in path/query and produce full URL."""
    raw = str(url_pattern or "").strip()
    missing: list[str] = []
    if "?" in raw:
        path_part, query_part = raw.split("?", 1)
    else:
        path_part, query_part = raw, ""

    path_part, miss1 = _replace_placeholders(path_part)
    missing.extend(miss1)

    query_values: dict[str, list[str]] = {}
    if query_part:
        query_part, miss2 = _replace_placeholders(query_part)
        missing.extend(miss2)
        for key, values in parse_qs(query_part, keep_blank_values=True).items():
            if values:
                query_values[key] = values

    path_part = path_part if path_part.startswith("/") else f"/{path_part}"
    full = base_url.rstrip("/") + path_part
    if query_values:
        full += "?" + urlencode(query_values, doseq=True)
    return full, missing


def _normalize_function_row(row: dict[str, Any]) -> FunctionCandidate | None:
    if not isinstance(row, dict):
        return None

    method = str(row.get("method") or "GET").upper().strip() or "GET"
    url = str(row.get("url") or "").strip()
    fn_id = str(row.get("id") or "").strip()
    fn_name = str(row.get("name") or "").strip()
    status = str(row.get("test_status") or "unknown").strip().lower() or "unknown"

    if not fn_id and not (url and fn_name):
        return None

    score_raw = row.get("validation_score")
    try:
        score = int(score_raw) if score_raw is not None else None
    except Exception:
        score = None

    return FunctionCandidate(
        function_id=fn_id,
        function_name=fn_name or fn_id or f"{method}:{url}",
        method=method,
        url=url,
        category=str(row.get("category") or "").strip(),
        file=str(row.get("file") or "").strip(),
        test_status=status,
        validation_score=score,
        agent_ready=bool(row.get("agent_ready")),
        fix_suggestion=str(row.get("fix_suggestion") or "").strip(),
    )


def load_candidates(source_json: Path) -> list[FunctionCandidate]:
    payload = json.loads(source_json.read_text(encoding="utf-8"))
    rows = payload.get("results") if isinstance(payload.get("results"), list) else []

    dedup: dict[str, FunctionCandidate] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        body = row.get("test_response_body") if isinstance(row.get("test_response_body"), dict) else None
        funcs = body.get("functions") if isinstance(body, dict) and isinstance(body.get("functions"), list) else []

        for fn in funcs:
            candidate = _normalize_function_row(fn)
            if not candidate:
                continue
            key = candidate.function_id or f"{candidate.method}:{candidate.url}:{candidate.function_name}"
            existing = dedup.get(key)
            if existing is None:
                dedup[key] = candidate
                continue

            # Keep the better status; if tied, keep the one with higher score.
            p_old = _status_priority(existing.test_status)
            p_new = _status_priority(candidate.test_status)
            if p_new < p_old:
                dedup[key] = candidate
                continue
            if p_new == p_old:
                old_score = existing.validation_score if existing.validation_score is not None else -1
                new_score = candidate.validation_score if candidate.validation_score is not None else -1
                if new_score > old_score:
                    dedup[key] = candidate

    return list(dedup.values())


def classify_http_status(http_code: int | None, error: str = "") -> str:
    if http_code is None:
        if error.startswith("timeout"):
            return "timeout"
        return "connection_error"
    if 200 <= http_code < 300:
        return "ok"
    if http_code == 404:
        return "not_found"
    if 400 <= http_code < 500:
        return "client_error"
    if 500 <= http_code < 600:
        return "server_error"
    return "unknown"


async def test_one(
    session: aiohttp.ClientSession,
    base_url: str,
    candidate: FunctionCandidate,
    timeout_seconds: int,
) -> dict[str, Any]:
    full_url, unresolved = _build_full_url(base_url, candidate.url)

    result: dict[str, Any] = {
        "function_id": candidate.function_id,
        "function_name": candidate.function_name,
        "method": candidate.method,
        "url": candidate.url,
        "full_url": full_url,
        "category": candidate.category,
        "source_file": candidate.file,
        "previous_test_status": candidate.test_status,
        "previous_validation_score": candidate.validation_score,
        "agent_ready": candidate.agent_ready,
        "fix_suggestion": candidate.fix_suggestion,
        "unresolved_params": unresolved,
        "tested_at": datetime.now(timezone.utc).isoformat(),
    }

    start = time.monotonic()
    try:
        async with session.request(candidate.method, full_url, timeout=timeout_seconds) as resp:
            latency = round((time.monotonic() - start) * 1000, 2)
            content_type = resp.headers.get("content-type", "")
            body_preview = ""
            body_json: Any = None

            try:
                if "application/json" in content_type.lower():
                    body_json = await resp.json(content_type=None)
                    body_preview = json.dumps(body_json, ensure_ascii=False)[:3000]
                else:
                    body_preview = (await resp.text())[:3000]
            except Exception as exc:
                body_preview = f"<unparseable body: {exc}>"

            result.update(
                {
                    "test_http_code": resp.status,
                    "test_latency_ms": latency,
                    "content_type": content_type,
                    "test_response_body": body_json if isinstance(body_json, (dict, list)) else body_preview,
                    "test_response_preview": body_preview,
                    "test_status": classify_http_status(resp.status),
                    "test_error": "",
                }
            )
            return result

    except asyncio.TimeoutError:
        latency = round((time.monotonic() - start) * 1000, 2)
        result.update(
            {
                "test_http_code": None,
                "test_latency_ms": latency,
                "content_type": "",
                "test_response_body": "",
                "test_response_preview": "",
                "test_status": "timeout",
                "test_error": f"timeout after {timeout_seconds}s",
            }
        )
        return result

    except Exception as exc:
        latency = round((time.monotonic() - start) * 1000, 2)
        result.update(
            {
                "test_http_code": None,
                "test_latency_ms": latency,
                "content_type": "",
                "test_response_body": "",
                "test_response_preview": "",
                "test_status": "connection_error",
                "test_error": str(exc),
            }
        )
        return result


async def run_tests(
    base_url: str,
    selected: list[FunctionCandidate],
    *,
    concurrency: int,
    timeout_seconds: int,
    headers: dict[str, str],
    dry_run: bool,
) -> list[dict[str, Any]]:
    if dry_run:
        out: list[dict[str, Any]] = []
        for candidate in selected:
            full_url, unresolved = _build_full_url(base_url, candidate.url)
            out.append(
                {
                    "function_id": candidate.function_id,
                    "function_name": candidate.function_name,
                    "method": candidate.method,
                    "url": candidate.url,
                    "full_url": full_url,
                    "category": candidate.category,
                    "source_file": candidate.file,
                    "previous_test_status": candidate.test_status,
                    "previous_validation_score": candidate.validation_score,
                    "agent_ready": candidate.agent_ready,
                    "fix_suggestion": candidate.fix_suggestion,
                    "unresolved_params": unresolved,
                    "tested_at": datetime.now(timezone.utc).isoformat(),
                    "test_http_code": None,
                    "test_latency_ms": None,
                    "content_type": "",
                    "test_response_body": "",
                    "test_response_preview": "",
                    "test_status": "skipped",
                    "test_error": "dry-run",
                }
            )
        return out

    semaphore = asyncio.Semaphore(max(1, concurrency))
    connector = aiohttp.TCPConnector(limit=0, force_close=True)

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:

        async def bounded(candidate: FunctionCandidate) -> dict[str, Any]:
            async with semaphore:
                return await test_one(session, base_url, candidate, timeout_seconds)

        return await asyncio.gather(*(bounded(c) for c in selected))


def parse_headers(raw_headers: list[str], bearer_token: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in raw_headers:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            headers[key] = value
    if bearer_token:
        headers.setdefault("Authorization", f"Bearer {bearer_token}")
    return headers


def main() -> None:
    parser = argparse.ArgumentParser(description="Retest untested VPS function endpoints with detailed output")
    parser.add_argument("--base-url", default="", help="VPS base URL. Defaults to base_url from source test_results.json")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE), help="Input test_results.json path")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output JSON path")
    parser.add_argument("--statuses", default="untested,unknown", help="Comma-separated previous statuses to retest")
    parser.add_argument("--include-template-routes", action="store_true", help="Include routes containing placeholders like {id}")
    parser.add_argument("--include-method", action="append", dest="include_methods", help="Method to include (repeatable). Default safe methods only")
    parser.add_argument("--allow-write-methods", action="store_true", help="Include POST/PUT/PATCH/DELETE")
    parser.add_argument("--only-agent-ready", action="store_true", help="Retest only functions marked agent_ready=true")
    parser.add_argument("--max-functions", type=int, default=0, help="Max number of selected functions (0 means all)")
    parser.add_argument("--concurrency", type=int, default=20, help="Max concurrent HTTP requests")
    parser.add_argument("--timeout", type=int, default=25, help="Per-request timeout in seconds")
    parser.add_argument("--header", action="append", default=[], help="Additional request header 'Key: Value' (repeatable)")
    parser.add_argument("--bearer-token", default="", help="Optional bearer token for authenticated endpoints")
    parser.add_argument("--dry-run", action="store_true", help="Resolve and list targets without HTTP calls")

    args = parser.parse_args()

    if not args.dry_run and aiohttp is None:
        print("ERROR: aiohttp is required for live retests. Install with: pip install aiohttp", file=sys.stderr)
        sys.exit(1)

    source_path = Path(args.source).resolve()
    output_path = Path(args.output).resolve()

    if not source_path.exists():
        print(f"ERROR: source file not found: {source_path}", file=sys.stderr)
        sys.exit(1)

    source_payload = json.loads(source_path.read_text(encoding="utf-8"))
    base_url = (args.base_url or source_payload.get("base_url") or "").strip()
    if not base_url:
        print("ERROR: base URL is required (--base-url or source file must contain base_url)", file=sys.stderr)
        sys.exit(1)

    bearer = args.bearer_token.strip()
    if not bearer:
        bearer = (
            str(os.environ.get("OliviaLegal_ADMIN_API_TOKEN") or "").strip()
            or str(os.environ.get("IBSCO_ADMIN_API_TOKEN") or "").strip()
        )

    requested_statuses = {
        s.strip().lower()
        for s in str(args.statuses or "untested,unknown").split(",")
        if s.strip()
    }

    include_methods = {m.strip().upper() for m in (args.include_methods or []) if m.strip()}
    if not include_methods:
        include_methods = set(SAFE_METHODS)
    if args.allow_write_methods:
        include_methods |= {"POST", "PUT", "PATCH", "DELETE"}

    all_candidates = load_candidates(source_path)

    selected: list[FunctionCandidate] = []
    skipped_template = 0
    skipped_method = 0
    skipped_agent_ready = 0
    skipped_status = 0

    for cand in all_candidates:
        if cand.test_status not in requested_statuses:
            skipped_status += 1
            continue
        if not args.include_template_routes and _is_template_url(cand.url):
            skipped_template += 1
            continue
        if cand.method not in include_methods:
            skipped_method += 1
            continue
        if args.only_agent_ready and not cand.agent_ready:
            skipped_agent_ready += 1
            continue
        selected.append(cand)

    selected.sort(key=lambda c: (c.test_status, c.method, c.url, c.function_name))

    if args.max_functions and args.max_functions > 0:
        selected = selected[: args.max_functions]

    headers = parse_headers(args.header, bearer)

    print(f"Source:          {source_path}")
    print(f"Base URL:        {base_url}")
    print(f"Discovered:      {len(all_candidates)} functions")
    print(f"Selected:        {len(selected)} functions")
    print(f"Skip(status):    {skipped_status}")
    print(f"Skip(template):  {skipped_template}")
    print(f"Skip(method):    {skipped_method}")
    print(f"Skip(agent):     {skipped_agent_ready}")
    print(f"Methods:         {', '.join(sorted(include_methods))}")
    print(f"Statuses:        {', '.join(sorted(requested_statuses))}")
    print(f"Dry run:         {args.dry_run}")

    results = asyncio.run(
        run_tests(
            base_url,
            selected,
            concurrency=args.concurrency,
            timeout_seconds=args.timeout,
            headers=headers,
            dry_run=args.dry_run,
        )
    )

    by_status: dict[str, int] = {}
    for r in results:
        st = str(r.get("test_status") or "unknown")
        by_status[st] = by_status.get(st, 0) + 1

    tested_count = sum(1 for r in results if r.get("test_status") != "skipped")
    ok_count = by_status.get("ok", 0)

    assignment_candidates: list[dict[str, Any]] = []
    for r in results:
        if r.get("test_status") != "ok":
            continue
        method = str(r.get("method") or "GET").upper()
        url = str(r.get("url") or "")
        function_id = str(r.get("function_id") or "").strip()
        cap_id = f"vps:{function_id}" if function_id else f"vps:{method}:{url}"
        assignment_candidates.append(
            {
                "capability_id": cap_id,
                "function_id": function_id,
                "function_name": r.get("function_name"),
                "method": method,
                "url": url,
                "category": r.get("category"),
                "latency_ms": r.get("test_latency_ms"),
                "validation_score": r.get("previous_validation_score"),
                "agent_ready": bool(r.get("agent_ready")),
                "content_type": r.get("content_type"),
            }
        )

    assignment_candidates.sort(
        key=lambda x: (
            0 if x.get("agent_ready") else 1,
            -(int(x.get("validation_score")) if isinstance(x.get("validation_score"), int) else -1),
            float(x.get("latency_ms") if isinstance(x.get("latency_ms"), (int, float)) else 1e9),
        )
    )

    output_payload = {
        "base_url": base_url,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(source_path),
        "filters": {
            "statuses": sorted(requested_statuses),
            "methods": sorted(include_methods),
            "include_template_routes": bool(args.include_template_routes),
            "only_agent_ready": bool(args.only_agent_ready),
            "max_functions": int(args.max_functions or 0),
            "dry_run": bool(args.dry_run),
        },
        "summary": {
            "discovered": len(all_candidates),
            "selected": len(selected),
            "tested": tested_count,
            "ok": ok_count,
            "errors": max(tested_count - ok_count, 0),
            "by_status": by_status,
            "pass_rate": round(ok_count / tested_count, 4) if tested_count else 0.0,
            "assignment_candidates": len(assignment_candidates),
        },
        "assignment_candidates": assignment_candidates,
        "results": results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Output written:  {output_path}")
    print(f"Pass rate:       {output_payload['summary']['pass_rate'] * 100:.2f}%")


if __name__ == "__main__":
    main()
