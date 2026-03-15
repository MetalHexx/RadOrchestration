---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
task: 4
title: "Next-Action CLI Entry Point"
status: "complete"
files_changed: 2
tests_written: 13
tests_passing: 13
build_status: "pass"
---

# Task Report: Next-Action CLI Entry Point

## Summary

Created `src/next-action.js`, a CLI entry point that wraps the `resolveNextAction()` pure function with argument parsing, file I/O, and error handling. Created `tests/next-action.test.js` with 13 tests covering parseArgs unit tests, require.main guard, and end-to-end CLI invocations. All tests pass; no regressions in existing test suites.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `src/next-action.js` | 79 | CLI entry point wrapping resolveNextAction() |
| CREATED | `tests/next-action.test.js` | 255 | 13 tests: 5 parseArgs, 1 guard, 7 e2e |

## Tests

| Test | File | Status |
|------|------|--------|
| returns state and null config when only --state provided | `tests/next-action.test.js` | ✅ Pass |
| returns state and config when both flags provided | `tests/next-action.test.js` | ✅ Pass |
| handles reversed flag order | `tests/next-action.test.js` | ✅ Pass |
| throws when argv is empty | `tests/next-action.test.js` | ✅ Pass |
| throws when --state is missing but --config is present | `tests/next-action.test.js` | ✅ Pass |
| require does NOT execute main() | `tests/next-action.test.js` | ✅ Pass |
| emits valid JSON with action and context for a valid state file | `tests/next-action.test.js` | ✅ Pass |
| emits init_project JSON and exits 0 when state file does not exist | `tests/next-action.test.js` | ✅ Pass |
| exits 1 with error on stderr when no flags provided | `tests/next-action.test.js` | ✅ Pass |
| exits 1 with error on stderr for invalid JSON in state file | `tests/next-action.test.js` | ✅ Pass |
| works with optional --config flag pointing to a valid YAML file | `tests/next-action.test.js` | ✅ Pass |
| works when --config points to a nonexistent file (config is optional) | `tests/next-action.test.js` | ✅ Pass |
| produces correct action for a state in planning tier | `tests/next-action.test.js` | ✅ Pass |

**Test summary**: 13/13 passing

### Regression checks

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| `tests/constants.test.js` | 29 | 29 | 0 |
| `tests/state-validator.test.js` | 15 | 15 | 0 |
| `tests/resolver.test.js` | 44 | 44 | 0 |

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | File `src/next-action.js` exists and is valid JavaScript (`node -c` exits 0) | ✅ Met |
| 2 | Shebang `#!/usr/bin/env node` on line 1 | ✅ Met |
| 3 | `'use strict'` on line 2 | ✅ Met |
| 4 | CommonJS module (`require`/`module.exports`) | ✅ Met |
| 5 | `parseArgs()` exported via `module.exports = { parseArgs }` | ✅ Met |
| 6 | `if (require.main === module)` guard present | ✅ Met |
| 7 | `--state <path>` flag is required — missing flag throws Error with usage message | ✅ Met |
| 8 | `--config <path>` flag is optional — omission does not cause error | ✅ Met |
| 9 | Non-existent state file returns `init_project` action JSON to stdout, exits 0 | ✅ Met |
| 10 | Valid state file produces correct `NextActionResult` JSON on stdout | ✅ Met |
| 11 | Exit code 0 on success, 1 on error | ✅ Met |
| 12 | Errors write `[ERROR] next-action: <message>` to stderr | ✅ Met |
| 13 | No regressions: `node tests/constants.test.js`, `node tests/state-validator.test.js` still pass | ✅ Met |
| 14 | All tests pass | ✅ Met |
| 15 | Build succeeds | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (`node -c src/next-action.js` exits 0)
- **Lint**: N/A — no linter configured in project
- **Type check**: N/A — pure JavaScript project
