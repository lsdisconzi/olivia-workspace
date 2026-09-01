#!/usr/bin/env python3
"""
Renders JSON transcripts into clean-professional themed HTML pages.

Two modes:
  1. Single file:  python3 render_transcript.py <transcript_json> <output_html> [--violation-dir DIR]
  2. Batch folder: python3 render_transcript.py --input-dir <input_dir> --output-dir <output_dir> [--violation-dir DIR] [--recursive]
  3. all
  python3 scripts/render_transcript.py \
  --input-dir /Users/dev/_sell/olivia/_shared/cases/la8159/02-transcripts/I-002 \
  --output-dir /Users/dev/_sell/olivia/_shared/cases/la8159/02-transcripts/transcripts_rendered/I-002 \
  --violation-dir /Users/dev/_sell/olivia/_shared/cases/la8159/01-violations/_json/EN \
  --recursive
"""

import json
import os
import sys
import html
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# CSS – clean-professional light theme (aligned with reference HTML)
# ---------------------------------------------------------------------------

CSS_VARIABLES = """
    :root {
      --bg-primary: #f8f7f4;
      --bg-card: #ffffff;
      --bg-card-hover: #f2f0ea;
      --bg-surface: #f1efe8;
      --border: #e1ddd1;
      --border-strong: #c7c1b0;
      --text-primary: #1b1c1e;
      --text-secondary: #52555c;
      --text-muted: #8a8b87;
      --accent: #24405f;
      --accent-dim: rgba(36, 64, 95, 0.07);
      --status-flag: #7a3733;
      --status-flag-dim: rgba(122, 55, 51, 0.08);
      --status-analysis: #8a6a2c;
      --status-analysis-dim: rgba(138, 106, 44, 0.09);
      --status-note: #3f6b4f;
      --status-note-dim: rgba(63, 107, 79, 0.08);
      --mono: 'JetBrains Mono', monospace;
      --serif: 'Source Serif 4', Georgia, serif;
      --sans: 'Inter', -apple-system, sans-serif;
    }
"""

