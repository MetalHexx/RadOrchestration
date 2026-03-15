---
project: "EXECUTE-BEHAVIORAL-TESTS"
author: "research-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Research Findings

## Research Scope

Investigated the three pipeline bugs documented in the PIPELINE-BEHAVIORAL-TESTS error log (triage Row 1 auto-approval bypass, missing triage row, YAML parser arrays-of-objects) plus the behavioral test suite structure, test infrastructure, and report conventions. Research focuses on the exact code locations, current behavior, and what needs to change for each fix.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Triage Engine | `.github/orchestration/scripts/lib/triage-engine.js` | Contains the 11-row task triage decision table. Row 1 (line ~153) returns `{ verdict: null, action: null }` — the root cause of Error #1. Missing row for `complete + deviations + no review` — Error #3. |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | `applyTaskTriage()` (line ~400) interprets `verdict=null, action=null` as auto-approve when `task.report_doc` exists. Must be updated to stop auto-approving on null/null. |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | Branch T11 (line ~237): `review_doc === null && review_verdict === null → spawn_code_reviewer`. Currently dead code for clean tasks because `applyTaskTriage` sets `review_verdict=approved` before resolver runs. |
| YAML Parser | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | List-item branch (line ~62) calls `parseScalar(itemContent)` on every `- item`, treating `- id: "T01"` as a scalar string instead of an object. |
| Pipeline Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Orchestrates the full pipeline: load state → mutation → triage → resolve → internal actions. Defines `EXTERNAL_ACTIONS` set (line ~18) and pre-read enrichment blocks. |
| Behavioral Tests | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | 10 `describe` blocks, ~35 `it` tests covering full happy path, triage rows, phase triage, human gates, retry cycles, halt paths, cold-start resume, pre-read failures, and frontmatter-driven flows. |
| Constants | `.github/orchestration/scripts/lib/constants.js` | Defines all enums: `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `TASK_STATUSES`, `NEXT_ACTIONS`, `HUMAN_GATE_MODES`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS`. |
| State Validator | `.github/orchestration/scripts/lib/state-validator.js` | Validates state transitions. Pipeline engine calls `validateTransition()` after mutations and triage. |
| YAML Parser Tests | `.github/orchestration/scripts/tests/yaml-parser.test.js` | Existing test file for `parseYaml()`. Uses a custom test harness (not `node:test`). |

### Bug #1: Triage Row 1 Auto-Approval Bypass

**Current behavior — triage-engine.js lines 150–157:**

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

Returns `{ verdict: null, action: null }`.

**Current behavior — mutations.js `applyTaskTriage()` lines ~400–418:**

```javascript
function applyTaskTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;
      task.review_verdict = REVIEW_VERDICTS.APPROVED;
      task.review_action = REVIEW_ACTIONS.ADVANCED;
      // ...
    }
    return { state, mutations_applied: [...] };
  }
  // ...
}
```

The null/null + report_doc path sets `review_verdict: approved` and `review_action: advanced` directly, bypassing code review entirely.

**Fix required:**
1. In `triage-engine.js` Row 1: change return to `{ verdict: null, action: "spawn_code_reviewer" }`
2. In `mutations.js` `applyTaskTriage()`: the null/null branch currently auto-approves. After the triage fix, Row 1 will return `{ verdict: null, action: "spawn_code_reviewer" }` so it won't hit the null/null branch anymore. However, Row 7 (partial, no review) also returns null/null and currently gets auto-approved via the same path. The mutation handler's null/null auto-approve logic should be guarded to only apply when appropriate (e.g., for skip-triage rows like Row 7 for partial reports).

**Impact on resolver:** After the fix, Row 1 returns `action: "spawn_code_reviewer"`. The `applyTaskTriage` non-null action path writes `review_action: spawn_code_reviewer` to the task. However, `"spawn_code_reviewer"` is NOT in the `REVIEW_ACTIONS` enum (`advanced`, `corrective_task_issued`, `halted`), so the "Route by action" block in `applyTaskTriage` won't match any branch — the task status won't be set to complete/failed/halted. The resolver then picks up the task and evaluates T11 (`review_doc === null && review_verdict === null → spawn_code_reviewer`). This is the correct flow: triage says "needs code review", mutation writes the action, resolver sees no review doc and routes to spawn_code_reviewer.

