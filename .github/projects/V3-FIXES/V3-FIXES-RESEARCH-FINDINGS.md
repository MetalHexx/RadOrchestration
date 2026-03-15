---
project: "V3-FIXES"
author: "research-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Research Findings

## Research Scope

Investigated the pipeline mutation engine (`mutations.js`, `pre-reads.js`, `resolver.js`, `pipeline-engine.js`, `state-io.js`), the Orchestrator agent instructions, and both live error logs (RAINBOW-HELLO, UI-MARKDOWN-IMPROVEMENTS) to characterize five bugs surfaced during real pipeline runs and determine the correct fix direction for each.

---

## Codebase Analysis

### Goal 1 — Corrective Task Flow in `mutations.js`

#### The Corrective Task Flow (Full Trace)

```
code_review_completed (changes_requested)
  → handleCodeReviewCompleted sets:
      task.status = 'failed'
      task.review_action = 'corrective_task_issued'
      task.retries += 1
      task.review_doc = <path>
      task.review_verdict = 'changes_requested'
      phase.current_task unchanged (stays at failing task index)

  → resolver sees: status='failed', review_action='corrective_task_issued'
  → returns: { action: 'create_task_handoff', context: { is_correction: true, ... } }

  → Orchestrator spawns Tactical Planner to create corrective handoff

task_handoff_created (doc_path = <new corrective handoff>)
  → handleTaskHandoffCreated:
      if (task.report_doc) → clear report_doc, report_status
      if (task.review_doc) → clear review_doc, review_verdict, review_action
      task.handoff_doc = context.doc_path
      task.status = 'in_progress'

  → resolver sees: status='in_progress', handoff_doc set, report_doc null, review_doc null
  → returns: { action: 'execute_task' }  ✅
```

#### The Pre-Fix State (What Broke)

Before the Orchestrator's mid-run fix, `handleTaskHandoffCreated` only set `handoff_doc` and `status = in_progress` without clearing stale fields. Post-mutation state had:
- `status = in_progress`, `handoff_doc` set
- `report_doc` set (from prior run)
- `review_doc` set (from prior run)

The resolver had no branch for `in_progress + handoff + report + review` simultaneously → `display_halted`.

#### Current Implementation Analysis

**File**: `.github/orchestration/scripts/lib/mutations.js`  
**Function**: `handleTaskHandoffCreated` (lines 211–233)

```javascript
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
  ...
}
```

**The fix is architecturally correct.** Reasons:
1. **Idempotent**: On first-time handoff, `report_doc` and `review_doc` are always `null`, so clearing is a no-op. No false clearing on initial runs.
2. **Presence-based guard is correct**: Checks actual field state instead of `context.is_correction`, which means it works even if the context flag is omitted.
3. **Right event boundary**: `task_handoff_created` is semantically "a new execution cycle begins for this task" — clearing stale state here is logically sound. Clearing at `code_review_completed` would mean the state is dirty between review completion and handoff creation (across two separate pipeline calls), which is a longer window with undefined intermediate state.
4. **Resolver compatibility**: After this fix, the resolver's corrective branch correctly matches: `status=failed, review_action=corrective_task_issued` → `create_task_handoff`. Then after `task_handoff_created`, the state matches: `status=in_progress, handoff_doc set, report_doc null, review_doc null` → `execute_task`. ✅

**Note on error log discrepancy**: The UI-MARKDOWN-IMPROVEMENTS error log states the Orchestrator added an `is_correction` check, but the current code uses presence-based checking (`if (task.report_doc)`). The current implementation is the cleaner approach and does not need to be reverted.

#### `handleCodeReviewCompleted` Dangling-Else: Status

**File**: `.github/orchestration/scripts/lib/mutations.js` (lines 298–320)

