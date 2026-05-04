# Instructions Canary — Brainstorming

## Project Vision

Build a tiny, single-function ESM utility — `reverse-string` — that exports one named function `reverseString(str)` returning the input string with its character order reversed. Published as an npm package and consumed by other modules.

The project's purpose for this fixture is to be small enough to drive the planner end-to-end with minimal token cost while still producing a real Requirements document, Master Plan, and at least one explodable phase/task. The implementation surface is deliberately trivial — one function, one test file — so the planner and coder have nothing to do except produce normal planning and source artifacts.

## Goals

- Export a named ESM function `reverseString(str: string): string` that returns the input with character order reversed.
- Drive the implementation with a RED-GREEN unit test under `src/__tests__/reverse.test.js`.
- Single source file at `src/reverse.js`, single test file at `src/__tests__/reverse.test.js`.

## Non-goals

- Unicode grapheme-cluster handling (a future phase if anyone needs it).
- Performance work — correctness only.
- A CLI entry point.
- Multi-package / monorepo structure.

## Constraints

- Node 20+, pure ESM, named export only (no default export).
- Standard library only — no dependencies.
- Tests use `node:test` and `node:assert`; run via `node --test src/__tests__/reverse.test.js`.

## Phases (rough)

### Phase 1 — Implement reverseString

- Implement `reverseString(str)` in `src/reverse.js`.
- RED-GREEN test in `src/__tests__/reverse.test.js`: assert `reverseString('abc') === 'cba'`.

That is the entire scope. The planner should produce one phase containing one task.

## Test strategy

A single `node --test` invocation against `src/__tests__/reverse.test.js`. No integration tests, no coverage thresholds, no lint command beyond what the planner naturally chooses.
