---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 1
title: "Delete Standalone Scripts & Tests"
status: "complete"
files_changed: 6
tests_written: 0
tests_passing: 321
build_status: "pass"
---

# Task Report: Delete Standalone Scripts & Tests

## Summary

Deleted the 3 deprecated standalone CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) and their 3 corresponding test files. Verified no dangling `require()` references exist in preserved files. All 8 preserved test suites (141 lib tests + 180 pipeline tests) pass with 0 failures.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| DELETED | `.github/orchestration/scripts/next-action.js` | — | Standalone next-action CLI replaced by `pipeline.js` |
| DELETED | `.github/orchestration/scripts/triage.js` | — | Standalone triage CLI replaced by `pipeline.js` |
| DELETED | `.github/orchestration/scripts/validate-state.js` | — | Standalone validate-state CLI replaced by `pipeline.js` |
| DELETED | `.github/orchestration/scripts/tests/next-action.test.js` | — | Tests for deleted `next-action.js` |
| DELETED | `.github/orchestration/scripts/tests/triage.test.js` | — | Tests for deleted `triage.js` |
| DELETED | `.github/orchestration/scripts/tests/validate-state.test.js` | — | Tests for deleted `validate-state.js` |

## Tests

| Test | File | Status |
|------|------|--------|
| constants (29 tests) | `.github/orchestration/scripts/tests/constants.test.js` | ✅ Pass |
| resolver (34 tests) | `.github/orchestration/scripts/tests/resolver.test.js` | ✅ Pass |
| state-validator (37 tests) | `.github/orchestration/scripts/tests/state-validator.test.js` | ✅ Pass |
| triage-engine (41 tests) | `.github/orchestration/scripts/tests/triage-engine.test.js` | ✅ Pass |
| mutations (54 tests) | `.github/orchestration/scripts/tests/mutations.test.js` | ✅ Pass |
| pipeline-engine (55 tests) | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | ✅ Pass |
| pipeline (43 tests) | `.github/orchestration/scripts/tests/pipeline.test.js` | ✅ Pass |
| state-io (28 tests) | `.github/orchestration/scripts/tests/state-io.test.js` | ✅ Pass |

**Test summary**: 321/321 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `.github/orchestration/scripts/next-action.js` does not exist | ✅ Met |
| 2 | `.github/orchestration/scripts/triage.js` does not exist | ✅ Met |
| 3 | `.github/orchestration/scripts/validate-state.js` does not exist | ✅ Met |
| 4 | `.github/orchestration/scripts/tests/next-action.test.js` does not exist | ✅ Met |
| 5 | `.github/orchestration/scripts/tests/triage.test.js` does not exist | ✅ Met |
| 6 | `.github/orchestration/scripts/tests/validate-state.test.js` does not exist | ✅ Met |
| 7 | All 4 preserved lib test suites pass (`node --test` exits 0) | ✅ Met |
| 8 | All 4 new pipeline test suites pass (`node --test` exits 0) | ✅ Met |
| 9 | No preserved `.js` file under `.github/orchestration/scripts/` contains a `require()` referencing any of the 3 deleted scripts | ✅ Met |
| 10 | No files were created or modified — only deletions | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (no build step — Node.js scripts, no compilation required)
- **Lint**: N/A
- **Type check**: N/A
