#!/usr/bin/env python3
"""Build a NETIFY-ready drop-in bundle for the requested LA8159 I-002 transcript set.

This script copies the already-rendered transcript pages and associated assets into a
clean folder that can be dropped directly into a NETIFY static site while preserving
working audio playback and embedded notes/violations.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import quote

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "I-002"
SOURCE_RENDERED_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "transcripts_rendered" / "I-002"
SOURCE_RENDERED_ROOT = REPO_ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "transcripts_rendered"
VIOLATION_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "01-violations" / "_json"

def discover_rendered_pages() -> list[Path]:
    pages = sorted(SOURCE_RENDERED_DIR.glob("*.html"))
    return [page for page in pages if page.is_file()]


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")


def resolve_page_audio_paths(page_path: Path, audio_map: dict) -> list[str]:
    text = page_path.read_text(encoding="utf-8", errors="ignore")
    raw_key = re.search(r'data-audio-map-key="([^"]+)"', text)
    raw_stem = re.search(r'data-audio-stem="([^"]+)"', text)
    candidates = []
    if raw_key:
        candidates.append(raw_key.group(1))
    if raw_stem:
        candidates.append(raw_stem.group(1))

    normalized_candidates = {normalize_key(c) for c in candidates if c}
    for candidate in candidates:
        if candidate in audio_map:
            segment_map = audio_map[candidate]
            if isinstance(segment_map, dict):
                values = []
                for value in segment_map.values():
                    if isinstance(value, str):
                        values.append(value)
                    elif isinstance(value, list):
                        values.extend(str(v) for v in value)
                return values
            if isinstance(segment_map, list):
                return [str(v) for v in segment_map]
            if isinstance(segment_map, str):
                return [segment_map]

    for map_key, map_value in audio_map.items():
        if normalize_key(map_key) in normalized_candidates:
            if isinstance(map_value, dict):
                values = []
                for value in map_value.values():
                    if isinstance(value, str):
                        values.append(value)
                    elif isinstance(value, list):
                        values.extend(str(v) for v in value)
                return values
            if isinstance(map_value, list):
                return [str(v) for v in map_value]
            if isinstance(map_value, str):
                return [map_value]

    return []


def copy_generated_audio(audio_map_path: Path, output_dir: Path) -> None:
    with open(audio_map_path, "r", encoding="utf-8") as handle:
        audio_map = json.load(handle)

    audio_output = output_dir / "audio"
    audio_output.mkdir(parents=True, exist_ok=True)

    for page_path in discover_rendered_pages():
        audio_paths = resolve_page_audio_paths(page_path, audio_map)
        if not audio_paths:
            continue

        transcript_audio_dir = audio_output / page_path.stem
        transcript_audio_dir.mkdir(parents=True, exist_ok=True)

        for source_value in audio_paths:
            source_path = REPO_ROOT / str(source_value).lstrip("/")
            if not source_path.exists():
                candidate = REPO_ROOT / source_value
                if candidate.exists():
                    source_path = candidate
                else:
                    continue
            dest = transcript_audio_dir / source_path.name
            if not dest.exists():
                shutil.copy2(source_path, dest)


def patch_html_for_dropin(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        'src="/case_files/02-transcripts/transcripts_rendered/audio_player.js"',
        'src="../audio_player.js"',
    )
    text = text.replace(
        'src="/case_files/02-transcripts/transcripts_rendered/audio_map.json"',
        'src="../audio_map.json"',
    )
    text = text.replace(
        '<script src="/case_files/02-transcripts/transcripts_rendered/audio_player.js"></script>',
        '<script src="../audio_player.js"></script>',
    )

    text = re.sub(
        r"(?s)<!-- Audio Player Bar -->.*?\n\s*<script>\s*\(function\(\)\s*\{.*?console\.log\('Narrative audio player initialized\.[^']*'\);\s*\}\)\(\);\s*</script>\s*</body>",
        "<!-- Audio Player Bar -->\n\n    <script src=\"../audio_player.js\"></script>\n\n</body>",
        text,
    )
    path.write_text(text, encoding="utf-8")


def build_index(output_dir: Path) -> None:
    transcript_dir = output_dir / "transcripts"
    rendered_links = []
    normalized_links = []

    for html_path in sorted(transcript_dir.glob("*.html")):
        name = html_path.name
        label = html.unescape(name.rsplit(".html", 1)[0].replace("_", " "))
        href = f"transcripts/{quote(name)}"

        if name.startswith("I-002_"):
            normalized_links.append(f'<li><a href="{href}">{html.escape(label)}</a></li>')
        else:
            rendered_links.append(f'<li><a href="{href}">{html.escape(label)}</a></li>')

    html_doc = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LA8159 I-002 Bundle Index</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; background: #f7f5f2; color: #1e1f23; margin: 0; padding: 32px; }}
    .wrap {{ max-width: 1100px; margin: 0 auto; }}
    h1 {{ font-size: 2rem; margin-bottom: 8px; }}
    h2 {{ font-size: 1.3rem; margin-top: 28px; margin-bottom: 12px; }}
    p {{ color: #4d5360; margin-bottom: 20px; }}
    ul {{ list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }}
    li {{ background: white; border: 1px solid #e0dbd2; border-radius: 6px; padding: 10px 12px; }}
    a {{ color: #224b72; text-decoration: none; font-weight: 600; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
<div class="wrap">
  <h1>LA8159 I-002 Evidence Bundle</h1>
  <p>Ready-to-drop static archive for the rendered transcript pages, local audio assets, and violation metadata for the I-002 record.</p>

  <h2>Rendered transcript pages</h2>
  <ul>
    {''.join(rendered_links)}
  </ul>

  <h2>Normalized / bundle pages</h2>
  <ul>
    {''.join(normalized_links)}
  </ul>
</div>
</body>
</html>
'''
    (output_dir / "index.html").write_text(html_doc, encoding="utf-8")


def copy_violation_payloads(output_dir: Path) -> None:
    violations_target = output_dir / "violations"
    if VIOLATION_DIR.exists():
        shutil.copytree(VIOLATION_DIR, violations_target, dirs_exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a NETIFY bundle ready for direct drop-in for the LA8159 I-002 transcript set.")
    parser.add_argument("--output-dir", required=True, help="Directory to write the drop-in bundle")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    transcripts_dir = output_dir / "transcripts"
    transcripts_dir.mkdir(parents=True, exist_ok=True)

    rendered_pages = discover_rendered_pages()
    if not rendered_pages:
        raise FileNotFoundError(f"No rendered HTML pages found in {SOURCE_RENDERED_DIR}")

    for page_path in rendered_pages:
        target_html = transcripts_dir / page_path.name
        shutil.copy2(page_path, target_html)
        patch_html_for_dropin(target_html)

    audio_map_path = SOURCE_RENDERED_ROOT / "audio_map.json"
    if audio_map_path.exists():
        shutil.copy2(audio_map_path, output_dir / "audio_map.json")
        copy_generated_audio(audio_map_path, output_dir)
    else:
        raise FileNotFoundError("Missing audio_map.json in rendered transcript directory")

    player_source = SOURCE_RENDERED_ROOT / "audio_player.js"
    if player_source.exists():
        shutil.copy2(player_source, output_dir / "audio_player.js")

    copy_violation_payloads(output_dir)
    build_index(output_dir)

    print(f"Drop-in bundle created: {output_dir}")
    print(f"Transcript pages: {len(list(transcripts_dir.glob('*.html')))}")
    print(f"Audio files copied: {len(list((output_dir / 'audio').rglob('*.wav')))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
