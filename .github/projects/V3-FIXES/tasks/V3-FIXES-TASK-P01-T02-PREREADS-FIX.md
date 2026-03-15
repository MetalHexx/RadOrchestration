---
project: "V3-FIXES"
phase: 1
task: 2
title: "Add state-derivation fallback to handlePlanApproved in pre-reads.js"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# Add state-derivation fallback to handlePlanApproved in pre-reads.js

## Objective

Update the `handlePlanApproved` function in `pre-reads.js` to derive the master plan document path from `state.planning.steps[4].doc_path` when `context.doc_path` is absent, while preserving backward compatibility when `context.doc_path` is present.

## Context

The `handlePlanApproved` pre-read handler currently requires `context.doc_path` to locate the master plan document. However, the documented event API for `plan_approved` specifies `context = {}` — the Orchestrator is not required to supply `doc_path`. When it is absent, the handler fails. The fix adds a state-derivation fallback: read state.json from `projectDir`, extract `state.planning.steps[4].doc_path` (the master plan step), and use that path. The `plan_approved` event only fires after `master_plan_completed`, so `steps[4].doc_path` is always populated by the time this handler runs. The function already receives `projectDir` as its third parameter from the `preRead` dispatch.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pre-reads.js` | Add 2 imports + replace `handlePlanApproved` function body |

## Implementation Steps

1. **Add two imports** at the top of `pre-reads.js`, immediately after `'use strict';` and before the `STATUS_MAP` declaration. Add:
   ```javascript
   const path = require('path');
   const { readFile } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
   ```

2. **Replace the entire `handlePlanApproved` function** (currently lines 27–37) with the new implementation shown in the Contracts & Interfaces section below. The replacement preserves the existing function signature `(context, readDocument, projectDir)` — `projectDir` is already passed by the `preRead` dispatch function.

3. **Verify no other changes are needed.** The `preRead` entry point already passes `projectDir` as the fourth argument to handlers:
   ```javascript
   function preRead(event, context, readDocument, projectDir) {
     const handler = PRE_READ_HANDLERS[event];
     if (!handler) return success(context);
     return handler(context, readDocument, projectDir);
   }
   ```
   No changes to `preRead`, the handler lookup table `PRE_READ_HANDLERS`, or any other handler function.

## Contracts & Interfaces

### Current `handlePlanApproved` (to be replaced)

```javascript
function handlePlanApproved(context, readDocument) {
  const { ok, frontmatter, result } = readOrFail(readDocument, context.doc_path, 'plan_approved');
  if (!ok) return result;
  const n = frontmatter.total_phases;
  if (n === undefined || n === null) return failure('Missing required field', 'plan_approved', 'total_phases');
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    return failure('Invalid value: total_phases must be a positive integer', 'plan_approved', 'total_phases');
  }
  return success({ ...context, total_phases: n });
}
```

### New `handlePlanApproved` (exact replacement)

```javascript
function handlePlanApproved(context, readDocument, projectDir) {
  let docPath = context.doc_path;

  if (!docPath) {
    // Derive doc_path from state.planning.steps[4] (master_plan step).
    // This step is always populated before plan_approved is ever signaled.
    const stateRaw = readFile(path.join(projectDir, 'state.json'));
    if (!stateRaw) {
      return failure(
        "Cannot derive master plan path: state.json unreadable at '" + projectDir + "'",
        'plan_approved',
        'doc_path',
      );
    }
    let state;
    try {
      state = JSON.parse(stateRaw);
    } catch (err) {
      return failure(
        'Cannot derive master plan path: state.json is not valid JSON',
        'plan_approved',
        'doc_path',
      );
    }
    const derived = state?.planning?.steps?.[4]?.doc_path;
    if (!derived) {
      return failure(
        'Cannot derive master plan path: state.planning.steps[4].doc_path is not set',
        'plan_approved',
        'doc_path',
      );
    }
    docPath = path.isAbsolute(derived) ? derived : path.join(projectDir, derived);
  }

  const { ok, frontmatter, result } = readOrFail(readDocument, docPath, 'plan_approved');
  if (!ok) return result;
  const n = frontmatter.total_phases;
  if (n === undefined || n === null) return failure('Missing required field', 'plan_approved', 'total_phases');
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    return failure('Invalid value: total_phases must be a positive integer', 'plan_approved', 'total_phases');
  }
  return success({ ...context, total_phases: n });
}
```

### Helper functions used (already present in pre-reads.js — do NOT modify)

```javascript
function success(context) { return { context, error: undefined }; }

function failure(error, event, field) {
  return { context: undefined, error: { error, event, field } };
}

