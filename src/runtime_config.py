#!/usr/bin/env python3
"""Shared runtime environment bootstrap helpers for OliviaLegal."""

from __future__ import annotations

import os
from pathlib import Path


def _iter_env_lines(path: Path):
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        yield key, value


def _load_env_file(path: Path) -> bool:
    if not path.is_file():
        return False
    for key, value in _iter_env_lines(path):
        os.environ.setdefault(key, value)
    return True


def bootstrap_environment(root: Path | None = None) -> list[Path]:
    """Load standard Olivia env files without overriding existing process env.

    Load order:
    1) <root>/.env
    2) <root>/_shared/.env
    """
    root_dir = (root or Path(__file__).resolve().parent.parent).resolve()
    loaded: list[Path] = []

    for candidate in (root_dir / ".env", root_dir / "_shared" / ".env"):
        if _load_env_file(candidate):
            loaded.append(candidate)

    return loaded
