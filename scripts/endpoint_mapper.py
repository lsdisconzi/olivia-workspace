#!/usr/bin/env python3
"""
API Endpoint Mapper
===================
Analyzes HTML/JS files and live services to extract API endpoints, then generates
visual documentation, agent-ready function definitions, and MCP tool catalogs.

Capabilities:
- Frontend endpoint extraction with DeepSeek (HTML/JS/TS/Vue)
- Service endpoint ingestion from live OpenAPI specs
- Gateway service-map ingestion for non-OpenAPI routes
- Probe/status enrichment from api_endpoint_catalog reports
- Agent function export + MCP-ready tools catalog

Usage:
    python endpoint_mapper.py ./src --output ./docs
    python endpoint_mapper.py ./frontend --name olivia --output ./docs
    python endpoint_mapper.py --services-only --olivia
"""

import os
import re
import json
import time
import shutil
import argparse
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, Any
from urllib import request as urllib_request, error as urllib_error, parse as urllib_parse
from dotenv import load_dotenv
from openai import OpenAI

# Load .env from the directory containing this script
load_dotenv(Path(__file__).parent / ".env")

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUNTIME_PORT_FILE = WORKSPACE_ROOT / ".dev-logs" / "runtime-ports.env"
DEFAULT_SERVICE_MAP_PATH = WORKSPACE_ROOT / "awareness-ai" / "_shared" / "api" / "service-map.json"
DEFAULT_AUDIT_REPORTS_DIR = WORKSPACE_ROOT / "reports" / "api-audit"

# Service targets mirror the live ecosystem as exposed by config/ecosystem_metadata.json
# (source of truth for http://localhost:3229/api/ecosystem/agents). Only services with
# HTTP endpoints are listed; violation-refiner is MCP-only and has no HTTP base URL.
SERVICE_TARGETS: list[dict[str, Any]] = [
    {"name": "transcription", "base_url": "http://127.0.0.1:8049", "health_path": "/health"},
    {"name": "juris-search", "base_url": "http://127.0.0.1:8000", "health_path": "/health"},
    {"name": "garage", "base_url": "http://127.0.0.1:8066", "health_path": "/health"},
    {"name": "ocr", "base_url": "http://127.0.0.1:8098", "health_path": "/health"},
    {"name": "discovery", "base_url": "http://127.0.0.1:3010", "health_path": "/health"},
    {"name": "audio", "base_url": "http://127.0.0.1:8777", "health_path": "/health"},
    {"name": "ops-dashboard", "base_url": "http://127.0.0.1:9000", "health_path": "/health"},
]

OPENAPI_CANDIDATES = ["/openapi.json", "/api/openapi.json", "/swagger.json"]


def _update_base_url_port(base_url: str, new_port: int) -> str:
    parsed = urllib_parse.urlsplit(base_url)
    host = parsed.hostname or "127.0.0.1"
    netloc = f"{host}:{new_port}"
    return urllib_parse.urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def _load_runtime_port_overrides(runtime_port_file: Path) -> dict[str, int]:
    overrides: dict[str, int] = {}
    if not runtime_port_file.exists():
        return overrides

    for line in runtime_port_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value.isdigit():
            overrides[key] = int(value)
    return overrides


def _resolve_service_targets(runtime_port_file: Path, service_filter: Optional[set[str]] = None) -> list[dict[str, Any]]:
    overrides = _load_runtime_port_overrides(runtime_port_file)
    resolved: list[dict[str, Any]] = []
    for svc in SERVICE_TARGETS:
        if service_filter and svc["name"] not in service_filter:
            continue
        item = dict(svc)
        if item["name"] in overrides:
            item["base_url"] = _update_base_url_port(item["base_url"], overrides[item["name"]])
        resolved.append(item)
    return resolved