function readOrFail(readDocument, docPath, event) {
  const doc = readDocument(docPath);
  if (!doc) return { ok: false, result: failure(`Document not found at '${docPath}'`, event) };
  return { ok: true, frontmatter: doc.frontmatter || {} };
}
```

### `preRead` dispatch (already passes `projectDir` — do NOT modify)

```javascript
function preRead(event, context, readDocument, projectDir) {
  const handler = PRE_READ_HANDLERS[event];
  if (!handler) return success(context);
  return handler(context, readDocument, projectDir);
}
```

### `readFile` import contract (from fs-helpers)

```javascript
// Signature: readFile(filePath: string) → string | null
// Returns file content as a string, or null if the file does not exist / is unreadable.
// Already used in state-io.js via the same import path.
const { readFile } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
```

### Pipeline engine call site (shows how preRead receives its arguments — do NOT modify)

```javascript
// In pipeline-engine.js processEvent():
const preReadResult = preRead(event, context, io.readDocument, projectDir);
```

### Expected file state after modification

The top of `pre-reads.js` should look like:

```javascript
'use strict';

const path = require('path');
const { readFile } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');

// ─── Status Normalization ──────────────────────────────────────────────────
// ... (rest unchanged)
```

## Styles & Design Tokens

Not applicable — this is a backend script change with no UI component.

## Test Requirements

- [ ] **State-derivation path**: Call `handlePlanApproved` with `context = {}` (no `doc_path`), a mock `readDocument` that returns frontmatter with `total_phases: 3`, and a `projectDir` whose `state.json` has `planning.steps[4].doc_path` set to a valid path. Assert the result has `context.total_phases === 3` and no error.
- [ ] **Backward-compatible path**: Call `handlePlanApproved` with `context = { doc_path: "/some/path.md" }` and a mock `readDocument`. Assert the result uses the context-supplied path (no state.json read needed).
- [ ] **Missing state and missing context**: Call `handlePlanApproved` with `context = {}` and a `projectDir` where `readFile` returns `null` (no state.json). Assert `result.error` contains `"state.json unreadable"`.
- [ ] **State exists but steps[4].doc_path is null**: Call with `context = {}` and a `projectDir` whose state.json has `planning.steps[4].doc_path = null`. Assert `result.error` contains `"steps[4].doc_path is not set"`.
- [ ] **State exists but JSON is invalid**: Call with `context = {}` and a `projectDir` where `readFile` returns invalid JSON. Assert `result.error` contains `"not valid JSON"`.

> **Note**: These test requirements are for verification reference. This task modifies ONLY `pre-reads.js` — do not create or modify test files. Unit tests for this handler will be added in a separate task if needed.

## Acceptance Criteria

- [ ] `handlePlanApproved` called with `context = {}` and valid state (`steps[4].doc_path` set) returns `{ context: { total_phases: N }, error: undefined }` with the correct data
- [ ] `handlePlanApproved` called with `context = { doc_path: "..." }` returns the same result as the current implementation (backward compatible)
- [ ] `handlePlanApproved` called with no `context.doc_path` AND no `state.planning.steps[4].doc_path` returns `{ context: undefined, error: { error: "...", event: "plan_approved", field: "doc_path" } }` with a descriptive message
- [ ] `handlePlanApproved` called with no `context.doc_path` AND unreadable state.json returns a descriptive `failure(...)` — never throws an exception
- [ ] `handlePlanApproved` called with no `context.doc_path` AND malformed state.json returns a descriptive `failure(...)` — never throws an exception
- [ ] All existing tests pass unchanged (`mutations.test.js`, `pipeline-behavioral.test.js`, `resolver.test.js`)
- [ ] No changes to any file other than `.github/orchestration/scripts/lib/pre-reads.js`
- [ ] The two new imports (`path`, `readFile`) are placed after `'use strict';` and before the `STATUS_MAP` block
- [ ] No other handler functions in `pre-reads.js` are modified

## Constraints

- Do NOT modify any file other than `.github/orchestration/scripts/lib/pre-reads.js`
- Do NOT modify the `preRead` entry point function or the `PRE_READ_HANDLERS` lookup table
- Do NOT modify any other handler function (`handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhasePlanCreated`, `handlePhaseReviewCompleted`)
- Do NOT modify the `success`, `failure`, or `readOrFail` helper functions
- Do NOT add `async`/`await` — all I/O in this module is synchronous (consistent with `readFile` from fs-helpers and the existing handler pattern)
- Do NOT use `readState` from `state-io.js` — use `readFile` + `JSON.parse` directly to avoid circular dependency concerns and to keep error handling within the handler
- Never throw an exception from the handler — all error conditions must return `failure(...)` with a descriptive message
