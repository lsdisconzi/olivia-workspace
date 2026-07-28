#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified i18n Mapper for Olivia Workspace
========================================
Merges i18n_manager.py + agent_i18n_extractor.py into a single tool.
Scans HTML, JS, CSS, Python — extracts user-facing strings, assigns
semantic keys, and writes structured translation mapping files.

Usage:
    python i18n_mapper.py --project-root . --output-dir translations
    python i18n_mapper.py --project-root . --output-dir translations --tag-html
    python i18n_mapper.py --project-root . --output-dir translations --known-keys-only
"""

import os
import re
import json
import argparse
from pathlib import Path
from collections import OrderedDict
from bs4 import BeautifulSoup, NavigableString

# ── Configuration ────────────────────────────────────────────
EXCLUDE_DIRS = {
    ".git", "node_modules", "__pycache__", "venv", ".venv",
    "dist", "build", ".obsidian", "uploads", "_shared",
    "pluggins", "data", "generated", "static", "deploy",
    "desktop", "runtime", "content", "planning", "openclaude",
}

EXCLUDE_EXTS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".pdf",
    ".zip", ".exe", ".dll", ".so", ".bin", ".m4a", ".mp3", ".mp4",
    ".woff", ".woff2", ".ttf", ".eot", ".svg",
}

SCAN_EXTS = {".html", ".htm", ".js", ".ts", ".py", ".css", ".scss"}

MIN_TEXT_LENGTH = 3  # Minimum characters for a translatable string

# Existing KNOWN_KEYS from i18n_manager.py
KNOWN_KEYS = {
    "Olivia": "brandName",
    "Workspace": "brandSub",
    "Home": "navHome",
    "Architecture": "navArchitecture",
    "Mobile Agent": "navAgent",
    "Agents": "sidebarAgents",
    "Configuration": "sidebarConfig",
    "Documents": "sidebarDocs",
    "Shared Data (_shared)": "sidebarShared",
    "Legal Router": "sidebarLegalRouter",
    "Case Dossier": "sidebarCaseDossier",
    "Violations": "sidebarViolations",
    "Law Library": "sidebarLawLib",
    "Memory": "sidebarMemory",
    "History": "sidebarHistory",
    "Session Files": "sidebarFiles",
    "Projects": "sidebarProjects",
    "Case Builder": "sidebarCaseBuilder",
    "Studio": "sidebarStudio",
    "Descoberta": "sidebarDescoberta",
    "Listening": "sidebarListening",
    "API Explorer": "sidebarAPIExplorer",
    "Shaders": "sidebarShaders",
    "Spaces": "sidebarSpaces",
    "Craudio": "sidebarCraudio",
    "Drive": "sidebarDrive",
    "Assistant Olivia": "chatAgentName",
    "idle": "chatBadgeIdle",
    "route: detecting": "chatRuntimeRoute",
    "Thinking": "chatThinking",
    "Send": "sendButton",
    "Stop": "stopButton",
    "Add Context": "addContextLabel",
    "Export": "exportButton",
    "Clear": "clearChat",
    "Focus Mode": "focusMode",
    "Output Panel": "outputPanel",
    "Browser Panel": "browserPanel",
    "Session cost": "costBadge",
    "More options": "headerDots",
    "Model Selection": "modelSelection",
    "DeepSeek": "providerDeepSeek",
    "Anthropic": "providerAnthropic",
    "Ollama": "providerOllama",
    "API Key": "apiKeyLabel",
    "Model Temperature": "temperatureLabel",
    "Max response tokens": "maxTokensLabel",
    "Voice Configuration": "voiceConfigTitle",
    "Section Generator": "sectionGeneratorTitle",
    "New Project": "projectsNew",
    "Reload projects": "projectsReload",
    "Upload to Project": "projectsUpload",
    "View Files": "projectsViewFiles",
    "Open full view": "legalRouterOpen",
    "Clear All": "filesClearAll",
    "Search memory...": "memorySearchPlaceholder",
    "Save Config": "memorySaveConfig",
    "Save Current Conversation": "historySave",
    "Refresh": "memoryRefresh",
    "New Collection": "memoryCreateCollection",
}

# Reverse lookup: key -> english text
REVERSE_KNOWN = {v: k for k, v in KNOWN_KEYS.items()}

SKIP_TAGS_HTML = {'script', 'style', 'noscript', 'svg', 'path', 'circle',
                  'ellipse', 'g', 'defs', 'linearGradient', 'stop'}

# ── Helpers ──────────────────────────────────────────────────

def is_skip_text(text: str) -> bool:
    text = text.strip()
    # Minimum length
    if len(text) < MIN_TEXT_LENGTH:
        return True
    # Template literals / JS interpolation: ${...}
    if "${" in text:
        return True
    # JS string concatenation fragments: starts with +, ends with +
    if text.startswith("+ ") or text.startswith("+"):
        return True
    # Just punctuation / symbols
    if re.match(r"^[\s\.\-\*\/,\(\)\[\]!@#%^&+=:;\"'<>?|\\~`$]+$", text):
        return True
    # CSS selectors: .class, #id
    if text.startswith(".") or text.startswith("#"):
        # Allow if it contains a space (multi-word), not just CSS
        if " " not in text:
            return True
    # Numbers only
    if re.match(r"^[\d\.\(\)]+$", text):
        return True
    # Alphanumeric only (env vars, identifiers)
    if re.match(r"^[A-Za-z0-9_\-]+$", text):
        return True
    # URLs
    if re.match(r"^(http|https|ftp|mailto|tel):", text):
        return True
    # HTML entities
    if re.match(r"^&[a-z]+;$", text):
        return True
    # CSS at-rules, brackets
    if re.match(r"^\s*[@\{\}]", text):
        return True
    # CSS pixel values
    if re.match(r"^\s*\d+px", text):
        return True
    return False


def clean_key(text: str) -> str:
    key = re.sub(r'[^\w\s]', '', text).strip()
    key = re.sub(r'\s+', '_', key).lower()
    if not key:
        return 'unnamed'
    if len(key) > 60:
        key = key[:60].rstrip('_')
    return key


def make_namespaced_key(base_ns: str, text: str, used_keys: set) -> str:
    """Generate a semantic key, preferring KNOWN_KEYS lookup first."""
    # Check if text is in KNOWN_KEYS
    if text.strip() in KNOWN_KEYS:
        return KNOWN_KEYS[text.strip()]

    text_key = clean_key(text)
    full = f"{base_ns}.{text_key}" if base_ns else text_key

    # Deduplicate
    original = full
    suffix = 1
    while full in used_keys:
        full = f"{original}_{suffix}"
        suffix += 1
    used_keys.add(full)
    return full


def get_base_ns(filepath: Path, project_root: Path) -> str:
    """Derive namespace from relative path, e.g. frontend/chat.js -> frontend.chat"""
    try:
        rel = filepath.relative_to(project_root)
    except ValueError:
        return filepath.stem
    parts = rel.parts
    if len(parts) >= 2:
        return f"{parts[-2]}.{Path(parts[-1]).stem}"
    return Path(parts[-1]).stem


# ── Extractors ───────────────────────────────────────────────

def extract_html(filepath: Path, project_root: Path, used_keys: set) -> list:
    entries = []
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return entries

    soup = BeautifulSoup(content, 'html.parser')
    base_ns = get_base_ns(filepath, project_root)

    # Text nodes
    for tag in soup.find_all(True):
        if tag.name in SKIP_TAGS_HTML:
            continue
        # Skip if already data-i18n
        if tag.get('data-i18n'):
            continue
        for child in tag.children:
            if isinstance(child, NavigableString):
                text = child.strip()
                if text and len(text) > 1 and not is_skip_text(text):
                    key = make_namespaced_key(base_ns, text, used_keys)
                    entries.append((key, text, f"{filepath}:{getattr(child, 'sourceline', '?')}"))

    # Attributes: placeholder, aria-label, title, alt
    for tag in soup.find_all(True):
        if tag.name in SKIP_TAGS_HTML:
            continue
        for attr in ['placeholder', 'aria-label', 'title', 'alt']:
            val = tag.get(attr)
            if val and not is_skip_text(val):
                # Check KNOWN_KEYS first
                if val.strip() in KNOWN_KEYS:
                    key = KNOWN_KEYS[val.strip()]
                else:
                    tag_id = tag.get('id', '')
                    attr_ns = f"{base_ns}.{tag_id}.{attr}" if tag_id else f"{base_ns}.{attr}"
                    key = make_namespaced_key(attr_ns, val, used_keys)
                entries.append((key, val, f"{filepath}:{getattr(tag, 'sourceline', '?')}"))

    return entries


def extract_js(filepath: Path, project_root: Path, used_keys: set) -> list:
    entries = []
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return entries

    base_ns = get_base_ns(filepath, project_root)

    # 1) t('key', 'default') calls
    for m in re.finditer(r"t\(\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]", content):
        key, default = m.group(1), m.group(2)
        if not is_skip_text(default):
            entries.append((key, default, f"{filepath}:{content[:m.start()].count(chr(10))+1}"))

    # 2) t('key') calls (no default)
    for m in re.finditer(r"t\(\s*['\"]([^'\"]+)['\"]\s*\)", content):
        key = m.group(1)
        # If key is in REVERSE_KNOWN, use that text; else use key as text
        text = REVERSE_KNOWN.get(key, key)
        if not is_skip_text(text):
            entries.append((key, text, f"{filepath}:{content[:m.start()].count(chr(10))+1}"))

    # 3) Hardcoded textContent / innerText / innerHTML
    for m in re.finditer(r"\.(?:textContent|innerText|innerHTML)\s*=\s*['\"]([^'\"]+)['\"]", content):
        text = m.group(1)
        if not is_skip_text(text):
            key = make_namespaced_key(f"{base_ns}.js", text, used_keys)
            entries.append((key, text, f"{filepath}:{content[:m.start()].count(chr(10))+1}"))

    # 4) alert / toast / console messages
    for pattern, tag in [
        (r"alert\(\s*['\"]([^'\"]+)['\"]", "alert"),
        (r"showToast\(\s*['\"]([^'\"]+)['\"]", "toast"),
        (r"showNotification\(\s*['\"]([^'\"]+)['\"]", "notification"),
    ]:
        for m in re.finditer(pattern, content):
            text = m.group(1)
            if not is_skip_text(text):
                key = make_namespaced_key(f"{base_ns}.{tag}", text, used_keys)
                entries.append((key, text, f"{filepath}:{content[:m.start()].count(chr(10))+1}"))

    return entries


def extract_python(filepath: Path, project_root: Path, used_keys: set) -> list:
    entries = []
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return entries

    # t('key', 'default') calls
    for m in re.finditer(r"t\(\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]", content):
        key, default = m.group(1), m.group(2)
        if not is_skip_text(default):
            entries.append((key, default, f"{filepath}:{content[:m.start()].count(chr(10))+1}"))

    return entries


def extract_css(filepath: Path, project_root: Path, used_keys: set) -> list:
    entries = []
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return entries

    base_ns = get_base_ns(filepath, project_root)

    # content: "text" or content: 'text'
    for i, m in enumerate(re.finditer(r"content:\s*['\"]([^'\"]+)['\"]", content)):
        text = m.group(1).strip()
        if text and not is_skip_text(text):
            key = make_namespaced_key(f"{base_ns}.css", text, used_keys)
            entries.append((key, text, f"{filepath} (CSS content #{i})"))

    return entries


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Unified i18n Mapper for Olivia Workspace")
    parser.add_argument("--project-root", default=".", type=Path,
                        help="Project root directory")
    parser.add_argument("--output-dir", default="translations", type=Path,
                        help="Folder where translation mapping files will be written")
    parser.add_argument("--tag-html", action="store_true",
                        help="Modify HTML files in-place to add data-i18n attributes")
    parser.add_argument("--known-keys-only", action="store_true",
                        help="Only extract strings present in KNOWN_KEYS dictionary")
    args = parser.parse_args()

    project_root = args.project_root.resolve()
    output_dir = project_root / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Collect files
    all_files = []
    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in SCAN_EXTS and ext not in EXCLUDE_EXTS:
                all_files.append(Path(root) / f)

    print(f"🔍 Scanning {len(all_files)} files...")
    used_keys = set(REVERSE_KNOWN.keys())

    # 2. Extract strings
    mapping = []  # list of {key, english, source, file}
    stats = {"html": 0, "js": 0, "py": 0, "css": 0}

    for filepath in all_files:
        ext = filepath.suffix.lower()
        try:
            if ext == ".html":
                entries = extract_html(filepath, project_root, used_keys)
                stats["html"] += 1
            elif ext in {".js", ".ts"}:
                entries = extract_js(filepath, project_root, used_keys)
                stats["js"] += 1
            elif ext == ".py":
                entries = extract_python(filepath, project_root, used_keys)
                stats["py"] += 1
            elif ext in {".css", ".scss"}:
                entries = extract_css(filepath, project_root, used_keys)
                stats["css"] += 1
            else:
                continue

            for key, text, source in entries:
                if args.known_keys_only and key not in KNOWN_KEYS.values() and key not in KNOWN_KEYS:
                    continue
                mapping.append({
                    "key": key,
                    "english": text,
                    "source": source,
                    "file": str(filepath.relative_to(project_root))
                })
        except Exception as e:
            print(f"  ⚠ Error processing {filepath}: {e}")

    print(f"📊 Files processed: HTML={stats['html']} JS={stats['js']} Python={stats['py']} CSS={stats['css']}")
    print(f"📝 Extracted {len(mapping)} string entries")

    # 3. Build master mapping
    master = OrderedDict()
    for item in mapping:
        key = item["key"]
        if key not in master:
            master[key] = {"english": item["english"], "sources": []}
        if item["source"] not in master[key]["sources"]:
            master[key]["sources"].append(item["source"])

    # 4. Write en.json (master index)
    en_dict = {k: v["english"] for k, v in master.items()}
    en_path = output_dir / "en.json"
    with open(en_path, "w", encoding="utf-8") as f:
        json.dump(en_dict, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"  ✅ en.json — {len(en_dict)} keys")

    # 5. Write mapping_report.json
    report_path = output_dir / "mapping_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"  ✅ mapping_report.json — {len(master)} entries with source details")

    # 6. Sync / create language files
    lang_dir = project_root / "frontend" / "languages"
    lang_map = {
        "english": "en",
        "portuguese": "pt-BR",
        "spanish": "es",
        "italian": "it",
        "french": "fr",
        "german": "de",
        "greek": "el",
        "albanian": "sq",
        "czech": "cs",
        "polish": "pl",
        "thai": "th",
    }

    synced = 0
    for lang_name, lang_code in lang_map.items():
        lang_file = lang_dir / f"{lang_name}.index.json"
        out_lang_file = output_dir / f"{lang_code}.json"

        if lang_file.exists():
            with open(lang_file, "r", encoding="utf-8") as f:
                try:
                    lang_data = json.load(f)
                except json.JSONDecodeError:
                    lang_data = {}

            # Add missing keys with English fallback
            added = 0
            for key in en_dict:
                if key not in lang_data:
                    lang_data[key] = en_dict[key]
                    added += 1
            print(f"  ➕ Synced {lang_name} ({lang_code}): {added} missing keys added")
        else:
            lang_data = dict(en_dict)
            print(f"  🆕 Created {lang_name} ({lang_code}) from English template")

        with open(out_lang_file, "w", encoding="utf-8") as f:
            json.dump(lang_data, f, indent=2, ensure_ascii=False, sort_keys=True)
        synced += 1

    print(f"\n  ✅ Synced/Created {synced} language files")

    # 7. Optional HTML tagging
    if args.tag_html:
        print("\n⚠  --tag-html mode: Modifying HTML files in-place...")
        tagged = 0
        html_files = [f for f in all_files if f.suffix.lower() == ".html"]
        for filepath in html_files:
            try:
                content = filepath.read_text(encoding='utf-8', errors='ignore')
                soup = BeautifulSoup(content, 'html.parser')
                modified = False
                for tag in soup.find_all(True):
                    if tag.name in SKIP_TAGS_HTML:
                        continue
                    text = tag.get_text(strip=True)
                    if text and len(text) > 1 and not tag.get('data-i18n'):
                        if text in KNOWN_KEYS:
                            tag['data-i18n'] = KNOWN_KEYS[text]
                            modified = True
                if modified:
                    filepath.write_text(str(soup), encoding='utf-8')
                    tagged += 1
                    print(f"  🏷  Tagged {filepath.relative_to(project_root)}")
            except Exception as e:
                print(f"  ⚠ Error tagging {filepath}: {e}")
        print(f"  ✅ Tagged {tagged} HTML files")

    print(f"\n{'='*50}")
    print(f"✅ Done. All outputs in: {output_dir}/")
    print(f"   • en.json              — {len(en_dict)} keys")
    print(f"   • mapping_report.json  — {len(master)} entries with source map")
    print(f"   • language files       — {synced} languages")
    if args.tag_html:
        print(f"   • HTML files tagged    — {tagged} files")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
