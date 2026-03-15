---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
task: 1
title: "Fix Triage Engine Row 1 + Insert Row 1b + Renumber"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# Fix Triage Engine Row 1 + Insert Row 1b + Renumber

## Objective

Modify the triage engine's task decision table so that clean completed tasks (no deviations, no review) route to code review instead of being auto-approved, add a new Row 1b for completed tasks with deviations but no review, and renumber all subsequent rows (original 2–11 → 3–12) for consistency.

## Context

The triage engine in `triage-engine.js` contains an 11-row first-match-wins decision table evaluated by `triageTask()`. Row 1 currently returns `{ verdict: null, action: null }` for clean completed tasks, which causes the mutation handler to auto-approve them — bypassing code review entirely. There is also no row matching `complete + deviations + no review`, which causes a "No decision table row matched" error. After this fix, the resolver's existing T11 branch (`review_doc === null && review_verdict === null → spawn_code_reviewer`) will become reachable for clean task completions.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/triage-engine.js` | Modify Row 1 return value, insert Row 1b, renumber Rows 2–11 → 3–12 |

## Implementation Steps

1. **Open** `.github/orchestration/scripts/lib/triage-engine.js` and locate the `triageTask` function's decision table, starting at line 151.

2. **Modify Row 1** (lines 151–158): Change the `makeSuccess` third argument from `null` to `'spawn_code_reviewer'`. Update the comment and detail string from "skip triage" to "spawn code reviewer". Do NOT change the condition.

3. **Insert Row 1b** after Row 1's closing brace (after line 158) and before the current Row 2 comment (line 160). Add a new block matching `complete && hasDeviations && !task.review_doc` that returns `makeSuccess` with action `'spawn_code_reviewer'` and row number `2`.

4. **Renumber Row 2 → Row 3** (current lines 160–169): Change `makeSuccess` row number argument from `2` to `3`. Update the comment from `Row 2:` to `Row 3:`. Update the detail string from `'Row 2: ...'` to `'Row 3: ...'`.

5. **Renumber Row 3 → Row 4** (current lines 171–180): Change row number from `3` to `4`. Update comment and detail string accordingly.

6. **Renumber Row 4 → Row 5** (current lines 182–191): Change row number from `4` to `5`. Update comment and detail string accordingly.

7. **Renumber Row 5 → Row 6** (current lines 193–201): Change row number from `5` to `6`. Update comment and detail string accordingly.

8. **Renumber Row 6 → Row 7** (current lines 203–211): Change row number from `6` to `7`. Update comment and detail string accordingly.

9. **Renumber Rows 7–11 → 8–12**: Apply the same pattern to the remaining rows. For Rows 10–11 (the `failed` block), update the comments, row number arguments, and detail strings per the renumbering table below.

10. **Verify** no condition logic was changed on any row — only return values (Row 1), new code (Row 1b), and labels/row numbers (all subsequent rows).

## Contracts & Interfaces

### `makeSuccess` signature (existing — do not modify)

```javascript
// .github/orchestration/scripts/lib/triage-engine.js
function makeSuccess(level, verdict, action, phaseIndex, taskIndex, row, detail) {
  return {
    success: true,
    level,
    verdict,     // REVIEW_VERDICTS value or null
    action,      // REVIEW_ACTIONS value, string, or null
    phase_index: phaseIndex,
    task_index:  taskIndex,
    row,         // numeric row label (used in detail strings and test assertions)
    detail       // descriptive string for logging
  };
}
```

### Constants imported by triage-engine.js (read-only — do not modify)

```javascript
// .github/orchestration/scripts/lib/constants.js (excerpts)
const REVIEW_VERDICTS = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected' };
const REVIEW_ACTIONS  = { ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted' };
const TRIAGE_LEVELS   = { TASK: 'task', PHASE: 'phase' };
```

### Row 1 — BEFORE (lines 151–158)

```javascript
  // ── Row 1: complete, no deviations, no review — skip triage ──
  if (reportStatus === 'complete' && !hasDeviations && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, null,
      phaseIndex, taskIndex, 1,
      'Row 1: complete, no deviations, no review — skip triage'
    );
  }
```

### Row 1 — AFTER

```javascript
  // ── Row 1: complete, no deviations, no review — spawn code reviewer ──
  if (reportStatus === 'complete' && !hasDeviations && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
      phaseIndex, taskIndex, 1,
      'Row 1: complete, no deviations, no review — spawn code reviewer'
    );
  }
```

### New Row 1b — INSERT after Row 1

```javascript
  // ── Row 1b: complete, deviations, no review — spawn code reviewer ──
  if (reportStatus === 'complete' && hasDeviations && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
      phaseIndex, taskIndex, 2,
      'Row 1b: complete, deviations, no review — spawn code reviewer'
    );
  }
```

### Complete Row Renumbering Table

Apply to every row after Row 1b. Update the numbered comment, the `makeSuccess` row number argument, and the detail string for each:

