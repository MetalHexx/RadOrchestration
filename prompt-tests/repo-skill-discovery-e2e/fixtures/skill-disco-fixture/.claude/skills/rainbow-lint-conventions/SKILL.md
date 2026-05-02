---
name: rainbow-lint-conventions
description: 'Repo-local linting conventions for the rainbow project. Use when authoring tests or test commands. Mandates `npm run rainbow-lint` as the canonical lint command and the `assertRainbow(...)` helper signature in test files.'
---
# Rainbow Lint Conventions

The canonical lint command is `npm run rainbow-lint`. All test files use the `assertRainbow(actual, expected)` helper. Master plans for this repo MUST inline `npm run rainbow-lint` for any test-running step rather than defaulting to `npm test`.
