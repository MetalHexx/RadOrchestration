---
project: "PIPELINE-BEHAVIORAL-TESTS"
author: "research-agent"
created: "2026-03-14T15:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Research Findings

## Research Scope

Investigated the pipeline engine, triage engine, state IO, mutations, resolver, constants, existing test infrastructure, and skill templates to support three goals: frontmatter cohesion across skill templates and pipeline consumers, fixing `readDocument` throw/null mismatch, and creating a comprehensive behavioral test suite.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Pipeline Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Central execution loop — pre-reads, mutations, triage, internal actions |
| Triage Engine | `.github/orchestration/scripts/lib/triage-engine.js` | 11 task-level + 5 phase-level decision rows reading frontmatter |
| State IO | `.github/orchestration/scripts/lib/state-io.js` | `readDocument` throws on missing files — target for Goal 2 |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | 18 mutation handlers + `needsTriage` + `applyTaskTriage` + `applyPhaseTriage` |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | `resolveNextAction` — routes state to 35 possible NEXT_ACTIONS |
| Constants | `.github/orchestration/scripts/lib/constants.js` | All enums: PIPELINE_TIERS, NEXT_ACTIONS (35), REVIEW_VERDICTS, etc. |
| State Validator | `.github/orchestration/scripts/lib/state-validator.js` | 15 invariants (V1–V15), called after every mutation |
| Pipeline CLI | `.github/orchestration/scripts/pipeline.js` | Wires real IO to `executePipeline`; sole `readDocument` consumer at CLI level |
| Pipeline Engine Tests | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | `createMockIO`, `withStrictDates`, `createBaseState`, `createExecutionState` |
| State IO Tests | `.github/orchestration/scripts/tests/state-io.test.js` | Tests `readDocument` throws on missing files |
| Phase Plan Template | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | Missing `tasks` array in frontmatter |
| Task Report Template | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Missing `has_deviations`, `deviation_type` in frontmatter |
| Phase Review Template | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | Missing `exit_criteria_met` in frontmatter |
| Master Plan Template | `.github/skills/create-master-plan/templates/MASTER-PLAN.md` | Reference pattern — has `total_phases` ✓ |
| Code Review Template | `.github/skills/review-task/templates/CODE-REVIEW.md` | Reference pattern — has `verdict`, `severity` ✓ |

---

## Goal 1: Frontmatter Cohesion

### Current Template Frontmatter (Verbatim)

#### Phase Plan Template (`.github/skills/create-phase-plan/templates/PHASE-PLAN.md`, lines 1–10)

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
title: "{PHASE-TITLE}"
status: "active|complete|halted"
total_tasks: {NUMBER}
author: "tactical-planner-agent"
created: "{ISO-DATE}"
---
```

**Missing**: `tasks` array (id + title per task)

#### Task Report Template (`.github/skills/generate-task-report/templates/TASK-REPORT.md`, lines 1–10)

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "complete"
files_changed: {NUMBER}
tests_written: {NUMBER}
tests_passing: {NUMBER}
build_status: "pass|fail"
---
```

**Missing**: `has_deviations` (boolean), `deviation_type` (string: `minor|architectural|null`)

#### Phase Review Template (`.github/skills/review-phase/templates/PHASE-REVIEW.md`, lines 1–8)

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---
```

**Missing**: `exit_criteria_met` (boolean or `"all"|"partial"`)

#### Reference: Master Plan Template (`.github/skills/create-master-plan/templates/MASTER-PLAN.md`, lines 1–7)

```yaml
---
project: "{PROJECT-NAME}"
total_phases: {NUMBER}
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
---
```

✅ Has `total_phases` — consumed by `plan_approved` pre-read in `pipeline-engine.js` line 218.

#### Reference: Code Review Template (`.github/skills/review-task/templates/CODE-REVIEW.md`, lines 1–9)

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---
```

✅ Has `verdict` and `severity` — consumed by triage engine `triageTask` at lines 130–140.

### How Pipeline Consumes These Fields

#### 1. Phase Plan `tasks` Array

**Consumer**: `handlePhasePlanCreated` in `mutations.js` (lines 165–192).

```javascript
if (Array.isArray(context.tasks) && context.tasks.length > 0) {
  phase.tasks = context.tasks.map((t, idx) => ({
    id: t.id,
    title: t.title,
    task_number: t.task_number ?? (idx + 1),
    status: TASK_STATUSES.NOT_STARTED,
    // ... rest of task scaffold
  }));
  phase.total_tasks = context.tasks.length;
  phase.current_task = 0;
}
```

