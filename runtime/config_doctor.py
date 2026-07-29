#!/usr/bin/env python3
"""Validate Olivia environment configuration before startup."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
URL_KEY_RE = re.compile(r"(?:_URL|_BASE_URL|_URI)$")
URL_EXACT_KEYS = {"OLLAMA_HOST"}
ALLOWED_URI_SCHEMES = {"http", "https", "bolt", "bolt+s", "neo4j", "neo4j+s"}

OLLAMA_KEEP_ALIVE_RE = re.compile(r"^-1$|^\d+[mhd]?$")
OLLAMA_MODEL_URLS_RE = re.compile(
    r"^https?://[a-zA-Z0-9.-]+(?::\d+)?(?:/v1/models)?$"
)


def _strip_inline_export(raw: str) -> str:
    if raw.startswith("export "):
        return raw[len("export "):].lstrip()
    return raw


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_env_file(path: Path) -> tuple[list[dict], list[str], list[str]]:
    entries: list[dict] = []
    malformed: list[str] = []
    missing_file: list[str] = []

    if not path.is_file():
        missing_file.append(f"Environment file not found: {path}")
        return entries, malformed, missing_file

    for idx, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        line = _strip_inline_export(line)
        if "=" not in line:
            malformed.append(f"line {idx}: missing '=' separator")
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = _unquote(value.strip())

        if not key:
            malformed.append(f"line {idx}: empty key")
            continue

        entries.append({"line": idx, "key": key, "value": value})

    return entries, malformed, missing_file


def _validate_urlish_value(key: str, value: str) -> str | None:
    if not value:
        return None
    if not URL_KEY_RE.search(key) and key not in URL_EXACT_KEYS:
        return None

    parsed = urlparse(value)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ALLOWED_URI_SCHEMES:
        return f"{key}: unsupported scheme '{parsed.scheme}'"

    if not parsed.netloc:
        return f"{key}: missing host in '{value}'"

    return None


def validate(entries: list[dict], malformed: list[str], strict: bool) -> tuple[list[str], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    infos: list[str] = []

    if malformed:
        errors.extend(malformed)

    by_key: dict[str, list[dict]] = {}
    for item in entries:
        key = item["key"]
        if not ENV_KEY_RE.match(key):
            errors.append(f"line {item['line']}: invalid key '{key}'")
            continue
        by_key.setdefault(key, []).append(item)

    for key, defs in by_key.items():
        if len(defs) <= 1:
            continue
        values = {d["value"] for d in defs}
        lines = ", ".join(str(d["line"]) for d in defs)
        if len(values) > 1:
            errors.append(f"{key}: conflicting duplicate values at lines {lines}")
            continue
        msg = f"{key}: duplicate with same value at lines {lines}"
        if strict:
            errors.append(msg)
        else:
            warnings.append(msg)

    values_map = {k: defs[-1]["value"] for k, defs in by_key.items()}

    required = {
        "VPS_GATEWAY_URL": "MCP bridge upstream gateway base URL",
        "LLM_BASE_URL": "OpenAI-compatible provider base URL",
        "LLM_MODEL": "default model identifier",
    }
    for key, purpose in required.items():
        if not values_map.get(key, "").strip():
            warnings.append(f"{key}: missing or empty ({purpose})")

    if not values_map.get("LLM_API_KEY") and not values_map.get("DEEPSEEK_API_KEY"):
        warnings.append("Neither LLM_API_KEY nor DEEPSEEK_API_KEY is set")

    if values_map.get("LLM_BASE_URL") and values_map.get("DEEPSEEK_API_BASE_URL"):
        if values_map["LLM_BASE_URL"].rstrip("/") != values_map["DEEPSEEK_API_BASE_URL"].rstrip("/"):
            warnings.append("LLM_BASE_URL and DEEPSEEK_API_BASE_URL differ; check intended precedence")

    if values_map.get("LLM_MODEL") and values_map.get("DEEPSEEK_MODEL"):
        if values_map["LLM_MODEL"] != values_map["DEEPSEEK_MODEL"]:
            warnings.append("LLM_MODEL and DEEPSEEK_MODEL differ; check intended precedence")

    # ── Ollama validation ───────────────────────────────────────────────────
    ollama_host = values_map.get("OLLAMA_HOST", "").strip()
    if ollama_host:
        parsed = urlparse(ollama_host)
        if parsed.scheme not in {"http", "https"}:
            errors.append(f"OLLAMA_HOST: unsupported scheme '{parsed.scheme}' (use http or https)")
        elif not parsed.netloc:
            errors.append(f"OLLAMA_HOST: missing host in '{ollama_host}'")
    else:
        infos.append("OLLAMA_HOST: not set (will use default http://127.0.0.1:11434)")

    ollama_keep_alive = values_map.get("OLLAMA_KEEP_ALIVE", "").strip()
    if ollama_keep_alive:
        if ollama_keep_alive == "-1":
            infos.append("OLLAMA_KEEP_ALIVE=-1: model stays in memory permanently (best)")
        elif ollama_keep_alive == "24h":
            infos.append("OLLAMA_KEEP_ALIVE=24h: model stays in memory for 24h (recommended)")
        elif OLLAMA_KEEP_ALIVE_RE.match(ollama_keep_alive):
            infos.append(f"OLLAMA_KEEP_ALIVE={ollama_keep_alive}")
        else:
            warnings.append(
                f"OLLAMA_KEEP_ALIVE={ollama_keep_alive}: unexpected format "
                "(use -1 for permanent, or duration like 24h, 10m)"
            )

    ollama_num_ctx = values_map.get("OLLAMA_NUM_CTX", "").strip()
    if ollama_num_ctx:
        try:
            n = int(ollama_num_ctx)
            if n < 4096:
                warnings.append(f"OLLAMA_NUM_CTX={n}: very small context window (min 4096, recommend 32768)")
            elif n < 16384:
                infos.append(f"OLLAMA_NUM_CTX={n}: moderate context window (gemma4 supports 131072)")
            elif n >= 131072:
                infos.append(f"OLLAMA_NUM_CTX={n}: using full model capacity (131072), ensure sufficient RAM")
            else:
                infos.append(f"OLLAMA_NUM_CTX={n}: good context window")
        except ValueError:
            errors.append(f"OLLAMA_NUM_CTX={ollama_num_ctx}: must be an integer")

    ollama_kv_cache = values_map.get("OLLAMA_KV_CACHE_TYPE", "").strip()
    if ollama_kv_cache:
        valid_kv_types = {"q8_0", "q4_0", "q4_1", "f16"}
        if ollama_kv_cache not in valid_kv_types:
            warnings.append(f"OLLAMA_KV_CACHE_TYPE={ollama_kv_cache}: expected one of {sorted(valid_kv_types)}")
        else:
            infos.append(f"OLLAMA_KV_CACHE_TYPE={ollama_kv_cache}: reduces KV cache memory (~50% vs FP16)")
    else:
        infos.append("OLLAMA_KV_CACHE_TYPE: not set, defaults to FP16 (high memory usage)")

    ollama_flash_attn = values_map.get("OLLAMA_FLASH_ATTENTION", "").strip()
    if ollama_flash_attn:
        if ollama_flash_attn in {"1", "true", "yes"}:
            infos.append("OLLAMA_FLASH_ATTENTION=1: flash attention enabled (faster eval, lower memory)")
        elif ollama_flash_attn in {"0", "false", "no"}:
            infos.append("OLLAMA_FLASH_ATTENTION=0: flash attention disabled")
        else:
            warnings.append(f"OLLAMA_FLASH_ATTENTION={ollama_flash_attn}: unexpected value (use 1 or 0)")
    else:
        infos.append("OLLAMA_FLASH_ATTENTION: not set (default depends on backend)")

    ollama_model_urls = values_map.get("OLLAMA_MODEL_URLS", "").strip()
    if ollama_model_urls:
        urls = [u.strip() for u in ollama_model_urls.split(",") if u.strip()]
        for u in urls:
            if not OLLAMA_MODEL_URLS_RE.match(u):
                warnings.append(f"OLLAMA_MODEL_URLS: '{u}' does not look like a valid server URL")

    for item in entries:
        issue = _validate_urlish_value(item["key"], item["value"])
        if issue:
            errors.append(f"line {item['line']}: {issue}")

    infos.append(f"Parsed variables: {len(entries)}")
    infos.append(f"Distinct keys: {len(by_key)}")

    return errors, warnings, infos


def build_report(path: Path, strict: bool) -> dict:
    entries, malformed, missing_file = parse_env_file(path)
    errors: list[str] = []
    warnings: list[str] = []
    infos: list[str] = []

    if missing_file:
        errors.extend(missing_file)
    else:
        errors, warnings, infos = validate(entries, malformed, strict)

    return {
        "env_file": str(path),
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "info": infos,
    }


def print_report(report: dict) -> None:
    print(f"[config-doctor] {report['env_file']}")

    errors = report["errors"]
    warnings = report["warnings"]
    info = report["info"]

    if info:
        print("Info:")
        for line in info:
            print(f"  - {line}")

    if warnings:
        print("Warnings:")
        for line in warnings:
            print(f"  - {line}")

    if errors:
        print("Errors:")
        for line in errors:
            print(f"  - {line}")

    status = "PASS" if report["ok"] else "FAIL"
    print(f"Result: {status} (errors={len(errors)}, warnings={len(warnings)})")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate .env consistency and required runtime keys.")
    parser.add_argument("--env-file", default=".env", help="Path to .env file (default: .env)")
    parser.add_argument("--strict", action="store_true", help="Treat duplicate same-value definitions as errors")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Emit JSON report")
    args = parser.parse_args(argv)

    report = build_report(Path(args.env_file).expanduser().resolve(), args.strict)
    if args.json_output:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