CSS_BODY = """
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      padding-bottom: 60px;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      font-family: var(--mono);
      font-size: 0.85em;
      color: var(--accent);
      background: var(--bg-surface);
      padding: 1px 6px;
      border-radius: 2px;
    }

    .masthead {
      border-bottom: 1px solid var(--border);
      padding: 44px 0 32px;
    }

    .masthead-inner {
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 32px;
    }

    .masthead-back {
      font-family: var(--mono);
      font-size: 0.7rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 18px;
      display: inline-block;
    }

    .masthead-back:hover {
      color: var(--accent);
      text-decoration: none;
    }

    .masthead-badge {
      display: inline-block;
      font-family: var(--mono);
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-secondary);
      border: 1px solid var(--border-strong);
      padding: 5px 12px;
      border-radius: 2px;
      margin-bottom: 20px;
    }

    .masthead h1 {
      font-family: var(--serif);
      font-size: clamp(1.6rem, 3vw, 2.3rem);
      font-weight: 600;
      line-height: 1.25;
      margin-bottom: 10px;
      color: var(--text-primary);
    }

    .masthead-sub {
      font-size: 0.96rem;
      color: var(--text-secondary);
      max-width: 700px;
      line-height: 1.7;
    }

    .stats-bar {
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    .stats-inner {
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 32px;
      display: flex;
      gap: 0;
      flex-wrap: wrap;
    }

    .stat-item {
      flex: 1 1 180px;
      padding: 18px 14px;
      border-right: 1px solid var(--border);
    }

    .stat-item:last-child {
      border-right: none;
    }

    .stat-val {
      font-family: var(--mono);
      font-size: 0.92rem;
      font-weight: 500;
      color: var(--text-primary);
      word-break: break-word;
    }

    .stat-label {
      font-size: 0.68rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-top: 5px;
    }

    .main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 32px;
    }

    .section-head {
      padding: 44px 0 18px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 18px;
    }

    .section-head h2 {
      font-family: var(--serif);
      font-size: 1.4rem;
      font-weight: 600;
      padding-bottom: 14px;
    }

    .section-head p {
      color: var(--text-secondary);
      font-size: 0.9rem;
      padding-bottom: 16px;
      max-width: 700px;
    }

    /* transcript */
    .transcript-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
    }

    .transcript-segment {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border-strong);
      border-radius: 3px;
      padding: 13px 18px;
    }

    .transcript-segment.seg-passenger {
      border-left-color: var(--accent);
    }

    .transcript-segment.seg-other {
      border-left-style: dashed;
      border-left-color: var(--status-analysis);
    }

    .transcript-segment .seg-time {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-bottom: 4px;
      letter-spacing: 0.02em;
    }

    .transcript-segment .seg-speaker {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .transcript-segment .seg-text {
      font-size: 0.92rem;
      color: var(--text-secondary);
      line-height: 1.65;
      font-style: italic;
    }

    .transcript-segment .seg-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }

    .transcript-segment .seg-note-btn {
      font-family: var(--mono);
      font-size: 0.65rem;
      padding: 3px 9px;
      border-radius: 2px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }

    .transcript-segment .seg-note-btn:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    /* evidence / violation cards */
    .evidence-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .evidence-card {
      display: grid;
      grid-template-columns: 100px 1fr 150px;
      align-items: start;
      gap: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border-strong);
      border-radius: 3px;
      padding: 18px 22px;
    }

    .ev-time-col {
      padding-top: 2px;
    }

    .ev-time {
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .ev-duration {
      font-family: var(--mono);
      font-size: 0.66rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .ev-body h3 {
      font-size: 0.94rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .ev-body .ev-summary {
      font-size: 0.86rem;
      color: var(--text-secondary);
      line-height: 1.68;
    }

    .ev-provisions {
      font-family: var(--mono);
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 10px;
    }

    .ev-meta-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      text-align: right;
    }

    .ev-type {
      font-family: var(--mono);
      font-size: 0.63rem;
      padding: 4px 9px;
      border-radius: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 500;
      white-space: nowrap;
    }

    .type-primary {
      background: var(--status-flag-dim);
      color: var(--status-flag);
    }

    .type-procedural {
      background: var(--status-analysis-dim);
      color: var(--status-analysis);
    }

    .type-analysis {
      background: var(--accent-dim);
      color: var(--accent);
    }

    .ev-open {
      font-family: var(--mono);
      font-size: 0.66rem;
      background: transparent;
      border: none;
      color: var(--accent);
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .ev-open:hover {
      color: var(--text-primary);
    }

    /* notes panel */
    .notes-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 24px 28px;
      margin-top: 12px;
    }

    .notes-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }

    .notes-label {
      font-family: var(--mono);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }

    .notes-count {
      font-family: var(--mono);
      font-size: 0.68rem;
      padding: 3px 9px;
      border-radius: 2px;
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
    }

    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }

    .notes-empty {
      font-size: 0.85rem;
      color: var(--text-muted);
      padding: 14px;
      background: var(--bg-surface);
      border: 1px dashed var(--border);
      border-radius: 3px;
      text-align: center;
    }

    .note-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border-strong);
      border-radius: 3px;
      padding: 13px 16px;
    }

    .note-card.note-admission {
      border-left-color: var(--status-flag);
    }

    .note-card.note-xref {
      border-left-color: var(--accent);
    }

    .note-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 7px;
    }

    .note-type {
      font-family: var(--mono);
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 2px;
      background: var(--bg-card);
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
    }

    .note-card.note-admission .note-type {
      color: var(--status-flag);
      border-color: var(--status-flag);
    }

    .note-card.note-xref .note-type {
      color: var(--accent);
      border-color: var(--accent);
    }

    .note-author {
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .note-seg {
      font-family: var(--mono);
      font-size: 0.68rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    .note-body {
      font-size: 0.88rem;
      color: var(--text-secondary);
      line-height: 1.65;
      white-space: pre-wrap;
    }

    /* modal */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(20, 20, 18, 0.55);
      z-index: 1000;
      justify-content: center;
      align-items: flex-start;
      padding: 40px 20px;
      overflow-y: auto;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: var(--bg-primary);
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      max-width: 760px;
      width: 100%;
      margin: auto 0;
    }

    .modal-header {
      padding: 22px 28px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .modal-header-body {
      flex: 1;
    }

    .modal-type-badge {
      font-family: var(--mono);
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 10px;
      border-radius: 2px;
      display: inline-block;
      margin-bottom: 10px;
    }

    .modal-title {
      font-family: var(--serif);
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--text-primary);
    }

    .modal-audio-ref {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .modal-close {
      background: transparent;
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
      width: 30px;
      height: 30px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 1.05rem;
    }

    .modal-close:hover {
      color: var(--text-primary);
      border-color: var(--text-primary);
    }

    .modal-body {
      padding: 22px 28px;
    }

    .modal-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 22px;
      padding: 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 3px;
    }

    .modal-status-text {
      font-family: var(--mono);
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }

    .modal-section {
      margin-bottom: 22px;
    }

    .modal-section-label {
      font-family: var(--mono);
      font-size: 0.63rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .modal-segments {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .modal-segment {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 3px;
      padding: 12px 16px;
    }

    .modal-segment-time {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .modal-segment-speaker {
      font-size: 0.76rem;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-primary);
    }

    .modal-segment-text {
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.6;
      font-style: italic;
    }

    .modal-jurisdictions,
    .modal-xrefs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .jurisdiction-pill {
      display: flex;
      flex-direction: column;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 12px 16px;
      min-width: 200px;
      flex: 1;
    }

    .jurisdiction-name {
      font-family: var(--mono);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      margin-bottom: 6px;
    }

    .jurisdiction-laws {
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .jurisdiction-article {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-primary);
      background: var(--bg-surface);
      padding: 2px 6px;
      border-radius: 2px;
      display: inline-block;
      margin: 2px 2px 2px 0;
    }

    .xref-tag {
      font-family: var(--mono);
      font-size: 0.68rem;
      padding: 4px 10px;
      border-radius: 2px;
      background: var(--bg-card);
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
    }

    .modal-footer {
      padding: 14px 28px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .modal-footer-note {
      font-family: var(--mono);
      font-size: 0.66rem;
      color: var(--text-muted);
      flex: 1;
    }

    .modal-download-btn {
      font-family: var(--mono);
      font-size: 0.66rem;
      padding: 6px 14px;
      border-radius: 3px;
      background: transparent;
      border: 1px solid var(--border-strong);
      color: var(--text-secondary);
      cursor: pointer;
    }

    .modal-download-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .page-footer {
      border-top: 1px solid var(--border);
      padding: 28px 0;
      text-align: center;
      margin-top: 48px;
    }

    .page-footer p {
      font-size: 0.76rem;
      color: var(--text-muted);
      line-height: 1.8;
    }

    .page-footer .mono {
      font-family: var(--mono);
    }

    @media (max-width: 900px) {
      .evidence-card {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .ev-meta-col {
        flex-direction: row-reverse;
        align-items: center;
        text-align: left;
        justify-content: flex-end;
      }
    }

    @media (max-width: 600px) {
      .masthead {
        padding: 28px 0 22px;
      }

      .masthead-inner,
      .main {
        padding: 0 16px;
      }

      .modal-overlay {
        padding: 16px 10px;
      }

      .pinned-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background: rgba(248, 247, 244, 0.94);
        backdrop-filter: blur(10px);
        border-top: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        gap: 16px;
      }

      .pinned-nav-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--mono);
        font-size: 0.68rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--accent);
        text-decoration: none;
        padding: 5px 12px;
        border-radius: 3px;
        border: 1px solid var(--border-strong);
      }

      .pinned-nav-link:hover {
        background: var(--accent-dim);
        text-decoration: none;
      }

      .pinned-nav-label {
        font-family: var(--mono);
        font-size: 0.64rem;
        color: var(--text-muted);
        letter-spacing: 0.04em;
      }

      @media (max-width: 600px) {
        .pinned-nav {
          padding: 8px 14px;
        }

        .pinned-nav-label {
          display: none;
        }
      }
    }
"""


