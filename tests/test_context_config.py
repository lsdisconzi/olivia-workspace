import serve


def test_normalize_context_selection_accepts_paths_and_filenames():
    normalized = serve._normalize_context_selection_entries(
        ["task_plan.md", "planning/findings.md", "./progress.md", "notes.txt", "task_plan.md"],
        {"task_plan.md", "findings.md", "progress.md"},
    )
    assert normalized == ["task_plan.md", "findings.md", "progress.md"]


def test_seed_project_planning_files_records_preferred_response_language(tmp_path):
    project_dir = tmp_path / "demo-project"
    project_dir.mkdir()

    serve._seed_project_planning_files(project_dir, "Demo Project", preferred_language="English")

    memory_text = (project_dir / "memory.md").read_text(encoding="utf-8")
    assert "Preferred response language" in memory_text
    assert "English" in memory_text
