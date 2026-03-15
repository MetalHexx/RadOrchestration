---
project: "PIPELINE-HOTFIX"
phase: 1
title: "Pipeline Engine Fixes & Regression Tests"
status: "active"
total_tasks: 7
author: "tactical-planner-agent"
created: "2026-03-13T00:00:00Z"
---

# Phase 1: Pipeline Engine Fixes & Regression Tests

## Phase Goal

Fix all 6 bugs in `pipeline-engine.js`, `mutations.js`, and `resolver.js`, add the unmapped action guard, update affected skill templates, and write regression tests (RT-1 through RT-13) covering every failure scenario. After this phase, the pipeline engine can process `plan_approved` → phase initialization → `execute_task` → `task_completed` (with normalization) → auto-approve → `advance_phase` → internal handling → next external action, without stalls or routing errors.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-HOTFIX-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints, risk register |
| [Architecture](../PIPELINE-HOTFIX-ARCHITECTURE.md) | Fix 1–5 contracts, code patterns, `EXTERNAL_ACTIONS` set, test architecture (RT-1–RT-13), fix dependency graph, module impact map |
| [Design](../PIPELINE-HOTFIX-DESIGN.md) | DF-1 (master plan pre-read), DF-2 (status normalization), DF-3 (advance_phase re-resolve), DF-4 (unmapped action guard), SL-1/SL-2 (corrected task/phase lifecycle) |
| [PRD](../PIPELINE-HOTFIX-PRD.md) | FR-1–FR-15 (bug fix requirements), FR-20–FR-27 (regression test requirements), NFR-1–NFR-5 (backward compat, patterns, dependencies, error clarity, test quality) |
| [state.json](../state.json) | `execution.phases[0].status = "not_started"`, no `phase_review_action` → normal plan; `limits.max_tasks_per_phase = 8` |

## Task Outline

| # | Task | Dependencies | Files Modified | Est. Files | Handoff Doc |
|---|------|-------------|----------------|-----------|-------------|
| T1 | Error 1 — Master Plan Pre-Read & Phase Initialization | — | `pipeline-engine.js`, `mutations.js`, `create-master-plan/templates/MASTER-PLAN.md` | 3 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T01-PHASE-INIT.md) |
| T2 | Error 2 — Resolver Conditional Fix for In-Progress Tasks | — | `resolver.js` | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T02-RESOLVER-FIX.md) |
| T3 | Error 3 — Status Normalization & Skill Vocabulary | — | `pipeline-engine.js`, `generate-task-report/SKILL.md`, `generate-task-report/templates/TASK-REPORT.md` | 3 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T03-STATUS-NORMALIZE.md) |
| T4 | Error 4 — Auto-Approve Clean Reports on Null/Null Triage | — | `mutations.js` | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T04-AUTO-APPROVE.md) |
| T5 | Errors 5+6 — Internal `advance_phase` & Unmapped Action Guard | T4 | `pipeline-engine.js` | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T05-ADVANCE-PHASE.md) |
| T6 | Regression Tests — `mutations.test.js` (RT-1, RT-7, RT-8, RT-9) | T1, T4 | `mutations.test.js` | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T06-MUTATION-TESTS.md) |
| T7 | Regression Tests — `pipeline-engine.test.js` (RT-1–RT-3, RT-5, RT-6, RT-10–RT-13) | T1, T2, T3, T5 | `pipeline-engine.test.js` | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P01-T07-ENGINE-TESTS.md) |

## Task Details

### T1: Error 1 — Master Plan Pre-Read & Phase Initialization

**Objective**: Add a `plan_approved` pre-read block in `pipeline-engine.js` that reads `total_phases` from the master plan frontmatter and injects it into the mutation context. Update `handlePlanApproved` in `mutations.js` to use `context.total_phases` to initialize `execution.phases[]` with the correct number of `not_started` entries. Add `total_phases` to the `create-master-plan` template frontmatter.

**Scope**:
- `pipeline-engine.js`: Insert new pre-read block before the existing `task_completed` pre-read (~line 150). Read master plan via `io.readDocument()`, extract `total_phases` from frontmatter, validate it's a positive integer, inject into `context.total_phases`. Hard error on missing path, missing field, or invalid value.
- `mutations.js`: Update `handlePlanApproved` (~lines 92–105) to initialize `state.execution.total_phases`, build `state.execution.phases[]` array with `context.total_phases` entries using `PHASE_STATUSES.NOT_STARTED`.
- `create-master-plan/templates/MASTER-PLAN.md`: Add `total_phases: {NUMBER}` to YAML frontmatter.