# ---------------------------------------------------------------------------
# Helper functions (updated to match new structure)
# ---------------------------------------------------------------------------

def escape_html(text):
    """Escape HTML special characters, preserving existing entities."""
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)
    if not text:
        return ""
    text = html.unescape(text)
    return html.escape(text)


def truncate_at_word(text, limit):
    """Truncate text to at most `limit` characters without cutting a word."""
    if not text or len(text) <= limit:
        return text or ""
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:")
    if not cut:
        cut = text[:limit]
    return cut + "…"


def classify_speaker(speaker):
    """Map speaker label to CSS class."""
    speaker_lower = speaker.lower()
    if any(x in speaker_lower for x in ["passenger", "pasajero", "pasajera"]):
        return "seg-passenger"
    if any(x in speaker_lower for x in ["stewardess", "steward", "latam", "staff", "security", "dgac", "pdi", "captain", "pilot", "official", "capitán", "piloto", "oficial"]):
        return "seg-staff"
    return "seg-other"


def format_duration(iso_duration):
    """Convert ISO 8601 duration or HH:MM:SS to human readable."""
    if not iso_duration:
        return "Unknown"
    if ":" in iso_duration:
        parts = iso_duration.split(":")
        if len(parts) == 3:
            h, m, s = parts
            h_val = int(h)
            m_val = int(m)
            s_val = float(s)
            if h_val > 0:
                return f"{h_val}h {m_val}m {s_val:.3f}s"
            return f"{m_val}m {s_val:.3f}s"
        elif len(parts) == 2:
            m, s = parts
            return f"{int(m)}m {float(s):.3f}s"
        return iso_duration
    if iso_duration.startswith("PT"):
        result = ""
        rest = iso_duration[2:]
        if "H" in rest:
            h_part, rest = rest.split("H")
            result += f"{int(h_part)}h "
        if "M" in rest:
            m_part, rest = rest.split("M")
            result += f"{int(m_part)}m "
        if rest:
            result += f"{float(rest.rstrip('S')):.3f}s"
        return result.strip()
    return iso_duration


def format_timestamp(dt_str):
    """Format ISO timestamp to human readable."""
    if not dt_str:
        return "Unknown"
    try:
        dt_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(dt_str)
        return dt.strftime("%B %d, %Y &middot; %H:%M:%S")
    except (ValueError, TypeError):
        return dt_str


