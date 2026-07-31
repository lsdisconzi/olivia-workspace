"""Project summary extraction from planning files (Phase 2).

Automatically generates a compact, structured summary from live planning
files (task_plan.md, memory.md, progress.md) on every prompt build.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional


def generate_summary(project_dir: Path, max_decisions: int = 3) -> str:
    """Extract a lightweight project summary from planning files.

    Reads task_plan.md, memory.md, and progress.md and returns a compact
    structured block like:

        [Phase] Phase 1: audio-only pipeline (active)
        [Decisions] 1. reuse-before-build; 2. orchestration layer
        [Last update] 2026-07-30: Initial setup completed.

    Parameters
    ----------
    project_dir : Path
        Path to the project root containing the planning files.
    max_decisions : int
        Maximum number of sticky decisions to include (default 3).

    Returns
    -------
    str
        Compact summary block, or "[Phase] (no task_plan.md)" if files
        are missing.
    """
    parts: list[str] = []

    # 1. Extract current phase from task_plan.md
    task_plan = _safe_read(project_dir / "task_plan.md")
    if task_plan:
        phase = _extract_current_phase(task_plan)
        parts.append(f"[Phase] {phase}")
    else:
        parts.append("[Phase] (no task_plan.md)")

    # 2. Extract top-N decisions from memory.md
    memory = _safe_read(project_dir / "memory.md")
    if memory:
        decisions = _extract_decisions(memory, max_decisions)
        if decisions:
            parts.append(f"[Decisions] {'; '.join(decisions)}")

    # 3. Extract last session log entry from progress.md
    progress = _safe_read(project_dir / "progress.md")
    if progress:
        last_update = _extract_last_update(progress)
        if last_update:
            parts.append(f"[Last update] {last_update}")

    return "\n".join(parts)


def _safe_read(path: Path) -> Optional[str]:
    """Read a file, returning None if it doesn't exist or is empty."""
    try:
        if path.is_file():
            content = path.read_text(encoding="utf-8").strip()
            return content if content else None
    except (OSError, UnicodeDecodeError):
        pass
    return None


def _extract_current_phase(content: str) -> str:
    """Extract the active phase from task_plan.md content.

    Looks for the first '## Current Phase' line and extracts the value.
    Falls back to finding the first '## Phases' heading and the first
    checked or unchecked phase item.
    """
    # Try Current Phase first
    match = re.search(
        r"## Current Phase\s*\n\s*[-–—]?\s*(.+?)(?:\n|$)",
        content,
        re.IGNORECASE | re.MULTILINE,
    )
    if match:
        phase = match.group(1).strip()
        if phase and phase != "in_progress":
            return phase

    # Fall back to first marked phase under ## Phases
    in_phases = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Phases"):
            in_phases = True
            continue
        if in_phases:
            if stripped.startswith("## "):
                break  # next heading
            # Check for checked or unchecked phase items
            match = re.match(r"-\s*\[([ xX])\]\s*(.+)$", stripped)
            if match:
                status = "active" if match.group(1).lower() == "x" else "pending"
                return f"{match.group(2).strip()} ({status})"

    return "in_progress"


def _extract_decisions(content: str, max_items: int = 3) -> list[str]:
    """Extract sticky decisions from memory.md.

    Looks for items under '## Decisions & Conventions (sticky)' that
    start with '**Decision:**'.
    """
    decisions: list[str] = []
    in_decisions = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Decisions"):
            in_decisions = True
            continue
        if in_decisions:
            if stripped.startswith("## "):
                break  # next section
            match = re.match(r"- \*\*Decision:\s*(.+?)\*\*\s*[-–—]?\s*(.*)$", stripped)
            if match:
                label = (match.group(1) + ": " + match.group(2)).strip(": ")
                decisions.append(label.strip())
                if len(decisions) >= max_items:
                    break

    # If no **Decision:** items, try plain list items under the section
    if not decisions:
        in_decisions = False
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("## Decisions"):
                in_decisions = True
                continue
            if in_decisions:
                if stripped.startswith("## "):
                    break
                match = re.match(r"- (.+)$", stripped)
                if match:
                    decisions.append(match.group(1).strip())
                    if len(decisions) >= max_items:
                        break

    # Trim long decisions
    trimmed: list[str] = []
    for d in decisions:
        if len(d) > 80:
            d = d[:77] + "..."
        trimmed.append(d)

    return trimmed


def _extract_last_update(content: str) -> Optional[str]:
    """Extract the latest session log entry from progress.md.

    Looks for the most recent '### [DATE]' entry and takes the first
    meaningful line or the Actions taken list.
    """
    # Find the first date heading
    date_match = re.search(r"###\s+(\d{4}-\d{2}-\d{2})\s*[-–—]\s*(.*?)(?:\n|$)", content)
    if not date_match:
        return None

    date = date_match.group(1)
    title = date_match.group(2).strip()

    # Find the first action item after this date heading
    after_date = content[date_match.end():]
    action_match = re.search(r"-\s+(.+)", after_date)
    first_action = action_match.group(1).strip() if action_match else ""

    if title and first_action:
        return f"{date}: {title} — {first_action}"
    elif title:
        return f"{date}: {title}"
    elif first_action:
        return f"{date}: {first_action}"
    return date
