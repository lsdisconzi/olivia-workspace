#!/usr/bin/env python3
"""
API Endpoint Mapper
===================
Analyzes HTML/JS files to extract API endpoints and generates
visual documentation with Mermaid diagrams.

Now includes Agent Functions output - detailed per-endpoint documentation
designed for AI agents to understand capabilities and compose operations.

Usage:
    python3 endpoint_mapper.py path/to/workspace --output ./output
"""

import os
import re
import json
import time
import shutil
import argparse
import hashlib
import sys
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from openai import OpenAI

_PROJ_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJ_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJ_ROOT))

from src.runtime_config import bootstrap_environment

# Load .env defaults without overriding process-level environment.
bootstrap_environment(_PROJ_ROOT)

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


# ─────────────────────────────────────────────────────────────────────────────
# LLM-Powered Analyzer
# ─────────────────────────────────────────────────────────────────────────────

class EndpointAnalyzer:
    """Uses DeepSeek to intelligently extract API endpoints from code."""
    
    CHUNK_MAX_CHARS = 10000  # ~3.3k tokens per chunk — fits well under rate limit
    
    def __init__(self, api_key: Optional[str] = None):
        # Prefer generic LLM_* env vars, with DeepSeek-compatible fallbacks.
        resolved_key = (
            api_key
            or os.environ.get("LLM_API_KEY")
            or os.environ.get("DEEPSEEK_API_KEY")
        )
        resolved_base = (
            os.environ.get("LLM_BASE_URL")
            or os.environ.get("DEEPSEEK_API_BASE_URL")
            or "https://api.deepseek.com"
        )
        self.client = OpenAI(
            api_key=resolved_key,
            base_url=resolved_base,
        )
        self.model = (
            os.environ.get("LLM_MODEL")
            or os.environ.get("DEEPSEEK_MODEL")
            or "deepseek-chat"
        )
    
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
                response = self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=2048,
                    messages=[{"role": "user", "content": prompt}]
                )
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
                    url=ep.get("url") or "(unknown)",
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
    IGNORE_DIRS = {'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor'}
    
    @classmethod
    def scan(cls, directory: str) -> list[tuple[str, str]]:
        """Scan directory and return list of (file_path, content) tuples."""
        files = []
        root_path = Path(directory)
        
        for path in root_path.rglob('*'):
            if any(ignored in path.parts for ignored in cls.IGNORE_DIRS):
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
# Agent Functions Generator
# ─────────────────────────────────────────────────────────────────────────────