```javascript
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

**All three branches are present and correct.** No dangling-else issue exists in the current code. The brainstorming doc mentioned this as something to verify — it is confirmed sound.

#### Test Coverage Gaps

| Test Location | Coverage | Gap |
|---|---|---|
| `mutations.test.js` — `handleTaskHandoffCreated` | Only happy path (fresh task, no prior state) | **No test for corrective scenario** — task with pre-populated `report_doc`/`review_doc` passed to handler |
| `mutations.test.js` — `handleCodeReviewCompleted` | All verdict branches covered (approved, changes_requested+retries, changes_requested+exhausted, rejected) | None |
| `pipeline-behavioral.test.js` | Categories 1–10 (15 sequential events for happy path; multi-phase, halt paths, pre-read failures, cold-start) | **No corrective flow category** — no end-to-end test for: `code_review_completed(changes_requested)` → `task_handoff_created` (corrective) → `execute_task` → re-review |
| `resolver.test.js` | Has `is_correction: true` test (line 234) for resolver output | ✅ Resolver side covered |

**Required new tests**:
1. `mutations.test.js`: `handleTaskHandoffCreated` with pre-populated `report_doc` and `review_doc` — assert they are nulled and mutation log entries are emitted
2. `mutations.test.js`: `handleTaskHandoffCreated` with no prior docs — assert no clearing mutation entries are emitted (idempotency)
3. `pipeline-behavioral.test.js`: New Category 11 (or similar) — full corrective flow: inject task in `failed/corrective_task_issued` state → `task_handoff_created` → assert `execute_task` returned, `report_doc=null`, `review_doc=null`, `review_action=null`

---

### Goal 2 — Orchestrator Self-Healing Hierarchy

**File**: `.github/agents/orchestrator.agent.md`

#### Current State

**"What you do NOT do" section** contains:
- "Never write, create, or modify any file — you are read-only"
- "Never make planning, design, or architectural decisions"
- "Never manage state mutations or validation"
- "Never route based on reading state.json fields"

**"Error Handling" section** contains:
1. Log the error (invoke `log-error` skill)
2. Display `result.error` to human
3. Halt — do not attempt automatic recovery

#### Gaps

| Gap | Location Needed |
|---|---|
| No prohibition specifically against modifying pipeline source files (`mutations.js`, `pipeline-engine.js`, agent `.md` files) | Both "What you do NOT do" and Error Handling |
| No positive self-healing hierarchy (re-signal → state.json edit → halt) | Error Handling section |
| No rule that `state.json` edits must be conservative (null/clear only, never invent values) | Error Handling section |
| The "Never write any file" rule is general but doesn't call out the self-healing decision tree | Error Handling section |

#### Where the Rule Should Live

- **"What you do NOT do"**: Add explicit prohibition: "Never modify pipeline source files (`mutations.js`, `pipeline-engine.js`, `.agent.md` files, skills) as a self-healing action — this is never acceptable."
- **"Error Handling"**: Add a self-healing hierarchy before the 3-step failure protocol: for cases where the Orchestrator can diagnose a recoverable pipeline state (e.g., stale fields), the correct actions are (1) re-signal the correct event, (2) clear stale fields in `state.json` directly as a last resort, (3) log and halt if neither works.

---

### Goal 3 — Orchestrator Event-Loop Discipline

**File**: `.github/agents/orchestrator.agent.md`

#### Current State

**"Loop Termination" section** states:
> "The loop terminates when `result.action` is `display_halted` or `display_complete`. These are terminal actions with no follow-up event."

**"What you do NOT do" section** has NO rule about not pausing mid-loop.

**"Error Handling"** defines a 3-step protocol ending with "Halt" for pipeline errors — but does NOT distinguish between:
- Pipeline `success: false` (halt is correct)
- Non-pipeline side-tasks completing (error logging, workaround application) — loop should resume

#### Gap

The Orchestrator lacks a concise rule prohibiting it from asking "want me to continue?" after completing side-tasks. During the RAINBOW-HELLO run (Error 3), after applying the CWD workaround and logging it, the Orchestrator conflated "I completed a side-task" with "I should pause for human confirmation."

**The only valid pause points are**:
- `display_halted` (terminal)
- `display_complete` (terminal)
- `request_plan_approval` (human gate)
- `request_final_approval` (human gate)
- `gate_task` (human gate)
- `gate_phase` (human gate)

All `result.action` values not in this list must be actioned immediately without human check-in.

**Required addition to "What you do NOT do"**: Add: "Never ask the human 'should I continue?' after completing a non-terminal side-task (error logging, status reporting, workaround). The event loop is continuous — resume immediately after any non-gate, non-terminal action."

---

### Goal 4 — `plan_approved` Context Payload Mismatch

**File**: `.github/orchestration/scripts/lib/pre-reads.js` — `handlePlanApproved` (lines 27–37)

```javascript
function handlePlanApproved(context, readDocument) {
  const { ok, frontmatter, result } = readOrFail(readDocument, context.doc_path, 'plan_approved');
  if (!ok) return result;
  const n = frontmatter.total_phases;
  ...
  return success({ ...context, total_phases: n });
}
```

**File**: `.github/agents/orchestrator.agent.md` — Event Signaling Reference table

```
| `plan_approved` | `{}` | After human approves master plan |
```

**Routing table entry #13**: `request_plan_approval` — "Display Master Plan summary to the human. Ask human to approve or reject." — **no mention of doc_path payload requirement**.

#### Root Cause

`handlePlanApproved` requires `context.doc_path` to read `total_phases` from the master plan frontmatter. Neither the event signaling table nor the routing table entry tell the Orchestrator to include `doc_path` when signaling `plan_approved`.

#### Can the Pre-Read Avoid `doc_path`?

**Yes — via state derivation.** The `preRead` entry point already receives `projectDir`:

```javascript
function preRead(event, context, readDocument, projectDir) {
  const handler = PRE_READ_HANDLERS[event];
  if (!handler) return success(context);
  return handler(context, readDocument, projectDir);  // projectDir passed
}
```

After `master_plan_completed`, `state.planning.steps[4].doc_path` always contains the master plan path. The pre-read handler could read `state.json` from `projectDir` and derive `doc_path` from there, removing the burden from the Orchestrator entirely.

**Trade-off analysis**:

| Approach | Pros | Cons |
|---|---|---|
| **A: Documentation-only fix** — Update event table and routing table to require `doc_path` | Zero code change | Same fragility for future Orchestrator implementations; requires Orchestrator to remember to include it |
| **B: State-derivation fix** — `handlePlanApproved` reads `state.json` to get master plan path | Orchestrator context can be `{}` as documented; more robust | Adds a new I/O pattern to `pre-reads.js`; `preRead` currently only reads *documents*, not state |
| **C: Hybrid + fallback** — Accept `doc_path` from context if present, else derive from state | Backward compatible; eliminates failure mode | More complex guard in handler |

The cleanest approach for this scoped fix project is **Option C**: modify `handlePlanApproved` to derive `doc_path` from state if `context.doc_path` is absent, with a `readFile(path.join(projectDir, 'state.json'))` fallback. This eliminates the mismatch entirely without changing the documented API surface (Orchestrator can still pass `doc_path` if it wants, but it's no longer required).

**If opted for documentation-only fix (Option A)**: Both the event signaling table and routing table #13 must be updated to document the required `{ "doc_path": "<master-plan-path>" }` payload.

---

### Goal 5 — CWD Drift After Coder Agent Execution

#### CWD Usage Audit (All Scripts)

| File | CWD-Dependent? | Pattern | Notes |
|---|---|---|---|
| `pipeline.js` | **No** for requires | Uses `require('./lib/pipeline-engine')` (relative to `__dirname`) | ✅ Internal requires are safe |
| `state-io.js` line 78 | **Yes** | `path.join(process.cwd(), '.github', 'orchestration.yml')` | ⚠️ CWD-dependent when `--config` not provided |
| `state-io.js` — `readState` | No | `path.join(projectDir, 'state.json')` — uses absolute `projectDir` from `--project-dir` flag | ✅ |
| `state-io.js` — `readDocument` | Potentially | Opens `docPath` directly; if paths in state are relative, depends on CWD | ⚠️ Risk if doc_path values are relative |
| `state-io.js` — imports | No | Relative requires to `validate-orchestration/scripts/lib/utils/...` | ✅ |

The primary CWD issue in the pipeline script itself:
- When the Orchestrator invokes `node .github/orchestration/scripts/pipeline.js ...` with a **relative path**, Node resolves this from `process.cwd()` — so if CWD is wrong, Node fails to find `pipeline.js` at all.
- Even if Node finds the script, `state-io.js#readConfig` falls back to `process.cwd()` for config discovery.

