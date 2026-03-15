---
project: "V3-FIXES"
phase: 1
title: "Pipeline Script Fixes + Unit Tests"
status: "active"
total_tasks: 3
tasks:
  - id: "T01-MUTATION-TESTS"
    title: "Add corrective clearing and idempotency unit tests to mutations.test.js"
  - id: "T02-PREREADS-FIX"
    title: "Add state-derivation fallback to handlePlanApproved in pre-reads.js"
  - id: "T03-STATEIO-CWD"
    title: "Replace process.cwd() with __dirname-relative path in state-io.js"
author: "tactical-planner-agent"
created: "2026-03-15T00:00:00Z"
---

# Phase 1: Pipeline Script Fixes + Unit Tests

## Phase Goal

Apply three targeted code fixes to pipeline scripts and add two unit tests to lock in the corrective task mutation behavior. After this phase, the three runtime scripts (`mutations.test.js`, `pre-reads.js`, `state-io.js`) are hardened and covered, with zero regressions to existing tests.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../V3-FIXES-MASTER-PLAN.md) | Phase 1 scope and exit criteria |
| [Architecture](../V3-FIXES-ARCHITECTURE.md) | Goal 1-A/1-C (mutations confirmation + test specs), Goal 4-A/4-B (pre-reads imports + updated handler), Goal 5-A (state-io one-line fix) |
| [Design](../V3-FIXES-DESIGN.md) | Area 1 (corrective task state lifecycle, presence-based clearing rationale, idempotency definition), Area 3 (plan_approved handler path derivation flow), Area 4 (CWD hardening Layer 1) |
| [PRD](../V3-FIXES-PRD.md) | FR-1, FR-2, FR-3 (mutations), FR-10 (pre-reads), FR-12 (state-io), NFR-1 (node:test), NFR-5 (no regression) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Add corrective clearing and idempotency unit tests to `mutations.test.js` | — | `code` | 1 | [V3-FIXES-TASK-P01-T01-MUTATION-TESTS.md](../tasks/V3-FIXES-TASK-P01-T01-MUTATION-TESTS.md) |
| T02 | Add state-derivation fallback to `handlePlanApproved` in `pre-reads.js` | — | `code` | 1 | [V3-FIXES-TASK-P01-T02-PREREADS-FIX.md](../tasks/V3-FIXES-TASK-P01-T02-PREREADS-FIX.md) |
| T03 | Replace `process.cwd()` with `__dirname`-relative path in `state-io.js` | — | `code` | 1 | [V3-FIXES-TASK-P01-T03-STATEIO-CWD.md](../tasks/V3-FIXES-TASK-P01-T03-STATEIO-CWD.md) |

## Execution Order

```
T01 (mutations.test.js unit tests)  ← parallel-ready
T02 (pre-reads.js fix)              ← parallel-ready
T03 (state-io.js CWD fix)           ← parallel-ready
```

**Sequential execution order**: T01 → T02 → T03

*Note: All three tasks are fully independent (no mutual dependencies) and parallel-ready, but will execute sequentially in v1.*

## Task Details

### T01 — Add corrective clearing and idempotency unit tests to `mutations.test.js`

**Objective**: Add 2 new unit tests inside the existing `describe('handleTaskHandoffCreated', ...)` block in `.github/orchestration/scripts/tests/mutations.test.js`. No runtime code changes to `mutations.js` — the existing clearing logic is confirmed correct.

**Scope**:
- **Test 1 (Corrective clearing)**: Build state with pre-populated stale fields (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`), call `handleTaskHandoffCreated`, assert all five fields are null and mutation log includes both clearing entries.
- **Test 2 (Idempotency)**: Call `handleTaskHandoffCreated` on a fresh task (all stale fields null), assert zero clearing mutation entries emitted and only 2 standard entries present (`handoff_doc` + `status`).
- Must use `node:test` + `node:assert/strict` (NFR-1).
- `makeExecutionState()` does not set `report_status` — test must set it explicitly on the task object before calling the handler.

**File targets**: `mutations.test.js` (MODIFY)

**FRs addressed**: FR-1, FR-2, FR-3

### T02 — Add state-derivation fallback to `handlePlanApproved` in `pre-reads.js`

**Objective**: Update `handlePlanApproved` in `.github/orchestration/scripts/lib/pre-reads.js` so it derives the master plan path from `state.planning.steps[4].doc_path` when `context.doc_path` is absent. Backward compatible — if `context.doc_path` IS present, use it as before.

**Scope**:
- Add two new imports at the top of `pre-reads.js`: `path` (Node built-in) and `readFile` from `../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers`.
- Replace the `handlePlanApproved` function body with the hybrid Option C implementation from the Architecture (§ 4-B).
- Return `success: false` with descriptive error if neither context nor state provides the path. Never throw.
- Function signature already receives `projectDir` as the third argument — no dispatch changes needed.

**File targets**: `pre-reads.js` (MODIFY)

**FRs addressed**: FR-10

### T03 — Replace `process.cwd()` with `__dirname`-relative path in `state-io.js`

**Objective**: Fix the single CWD-dependent path in `.github/orchestration/scripts/lib/state-io.js` so `readConfig` resolves the correct config path regardless of the process working directory.

**Scope**:
- In `readConfig`, replace `path.join(process.cwd(), '.github', 'orchestration.yml')` with `path.resolve(__dirname, '../../../orchestration.yml')`.
- This is a single-line change. `path` is already imported.

**File targets**: `state-io.js` (MODIFY)

**FRs addressed**: FR-12

## Phase Exit Criteria

- [ ] All existing tests in `mutations.test.js` pass unchanged (NFR-5)
- [ ] T1 (corrective clearing) passes: all five stale fields nulled; mutation log entries emitted for `report_doc` and `review_doc` clearing (FR-2)
- [ ] T2 (idempotency) passes: zero clearing mutation entries emitted; only 2 standard entries present (FR-3)
- [ ] `handlePlanApproved` invoked with `context = {}` (no `doc_path`) succeeds when `state.planning.steps[4].doc_path` is set (FR-10)
- [ ] `readConfig` resolves correct path when CWD is not the workspace root (FR-12)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] All tests pass (no regressions across `mutations.test.js`, `pipeline-behavioral.test.js`, `resolver.test.js`)

## Known Risks for This Phase

- **R-1 (from Master Plan)**: `handlePlanApproved` state derivation fails if `state.planning.steps[4]` index is wrong (e.g., planning step order changes in a future refactor). Mitigation: null-check guards return descriptive `success: false` instead of throwing; the index is stable and verified by precondition (plan_approved only fires after master_plan_completed).
- **R-4 (from Master Plan)**: Presence-based clearing in `handleTaskHandoffCreated` fires unexpectedly if a future event legitimately leaves `report_doc` set before a first-time handoff. Mitigation: T2 (idempotency test) detects regression; clearing emits mutation log entries making any unintended clearing visible.
- **R-5 (from Master Plan)**: `__dirname`-relative path in `state-io.js` breaks if the script is relocated. Mitigation: script location is stable and not in scope for relocation; the path derivation is verified by the Architecture path-resolution table.
