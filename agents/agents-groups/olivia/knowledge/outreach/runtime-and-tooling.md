# Outreach Concierge — Runtime & Tooling Notes

> Owner: `outreach-concierge-v1`
> Purpose: prevent repeated tooling failures and standardise workspace writes.
> Last updated: 2026-08-07 (case: `andrew-neary`)

## Tooling & Execution Path

- Standard built-in tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`) and MCP tools (`read_text_file`, `write_file`, `edit_file`, `list_directory`) are supported in this environment.
- Use `Read` or `read_text_file` for reading files, `Write` or `write_file` for creating/overwriting files, and `Edit` or `edit_file` for targeted line-based edits.
- If any tool invocation returns `NoSuchTool`, switch immediately to the equivalent built-in tool (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`).
- Confirmed allowed root: `/Users/dev/_sell/olivia` (covers all projects, agents, and knowledge paths).

## Workspace conventions

- Active project root is defined by the `project_root_absolute` binding (e.g. `uploads/projects/<project_id>/`).
- Keep generated artifacts under `outputs/`; planning files at project root (`task_plan.md`, `findings.md`, `progress.md`, `memory.md`).
- Canonical Markdown first; PDFs / HTML derive from Markdown when generated.
- Record evidence labels (FACT / INFERENCE / HYPOTHESIS) in every outreach document.
- Do not overwrite important research without preserving the previous state.

## Checkpoint discipline

- Checkpoint A — Discovery: human validates identity / facts / gaps.
- Checkpoint B — Alignment: human validates interpretation / hypotheses / tone before the final Bridge Document.
- Checkpoint C — Outreach: human approves every send. The agent never sends externally.