Currently, there is **no pre-read** for `phase_plan_created` in `pipeline-engine.js`. Unlike `plan_approved` (which pre-reads `total_phases` from the master plan at line 211) and `task_completed` (which pre-reads `status`/`severity`/`has_deviations` from the task report at line 248), the `phase_plan_created` event relies entirely on the Orchestrator manually passing `context.tasks`. If the Orchestrator fails to do this, the phase initializes with zero tasks.

**Recommendation**: Add a `phase_plan_created` pre-read block (modeled after the `plan_approved` pre-read at lines 211–240) that reads the phase plan document's frontmatter `tasks` array into `context.tasks`. Add `tasks` to the phase plan template frontmatter.

**Expected frontmatter format for pre-read**:
```yaml
tasks:
  - id: "T01-TITLE"
    title: "Task Title"
  - id: "T02-TITLE"
    title: "Task Title"
```

#### 2. Task Report `has_deviations` and `deviation_type`

**Consumer 1**: Pipeline engine `task_completed` pre-read at `pipeline-engine.js` lines 263–264:

```javascript
context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
```

Note: Already has a fallback to `fm.deviations` if `fm.has_deviations` is undefined — backward-compatible.

**Consumer 2**: Triage engine `triageTask` at `triage-engine.js` lines 117–122:

```javascript
const hasDeviations = Boolean(
  reportFm.has_deviations !== undefined
    ? reportFm.has_deviations
    : reportFm.deviations
);
const deviationType = reportFm.deviation_type || null;
```

Used in Row 3 (`deviationType === 'minor'`), Row 4 (`deviationType === 'architectural'`), and the general `hasDeviations` check across multiple rows.

**Recommendation**: Add `has_deviations: false` and `deviation_type: null` to the task report template frontmatter. The existing fallback code means this is backward-compatible.

#### 3. Phase Review `exit_criteria_met`

**Consumer**: Triage engine `triagePhase` at `triage-engine.js` lines 338–343:

```javascript
const exitCriteriaMet = reviewFm.exit_criteria_met;
const allExitCriteriaMet =
  exitCriteriaMet === true ||
  exitCriteriaMet === 'all' ||
  exitCriteriaMet === undefined ||
  exitCriteriaMet === null;
```

Used to distinguish Row 2 (approved, all exit criteria met → advance) from Row 3 (approved, some exit criteria unmet → advance with carry-forward). When `exit_criteria_met` is undefined/null, it defaults to Row 2 (all met) — backward-compatible.

**Recommendation**: Add `exit_criteria_met: true` to the phase review template frontmatter. The triage engine already has graceful fallback when undefined.

### Skill Instruction Files (SKILL.md)

| Skill | Path | Notes |
|-------|------|-------|
| create-phase-plan | `.github/skills/create-phase-plan/SKILL.md` | Does NOT mention `tasks` array in frontmatter. Step 5 says "Break into tasks" but instructions only describe the body Task Outline table, not frontmatter. |
| generate-task-report | `.github/skills/generate-task-report/SKILL.md` | Step 6 says "Document deviations" but only as a body section ("Deviations from Handoff"). No mention of `has_deviations` or `deviation_type` frontmatter. Has strict status guidance. |
| review-phase | `.github/skills/review-phase/SKILL.md` | Step 4 says "Verify exit criteria" but only as a body section ("Exit Criteria Verification"). No mention of `exit_criteria_met` frontmatter. |

**Recommendation**: Each SKILL.md should be updated to instruct agents to produce the new frontmatter fields. Instructions should explain the exact field names, allowed values, and why they matter.

---

## Goal 2: `readDocument` Throw/Null Fix

### Current Implementation

**File**: `.github/orchestration/scripts/lib/state-io.js`, lines 126–137.

```javascript
function readDocument(docPath) {
  if (!exists(docPath)) {
    throw new Error('Document not found: ' + docPath);
  }
  const content = readFile(docPath);
  if (content === null) {
    throw new Error('Failed to read document: ' + docPath);
  }
  return extractFrontmatter(content);
}
```

Throws `Error` when file does not exist. This is the **root cause** of the throw/null mismatch.

### All `readDocument` Call Sites

