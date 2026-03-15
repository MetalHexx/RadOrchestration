---
project: "V3-FIXES"
status: "draft"
author: "architect-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Architecture

## Technical Overview

V3-FIXES applies five surgical corrections to the v3 orchestration pipeline. The approach is strictly additive and minimally invasive: confirm the already-correct stale-state fix in `mutations.js`, add missing test coverage for the corrective task flow, eliminate a `doc_path` mismatch in `pre-reads.js` via a state-derivation fallback, replace the single CWD-dependent path in `state-io.js` with a `__dirname`-relative constant, and strengthen two agent instruction files with explicit self-healing hierarchy and event-loop discipline rules. No new modules, abstractions, or files are introduced; all changes land in three runtime scripts, two agent instruction files, and two existing test files. Every change is backward compatible.

---

## System Layers

Only the layers with in-scope changes are shown. The resolver, pipeline-engine, and constants layers are untouched.

```
┌──────────────────────────────────────────────────────────────┐
│  Behavioral  (Agent Instructions)                            │
│  orchestrator.agent.md  ·  coder.agent.md                   │
│  Goals 2, 3, 5 (secondary + tertiary hardening)             │
├──────────────────────────────────────────────────────────────┤
│  Application  (Pipeline Script + I/O)                        │
│  state-io.js                                                 │
│  Goal 5 (primary code fix)                                   │
├──────────────────────────────────────────────────────────────┤
│  Domain  (Mutations + Pre-Reads)                             │
│  mutations.js  (confirmed correct, no runtime change)        │
│  pre-reads.js  (Goal 4 fallback added)                       │
├──────────────────────────────────────────────────────────────┤
│  Test Coverage                                               │
│  mutations.test.js  ·  pipeline-behavioral.test.js           │
│  Goal 1 (new unit tests + new behavioral category)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Module Map

Only modules receiving in-scope changes are listed.

| Module | Layer | Path | Responsibility | In-Scope Change |
|--------|-------|------|----------------|-----------------|
| `mutations.js` | Domain | `.github/orchestration/scripts/lib/mutations.js` | Applies state mutations for all pipeline events | **Confirmed correct — zero runtime change**; covered by new tests |
| `pre-reads.js` | Domain | `.github/orchestration/scripts/lib/pre-reads.js` | Reads and validates documents before state mutation | Add state-derivation fallback to `handlePlanApproved` (Goal 4) |
| `state-io.js` | Application | `.github/orchestration/scripts/lib/state-io.js` | Config loading, state read/write, document reading | Replace `process.cwd()` with `__dirname`-relative path in `readConfig` (Goal 5) |
| `orchestrator.agent.md` | Behavioral | `.github/agents/orchestrator.agent.md` | Orchestrator agent behavioral instructions | Add self-healing hierarchy, valid pause points, source-file prohibition, pipeline invocation rule (Goals 2, 3, 5) |
| `coder.agent.md` | Behavioral | `.github/agents/coder.agent.md` | Coder agent behavioral instructions | Add CWD restoration step (Goal 5) |
| `mutations.test.js` | Test | `.github/orchestration/scripts/tests/mutations.test.js` | Unit tests for mutation handlers | Add 2 test cases for `handleTaskHandoffCreated` corrective path (Goal 1) |
| `pipeline-behavioral.test.js` | Test | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | End-to-end behavioral tests for the pipeline | Add Category 11 — full corrective task flow (Goal 1) |

---

## Change Specifications

### Goal 1 — `mutations.js`: Confirmation + Test Coverage

#### 1-A: Runtime Code — No Change Required

`handleTaskHandoffCreated` (`.github/orchestration/scripts/lib/mutations.js`, lines 211–233) is **already correct**. The presence-based clearing logic is architecturally sound, idempotent, and requires no modification. The function as it currently exists is the target state:

```javascript
// Target state — already in the file. No change required.
function handleTaskHandoffCreated(state, context, config) {
  const task = currentTask(state);
  const mutations = [];

  if (task.report_doc) {
    task.report_doc = null;
    task.report_status = null;
    mutations.push('Cleared task.report_doc and report_status (corrective re-execution)');
  }
  if (task.review_doc) {
    task.review_doc = null;
    task.review_verdict = null;
    task.review_action = null;
    mutations.push('Cleared task.review_doc, review_verdict, and review_action (corrective re-execution)');
  }

  task.handoff_doc = context.doc_path;
  task.status = TASK_STATUSES.IN_PROGRESS;
  mutations.push(`Set task.handoff_doc to "${context.doc_path}"`);
  mutations.push(`Set task.status to "${TASK_STATUSES.IN_PROGRESS}"`);

  return { state, mutations_applied: mutations };
}
```

**Why presence-based clearing is correct** (decision recorded for review):
- Checks actual field state, not a context flag — works even if the resolver's `is_correction` flag is renamed or omitted.
- Self-describing: the clearing fires if and only if there is something to clear.
- The event `task_handoff_created` semantically means "a new execution cycle begins for this task" — clearing stale fields at this exact boundary is logically sound.

#### 1-B: `handleCodeReviewCompleted` — Confirmed, No Change

All three outcome branches are present in the current file (lines 298–320). Confirmed by research; no action required.

```javascript
// Confirmed present — no change required.
if (reviewAction === REVIEW_ACTIONS.ADVANCED) {
  phase.current_task += 1;
  ...
} else if (reviewAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
  task.retries += 1;
  task.status = TASK_STATUSES.FAILED;
  ...
} else if (reviewAction === REVIEW_ACTIONS.HALTED) {
  task.status = TASK_STATUSES.HALTED;
  ...
}
```

#### 1-C: New Unit Tests — `mutations.test.js`

Add two test cases inside the existing `describe('handleTaskHandoffCreated', ...)` block. Both use the Node built-in test runner (`node:test` + `node:assert/strict`), consistent with the rest of the file.

**Test T1 — Corrective path: all stale fields are cleared and mutation log entries are emitted**

```javascript
it('clears stale report and review fields on corrective re-execution', () => {
  // Build state with pre-populated stale fields (simulates post-code-review state)
  const state = makeExecutionState(); // or equivalent local builder
  const task = state.execution.phases[0].tasks[0];
  task.report_doc = '.github/projects/PROJ/reports/REPORT.md';
  task.report_status = 'complete';        // makeExecutionState does not set this — must be explicit
  task.review_doc = '.github/projects/PROJ/reports/REVIEW.md';
  task.review_verdict = 'changes_requested';
  task.review_action = 'corrective_task_issued';

  const context = { doc_path: '.github/projects/PROJ/tasks/CORRECTIVE-HANDOFF.md' };
  const result = handleTaskHandoffCreated(state, context, config);

  // Mutation log entries
  assert.ok(
    result.mutations_applied.some(m => m.includes('Cleared task.report_doc')),
    'Expected clearing entry for report_doc',
  );
  assert.ok(
    result.mutations_applied.some(m => m.includes('Cleared task.review_doc')),
    'Expected clearing entry for review_doc',
  );

  // Field values after clearing
  assert.strictEqual(task.report_doc, null);
  assert.strictEqual(task.report_status, null);
  assert.strictEqual(task.review_doc, null);
  assert.strictEqual(task.review_verdict, null);
  assert.strictEqual(task.review_action, null);

  // New handoff fields set correctly
  assert.strictEqual(task.handoff_doc, context.doc_path);
  assert.strictEqual(task.status, TASK_STATUSES.IN_PROGRESS);
});
```

**Test T2 — Idempotency: first-time handoff emits no clearing mutation entries**

```javascript
it('emits no clearing entries when stale fields are already null (first-time handoff)', () => {
  const state = makeExecutionState(); // task fields report_doc and review_doc are null by default
  const context = { doc_path: '.github/projects/PROJ/tasks/HANDOFF.md' };
  const result = handleTaskHandoffCreated(state, context, config);

  // No clearing mutation entries emitted
  assert.ok(
    !result.mutations_applied.some(m => m.includes('Cleared task.report_doc')),
    'Unexpected clearing entry for report_doc on first-time handoff',
  );
  assert.ok(
    !result.mutations_applied.some(m => m.includes('Cleared task.review_doc')),
    'Unexpected clearing entry for review_doc on first-time handoff',
  );

  // Only the two standard entries present (handoff_doc and status)
  assert.strictEqual(result.mutations_applied.length, 2);

  // Fields are set correctly
  const task = state.execution.phases[0].tasks[0];
  assert.strictEqual(task.handoff_doc, context.doc_path);
  assert.strictEqual(task.status, TASK_STATUSES.IN_PROGRESS);
  assert.strictEqual(task.report_doc, null);
  assert.strictEqual(task.review_doc, null);
});
```

> **Implementation note for T1**: `makeExecutionState()` does not set `task.report_status`. The test must explicitly set it on the task object before calling the handler, as shown above.

#### 1-D: New Behavioral Test — `pipeline-behavioral.test.js` Category 11

Append a new `describe` block as **Category 11** at the end of `pipeline-behavioral.test.js`. Follow the same shared-IO sequential structure used by Categories 1–10: a `before` block accumulates the initial state sequence, and `it` blocks run the specific assertions as sequential steps sharing the same IO.

**Structure and assertions**:

```javascript
describe('Category 11 — Corrective Task Flow', () => {
  // Shared IO (same pattern as existing categories — use the test file's IO setup)
  // State must enter this category with the current task in:
  //   status = 'failed'
  //   review_action = 'corrective_task_issued'
  //   report_doc = '<some-path>'      (set — from prior task_completed event)
  //   report_status = 'complete'      (set — from prior task_completed event)
  //   review_doc = '<some-path>'      (set — from prior code_review_completed event)
  //   review_verdict = 'changes_requested'
  //
  // Achieve this by running the pipeline through the following event sequence in
  // the before block (or by directly building and writing mid-flight state using
  // the test file's state-building helpers, following the pattern of existing
  // categories that inject intermediate state):
  //
  //   start → [all planning events] → phase_plan_created → task_handoff_created →
  //   task_completed → code_review_completed(verdict=changes_requested)
  //
  // After code_review_completed the resolver returns create_task_handoff.
  // The category then signals task_handoff_created as the first test step.

  it('returns execute_task after task_handoff_created on a corrective task', () => {
    const result = pipeline('task_handoff_created', {
      doc_path: '.github/projects/PROJ/tasks/CORRECTIVE-HANDOFF.md',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, 'execute_task');
  });

  it('clears all stale fields after corrective task_handoff_created', () => {
    const state = readState(); // read state after the event above
    const task = state.execution.phases[0].tasks[0];
    assert.strictEqual(task.report_doc, null);
    assert.strictEqual(task.report_status, null);
    assert.strictEqual(task.review_doc, null);
    assert.strictEqual(task.review_verdict, null);
    assert.strictEqual(task.review_action, null);
  });

  it('sets task status to in_progress and handoff_doc to the corrective path', () => {
    const state = readState();
    const task = state.execution.phases[0].tasks[0];
    assert.strictEqual(task.status, 'in_progress');
    assert.strictEqual(
      task.handoff_doc,
      '.github/projects/PROJ/tasks/CORRECTIVE-HANDOFF.md',
    );
  });
});
```

> **Implementation notes for Category 11**:
> - The test must use `delete state.project.updated` (or the equivalent V13 bypass used by other categories) before writing injected state.
> - If the sequential run-through approach is used in `before`, the `code_review_completed` event must pass a context with `{ doc_path: '<review-doc>', verdict: 'changes_requested' }` pointing to a document with `verdict: changes_requested` in its frontmatter.
> - State must not leak from Category 11 into any subsequent categories.

---

### Goals 2 & 3 — `orchestrator.agent.md`: Self-Healing + Event-Loop Rules

Five text additions are required. Each is specified verbatim below, with the precise insertion location.

#### Addition A — "What you do NOT do": Source File Prohibition

**Location**: `orchestrator.agent.md` → "What you do NOT do" section → insert as a new bullet **immediately after** the existing `- **Never write, create, or modify any file** — you are read-only` bullet.

```markdown
- **Never modify pipeline source files as a self-healing or workaround action** — this includes `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, and skill files. Source file changes bypass code review and test coverage. This prohibition has no exceptions.
```

#### Addition B — "What you do NOT do": Event-Loop Interruption Prohibition

**Location**: Same section, insert as the next bullet after Addition A.

```markdown
- **Never pause the event loop after completing a non-terminal side-task.** Error logging, status reporting, and workaround application are not pipeline gates. After any side-task completes, resume the event loop immediately — do not ask the human "should I continue?" unless `result.action` is one of the six valid pause points listed in the Valid Pause and Stop Points section below.
```

#### Addition C — Error Handling: Self-Healing Hierarchy

**Location**: `orchestrator.agent.md` → "Error Handling" section → insert a new `### Self-Healing Hierarchy` sub-heading **immediately before** the existing "On every `success: false` result, follow these 3 steps in order" paragraph.

```markdown
### Self-Healing Hierarchy

When you encounter a pipeline error or a stuck state, follow this priority order. Do not skip levels:

1. **Re-signal the correct event.** If you can identify the correct next event and the pipeline simply did not receive it, re-invoke `pipeline.js` with that event and context. No `state.json` edits are needed.
2. **Clear stale fields in `state.json`.** If the state contains stale fields from a prior step, null or clear only those fields — never set a value that was not returned by a pipeline result. Log the edit via the `log-error` skill, then re-invoke the pipeline.
3. **Log and halt.** If neither option resolves the issue, invoke the `log-error` skill, display the error to the human, and stop.

**Never modify pipeline source files** (`mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, or skills) as a self-healing action — this is never acceptable under any circumstances.
```

#### Addition D — Event Loop: Valid Pause and Stop Points

**Location**: `orchestrator.agent.md` → "Event Loop" section → insert a new `### Valid Pause and Stop Points` sub-heading **immediately after** the existing `### Loop Termination` sub-section.