| Original Row | New Row | Original Comment | New Comment | Original Detail String | New Detail String |
|---|---|---|---|---|---|
| Row 1 | Row 1 | `skip triage` | `spawn code reviewer` | `'Row 1: complete, no deviations, no review — skip triage'` | `'Row 1: complete, no deviations, no review — spawn code reviewer'` |
| *(new)* | Row 1b | — | `spawn code reviewer` | — | `'Row 1b: complete, deviations, no review — spawn code reviewer'` |
| Row 2 | Row 3 | `Row 2: complete, no deviations, approved — advance` | `Row 3: complete, no deviations, approved — advance` | `'Row 2: ...'` | `'Row 3: ...'` |
| Row 3 | Row 4 | `Row 3: complete, minor deviations, approved — advance` | `Row 4: complete, minor deviations, approved — advance` | `'Row 3: ...'` | `'Row 4: ...'` |
| Row 4 | Row 5 | `Row 4: complete, architectural deviations, approved — advance` | `Row 5: complete, architectural deviations, approved — advance` | `'Row 4: ...'` | `'Row 5: ...'` |
| Row 5 | Row 6 | `Row 5: complete, changes requested — corrective task` | `Row 6: complete, changes requested — corrective task` | `'Row 5: ...'` | `'Row 6: ...'` |
| Row 6 | Row 7 | `Row 6: complete, rejected — halt` | `Row 7: complete, rejected — halt` | `'Row 6: ...'` | `'Row 7: ...'` |
| Row 7 | Row 8 | `Row 7: partial, no review — skip triage` | `Row 8: partial, no review — skip triage` | `'Row 7: ...'` | `'Row 8: ...'` |
| Row 8 | Row 9 | `Row 8: partial, changes requested — corrective task` | `Row 9: partial, changes requested — corrective task` | `'Row 8: ...'` | `'Row 9: ...'` |
| Row 9 | Row 10 | `Row 9: partial, rejected — halt` | `Row 10: partial, rejected — halt` | `'Row 9: ...'` | `'Row 10: ...'` |
| Row 10 | Row 11 | `Row 10: failed, minor severity, retries available — corrective task` | `Row 11: failed, minor severity, retries available — corrective task` | `'Row 10: ...'` | `'Row 11: ...'` |
| Row 11 | Row 12 | `Row 11: failed, critical severity or retries exhausted — halt` | `Row 12: failed, critical severity or retries exhausted — halt` | `'Row 11: ...'` | `'Row 12: ...'` |

### Full AFTER Code — Decision Table (for reference)

After all changes, the decision table should read:

```javascript
  // ── Row 1: complete, no deviations, no review — spawn code reviewer ──
  if (reportStatus === 'complete' && !hasDeviations && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
      phaseIndex, taskIndex, 1,
      'Row 1: complete, no deviations, no review — spawn code reviewer'
    );
  }

  // ── Row 1b: complete, deviations, no review — spawn code reviewer ──
  if (reportStatus === 'complete' && hasDeviations && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
      phaseIndex, taskIndex, 2,
      'Row 1b: complete, deviations, no review — spawn code reviewer'
    );
  }

  // ── Row 3: complete, no deviations, approved — advance ──
  if (
    reportStatus === 'complete' && !hasDeviations &&
    task.review_doc && verdict === REVIEW_VERDICTS.APPROVED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.APPROVED, REVIEW_ACTIONS.ADVANCED,
      phaseIndex, taskIndex, 3,
      'Row 3: complete, no deviations, approved — advance'
    );
  }

  // ── Row 4: complete, minor deviations, approved — advance ──
  if (
    reportStatus === 'complete' && hasDeviations &&
    deviationType === 'minor' && verdict === REVIEW_VERDICTS.APPROVED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.APPROVED, REVIEW_ACTIONS.ADVANCED,
      phaseIndex, taskIndex, 4,
      'Row 4: complete, minor deviations, approved — advance'
    );
  }

  // ── Row 5: complete, architectural deviations, approved — advance ──
  if (
    reportStatus === 'complete' && hasDeviations &&
    deviationType === 'architectural' && verdict === REVIEW_VERDICTS.APPROVED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.APPROVED, REVIEW_ACTIONS.ADVANCED,
      phaseIndex, taskIndex, 5,
      'Row 5: complete, architectural deviations, approved — advance'
    );
  }

  // ── Row 6: complete, changes requested — corrective task ──
  if (
    reportStatus === 'complete' && task.review_doc &&
    verdict === REVIEW_VERDICTS.CHANGES_REQUESTED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.CHANGES_REQUESTED, REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED,
      phaseIndex, taskIndex, 6,
      'Row 6: complete, changes requested — corrective task'
    );
  }

  // ── Row 7: complete, rejected — halt ──
  if (
    reportStatus === 'complete' && task.review_doc &&
    verdict === REVIEW_VERDICTS.REJECTED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.REJECTED, REVIEW_ACTIONS.HALTED,
      phaseIndex, taskIndex, 7,
      'Row 7: complete, rejected — halt'
    );
  }

  // ── Row 8: partial, no review — skip triage ──
  if (reportStatus === 'partial' && !task.review_doc) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, null, null,
      phaseIndex, taskIndex, 8,
      'Row 8: partial, no review — skip triage'
    );
  }

  // ── Row 9: partial, changes requested — corrective task ──
  if (
    reportStatus === 'partial' && task.review_doc &&
    verdict === REVIEW_VERDICTS.CHANGES_REQUESTED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.CHANGES_REQUESTED, REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED,
      phaseIndex, taskIndex, 9,
      'Row 9: partial, changes requested — corrective task'
    );
  }

  // ── Row 10: partial, rejected — halt ──
  if (
    reportStatus === 'partial' && task.review_doc &&
    verdict === REVIEW_VERDICTS.REJECTED
  ) {
    return makeSuccess(
      TRIAGE_LEVELS.TASK, REVIEW_VERDICTS.REJECTED, REVIEW_ACTIONS.HALTED,
      phaseIndex, taskIndex, 10,
      'Row 10: partial, rejected — halt'
    );
  }

  // ── Rows 11–12: failed — use checkRetryBudget ──
  if (reportStatus === 'failed') {
    const budgetAction = checkRetryBudget(task, state.limits);
    const failedVerdict = task.review_doc ? verdict : null;

    if (budgetAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
      // Row 11: failed, minor severity, retries available — corrective task
      return makeSuccess(
        TRIAGE_LEVELS.TASK, failedVerdict, REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED,
        phaseIndex, taskIndex, 11,
        'Row 11: failed, minor severity, retries available — corrective task'
      );
    }

    // Row 12: failed, critical severity or retries exhausted — halt
    return makeSuccess(
      TRIAGE_LEVELS.TASK, failedVerdict, REVIEW_ACTIONS.HALTED,
      phaseIndex, taskIndex, 12,
      'Row 12: failed, critical severity or retries exhausted — halt'
    );
  }
```