| # | File | Line | Call Pattern | Error Handling |
|---|------|------|-------------|----------------|
| 1 | `pipeline.js` | 27 | `readDocument: stateIo.readDocument` | Passed as-is to IO object; no wrapping |
| 2 | `pipeline-engine.js` | 225 | `createProjectAwareReader(io.readDocument, projectDir)` | Wrapped in catch → retry project-relative |
| 3 | `pipeline-engine.js` | 253 | `io.readDocument(context.report_path)` | Checked `if (!reportDoc)` → error result |
| 4 | `pipeline-engine.js` | 339 | `createProjectAwareReader(io.readDocument, projectDir)` | Wrapped in catch → retry project-relative |
| 5 | `triage-engine.js` | 107 | `readDocument(task.report_doc)` | `if (!taskReport)` → makeError (expects null) |
| 6 | `triage-engine.js` | 130 | `readDocument(task.review_doc)` | `if (!codeReview)` → makeError (expects null) |
| 7 | `triage-engine.js` | 314 | `readDocument(phase.phase_review)` | `if (!phaseReview)` → makeError (expects null) |

### Analysis

- **Triage engine** (call sites 5, 6, 7): Uses `if (!result)` guard — **expects null for missing files**. Because triage is always called through `createProjectAwareReader`, the catch block in that wrapper converts throws to fallback attempts, and if both attempts throw, the error propagates as an uncaught exception. This works in practice but makes the null-check dead code and creates fragile semantics.

- **Pipeline engine task_completed pre-read** (call site 3): Uses `io.readDocument` directly (not through `createProjectAwareReader`) and checks `if (!reportDoc)` — **expects null**. Currently, a missing report throws and goes to the catch block at line 271 (try/catch wraps the entire pre-read).

- **`createProjectAwareReader`** (call sites 2, 4): Pattern at `pipeline-engine.js` lines 137–147:

```javascript
function createProjectAwareReader(readDocument, projectDir) {
  return function(docPath) {
    if (!docPath) return null;
    try {
      return readDocument(docPath);
    } catch (_) {
      const resolved = path.join(projectDir, docPath);
      return readDocument(resolved);
    }
  };
}
```

If `readDocument` is changed to return null: the first call returns null (no throw), so the catch block is **never entered**, and the project-relative fallback **never runs**. This wrapper must be updated to check for null return before falling back.

- **pipeline-engine.js task_completed pre-read** (call site 3): Wrapped in try/catch at line 247. If `readDocument` returns null instead of throwing, the `if (!reportDoc)` check at line 254 now works as intended. The catch block at line 271 catches other errors (e.g., parse failures). **No change needed here** beyond ensuring `readDocument` returns null.

### `createProjectAwareReader` Fix Pattern

After changing `readDocument` to return null, the wrapper should become:

```javascript
function createProjectAwareReader(readDocument, projectDir) {
  return function(docPath) {
    if (!docPath) return null;
    const result = readDocument(docPath);
    if (result !== null) return result;
    // Path didn't resolve from CWD — try as project-relative
    const resolved = path.join(projectDir, docPath);
    return readDocument(resolved);
  };
}
```

### `readDocument` Proposed Change

```javascript
function readDocument(docPath) {
  if (!exists(docPath)) {
    return null;
  }
  const content = readFile(docPath);
  if (content === null) {
    return null;
  }
  return extractFrontmatter(content);
}
```

### Existing Tests That Will Need Updates

- `state-io.test.js` line 209: `assert.throws(() => readDocument(docPath), ...)` → must change to assert null return
- `pipeline-engine.test.js` line 1680–1683: `createProjectAwareReader` test "lets the second readDocument throw if both resolutions fail" → behavior changes from throw to returning null

### Mock IO Pattern (Already Compatible)

The `createMockIO` in `pipeline-engine.test.js` line 46 already returns null for missing documents:

```javascript
readDocument(docPath) {
  const doc = documents[docPath];
  if (!doc) return null;
  return JSON.parse(JSON.stringify(doc));
}
```

This means **all existing pipeline-engine tests already use the null-return convention** and won't need changes for Goal 2.

---

## Goal 3: Behavioral Test Suite

### Existing Test Infrastructure

#### `createMockIO` (pipeline-engine.test.js, lines 28–55)