```markdown
### Valid Pause and Stop Points

The event loop may only pause or stop at exactly these six `result.action` values:

| `result.action` | Type | Required action |
|-----------------|------|-----------------|
| `display_halted` | Terminal stop | Inform human; halt — loop ends |
| `display_complete` | Terminal stop | Inform human; pipeline complete — loop ends |
| `request_plan_approval` | Human gate | Display Master Plan summary; await human approval |
| `request_final_approval` | Human gate | Display final review summary; await human approval |
| `gate_task` | Human gate | Display task gate summary; await human decision |
| `gate_phase` | Human gate | Display phase gate summary; await human decision |

Any `result.action` not in this list must be actioned immediately without human check-in. Side-tasks (error logging, status reporting, workaround application) do not produce a `result.action` — they are never a pause point.
```

#### Addition E — Event Loop: Pipeline Invocation Rule

**Location**: `orchestrator.agent.md` → "Event Loop" section → insert a new `### Pipeline Invocation Rule` sub-heading **immediately after** the `### First Call` sub-section (before Loop Termination).

```markdown
### Pipeline Invocation Rule

Always invoke `pipeline.js` using one of the following two safe forms — never use a bare relative path:

1. **cd prefix**: `cd <workspace-root> && node .github/orchestration/scripts/pipeline.js ...`
2. **Absolute path**: `node /absolute/path/to/.github/orchestration/scripts/pipeline.js ...`

A Coder agent may have changed the working directory during task execution. A bare relative path will silently fail if CWD has drifted from the workspace root.
```

