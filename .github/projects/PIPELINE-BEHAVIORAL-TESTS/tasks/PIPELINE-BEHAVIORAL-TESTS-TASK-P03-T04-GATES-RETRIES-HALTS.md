---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
task: 4
title: "Gate Modes, Retry/Corrective Cycles & Halt Paths"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 1
---

# Gate Modes, Retry/Corrective Cycles & Halt Paths

## Objective

Add behavioral tests covering all four human gate execution modes (`autonomous`, `task`, `phase`, `ask`), retry/corrective task cycles (including retry exhaustion → halt), and halt paths triggered by rejected reviews and critical failures. Tests are added into the three existing placeholder `describe` blocks: `'Behavioral: Human Gate Modes'`, `'Behavioral: Retry & Corrective Cycles'`, and `'Behavioral: Halt Paths'`.

## Context

The file `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` already exists with factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `advancePipeline`), 2 happy-path tests, 11 task triage row tests, and 5 phase triage row tests. Three empty placeholder `describe` blocks exist at the bottom of the file for this task's tests. The `config.human_gates.execution_mode` field controls gate behavior: `'task'` mode triggers `gate_task` after task approval, `'phase'` mode triggers `gate_phase` after phase approval, and both `'autonomous'` and `'ask'` modes auto-advance with no execution-tier gates. The `gate_approved` and `gate_rejected` events are separate mutation handlers that advance or halt the pipeline.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Replace three empty placeholder `describe` blocks with populated test suites |

## Implementation Steps

1. **Replace the empty `describe('Behavioral: Human Gate Modes', () => { /* T04 */ });` block** with a populated `describe` block containing the gate mode tests listed below. Each test sets `config.human_gates.execution_mode` via `createDefaultConfig({ human_gates: { execution_mode: '<mode>' } })`.

2. **`autonomous` mode test**: Set `execution_mode: 'autonomous'`. Drive a task from `in_progress` through `task_completed` (with clean report) to triage approval. Assert `result.action` is `NEXT_ACTIONS.GENERATE_PHASE_REPORT` (auto-advance through `advance_task` internal action — no `gate_task` returned). Verifies no gate is interposed.

