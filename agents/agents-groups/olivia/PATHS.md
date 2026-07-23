# Olivia Source & Frontend Paths

> Canonical reference for the frontend asset paths used by Olivia agents.

## Overview

The Olivia group operates across the main frontend surface and the content/scenes library. Agent specs should use these paths when they refer to UI assets or scene data.

## Frontend asset inventory

| Area | Path | Purpose |
|------|------|---------|
| Main frontend entry | `frontend/index.html` | Primary UI shell and section routing |
| Frontend JavaScript | `frontend/js/` | UI modules and feature logic |
| Frontend styles | `frontend/css/` | Section and component styling |
| Scene content | `content/scenes/` | Scene JSON definitions and manifest |

## Agent routing notes

- Discovery and listening work should reference the relevant modules under `frontend/js/modules/`.
- Studio and shaders should reference `frontend/js/modules/studio.js`, `frontend/js/shaders.js`, and the scene files under `content/scenes/`.
- Memory and qdrant-related work should reference `frontend/js/modules/memory.js` and `frontend/qdrant.html` when applicable.
- When generating output that references frontend assets, prefer paths relative to the repository root and keep them consistent with the agent-owned-scope entries.

## Recommended usage

When an agent needs to reference a UI asset, use one of the following patterns:

- `frontend/js/modules/discovery.js`
- `frontend/js/modules/listening.js`
- `frontend/js/modules/memory.js`
- `frontend/js/modules/studio.js`
- `frontend/js/shaders.js`
- `frontend/css/descoberta.css`
- `frontend/css/listening.css`
- `frontend/css/studio.css`
- `content/scenes/manifest.json`

Never use the older `awareness-ai/olivia/olivia-workspace/...` paths for new references.
