---
name: vue3-migration
description: Refactors monolithic HTML/JS into Vue 3 components, composables, and Pinia stores.
---

# SKILL – Vue 3 Migration

## Capabilities
- Extract HTML sections from the legacy `index.html` into Vue single-file components (SFC).
- Replace inline event handlers (`onclick`, `onsubmit`) with Vue methods and event binding.
- Convert global JavaScript functions into composables or exported modules.
- Map legacy state objects to reactive Pinia stores.
- Manage component communication (props, emits, provide/inject).
- Handle third‑party libraries (e.g., `marked`, `mammoth`, `Three.js`) via Vue plugin or dynamic imports.

## Usage Guidelines
- Identify logical UI blocks (chat, sidebar, modals, views) and create a component for each.
- Preserve the original user experience exactly; do not change feature behaviour unless explicitly requested.
- Use the Composition API (`<script setup>`) for consistency.
- Keep each component focused and under ~300 lines; split further if necessary.
- Test each migrated piece against the legacy fallback to verify functional equivalence.