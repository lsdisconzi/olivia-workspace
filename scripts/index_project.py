#!/usr/bin/env python3
"""
Project Mapper & Indexer
Maps and indexes a project into a structured JSON representation with:
- File tree
- Symbol extraction (functions, classes, imports)
- HTML structure (scripts, stylesheets, templates)
- CSS selectors
- Dependency graph
- Cross-references
"""

import argparse
import ast
import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ---------- Configuration ----------
EXCLUDE_DIRS_DEFAULT = {
    ".git", "node_modules", "__pycache__", "venv", ".venv",
    "dist", "build", ".mypy_cache", ".tox", ".obsidian",
    "uploads", "_shared", "pluggins"
}
EXCLUDE_EXTS_DEFAULT = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".pdf",
    ".zip", ".exe", ".dll", ".so", ".bin", ".m4a", ".mp3", ".mp4"
}

# Folders to generate individual JSON indexes for
FOLDER_INDEXES = [
    "agents",
    "config",
    "content",
    "data",
    "data/notes",
    "deploy",
    "deploy/vps",
    "desktop",
    "frontend",
    "generated",
    "planning",
    "pluggins",
    "pluggins/craudio",
    "runtime",
    "scripts",
    "src",
    "static",
    "tests",
]

LANGUAGE_MAP = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".jsx": "javascript", ".md": "markdown",
    ".markdown": "markdown", ".yml": "yaml", ".yaml": "yaml",
    ".json": "json", ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".sql": "sql", ".sh": "bash", ".bash": "bash", ".tf": "hcl",
}


# ============================================================================
# FILE TREE BUILDER
# ============================================================================

def build_file_tree(root: Path, files: List[Path]) -> Dict[str, Any]:
    """Build nested directory tree structure."""
    tree: Dict[str, Any] = {}
    for file_path in sorted(files):
        rel = file_path.relative_to(root)
        parts = rel.parts
        current = tree
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = {"file_ref": f"files/{rel}"}
    return tree


# ============================================================================
# PYTHON PARSER
# ============================================================================

def parse_python_file(file_path: Path, content: str) -> Dict[str, Any]:
    """Parse Python file with proper AST handling."""
    result = {
        "imports": [],
        "imports_external": [],
        "symbols": {
            "functions": [],
            "classes": [],
            "globals": []
        }
    }

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        log.warning(f"Syntax error in {file_path}: {e}")
        return result

    stdlib_modules = {
        "os", "sys", "json", "re", "time", "datetime", "pathlib",
        "hashlib", "subprocess", "typing", "collections", "itertools",
        "functools", "abc", "contextlib", "io", "math", "random",
        "socket", "http", "urllib", "email", "html", "xml",
        "sqlite3", "csv", "argparse", "logging", "unittest",
        "threading", "multiprocessing", "asyncio", "ssl", "base64",
    }

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split(".")[0]
                if module in stdlib_modules:
                    result["imports"].append(alias.name)
                else:
                    result["imports_external"].append(alias.name)

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module = node.module.split(".")[0]
                if module in stdlib_modules:
                    result["imports"].append(node.module)
                else:
                    result["imports_external"].append(node.module)

        elif isinstance(node, ast.FunctionDef):
            args = [arg.arg for arg in node.args.args]
            result["symbols"]["functions"].append({
                "name": node.name,
                "line": node.lineno,
                "end_line": node.end_lineno,
                "args": args,
                "decorators": [d.id if isinstance(d, ast.Name) else str(d) for d in node.decorator_list]
            })

        elif isinstance(node, ast.ClassDef):
            methods = []
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    methods.append({
                        "name": item.name,
                        "line": item.lineno,
                        "end_line": item.end_lineno,
                        "args": [arg.arg for arg in item.args.args]
                    })
            result["symbols"]["classes"].append({
                "name": node.name,
                "line": node.lineno,
                "end_line": node.end_lineno,
                "methods": methods,
                "bases": [b.id if isinstance(b, ast.Name) else str(b) for b in node.bases]
            })

        elif isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            # Top-level assignments (globals/constants)
            if node.col_offset == 0:  # Top-level
                result["symbols"]["globals"].append({
                    "name": node.targets[0].id,
                    "line": node.lineno
                })

    return result


# ============================================================================
# JAVASCRIPT/TYPESCRIPT PARSER
# ============================================================================

