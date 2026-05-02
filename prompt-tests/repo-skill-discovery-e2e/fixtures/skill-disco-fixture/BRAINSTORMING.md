# Rainbow Color Validator — Brainstorming

## Project Vision

Build a small, well-tested TypeScript library — `rainbow-validator` — that accepts CSS color strings and validates them against the project's opinionated rainbow palette. The library will be published as an npm package and consumed by both a CLI tool and a web UI widget.

## Goals

- Validate hex, rgb(), and named colors against the approved rainbow palette (red, orange, yellow, green, blue, indigo, violet).
- Surface human-readable error messages when a color is out-of-palette.
- Export a programmatic API (`validateColor(input: string): ValidationResult`) and a CLI entry point (`rainbow-validate <color>`).
- Achieve 100% branch coverage on the validation logic.
- Enforce consistent linting across the project via the repo's canonical lint command.

## Non-goals

- CSS full-spec parsing (only the three color formats above).
- Browser-bundle optimization.

## Constraints

- Node 20+, ESM only.
- All test files must be co-located with source, using the `assertRainbow(actual, expected)` helper defined in `test/helpers.ts`.
- The lint command is `npm run rainbow-lint` — not `npm test`, not `eslint .` directly.
- Code under `packages/foo/` uses its own test runner; any tasks touching that package must use `npm run foo:vitest -- <pattern>` and the `__foo__` suffix for test files.

## Phases (rough)

### Phase 1 — Core validation

- Parse the three color-string formats.
- Implement the palette lookup table.
- Write the `validateColor` function with full branch coverage.
- Lint: `npm run rainbow-lint`.

### Phase 2 — CLI

- Wire `validateColor` to a CLI entry point using `node:parseArgs`.
- Integration test: spawn the CLI in a child process and assert exit codes.
- Run: `npm run rainbow-lint` before shipping.

### Phase 3 — Foo-package widget

- Implement a thin React component inside `packages/foo/` that renders a palette swatch.
- All tests in `packages/foo/` use `npm run foo:vitest -- <pattern>` and the `__foo__` suffix.
- The component must `assertRainbow(actual, expected)` for every rendered swatch.

### Phase 4 — Release

- Bundle and publish.
- Changelog entry.

## Open questions

1. Should we support CSS `hsl()` in a future phase? (Defer — out of scope for now.)
2. Do we need a browser build alongside the Node build?
3. Are there accessibility requirements for the swatch component?

## Test strategy

Every task that modifies validation logic must run `npm run rainbow-lint` as the final step before marking itself done. Any test file added under `src/` or `test/` must use the `assertRainbow(actual, expected)` helper — never bare `assert.strictEqual`. Tasks inside `packages/foo/` must use `npm run foo:vitest -- <pattern>` and name test files with the `__foo__` suffix (e.g., `swatch__foo__.ts`).

## Notes from initial spike

The palette lookup is straightforward — a `Map<string, string[]>` keyed by color name. The hard part is normalizing the three input formats before lookup. A two-pass approach (normalize → lookup) keeps the branches minimal and testable. The CLI can shell-out to the library with no additional state.