```javascript
function createMockIO(opts = {}) {
  let currentState = opts.state !== undefined ? opts.state : null;
  const config = opts.config || createDefaultConfig();
  const documents = opts.documents || {};
  const writes = [];
  let ensureDirsCalled = 0;

  return {
    readState(projectDir)    → returns deep clone of currentState or null
    writeState(projectDir, state) → deep clones + stores snapshot
    readConfig(configPath)   → returns deep clone of config
    readDocument(docPath)    → returns deep clone of documents[docPath] or null
    ensureDirectories(projectDir) → counter
    // Accessors: getState(), getWrites(), getEnsureDirsCalled()
  };
}
```

#### `createDefaultConfig` (pipeline-engine.test.js, lines 59–78)

Returns config with:
- `limits.max_phases: 10`, `max_tasks_per_phase: 8`, `max_retries_per_task: 2`, `max_consecutive_review_rejections: 3`
- `human_gates.execution_mode: 'ask'`
- `projects.base_path: '.github/projects'`

#### `createBaseState` (pipeline-engine.test.js, lines 86–122)

Minimal valid state.json for planning tier. Accepts overrides via callback or shallow merge.

#### `createExecutionState` (pipeline-engine.test.js, lines 131–177)

Execution-tier state with one phase, one task (not_started). All planning steps complete. Accepts mutator callback.

#### `withStrictDates` (pipeline-engine.test.js, lines 201–213)

Monkey-patches `Date` so each `new Date()` yields a strictly increasing millisecond value. Required for internal action handling (advance_task, advance_phase) to avoid V13 validation collisions.

```javascript
function withStrictDates(fn) {
  const _Orig = Date;
  let _tick = _Orig.now();
  global.Date = class extends _Orig {
    constructor(...args) { if (args.length === 0) super(_tick++); else super(...args); }
    static now() { return _tick++; }
    static parse(s) { return _Orig.parse(s); }
    static UTC(...a) { return _Orig.UTC(...a); }
  };
  try { return fn(); } finally { global.Date = _Orig; }
}
```

#### `makeRequest` (pipeline-engine.test.js, lines 181–188)

```javascript
function makeRequest(event, context = {}) {
  return { event, projectDir: '/test/project', configPath: '/test/orchestration.yml', context };
}
```

#### `pipeline-behavioral.test.js` — Does NOT Exist

No file matching `pipeline-behavioral*` was found. This is a new file to be created.

### Existing Test Coverage (pipeline-engine.test.js)

| Section | Coverage |
|---------|----------|
| Init Path | `start` with no state → scaffold |
| Cold Start | `start` with existing state → zero writes |
| Planning Events | All 5 planning steps + plan_approved + plan_rejected |
| Execution Events | phase_plan_created, task_handoff_created, task_completed, code_review_completed, phase_report_created, phase_review_completed |
| Gate Events | gate_approved (task + phase + last-phase), gate_rejected |
| Final Review Events | final_review_completed, final_approved, final_rejected |
| Triage Flow | Row 1 auto-approve, Row 10 corrective |
| triage_attempts Lifecycle | Increment, reset, overflow |
| Error Paths | Unknown event, no state, validation failure |
| Task Report Pre-Read | Enrichment, missing report |
| Master Plan Pre-Read | RT-1 (happy), RT-2 (missing total_phases), RT-2b (non-integer), RT-3 |
| Status Normalization | RT-5 (pass→complete), RT-6 (banana→error) |
| Internal advance_phase | RT-10 (non-last), RT-11 (last), RT-12 (V1 validation) |
| Internal advance_task | RT-13 |
| Path Normalization | All path keys, idempotent, null handling |
| createProjectAwareReader | Direct, fallback, null, throw |

**Gaps**: No multi-phase multi-task scenario. No triage rows 2–9, 11. No phase-level triage rows 2–5. No gate modes. No corrective/retry cycles. No halt paths via triage. No resume from halted. No full happy path end-to-end. These are the targets for the behavioral test suite.

---

## Triage Decision Tables

### Task-Level (11 Rows) — `triage-engine.js` `triageTask`