def parse_js_file(file_path: Path, content: str) -> Dict[str, Any]:
    """Parse JavaScript/TypeScript file for imports, exports, functions."""
    result = {
        "imports": [],
        "exports": [],
        "symbols": {
            "functions": [],
            "classes": [],
            "constants": []
        }
    }

    lines = content.split("\n")

    # Import statements
    import_patterns = [
        r"import\s+(?:\{[^}]+\}|\w+)\s+from\s+['\"]([^'\"]+)['\"]",
        r"import\s+['\"]([^'\"]+)['\"]",
        r"import\s+\*\s+as\s+\w+\s+from\s+['\"]([^'\"]+)['\"]",
    ]
    for pattern in import_patterns:
        for match in re.finditer(pattern, content):
            result["imports"].append(match.group(1))

    # Export statements
    export_patterns = [
        r"export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)",
        r"export\s+\{[^}]+\}",
    ]
    for pattern in export_patterns:
        for match in re.finditer(pattern, content):
            if match.lastindex:
                result["exports"].append(match.group(1))

    # Function declarations
    func_pattern = r"function\s+(\w+)\s*\(([^)]*)\)"
    for match in re.finditer(func_pattern, content):
        name = match.group(1)
        args_str = match.group(2)
        args = [a.strip() for a in args_str.split(",") if a.strip()]
        line_num = content[:match.start()].count("\n") + 1
        result["symbols"]["functions"].append({
            "name": name,
            "line": line_num,
            "args": args
        })

    # Arrow functions assigned to const/let/var
    arrow_pattern = r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>"
    for match in re.finditer(arrow_pattern, content):
        name = match.group(1)
        args_str = match.group(2)
        args = [a.strip() for a in args_str.split(",") if a.strip()]
        line_num = content[:match.start()].count("\n") + 1
        result["symbols"]["functions"].append({
            "name": name,
            "line": line_num,
            "args": args
        })

    # Class declarations
    class_pattern = r"class\s+(\w+)(?:\s+extends\s+(\w+))?"
    for match in re.finditer(class_pattern, content):
        name = match.group(1)
        base = match.group(2)
        line_num = content[:match.start()].count("\n") + 1
        # Find class body to extract methods
        class_body_start = match.end()
        class_body = content[class_body_start:class_body_start + 5000]  # Look ahead 5k chars
        methods = []
        method_pattern = r"^\s+(\w+)\s*\([^)]*\)\s*[{]"
        for m_match in re.finditer(method_pattern, class_body, re.MULTILINE):
            method_name = m_match.group(1)
            if method_name not in ["if", "for", "while", "switch", "catch"]:
                method_line = line_num + class_body[:m_match.start()].count("\n")
                methods.append({
                    "name": method_name,
                    "line": method_line
                })
        result["symbols"]["classes"].append({
            "name": name,
            "line": line_num,
            "base": base,
            "methods": methods[:20]  # Limit to first 20 methods
        })

    # Constants (const/let at top level)
    const_pattern = r"^(?:const|let)\s+(\w+)\s*="
    for i, line in enumerate(lines, 1):
        match = re.match(const_pattern, line)
        if match:
            result["symbols"]["constants"].append({
                "name": match.group(1),
                "line": i
            })

    return result


# ============================================================================
# DEEP JAVASCRIPT PARSER (Frontend Architecture)
# ============================================================================

# JS built-ins / keywords to exclude from function call detection
_JS_BUILTINS = {
    # Language keywords
    "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
    "return", "throw", "try", "catch", "finally", "new", "delete", "typeof",
    "instanceof", "void", "in", "of", "yield", "await", "async",
    # Built-in objects
    "console", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean",
    "Date", "RegExp", "Error", "Map", "Set", "WeakMap", "WeakSet", "Promise",
    "Symbol", "Proxy", "Reflect", "Intl", "ArrayBuffer", "DataView", "Float32Array",
    "Float64Array", "Int8Array", "Int16Array", "Int32Array", "Uint8Array",
    "Uint16Array", "Uint32Array", "BigInt64Array", "BigUint64Array",
    # DOM built-ins
    "document", "window", "navigator", "location", "history", "localStorage",
    "sessionStorage", "fetch", "setTimeout", "setInterval", "clearTimeout",
    "clearInterval", "requestAnimationFrame", "cancelAnimationFrame",
    "alert", "confirm", "prompt", "atob", "btoa", "encodeURIComponent",
    "decodeURIComponent", "parseInt", "parseFloat", "isNaN", "isFinite",
    "eval", "Function",
    # Common patterns
    "undefined", "null", "true", "false", "NaN", "Infinity",
    # Method names that are not cross-module calls
    "push", "pop", "shift", "unshift", "splice", "slice", "concat", "join",
    "indexOf", "lastIndexOf", "find", "filter", "reduce", "map", "forEach",
    "some", "every", "includes", "startsWith", "endsWith", "trim", "split",
    "replace", "replaceAll", "match", "test", "toLowerCase", "toUpperCase",
    "keys", "values", "entries", "assign", "freeze", "create",
    "then", "catch", "finally", "resolve", "reject", "all", "race",
    "addEventListener", "removeEventListener", "preventDefault", "stopPropagation",
    "createElement", "getElementById", "querySelector", "querySelectorAll",
    "appendChild", "removeChild", "insertBefore", "replaceChild",
    "getAttribute", "setAttribute", "removeAttribute", "classList",
    "log", "warn", "error", "info", "debug", "table", "group", "groupEnd",
    "parse", "stringify", "floor", "ceil", "round", "random", "min", "max",
    "abs", "sqrt", "pow", "now", "getItem", "setItem", "removeItem",
    "stopPropagation", "closest", "cloneNode", "contains", "focus", "blur",
    "click", "submit", "reset", "scrollIntoView", "getBoundingClientRect",
    "getComputedStyle", "matches",
}


