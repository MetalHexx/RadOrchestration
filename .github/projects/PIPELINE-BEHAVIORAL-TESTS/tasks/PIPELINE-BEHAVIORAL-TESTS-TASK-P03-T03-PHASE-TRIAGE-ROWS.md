---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
task: 3
title: "Phase-Level Triage Rows 1–5"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Phase-Level Triage Rows 1–5

## Objective

Add 5 behavioral tests for all phase-level triage decision rows into the existing `describe('Behavioral: Phase Triage')` placeholder block in `pipeline-behavioral.test.js`. Each test calls `executePipeline()` end-to-end with a `phase_review_completed` event and asserts the correct `result.action` and state mutations.

## Context

The file `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` already exists with factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `advancePipeline`), happy-path tests (T01), and task triage tests (T02). There is an empty placeholder: `describe('Behavioral: Phase Triage', () => { /* T03: Rows 1-5 */ });`. Replace that placeholder with a `describe` block containing 5 `it()` tests — one per phase triage behavioral row. Phase triage runs automatically when the pipeline engine processes a `phase_review_completed` event: the mutation sets `phase.phase_review`, then the triage engine evaluates the 5-row phase decision table, then `applyPhaseTriage` writes verdict/action to state, and the resolver determines the next external action. The `exit_criteria_met` boolean in the phase review frontmatter is a REQUIRED field — omitting it triggers a triage error.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Replace the empty `describe('Behavioral: Phase Triage', ...)` placeholder with 5 test cases |

## Implementation Steps

1. **Locate the placeholder** — find the line `describe('Behavioral: Phase Triage', () => { /* T03: Rows 1-5 */ });` and replace it entirely with the new `describe` block containing 5 tests.

2. **Create a state builder helper** inside the `describe` block (or inline in each test) that produces a phase-triage-ready state. Use `createExecutionState` with a mutator that:
   - Sets `phases[0].tasks[0].status = 'complete'`
   - Sets `phases[0].tasks[0].review_verdict = 'approved'`
   - Sets `phases[0].tasks[0].review_action = 'advanced'`
   - Sets `phases[0].tasks[0].handoff_doc = 'tasks/task-01.md'`
   - Sets `phases[0].tasks[0].report_doc = 'reports/task-report.md'`
   - Sets `phases[0].tasks[0].review_doc = 'reviews/code-review.md'`
   - Sets `phases[0].current_task = 1` (past end of 1-task array → phase lifecycle)
   - Sets `phases[0].phase_report = 'reports/phase-report.md'`
   - Leaves `phases[0].phase_review = null` (the event mutation will set it)
   - Leaves `phases[0].phase_review_verdict = null`
   - Leaves `phases[0].phase_review_action = null`

3. **For multi-phase tests** (Row 1), modify the state to have 2 phases. Add a second phase with `status: 'not_started'` and set `execution.total_phases = 2`.

4. **Stock task report documents** in mock IO for each test with `has_deviations: false` and `deviation_type: null` to avoid triage table gap errors.

5. **Stock phase review documents** under dual paths (direct path and project-aware path) — e.g., both `'reviews/phase-review.md'` and `'/test/project/reviews/phase-review.md'`. The triage engine uses `createProjectAwareReader` which tries the path as-is first, then falls back to joining with projectDir.

6. **Wrap every test body** in `withStrictDates(() => { ... })` to avoid V13 timestamp validation collisions during triage + internal action sequences.

7. **Implement the 5 tests** per the specifications in the Test Requirements section below.

8. **Run `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js`** to verify all tests pass.

## Contracts & Interfaces

### `executePipeline(request, io)` — Pipeline Engine Entry Point

```javascript
// request shape:
{
  event: 'phase_review_completed',
  projectDir: '/test/project',
  configPath: '/test/orchestration.yml',
  context: { review_path: 'reviews/phase-review.md' }
}

// Successful result shape:
{
  success: true,
  action: string,          // NEXT_ACTIONS enum value (external action)
  context: { tier, phase_index, task_index, phase_id, task_id, details },
  mutations_applied: string[],
  triage_ran: boolean,     // true for phase_review_completed
  validation_passed: true
}

// Error result shape:
{
  success: false,
  error: string,           // e.g. "Triage failed: Required frontmatter field 'exit_criteria_met' missing..."
  event: string,
  state_snapshot: object|null,
  mutations_applied: string[],
  validation_passed: boolean|null
}
```

### Phase Review Document Shape (mock)

```javascript
{
  frontmatter: {
    verdict: 'approved' | 'changes_requested' | 'rejected',
    exit_criteria_met: true | false   // REQUIRED — omitting triggers triage error
  },
  body: 'Phase review body'
}
```

### Task Report Document Shape (mock — for state consistency)

