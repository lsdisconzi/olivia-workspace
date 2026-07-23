#!/usr/bin/env python3
"""
Validation Report Updater.

Reads test_results.json and updates:
  1. validation_report.json  — per-function validation scores + checks
  2. Individual function JSONs in agent_functions/functions/ — test_status, test_http_code, fix_suggestion
  3. triage_report.json / triage_report.md  — regenerated summary

Usage:
    python validation_updater.py
    python validation_updater.py --test-results test_harness/output/test_results.json
    python validation_updater.py --dry-run
"""

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def compute_validation_score(
    func: dict,
    test_result: Optional[dict] = None,
) -> int:
    """Compute a validation score 0-100 for a function."""
    score = 0
    checks = {
        "method_defined": False,
        "url_defined": False,
        "parameters_defined": False,
        "body_defined_for_write": False,
        "response_defined": False,
        "tested": False,
        "working": False,
    }

    # Basic fields (10 pts each)
    if func.get("method"):
        score += 10
        checks["method_defined"] = True
    if func.get("url_pattern") or func.get("url"):
        score += 10
        checks["url_defined"] = True
    if func.get("path_params") is not None or func.get("query_params") is not None:
        score += 10
        checks["parameters_defined"] = True

    # Write methods need a body schema
    method = (func.get("method") or "").upper()
    if method in ("POST", "PATCH", "PUT", "DELETE"):
        if func.get("body_schema") or func.get("request_payload"):
            score += 10
            checks["body_defined_for_write"] = True
    else:
        score += 10
        checks["body_defined_for_write"] = True  # N/A for GET

    # Response schema (20 pts)
    if func.get("response_schema") or func.get("response_schema_data"):
        score += 20
        checks["response_defined"] = True

    # Test results (40 pts total)
    if test_result:
        checks["tested"] = True
        score += 15

        status = test_result.get("test_status", "")
        http_code = test_result.get("test_http_code")
        if status == "ok" and http_code and 200 <= http_code < 300:
            checks["working"] = True
            score += 25
        elif status == "ok":
            score += 15
        elif status in ("not_found", "client_error"):
            score += 5
        # connection_error, timeout, server_error => 0

    return min(score, 100), checks


def _determine_test_status(http_code: Optional[int], status: str) -> str:
    """Map test result to a canonical test_status string."""
    if status == "skipped":
        return "untested"
    if status == "ok":
        return "ok"
    if status == "not_found":
        return "not_found"
    if status == "client_error":
        return "client_error"
    if status == "server_error":
        return "server_error"
    if status == "timeout":
        return "timeout"
    if status == "connection_error":
        return "connection_error"
    return "untested"


def _generate_fix_suggestion(status: str, http_code: Optional[int], error: Optional[str]) -> str:
    """Generate a human-readable fix suggestion."""
    if status == "ok":
        return ""
    if status == "not_found":
        return "Route not found (404). Verify the URL path is correct and that the route is registered in the backend API server."
    if status == "client_error":
        if http_code == 400:
            return "Route exists but returned 400 (Bad Request). Check required query parameters or request body structure."
        if http_code == 401:
            return "Route exists but requires authentication (401). Ensure a valid auth token / header is included in the request."
        if http_code == 403:
            return "Route exists but access is forbidden (403). Check permissions for the authenticated principal."
        if http_code == 422:
            return "Route exists but rejected with 422 (Unprocessable Entity). Verify required body fields, query parameters, and content-type headers."
        return f"Route returned HTTP {http_code}. Review request parameters and authentication."
    if status == "server_error":
        return f"Server error (HTTP {http_code}). Check backend logs for the route handler."
    if status == "timeout":
        return f"Request timed out. The endpoint may be hanging or the timeout threshold is too low."
    if status == "connection_error":
        return f"Connection failed: {error}. Verify the VPS is reachable and the URL is correct."
    return ""


# ---------------------------------------------------------------------------
# Updaters
# ---------------------------------------------------------------------------

