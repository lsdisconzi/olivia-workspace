#!/usr/bin/env python3
"""
Test Orchestrator for VPS API Endpoints.

Classifies GET/read-only endpoints into test layers, runs them with
concurrency throttling, and records results for validation + OpenAPI generation.

Usage:
    python test_orchestrator.py --base-url https://vps.example.com
    python test_orchestrator.py --base-url http://localhost:8080 --dry-run
    python test_orchestrator.py --base-url https://vps.example.com --layer 0
    python test_orchestrator.py --base-url https://vps.example.com --concurrency 5
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode

try:
    import aiohttp
except ImportError:
    print("ERROR: aiohttp required.  pip install aiohttp", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class TestLayer(Enum):
    SMOKE = 0       # no path params, no query params
    PATH_PARAMS = 1 # has path params like {agent_id}
    QUERY_PARAMS = 2 # has query params only
    HYBRID = 3      # has both path + query params


class TestResult(Enum):
    OK = "ok"
    NOT_FOUND = "not_found"
    CLIENT_ERROR = "client_error"
    SERVER_ERROR = "server_error"
    TIMEOUT = "timeout"
    CONNECTION_ERROR = "connection_error"
    UNTESTED = "untested"
    SKIPPED = "skipped"


@dataclass
class Endpoint:
    file_path: str          # e.g. "service:gateway:openapi"
    method: str
    url: str
    function_name: str
    context: str = ""
    path_params: list[dict] = field(default_factory=list)
    query_params: list[dict] = field(default_factory=list)
    response_schema_data: Optional[dict] = None
    expected_response: str = ""
    notes: str = ""
    # test results populated by orchestrator
    test_status: Optional[str] = None
    test_http_code: Optional[int] = None
    test_latency_ms: Optional[float] = None
    test_response_body: Optional[Any] = None
    test_error: Optional[str] = None
    test_layer: Optional[int] = None


@dataclass
class TestRun:
    base_url: str
    started_at: str = ""
    finished_at: str = ""
    total_endpoints: int = 0
    tested: int = 0
    ok: int = 0
    errors: int = 0
    skipped: int = 0
    results: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def load_endpoints(json_path: str) -> list[Endpoint]:
    """Load and flatten endpoints from endpoints.json."""
    with open(json_path, "r") as fh:
        data = json.load(fh)

    endpoints: list[Endpoint] = []
    for file_entry in data.get("files", []):
        for ep in file_entry.get("endpoints", []):
            endpoints.append(Endpoint(
                file_path=ep.get("file_path", file_entry.get("file_path", "")),
                method=ep.get("method", "GET").upper(),
                url=ep.get("url", ""),
                function_name=ep.get("function_name", ""),
                context=ep.get("context", ""),
                path_params=ep.get("path_params") or [],
                query_params=ep.get("query_params") or [],
                response_schema_data=ep.get("response_schema_data"),
                expected_response=ep.get("expected_response", ""),
                notes=ep.get("notes", ""),
            ))
    return endpoints


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

def classify_layer(ep: Endpoint) -> TestLayer:
    """Assign an endpoint to a test layer based on its parameter shape."""
    has_path = len(ep.path_params) > 0
    has_query = len(ep.query_params) > 0

    if not has_path and not has_query:
        return TestLayer.SMOKE
    if has_path and not has_query:
        return TestLayer.PATH_PARAMS
    if not has_path and has_query:
        return TestLayer.QUERY_PARAMS
    return TestLayer.HYBRID


# ---------------------------------------------------------------------------
# Parameter value resolver
# ---------------------------------------------------------------------------

# Known-good values discovered from previous test runs
_KNOWN_VALUES: dict[str, str] = {
    "agent_id": "test-agent-001",
    "collection_name": "default",
    "directory": ".",
    "extension": ".txt",
    "filename": "test.txt",
    "file": "test.txt",
    "name": "test",
    "category": "default",
    "path": ".",
    "query": "test",
    "q": "test",
    "session_id": "test-session-001",
    "case_id": "test-case-001",
    "interaction_type": "chat",
    "model_id": "gpt-4",
    "limit": "10",
    "offset": "0",
    "code": "cf",
    "theme": "default",
    "id": "test-001",
    "project_id": "test-project-001",
    "service": "test",
    "collection_id": "default",
}


def resolve_path_values(ep: Endpoint) -> dict[str, str]:
    """Resolve placeholder values for path parameters."""
    values: dict[str, str] = {}
    for p in ep.path_params:
        name = p.get("name", "")
        values[name] = _KNOWN_VALUES.get(name, f"test-{name}")
    return values


def resolve_query_values(ep: Endpoint) -> dict[str, str]:
    """Resolve placeholder values for query parameters."""
    values: dict[str, str] = {}
    for p in ep.query_params:
        name = p.get("name", "")
        required = p.get("required", False)
        if required:
            values[name] = _KNOWN_VALUES.get(name, f"test-{name}")
        else:
            # For optional params, still provide a value so we can test
            values[name] = _KNOWN_VALUES.get(name, f"test-{name}")
    return values


def build_url(base_url: str, ep: Endpoint) -> str:
    """Construct the full test URL with path and query params resolved."""
    url_pattern = ep.url

    # Split off any query string already baked into the URL pattern
    if "?" in url_pattern:
        url_base, existing_qs = url_pattern.split("?", 1)
    else:
        url_base, existing_qs = url_pattern, ""

    # Substitute path params into the URL base (path params may appear anywhere)
    path_values = resolve_path_values(ep)
    query_values = resolve_query_values(ep)

    for name, value in path_values.items():
        placeholder = f"{{{name}}}"
        url_base = url_base.replace(placeholder, value)
        existing_qs = existing_qs.replace(placeholder, value)

    # Substitute query param placeholders that appear in the existing query string
    for name, value in query_values.items():
        placeholder = f"{{{name}}}"
        existing_qs = existing_qs.replace(placeholder, value)

    # Merge existing query params with resolved test values (deduplicated)
    from urllib.parse import parse_qs
    merged_params: dict[str, list[str]] = {}
    if existing_qs:
        for k, v in parse_qs(existing_qs, keep_blank_values=True).items():
            merged_params.setdefault(k, []).extend(v)
    for name, value in query_values.items():
        if name not in merged_params:
            merged_params[name] = [value]

    qs = urlencode(merged_params, doseq=True) if merged_params else ""

    full_url = base_url.rstrip("/") + url_base
    if qs:
        full_url += "?" + qs

    return full_url


# ---------------------------------------------------------------------------
# HTTP tester (async)
# ---------------------------------------------------------------------------

DEFAULT_TIMEOUT = 30  # seconds
DEFAULT_CONCURRENCY = 10


async def test_one(
    session: Any,  # aiohttp.ClientSession
    base_url: str,
    ep: Endpoint,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    """Test a single endpoint and return its result dict."""
    url = build_url(base_url, ep)
    result = {
        "function_name": ep.function_name,
        "method": ep.method,
        "url": ep.url,
        "full_url": url,
        "file_path": ep.file_path,
        "layer": classify_layer(ep).value,
    }

    start = time.monotonic()
    try:
        async with session.get(url, timeout=timeout) as resp:
            latency = (time.monotonic() - start) * 1000
            body = None
            content_type = resp.headers.get("content-type", "")
            try:
                if "application/json" in content_type:
                    body = await resp.json()
                else:
                    raw = await resp.text()
                    body = raw[:2000]  # truncate long responses
            except Exception:
                body = "<unparseable>"

            result["test_http_code"] = resp.status
            result["test_latency_ms"] = round(latency, 2)
            result["test_response_body"] = body
            result["content_type"] = content_type

            if 200 <= resp.status < 300:
                result["test_status"] = TestResult.OK.value
            elif resp.status == 404:
                result["test_status"] = TestResult.NOT_FOUND.value
            elif 400 <= resp.status < 500:
                result["test_status"] = TestResult.CLIENT_ERROR.value
            elif 500 <= resp.status < 600:
                result["test_status"] = TestResult.SERVER_ERROR.value
            else:
                result["test_status"] = TestResult.OK.value

    except asyncio.TimeoutError:
        latency = (time.monotonic() - start) * 1000
        result["test_status"] = TestResult.TIMEOUT.value
        result["test_http_code"] = None
        result["test_latency_ms"] = round(latency, 2)
        result["test_error"] = f"Timeout after {timeout}s"

    except Exception as exc:
        latency = (time.monotonic() - start) * 1000
        result["test_status"] = TestResult.CONNECTION_ERROR.value
        result["test_http_code"] = None
        result["test_latency_ms"] = round(latency, 2)
        result["test_error"] = str(exc)

    return result


async def run_layer(
    base_url: str,
    endpoints: list[Endpoint],
    concurrency: int = DEFAULT_CONCURRENCY,
    timeout: int = DEFAULT_TIMEOUT,
    dry_run: bool = False,
) -> list[dict]:
    """Run all endpoints in a layer with bounded concurrency."""
    semaphore = asyncio.Semaphore(concurrency)

    async def bounded_test(ep: Endpoint) -> dict:
        if dry_run:
            return {
                "function_name": ep.function_name,
                "method": ep.method,
                "url": ep.url,
                "full_url": build_url(base_url, ep),
                "file_path": ep.file_path,
                "layer": classify_layer(ep).value,
                "test_status": TestResult.SKIPPED.value,
                "test_http_code": None,
                "test_latency_ms": None,
                "test_error": "dry-run",
            }

        async with semaphore:
            connector = aiohttp.TCPConnector(limit=0, force_close=True)
            async with aiohttp.ClientSession(connector=connector) as session:
                return await test_one(session, base_url, ep, timeout)

    return await asyncio.gather(*(bounded_test(ep) for ep in endpoints))


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run(
    base_url: str,
    endpoints_json_path: str,
    *,
    layers: Optional[set[int]] = None,
    concurrency: int = DEFAULT_CONCURRENCY,
    timeout: int = DEFAULT_TIMEOUT,
    dry_run: bool = False,
    output_dir: str = "",
) -> TestRun:
    """Main entry point.  Classifies, tests, and records."""
    # Load
    all_endpoints = load_endpoints(endpoints_json_path)

    # Filter to GET only (skip mutations)
    get_endpoints = [ep for ep in all_endpoints if ep.method == "GET"]
    print(f"Loaded {len(all_endpoints)} total, {len(get_endpoints)} GET endpoints")

    # Classify
    by_layer: dict[TestLayer, list[Endpoint]] = {ly: [] for ly in TestLayer}
    for ep in get_endpoints:
        ly = classify_layer(ep)
        if layers is None or ly.value in layers:
            by_layer[ly].append(ep)
            ep.test_layer = ly.value

    layer_order = [TestLayer.SMOKE, TestLayer.PATH_PARAMS, TestLayer.QUERY_PARAMS, TestLayer.HYBRID]
    layer_labels = {
        TestLayer.SMOKE: "Layer 0 — Smoke (no params)",
        TestLayer.PATH_PARAMS: "Layer 1 — Path params only",
        TestLayer.QUERY_PARAMS: "Layer 2 — Query params only",
        TestLayer.HYBRID: "Layer 3 — Path + query params",
    }

    test_run = TestRun(
        base_url=base_url,
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    all_results: list[dict] = []

    for ly in layer_order:
        eps = by_layer[ly]
        if not eps:
            continue

        label = layer_labels[ly]
        print(f"\n{'='*60}")
        print(f"{label}  ({len(eps)} endpoints)")
        print(f"{'='*60}")

        results = asyncio.run(run_layer(base_url, eps, concurrency, timeout, dry_run))
        all_results.extend(results)

        # Summarise this layer
        ok_count = sum(1 for r in results if r["test_status"] == TestResult.OK.value)
        err_count = len(results) - ok_count
        print(f"  OK: {ok_count}  |  Issues: {err_count}")

        if not dry_run and ly == TestLayer.SMOKE:
            # After smoke tests, collect any agent_ids / real values found
            for r in results:
                body = r.get("test_response_body")
                if isinstance(body, list) and len(body) > 0:
                    first = body[0]
                    if isinstance(first, dict):
                        if "id" in first or "agent_id" in first:
                            real_id = first.get("id") or first.get("agent_id")
                            if real_id:
                                _KNOWN_VALUES["agent_id"] = str(real_id)
                                break

    test_run.total_endpoints = len(get_endpoints)
    test_run.tested = sum(1 for r in all_results if r["test_status"] != TestResult.SKIPPED.value)
    test_run.ok = sum(1 for r in all_results if r["test_status"] == TestResult.OK.value)
    test_run.errors = test_run.tested - test_run.ok
    test_run.skipped = len(all_results) - test_run.tested
    test_run.finished_at = datetime.now(timezone.utc).isoformat()
    test_run.results = all_results

    # Write output
    if output_dir:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        # Full results
        results_file = out_path / "test_results.json"
        with open(results_file, "w") as fh:
            json.dump(asdict(test_run), fh, indent=2, default=str)
        print(f"\nResults written to {results_file}")

        # Summary
        summary = {
            "base_url": base_url,
            "started_at": test_run.started_at,
            "finished_at": test_run.finished_at,
            "total_get_endpoints": test_run.total_endpoints,
            "tested": test_run.tested,
            "ok": test_run.ok,
            "errors": test_run.errors,
            "skipped": test_run.skipped,
            "by_status": {},
        }
        for r in all_results:
            st = r["test_status"]
            summary["by_status"][st] = summary["by_status"].get(st, 0) + 1

        summary_file = out_path / "test_summary.json"
        with open(summary_file, "w") as fh:
            json.dump(summary, fh, indent=2)
        print(f"Summary written to {summary_file}")

    return test_run


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Test Orchestrator for VPS API endpoints (GET-only by default)"
    )
    parser.add_argument(
        "--base-url",
        required=True,
        help="VPS base URL, e.g. https://vps.example.com",
    )
    parser.add_argument(
        "--endpoints-json",
        default="",
        help="Path to endpoints.json (default: auto-detect)",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Directory for test_results.json and test_summary.json",
    )
    parser.add_argument(
        "--layer",
        type=int,
        action="append",
        dest="layers",
        help="Only test specific layer(s). Repeatable. 0=smoke,1=path,2=query,3=hybrid",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"Max concurrent requests (default: {DEFAULT_CONCURRENCY})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"Request timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be tested without making requests",
    )
    args = parser.parse_args()

    # Auto-detect paths
    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parent

    endpoints_json = args.endpoints_json or str(root_dir / "endpoints.json")
    output_dir = args.output_dir or str(script_dir / "output")

    if not os.path.exists(endpoints_json):
        print(f"ERROR: endpoints.json not found at {endpoints_json}", file=sys.stderr)
        sys.exit(1)

    layers = set(args.layers) if args.layers else None

    print(f"Base URL:  {args.base_url}")
    print(f"Endpoints: {endpoints_json}")
    print(f"Output:    {output_dir}")
    print(f"Concurrency: {args.concurrency}  |  Timeout: {args.timeout}s")
    if args.dry_run:
        print("DRY-RUN MODE — no HTTP requests will be made")

    run(
        base_url=args.base_url,
        endpoints_json_path=endpoints_json,
        layers=layers,
        concurrency=args.concurrency,
        timeout=args.timeout,
        dry_run=args.dry_run,
        output_dir=output_dir,
    )


if __name__ == "__main__":
    main()
