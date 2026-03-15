---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 1
title: "Core Contract Changes"
status: "active"
total_tasks: 2
tasks:
  - id: "T01-READDOCUMENT-NULL"
    title: "Change readDocument to null-return contract"
    depends_on: []
  - id: "T02-PROJECTREADER-NULLCHECK"
    title: "Update createProjectAwareReader to null-check fallback"
    depends_on: ["T01-READDOCUMENT-NULL"]
author: "tactical-planner-agent"
created: "2026-03-14T21:30:00Z"
---

# Phase 1: Core Contract Changes

## Phase Goal

Fix the `readDocument` throw-to-null contract and update `createProjectAwareReader` from try/catch to null-check fallback, keeping the existing test suite green throughout. After this phase, `readDocument` returns `null` for missing/unreadable files and all 7 call sites handle that contract correctly.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-BEHAVIORAL-TESTS-MASTER-PLAN.md) | Phase 1 scope and exit criteria |
| [Architecture](../PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | `readDocument` contract (lines 128–137), `createProjectAwareReader` contract (lines 137–147), change dependency graph, module map |
| [Design](../PIPELINE-BEHAVIORAL-TESTS-DESIGN.md) | `readDocument` call site state table, `createProjectAwareReader` behavior table |
| [Research](../PIPELINE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md) | All 7 `readDocument` call sites, existing test patterns, `createMockIO` null-return convention |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Change `readDocument` to null-return contract | — | Code modification, test update | 2 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P01-T01-READDOCUMENT-NULL.md) |
| T02 | Update `createProjectAwareReader` to null-check fallback | T01 | Code modification, test update | 2 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P01-T02-PROJECTREADER-NULLCHECK.md) |

### T01: Change `readDocument` to null-return contract

**Objective**: Change `readDocument` in `state-io.js` from throwing on missing/unreadable files to returning `null`, and update the existing test that asserts throw behavior.

**File targets**:
- MODIFY `.github/orchestration/scripts/lib/state-io.js` — `readDocument` function (lines ~128–137): replace `throw new Error(...)` with `return null` in both the missing-file and unreadable-file branches
- MODIFY `.github/orchestration/scripts/tests/state-io.test.js` — throw assertion (lines ~207–213): change `assert.throws` to `assert.strictEqual(result, null)` for the missing-file test case

**Why together**: The production code change and test update must be atomic — changing `readDocument` without updating the throw assertion would leave a failing test; updating the test without the code change would also fail.

**Acceptance criteria**:
- `readDocument` returns `null` when the file does not exist
- `readDocument` returns `null` when the file exists but is unreadable
- `readDocument` still returns `{ frontmatter, body }` for valid files (no regression)
- The existing `state-io.test.js` test for missing files asserts `null` return (not `throws`)
- All `state-io.test.js` tests pass
- All `pipeline-engine.test.js` tests pass (mock IO already uses null-return; no tests break)

### T02: Update `createProjectAwareReader` to null-check fallback

**Objective**: Replace the try/catch pattern in `createProjectAwareReader` with a null-check that triggers the project-relative fallback, and update the "both fail" test to assert null return instead of throw.

**File targets**:
- MODIFY `.github/orchestration/scripts/lib/pipeline-engine.js` — `createProjectAwareReader` function (lines ~137–147): replace try/catch with `const result = readDocument(docPath); if (result !== null) return result;` before the project-relative fallback
- MODIFY `.github/orchestration/scripts/tests/pipeline-engine.test.js` — "both fail" test (lines ~1680–1683): change from a throwing mock + `assert.throws` to a null-returning mock + `assert.strictEqual(result, null)`

**Why depends on T01**: The null-check pattern in `createProjectAwareReader` relies on `readDocument` returning `null` for missing files. Without T01, `readDocument` still throws, and the null-check branch would never trigger — the throw would propagate uncaught from the first `readDocument` call.

**Acceptance criteria**:
- `createProjectAwareReader` returns the document when the direct path resolves
- `createProjectAwareReader` falls back to project-relative path when the direct path returns `null`
- `createProjectAwareReader` returns `null` when both paths return `null`
- `createProjectAwareReader` still returns `null` for null/empty `docPath` (no regression)
- The "both fail" test uses a null-returning mock and asserts `null` return
- All `pipeline-engine.test.js` tests pass
- All `state-io.test.js` tests pass (no regression from T01)

## Execution Order

```
T01 (foundation — readDocument null-return)
 └→ T02 (depends on T01 — createProjectAwareReader null-check)
```

**Sequential execution order**: T01 → T02

*No parallel-ready pairs in this phase — T02 directly depends on T01's contract change.*

## Phase Exit Criteria

- [ ] `readDocument` returns `null` for missing files (not throws)
- [ ] `createProjectAwareReader` fallback works via null-check (not try/catch)
- [ ] All existing tests pass with zero regressions
- [ ] All tasks complete with status `complete`
- [ ] Build passes
- [ ] All tests pass

## Known Risks for This Phase

- **Undiscovered call site depending on throw**: Research identified all 7 `readDocument` call sites — 3 in triage (already expect null via guard), 2 wrapped by `createProjectAwareReader` (updated in T02), 1 direct in pipeline pre-read (wrapped in try/catch, null-check is live after T01), 1 pass-through in pipeline.js CLI. Risk is low given complete enumeration.
- **Integration test for project-relative fallback**: The `pipeline-engine.test.js` integration test at line ~1693 uses `createMockIO` (already returns null), so it exercises the null-check fallback path naturally after T02. Verify it still passes.