| Row | report_status | has_deviations | deviation_type | review_doc | verdict | Action | Frontmatter Read |
|-----|---------------|----------------|----------------|------------|---------|--------|------------------|
| 1 | `complete` | false | — | null | — | skip (auto-approve) | `status`, `has_deviations` |
| 2 | `complete` | false | — | present | `approved` | `advanced` | `status`, `has_deviations`, `verdict` |
| 3 | `complete` | true | `minor` | present | `approved` | `advanced` | `status`, `has_deviations`, `deviation_type`, `verdict` |
| 4 | `complete` | true | `architectural` | present | `approved` | `advanced` | `status`, `has_deviations`, `deviation_type`, `verdict` |
| 5 | `complete` | — | — | present | `changes_requested` | `corrective_task_issued` | `status`, `verdict` |
| 6 | `complete` | — | — | present | `rejected` | `halted` | `status`, `verdict` |
| 7 | `partial` | — | — | null | — | skip (auto-approve) | `status` |
| 8 | `partial` | — | — | present | `changes_requested` | `corrective_task_issued` | `status`, `verdict` |
| 9 | `partial` | — | — | present | `rejected` | `halted` | `status`, `verdict` |
| 10 | `failed` | — | — | — | (from review or null) | `corrective_task_issued` | `status`, `severity` (from task) |
| 11 | `failed` | — | — | — | (from review or null) | `halted` | `status`, `severity` (from task) |

Row 10 triggers when `task.severity === 'minor'` AND `task.retries < limits.max_retries_per_task`.
Row 11 triggers on critical severity OR retries exhausted.

### Phase-Level (5 Rows) — `triage-engine.js` `triagePhase`

| Row | phase_review | verdict | exit_criteria_met | Action | Frontmatter Read |
|-----|-------------|---------|-------------------|--------|------------------|
| 1 | null | — | — | skip (auto-approve) | — |
| 2 | present | `approved` | true/undefined/null | `advanced` | `verdict`, `exit_criteria_met` |
| 3 | present | `approved` | false/`"partial"` | `advanced` (carry-forward) | `verdict`, `exit_criteria_met` |
| 4 | present | `changes_requested` | — | `corrective_tasks_issued` | `verdict` |
| 5 | present | `rejected` | — | `halted` | `verdict` |

---

## Mutation Handlers (18)

| # | Event | Handler | What it does |
|---|-------|---------|-------------|
| 1 | `research_completed` | `handleResearchCompleted` | Sets planning.steps.research → complete |
| 2 | `prd_completed` | `handlePrdCompleted` | Sets planning.steps.prd → complete |
| 3 | `design_completed` | `handleDesignCompleted` | Sets planning.steps.design → complete |
| 4 | `architecture_completed` | `handleArchitectureCompleted` | Sets planning.steps.architecture → complete |
| 5 | `master_plan_completed` | `handleMasterPlanCompleted` | Sets master_plan → complete, planning.status → complete |
| 6 | `plan_approved` | `handlePlanApproved` | Sets human_approved, tier → execution, initializes phases |
| 7 | `plan_rejected` | `handlePlanRejected` | Halts pipeline, adds blocker |
| 8 | `phase_plan_created` | `handlePhasePlanCreated` | Sets phase_doc, status → in_progress, initializes tasks from context.tasks |
| 9 | `task_handoff_created` | `handleTaskHandoffCreated` | Sets handoff_doc, task → in_progress, clears review fields |
| 10 | `task_completed` | `handleTaskCompleted` | Sets report_doc, task.severity from context |
| 11 | `code_review_completed` | `handleCodeReviewCompleted` | Sets review_doc |
| 12 | `phase_report_created` | `handlePhaseReportCreated` | Sets phase_report |
| 13 | `phase_review_completed` | `handlePhaseReviewCompleted` | Sets phase_review |
| 14 | `gate_approved` | `handleGateApproved` | Advances task/phase, resets triage_attempts |
| 15 | `gate_rejected` | `handleGateRejected` | Halts pipeline, adds blocker |
| 16 | `final_review_completed` | `handleFinalReviewCompleted` | Sets report_doc, status → complete |
| 17 | `final_approved` | `handleFinalApproved` | Sets human_approved, tier → complete |
| 18 | `final_rejected` | `handleFinalRejected` | Halts pipeline, adds blocker |

### Triage Helpers

- `needsTriage(event, state)` — Returns `{ shouldTriage, level }` for `task_completed` (task), `code_review_completed` (task), `phase_review_completed` (phase)
- `applyTaskTriage(state, triageResult)` — Routes by `triageResult.action`: advanced → complete, corrective → failed + retry, halted → halt pipeline. Null verdict + null action → auto-approve if report_doc exists.
- `applyPhaseTriage(state, triageResult)` — Routes by action: advanced → reset triage_attempts, halted → halt pipeline + halt phase. Null verdict + null action → auto-approve if phase_report exists.
- `normalizeDocPath(docPath, basePath, projectName)` — Strips workspace-relative prefix, making paths project-relative.

