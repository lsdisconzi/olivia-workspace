#!/usr/bin/env python3
"""Regenerate audio_map.json from live segment folders and rendered transcript page metadata."""
import json
import re
import sys
from pathlib import Path

ROOT = Path("_shared/cases/la8159")
AUDIO_ROOT = ROOT / "10-audio"
RENDERED_DIR = ROOT / "02-transcripts" / "transcripts_rendered" / "I-002"
MAP_PATH = ROOT / "02-transcripts" / "transcripts_rendered" / "audio_map.json"


def normalize_key(value):
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")


def add_mapping(new_map, key, mapping):
    if not key:
        return
    clean = normalize_key(key)
    if clean and mapping:
        new_map[clean] = mapping


def mapping_for_folder(folder: Path):
    seg_dir = folder / "audio_segments"
    wavs = sorted(seg_dir.glob("*.wav")) if seg_dir.exists() else []
    if not wavs:
        return None
    return {str(i): f"_shared/cases/la8159/10-audio/{folder.name}/audio_segments/{w.name}" for i, w in enumerate(wavs)}


def add_folder_aliases(new_map, folder: Path, mapping):
    folder_stem = folder.name.replace("_segments_all", "")
    add_mapping(new_map, folder_stem, mapping)

    m = re.search(r"stg[_-]?([0-9]+)", folder_stem, re.IGNORECASE)
    if m and "latam_stg_" not in folder_stem.lower():
        add_mapping(new_map, f"aeropuerto_stg_{m.group(1)}", mapping)

    if "latam_stg_" in folder_stem.lower():
        add_mapping(new_map, folder_stem.lower(), mapping)
        add_mapping(new_map, normalize_key(folder_stem.lower().replace("i_002_", "")), mapping)
        match = re.search(r"latam_stg[_-]?([0-9]+)", folder_stem, re.IGNORECASE)
        if match:
            add_mapping(new_map, f"latam_stg_{match.group(1)}", mapping)

    if "carabineros" in folder_stem.lower():
        add_mapping(new_map, folder_stem.lower(), mapping)
        match = re.search(r"carabineros[_-].*?([0-9]+)$", folder_stem, re.IGNORECASE)
        if match:
            add_mapping(new_map, f"carabineros_ppdartnel_{match.group(1)}", mapping)

    if "terminal_internacional_t2" in folder_stem.lower():
        add_mapping(new_map, "terminal_internacional_t2", mapping)

    if "dgac" in folder_stem.lower() or "self_narration" in folder_stem.lower():
        add_mapping(new_map, normalize_key(folder_stem), mapping)


def add_rendered_page_aliases(new_map):
    if not RENDERED_DIR.exists():
        return

    for page in sorted(RENDERED_DIR.glob("*.html")):
        text = page.read_text(encoding="utf-8", errors="ignore")
        body = re.search(r'<body[^>]*data-audio-map-key="([^"]+)"', text, re.IGNORECASE)
        stem = re.search(r'<body[^>]*data-audio-stem="([^"]+)"', text, re.IGNORECASE)
        if not body and not stem:
            continue

        page_map_key = body.group(1) if body else None
        page_stem = stem.group(1) if stem else None

        for candidate in [page_map_key, page_stem]:
            if not candidate:
                continue
            add_mapping(new_map, candidate, new_map.get(normalize_key(candidate), {}))

        if page_map_key and page_map_key in new_map:
            add_mapping(new_map, page_map_key, new_map[normalize_key(page_map_key)])

        if page_stem:
            normalized_stem = normalize_key(page_stem)
            if normalized_stem in new_map:
                add_mapping(new_map, page_map_key or page_stem, new_map[normalized_stem])

            m = re.search(r"stg[_-]?([0-9]+)", page_stem, re.IGNORECASE)
            if m:
                add_mapping(new_map, f"aeropuerto_stg_{m.group(1)}", new_map.get(f"aeropuerto_stg_{m.group(1)}", {}))

            if "terminal_internacional_t2" in page_stem.lower():
                add_mapping(new_map, "terminal_internacional_t2", new_map.get("terminal_internacional_t2", {}))

            if "self_narration" in page_stem.lower() or "dgac" in page_stem.lower():
                add_mapping(new_map, normalized_stem, new_map.get(normalized_stem, {}))


def regenerate_audio_map():
    if not AUDIO_ROOT.exists():
        print(f"⚠  Audio case directory not found: {AUDIO_ROOT}", file=sys.stderr)
        return False

    new_map = {}

    for folder in sorted(AUDIO_ROOT.iterdir()):
        if not folder.is_dir() or not folder.name.endswith("_segments_all"):
            continue
        mapping = mapping_for_folder(folder)
        if mapping is None:
            continue
        add_folder_aliases(new_map, folder, mapping)

    legacy_aliases = {
        "aeropuerto_arturo_merino_benitez_1": "aeropuerto_stg_1",
        "aeropuerto_arturo_merino_benitez_2": "aeropuerto_stg_2",
        "aeropuerto_arturo_merino_benitez_5": "aeropuerto_stg_5",
        "aeropuerto_arturo_merino_benitez_6": "aeropuerto_stg_6",
        "aeropuerto_arturo_merino_benitez_7": "aeropuerto_stg_7",
        "aeropuerto_arturo_merino_benitez_8": "aeropuerto_stg_8",
        "aeropuerto_arturo_merino_benitez_13": "aeropuerto_stg_13",
        "aeropuerto_arturo_merino_benitez_15": "aeropuerto_stg_15",
        "aeropuerto_arturo_merino_benitez_16": "aeropuerto_stg_16",
        "aeropuerto_arturo_merino_benitez_20": "aeropuerto_stg_20",
        "aeropuerto_arturo_merino_benitez_22": "aeropuerto_stg_22",
        "aeropuerto_arturo_merino_benitez_23": "aeropuerto_stg_23",
        "aeropuerto_arturo_merino_benitez_26": "aeropuerto_stg_26",
        "aeropuerto_arturo_merino_benitez_27": "aeropuerto_stg_27",
        "aeropuerto_arturo_merino_benitez_28": "aeropuerto_stg_28",
        "aeropuerto_arturo_merino_benitez_29": "aeropuerto_stg_29",
    }
    for alias, target in legacy_aliases.items():
        if target in new_map:
            new_map[alias] = new_map[target]

    add_rendered_page_aliases(new_map)

    MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAP_PATH.write_text(json.dumps(new_map, ensure_ascii=False, indent=2) + "\n")

    print(f"✓  audio_map.json regenerated with {len(new_map)} audio IDs", flush=True)
    return True


if __name__ == "__main__":
    success = regenerate_audio_map()
    sys.exit(0 if success else 1)