#### Fix Analysis

| Fix | Scope | Robustness |
|---|---|---|
| **`state-io.js`: Use `__dirname`-relative config path** | `readConfig` fallback: `path.resolve(__dirname, '..', '..', '..', 'orchestration.yml')` — resolves to `.github/orchestration.yml` | High — config discovery no longer depends on CWD |
| **Orchestrator agent**: Always prefix pipeline call with `cd <workspace-root>;`  | `orchestrator.agent.md` — add pipe execution rule | Medium — depends on Orchestrator following the rule |
| **Orchestrator agent**: Always invoke pipeline.js with absolute path | `orchestrator.agent.md` — use `path.resolve` or `$WORKSPACE_ROOT` | Medium — same dependence on rule-following |
| **Coder agent**: Restore CWD at end of task | `coder.agent.md` — add post-task restoration step | Low alone — only prevents the drift at source |

**Correct path derivation for `state-io.js`**:

```
.github/orchestration/scripts/lib/state-io.js
  → __dirname = .../lib/
  → path.resolve(__dirname, '..', '..', '..', 'orchestration.yml')
  = .../  (workspace root)  /.github/orchestration.yml   ❌ Wrong
```

Actually the correct resolution:
```
__dirname = <repo>/.github/orchestration/scripts/lib
path.resolve(__dirname, '../../../../..') = <repo>
path.resolve(__dirname, '..', '..', '..') = <repo>/.github

Actually needs:
path.resolve(__dirname, '../../../../orchestration.yml')
= <repo>/.github/orchestration.yml  ✅
```

