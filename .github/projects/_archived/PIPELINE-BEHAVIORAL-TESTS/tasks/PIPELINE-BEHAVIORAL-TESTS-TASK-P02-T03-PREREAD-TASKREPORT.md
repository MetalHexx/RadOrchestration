---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
task: 3
title: "Add task_completed Required-Field Validation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Add `task_completed` Required-Field Validation

## Objective

Add required-field validation for `has_deviations` and `deviation_type` in the existing `task_completed` pre-read block of `pipeline-engine.js`, remove the legacy `deviations` fallback chain, and update all existing test mocks that omit `deviation_type` so the test suite stays green.

## Context

The `task_completed` pre-read block in `pipeline-engine.js` already reads the task report document's frontmatter and extracts `status`, `severity`, and `has_deviations`. However, it currently falls back to a legacy `deviations` field when `has_deviations` is absent, and it does not extract `deviation_type` at all. This task adds strict validation: if `has_deviations` or `deviation_type` is absent from the frontmatter, the pipeline returns a structured error result. It also removes the fallback chain and adds `context.report_deviation_type` extraction. The downstream triage engine (T04) will rely on the pipeline pre-read having already validated these fields.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Add required-field validation for `has_deviations` and `deviation_type` in the `task_completed` pre-read block; remove legacy `deviations` fallback; add `context.report_deviation_type` extraction |
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Add `deviation_type` to all existing test mocks that provide task report frontmatter without it; add 2 new tests for missing-field error paths |

## Implementation Steps

1. **Open** `.github/orchestration/scripts/lib/pipeline-engine.js` and locate the `task_completed` pre-read block (the `if (event === 'task_completed' && context.report_path)` block).

2. **Add required-field validation** after the status normalization block and _before_ the `context.report_severity` assignment. Insert validation for `has_deviations` first, then `deviation_type`:

   - If `fm.has_deviations` is `undefined` or `null`, return `makeErrorResult` with the error message `Required frontmatter field 'has_deviations' missing from task report`.
   - If `fm.deviation_type` is `undefined`, return `makeErrorResult` with the error message `Required frontmatter field 'deviation_type' missing from task report`.

3. **Remove the legacy fallback** on the `context.report_deviations` line. Replace:
   ```javascript
   context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
   ```
   with:
   ```javascript
   context.report_deviations = Boolean(fm.has_deviations);
   ```

4. **Add `deviation_type` extraction** immediately after the `report_deviations` line:
   ```javascript
   context.report_deviation_type = fm.deviation_type;
   ```

5. **Open** `.github/orchestration/scripts/tests/pipeline-engine.test.js` and add `deviation_type: null` to every existing test mock's task report frontmatter that currently omits it. There are 7 locations (identified by their `has_deviations` field in frontmatter objects) — see the **Existing Mocks to Update** section below.

6. **Add 2 new test cases** in the `Task Report Pre-Read` describe block:
   - Test: `task_completed with missing has_deviations → returns error result`
   - Test: `task_completed with missing deviation_type → returns error result`

## Contracts & Interfaces

### `makeErrorResult` function signature

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js (line 93)
function makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed) {
  return {
    success: false,
    error,
    event: event || null,
    state_snapshot: stateSnapshot || null,
    mutations_applied: mutationsApplied || [],
    validation_passed: validationPassed !== undefined ? validationPassed : null
  };
}
```

### `task_completed` pre-read — target code (BEFORE modification)

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js (lines ~249–281)

  // Task report pre-read: enrich context before passing to mutation
  if (event === 'task_completed' && context.report_path) {
    try {
      const reportDoc = io.readDocument(context.report_path);
      if (!reportDoc) {
        return makeErrorResult(
          `Task report not found: ${context.report_path}`,
          event, [], null, null
        );
      }
      const fm = reportDoc.frontmatter || {};
      context.report_status = fm.status || null;
      // Normalize task report status vocabulary
      const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
      const VALID_STATUSES = ['complete', 'partial', 'failed'];
      if (context.report_status && STATUS_SYNONYMS[context.report_status]) {
        context.report_status = STATUS_SYNONYMS[context.report_status];
      }
      if (context.report_status && !VALID_STATUSES.includes(context.report_status)) {
        return makeErrorResult(
          `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
          event, [], null, null
        );
      }
      context.report_severity = fm.severity || null;
      context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read task report: ${err.message}`,
        event, [], null, null
      );
    }
  }
```

