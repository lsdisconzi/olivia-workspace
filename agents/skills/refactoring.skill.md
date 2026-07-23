---
name: refactoring
description: Restructures legacy code without changing its external behaviour.
---

# SKILL – Refactoring

## Capabilities
- Break large functions into smaller, reusable functions.
- Extract magic numbers and strings into constants or configuration objects.
- Remove dead code and redundant comments.
- Rename variables and functions for clarity.
- Reorganise file and folder structures logically.
- Convert callbacks to promises/async-await where appropriate.
- Apply consistent coding style (indentation, quotes, etc.).

## Usage Guidelines
- Always verify that the refactored code produces identical output or behaviour.
- Provide a before/after comparison or a diff when proposing changes.
- Focus on improving readability, maintainability, and testability.
- Do not introduce new dependencies unless they are part of the migration plan.
- Preserve the original API signatures of exported functions unless explicitly asked to change them.