---

### Goal 4 — `pre-reads.js`: `handlePlanApproved` State-Derivation Fallback

#### 4-A: New Imports

Add to the top of `.github/orchestration/scripts/lib/pre-reads.js` (after `'use strict';`):

```javascript
const path = require('path');
const { readFile } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
```

**Path resolution verification** (`__dirname` = `.github/orchestration/scripts/lib`):
- `../` → `.github/orchestration/scripts/`
- `../../` → `.github/orchestration/`
- `../../../` → `.github/`
- `../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers` → `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` ✅

`readFile` is already used in `state-io.js` (same directory) via the same import path. The same pattern applies here.

#### 4-B: Updated `handlePlanApproved` Function

Replace the current `handlePlanApproved` (`.github/orchestration/scripts/lib/pre-reads.js`, lines 27–37) with:

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

**Key design properties**:

| Property | Behavior |
|----------|----------|
| Backward compatibility | If `context.doc_path` is present, the existing code path runs unchanged |
| State derivation | Only activates when `context.doc_path` is absent; reads state.json via `readFile` |
| Precondition | `plan_approved` can only be signaled after `master_plan_completed`, so `steps[4].doc_path` is always set when this handler runs |
| Relative path resolution | If the stored path is relative, it is joined with `projectDir` to produce an absolute path |
| Failure mode | Returns `success: false` with a descriptive human-readable error rather than throwing |