## Styles & Design Tokens

Not applicable — this is a backend logic change with no UI component.

## Test Requirements

- [ ] After the change, calling `triageTask` with a state where `reportStatus === 'complete'`, `hasDeviations === false`, and `task.review_doc === null` returns `{ success: true, verdict: null, action: 'spawn_code_reviewer', row: 1 }`
- [ ] After the change, calling `triageTask` with a state where `reportStatus === 'complete'`, `hasDeviations === true`, and `task.review_doc === null` returns `{ success: true, verdict: null, action: 'spawn_code_reviewer', row: 2 }`
- [ ] Row 8 (partial, no review — formerly Row 7) still returns `{ verdict: null, action: null, row: 8 }`
- [ ] No other row conditions are modified — only Row 1's return value changes, Row 1b is inserted, and all subsequent rows have updated row numbers and detail strings
- [ ] The decision table has exactly 12 rows (original 11 + 1 new) after the change

## Acceptance Criteria

- [ ] Row 1 `makeSuccess` returns `{ verdict: null, action: 'spawn_code_reviewer' }` for `complete + no deviations + no review`
- [ ] Row 1b exists as a new block after Row 1, returning `{ verdict: null, action: 'spawn_code_reviewer' }` for `complete + deviations + no review`
- [ ] Row 1b uses row number `2` in the `makeSuccess` call and detail string `'Row 1b: complete, deviations, no review — spawn code reviewer'`
- [ ] Row 1b appears after Row 1 and before original Row 2 (now Row 3)
- [ ] All subsequent rows (original 2–11) have updated row numbers (3–12) in `makeSuccess` arguments and detail strings
- [ ] All subsequent rows have updated numbered comments matching the new row numbers
- [ ] The `Rows 10–11` section comment is updated to `Rows 11–12`
- [ ] No condition logic changed on any existing row — only return values (Row 1) and labels/numbers (all rows)
- [ ] First-match-wins evaluation order preserved — no shadowed or unreachable rows
- [ ] No new constants added to `constants.js`
- [ ] The string `'spawn_code_reviewer'` is used directly (not a constant) — consistent with how it's used in the resolver

## Constraints

- Do NOT modify any row conditions other than Row 1's return value (third argument to `makeSuccess`)
- Do NOT modify `constants.js` — use the string `'spawn_code_reviewer'` directly for the action argument
- Do NOT modify `mutations.js`, `resolver.js`, `pipeline-engine.js`, or any other file
- Do NOT add new functions, imports, or exports to `triage-engine.js`
- Do NOT modify the `makeSuccess` or `makeError` helper functions
- Do NOT modify the `VALID_VERDICTS` set or the verdict validation logic above the decision table
- Do NOT modify the phase triage function (`triagePhase`) — only `triageTask` is in scope
- Follow the existing pattern: numbered comment (`// ── Row N: ... ──`), `makeSuccess()` with 7 args, descriptive detail string matching the comment