---

## Resolver NEXT_ACTIONS (35 values)

| Constant | Value | Tier | Type |
|----------|-------|------|------|
| `INIT_PROJECT` | `init_project` | — | Internal |
| `DISPLAY_HALTED` | `display_halted` | Any | External |
| `SPAWN_RESEARCH` | `spawn_research` | Planning | External |
| `SPAWN_PRD` | `spawn_prd` | Planning | External |
| `SPAWN_DESIGN` | `spawn_design` | Planning | External |
| `SPAWN_ARCHITECTURE` | `spawn_architecture` | Planning | External |
| `SPAWN_MASTER_PLAN` | `spawn_master_plan` | Planning | External |
| `REQUEST_PLAN_APPROVAL` | `request_plan_approval` | Planning | External |
| `TRANSITION_TO_EXECUTION` | `transition_to_execution` | Planning | Internal |
| `CREATE_PHASE_PLAN` | `create_phase_plan` | Execution | External |
| `CREATE_TASK_HANDOFF` | `create_task_handoff` | Execution | External |
| `EXECUTE_TASK` | `execute_task` | Execution | External |
| `UPDATE_STATE_FROM_TASK` | `update_state_from_task` | Execution | Internal |
| `CREATE_CORRECTIVE_HANDOFF` | `create_corrective_handoff` | Execution | Internal |
| `HALT_TASK_FAILED` | `halt_task_failed` | Execution | Internal |
| `SPAWN_CODE_REVIEWER` | `spawn_code_reviewer` | Execution | External |
| `UPDATE_STATE_FROM_REVIEW` | `update_state_from_review` | Execution | Internal |
| `TRIAGE_TASK` | `triage_task` | Execution | Internal |
| `HALT_TRIAGE_INVARIANT` | `halt_triage_invariant` | Execution | Internal |
| `RETRY_FROM_REVIEW` | `retry_from_review` | Execution | Internal |
| `HALT_FROM_REVIEW` | `halt_from_review` | Execution | Internal |
| `ADVANCE_TASK` | `advance_task` | Execution | Internal (handled in engine loop) |
| `GATE_TASK` | `gate_task` | Execution | External |
| `GENERATE_PHASE_REPORT` | `generate_phase_report` | Execution | External |
| `SPAWN_PHASE_REVIEWER` | `spawn_phase_reviewer` | Execution | External |
| `UPDATE_STATE_FROM_PHASE_REVIEW` | `update_state_from_phase_review` | Execution | Internal |
| `TRIAGE_PHASE` | `triage_phase` | Execution | Internal |
| `HALT_PHASE_TRIAGE_INVARIANT` | `halt_phase_triage_invariant` | Execution | Internal |
| `GATE_PHASE` | `gate_phase` | Execution | External |
| `ADVANCE_PHASE` | `advance_phase` | Execution | Internal (handled in engine loop) |
| `TRANSITION_TO_REVIEW` | `transition_to_review` | Execution | Internal |
| `SPAWN_FINAL_REVIEWER` | `spawn_final_reviewer` | Review | External |
| `REQUEST_FINAL_APPROVAL` | `request_final_approval` | Review | External |
| `TRANSITION_TO_COMPLETE` | `transition_to_complete` | Review | Internal |
| `DISPLAY_COMPLETE` | `display_complete` | Complete | External |

The pipeline engine's internal action loop (lines 396–440) handles `ADVANCE_TASK` and `ADVANCE_PHASE`. All other actions marked "External" are in the `EXTERNAL_ACTIONS` set (18 actions) and are returned to the Orchestrator. Internal actions that aren't `ADVANCE_TASK`/`ADVANCE_PHASE` trigger the unmapped action guard error.

---

## Pipeline Engine Flow (Key Reference Points)

### `executePipeline` Entry Points (pipeline-engine.js, lines 160–465)

| Path | Condition | Behavior |
|------|-----------|----------|
| INIT | `state === null && event === 'start'` | Scaffold state, write, resolve, return |
| COLD START | `state !== null && event === 'start'` | Resolve from existing state, zero writes |
| NO STATE ERROR | `state === null && event !== 'start'` | Return error |
| STANDARD MUTATION | All other events | Mutate → validate → write → triage? → resolve → internal loop |

