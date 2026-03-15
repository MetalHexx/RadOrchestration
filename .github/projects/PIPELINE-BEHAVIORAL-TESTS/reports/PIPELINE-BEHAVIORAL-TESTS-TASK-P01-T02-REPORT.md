---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 1
task: 2
title: "Update createProjectAwareReader to null-check fallback"
status: "complete"
has_deviations: false
deviation_type: "none"
files_changed: 2
tests_written: 0
tests_passing: 79
build_status: "pass"
---

# Task Report: Update createProjectAwareReader to null-check fallback

## Summary

Replaced the try/catch pattern in `createProjectAwareReader` (pipeline-engine.js) with a null-check fallback, aligning it with the updated `readDocument` contract that returns `null` instead of throwing. Updated three unit test mocks in pipeline-engine.test.js from throwing to null-returning, and renamed the "both fail" test to assert `null` return instead of `assert.throws`.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/orchestration/scripts/lib/pipeline-engine.js` | ~5 changed | Replaced try/catch body with null-check: `const result = readDocument(docPath); if (result !== null) return result;` |
| MODIFIED | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | ~10 changed | Updated 3 test mocks from `throw` to `return null`; renamed "both fail" test; changed assertion from `assert.throws` to `assert.strictEqual(result, null)` |

## Tests

| Test | File | Status |
|------|------|--------|
| returns the document when path resolves directly | `pipeline-engine.test.js` | ✅ Pass |
| falls back to project-relative path when direct resolution fails | `pipeline-engine.test.js` | ✅ Pass |
| returns null for null/empty docPath | `pipeline-engine.test.js` | ✅ Pass |
| returns null when both resolutions fail | `pipeline-engine.test.js` | ✅ Pass |
| task_completed with project-relative report_doc in state succeeds through triage | `pipeline-engine.test.js` | ✅ Pass |
| All other pipeline-engine.test.js tests (56 remaining) | `pipeline-engine.test.js` | ✅ Pass |
| All state-io.test.js tests (18 total) | `state-io.test.js` | ✅ Pass |

**Test summary**: 79/79 passing (61 pipeline-engine + 18 state-io)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `createProjectAwareReader` returns the document when the direct path resolves | ✅ Met |
| 2 | `createProjectAwareReader` falls back to project-relative path when direct path returns `null` | ✅ Met |
| 3 | `createProjectAwareReader` returns `null` when both paths return `null` | ✅ Met |
| 4 | `createProjectAwareReader` still returns `null` for null/empty `docPath` (no regression) | ✅ Met |
| 5 | The try/catch pattern is completely removed from `createProjectAwareReader` | ✅ Met |
| 6 | The "both fail" test uses a null-returning mock and asserts `null` return (not `assert.throws`) | ✅ Met |
| 7 | The "fallback" test uses a null-returning mock (not a throwing mock) | ✅ Met |
| 8 | All `pipeline-engine.test.js` tests pass | ✅ Met |
| 9 | All `state-io.test.js` tests pass (no regression from T01) | ✅ Met |
| 10 | Build succeeds | ✅ Met |
| 11 | No lint errors | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass — no lint configuration in this project; no errors in modified files
- **Type check**: N/A — plain JavaScript project
