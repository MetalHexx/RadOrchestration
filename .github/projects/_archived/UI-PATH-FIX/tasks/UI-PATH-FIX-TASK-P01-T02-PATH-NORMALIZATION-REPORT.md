---
project: "UI-PATH-FIX"
phase: 1
task: 2
title: "Centralized Path Normalization"
status: "complete"
files_changed: 2
tests_written: 11
tests_passing: 11
build_status: "pass"
---

# Task Report: Centralized Path Normalization

## Summary

Added a centralized `normalizeContextPaths` helper function to `pipeline-engine.js` that normalizes all path-valued context fields from workspace-relative to project-relative format before mutation handlers execute. Imported `normalizeDocPath` from `mutations.js`, moved the config read earlier in the standard mutation path, and removed the duplicate `const config` declaration at the RESOLVE section. All 56 pipeline-engine tests pass (45 existing + 11 new), and 322 total tests across the test suite pass with zero regressions.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/orchestration/scripts/lib/pipeline-engine.js` | +19 | Added `normalizeDocPath` to import, added `normalizeContextPaths` helper, added config read + normalization call before mutation, removed duplicate `const config` at RESOLVE |
| MODIFIED | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | +186 | Added 8 unit tests for `normalizeContextPaths` and 3 integration tests for path normalization in `executePipeline` |

## Tests

| Test | File | Status |
|------|------|--------|
| normalizes context.doc_path from workspace-relative to project-relative | `pipeline-engine.test.js` | ✅ Pass |
| normalizes context.plan_path from workspace-relative to project-relative | `pipeline-engine.test.js` | ✅ Pass |
| normalizes context.report_path from workspace-relative to project-relative | `pipeline-engine.test.js` | ✅ Pass |
| normalizes context.handoff_path from workspace-relative to project-relative | `pipeline-engine.test.js` | ✅ Pass |
| normalizes context.review_path from workspace-relative to project-relative | `pipeline-engine.test.js` | ✅ Pass |
| leaves already project-relative paths unchanged (idempotent) | `pipeline-engine.test.js` | ✅ Pass |
| does not modify context keys that are not in the PATH_KEYS list | `pipeline-engine.test.js` | ✅ Pass |
| handles null/undefined path values in context without throwing | `pipeline-engine.test.js` | ✅ Pass |
| prd_completed with workspace-relative doc_path stores project-relative path in state | `pipeline-engine.test.js` | ✅ Pass |
| task_completed with workspace-relative report_path: pre-read succeeds AND stored path is project-relative | `pipeline-engine.test.js` | ✅ Pass |
| task_completed with already project-relative report_path continues to work (idempotent) | `pipeline-engine.test.js` | ✅ Pass |

**Test summary**: 56/56 passing (pipeline-engine), 322/322 passing (full suite)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `normalizeDocPath` is imported from `./mutations` in `pipeline-engine.js` | ✅ Met |
| 2 | `normalizeContextPaths` function exists in `pipeline-engine.js` and normalizes `doc_path`, `plan_path`, `handoff_path`, `report_path`, `review_path` | ✅ Met |
| 3 | `normalizeContextPaths` is called in `executePipeline` AFTER the pre-read enrichment blocks and BEFORE `mutation(state, context)` | ✅ Met |
| 4 | Pre-read enrichment blocks are NOT affected — they execute before normalization | ✅ Met |
| 5 | Already project-relative paths pass through unchanged (idempotent) | ✅ Met |
| 6 | `null`, `undefined`, and empty string `context.*_path` values do not throw | ✅ Met |
| 7 | `config` is loaded via `io.readConfig(configPath)` before the normalization call — no duplicate `const config` declarations in the standard mutation path | ✅ Met |
| 8 | No changes to any mutation handler function signatures or behavior in `mutations.js` | ✅ Met |
| 9 | No changes to any other file besides `pipeline-engine.js` | ✅ Met |
| 10 | All existing pipeline-engine tests continue to pass (zero regressions) | ✅ Met |
| 11 | All new tests pass | ✅ Met |
| 12 | Build succeeds (`node --test` on all pipeline test files) | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass — `node --test` on all 5 test files: 322/322 passing, 0 failures