Wait — let me count:
- `__dirname` = `<repo>/.github/orchestration/scripts/lib`
- `../` = `<repo>/.github/orchestration/scripts`
- `../../` = `<repo>/.github/orchestration`
- `../../../` = `<repo>/.github`
- `../../../orchestration.yml` = `<repo>/.github/orchestration.yml` ✅

**Recommended primary fix**:
```javascript
// state-io.js readConfig — replace:
resolvedPath = path.join(process.cwd(), '.github', 'orchestration.yml');
// with:
resolvedPath = path.resolve(__dirname, '../../../orchestration.yml');
```

**Coder agent**: Currently has no CWD restoration instructions. The `coder.agent.md` workflow ends at saving the Task Report — no post-task cleanup step. Needs an explicit rule: "Restore the working directory to the workspace root after running any terminal commands in a subdirectory."

---

## Key Patterns Discovered

| Pattern | Location | Relevance |
|---|---|---|
| Event → Mutation → Validate → Write → Resolve (linear recipe) | `pipeline-engine.js#processEvent` | All fixes must preserve this single-pass invariant |
| State mutations are shallow — only current task/phase written | `mutations.js` helper functions | Clearing stale fields is safe; no cascading side-effects |
| `preRead` receives `projectDir` but current handlers don't use it | `pre-reads.js#preRead` | Goal 4 fix can derive state without changing function signatures |
| `state-io.js` uses `process.cwd()` exactly once for config discovery | `state-io.js` line 78 | Only one CWD-dependent path in the codebase |
| Test helpers use `delete state.project.updated` for V13 bypass | `pipeline-behavioral.test.js` | New behavioral tests must follow the same pattern |
| All `require()` calls in scripts use `__dirname`-relative paths except one | `state-io.js` | The CWD fix is a targeted 1-line change |
| `is_correction` flag flows from resolver context to Orchestrator | `resolver.js#resolveTask` | The flag is present but `handleTaskHandoffCreated` uses presence-checking instead — both work |

---

## Constraints Discovered

- **Test framework**: Node built-in test runner (`node:test` + `node:assert/strict`) — no Jest, no Mocha. New tests must follow the same `describe/it/beforeEach` pattern from `node:test`.
- **Behavioral tests use shared mutable IO state**: Categories 1–2 in `pipeline-behavioral.test.js` depend on sequential execution order within each `describe` block. New corrective flow category must be structured the same way.
- **`mutations.test.js` helper `makeExecutionState` lacks `report_status`**: The task objects it creates have no `report_status` field. Tests for the corrective clearing path must build task objects with `report_status` populated explicitly.
- **`handleTaskHandoffCreated` fix does NOT check `context.is_correction`**: If the Architect decides context-based (not presence-based) clearing is preferred, this changes the API contract and also impacts behavioral tests.
- **Orchestrator agent instructions are the only control mechanism**: There is no runtime enforcement of self-healing hierarchy rules — the agent's behavior depends entirely on what is written in `orchestrator.agent.md`.
- **`pre-reads.js` has no existing `readState` dependency**: Adding state-reading to the pre-read layer requires adding either a `readFile` import (already available via `fs-helpers`) or a state-read injection — minimal but a real change.
- **Document paths in state may be relative**: `state.planning.steps[4].doc_path` holds whatever path the Orchestrator passed to `master_plan_completed`. If it's a relative path, using it in the pre-read works as long as `readDocument` is called from the correct CWD or the implementation resolves relative to projectDir.

