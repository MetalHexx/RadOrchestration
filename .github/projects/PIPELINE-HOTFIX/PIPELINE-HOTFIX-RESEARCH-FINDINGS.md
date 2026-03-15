---
project: "PIPELINE-HOTFIX"
author: "research-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Research Findings

## Research Scope

Investigated the 6 bugs discovered during the RAINBOW-HELLO benchmark run that prevent end-to-end pipeline execution. Research focused on exact code locations, function signatures, conditional logic, and test patterns for each bug site, plus the skill/template structure needed for the new `log-error` skill.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Pipeline Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Central orchestration loop; task report pre-read pattern (lines 131–148); resolve step (line 200); site for master plan pre-read (Error 1), status normalization (Error 3), `advance_phase` internal handling (Error 5), unmapped action guard |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | All 18 event handlers; `handlePlanApproved` (lines 102–113, Error 1); `applyTaskTriage` (lines 269–309, Error 4); `applyPhaseTriage` (lines 318–358, Error 4) |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | `resolveTaskLifecycle` (lines 115–195, Errors 2 & 5); `resolvePhaseLifecycle` (lines 206–260); `resolveExecution` (lines 271–300, Error 1 indirect) |
| Triage Engine | `.github/orchestration/scripts/lib/triage-engine.js` | Task decision table Row 1 (lines 146–152); phase Row 1 (lines 303–308); `executeTriage` entry point (lines 433–526) |
| State Validator | `.github/orchestration/scripts/lib/state-validator.js` | V1 check `checkV1` (lines 74–82, Error 6) |
| Constants | `.github/orchestration/scripts/lib/constants.js` | `NEXT_ACTIONS` enum (35 values, lines 193–266); all status/verdict/action enums |
| State I/O | `.github/orchestration/scripts/lib/state-io.js` | `readDocument` (lines 130–142); `readState`/`writeState`; dependency injection target for pipeline engine |
| Mutations Tests | `.github/orchestration/scripts/tests/mutations.test.js` | 896 lines; fixture factories `makeBaseState` / `makeExecutionState`; `applyTaskTriage` / `applyPhaseTriage` test patterns (lines 710–896) |
| Pipeline Engine Tests | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | 1013 lines; `createMockIO` factory; `createExecutionState` helper; triage flow tests (lines 752–880); task report pre-read tests (lines 940–1013) |
| generate-task-report Skill | `.github/skills/generate-task-report/SKILL.md` | Status classification table (Error 3); template frontmatter |
| Task Report Template | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Frontmatter `status` field — currently `"complete|partial|failed"` (line 6, Error 3) |
| Master Plan Template | `.github/skills/create-master-plan/templates/MASTER-PLAN.md` | Frontmatter fields — currently lacks `total_phases` (Error 1) |
| Orchestrator Agent | `.github/agents/orchestrator.agent.md` | 18-action routing table; error handling section (line 91); no `log-error` skill reference yet |

### Existing Patterns

- **Pre-read pattern (pipeline-engine.js lines 131–148)**: Before the `task_completed` mutation runs, the engine reads the task report via `io.readDocument(context.report_path)`, extracts frontmatter fields (`status`, `severity`, `has_deviations`), and injects them into the `context` object. The mutation handler then receives these enriched values as pure inputs. This pattern should be replicated for `plan_approved` → master plan pre-read.

- **Mutation handler pattern (mutations.js)**: Each handler is a pure function `(state, context) → { state, mutations_applied }`. Handlers mutate the state object in-place and return a list of human-readable mutation descriptions. No I/O, no side effects.

- **Triage application pattern (mutations.js lines 269–358)**: `applyTaskTriage` and `applyPhaseTriage` receive a `triageResult` object from the triage engine. They check for `null/null` verdict/action as a skip case (return empty mutations). Otherwise they increment `triage_attempts`, write verdict/action to the task/phase, and branch by action (`advanced`, `corrective_task_issued`, `halted`).