**Key contracts** (from Architecture Fix 1):
- Context field: `total_phases` — `number`, integer ≥ 1, injected by engine pre-read
- Phase entry fields: `status: 'not_started'`, `tasks: []`, `current_task: 0`, all doc fields `null`, `triage_attempts: 0`, `human_approved: false`
- Error conditions: missing `master_plan.output`, `readDocument()` failure, missing/invalid `total_phases` → all hard error exit 1

**Acceptance criteria**:
- `handlePlanApproved` with `context.total_phases = 3` produces `execution.phases.length === 3` with all entries `status: 'not_started'`
- `execution.total_phases` is set to the context value
- Missing `total_phases` in frontmatter returns `success: false` with descriptive error
- Master plan template includes `total_phases` field in frontmatter

---

### T2: Error 2 — Resolver Conditional Fix for In-Progress Tasks

**Objective**: Fix `resolveTaskLifecycle` in `resolver.js` to split the `in_progress` branch: return `execute_task` when the task has `handoff_doc` but no `report_doc`, and return `update_state_from_task` only when both exist.

**Scope**:
- `resolver.js`: Replace the `in_progress` block (~lines 168–173) with a conditional split on `task.handoff_doc` and `task.report_doc`.

**Key contracts** (from Architecture Fix 2):
- `handoff_doc` truthy + `report_doc` falsy → `NEXT_ACTIONS.EXECUTE_TASK` ("Coder hasn't run yet")
- `handoff_doc` truthy + `report_doc` truthy → `NEXT_ACTIONS.UPDATE_STATE_FROM_TASK` ("Coder finished")
- `handoff_doc` falsy + `report_doc` falsy → falls through to `UPDATE_STATE_FROM_TASK` (defensive)

**Acceptance criteria**:
- In-progress task with handoff but no report → resolver returns `execute_task`
- In-progress task with both handoff and report → resolver returns `update_state_from_task`
- Existing `resolver.test.js` suite passes unmodified

---

### T3: Error 3 — Status Normalization & Skill Vocabulary

**Objective**: Add status normalization in `pipeline-engine.js` inside the existing task report pre-read block. Reinforce the `generate-task-report` skill and template to constrain status vocabulary.

**Scope**:
- `pipeline-engine.js`: Insert normalization logic after `context.report_status` is extracted from frontmatter (~line 163). Map `'pass'` → `'complete'`, `'fail'` → `'failed'`. Hard error for any value not in `{complete, partial, failed}` after normalization.
- `generate-task-report/SKILL.md`: Insert explicit vocabulary constraint block before the status classification table.
- `generate-task-report/templates/TASK-REPORT.md`: Update the frontmatter status field comment to reinforce `complete | partial | failed` constraint.

**Key contracts** (from Architecture Fix 3):
- `STATUS_SYNONYMS`: `{ 'pass': 'complete', 'fail': 'failed' }` — defined inside pre-read block
- `VALID_STATUSES`: `['complete', 'partial', 'failed']`
- Unknown values after normalization → hard error exit 1 with message naming the invalid value
- Error message pattern: `"Unrecognized task report status: '{raw}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)"`

**Acceptance criteria**:
- `status: 'pass'` in task report frontmatter is normalized to `'complete'` before triage
- `status: 'fail'` is normalized to `'failed'`
- `status: 'banana'` produces `success: false` with error naming `'banana'`
- Skill SKILL.md contains prominent vocabulary constraint block
- Template frontmatter comment reinforces `complete | partial | failed`

---

### T4: Error 4 — Auto-Approve Clean Reports on Null/Null Triage

**Objective**: Update `applyTaskTriage` and `applyPhaseTriage` in `mutations.js` to auto-approve when triage returns null/null verdict/action and a report exists (proof of execution).

**Scope**:
- `mutations.js` — `applyTaskTriage` (~lines 372–375): When `verdict === null && action === null` and `task.report_doc` is truthy, set `task.status = TASK_STATUSES.COMPLETE`, `task.review_verdict = REVIEW_VERDICTS.APPROVED`, `task.review_action = REVIEW_ACTIONS.ADVANCED`, reset `task.triage_attempts` and `execution.triage_attempts` to 0. When no report, preserve original skip behavior (`{ state, mutations_applied: [] }`).
- `mutations.js` — `applyPhaseTriage` (~lines 421–423): Same pattern — when `verdict === null && action === null` and `phase.phase_report` is truthy, set `phase.phase_review_verdict = REVIEW_VERDICTS.APPROVED`, `phase.phase_review_action = PHASE_REVIEW_ACTIONS.ADVANCED`, reset triage attempts.

**Key contracts** (from Architecture Fix 4):
- Task auto-approve conditions: `verdict === null`, `action === null`, `task.report_doc` truthy
- Phase auto-approve conditions: `verdict === null`, `action === null`, `phase.phase_report` truthy
- Without report → original skip (`mutations_applied: []`)
- Triage decision table (triage-engine.js) is NOT modified — Row 1 still returns null/null

