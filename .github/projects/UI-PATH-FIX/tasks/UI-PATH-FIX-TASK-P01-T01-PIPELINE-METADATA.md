---
project: "UI-PATH-FIX"
phase: 1
task: 1
title: "Pipeline Metadata & Path Helper"
status: "pending"
skills_required: []
skills_optional: ["run-tests"]
estimated_files: 1
---

# Pipeline Metadata & Path Helper

## Objective

Populate missing metadata fields (`phase_number`, `title`, `total_tasks`) on phase objects in `handlePlanApproved`, populate missing metadata fields (`task_number`, `last_error`, `severity`) on task objects in `handlePhasePlanCreated`, and add a new exported `normalizeDocPath` path-normalization utility function to `mutations.js`.

## Context

The file `.github/orchestration/scripts/lib/mutations.js` contains all pipeline state-mutation handlers. Currently, `handlePlanApproved` initializes phase objects without `phase_number`, `title`, or `total_tasks`, causing the UI to render "Phase undefined". Similarly, `handlePhasePlanCreated` initializes task objects without `task_number`, `last_error`, or `severity`. A new `normalizeDocPath` helper is also needed to strip workspace-relative path prefixes (e.g., `.github/projects/PROJ/tasks/FILE.md` → `tasks/FILE.md`); this helper will be consumed by Task T02 in `pipeline-engine.js`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/mutations.js` | Add metadata fields to two handlers; add `normalizeDocPath` helper; update `module.exports` |

## Implementation Steps

1. **Locate `handlePlanApproved`** (Handler 6, ~line 90). Inside the `for` loop that pushes phase objects to `state.execution.phases`, add three new fields to each phase object: `phase_number: i + 1`, `title: context.phases?.[i]?.title ?? 'Phase ' + (i + 1)`, and `total_tasks: 0`. Place them at the top of the object literal, before the existing `status` field.

2. **Update `handlePlanApproved` mutations_applied**: Add entries to the `mutations_applied` array for the new fields so that logging reflects the changes.

3. **Locate `handlePhasePlanCreated`** (Handler 8, ~line 121). Inside the `context.tasks.map()` callback that creates task objects, add three new fields: `task_number: t.task_number ?? (idx + 1)` (note: the `.map()` callback currently receives only `t` — add `idx` as the second parameter), `last_error: null`, and `severity: null`. Place them after the existing `title` field and before `status`.

4. **Add the `.map()` index parameter**: Change `context.tasks.map(t => ({` to `context.tasks.map((t, idx) => ({` so the 1-indexed `task_number` fallback works.

5. **Add `normalizeDocPath` function**: Create a new function in the Helpers section (after the existing `currentTask` helper, before the Planning Handlers section). The function takes three parameters: `docPath`, `basePath`, `projectName`. See the exact contract in the Contracts section below.

6. **Export `normalizeDocPath`**: Update the `module.exports` line at the bottom of the file to include `normalizeDocPath`. Change from:
   ```javascript
   module.exports = { MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage };
   ```
   to:
   ```javascript
   module.exports = { MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage, normalizeDocPath };
   ```

7. **Verify no other code is affected**: The changes are additive — no existing fields are removed or renamed. No function signatures change (both handlers still take `(state, context)`). The new `normalizeDocPath` function is standalone and does not call any other function in the file.

## Contracts & Interfaces

### Contract 1: Phase Object Shape (after fix)

Each phase object pushed in `handlePlanApproved` must conform to this shape:

```javascript
// .github/orchestration/scripts/lib/mutations.js — handlePlanApproved
// Each phase object pushed to state.execution.phases:
{
  phase_number: i + 1,                                    // NEW — 1-indexed integer
  title: context.phases?.[i]?.title ?? `Phase ${i + 1}`,  // NEW — from context or fallback
  status: 'not_started',
  total_tasks: 0,                                          // NEW — initialized to 0
  tasks: [],
  current_task: 0,
  phase_doc: null,
  phase_report: null,
  phase_review: null,
  phase_review_verdict: null,
  phase_review_action: null,
  triage_attempts: 0,
  human_approved: false
}
```

Use the `PHASE_STATUSES.NOT_STARTED` constant for `status` (already used in the current code).

### Contract 2: Task Object Shape (after fix)

Each task object in the `.map()` inside `handlePhasePlanCreated` must conform to this shape:

```javascript
// .github/orchestration/scripts/lib/mutations.js — handlePhasePlanCreated
// Each task object in phase.tasks:
{
  id: t.id,
  title: t.title,
  task_number: t.task_number ?? idx + 1,  // NEW — from context or 1-indexed position
  status: 'not_started',
  retries: 0,
  last_error: null,                        // NEW — explicit initialization
  severity: null,                          // NEW — explicit initialization
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null
}
```

Use the `TASK_STATUSES.NOT_STARTED` constant for `status` (already used in the current code).

### Contract 3: `normalizeDocPath` Function

```javascript
/**
 * Strip workspace-relative prefix from a document path, returning project-relative.
 * Idempotent: already project-relative paths pass through unchanged.
 *
 * @param {string|null|undefined} docPath - Document path from context
 * @param {string} basePath - From orchestration.yml projects.base_path (e.g., ".github/projects")
 * @param {string} projectName - Project name (e.g., "RAINBOW-HELLO")
 * @returns {string|null|undefined} Project-relative path, or null/undefined if input was null/undefined
 */
function normalizeDocPath(docPath, basePath, projectName) { ... }
```

**Behavior table:**

| Input `docPath` | `basePath` | `projectName` | Output |
|-----------------|-----------|---------------|--------|
| `.github/projects/PROJ/tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `.github/projects/PROJ/PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `null` | any | any | `null` |
| `undefined` | any | any | `undefined` |
| `''` | any | any | `''` |

**Implementation logic:**
1. If `docPath` is falsy (null, undefined, empty string), return it as-is
2. Construct `prefix` as `basePath + '/' + projectName + '/'` (forward slashes)
3. If `docPath.startsWith(prefix)`, return `docPath.slice(prefix.length)`
4. Otherwise return `docPath` unchanged

This makes the function idempotent — applying it to an already project-relative path is a no-op because project-relative paths like `tasks/FILE.md` will never start with `.github/projects/PROJ/`.

## Styles & Design Tokens

Not applicable — this is a backend/pipeline JavaScript file with no UI or styling.

## Test Requirements

- [ ] After `handlePlanApproved` executes with `context = { total_phases: 3, phases: [{ title: 'Setup' }, { title: 'Core' }, { title: 'Polish' }] }`, each phase in `state.execution.phases` has `phase_number` set to 1, 2, 3 respectively, `title` set to 'Setup', 'Core', 'Polish' respectively, and `total_tasks` set to 0
- [ ] After `handlePlanApproved` executes with `context = { total_phases: 2 }` (no `phases` array), each phase has `title` set to `'Phase 1'`, `'Phase 2'` (fallback)
- [ ] After `handlePhasePlanCreated` executes with tasks `[{ id: 'T01', title: 'Foo' }, { id: 'T02', title: 'Bar', task_number: 5 }]`, the first task has `task_number: 1` (fallback), `last_error: null`, `severity: null`; the second task has `task_number: 5` (from context), `last_error: null`, `severity: null`
- [ ] `normalizeDocPath('.github/projects/PROJ/tasks/FILE.md', '.github/projects', 'PROJ')` returns `'tasks/FILE.md'`
- [ ] `normalizeDocPath('tasks/FILE.md', '.github/projects', 'PROJ')` returns `'tasks/FILE.md'` (idempotent)
- [ ] `normalizeDocPath('PROJ-PRD.md', '.github/projects', 'PROJ')` returns `'PROJ-PRD.md'` (root-level file)
- [ ] `normalizeDocPath(null, '.github/projects', 'PROJ')` returns `null`
- [ ] `normalizeDocPath(undefined, '.github/projects', 'PROJ')` returns `undefined`
- [ ] `normalizeDocPath('', '.github/projects', 'PROJ')` returns `''`

## Acceptance Criteria

- [ ] Phase objects include `phase_number` (1-indexed integer), `title` (string), and `total_tasks: 0` after `handlePlanApproved` executes
- [ ] `title` falls back to `'Phase ' + (i + 1)` when `context.phases` is absent or the entry is missing
- [ ] Task objects include `task_number` (from `t.task_number` or 1-indexed position), `last_error: null`, and `severity: null` after `handlePhasePlanCreated` executes
- [ ] `normalizeDocPath` strips the `{basePath}/{projectName}/` prefix when present
- [ ] `normalizeDocPath` passes through `null`, `undefined`, and empty string without throwing
- [ ] `normalizeDocPath` is idempotent — already project-relative paths pass through unchanged
- [ ] `normalizeDocPath` is exported from `mutations.js` via `module.exports`
- [ ] No existing fields are removed or renamed in either handler
- [ ] No existing function signatures are changed
- [ ] No existing tests break (if any exist)

## Constraints

- Do NOT modify any file other than `.github/orchestration/scripts/lib/mutations.js`
- Do NOT change the signature of `handlePlanApproved(state, context)` or `handlePhasePlanCreated(state, context)`
- Do NOT modify `pipeline-engine.js` — that is Task T02's scope
- Do NOT call `normalizeDocPath` inside any mutation handler — Task T02 will add the centralized call in `pipeline-engine.js`
- Do NOT add any new `require()` imports — the function uses only built-in string operations
- Do NOT remove or rename any existing fields in the phase or task objects
- Do NOT modify the `MUTATIONS` record, `getMutation`, `needsTriage`, `applyTaskTriage`, or `applyPhaseTriage` functions
- Use existing code style: `'use strict'`, JSDoc comments, section divider comments (`// ─── Section ───`)

## Reference: Current File Content

Below is the complete current content of `.github/orchestration/scripts/lib/mutations.js` (516 lines). Use this as the base for your modifications:

```javascript
'use strict';

const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS
} = require('./constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generic planning step completion handler.
 * @param {Object} state
 * @param {string} stepKey - One of: 'research', 'prd', 'design', 'architecture', 'master_plan'
 * @param {string} docPath - Path to the output document
 * @returns {MutationResult}
 */
function completePlanningStep(state, stepKey, docPath) {
  state.planning.steps[stepKey].status = PLANNING_STEP_STATUSES.COMPLETE;
  state.planning.steps[stepKey].output = docPath;
  return {
    state,
    mutations_applied: [
      `planning.steps.${stepKey}.status → complete`,
      `planning.steps.${stepKey}.output → ${docPath}`
    ]
  };
}

/**
 * Get the current phase object from state.
 * @param {Object} state
 * @returns {Object} Current phase
 */
function currentPhase(state) {
  return state.execution.phases[state.execution.current_phase];
}

/**
 * Get the current task object from the current phase.
 * @param {Object} state
 * @returns {Object} Current task
 */
function currentTask(state) {
  const phase = currentPhase(state);
  return phase.tasks[phase.current_task];
}

// ─── Planning Handlers ──────────────────────────────────────────────────────

/**
 * @typedef {Object} MutationResult
 * @property {Object} state - The mutated state object (same reference passed in, modified in place)
 * @property {string[]} mutations_applied - Human-readable list of mutations applied
 */

/** Handler 1 */
function handleResearchCompleted(state, context) {
  return completePlanningStep(state, 'research', context.doc_path);
}

/** Handler 2 */
function handlePrdCompleted(state, context) {
  return completePlanningStep(state, 'prd', context.doc_path);
}

/** Handler 3 */
function handleDesignCompleted(state, context) {
  return completePlanningStep(state, 'design', context.doc_path);
}

/** Handler 4 */
function handleArchitectureCompleted(state, context) {
  return completePlanningStep(state, 'architecture', context.doc_path);
}

/** Handler 5 */
function handleMasterPlanCompleted(state, context) {
  const result = completePlanningStep(state, 'master_plan', context.doc_path);
  state.planning.status = PLANNING_STATUSES.COMPLETE;
  result.mutations_applied.push('planning.status → complete');
  return result;
}

// ─── Plan Approval Handlers ─────────────────────────────────────────────────

/** Handler 6 */
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  state.execution.total_phases = context.total_phases;
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      status: PHASE_STATUSES.NOT_STARTED,
      tasks: [],
      current_task: 0,
      phase_doc: null,
      phase_report: null,
      phase_review: null,
      phase_review_verdict: null,
      phase_review_action: null,
      triage_attempts: 0,
      human_approved: false
    });
  }
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress',
      `execution.total_phases → ${context.total_phases}`,
      `execution.phases → [${context.total_phases} phases initialized]`
    ]
  };
}

/** Handler 7 */
function handlePlanRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  state.errors.active_blockers.push('Plan rejected by human');
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      'errors.active_blockers ← Plan rejected by human',
      'errors.total_halts += 1'
    ]
  };
}

// ─── Execution Handlers ─────────────────────────────────────────────────────

/** Handler 8 */
function handlePhasePlanCreated(state, context) {
  const phase = currentPhase(state);
  const mutations = [];

  phase.phase_doc = context.plan_path;
  mutations.push(`phase.phase_doc → ${context.plan_path}`);

  if (phase.status === PHASE_STATUSES.NOT_STARTED) {
    phase.status = PHASE_STATUSES.IN_PROGRESS;
    mutations.push('phase.status → in_progress');
  }

  if (Array.isArray(context.tasks) && context.tasks.length > 0) {
    phase.tasks = context.tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: TASK_STATUSES.NOT_STARTED,
      retries: 0,
      handoff_doc: null,
      report_doc: null,
      review_doc: null,
      review_verdict: null,
      review_action: null
    }));
    phase.total_tasks = context.tasks.length;
    phase.current_task = 0;
    mutations.push(`phase.tasks initialized (${context.tasks.length} tasks)`);
  }

  return { state, mutations_applied: mutations };
}

/** Handler 9 */
function handleTaskHandoffCreated(state, context) {
  const task = currentTask(state);
  const mutations = [];

  task.handoff_doc = context.handoff_path;
  mutations.push(`task.handoff_doc → ${context.handoff_path}`);

  task.status = TASK_STATUSES.IN_PROGRESS;
  mutations.push('task.status → in_progress');

  // Clear review cycle for corrective support
  task.review_doc = null;
  task.review_verdict = null;
  task.review_action = null;
  mutations.push('task review fields cleared (review_doc, review_verdict, review_action → null)');

  return { state, mutations_applied: mutations };
}

/** Handler 10 */
function handleTaskCompleted(state, context) {
  const task = currentTask(state);
  const mutations = [];

  task.report_doc = context.report_path;
  mutations.push(`task.report_doc → ${context.report_path}`);

  if (context.report_severity != null) {
    task.severity = context.report_severity;
    mutations.push(`task.severity → ${context.report_severity}`);
  }

  return { state, mutations_applied: mutations };
}

/** Handler 11 */
function handleCodeReviewCompleted(state, context) {
  const task = currentTask(state);
  task.review_doc = context.review_path;
  return {
    state,
    mutations_applied: [`task.review_doc → ${context.review_path}`]
  };
}

/** Handler 12 */
function handlePhaseReportCreated(state, context) {
  const phase = currentPhase(state);
  phase.phase_report = context.report_path;
  return {
    state,
    mutations_applied: [`phase.phase_report → ${context.report_path}`]
  };
}

/** Handler 13 */
function handlePhaseReviewCompleted(state, context) {
  const phase = currentPhase(state);
  phase.phase_review = context.review_path;
  return {
    state,
    mutations_applied: [`phase.phase_review → ${context.review_path}`]
  };
}

// ─── Gate Handlers ──────────────────────────────────────────────────────────

/** Handler 14 */
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
    mutations.push('phase.status → complete', 'phase.human_approved → true');

    const isLastPhase = (state.execution.current_phase >= state.execution.phases.length - 1);
    if (isLastPhase) {
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      state.execution.status = 'complete';
      mutations.push('pipeline.current_tier → review', 'execution.status → complete');
    } else {
      state.execution.current_phase += 1;
      mutations.push(`execution.current_phase → ${state.execution.current_phase}`);
    }
  }

  state.execution.triage_attempts = 0;
  mutations.push('execution.triage_attempts → 0');

  return { state, mutations_applied: mutations };
}

/** Handler 15 */
function handleGateRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  const msg = 'Gate rejected: ' + (context.gate_type || 'unknown');
  state.errors.active_blockers.push(msg);
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      `errors.active_blockers ← ${msg}`,
      'errors.total_halts += 1'
    ]
  };
}

// ─── Final Review Handlers ──────────────────────────────────────────────────

/** Handler 16 */
function handleFinalReviewCompleted(state, context) {
  state.final_review.report_doc = context.review_path;
  state.final_review.status = 'complete';
  return {
    state,
    mutations_applied: [
      `final_review.report_doc → ${context.review_path}`,
      'final_review.status → complete'
    ]
  };
}

/** Handler 17 */
function handleFinalApproved(state, context) {
  state.final_review.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.COMPLETE;
  return {
    state,
    mutations_applied: [
      'final_review.human_approved → true',
      'pipeline.current_tier → complete'
    ]
  };
}

/** Handler 18 */
function handleFinalRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  state.errors.active_blockers.push('Final review rejected by human');
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      'errors.active_blockers ← Final review rejected by human',
      'errors.total_halts += 1'
    ]
  };
}

// ─── MUTATIONS Record ───────────────────────────────────────────────────────

/** @type {Record<string, (state: Object, context: Object) => MutationResult>} */
const MUTATIONS = {
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  plan_rejected:            handlePlanRejected,
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  gate_approved:            handleGateApproved,
  gate_rejected:            handleGateRejected,
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  final_rejected:           handleFinalRejected
};

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Look up the mutation handler for an event name.
 * @param {string} event - Event name
 * @returns {((state: Object, context: Object) => MutationResult)|undefined}
 */
function getMutation(event) {
  return MUTATIONS[event];
}

/**
 * Determine whether triage should run after this event.
 * @param {string} event - Event name
 * @param {Object} state - Current state (unused currently, reserved for future logic)
 * @returns {{ shouldTriage: boolean, level: 'task'|'phase'|null }}
 */
function needsTriage(event, state) {
  if (event === 'task_completed')          return { shouldTriage: true, level: 'task' };
  if (event === 'code_review_completed')   return { shouldTriage: true, level: 'task' };
  if (event === 'phase_review_completed')  return { shouldTriage: true, level: 'phase' };
  return { shouldTriage: false, level: null };
}

// ─── Triage Helpers ─────────────────────────────────────────────────────────

// ... (applyTaskTriage and applyPhaseTriage — unchanged, not shown for brevity)

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage };
```
