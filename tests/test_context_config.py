import serve


def test_normalize_context_selection_accepts_paths_and_filenames():
    normalized = serve._normalize_context_selection_entries(
        ["task_plan.md", "planning/findings.md", "./progress.md", "notes.txt", "task_plan.md"],
        {"task_plan.md", "findings.md", "progress.md"},
    )
    assert normalized == ["task_plan.md", "findings.md", "progress.md"]