def update_validation_report(
    report_path: str,
    test_lookup: dict[str, dict],
    dry_run: bool = False,
) -> dict:
    """Update validation_report.json with test results."""
    with open(report_path, "r") as fh:
        report = json.load(fh)

    updated = 0
    for func in report.get("functions", []):
        func_name = func.get("name", "")
        func_url = func.get("url", "")
        method = func.get("method", "GET")
        test_key = f"{method}:{func_url}"

        test_result = test_lookup.get(test_key) or test_lookup.get(func_name)
        if not test_result:
            continue

        test_status = test_result.get("test_status", "untested")
        http_code = test_result.get("test_http_code")

        score, checks = compute_validation_score(func, test_result)

        func["validation_score"] = score
        func["validation_checks"] = checks
        func["test_status"] = _determine_test_status(http_code, test_status)
        func["test_http_code"] = http_code

        old_notes = func.get("validation_notes", [])
        new_notes = []
        if not checks["response_defined"]:
            new_notes.append("Missing response schema/description")
        if not checks["tested"]:
            new_notes.append("Endpoint not runtime-tested")
        elif not checks["working"]:
            new_notes.append(f"Test returned {test_status} (HTTP {http_code})")
        func["validation_notes"] = new_notes or old_notes

        updated += 1

    # Update summary
    funcs = report.get("functions", [])
    report["summary"] = {
        "total_functions": len(funcs),
        "agent_ready": sum(1 for f in funcs if f.get("agent_ready")),
        "working": sum(1 for f in funcs if f.get("test_status") == "ok"),
        "tested_not_ok": sum(1 for f in funcs if f.get("test_status") not in ("ok", "untested", None)),
        "untested": sum(1 for f in funcs if f.get("test_status") in ("untested", None)),
        "missing_response_schema": sum(1 for f in funcs if not f.get("has_response_schema")),
        "missing_write_body_schema": sum(1 for f in funcs if not f.get("has_body_schema")),
        "average_validation_score": round(
            sum(f.get("validation_score", 0) for f in funcs) / max(len(funcs), 1), 2
        ),
    }
    report["generated_at"] = datetime.now(timezone.utc).isoformat()

    if not dry_run:
        with open(report_path, "w") as fh:
            json.dump(report, fh, indent=2)

    print(f"  validation_report.json: {updated} functions updated")
    return report


def update_function_files(
    functions_dir: str,
    test_lookup: dict[str, dict],
    dry_run: bool = False,
) -> int:
    """Update individual function JSON files in agent_functions/functions/."""
    updated = 0
    func_dir = Path(functions_dir)

    if not func_dir.exists():
        print(f"  functions dir not found: {functions_dir}")
        return 0

    # Build name→file mapping
    for fpath in func_dir.iterdir():
        if not fpath.suffix == ".json":
            continue
        try:
            with open(fpath, "r") as fh:
                func = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue

        func_name = func.get("name", "")
        method = func.get("method", "GET")
        url = func.get("url_pattern", "")

        test_key = f"{method}:{url}"
        test_result = test_lookup.get(test_key) or test_lookup.get(func_name)
        if not test_result:
            continue

        test_status = test_result.get("test_status", "untested")
        http_code = test_result.get("test_http_code")

        func["test_status"] = _determine_test_status(http_code, test_status)
        func["test_http_code"] = http_code
        func["test_notes"] = test_result.get("test_error", "")
        func["fix_suggestion"] = _generate_fix_suggestion(
            test_status, http_code, test_result.get("test_error")
        )

        # Update validation score
        score, checks = compute_validation_score(func, test_result)
        func["validation_score"] = score
        func["validation_checks"] = checks

        # If we got a live response, capture its schema
        live_body = test_result.get("test_response_body")
        if live_body and isinstance(live_body, (dict, list)):
            if not func.get("response_schema") or func["response_schema"] == {"description": "application/json response: Successful Response"}:
                from openapi_generator import _infer_response_schema
                func["response_schema"] = _infer_response_schema(live_body)

        if not dry_run:
            with open(fpath, "w") as fh:
                json.dump(func, fh, indent=2)

        updated += 1

    return updated


def _status_priority(status: str) -> int:
    """Lower = better. ok=0, client_error=1, server_error=2, not_found=3, rest=4."""
    return {"ok": 0, "client_error": 1, "server_error": 2, "not_found": 3}.get(status, 4)


def regenerate_triage_report(
    triage_json_path: str,
    triage_md_path: str,
    test_lookup: dict[str, dict],
    dry_run: bool = False,
) -> None:
    """Regenerate the triage report from test results, deduplicated by method+URL."""
    # Deduplicate by method+url, keeping the best result
    best: dict[str, dict] = {}
    for key, tr in test_lookup.items():
        url = tr.get("url", "")
        method = tr.get("method", "GET")
        dedup_key = f"{method}:{url}"
        status = tr.get("test_status", "untested")

        existing = best.get(dedup_key)
        if existing is None or _status_priority(status) < _status_priority(existing.get("test_status", "untested")):
            best[dedup_key] = {
                "endpoint": url,
                "method": method,
                "http_code": tr.get("test_http_code"),
                "latency_ms": tr.get("test_latency_ms"),
                "source": tr.get("file_path", ""),
                "error": tr.get("test_error", ""),
                "test_status": status,
            }

    # Rebuild from deduplicated results
    ok_list: list[dict] = []
    not_found_list: list[dict] = []
    reachable_errors: list[dict] = []
    untested_list: list[dict] = []

    for entry in best.values():
        status = entry.pop("test_status", "untested")
        if status == "ok":
            ok_list.append(entry)
        elif status == "not_found":
            not_found_list.append(entry)
        elif status in ("client_error", "server_error"):
            reachable_errors.append(entry)
        else:
            untested_list.append(entry)

    triage = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "ok": len(ok_list),
            "not_found": len(not_found_list),
            "reachable_errors": len(reachable_errors),
            "untested": len(untested_list),
        },
        "ok": ok_list,
        "not_found": not_found_list,
        "reachable_errors": reachable_errors,
        "untested": untested_list,
    }

    if not dry_run:
        with open(triage_json_path, "w") as fh:
            json.dump(triage, fh, indent=2)

    # Generate markdown
    md = _render_triage_md(triage)
    if not dry_run:
        with open(triage_md_path, "w") as fh:
            fh.write(md)

    print(f"  triage_report.json: {len(ok_list)} OK, {len(not_found_list)} NF, {len(reachable_errors)} ERR, {len(untested_list)} untested")
    print(f"  triage_report.md regenerated")


