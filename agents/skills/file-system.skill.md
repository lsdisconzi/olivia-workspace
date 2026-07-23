---
name: file-system
description: Reads, writes, and manipulates files and directories inside the workspace sandbox.
---

# SKILL – File System

## Capabilities
- List directory contents (e.g., `tree` output).
- Read file contents (plain text, JSON, markdown, etc.).
- Create new files and folders.
- Write or overwrite file content.
- Move, copy, and delete files/directories.
- Check file existence and permissions.

## Usage Guidelines
- Always respect the sandbox boundaries (e.g., `studio_files/frontend/`).
- Never modify files outside the permitted workspace without user confirmation.
- When creating a folder structure, generate all parent directories automatically.
- Handle errors gracefully (e.g., file not found, permission denied) and report to user.
- Use relative paths where possible, but accept absolute paths if provided.