**Note on `applyTaskTriage` action routing:** The action routing block handles `ADVANCED`, `CORRECTIVE_TASK_ISSUED`, and `HALTED`. A triage result with `action: "spawn_code_reviewer"` will fall through without setting task status. This is acceptable because the resolver handles the routing. However, the `triage_attempts` counter will be incremented. Consider whether the null/null branch changes are needed to avoid incrementing triage_attempts for spawn_code_reviewer actions.

### Bug #2: YAML Parser Arrays of Objects

**Current behavior — yaml-parser.js lines 57–63:**

```javascript
// ── List item: - value ──────────────────────────────────────────
if (trimmed.startsWith('- ')) {
  if (Array.isArray(current)) {
    const itemContent = trimmed.slice(2).trim();
    current.push(parseScalar(itemContent));
  }
  i++;
  continue;
}
```

For `- id: "T01"`, `itemContent` = `id: "T01"`, then `parseScalar('id: "T01"')` returns the string `'id: "T01"'` — not an object.

**Fix required:** Detect when `itemContent` contains a colon (key-value separator) and parse it as an object. For continuation lines (indented deeper than the `- ` prefix), add additional key-value pairs to the same object. One level of nesting is sufficient per brainstorming constraints.

**Example YAML input:**
```yaml
tasks:
  - id: "T01"
    title: "First Task"
  - id: "T02"
    title: "Second Task"
```

**Expected output:**
```javascript
{ tasks: [
  { id: "T01", title: "First Task" },
  { id: "T02", title: "Second Task" }
] }
```

**Parser architecture context:** The parser uses a stack-based approach with `{ indent, container }` entries. The list-item branch checks `Array.isArray(current)` and pushes items. The fix needs to:
1. Check if `itemContent` contains a colon (use existing `findKeyColon`)
2. If yes: create a new object `{}`, parse the first key-value, push the object to the array
3. Read continuation lines (indented deeper than the `- ` line) as additional key-value pairs on the same object
4. If no colon: keep existing `parseScalar` behavior

### Bug #3: Missing Triage Row

**Current gap in triage-engine.js task decision table:**

The existing rows for `reportStatus === 'complete'` with `hasDeviations === true`:
- Row 3: `complete + minor deviations + approved verdict` → advance
- Row 4: `complete + architectural deviations + approved verdict` → advance

Both require `verdict === REVIEW_VERDICTS.APPROVED`, which requires `task.review_doc` to exist. There is NO row matching:
- `reportStatus === 'complete'`
- `hasDeviations === true`
- `task.review_doc === null` (no review yet)

This causes the "No decision table row matched" error.

**Fix required:** Add a new row between current Row 1 and Row 2 (or after Row 4, before Row 5):

```javascript
// New row: complete, has deviations, no review → spawn code reviewer
if (reportStatus === 'complete' && hasDeviations && !task.review_doc) {
  return makeSuccess(
    TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
    phaseIndex, taskIndex, NEW_ROW_NUMBER,
    'Row N: complete, deviations, no review — spawn code reviewer'
  );
}
```

**Placement consideration:** This row must appear BEFORE rows 3–6 (which require `task.review_doc` to exist). Logical placement: immediately after Row 1 fix (both handle the "no review yet" case). Row numbering will shift for subsequent rows.

### Existing Patterns

- **Decision table pattern**: First-match-wins evaluation with `makeSuccess(level, verdict, action, phaseIndex, taskIndex, rowNumber, details)`. Each row has a numbered comment and descriptive details string.
- **Mutation handler pattern**: `applyTaskTriage` routes by `triageResult.action` using constants from `REVIEW_ACTIONS` enum. Null/null is special-cased at the top.
- **Internal action loop**: Pipeline engine resolves next action, and if it's an internal action (`advance_task`, `advance_phase`), executes it inline before re-resolving. External actions are returned to the caller.
- **Test pattern**: `pipeline-behavioral.test.js` uses `node:test` (`describe`, `it`, `beforeEach`) with `node:assert/strict`. Each test creates a mock IO with pre-stocked documents and state, calls `executePipeline()`, and asserts on `result.success`, `result.action`, `result.triage_ran`, and final state fields.
- **Mock IO pattern**: `createMockIO({ state, documents, config })` — documents are keyed by path, dual-path stocking (direct + project-relative) for documents read via `createProjectAwareReader`.
- **State factory pattern**: `createBaseState(overrides)` and `createExecutionState(mutator)` build state objects. Mutator is a function receiving the state for customization.
- **`withStrictDates` wrapper**: Wraps test bodies to ensure deterministic timestamps.
- **YAML parser test pattern**: `yaml-parser.test.js` uses a custom `test(name, fn)` harness (NOT `node:test`), with `assert` module and a summary reporter at the end.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | Built-in `node:test` | No external test framework; uses native test runner |
| Test runner | `node --test` | Node.js built-in | Command: `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` |
| Assertions | `node:assert/strict` | Node.js built-in | Used in behavioral tests |
| Pipeline scripts | Plain JavaScript (CommonJS) | No transpilation | `require()` imports, `module.exports` |
| Configuration | YAML (`orchestration.yml`) | Custom parser | The parser being fixed in Bug #2 |