def _find_latest_audit_catalog() -> Optional[Path]:
    if not DEFAULT_AUDIT_REPORTS_DIR.exists():
        return None
    matches = sorted(DEFAULT_AUDIT_REPORTS_DIR.glob("api_endpoint_catalog_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return matches[0] if matches else None

# ─────────────────────────────────────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class APIEndpoint:
    """Represents a single API endpoint call found in code."""
    file_path: str
    line_number: int
    method: str  # GET, POST, PUT, DELETE, PATCH, etc.
    url: str
    request_payload: Optional[str] = None
    expected_response: Optional[str] = None
    context: str = ""  # surrounding code context
    function_name: Optional[str] = None  # which function contains this call
    notes: str = ""
    path_params: list[dict] = field(default_factory=list)
    query_params: list[dict] = field(default_factory=list)
    response_schema_data: Optional[dict] = None

@dataclass
class FileAnalysis:
    """Analysis results for a single file."""
    file_path: str
    file_type: str  # html, js, jsx, ts, tsx, vue
    endpoints: list[APIEndpoint] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    api_clients: list[str] = field(default_factory=list)  # axios, fetch, etc.

@dataclass 
class ProjectAnalysis:
    """Complete project analysis."""
    project_name: str
    total_files: int
    total_endpoints: int
    files: list[FileAnalysis] = field(default_factory=list)
    endpoint_summary: dict = field(default_factory=dict)


@dataclass
class AgentFunction:
    """
    Agent-optimized function representation.
    Contains all information an AI agent needs to understand and use this endpoint.
    """
    id: str                          # Unique hash-based ID
    name: str                        # Human-readable function name
    method: str                      # HTTP method
    url_pattern: str                 # URL with parameter placeholders
    description: str                 # What this function does
    category: str                    # Functional category (crud, search, system, etc.)
    
    # Parameters
    path_params: list[dict] = field(default_factory=list)    # [{name, type, required, description}]
    query_params: list[dict] = field(default_factory=list)   # [{name, type, required, description}]
    body_schema: Optional[dict] = None                        # JSON schema or description
    headers: list[dict] = field(default_factory=list)        # Required headers
    
    # Response
    response_type: str = "json"                               # json, text, binary, stream
    response_schema: Optional[dict] = None                    # Expected response structure
    success_indicators: list[str] = field(default_factory=list)  # How to detect success
    error_handling: str = ""                                  # Error handling notes
    
    # Relationships
    prerequisites: list[str] = field(default_factory=list)   # Functions that must run first
    related_functions: list[str] = field(default_factory=list)  # Commonly used together
    supersedes: list[str] = field(default_factory=list)      # Functions this replaces
    
    # Agent Hints
    use_cases: list[str] = field(default_factory=list)       # When to use this function
    capabilities: list[str] = field(default_factory=list)    # What this enables
    limitations: list[str] = field(default_factory=list)     # Known constraints
    
    # Metadata
    source_file: str = ""
    source_function: Optional[str] = None
    confidence: float = 1.0          # How confident we are in this extraction

    # Test Results (populated when --test-report is provided)
    test_status: Optional[str] = None          # ok | reachable | not_found | timeout | offline | untested
    test_http_code: Optional[int] = None       # HTTP status code returned by probe
    test_notes: str = ""                       # Notes from test report
    test_source_ref: str = ""                  # JS file:line reference from test report
    fix_suggestion: str = ""                   # Actionable fix when status is not ok

    # Validation/Readiness (machine-consumable quality gate for agents)
    validation_score: int = 0
    validation_checks: dict[str, bool] = field(default_factory=dict)
    validation_notes: list[str] = field(default_factory=list)
    agent_ready: bool = False


@dataclass
class EndpointTestResult:
    """
    Runtime test result for a single endpoint, parsed from a probe/test report
    (e.g. FRONTEND_ENDPOINT_REPORT.md).  Populated by TestReportParser when
    --test-report is provided.
    """
    url: str
    method_declared: str      # HTTP method declared in source code
    method_probed: str        # HTTP method actually used to probe
    status: str               # ok | reachable | not_found | timeout | offline | untested
    http_code: Optional[int]  # HTTP status code returned by probe
    feature: str              # Human-readable feature description
    source_ref: str           # JS file + line reference (e.g. js/modules/agents.js:8)
    latency_ms: Optional[int]
    notes: str
    section: str              # Report section / category


# ─────────────────────────────────────────────────────────────────────────────
# URL Normalization Helper
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_llm_url(url: str) -> str:
    """Convert JS string-concat URL expressions from LLM output into clean ${VAR}/path templates."""
    # API_BASE + '/path' or API_BASE+'/path'
    url = re.sub(r'\bAPI_BASE\s*\+\s*[\'"]([^\'"]+)[\'"]', r'${API_BASE}\1', url)
    # _DSC_SERVER + '/path'
    url = re.sub(r'\b_DSC_SERVER\s*\+\s*[\'"]([^\'"]+)[\'"]', r'${_DSC_SERVER}\1', url)
    # config.gatewayUrl + '/path' or gatewayUrl + '/path'
    url = re.sub(r'\bconfig\.gatewayUrl\s*\+\s*[\'"]([^\'"]+)[\'"]', r'${GATEWAY_URL}\1', url)
    url = re.sub(r'\bgatewayUrl\s*\+\s*[\'"]([^\'"]+)[\'"]', r'${GATEWAY_URL}\1', url)
    # baseUrl + '/path' (RunPod style)
    url = re.sub(r'\bbaseUrl\s*\+\s*[\'"/]\s*\+?\s*(\w+)', r'${RUNPOD_BASE_URL}/\1', url)
    # Strip verbose LLM explanations: "baseUrl+'/'+execMode where baseUrl = ..."
    if ' where ' in url:
        url = url.split(' where ')[0].strip()
    # Normalize: `foo + 'bar'` leftover → keep as-is but tidy spaces
    url = re.sub(r'\s{2,}', ' ', url).strip()
    return url


# ─────────────────────────────────────────────────────────────────────────────
# LLM-Powered Analyzer
# ─────────────────────────────────────────────────────────────────────────────

class EndpointAnalyzer:
    """Uses DeepSeek to intelligently extract API endpoints from code."""
    
    CHUNK_MAX_CHARS = 10000  # ~3.3k tokens per chunk — fits well under rate limit
    
    def __init__(self, api_key: Optional[str] = None):
        resolved_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        resolved_base = os.environ.get("DEEPSEEK_API_BASE_URL", "https://api.deepseek.com")
        self.client = OpenAI(
            api_key=resolved_key,
            base_url=resolved_base,
        )
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-flash")
    
    def _extract_js_from_html(self, content: str) -> str:
        """Extract only <script> block content from HTML to reduce token usage."""
        scripts = re.findall(r'<script(?:[^>]*)>(.*?)</script>', content, re.DOTALL | re.IGNORECASE)
        if scripts:
            return '\n'.join(scripts)
        return content

    def _chunk_content(self, content: str) -> list[str]:
        """Split content into chunks that each fit within the token budget."""
        if len(content) <= self.CHUNK_MAX_CHARS:
            return [content]
        
        chunks: list[str] = []
        lines = content.split('\n')
        current_chunk: list[str] = []
        current_size = 0
        
        for line in lines:
            line_size = len(line) + 1
            if current_size + line_size > self.CHUNK_MAX_CHARS and current_chunk:
                chunks.append('\n'.join(current_chunk))
                current_chunk = []
                current_size = 0
            current_chunk.append(line)
            current_size += line_size
        
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        return chunks

    def _analyze_chunk(self, file_path: str, file_type: str, content: str, chunk_num: int, total_chunks: int) -> dict:
        """Analyze a single chunk of code for API endpoints."""
        
        chunk_ctx = f" (chunk {chunk_num}/{total_chunks})" if total_chunks > 1 else ""
        
        prompt = f"""Analyze this code and extract ALL API endpoint calls — every fetch(), POST, GET, PUT, DELETE, EventSource, XMLHttpRequest, axios call, or any HTTP request.

FILE: {file_path}{chunk_ctx}

```{file_type}
{content}
```

Look for ALL of these patterns:
- fetch(url) or fetch(url, {{ method: ... }})
- axios.get/post/put/delete(url)
- XMLHttpRequest: actual calls like xhr.open('GET', url) — NOT prototype patching
- EventSource(url)
- $.ajax, $.get, $.post
- Any HTTP client call

IGNORE these — they are NOT endpoint calls:
- Prototype monkey-patching
- Saving fetch references
- Re-assigning fetch

Return a JSON object:
{{
    "endpoints": [
        {{
            "line_number": <integer or 0 if unclear>,
            "method": "GET|POST|PUT|DELETE|PATCH|SSE",
            "url": "<the URL or path pattern, preserving variables>",
            "request_payload": "<what data is sent, or null>",
            "expected_response": "<what response is used for, or null>",
            "function_name": "<containing function, or null>",
            "context": "<what this call does>",
            "notes": "<headers, auth, error handling>"
        }}
    ],
    "imports": [],
    "api_clients": []
}}

Return ONLY valid JSON. No markdown fences. No extra text."""

        max_retries = 4
        for attempt in range(max_retries):
            try:
                request_params: dict[str, Any] = {
                    "model": self.model,
                    "max_tokens": 2048,
                    "messages": [{"role": "user", "content": prompt}],
                }
                response = self.client.chat.completions.create(**request_params)
                result_text = response.choices[0].message.content.strip()
                result_text = re.sub(r'^```(?:json)?\s*', '', result_text)
                result_text = re.sub(r'\s*```$', '', result_text)
                return json.loads(result_text)
            except json.JSONDecodeError as e:
                print(f"    ⚠ JSON parse error (chunk {chunk_num}): {e}")
                return {"endpoints": [], "imports": [], "api_clients": []}
            except Exception as e:
                err_str = str(e)
                if '429' in err_str and attempt < max_retries - 1:
                    wait = 20 * (attempt + 1)
                    print(f"    ⏳ Rate limited — waiting {wait}s (retry {attempt + 2}/{max_retries})…")
                    time.sleep(wait)
                else:
                    print(f"    ⚠ Error (chunk {chunk_num}): {e}")
                    return {"endpoints": [], "imports": [], "api_clients": []}
        return {"endpoints": [], "imports": [], "api_clients": []}

    def analyze_file(self, file_path: str, content: str) -> FileAnalysis:
        """Analyze a single file for API endpoints, chunking large files."""
        
        file_ext = Path(file_path).suffix.lower()
        file_type = {
            '.html': 'html', '.js': 'js', '.jsx': 'jsx',
            '.ts': 'ts', '.tsx': 'tsx', '.vue': 'vue',
            '.mjs': 'js', '.cjs': 'js'
        }.get(file_ext, 'unknown')

        if file_type == 'html':
            content = self._extract_js_from_html(content)

        chunks = self._chunk_content(content)
        total_chunks = len(chunks)
        
        if total_chunks > 1:
            print(f"           📦 {len(content):,} chars JS → {total_chunks} chunks")

        all_endpoints: list[APIEndpoint] = []
        all_imports: list[str] = []
        all_clients: list[str] = []

        for i, chunk in enumerate(chunks, 1):
            if total_chunks > 1:
                print(f"           🔍 chunk {i}/{total_chunks}…", end=" ", flush=True)
            
            result = self._analyze_chunk(file_path, file_type, chunk, i, total_chunks)
            chunk_eps = result.get("endpoints", [])
            if total_chunks > 1:
                print(f"{len(chunk_eps)} endpoint(s)")
            
            for ep in chunk_eps:
                all_endpoints.append(APIEndpoint(
                    file_path=file_path,
                    line_number=ep.get("line_number") or 0,
                    method=ep.get("method") or "UNKNOWN",
                    url=_normalize_llm_url(ep.get("url") or "(unknown)"),
                    request_payload=ep.get("request_payload"),
                    expected_response=ep.get("expected_response"),
                    function_name=ep.get("function_name"),
                    context=ep.get("context") or "",
                    notes=ep.get("notes") or ""
                ))
            
            all_imports.extend(result.get("imports", []))
            all_clients.extend(result.get("api_clients", []))
            if i < total_chunks:
                time.sleep(3)

        # Deduplicate
        seen = set()
        unique_endpoints = []
        for ep in all_endpoints:
            key = (ep.method, ep.url)
            if key not in seen:
                seen.add(key)
                unique_endpoints.append(ep)

        def _flatten(items):
            out = set()
            for item in items:
                if isinstance(item, dict):
                    out.update(str(v) for v in item.values())
                elif isinstance(item, list):
                    out.update(str(v) for v in item)
                else:
                    out.add(str(item))
            return sorted(out)

        return FileAnalysis(
            file_path=file_path,
            file_type=file_type,
            endpoints=unique_endpoints,
            imports=_flatten(all_imports),
            api_clients=_flatten(all_clients)
        )


# ─────────────────────────────────────────────────────────────────────────────
# File Scanner
# ─────────────────────────────────────────────────────────────────────────────

class FileScanner:
    """Scans directories for HTML/JS files."""
    
    SUPPORTED_EXTENSIONS = {'.html', '.js', '.jsx', '.ts', '.tsx', '.vue', '.mjs', '.cjs'}
    IGNORE_DIRS = {
        'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor',
        '.venv', 'venv', 'env', '.env', 'site-packages', 'dist-packages',
        '.mypy_cache', '.pytest_cache', '.ruff_cache', '.tox', '.nox',
        '.idea', '.vscode'
    }
    # Skip self-referencing registry file to avoid circular meta-endpoints
    IGNORE_FILES = {'agent-functions-registry.js'}

    @staticmethod
    def _resolve_include_dirs(root_path: Path, include_dirs: Optional[list[str]]) -> list[Path]:
        includes: list[Path] = []
        for raw in include_dirs or []:
            raw = (raw or "").strip()
            if not raw:
                continue
            candidate = Path(raw)
            if not candidate.is_absolute():
                candidate = (root_path / candidate)
            includes.append(candidate.resolve())
        return includes

    @staticmethod
    def _is_within(path: Path, prefixes: list[Path]) -> bool:
        for prefix in prefixes:
            try:
                path.relative_to(prefix)
                return True
            except ValueError:
                continue
        return False
    
    @classmethod
    def scan(
        cls,
        directory: str,
        include_dirs: Optional[list[str]] = None,
        extra_ignore_dirs: Optional[list[str]] = None,
    ) -> list[tuple[str, str]]:
        """Scan directory and return list of (file_path, content) tuples."""
        files = []
        root_path = Path(directory)
        ignore_dirs = set(cls.IGNORE_DIRS)
        ignore_dirs.update({d.strip() for d in (extra_ignore_dirs or []) if d and d.strip()})
        include_prefixes = cls._resolve_include_dirs(root_path, include_dirs)
        
        for path in root_path.rglob('*'):
            if any(ignored in path.parts for ignored in ignore_dirs):
                continue
            if path.name in cls.IGNORE_FILES:
                continue
            if include_prefixes and not cls._is_within(path.resolve(), include_prefixes):
                continue
            if path.is_file() and path.suffix.lower() in cls.SUPPORTED_EXTENSIONS:
                try:
                    content = path.read_text(encoding='utf-8', errors='ignore')
                    if len(content) > 50:
                        files.append((str(path), content))
                except Exception as e:
                    print(f"  ⚠ Could not read {path}: {e}")
        return files


# ─────────────────────────────────────────────────────────────────────────────
# Test Report Parser
# ─────────────────────────────────────────────────────────────────────────────

class TestReportParser:
    """
    Parses a Markdown endpoint test report (FRONTEND_ENDPOINT_REPORT.md format)
    into structured EndpointTestResult objects.

    Expected table columns (in order):
        Status | Feature | JS Source | Declared | Probed | Endpoint | ms | Notes
    """

    STATUS_MAP = {
        "✅": "ok",
        "🟡": "reachable",
        "❌": "not_found",
        "⏱️": "timeout",
        "🔴": "offline",
    }

    # Actionable fix templates keyed by status (or "reachable_NNN" for specific codes)
    _FIX_TEMPLATES: dict[str, str] = {
        "not_found":      "Route not found (404). Verify the URL path is correct and that "
                          "the route is registered in the backend API server.",
        "timeout":        "Backend service timed out. Check that the service is running on "
                          "the expected port and that no firewall/network issue is blocking it.",
        "offline":        "Backend service appears offline. Start the server process and "
                          "confirm the correct port is configured.",
        "untested":       "Endpoint was not probed yet. Run api audit/probe to validate runtime behavior.",
        "reachable_422":  "Route exists but rejected with 422 (Unprocessable Entity). "
                          "Verify required body fields, query parameters, and content-type headers.",
        "reachable_405":  "Route exists but returned 405 (Method Not Allowed). Production "
                          "callers must use the correct HTTP method (often POST). Confirm the "
                          "method in source matches the API spec.",
        "reachable_400":  "Route exists but returned 400 (Bad Request). Check required "
                          "query parameters or request body structure.",
        "reachable_401":  "Route exists but requires authentication (401). Ensure a valid "
                          "auth token / header is included in the request.",
        "reachable_403":  "Route exists but access is forbidden (403). Check user permissions "
                          "and API key scopes.",
        "reachable_4xx":  "Route exists but returned a client error. Review required "
                          "parameters and authentication requirements.",
        "ok":             "",
    }

    @classmethod
    def _parse_status(cls, cell: str) -> tuple[str, Optional[int]]:
        """Return (status_str, http_code) from a cell like '✅ OK' or '🟡 REACHABLE (422)'."""
        status = "unknown"
        http_code = None
        for icon, name in cls.STATUS_MAP.items():
            if icon in cell:
                status = name
                break
        m = re.search(r'\((\d{3})\)', cell)
        if m:
            http_code = int(m.group(1))
        return status, http_code

    @classmethod
    def fix_suggestion(cls, status: str, http_code: Optional[int]) -> str:
        """Return an actionable fix string for a given test result."""
        if status == "ok":
            return ""
        if status == "reachable" and http_code:
            key = f"reachable_{http_code}"
            if key in cls._FIX_TEMPLATES:
                return cls._FIX_TEMPLATES[key]
            return cls._FIX_TEMPLATES.get("reachable_4xx", "")
        return cls._FIX_TEMPLATES.get(status, "Review the endpoint — status unknown.")

    @classmethod
    def parse(cls, report_path: Path) -> list[EndpointTestResult]:
        """Parse a markdown test-report file into EndpointTestResult objects."""
        text = report_path.read_text(encoding="utf-8", errors="ignore")
        results: list[EndpointTestResult] = []
        current_section = "General"

        for line in text.splitlines():
            if line.startswith("## "):
                current_section = line[3:].strip()
                continue
            if not line.startswith("|"):
                continue
            if re.match(r'^\|[-| :]+\|$', line.strip()):
                continue

            cells = [c.strip() for c in line.split("|")]
            cells = [c for c in cells if c != ""]
            # Need at least: Status, Feature, JS Source, Declared, Probed, Endpoint
            if len(cells) < 6:
                continue

            status_cell = cells[0]
            if not any(icon in status_cell for icon in cls.STATUS_MAP):
                continue

            status, http_code = cls._parse_status(status_cell)
            feature     = cells[1] if len(cells) > 1 else ""
            source_ref  = cells[2] if len(cells) > 2 else ""
            declared    = cells[3] if len(cells) > 3 else ""
            probed      = cells[4] if len(cells) > 4 else ""
            endpoint    = cells[5] if len(cells) > 5 else ""
            latency_str = cells[6] if len(cells) > 6 else ""
            notes       = cells[7] if len(cells) > 7 else ""

            lat_m = re.search(r'(\d+)', latency_str)
            latency_ms = int(lat_m.group(1)) if lat_m else None

            endpoint = endpoint.strip('`').strip()
            results.append(EndpointTestResult(
                url=endpoint,
                method_declared=declared.strip(),
                method_probed=probed.strip(),
                status=status,
                http_code=http_code,
                feature=feature.strip(),
                source_ref=source_ref.strip(),
                latency_ms=latency_ms,
                notes=notes.strip(),
                section=current_section,
            ))

        return results

    @staticmethod
    def _normalize_url(url: str) -> str:
        """Strip scheme+host and query string; normalise path params to {param}."""
        path = re.sub(r'^https?://[^/]+', '', url)
        path = path.split('?')[0].rstrip('/')
        path = re.sub(r'\$\{[^}]+\}', '{param}', path)
        path = re.sub(r':[a-zA-Z_]\w*(?=/|$)', '{param}', path)
        # collapse numeric IDs like /1 or /42
        path = re.sub(r'/\d+(?=/|$)', '/{param}', path)
        return path

    @classmethod
    def build_lookup(cls, results: list[EndpointTestResult]) -> dict[str, EndpointTestResult]:
        """
        Build a lookup dict.  Primary key: 'METHOD:normalised_path'.
        Secondary key: 'normalised_path' alone (method-agnostic fallback).
        Later entries overwrite earlier ones for the same key.
        """
        lookup: dict[str, EndpointTestResult] = {}
        for r in results:
            path = cls._normalize_url(r.url)
            lookup[f"{r.method_declared.upper()}:{path}"] = r
            lookup[path] = r
        return lookup


class AuditCatalogParser:
    """Parse structured endpoint catalog emitted by test-all-apis.py."""

    @staticmethod
    def _map_status(item: dict[str, Any]) -> tuple[str, Optional[int], str]:
        code = item.get("status_code")
        classification = item.get("classification") or {}
        category = classification.get("category", "")
        probe_mode = item.get("probe_mode", "")
        skip_reason = item.get("skip_reason") or ""

        if item.get("ok") is True:
            return "ok", code, ""
        if probe_mode == "skipped":
            note = f"Skipped by auditor: {skip_reason}" if skip_reason else "Skipped by auditor"
            return "untested", code, note

        if category == "missing_or_unmapped":
            return "not_found", code, "Route appears missing or not mapped"
        if category in {"timeout", "network_error"}:
            return "timeout", code, "Endpoint timed out or network failed"
        if category == "dependency_unavailable":
            return "offline", code, "Dependency unavailable while serving endpoint"

        return "reachable", code, f"Probe returned category={category or 'unknown'}"

    @classmethod
    def parse(cls, catalog_path: Path) -> list[EndpointTestResult]:
        if not catalog_path.exists():
            return []
        try:
            raw = json.loads(catalog_path.read_text(encoding="utf-8"))
        except Exception:
            return []

        if not isinstance(raw, list):
            return []

        results: list[EndpointTestResult] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            method = str(item.get("method") or "GET").upper()
            path = str(item.get("path") or "").strip() or "/"
            if not path.startswith("/"):
                path = f"/{path}"
            status, code, note = cls._map_status(item)
            source_ref = f"{item.get('service', 'service')}:{path}"
            results.append(
                EndpointTestResult(
                    url=path,
                    method_declared=method,
                    method_probed=method,
                    status=status,
                    http_code=code,
                    feature=str(item.get("summary") or ""),
                    source_ref=source_ref,
                    latency_ms=None,
                    notes=note,
                    section=str(item.get("service") or "service"),
                )
            )
        return results


class ServiceEndpointMapper:
    """Discover service endpoints from live OpenAPI specs and static service-map registry."""

    def __init__(
        self,
        timeout: float,
        runtime_port_file: Path,
        service_filter: Optional[set[str]] = None,
        service_map_path: Optional[Path] = None,
    ):
        self.timeout = timeout
        self.runtime_port_file = runtime_port_file
        self.service_filter = service_filter
        self.service_map_path = service_map_path

    def _http_get_json(self, url: str) -> Optional[dict[str, Any]]:
        req = urllib_request.Request(url=url, method="GET", headers={"User-Agent": "endpoint-mapper/1.0"})
        try:
            with urllib_request.urlopen(req, timeout=self.timeout) as resp:
                if resp.getcode() != 200:
                    return None
                raw = resp.read().decode("utf-8", errors="replace")
                data = json.loads(raw)
                return data if isinstance(data, dict) else None
        except (urllib_error.HTTPError, urllib_error.URLError, TimeoutError, json.JSONDecodeError):
            return None

    def _discover_openapi(self, base_url: str) -> Optional[dict[str, Any]]:
        for candidate in OPENAPI_CANDIDATES:
            spec = self._http_get_json(f"{base_url}{candidate}")
            if spec and isinstance(spec.get("paths"), dict):
                return spec
        return None

    @staticmethod
    def _params_by_in(op: dict[str, Any], in_name: str) -> list[dict[str, Any]]:
        params = []
        for p in op.get("parameters", []) or []:
            if isinstance(p, dict) and p.get("in") == in_name:
                params.append(p)
        return params

    @staticmethod
    def _type_from_schema(schema: dict[str, Any]) -> str:
        if not isinstance(schema, dict):
            return "string"
        if schema.get("type"):
            return str(schema["type"])
        if "$ref" in schema:
            return str(schema["$ref"]).split("/")[-1]
        if "anyOf" in schema:
            return "anyOf"
        if "oneOf" in schema:
            return "oneOf"
        return "object"

    @classmethod
    def _param_to_agent_hint(cls, param: dict[str, Any], kind: str) -> dict[str, Any]:
        schema = param.get("schema") if isinstance(param, dict) else {}
        return {
            "name": str(param.get("name") or "param"),
            "type": cls._type_from_schema(schema if isinstance(schema, dict) else {}),
            "required": bool(param.get("required")),
            "description": str(param.get("description") or f"{kind} parameter"),
        }

    @classmethod
    def _request_summary(cls, op: dict[str, Any]) -> tuple[Optional[str], Optional[dict[str, Any]]]:
        rb = op.get("requestBody")
        if not isinstance(rb, dict):
            return None, None
        content = rb.get("content") or {}
        if not isinstance(content, dict) or not content:
            return "requestBody present", None
        ctype = next(iter(content.keys()))
        schema = content.get(ctype, {}).get("schema") if isinstance(content.get(ctype), dict) else None
        if isinstance(schema, dict):
            schema_type = cls._type_from_schema(schema)
            return f"{ctype} body ({schema_type})", schema
        return f"{ctype} body", None

    @staticmethod
    def _response_summary(op: dict[str, Any]) -> str:
        responses = op.get("responses") if isinstance(op, dict) else {}
        if not isinstance(responses, dict) or not responses:
            return ""
        best = responses.get("200") or responses.get("201") or responses.get("default") or next(iter(responses.values()))
        if isinstance(best, dict):
            desc = str(best.get("description") or "")
            content = best.get("content") or {}
            if isinstance(content, dict) and content:
                ctype = next(iter(content.keys()))
                return f"{ctype} response{(': ' + desc) if desc else ''}".strip()
            return desc
        return ""

    @staticmethod
    def _response_schema(op: dict[str, Any]) -> Optional[dict[str, Any]]:
        responses = op.get("responses") if isinstance(op, dict) else {}
        if not isinstance(responses, dict) or not responses:
            return None
        best = responses.get("200") or responses.get("201") or responses.get("default") or next(iter(responses.values()))
        if not isinstance(best, dict):
            return None
        content = best.get("content") or {}
        if not isinstance(content, dict) or not content:
            return None
        ctype = next(iter(content.keys()))
        schema = content.get(ctype, {}).get("schema") if isinstance(content.get(ctype), dict) else None
        return schema if isinstance(schema, dict) else None

    def _build_from_openapi(self, service_name: str, spec: dict[str, Any]) -> FileAnalysis:
        endpoints: list[APIEndpoint] = []
        paths = spec.get("paths") or {}
        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue
            for method, op in methods.items():
                if not isinstance(op, dict):
                    continue
                method_u = str(method).upper()
                path_params = [self._param_to_agent_hint(p, "path") for p in self._params_by_in(op, "path")]
                query_params = [self._param_to_agent_hint(p, "query") for p in self._params_by_in(op, "query")]

                url = path if path.startswith("/") else f"/{path}"
                if query_params:
                    qp = "&".join(f"{p['name']}={{{p['name']}}}" for p in query_params)
                    url = f"{url}?{qp}"

                req_summary, _req_schema = self._request_summary(op)
                expected_response = self._response_summary(op)
                response_schema = self._response_schema(op)

                notes_parts = []
                tags = op.get("tags") or []
                if tags:
                    notes_parts.append("tags=" + ",".join(str(t) for t in tags))

                endpoints.append(
                    APIEndpoint(
                        file_path=f"service:{service_name}:openapi",
                        line_number=0,
                        method=method_u,
                        url=url,
                        request_payload=req_summary,
                        expected_response=expected_response,
                        context=str(op.get("summary") or op.get("description") or f"{method_u} {path}"),
                        function_name=str(op.get("operationId") or ""),
                        notes="; ".join(notes_parts),
                        path_params=path_params,
                        query_params=query_params,
                        response_schema_data=response_schema,
                    )
                )

        return FileAnalysis(
            file_path=f"service:{service_name}:openapi",
            file_type="openapi",
            endpoints=endpoints,
            imports=["openapi"],
            api_clients=["http"],
        )

    def _build_from_service_map(self) -> Optional[FileAnalysis]:
        if not self.service_map_path or not self.service_map_path.exists():
            return None
        try:
            data = json.loads(self.service_map_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        services = data.get("services") if isinstance(data, dict) else None
        if not isinstance(services, dict):
            return None

        endpoints: list[APIEndpoint] = []
        for svc_name, svc_data in services.items():
            if not isinstance(svc_data, dict):
                continue
            items = svc_data.get("endpoints") or []
            for item in items:
                if not isinstance(item, dict):
                    continue
                method = str(item.get("method") or "GET").upper()
                path = str(item.get("path") or "").strip()
                if not path:
                    continue
                if not path.startswith("/"):
                    path = f"/{path}"
                endpoints.append(
                    APIEndpoint(
                        file_path=f"service-map:{svc_name}",
                        line_number=0,
                        method=method,
                        url=path,
                        request_payload=None,
                        expected_response=None,
                        context=str(item.get("description") or svc_data.get("description") or ""),
                        function_name=str(item.get("operationId") or ""),
                        notes=f"backend_path={item.get('backend_path', '')}",
                    )
                )

        return FileAnalysis(
            file_path="service-map.json",
            file_type="json",
            endpoints=endpoints,
            imports=["service-map"],
            api_clients=["gateway"],
        )

    @staticmethod
    def _dedupe_file_analysis(fa: FileAnalysis) -> FileAnalysis:
        seen = set()
        unique = []
        for ep in fa.endpoints:
            key = (ep.method.upper(), ep.url)
            if key in seen:
                continue
            seen.add(key)
            unique.append(ep)
        fa.endpoints = unique
        return fa

    def discover(self) -> list[FileAnalysis]:
        analyses: list[FileAnalysis] = []
        targets = _resolve_service_targets(self.runtime_port_file, self.service_filter)
        for svc in targets:
            name = str(svc["name"])
            base_url = str(svc["base_url"]).rstrip("/")
            spec = self._discover_openapi(base_url)
            if not spec:
                continue
            fa = self._build_from_openapi(name, spec)
            analyses.append(self._dedupe_file_analysis(fa))

        service_map_fa = self._build_from_service_map()
        if service_map_fa:
            analyses.append(self._dedupe_file_analysis(service_map_fa))

        return analyses


# ─────────────────────────────────────────────────────────────────────────────
# Agent Functions Generator
# ─────────────────────────────────────────────────────────────────────────────

class AgentFunctionsGenerator:
    """
    Generates agent-optimized function documentation from extracted endpoints.
    Creates individual JSON files for each function and a master index.
    """
    
    def __init__(self, test_lookup: Optional[dict] = None):
        self.functions: list[AgentFunction] = []
        self._test_lookup: dict = test_lookup or {}
    
    @staticmethod
    def _generate_id(method: str, url: str) -> str:
        """Generate a stable unique ID for an endpoint."""
        raw = f"{method}:{url}"
        return hashlib.sha256(raw.encode()).hexdigest()[:12]
    
    @staticmethod
    def _extract_path_params(url: str) -> list[dict]:
        """Extract path parameters from URL pattern."""
        params = []
        patterns = re.findall(r'\$\{([^}]+)\}|:(\w+)|\{(\w+)\}', url)
        for match in patterns:
            param_name = match[0] or match[1] or match[2]
            param_name = re.sub(r'^encodeURIComponent\(([^)]+)\)$', r'\1', param_name)
            param_name = re.sub(r'\.value$', '', param_name)
            params.append({
                "name": param_name,
                "type": "string",
                "required": True,
                "description": f"Path parameter: {param_name}"
            })
        return params
    
    @staticmethod
    def _extract_query_params(url: str) -> list[dict]:
        """Extract query parameters from URL pattern."""
        params = []
        if '?' in url:
            query_part = url.split('?', 1)[1]
            matches = re.findall(r'(\w+)=(?:\$\{([^}]+)\}|([^&]+))', query_part)
            for match in matches:
                param_name = match[0]
                params.append({
                    "name": param_name,
                    "type": "string",
                    "required": True,
                    "description": f"Query parameter: {param_name}"
                })
        return params
    
    @staticmethod
    def _categorize_endpoint(method: str, url: str, context: str) -> str:
        """Categorize endpoint by its purpose."""
        url_lower = url.lower()
        context_lower = context.lower()

        # ── Olivia-specific route patterns (checked first) ─────────────────
        if any(kw in url_lower for kw in ['/api/agents', '/agents/', '/api/agent/']):
            return "agent_control"
        if any(kw in url_lower for kw in ['/api/memory', '/memory/', 'qdrant', 'collection', 'vector']):
            return "memory"
        if any(kw in url_lower for kw in ['/api/bridge', '/bridge/', 'ingest', 'upload', 'import']):
            return "data_ingestion"
        if any(kw in url_lower for kw in ['/api/discovery', '/discovery/', '/api/disc']):
            return "discovery"
        if any(kw in url_lower for kw in ['/api/spaces', '/spaces/']):
            return "spaces"
        if any(kw in url_lower for kw in ['/api/shared', '/shared/']):
            return "crud_read"
        if any(kw in url_lower for kw in ['/api/docs', '/docs/']):
            return "crud_read"
        if any(kw in url_lower for kw in ['/api/assistant', '/chat', 'completion', 'assistant']):
            return "ai"

        # ── Generic patterns ───────────────────────────────────────────────
        if any(kw in url_lower for kw in ['search', 'query', 'find']):
            return "search"
        if any(kw in url_lower for kw in ['health', 'status', 'telemetry', 'cluster']):
            return "system"
        if any(kw in url_lower for kw in ['snapshot', 'backup']):
            return "backup"
        if any(kw in url_lower for kw in ['alias']):
            return "alias"
        if any(kw in url_lower for kw in ['lock']):
            return "locking"

        if method == "POST" and "create" in context_lower:
            return "crud_create"
        if method == "DELETE":
            return "crud_delete"
        if method == "PUT" or method == "PATCH":
            return "crud_update"
        if method == "GET":
            if "list" in context_lower or url.endswith('s'):
                return "crud_list"
            return "crud_read"
        if method == "POST":
            return "crud_create"

        return "general"
    
    @staticmethod
    def _derive_function_name(endpoint: APIEndpoint) -> str:
        """Derive a clean function name from endpoint data."""
        if endpoint.function_name and endpoint.function_name != "null":
            name = endpoint.function_name
            name = re.sub(r'\(.*\)', '', name)
            name = re.sub(r'^async\s+', '', name)
            name = name.strip()
            if name:
                return name
        
        url = endpoint.url
        url = re.sub(r'\$\{[^}]+\}', '', url)
        url = re.sub(r':[^/]+', '', url)
        url = re.sub(r'\?.*$', '', url)
        
        parts = [p for p in url.split('/') if p and p not in ['api', 'v1', 'v2']]
        if parts:
            name = '_'.join(parts[-2:])
            name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
            return f"{endpoint.method.lower()}_{name}"
        
        return f"{endpoint.method.lower()}_endpoint"
    
    @staticmethod
    def _parse_body_schema(payload: Optional[str]) -> Optional[dict]:
        """Parse request payload into a schema description."""
        if not payload:
            return None
        
        payload_lower = payload.lower()
        
        if 'formdata' in payload_lower:
            fields = []
            if 'file' in payload_lower:
                fields.append({"name": "file", "type": "File", "description": "File to upload"})
            if 'files' in payload_lower:
                fields.append({"name": "files", "type": "File[]", "description": "Multiple files to upload"})
            if 'metadata' in payload_lower:
                fields.append({"name": "metadata", "type": "JSON", "description": "Metadata object"})
            return {"type": "FormData", "fields": fields} if fields else {"type": "FormData", "description": payload}
        
        if 'json' in payload_lower or '{' in payload:
            return {"type": "JSON", "description": payload}
        
        return {"type": "unknown", "description": payload}
    
    @staticmethod
    def _extract_headers(notes: str) -> list[dict]:
        """Extract header information from notes."""
        headers = []
        notes_lower = notes.lower()
        
        if 'content-type: application/json' in notes_lower or 'application/json' in notes_lower:
            headers.append({"name": "Content-Type", "value": "application/json"})
        if 'auth' in notes_lower:
            headers.append({"name": "Authorization", "value": "Bearer <token>", "required": True})
        
        return headers
    
    @staticmethod
    def _infer_response_type(url: str, method: str, response: Optional[str]) -> str:
        """Infer the response type."""
        if 'sse' in url.lower() or method == 'SSE':
            return "stream"
        if 'download' in url.lower() or 'snapshot' in url.lower():
            return "binary"
        return "json"
    
    @staticmethod
    def _derive_use_cases(method: str, url: str, context: str, category: str) -> list[str]:
        """Generate use case descriptions."""
        use_cases = []
        
        if category == "crud_create":
            use_cases.append("Create a new resource")
        elif category == "crud_read":
            use_cases.append("Retrieve resource details")
        elif category == "crud_list":
            use_cases.append("List all resources of this type")
        elif category == "crud_delete":
            use_cases.append("Remove a resource permanently")
        elif category == "crud_update":
            use_cases.append("Modify existing resource")
        elif category == "search":
            use_cases.append("Find resources matching criteria")
        elif category == "data_ingestion":
            use_cases.append("Import or upload data")
        elif category == "system":
            use_cases.append("Check system health or status")
        elif category == "ai":
            use_cases.append("Get AI-powered responses")
        
        if context:
            use_cases.append(context)
        
        return use_cases
    
    @staticmethod
    def _derive_capabilities(method: str, url: str, category: str) -> list[str]:
        """Derive what capabilities this function provides."""
        caps = []
        url_lower = url.lower()

        if category.startswith("crud_"):
            caps.append(f"Provides {category.replace('crud_', '')} operations")

        # ── Domain-specific (vector / AI) ──────────────────────────────────
        if 'collection' in url_lower or 'vector' in url_lower:
            caps.append("Manages vector collections")
        # Use word-boundary check so "points" in a Qdrant URL matches but "endpoint" / "encodeURIComponent" don't
        if re.search(r'/points?(?:/|$)', url_lower):
            caps.append("Manipulates data points/vectors")
        if 'search' in url_lower or 'query' in url_lower:
            caps.append("Enables semantic/vector search")
        if 'ingest' in url_lower or 'upload' in url_lower:
            caps.append("Bulk data import capability")
        if 'assistant' in url_lower or 'chat' in url_lower or 'completion' in url_lower:
            caps.append("Conversational AI interaction")
        # Explicitly mark AI analysis / streaming AI endpoints
        if category == 'ai' and 'Conversational AI interaction' not in caps:
            caps.append("Conversational AI interaction")

        # ── Olivia-specific ────────────────────────────────────────────────
        if 'agent' in url_lower:
            caps.append("Agent lifecycle management")
        if 'memory' in url_lower:
            caps.append("Persistent memory access")
        if 'bridge' in url_lower or 'discovery' in url_lower:
            caps.append("Service discovery and bridging")
        if 'stream' in url_lower or 'sse' in url_lower or category == 'ai':
            caps.append("Real-time streaming output")
        if 'docs' in url_lower or 'document' in url_lower:
            caps.append("Document access and retrieval")
        if 'space' in url_lower:
            caps.append("Workspace / space management")
        if 'shared' in url_lower:
            caps.append("Shared resource access")

        # ── Method-based fallback ──────────────────────────────────────────
        if not caps:
            if method == 'GET':
                caps.append("Data retrieval")
            elif method == 'POST':
                caps.append("Resource creation or action execution")
            elif method in ('PUT', 'PATCH'):
                caps.append("Resource modification")
            elif method == 'DELETE':
                caps.append("Resource deletion")
            else:
                caps.append("API operation")

        return caps
    
    def generate_from_analysis(self, analysis: ProjectAnalysis) -> list[AgentFunction]:
        """Convert project analysis into agent functions."""
        
        all_endpoints = []
        for fa in analysis.files:
            all_endpoints.extend(fa.endpoints)
        
        seen = {}
        for ep in all_endpoints:
            key = (ep.method, ep.url)
            if key not in seen:
                seen[key] = ep
        
        functions = []
        for (method, url), ep in seen.items():
            func_id = self._generate_id(method, url)
            func_name = self._derive_function_name(ep)
            category = self._categorize_endpoint(method, url, ep.context)
            
            func = AgentFunction(
                id=func_id,
                name=func_name,
                method=method,
                url_pattern=url,
                description=ep.context or f"{method} request to {url}",
                category=category,
                path_params=ep.path_params or self._extract_path_params(url),
                query_params=ep.query_params or self._extract_query_params(url),
                body_schema=self._parse_body_schema(ep.request_payload),
                headers=self._extract_headers(ep.notes),
                response_type=self._infer_response_type(url, method, ep.expected_response),
                response_schema=ep.response_schema_data or ({"description": ep.expected_response} if ep.expected_response else None),
                success_indicators=["response.ok", "status 200-299"],
                error_handling=ep.notes if 'error' in (ep.notes or '').lower() else "",
                prerequisites=[],
                related_functions=[],
                supersedes=[],
                use_cases=self._derive_use_cases(method, url, ep.context, category),
                capabilities=self._derive_capabilities(method, url, category),
                limitations=[],
                source_file=ep.file_path,
                source_function=ep.function_name,
                confidence=0.9 if ep.function_name else 0.7
            )
            functions.append(func)
        
        self._apply_test_results(functions)
        functions = self._find_relationships(functions)
        self._validate_functions(functions)
        self.functions = functions
        return functions

    def _apply_test_results(self, functions: list[AgentFunction]) -> None:
        """Enrich functions with test results from a probe report, if available."""
        if not self._test_lookup:
            return
        for func in functions:
            path = TestReportParser._normalize_url(func.url_pattern)
            result = (
                self._test_lookup.get(f"{func.method.upper()}:{path}")
                or self._test_lookup.get(path)
            )
            if result:
                func.test_status     = result.status
                func.test_http_code  = result.http_code
                func.test_notes      = result.notes
                func.test_source_ref = result.source_ref
                func.fix_suggestion  = TestReportParser.fix_suggestion(result.status, result.http_code)

    def _find_relationships(self, functions: list[AgentFunction]) -> list[AgentFunction]:
        """Identify relationships between functions."""
        
        by_resource = {}
        for func in functions:
            url = func.url_pattern
            url = re.sub(r'\$\{[^}]+\}', '{param}', url)
            url = re.sub(r':[^/]+', '{param}', url)
            parts = [p for p in url.split('/') if p and p not in ['api', 'v1', 'v2', '{param}']]
            resource = parts[0] if parts else 'unknown'
            
            if resource not in by_resource:
                by_resource[resource] = []
            by_resource[resource].append(func)
        
        for resource, funcs in by_resource.items():
            func_ids = [f.id for f in funcs]
            
            for func in funcs:
                func.related_functions = [fid for fid in func_ids if fid != func.id]
                
                if func.method in ['DELETE', 'PUT', 'PATCH']:
                    list_funcs = [f for f in funcs if f.method == 'GET' and f.category == 'crud_list']
                    func.prerequisites = [f.id for f in list_funcs]
                
                if func.method == 'GET' and func.category == 'crud_read':
                    list_funcs = [f for f in funcs if f.method == 'GET' and f.category == 'crud_list']
                    create_funcs = [f for f in funcs if f.method == 'POST' and f.category == 'crud_create']
                    func.prerequisites = [f.id for f in (list_funcs + create_funcs)]
        
        return functions
    
    def write_to_directory(self, output_dir: Path, project_name: str = "") -> Path:
        """Write agent functions to a directory structure."""
        
        funcs_dir = output_dir / "agent_functions"
        funcs_dir.mkdir(parents=True, exist_ok=True)
        
        individual_dir = funcs_dir / "functions"
        individual_dir.mkdir(exist_ok=True)
        
        for func in self.functions:
            func_path = individual_dir / f"{func.id}_{func.name}.json"
            func_data = asdict(func)
            # Always include test_status so consumers never get undefined
            if "test_status" not in func_data or func_data["test_status"] is None:
                func_data.setdefault("test_status", None)
                func_data.setdefault("test_http_code", None)
                func_data.setdefault("fix_suggestion", None)
            func_path.write_text(json.dumps(func_data, indent=2))
        
        index = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_project": project_name or output_dir.name,
            "total_functions": len(self.functions),
            "categories": {},
            "functions": []
        }
        
        for func in self.functions:
            if func.category not in index["categories"]:
                index["categories"][func.category] = []
            index["categories"][func.category].append({
                "id": func.id,
                "name": func.name,
                "method": func.method,
                "url": func.url_pattern
            })
            
            entry = {
                "id": func.id,
                "name": func.name,
                "method": func.method,
                "url": func.url_pattern,
                "category": func.category,
                "description": func.description,
                "file": f"functions/{func.id}_{func.name}.json",
                "test_status": func.test_status or None,
                "agent_ready": func.agent_ready,
                "validation_score": func.validation_score,
            }
            if func.test_status and func.fix_suggestion:
                entry["fix_suggestion"] = func.fix_suggestion
            index["functions"].append(entry)
        
        index_path = funcs_dir / "index.json"
        index_path.write_text(json.dumps(index, indent=2))
        
        capability_map = {
            "by_capability": {},
            "by_use_case": {},
            "workflows": []
        }
        
        for func in self.functions:
            for cap in func.capabilities:
                if cap not in capability_map["by_capability"]:
                    capability_map["by_capability"][cap] = []
                capability_map["by_capability"][cap].append(func.id)
            
            for uc in func.use_cases:
                if uc not in capability_map["by_use_case"]:
                    capability_map["by_use_case"][uc] = []
                capability_map["by_use_case"][uc].append(func.id)
        
        capability_map["workflows"] = self._generate_workflows()
        
        cap_path = funcs_dir / "capability_map.json"
        cap_path.write_text(json.dumps(capability_map, indent=2))

        mcp_catalog_path = self._write_mcp_catalog(funcs_dir)
        mcp_ready_catalog_path = self._write_ready_mcp_catalog(funcs_dir)
        validation_path, ready_index_path = self._write_validation_artifacts(funcs_dir)
        
        readme = self._generate_agent_readme()
        readme_path = funcs_dir / "README.md"
        readme_path.write_text(readme)

        if self._test_lookup:
            self._write_triage_report(funcs_dir)

        print(f"   ✓ MCP Tools Catalog: {mcp_catalog_path}")
        print(f"   ✓ MCP Ready Catalog: {mcp_ready_catalog_path}")
        print(f"   ✓ Validation Report: {validation_path}")
        print(f"   ✓ Agent-Ready Index: {ready_index_path}")

        return funcs_dir
    
    def _generate_workflows(self) -> list[dict]:
        """Generate common workflow patterns."""
        workflows = []
        
        by_resource = {}
        for func in self.functions:
            url = func.url_pattern
            parts = [p for p in url.split('/') if p and not p.startswith('$') and not p.startswith(':')]
            parts = [p for p in parts if p not in ['api', 'v1', 'v2']]
            resource = parts[0] if parts else 'unknown'
            
            if resource not in by_resource:
                by_resource[resource] = {"create": [], "list": [], "read": [], "update": [], "delete": [], "search": [], "other": []}
            
            if func.category == 'crud_create':
                by_resource[resource]["create"].append(func.id)
            elif func.category == 'crud_list':
                by_resource[resource]["list"].append(func.id)
            elif func.category == 'crud_read':
                by_resource[resource]["read"].append(func.id)
            elif func.category == 'crud_update':
                by_resource[resource]["update"].append(func.id)
            elif func.category == 'crud_delete':
                by_resource[resource]["delete"].append(func.id)
            elif func.category == 'search':
                by_resource[resource]["search"].append(func.id)
            else:
                by_resource[resource]["other"].append(func.id)
        
        for resource, ops in by_resource.items():
            if resource == 'unknown':
                continue
            
            if ops["create"] and ops["list"]:
                raw_steps = [
                    {"action": "list",   "function_ids": ops["list"],   "description": "List existing items"},
                    {"action": "create", "function_ids": ops["create"], "description": "Create new item"},
                    {"action": "read",   "function_ids": ops["read"],   "description": "Read item details"},
                    {"action": "update", "function_ids": ops["update"], "description": "Modify item"},
                    {"action": "delete", "function_ids": ops["delete"], "description": "Remove item"},
                ]
                steps = [s for s in raw_steps if s["function_ids"]]
                if len(steps) >= 2:
                    workflows.append({
                        "name": f"{resource}_crud_workflow",
                        "description": f"Full CRUD operations for {resource}",
                        "steps": steps
                    })

            if ops["search"]:
                raw_steps = [
                    {"action": "list",   "function_ids": ops["list"],   "description": "Get available items"},
                    {"action": "search", "function_ids": ops["search"], "description": "Search with criteria"},
                ]
                steps = [s for s in raw_steps if s["function_ids"]]
                if len(steps) >= 2:
                    workflows.append({
                        "name": f"{resource}_search_workflow",
                        "description": f"Search and retrieve {resource}",
                        "steps": steps
                    })
        
        return workflows

    @staticmethod
    def _required_param_names(params: list[dict]) -> list[str]:
        names: list[str] = []
        for p in params:
            if not isinstance(p, dict):
                continue
            if p.get("required", False):
                name = str(p.get("name") or "").strip()
                if name:
                    names.append(name)
        return names

    @staticmethod
    def _required_headers(headers: list[dict]) -> list[str]:
        required: list[str] = []
        for h in headers:
            if not isinstance(h, dict):
                continue
            if h.get("required", False):
                name = str(h.get("name") or "").strip()
                if name:
                    required.append(name)
        return required

    @staticmethod
    def _body_required(func: AgentFunction) -> bool:
        return func.method.upper() in {"POST", "PUT", "PATCH"}

    @staticmethod
    def _response_defined(func: AgentFunction) -> bool:
        return isinstance(func.response_schema, dict) and bool(func.response_schema)

    def _evaluate_function_validation(self, func: AgentFunction) -> tuple[int, dict[str, bool], list[str], bool]:
        notes: list[str] = []
        required_path = self._required_param_names(func.path_params)
        required_query = self._required_param_names(func.query_params)
        required_headers = self._required_headers(func.headers)

        checks: dict[str, bool] = {
            "method_defined": bool(func.method and func.method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "SSE"}),
            "url_defined": bool(func.url_pattern and str(func.url_pattern).strip().startswith("/")),
            "parameters_defined": all(required_path + required_query),
            "body_defined_for_write": (not self._body_required(func)) or (func.body_schema is not None),
            "response_defined": self._response_defined(func),
            "tested": bool(func.test_status and func.test_status != "untested"),
            "working": func.test_status == "ok",
        }

        if not checks["method_defined"]:
            notes.append("Missing/invalid HTTP method")
        if not checks["url_defined"]:
            notes.append("Missing URL pattern")
        if not checks["parameters_defined"]:
            notes.append("Missing required parameter names")
        if not checks["body_defined_for_write"]:
            notes.append("Write endpoint missing request body schema")
        if not checks["response_defined"]:
            notes.append("Missing response schema/description")
        if not checks["tested"]:
            notes.append("Endpoint not runtime-tested")
        if checks["tested"] and not checks["working"]:
            notes.append(f"Runtime status is {func.test_status}")
        if required_headers:
            notes.append("Requires headers: " + ", ".join(required_headers))

        weights = {
            "method_defined": 10,
            "url_defined": 10,
            "parameters_defined": 20,
            "body_defined_for_write": 15,
            "response_defined": 15,
            "tested": 10,
            "working": 20,
        }
        score = sum(weights[k] for k, ok in checks.items() if ok)

        ready = (
            checks["method_defined"]
            and checks["url_defined"]
            and checks["parameters_defined"]
            and checks["body_defined_for_write"]
            and checks["response_defined"]
            and checks["working"]
        )

        return score, checks, notes, ready

    def _validate_functions(self, functions: list[AgentFunction]) -> None:
        for func in functions:
            score, checks, notes, ready = self._evaluate_function_validation(func)
            func.validation_score = score
            func.validation_checks = checks
            func.validation_notes = notes
            func.agent_ready = ready

    @staticmethod
    def _tool_name(func: AgentFunction) -> str:
        raw = f"{func.method.lower()}_{func.name}"
        return re.sub(r'[^a-zA-Z0-9_]', '_', raw).lower()

    @staticmethod
    def _build_mcp_input_schema(func: AgentFunction) -> dict[str, Any]:
        properties: dict[str, Any] = {}
        required: list[str] = []

        for p in func.path_params:
            name = p.get("name", "param")
            properties[name] = {
                "type": p.get("type", "string"),
                "description": p.get("description", "Path parameter"),
            }
            if p.get("required", True):
                required.append(name)

        for p in func.query_params:
            name = p.get("name", "query")
            properties[name] = {
                "type": p.get("type", "string"),
                "description": p.get("description", "Query parameter"),
            }
            if p.get("required", False):
                required.append(name)

        if func.body_schema:
            properties["body"] = {
                "type": "object",
                "description": "Request payload",
                "schema_hint": func.body_schema,
            }
            if func.method in {"POST", "PUT", "PATCH"}:
                required.append("body")

        if func.headers:
            properties["headers"] = {
                "type": "object",
                "description": "Optional headers override",
                "default": {h.get("name", "Header"): h.get("value", "") for h in func.headers},
            }

        schema: dict[str, Any] = {
            "type": "object",
            "properties": properties,
            "additionalProperties": False,
        }
        if required:
            schema["required"] = sorted(set(required))
        return schema

    def _write_mcp_catalog(self, funcs_dir: Path) -> Path:
        tools: list[dict[str, Any]] = []
        by_category: dict[str, list[str]] = {}

        for func in self.functions:
            tool_name = self._tool_name(func)
            by_category.setdefault(func.category, []).append(tool_name)

            tools.append(
                {
                    "name": tool_name,
                    "description": func.description,
                    "inputSchema": self._build_mcp_input_schema(func),
                    "transport": {
                        "method": func.method,
                        "url_pattern": func.url_pattern,
                        "headers": func.headers,
                    },
                    "response": {
                        "type": func.response_type,
                        "schema": func.response_schema,
                        "success_indicators": func.success_indicators,
                    },
                    "metadata": {
                        "agent_function_id": func.id,
                        "category": func.category,
                        "use_cases": func.use_cases,
                        "capabilities": func.capabilities,
                        "agent_ready": func.agent_ready,
                        "validation_score": func.validation_score,
                        "validation_checks": func.validation_checks,
                        "validation_notes": func.validation_notes,
                        "test_status": func.test_status,
                        "test_http_code": func.test_http_code,
                        "fix_suggestion": func.fix_suggestion,
                    },
                }
            )

        payload = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_tools": len(tools),
            "categories": by_category,
            "tools": tools,
        }

        out = funcs_dir / "mcp_tools_catalog.json"
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return out

    def _write_ready_mcp_catalog(self, funcs_dir: Path) -> Path:
        tools: list[dict[str, Any]] = []
        by_category: dict[str, list[str]] = {}

        ready_functions = [f for f in self.functions if f.agent_ready]
        for func in ready_functions:
            tool_name = self._tool_name(func)
            by_category.setdefault(func.category, []).append(tool_name)

            tools.append(
                {
                    "name": tool_name,
                    "description": func.description,
                    "inputSchema": self._build_mcp_input_schema(func),
                    "transport": {
                        "method": func.method,
                        "url_pattern": func.url_pattern,
                        "headers": func.headers,
                    },
                    "response": {
                        "type": func.response_type,
                        "schema": func.response_schema,
                        "success_indicators": func.success_indicators,
                    },
                    "metadata": {
                        "agent_function_id": func.id,
                        "category": func.category,
                        "use_cases": func.use_cases,
                        "capabilities": func.capabilities,
                        "agent_ready": func.agent_ready,
                        "validation_score": func.validation_score,
                        "validation_checks": func.validation_checks,
                        "validation_notes": func.validation_notes,
                        "test_status": func.test_status,
                        "test_http_code": func.test_http_code,
                    },
                }
            )

        payload = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_tools": len(tools),
            "categories": by_category,
            "selection_criteria": "agent_ready=true and test_status=ok and complete contract",
            "tools": tools,
        }

        out = funcs_dir / "mcp_tools_ready.json"
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return out

    def _write_validation_artifacts(self, funcs_dir: Path) -> tuple[Path, Path]:
        total = len(self.functions)
        ready = [f for f in self.functions if f.agent_ready]
        working = [f for f in self.functions if f.test_status == "ok"]
        tested_not_ok = [f for f in self.functions if f.test_status and f.test_status not in {"ok", "untested"}]
        untested = [f for f in self.functions if not f.test_status or f.test_status == "untested"]

        missing_response = [f for f in self.functions if not self._response_defined(f)]
        missing_write_body = [
            f for f in self.functions
            if self._body_required(f) and f.body_schema is None
        ]

        avg_score = round(sum(f.validation_score for f in self.functions) / total, 2) if total else 0.0

        validation_payload = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": {
                "total_functions": total,
                "agent_ready": len(ready),
                "working": len(working),
                "tested_not_ok": len(tested_not_ok),
                "untested": len(untested),
                "missing_response_schema": len(missing_response),
                "missing_write_body_schema": len(missing_write_body),
                "average_validation_score": avg_score,
            },
            "functions": [
                {
                    "id": f.id,
                    "name": f.name,
                    "method": f.method,
                    "url": f.url_pattern,
                    "agent_ready": f.agent_ready,
                    "validation_score": f.validation_score,
                    "validation_checks": f.validation_checks,
                    "validation_notes": f.validation_notes,
                    "test_status": f.test_status,
                    "test_http_code": f.test_http_code,
                    "required_path_params": self._required_param_names(f.path_params),
                    "required_query_params": self._required_param_names(f.query_params),
                    "required_headers": self._required_headers(f.headers),
                    "body_required": self._body_required(f),
                    "has_body_schema": f.body_schema is not None,
                    "has_response_schema": self._response_defined(f),
                }
                for f in self.functions
            ],
        }

        validation_json = funcs_dir / "validation_report.json"
        validation_json.write_text(json.dumps(validation_payload, indent=2), encoding="utf-8")

        ready_index = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_ready": len(ready),
            "functions": [
                {
                    "id": f.id,
                    "name": f.name,
                    "method": f.method,
                    "url": f.url_pattern,
                    "category": f.category,
                    "validation_score": f.validation_score,
                    "required_path_params": self._required_param_names(f.path_params),
                    "required_query_params": self._required_param_names(f.query_params),
                    "required_headers": self._required_headers(f.headers),
                    "body_schema": f.body_schema,
                    "response_schema": f.response_schema,
                    "success_indicators": f.success_indicators,
                    "source_file": f.source_file,
                    "test_status": f.test_status,
                    "test_http_code": f.test_http_code,
                }
                for f in sorted(ready, key=lambda x: (-x.validation_score, x.name))
            ],
        }
        ready_json = funcs_dir / "agent_ready_index.json"
        ready_json.write_text(json.dumps(ready_index, indent=2), encoding="utf-8")

        return validation_json, ready_json
    
    def _write_triage_report(self, funcs_dir: Path) -> Path:
        """Generate triage_report.md listing all endpoints with test status and fix suggestions."""
        STATUS_ICON = {
            "ok": "✅", "reachable": "🟡", "not_found": "❌", "timeout": "⏱️", "offline": "🔴"
        }
        tested   = [f for f in self.functions if f.test_status and f.test_status != "untested"]
        untested = [f for f in self.functions if not f.test_status or f.test_status == "untested"]
        ok       = [f for f in tested if f.test_status == "ok"]
        broken   = [f for f in tested if f.test_status != "ok"]

        counts = {s: sum(1 for f in broken if f.test_status == s)
                  for s in ("not_found", "timeout", "offline", "reachable")}

        lines = [
            "# Endpoint Triage Report",
            "",
            "> Auto-generated by `endpoint_mapper.py` — enriched with live probe results.",
            "> Use this file to identify broken endpoints and apply the suggested fixes.",
            "",
            "## Summary",
            "",
            "| Status | Count |",
            "|--------|-------|",
            f"| ✅ OK | {len(ok)} |",
        ]
        label_map = {
            "not_found": "❌ Not Found (404)",
            "timeout":   "⏱️ Timeout",
            "offline":   "🔴 Offline",
            "reachable": "🟡 Reachable (errors)",
        }
        for s, lbl in label_map.items():
            if counts.get(s):
                lines.append(f"| {lbl} | {counts[s]} |")
        lines += [f"| ⚪ Not Tested | {len(untested)} |", ""]

        GROUPS = [
            ("not_found", "❌ Not Found — Route Missing",
             "These routes returned 404. Verify the URL path and ensure the route is registered in the backend."),
            ("timeout",   "⏱️ Timeout — Backend Unreachable",
             "These endpoints timed out. Check that the backing service is running on the expected port."),
            ("offline",   "🔴 Offline — Service Down",
             "The backend service appears completely offline. Start the server process first."),
            ("reachable", "🟡 Reachable — Errors / Wrong Method",
             "Routes exist but returned client error codes (4xx). Verify methods, params, and auth headers."),
        ]
        for status, heading, desc in GROUPS:
            group = [f for f in broken if f.test_status == status]
            if not group:
                continue
            lines += [f"## {heading}", "", desc, "",
                      "| Endpoint | Method | JS Source | HTTP | Fix |",
                      "|----------|--------|-----------|------|-----|"]
            for f in group:
                code_str  = str(f.test_http_code) if f.test_http_code else "—"
                fix       = f.fix_suggestion or "Review endpoint configuration"
                src       = f.test_source_ref or f.source_file
                url_short = (f.url_pattern[:68] + "…") if len(f.url_pattern) > 68 else f.url_pattern
                lines.append(f"| `{url_short}` | `{f.method}` | {src} | {code_str} | {fix} |")
            lines.append("")

        if ok:
            lines += ["## ✅ Working Endpoints", "",
                      "| Endpoint | Method |",
                      "|----------|--------|"]
            for f in ok:
                url_short = (f.url_pattern[:68] + "…") if len(f.url_pattern) > 68 else f.url_pattern
                lines.append(f"| `{url_short}` | `{f.method}` |")
            lines.append("")

        if untested:
            lines += [
                "## ⚪ Not Tested",
                "",
                "Found in source code but absent from the test report.",
                "",
                "| Endpoint | Method | Source File |",
                "|----------|--------|-------------|",
            ]
            for f in untested:
                url_short = (f.url_pattern[:68] + "…") if len(f.url_pattern) > 68 else f.url_pattern
                lines.append(f"| `{url_short}` | `{f.method}` | {f.source_file} |")
            lines.append("")

        triage_path = funcs_dir / "triage_report.md"
        triage_path.write_text("\n".join(lines))

        # Also emit machine-readable JSON for the API Explorer browser panel
        triage_json = {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": {
                "ok": len(ok),
                "broken": len(broken),
                "untested": len(untested),
                "by_status": counts,
            },
            "broken": [
                {
                    "id": f.id,
                    "name": f.name,
                    "method": f.method,
                    "url": f.url_pattern,
                    "test_status": f.test_status,
                    "http_code": f.test_http_code,
                    "source": f.test_source_ref or f.source_file,
                    "fix": f.fix_suggestion or "Review endpoint configuration",
                }
                for f in broken
            ],
            "ok": [
                {"id": f.id, "name": f.name, "method": f.method, "url": f.url_pattern}
                for f in ok
            ],
            "untested": [
                {"id": f.id, "name": f.name, "method": f.method, "url": f.url_pattern, "source": f.source_file}
                for f in untested
            ],
        }
        (funcs_dir / "triage_report.json").write_text(json.dumps(triage_json, indent=2))

        return triage_path

    def _generate_agent_readme(self) -> str:
        """Generate documentation for agents."""
        
        categories = {}
        for func in self.functions:
            if func.category not in categories:
                categories[func.category] = []
            categories[func.category].append(func)
        
        broken_funcs = [f for f in self.functions if f.test_status and f.test_status != "ok"]
        lines = [
            "# Agent Functions Reference",
            "",
            "This directory contains agent-optimized API function definitions.",
            "Each function is documented with all the information an AI agent needs",
            "to understand and correctly invoke the API.",
            "",
        ]
        if broken_funcs:
            lines += [
                f"> ⚠️  **Live test data included.** {len(broken_funcs)} endpoint(s) have issues — "
                f"see [`triage_report.md`](triage_report.md) for fix guidance.",
                "> Each function JSON also contains `test_status`, `test_http_code`, and `fix_suggestion` fields.",
                "",
            ]
        lines += [
            "## Quick Start",
            "",
            "1. Read `index.json` for a list of all available functions",
            "2. Use `capability_map.json` to find functions by what they do",
            "3. Load individual function files from `functions/` for full details",
            "",
            "## File Structure",
            "",
            "```",
            "agent_functions/",
            "├── index.json           # Master index of all functions",
            "├── capability_map.json  # Functions organized by capability",
            "├── mcp_tools_catalog.json # MCP-ready tool definitions",
            "├── mcp_tools_ready.json # Ready-only MCP tools (strict gate)",
            "├── validation_report.json # Validation score/checks for every function",
            "├── agent_ready_index.json # Strict ready-only function list",
            "├── README.md            # This file",
            "└── functions/           # Individual function definitions",
            "    ├── {id}_{name}.json",
            "    └── ...",
            "```",
            "",
            "## Function Categories",
            ""
        ]
        
        for cat, funcs in sorted(categories.items()):
            lines.append(f"### {cat.replace('_', ' ').title()}")
            lines.append("")
            for func in funcs:
                url_short = func.url_pattern[:50] + "..." if len(func.url_pattern) > 50 else func.url_pattern
                lines.append(f"- **{func.name}** (`{func.method} {url_short}`)")
                lines.append(f"  - {func.description[:80]}")
            lines.append("")
        
        lines.extend([
            "## Function Schema",
            "",
            "Each function JSON contains:",
            "",
            "| Field | Description |",
            "|-------|-------------|",
            "| `id` | Unique identifier |",
            "| `name` | Human-readable name |",
            "| `method` | HTTP method (GET, POST, etc.) |",
            "| `url_pattern` | URL with parameter placeholders |",
            "| `description` | What this function does |",
            "| `category` | Functional category |",
            "| `path_params` | URL path parameters |",
            "| `query_params` | URL query parameters |",
            "| `body_schema` | Request body structure |",
            "| `headers` | Required headers |",
            "| `response_type` | Expected response format |",
            "| `prerequisites` | Functions to call first |",
            "| `related_functions` | Commonly used together |",
            "| `use_cases` | When to use this function |",
            "| `capabilities` | What this enables |",
            "",
            "## Workflow Composition",
            "",
            "See `capability_map.json` for pre-defined workflows that combine",
            "multiple functions to accomplish common tasks.",
            ""
        ])
        
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Documentation Generator
# ─────────────────────────────────────────────────────────────────────────────

