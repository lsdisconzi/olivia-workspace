#!/usr/bin/env python3
"""
OpenAPI 3.1 Spec Generator.

Reads endpoints.json (optionally enriched with test_results.json) and generates
per-service OpenAPI 3.1 specifications.

Usage:
    python openapi_generator.py
    python openapi_generator.py --test-results test_harness/output/test_results.json
    python openapi_generator.py --service gateway
"""

import argparse
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _service_name(file_path: str) -> str:
    """Extract a clean service name from 'service:foo:openapi' format."""
    parts = file_path.split(":")
    if len(parts) >= 2:
        return parts[1]
    return file_path.replace(":", "_").replace("/", "_")


def _tag_from_url(url: str) -> str:
    """Guess a tag from the URL path, e.g. /api/agents/list -> Agents."""
    clean = url.split("?")[0].strip("/")
    parts = [p for p in clean.split("/") if p and not p.startswith("{") and p not in ("api", "v1")]
    if parts:
        return parts[0].replace("-", " ").title()
    return "General"


def _openapi_param_type(param: dict) -> str:
    """Map a param type/anyOf to an OpenAPI type."""
    t = param.get("type", "string")
    if t == "anyOf":
        return "string"
    return t


def _build_schema_from_response(resp_data: Optional[dict]) -> dict:
    """Build a best-effort OpenAPI schema from response_schema_data or live body."""
    if not resp_data:
        return {"type": "object", "description": "Successful response"}

    # If it's already an OpenAPI-like schema with $ref or type
    if "$ref" in resp_data:
        return resp_data
    if "type" in resp_data:
        return resp_data

    # Otherwise wrap
    return {
        "type": "object",
        "description": resp_data.get("description", "Successful response"),
        "properties": {},
    }


def _infer_response_schema(body: Any) -> dict:
    """Infer a JSON Schema from a live response body."""
    if body is None:
        return {"type": "object", "description": "No content"}

    if isinstance(body, list):
        item_schema = {}
        if len(body) > 0 and isinstance(body[0], dict):
            props = {}
            for k, v in body[0].items():
                props[k] = _infer_type(v)
            item_schema = {"type": "object", "properties": props}
        else:
            item_schema = _infer_type(body[0]) if body else {"type": "string"}
        return {"type": "array", "items": item_schema}

    if isinstance(body, dict):
        props = {}
        for k, v in body.items():
            props[k] = _infer_type(v)
        return {"type": "object", "properties": props}

    return _infer_type(body)


def _infer_type(value: Any) -> dict:
    """Infer a JSON Schema type from a Python value."""
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    if isinstance(value, str):
        return {"type": "string"}
    if isinstance(value, list):
        item = _infer_type(value[0]) if value else {"type": "string"}
        return {"type": "array", "items": item}
    if isinstance(value, dict):
        props = {k: _infer_type(v) for k, v in value.items()}
        return {"type": "object", "properties": props}
    return {"type": "string"}


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

def generate(
    endpoints_json_path: str,
    test_results_path: str = "",
    output_dir: str = "",
    single_service: str = "",
) -> dict[str, dict]:
    """Generate per-service OpenAPI 3.1 specs. Returns {service_name: spec_dict}."""

    # Load endpoints
    with open(endpoints_json_path, "r") as fh:
        data = json.load(fh)

    # Load test results if available
    test_lookup: dict[str, dict] = {}
    if test_results_path and os.path.exists(test_results_path):
        with open(test_results_path, "r") as fh:
            tr = json.load(fh)
        for r in tr.get("results", []):
            key = f"{r.get('method','')}:{r.get('url','')}"
            test_lookup[key] = r

    # Group endpoints by service
    by_service: dict[str, list[dict]] = defaultdict(list)
    for file_entry in data.get("files", []):
        svc = _service_name(file_entry.get("file_path", "unknown"))
        for ep in file_entry.get("endpoints", []):
            ep["_service"] = svc
            by_service[svc].append(ep)

    specs: dict[str, dict] = {}
    services = [single_service] if single_service else sorted(by_service.keys())

    for svc in services:
        if svc not in by_service:
            continue

        endpoints = by_service[svc]
        spec = _build_spec(svc, endpoints, test_lookup)
        specs[svc] = spec

        if output_dir:
            out_path = Path(output_dir)
            out_path.mkdir(parents=True, exist_ok=True)
            file_path = out_path / f"{svc}.openapi.json"
            with open(file_path, "w") as fh:
                json.dump(spec, fh, indent=2)
            print(f"  {file_path}  ({len(endpoints)} endpoints)")

    return specs


