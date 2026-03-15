---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 3
title: "Documentation Fix — Invariant Descriptions"
status: "pending"
skills_required: ["coder"]
skills_optional: []
estimated_files: 1
corrective: true
---

# Documentation Fix — Invariant Descriptions

## Objective

Fix the 4 incorrect invariant descriptions (V5, V6, V7, V10) in `docs/validation.md` to match the actual v3 `validator.js` implementation, and verify the remaining 7 invariants (V1–V4, V11–V13) are also accurate.

## Context

The previous task updated `docs/validation.md` to remove v2 invariants (V8/V9/V14/V15) and update the catalog heading and count. However, the descriptions for V5, V6, V7, and V10 were copied from the task handoff's provided table instead of being verified against the actual source code in `.github/orchestration/scripts/lib/validator.js`. The code review found all four descriptions are wrong — they describe invariants that don't exist in v3 (e.g., "single active task", "retry limit", "schema version").

## Issues from Code Review

These are the issues that triggered this corrective task (from `CODE-REVIEW-P04-T03.md`):

| # | Severity | Issue |
|---|----------|-------|
| 1 | minor | **V5, V6, V7, V10 invariant descriptions do not match actual v3 code.** V5 says "Human approval gate" (actual: config limits check), V6 says "Single active task" (actual: execution tier gate), V7 says "Retry limit" (actual: final review gate), V10 says "Schema version" (actual: phase-tier consistency). |

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/validation.md` | Fix 4 invariant rows in the catalog table (lines ~153–156); verify other 7 rows |

## Implementation Steps

1. **Read the source of truth**: Open `.github/orchestration/scripts/lib/validator.js` and read the JSDoc comments and implementations for `checkV5`, `checkV6`, `checkV7`, and `checkV10`.

2. **Fix V5 row** (line ~153): Replace the current row with:
   ```
   | V5 | Config limits | Proposed-only | `phases.length` must not exceed `config.limits.max_phases`; each phase's `tasks.length` must not exceed `config.limits.max_tasks_per_phase` |
   ```

3. **Fix V6 row** (line ~154): Replace the current row with:
   ```
   | V6 | Execution tier gate | Proposed-only | Execution tier requires `planning.human_approved` to be `true` |
   ```

4. **Fix V7 row** (line ~155): Replace the current row with:
   ```
   | V7 | Final review gate | Proposed-only | Complete tier with `after_final_review` gate enabled requires `planning.human_approved` to be `true` |
   ```

5. **Fix V10 row** (line ~156): Replace the current row with:
   ```
   | V10 | Phase-tier consistency | Proposed-only | Active phase status must be consistent with `current_tier` (e.g., no `in_progress` phase during planning tier; all phases `complete` or `halted` during review/complete tier) |
   ```

6. **Verify V1–V4**: Read `checkV1` through `checkV4` in `validator.js` and confirm the existing descriptions in `docs/validation.md` are accurate. Current descriptions:
   - V1: Phase index bounds — `current_phase` must be a valid index into `execution.phases[]` (0 when empty)
   - V2: Task index bounds — Each phase's `current_task` must be a valid index into its `tasks[]` (0 when empty, may equal length when all complete)
   - V3: Phase count match — `total_phases` matches `phases.length`
   - V4: Task count match — `total_tasks` matches `tasks.length` per phase

7. **Verify V11–V13**: Read `checkV11`, `checkV12`, `checkV13` in `validator.js` and confirm the existing descriptions are accurate. Pay special attention to V12 — the code checks **both phase and task** status transitions, but the current docs only mention "Task status transitions". If V12's name or description is incomplete, fix it to reflect that both phase and task transitions are validated.

8. **Verify the "Valid Task Status Transitions (V12)" subsection** below the table — confirm the transition diagram is still accurate, and if V12 also covers phase transitions, add a note or separate diagram for phase transitions.

## Contracts & Interfaces

### Actual v3 Invariant Implementations (from `validator.js`)

```javascript
/** V5 — phases and tasks within config limits */
function checkV5(proposed, config) {
  const errors = [];
  const { phases } = proposed.execution;
  if (phases.length > config.limits.max_phases) {
    errors.push(makeError('V5', `phases.length ${phases.length} exceeds max_phases ${config.limits.max_phases}`, 'execution.phases.length'));
  }
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].tasks.length > config.limits.max_tasks_per_phase) {
      errors.push(makeError('V5', `phase[${i}].tasks.length ${phases[i].tasks.length} exceeds max_tasks_per_phase ${config.limits.max_tasks_per_phase}`, `execution.phases[${i}].tasks.length`));
    }
  }
  return errors;
}

/** V6 — execution tier requires human_approved */
function checkV6(proposed) {
  if (proposed.execution.current_tier === PIPELINE_TIERS.EXECUTION && !proposed.planning.human_approved) {
    return [makeError('V6', 'execution tier requires planning.human_approved to be true', 'planning.human_approved')];
  }
  return [];
}

