# Outreach Concierge — Runtime & Tooling Notes

> Owner: `outreach-concierge-v1`
> Purpose: prevent repeated tooling failures and standardise workspace writes.
> Last updated: 2026-08-07 (case: `andrew-neary`)

## Write path (CRITICAL — learned from repeated failures)

- The generic `Write` tool is **NOT registered** in this runtime.
- Calling it raises `NoSuchTool` and the file is not persisted.
- **Correct write path:** MCP filesystem server
  - `mcp__mcp-server-files__write_file` — create / fully overwrite a file
  - `mcp__mcp-server-files__edit_file` — targeted line-based edits (dry-run supported)
- Confirmed allowed root: `/Users/dev/_sell/olivia` (covers all projects, agents, and knowledge paths).
- Before writing a new file, verify the parent directory exists (`list_directory`); create it with `mcp__mcp-server-files__create_directory` when missing (create parents first — nested creation fails if the parent does not exist).
- Do not attempt `Write`, `Bash` heredocs, or `echo >` to persist files.

## Read path

- Use the local `Read` tool or `mcp__mcp-server-files__read_text_file` for exact file contents.
- Use `garage-qdrant` semantic search for Olivia ecosystem / project document queries when content is large or when the answer is not in the visible context.

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