def get_jurisdiction_label(vid):
    """Prefix mapping."""
    if vid.startswith("CL-"):
        return "Chile"
    elif vid.startswith("BR-"):
        return "Brazil"
    elif vid.startswith("INT-"):
        return "International"
    return "N/A"


def get_violation_type_class(category):
    """Map category to CSS badge class for ev-type."""
    cat_lower = category.lower()
    if any(x in cat_lower for x in ["false", "misconduct", "abuse", "harassment", "criminal", "intimidation", "coercion", "prevaricación", "abuso", "criminal", "touch"]):
        return "type-primary"
    if any(x in cat_lower for x in ["retaliation", "procedural", "regulatory", "abdication", "obstruction", "institutional", "coercive"]):
        return "type-procedural"
    if any(x in cat_lower for x in ["shifting narrative", "bad faith", "analysis", "escalation", "baseline"]):
        return "type-analysis"
    return "type-procedural"


def load_violation_json(vid, violation_dir):
    """Load violation JSON."""
    path = os.path.join(violation_dir, "EN", f"{vid}.json")
    if not os.path.exists(path):
        path = os.path.join(violation_dir, f"{vid}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def get_violation_summary_text(violation):
    for field in ["allegation_summary", "legal_theory", "evidentiary_strength"]:
        val = violation.get(field, "")
        if val:
            return val
    return ""


def get_violation_legal_basis_text(violation):
    lb = violation.get("legal_basis", [])
    if isinstance(lb, str) and lb:
        return lb
    if isinstance(lb, list):
        parts = []
        for item in lb:
            if isinstance(item, dict):
                article = item.get("article_name", item.get("article_id", str(item)))
                parts.append(article)
            else:
                parts.append(str(item))
        return "; ".join(parts)
    return ""


def get_violation_cross_refs(violation):
    xrefs = violation.get("cross_references", [])
    if isinstance(xrefs, list):
        refs = []
        for x in xrefs:
            if isinstance(x, dict):
                ref = x.get("ref", x.get("cross_reference_id", ""))
                refs.append(str(ref))
            else:
                refs.append(str(x))
        return refs
    return []


def get_violation_anchor_segments(violation, data):
    """Extract anchor segment info for modal display."""
    anchor = violation.get("evidence_anchor", {})
    if anchor:
        if "segments" in anchor:
            segs = anchor["segments"]
            result = []
            seen_indices = set()
            for seg_id in segs:
                if isinstance(seg_id, dict):
                    seg_id = seg_id.get("id", "")
                seg_id = str(seg_id)
                for i, seg in enumerate(data.get("segments", [])):
                    if i in seen_indices:
                        continue
                    is_match = str(seg.get("id", "")) == seg_id or (
                        seg_id.isdigit() and i == int(seg_id)
                    )
                    if is_match:
                        result.append(seg)
                        seen_indices.add(i)
            result.sort(key=lambda s: s.get("start", 0))
            return result
    return []


def build_violation_modal_entry(violation, vid, data):
    """Build the JS data entry for a violation in the modal."""
    v = violation
    title = html.escape(v.get("title", vid))
    category = v.get("category", "Uncategorized")
    badge_class = get_violation_type_class(category)
    badge = category.split("/")[0].strip()[:20] if "/" in category else category.split("—")[0].strip()[:20]

    body_parts = []

    # Reasoning
    summary = get_violation_summary_text(v)
    if summary:
        body_parts.append(
            f'<div class="modal-section"><div class="modal-section-label">Reasoning</div>'
            f'<div class="modal-reasoning">{escape_html(summary)}</div></div>'
        )

    # Jurisdictions and laws
    legal_basis = get_violation_legal_basis_text(v)
    if legal_basis:
        jurisdiction = get_jurisdiction_label(vid)
        body_parts.append(
            f'<div class="modal-section"><div class="modal-section-label">Engaged Provisions</div>'
            f'<div class="modal-jurisdictions">'
            f'<div class="jurisdiction-pill">'
            f'<div class="jurisdiction-name">{escape_html(jurisdiction)}</div>'
            f'<div class="jurisdiction-laws"><span class="jurisdiction-article">{escape_html(legal_basis)}</span></div>'
            f'</div></div></div>'
        )

    # Cross-references
    xrefs = get_violation_cross_refs(v)
    if xrefs:
        tags = " ".join(f'<span class="xref-tag">{escape_html(x)}</span>' for x in xrefs[:10])
        body_parts.append(
            f'<div class="modal-section"><div class="modal-section-label">Cross-References</div>'
            f'<div class="modal-xrefs">{tags}</div></div>'
        )

    # Anchor segments
    anchor_segs = get_violation_anchor_segments(v, data)
    if anchor_segs:
        seg_html = []
        for seg in anchor_segs:
            time = f"{seg.get('start',0):.2f}s – {seg.get('end',0):.2f}s"
            speaker = escape_html(seg.get('speaker', ''))
            text = escape_html(seg.get('text', ''))
            seg_html.append(f'<div class="modal-segment"><div class="modal-segment-time">{time}</div>'
                            f'<div class="modal-segment-speaker">{speaker}</div>'
                            f'<div class="modal-segment-text">"{text}"</div></div>')
        body_parts.append(
            f'<div class="modal-section"><div class="modal-section-label">Evidentiary Anchor</div>'
            f'<div class="modal-segments">{"".join(seg_html)}</div></div>'
        )

    body = "".join(body_parts)
    footer = escape_html(truncate_at_word(summary, 80)) if summary else "See full violation record"

    return {
        "badge": badge,
        "badgeClass": badge_class,
        "title": title,
        "body": body,
        "footer": footer,
    }


# ---------------------------------------------------------------------------
# HTML template builders
# ---------------------------------------------------------------------------

def build_head(title_text):
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="clean-professional">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape_html(title_text)}</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet">
  <style>
{CSS_VARIABLES}
{CSS_BODY}
  </style>