### Pre-Read Blocks

| Event | Line | What it reads | Frontmatter fields |
|-------|------|---------------|-------------------|
| `plan_approved` | 211–240 | Master plan doc | `total_phases` |
| `task_completed` | 248–273 | Task report doc | `status`, `severity`, `has_deviations` (+ `deviations` fallback) |

### Triage Integration (lines 308–375)

1. Check `needsTriage(event, proposedState)` → `{ shouldTriage, level }`
2. Guard: `triage_attempts > 1` → skip triage, return `DISPLAY_HALTED`
3. Snapshot post-mutation state
4. Create `projectAwareReader`
5. Call `executeTriage(proposedState, level, projectAwareReader)`
6. Apply triage mutation via `applyTaskTriage` or `applyPhaseTriage`
7. Validate triage transition against post-mutation baseline
8. Write state once (combined mutation + triage)

### Internal Action Loop (lines 396–440)

```
while (!EXTERNAL_ACTIONS.has(resolved.action) && internalIterations < MAX_INTERNAL_ITERATIONS):
  if ADVANCE_TASK → phase.current_task += 1
  if ADVANCE_PHASE → phase.status = complete, check last phase
  re-validate, write, re-resolve
```

Max 2 internal iterations. If still unmapped → error result.

---

## Constraints Discovered

- **Backward compatibility**: Existing projects have documents produced from old templates. Absent frontmatter fields must not crash the pipeline. The triage engine already treats undefined `exit_criteria_met` as "all met" and undefined `has_deviations` falls back to `deviations`. New template fields should have sensible defaults.
- **`createProjectAwareReader` coupling**: After changing `readDocument` to return null, this wrapper must switch from try/catch to null-check for the fallback logic.
- **V13 timestamp invariant**: Any test calling `executePipeline` with triage or internal actions must use `withStrictDates` to avoid same-millisecond timestamp collisions.
- **Test runner**: Must use `node:test` (built-in), matching existing infrastructure. No external test dependencies.
- **Test file location**: Should be `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` — separate from `pipeline-engine.test.js` but in the same test directory.
- **State validator**: 15 invariants (V1–V15) are checked after every mutation and after every triage mutation. Key validators: V1 (current_phase bounds), V2 (current_task bounds), V3 (retry limit), V6 (single in_progress task), V8/V9 (review doc/verdict consistency), V13 (timestamp monotonicity), V14 (review_doc immutability).

## Recommendations

### Goal 1 — Frontmatter Cohesion

1. **Phase Plan template**: Add `tasks` array to frontmatter. Add `phase_plan_created` pre-read in `pipeline-engine.js` (modeled after `plan_approved` pre-read). Update `create-phase-plan/SKILL.md` to instruct agents to produce the `tasks` array.
2. **Task Report template**: Add `has_deviations: false` and `deviation_type: null` to frontmatter. Update `generate-task-report/SKILL.md` to instruct agents to populate these fields based on whether deviations occurred.
3. **Phase Review template**: Add `exit_criteria_met: true` to frontmatter. Update `review-phase/SKILL.md` to instruct agents to set this based on exit criteria verification results.

### Goal 2 — `readDocument` Fix

1. Change `readDocument` in `state-io.js` to return null instead of throwing on missing files.
2. Update `createProjectAwareReader` in `pipeline-engine.js` to use null-check instead of try/catch for fallback logic.
3. Update `state-io.test.js` to assert null return instead of throw.
4. Update `pipeline-engine.test.js` `createProjectAwareReader` test for the "both resolutions fail" case.

### Goal 3 — Behavioral Test Suite

1. Create `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`.
2. Import and reuse `createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates` from `pipeline-engine.test.js` — or duplicate the factory functions in the new file to keep it self-contained per brainstorming doc guidance.
3. Test categories to implement:
   - Full happy path (start → planning → approval → execution → review → complete)
   - Multi-phase/multi-task scenarios
   - All 11 task-level triage rows
   - All 5 phase-level triage rows
   - Human gate modes (ask, task, phase, autonomous)
   - Retry/corrective cycles (corrective_task_issued → retry)
   - Halt paths (rejected reviews, critical failures, retry exhaustion)
   - Path normalization through triage (workspace-relative → project-relative)
   - Cold start resume from various pipeline states
   - Pre-read failures (missing/malformed documents)
   - Frontmatter-driven flows for new fields from Goal 1
