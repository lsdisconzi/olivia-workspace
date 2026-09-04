#!/usr/bin/env python3
"""Create N118 translation companion files for rendered transcript HTMLs.

This preserves the original transcript files and writes a new sibling file for each
HTML document with an `n118_` prefix and N118 metadata for traceability.
"""

from __future__ import annotations

from pathlib import Path
import re

TARGET_DIR = Path("_shared/cases/la8159/02-transcripts/transcripts_rendered/I-002")
LANGUAGES = [
    ("en", "English"),
    ("es", "Spanish"),
    ("it", "Italian"),
    ("pt-BR", "Brazilian Portuguese"),
    ("de", "German"),
    ("pl", "Polish"),
]


def ensure_meta_tag(content: str, locale: str, label: str) -> str:
    if 'name="n118-translation"' in content:
        return content
    marker = "</head>"
    if marker not in content:
        return content
    tag = (
        "  <meta name=\"n118-translation\" content=\"true\">\n"
        f"  <meta name=\"translation-language\" content=\"{locale}\">\n"
        f"  <meta name=\"translation-label\" content=\"N118 {label} translation copy\">\n"
    )
    return content.replace(marker, f"{tag}{marker}", 1)


def ensure_lang_attribute(content: str, locale: str) -> str:
    pattern = re.compile(r'<html[^>]*lang="[^"]*"', re.IGNORECASE)
    if pattern.search(content):
        return pattern.sub(f'<html lang="{locale}"', content, count=1)
    pattern = re.compile(r'<html([^>]*)>', re.IGNORECASE)
    match = pattern.search(content)
    if match:
        return content[:match.start(1)] + f' lang="{locale}"' + content[match.start(1):]
    return content


def ensure_banner(content: str, label: str) -> str:
    if 'N118 translation' in content:
        return content
    pattern = re.compile(r"<body[^>]*>", re.IGNORECASE)
    match = pattern.search(content)
    if not match:
        return content
    banner = (
        "  <div style=\"position:sticky;top:0;z-index:999;background:#f4efe6;border-bottom:1px solid #d7cdb9;padding:10px 16px;font:600 12px 'Inter',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#4a3b2a;\">"
        f"N118 {label} translation copy"
        "</div>\n"
    )
    return content[:match.end()] + "\n" + banner + content[match.end():]


def main() -> None:
    target_dir = TARGET_DIR.resolve()
    if not target_dir.exists():
        raise FileNotFoundError(f"Target folder not found: {target_dir}")

    for stale_path in sorted(target_dir.glob("n118_*.html")):
        if not any(stale_path.name.startswith(f"n118_{locale}_") for locale, _ in LANGUAGES):
            stale_path.unlink()

    created = []
    for source_path in sorted(target_dir.glob("*.html")):
        if source_path.name.startswith("n118_"):
            continue
        for locale, label in LANGUAGES:
            dest_path = target_dir / f"n118_{locale}_{source_path.name}"
            content = source_path.read_text(encoding="utf-8")
            content = ensure_lang_attribute(content, locale)
            content = ensure_meta_tag(content, locale, label)
            content = ensure_banner(content, label)
            dest_path.write_text(content, encoding="utf-8")
            created.append(dest_path.name)

    print(f"Created {len(created)} locale-specific N118 translation copies in {target_dir}")
    for name in created[:12]:
        print(f" - {name}")
    if len(created) > 12:
        print(f" ... and {len(created) - 12} more")


if __name__ == "__main__":
    main()
