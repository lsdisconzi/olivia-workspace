#!/usr/bin/env python3
"""
Integrate raw diarization segments (1755-2000s) into the main transcript.

The main transcript (I-002_04_NAR-06_STG_6_jetbridge_standoff.json) has
problematic segments in the 1755-2000 second range (indices 259-331):
- Duplicate indices (264, 265)
- Out-of-order timestamps
- [silencio] placeholders
- Garbled text
- Unassigned speakers (SPEAKER_00, SPEAKER_02)

The two raw files provide cleaner transcription of the 1755-2000 range:
- 1755-2000-segment_274_segment_274_1787907831_transcript.json
- 2000-21000-segment_274_segment_274_1787908466_transcript.json

This script:
1. Reconstructs segments 259-283 (not covered by raw files) by removing
   placeholders, duplicates, and garbled text; fixing speakers and timestamps.
2. Integrates raw file content into segments 284-331 to fill placeholders
   and fix garbled text.
3. Reindexes all segments sequentially.
"""

import json
import re
import sys
from pathlib import Path

BASE = Path("/Users/leandrodisconzi/repos/olivia/olivia/transcripts")
MAIN = BASE / "I-002_04_NAR-06_STG_6_jetbridge_standoff.json"
RAW1 = BASE / "1755-2000-segment_274_segment_274_1787907831_transcript.json"
RAW2 = BASE / "2000-21000-segment_274_segment_274_1787908466_transcript.json"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def is_placeholder(text):
    """Check if a segment is a [silencio] placeholder or garbled."""
    t = text.strip().lower()
    if t == "[silencio]":
        return True
    # Garbled text with lots of question marks
    if re.search(r"\?{3,}", text):
        return True
    return False