## Detailed Code Analysis

### Triage Engine — Full Task Decision Table (11 Rows)

| Row | report_status | has_deviations | deviation_type | review_doc | verdict | → verdict | → action | Line |
|-----|---------------|----------------|----------------|------------|---------|-----------|----------|------|
| 1 | complete | false | — | null | — | null | null | ~153 |
| 2 | complete | false | — | exists | approved | approved | advanced | ~161 |
| 3 | complete | true | minor | exists | approved | approved | advanced | ~172 |
| 4 | complete | true | architectural | exists | approved | approved | advanced | ~182 |
| 5 | complete | — | — | exists | changes_requested | changes_requested | corrective_task_issued | ~192 |
| 6 | complete | — | — | exists | rejected | rejected | halted | ~202 |
| 7 | partial | — | — | null | — | null | null | ~210 |
| 8 | partial | — | — | exists | changes_requested | changes_requested | corrective_task_issued | ~218 |
| 9 | partial | — | — | exists | rejected | rejected | halted | ~228 |
| 10 | failed | — | — | — | (minor, retries available) | transcribed | corrective_task_issued | ~240 |
| 11 | failed | — | — | — | (critical or exhausted) | transcribed | halted | ~250 |

**Gap:** No row for `complete + true + any + null` (complete with deviations but no review doc).

### Mutations — `applyTaskTriage` Flow

1. **Null/null guard** (lines ~400–418): If `verdict === null && action === null`, checks `task.report_doc`. If present → auto-approve (sets `review_verdict: approved`, `review_action: advanced`, `status: complete`). If absent → no-op.
2. **Non-null path** (lines ~420+): Increments `triage_attempts`, writes `review_verdict` and `review_action` to task, then routes by action:
   - `ADVANCED` → `task.status = complete`, reset `triage_attempts`
   - `CORRECTIVE_TASK_ISSUED` → `task.status = failed`, increment retries
   - `HALTED` → `task.status = halted`, set tier to halted

### Resolver — T11 Branch

Located in `resolveTaskLifecycle()` at line ~237:

```javascript
// T11: no review_doc and no verdict → needs code review
if (task.review_doc === null && task.review_verdict === null) {
  return makeResult(NEXT_ACTIONS.SPAWN_CODE_REVIEWER, { ... });
}
```

This branch is within the `task.status === TASK_STATUSES.COMPLETE` block. After triage fix, when `applyTaskTriage` writes `action: "spawn_code_reviewer"` but doesn't route (falls through the action switch), the task's `review_verdict` stays `null` and `review_doc` stays `null`, so T11 fires correctly.

**Critical detail:** The `applyTaskTriage` non-null path currently sets `task.review_verdict = triageResult.verdict` and `task.review_action = triageResult.action` before routing. For the fixed Row 1 (`verdict: null, action: "spawn_code_reviewer"`), this writes `review_verdict: null` and `review_action: "spawn_code_reviewer"`. The resolver checks `task.review_verdict === null` (true) and `task.review_doc === null` (true) → T11 fires. However, T7 checks `task.review_verdict === REVIEW_VERDICTS.APPROVED` first — since it's null, T7 doesn't match. The flow is correct.

**But:** `task.review_action` is now `"spawn_code_reviewer"`, which is not in the `REVIEW_ACTIONS` enum. This is fine for T11 resolution, but the task_handoff_created handler (Handler 9) clears `review_doc`, `review_verdict`, and `review_action` to null, resetting for the next cycle.

### Pipeline Engine — EXTERNAL_ACTIONS Set

