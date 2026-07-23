---
name: vite-builder
description: Initialises Vite projects, installs dependencies, and runs dev/build commands.
---

# SKILL – Vite Builder

## Capabilities
- Create a new Vite project with the Vue template (`npm create vite@latest`).
- Install npm dependencies (e.g., `pinia`, `vue-router`, `marked`, `axios`).
- Run the development server (`npm run dev`) and capture errors.
- Execute production builds (`npm run build`) and analyse output.
- Configure `vite.config.js` for aliases, environment variables, proxy, etc.
- Set up Vitest for testing and run test suites.

## Usage Guidelines
- Always execute commands inside the correct project directory (e.g., `frontend/`).
- Check Node.js and npm availability before running commands.
- Report the exact command executed and its output (stdout/stderr).
- If a command fails, analyse the error and propose a fix or ask the user for missing prerequisites.
- After a successful setup, confirm that `npm run dev` starts without errors and provides the local URL.