**Acceptance criteria**:
- `applyTaskTriage` with null/null + `report_doc` → task `status: 'complete'`, `review_verdict: 'approved'`, `review_action: 'advanced'`, `triage_attempts: 0`
- `applyTaskTriage` with null/null + no `report_doc` → zero mutations (original skip)
- `applyPhaseTriage` with null/null + `phase_report` → phase `review_verdict: 'approved'`, `review_action: 'advanced'`, `triage_attempts: 0`
- Existing `triage-engine.test.js` passes unmodified

---

### T5: Errors 5+6 — Internal `advance_phase` & Unmapped Action Guard

**Objective**: Add internal `advance_phase` handling in `pipeline-engine.js` with bounded re-resolve loop (max 1 iteration), define the `EXTERNAL_ACTIONS` set, and add the unmapped action guard.

**Scope**:
- `pipeline-engine.js` — imports: Add `PHASE_STATUSES` to the constants import (currently only `PIPELINE_TIERS` and `NEXT_ACTIONS` are imported).
- `pipeline-engine.js` — module scope: Define `EXTERNAL_ACTIONS` set (18 external action values from `NEXT_ACTIONS`).
- `pipeline-engine.js` — after resolve step (~lines 285–290): Insert `advance_phase` internal handler: set `phase.status = PHASE_STATUSES.COMPLETE`, advance `current_phase` or set `execution.status = 'complete'` on last phase (keeping `current_phase` at last valid index), re-validate, write state, re-resolve. Bounded loop guard: if re-resolved action is still not in `EXTERNAL_ACTIONS`, hard error.
- `pipeline-engine.js` — after internal handler: Insert unmapped action guard: if resolved action is not in `EXTERNAL_ACTIONS`, hard error exit 1 with descriptive message.

**Key contracts** (from Architecture Fix 5):
- `EXTERNAL_ACTIONS`: Set of 18 actions — `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `request_plan_approval`, `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer`, `generate_phase_report`, `spawn_phase_reviewer`, `spawn_final_reviewer`, `request_final_approval`, `gate_task`, `gate_phase`, `display_halted`, `display_complete`
- Last-phase advancement: `current_phase` stays at last valid index, `execution.status = 'complete'`, `pipeline.current_tier = 'review'`
- Non-last: `current_phase += 1`
- Re-resolve bound: 1 internal iteration max → hard error if exceeded
- Unmapped action guard: catches any action not in `EXTERNAL_ACTIONS` (including after internal handling)

**Acceptance criteria**:
- Non-last phase approved → engine handles `advance_phase` internally → returns `create_phase_plan` as external action
- Last phase approved → engine handles `advance_phase` internally → returns `spawn_final_reviewer`, `current_phase` at last index, `execution.status = 'complete'`
- Unmapped action (not in 18-action set) → `success: false` with error naming the action
- `PHASE_STATUSES` is imported from constants
- Existing `state-validator.test.js` passes unmodified (V1 bounds check never triggered)

---

### T6: Regression Tests — `mutations.test.js`

**Objective**: Add regression tests RT-1, RT-7, RT-8, RT-9 to `mutations.test.js` and update the existing skip-case test to reflect the new auto-approve behavior.

**Scope**:
- `mutations.test.js` — RT-1: `handlePlanApproved` initializes phases. Assert `execution.phases.length === context.total_phases`, each entry has `status: 'not_started'`, `execution.total_phases` is set.
- `mutations.test.js` — RT-7: `applyTaskTriage` auto-approve with `report_doc`. Assert `task.status === 'complete'`, `review_verdict === 'approved'`, `review_action === 'advanced'`, `triage_attempts === 0`.
- `mutations.test.js` — RT-8: `applyTaskTriage` skip without `report_doc`. Assert `mutations_applied === []`, state unchanged.
- `mutations.test.js` — RT-9: `applyPhaseTriage` auto-approve with `phase_report`. Assert `phase_review_verdict === 'approved'`, `phase_review_action === 'advanced'`, `triage_attempts === 0`.
- `mutations.test.js` — Update existing skip-case test (~line 710): Split or adjust to match RT-7/RT-8 split. If the existing fixture includes `report_doc`, change expected behavior to auto-approve. If not, keep as skip-case and add RT-7 as separate test.

**Key patterns** (from Architecture Test Architecture):
- Use existing `makeBaseState()` / `makeExecutionState()` factory with overrides
- Use `node:test` `describe`/`it` blocks, `node:assert/strict`
- Assert correct post-condition state, not just absence of errors (NFR-5)

**Acceptance criteria**:
- RT-1 passes: `handlePlanApproved` correctly initializes phase array
- RT-7 passes: null/null + report → auto-approve
- RT-8 passes: null/null + no report → skip (zero mutations)
- RT-9 passes: null/null phase triage + report → auto-approve
- Existing skip-case test is updated or split correctly
- All existing `mutations.test.js` tests still pass

---

### T7: Regression Tests — `pipeline-engine.test.js`

**Objective**: Add regression tests RT-1, RT-2, RT-3, RT-5, RT-6, RT-10, RT-11, RT-12, RT-13 to `pipeline-engine.test.js`, covering the full pipeline engine integration for all 6 fixes and the unmapped action guard.

**Scope**:
- RT-1: `plan_approved` pre-read initializes phases via engine. Mock `io.readDocument` to return `{ frontmatter: { total_phases: 3 } }`. Assert `result.success === true`, state has 3 phases.
- RT-2: `plan_approved` missing `total_phases` → error. Mock doc with empty frontmatter. Assert `result.success === false`, error mentions `total_phases`.
- RT-3: Resolver returns `execute_task` for in-progress task with handoff but no report. Set up state with `task.status = 'in_progress'`, `handoff_doc` set, `report_doc = null`. Assert `result.action === 'execute_task'`.
- RT-5: Status normalization `pass` → `complete`. Mock task report with `{ status: 'pass' }`. Assert `result.success === true`, triage receives normalized status.
- RT-6: Status normalization `banana` → error. Mock task report with `{ status: 'banana' }`. Assert `result.success === false`, error mentions `banana`.
- RT-10: `advance_phase` non-last phase. Set up 2-phase state with phase 0 approved. Assert `result.action === 'create_phase_plan'`, `current_phase === 1`.
- RT-11: `advance_phase` last phase. Set up 2-phase state with phase 1 approved. Assert `result.action === 'spawn_final_reviewer'`, `current_phase === 1` (not 2), `execution.status === 'complete'`.
- RT-12: V1 validator passes after last-phase advancement. Same state as RT-11. Assert `result.success === true` (no validation error).
- RT-13: Unmapped action guard. Construct state causing resolver to return an action not in `EXTERNAL_ACTIONS`. Assert `result.success === false`, error names the unmapped action.

**Key patterns** (from Architecture Test Architecture):
- Use existing mock I/O and fixture factory patterns in `pipeline-engine.test.js`
- Mock `io.readDocument`, `io.readConfig`, `io.writeState` as needed
- Use `node:test` `describe`/`it` blocks, `node:assert/strict`
- Assert correct post-condition state (NFR-5)

**Acceptance criteria**:
- All 9 regression tests (RT-1, RT-2, RT-3, RT-5, RT-6, RT-10, RT-11, RT-12, RT-13) pass
- No existing tests in `pipeline-engine.test.js` break
- All 4 preserved test suites (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`) still pass unmodified