```javascript
{
  frontmatter: {
    status: 'complete',
    has_deviations: false,
    deviation_type: null    // Use null, not "none"
  },
  body: 'Task report body'
}
```

### Phase Triage Decision Table (5 rows from triage-engine.js `triagePhase`)

| Row | Condition | Verdict | Action | Details |
|-----|-----------|---------|--------|---------|
| 1 | No phase_review set | `null` | `null` | Skip triage (unreachable via `phase_review_completed` — mutation always sets phase_review before triage) |
| 2 | `verdict=approved`, `exit_criteria_met=true` | `'approved'` | `'advanced'` | Advance to next phase |
| 3 | `verdict=approved`, `exit_criteria_met=false` | `'approved'` | `'advanced'` | Advance with carry-forward |
| 4 | `verdict=changes_requested` | `'changes_requested'` | `'corrective_tasks_issued'` | Create corrective phase plan |
| 5 | `verdict=rejected` | `'rejected'` | `'halted'` | Halt pipeline |

### `applyPhaseTriage` State Mutations

```javascript
// For ADVANCED action (rows 2, 3):
phase.phase_review_verdict = triageResult.verdict;   // 'approved'
phase.phase_review_action = triageResult.action;      // 'advanced'
execution.triage_attempts = 0;                        // reset on advance

// For CORRECTIVE_TASKS_ISSUED action (row 4):
phase.phase_review_verdict = triageResult.verdict;   // 'changes_requested'
phase.phase_review_action = triageResult.action;      // 'corrective_tasks_issued'
execution.triage_attempts += 1;

// For HALTED action (row 5):
phase.phase_review_verdict = triageResult.verdict;   // 'rejected'
phase.phase_review_action = triageResult.action;      // 'halted'
phase.status = 'halted';
pipeline.current_tier = 'halted';
errors.total_halts += 1;
errors.active_blockers ← halt message;
execution.triage_attempts += 1;
```

### Post-Triage Resolution (Internal Actions)

After triage, the resolver determines the next action. For `ADVANCED`, the resolver returns `ADVANCE_PHASE` (internal action), which the pipeline engine handles:

```javascript
// ADVANCE_PHASE (internal action):
phase.status = 'complete';
if (isLastPhase) {
  pipeline.current_tier = 'review';
  execution.status = 'complete';
  // → resolves to SPAWN_FINAL_REVIEWER
} else {
  execution.current_phase += 1;
  // → resolves to CREATE_PHASE_PLAN (next phase is not_started)
}
```

### NEXT_ACTIONS Constants (relevant subset)

```javascript
const NEXT_ACTIONS = {
  CREATE_PHASE_PLAN:       'create_phase_plan',
  SPAWN_FINAL_REVIEWER:    'spawn_final_reviewer',
  DISPLAY_HALTED:          'display_halted',
  // ... (others not needed for this task)
};
```

### PHASE_REVIEW_ACTIONS Constants

```javascript
const PHASE_REVIEW_ACTIONS = {
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',   // Note: PLURAL
  HALTED: 'halted'
};
```

## Styles & Design Tokens

N/A — this is a test-only task with no UI components.

## Test Requirements

### Test 1: "Phase Row 2: approved, exit_criteria_met=true, non-last phase → advance → create_phase_plan"

- **State**: 2-phase project (`total_phases: 2`, `phases.length: 2`), phase 0 fully complete (all tasks done, phase report exists), second phase with `status: 'not_started'`
- **Event**: `phase_review_completed` with `{ review_path: 'reviews/phase-review.md' }`
- **Phase review doc**: `{ verdict: 'approved', exit_criteria_met: true }`
- **Assertions**:
  - `result.success === true`
  - `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN`
  - `result.triage_ran === true`
  - Final state: `execution.current_phase === 1`
  - Final state: `phases[0].phase_review_verdict === 'approved'`
  - Final state: `phases[0].phase_review_action === PHASE_REVIEW_ACTIONS.ADVANCED`
  - Final state: `phases[0].status === PHASE_STATUSES.COMPLETE`

### Test 2: "Phase Row 2: approved, exit_criteria_met=true, last phase → advance → spawn_final_reviewer"

- **State**: 1-phase project (default `createExecutionState`), phase 0 fully complete (all tasks done, phase report exists)
- **Event**: `phase_review_completed` with `{ review_path: 'reviews/phase-review.md' }`
- **Phase review doc**: `{ verdict: 'approved', exit_criteria_met: true }`
- **Assertions**:
  - `result.success === true`
  - `result.action === NEXT_ACTIONS.SPAWN_FINAL_REVIEWER`
  - `result.triage_ran === true`
  - Final state: `pipeline.current_tier === PIPELINE_TIERS.REVIEW`
  - Final state: `execution.status === 'complete'`
  - Final state: `phases[0].phase_review_verdict === 'approved'`
  - Final state: `phases[0].phase_review_action === PHASE_REVIEW_ACTIONS.ADVANCED`
  - Final state: `phases[0].status === PHASE_STATUSES.COMPLETE`