3. **`task` mode test**: Set `execution_mode: 'task'`. Create state with a **2-task phase** (so advancing past task 1 doesn't immediately trigger phase lifecycle). Drive task 1 through `task_completed` with a clean report. Triage auto-approves → resolver sees approved task + `task` gate mode → returns `gate_task`. Assert `result.action === NEXT_ACTIONS.GATE_TASK`. Then send `gate_approved` with `context: { gate_type: 'task' }`. Assert the next action is `NEXT_ACTIONS.CREATE_TASK_HANDOFF` (task 2 is `not_started` with no handoff).

4. **`phase` mode test**: Set `execution_mode: 'phase'`. Drive a **single-task** phase all the way through task completion, phase report creation, and phase review with `verdict: 'approved'` and `exit_criteria_met: true`. After phase triage approves → resolver sees approved phase + `phase` gate mode → returns `gate_phase`. Assert `result.action === NEXT_ACTIONS.GATE_PHASE`. Then send `gate_approved` with `context: { gate_type: 'phase' }`. Assert the pipeline advances correctly (next phase or review tier).

5. **`ask` mode test**: Set `execution_mode: 'ask'`. Drive a task through `task_completed` with a clean report. Assert `result.action` is `NEXT_ACTIONS.GENERATE_PHASE_REPORT` (same as `autonomous` — no execution-tier gates). This confirms `ask` mode does not produce `gate_task` or `gate_phase` in the execution tier.

6. **`gate_rejected` test**: Set `execution_mode: 'task'`. Drive a task to `gate_task`. Then send `gate_rejected` with `context: { gate_type: 'task' }`. Assert `result.action === NEXT_ACTIONS.DISPLAY_HALTED` and the final state has `pipeline.current_tier === 'halted'`, `errors.total_halts >= 1`, and `errors.active_blockers` contains a gate rejection message.

7. **Replace the empty `describe('Behavioral: Retry & Corrective Cycles', () => { /* T04 */ });` block** with the retry/corrective tests listed below.

8. **Single corrective cycle test**: State has 1 task `in_progress` with `handoff_doc` set. Send `task_completed` with a report where `status: 'failed'`, `severity: 'minor'`, `has_deviations: false`, `deviation_type: null`. Assert triage returns `CREATE_CORRECTIVE_HANDOFF` and `task.retries === 1`. Then send `task_handoff_created` (corrective handoff). Assert `result.action === NEXT_ACTIONS.EXECUTE_TASK`. Then send another `task_completed` with a **successful** report (`status: 'complete'`, `has_deviations: false`, `deviation_type: null`). Assert triage auto-approves and advances (Row 1: complete, no deviations, no review → auto-approve → `GENERATE_PHASE_REPORT`). Assert final `task.retries === 1` (unchanged by successful completion).

9. **Retry exhaustion → halt test**: Set `config.limits.max_retries_per_task: 2`. State has task with `retries: 2` already (budget exhausted), `status: 'in_progress'`, `severity: 'minor'`, `handoff_doc` set. Send `task_completed` with `status: 'failed'`, `severity: 'minor'`. Triage's `checkRetryBudget` sees `retries (2) < max (2)` is `false` → returns `HALTED` (Row 11). Assert `result.action === NEXT_ACTIONS.DISPLAY_HALTED`, `task.status === 'halted'`, `pipeline.current_tier === 'halted'`, and `errors.total_halts >= 1`.

10. **Replace the empty `describe('Behavioral: Halt Paths', () => { /* T04 */ });` block** with halt path tests. These tests overlap with triage rows 6, 9, 11 and phase row 5, but the Halt Paths section groups them by halt mechanism for discoverability. Include: (a) task rejected (Row 6), (b) task critical failure (Row 11), (c) phase rejected (phase Row 5), (d) `gate_rejected` halt — all asserting `display_halted` and halted state.

## Contracts & Interfaces

### Human Gate Mode Resolution

```javascript
// .github/orchestration/scripts/lib/resolver.js
function resolveHumanGateMode(state, config) {
  if (config && config.human_gates && config.human_gates.execution_mode) {
    return config.human_gates.execution_mode;
  }
  return (state.pipeline && state.pipeline.human_gate_mode) || HUMAN_GATE_MODES.ASK;
}
```

### Gate Mode → Resolver Behavior

| `execution_mode` | Task approved → action | Phase approved → action |
|-------------------|----------------------|------------------------|
| `'autonomous'` | `advance_task` (internal) → auto-advance | `advance_phase` (internal) → auto-advance |
| `'task'` | `gate_task` (external) → waits for `gate_approved`/`gate_rejected` | `advance_phase` (internal) → auto-advance |
| `'phase'` | `advance_task` (internal) → auto-advance | `gate_phase` (external) → waits for `gate_approved`/`gate_rejected` |
| `'ask'` | `advance_task` (internal) → auto-advance | `advance_phase` (internal) → auto-advance |

### Task Lifecycle — Gate Check (resolver.js)

```javascript
// Inside resolveTaskLifecycle, when task.status === TASK_STATUSES.COMPLETE
// and task.review_verdict === REVIEW_VERDICTS.APPROVED:
if (humanGateMode === HUMAN_GATE_MODES.TASK) {
  return makeResult(NEXT_ACTIONS.GATE_TASK, { ...baseOpts, details: '...' });
}
return makeResult(NEXT_ACTIONS.ADVANCE_TASK, { ...baseOpts, details: '...' });
```

### Phase Lifecycle — Gate Check (resolver.js)

```javascript
// Inside resolvePhaseLifecycle, after phase review verdict is set:
// P6: Approved with phase gate mode
if (phase.phase_review_verdict === REVIEW_VERDICTS.APPROVED &&
    humanGateMode === HUMAN_GATE_MODES.PHASE) {
  return makeResult(NEXT_ACTIONS.GATE_PHASE, { ...baseOpts, details: '...' });
}
// P7: Approved — advance phase
if (phase.phase_review_verdict === REVIEW_VERDICTS.APPROVED) {
  return makeResult(NEXT_ACTIONS.ADVANCE_PHASE, { ...baseOpts, details: '...' });
}
```

### gate_approved Mutation (mutations.js)

```javascript
function handleGateApproved(state, context) {
  const mutations = [];
  if (context.gate_type === 'task') {
    const phase = currentPhase(state);
    phase.current_task += 1;
    mutations.push(`phase.current_task → ${phase.current_task}`);
  } else if (context.gate_type === 'phase') {
    const phase = currentPhase(state);
    phase.status = PHASE_STATUSES.COMPLETE;
    phase.human_approved = true;
    const isLastPhase = (state.execution.current_phase >= state.execution.phases.length - 1);
    if (isLastPhase) {
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      state.execution.status = 'complete';
    } else {
      state.execution.current_phase += 1;
    }
  }
  state.execution.triage_attempts = 0;
  return { state, mutations_applied: mutations };
}
```

### gate_rejected Mutation (mutations.js)

```javascript
function handleGateRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  const msg = 'Gate rejected: ' + (context.gate_type || 'unknown');
  state.errors.active_blockers.push(msg);
  state.errors.total_halts += 1;
  return { state, mutations_applied: [...] };
}
```

### Retry Budget Check (triage-engine.js)

```javascript
function checkRetryBudget(task, limits) {
  if (
    task.severity === SEVERITY_LEVELS.MINOR &&
    task.retries < limits.max_retries_per_task
  ) {
    return REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED;
  }
  return REVIEW_ACTIONS.HALTED;
}
```

### applyTaskTriage — Corrective Path (mutations.js)

```javascript
// When triageResult.action === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED:
task.status = TASK_STATUSES.FAILED;
task.retries += 1;
state.errors.total_retries += 1;
```

### applyTaskTriage — Halt Path (mutations.js)

```javascript
// When triageResult.action === REVIEW_ACTIONS.HALTED:
task.status = TASK_STATUSES.HALTED;
state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
state.errors.total_halts += 1;
state.errors.active_blockers.push('Task halted by triage: ...');
```

### applyPhaseTriage — Halt Path (mutations.js)

```javascript
// When triageResult.action === PHASE_REVIEW_ACTIONS.HALTED:
phase.status = PHASE_STATUSES.HALTED;
state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
state.errors.total_halts += 1;
state.errors.active_blockers.push('Phase halted by triage: ...');
```

### Constants Used in Assertions

```javascript
// .github/orchestration/scripts/lib/constants.js
const NEXT_ACTIONS = {
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  ADVANCE_TASK: 'advance_task',           // internal — NOT returned to caller
  ADVANCE_PHASE: 'advance_phase',         // internal — NOT returned to caller
  CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
  DISPLAY_HALTED: 'display_halted',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  // ... (other values)
};

const HUMAN_GATE_MODES = {
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous'
};

const REVIEW_ACTIONS = {
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted'
};

const PHASE_REVIEW_ACTIONS = {
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted'
};

const TASK_STATUSES = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted' };
const PHASE_STATUSES = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', HALTED: 'halted' };
const PIPELINE_TIERS = { PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review', COMPLETE: 'complete', HALTED: 'halted' };
const REVIEW_VERDICTS = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected' };
const SEVERITY_LEVELS = { MINOR: 'minor', CRITICAL: 'critical' };
```

## Styles & Design Tokens

Not applicable — no visual interface.

## Test Requirements

### Gate Mode Tests (inside `describe('Behavioral: Human Gate Modes')`)

- [ ] `autonomous` mode: task auto-advances after triage approval — no `gate_task` action returned. Assert `result.action === NEXT_ACTIONS.GENERATE_PHASE_REPORT` (single-task phase completes).
- [ ] `task` mode: triage approves task → resolver returns `gate_task`. Assert `result.action === NEXT_ACTIONS.GATE_TASK`. Then `gate_approved` with `gate_type: 'task'` → `NEXT_ACTIONS.CREATE_TASK_HANDOFF` (next task in 2-task phase).
- [ ] `phase` mode: phase triage approves → resolver returns `gate_phase`. Assert `result.action === NEXT_ACTIONS.GATE_PHASE`. Then `gate_approved` with `gate_type: 'phase'` → pipeline advances to next phase or review tier.
- [ ] `ask` mode: same behavior as `autonomous` — task auto-advances, no execution-tier gate. Assert `result.action === NEXT_ACTIONS.GENERATE_PHASE_REPORT`.
- [ ] `gate_rejected`: after `gate_task` returned, send `gate_rejected`. Assert `pipeline.current_tier === 'halted'` and `errors.total_halts >= 1` and `errors.active_blockers` contains gate rejection message.

### Retry & Corrective Cycle Tests (inside `describe('Behavioral: Retry & Corrective Cycles')`)

- [ ] Single corrective cycle: task fails (minor) → `CREATE_CORRECTIVE_HANDOFF` → `task_handoff_created` → `EXECUTE_TASK` → task succeeds → auto-approve → `GENERATE_PHASE_REPORT`. Assert `task.retries === 1`.
- [ ] Retry exhaustion → halt: task with `retries` already at `max_retries_per_task` → fails again → triage `checkRetryBudget` returns `HALTED` → `DISPLAY_HALTED`. Assert `task.status === 'halted'`, `pipeline.current_tier === 'halted'`.

### Halt Path Tests (inside `describe('Behavioral: Halt Paths')`)

- [ ] Task rejected by reviewer: code review with `verdict: 'rejected'` → triage Row 6 → `DISPLAY_HALTED`. Assert `task.status === 'halted'`, `pipeline.current_tier === 'halted'`.
- [ ] Task critical failure: `task_completed` with `status: 'failed'`, `severity: 'critical'` → triage Row 11 → `DISPLAY_HALTED`. Assert `task.status === 'halted'`, `errors.total_halts >= 1`.
- [ ] Phase rejected: phase review with `verdict: 'rejected'` → phase triage Row 5 → `DISPLAY_HALTED`. Assert `phase.status === 'halted'`, `pipeline.current_tier === 'halted'`.
- [ ] Gate rejected → halt: `gate_rejected` event → `DISPLAY_HALTED`. Assert `pipeline.current_tier === 'halted'`, `errors.active_blockers` has gate message.

## Acceptance Criteria

- [ ] The empty `describe('Behavioral: Human Gate Modes', () => { /* T04 */ })` placeholder is replaced with a `describe` block containing at least 5 `it()` tests
- [ ] The empty `describe('Behavioral: Retry & Corrective Cycles', () => { /* T04 */ })` placeholder is replaced with a `describe` block containing at least 2 `it()` tests
- [ ] The empty `describe('Behavioral: Halt Paths', () => { /* T04 */ })` placeholder is replaced with a `describe` block containing at least 4 `it()` tests
- [ ] Every test calls `executePipeline()` end-to-end (not unit-testing resolver or triage functions directly)
- [ ] Every test wrapping triage or internal-action sequences uses `withStrictDates(() => { ... })`
- [ ] The `autonomous` mode test confirms no `gate_task` or `gate_phase` action is returned
- [ ] The `task` mode test confirms `gate_task` is returned after task triage approval and `gate_approved` advances the task
- [ ] The `phase` mode test confirms `gate_phase` is returned after phase triage approval and `gate_approved` advances the phase
- [ ] The `ask` mode test confirms no execution-tier gate action is returned (same as `autonomous`)
- [ ] The `gate_rejected` test confirms the pipeline transitions to `halted` with an active blocker
- [ ] The corrective cycle test drives a task through fail → corrective → succeed with correct `retries` count
- [ ] The retry exhaustion test halts the pipeline when `task.retries >= max_retries_per_task`
- [ ] All existing tests continue to pass — zero regressions
- [ ] All new tests pass (`node --test pipeline-behavioral.test.js`)
- [ ] No lint errors

## Constraints

- Do NOT modify any source modules (`pipeline-engine.js`, `resolver.js`, `mutations.js`, `triage-engine.js`, `constants.js`)
- Do NOT modify any tests written by T01, T02, or T03 — only replace the three empty placeholder `describe` blocks
- Do NOT add imports — all required imports and factory functions already exist at the top of the file
- Do NOT import helpers from other test files — use only the locally-defined factory functions
- Do NOT test gate behavior by calling `resolveNextAction` directly — call `executePipeline()` end-to-end
- Use `createDefaultConfig({ human_gates: { execution_mode: '<mode>' } })` to override the gate mode — do NOT modify the base factory
- For the retry exhaustion test, set `task.retries` to the max value in initial state so triage itself returns `HALTED` (do not rely on multi-step retry cycling to reach the budget limit)
- For the `task` mode gate test, use a **2-task phase** so that advancing past task 1 produces `create_task_handoff` for task 2 (not phase lifecycle)
- All document mocks must include `has_deviations` and `deviation_type` in task report frontmatter and `exit_criteria_met` in phase review frontmatter — these are REQUIRED fields with no fallback
- Stock documents under both direct and project-relative paths as needed (e.g., `'reviews/phase-review.md'` and `'/test/project/reviews/phase-review.md'`) to support `createProjectAwareReader` fallback
