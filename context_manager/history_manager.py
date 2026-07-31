"""Conversation history management (Phase 5).

Handles adaptive truncation, quote de-duplication, and optional history
summarisation to keep prompts within token budget.
"""

from __future__ import annotations

import difflib
from typing import Any


def truncate_history(
    history: list[dict[str, str]],
    max_turns: int = 3,
    max_tokens_est: int = 800,
) -> list[dict[str, str]]:
    """Keep the most recent turns, respecting token budget.

    Parameters
    ----------
    history : list[dict[str, str]]
        List of message dicts with 'role' and 'content'.
    max_turns : int
        Default number of turns to keep (default 3).
    max_tokens_est : int
        Rough token limit for history section (default 800).

    Returns
    -------
    list[dict[str, str]]
        Truncated history, newest turns preserved.
    """
    if not history:
        return []

    # Always start from the end
    selected: list[dict[str, str]] = []
    token_count = 0

    for msg in reversed(history):
        # Rough token estimate: 1 token ≈ 4 chars
        msg_tokens = len(msg.get("content", "")) // 4 + 1

        if len(selected) >= max_turns * 2 or (token_count + msg_tokens) > max_tokens_est:
            break

        selected.insert(0, msg)
        token_count += msg_tokens

    return selected


def deduplicate_user_quote(
    history: list[dict[str, str]],
    user_message: str,
    similarity_threshold: float = 0.8,
) -> str:
    """Remove repeated content if the user message largely quotes the last assistant reply.

    If the user message is ≥80% similar to the content of the last assistant
    message, replace it with a condensed marker.

    Parameters
    ----------
    history : list[dict[str, str]]
        Recent conversation history (already truncated).
    user_message : str
        The new user message to check.
    similarity_threshold : float
        Ratio threshold for considering a duplicate (default 0.8).

    Returns
    -------
    str
        The original user_message or a placeholder if it was a duplicate.
    """
    if not history or len(history) < 2:
        return user_message

    # Find the last assistant message
    last_assistant_content = None
    for msg in reversed(history):
        if msg.get("role") == "assistant":
            last_assistant_content = msg.get("content", "")
            break

    if not last_assistant_content:
        return user_message

    # Calculate similarity ratio
    ratio = _similarity_ratio(user_message, last_assistant_content)

    if ratio >= similarity_threshold:
        return "[User referenced previous response; same context applies]"

    return user_message


def _similarity_ratio(a: str, b: str) -> float:
    """Compute a quick similarity ratio between two strings.

    Uses SequenceMatcher on a sample if strings are very long.
    """
    # For very long strings, sample the first and last 500 chars
    if len(a) > 1000 or len(b) > 1000:
        sample_a = a[:500] + a[-500:] if len(a) > 1000 else a
        sample_b = b[:500] + b[-500:] if len(b) > 1000 else b
        return difflib.SequenceMatcher(None, sample_a, sample_b).ratio()

    return difflib.SequenceMatcher(None, a, b).ratio()
