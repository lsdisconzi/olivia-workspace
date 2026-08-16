#!/usr/bin/env python3
"""Generic OCR pipeline for the Olivia workspace.

Reads every image from --input, runs OCR via pytesseract (reusing the proven
primitives from health_images_to_report.py), and writes:

  <output>/image_processing_workspace/extractions/<name>_extraction.json
      per-file extraction with fields:
        filename, pages (list of {text, ...}), text_summary, text_md, error
  <output>/image_processing_workspace/pipeline_summary.json
      with a "file_statistics" block.

When --llm-provider is passed (default: off, preserving the pipeline's no-LLM
behavior), an extra "STEP 10" profile analysis + refinement pass runs -- the
same approach as the procurement pipeline's LLM analysis + refinement, but
specialized for LinkedIn profiles / any data that can be learned from the
corpus of extractions (see ocr_profile_analytics.py). It writes:

  analysis/<name>_analysis.json                  per-page LLM profile extraction
  analysis_refined/<name>_analysis_refined.json  refined per-page analysis
  profiles.json                                  merged per-person profiles
  refinement_report.json                         auditable change log
  profile_knowledge_base.json                    persistent learning (cross-run)

Contract consumed by serve.py's /api/ocr/run handler:
  python generic_ocr_pipeline.py --input DIR --output DIR [--llm-provider X] [--llm-model M] [--enable-refinement]
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


def _profile_analytics():
    """Import the profile LLM analysis + refinement helpers lazily (only needed
    when --llm-provider is passed)."""
    try:
        from ocr_profile_analytics import (
            ProfileAnalyzer,
            ProfileKnowledgeBase,
            refine_profile_results,
        )
    except ImportError as exc:
        raise RuntimeError(
            "Profile LLM analysis dependencies are missing for this interpreter "
            f"({sys.executable}). Set DEEPSEEK_API_KEY and install the "
            "requirements: openai. Pass --llm-provider none to disable."
        ) from exc
    return ProfileAnalyzer, ProfileKnowledgeBase, refine_profile_results


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


def run_pipeline(input_dir, output_root, llm_provider=None, llm_model=None, ocr_lang="por+eng", dry_run=False, enable_refinement=True):
    workspace = os.path.join(output_root, "image_processing_workspace")
    extraction_dir = os.path.join(workspace, "extractions")
    os.makedirs(extraction_dir, exist_ok=True)

    # Effective LLM model for the profile analysis step. When no explicit model
    # is passed and the provider is deepseek, fall back to the environment's
    # LLM_MODEL (the same default the sidebar config catalog uses) instead of
    # the generic LLMAnalyzer default ("deepseek-v4"), which is not a valid id.
    effective_llm_model = llm_model
    if not effective_llm_model and llm_provider and llm_provider != "none":
        if llm_provider == "deepseek":
            effective_llm_model = os.getenv("LLM_MODEL", "deepseek-v4-flash")
        else:
            effective_llm_model = os.getenv("LLM_MODEL", "")

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
            "llm_model": effective_llm_model or None,
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

    extraction_by_path = {}
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

        extraction_by_path[str(f)] = extr
        out_name = Path(extr["filename"]).stem + "_extraction.json"
        with open(os.path.join(extraction_dir, out_name), "w", encoding="utf-8") as fh:
            json.dump(extr, fh, ensure_ascii=False, indent=2)

    # ── STEP 10 (profile): LLM analysis + refinement (KB-aware) ─────────────
    # Mirrors the procurement pipeline's LLMAnalyzer + refine_analysis_results,
    # specialized for LinkedIn profiles / any data that can be learned from the
    # corpus of extractions. Only runs when --llm-provider is passed (default
    # off, preserving the OCR pipeline's no-LLM behavior).
    analysis_results = {}
    refined_results = {}
    merged_profiles = []
    profile_kb = None
    profile_kb_path = os.path.join(output_root, "profile_knowledge_base.json")
    if llm_provider and llm_provider != "none" and not dry_run:
        try:
            ProfileAnalyzer, ProfileKnowledgeBase, refine_profile_results = _profile_analytics()
        except RuntimeError as exc:
            print(f"[OCR-LLM] {exc}", flush=True)
            pipeline["steps"]["profile_llm_analysis"] = {"status": "failed", "error": str(exc)}
            pipeline["steps"]["profile_refinement"] = {"status": "skipped", "reason": "analysis unavailable"}
            llm_provider = None
        else:
            profile_kb = ProfileKnowledgeBase(profile_kb_path)
            profile_kb.data["stats"]["total_runs"] += 1
            analysis_dir = os.path.join(workspace, "analysis")
            os.makedirs(analysis_dir, exist_ok=True)
            config = {
                "llm_provider": llm_provider,
                "llm_model": effective_llm_model or None,
                "llm_temperature": 0.1,
                "llm_max_tokens": 8192,
                "max_ocr_chars": 3000,
            }
            try:
                analyzer = ProfileAnalyzer(config, knowledge_base=profile_kb)
            except Exception as exc:  # noqa: BLE001 - e.g. missing API key
                print(f"[OCR-LLM] ProfileAnalyzer init failed: {exc}", flush=True)
                pipeline["steps"]["profile_llm_analysis"] = {"status": "failed", "error": str(exc)}
                profile_kb = None
            else:
                analyzed = 0
                for f in file_index:
                    extr = extraction_by_path.get(str(f))
                    if extr is None or extr.get("error"):
                        continue
                    if not " ".join(p.get("text") or "" for p in extr.get("pages", [])).strip():
                        continue
                    print(f"[OCR-LLM] Analyzing {f.name} ...", flush=True)
                    try:
                        analysis = analyzer.analyze_profile(extr)
                    except Exception as exc:  # noqa: BLE001
                        print(f"[OCR-LLM] analyze failed for {f.name}: {exc}", flush=True)
                        continue
                    if "error" not in analysis and profile_kb is not None:
                        profile_kb.update_from_profile(analysis)
                    analysis_results[str(f)] = analysis
                    aout = Path(extr["filename"]).stem + "_analysis.json"
                    with open(os.path.join(analysis_dir, aout), "w", encoding="utf-8") as fh:
                        json.dump(analysis, fh, ensure_ascii=False, indent=2)
                    analyzed += 1
                if profile_kb is not None:
                    profile_kb.save()
                pipeline["steps"]["profile_llm_analysis"] = {
                    "status": "completed", "analyzed": analyzed, "total_candidates": len(file_index),
                }

            # ── cross-profile refinement → merged per-person profiles ─────
            if analysis_results and enable_refinement:
                refine_config = {
                    "min_ocr_confidence_trusted": 70.0,
                    "fuzzy_match_threshold": 0.84,
                }
                try:
                    refined_results, refinement_report, merged_profiles = refine_profile_results(
                        analysis_results, extraction_by_path, profile_kb, refine_config
                    )
                    refine_dir = os.path.join(workspace, "analysis_refined")
                    os.makedirs(refine_dir, exist_ok=True)
                    for path, analysis in refined_results.items():
                        rout = Path(path).stem + "_analysis_refined.json"
                        with open(os.path.join(refine_dir, rout), "w", encoding="utf-8") as fh:
                            json.dump(analysis, fh, ensure_ascii=False, indent=2)
                    with open(os.path.join(workspace, "refinement_report.json"), "w", encoding="utf-8") as fh:
                        json.dump(refinement_report, fh, ensure_ascii=False, indent=2)
                    with open(os.path.join(workspace, "profiles.json"), "w", encoding="utf-8") as fh:
                        json.dump(merged_profiles, fh, ensure_ascii=False, indent=2)
                    if profile_kb is not None:
                        profile_kb.save()
                    pipeline["steps"]["profile_refinement"] = {
                        "status": "completed",
                        "person_groups": refinement_report["person_groups"],
                        "profiles_merged": len(merged_profiles),
                        "total_changes": refinement_report["total_changes"],
                    }
                except Exception as exc:  # noqa: BLE001
                    print(f"[OCR-LLM] refinement failed: {exc}", flush=True)
                    pipeline["steps"]["profile_refinement"] = {"status": "failed", "error": str(exc)}
            elif analysis_results:
                pipeline["steps"]["profile_refinement"] = {"status": "skipped", "reason": "refinement disabled"}
    else:
        pipeline["steps"]["profile_llm_analysis"] = {"status": "skipped", "reason": "no llm_provider"}
        pipeline["steps"]["profile_refinement"] = {"status": "skipped", "reason": "no llm_provider"}

    # Summary statistics (extended with the LLM analysis + refinement results).
    pipeline["file_statistics"]["successful_analyses"] = sum(
        1 for a in analysis_results.values() if "error" not in a
    )
    pipeline["file_statistics"]["profiles_merged"] = len(merged_profiles)

    pipeline["end_time"] = datetime.now().isoformat()
    with open(os.path.join(workspace, "pipeline_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(pipeline, fh, ensure_ascii=False, indent=2)
    return pipeline


def main():
    parser = argparse.ArgumentParser(description="Generic OCR Pipeline")
    parser.add_argument("--input", "-i", required=True, help="Directory containing images")
    parser.add_argument("--output", "-o", required=True, help="Output root (workspace created inside)")
    parser.add_argument("--llm-provider", choices=["deepseek", "ollama", "openai", "none"], default=None,
                        help="Optional LLM provider for profile analysis + refinement "
                             "(LinkedIn-style structured extraction). Default: off.")
    parser.add_argument("--llm-model", default=None,
                        help="LLM model id used for profile analysis (e.g. deepseek-v4-flash, "
                             "gpt-4o-mini, or an Ollama model). Defaults to the LLM_MODEL env var "
                             "for deepseek, otherwise the provider's default.")
    parser.add_argument("--ocr-lang", default="por+eng", help="Tesseract language(s), e.g. por+eng")
    parser.add_argument("--enable-refinement", dest="enable_refinement", action="store_true",
                        help="Enable cross-page profile refinement + merge (requires --llm-provider)")
    parser.add_argument("--disable-refinement", dest="enable_refinement", action="store_false",
                        help="Disable cross-page profile refinement")
    parser.set_defaults(enable_refinement=True)
    parser.add_argument("--dry-run", "-d", action="store_true", help="Scan files but skip OCR")
    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"Input directory not found: {args.input}", file=sys.stderr)
        return 1

    results = run_pipeline(
        args.input, args.output,
        llm_provider=args.llm_provider,
        llm_model=args.llm_model,
        ocr_lang=args.ocr_lang,
        dry_run=args.dry_run,
        enable_refinement=args.enable_refinement,
    )
    stats = results["file_statistics"]
    print(f"Generic OCR: {stats['total_files']} file(s), {stats['successful_ocr']} OCR ok, "
          f"{stats.get('successful_analyses', 0)} analyses, {stats.get('profiles_merged', 0)} profiles merged")
    return 0 if results["status"] == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