---

## Recommendations

| # | Goal | Recommended Direction |
|---|---|---|
| 1a | Corrective task flow fix | **Confirm as correct** — the `handleTaskHandoffCreated` presence-based clearing is architecturally sound. No revert or re-implementation needed. |
| 1b | Test coverage | **Add 3 missing tests**: (1) `mutations.test.js` — corrective scenario with pre-populated fields; (2) `mutations.test.js` — idempotency when fields are null; (3) `pipeline-behavioral.test.js` — new Category 11 covering full corrective task end-to-end flow. |
| 1c | `handleCodeReviewCompleted` else-if | **Confirm as correct** — all three branches (ADVANCED, CORRECTIVE\_TASK\_ISSUED, HALTED) are present. No action needed. |
| 2 | Self-healing hierarchy | **Update `orchestrator.agent.md`** — add explicit prohibition of source file edits to "What you do NOT do"; add positive self-healing hierarchy (re-signal → state.json clear → log+halt) to Error Handling section. |
| 3 | Event-loop discipline | **Update `orchestrator.agent.md`** — add rule to "What you do NOT do": never ask "should I continue?" after non-terminal side-tasks. List the six valid pause points explicitly. |
| 4 | `plan_approved` mismatch | **Recommend Option C (hybrid fix)**: Modify `handlePlanApproved` in `pre-reads.js` to derive `doc_path` from state if not present in context. Requires reading `state.json` from `projectDir`. Also update event signaling table and routing table #13 to document the optional `doc_path` field for clarity. |
| 5a | CWD drift — primary | **Fix `state-io.js`**: Replace `process.cwd()` with `path.resolve(__dirname, '../../../orchestration.yml')` in `readConfig` fallback (line 78). |
| 5b | CWD drift — secondary | **Update `orchestrator.agent.md`** — add rule: always invoke `pipeline.js` with an absolute path or prefix with `cd <workspace-root>;`. |
| 5c | CWD drift — tertiary | **Update `coder.agent.md`** — add post-task cleanup step: restore working directory to workspace root after running any commands in a project subdirectory. |

---

## Source Index

| File | Path | Goals |
|---|---|---|
| mutations.js | `.github/orchestration/scripts/lib/mutations.js` | 1, 4 |
| pre-reads.js | `.github/orchestration/scripts/lib/pre-reads.js` | 1, 4 |
| resolver.js | `.github/orchestration/scripts/lib/resolver.js` | 1 |
| pipeline-engine.js | `.github/orchestration/scripts/lib/pipeline-engine.js` | 1, 4, 5 |
| state-io.js | `.github/orchestration/scripts/lib/state-io.js` | 5 |
| constants.js | `.github/orchestration/scripts/lib/constants.js` | 1 |
| pipeline.js | `.github/orchestration/scripts/pipeline.js` | 5 |
| mutations.test.js | `.github/orchestration/scripts/tests/mutations.test.js` | 1 |
| pipeline-behavioral.test.js | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | 1 |
| resolver.test.js | `.github/orchestration/scripts/tests/resolver.test.js` | 1 |
| orchestrator.agent.md | `.github/agents/orchestrator.agent.md` | 2, 3, 4, 5 |
| coder.agent.md | `.github/agents/coder.agent.md` | 5 |
| RAINBOW-HELLO-ERROR-LOG.md | `.github/projects/V3-FIXES/RAINBOW-HELLO-ERROR-LOG.md` | 2, 3, 4, 5 |
| UI-MARKDOWN-IMPROVEMENTS-ERROR-LOG.md | `.github/projects/V3-FIXES/UI-MARKDOWN-IMPROVEMENTS-ERROR-LOG.md` | 1 |
| PIPELINE-SIMPLIFICATION-MASTER-PLAN.md | `.github/projects/_archived/PIPELINE-SIMPLIFICATION/PIPELINE-SIMPLIFICATION-MASTER-PLAN.md` | Context |