```javascript
const EXTERNAL_ACTIONS = new Set([
  NEXT_ACTIONS.SPAWN_RESEARCH,
  NEXT_ACTIONS.SPAWN_PRD,
  NEXT_ACTIONS.SPAWN_DESIGN,
  NEXT_ACTIONS.SPAWN_ARCHITECTURE,
  NEXT_ACTIONS.SPAWN_MASTER_PLAN,
  NEXT_ACTIONS.REQUEST_PLAN_APPROVAL,
  NEXT_ACTIONS.CREATE_PHASE_PLAN,
  NEXT_ACTIONS.CREATE_TASK_HANDOFF,
  NEXT_ACTIONS.EXECUTE_TASK,
  NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
  NEXT_ACTIONS.GENERATE_PHASE_REPORT,
  NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
  NEXT_ACTIONS.SPAWN_FINAL_REVIEWER,
  NEXT_ACTIONS.REQUEST_FINAL_APPROVAL,
  NEXT_ACTIONS.GATE_TASK,
  NEXT_ACTIONS.GATE_PHASE,
  NEXT_ACTIONS.CREATE_CORRECTIVE_HANDOFF,
  NEXT_ACTIONS.DISPLAY_HALTED,
  NEXT_ACTIONS.DISPLAY_COMPLETE
]);
```

`SPAWN_CODE_REVIEWER` is in EXTERNAL_ACTIONS, so when the resolver returns it, the pipeline engine returns it to the caller. No internal action loop needed.

### Behavioral Test Suite Structure

**File:** `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` (2,366 lines)

| describe Block | Line | Test Count | Coverage |
|---------------|------|------------|----------|
| Full Happy Path | 229 | 1 | 14 pipeline steps start → display_complete |
| Multi-Phase Multi-Task | 379 | 1 | 2 phases × 2 tasks to completion |
| Task Triage | 621 | 11 | Rows 1–11, each row in isolation |
| Phase Triage | 1049 | 5 | Phase Rows 2–5 (Row 1 implicitly tested) |
| Human Gate Modes | 1346 | 5 | autonomous, task, phase, ask, gate_rejected |
| Retry & Corrective Cycles | 1603 | 2 | single corrective cycle, retry exhaustion |
| Halt Paths | 1702 | 4 | task rejected, critical failure, phase rejected, gate rejected |
| Cold-Start Resume | 1851 | 4 | new project, mid-execution, between phases, halted/complete |
| Pre-Read Failures | 1963 | 7 | missing files, missing fields, null returns |
| Frontmatter-Driven Flows | 2103 | 5 | tasks array, deviations, exit_criteria_met |

**Total: ~45 test cases**

### Tests Affected by Bug Fixes

**Tests that will change behavior after Row 1 fix:**
1. **"Row 1: complete, no deviations, no review_doc → auto-approve → generate_phase_report"** (line 623): Currently expects `review_verdict: approved`, `review_action: advanced`, `status: complete`, `action: GENERATE_PHASE_REPORT`. After fix, Row 1 should return `spawn_code_reviewer` action from triage, and the resolver should return `SPAWN_CODE_REVIEWER` instead of advancing to phase report.
2. **Full Happy Path** (line 230): Step 10 expects `task_completed → auto-approve → generate_phase_report`. After fix, will need a code_review_completed step between task_completed and generate_phase_report.
3. **Multi-Phase Multi-Task** (line 380): Same pattern — all task completions expect auto-approve. After fix, each task needs code review.
4. **Row 7: partial, no review_doc → auto-approve** (line 863): Row 7 also returns null/null. If the mutations.js null/null guard is changed, Row 7 behavior may change too. Need to decide: should partial reports also require code review, or should they keep auto-approve?
5. **Human Gate Mode tests** (lines 1346+): Several tests rely on task_completed → auto-approve flow.
6. **Retry & Corrective Cycles** (line 1603): The success path after corrective assumes auto-approve.
7. **Halt Path tests**: Some setup paths rely on auto-approve.
8. **Cold-Start Resume tests**: Some use auto-approved task states.
9. **Frontmatter-Driven Flows tests**: Some rely on auto-approve for setup.

**Key constraint from brainstorming:** "Any changes to `pipeline-behavioral.test.js` itself" are out of scope. The tests should NOT be modified. The fixes must make the existing tests pass or the test expectations must already be correct.

**Conflict:** The brainstorming doc says the test file should NOT be changed, but the current tests explicitly assert Row 1 auto-approve behavior (e.g., `assert.equal(task.review_verdict, REVIEW_VERDICTS.APPROVED)` for Row 1). Changing Row 1 to return `spawn_code_reviewer` would break these assertions. This is a critical scope conflict that the PM and Architect must resolve.

