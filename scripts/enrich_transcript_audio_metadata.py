#!/usr/bin/env python3
"""
Enrich transcript JSON files that are missing audio metadata.

Some transcript JSONs (e.g. the carabineros / latam / several aeropuerto
narratives in I-002) were produced without populating ``metadata.file_info``
and ``metadata.audio_properties``.  As a result the rendered stats bar shows
``0m 0.000s`` for Duration and ``Unknown`` for File Size.

This script fills those fields for any transcript that lacks them, using:

  * ``file_name`` / ``file_size``  -> from the matching audio manifest
    (``10-audio/<folder>/*_manifest.json`` ``source_audio``), cross-checked
    against the actual source file in ``10.1-audio/``.
  * ``duration``                   -> from the transcript's own last segment
    ``end`` (total recording length), formatted as ``HH:MM:SS.mmm`` to match
    the schema used by transcripts that already carry metadata.

Usage:
  python3 scripts/enrich_transcript_audio_metadata.py \
      --transcripts _shared/cases/la8159/02-transcripts/I-002 \
      --audio-root _shared/cases/la8159/10-audio \
      --source-audio _shared/cases/la8159/10.1-audio \
      [--dry-run]
"""

import argparse
import json
import os
import sys
from pathlib import Path


def format_duration_hms(total_seconds):
    """Format a float number of seconds as ``HH:MM:SS.mmm`` (schema style)."""
    total_seconds = float(total_seconds)
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"


def _looks_like_hms(value):
    """Return True if ``value`` is already an ``HH:MM:SS``-style duration."""
    if not isinstance(value, str):
        return False
    parts = value.split(":")
    return len(parts) >= 2 and all(p.replace(".", "", 1).isdigit() for p in parts)


def format_size_kb(num_bytes):
    """Format a byte count as ``NNNN.NN KB`` (schema style)."""
    return f"{num_bytes / 1024:.2f} KB"