def _render_triage_md(triage: dict) -> str:
    """Render triage data as markdown."""
    s = triage["summary"]
    lines = [
        "# Endpoint Triage Report",
        "",
        f"> Auto-generated by validation_updater.py — {triage['generated_at']}",
        "",
        "## Summary",
        "",
        "| Status | Count |",
        "|--------|-------|",
        f"| ✅ OK | {s['ok']} |",
        f"| ❌ Not Found (404) | {s['not_found']} |",
        f"| 🟡 Reachable (errors) | {s['reachable_errors']} |",
        f"| ⚪ Not Tested | {s['untested']} |",
        "",
    ]

    if triage["not_found"]:
        lines += [
            "## ❌ Not Found — Route Missing",
            "",
            "| Endpoint | Method | Source | HTTP | Error |",
            "|----------|--------|--------|------|-------|",
        ]
        for e in triage["not_found"]:
            lines.append(f"| `{e['endpoint']}` | `{e['method']}` | {e.get('source','')} | {e.get('http_code',404)} | {e.get('error','')} |")
        lines.append("")

    if triage["reachable_errors"]:
        lines += [
            "## 🟡 Reachable — Errors / Wrong Method",
            "",
            "| Endpoint | Method | Source | HTTP | Error |",
            "|----------|--------|--------|------|-------|",
        ]
        for e in triage["reachable_errors"]:
            fix = ""
            http = e.get("http_code", 0)
            if http == 400:
                fix = "Check required query parameters or request body."
            elif http == 401:
                fix = "Requires authentication. Include a valid token."
            elif http == 403:
                fix = "Access forbidden. Check permissions."
            elif http == 422:
                fix = "Verify body fields, query params, and content-type."
            lines.append(f"| `{e['endpoint']}` | `{e['method']}` | {e.get('source','')} | {http} | {fix} |")
        lines.append("")

    if triage["ok"]:
        lines += [
            "## ✅ Working Endpoints",
            "",
            "| Endpoint | Method | HTTP | Latency |",
            "|----------|--------|------|---------|",
        ]
        for e in triage["ok"][:200]:  # limit to 200 to keep the file manageable
            lat = f"{e.get('latency_ms', 0):.0f}ms" if e.get("latency_ms") else "-"
            lines.append(f"| `{e['endpoint']}` | `{e['method']}` | {e.get('http_code', 200)} | {lat} |")
        if len(triage["ok"]) > 200:
            lines.append(f"| ... | ... | ... | ... |")
            lines.append(f"| *{len(triage['ok']) - 200} more working endpoints* | | | |")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Update validation reports from test results"
    )
    parser.add_argument(
        "--test-results",
        default="",
        help="Path to test_results.json (default: auto-detect)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be updated without writing",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parent
    agent_dir = root_dir / "agent_functions"

    test_results_path = args.test_results or str(script_dir / "output" / "test_results.json")
    if not os.path.exists(test_results_path):
        print(f"ERROR: test_results.json not found at {test_results_path}")
        print("Run test_orchestrator.py first, then pass --test-results")
        return

    with open(test_results_path, "r") as fh:
        test_run = json.load(fh)

    # Build lookup by both method:url and function_name
    test_lookup: dict[str, dict] = {}
    for r in test_run.get("results", []):
        key_url = f"{r.get('method','')}:{r.get('url','')}"
        key_name = r.get("function_name", "")
        test_lookup[key_url] = r
        if key_name:
            test_lookup[key_name] = r

    print(f"Loaded {len(test_run.get('results', []))} test results")
    if args.dry_run:
        print("DRY-RUN MODE — no files will be written\n")

    # 1. Update validation_report.json
    report_path = str(agent_dir / "validation_report.json")
    if os.path.exists(report_path):
        update_validation_report(report_path, test_lookup, dry_run=args.dry_run)
    else:
        print(f"  validation_report.json not found at {report_path}")

    # 2. Update individual function files
    func_dir = str(agent_dir / "functions")
    n = update_function_files(func_dir, test_lookup, dry_run=args.dry_run)
    print(f"  Individual function files updated: {n}")

    # 3. Regenerate triage report
    triage_json = str(agent_dir / "triage_report.json")
    triage_md = str(agent_dir / "triage_report.md")
    regenerate_triage_report(triage_json, triage_md, test_lookup, dry_run=args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
