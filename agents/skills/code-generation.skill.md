---
name: code-generation
description: Generates clean, idiomatic Vue 3, JavaScript, and CSS code for the migration project.
---

# SKILL – Code Generation

## Capabilities
- Produces syntactically correct and well-structured Vue 3 components (Composition API with `<script setup>`).
- Writes modern JavaScript/ES modules, following consistent coding standards.
- Creates CSS/SCSS files that integrate with the existing Olivia Workspace design system.
- Generates Pinia stores, composables, and utility functions.
- Follows best practices: readable naming, separation of concerns, no unused code.

## Usage Guidelines
- Always provide full file content when generating a new component or module.
- When modifying existing code, output the exact diff or replacement block.
- Prefer idiomatic Vue patterns (e.g., `defineProps`, `ref`, `watch`, `computed`, `onMounted`).
- Ensure all generated code passes basic lint rules (no trailing spaces, consistent indentation).