**Signature note**: `projectDir` is already passed as the third argument by `preRead` (`return handler(context, readDocument, projectDir)`). The updated function signature accepts it; no changes to the dispatch logic are required.

#### 4-C: Event Signaling Reference Update (in `orchestrator.agent.md`)

In the Event Signaling Reference table, update the `plan_approved` row:

| Event | Current context column | Updated context column |
|-------|----------------------|----------------------|
| `plan_approved` | `{}` | `{}` or optionally `{ "doc_path": "<master-plan-path>" }` — if omitted, the handler derives the path from state |

Routing table entry #13 (`request_plan_approval`) must remove any implied `doc_path` requirement from its description. The `plan_approved` event no longer requires the Orchestrator to supply the master plan path.

---

### Goal 5 — `state-io.js`: CWD-Independent Config Path + Agent Hardening

#### 5-A: `state-io.js` Code Change — Primary Fix

**File**: `.github/orchestration/scripts/lib/state-io.js`  
**Function**: `readConfig` (the fallback branch when `configPath` is not supplied)

**Current code** (line ~78):
```javascript
  if (!resolvedPath) {
    resolvedPath = path.join(process.cwd(), '.github', 'orchestration.yml');
  }
```

**Target code** (one line changed):
```javascript
  if (!resolvedPath) {
    resolvedPath = path.resolve(__dirname, '../../../orchestration.yml');
  }
```