**Possible resolution:** The brainstorming scope boundary says no changes to `pipeline-behavioral.test.js` itself, but Goal 1 explicitly mentions "Existing tests that assert auto-approval on clean tasks will need their expectations updated." This implies the test file IS expected to be updated as part of the fix — the scope boundary might mean "don't change the test structure or add new tests" rather than "don't touch the file at all." The PM should clarify this.

### Test Infrastructure

- **Runner:** `node --test` (Node.js built-in test runner)
- **Command:** `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- **Filter:** `node --test --test-name-pattern "Behavioral"` for behavioral tests only
- **All tests:** `node --test .github/orchestration/scripts/tests/` runs all test files in the directory
- **No package.json test script:** The orchestration scripts directory has no package.json. Tests are run directly via `node --test`.
- **Existing test files:** 20 test files in `.github/orchestration/scripts/tests/`: agents, config, constants, cross-refs, frontmatter, fs-helpers, instructions, mutations, pipeline, pipeline-engine, pipeline-behavioral, prompts, reporter, resolver, skills, state-io, state-validator, structure, triage-engine, yaml-parser.

### PIPELINE-BEHAVIORAL-TESTS Project Context

The parent project produced the test suite and documented the three bugs in its error log. Key artifacts:

| File | Path | Relevance |
|------|------|-----------|
| Error Log | `.github/projects/PIPELINE-BEHAVIORAL-TESTS/PIPELINE-BEHAVIORAL-TESTS-ERROR-LOG.md` | Documents the 3 bugs with root cause analysis |
| Master Plan | `.github/projects/PIPELINE-BEHAVIORAL-TESTS/PIPELINE-BEHAVIORAL-TESTS-MASTER-PLAN.md` | References test conventions and `node --test` usage |
| Architecture | `.github/projects/PIPELINE-BEHAVIORAL-TESTS/PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md` | Documents pipeline architecture, test discoverability patterns |

## Constraints Discovered

- **No new npm dependencies**: Tests run with `node --test` and Node.js built-ins only
- **No structural changes to pipeline flow**: Fixes stay within existing patterns — triage table values, missing rows, parser branch logic
- **REVIEW_ACTIONS enum does not include `spawn_code_reviewer`**: The string `"spawn_code_reviewer"` exists in `NEXT_ACTIONS` but not `REVIEW_ACTIONS`. When `applyTaskTriage` writes this action to the task, it won't match any routing branch — this is the intended behavior (let resolver handle it)
- **Row 7 (partial, no review) shares the null/null pattern**: Changes to `applyTaskTriage`'s null/null guard must not break Row 7's auto-approve behavior unless Row 7 should also require code review
- **Test file modification scope ambiguity**: Brainstorming says "no changes to `pipeline-behavioral.test.js`" in scope boundaries, but Goal 1 says "existing tests that assert auto-approval on clean tasks will need their expectations updated"
- **`triage_attempts` counter**: The non-null path in `applyTaskTriage` increments `triage_attempts`. For `spawn_code_reviewer` actions, this increment may be undesirable since it's a routing action, not a true triage retry
- **State validator**: The validator runs after both mutation and triage. Changes to how triage results are applied must not violate existing validation invariants (V8, V9, V13, V14)
- **YAML parser scope**: One level of nesting for array-of-objects is sufficient. Deep nesting is out of scope per brainstorming constraints

## Recommendations

- **Clarify test modification scope**: The PM should explicitly state whether `pipeline-behavioral.test.js` test expectations can be updated (Goal 1 implies yes, scope boundaries imply no)
- **Row 7 decision**: Decide whether partial reports (Row 7) should also route to code review or remain auto-approved. Row 7 currently returns null/null like Row 1. If only Row 1 is fixed, the `applyTaskTriage` null/null guard still needs to handle Row 7 auto-approval
- **Triage Row 1 fix**: Change to `{ verdict: null, action: "spawn_code_reviewer" }` — this means the task gets `review_action: "spawn_code_reviewer"` written, falls through action routing in mutations, and resolver T11 fires correctly
- **Missing row placement**: Insert the new row for `complete + deviations + no review` right after the fixed Row 1. Both handle the "no review yet" case — Row 1 (without deviations) and new row (with deviations)
- **YAML parser approach**: In the list-item branch, use `findKeyColon()` on `itemContent` to detect key-value pairs. If found, create an object, parse the first key-value, then consume continuation lines (indented deeper) as additional key-value pairs
- **Test report format**: Use a plain markdown summary as described in brainstorming — total tests, pass count, fail count, and a section per failure with test name, assertion, and stack trace. Save to `.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`
