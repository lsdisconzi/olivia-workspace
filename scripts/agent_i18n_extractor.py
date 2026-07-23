#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import json
import hashlib
from bs4 import BeautifulSoup

# ------------------------------------------------------------
# 1. Key generation (mirrors i18n_manager.py)
# ------------------------------------------------------------
def generate_key(text, used_keys):
    """Create a clean key from text; avoid duplicates by suffixing."""
    key = re.sub(r'[^\w\s]', '', text).strip()
    key = re.sub(r'\s+', '_', key).lower()
    if not key:
        key = 'unnamed'
    if len(key) > 50:
        key = key[:50]
    # Avoid collision
    original = key
    suffix = 1
    while key in used_keys:
        key = f"{original}_{suffix}"
        suffix += 1
    used_keys.add(key)
    return key

# ------------------------------------------------------------
# 2. HTML text extraction & replacement
# ------------------------------------------------------------
def extract_and_tag_html(html_content, used_keys):
    """
    Parse HTML, wrap each text node (excluding script/style etc.)
    with <span data-i18n="...">, and return the modified HTML and
    a dictionary {key: original_text}.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    extracted = {}

    # Tags whose content should not be touched
    SKIP_TAGS = {'script', 'style', 'noscript', 'svg', 'path', 'circle',
                 'ellipse', 'g', 'defs', 'linearGradient', 'stop'}

    def process_node(node):
        """Recursively traverse and replace text nodes."""
        if node.name in SKIP_TAGS:
            return
        if isinstance(node, str):
            # Text node – trim whitespace
            text = node.strip()
            if not text or len(text) < 2:
                return
            # Only wrap if it's not already inside a data-i18n span
            parent = node.parent
            if parent and parent.name == 'span' and parent.get('data-i18n'):
                return
            # Create key
            key = generate_key(text, used_keys)
            extracted[key] = text
            # Wrap with span
            span = soup.new_tag('span')
            span['data-i18n'] = key
            span.string = text
            node.replace_with(span)
        else:
            # Element node – process children
            for child in list(node.children):
                process_node(child)

    # Process root children
    for child in list(soup.children):
        process_node(child)

    return str(soup), extracted

# ------------------------------------------------------------
# 3. Extract strings from JavaScript (inside <script>)
# ------------------------------------------------------------
def extract_js_strings(html_content, used_keys):
    """
    Extract translatable strings from JavaScript:
    - Placeholders (e.g. placeholder="...")
    - Button texts, labels inside script (e.g. TOPIC_QUERIES values,
      alert messages, etc.)
    We use a simple regex to find string literals in the script content.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    extracted = {}
    # Find all script tags with content
    for script in soup.find_all('script'):
        if not script.string:
            continue
        js = script.string

        # Match single- or double-quoted strings (non-greedy)
        # Avoid matching HTML attributes or comments
        pattern = r'(["\'])((?:(?!\1).)*?)\1'
        matches = re.findall(pattern, js)
        for quote, content in matches:
            # Skip very short or non‑human strings
            if len(content) < 3:
                continue
            # Exclude strings that look like code, URLs, or numbers
            if re.match(r'^[\d\.]+$', content):
                continue
            if content.startswith(('http', 'data:', 'mailto:', 'tel:')):
                continue
            if content.startswith(('#', '.', '[')):   # likely CSS selectors or JSON keys
                continue
            # We only want natural language – heuristic: contains a space or a non‑ASCII char
            if ' ' not in content and not re.search(r'[^\x00-\x7F]', content):
                continue
            # Avoid duplicates
            key = generate_key(content, used_keys)
            extracted[key] = content
    return extracted

# ------------------------------------------------------------
# 4. Main
# ------------------------------------------------------------
def main():
    html_file = 'frontend/agent.html'               # adjust path if needed
    output_json = 'frontend/languages/pages/agent.english.index.json'
    modified_html = 'frontend/agent_i18n.html'      # or overwrite original

    used_keys = set()
    all_extracted = {}

    print(f"📄 Processing {html_file} ...")
    with open(html_file, 'r', encoding='utf-8') as f:
        raw_html = f.read()

    # 4a. Process HTML text nodes
    modified_html_content, html_extracted = extract_and_tag_html(raw_html, used_keys)
    all_extracted.update(html_extracted)

    # 4b. Process JavaScript strings
    js_extracted = extract_js_strings(raw_html, used_keys)
    all_extracted.update(js_extracted)

    # 4c. Write modified HTML (optional)
    with open(modified_html, 'w', encoding='utf-8') as f:
        f.write(modified_html_content)
    print(f"✅ Modified HTML saved to {modified_html}")

    # 4d. Write JSON dictionary
    # Sort keys for readability
    sorted_dict = dict(sorted(all_extracted.items()))
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(sorted_dict, f, indent=2, ensure_ascii=False)
    print(f"💾 JSON saved to {output_json} with {len(sorted_dict)} keys.")

    # Optional: print a few examples
    print("\nSample keys:")
    for k, v in list(sorted_dict.items())[:5]:
        print(f"  {k} → {v}")

if __name__ == '__main__':
    main()