class AgentFunctionsGenerator:
    """
    Generates agent-optimized function documentation from extracted endpoints.
    Creates individual JSON files for each function and a master index.
    """
    
    def __init__(self):
        self.functions: list[AgentFunction] = []
    
    @staticmethod
    def _generate_id(method: str, url: str) -> str:
        """Generate a stable unique ID for an endpoint."""
        raw = f"{method}:{url}"
        return hashlib.sha256(raw.encode()).hexdigest()[:12]
    
    @staticmethod
    def _extract_path_params(url: str) -> list[dict]:
        """Extract path parameters from URL pattern."""
        params = []
        patterns = re.findall(r'\$\{([^}]+)\}|:(\w+)', url)
        for match in patterns:
            param_name = match[0] or match[1]
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
        
        if any(kw in url_lower for kw in ['search', 'query', 'find']):
            return "search"
        if any(kw in url_lower for kw in ['ingest', 'upload', 'import']):
            return "data_ingestion"
        if any(kw in url_lower for kw in ['health', 'status', 'telemetry', 'cluster']):
            return "system"
        if any(kw in url_lower for kw in ['snapshot', 'backup']):
            return "backup"
        if any(kw in url_lower for kw in ['alias']):
            return "alias"
        if any(kw in url_lower for kw in ['chat', 'completion', 'assistant']):
            return "ai"
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
        
        if category.startswith("crud_"):
            caps.append(f"Provides {category.replace('crud_', '')} operations")
        
        if 'collection' in url.lower():
            caps.append("Manages vector collections")
        if 'point' in url.lower():
            caps.append("Manipulates data points/vectors")
        if 'search' in url.lower():
            caps.append("Enables semantic/vector search")
        if 'ingest' in url.lower():
            caps.append("Bulk data import capability")
        if 'assistant' in url.lower() or 'chat' in url.lower():
            caps.append("Conversational AI interaction")
        
        return caps if caps else ["General API operation"]
    
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
                path_params=self._extract_path_params(url),
                query_params=self._extract_query_params(url),
                body_schema=self._parse_body_schema(ep.request_payload),
                headers=self._extract_headers(ep.notes),
                response_type=self._infer_response_type(url, method, ep.expected_response),
                response_schema={"description": ep.expected_response} if ep.expected_response else None,
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
        
        functions = self._find_relationships(functions)
        self.functions = functions
        return functions
    
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
                    create_funcs = [f for f in funcs if f.method == 'POST' and func.category == 'crud_create']
                    func.prerequisites = [f.id for f in (list_funcs + create_funcs)]
        
        return functions
    
    def write_to_directory(self, output_dir: Path) -> Path:
        """Write agent functions to a directory structure."""
        
        funcs_dir = output_dir / "agent_functions"
        funcs_dir.mkdir(parents=True, exist_ok=True)
        
        individual_dir = funcs_dir / "functions"
        individual_dir.mkdir(exist_ok=True)
        
        for func in self.functions:
            func_path = individual_dir / f"{func.id}_{func.name}.json"
            func_data = asdict(func)
            func_path.write_text(json.dumps(func_data, indent=2))
        
        index = {
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
            
            index["functions"].append({
                "id": func.id,
                "name": func.name,
                "method": func.method,
                "url": func.url_pattern,
                "category": func.category,
                "description": func.description,
                "file": f"functions/{func.id}_{func.name}.json"
            })
        
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
        
        readme = self._generate_agent_readme()
        readme_path = funcs_dir / "README.md"
        readme_path.write_text(readme)
        
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
                workflows.append({
                    "name": f"{resource}_crud_workflow",
                    "description": f"Full CRUD operations for {resource}",
                    "steps": [
                        {"action": "list", "function_ids": ops["list"], "description": "List existing items"},
                        {"action": "create", "function_ids": ops["create"], "description": "Create new item"},
                        {"action": "read", "function_ids": ops["read"], "description": "Read item details"},
                        {"action": "update", "function_ids": ops["update"], "description": "Modify item"},
                        {"action": "delete", "function_ids": ops["delete"], "description": "Remove item"}
                    ]
                })
            
            if ops["search"]:
                workflows.append({
                    "name": f"{resource}_search_workflow",
                    "description": f"Search and retrieve {resource}",
                    "steps": [
                        {"action": "list", "function_ids": ops["list"], "description": "Get available items"},
                        {"action": "search", "function_ids": ops["search"], "description": "Search with criteria"}
                    ]
                })
        
        return workflows
    
    def _generate_agent_readme(self) -> str:
        """Generate documentation for agents."""
        
        categories = {}
        for func in self.functions:
            if func.category not in categories:
                categories[func.category] = []
            categories[func.category].append(func)
        
        lines = [
            "# Agent Functions Reference",
            "",
            "This directory contains agent-optimized API function definitions.",
            "Each function is documented with all the information an AI agent needs",
            "to understand and correctly invoke the API.",
            "",
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
    parser.add_argument("--api-key", help="LLM API key (or set LLM_API_KEY / DEEPSEEK_API_KEY in .env)")
    parser.add_argument("--no-clear", action="store_true",
                        help="Keep source files in pages/ after export (don't clear)")
    parser.add_argument("--no-agent-functions", action="store_true",
                        help="Skip generating agent function files")

    args = parser.parse_args()

    source_dir = Path(args.directory).resolve()
    project_name = _derive_project_name(source_dir, args.name)
    output_dir = Path(args.output).resolve() / project_name

    if not source_dir.exists():
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
    
    print("📂 Scanning for HTML/JS files...")
    files = FileScanner.scan(str(source_dir))
    print(f"   Found {len(files)} files to analyze\n")
    
    if not files:
        print("❌ No supported files found (.html, .js, .jsx, .ts, .tsx, .vue)")
        return 1
    
    print(f"🤖 Analyzing files with DeepSeek...\n")
    analyzer = EndpointAnalyzer(api_key=args.api_key)
    
    file_analyses: list[FileAnalysis] = []
    total_endpoints = 0
    
    for idx, (file_path, content) in enumerate(files, 1):
        rel_path = str(Path(file_path).relative_to(source_dir))
        print(f"  [{idx}/{len(files)}] Analyzing: {rel_path}")
        
        analysis = analyzer.analyze_file(rel_path, content)
        file_analyses.append(analysis)
        
        endpoint_count = len(analysis.endpoints)
        total_endpoints += endpoint_count
        
        if endpoint_count > 0:
            print(f"           ✓ Found {endpoint_count} endpoint(s)")

        if idx < len(files):
            time.sleep(3)
    
    project_analysis = ProjectAnalysis(
        project_name=project_name,
        total_files=len(files),
        total_endpoints=total_endpoints,
        files=file_analyses
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
        agent_gen = AgentFunctionsGenerator()
        agent_gen.generate_from_analysis(project_analysis)
        funcs_dir = agent_gen.write_to_directory(output_dir)
        print(f"   ✓ Agent Functions: {funcs_dir}")
        print(f"   ✓ Generated {len(agent_gen.functions)} function definitions")

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
║  Files analyzed: {len(files):<43} ║
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