### Test 3: "Phase Row 3: approved, exit_criteria_met=false → advance with carry-forward → create_phase_plan"

- **State**: 2-phase project, phase 0 fully complete, second phase `not_started`
- **Event**: `phase_review_completed` with `{ review_path: 'reviews/phase-review.md' }`
- **Phase review doc**: `{ verdict: 'approved', exit_criteria_met: false }`
- **Assertions**:
  - `result.success === true`
  - `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN`
  - `result.triage_ran === true`
  - Final state: `execution.current_phase === 1`
  - Final state: `phases[0].phase_review_verdict === 'approved'`
  - Final state: `phases[0].phase_review_action === PHASE_REVIEW_ACTIONS.ADVANCED`
  - Final state: `phases[0].status === PHASE_STATUSES.COMPLETE`

### Test 4: "Phase Row 4: changes_requested → corrective_tasks_issued → create_phase_plan"

- **State**: 1-phase project (or multi-phase — doesn't matter since it won't advance), phase 0 fully complete
- **Event**: `phase_review_completed` with `{ review_path: 'reviews/phase-review.md' }`
- **Phase review doc**: `{ verdict: 'changes_requested', exit_criteria_met: true }`
- **Assertions**:
  - `result.success === true`
  - `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN`
  - `result.triage_ran === true`
  - Final state: `phases[0].phase_review_verdict === 'changes_requested'`
  - Final state: `phases[0].phase_review_action === PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED`
  - Final state: `pipeline.current_tier` is still `'execution'` (NOT halted)

### Test 5: "Phase Row 5: rejected → halted → display_halted"

- **State**: 1-phase project, phase 0 fully complete
- **Event**: `phase_review_completed` with `{ review_path: 'reviews/phase-review.md' }`
- **Phase review doc**: `{ verdict: 'rejected', exit_criteria_met: true }`
- **Assertions**:
  - `result.success === true`
  - `result.action === NEXT_ACTIONS.DISPLAY_HALTED`
  - `result.triage_ran === true`
  - Final state: `pipeline.current_tier === PIPELINE_TIERS.HALTED`
  - Final state: `phases[0].phase_review_verdict === 'rejected'`
  - Final state: `phases[0].phase_review_action === PHASE_REVIEW_ACTIONS.HALTED`
  - Final state: `phases[0].status === PHASE_STATUSES.HALTED`
  - Final state: `errors.total_halts >= 1`
  - Final state: `errors.active_blockers.length >= 1`

## Acceptance Criteria

- [ ] The empty `describe('Behavioral: Phase Triage', () => { /* T03: Rows 1-5 */ })` placeholder is replaced with a `describe` block containing exactly 5 `it()` tests
- [ ] Test 1 covers phase triage row 2 with non-last-phase (advance → create_phase_plan)
- [ ] Test 2 covers phase triage row 2 with last-phase (advance → spawn_final_reviewer)
- [ ] Test 3 covers phase triage row 3 (approved + exit_criteria_met=false → advance with carry-forward)
- [ ] Test 4 covers phase triage row 4 (changes_requested → corrective_tasks_issued → create_phase_plan)
- [ ] Test 5 covers phase triage row 5 (rejected → halted → display_halted)
- [ ] All 5 tests call `executePipeline()` end-to-end (not unit-testing triage functions directly)
- [ ] All 5 tests are wrapped in `withStrictDates(() => { ... })`
- [ ] Phase review documents are stocked under dual paths (direct and `/test/project/`-prefixed)
- [ ] All task reports in mock state have `has_deviations: false` and `deviation_type: null` (not `"none"`)
- [ ] All existing tests (happy path, multi-phase, task triage) continue to pass — zero regressions
- [ ] `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` passes with 0 failures
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `advancePipeline`) — they are shared with other tests
- Do NOT modify any other `describe` blocks — only replace the `Behavioral: Phase Triage` placeholder
- Do NOT import or reference any external planning documents — this handoff is self-contained
- Do NOT unit-test `triagePhase` or `applyPhaseTriage` directly — all tests must go through `executePipeline()`
- Do NOT add new imports — the existing imports at the top of the file already include all needed constants (`NEXT_ACTIONS`, `PIPELINE_TIERS`, `TASK_STATUSES`, `PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`)
- Use `deviation_type: null` in task report frontmatter, NOT `deviation_type: "none"` — the pipeline engine checks for the presence of the field, and `null` is the correct "no deviation" value