</head>
"""


def build_masthead(data):
    audio_id = data.get("audio_id", "unknown")
    subtitle = data.get("subtitle", "")
    return f"""  <header class="masthead">
    <div class="masthead-inner">
      <a class="masthead-back" href="../index.html">&larr; Evidence Archive &middot; Index</a>
      <div class="masthead-badge">Audio Evidence &middot; {escape_html(audio_id)}</div>
      <h1>{escape_html(audio_id)}</h1>
      <p class="masthead-sub">{escape_html(subtitle)}</p>
    </div>
  </header>
"""


def get_audio_info(data):
    meta = data.get("metadata", {})
    file_info = meta.get("file_info", {})
    audio_id = data.get("audio_id", "")
    audio_file = (
        file_info.get("file_name")
        or meta.get("processed_audio_file")
        or (f"{audio_id}.m4a" if audio_id else "unknown.m4a")
    )
    stem = audio_file.replace(".m4a", "").replace(".wav", "")
    if not stem or stem == "unknown":
        if audio_id:
            stem = audio_id
    return audio_file, audio_id, stem


def build_stats_bar(data):
    meta = data.get("metadata", {})
    file_info = meta.get("file_info", {})
    audio_props = meta.get("audio_properties", {})

    audio_file, audio_id, _ = get_audio_info(data)
    duration_raw = audio_props.get("duration", "00:00:00")
    duration_fmt = format_duration(duration_raw)

    file_size = file_info.get("file_size_kb", file_info.get("file_size"))
    if isinstance(file_size, (int, float)):
        file_size = f"{file_size:.2f} KB"
    elif isinstance(file_size, str) and file_size.endswith(" bytes"):
        try:
            bytes_val = int(file_size.replace(" bytes", "").strip())
            file_size = f"{bytes_val / 1024:.2f} KB"
        except ValueError:
            pass
    elif not file_size:
        file_size = "Unknown"

    dt_str = data.get("recording_datetime", "")
    date_formatted = format_timestamp(dt_str)

    location = data.get("location", "Unknown")
    language = data.get("language", "Unknown")

    return f"""  <div class="stats-bar">
    <div class="stats-inner">
      <div class="stat-item">
        <div class="stat-val">{escape_html(audio_file)}</div>
        <div class="stat-label">Audio File</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">{duration_fmt}</div>
        <div class="stat-label">Duration</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">{date_formatted}</div>
        <div class="stat-label">Date</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">{escape_html(file_size)}</div>
        <div class="stat-label">File Size</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">{escape_html(location)}</div>
        <div class="stat-label">Location</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">{escape_html(language)}</div>
        <div class="stat-label">Language</div>
      </div>
    </div>
  </div>
"""


def build_transcript_segment(seg, idx):
    speaker = seg.get("speaker", "Unknown")
    text = seg.get("text", "")
    start = seg.get("start", 0)
    end = seg.get("end", 0)
    seg_class = classify_speaker(speaker)

    def fmt_time(seconds):
        if isinstance(seconds, (int, float)):
            return f"{seconds:.2f}s"
        return str(seconds)

    time_str = f"{fmt_time(start)} &rarr; {fmt_time(end)}"
    note_onclick = f"window._noteAt('{fmt_time(start)}&ndash;{fmt_time(end)}')"

    speaker_escaped = escape_html(speaker)
    text_escaped = escape_html(text)

    return f"""        <div class="transcript-segment {seg_class}" id="seg-{idx}">
          <div class="seg-time">{time_str}</div>
          <div class="seg-speaker">{speaker_escaped}</div>
          <p class="seg-text">"{text_escaped}"</p>
          <div class="seg-actions"><button type="button" class="seg-note-btn" onclick="{note_onclick}">+ add note</button></div>
        </div>
