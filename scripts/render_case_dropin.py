#!/usr/bin/env python3
"""Render the LA8159 I-002 transcript pages for a NETIFY drop-in bundle.

This script intentionally targets the exact transcript set requested for the drop-in
bundle and prefers the already-rendered HTML when present, while falling back to
render_transcript.py for any missing source pages.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from render_transcript import render_transcript

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "I-002"
SOURCE_RENDERED_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "transcripts_rendered" / "I-002"
VIOLATION_DIR = REPO_ROOT / "_shared" / "cases" / "la8159" / "01-violations" / "_json"

TARGET_STEMS = [
    "I-002_01_NAR-01_STG_1_pre_boarding",
    "I-002_02_NAR-02_STG_2_boarding_gate",
    "I-002_03_NAR-05_STG_5_aircraft_removal",
    "I-002_04_NAR-06_STG_6_jetbridge_standoff",
    "I-002_05_NAR-07_STG_7_post_removal_investigation",
    "I-002_06_NAR-STG_8_pdi_identity_control",
    "I-002_07_NAR-06_STG_13_post_PDI_corridor",
    "I-002_08_NAR-09_STG_15_luggage_recovery",
    "I-002_09_NAR-10_STG_16_counter_confrontation",
    "I-002_10_NAR-13_STG_20_barraza_counter",
    "I-002_11_NAR-14_Terminal_Internacional_T2_counter",
    "I-002_12_NAR-15_STG_22_DGAC_office",
    "I-002_13_NAR-18_STG_26_self_narration",
    "I-002_14_NAR-16_STG_23_DGAC_don_nicolas",
    "I-002_15_NAR-19_STG_27_self_narration",
    "I-002_16_NAR-20_STG_28",
    "I-002_17_NAR-21_STG_29",
    "I-002_18_NAR_LATAM_STG_2",
    "I-002_19_NAR_LATAM_STG_3",
    "I-002_20_NAR_LATAM_STG_4",
    "I-002_21_NAR_CARABINEROS_1",
    "I-002_22_NAR_CARABINEROS_2",
    "I-002_23_NAR_CARABINEROS_3",
    "I-002_24_NAR-19_STG_12",
]


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
    path.write_text(text, encoding="utf-8")


def ensure_target_pages(output_dir: Path) -> None:
    transcripts_dir = output_dir / "transcripts"
    transcripts_dir.mkdir(parents=True, exist_ok=True)

    for stem in TARGET_STEMS:
        target_html = transcripts_dir / f"{stem}.html"
        source_html = SOURCE_RENDERED_DIR / f"{stem}.html"
        source_json = SOURCE_JSON_DIR / f"{stem}.json"

        if source_html.exists():
            shutil.copy2(source_html, target_html)
        elif source_json.exists():
            render_transcript(str(source_json), str(target_html), str(VIOLATION_DIR))
        else:
            raise FileNotFoundError(f"Missing transcript source for {stem}")

        patch_html_for_dropin(target_html)


def main() -> int:
    parser = argparse.ArgumentParser(description="Render the LA8159 I-002 transcript pages for a NETIFY drop-in bundle.")
    parser.add_argument("--output-dir", required=True, help="Target directory to create for the drop-in bundle")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    ensure_target_pages(output_dir)
    print(f"Prepared transcript pages in {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
