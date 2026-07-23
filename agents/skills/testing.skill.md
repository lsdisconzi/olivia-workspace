---
name: testing
description: Writes and runs unit/integration tests using Vitest or similar frameworks.
---

# SKILL – Testing

## Capabilities
- Set up Vitest in a Vite project.
- Write unit tests for Pinia stores, composables, and utility functions.
- Write component tests with Vue Test Utils + jsdom.
- Mock API calls and browser APIs (e.g., `fetch`, Web Speech API) using `vi.fn()`.
- Run test suites (`npm run test`) and interpret results.
- Generate test coverage reports.

## Usage Guidelines
- Write tests for every migrated component and store.
- Aim for >80% code coverage on critical paths (chat, agent creation, API interactions).
- Follow AAA pattern (Arrange, Act, Assert).
- Use descriptive test names that explain the expected behaviour.
- If a test fails, provide a clear explanation and a possible fix.