def _build_spec(
    svc: str,
    endpoints: list[dict],
    test_lookup: dict[str, dict],
) -> dict:
    """Build a single OpenAPI 3.1 spec for one service."""

    paths: dict[str, dict] = {}
    tags_seen: set[str] = set()
    schemas: dict[str, dict] = {}

    for ep in endpoints:
        method = ep.get("method", "GET").lower()
        url = ep.get("url", "")
        fn_name = ep.get("function_name", "")
        context = ep.get("context", fn_name)
        tag = _tag_from_url(url)
        tags_seen.add(tag)

        # Build path item
        path_key, path_item = _ensure_path(paths, url)

        # Parameters
        parameters = []
        for p in ep.get("path_params", []):
            parameters.append({
                "name": p.get("name", ""),
                "in": "path",
                "required": p.get("required", True),
                "schema": {"type": _openapi_param_type(p)},
                "description": p.get("description", ""),
            })
        for p in ep.get("query_params", []):
            parameters.append({
                "name": p.get("name", ""),
                "in": "query",
                "required": p.get("required", False),
                "schema": {"type": _openapi_param_type(p)},
                "description": p.get("description", ""),
            })

        # Request body (for POST/PATCH/PUT)
        request_body = None
        if method in ("post", "patch", "put"):
            payload = ep.get("request_payload", "")
            if payload:
                request_body = {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": _body_schema_name(ep),
                        }
                    },
                }
                # Collect body schemas
                schema_name = _body_schema_name(ep).get("$ref", "").split("/")[-1]
                if schema_name and schema_name not in schemas:
                    schemas[schema_name] = {"type": "object", "description": payload}

        # Response
        test_key = f"{method.upper()}:{url.split('?')[0]}"
        test_info = test_lookup.get(test_key, {})

        response_schema = _build_schema_from_response(ep.get("response_schema_data"))
        if test_info.get("test_response_body") and isinstance(test_info["test_response_body"], (dict, list)):
            live_schema = _infer_response_schema(test_info["test_response_body"])
            response_schema = live_schema

        status_code = str(test_info.get("test_http_code", 200)) if test_info else "200"
        if not test_info:
            status_code = "200"

        response_desc = ep.get("expected_response") or "Successful Response"
        if test_info:
            test_status = test_info.get("test_status", "")
            if test_status == "ok":
                response_desc += f" [TESTED: {test_info.get('test_http_code')}]"
            elif test_status:
                response_desc += f" [TEST STATUS: {test_status}]"

        responses = {
            status_code: {
                "description": response_desc,
                "content": {
                    "application/json": {
                        "schema": response_schema,
                    }
                },
            }
        }

        # Add error responses
        if status_code != "200":
            responses["200"] = {
                "description": "Successful response (expected)",
                "content": {"application/json": {"schema": {"type": "object"}}},
            }

        operation: dict = {
            "operationId": fn_name or f"{method}_{_slug(url)}",
            "summary": context or tag,
            "description": ep.get("notes", ""),
            "tags": [tag],
            "responses": responses,
        }

        if parameters:
            operation["parameters"] = parameters
        if request_body:
            operation["requestBody"] = request_body
        if test_info:
            operation["x-test-status"] = test_info.get("test_status", "unknown")
            if test_info.get("test_latency_ms"):
                operation["x-test-latency-ms"] = test_info["test_latency_ms"]

        path_item[method] = operation

    # Build top-level spec
    spec: dict = {
        "openapi": "3.1.0",
        "info": {
            "title": f"{svc} API",
            "version": "1.0.0",
            "description": f"Auto-generated OpenAPI 3.1 spec for service '{svc}'.\nGenerated at {datetime.now(timezone.utc).isoformat()}",
        },
        "servers": [{"url": "/", "description": "VPS API server"}],
        "tags": [{"name": t} for t in sorted(tags_seen)],
        "paths": paths,
    }

    if schemas:
        spec["components"] = {"schemas": schemas}

    return spec


def _ensure_path(paths: dict, url: str) -> tuple[str, dict]:
    """Get or create a path entry, normalising URL patterns."""
    base = url.split("?")[0]
    if base not in paths:
        paths[base] = {}
    return base, paths[base]


def _slug(url: str) -> str:
    """Convert URL path to a slug."""
    clean = url.split("?")[0].strip("/")
    return re.sub(r"[^\w]", "_", clean)


def _body_schema_name(ep: dict) -> dict:
    """Derive a schema $ref name for a request body."""
    name = ep.get("function_name", "") or _slug(ep.get("url", ""))
    schema_name = name.replace("_post", "_request").replace("_patch", "_request").replace("_put", "_request")
    if not schema_name.endswith("_request"):
        schema_name += "_request"
    return {"$ref": f"#/components/schemas/{schema_name}"}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate OpenAPI 3.1 specs from endpoints.json"
    )
    parser.add_argument(
        "--endpoints-json",
        default="",
        help="Path to endpoints.json (default: auto-detect)",
    )
    parser.add_argument(
        "--test-results",
        default="",
        help="Path to test_results.json for live response enrichment",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Output directory for per-service .openapi.json files",
    )
    parser.add_argument(
        "--service",
        default="",
        help="Only generate spec for a single service (e.g., 'gateway')",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parent

    endpoints_json = args.endpoints_json or str(root_dir / "endpoints.json")
    test_results = args.test_results or str(script_dir / "output" / "test_results.json")
    output_dir = args.output_dir or str(root_dir / "openapi")

    if not os.path.exists(endpoints_json):
        print(f"ERROR: endpoints.json not found at {endpoints_json}")
        return

    print(f"Endpoints:    {endpoints_json}")
    print(f"Test results: {test_results if os.path.exists(test_results) else '(not found — skipping)'}")
    print(f"Output:       {output_dir}")
    print()

    generate(
        endpoints_json_path=endpoints_json,
        test_results_path=test_results if os.path.exists(test_results) else "",
        output_dir=output_dir,
        single_service=args.service,
    )

    print("\nDone.")


if __name__ == "__main__":
    main()