- **Mock I/O pattern (pipeline-engine.test.js lines 24–60)**: `createMockIO` returns an object with `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories` methods plus accessor helpers (`getState`, `getWrites`, `getEnsureDirsCalled`). Documents are provided as a `Record<string, { frontmatter, body }>` map.

- **Test fixture pattern (mutations.test.js lines 17–110)**: `makeBaseState()` creates a planning-tier state; `makeExecutionState()` creates an execution-tier state with 1 phase and 2 tasks. Both use `clone()` (JSON round-trip) for isolation.

- **Skill directory structure**: Each skill is a folder under `.github/skills/{name}/` containing `SKILL.md` (with frontmatter `name` and `description`) and optionally a `templates/` subfolder with template markdown files.

- **Internal vs. external actions**: The resolver returns 35 distinct `NEXT_ACTIONS` values. The Orchestrator's routing table handles 18 external actions. The remaining 17 are internal mechanical actions that the pipeline was designed to handle internally but currently doesn't for all cases.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | Built-ins only | CommonJS, `'use strict'`, shebang line |
| Testing | `node:test` + `node:assert/strict` | Built-in | `describe`/`it` pattern, no external test runner |
| Dependencies | Zero npm deps | N/A | Shared utilities from `validate-orchestration` skill |
| Config | YAML | orchestration.yml | Parsed by shared `yaml-parser.js` |
| Documents | Markdown + YAML frontmatter | N/A | Parsed by shared `frontmatter.js` |

## Detailed Bug-Site Analysis

### Error 1: `handlePlanApproved` — Phase Array Not Initialized