### `task_completed` pre-read — target code (AFTER modification)

```javascript
  // Task report pre-read: enrich context before passing to mutation
  if (event === 'task_completed' && context.report_path) {
    try {
      const reportDoc = io.readDocument(context.report_path);
      if (!reportDoc) {
        return makeErrorResult(
          `Task report not found: ${context.report_path}`,
          event, [], null, null
        );
      }
      const fm = reportDoc.frontmatter || {};
      context.report_status = fm.status || null;
      // Normalize task report status vocabulary
      const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
      const VALID_STATUSES = ['complete', 'partial', 'failed'];
      if (context.report_status && STATUS_SYNONYMS[context.report_status]) {
        context.report_status = STATUS_SYNONYMS[context.report_status];
      }
      if (context.report_status && !VALID_STATUSES.includes(context.report_status)) {
        return makeErrorResult(
          `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
          event, [], null, null
        );
      }
      if (fm.has_deviations === undefined || fm.has_deviations === null) {
        return makeErrorResult(
          `Required frontmatter field 'has_deviations' missing from task report`,
          event, [], null, null
        );
      }
      if (fm.deviation_type === undefined) {
        return makeErrorResult(
          `Required frontmatter field 'deviation_type' missing from task report`,
          event, [], null, null
        );
      }
      context.report_severity = fm.severity || null;
      context.report_deviations = Boolean(fm.has_deviations);
      context.report_deviation_type = fm.deviation_type;
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read task report: ${err.message}`,
        event, [], null, null
      );
    }
  }
```

### Task Report Frontmatter Contract (required fields for this task)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `has_deviations` | `boolean` | **yes** | `undefined` or `null` → error |
| `deviation_type` | `string` enum: `"minor"` \| `"architectural"` \| `null` | **yes** | `undefined` → error (note: `null` is a valid value meaning "no deviation type") |

### Error result shape for missing required fields

```javascript
{
  success: false,
  error: "Required frontmatter field 'has_deviations' missing from task report",
  event: "task_completed",
  state_snapshot: null,
  mutations_applied: [],
  validation_passed: null
}
```

## Styles & Design Tokens

Not applicable — no UI changes.

## Existing Mocks to Update

Every existing test mock in `pipeline-engine.test.js` that provides a task report frontmatter object with `has_deviations` but without `deviation_type` must have `deviation_type: null` added. These are the 7 locations:

1. **~Line 452** — `'task_completed → sets report_doc, triggers triage, enriches from pre-read'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'complete', severity: null, has_deviations: false },
   // AFTER:
   frontmatter: { status: 'complete', severity: null, has_deviations: false, deviation_type: null },
   ```

2. **~Line 485** — `'code_review_completed'` test (task report mock):
   ```javascript
   // BEFORE:
   frontmatter: { status: 'complete', has_deviations: false },
   // AFTER:
   frontmatter: { status: 'complete', has_deviations: false, deviation_type: null },
   ```

3. **~Line 769** — `'task_completed → skip triage (Row 1)'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'complete', has_deviations: false },
   // AFTER:
   frontmatter: { status: 'complete', has_deviations: false, deviation_type: null },
   ```

4. **~Line 808** — `'task_completed → corrective (Row 10)'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'failed', severity: 'minor', has_deviations: false },
   // AFTER:
   frontmatter: { status: 'failed', severity: 'minor', has_deviations: false, deviation_type: null },
   ```

5. **~Line 877** — `'increments on triage with non-skip result'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'failed', severity: 'minor', has_deviations: false },
   // AFTER:
   frontmatter: { status: 'failed', severity: 'minor', has_deviations: false, deviation_type: null },
   ```

6. **~Line 921** — `'triage_attempts > 1 → returns display_halted'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'complete', has_deviations: false },
   // AFTER:
   frontmatter: { status: 'complete', has_deviations: false, deviation_type: null },
   ```

7. **~Line 1015** — `'task_completed enriches context with frontmatter fields from pre-read'` test:
   ```javascript
   // BEFORE:
   frontmatter: { status: 'partial', severity: 'minor', has_deviations: true },
   // AFTER:
   frontmatter: { status: 'partial', severity: 'minor', has_deviations: true, deviation_type: 'minor' },
   ```