"""


def build_transcript_list(data):
    segments = data.get("segments", [])
    lines = ['      <div class="transcript-list">\n']
    for idx, seg in enumerate(segments):
        lines.append(build_transcript_segment(seg, idx))
    lines.append("      </div>\n")
    return "".join(lines)


def build_evidence_grid(data, violation_dir):
    violations_cited = data.get("violations_cited", [])
    lines = ['      <div class="evidence-grid" id="relatedViolations">\n']

    for vid in violations_cited:
        violation = load_violation_json(vid, violation_dir)
        if not violation:
            continue

        category = violation.get("category", "")
        badge_class = get_violation_type_class(category)
        if badge_class == "type-primary":
            border_color = "var(--status-flag)"
        elif badge_class == "type-analysis":
            border_color = "var(--accent)"
        else:
            border_color = "var(--status-analysis)"

        title = violation.get("title", vid)
        summary = get_violation_summary_text(violation)
        legal_basis = get_violation_legal_basis_text(violation)
        anchor_segs = get_violation_anchor_segments(violation, data)

        if anchor_segs:
            first_time = f"{anchor_segs[0].get('start', 0):.2f}s"
            last_time = f"{anchor_segs[-1].get('end', 0):.2f}s"
            if len(anchor_segs) > 1:
                time_range = f"{first_time} – {last_time}"
                seg_ref = f"seg {anchor_segs[0].get('id', '?')} &ndash; {anchor_segs[-1].get('id', '?')}"
            else:
                time_range = first_time
                seg_ref = f"seg {anchor_segs[0].get('id', '?')}"
        else:
            time_range = "Entire recording"
            seg_ref = ""

        type_label = "Primary Evidence" if badge_class == "type-primary" else (
            "Legal Analysis" if badge_class == "type-analysis" else "Procedural Finding")
        summary_short = truncate_at_word(summary, 300)

        lines.append(f"""
        <div class="evidence-card" style="border-left-color: {border_color};">
          <div class="ev-time-col">
            <div class="ev-time">{escape_html(time_range)}</div>
            <div class="ev-duration">{escape_html(seg_ref)}</div>
          </div>
          <div class="ev-body">
            <h3>{escape_html(title)}</h3>
            <p class="ev-summary">{escape_html(summary_short)}</p>
            <div class="ev-provisions">{escape_html(legal_basis)}</div>
          </div>
          <div class="ev-meta-col">
            <span class="ev-type {badge_class}">{escape_html(type_label)}</span>
            <button type="button" class="ev-open" onclick="window.openViolation('{vid}')">View full record &rarr;</button>
          </div>
        </div>
""")
    lines.append("      </div>\n")
    return "".join(lines)


def build_notes_panel(data):
    findings = data.get("key_evidentiary_findings", [])
    lines = ['      <div class="notes-panel" id="notesPanel">\n',
             '        <div class="notes-head">\n',
             '          <span class="notes-label">Forensic Notes</span>\n',
             f'          <span class="notes-count">{len(findings)} annotations</span>\n',
             '        </div>\n',
             '        <div class="notes-list">\n']

    if not findings:
        lines.append('          <div class="notes-empty">No annotations recorded for this audio.</div>\n')
    else:
        for finding in findings:
            ftype = finding.get("type", "Key Point").strip()
            ftype_lower = ftype.lower()
            note_class = ""
            if "admission" in ftype_lower:
                note_class = " note-admission"
            elif "cross" in ftype_lower or "xref" in ftype_lower:
                note_class = " note-xref"

            author = finding.get("author", finding.get("title", ""))
            body_text = finding.get("finding", finding.get("text", ""))
            seg_ref = finding.get("cross_reference", finding.get("segment", ""))

            lines.append(f"""
          <div class="note-card{note_class}">
            <div class="note-meta">
              <span class="note-type">{escape_html(ftype)}</span>
              <span class="note-author">{escape_html(author)}</span>
              <span class="note-seg">{escape_html(seg_ref)}</span>
            </div>
            <div class="note-body">{escape_html(body_text)}</div>
          </div>
""")

    lines.append('        </div>\n')
    lines.append('      </div>\n')
    return "".join(lines)


def build_footer(data):
    meta = data.get("metadata", {})
    audio_props = meta.get("audio_properties", {})

    audio_file, _, _ = get_audio_info(data)
    duration = format_duration(audio_props.get("duration", "00:00:00"))
    dt_str = data.get("recording_datetime", "")
    date_formatted = format_timestamp(dt_str)

    return f"""  <footer class="page-footer">
    <div class="main">
      <p>Disconzi v. LATAM Airlines &mdash; Audio Evidence Archive</p>
      <p class="mono">{escape_html(audio_file)} &middot; {duration} &middot; {date_formatted}</p>
      <p style="margin-top:8px;">This page constitutes direct audio evidence for pending legal proceedings.</p>
    </div>
  </footer>