**Path derivation verification**:
```
__dirname = <workspace>/.github/orchestration/scripts/lib
../        → <workspace>/.github/orchestration/scripts/
../../     → <workspace>/.github/orchestration/
../../../  → <workspace>/.github/
../../../orchestration.yml → <workspace>/.github/orchestration.yml  ✅
```

The `path` module is already required at the top of `state-io.js`. No additional import is needed.

**Change scope**: One assignement line in `readConfig`. Zero effect on `readState`, `writeState`, or `readDocument` — those use absolute `projectDir` from the `--project-dir` flag and are already CWD-independent.

#### 5-B: `coder.agent.md` — CWD Restoration Step — Tertiary Hardening

**Location**: `coder.agent.md` → "Workflow" section → insert as a new step **between the current step 9 (Run build) and step 10 (Check acceptance criteria)**. Renumber subsequent steps accordingly.

```markdown
10. **Restore the working directory**: After running any terminal commands inside a project subdirectory, restore CWD to the workspace root before continuing:
    ```
    cd <workspace-root>
    ```
    Failure to restore CWD will silently break all subsequent `pipeline.js` invocations in this run.
```

*(Steps 10–12 in the existing workflow become 11–13 after insertion.)*

---

## Dependencies

### New External Dependencies

None. All changes use Node built-in modules (`path`) and an existing internal utility already used elsewhere in the same script directory.

### New Internal Dependencies

| New Dependency | Added to | Reason |
|----------------|----------|--------|
| `path` (Node built-in) | `pre-reads.js` | Resolve `state.json` path and normalize relative `doc_path` values |
| `readFile` from `fs-helpers` | `pre-reads.js` | Read `state.json` to derive master plan path |

### Internal Module Dependency Graph (changes only)

```
pre-reads.js → fs-helpers (readFile)       [NEW]
pre-reads.js → path (Node built-in)        [NEW]
state-io.js  → path (__dirname resolution) [already imported; usage extended]
mutations.js → (unchanged)
```

---

## File Structure

All changes are to existing files. No new files are created.

```
.github/
├── agents/
│   ├── orchestrator.agent.md          # Goals 2, 3, 4, 5 — 5 text additions
│   └── coder.agent.md                 # Goal 5 — 1 CWD restoration step
├── orchestration/
│   └── scripts/
│       ├── lib/
│       │   ├── mutations.js            # Goal 1 — NO RUNTIME CHANGE (already correct)
│       │   ├── pre-reads.js            # Goal 4 — +2 imports, updated handlePlanApproved
│       │   └── state-io.js             # Goal 5 — 1-line change in readConfig
│       └── tests/
│           ├── mutations.test.js       # Goal 1 — +2 unit tests for handleTaskHandoffCreated
│           └── pipeline-behavioral.test.js  # Goal 1 — +Category 11 corrective flow
```

