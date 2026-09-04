#!/usr/bin/env python3
"""
Builds a self-contained, playable HTML "compilation" page from marked transcript
segments gathered across multiple rendered transcript pages.

A compilation is a named HTML file that collects the segments the user marked
(★) on the individual transcript pages, orders them chronologically across all
source recordings, and clearly labels each one with the source file, sequence,
narrative, audio file and segment index. Every segment keeps its own Play button
so the user can listen to the exact audio clip it came from.

Usage (CLI):
    python3 scripts/build_compilation.py \
        --name "my-compilation" \
        --title "My Compilation" \
        --case-root _shared/cases/la8159 \
        --source-dir _shared/cases/la8159/02-transcripts/I-002 \
        --audio-map _shared/cases/la8159/02-transcripts/transcripts_rendered/audio_map.json \
        --out-dir _shared/cases/la8159/02-transcripts/transcripts_rendered/compilations \
        --picks 'aeropuerto_STG_2:7' 'aeropuerto_STG_2:13' 'aeropuerto_STG_8:0'

The module is also importable so serve.py can generate compilations server-side
via ``build_compilation_html(...)``.
"""

import json
import os
import re
import sys
import html
from datetime import datetime, timedelta
from pathlib import Path

# Reuse the shared CSS + helpers from the transcript renderer so the compilation
# pages look and behave like the individual transcript pages.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_transcript import (  # noqa: E402
    CSS_VARIABLES,
    CSS_BODY,
    escape_html,
    classify_speaker,
    format_quote_datetime,
    format_timestamp,
    js_escape,
)


# ---------------------------------------------------------------------------
# Extra CSS specific to the compilation page (source chips, group headers,
# the shared audio bar, etc.)
# ---------------------------------------------------------------------------