"""


def js_escape(s):
    """Escape string for JavaScript single-quoted string, embedded inside
    an inline <script> tag."""
    return (
        s.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "")
        .replace("</", "<\\/")
    )


def build_modal_and_js(data, violation_dir):
    violations_cited = data.get("violations_cited", [])
    modal_entries = []
    for vid in violations_cited:
        violation = load_violation_json(vid, violation_dir)
        if violation:
            entry = build_violation_modal_entry(violation, vid, data)
            badge = js_escape(entry["badge"])
            badge_class = js_escape(entry["badgeClass"])
            title = js_escape(entry["title"])
            body = js_escape(entry["body"])
            footer = js_escape(entry["footer"])

            modal_entries.append(f"""        '{vid}': {{
            badge: '{badge}',
            badgeClass: '{badge_class}',
            title: '{title}',
            body: '{body}',
            footer: '{footer}'
          }}""")

    modal_data_js = ",\n".join(modal_entries)
    audio_file, audio_id, _ = get_audio_info(data)

    return f"""  <!-- VIOLATION MODAL -->
  <div class="modal-overlay" id="violationModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-header-body">
          <div class="modal-type-badge" id="modalBadge"></div>
          <div class="modal-title" id="modalTitle"></div>
          <div class="modal-audio-ref" id="modalAudioRef">Evidence: {escape_html(audio_id)}</div>
        </div>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer">
        <span class="modal-footer-note" id="modalFooterNote"></span>
        <button class="modal-download-btn" onclick="downloadViolationJSON()">Download JSON</button>
      </div>
    </div>
  </div>

  <script>
    (function () {{
      var modalData = {{
{modal_data_js}
      }};

      var activeVid = null;

      window.openModal = function (vid) {{
        var d = modalData[vid];
        if (!d) return;
        activeVid = vid;
        var modal = document.getElementById('violationModal');
        var badge = document.getElementById('modalBadge');
        var title = document.getElementById('modalTitle');
        var body = document.getElementById('modalBody');
        var note = document.getElementById('modalFooterNote');
        var audioRef = document.getElementById('modalAudioRef');

        badge.textContent = d.badge;
        badge.className = 'modal-type-badge ' + d.badgeClass;
        title.textContent = d.title;
        body.innerHTML = d.body;
        note.textContent = d.footer;
        if (audioRef) {{
          audioRef.textContent = 'Evidence: {escape_html(audio_id)}';
        }}

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }};

      window.closeModal = function () {{
        var modal = document.getElementById('violationModal');
        if (modal) modal.classList.remove('open');
        document.body.style.overflow = '';
        activeVid = null;
      }};

      window.downloadViolationJSON = function () {{
        if (!activeVid) return;
        var blob = new Blob([JSON.stringify(modalData[activeVid] || {{}}, null, 2)], {{ type: 'application/json' }});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = activeVid + '.json';
        a.click();
      }};

      document.getElementById('violationModal').addEventListener('click', function (e) {{
        if (e.target === this) {{
          window.closeModal();
        }}
      }});

      document.addEventListener('keydown', function (e) {{
        if (e.key === 'Escape') window.closeModal();
      }});

      // Audio player integration (optional)
      var player = new AudioPlayer({{
        container: '.audio-player-container',
        src: '{js_escape(audio_file)}',
        audioId: '{js_escape(audio_id)}',
        segments: {json.dumps(data.get('segments', []), ensure_ascii=False)}
      }});
    }})();
  </script>
