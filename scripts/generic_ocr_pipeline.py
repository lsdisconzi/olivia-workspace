#!/usr/bin/env python3
"""Generic OCR pipeline for the Olivia workspace.

Reads every image from --input, runs OCR via pytesseract (reusing the proven
primitives from health_images_to_report.py), and writes:

  <output>/image_processing_workspace/extractions/<name>_extraction.json
      per-file extraction with fields:
        filename, pages (list of {text, ...}), text_summary, text_md, error
  <output>/image_processing_workspace/pipeline_summary.json
      with a "file_statistics" block.

Contract consumed by serve.py's /api/ocr/run handler:
  python generic_ocr_pipeline.py --input DIR --output DIR [--llm-provider X]
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp", ".gif"}


def _ocr_primitives():
    """Import the proven OCR primitives lazily so --help/--dry-run need no
    third-party packages, and missing deps surface a clear error at run time."""
    try:
        from health_images_to_report import (
            clean_ocr_text,
            extract_text_from_image,
            ocr_with_confidence,
            preprocess_image,
        )
    except ImportError as exc:
        raise RuntimeError(
            "OCR dependencies are missing for this interpreter "
            f"({sys.executable}). Run with the project venv (.venv/bin/python) "
            "or install the requirements: pytesseract, pillow, pandas, openai."
        ) from exc
    return clean_ocr_text, extract_text_from_image, ocr_with_confidence, preprocess_image


def make_markdown(filename, text_summary, pages):
    """Build a lightweight Markdown document from the OCR text."""
    title = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    lines = [f"# {title}", ""]
    for page in pages:
        text = (page.get("text") or "").strip()
        if not text:
            continue
        lines.append(text)
        lines.append("")
    if len(lines) <= 2 and text_summary:
        lines.append(str(text_summary))
    return "\n".join(lines)


def run_pipeline(input_dir, output_root, llm_provider=None, ocr_lang="por+eng", dry_run=False):
    workspace = os.path.join(output_root, "image_processing_workspace")
    extraction_dir = os.path.join(workspace, "extractions")
    os.makedirs(extraction_dir, exist_ok=True)

    file_index = []
    for f in sorted(Path(input_dir).iterdir()):
        if not f.is_file():
            continue
        if f.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        file_index.append(f)

    pipeline = {
        "status": "completed",
        "start_time": datetime.now().isoformat(),
        "end_time": None,
        "config": {
            "input": str(input_dir),
            "output": str(output_root),
            "llm_provider": llm_provider or "none",
            "ocr_language": ocr_lang,
        },
        "steps": {},
        "file_statistics": {
            "total_files": len(file_index),
            "total_images": len(file_index),
            "successful_ocr": 0,
            "failed": 0,
        },
    }

    if not dry_run:
        clean_ocr_text, extract_text_from_image, ocr_with_confidence, preprocess_image = _ocr_primitives()

    for f in file_index:
        extr = {
            "filename": f.name,
            "filepath": str(f),
            "extraction_time": datetime.now().isoformat(),
            "total_pages": 1,
            "pages": [],
            "metadata": {},
            "text_summary": "",
            "text_md": "",
            "ocr_confidence": 0.0,
            "error": None,
        }
        if dry_run:
            pass
        else:
            try:
                base = extract_text_from_image(str(f), ocr_lang=ocr_lang)
                extr["pages"] = base.get("pages", [])
                extr["text_summary"] = base.get("text_summary", "")
                extr["ocr_confidence"] = base.get("ocr_confidence", 0.0)
                extr["error"] = base.get("error")
            except Exception as exc:  # noqa: BLE001 - surface per-file failures
                extr["error"] = f"{type(exc).__name__}: {exc}"
                extr["pages"] = []

        text = " ".join(p.get("text") or "" for p in extr["pages"]).strip()
        if extr["error"] or not text:
            extr["error"] = extr["error"] or "No text extracted"
            extr["text_summary"] = ""
            extr["text_md"] = ""
            pipeline["file_statistics"]["failed"] += 1
        else:
            extr["text_summary"] = extr["text_summary"] or clean_ocr_text(text)[:5000]
            extr["text_md"] = make_markdown(extr["filename"], extr["text_summary"], extr["pages"])
            pipeline["file_statistics"]["successful_ocr"] += 1

        out_name = Path(extr["filename"]).stem + "_extraction.json"
        with open(os.path.join(extraction_dir, out_name), "w", encoding="utf-8") as fh:
            json.dump(extr, fh, ensure_ascii=False, indent=2)

    pipeline["end_time"] = datetime.now().isoformat()
    with open(os.path.join(workspace, "pipeline_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(pipeline, fh, ensure_ascii=False, indent=2)
    return pipeline


def main():
    parser = argparse.ArgumentParser(description="Generic OCR Pipeline")
    parser.add_argument("--input", "-i", required=True, help="Directory containing images")
    parser.add_argument("--output", "-o", required=True, help="Output root (workspace created inside)")
    parser.add_argument("--llm-provider", choices=["deepseek", "ollama", "openai", "none"], default=None,
                        help="Optional LLM provider (accepted for interface parity; markdown is built locally)")
    parser.add_argument("--ocr-lang", default="por+eng", help="Tesseract language(s), e.g. por+eng")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Scan files but skip OCR")
    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"Input directory not found: {args.input}", file=sys.stderr)
        return 1

    results = run_pipeline(
        args.input, args.output,
        llm_provider=args.llm_provider,
        ocr_lang=args.ocr_lang,
        dry_run=args.dry_run,
    )
    print(f"Generic OCR: {results['file_statistics']['total_files']} file(s), "
          f"{results['file_statistics']['successful_ocr']} OCR ok")
    return 0 if results["status"] == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
