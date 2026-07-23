# The 4-File Planning Convention (Olivia)

These four files live in **each project’s** `planning/` directory and form the persistent memory of the Olivia agent orchestration for that project. The server (`serve.py`) **auto-injects their contents into every agent run** for that project via `_read_planning_context()`, and surfaces planning status in the web UI dashboard. Keep them accurate; they are the continuity layer across conversations and sessions for that project.

---

## The files (per project)

| File | Role | When to read | When to write |
|------|------|--------------|---------------|
| `task_plan.md` | **What** we're doing & **where** we are. Phases, checkboxes, status. | Before every meaningful decision. | On scope change or step completion. |
| `findings.md` | **Evidence** — validated discoveries, decisions, references. | When reasoning about *why*. | Only after a finding is verified (with evidence). |
| `progress.md` | **What happened** — session log, errors, test results. | To resume a session. | After each meaningful action batch. |
| `memory.md` | **Sticky brain** — conventions, key entities, open questions, do-not-redo. | At session start & after settling decisions. | When a durable fact/convention is established. |

---

## How they differ (don't duplicate across files)

- `findings.md` = raw, sourced evidence. `memory.md` = the durable conclusion drawn from it.
- `progress.md` = chronological *this session*. `memory.md` = cross-session *always true*.
- `task_plan.md` = the objective & status. The other three serve it.

---

## Project-level isolation

- Each project has its own `planning/` folder inside its root directory.
  - For example: `uploads/projects/<project_id>/planning/`
- The orchestration server (`serve.py`) resolves the correct planning directory based on the active project context.
- When switching projects, the server reloads the corresponding four files.
- This means conventions, findings, and memory are **project‑specific** and do not bleed across projects.

---

## Orchestration contract (what the server reads per project)

- **Directory**: resolved by `_resolve_planning_dir(project_id)` → `uploads/projects/<project_id>/planning/`
  (constant `PLANNING_WORKSPACE_DIR` in `serve.py` is relative to the project root).
- **Filenames**: `PLANNING_FILENAMES = ("task_plan.md", "findings.md", "progress.md", "memory.md")`.
- **Injected into prompts**: `_read_planning_context(project_id)` concatenates all four files (capped per file), rendered in the web UI as the `planning_context` block for that project. `_build_planning_control_prompt()` adds the 9 mandatory loop rules (incl. "read memory.md before starting").
- **Dashboard parsing** (from `progress.md`): `_extract_actions()` reads the `- Actions taken:` bullet block; `_extract_passed_tests()` reads the `| Test | Expected | Actual | Status |` table; `_extract_next_step()` reads the `| Where am I going? | ... |` row. HTML comments (`<!-- ... -->`) are stripped by those parsers, so use them freely for instructions.
- **Auto-creation**: `_ensure_planning_files(project_id)` creates any missing file from a default template, so removing a file is non-fatal (it is recreated on the next run for that project).

---

## How agents should use this per project

1. **Start**: read `task_plan.md` + `memory.md` for the active project.
2. **Work**: align actions to that project's plan; record evidence in `findings.md` once verified.
3. **After a batch**: append to `progress.md` (keep the Status table / Actions / Test Results markers).
4. **Settle**: if a durable convention, entity, or do-not-redo emerges, write it to `memory.md`.
5. **If scope changed**: update `task_plan.md` immediately.
6. **Switching projects**: the server will automatically inject the new project's planning files.

---

*Last updated: 2026‑07‑19*