"""


# ---------------------------------------------------------------------------
# Main render function
# ---------------------------------------------------------------------------

def render_transcript(json_path, output_path, violation_dir=None):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if violation_dir is None:
        # Default: ../../01-violations/_json relative to the JSON file
        violation_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(json_path))),
            "01-violations", "_json"
        )

    audio_file, audio_id, stem = get_audio_info(data)
    title_text = f"Disconzi v. LATAM — {stem}"

    html_parts = []
    html_parts.append(build_head(title_text))
    html_parts.append(f'<body data-audio-stem="{html.escape(stem)}">\n')
    html_parts.append('  <div class="page">\n')

    # Masthead
    html_parts.append(build_masthead(data))

    # Stats bar
    html_parts.append(build_stats_bar(data))

    # Main content
    html_parts.append('    <div class="main">\n')

    # Transcript section
    html_parts.append('      <div class="section-head">\n')
    html_parts.append('        <h2>Full Transcript</h2>\n')
    html_parts.append('        <p>Speaker-attributed segments in chronological order. Select <strong>+ add note</strong> on any segment to record an annotation against this audio.</p>\n')
    html_parts.append('      </div>\n')
    html_parts.append(build_transcript_list(data))

    # Violations section
    html_parts.append('      <div class="section-head">\n')
    html_parts.append('        <h2>Related Violations</h2>\n')
    html_parts.append('        <p>Structured legal records linked to this audio. Each record identifies the violation, engaged provisions, and evidentiary anchor. <strong>Primary Evidence</strong> denotes an on-tape admission or directly observed fact; <strong>Legal Analysis</strong> denotes an inference drawn from the record and cross-referenced material.</p>\n')
    html_parts.append('      </div>\n')
    html_parts.append(build_evidence_grid(data, violation_dir))

    # Annotations section
    html_parts.append('      <div class="section-head">\n')
    html_parts.append('        <h2>Annotations &amp; Comments</h2>\n')
    html_parts.append('        <p>Key forensic annotations for this audio recording are documented below. These notes identify the legally significant moments captured in this evidence.</p>\n')
    html_parts.append('      </div>\n')
    html_parts.append(build_notes_panel(data))

    html_parts.append('    </div>\n')  # close main

    # Footer
    html_parts.append(build_footer(data))

    html_parts.append('  </div>\n')  # close page

    # Modal and JS
    html_parts.append(build_modal_and_js(data, violation_dir))

    # Pinned nav
    html_parts.append('  <script src="../audio_player.js"></script>\n')
    html_parts.append('  <div class="pinned-nav"><a class="pinned-nav-link" href="../index.html">&larr; Case Index</a><span class="pinned-nav-label">Disconzi v. LATAM Airlines</span></div>\n')
    html_parts.append('</body>\n\n</html>\n')

    output_html = "".join(html_parts)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output_html)

    return output_html


# ---------------------------------------------------------------------------
# Batch processing helper
# ---------------------------------------------------------------------------

def process_folder(input_dir, output_dir, violation_dir=None, recursive=False):
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    if not input_path.is_dir():
        print(f"Error: Input directory '{input_dir}' does not exist.", file=sys.stderr)
        return

    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)

    # Collect JSON files
    if recursive:
        json_files = list(input_path.rglob("*.json"))
    else:
        json_files = list(input_path.glob("*.json"))

    if not json_files:
        print(f"No JSON files found in '{input_dir}'.")
        return

    success_count = 0
    for json_file in json_files:
        try:
            # Determine relative path to preserve structure if recursive
            rel_path = json_file.relative_to(input_path) if recursive else json_file.name
            out_file = output_path / rel_path.with_suffix(".html")
            out_file.parent.mkdir(parents=True, exist_ok=True)

            # Compute violation_dir for this file (if not provided)
            file_violation_dir = violation_dir
            if file_violation_dir is None:
                file_violation_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(json_file))),
                    "01-violations", "_json"
                )

            print(f"Processing: {json_file} -> {out_file}")
            result = render_transcript(str(json_file), str(out_file), file_violation_dir)
            print(f"  Rendered {len(result)} bytes")
            success_count += 1
        except Exception as e:
            print(f"Error processing {json_file}: {e}", file=sys.stderr)

    print(f"\nBatch complete: {success_count}/{len(json_files)} files rendered successfully.")


# ---------------------------------------------------------------------------
# Command-line entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Render JSON transcript(s) to clean-professional themed HTML pages."
    )

    # Single file mode
    parser.add_argument("json_path", nargs="?", help="Path to a single transcript JSON file")
    parser.add_argument("output_path", nargs="?", help="Path to the output HTML file")

    # Batch mode
    parser.add_argument("--input-dir", dest="input_dir", help="Input directory containing JSON transcripts")
    parser.add_argument("--output-dir", dest="output_dir", help="Output directory for rendered HTML files")
    parser.add_argument("--recursive", action="store_true",
                        help="Process subdirectories recursively (only with --input-dir)")

    # Common
    parser.add_argument("--violation-dir", default=None,
                        help="Path to the violations _json directory")

    args = parser.parse_args()

    # Validate modes
    if args.input_dir:
        if not args.output_dir:
            parser.error("--output-dir is required when --input-dir is used")
        if args.json_path or args.output_path:
            parser.error("Positional arguments (json_path, output_path) cannot be used with --input-dir")
        process_folder(args.input_dir, args.output_dir, args.violation_dir, args.recursive)
    else:
        if not args.json_path or not args.output_path:
            parser.error("Either provide positional arguments (json_path output_path) or use --input-dir and --output-dir")
        result = render_transcript(args.json_path, args.output_path, args.violation_dir)
        print(f"Rendered {args.output_path} ({len(result)} bytes)")

        with open(args.json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"  Segments: {len(data.get('segments', []))}")
        print(f"  Violations cited: {len(data.get('violations_cited', []))}")
        print(f"  Key findings: {len(data.get('key_evidentiary_findings', []))}")
        print(f"  Forensic clusters: {len(data.get('forensic_clusters', {}))}")