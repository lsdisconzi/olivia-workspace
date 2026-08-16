#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM analysis + refinement for the generic OCR pipeline (profile flavor).

Ported from the procurement pipeline's STEP 10 -- LLM analysis + refinement
(``LLMAnalyzer.analyze_report`` + ``refine_analysis_results`` in
``health_images_to_report.py``) and specialized for LinkedIn profiles (or any
data that can be learned from a corpus of extractions):

  1. ``ProfileAnalyzer``  -- per-page LLM extraction of structured profile
     fields (person name, headline, location, contact, top skills, languages,
     summary, experience, education, certifications) from the OCR text.
  2. ``ProfileKnowledgeBase`` -- persistent, cross-run learning of canonical
     person names, employer/company names, top-skill spellings, language names
     and job titles, plus the existing OCR-error-correction dictionary.
  3. ``refine_profile_results`` -- cross-page refinement: pages of the same
     person are grouped (fuzzy via the KB), an anchor page (highest OCR
     confidence) is picked, metadata fields are reconciled, experience /
     education are merged and de-duplicated, and names/skills are canonicalized
     through the KB. The result is one clean merged Markdown profile per person.

This module is only imported lazily by ``generic_ocr_pipeline.py`` when
``--llm-provider`` is passed, so the OCR pipeline keeps its dependency-free
``--help`` / ``--dry-run`` path.
"""
import difflib
import json
import re
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

from health_images_to_report import (
    KnowledgeBase,
    LLMAnalyzer,
    atomic_write_json,
    truncate_text,
)


def profile_similarity(a: str, b: str) -> float:
    """Entity-aware fuzzy similarity for profile fields.

    LinkedIn entities often match by partial/containment rather than exact
    sequence ("Latam" ~ "LATAM Airlines", "U. Chile" ~ "Universidad de Chile").
    Combines SequenceMatcher ratio with a token-containment score so short OCR
    fragments converge to the known canonical spelling over runs.
    """
    a = (a or "").strip().lower()
    b = (b or "").strip().lower()
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    tokens_a = set(re.findall(r"[a-z0-9]+", a))
    tokens_b = set(re.findall(r"[a-z0-9]+", b))
    overlap = float(len(tokens_a & tokens_b))
    smaller = min(len(tokens_a), len(tokens_b))
    containment = (overlap / smaller) if smaller else 0.0
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    return max(ratio, containment * 0.9)


# ----------------------------------------------------------------------
# Profile knowledge base
# ----------------------------------------------------------------------
class ProfileKnowledgeBase(KnowledgeBase):
    """Knowledge base flavored for LinkedIn/profile extraction.

    Reuses the health KB's fuzzy canonicalization machinery (variants, counts,
    OCR-error learning) but with profile-oriented categories and prompt hints,
    and a containment-aware matcher better suited to company/skill names.
    """

    def _default(self) -> Dict[str, Any]:
        d = super()._default()
        d.setdefault("person_names", {})       # canonical person name
        d.setdefault("company_names", {})      # employers / institutions
        d.setdefault("skill_vocabulary", {})   # top-skills canonical spelling
        d.setdefault("language_vocabulary", {})  # language canonical spelling
        d.setdefault("title_vocabulary", {})   # job-title canonical spelling
        return d

    def _best_match(self, category: str, value: str) -> Optional[str]:
        """Containment-aware matcher (see profile_similarity)."""
        best_key, best_score = None, 0.0
        for canonical in self.data[category].keys():
            score = profile_similarity(canonical, value)
            if score > best_score:
                best_key, best_score = canonical, score
        if best_key and best_score >= self.threshold:
            return best_key
        return None

    def as_prompt_hints(self) -> str:
        lines = []
        pn = self.known_values("person_names")
        cn = self.known_values("company_names")
        sk = self.known_values("skill_vocabulary")
        lg = self.known_values("language_vocabulary")
        tt = self.known_values("title_vocabulary")
        if pn:
            lines.append(f"Known person name(s) from prior profiles: {', '.join(pn)}")
        if cn:
            lines.append(f"Known employer/company/institution name(s): {', '.join(cn)}")
        if sk:
            lines.append(f"Known top-skill spellings (reuse exact spelling when it matches): {', '.join(sk)}")
        if lg:
            lines.append(f"Known language name(s): {', '.join(lg)}")
        if tt:
            lines.append(f"Known job title(s): {', '.join(tt)}")
        if not lines:
            return ""
        return (
            "Context from previously processed profiles belonging to the SAME set of people "
            "(use to keep names/companies/skills consistent, but do not invent data not present on this page):\n"
            + "\n".join(f"- {l}" for l in lines)
        )

    def update_from_profile(self, profile: Dict[str, Any]) -> Dict[str, str]:
        """Learn canonical spellings from a fresh (non-error) profile analysis."""
        meta = profile.get("profile_metadata", {})
        result = {}
        if meta.get("person_name"):
            result["person_name"] = self.normalize_and_learn("person_names", meta["person_name"])
        for company in _extract_company_mentions(meta.get("headline", "")):
            self.normalize_and_learn("company_names", company)
        if meta.get("company_name"):
            result["company_name"] = self.normalize_and_learn("company_names", meta["company_name"])
        for s in profile.get("top_skills", []):
            s = (s or "").strip()
            if s:
                self.normalize_and_learn("skill_vocabulary", s)
        for lang in profile.get("languages", []):
            lang = (lang or "").strip()
            if lang:
                self.normalize_and_learn("language_vocabulary", lang)
        for e in profile.get("experience", []):
            if e.get("title"):
                self.normalize_and_learn("title_vocabulary", e["title"])
            if e.get("company"):
                self.normalize_and_learn("company_names", e["company"])
        for ed in profile.get("education", []):
            if ed.get("institution"):
                self.normalize_and_learn("company_names", ed["institution"])
        self.data["stats"]["total_files_learned"] += 1
        return result


def _extract_company_mentions(text: str) -> List[str]:
    """Pull "Company" mentions from a headline like
    'Chief Information and Digital Officer @ LATAM Airlines | Board Member'."""
    if not text:
        return []
    parts = [p.strip() for p in re.split(r"[\||•·;]", str(text)) if p.strip()]
    out = []
    for part in parts:
        m = re.search(r"@\s*([A-Za-z0-9][A-Za-z0-9 .&'’\-]{2,})", part)
        if m:
            name = m.group(1).strip().rstrip(".,")
            if name:
                out.append(name)
    return out


# ----------------------------------------------------------------------
# Profile analyzer (LLM)
# ----------------------------------------------------------------------
class ProfileAnalyzer(LLMAnalyzer):
    """Per-page LinkedIn/profile extraction, modeled on LLMAnalyzer.analyze_report."""

    def _create_profile_prompt(self, extraction: Dict[str, Any]) -> Tuple[str, List[str]]:
        filename = extraction.get("filename", "Unknown")
        ocr_text = extraction.get("text_summary", "") or ""

        # apply any high-confidence, previously-learned OCR corrections first
        applied_corrections: List[str] = []
        if self.kb is not None:
            ocr_text, applied_corrections = self.kb.apply_ocr_corrections(ocr_text)

        ocr_text = truncate_text(ocr_text, self.max_ocr_chars)
        kb_hints = self.kb.as_prompt_hints() if self.kb is not None else ""

        prompt = f"""
        The text below was extracted by OCR from a page of a LinkedIn profile
        (screenshot or printed-PDF page). OCR may contain errors. Extract the
        profile information that is actually present on THIS page and return a
        JSON object with these fields:

        {{
            "profile_metadata": {{
                "person_name": "full name shown on the page (empty if not visible)",
                "headline": "headline line, e.g. 'Role @ Company | Board Member'",
                "location": "city/country or empty",
                "linkedin_url": "linkedin URL or empty",
                "company_name": "current employer from headline (text after @) or empty",
                "name_confidence": 0.0-1.0
            }},
            "top_skills": ["skill1", "skill2", ...],
            "languages": ["language1", ...],
            "summary": "profile summary paragraph or empty",
            "experience": [
                {{"company": "...", "title": "...", "period": "Jan 2020 - Present",
                  "duration": "5 years 2 months", "location": "...", "description": "..."}}
            ],
            "education": [
                {{"institution": "...", "degree": "...", "period": "..."}}
            ],
            "certifications": ["..."],
            "contact_info": ["email, phone or other links if present"],
            "content_summary": "one-sentence description of this page's content"
        }}

        Rules:
        - Only include values actually visible on this page. Do not invent data.
        - Keep multi-line experience descriptions intact (concatenate lines).
        - Preserve company/skill/language spelling exactly as written unless a
          known value is listed below and clearly matches.
        {"Use the exact spelling of known names/companies/skills below when this page clearly matches one of them; otherwise extract what is actually written." if kb_hints else ""}
        {kb_hints}

        Output ONLY the JSON object, no other text (including no reasoning or explanation).

        FILENAME: {filename}
        OCR TEXT:
        {ocr_text}
        """
        return prompt, applied_corrections

    def analyze_profile(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        max_retries = 2
        last_applied_corrections: List[str] = []
        for attempt in range(max_retries + 1):
            prompt, applied_corrections = self._create_profile_prompt(extraction)
            last_applied_corrections = applied_corrections
            messages = [
                {"role": "system", "content": "You are a profile data extraction assistant. Output **only** a valid JSON object. Do not include any extra text, explanations, reasoning, or markdown."},
                {"role": "user", "content": prompt},
            ]
            if attempt > 0:
                self.max_tokens = 8192
            try:
                raw = self._chat_completion(messages, use_json=self.supports_json_mode)
                content = raw.get("choices", [{}])[0].get("message", {}).get("content", "")
                reasoning = raw.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")

                parsed = self._parse_json_from_text(content)
                extracted_from = "content"
                if not parsed and not content and reasoning:
                    parsed = self._parse_json_from_text(reasoning)
                    extracted_from = "reasoning"

                if parsed:
                    parsed["llm_analysis_metadata"] = {
                        "model": self.model,
                        "provider": self.provider,
                        "analysis_time": datetime.now().isoformat(),
                        "attempt": attempt + 1,
                        "original_filename": extraction.get("filename", "unknown"),
                        "ocr_confidence": extraction.get("ocr_confidence", None),
                        "pre_llm_corrections_applied": last_applied_corrections,
                        "extracted_from": extracted_from,
                    }
                    return parsed

                import logging
                logging.warning(f"Profile analysis attempt {attempt + 1} returned non-JSON. Snippet: {content[:200]}")
            except Exception as e:  # noqa: BLE001
                import logging
                logging.error(f"Profile LLM call failed: {e}")
            time.sleep(2)

        return {
            "error": "Profile analysis failed after retries",
            "raw_ocr_summary": extraction.get("text_summary", "")[:500],
            "llm_analysis_metadata": {
                "model": self.model,
                "provider": self.provider,
                "analysis_time": datetime.now().isoformat(),
                "failed": True,
                "original_filename": extraction.get("filename", "unknown"),
                "ocr_confidence": extraction.get("ocr_confidence", None),
            },
        }


# ----------------------------------------------------------------------
# Cross-profile refinement -> merged per-person profiles
# ----------------------------------------------------------------------
def _profile_person_key(analysis: Dict[str, Any], kb: Optional[ProfileKnowledgeBase]) -> str:
    meta = analysis.get("profile_metadata", {})
    name = (meta.get("person_name") or "").strip()
    if not name:
        return ""
    if kb is not None:
        canonical = kb.normalize_and_learn("person_names", name)
        return canonical.lower()
    return name.lower()


def _is_initialism_of(short: str, long: str) -> bool:
    """True if one string is an initialism of the other's words
    ("CIO" ~ "Chief Information Officer")."""
    short = re.sub(r"[^a-z]", "", (short or "").lower())
    words = re.findall(r"[a-z]+", (long or "").lower())
    if not short or len(short) < 2 or len(words) < 2:
        return False
    return short == "".join(w[0] for w in words)


def _same_role(comp: str, title: str, other_comp: str, other_title: str) -> bool:
    """Are two experience entries the same role? Company must agree (fuzzy);
    titles must be close or one an initialism of the other."""
    if comp and other_comp and profile_similarity(comp, other_comp) < 0.8:
        return False
    if title and other_title:
        return (
            profile_similarity(title, other_title) >= 0.6
            or _is_initialism_of(title, other_title)
            or _is_initialism_of(other_title, title)
        )
    return True


def _dedupe_experience(entries: List[Dict[str, Any]], threshold: float = 0.8) -> List[Dict[str, Any]]:
    """Merge experience entries across pages by (company + title) similarity.
    Never fabricates: keeps the richer description/duration when present."""
    out: List[Dict[str, Any]] = []
    for e in entries or []:
        comp = (e.get("company") or "").strip()
        title = (e.get("title") or "").strip()
        if not comp and not title:
            continue
        dup_idx = None
        for idx, existing in enumerate(out):
            if _same_role(
                comp, title,
                (existing.get("company") or "").strip(),
                (existing.get("title") or "").strip(),
            ):
                dup_idx = idx
                break
        if dup_idx is None:
            out.append(dict(e))
        else:
            if not out[dup_idx].get("description") and e.get("description"):
                out[dup_idx]["description"] = e["description"]
            if not out[dup_idx].get("duration") and e.get("duration"):
                out[dup_idx]["duration"] = e["duration"]
            if not out[dup_idx].get("location") and e.get("location"):
                out[dup_idx]["location"] = e["location"]
    return out


def profile_to_markdown(profile: Dict[str, Any]) -> str:
    """Render a merged profile dict as clean structured Markdown."""
    meta = profile.get("profile_metadata", {})
    md = [f"# {profile.get('person_name') or meta.get('person_name') or 'Perfil'}"]
    if meta.get("headline"):
        md += ["", f"**{meta['headline']}**"]
    if meta.get("location"):
        md += ["", f"_{meta['location']}_"]

    contact = []
    if meta.get("linkedin_url"):
        contact.append(meta["linkedin_url"])
    for c in profile.get("contact_info", []) or []:
        c = (c or "").strip()
        if c and c not in contact:
            contact.append(c)
    if contact:
        md += ["", "## Contact", ""] + [f"- {c}" for c in contact]

    if profile.get("top_skills"):
        md += ["", "## Top Skills", ""] + [f"- {s}" for s in profile["top_skills"]]
    if profile.get("languages"):
        md += ["", "## Languages", ""] + [f"- {l}" for l in profile["languages"]]
    if profile.get("summary"):
        md += ["", "## Summary", "", str(profile["summary"]).strip()]

    if profile.get("experience"):
        md += ["", "## Experience", ""]
        for e in profile["experience"]:
            head = f"**{e.get('title') or '—'}**"
            if e.get("company"):
                head += f" · {e['company']}"
            if e.get("period"):
                head += f" ({e['period']})"
            md.append(head)
            if e.get("location"):
                md.append(f"_{e['location']}_")
            if e.get("description"):
                for line in str(e["description"]).split("\n"):
                    line = line.strip()
                    if line:
                        md.append(f"- {line}")
            md.append("")

    if profile.get("education"):
        md += ["", "## Education", ""]
        for ed in profile["education"]:
            parts = []
            if ed.get("degree"):
                parts.append(f"**{ed['degree']}**")
            if ed.get("institution"):
                parts.append(str(ed["institution"]))
            if ed.get("period"):
                parts.append(f"({ed['period']})")
            if parts:
                md.append("- " + " · ".join(parts))

    if profile.get("certifications"):
        md += ["", "## Certifications", ""] + [f"- {c}" for c in profile["certifications"]]
    return "\n".join(md).strip() + "\n"


def refine_profile_results(
    analysis_results: Dict[str, Dict[str, Any]],
    extraction_results: Dict[str, Dict[str, Any]],
    kb: Optional[ProfileKnowledgeBase],
    config: Dict[str, Any],
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    """Group per-page analyses by person and merge them into clean profiles.

    Metadata-only consensus refinement, mirroring the procurement pipeline:
      - pages of the same person are grouped (fuzzy via the KB)
      - the highest-OCR-confidence page is the anchor for shared fields
      - experience/education are merged across pages and de-duplicated
      - company/skill/language/title spellings are canonicalized via the KB
      - every change is logged in the returned refinement_report (auditable)
    """
    trusted = float(config.get("min_ocr_confidence_trusted", 70.0))
    refined: Dict[str, Dict[str, Any]] = {
        p: json.loads(json.dumps(a)) for p, a in analysis_results.items() if "error" not in a
    }
    change_log: List[Dict[str, Any]] = []

    groups: Dict[str, List[str]] = defaultdict(list)
    for p, a in refined.items():
        key = _profile_person_key(a, kb)
        if key:
            groups[key].append(p)

    merged_profiles: List[Dict[str, Any]] = []
    for key, paths in groups.items():
        ranked = sorted(
            paths,
            key=lambda p: extraction_results.get(p, {}).get("ocr_confidence", 0.0),
            reverse=True,
        )
        anchor_path = ranked[0]
        anchor_meta = refined[anchor_path].get("profile_metadata", {})
        person_name = (anchor_meta.get("person_name") or "").strip()
        if not person_name:
            person_name = _ocr_like_name(Path(anchor_path).name)

        # ── aggregate across pages ────────────────────────────────────────
        agg: Dict[str, Any] = {
            "top_skills": [], "languages": [], "summary": "",
            "experience": [], "education": [], "certifications": [], "contact_info": [],
        }
        seen_skills = set()
        seen_langs = set()
        for p in ranked:
            a = refined[p]
            meta = a.get("profile_metadata", {})
            conf = extraction_results.get(p, {}).get("ocr_confidence", 0.0)
            # fill missing shared metadata fields from a trusted sibling
            for fld in ("location", "linkedin_url", "headline", "company_name"):
                if not anchor_meta.get(fld) and meta.get(fld):
                    if conf >= trusted or p == anchor_path:
                        anchor_meta[fld] = meta[fld]
                        change_log.append({
                            "file": p, "field": f"profile_metadata.{fld}",
                            "before": "", "after": meta[fld],
                            "reason": f"filled from {'anchor' if p == anchor_path else 'higher-confidence sibling'}",
                        })
            # summary: prefer the longest fragment
            if len(str(a.get("summary") or "")) > len(str(agg["summary"] or "")):
                agg["summary"] = a.get("summary", "")
            for s in a.get("top_skills", []) or []:
                s = (s or "").strip()
                if not s:
                    continue
                if kb is not None:
                    s = kb.normalize_and_learn("skill_vocabulary", s)
                if s.lower() not in seen_skills:
                    seen_skills.add(s.lower())
                    agg["top_skills"].append(s)
            for lang in a.get("languages", []) or []:
                lang = (lang or "").strip()
                if not lang:
                    continue
                if kb is not None:
                    lang = kb.normalize_and_learn("language_vocabulary", lang)
                if lang.lower() not in seen_langs:
                    seen_langs.add(lang.lower())
                    agg["languages"].append(lang)
            # Canonicalize company/title/institution spellings NOW (before the
            # de-duplication pass) so "Latam" and "LATAM Airlines" converge to
            # the same canonical key and merge into a single experience entry.
            for e in a.get("experience", []) or []:
                if e.get("company") and kb is not None:
                    canon = kb.normalize_and_learn("company_names", e["company"])
                    if canon != e["company"]:
                        change_log.append({
                            "file": p, "field": "experience.company",
                            "before": e["company"], "after": canon,
                            "reason": "canonicalized against known company vocabulary",
                        })
                        e["company"] = canon
                if e.get("title") and kb is not None:
                    canon = kb.normalize_and_learn("title_vocabulary", e["title"])
                    if canon != e["title"]:
                        change_log.append({
                            "file": p, "field": "experience.title",
                            "before": e["title"], "after": canon,
                            "reason": "canonicalized against known title vocabulary",
                        })
                        e["title"] = canon
                agg["experience"].append(e)
            for ed in a.get("education", []) or []:
                if ed.get("institution") and kb is not None:
                    canon = kb.normalize_and_learn("company_names", ed["institution"])
                    if canon != ed["institution"]:
                        change_log.append({
                            "file": p, "field": "education.institution",
                            "before": ed["institution"], "after": canon,
                            "reason": "canonicalized against known company vocabulary",
                        })
                        ed["institution"] = canon
                agg["education"].append(ed)
            agg["certifications"].extend(a.get("certifications", []) or [])
            agg["contact_info"].extend(a.get("contact_info", []) or [])

        # ── de-duplicate after canonicalization ────────────────────────────
        agg["experience"] = _dedupe_experience(agg["experience"])
        agg["certifications"] = [c for c in dict.fromkeys(str(c).strip() for c in agg["certifications"]) if c]
        agg["contact_info"] = [c for c in dict.fromkeys(str(c).strip() for c in agg["contact_info"]) if c]

        profile = {
            "person_name": person_name,
            "profile_metadata": anchor_meta,
            "top_skills": agg["top_skills"],
            "languages": agg["languages"],
            "summary": agg["summary"],
            "experience": agg["experience"],
            "education": agg["education"],
            "certifications": agg["certifications"],
            "contact_info": agg["contact_info"],
            "pages": [Path(p).name for p in sorted(paths)],
            "page_count": len(paths),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        profile["markdown"] = profile_to_markdown(profile)
        merged_profiles.append(profile)

    refinement_report = {
        "generated_at": datetime.now().isoformat(),
        "person_groups": len(groups),
        "profiles_merged": len(merged_profiles),
        "total_changes": len(change_log),
        "changes": change_log,
    }
    return refined, refinement_report, merged_profiles


def _ocr_like_name(filename: str) -> str:
    """Best-effort human name from a filename stem (used only when the LLM
    could not determine a person name)."""
    stem = Path(filename).stem
    stem = re.sub(r"[-_](?=[0-9a-f]{6})[0-9a-f]*[a-f][0-9a-f]*", "", stem, flags=re.I)
    stem = re.sub(r"[-_]?\d+$", "", stem)
    return re.sub(r"[-_]+", " ", stem).strip() or "Perfil"
