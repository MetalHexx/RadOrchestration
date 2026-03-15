---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 1
title: "File Swap & Pipeline Entry Point Update"
status: "complete"
files_changed: 16
tests_written: 0
tests_passing: 522
build_status: "pass"
has_deviations: true
deviation_type: "minor"
---

# Task Report: File Swap & Pipeline Entry Point Update

## Summary

Executed the directory swap from `lib-v3/` to `lib/`, updated `pipeline.js` to call the v3 `processEvent` API, copied and fixed test paths from `tests-v3/` to `tests/`, applied the V13 timestamp fix, and removed obsolete v2 test files. All 522 tests pass with 0 failures.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| RENAMED | `.github/orchestration/scripts/lib/` → `lib-old/` | — | Preserved v2 modules for rollback |
| RENAMED | `.github/orchestration/scripts/lib-v3/` → `lib/` | — | v3 modules become production |
| MODIFIED | `.github/orchestration/scripts/pipeline.js` | ~15 | Replaced `executePipeline` with `processEvent` import and call |
| COPIED | `.github/orchestration/scripts/tests-v3/*.test.js` → `tests/` | — | 8 test files overwritten |
| COPIED | `.github/orchestration/scripts/tests-v3/helpers/` → `tests/helpers/` | — | Test infrastructure |
| DELETED | `.github/orchestration/scripts/tests/triage-engine.test.js` | — | No v3 triage module |
| DELETED | `.github/orchestration/scripts/tests/state-validator.test.js` | — | No v3 state-validator module (deviation) |
| MODIFIED | `.github/orchestration/scripts/tests/constants.test.js` | 2 | Fix require path lib-v3 → lib |
| MODIFIED | `.github/orchestration/scripts/tests/mutations.test.js` | 1 | Fix require path lib-v3 → lib |
| MODIFIED | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | 3 | Fix require path + remove dead imports |
| MODIFIED | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | 1 | Fix require path |
| MODIFIED | `.github/orchestration/scripts/tests/resolver.test.js` | 2 | Fix two require paths lib-v3 → lib |
| MODIFIED | `.github/orchestration/scripts/tests/pre-reads.test.js` | 1 | Fix require path |
| MODIFIED | `.github/orchestration/scripts/tests/validator.test.js` | 1 | Fix require path |
| MODIFIED | `.github/orchestration/scripts/tests/state-io.test.js` | 1 | Fix require path |
| MODIFIED | `.github/orchestration/scripts/tests/helpers/test-helpers.js` | 1 | Fix require path lib-v3 → lib |
| MODIFIED | `.github/orchestration/scripts/lib/pipeline-engine.js` | +5 | V13 timestamp fix with monotonicity guarantee |
| MODIFIED | `.github/orchestration/scripts/lib/mutations.js` | 1 | Fix internal require from `../lib-v3/constants` → `./constants` |
| MODIFIED | `.github/orchestration/scripts/tests/pipeline.test.js` | 3 | Update v2 assertions to v3 output contract (deviation) |

## Implementation Notes

Three deviations from the handoff were required (see Deviations section below):

1. **`mutations.js` internal require fix**: The v3 `lib/mutations.js` had `require('../lib-v3/constants')` which broke after renaming `lib-v3/` → `lib/`. Changed to `require('./constants')` (same-directory reference).

2. **V13 timestamp fix enhancement**: The handoff specified `proposed.state.project.updated = new Date().toISOString()`. This has a race condition in rapid sequential calls (same millisecond → identical timestamps → V13 check fails). Enhanced to guarantee strictly increasing timestamps by bumping +1ms when `now <= prev`.

3. **Old v2 test cleanup**: Two v2 test files (`state-validator.test.js` and `pipeline.test.js`) referenced modules/contracts that no longer exist. `state-validator.test.js` was deleted (analogous to `triage-engine.test.js`). `pipeline.test.js` had three assertions updated for v3's output contract.

## Tests