def find_manifest_for_transcript(transcript_id, audio_root):
    """Locate the manifest JSON whose transcript_id matches, if any."""
    audio_root = Path(audio_root)
    if not audio_root.is_dir():
        return None
    for manifest in sorted(audio_root.glob("*/*_manifest.json")):
        try:
            with open(manifest, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if data.get("transcript_id") == transcript_id:
            return manifest, data
    return None


def resolve_source_file(source_filename, source_audio_dir):
    """Return the on-disk path for a source filename, or None."""
    source_audio_dir = Path(source_audio_dir)
    candidate = source_audio_dir / source_filename
    if candidate.is_file():
        return candidate
    # Fall back to a case-insensitive scan (macOS filesystems are often
    # case-insensitive but the name may differ in accents/case).
    for f in source_audio_dir.iterdir():
        if f.is_file() and f.name.lower() == source_filename.lower():
            return f
    return None


def enrich_transcript(json_path, audio_root, source_audio_dir, dry_run=False):
    """Enrich a single transcript JSON if it lacks audio metadata."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.setdefault("metadata", {})
    file_info = meta.get("file_info", {}) or {}
    audio_props = meta.get("audio_properties", {}) or {}

    has_file_name = bool(file_info.get("file_name"))
    has_file_size = bool(file_info.get("file_size"))
    has_duration = bool(audio_props.get("duration"))

    transcript_id = data.get("transcript_id") or Path(json_path).stem
    audio_id = data.get("audio_id") or ""
    changed = False
    notes = []

    # --- Normalize file_name to the audio_id-based display convention ---------
    # Some transcripts carry a real source filename (e.g. ``Aeropuerto Arturo
    # Merino Benítez 22.m4a``) or a plain-seconds duration.  Normalize the
    # display name to ``<audio_id>.m4a`` so every page matches the convention
    # used by the good examples (e.g. ``aeropuerto_STG_2.m4a``).
    if audio_id:
        expected_name = f"{audio_id}.m4a"
        if file_info.get("file_name") != expected_name:
            file_info["file_name"] = expected_name
            changed = True

    # --- Normalize a plain-seconds duration to HH:MM:SS.mmm -------------------
    raw_duration = audio_props.get("duration")
    if raw_duration and not _looks_like_hms(raw_duration):
        try:
            audio_props["duration"] = format_duration_hms(float(raw_duration))
            changed = True
        except (TypeError, ValueError):
            notes.append("unparseable duration")

    if has_file_name and has_file_size and has_duration and not changed:
        return False, "already complete"

    # --- file_info (file_name + file_size) from manifest / source file -------
    if not (has_file_name and has_file_size):
        # Display name follows the transcript's own audio_id (e.g.
        # ``carabineros_ppdartnel_2.m4a``), matching the convention used by
        # transcripts that already carry metadata (e.g. ``aeropuerto_STG_2.m4a``).
        if audio_id:
            file_info["file_name"] = f"{audio_id}.m4a"
            changed = True
        manifest = find_manifest_for_transcript(transcript_id, audio_root)
        if manifest is None:
            notes.append("no manifest found")
        else:
            _manifest_path, manifest_data = manifest
            source_audio = manifest_data.get("source_audio", {}) or {}
            source_filename = source_audio.get("filename")
            source_size = source_audio.get("size")
            # Prefer the real on-disk size; fall back to the manifest size.
            disk_path = (
                resolve_source_file(source_filename, source_audio_dir)
                if source_filename
                else None
            )
            if disk_path is not None:
                try:
                    source_size = disk_path.stat().st_size
                except OSError:
                    pass
            if source_size:
                file_info["file_size"] = f"{int(source_size)} bytes"
                file_info["file_size_kb"] = format_size_kb(int(source_size))
                changed = True
            if not source_filename:
                notes.append("manifest has no source filename")

    # --- audio_properties.duration from last segment end ---------------------
    if not has_duration:
        segments = data.get("segments", [])
        if segments:
            last_end = segments[-1].get("end")
            if isinstance(last_end, (int, float)) and last_end > 0:
                audio_props["duration"] = format_duration_hms(last_end)
                changed = True
            else:
                notes.append("no usable last-segment end")
        else:
            notes.append("no segments")

    if changed:
        meta["file_info"] = file_info
        meta["audio_properties"] = audio_props
        if not dry_run:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return True, "; ".join(notes) if notes else "enriched"
    return False, "; ".join(notes) if notes else "nothing to add"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--transcripts",
        required=True,
        help="Directory containing transcript JSON files to enrich.",
    )
    parser.add_argument(
        "--audio-root",
        required=True,
        help="Directory containing the <folder>_segments_all/*_manifest.json files.",
    )
    parser.add_argument(
        "--source-audio",
        required=True,
        help="Directory containing the original source audio files (e.g. 10.1-audio).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without writing files.",
    )
    args = parser.parse_args()

    transcripts_dir = Path(args.transcripts)
    if not transcripts_dir.is_dir():
        print(f"Error: transcripts dir '{args.transcripts}' not found.", file=sys.stderr)
        return 1

    enriched = 0
    skipped = 0
    for json_path in sorted(transcripts_dir.glob("*.json")):
        try:
            changed, note = enrich_transcript(
                json_path, args.audio_root, args.source_audio, dry_run=args.dry_run
            )
        except Exception as e:  # noqa: BLE001
            print(f"ERROR {json_path.name}: {e}", file=sys.stderr)
            continue
        if changed:
            enriched += 1
            action = "WOULD ENRICH" if args.dry_run else "ENRICHED"
            print(f"{action} {json_path.name}  [{note}]")
        else:
            skipped += 1
            print(f"skipped  {json_path.name}  [{note}]")

    print(f"\nDone: {enriched} enriched, {skipped} skipped "
          f"({'dry-run' if args.dry_run else 'written'}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