class DocumentationGenerator:
    """Generates Mermaid diagrams and Markdown documentation."""
    
    @staticmethod
    def generate_mermaid_diagram(analysis: ProjectAnalysis) -> str:
        """Generate a Mermaid flowchart showing pages and their API calls."""
        
        lines = [
            "```mermaid",
            "flowchart LR",
            "    subgraph Frontend[\"🖥️ Frontend Pages\"]"
        ]
        
        file_endpoints: dict[str, list[APIEndpoint]] = {}
        for file_analysis in analysis.files:
            if file_analysis.endpoints:
                file_endpoints[file_analysis.file_path] = file_analysis.endpoints
        
        file_ids = {}
        for idx, (file_path, endpoints) in enumerate(file_endpoints.items()):
            file_name = Path(file_path).name
            file_id = f"F{idx}"
            file_ids[file_path] = file_id
            lines.append(f'        {file_id}["{file_name}"]')
        
        lines.append("    end")
        lines.append("")
        
        api_groups: dict[str, list[tuple[str, APIEndpoint]]] = {}
        for file_path, endpoints in file_endpoints.items():
            for ep in endpoints:
                url = ep.url
                base = url.split('/')[1] if url.startswith('/') and len(url.split('/')) > 1 else 'api'
                base = re.sub(r'[^a-zA-Z0-9]', '_', base)[:20]
                if base not in api_groups:
                    api_groups[base] = []
                api_groups[base].append((file_path, ep))
        
        lines.append("    subgraph APIs[\"🔌 API Endpoints\"]")
        endpoint_ids = {}
        ep_counter = 0
        
        for group_name, group_endpoints in api_groups.items():
            lines.append(f"        subgraph {group_name}[\"{group_name}\"]")
            for file_path, ep in group_endpoints:
                ep_id = f"E{ep_counter}"
                endpoint_ids[(file_path, ep.url, ep.method)] = ep_id
                short_url = ep.url[:40] + "..." if len(ep.url) > 40 else ep.url
                lines.append(f'            {ep_id}["{ep.method}: {short_url}"]')
                ep_counter += 1
            lines.append("        end")
        
        lines.append("    end")
        lines.append("")
        
        for file_path, endpoints in file_endpoints.items():
            file_id = file_ids[file_path]
            for ep in endpoints:
                ep_id = endpoint_ids.get((file_path, ep.url, ep.method))
                if ep_id:
                    lines.append(f"    {file_id} --> {ep_id}")
        
        lines.append("```")
        return "\n".join(lines)
    
    @staticmethod
    def generate_per_file_diagram(file_analysis: FileAnalysis) -> str:
        """Generate a diagram for a single file."""
        if not file_analysis.endpoints:
            return ""
        
        file_name = Path(file_analysis.file_path).name
        
        lines = [
            "```mermaid",
            "flowchart TD",
            f'    Page["{file_name}"]',
            ""
        ]
        
        for idx, ep in enumerate(file_analysis.endpoints):
            ep_id = f"EP{idx}"
            short_url = ep.url[:50] + "..." if len(ep.url) > 50 else ep.url
            label = f"{ep.method}\\n{short_url}\\nLine {ep.line_number}"
            lines.append(f'    {ep_id}["{label}"]')
            lines.append(f"    Page --> {ep_id}")
        
        lines.append("```")
        return "\n".join(lines)
    
    @staticmethod
    def generate_markdown(analysis: ProjectAnalysis) -> str:
        """Generate comprehensive Markdown documentation."""
        
        lines = [
            f"# API Endpoint Documentation",
            f"## Project: {analysis.project_name}",
            "",
            f"**Total Files Analyzed:** {analysis.total_files}",
            f"**Total Endpoints Found:** {analysis.total_endpoints}",
            "",
            "---",
            "",
            "## Overview Diagram",
            "",
            DocumentationGenerator.generate_mermaid_diagram(analysis),
            "",
            "---",
            "",
            "## Endpoints by File",
            ""
        ]
        
        for file_analysis in sorted(analysis.files, key=lambda f: f.file_path):
            if not file_analysis.endpoints:
                continue
                
            file_name = Path(file_analysis.file_path).name
            rel_path = file_analysis.file_path
            
            lines.extend([
                f"### 📄 {file_name}",
                f"**Path:** `{rel_path}`  ",
                f"**Type:** {file_analysis.file_type.upper()}  ",
                f"**API Clients Used:** {', '.join(str(c) for c in file_analysis.api_clients) or 'N/A'}",
                "",
                DocumentationGenerator.generate_per_file_diagram(file_analysis),
                "",
                "| Line | Method | Endpoint | Request | Response | Function | Notes |",
                "|------|--------|----------|---------|----------|----------|-------|"
            ])
            
            for ep in sorted(file_analysis.endpoints, key=lambda e: e.line_number):
                req = (ep.request_payload or "—")[:50]
                res = (ep.expected_response or "—")[:50]
                func = ep.function_name or "—"
                notes = ep.notes[:30] if ep.notes else "—"
                url = ep.url[:60] + "..." if len(ep.url) > 60 else ep.url
                
                lines.append(
                    f"| {ep.line_number} | `{ep.method}` | `{url}` | {req} | {res} | `{func}` | {notes} |"
                )
            
            lines.extend(["", "---", ""])
        
        lines.extend([
            "## Endpoint Summary",
            "",
            "### By HTTP Method",
            ""
        ])
        
        method_counts: dict[str, int] = {}
        all_endpoints: list[APIEndpoint] = []
        for fa in analysis.files:
            all_endpoints.extend(fa.endpoints)
            for ep in fa.endpoints:
                method_counts[ep.method] = method_counts.get(ep.method, 0) + 1
        
        for method, count in sorted(method_counts.items(), key=lambda x: -x[1]):
            lines.append(f"- **{method}**: {count} calls")
        
        lines.extend([
            "",
            "### Unique Endpoints",
            ""
        ])
        
        unique_endpoints: dict[str, list[str]] = {}
        for ep in all_endpoints:
            key = f"{ep.method} {ep.url}"
            if key not in unique_endpoints:
                unique_endpoints[key] = []
            unique_endpoints[key].append(Path(ep.file_path).name)
        
        for endpoint, files in sorted(unique_endpoints.items()):
            files_str = ", ".join(set(files))
            lines.append(f"- `{endpoint}` — used in: {files_str}")
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_json(analysis: ProjectAnalysis) -> str:
        """Generate JSON export of all data."""
        
        data = {
            "project_name": analysis.project_name,
            "total_files": analysis.total_files,
            "total_endpoints": analysis.total_endpoints,
            "files": []
        }
        
        for fa in analysis.files:
            file_data = {
                "file_path": fa.file_path,
                "file_type": fa.file_type,
                "imports": fa.imports,
                "api_clients": fa.api_clients,
                "endpoints": [asdict(ep) for ep in fa.endpoints]
            }
            data["files"].append(file_data)
        
        return json.dumps(data, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def _derive_project_name(source_dir: Path, override: Optional[str]) -> str:
    """Use explicit name > .env PROJECT_NAME > first non-generic HTML stem > directory name."""
    if override:
        return override
    env_name = os.environ.get("PROJECT_NAME", "").strip()
    if env_name:
        return env_name
    generic = {"index", "main", "app", "home", "default"}
    for f in sorted(source_dir.rglob("*.html")):
        if f.stem.lower() not in generic:
            return f.stem
    return source_dir.name


def _copy_sources(source_dir: Path, output_dir: Path) -> Path:
    """Copy all scanned source files into output_dir/source/, preserving structure."""
    src_out = output_dir / "source"
    if src_out.exists():
        shutil.rmtree(src_out)
    shutil.copytree(
        source_dir, src_out,
        ignore=shutil.ignore_patterns(
            'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor'
        )
    )
    return src_out


def _clear_pages(source_dir: Path):
    """Remove all files/subdirs inside source_dir, keeping the directory itself."""
    for item in source_dir.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()


def main():
    _env_input  = os.environ.get("INPUT_DIR",  "./pages")
    _env_output = os.environ.get("OUTPUT_DIR", "./docs/endpoint_docs")

    parser = argparse.ArgumentParser(
        description="Extract and map API endpoints from HTML/JS code",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python endpoint_mapper.py                    # uses INPUT_DIR / OUTPUT_DIR from .env
    python endpoint_mapper.py ./src
    python endpoint_mapper.py ./frontend --output ./docs
    python endpoint_mapper.py ./app --name "My Project" --output ./api-docs
        """
    )
    parser.add_argument("directory", nargs="?", default=_env_input,
                        help=f"Directory to analyze (default from .env: {_env_input})")
    parser.add_argument("--output", "-o", default=_env_output,
                        help=f"Output base directory (default from .env: {_env_output})")
    parser.add_argument("--name", "-n", default=None, help="Project name (overrides auto-detection)")
    parser.add_argument("--api-key", help="DeepSeek API key (or set DEEPSEEK_API_KEY in .env)")
    parser.add_argument("--services-only", action="store_true",
                        help="Skip frontend LLM scan and map endpoints only from live services/OpenAPI/service-map")
    parser.add_argument("--no-service-openapi", action="store_true",
                        help="Disable service-level OpenAPI and service-map discovery")
    parser.add_argument("--runtime-port-file", default=str(DEFAULT_RUNTIME_PORT_FILE),
                        help="Path to runtime-ports.env generated by start-all.sh")
    parser.add_argument("--service-map", default=str(DEFAULT_SERVICE_MAP_PATH),
                        help="Path to gateway service-map.json registry")
    parser.add_argument("--audit-catalog", default=None,
                        help="Path to api_endpoint_catalog_*.json (defaults to latest in reports/api-audit)")
    parser.add_argument("--service", action="append", default=[],
                        help="Limit service OpenAPI mapping to one or more service names")
    parser.add_argument("--include-dir", action="append", default=[],
                        help="Only scan these frontend folders (repeatable, absolute or relative to input directory)")
    parser.add_argument("--exclude-dir", action="append", default=[],
                        help="Exclude additional folder names from frontend scan (repeatable)")
    parser.add_argument("--no-clear", action="store_true",
                        help="Keep source files in pages/ after export (don't clear)")
    parser.add_argument("--no-agent-functions", action="store_true",
                        help="Skip generating agent function files")
    parser.add_argument("--test-report", "-t", default=None, metavar="REPORT_MD",
                        help="Path to a Markdown endpoint test report "
                             "(e.g. FRONTEND_ENDPOINT_REPORT.md) to enrich agent functions "
                             "with live test results and actionable fix suggestions")
    parser.add_argument("--olivia", action="store_true",
                        help="Output directly to reports/ecosystem/ (auto-detected from this script's directory)")

    args = parser.parse_args()

    source_dir = Path(args.directory).resolve()
    if args.services_only and not source_dir.exists():
        project_name = args.name or "ecosystem_endpoints"
    else:
        project_name = _derive_project_name(source_dir, args.name)

    if args.olivia:
        # serve.py consumes the agent functions catalog from reports/ecosystem/agent_functions/
        olivia_root = WORKSPACE_ROOT
        output_dir = (olivia_root / "reports" / "ecosystem").resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        # When targeting the ecosystem reports dir, skip the extra project_name subdirectory
        print(f"   🏠 --olivia: writing to {output_dir}")
    else:
        output_dir = Path(args.output).resolve() / project_name

    if not args.services_only and not source_dir.exists():
        print(f"❌ Error: Directory not found: {source_dir}")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           🔍 API Endpoint Mapper                             ║
╠══════════════════════════════════════════════════════════════╣
║  Project:  {project_name:<47} ║
║  Source:   {str(source_dir):<47} ║
║  Output:   {str(output_dir):<47} ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    file_analyses: list[FileAnalysis] = []
    files: list[tuple[str, str]] = []

    if not args.services_only:
        print("📂 Scanning for HTML/JS files...")
        files = FileScanner.scan(
            str(source_dir),
            include_dirs=args.include_dir,
            extra_ignore_dirs=args.exclude_dir,
        )
        print(f"   Found {len(files)} files to analyze\n")

        if not files and args.no_service_openapi:
            print("❌ No supported files found and service discovery disabled.")
            return 1

        if files:
            if not (args.api_key or os.environ.get("DEEPSEEK_API_KEY")):
                print("❌ Error: Missing DeepSeek API key for frontend code analysis")
                print("   Use --api-key, set DEEPSEEK_API_KEY, or run with --services-only")
                return 1
            print("🤖 Analyzing files with DeepSeek...\n")
            analyzer = EndpointAnalyzer(api_key=args.api_key)
            for idx, (file_path, content) in enumerate(files, 1):
                rel_path = str(Path(file_path).relative_to(source_dir))
                print(f"  [{idx}/{len(files)}] Analyzing: {rel_path}")
                analysis = analyzer.analyze_file(rel_path, content)
                file_analyses.append(analysis)

                endpoint_count = len(analysis.endpoints)
                if endpoint_count > 0:
                    print(f"           ✓ Found {endpoint_count} endpoint(s)")

                if idx < len(files):
                    time.sleep(3)
    else:
        print("📂 --services-only: skipping frontend file scan")

    service_filter = {s.strip() for s in args.service if s.strip()}
    if not args.no_service_openapi:
        runtime_port_file = Path(args.runtime_port_file).expanduser().resolve()
        service_map_path = Path(args.service_map).expanduser().resolve() if args.service_map else None
        mapper = ServiceEndpointMapper(
            timeout=8.0,
            runtime_port_file=runtime_port_file,
            service_filter=service_filter or None,
            service_map_path=service_map_path,
        )
        print("🌐 Discovering service endpoints from OpenAPI/service-map...")
        service_analyses = mapper.discover()
        service_endpoint_count = sum(len(fa.endpoints) for fa in service_analyses)
        print(f"   ✓ Added {service_endpoint_count} service endpoint entries from {len(service_analyses)} sources")
        file_analyses.extend(service_analyses)

    if not file_analyses:
        print("❌ No endpoint sources were mapped (frontend/service).")
        return 1

    total_endpoints = sum(len(fa.endpoints) for fa in file_analyses)
    project_analysis = ProjectAnalysis(
        project_name=project_name,
        total_files=len(file_analyses),
        total_endpoints=total_endpoints,
        files=file_analyses,
    )
    
    print(f"\n📝 Generating documentation...")
    
    md_content = DocumentationGenerator.generate_markdown(project_analysis)
    md_path = output_dir / "API_ENDPOINTS.md"
    md_path.write_text(md_content)
    print(f"   ✓ Markdown: {md_path}")
    
    json_content = DocumentationGenerator.generate_json(project_analysis)
    json_path = output_dir / "endpoints.json"
    json_path.write_text(json_content)
    print(f"   ✓ JSON: {json_path}")
    
    mermaid_content = DocumentationGenerator.generate_mermaid_diagram(project_analysis)
    mermaid_path = output_dir / "diagram.mmd"
    mermaid_path.write_text(mermaid_content.replace("```mermaid\n", "").replace("\n```", ""))
    print(f"   ✓ Mermaid: {mermaid_path}")

    if not args.no_agent_functions:
        print(f"\n🤖 Generating agent functions...")
        test_lookup: dict = {}

        audit_catalog_path: Optional[Path] = None
        if args.audit_catalog:
            audit_catalog_path = Path(args.audit_catalog).expanduser().resolve()
        else:
            audit_catalog_path = _find_latest_audit_catalog()

        if audit_catalog_path and audit_catalog_path.exists():
            print(f"   📋 Loading audit catalog: {audit_catalog_path.name}")
            catalog_results = AuditCatalogParser.parse(audit_catalog_path)
            test_lookup.update(TestReportParser.build_lookup(catalog_results))
            print(f"   ✓ Loaded {len(catalog_results)} catalog endpoint statuses")

        if args.test_report:
            test_report_path = Path(args.test_report).resolve()
            if test_report_path.exists():
                print(f"   📋 Loading test report: {test_report_path.name}")
                test_results = TestReportParser.parse(test_report_path)
                test_lookup.update(TestReportParser.build_lookup(test_results))
                broken_count = sum(1 for r in test_results if r.status != "ok")
                print(f"   ✓ Loaded {len(test_results)} test results ({broken_count} with issues)")
            else:
                print(f"   ⚠ Test report not found: {test_report_path}")
        agent_gen = AgentFunctionsGenerator(test_lookup=test_lookup)
        agent_gen.generate_from_analysis(project_analysis)
        funcs_dir = agent_gen.write_to_directory(output_dir, project_name=project_name)
        print(f"   ✓ Agent Functions: {funcs_dir}")
        print(f"   ✓ Generated {len(agent_gen.functions)} function definitions")
        if test_lookup:
            broken_funcs = [
                f for f in agent_gen.functions
                if f.test_status and f.test_status not in {"ok", "untested"}
            ]
            if broken_funcs:
                print(f"   ⚠  {len(broken_funcs)} endpoint(s) have issues — see triage_report.md")

    if not args.services_only:
        print(f"\n📦 Copying source files...")
        src_out = _copy_sources(source_dir, output_dir)
        print(f"   ✓ Source: {src_out}")

        if not args.no_clear:
            print(f"\n🧹 Clearing {source_dir} for next run...")
            _clear_pages(source_dir)
            print(f"   ✓ {source_dir} is now empty")

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  ✅ Analysis Complete!                                       ║
╠══════════════════════════════════════════════════════════════╣
║  Project:        {project_name:<43} ║
║  Files analyzed: {len(file_analyses):<43} ║
║  Endpoints found:{total_endpoints:<43} ║
║  Output:         {str(output_dir):<43} ║
║                                                              ║
║  📊 Run `python server.py` then open http://localhost:8765   ║
║  🤖 Agent functions: {str(output_dir / 'agent_functions'):<39} ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    return 0


if __name__ == "__main__":
    exit(main())
