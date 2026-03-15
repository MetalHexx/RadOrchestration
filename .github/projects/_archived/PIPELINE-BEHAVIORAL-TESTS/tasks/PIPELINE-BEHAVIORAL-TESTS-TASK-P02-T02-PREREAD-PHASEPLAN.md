---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
task: 2
title: "Add phase_plan_created Pre-Read Block"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Add `phase_plan_created` Pre-Read Block

## Objective

Add a new pre-read block in `pipeline-engine.js` that executes when `event === 'phase_plan_created'`, reads the phase plan document's frontmatter via `createProjectAwareReader`, validates the `tasks` array, and copies it into `context.tasks` so `handlePhasePlanCreated` can initialize the phase's task list.

## Context

The pipeline engine already has two pre-read blocks: one for `plan_approved` (reads master plan `total_phases` into context) and one for `task_completed` (reads task report fields into context). The `phase_plan_created` event currently has no pre-read, so the Orchestrator must manually pass task definitions. This block fills that gap by reading the `tasks` array from the phase plan frontmatter — the same `tasks` array that T01 just added as a REQUIRED field in the phase plan template. The block uses `createProjectAwareReader` (which already uses the null-return contract from Phase 1) for path resolution and returns `makeErrorResult(...)` on any validation failure.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Add `phase_plan_created` pre-read block between the existing `task_completed` pre-read and the config/normalize section |

## Implementation Steps

### Step 1: Locate the insertion point

Open `.github/orchestration/scripts/lib/pipeline-engine.js`. Find the end of the `task_completed` pre-read block. The current code at the insertion point (around lines 275–282) is:

```javascript
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read task report: ${err.message}`,
        event, [], null, null
      );
    }
  }

  // ── Load config & normalize context paths ──
  const config = io.readConfig(configPath);
```

### Step 2: Insert the `phase_plan_created` pre-read block

Insert the following block **after** the closing `}` of the `task_completed` pre-read block and **before** the `// ── Load config & normalize context paths ──` comment:

```javascript
  // Phase plan pre-read: extract tasks array from phase plan frontmatter
  if (event === 'phase_plan_created' && context.phase_plan_path) {
    try {
      const projectAwareReader = createProjectAwareReader(io.readDocument, projectDir);
      const phasePlanDoc = projectAwareReader(context.phase_plan_path);
      if (!phasePlanDoc) {
        return makeErrorResult(
          `Phase plan not found: ${context.phase_plan_path}`,
          event, [], null, null
        );
      }
      const fm = phasePlanDoc.frontmatter || {};
      if (!Array.isArray(fm.tasks)) {
        return makeErrorResult(
          `Required frontmatter field 'tasks' missing from phase plan document`,
          event, [], null, null
        );
      }
      if (fm.tasks.length === 0) {
        return makeErrorResult(
          `Phase plan 'tasks' array must not be empty`,
          event, [], null, null
        );
      }
      context.tasks = fm.tasks;
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read phase plan: ${err.message}`,
        event, [], null, null
      );
    }
  }
```

### Step 3: Verify the surrounding code after insertion

After inserting, the code from the end of the `task_completed` block through the config load should read:

```javascript
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read task report: ${err.message}`,
        event, [], null, null
      );
    }
  }

  // Phase plan pre-read: extract tasks array from phase plan frontmatter
  if (event === 'phase_plan_created' && context.phase_plan_path) {
    try {
      const projectAwareReader = createProjectAwareReader(io.readDocument, projectDir);
      const phasePlanDoc = projectAwareReader(context.phase_plan_path);
      if (!phasePlanDoc) {
        return makeErrorResult(
          `Phase plan not found: ${context.phase_plan_path}`,
          event, [], null, null
        );
      }
      const fm = phasePlanDoc.frontmatter || {};
      if (!Array.isArray(fm.tasks)) {
        return makeErrorResult(
          `Required frontmatter field 'tasks' missing from phase plan document`,
          event, [], null, null
        );
      }
      if (fm.tasks.length === 0) {
        return makeErrorResult(
          `Phase plan 'tasks' array must not be empty`,
          event, [], null, null
        );
      }
      context.tasks = fm.tasks;
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read phase plan: ${err.message}`,
        event, [], null, null
      );
    }
  }

  // ── Load config & normalize context paths ──
  const config = io.readConfig(configPath);
```

### Step 4: Run existing tests to confirm zero regressions

Run the existing pipeline engine tests:

```bash
node --test .github/orchestration/scripts/tests/pipeline-engine.test.js
```

The new pre-read block only activates when `event === 'phase_plan_created' && context.phase_plan_path` — no existing test exercises this event+context combination, so no existing test should be affected.

## Contracts & Interfaces

### `makeErrorResult` signature

```javascript
/**
 * @param {string} error - Error message
 * @param {string|null} event - Event that caused the failure
 * @param {string[]} mutationsApplied - Mutations applied before the error
 * @param {Object|null} stateSnapshot - Partial state for debugging
 * @param {boolean|null} validationPassed - Whether validation passed; null if not run
 * @returns {{ success: false, error: string, event: string|null, state_snapshot: Object|null, mutations_applied: string[], validation_passed: boolean|null }}
 */
function makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed)
```

All error returns from the new pre-read use: `makeErrorResult(errorMessage, event, [], null, null)` — no mutations applied, no state snapshot, validation not yet run.

### `createProjectAwareReader` signature

```javascript
/**
 * @param {Function} readDocument - The IO-injected readDocument function (returns { frontmatter, body } or null)
 * @param {string} projectDir - Absolute or workspace-relative project directory path
 * @returns {Function} - A reader that tries direct path, then project-relative fallback; returns document or null
 */
function createProjectAwareReader(readDocument, projectDir)
```

Already exists in the file (around line 137). Uses the null-return contract — returns `null` if both direct and project-relative paths fail. Never throws for missing files.

### `executePipeline` request shape (relevant fields)

```javascript
// The request object passed to executePipeline:
{
  event: 'phase_plan_created',        // string — the pipeline event
  projectDir: '/path/to/project',     // string — project directory
  context: {
    phase_plan_path: 'phases/...',    // string — path to the phase plan document
    // ... other context fields
  }
}
```

### Phase plan document shape (returned by `createProjectAwareReader`)

```javascript
// Successful readDocument return:
{
  frontmatter: {
    project: "PROJECT-NAME",
    phase: 2,
    title: "Phase Title",
    status: "active",
    total_tasks: 4,
    tasks: [                          // REQUIRED — this is what the pre-read extracts
      { id: "T01-AUTH", title: "Implement auth module" },
      { id: "T02-API", title: "Create API endpoints" }
    ],
    author: "tactical-planner-agent",
    created: "2026-03-14T23:00:00Z"
  },
  body: "# Phase Plan markdown content..."
}

// Missing document:
null
```

### Context enrichment (output of the pre-read)

On success, the pre-read copies the tasks array into context:

```javascript
context.tasks = fm.tasks;
// Result: context.tasks === [{ id: "T01-AUTH", title: "..." }, { id: "T02-API", title: "..." }]
```

### Error result shapes

| Failure Mode | Error Message |
|---|---|
| Phase plan document not found | `"Phase plan not found: {context.phase_plan_path}"` |
| `tasks` field missing or not an array | `"Required frontmatter field 'tasks' missing from phase plan document"` |
| `tasks` array is empty | `"Phase plan 'tasks' array must not be empty"` |
| Unexpected read error | `"Failed to pre-read phase plan: {err.message}"` |

All errors return `{ success: false, error: "...", event: "phase_plan_created", state_snapshot: null, mutations_applied: [], validation_passed: null }`.

## Styles & Design Tokens

Not applicable — this task modifies only a JavaScript engine module. No visual interface or design system.

## Test Requirements

- [ ] Run existing pipeline engine tests (`node --test .github/orchestration/scripts/tests/pipeline-engine.test.js`) — all must pass with zero regressions
- [ ] Run existing state-io tests (`node --test .github/orchestration/scripts/tests/state-io.test.js`) — all must pass (no changes to state-io, but verify no side effects)
- [ ] No new tests are required for this task — comprehensive behavioral tests covering this pre-read block (including missing documents and missing required fields) will be added in Phase 3 (T02 is a code change only)

## Acceptance Criteria

- [ ] A `phase_plan_created` pre-read block exists in `pipeline-engine.js` that activates when `event === 'phase_plan_created' && context.phase_plan_path`
- [ ] The pre-read uses `createProjectAwareReader(io.readDocument, projectDir)` to resolve the phase plan path
- [ ] The pre-read returns `{ success: false, error: "Phase plan not found: ..." }` when the document is not found (null return from reader)
- [ ] The pre-read returns `{ success: false, error: "Required frontmatter field 'tasks' missing from phase plan document" }` when `frontmatter.tasks` is missing or not an array
- [ ] The pre-read returns `{ success: false, error: "Phase plan 'tasks' array must not be empty" }` when `frontmatter.tasks` is an empty array
- [ ] On success, `context.tasks` is set to `frontmatter.tasks` (the array of `{ id, title }` objects)
- [ ] The pre-read block is placed after the `task_completed` pre-read block and before the `// ── Load config & normalize context paths ──` section
- [ ] All existing tests pass with zero regressions
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify the existing `plan_approved` pre-read block
- Do NOT modify the existing `task_completed` pre-read block
- Do NOT modify the `createProjectAwareReader` function — use it as-is
- Do NOT add `phase_plan_path` to the `normalizeContextPaths` PATH_KEYS array — the `createProjectAwareReader` handles path resolution
- Do NOT add new tests in this task — behavioral test coverage is Phase 3's scope
- Do NOT modify any file other than `.github/orchestration/scripts/lib/pipeline-engine.js`
- Do NOT add required-field validation for `has_deviations`/`deviation_type` in the `task_completed` block — that is T03's scope