---

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Backward compatibility | `handlePlanApproved`: honors `context.doc_path` when present — state derivation is the fallback only. `handleTaskHandoffCreated`: clearing is a no-op when fields are null. `readConfig`: produces the same path when CWD is already correct. |
| Idempotency | Presence-based guards in `handleTaskHandoffCreated` guarantee zero side-effects when `report_doc` and `review_doc` are null (first-time handoffs). |
| Error signaling | New `handlePlanApproved` failure paths return `{ success: false, error: '...' }` with descriptive messages. Never throw — consistent with the rest of `pre-reads.js`. |
| Test isolation | Category 11 must use the same shared-IO sequential execution pattern as Categories 1–10. State must not leak into any subsequent category. |
| No regression | `mutations.js` has zero runtime changes. All existing tests in `mutations.test.js`, `pipeline-behavioral.test.js`, and `resolver.test.js` must pass without modification. |
| Agent instruction enforcement | Self-healing hierarchy and event-loop rules in `orchestrator.agent.md` are the only enforcement mechanism. Rules must be placed in highest-attention sections ("What you do NOT do" and "Error Handling") with hard-prohibition phrasing — not guidelines. |
| `state.json` edits (Level 2 self-healing) | Orchestrator is only authorized to null or clear stale fields. Setting any field to a non-null value that was not returned by a pipeline result is prohibited by the self-healing hierarchy. |

---

## Phasing Recommendations

Three phases are recommended, each independently reviewable. Every phase boundary corresponds to a stable, testable state.

### Phase 1 — Script Fixes + Unit Tests

| Scope | Files | FRs Addressed |
|-------|-------|---------------|
| `mutations.test.js`: add T1 + T2 unit tests | `mutations.test.js` | FR-2, FR-3 |
| `pre-reads.js`: add imports + updated `handlePlanApproved` | `pre-reads.js` | FR-10, FR-11 |
| `state-io.js`: replace `process.cwd()` with `__dirname`-relative path | `state-io.js` | FR-12 |

**Exit criteria**:
- T1 and T2 in `mutations.test.js` pass
- All pre-existing tests in `mutations.test.js` still pass
- A `plan_approved` event with `{}` context (no `doc_path`) succeeds in a test or manual run
- `readConfig` returns correct config when called from a non-root working directory

### Phase 2 — Behavioral Test Coverage

| Scope | Files | FRs Addressed |
|-------|-------|---------------|
| `pipeline-behavioral.test.js`: add Category 11 corrective task flow | `pipeline-behavioral.test.js` | FR-4 |

**Exit criteria**:
- All three assertions in Category 11 pass (`execute_task` returned; stale fields null; `status=in_progress`, `handoff_doc` set correctly)
- All existing Categories 1–10 still pass

### Phase 3 — Agent Instruction Updates

| Scope | Files | FRs Addressed |
|-------|-------|---------------|
| `orchestrator.agent.md`: Additions A, B (What you do NOT do), C (self-healing hierarchy), D (valid pause points), E (pipeline invocation rule) | `orchestrator.agent.md` | FR-6, FR-7, FR-8, FR-9, FR-11, FR-13 |
| `coder.agent.md`: CWD restoration step | `coder.agent.md` | FR-14 |

**Exit criteria**:
- Reviewer agent confirms FR-6, FR-7, FR-8, FR-9, FR-13, FR-14 are present and correctly worded in the target files
- No existing instruction text in either file is removed or broken
- Event Signaling Reference table `plan_approved` row updated to show `doc_path` as optional
- Routing table entry #13 (`request_plan_approval`) updated to remove implied `doc_path` requirement

---

## Source Document References

| Document | Path | Status |
|----------|------|--------|
| PRD | `.github/projects/V3-FIXES/V3-FIXES-PRD.md` | Draft |
| Design | `.github/projects/V3-FIXES/V3-FIXES-DESIGN.md` | Draft |
| Research Findings | `.github/projects/V3-FIXES/V3-FIXES-RESEARCH-FINDINGS.md` | Draft |