| Test | File | Status |
|------|------|--------|
| constants (v3) | `tests/constants.test.js` | ✅ Pass |
| mutations (v3) | `tests/mutations.test.js` | ✅ Pass |
| pipeline-engine (v3) | `tests/pipeline-engine.test.js` | ✅ Pass |
| pipeline-behavioral (v3) | `tests/pipeline-behavioral.test.js` | ✅ Pass |
| resolver (v3) | `tests/resolver.test.js` | ✅ Pass |
| pre-reads (v3) | `tests/pre-reads.test.js` | ✅ Pass |
| validator (v3) | `tests/validator.test.js` | ✅ Pass |
| state-io (v3) | `tests/state-io.test.js` | ✅ Pass |
| pipeline E2E | `tests/pipeline.test.js` | ✅ Pass |
| validation tests (agents, config, etc.) | `tests/*.test.js` | ✅ Pass |

**Test summary**: 522/522 passing (0 failures, 0 skipped)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `lib-old/` directory exists with 7 v2 modules | ✅ Met |
| 2 | `lib/` directory contains 7 v3 modules | ✅ Met |
| 3 | `pipeline.js` imports `processEvent` and `scaffoldInitialState` from `./lib/pipeline-engine` | ✅ Met |
| 4 | `pipeline.js` calls `processEvent(event, projectDir, context, io, configPath)` with positional arguments | ✅ Met |
| 5 | CLI contract unchanged: flags, JSON stdout, exit code 0/1 | ✅ Met |
| 6 | `tests/` directory contains all 8 v3 test files and `helpers/test-helpers.js` | ✅ Met |
| 7 | All test file `require` paths use `../lib/` (not `../lib-v3/`) | ✅ Met |
| 8 | `tests/triage-engine.test.js` does not exist | ✅ Met |
| 9 | Dead imports (`processAndAssert`, `deepClone`) removed from `tests/pipeline-engine.test.js` | ✅ Met |
| 10 | V13 timestamp fix applied in `lib/pipeline-engine.js` | ✅ Met |
| 11 | All tests pass (374+ tests, 0 failures) | ✅ Met (522 pass, 0 fail) |
| 12 | Build succeeds (all modules importable via `require()`) | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (all modules importable, 522 tests execute successfully)
- **Lint**: N/A (no linter configured)
- **Type check**: N/A (plain JavaScript, no TypeScript)

## Deviations from Handoff

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | Apply `proposed.state.project.updated = new Date().toISOString()` as V13 fix | Enhanced to guarantee strictly increasing timestamps: if `now <= prev`, bump to `prev + 1ms` | The simple `new Date()` approach produces identical timestamps when consecutive `processEvent` calls happen within the same millisecond (common in tests), causing V13 validation failure |
| 2 | Only delete `tests/triage-engine.test.js` | Also deleted `tests/state-validator.test.js` | `state-validator.test.js` requires `../lib/state-validator.js` which is a v2-only module (replaced by `validator.js` in v3). Identical situation to `triage-engine.test.js`. |
| 3 | No modifications to `tests/pipeline.test.js` | Updated 3 assertions in `pipeline.test.js` | Old test asserted v2-specific fields (`triage_ran`, `validation_passed`, `result.error`, `$schema: v2`) that don't exist in v3 output. Updated to match v3 `PipelineResult` contract (`context.error`, `$schema: v3`). |
| 4 | No modifications to `lib/mutations.js` | Fixed internal require from `../lib-v3/constants` to `./constants` | After renaming `lib-v3/` → `lib/`, `mutations.js` had a broken cross-directory require. This was a pre-existing path that pointed outside its own directory. |

## Recommendations for Next Task

- The `tests-v3/` directory still exists with `lib-v3` require paths that are now broken (since `lib-v3/` was renamed). T04 cleanup should delete `tests-v3/` and `lib-old/` as planned.
- The `backdateTimestamp()` workaround in `tests/pipeline-behavioral.test.js` is now unnecessary thanks to the V13 fix, but is harmless. Future cleanup could remove it for clarity.
