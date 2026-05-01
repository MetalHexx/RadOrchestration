---
name: foo-test-runner
description: 'Test runner conventions for the foo package. Use when planning tests inside packages/foo/. Mandates the `foo:vitest` npm script as the test command and a `__foo__` test-file suffix.'
---
# Foo Test Runner

Tests inside `packages/foo/` run via `npm run foo:vitest -- <pattern>`. Test files use the `__foo__` suffix instead of `.test.ts`.