def clean_text(text):
    """Clean up garbled text."""
    # Remove runs of question marks
    text = re.sub(r"\?{3,}", "", text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text


def main():
    main_data = load_json(MAIN)
    raw1 = load_json(RAW1)
    raw2 = load_json(RAW2)

    segments = main_data["segments"]
    print(f"Original segment count: {len(segments)}")

    # ============================================================
    # PART 1: Reconstruct segments 259-283 (not covered by raw files)
    # ============================================================
    # These segments have issues: placeholders, duplicates, garbled text,
    # out-of-order timestamps, unassigned speakers.
    #
    # The valid content segments in this range (in chronological order):
    #   idx 260: "Ya, ¿puedes parar con el drama?" Passenger (1791-1794)
    #   idx 261: "Si, eso es." PDI (1794-1798)
    #   idx 262: "¿Ya? ¿Y ahora?" Passenger (1798-1799)
    #   idx 264: "Me voy a soltar un poco porque quiero..." Passenger (fix ts to 1799-1800)
    #   idx 269: "Yo no sé, pero yo no voy a me acercar." DGAC & PDI (fix speaker, 1802-1803)
    #   idx 270: "¿Qué vamos a hacer? ¿Qué estamos haciendo?" Passenger (1804-1808)
    #   idx 271: "algún policía." DGAC & PDI (1808-1809)
    #   idx 272: "¡Vamos con policía!" DGAC & PDI (1809-1810)
    #   idx 273: "Ya, bueno." Passenger (1811-1812)
    #   idx 274: "Bueno, bueno. La, la." Passenger (1813-1814)
    #   idx 275: "¿La grabación de las cámaras también?" Passenger (1815-1816)
    #   idx 278: "Era eso, ¡eh!" Passenger (fix ts to 1816-1817)
    #   idx 279: "es un absurdo" Passenger (fix ts to 1817-1818)
    #   idx 280: "Tiene la cámara, ¿cierto? Tiene la grabación." Passenger (1817.71-1818.84)
    #   idx 281: "Ya." DGAC & PDI (1818.43-1819.03)
    #   idx 282: "Ya, si se tiene la grabación bacana, pero si no..." Passenger (1819.03-1822.36)
    #
    # Removed: 259 ([silencio]), 263 ([silencio]), 265 ([silencio] x2),
    #          266 ([silencio] huge), 267 (garbled), 268 ([silencio]),
    #          276 (duplicate of 275), 277 ([silencio]), 283 ([silencio])

    # Build the cleaned segments 259-283
    cleaned_259_283 = [
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1791.0, "end": 1794.0,
         "duration": 3.0, "text": "Ya, ¿puedes parar con el drama?", "reviewed": True},
        {"speaker": "PDI", "start": 1794.0, "end": 1798.0,
         "duration": 4.0, "text": "Si, eso es.", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1798.0, "end": 1799.0,
         "duration": 1.0, "text": "¿Ya? ¿Y ahora?", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1799.0, "end": 1800.0,
         "duration": 1.0, "text": "Me voy a soltar un poco porque quiero...", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1802.0, "end": 1803.0,
         "duration": 1.0, "text": "Yo no sé, pero yo no voy a me acercar.", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1804.0, "end": 1808.0,
         "duration": 4.0, "text": "¿Qué vamos a hacer? ¿Qué estamos haciendo?", "reviewed": True},
        {"speaker": "DGAC & PDI", "start": 1808.0, "end": 1809.0,
         "duration": 1.0, "text": "algún policía.", "reviewed": True},
        {"speaker": "DGAC & PDI", "start": 1809.0, "end": 1810.0,
         "duration": 1.0, "text": "¡Vamos con policía!", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1811.0, "end": 1812.0,
         "duration": 1.0, "text": "Ya, bueno.", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1813.0, "end": 1814.0,
         "duration": 1.0, "text": "Bueno, bueno. La, la.", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1815.0, "end": 1816.0,
         "duration": 1.0, "text": "¿La grabación de las cámaras también?", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1816.0, "end": 1817.0,
         "duration": 1.0, "text": "Era eso, ¡eh!", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1817.0, "end": 1817.71,
         "duration": 0.71, "text": "es un absurdo", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1817.71, "end": 1818.84,
         "duration": 1.13, "text": "Tiene la cámara, ¿cierto? Tiene la grabación.", "reviewed": True},
        {"speaker": "DGAC & PDI", "start": 1818.84, "end": 1819.03,
         "duration": 0.19, "text": "Ya.", "reviewed": True},
        {"speaker": "Passenger (Leandro Disconzi)", "start": 1819.03, "end": 1822.36,
         "duration": 3.33, "text": "Ya, si se tiene la grabación bacana, pero si no...", "reviewed": True},
    ]

    # ============================================================
    # PART 2: Integrate raw content into segments 284-331
    # ============================================================
    # The raw files provide cleaner transcription. Use them to fill
    # [silencio] placeholders and fix garbled text.
    #
    # Raw file 1 (1755-2000) mapping:
    #   F1 seg 9-10 (rel 16.38-18.95): "Es famoso. ¿Qué hiciste?" -> seg 288
    #   F1 seg 11-13 (rel 22.02-27.33): "Chaita. ¿Está cómico eso? ¡Dios mío!" -> seg 289
    #   F1 seg 22 (rel 109.99-112.99): "de atrasar el vuelo probablemente no puede ser" -> seg 307
    #   F1 seg 23 (rel 113.43-113.95): "Vale." -> seg 308
    #   F1 seg 24 (rel 114.75-116.03): "Y a lo mejor está bien o está mal." -> seg 309
    #   F1 seg 25 (rel 116.37-117.11): "Pero lo hacen." -> seg 310
    #   F1 seg 26 (rel 118.43-119.03): "Y si ellos..." -> seg 313
    #   F1 seg 27 (rel 119.29-119.98): "¡Chao!" -> seg 314
    #
    # Raw file 2 (2000-2100) mapping:
    #   F2 seg 14 (rel 50.64-52.56): "Quizá a veces hemos gritado más cosas." -> seg 326
    #   F2 seg 17 (rel 87.95-88.59): "¿Y de ahí?" -> seg 329

    # Define fixes for specific segments (by index)
    # Format: {index: {"text": ..., "speaker": ...}}
    # These fixes use raw file content to fill [silencio] placeholders and
    # fix garbled text in segments 284-331.
    fixes_284_331 = {
        # seg 288 [silencio] Passenger -> fill with raw F1 seg 9-10
        288: {"text": "Es famoso. ¿Qué hiciste?", "speaker": "Passenger (Leandro Disconzi)"},
        # seg 289 "???¡Paita!" SPEAKER_02 (garbled) -> fix with raw F1 seg 11-13
        289: {"text": "Chaita. ¿Está cómico eso? ¡Dios mío!", "speaker": "Passenger (Leandro Disconzi)"},
        # seg 307 "El límite de la huésped.???????????????????????" (garbled) -> fix with raw F1 seg 22
        307: {"text": "de atrasar el vuelo probablemente no puede ser", "speaker": "DGAC & PDI"},
        # seg 309 "Ya a lo mejor está bien o está mal." -> fix with raw F1 seg 24
        309: {"text": "Y a lo mejor está bien o está mal.", "speaker": "DGAC & PDI"},
        # seg 310 "¡Pero lo hace!" -> fix with raw F1 seg 25
        310: {"text": "Pero lo hacen.", "speaker": "DGAC & PDI"},
        # seg 313 [silencio] DGAC & PDI -> fill with raw F1 seg 26
        313: {"text": "Y si ellos...", "speaker": "DGAC & PDI"},
        # seg 314 [silencio] Passenger -> fill with raw F1 seg 27
        314: {"text": "¡Chao!", "speaker": "Passenger (Leandro Disconzi)"},
    }

    # ============================================================
    # Build the new segments list
    # ============================================================
    new_segments = []

    # Segments before 259 (indices 0-258) - keep as-is
    for seg in segments:
        if seg["index"] < 259:
            new_segments.append(seg)

    # Segments 259-283 - use cleaned reconstruction
    for seg in cleaned_259_283:
        new_segments.append(seg)

    # Segments 284-331 - apply fixes
    for seg in segments:
        idx = seg["index"]
        if 284 <= idx <= 331:
            new_seg = dict(seg)
            if idx in fixes_284_331:
                fix = fixes_284_331[idx]
                if "text" in fix:
                    new_seg["text"] = fix["text"]
                if "speaker" in fix:
                    new_seg["speaker"] = fix["speaker"]
            new_segments.append(new_seg)

    # Segments after 331 (indices 332+) - keep as-is
    for seg in segments:
        if seg["index"] > 331:
            new_segments.append(seg)

    # ============================================================
    # Reindex all segments
    # ============================================================
    for i, seg in enumerate(new_segments):
        seg["index"] = i

    print(f"New segment count: {len(new_segments)}")

    # ============================================================
    # Update the main transcript
    # ============================================================
    main_data["segments"] = new_segments

    # Update corrections_applied
    corrections = main_data.get("corrections_applied", [])
    corrections.append(
        "Integrated raw diarization segments (1755-2000s): removed [silencio] "
        "placeholders, duplicate indices, and garbled text; fixed out-of-order "
        "timestamps and unassigned speakers (SPEAKER_00/SPEAKER_02); filled "
        "placeholders with raw transcription content."
    )
    main_data["corrections_applied"] = corrections

    save_json(MAIN, main_data)
    print(f"Saved updated transcript to {MAIN}")


if __name__ == "__main__":
    main()
