---
project: "ORCHESTRATION-REORG"
phase: 4
task: 1
title: "Update docs/scripts.md Path References"
status: "complete"
files_changed: 1
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Update docs/scripts.md Path References

## Summary

Replaced all 19 stale `src/` and `tests/` path references in `docs/scripts.md` with their `.github/orchestration/scripts/` equivalents. The file now reflects the post-reorg directory structure across the architecture diagram, CLI invocations, prose references, and test execution examples. No other content was modified.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `docs/scripts.md` | 339 (unchanged) | 19 path replacements across 10 edit operations |

## Tests

Validation performed via grep checks (no test files involved — documentation-only task):

| Test | File | Status |
|------|------|--------|
| `grep "node src/" docs/scripts.md` returns 0 matches | `docs/scripts.md` | ✅ Pass |
| `grep "node tests/" docs/scripts.md` returns 0 matches | `docs/scripts.md` | ✅ Pass |
| `grep "'src/" docs/scripts.md` returns 0 matches (backtick-quoted) | `docs/scripts.md` | ✅ Pass |
| Architecture diagram starts with `.github/orchestration/scripts/` | `docs/scripts.md` | ✅ Pass |
| No residual `\bsrc/` word-boundary matches | `docs/scripts.md` | ✅ Pass |
| File renders correctly (code blocks intact, no broken formatting) | `docs/scripts.md` | ✅ Pass |

**Test summary**: 6/6 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Zero occurrences of `src/` as a path prefix in `docs/scripts.md` | ✅ Met |
| 2 | Zero occurrences of `tests/` as a path prefix in `docs/scripts.md` | ✅ Met |
| 3 | All ~21 path references updated to `.github/orchestration/scripts/` equivalents per the Change Map | ✅ Met |
| 4 | Architecture diagram root line reads `.github/orchestration/scripts/` | ✅ Met |
| 5 | All CLI invocations use `node .github/orchestration/scripts/<script>.js` format | ✅ Met |
| 6 | All test execution examples use `node .github/orchestration/scripts/tests/<test>.test.js` format | ✅ Met |
| 7 | File renders correctly in Markdown preview | ✅ Met |
| 8 | No other content in the file is modified (tables, prose, enum values, etc. unchanged) | ✅ Met |

## Build & Lint

- **Build**: N/A — documentation-only change, no code compiled
- **Lint**: N/A — Markdown file, no linter configured
- **Type check**: N/A

## Replacement Inventory

19 path replacements made across 10 edit operations:

| # | Old Path | New Path |
|---|----------|----------|
| 1 | `src/` (architecture diagram root) | `.github/orchestration/scripts/` |
| 2 | `` `src/lib/constants.js` `` (prose) | `` `.github/orchestration/scripts/lib/constants.js` `` |
| 3 | `node src/next-action.js --state path/to/state.json` | `node .github/orchestration/scripts/next-action.js --state path/to/state.json` |
| 4 | `node src/next-action.js --state <path>` (Orchestrator step) | `node .github/orchestration/scripts/next-action.js --state <path>` |
| 5 | `node src/triage.js --state ... --level task` | `node .github/orchestration/scripts/triage.js --state ... --level task` |
| 6 | `node src/triage.js --state ... --level phase` | `node .github/orchestration/scripts/triage.js --state ... --level phase` |
| 7 | `node src/triage.js` Mode 3 (phase triage) | `node .github/orchestration/scripts/triage.js` |
| 8 | `node src/triage.js` Mode 4 (task triage) | `node .github/orchestration/scripts/triage.js` |
| 9 | `` `src/triage.js` `` (Write Behavior prose) | `` `.github/orchestration/scripts/triage.js` `` |
| 10 | `node src/validate-state.js --current ... --proposed ...` | `node .github/orchestration/scripts/validate-state.js --current ... --proposed ...` |
| 11 | `node src/validate-state.js` (Planner step 2) | `node .github/orchestration/scripts/validate-state.js` |
| 12 | `node tests/constants.test.js` | `node .github/orchestration/scripts/tests/constants.test.js` |
| 13 | `node tests/resolver.test.js` | `node .github/orchestration/scripts/tests/resolver.test.js` |
| 14 | `node tests/state-validator.test.js` | `node .github/orchestration/scripts/tests/state-validator.test.js` |
| 15 | `node tests/triage-engine.test.js` | `node .github/orchestration/scripts/tests/triage-engine.test.js` |
| 16 | `node tests/validate-state.test.js` | `node .github/orchestration/scripts/tests/validate-state.test.js` |

> Note: Change Map items #2 (lib/ relative path) and #18 (comment with no path) were correctly left unchanged, and items #3/#5 were combined with their adjacent lines into single edit operations. 19 actual string replacements across 16 unique path references.
