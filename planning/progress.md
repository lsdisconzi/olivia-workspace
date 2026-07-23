<!--
PURPOSE: The running session log — *what happened*. Append after each meaningful action
batch. Parsed by serve.py (_extract_actions, _extract_passed_tests, _extract_next_step),
so keep the markers stable: a "## Status" table with a "| Where am I going? | ... |" row,
an "- Actions taken:" bullet block, and a "| Test | Expected | Actual | Status |" table.
HTML comments like this one are stripped by the parsers.
Lives in planning/progress.md; auto-injected into every agent run.
-->

# Progress

## Status
| Question | Answer |
|----------|--------|
| Where am I? | [Current milestone or phase] |
| Where am I going? | [Next milestone or phase] |
| What will I do next? | [Concrete next action] |

## Session Log
### [DATE] — session summary
- Actions taken:
  - Did something concrete
- Files created/modified:
  - path/to/file
- Errors & fixes:
  - error -> fix
- Test Results:
  | Test | Expected | Actual | Status |
  |------|----------|--------|--------|
  | example check | ok | ok | PASS |