**File**: [mutations.js](/.github/orchestration/scripts/lib/mutations.js#L102-L113)

**Current implementation**:
```javascript
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress'
    ]
  };
}
```

**Problem**: Sets tier to `execution` and status to `in_progress`, but does NOT:
- Populate `execution.phases[]` (stays `[]`)
- Set `execution.total_phases` (stays `0`)

**Downstream impact**: The resolver's `resolveExecution` (resolver.js line 283) checks `if (currentPhaseIndex >= phases.length)` — with `current_phase = 0` and `phases.length = 0`, this is `true`, so it immediately returns `transition_to_review`, skipping the entire execution tier.

**Pre-read site**: The master plan path is already stored in `state.planning.steps.master_plan.output`. The pipeline engine should read it via `io.readDocument()` before calling the mutation, extracting `total_phases` from frontmatter and injecting it into the context.

**Pipeline engine insertion point**: [pipeline-engine.js](/.github/orchestration/scripts/lib/pipeline-engine.js#L128-L131) — just before the `task_completed` pre-read block (line 131), add a parallel block for `plan_approved`:
```javascript
// Master plan pre-read: enrich context before passing to mutation
if (event === 'plan_approved') {
  const masterPlanPath = currentState.planning.steps.master_plan.output;
  // ... read document, extract total_phases from frontmatter, inject into context
}
```

**Master plan template change**: [MASTER-PLAN.md](/.github/skills/create-master-plan/templates/MASTER-PLAN.md#L1-L6) — current frontmatter:
```yaml
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
```
Needs `total_phases: {NUMBER}` added.

---

### Error 2: Resolver Returns `update_state_from_task` for In-Progress Tasks

**File**: [resolver.js](/.github/orchestration/scripts/lib/resolver.js#L139-L143)

**Current implementation** — `resolveTaskLifecycle`, `in_progress` branch:
```javascript
// ── in_progress ───────────────────────────────────────────────────────
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, {
    ...baseOpts,
    details: 'Task ' + taskId + ' is in progress; checking Coder results and recording'
  });
}
```

**Problem**: After `task_handoff_created` sets `task.status = in_progress` and `task.handoff_doc = <path>`, the resolver always returns `update_state_from_task` — an internal mechanical action that is NOT in the Orchestrator's 18-action routing table.

**Expected behavior**: When a task is `in_progress` with a `handoff_doc` but no `report_doc`, the resolver should return `execute_task` (spawn Coder). The `update_state_from_task` action should only be returned when the task has already been executed (i.e., has a `report_doc`).

**Fix location**: [resolver.js lines 139–143](/.github/orchestration/scripts/lib/resolver.js#L139-L143) — add a conditional check:
```javascript
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  if (task.handoff_doc && !task.report_doc) {
    return makeResult(NEXT_ACTIONS.EXECUTE_TASK, { ... });
  }
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, { ... });
}
```

**Constant values**: `NEXT_ACTIONS.EXECUTE_TASK = 'execute_task'`, `NEXT_ACTIONS.UPDATE_STATE_FROM_TASK = 'update_state_from_task'` (constants.js lines 222, 223).

---

### Error 3: Task Report Status Vocabulary Mismatch

**Skill file**: [generate-task-report/SKILL.md](/.github/skills/generate-task-report/SKILL.md#L38-L44)

**Current status classification table**:
```
| Status | Meaning | Planner Action |
|--------|---------|----------------|
| `complete` | All acceptance criteria met, tests pass, build passes | Mark task complete, advance |
| `partial` | Some criteria met, minor issues remain | Check severity → auto-retry or escalate |
| `failed` | Blocking issues, build broken, critical errors | Check severity → halt or corrective task |
```

**Template frontmatter**: [TASK-REPORT.md](/.github/skills/generate-task-report/templates/TASK-REPORT.md#L6):
```yaml
status: "complete|partial|failed"
```

**Problem**: While the template and skill correctly specify `complete|partial|failed`, the Coder used `pass` instead of `complete`. The triage engine's decision table (triage-engine.js) only matches `reportStatus === 'complete'`, `'partial'`, or `'failed'` — `'pass'` falls through to the defensive fallback at line 265: `No decision table row matched for report_status='pass'`.

**Two-part fix**:
1. **Skill template**: Make the constraint more prominent — add explicit instruction text, not just the status table
2. **Pipeline engine normalization**: Add a ~3-line normalizer in the task report pre-read block (pipeline-engine.js lines 131–148) that maps `pass` → `complete`, `fail` → `failed`, and rejects unknown values

**Pre-read insertion point** (after line 140):
```javascript
// Normalize report status vocabulary
const statusMap = { 'pass': 'complete', 'fail': 'failed' };
if (statusMap[context.report_status]) {
  context.report_status = statusMap[context.report_status];
} else if (!['complete', 'partial', 'failed'].includes(context.report_status)) {
  return makeErrorResult(`Unrecognized task report status: '${context.report_status}'`, ...);
}
```

---

### Error 4: Triage Null/Null Auto-Approve Deadlock

**Triage engine Row 1** — [triage-engine.js](/.github/orchestration/scripts/lib/triage-engine.js#L146-L152):
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

**`applyTaskTriage` skip case** — [mutations.js](/.github/orchestration/scripts/lib/mutations.js#L269-L272):
```javascript
function applyTaskTriage(state, triageResult) {
  // Skip case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }
  // ...
```

**`applyPhaseTriage` skip case** — [mutations.js](/.github/orchestration/scripts/lib/mutations.js#L318-L321):
```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }
  // ...
```

**Problem**: The pipeline flow for a clean `task_completed`:
1. `handleTaskCompleted` sets `report_doc` but does NOT change `task.status` from `in_progress` (by design — status is set by triage)
2. Triage Row 1 matches (complete, no deviations, no review) → returns `verdict: null, action: null`
3. `applyTaskTriage` sees null/null → applies zero mutations → task stays `in_progress`
4. Resolver sees `in_progress` task → returns `update_state_from_task` → infinite loop

**Fix**: In the null/null skip case of both `applyTaskTriage` and `applyPhaseTriage`, when a `report_doc` exists (for tasks) or `phase_report` exists (for phases), treat it as auto-approval: set status to `complete`, verdict to `approved`, action to `advanced`, and advance the task/phase pointer.

**For `applyTaskTriage`**: When `verdict === null && action === null` and `triageResult.report_doc exists` (or check the task directly via `phase.tasks[triageResult.task_index]`):
- Set `task.status = TASK_STATUSES.COMPLETE`
- Set `task.review_verdict = REVIEW_VERDICTS.APPROVED`
- Set `task.review_action = REVIEW_ACTIONS.ADVANCED`
- Reset `triage_attempts = 0`

**For `applyPhaseTriage`**: Similar auto-approve when null/null:
- Set `phase.phase_review_verdict = REVIEW_VERDICTS.APPROVED`
- Set `phase.phase_review_action = PHASE_REVIEW_ACTIONS.ADVANCED`
- Reset `triage_attempts = 0`

**Note**: The triage engine's decision table itself is NOT modified — Row 1 still returns null/null. The callers (`applyTaskTriage`, `applyPhaseTriage`) handle the null/null → auto-approve translation.

**Existing test for skip case** — [mutations.test.js](/.github/orchestration/scripts/tests/mutations.test.js#L710-L718):
```javascript
it('skip case: returns mutations_applied: [] and makes no state changes', () => {
  const state = clone(makeExecutionState());
  const before = JSON.stringify(state);
  const result = applyTaskTriage(state, {
    verdict: null, action: null, phase_index: 0, task_index: 0, details: null
  });
  assert.deepEqual(result.mutations_applied, []);
  assert.equal(JSON.stringify(result.state), before);
});
```
This test will need to be updated to reflect the new auto-approve behavior.

---

### Error 5: Resolver Returns `advance_phase` (Internal Action)

**File**: [resolver.js](/.github/orchestration/scripts/lib/resolver.js#L253-L258)

**Current implementation** — `resolvePhaseLifecycle`, P7 branch:
```javascript
// P7: Approved — advance phase
if (phase.phase_review_verdict === REVIEW_VERDICTS.APPROVED) {
  return makeResult(NEXT_ACTIONS.ADVANCE_PHASE, {
    ...baseOpts,
    details: 'Phase ' + phaseId + ' approved; advancing to next phase'
  });
}
```

**Problem**: `NEXT_ACTIONS.ADVANCE_PHASE = 'advance_phase'` (constants.js line 240) is an internal mechanical action — it's not in the Orchestrator's 18-action routing table. The Orchestrator has no route for it and stalls.

**Fix**: The pipeline engine should handle `advance_phase` internally:
1. After resolve returns `advance_phase`, apply the phase advancement mutation (set phase to `complete`, either increment `current_phase` or set `execution.status = 'complete'` if last phase)
2. Re-validate the new state
3. Re-resolve to get the next *external* action
4. Bound the re-resolve loop to max 1 internal iteration to prevent infinite loops

**Pipeline engine insertion point**: [pipeline-engine.js](/.github/orchestration/scripts/lib/pipeline-engine.js#L198-L207) — after the resolve step:
```javascript
const resolved = resolveNextAction(proposedState, config);
// Handle internal actions
if (resolved.action === NEXT_ACTIONS.ADVANCE_PHASE) {
  // Apply advancement, re-validate, re-resolve
}
```

**Phase advancement logic** (from `handleGateApproved` phase branch, mutations.js lines 204–222):
```javascript
const phase = currentPhase(state);
phase.status = PHASE_STATUSES.COMPLETE;
const isLastPhase = (state.execution.current_phase >= state.execution.phases.length - 1);
if (isLastPhase) {
  state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
  state.execution.status = 'complete';
} else {
  state.execution.current_phase += 1;
}
```
This same logic should be extracted or replicated for internal `advance_phase` handling.

**This also fixes Error 6**: By keeping `current_phase` at the last valid index when the last phase completes (setting `execution.status = 'complete'` instead of incrementing past the end), V1 is never violated.

---

### Error 6: V1 Validation — `current_phase` Out of Bounds

**File**: [state-validator.js](/.github/orchestration/scripts/lib/state-validator.js#L74-L82)

**Current implementation** — `checkV1`:
```javascript
function checkV1(proposed) {
  const errors = [];
  const phases = proposed.execution.phases || [];
  const cp = proposed.execution.current_phase;
  if (phases.length === 0 && cp !== 0) {
    errors.push(makeError('V1', `current_phase (${cp}) is out of bounds for phases array of length ${phases.length}`));
  }
  if (phases.length > 0 && (cp < 0 || cp >= phases.length)) {
    errors.push(makeError('V1', `current_phase (${cp}) is out of bounds for phases array of length ${phases.length}`));
  }
  return errors;
}
```

**Problem**: The second condition `cp >= phases.length` rejects `current_phase = 2` when `phases.length = 2`. This is technically correct — `current_phase` is an array index and should be `0` to `phases.length - 1`. The real problem is Error 5's workaround set `current_phase` past the end to trigger the resolver's `transition_to_review` check.

**Resolution**: Error 5's fix (internal `advance_phase` handling) ensures `current_phase` never goes past the last valid index. The last phase stays at its index and `execution.status = 'complete'` signals completion instead. V1's check is correct and should NOT be modified — the root cause is in Error 5.

**Resolver's existing check** — [resolver.js](/.github/orchestration/scripts/lib/resolver.js#L283-L288):
```javascript
// 2a: All phases done → transition to review
if (currentPhaseIndex >= phases.length) {
  return makeResult(NEXT_ACTIONS.TRANSITION_TO_REVIEW, { ... });
}
```
After the Error 5 fix, this condition is reached when `execution.status = 'complete'` routes the resolver differently (or phase count equality is handled by internal advancement). The details depend on the Architect's chosen approach.

---

### NEXT_ACTIONS Complete Enum (35 values)

**File**: [constants.js](/.github/orchestration/scripts/lib/constants.js#L193-L266)

**External actions** (in Orchestrator's 18-action routing table):
| # | Constant | String value |
|---|----------|-------------|
| 1 | `SPAWN_RESEARCH` | `spawn_research` |
| 2 | `SPAWN_PRD` | `spawn_prd` |
| 3 | `SPAWN_DESIGN` | `spawn_design` |
| 4 | `SPAWN_ARCHITECTURE` | `spawn_architecture` |
| 5 | `SPAWN_MASTER_PLAN` | `spawn_master_plan` |
| 6 | `REQUEST_PLAN_APPROVAL` | `request_plan_approval` |
| 7 | `CREATE_PHASE_PLAN` | `create_phase_plan` |
| 8 | `CREATE_TASK_HANDOFF` | `create_task_handoff` |
| 9 | `EXECUTE_TASK` | `execute_task` |
| 10 | `SPAWN_CODE_REVIEWER` | `spawn_code_reviewer` |
| 11 | `GENERATE_PHASE_REPORT` | `generate_phase_report` |
| 12 | `SPAWN_PHASE_REVIEWER` | `spawn_phase_reviewer` |
| 13 | `SPAWN_FINAL_REVIEWER` | `spawn_final_reviewer` |
| 14 | `REQUEST_FINAL_APPROVAL` | `request_final_approval` |
| 15 | `GATE_TASK` | `gate_task` |
| 16 | `GATE_PHASE` | `gate_phase` |
| 17 | `DISPLAY_HALTED` | `display_halted` |
| 18 | `DISPLAY_COMPLETE` | `display_complete` |

**Internal actions** (should be handled inside pipeline engine, not surfaced to Orchestrator):
| Constant | String value | When returned |
|----------|-------------|---------------|
| `INIT_PROJECT` | `init_project` | No state → init path |
| `TRANSITION_TO_EXECUTION` | `transition_to_execution` | All planning done + approved |
| `TRANSITION_TO_REVIEW` | `transition_to_review` | All phases complete |
| `TRANSITION_TO_COMPLETE` | `transition_to_complete` | Final review approved |
| `UPDATE_STATE_FROM_TASK` | `update_state_from_task` | Task in_progress (Error 2) |
| `UPDATE_STATE_FROM_REVIEW` | `update_state_from_review` | Review doc set, no verdict |
| `CREATE_CORRECTIVE_HANDOFF` | `create_corrective_handoff` | Task failed, retries available |
| `HALT_TASK_FAILED` | `halt_task_failed` | Task failed, no retries |
| `TRIAGE_TASK` | `triage_task` | Task review doc, no verdict |
| `HALT_TRIAGE_INVARIANT` | `halt_triage_invariant` | Triage attempts exceeded |
| `RETRY_FROM_REVIEW` | `retry_from_review` | Review changes_requested |
| `HALT_FROM_REVIEW` | `halt_from_review` | Review rejected |
| `ADVANCE_TASK` | `advance_task` | Task approved, no gate |
| `TRIAGE_PHASE` | `triage_phase` | Phase review doc, no verdict |
| `HALT_PHASE_TRIAGE_INVARIANT` | `halt_phase_triage_invariant` | Phase triage exceeded |
| `ADVANCE_PHASE` | `advance_phase` | Phase approved, no gate (Error 5) |
| `UPDATE_STATE_FROM_PHASE_REVIEW` | `update_state_from_phase_review` | Phase review doc exists |

**Note**: Not all of these 17 "internal" actions currently cause routing failures. Some (like `create_corrective_handoff`) are actually in the Orchestrator's table via the `create_task_handoff` route. The ones that concretely cause failures are `update_state_from_task` (Error 2) and `advance_phase` (Error 5). The brainstorming doc recommends adding a hard-error guard in the pipeline engine that validates the resolved action is in the known 18-action external vocabulary.

---

### Orchestrator Agent Error Handling

**File**: [orchestrator.agent.md](/.github/agents/orchestrator.agent.md#L85-L98)

**Current error handling section**:
```markdown
### Error Handling

If the pipeline exits with code 1, parse the error result:
{ "success": false, "error": "...", ... }
Display `result.error` to the human and halt. Do not attempt to recover automatically from pipeline errors.
```

**Missing**: No reference to a `log-error` skill. No instruction to auto-log errors. The Orchestrator just displays and halts. The new skill needs to be:
1. Added to the Orchestrator's skill references
2. Integrated into the error handling flow: when `success: false`, invoke the `log-error` skill to append an entry to `{NAME}-ERROR-LOG.md` before displaying to the human

---

### Existing Skill Structure (for `log-error` skill creation)

**Directory pattern**: `.github/skills/{name}/SKILL.md` + optional `templates/` subfolder

**SKILL.md frontmatter**: 
```yaml
---
name: {skill-name}
description: '{description}'
---
```

**Template files**: Stored in `templates/` as markdown with YAML frontmatter placeholders.

**Example skills examined**:
- `generate-task-report/` — `SKILL.md` (56 lines) + `templates/TASK-REPORT.md` (70 lines)
- `review-task/` — `SKILL.md` (58 lines) + `templates/CODE-REVIEW.md`

The `log-error` skill would follow the same pattern:
- `.github/skills/log-error/SKILL.md` — Instructions for when/how to log errors
- `.github/skills/log-error/templates/ERROR-LOG.md` — Template for the error log file with numbered entry sections

---

### Test Structure Summary

**Test framework**: `node:test` + `node:assert/strict` (Node.js built-in)

**mutations.test.js** (896 lines):
- Fixture factories: `makeBaseState()`, `makePlanningState()`, `makeExecutionState()`, `clone()`
- Tests organized by: `describe('event_name')` → `it('behavior description')`
- Each test: create state via factory → apply mutation → assert state changes
- `applyTaskTriage`/`applyPhaseTriage` tests at bottom (lines 710–896)
- Current skip-case test (line 710) asserts zero mutations and no state change — will need updating for Error 4 fix

**pipeline-engine.test.js** (1013 lines):
- Mock I/O factory: `createMockIO({ state, config, documents })` with accessor helpers
- State factories: `createBaseState(overrides)`, `createExecutionState(mutator)`
- Request builder: `makeRequest(event, context)`
- Tests organized by lifecycle phase: Init → Cold Start → Planning → Execution → Gates → Final Review → Triage Flow → Error Paths → Pre-Read
- Triage flow tests (lines 752–880) verify Row 1 skip behavior, corrective path (Row 10), and phase-level triage
- Documents provided as `{ frontmatter, body }` objects in the mock

**Key test that will need regression coverage**:
1. `plan_approved` → should now initialize phases from pre-read context
2. `task_handoff_created` → next resolve should return `execute_task` not `update_state_from_task`
3. `task_completed` with `status: 'pass'` → should normalize to `complete`
4. `task_completed` Row 1 skip → should auto-approve and advance task
5. Phase review approved → `advance_phase` should be handled internally, next external action should be `create_phase_plan` (next phase) or `transition_to_review` (last phase)
6. No V1 violation after last phase completes (already tested in pipeline-engine.test.js line 619)

## Constraints Discovered

- **4 preserved lib test suites must pass unmodified**: `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js` — these are from the SCRIPT-SIMPLIFY-AGENTS project and are not to be modified
- **CommonJS + Node.js built-ins only**: Zero npm dependencies; all shared utilities come from `validate-orchestration` skill
- **Triage decision table is immutable**: The triage engine's 11 task rows and 5 phase rows are not modified — null/null handling is in the callers
- **V1 validator is correct**: The bounds check should not be relaxed — the fix is in Error 5 ensuring `current_phase` never exceeds the last valid index
- **State I/O isolation**: All filesystem access goes through `state-io.js` or the injected `PipelineIO` interface — mutations and domain logic remain pure functions
- **`applyTaskTriage` skip-case test will break**: The current test at mutations.test.js line 710 asserts zero mutations for null/null — this will need to be updated to assert auto-approve behavior when a report_doc exists
- **Pipeline engine pre-read requires access to current state**: For the `plan_approved` master plan pre-read, the engine needs to read `currentState.planning.steps.master_plan.output` — this field is set during the planning phase and is available before the mutation runs

## Recommendations

- **Extract phase advancement logic**: The `handleGateApproved` phase branch (mutations.js lines 204–222) and the new internal `advance_phase` handler share identical logic. Consider extracting a shared `advancePhasePointer(state)` helper to avoid duplication.
- **Unmapped action guard**: Add a defensive check after `resolveNextAction` in the pipeline engine that validates the returned action is in an allowed set of 18 external actions. If not, return a hard error (exit code 1). This catches future resolver bugs before they silently fail.
- **Minimal status normalizer**: Keep the normalization map small (`pass → complete`, `fail → failed`) and reject anything else with a clear error. Don't attempt general-purpose synonym mapping.
- **Bounded re-resolve loop**: When handling `advance_phase` internally, limit the re-resolve to 1 iteration. If the second resolve also returns an internal action, that's a bug — return an error.
- **`total_phases` frontmatter**: The Architect fills this when writing the master plan. The `create-master-plan` skill instructions should mention it. No auto-derivation needed.
- **Error log is append-only**: The `log-error` skill template should number entries sequentially. Each entry is a `## Error N:` section with structured fields. The Orchestrator appends; no agent rewrites existing entries.