def parse_js_deep(file_path: Path, content: str) -> Dict[str, Any]:
    """Deep-parse a JS file for frontend architecture: window exports, DOM refs,
    API calls, event listeners, localStorage, globals, and function calls."""
    result: Dict[str, Any] = {
        "window_exports": [],
        "function_calls": [],
        "dom_references": {},
        "api_endpoints": [],
        "event_listeners": [],
        "localStorage_keys": [],
        "globals": [],
    }

    lines = content.split("\n")

    # --- Strip comments and string literals for cleaner analysis ---
    # We keep the original for line-number lookups but work on a cleaned version
    # for pattern matching to avoid false positives in comments/strings.
    cleaned = re.sub(r"//.*$", "", content, flags=re.MULTILINE)
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", cleaned)

    # --- 1. Window exports ---
    # window.X = function(...)
    for m in re.finditer(r"window\.(\w+)\s*=\s*function\s*\(", cleaned):
        line_num = cleaned[:m.start()].count("\n") + 1
        result["window_exports"].append({
            "name": m.group(1), "line": line_num, "type": "function"
        })
    # window.X = (...) => ...
    for m in re.finditer(r"window\.(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", cleaned):
        line_num = cleaned[:m.start()].count("\n") + 1
        result["window_exports"].append({
            "name": m.group(1), "line": line_num, "type": "arrow_function"
        })
    # window.X = { ... } (object literal — first line only)
    for m in re.finditer(r"window\.(\w+)\s*=\s*\{", cleaned):
        name = m.group(1)
        if not any(e["name"] == name for e in result["window_exports"]):
            line_num = cleaned[:m.start()].count("\n") + 1
            result["window_exports"].append({
                "name": name, "line": line_num, "type": "object"
            })
    # window.X = [...] (array)
    for m in re.finditer(r"window\.(\w+)\s*=\s*\[", cleaned):
        name = m.group(1)
        if not any(e["name"] == name for e in result["window_exports"]):
            line_num = cleaned[:m.start()].count("\n") + 1
            result["window_exports"].append({
                "name": name, "line": line_num, "type": "array"
            })
    # window.X = "..." or window.X = number or window.X = true/false
    for m in re.finditer(r"window\.(\w+)\s*=\s*(?:'[^']*'|\"[^\"]*\"|`[^`]*`|\d+|true|false|null)", cleaned):
        name = m.group(1)
        if not any(e["name"] == name for e in result["window_exports"]):
            line_num = cleaned[:m.start()].count("\n") + 1
            result["window_exports"].append({
                "name": name, "line": line_num, "type": "value"
            })
    # window.X = identifier (e.g. window.escapeHtml = escapeHtml)
    # Match: window.NAME = IDENTIFIER (with optional semicolon/newline after)
    for m in re.finditer(r"window\.(\w+)\s*=\s*([a-zA-Z_]\w*)(?:\s*[;\n]|\s*$)", cleaned, re.MULTILINE):
        name = m.group(1)
        value = m.group(2)
        # Exclude if it looks like a keyword or built-in
        if value in ("function", "true", "false", "null", "undefined", "new"):
            continue
        if not any(e["name"] == name for e in result["window_exports"]):
            line_num = cleaned[:m.start()].count("\n") + 1
            result["window_exports"].append({
                "name": name, "line": line_num, "type": "alias", "source": value
            })

    # --- 2. DOM references ---
    dom_methods = {
        "getElementById": r"getElementById\(\s*['\"]([^'\"]+)['\"]",
        "querySelector": r"querySelector\(\s*['\"]([^'\"]+)['\"]",
        "querySelectorAll": r"querySelectorAll\(\s*['\"]([^'\"]+)['\"]",
        "getElementsByClassName": r"getElementsByClassName\(\s*['\"]([^'\"]+)['\"]",
        "getElementsByTagName": r"getElementsByTagName\(\s*['\"]([^'\"]+)['\"]",
    }
    for method, pattern in dom_methods.items():
        refs = []
        for m in re.finditer(pattern, cleaned):
            refs.append(m.group(1))
        if refs:
            result["dom_references"][method] = sorted(set(refs))

    # --- 3. API endpoints ---
    api_patterns = [
        r"fetch\(\s*['\"]([^'\"]+)['\"]",
        r"fetch\(\s*`([^`]+)`",
        r"fetch\(\s*(?:API_BASE|apiBase|BASE_URL|baseUrl)\s*\+\s*['\"]([^'\"]+)['\"]",
        r"fetch\(\s*['\"]([^'\"]+)['\"]",
        r"\.open\(\s*['\"](?:GET|POST|PUT|DELETE|PATCH)['\"]\s*,\s*['\"]([^'\"]+)['\"]",
        r"url\s*:\s*['\"]([^'\"]*api[^'\"]*?)['\"]",
        r"url\s*:\s*['\"]([^'\"]*\/api\/[^'\"]*?)['\"]",
        r"url\s*:\s*['\"]([^'\"]*\/OliviaLegal\/[^'\"]*?)['\"]",
    ]
    endpoints = []
    for pattern in api_patterns:
        for m in re.finditer(pattern, cleaned):
            ep = m.group(1)
            # Filter out CDN URLs and non-project endpoints
            if ep.startswith(("http://", "https://")) and "cdn" in ep.lower():
                continue
            endpoints.append(ep)
    result["api_endpoints"] = sorted(set(endpoints))

    # --- 4. Event listeners ---
    # addEventListener('event', handler)
    for m in re.finditer(r"\.addEventListener\(\s*['\"](\w+)['\"]\s*,\s*(\w+)", cleaned):
        event = m.group(1)
        handler = m.group(2)
        line_num = cleaned[:m.start()].count("\n") + 1
        # Try to find the target element (look backwards for querySelector/getElementById)
        target = _find_event_target(cleaned, m.start())
        result["event_listeners"].append({
            "event": event, "handler": handler, "line": line_num, "target": target
        })
    # .onclick = handler
    for m in re.finditer(r"\.onclick\s*=\s*(\w+)", cleaned):
        handler = m.group(1)
        line_num = cleaned[:m.start()].count("\n") + 1
        target = _find_event_target(cleaned, m.start())
        result["event_listeners"].append({
            "event": "click", "handler": handler, "line": line_num, "target": target
        })

    # --- 5. localStorage keys ---
    ls_pattern = r"localStorage\.(?:get|set|remove)Item\(\s*['\"]([^'\"]+)['\"]"
    ls_keys = []
    for m in re.finditer(ls_pattern, cleaned):
        ls_keys.append(m.group(1))
    result["localStorage_keys"] = sorted(set(ls_keys))

    # --- 6. Global state (top-level const/let/var) ---
    for i, line in enumerate(lines, 1):
        stripped = line.lstrip()
        # Only top-level (no indentation)
        if line and line[0] not in (" ", "\t", "/"):
            m = re.match(r"(const|let|var)\s+(\w+)\s*=\s*(.*)", stripped)
            if m:
                kind = m.group(1)
                name = m.group(2)
                value_preview = m.group(3).strip()[:80]
                # Determine type hint from value
                if value_preview.startswith("["):
                    vtype = "array"
                elif value_preview.startswith("{"):
                    vtype = "object"
                elif value_preview.startswith(("'", '"', "`")):
                    vtype = "string"
                elif value_preview.startswith(("true", "false")):
                    vtype = "boolean"
                elif re.match(r"^\d", value_preview):
                    vtype = "number"
                elif value_preview.startswith("new "):
                    vtype = "instance"
                elif value_preview.startswith("function") or "=>" in value_preview:
                    vtype = "function"
                else:
                    vtype = "expression"
                result["globals"].append({
                    "name": name, "line": i, "kind": kind,
                    "value_preview": value_preview, "type": vtype
                })

    # --- 7. Function calls (cross-module) ---
    # Collect all function names defined in this file to exclude self-calls
    defined_names = set()
    for exp in result["window_exports"]:
        defined_names.add(exp["name"])
    for g in result["globals"]:
        defined_names.add(g["name"])
    # Also add function declarations
    for m in re.finditer(r"function\s+(\w+)\s*\(", cleaned):
        defined_names.add(m.group(1))
    for m in re.finditer(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(", cleaned):
        defined_names.add(m.group(1))

    # Find all identifier(...) calls
    call_pattern = r"(?:^|[^.\w])(\w+)\s*\("
    calls = set()
    for m in re.finditer(call_pattern, cleaned):
        name = m.group(1)
        if (
            name not in _JS_BUILTINS
            and name not in defined_names
            and not name[0].isupper()  # Skip constructors/Classes (PascalCase)
            and len(name) > 1
        ):
            calls.add(name)
    result["function_calls"] = sorted(calls)

    return result


def _find_event_target(content: str, pos: int) -> Optional[str]:
    """Look backwards from pos to find the nearest querySelector/getElementById
    to determine the event target element."""
    # Look back up to 200 chars
    lookback = content[max(0, pos - 200):pos]
    # Try querySelector first
    m = re.search(r"querySelector\(\s*['\"]([^'\"]+)['\"]", lookback)
    if m:
        return m.group(1)
    m = re.search(r"getElementById\(\s*['\"]([^'\"]+)['\"]", lookback)
    if m:
        return f"#{m.group(1)}"
    m = re.search(r"getElementsByClassName\(\s*['\"]([^'\"]+)['\"]", lookback)
    if m:
        return f".{m.group(1)}"
    return None


# ============================================================================
# HTML PARSER
# ============================================================================

class HTMLStructureParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = {
            "title": "",
            "scripts": [],
            "stylesheets": [],
            "templates": [],
            "ids": [],
            "forms": []
        }
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "title":
            self.in_title = True
        elif tag == "script" and attrs_dict.get("src"):
            self.result["scripts"].append(attrs_dict["src"])
        elif tag == "link" and attrs_dict.get("rel") == "stylesheet":
            self.result["stylesheets"].append(attrs_dict.get("href", ""))
        elif tag == "template" and attrs_dict.get("id"):
            self.result["templates"].append(attrs_dict["id"])
        elif tag == "form":
            self.result["forms"].append({
                "id": attrs_dict.get("id", ""),
                "action": attrs_dict.get("action", ""),
                "method": attrs_dict.get("method", "get")
            })

        if attrs_dict.get("id"):
            self.result["ids"].append(attrs_dict["id"])

    def handle_data(self, data):
        if self.in_title:
            self.result["title"] += data

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False


def parse_html_file(file_path: Path, content: str) -> Dict[str, Any]:
    """Parse HTML file for structure."""
    parser = HTMLStructureParser()
    try:
        parser.feed(content)
    except Exception as e:
        log.warning(f"HTML parse error in {file_path}: {e}")
    return parser.result


# ============================================================================
# CSS PARSER
# ============================================================================

def parse_css_file(file_path: Path, content: str) -> Dict[str, Any]:
    """Parse CSS file for selectors and imports."""
    result = {
        "imports": [],
        "selectors": {
            "classes": [],
            "ids": [],
            "elements": []
        }
    }

    # @import statements
    import_pattern = r"@import\s+url\(['\"]?([^'\")\s]+)['\"]?\)"
    for match in re.finditer(import_pattern, content):
        result["imports"].append(match.group(1))

    # Class selectors
    class_pattern = r"\.([a-zA-Z_][a-zA-Z0-9_-]*)"
    for match in re.finditer(class_pattern, content):
        result["selectors"]["classes"].append(match.group(1))

    # ID selectors
    id_pattern = r"#([a-zA-Z_][a-zA-Z0-9_-]*)"
    for match in re.finditer(id_pattern, content):
        result["selectors"]["ids"].append(match.group(1))

    # Element selectors (basic)
    element_pattern = r"(?:^|\s)([a-z]+)\s*[{,]"
    for match in re.finditer(element_pattern, content, re.MULTILINE):
        result["selectors"]["elements"].append(match.group(1))

    # Deduplicate
    for key in result["selectors"]:
        result["selectors"][key] = sorted(set(result["selectors"][key]))

    return result


# ============================================================================
# DEPENDENCY GRAPH BUILDER
# ============================================================================

def build_dependency_graph(files_data: Dict[str, Any], root: Path) -> Dict[str, Any]:
    """Build dependency graph from all file data."""
    graph = {}

    for rel_path, file_data in files_data.items():
        imports = []
        imported_by = []

        # Collect imports based on language
        if file_data.get("language") == "python":
            imports = file_data.get("parsed", {}).get("imports", []) + \
                     file_data.get("parsed", {}).get("imports_external", [])
        elif file_data.get("language") in ["javascript", "typescript"]:
            imports = file_data.get("parsed", {}).get("imports", [])
        elif file_data.get("language") == "html":
            # HTML imports scripts and stylesheets
            parsed = file_data.get("parsed", {})
            imports = parsed.get("scripts", []) + parsed.get("stylesheets", [])
        elif file_data.get("language") == "css":
            imports = file_data.get("parsed", {}).get("imports", [])

        graph[rel_path] = {
            "imports": imports,
            "imported_by": imported_by
        }

    # Build reverse index (imported_by)
    for rel_path, data in graph.items():
        for imp in data["imports"]:
            # Try to resolve import to actual file
            resolved = resolve_import(imp, rel_path, root, files_data)
            if resolved and resolved in graph:
                if rel_path not in graph[resolved]["imported_by"]:
                    graph[resolved]["imported_by"].append(rel_path)

    return graph


# ============================================================================
# JS CROSS-MODULE GRAPH
# ============================================================================

def build_js_cross_module_graph(files_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build cross-module dependency graph from js_deep data.

    Maps which JS files call functions defined in other JS files,
    producing a dependency graph for the frontend architecture.
    """
    # Step 1: Build a map of symbol -> defining file(s)
    symbol_providers: Dict[str, List[str]] = {}
    for rel_path, file_data in files_data.items():
        js_deep = file_data.get("js_deep")
        if not js_deep:
            continue
        # Window exports are the primary public API
        for exp in js_deep.get("window_exports", []):
            name = exp["name"]
            if name not in symbol_providers:
                symbol_providers[name] = []
            symbol_providers[name].append(rel_path)
        # Also track function declarations from parsed.symbols
        parsed = file_data.get("parsed", {})
        for func in parsed.get("symbols", {}).get("functions", []):
            name = func["name"]
            if name not in symbol_providers:
                symbol_providers[name] = []
            if rel_path not in symbol_providers[name]:
                symbol_providers[name].append(rel_path)

    # Step 2: For each file, find which function_calls resolve to other files
    graph: Dict[str, Any] = {}
    for rel_path, file_data in files_data.items():
        js_deep = file_data.get("js_deep")
        if not js_deep:
            continue

        calls = js_deep.get("function_calls", [])
        dependencies = {}  # dep_file -> [symbols called]
        for call_name in calls:
            providers = symbol_providers.get(call_name, [])
            for provider in providers:
                if provider != rel_path:
                    if provider not in dependencies:
                        dependencies[provider] = []
                    dependencies[provider].append(call_name)

        graph[rel_path] = {
            "calls_to": {dep: syms for dep, syms in sorted(dependencies.items())},
            "dependency_count": len(dependencies)
        }

    # Step 3: Build reverse index (called_by)
    for rel_path in graph:
        graph[rel_path]["called_by"] = []
    for rel_path, data in graph.items():
        for dep_file in data["calls_to"]:
            if dep_file in graph:
                if rel_path not in graph[dep_file]["called_by"]:
                    graph[dep_file]["called_by"].append(rel_path)

    return graph


def resolve_import(imp: str, from_file: str, root: Path, files_data: Dict) -> Optional[str]:
    """Try to resolve an import string to an actual file path."""
    # Skip stdlib/external Python imports (no path separators)
    if not imp.startswith(".") and not imp.startswith("/") and "/" not in imp:
        return None

    from_path = Path(from_file).parent

    # Handle relative imports
    if imp.startswith("."):
        # JavaScript relative import
        candidates = [
            from_path / imp,
            from_path / f"{imp}.js",
            from_path / f"{imp}.ts",
            from_path / imp / "index.js",
        ]
    elif imp.startswith("/"):
        # Absolute URL path (like /static/...) - try to resolve within project
        # Strip leading slash and treat as relative to root
        imp_relative = imp.lstrip("/")
        candidates = [
            root / imp_relative,
        ]
    else:
        # Other absolute paths
        candidates = [
            root / imp,
            root / f"{imp}.js",
            root / f"{imp}.ts",
        ]

    for candidate in candidates:
        try:
            if candidate.is_absolute():
                candidate_str = str(candidate.relative_to(root))
            else:
                candidate_str = str(candidate)
        except ValueError:
            continue
        if candidate_str in files_data:
            return candidate_str

    return None


# ============================================================================
# SYMBOL INDEX BUILDER
# ============================================================================

def build_symbol_index(files_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build flat symbol index across all files."""
    index = {}

    for rel_path, file_data in files_data.items():
        parsed = file_data.get("parsed", {})
        symbols = parsed.get("symbols", {})

        # Functions
        for func in symbols.get("functions", []):
            name = func["name"]
            if name not in index:
                index[name] = []
            index[name].append({
                "file": rel_path,
                "line": func["line"],
                "type": "function"
            })

        # Classes
        for cls in symbols.get("classes", []):
            name = cls["name"]
            if name not in index:
                index[name] = []
            index[name].append({
                "file": rel_path,
                "line": cls["line"],
                "type": "class"
            })

    return index


# ============================================================================
# MAIN INDEXER
# ============================================================================

def should_exclude(path: Path, exclude_dirs: Set[str], exclude_exts: Set[str]) -> bool:
    """Check if path should be excluded."""
    for part in path.parts:
        if part in exclude_dirs:
            return True
    if path.suffix.lower() in exclude_exts:
        return True
    return False


def get_file_metadata(file_path: Path) -> Dict[str, Any]:
    """Get file metadata."""
    stat = file_path.stat()
    return {
        "size_bytes": stat.st_size,
        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
    }


def get_git_commit(file_path: Path) -> Optional[str]:
    """Get last git commit hash for file."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%h", str(file_path)],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except:
        return None


def index_project(
    project_root: Path,
    exclude_dirs: Set[str],
    exclude_exts: Set[str]
) -> Dict[str, Any]:
    """Main indexing function."""

    # Collect all files
    all_files = []
    for root, dirs, files in os.walk(project_root):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]

        for file in files:
            file_path = Path(root) / file
            if not should_exclude(file_path, exclude_dirs, exclude_exts):
                all_files.append(file_path)

    log.info(f"Found {len(all_files)} files to index")

    # Initialize result structure
    result = {
        "metadata": {
            "project_root": str(project_root),
            "indexed_at": datetime.now().isoformat(),
            "total_files": len(all_files),
            "total_lines": 0,
            "languages": {}
        },
        "tree": {},
        "files": {},
        "html_pages": {},
        "modules": {},
        "symbols_index": {},
        "dependency_graph": {},
        "js_cross_module_graph": {}
    }

    # Process each file
    for file_path in all_files:
        rel_path = file_path.relative_to(project_root)
        ext = file_path.suffix.lower()
        language = LANGUAGE_MAP.get(ext, "unknown")

        log.info(f"Indexing {rel_path}")

        # Read file content
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            log.warning(f"Could not read {file_path}: {e}")
            continue

        lines = content.split("\n")
        line_count = len(lines)

        # Get metadata
        metadata = get_file_metadata(file_path)
        git_commit = get_git_commit(file_path)

        # Parse based on language
        parsed = {}
        if language == "python":
            parsed = parse_python_file(file_path, content)
        elif language in ["javascript", "typescript"]:
            parsed = parse_js_file(file_path, content)
        elif language == "html":
            parsed = parse_html_file(file_path, content)
        elif language == "css":
            parsed = parse_css_file(file_path, content)

        # Deep parse for frontend JS files
        js_deep = None
        if language == "javascript" and str(rel_path).startswith("frontend/js/"):
            js_deep = parse_js_deep(file_path, content)

        # Build file entry
        file_entry = {
            "path": str(rel_path),
            "language": language,
            "size_bytes": metadata["size_bytes"],
            "lines": line_count,
            "last_modified": metadata["last_modified"],
            "git_commit": git_commit,
            "parsed": parsed
        }
        if js_deep:
            file_entry["js_deep"] = js_deep

        result["files"][str(rel_path)] = file_entry

        # Track HTML pages separately
        if language == "html":
            result["html_pages"][str(rel_path)] = parsed

        # Update metadata
        result["metadata"]["total_lines"] += line_count
        result["metadata"]["languages"][language] = \
            result["metadata"]["languages"].get(language, 0) + 1

    # Build file tree
    result["tree"] = build_file_tree(project_root, all_files)

    # Build dependency graph
    result["dependency_graph"] = build_dependency_graph(result["files"], project_root)

    # Build symbol index
    result["symbols_index"] = build_symbol_index(result["files"])

    # Build JS cross-module graph
    result["js_cross_module_graph"] = build_js_cross_module_graph(result["files"])

    # Identify modules (directories with multiple related files)
    module_dirs = {}
    for rel_path in result["files"]:
        path = Path(rel_path)
        if len(path.parts) > 1:
            dir_path = str(path.parent)
            if dir_path not in module_dirs:
                module_dirs[dir_path] = []
            module_dirs[dir_path].append(rel_path)

    # Only include directories with 3+ files as modules
    for dir_path, files in module_dirs.items():
        if len(files) >= 3:
            result["modules"][dir_path] = {
                "files": files,
                "count": len(files)
            }

    return result


def write_folder_indexes(result: Dict[str, Any], project_root: Path) -> None:
    """Write per-folder JSON indexes to config/index-project/."""
    output_dir = project_root / "config" / "index-project"
    output_dir.mkdir(parents=True, exist_ok=True)

    files_data = result.get("files", {})
    symbols_index = result.get("symbols_index", {})
    js_graph = result.get("js_cross_module_graph", {})
    dep_graph = result.get("dependency_graph", {})

    for folder in FOLDER_INDEXES:
        # Collect files belonging to this folder
        folder_files = {}
        for rel_path, file_data in files_data.items():
            if rel_path.startswith(folder + "/") or rel_path == folder:
                folder_files[rel_path] = file_data

        # Build folder-specific tree
        folder_paths = [project_root / p for p in folder_files]
        folder_tree = build_file_tree(project_root, folder_paths)
        # Drill into the nested tree to get just the folder's subtree
        subtree = folder_tree
        for part in folder.split("/"):
            subtree = subtree.get(part, {})

        # Build folder-specific symbol index
        folder_symbols = {}
        for sym_name, occurrences in symbols_index.items():
            folder_occs = [o for o in occurrences if o["file"].startswith(folder + "/")]
            if folder_occs:
                folder_symbols[sym_name] = folder_occs

        # Build folder-specific dependency graph
        folder_dep_graph = {}
        for rel_path, data in dep_graph.items():
            if rel_path.startswith(folder + "/"):
                folder_dep_graph[rel_path] = data

        # Build folder-specific JS cross-module graph
        folder_js_graph = {}
        for rel_path, data in js_graph.items():
            if rel_path.startswith(folder + "/"):
                folder_js_graph[rel_path] = data

        # Build folder-specific HTML pages
        folder_html_pages = {}
        for rel_path, page_data in result.get("html_pages", {}).items():
            if rel_path.startswith(folder + "/"):
                folder_html_pages[rel_path] = page_data

        # Build folder-specific modules
        folder_modules = {}
        for mod_path, mod_data in result.get("modules", {}).items():
            if mod_path.startswith(folder + "/") or mod_path == folder:
                folder_modules[mod_path] = mod_data

        # Compute folder stats
        folder_lines = sum(f.get("lines", 0) for f in folder_files.values())
        folder_langs: Dict[str, int] = {}
        for f in folder_files.values():
            lang = f.get("language", "unknown")
            folder_langs[lang] = folder_langs.get(lang, 0) + 1

        folder_index = {
            "metadata": {
                "folder": folder,
                "indexed_at": result["metadata"]["indexed_at"],
                "total_files": len(folder_files),
                "total_lines": folder_lines,
                "languages": folder_langs
            },
            "tree": subtree,
            "files": folder_files,
            "html_pages": folder_html_pages,
            "modules": folder_modules,
            "symbols_index": folder_symbols,
            "dependency_graph": folder_dep_graph,
            "js_cross_module_graph": folder_js_graph
        }

        # Write folder JSON — use folder path as filename with slashes replaced
        filename = folder.replace("/", "__") + ".json"
        filepath = output_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(folder_index, f, indent=2, ensure_ascii=False)

        log.info(f"  {folder}: {len(folder_files)} files -> {filepath}")


def write_root_index(result: Dict[str, Any], project_root: Path) -> None:
    """Write the root project-index.json to the project root."""
    filepath = project_root / "project-index.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    log.info(f"Root index written to {filepath}")


def main():
    parser = argparse.ArgumentParser(
        description="Map and index a project into structured JSON"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Root directory of project to index"
    )
    parser.add_argument(
        "--exclude-dirs",
        type=str,
        nargs="*",
        default=list(EXCLUDE_DIRS_DEFAULT),
        help="Directories to exclude"
    )
    parser.add_argument(
        "--exclude-exts",
        type=str,
        nargs="*",
        default=list(EXCLUDE_EXTS_DEFAULT),
        help="File extensions to exclude"
    )
    parser.add_argument(
        "--push-to-qdrant", action="store_true",
        help="After building the index, push parsed code symbols into Qdrant as "
             "searchable documents in the 'olivia-dev-code' collection (Tier 1)."
    )

    args = parser.parse_args()

    log.info(f"Indexing project at {args.project_root}")

    result = index_project(
        args.project_root,
        set(args.exclude_dirs),
        set(args.exclude_exts)
    )

    # Write root index
    write_root_index(result, args.project_root)

    # Write per-folder indexes
    log.info("Writing folder indexes to config/index-project/")
    write_folder_indexes(result, args.project_root)

    log.info(f"Total files: {result['metadata']['total_files']}")
    log.info(f"Total lines: {result['metadata']['total_lines']}")
    log.info(f"Languages: {result['metadata']['languages']}")

    if args.push_to_qdrant:
        _push_to_qdrant(result, args.project_root)


def _push_to_qdrant(result: dict, project_root: Path) -> None:
    """Push parsed code symbols into Qdrant as searchable documents.

    Creates a temporary directory of structured text files (one per source
    file with symbols), then calls the ingestion service's ingest-directory
    to push them into the 'olivia-dev-code' collection.
    """
    import shutil
    import tempfile
    import urllib.parse
    import urllib.error

    ingestion_base = os.environ.get("INGESTION_BASE_URL", "http://127.0.0.1:8066")
    collection = "olivia-dev-code"

    files_data = result.get("files", {})
    if not files_data:
        log.warning("No file data to push to Qdrant.")
        return

    # Create temp directory with one text file per source directory
    tmpdir = Path(tempfile.mkdtemp(prefix="qdrant_code_index_"))
    doc_count = 0

    try:
        for file_key, fdata in files_data.items():
            parsed = fdata.get("parsed", {})
            if not parsed:
                continue

            ext = Path(file_key).suffix.lower()
            if ext not in {".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".sh", ".md"}:
                continue

            lines: list[str] = []
            lines.append(f"File: {file_key}")
            lines.append(f"Path: {file_key}")
            lines.append(f"Language: {fdata.get('language', 'unknown')}")
            lines.append("")

            # Functions (stored under parsed["symbols"]["functions"])
            symbols = parsed.get("symbols", {})
            funcs = symbols.get("functions", [])
            if funcs:
                lines.append("Functions:")
                for fn in funcs:
                    name = fn if isinstance(fn, str) else (fn.get("name", str(fn)) if isinstance(fn, dict) else str(fn))
                    ln = ""
                    if isinstance(fn, dict):
                        ln = f" (line {fn.get('line', '?')})" if fn.get("line") else ""
                    lines.append(f"  - {name}{ln}")
                lines.append("")

            # Classes (stored under parsed["symbols"]["classes"])
            classes = symbols.get("classes", [])
            if classes:
                lines.append("Classes:")
                for cls in classes:
                    name = cls if isinstance(cls, str) else (cls.get("name", str(cls)) if isinstance(cls, dict) else str(cls))
                    ln = ""
                    if isinstance(cls, dict):
                        ln = f" (line {cls.get('line', '?')})" if cls.get("line") else ""
                    lines.append(f"  - {name}{ln}")
                lines.append("")

            # Imports
            imports = parsed.get("imports", [])
            if imports:
                lines.append("Imports:")
                for imp in imports:
                    if isinstance(imp, dict):
                        lines.append(f"  - {imp.get('source', '')} → {', '.join(imp.get('names', []))}")
                    elif isinstance(imp, str):
                        lines.append(f"  - {imp}")
                    else:
                        lines.append(f"  - {str(imp)}")
                lines.append("")

            # API endpoints (JS deep parse — stored in js_deep key, not in parsed)
            js_deep = fdata.get("js_deep", {})
            api_endpoints = js_deep.get("api_endpoints", [])
            if api_endpoints:
                lines.append("API endpoints:")
                for ep in api_endpoints:
                    lines.append(f"  - {ep}")
                lines.append("")

            # Window exports (JS deep)
            window_exports = js_deep.get("window_exports", [])
            if window_exports:
                lines.append("Window exports:")
                for exp in window_exports:
                    lines.append(f"  - {exp.get('name', '?')} ({exp.get('type', '?')})")
                lines.append("")

            # HTML forms/IDs (stored as parsed["forms"] and parsed["ids"])
            forms = parsed.get("forms", [])
            if forms:
                lines.append("Forms:")
                for frm in forms:
                    fid = frm.get("id", "") if isinstance(frm, dict) else str(frm)
                    action = frm.get("action", "") if isinstance(frm, dict) else ""
                    lines.append(f"  - id={fid} action={action}")
                lines.append("")
            html_ids = parsed.get("ids", [])
            if html_ids:
                lines.append("Element IDs:")
                for hid in html_ids:
                    lines.append(f"  - {hid}")
                lines.append("")

            if len(lines) <= 5:  # header only, no real content
                continue

            # Write to a safe filename under tempdir
            safe_name = file_key.replace("/", "__").replace("\\", "__")
            doc_path = tmpdir / f"{safe_name}.md"
            doc_path.write_text("\n".join(lines), encoding="utf-8")
            doc_count += 1

        if doc_count == 0:
            log.info("No source files with parsed symbols found — nothing to push.")
            return

        log.info(f"Pushing {doc_count} code symbol documents to Qdrant collection '{collection}'...")

        url = f"{ingestion_base}/v1/ingestion/ingest-directory"
        qs = urllib.parse.quote(str(tmpdir), safe="")
        full_url = f"{url}?directory_path={qs}&collection_name={collection}&force_recreate=true"
        req = urllib.request.Request(full_url, data=b"", method="POST")
        req.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                resp_data = resp.read().decode("utf-8")
                log.info(f"Qdrant response: {resp_data[:300]}")
            log.info(f"✓ Code symbols pushed to '{collection}'")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            log.warning(f"HTTP {e.code} from ingestion API: {body[:300]}")
            log.warning("Code symbols were NOT pushed to Qdrant.")
        except Exception as e:
            log.warning(f"Failed to push code symbols to Qdrant: {e}")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()