## Test Requirements

- [ ] Test: `task_completed` with task report frontmatter containing `has_deviations: false, deviation_type: null` → pipeline succeeds (passes validation)
- [ ] Test: `task_completed` with task report frontmatter missing `has_deviations` entirely → returns `{ success: false }` with error containing `"Required frontmatter field 'has_deviations' missing from task report"`
- [ ] Test: `task_completed` with task report frontmatter missing `deviation_type` entirely → returns `{ success: false }` with error containing `"Required frontmatter field 'deviation_type' missing from task report"`
- [ ] All 7 existing test mocks updated with `deviation_type` → all existing tests pass with zero regressions
- [ ] No state should be written when validation fails (assert `io.getWrites().length === 0`)

### New Test Case Templates

**Test: missing `has_deviations`**:
```javascript
it('task_completed with missing has_deviations → returns error result', () => {
  const state = createExecutionState(s => {
    const task = s.execution.phases[0].tasks[0];
    task.status = 'in_progress';
    task.handoff_doc = 'tasks/test.md';
  });
  const documents = {
    'reports/task-report.md': {
      frontmatter: { status: 'complete', severity: null },
      body: 'Task complete.'
    }
  };
  const io = createMockIO({ state, documents });
  const result = executePipeline(makeRequest('task_completed', {
    report_path: 'reports/task-report.md'
  }), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes("Required frontmatter field 'has_deviations' missing from task report"),
    `Expected error about missing has_deviations, got: ${result.error}`);
  assert.deepStrictEqual(result.mutations_applied, []);
  assert.equal(io.getWrites().length, 0);
});
```

**Test: missing `deviation_type`**:
```javascript
it('task_completed with missing deviation_type → returns error result', () => {
  const state = createExecutionState(s => {
    const task = s.execution.phases[0].tasks[0];
    task.status = 'in_progress';
    task.handoff_doc = 'tasks/test.md';
  });
  const documents = {
    'reports/task-report.md': {
      frontmatter: { status: 'complete', severity: null, has_deviations: false },
      body: 'Task complete.'
    }
  };
  const io = createMockIO({ state, documents });
  const result = executePipeline(makeRequest('task_completed', {
    report_path: 'reports/task-report.md'
  }), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes("Required frontmatter field 'deviation_type' missing from task report"),
    `Expected error about missing deviation_type, got: ${result.error}`);
  assert.deepStrictEqual(result.mutations_applied, []);
  assert.equal(io.getWrites().length, 0);
});
```

## Acceptance Criteria

- [ ] `has_deviations` validation: when `has_deviations` is `undefined` or `null` in task report frontmatter, `executePipeline` returns `{ success: false, error: "Required frontmatter field 'has_deviations' missing from task report" }`
- [ ] `deviation_type` validation: when `deviation_type` is `undefined` in task report frontmatter, `executePipeline` returns `{ success: false, error: "Required frontmatter field 'deviation_type' missing from task report" }`
- [ ] `deviation_type: null` is a valid value (not rejected) — `null` means "no deviation type"
- [ ] Legacy fallback removed: the expression `fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations` is replaced with `Boolean(fm.has_deviations)`
- [ ] `context.report_deviation_type` is set to `fm.deviation_type` after validation passes
- [ ] All 7 existing test mocks include `deviation_type` in their task report frontmatter
- [ ] 2 new tests added: one for missing `has_deviations`, one for missing `deviation_type`
- [ ] All tests pass (`node --test .github/orchestration/scripts/tests/pipeline-engine.test.js`)
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any code outside the `task_completed` pre-read block in `pipeline-engine.js`
- Do NOT add fallback logic — `has_deviations` and `deviation_type` are strictly REQUIRED; no default values
- Do NOT accept the legacy `deviations` field — `has_deviations` is the sole field name
- Do NOT modify the triage engine (`triage-engine.js`) — that is T04's scope
- Do NOT modify the task report template or SKILL.md — that was T01's scope
- Do NOT change the existing `status` normalization/validation logic — only add the new validation _after_ it
- `deviation_type` allows `null` as a valid value — only `undefined` is an error (field absent from YAML)
