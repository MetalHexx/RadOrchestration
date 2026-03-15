---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
task: 3
title: "Resolver Test Suite"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Resolver Test Suite

## Objective

Create `tests/resolver.test.js` — a comprehensive test suite that exercises every resolution path in `src/lib/resolver.js`, verifying that the `resolveNextAction(state, config?)` pure function returns the correct `NEXT_ACTIONS` value for every reachable state combination (~31 paths).

## Context

`src/lib/resolver.js` exports `resolveNextAction(state, config?)` — a pure function that reads a `state.json` object and returns a `NextActionResult` identifying the next Orchestrator action. It encodes ~31 resolution paths across 5 tiers (setup/terminal, planning, execution-task, execution-phase, review). The function imports only from `src/lib/constants.js`. Existing test suites use `node:test` (`describe`/`it`) and a `makeBaseState()` helper that returns a valid execution-tier state object.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/resolver.test.js` | Comprehensive test suite for all resolution paths |

## Implementation Steps

1. **Create file** with `'use strict'`, import `{ describe, it }` from `node:test`, import `assert` from `node:assert`.
2. **Import** `{ resolveNextAction }` from `../src/lib/resolver.js` and all needed enums from `../src/lib/constants.js`.
3. **Create `makeBaseState()` helper** returning a valid execution-tier state (same pattern as `tests/state-validator.test.js`). Must include: `project`, `pipeline` (tier: `'execution'`, gate mode: `'autonomous'`), `planning` (all complete, human_approved: true), `execution` (1 phase, 2 tasks, phase `in_progress`, current_task: 0, first task `not_started`), `final_review`, `errors`, `limits`.
4. **Setup / Terminal group** (~3 tests): `INIT_PROJECT` (null state), `DISPLAY_HALTED` (tier `'halted'`), `DISPLAY_COMPLETE` (tier `'complete'`).
5. **Planning tier group** (~9 tests): One test per planning step spawn action (`SPAWN_RESEARCH` through `SPAWN_MASTER_PLAN`), plus `REQUEST_PLAN_APPROVAL` (all steps complete, human_approved false), `TRANSITION_TO_EXECUTION` (all complete, human_approved true). Also test unknown tier fallback → `INIT_PROJECT`.
6. **Execution — task lifecycle group** (~13 tests): `CREATE_TASK_HANDOFF` (not_started, no handoff), `EXECUTE_TASK` (not_started, has handoff), `UPDATE_STATE_FROM_TASK` (in_progress), `HALT_TASK_FAILED` (failed + critical), `HALT_TASK_FAILED` (failed + retries exhausted), `CREATE_CORRECTIVE_HANDOFF` (failed + minor + retries available), `SPAWN_CODE_REVIEWER` (complete, no review_doc, no verdict), `TRIAGE_TASK` (complete, review_doc exists, verdict null), `ADVANCE_TASK` (complete, verdict approved, gate mode autonomous), `GATE_TASK` (complete, verdict approved, gate mode task), `RETRY_FROM_REVIEW` (complete, verdict changes_requested), `HALT_FROM_REVIEW` (complete, verdict rejected), `DISPLAY_HALTED` (task status halted).
7. **Execution — phase lifecycle group** (~8 tests): `CREATE_PHASE_PLAN` (phase not_started), `GENERATE_PHASE_REPORT` (all tasks done, no phase_report), `SPAWN_PHASE_REVIEWER` (phase_report exists, no phase_review), `TRIAGE_PHASE` (phase_review exists, verdict null), `DISPLAY_HALTED` (phase_review_action halted), `CREATE_PHASE_PLAN` (phase_review_action corrective_tasks_issued), `GATE_PHASE` (verdict approved, gate mode phase), `ADVANCE_PHASE` (verdict approved, gate mode autonomous), `TRANSITION_TO_REVIEW` (current_phase >= phases.length).
8. **Review tier group** (~3 tests): `SPAWN_FINAL_REVIEWER` (final_review.status not complete), `REQUEST_FINAL_APPROVAL` (final_review complete, not human_approved), `TRANSITION_TO_COMPLETE` (final_review complete and human_approved).
9. **Config override group** (~2 tests): Verify `resolveHumanGateMode` uses `config.human_gates.execution_mode` when provided, and falls back to `state.pipeline.human_gate_mode` when config is omitted or missing that field.
10. **Run all tests** with `node tests/resolver.test.js` — verify exit code 0.

## Contracts & Interfaces

### `resolveNextAction` signature

```javascript
/**
 * @param {StateJson|null|undefined} state - Parsed state.json object (null/undefined → init_project)
 * @param {OrchestratorConfig} [config] - Parsed orchestration.yml (optional)
 * @returns {NextActionResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### `NextActionResult` shape

```javascript
{
  action: string,       // NEXT_ACTIONS enum value
  context: {
    tier: string|null,        // PIPELINE_TIERS enum value or null
    phase_index: number|null, // 0-based index
    task_index: number|null,  // 0-based index
    phase_id: string|null,    // e.g. "P01"
    task_id: string|null,     // e.g. "P01-T03"
    details: string           // explanation of resolution path
  }
}
```

### `OrchestratorConfig` shape (for config-override tests)

```javascript
{
  human_gates: {
    execution_mode: 'ask' | 'phase' | 'task' | 'autonomous'
  },
  projects: {
    base_path: '.github/projects/'
  }
}
```

### Complete `NEXT_ACTIONS` enum (all 35 values — 31 produced by resolver)

```javascript
const NEXT_ACTIONS = Object.freeze({
  INIT_PROJECT: 'init_project',
  DISPLAY_HALTED: 'display_halted',
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  TRANSITION_TO_EXECUTION: 'transition_to_execution',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  UPDATE_STATE_FROM_TASK: 'update_state_from_task',
  CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
  HALT_TASK_FAILED: 'halt_task_failed',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
  TRIAGE_TASK: 'triage_task',
  HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
  RETRY_FROM_REVIEW: 'retry_from_review',
  HALT_FROM_REVIEW: 'halt_from_review',
  ADVANCE_TASK: 'advance_task',
  GATE_TASK: 'gate_task',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
  TRIAGE_PHASE: 'triage_phase',
  HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
  GATE_PHASE: 'gate_phase',
  ADVANCE_PHASE: 'advance_phase',
  TRANSITION_TO_REVIEW: 'transition_to_review',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  TRANSITION_TO_COMPLETE: 'transition_to_complete',
  DISPLAY_COMPLETE: 'display_complete'
});
```

The 4 Orchestrator-managed values NOT produced by the resolver (but exist in the enum): `UPDATE_STATE_FROM_REVIEW`, `UPDATE_STATE_FROM_PHASE_REVIEW`, `HALT_TRIAGE_INVARIANT`, `HALT_PHASE_TRIAGE_INVARIANT`. These are managed by the Orchestrator's runtime `triage_attempts` counter.

### Other required enums (from `src/lib/constants.js`)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review',
  COMPLETE: 'complete', HALTED: 'halted'
});

const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete', FAILED: 'failed', SKIPPED: 'skipped'
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted'
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted'
});

const SEVERITY_LEVELS = Object.freeze({
  MINOR: 'minor', CRITICAL: 'critical'
});

const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask', PHASE: 'phase', TASK: 'task', AUTONOMOUS: 'autonomous'
});
```

### Resolution paths by tier (complete reference)

**Tier 0 — Setup / Terminal:**
| ID | Triggering state | Expected action |
|----|------------------|-----------------|
| S1 | `state == null` or `state == undefined` | `INIT_PROJECT` |
| S2 | `pipeline.current_tier === 'halted'` | `DISPLAY_HALTED` |
| S3 | `pipeline.current_tier === 'complete'` | `DISPLAY_COMPLETE` |
| S4 | `pipeline.current_tier` is unknown string (e.g., `'garbage'`) | `INIT_PROJECT` |

**Tier 1 — Planning (evaluated in step order: research → prd → design → architecture → master_plan):**
| ID | Triggering state | Expected action |
|----|------------------|-----------------|
| PL1 | `planning.steps.research.status !== 'complete'` | `SPAWN_RESEARCH` |
| PL2 | research complete, `prd.status !== 'complete'` | `SPAWN_PRD` |
| PL3 | research+prd complete, `design.status !== 'complete'` | `SPAWN_DESIGN` |
| PL4 | research+prd+design complete, `architecture.status !== 'complete'` | `SPAWN_ARCHITECTURE` |
| PL5 | all 4 complete, `master_plan.status !== 'complete'` | `SPAWN_MASTER_PLAN` |
| PL6 | all 5 complete, `planning.human_approved === false` | `REQUEST_PLAN_APPROVAL` |
| PL7 | all 5 complete, `planning.human_approved === true` | `TRANSITION_TO_EXECUTION` |

**Tier 2a — Execution: Task Lifecycle:**
| ID | Triggering state | Expected action |
|----|------------------|-----------------|
| T1 | `task.status === 'not_started'`, `task.handoff_doc === null` | `CREATE_TASK_HANDOFF` |
| T2 | `task.status === 'not_started'`, `task.handoff_doc !== null` | `EXECUTE_TASK` |
| T3 | `task.status === 'in_progress'` | `UPDATE_STATE_FROM_TASK` |
| T4 | `task.status === 'failed'`, `task.severity === 'critical'` | `HALT_TASK_FAILED` |
| T5 | `task.status === 'failed'`, `task.retries >= limits.max_retries_per_task` | `HALT_TASK_FAILED` |
| T6 | `task.status === 'failed'`, `task.severity !== 'critical'`, retries < max | `CREATE_CORRECTIVE_HANDOFF` |
| T7 | `task.status === 'complete'`, `task.review_verdict === 'approved'`, gate mode !== `'task'` | `ADVANCE_TASK` |
| T8 | `task.status === 'complete'`, `task.review_verdict === 'approved'`, gate mode === `'task'` | `GATE_TASK` |
| T9 | `task.status === 'complete'`, `task.review_verdict === 'changes_requested'` | `RETRY_FROM_REVIEW` |
| T10 | `task.status === 'complete'`, `task.review_verdict === 'rejected'` | `HALT_FROM_REVIEW` |
| T11 | `task.status === 'complete'`, `task.review_doc !== null`, `task.review_verdict === null` | `TRIAGE_TASK` |
| T12 | `task.status === 'complete'`, `task.review_doc === null`, `task.review_verdict === null` | `SPAWN_CODE_REVIEWER` |
| T13 | `task.status === 'halted'` | `DISPLAY_HALTED` |

**Tier 2b — Execution: Phase Lifecycle (entered when `phase.current_task >= phase.tasks.length`):**
| ID | Triggering state | Expected action |
|----|------------------|-----------------|
| E1 | `current_phase >= phases.length` (all phases done) | `TRANSITION_TO_REVIEW` |
| E2 | `phase.status === 'not_started'` | `CREATE_PHASE_PLAN` |
| P1 | phase tasks all processed, `phase.phase_report === null` | `GENERATE_PHASE_REPORT` |
| P2 | `phase.phase_report` exists, `phase.phase_review === null` | `SPAWN_PHASE_REVIEWER` |
| P3 | `phase.phase_review !== null`, `phase.phase_review_verdict === null` | `TRIAGE_PHASE` |
| P4 | `phase.phase_review_action === 'halted'` | `DISPLAY_HALTED` |
| P5 | `phase.phase_review_action === 'corrective_tasks_issued'` | `CREATE_PHASE_PLAN` |
| P6 | `phase.phase_review_verdict === 'approved'`, gate mode === `'phase'` | `GATE_PHASE` |
| P7 | `phase.phase_review_verdict === 'approved'`, gate mode !== `'phase'` | `ADVANCE_PHASE` |

**Tier 3 — Review:**
| ID | Triggering state | Expected action |
|----|------------------|-----------------|
| R1 | `final_review.status !== 'complete'` | `SPAWN_FINAL_REVIEWER` |
| R2 | `final_review.status === 'complete'`, `final_review.human_approved === false` | `REQUEST_FINAL_APPROVAL` |
| R3 | `final_review.status === 'complete'`, `final_review.human_approved === true` | `TRANSITION_TO_COMPLETE` |

### `makeBaseState()` helper template

```javascript
function makeBaseState() {
  return {
    project: {
      name: 'TEST-PROJECT',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T12:00:00Z'
    },
    pipeline: {
      current_tier: 'execution',
      human_gate_mode: 'autonomous'
    },
    planning: {
      status: 'complete',
      steps: {
        research:      { status: 'complete', output: 'RESEARCH.md' },
        prd:           { status: 'complete', output: 'PRD.md' },
        design:        { status: 'complete', output: 'DESIGN.md' },
        architecture:  { status: 'complete', output: 'ARCHITECTURE.md' },
        master_plan:   { status: 'complete', output: 'MASTER-PLAN.md' }
      },
      human_approved: true
    },
    execution: {
      status: 'in_progress',
      current_phase: 0,
      total_phases: 1,
      phases: [{
        phase_number: 1,
        title: 'Phase One',
        status: 'in_progress',
        phase_doc: 'phases/PHASE-01.md',
        current_task: 0,
        total_tasks: 2,
        tasks: [
          {
            task_number: 1, title: 'Task One',
            status: 'not_started', handoff_doc: null,
            report_doc: null, retries: 0,
            last_error: null, severity: null,
            review_doc: null, review_verdict: null, review_action: null
          },
          {
            task_number: 2, title: 'Task Two',
            status: 'not_started', handoff_doc: null,
            report_doc: null, retries: 0,
            last_error: null, severity: null,
            review_doc: null, review_verdict: null, review_action: null
          }
        ],
        phase_report: null,
        human_approved: false,
        phase_review: null,
        phase_review_verdict: null,
        phase_review_action: null
      }]
    },
    final_review: {
      status: 'not_started',
      report_doc: null,
      human_approved: false
    },
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 }
  };
}
```

## Styles & Design Tokens

N/A — pure logic module with no UI.

## Test Requirements

- [ ] Every `NEXT_ACTIONS` enum value produced by the resolver (~31 values) has at least one dedicated test
- [ ] Tests for the 4 Orchestrator-managed values (`UPDATE_STATE_FROM_REVIEW`, `UPDATE_STATE_FROM_PHASE_REVIEW`, `HALT_TRIAGE_INVARIANT`, `HALT_PHASE_TRIAGE_INVARIANT`) confirm they are NOT produced by any state (optional — these are excluded by design)
- [ ] Each test constructs a minimal state via `makeBaseState()` + targeted mutations, calls `resolveNextAction(state)`, and asserts `result.action === NEXT_ACTIONS.<VALUE>`
- [ ] Config override tests verify `config.human_gates.execution_mode` takes precedence over `state.pipeline.human_gate_mode`
- [ ] Config fallback test verifies `state.pipeline.human_gate_mode` is used when config is omitted
- [ ] `node tests/resolver.test.js` exits with code 0

## Acceptance Criteria

- [ ] File `tests/resolver.test.js` exists and is valid JavaScript (`node -c` exits 0)
- [ ] Every `NEXT_ACTIONS` value produced by `resolveNextAction` has at least one test
- [ ] `node tests/resolver.test.js` exits with code 0 — all tests pass
- [ ] Tests import `resolveNextAction` directly via `require('../src/lib/resolver.js')` — no subprocess spawning
- [ ] Tests use `node:test` framework (`describe`/`it` from `require('node:test')`)
- [ ] Tests use `makeBaseState()` helper (consistent with Phase 1 test convention)
- [ ] No filesystem access in tests — state objects are constructed in-memory
- [ ] No regressions: `node tests/constants.test.js` and `node tests/state-validator.test.js` still pass
- [ ] All tests pass
- [ ] Build succeeds

## Constraints

- Do NOT modify `src/lib/resolver.js` — this is a test-only task
- Do NOT modify `src/lib/constants.js`
- Do NOT modify any existing test files
- Do NOT use subprocess spawning (`child_process`) — import the function directly
- Do NOT introduce any npm dependencies — use only Node.js built-ins (`node:test`, `node:assert`)
- Do NOT add filesystem access in tests — construct all state objects in-memory
- Use `'use strict'` at the top of the file
