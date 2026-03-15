---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 2
title: "Delete Shadow Docs & Schemas Dir"
status: "complete"
files_changed: 3
tests_written: 0
tests_passing: 321
build_status: "pass"
---

# Task Report: Delete Shadow Docs & Schemas Dir

## Summary

Deleted three artifacts: `.github/orchestration/schemas/state-json-schema.md`, the `.github/orchestration/schemas/` directory, and `.github/instructions/state-management.instructions.md`. All 321 existing tests pass with 0 failures. All preserved files (pipeline.js, lib/ modules, tests/, project-docs.instructions.md) remain intact and unmodified.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| DELETED | `.github/orchestration/schemas/state-json-schema.md` | — | Prose shadow of `constants.js` + `state-validator.js`; no runtime consumer |
| DELETED | `.github/orchestration/schemas/` | — | Directory empty after schema file deletion; removed entirely |
| DELETED | `.github/instructions/state-management.instructions.md` | — | All sections redundant post-refactor; `applyTo: **/state.json` no longer relevant since pipeline.js owns state mutations |

## Implementation Notes

Pre-deletion reference audit confirmed zero matches for either deleted file in active system files (agents, skills, instructions, scripts, config, orchestration.yml, copilot-instructions.md). Stale references remain in two non-active locations that are outside this task's scope (constraint: deletions only, no modifications):

1. **`docs/project-structure.md`** — references `state-json-schema.md` (line 30) and `state-management.instructions.md` (lines 108, 205). These are documentation-only references and will be cleaned up in Phase 4 (Documentation Overhaul).
2. **`.github/orchestration/scripts/tests/instructions.test.js`** — mock data references `state-management.instructions.md` (lines 196, 211). The task constraint prohibits modifying test files; the Phase Plan notes this needs updating but scopes it outside T02.
3. **`archive/ORCHESTRATION-MASTER-PLAN.md`** — historical references to the old `plan/schemas/state-json-schema.md` path. Archive files are intentionally frozen.

## Tests

| Test | File | Status |
|------|------|--------|
| constants (36 tests) | `.github/orchestration/scripts/tests/constants.test.js` | ✅ Pass |
| resolver (55 tests) | `.github/orchestration/scripts/tests/resolver.test.js` | ✅ Pass |
| state-validator (49 tests) | `.github/orchestration/scripts/tests/state-validator.test.js` | ✅ Pass |
| triage-engine (43 tests) | `.github/orchestration/scripts/tests/triage-engine.test.js` | ✅ Pass |
| mutations (32 tests) | `.github/orchestration/scripts/tests/mutations.test.js` | ✅ Pass |
| pipeline-engine (56 tests) | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | ✅ Pass |
| pipeline (19 tests) | `.github/orchestration/scripts/tests/pipeline.test.js` | ✅ Pass |
| state-io (31 tests) | `.github/orchestration/scripts/tests/state-io.test.js` | ✅ Pass |

**Test summary**: 321/321 passing (74 suites, 0 failures, 605ms)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `.github/orchestration/schemas/state-json-schema.md` does not exist | ✅ Met |
| 2 | `.github/orchestration/schemas/` directory does not exist | ✅ Met |
| 3 | `.github/instructions/state-management.instructions.md` does not exist | ✅ Met |
| 4 | `.github/instructions/project-docs.instructions.md` still exists (unchanged) | ✅ Met |
| 5 | `.github/orchestration/scripts/pipeline.js` still exists (unchanged) | ✅ Met |
| 6 | All files in `.github/orchestration/scripts/lib/` still exist (unchanged) | ✅ Met |
| 7 | All files in `.github/orchestration/scripts/tests/` still exist (unchanged) | ✅ Met |
| 8 | All test suites pass (`node --test` exits 0) — 321/321 tests, 0 failures | ✅ Met |
| 9 | No files were created or modified — only deletions | ✅ Met |
| 10 | Grep for `state-json-schema.md` in active system files (outside `.github/projects/`) returns zero matches | ✅ Met |
| 11 | Grep for `state-management.instructions.md` in active system files (outside `.github/projects/`) returns zero matches | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass — no build step applies (pure file deletions; test runner confirms no broken imports)
- **Lint**: N/A — no source files modified
- **Type check**: N/A — no source files modified

## Recommendations for Next Task

- `docs/project-structure.md` contains 3 stale references to the deleted files (lines 30, 108, 205). Phase 4 (Documentation Overhaul) should update this file.
- `.github/orchestration/scripts/tests/instructions.test.js` mock data still references `state-management.instructions.md` (lines 196, 211). A future task should update the mock to use only `project-docs.instructions.md` or a generic test name.