COMPILATION_CSS = """
    /* Compilation-specific layout */
    .compilation-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .compilation-meta .chip {
      font-family: var(--mono);
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 12px;
    }
    .compilation-meta .chip b { color: var(--accent); font-weight: 600; }

    .source-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--mono);
      font-size: 0.66rem;
      letter-spacing: 0.03em;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid rgba(36, 64, 95, 0.18);
      border-radius: 3px;
      padding: 3px 8px;
      margin-bottom: 8px;
    }
    .source-chip .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--status-analysis);
      flex: 0 0 auto;
    }

    .compilation-segment {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border-strong);
      border-radius: 3px;
      padding: 14px 18px;
      margin-bottom: 10px;
    }
    .compilation-segment.seg-passenger { border-left-color: var(--accent); }
    .compilation-segment.seg-staff { border-left-color: var(--status-flag); }
    .compilation-segment.seg-other { border-left-style: dashed; border-left-color: var(--status-analysis); }

    .comp-seg-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px 16px;
      margin-bottom: 6px;
    }
    .comp-seg-datetime {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--status-analysis);
    }
    .comp-seg-time {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      letter-spacing: 0.02em;
    }
    .comp-seg-speaker {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    .comp-seg-text {
      font-size: 0.92rem;
      color: var(--text-secondary);
      line-height: 1.65;
      font-style: italic;
    }
    .comp-seg-text::before { content: "\\201C"; }
    .comp-seg-text::after { content: "\\201D"; }

    /* Word-level karaoke highlighting during playback */
    .compilation-segment .comp-seg-text .wl-word {
      border-radius: 2px;
      padding: 0 1px;
      margin: 0 -1px;
      transition: background-color 0.12s ease, color 0.12s ease;
    }
    .compilation-segment .comp-seg-text .wl-word.active {
      background: #f5d97a;
      color: #1b1c1e;
    }
    .compilation-segment .comp-seg-text .wl-word.past {
      color: #8a8b87;
    }
    .compilation-segment.is-playing {
      background: rgba(36, 64, 95, 0.05);
      border-left-color: #c9a84c;
    }
    .comp-seg-actions {
      margin-top: 10px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .comp-seg-play-btn {
      font-family: var(--mono);
      font-size: 0.68rem;
      padding: 5px 14px;
      border-radius: 3px;
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
      font-weight: 600;
      line-height: 1.4;
    }
    .comp-seg-play-btn:hover { background-color: var(--accent-dim); }
    .comp-seg-play-btn.is-playing { background-color: var(--accent); color: #fff; }

    .comp-seg-source {
      font-family: var(--mono);
      font-size: 0.66rem;
      color: var(--text-muted);
      margin-left: auto;
      text-align: right;
    }
    .comp-seg-source .src-file { color: var(--text-secondary); }

    .comp-group {
      margin-bottom: 26px;
    }
    .comp-group-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }
    .comp-group-num {
      font-family: var(--mono);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-dim);
      border-radius: 3px;
      padding: 3px 8px;
    }
    .comp-group-title {
      font-family: var(--serif);
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .comp-group-sub {
      font-family: var(--mono);
      font-size: 0.68rem;
      color: var(--text-muted);
      margin-left: auto;
      text-align: right;
    }

    /* Shared audio bar (fixed at bottom) */
    .comp-audio-bar {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      background: var(--bg-card);
      border-top: 1px solid var(--border-strong);
      padding: 8px 24px;
      display: flex;
      align-items: center;
      gap: 14px;
      z-index: 50;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    }
    .comp-audio-bar .now-label {
      font-family: var(--mono);
      font-size: 0.66rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .comp-audio-bar .now-file {
      font-family: var(--mono);
      font-size: 0.72rem;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .comp-audio-bar .now-time {
      font-family: var(--mono);
      font-size: 0.72rem;
      color: var(--accent);
      white-space: nowrap;
    }
    .comp-audio-bar .stop-btn {
      font-family: var(--mono);
      font-size: 0.68rem;
      padding: 4px 12px;
      border-radius: 3px;
      background: transparent;
      color: var(--status-flag);
      border: 1px solid var(--status-flag);
      cursor: pointer;
    }
    .comp-audio-bar .stop-btn:hover { background: var(--status-flag-dim); }
    body { padding-bottom: 64px; }

    .comp-empty {
      background: var(--bg-card);
      border: 1px dashed var(--border-strong);
      border-radius: 6px;
      padding: 40px;
      text-align: center;
      color: var(--text-secondary);
    }
    .comp-empty h3 { font-family: var(--serif); color: var(--text-primary); margin-bottom: 8px; }
"""


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def _parse_dt(dt_str):
    """Parse an ISO datetime string to a datetime, or None."""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(str(dt_str).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _seg_start(seg):
    try:
        return float(seg.get("start", 0) or 0)
    except (ValueError, TypeError):
        return 0.0


def _seg_end(seg):
    try:
        return float(seg.get("end", 0) or 0)
    except (ValueError, TypeError):
        return _seg_start(seg) + 1.0


def _fmt_seconds(seconds):
    try:
        return f"{float(seconds):.2f}s"
    except (ValueError, TypeError):
        return str(seconds)


def _fmt_clock(seconds):
    """Format seconds as HH:MM:SS.mmm for the audio bar."""
    try:
        seconds = float(seconds)
    except (ValueError, TypeError):
        return "0:00"
    total_ms = int(round(seconds * 1000))
    ms = total_ms % 1000
    total_s = total_ms // 1000
    s = total_s % 60
    m = (total_s // 60) % 60
    h = total_s // 3600
    if h:
        return f"{h}:{m:02d}:{s:02d}.{ms:03d}"
    return f"{m}:{s:02d}.{ms:03d}"


def _audio_url_for_segment(audio_map, stem, map_key, seg_index):
    """Resolve the raw audio path for a segment from the audio map.

    Returns the raw path (e.g. ``_shared/cases/la8159/10-audio/...``) or None.
    """
    if not audio_map:
        return None
    mapping = None
    for key in (map_key, stem, (stem or "").lower()):
        if key and key in audio_map:
            mapping = audio_map[key]
            break
    if not mapping:
        return None
    return mapping.get(str(seg_index))


def _to_case_files_url(raw_path):
    """Convert a raw audio path to a /case_files/... absolute URL.

    Raw paths look like ``_shared/cases/la8159/10-audio/...``. The static route
    serves ``_shared/cases/LA8159`` at ``/case_files/``, so we strip the leading
    ``_shared/cases/la8159/`` (case-insensitive) prefix.
    """
    if not raw_path:
        return None
    u = str(raw_path).replace("\\", "/")
    low = u.lower()
    marker = "_shared/cases/la8159/"
    if marker in low:
        idx = low.index(marker)
        rel = u[idx + len(marker):]
        return "/case_files/" + rel
    # Fallback: try to find the 10-audio segment
    marker2 = "10-audio/"
    if marker2 in low:
        idx = low.index(marker2)
        return "/case_files/" + u[idx:]
    return u


# ---------------------------------------------------------------------------
# HTML builders
# ---------------------------------------------------------------------------

def _build_head(title_text):
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
{COMPILATION_CSS}
  </style>
</head>
"""


def _build_masthead(compilation_title, created_label, segment_count, source_count):
    return f"""  <header class="masthead">
    <div class="masthead-inner">
      <div class="masthead-row">
        <a class="masthead-back" href="../index.html">&larr; Evidence Archive &middot; Index</a>
        <div class="masthead-actions">
          <a class="masthead-full-narrative" href="../index.html">Case Index</a>
        </div>
      </div>
      <div class="masthead-badge">Marked Segments Compilation</div>
      <h1>{escape_html(compilation_title)}</h1>
      <p class="masthead-sub">Chronological compilation of marked transcript segments across multiple audio recordings.</p>
      <div class="compilation-meta">
        <span class="chip"><b>{segment_count}</b> marked segment{'' if segment_count == 1 else 's'}</span>
        <span class="chip"><b>{source_count}</b> source recording{'' if source_count == 1 else 's'}</span>
        <span class="chip">Created {escape_html(created_label)}</span>
      </div>
    </div>
  </header>
"""


def _build_segment_card(entry, seq):
    """Build one marked-segment card.

    ``entry`` is a dict with keys: stem, map_key, transcript_id, narrative_id,
    chronological_order, title, subtitle, audio_id, recording_datetime, seg
    (the raw segment dict), audio_url (resolved /case_files/ URL or None).
    """
    seg = entry["seg"]
    speaker = seg.get("speaker", "Unknown")
    text = seg.get("text", "")
    start = _seg_start(seg)
    end = _seg_end(seg)
    seg_class = classify_speaker(speaker)
    quote_datetime = format_quote_datetime(entry.get("recording_datetime", ""), start)

    seg_index = seg.get("index", entry.get("seg_index", ""))
    source_file = entry.get("transcript_id", entry.get("stem", ""))
    narrative = entry.get("title") or entry.get("narrative_id") or ""
    audio_id = entry.get("audio_id") or entry.get("stem", "")
    audio_url = entry.get("audio_url") or ""

    time_str = f"{_fmt_seconds(start)} &rarr; {_fmt_seconds(end)}"
    start_clock = _fmt_clock(start)
    end_clock = _fmt_clock(end)

    play_attrs = ""
    if audio_url:
        play_attrs = (
            f' data-audio-url="{escape_html(audio_url)}"'
            f' data-start="{start}" data-end="{end}"'
            f' data-start-clock="{escape_html(start_clock)}"'
            f' data-end-clock="{escape_html(end_clock)}"'
            f' data-file="{escape_html(audio_id)}"'
        )

    return f"""        <div class="compilation-segment {seg_class}" id="comp-seg-{seq}">
          <div class="source-chip"><span class="dot"></span>{escape_html(source_file)}</div>
          <div class="comp-seg-head">
            <span class="comp-seg-datetime">{escape_html(quote_datetime)}</span>
            <span class="comp-seg-time">{time_str}</span>
            <span class="comp-seg-source">
              <span class="src-file">{escape_html(audio_id)}</span> &middot; seg {escape_html(str(seg_index))}
            </span>
          </div>
          <div class="comp-seg-speaker">{escape_html(speaker)}</div>
          <p class="comp-seg-text">{escape_html(text)}</p>
          <div class="comp-seg-actions">
            <button type="button" class="comp-seg-play-btn"{play_attrs}>▶ Play</button>
            <span class="comp-seg-source" style="margin-left:auto;">
              <span class="src-file">{escape_html(narrative)}</span>
            </span>
          </div>
        </div>
"""


def _build_player_js():
    """Self-contained multi-file player for the compilation page.

    Each Play button carries data-audio-url / data-start / data-end. A single
    shared <audio> element plays the segment's pre-sliced audio clip from time 0
    (the clip already starts at the segment's own start). While it plays, the
    segment's transcript text is highlighted word-by-word (karaoke style) using
    proportionally estimated word timings across the clip duration.
    """
    return """
  <script>
    (function () {
      var audio = new Audio();
      var activeBtn = null;
      var activeWords = [];
      var activeSegEl = null;
      var rafId = null;
      var nowFile = document.getElementById('nowFile');
      var nowTime = document.getElementById('nowTime');

      function fmtClock(sec) {
        sec = Number(sec) || 0;
        var ms = Math.round((sec % 1) * 1000);
        var s = Math.floor(sec);
        var m = Math.floor(s / 60);
        s = s % 60;
        var h = Math.floor(m / 60);
        m = m % 60;
        var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };
        if (h) return h + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(ms, 3);
        return m + ':' + pad(s, 2) + '.' + pad(ms, 3);
      }

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      // Split a segment's text element into per-word spans so individual words
      // can be highlighted in sync with playback. Returns [{el, weight, start, end}].
      function tokenizeWords(segTextEl) {
        var raw = segTextEl.textContent;
        var tokens = raw.split(/(\\s+)/);
        var html = '';
        var words = [];
        for (var i = 0; i < tokens.length; i++) {
          var tok = tokens[i];
          if (/^\\s*$/.test(tok)) {
            html += tok;
          } else {
            html += '<span class="wl-word">' + escapeHtml(tok) + '</span>';
            words.push({ el: null, weight: tok.length, start: 0, end: 0 });
          }
        }
        segTextEl.innerHTML = html;
        var spans = segTextEl.querySelectorAll('.wl-word');
        for (var k = 0; k < spans.length; k++) words[k].el = spans[k];
        return words;
      }

      // Distribute word timings proportionally (by character weight) across the
      // clip duration. No real word timestamps exist in the source data.
      function assignWordTimes(words, duration) {
        if (!duration || duration <= 0) return;
        var totalWeight = 0;
        for (var i = 0; i < words.length; i++) totalWeight += words[i].weight;
        if (!totalWeight) return;
        var cum = 0;
        for (var j = 0; j < words.length; j++) {
          var w = words[j];
          w.start = duration * (cum / totalWeight);
          cum += w.weight;
          w.end = duration * (cum / totalWeight);
        }
      }

      function clearHighlight() {
        if (activeSegEl) activeSegEl.classList.remove('is-playing');
        for (var i = 0; i < activeWords.length; i++) {
          activeWords[i].el.classList.remove('active', 'past');
        }
        activeWords = [];
        activeSegEl = null;
      }

      function updateHighlight() {
        if (!audio || !activeWords.length) return;
        var t = audio.currentTime;
        var activeFound = false;
        for (var i = 0; i < activeWords.length; i++) {
          var w = activeWords[i];
          if (!activeFound && t >= w.start && t < w.end) {
            w.el.classList.add('active');
            w.el.classList.remove('past');
            activeFound = true;
          } else {
            w.el.classList.remove('active');
            if (t >= w.end) w.el.classList.add('past');
            else w.el.classList.remove('past');
          }
        }
      }

      function startHighlightLoop() {
        function tick() {
          if (rafId === null) return;
          updateHighlight();
          rafId = requestAnimationFrame(tick);
        }
        rafId = requestAnimationFrame(tick);
      }

      function stop() {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        try { audio.pause(); } catch (e) {}
        try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
        if (activeBtn) {
          activeBtn.classList.remove('is-playing');
          activeBtn.textContent = '\\u25b6 Play';
          activeBtn = null;
        }
        clearHighlight();
        if (nowFile) nowFile.textContent = 'No audio playing';
        if (nowTime) nowTime.textContent = '';
      }

      function playSegment(btn) {
        var url = btn.getAttribute('data-audio-url');
        var start = Number(btn.getAttribute('data-start')) || 0;
        var end = Number(btn.getAttribute('data-end')) || 0;
        var file = btn.getAttribute('data-file') || '';
        if (!url) { alert('No audio available for this segment.'); return; }

        // If this button is already playing, stop it.
        if (activeBtn === btn) { stop(); return; }

        stop();
        activeBtn = btn;
        btn.classList.add('is-playing');
        btn.textContent = '\\u23f8 Pause';
        if (nowFile) nowFile.textContent = file;
        if (nowTime) nowTime.textContent = fmtClock(start) + ' \\u2192 ' + fmtClock(end);

        // Words for this segment were tokenized once at init (btn._words).
        activeWords = btn._words || [];
        activeSegEl = btn._segEl || null;

        // The clip is pre-sliced to this segment, so it starts at time 0.
        audio.src = url;
        audio.currentTime = 0;
        audio.play().then(function () {
          assignWordTimes(activeWords, audio.duration);
          if (activeWords.length && activeSegEl) activeSegEl.classList.add('is-playing');
          startHighlightLoop();
        }).catch(function (e) {
          console.error('Playback failed:', e);
          btn.textContent = '\\u26a0 Error';
          clearActive();
        });
      }

      function clearActive() {
        if (activeBtn) {
          activeBtn.classList.remove('is-playing');
          activeBtn.textContent = '\\u25b6 Play';
          activeBtn = null;
        }
      }

      audio.addEventListener('ended', function () { stop(); });
      audio.addEventListener('error', function () {
        if (activeBtn) { activeBtn.textContent = '\\u26a0 Error'; }
        clearActive();
      });

      // Tokenize each segment's text once and wire up its play button.
      document.querySelectorAll('.comp-seg-play-btn').forEach(function (btn) {
        var card = btn.closest('.compilation-segment');
        var segTextEl = card ? card.querySelector('.comp-seg-text') : null;
        btn._words = segTextEl ? tokenizeWords(segTextEl) : [];
        btn._segEl = card;
        btn.addEventListener('click', function () { playSegment(btn); });
      });

      var stopBtn = document.getElementById('stopPlayback');
      if (stopBtn) stopBtn.addEventListener('click', stop);
    })();
  </script>
"""


def _build_audio_bar():
    return """  <div class="comp-audio-bar">
    <span class="now-label">Now playing</span>
    <span class="now-file" id="nowFile">No audio playing</span>
    <span class="now-time" id="nowTime"></span>
    <button type="button" class="stop-btn" id="stopPlayback">■ Stop</button>
  </div>
"""


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def build_compilation_html(entries, compilation_title="Marked Segments Compilation",
                           created_label="", audio_map=None):
    """Build the full HTML for a compilation from a list of ``entries``.

    Each entry is a dict (see ``_build_segment_card``). Entries are expected to
    already be in chronological order. Returns the HTML string.
    """
    if not created_label:
        created_label = datetime.now().strftime("%B %d, %Y")

    # Group entries by source stem so we can render a small group header per
    # source recording while preserving overall chronological order.
    groups = []
    current = None
    for entry in entries:
        stem = entry.get("stem", "")
        if current is None or current["stem"] != stem:
            current = {"stem": stem, "entries": []}
            groups.append(current)
        current["entries"].append(entry)

    source_count = len(groups)
    segment_count = len(entries)

    parts = []
    parts.append(_build_head(f"Disconzi v. LATAM — {compilation_title}"))
    parts.append('  <body>\n')
    parts.append('    <div class="page">\n')
    parts.append(_build_masthead(compilation_title, created_label, segment_count, source_count))
    parts.append('      <div class="main">\n')
    parts.append('        <div class="section-head" style="padding-top:0;">\n')
    parts.append('          <h2>Marked Segments &mdash; Chronological</h2>\n')
    parts.append('          <p>Every segment below was marked (★) on its source transcript page. Segments are ordered by the actual recording time across all source files. Use <strong>▶ Play</strong> on any segment to hear the exact audio clip it came from.</p>\n')
    parts.append('        </div>\n')

    if not entries:
        parts.append('          <div class="comp-empty"><h3>No marked segments</h3><p>Mark segments on the individual transcript pages, then create a compilation here.</p></div>\n')
    else:
        seq = 0
        for group in groups:
            first = group["entries"][0]
            parts.append('        <div class="comp-group">\n')
            parts.append('          <div class="comp-group-head">\n')
            parts.append(f'            <span class="comp-group-num">{escape_html(str(first.get("chronological_order", "?")))}</span>\n')
            parts.append(f'            <span class="comp-group-title">{escape_html(first.get("title") or first.get("narrative_id") or first.get("stem", ""))}</span>\n')
            parts.append(f'            <span class="comp-group-sub">{escape_html(first.get("audio_id") or first.get("stem", ""))} &middot; {len(group["entries"])} marked</span>\n')
            parts.append('          </div>\n')
            for entry in group["entries"]:
                seq += 1
                parts.append(_build_segment_card(entry, seq))
            parts.append('        </div>\n')

    parts.append('      </div>\n')  # close main
    parts.append('    </div>\n')  # close page
    parts.append(_build_audio_bar())
    parts.append(_build_player_js())
    parts.append('  </body>\n')
    parts.append('</html>\n')

    return "".join(parts)


def collect_marked_entries(source_dir, audio_map, marks_by_stem):
    """Collect full segment entries for every marked segment.

    ``marks_by_stem`` maps a stem (audio_id) to a list of marked segment indices
    (as strings). Returns a list of entry dicts in chronological order.
    """
    source_dir = Path(source_dir)
    entries = []
    for json_path in sorted(source_dir.glob("*.json")):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        stem = data.get("audio_id", "")
        if not stem:
            continue
        marks = marks_by_stem.get(stem)
        if not marks:
            continue
        mark_set = set(str(m) for m in marks)
        segments = data.get("segments", [])
        recording_dt = data.get("recording_datetime", "")
        map_key = re.sub(r"[^a-z0-9]+", "_", Path(json_path).stem.lower()).strip("_")
        for seg in segments:
            idx = seg.get("index")
            if str(idx) not in mark_set:
                continue
            raw_url = _audio_url_for_segment(audio_map, stem, map_key, idx)
            entries.append({
                "stem": stem,
                "map_key": map_key,
                "transcript_id": data.get("transcript_id", Path(json_path).stem),
                "narrative_id": data.get("narrative_id", ""),
                "chronological_order": data.get("chronological_order", 0),
                "title": data.get("title", ""),
                "subtitle": data.get("subtitle", ""),
                "audio_id": stem,
                "recording_datetime": recording_dt,
                "seg_index": idx,
                "seg": seg,
                "audio_url": _to_case_files_url(raw_url),
            })

    # Chronological sort: recording datetime first, then segment start time.
    def sort_key(e):
        dt = _parse_dt(e.get("recording_datetime", ""))
        dt_key = dt.timestamp() if dt else 0.0
        return (dt_key, _seg_start(e["seg"]), int(e.get("seg_index", 0)))

    entries.sort(key=sort_key)
    return entries


def build_compilation_file(name, compilation_title, source_dir, audio_map,
                           marks_by_stem, out_dir, created_label=""):
    """Collect marked entries and write a compilation HTML file.

    Returns the output Path.
    """
    entries = collect_marked_entries(source_dir, audio_map, marks_by_stem)
    html_str = build_compilation_html(entries, compilation_title=compilation_title,
                                      created_label=created_label, audio_map=audio_map)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^\w\-]+", "_", name).strip("_") or "compilation"
    out_path = out_dir / f"{safe_name}.html"
    out_path.write_text(html_str, encoding="utf-8")
    return out_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main(argv):
    import argparse
    parser = argparse.ArgumentParser(description="Build a marked-segments compilation HTML page.")
    parser.add_argument("--name", required=True, help="Compilation file name (slug).")
    parser.add_argument("--title", default="", help="Human-readable compilation title.")
    parser.add_argument("--case-root", default="", help="Case root, e.g. _shared/cases/la8159 (informational).")
    parser.add_argument("--source-dir", required=True, help="Directory of source transcript JSONs.")
    parser.add_argument("--audio-map", required=True, help="Path to audio_map.json.")
    parser.add_argument("--out-dir", required=True, help="Output directory for compilation HTML.")
    parser.add_argument("--marks-dir", default="",
                        help="Directory of segment_marks JSON files (default: <repo>/data/segment_marks).")
    parser.add_argument("--picks", nargs="*", default=None,
                        help="Optional explicit picks as stem:index (e.g. aeropuerto_STG_2:7). "
                             "If omitted, all currently-marked segments are used.")
    args = parser.parse_args(argv)

    with open(args.audio_map, "r", encoding="utf-8") as f:
        audio_map = json.load(f)

    if args.picks:
        marks_by_stem = {}
        for pick in args.picks:
            if ":" not in pick:
                continue
            stem, idx = pick.split(":", 1)
            marks_by_stem.setdefault(stem, []).append(idx)
    else:
        # Load marks from data/segment_marks/<stem>.json (repo root by default)
        marks_root = Path(args.marks_dir) if args.marks_dir else (
            Path(__file__).resolve().parent.parent / "data" / "segment_marks"
        )
        marks_by_stem = {}
        if marks_root.is_dir():
            for fp in sorted(marks_root.glob("*.json")):
                try:
                    marks = json.loads(fp.read_text(encoding="utf-8"))
                except Exception:
                    continue
                if isinstance(marks, list):
                    marks_by_stem[fp.stem] = [str(m) for m in marks]

    out_path = build_compilation_file(
        args.name, args.title or args.name, args.source_dir, audio_map,
        marks_by_stem, args.out_dir,
    )
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    _main(sys.argv[1:])