/** V7 — complete tier with after_final_review gate requires human_approved */
function checkV7(proposed, config) {
  if (
    proposed.execution.current_tier === PIPELINE_TIERS.COMPLETE &&
    config.human_gates.after_final_review === true &&
    !proposed.planning.human_approved
  ) {
    return [makeError('V7', 'complete tier with after_final_review gate requires planning.human_approved to be true', 'planning.human_approved')];
  }
  return [];
}

/** V10 — phase status consistency with current_tier */
function checkV10(proposed) {
  const errors = [];
  const { current_tier, current_phase, phases } = proposed.execution;

  if (current_tier === PIPELINE_TIERS.EXECUTION) {
    if (current_phase >= 0 && current_phase < phases.length) {
      const status = phases[current_phase].status;
      if (status !== PHASE_STATUSES.NOT_STARTED && status !== PHASE_STATUSES.IN_PROGRESS) {
        errors.push(makeError('V10', `active phase status '${status}' invalid during execution tier`, `execution.phases[${current_phase}].status`));
      }
    }
  } else if (current_tier === PIPELINE_TIERS.PLANNING) {
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].status === PHASE_STATUSES.IN_PROGRESS) {
        errors.push(makeError('V10', `phase[${i}] is in_progress during planning tier`, `execution.phases[${i}].status`));
      }
    }
  } else if (current_tier === PIPELINE_TIERS.REVIEW || current_tier === PIPELINE_TIERS.COMPLETE) {
    for (let i = 0; i < phases.length; i++) {
      const s = phases[i].status;
      if (s !== PHASE_STATUSES.COMPLETE && s !== PHASE_STATUSES.HALTED) {
        errors.push(makeError('V10', `phase[${i}] status '${s}' must be complete or halted during ${current_tier} tier`, `execution.phases[${i}].status`));
      }
    }
  }

  return errors;
}
```

### V12 Implementation (verify phase + task transitions)

```javascript
/** V12 — status transitions must follow allowed maps */
function checkV12(current, proposed) {
  const errors = [];
  const curPhases = current.execution.phases;
  const propPhases = proposed.execution.phases;
  const pLen = Math.min(curPhases.length, propPhases.length);

  for (let p = 0; p < pLen; p++) {
    // Phase transitions
    const fromPhase = curPhases[p].status;
    const toPhase = propPhases[p].status;
    if (fromPhase !== toPhase) {
      const allowed = ALLOWED_PHASE_TRANSITIONS[fromPhase];
      if (!allowed || !allowed.includes(toPhase)) {
        errors.push(makeError('V12', `phase[${p}] transition '${fromPhase}' → '${toPhase}' not allowed`, ...));
      }
    }

    // Task transitions
    const curTasks = curPhases[p].tasks;
    const propTasks = propPhases[p].tasks;
    for (let t = 0; t < tLen; t++) {
      const fromTask = curTasks[t].status;
      const toTask = propTasks[t].status;
      if (fromTask !== toTask) {
        const allowed = ALLOWED_TASK_TRANSITIONS[fromTask];
        if (!allowed || !allowed.includes(toTask)) {
          errors.push(makeError('V12', `task[${p}][${t}] transition '${fromTask}' → '${toTask}' not allowed`, ...));
        }
      }
    }
  }
  return errors;
}
```

Note: The current docs call V12 "Task status transitions" but the code validates **both** phase and task transitions. Update the name and description if they are incomplete.

## Styles & Design Tokens

N/A — documentation-only task.

## Test Requirements

- [ ] Grep `docs/validation.md` for "Human approval gate" — 0 matches expected (V5 is now "Config limits")
- [ ] Grep `docs/validation.md` for "Single active task" — 0 matches expected (V6 is now "Execution tier gate")
- [ ] Grep `docs/validation.md` for "Retry limit" — 0 matches expected (V7 is now "Final review gate")
- [ ] Grep `docs/validation.md` for "Schema version" — 0 matches expected (V10 is now "Phase-tier consistency")
- [ ] Each of the 11 invariant rows (V1–V7, V10–V13) has a description that matches the actual `validator.js` implementation

## Acceptance Criteria

- [ ] V5 row in `docs/validation.md` describes config limits check (`max_phases`, `max_tasks_per_phase`) — matches `checkV5` in `validator.js`
- [ ] V6 row describes execution tier gate (requires `planning.human_approved`) — matches `checkV6`
- [ ] V7 row describes final review gate (complete tier + `after_final_review` gate) — matches `checkV7`
- [ ] V10 row describes phase-tier consistency (phase status vs `current_tier`) — matches `checkV10`
- [ ] V1–V4, V11–V13 descriptions verified accurate against `validator.js` (fix any that are wrong)
- [ ] V12 name and description correctly reflect that both phase AND task transitions are validated (not just tasks)
- [ ] No other changes to the invariant catalog structure (heading, count, check types remain the same)
- [ ] File is valid Markdown with no syntax errors

## Constraints

- Modify ONLY `docs/validation.md` — no other files
- Do NOT change the invariant catalog structure (heading, column layout, V1–V7/V10–V13 range)
- Do NOT change the `validateTransition` signature, prose, or code block above the table — those are already correct
- Do NOT touch any source code files
- Read `validator.js` as the sole source of truth — do not rely on descriptions from any other document