## Execution Order

```
T1 (Error 1: Phase Init)      ──┐
T2 (Error 2: Resolver Fix)    ──┤── parallel-ready (independent)
T3 (Error 3: Status Normalize)──┤
T4 (Error 4: Auto-Approve)    ──┘
                                 │
                                 ▼
T5 (Errors 5+6: advance_phase)←── depends on T4
                                 │
                                 ▼
T6 (mutations.test.js)        ←── depends on T1, T4
T7 (pipeline-engine.test.js)  ←── depends on T1, T2, T3, T5
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6 → T7

*Note: T1, T2, T3, T4 are parallel-ready (no mutual dependencies) but will execute sequentially in v1. T6 and T7 are parallel-ready once their respective dependencies are met.*

## Phase Exit Criteria

- [ ] All 4 preserved test suites pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] All new regression tests (RT-1 through RT-13) pass
- [ ] Pipeline processes `plan_approved` → phases initialized → `execute_task` → `task_completed` (with normalization) → auto-approve → `advance_phase` → internal handling → next external action, without stalls or routing errors
- [ ] Unmapped action guard returns hard error for any non-external action after internal handling
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes (`node --test` on all test files in `.github/orchestration/scripts/tests/`)

## Known Risks for This Phase

- **Auto-approve incorrectly advances tasks**: Mitigated by requiring `report_doc`/`phase_report` to be truthy (proof of execution). Regression tests RT-7, RT-8, RT-9 verify exact conditions. (Risk Register #1)
- **Existing skip-case test update changes meaning**: The old test asserted behavior for a buggy case. RT-7 and RT-8 split the assertion into two tests covering both with-report and without-report cases. (Risk Register #4)
- **Multiple tasks modify same files** (`pipeline-engine.js` is touched by T1, T3, T5; `mutations.js` by T1, T4): Sequential execution and non-overlapping code sections mitigate merge conflicts. Each task targets specific, well-defined insertion points from the Architecture document.
- **Bounded re-resolve loop (max 1 iteration)**: Current analysis shows only `advance_phase` triggers re-resolve. Hard error on exceeding the bound makes issues immediately visible. (Risk Register #2)
