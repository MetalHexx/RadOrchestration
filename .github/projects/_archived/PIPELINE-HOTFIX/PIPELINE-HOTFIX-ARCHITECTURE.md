---
project: "PIPELINE-HOTFIX"
status: "draft"
author: "architect-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Architecture

## Technical Overview

This project applies 6 targeted bug fixes to the unified pipeline engine built by SCRIPT-SIMPLIFY-AGENTS, adds an unmapped-action guard, creates a `log-error` skill for the Orchestrator, and adds regression tests covering all failure scenarios. No new architectural layers, modules, or dependencies are introduced — all changes land in existing files within the established system layers (Orchestration, Domain, Infrastructure). The fixes follow the existing patterns exactly: pre-read for I/O enrichment, pure mutation handlers, I/O isolation via the `PipelineIO` interface, and `node:test` + `node:assert/strict` for testing.

## System Layers

No changes to the layer structure. All fixes target modules in their existing layers:

```
┌─────────────────────────────────────────────────────┐
│  CLI Layer (Entry Point)                            │  UNCHANGED
│  pipeline.js                                        │
├─────────────────────────────────────────────────────┤
│  Orchestration Layer (Pipeline Engine)              │  MODIFIED — pre-reads, internal action handling, guard
│  pipeline-engine.js                                 │
├─────────────────────────────────────────────────────┤
│  Domain Layer (Business Logic)                      │  MODIFIED — mutations.js, resolver.js fixes
│  mutations.js, resolver.js, state-validator.js,     │  PRESERVED — state-validator.js, triage-engine.js, constants.js
│  triage-engine.js, constants.js                     │
├─────────────────────────────────────────────────────┤
│  Infrastructure Layer (I/O)                         │  UNCHANGED
│  state-io.js, fs-helpers.js, yaml-parser.js,        │
│  frontmatter.js                                     │
└─────────────────────────────────────────────────────┘
```

## Module Impact Map

### Files Modified by Fix

| File | Layer | Fixes Applied | Change Type |
|------|-------|---------------|-------------|
| `pipeline-engine.js` | Orchestration | Error 1, Error 3, Error 5, Error 6, Unmapped Guard | Pre-read addition, normalization, internal action loop, guard |
| `mutations.js` | Domain | Error 1, Error 4 | `handlePlanApproved` context usage, `applyTaskTriage`/`applyPhaseTriage` auto-approve |
| `resolver.js` | Domain | Error 2 | `resolveTaskLifecycle` conditional split |
| `MASTER-PLAN.md` template | Skill | Error 1 | Add `total_phases` frontmatter field |
| `generate-task-report/SKILL.md` | Skill | Error 3 | Reinforce status vocabulary constraint |
| `generate-task-report/templates/TASK-REPORT.md` | Skill | Error 3 | Reinforce status comment in frontmatter |
| `orchestrator.agent.md` | Agent | Error Logging | Add `log-error` skill reference and auto-log instructions |
| `mutations.test.js` | Test | Error 1, Error 4 | New regression tests, update skip-case test |
| `pipeline-engine.test.js` | Test | Error 1, Error 2, Error 3, Error 5, Error 6, Guard | New regression tests |

### Files Created

| File | Purpose |
|------|---------|
| `.github/skills/log-error/SKILL.md` | Error logging skill definition |
| `.github/skills/log-error/templates/ERROR-LOG.md` | Error log document template |

### Files NOT Modified (Preserved)

| File | Constraint |
|------|-----------|
| `constants.js` | Preserved — no enum changes (NFR-1) |
| `resolver.test.js` | Preserved test suite — must pass unmodified (NFR-1) |
| `state-validator.js` | Preserved — V1 check is correct; root cause is in Error 5 (NFR-1) |
| `state-validator.test.js` | Preserved test suite (NFR-1) |
| `triage-engine.js` | Preserved — Row 1 null/null is correct; callers handle translation (NFR-1) |
| `triage-engine.test.js` | Preserved test suite (NFR-1) |
| `constants.test.js` | Preserved test suite (NFR-1) |
| `state-io.js` | No I/O layer changes needed |
| `pipeline.js` | No CLI changes needed |

### Fix Dependency Graph

```
Error 1 (phase init)     ── independent ──────────────────────────────┐
Error 2 (resolver split) ── independent ──────────────────────────────┤
Error 3 (status normalize)── independent ─────────────────────────────┤
Error 4 (auto-approve)   ── prerequisite for ── Error 5              │
Error 5 (advance_phase)  ── also fixes ──────── Error 6              ├── All converge for
Error 6 (V1 bounds)      ── fixed BY Error 5 ──────────────────────  │   regression tests
Unmapped Action Guard    ── depends on Error 5 (re-resolve produces  │
                            external action that needs validation) ───┘
```

**Key dependency**: Error 4 (auto-approve) must be implemented before Error 5 (advance_phase). The `advance_phase` action is only reached after phase triage produces `verdict: approved`, `action: advanced` — which requires the auto-approve path from Error 4 to work. Error 5 also transitively resolves Error 6.

## Contracts & Interfaces

### Fix 1: `handlePlanApproved` — Updated Mutation (mutations.js)

**Current signature** (unchanged):

```javascript
/**
 * @param {Object} state - Deep clone of current state
 * @param {Object} context - Event context, NOW includes total_phases from pre-read
 * @returns {MutationResult}
 */
function handlePlanApproved(state, context) { /* ... */ }
```

**Updated context contract**:

| Field | Type | Source | Required |
|-------|------|--------|----------|
| `total_phases` | `number` (integer ≥ 1) | Injected by pipeline engine master plan pre-read | Yes |

**Current code pattern** ([mutations.js lines 92–105](/.github/orchestration/scripts/lib/mutations.js#L92-L105)):

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

**New code pattern**:

```javascript
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  state.execution.total_phases = context.total_phases;
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      status: PHASE_STATUSES.NOT_STARTED,
      tasks: [],
      current_task: 0,
      phase_doc: null,
      phase_report: null,
      phase_review: null,
      phase_review_verdict: null,
      phase_review_action: null,
      triage_attempts: 0,
      human_approved: false
    });
  }
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress',
      `execution.total_phases → ${context.total_phases}`,
      `execution.phases → [${context.total_phases} phases initialized]`
    ]
  };
}
```

**Phase entry initialization template**: Each entry in `execution.phases[]` uses values from `constants.js`:

| Field | Initial Value | Constant |
|-------|---------------|----------|
| `status` | `'not_started'` | `PHASE_STATUSES.NOT_STARTED` |
| `tasks` | `[]` | — |
| `current_task` | `0` | — |
| `phase_doc` | `null` | — |
| `phase_report` | `null` | — |
| `phase_review` | `null` | — |
| `phase_review_verdict` | `null` | — |
| `phase_review_action` | `null` | — |
| `triage_attempts` | `0` | — |
| `human_approved` | `false` | — |

---

### Fix 1: Master Plan Pre-Read (pipeline-engine.js)

**Insertion point**: [pipeline-engine.js lines 150–151](/.github/orchestration/scripts/lib/pipeline-engine.js#L150-L151) — immediately before the existing `task_completed` pre-read block (line 153).

**New pre-read block**:

```javascript
// Master plan pre-read: enrich context with total_phases before mutation
if (event === 'plan_approved') {
  const masterPlanPath = state.planning.steps.master_plan.output;
  if (!masterPlanPath) {
    return makeErrorResult(
      'Master plan path not found in state.planning.steps.master_plan.output',
      event, [], null, null
    );
  }
  try {
    const masterPlanDoc = io.readDocument(masterPlanPath);
    if (!masterPlanDoc) {
      return makeErrorResult(
        `Failed to read master plan at '${masterPlanPath}': document not found`,
        event, [], null, null
      );
    }
    const fm = masterPlanDoc.frontmatter || {};
    const totalPhases = parseInt(fm.total_phases, 10);
    if (!Number.isInteger(totalPhases) || totalPhases <= 0) {
      return makeErrorResult(
        `Master plan total_phases must be a positive integer, got '${fm.total_phases}'`,
        event, [], null, null
      );
    }
    context.total_phases = totalPhases;
  } catch (err) {
    return makeErrorResult(
      `Failed to read master plan at '${masterPlanPath}': ${err.message}`,
      event, [], null, null
    );
  }
}
```

**Error conditions**:

| Condition | Behavior | Exit Code |
|-----------|----------|-----------|
| `master_plan.output` missing from state | Hard error, no state written | 1 |
| `io.readDocument()` returns null/throws | Hard error, no state written | 1 |
| `total_phases` missing from frontmatter | Hard error, no state written | 1 |
| `total_phases` not a positive integer | Hard error, no state written | 1 |

---

### Fix 2: `resolveTaskLifecycle` — Conditional `in_progress` (resolver.js)

**Location**: [resolver.js lines 168–173](/.github/orchestration/scripts/lib/resolver.js#L168-L173)

**Current code pattern**:

```javascript
// ── in_progress ───────────────────────────────────────────────────────
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, {
    ...baseOpts,
    details: 'Task ' + taskId + ' is in progress; checking Coder results and recording'
  });
}
```

**New code pattern**:

```javascript
// ── in_progress ───────────────────────────────────────────────────────
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  // Task has handoff but no report → Coder hasn't run yet; spawn Coder
  if (task.handoff_doc && !task.report_doc) {
    return makeResult(NEXT_ACTIONS.EXECUTE_TASK, {
      ...baseOpts,
      details: 'Task ' + taskId + ' has handoff but no report; spawning Coder to execute'
    });
  }
  // Task has both handoff and report → Coder finished; engine processes report
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, {
    ...baseOpts,
    details: 'Task ' + taskId + ' is in progress with report; processing Coder results'
  });
}
```

**Decision matrix** for `in_progress` status:

| `handoff_doc` | `report_doc` | Action | Rationale |
|---------------|-------------|--------|-----------|
| truthy | falsy | `execute_task` | Coder hasn't run yet |
| truthy | truthy | `update_state_from_task` | Coder finished; engine should process |
| falsy | falsy | Falls through to `UPDATE_STATE_FROM_TASK` | Defensive; handoff should always exist for `in_progress` |

---

### Fix 3: Status Normalization (pipeline-engine.js)

**Insertion point**: Inside the existing task report pre-read block at [pipeline-engine.js line 163](/.github/orchestration/scripts/lib/pipeline-engine.js#L163) — after extracting `context.report_status` from frontmatter, before passing to mutation.

**New normalization logic** (insert after `context.report_status = fm.status || null;`):

```javascript
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
```

**Normalization map** (defined as `STATUS_SYNONYMS` constant inside the pre-read block):

| Raw Value | Normalized Value |
|-----------|------------------|
| `'pass'` | `'complete'` |
| `'fail'` | `'failed'` |
| `'complete'` | `'complete'` (no change) |
| `'partial'` | `'partial'` (no change) |
| `'failed'` | `'failed'` (no change) |
| Anything else | **HARD ERROR** (exit 1) |

---

### Fix 4: `applyTaskTriage` Auto-Approve (mutations.js)

**Location**: [mutations.js lines 372–375](/.github/orchestration/scripts/lib/mutations.js#L372-L375)

**Current code pattern**:

```javascript
function applyTaskTriage(state, triageResult) {
  // Skip case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }
  // ... rest of function
```

**New code pattern**:

```javascript
function applyTaskTriage(state, triageResult) {
  // Null/null case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when task has a report (proof of execution)
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;
      task.review_verdict = REVIEW_VERDICTS.APPROVED;
      task.review_action = REVIEW_ACTIONS.ADVANCED;
      task.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `task[P${triageResult.phase_index}T${triageResult.task_index}].status → complete (auto-approved: clean report, no triage action)`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_verdict → approved`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_action → advanced`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip (nothing to auto-approve)
    return { state, mutations_applied: [] };
  }
  // ... rest of function unchanged
```

**Conditions**:

| Verdict | Action | `task.report_doc` | Behavior |
|---------|--------|-------------------|----------|
| `null` | `null` | truthy | Auto-approve: set `complete`, `approved`, `advanced`, reset triage |
| `null` | `null` | falsy | Original skip: `{ state, mutations_applied: [] }` |
| non-null | non-null | — | Existing triage routing (unchanged) |

---

### Fix 4: `applyPhaseTriage` Auto-Approve (mutations.js)

**Location**: [mutations.js lines 421–423](/.github/orchestration/scripts/lib/mutations.js#L421-L423)

**Current code pattern**:

```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }
  // ... rest of function
```

**New code pattern**:

```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when phase has a report (proof of phase work)
    const phase = state.execution.phases[triageResult.phase_index];
    if (phase.phase_report) {
      phase.phase_review_verdict = REVIEW_VERDICTS.APPROVED;
      phase.phase_review_action = PHASE_REVIEW_ACTIONS.ADVANCED;
      phase.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `phase[P${triageResult.phase_index}].phase_review_verdict → approved (auto-approved: clean report, no triage action)`,
          `phase[P${triageResult.phase_index}].phase_review_action → advanced`,
          `phase[P${triageResult.phase_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip
    return { state, mutations_applied: [] };
  }
  // ... rest of function unchanged
```

---

### Fix 5: Internal `advance_phase` Handling (pipeline-engine.js)

**Insertion point**: [pipeline-engine.js lines 285–290](/.github/orchestration/scripts/lib/pipeline-engine.js#L285-L290) — after the resolve step, before the return statement.

**Current code pattern**:

```javascript
  // ── RESOLVE ──
  const config = io.readConfig(configPath);
  const resolved = resolveNextAction(proposedState, config);

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
}
```

**New code pattern**:

```javascript
  // ── RESOLVE ──
  const config = io.readConfig(configPath);
  let resolved = resolveNextAction(proposedState, config);

  // ── INTERNAL ACTION HANDLING ──
  // Handle advance_phase internally: apply phase advancement, re-validate, re-resolve
  if (resolved.action === NEXT_ACTIONS.ADVANCE_PHASE) {
    const phase = proposedState.execution.phases[proposedState.execution.current_phase];
    phase.status = PHASE_STATUSES.COMPLETE;

    const isLastPhase = (proposedState.execution.current_phase >= proposedState.execution.phases.length - 1);
    if (isLastPhase) {
      proposedState.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      proposedState.execution.status = 'complete';
      // current_phase stays at last valid index — never exceeds phases.length - 1
    } else {
      proposedState.execution.current_phase += 1;
    }

    allMutationsApplied.push(
      `phase[${resolved.context.phase_index}].status → complete`,
      isLastPhase
        ? 'pipeline.current_tier → review, execution.status → complete'
        : `execution.current_phase → ${proposedState.execution.current_phase}`
    );

    // Re-validate after internal advancement
    const preAdvanceState = deepClone(proposedState);
    proposedState.project.updated = new Date().toISOString();
    const advanceValidation = validateTransition(preAdvanceState, proposedState);
    if (!advanceValidation.valid) {
      const firstError = advanceValidation.errors[0];
      return makeErrorResult(
        `Validation failed after advance_phase: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }

    // Write state after advancement
    io.writeState(projectDir, proposedState);

    // Re-resolve to get external action
    resolved = resolveNextAction(proposedState, config);

    // Bounded loop guard: if re-resolved action is still not external, hard error
    if (!EXTERNAL_ACTIONS.has(resolved.action)) {
      return makeErrorResult(
        `Internal re-resolve produced unmapped action '${resolved.action}' after handling 'advance_phase'. Max internal iterations (1) exceeded.`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        true
      );
    }
  }

  // ── UNMAPPED ACTION GUARD ──
  if (!EXTERNAL_ACTIONS.has(resolved.action)) {
    return makeErrorResult(
      `Pipeline resolved unmapped action '${resolved.action}'. Expected one of: ${[...EXTERNAL_ACTIONS].join(', ')}. This indicates a resolver bug.`,
      event, allMutationsApplied,
      { current_phase: proposedState.execution.current_phase },
      true
    );
  }

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
}
```

**`EXTERNAL_ACTIONS` set** — defined at module scope in `pipeline-engine.js`:

```javascript
/**
 * The 18 actions the Orchestrator's routing table handles.
 * Any resolved action not in this set is a bug.
 * @type {Set<string>}
 */
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
  NEXT_ACTIONS.DISPLAY_HALTED,
  NEXT_ACTIONS.DISPLAY_COMPLETE
]);
```

**Required additional import** in `pipeline-engine.js`:

```javascript
const { PIPELINE_TIERS, NEXT_ACTIONS, PHASE_STATUSES } = require('./constants');
```

`PHASE_STATUSES` is a new import — currently only `PIPELINE_TIERS` and `NEXT_ACTIONS` are imported from constants.

**Phase advancement state mutations** (applied during internal handling):

| Mutation | Last Phase | Non-Last Phase |
|----------|-----------|----------------|
| `phase.status` | `PHASE_STATUSES.COMPLETE` | `PHASE_STATUSES.COMPLETE` |
| `execution.current_phase` | **unchanged** (stays at last valid index) | `+= 1` |
| `execution.status` | `'complete'` | unchanged |
| `pipeline.current_tier` | `PIPELINE_TIERS.REVIEW` | unchanged |

**Expected external actions after re-resolve**:

| Scenario | Tier After Advancement | Re-resolved Action |
|----------|----------------------|-------------------|
| Non-last phase (more phases remain) | `execution` | `create_phase_plan` (new phase is `not_started`) |
| Last phase completed | `review` | `spawn_final_reviewer` (final review not started) |

**This also resolves Error 6**: `current_phase` never exceeds `phases.length - 1`. The V1 validator check `cp >= phases.length` is never triggered because last-phase advancement sets `execution.status = 'complete'` and `pipeline.current_tier = 'review'` instead of incrementing past the end.

---

### Fix 3: Task Report Skill — Reinforced Vocabulary (SKILL.md)

**File**: `.github/skills/generate-task-report/SKILL.md`

**Addition**: Insert an explicit constraint block immediately before the existing status classification table:

```markdown
> **IMPORTANT: The `status` field in the frontmatter MUST be exactly one of: `complete`, `partial`, or `failed`. Do NOT use synonyms like `pass`, `fail`, `success`, `done`, or any other word. The pipeline engine will reject reports with unrecognized status values.**
```

**File**: `.github/skills/generate-task-report/templates/TASK-REPORT.md`

**Change**: Update the frontmatter status field comment:

```yaml
status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms
```

---

### Fix 1: Master Plan Template — New Frontmatter Field

**File**: `.github/skills/create-master-plan/templates/MASTER-PLAN.md`

**Current frontmatter**:

```yaml
---
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
---
```

**Updated frontmatter**:

```yaml
---
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
total_phases: {NUMBER}
---
```

| Field | Type | Description |
|-------|------|-------------|
| `total_phases` | integer ≥ 1 | Total execution phases. Must match the number of phase outlines in the document body. Filled by the Architect when writing the master plan. |

## `log-error` Skill Structure

### Directory Layout

```
.github/skills/log-error/
├── SKILL.md                          # Skill definition with frontmatter
└── templates/
    └── ERROR-LOG.md                  # Error log document template
```

### SKILL.md Interface

```yaml
---
name: log-error
description: 'Log pipeline execution errors to a structured per-project error log. Use when the pipeline returns success: false, when an agent produces invalid output, or when manual intervention is needed. Appends numbered entries to an append-only error log file.'
---
```

**Skill workflow** (content of SKILL.md body):

1. **When to invoke**: The Orchestrator invokes this skill when `pipeline.js` returns `{ success: false, ... }` — this is near-mandatory, not optional
2. **Error log file path**: `{PROJECT-DIR}/{NAME}-ERROR-LOG.md`
3. **If file does not exist**: Create it using the bundled template, fill frontmatter, write the first entry as `## Error 1`
4. **If file exists**: Read existing file, increment `entry_count` in frontmatter, update `last_updated`, append new entry section after the last `---` horizontal rule
5. **Entry numbering**: Sequential starting at 1; read current `entry_count` from frontmatter to determine next number
6. **Append-only**: Never modify or delete existing entries

### ERROR-LOG.md Template

```yaml
---
project: "{PROJECT-NAME}"
type: "error-log"
created: "{ISO-DATE}"
last_updated: "{ISO-DATE}"
entry_count: 0
---
```

**Entry template** (appended per error):

```markdown
## Error {N}: {Brief Symptom Title}

| Field | Value |
|-------|-------|
| **Entry** | {N} |
| **Timestamp** | {ISO-8601} |
| **Pipeline Event** | {event name, e.g. `task_completed`} |
| **Pipeline Action** | {resolved action at failure, or `N/A`} |
| **Severity** | {`critical` \| `high` \| `medium` \| `low`} |
| **Phase** | {phase index or `N/A`} |
| **Task** | {task index or `N/A`} |

### Symptom

{1-3 sentences: observable failure}

### Pipeline Output

```json
{Raw JSON from pipeline engine}
```

### Root Cause

{1-3 sentences, or "Under investigation."}

### Workaround Applied

{Recovery action, or "None — awaiting fix."}

---
```

**Entry field contract**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Entry | integer ≥ 1 | Yes | Sequential entry number |
| Timestamp | ISO-8601 string | Yes | When the error occurred |
| Pipeline Event | string | Yes | Event being processed at failure time |
| Pipeline Action | string \| `'N/A'` | Yes | Resolved action at failure, or `'N/A'` if pre-resolution |
| Severity | `'critical'` \| `'high'` \| `'medium'` \| `'low'` | Yes | Per severity guide |
| Phase | integer \| `'N/A'` | Yes | Current phase index |
| Task | integer \| `'N/A'` | Yes | Current task index |
| Symptom | markdown | Yes | Observable failure (1-3 sentences) |
| Pipeline Output | JSON block | Yes | Raw `{ success: false, ... }` object |
| Root Cause | markdown | Yes | Diagnosis or "Under investigation." |
| Workaround Applied | markdown | Yes | Recovery action or "None — awaiting fix." |

**Severity classification guide**:

| Severity | Criteria |
|----------|----------|
| `critical` | Pipeline cannot proceed; blocks all execution (unmapped action, validation error, phase init failure) |
| `high` | Pipeline produces incorrect state but doesn't crash (wrong action returned, stuck status) |
| `medium` | Pipeline works around issue with degraded behavior (status synonym normalized) |
| `low` | Cosmetic or informational; no pipeline impact |

### Orchestrator Agent Update

**File**: `.github/agents/orchestrator.agent.md`

**Changes**:

1. Add `log-error` to the skill references section
2. Update the error handling section to invoke the skill automatically:

```markdown
### Error Handling

If the pipeline exits with code 1, parse the error result:
{ "success": false, "error": "...", ... }

1. **Log the error**: Invoke the `log-error` skill to append a structured entry to `{NAME}-ERROR-LOG.md`
2. **Display**: Show `result.error` to the human
3. **Halt**: Do not attempt automatic recovery from pipeline errors
```

## API Endpoints

> No HTTP API. The CLI contract for `pipeline.js` is unchanged. No new events, flags, or output fields.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| *(none)* | — | Zero npm dependencies — unchanged (NFR-3) |

### Internal Dependencies (changes only)

**New import in `pipeline-engine.js`**:

```javascript
// Current imports:
const { PIPELINE_TIERS, NEXT_ACTIONS } = require('./constants');

// Updated imports:
const { PIPELINE_TIERS, NEXT_ACTIONS, PHASE_STATUSES } = require('./constants');
```

`PHASE_STATUSES` is needed for the internal `advance_phase` handler to set `phase.status = PHASE_STATUSES.COMPLETE`.

**New imports in `mutations.js`** (if not already imported):

Verify that `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS` are already imported. Based on the existing `applyTaskTriage` implementation (mutations.js lines 397–408), they are already in scope.

No other dependency changes. The module dependency graph is unchanged:

```
pipeline.js
  └─→ pipeline-engine.js
        ├─→ mutations.js        ← MODIFIED (Errors 1, 4)
        │     └─→ constants.js  ← PRESERVED
        ├─→ state-io.js         ← UNCHANGED
        ├─→ resolver.js         ← MODIFIED (Error 2)
        │     └─→ constants.js
        ├─→ state-validator.js  ← PRESERVED
        │     └─→ constants.js
        └─→ triage-engine.js    ← PRESERVED
              └─→ constants.js
```

## File Structure

### Modified Files

```
.github/orchestration/scripts/
├── lib/
│   ├── pipeline-engine.js             # MODIFIED — pre-read, normalization, internal action, guard
│   ├── mutations.js                   # MODIFIED — handlePlanApproved, applyTaskTriage, applyPhaseTriage
│   └── resolver.js                    # MODIFIED — resolveTaskLifecycle in_progress branch
└── tests/
    ├── pipeline-engine.test.js        # MODIFIED — regression tests for Errors 1-6, guard
    └── mutations.test.js              # MODIFIED — regression tests for Errors 1, 4; update skip-case
```

### New Files

```
.github/skills/
└── log-error/
    ├── SKILL.md                       # NEW — error logging skill definition
    └── templates/
        └── ERROR-LOG.md               # NEW — error log document template
```

### Modified Skill/Agent Files

```
.github/
├── agents/
│   └── orchestrator.agent.md          # MODIFIED — add log-error skill ref, update error handling
└── skills/
    ├── create-master-plan/
    │   └── templates/
    │       └── MASTER-PLAN.md         # MODIFIED — add total_phases frontmatter field
    └── generate-task-report/
        ├── SKILL.md                   # MODIFIED — reinforce status vocabulary constraint
        └── templates/
            └── TASK-REPORT.md         # MODIFIED — reinforce status comment in frontmatter
```

## Test Architecture

### Regression Test Plan

All regression tests use the existing `node:test` + `node:assert/strict` framework. No new test files — tests are added to the existing test files.

#### mutations.test.js — New/Updated Tests

| Test | Describe Block | Assertion |
|------|---------------|-----------|
| RT-1: `handlePlanApproved` initializes phases | `describe('plan_approved')` | `execution.phases.length === context.total_phases`, each entry has `status: 'not_started'`, `execution.total_phases === context.total_phases` |
| RT-7: `applyTaskTriage` auto-approve with report | `describe('applyTaskTriage')` | `task.status === 'complete'`, `task.review_verdict === 'approved'`, `task.review_action === 'advanced'`, `task.triage_attempts === 0` |
| RT-8: `applyTaskTriage` skip without report | `describe('applyTaskTriage')` | `mutations_applied === []`, state unchanged (preserves original skip for no-report case) |
| RT-9: `applyPhaseTriage` auto-approve with report | `describe('applyPhaseTriage')` | `phase.phase_review_verdict === 'approved'`, `phase.phase_review_action === 'advanced'`, `phase.triage_attempts === 0` |
| **Update**: existing skip-case test (~line 710) | `describe('applyTaskTriage')` | Split into RT-7 (with report) and RT-8 (without report); the original test asserts zero mutations but the fixture may include `report_doc` — check and adjust |

**Fixture patterns**: Use existing `makeExecutionState()` factory with overrides:

```javascript
// RT-1: plan_approved phase initialization
const state = makeBaseState(); // planning tier state
state.planning.status = 'complete';
state.planning.steps.master_plan.status = 'complete';
state.planning.steps.master_plan.output = '/path/to/MASTER-PLAN.md';
const context = { total_phases: 3 };
const result = handlePlanApproved(state, context);
assert.equal(result.state.execution.phases.length, 3);

// RT-7: auto-approve with report
const state = clone(makeExecutionState());
const phase = state.execution.phases[0];
const task = phase.tasks[0];
task.status = 'in_progress';
task.report_doc = '/path/to/report.md';
const triageResult = { verdict: null, action: null, phase_index: 0, task_index: 0, details: null };
const result = applyTaskTriage(state, triageResult);
assert.equal(result.state.execution.phases[0].tasks[0].status, 'complete');
assert.equal(result.state.execution.phases[0].tasks[0].review_verdict, 'approved');

// RT-8: skip without report (preserve original behavior)
const state = clone(makeExecutionState());
const phase = state.execution.phases[0];
const task = phase.tasks[0];
task.status = 'in_progress';
task.report_doc = null; // no report → original skip
const before = JSON.stringify(state);
const triageResult = { verdict: null, action: null, phase_index: 0, task_index: 0, details: null };
const result = applyTaskTriage(state, triageResult);
assert.deepEqual(result.mutations_applied, []);
assert.equal(JSON.stringify(result.state), before);
```

#### pipeline-engine.test.js — New Tests

| Test | Describe Block | Mock Setup | Assertion |
|------|---------------|------------|-----------|
| RT-1: `plan_approved` pre-read | `describe('plan_approved')` | `documents: { '/master-plan.md': { frontmatter: { total_phases: 3 } } }` | `result.success === true`, state.execution.phases.length === 3 |
| RT-2: `plan_approved` missing total_phases | `describe('plan_approved')` | `documents: { '/master-plan.md': { frontmatter: {} } }` | `result.success === false`, error mentions `total_phases` |
| RT-3: resolver returns `execute_task` for in_progress+handoff | `describe('execution - task lifecycle')` | State with `task.status = 'in_progress'`, `task.handoff_doc = '/handoff.md'`, `task.report_doc = null` | `result.action === 'execute_task'` |
| RT-5: status normalization `pass` → `complete` | `describe('task_completed')` | Report doc `{ frontmatter: { status: 'pass' } }` | `result.success === true`, triage receives normalized status |
| RT-6: status normalization `banana` → error | `describe('task_completed')` | Report doc `{ frontmatter: { status: 'banana' } }` | `result.success === false`, error mentions `banana` |
| RT-10: `advance_phase` non-last | `describe('advance_phase internal')` | 2-phase state, phase 0 approved, triage auto-approves | `result.action === 'create_phase_plan'`, `execution.current_phase === 1` |
| RT-11: `advance_phase` last phase | `describe('advance_phase internal')` | 2-phase state, phase 1 approved, triage auto-approves | `result.action === 'spawn_final_reviewer'`, `execution.current_phase === 1`, `execution.status === 'complete'` |
| RT-12: V1 passes after last phase | Same as RT-11 | — | `result.success === true` (no V1 error) |
| RT-13: unmapped action guard | `describe('unmapped action guard')` | Construct state that causes resolver to return an internal action not handled by the engine | `result.success === false`, error message contains the action name |

**Mock I/O patterns**: Use existing `createMockIO` factory:

```javascript
// RT-1: master plan pre-read
const mockIO = createMockIO({
  state: createBaseState(s => {
    s.planning.status = 'complete';
    s.planning.human_approved = false;
    Object.values(s.planning.steps).forEach(step => {
      step.status = 'complete';
      step.output = '/doc.md';
    });
    s.planning.steps.master_plan.output = '/master-plan.md';
  }),
  documents: {
    '/master-plan.md': { frontmatter: { total_phases: 3, project: 'TEST' }, body: '# Plan' }
  }
});
const result = executePipeline(
  { event: 'plan_approved', projectDir: '/test', context: {} },
  mockIO
);
assert.equal(result.success, true);
const written = mockIO.getState();
assert.equal(written.execution.phases.length, 3);
```

**Pre-read mocking for `advance_phase` tests (RT-10, RT-11)**:

These tests require the full pipeline flow through triage. The state must be set up such that:
1. A `phase_review_completed` event triggers phase triage
2. Triage returns null/null (clean phase report)
3. `applyPhaseTriage` auto-approves (Error 4 fix)
4. Resolver returns `advance_phase` (Error 5)
5. Engine handles internally and re-resolves

The mock documents map must include the phase report and phase review documents that the triage engine reads.

## Cross-Cutting Concerns

| Concern | Strategy | Change from Baseline |
|---------|----------|---------------------|
| **Error handling** | Hard errors (exit 1, no state written) for: missing `total_phases`, unknown report status, unmapped actions, re-resolve loop exceeded | New error conditions added; follow existing `makeErrorResult` pattern |
| **Validation** | `validateTransition` runs after internal `advance_phase` advancement (additional validation pass). V1 correctness preserved by never exceeding `phases.length - 1` | One additional validation pass on `advance_phase` path |
| **State management** | Pre-read enrichment pattern extended: `plan_approved` → master plan pre-read parallels `task_completed` → task report pre-read. Internal `advance_phase` mutates `proposedState` in-place before re-resolve. | New pre-read; internal mutation before re-resolve |
| **Determinism** | All fixes are deterministic: same state + event → same result. No randomness, no ambient state. Status normalization is a deterministic map. | Unchanged |
| **Atomicity** | `io.writeState` called after internal `advance_phase` advancement + validation. If the `advance_phase` re-resolve path writes state, this is an additional write beyond the initial mutation write (3 writes max for triage + advance_phase events). | One additional write on advance_phase path |
| **Test isolation** | All new tests use mock I/O. No filesystem access in tests. Fixture factories extended for new scenarios. | Unchanged |
| **Backward compatibility** | 4 preserved test suites pass unmodified. Triage decision table unmodified. V1 validator unmodified. | NFR-1 enforced |

## Phasing Recommendations

> These are advisory suggestions. The Tactical Planner makes final phasing decisions.

### Phase 1: Pipeline Engine Fixes + Regression Tests

**Goal**: Fix all 6 bugs in the pipeline engine, mutations, and resolver. Add the unmapped action guard. Write all regression tests. Update the existing skip-case test.

**Scope**:
- **Error 1**: Add master plan pre-read in `pipeline-engine.js` + update `handlePlanApproved` in `mutations.js` + add `total_phases` to master plan template
- **Error 2**: Fix `resolveTaskLifecycle` conditional in `resolver.js`
- **Error 3**: Add status normalization in `pipeline-engine.js` task report pre-read + reinforce task report skill vocabulary
- **Error 4**: Add auto-approve path in `applyTaskTriage` and `applyPhaseTriage` in `mutations.js`
- **Error 5 + 6**: Add internal `advance_phase` handling in `pipeline-engine.js` + define `EXTERNAL_ACTIONS` set + add unmapped action guard
- **Tests**: All regression tests (RT-1 through RT-13) in `mutations.test.js` and `pipeline-engine.test.js` + update existing skip-case test

**Exit criteria**:
- All 4 preserved test suites pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- All new regression tests pass
- Pipeline processes `plan_approved` → phases initialized → `execute_task` → `task_completed` (with normalization) → auto-approve → `advance_phase` → internal handling → next external action, without stalls or routing errors

**Ordering within phase**: Error 4 before Error 5 (dependency). Errors 1, 2, 3 are independent and can be done in any order or in parallel.

### Phase 2: Skill Creation + Agent Updates

**Goal**: Create the `log-error` skill and update the Orchestrator agent definition.

**Scope**:
- Create `.github/skills/log-error/SKILL.md` with skill definition
- Create `.github/skills/log-error/templates/ERROR-LOG.md` with document template
- Update `orchestrator.agent.md` to reference `log-error` skill and auto-log on `success: false`

**Exit criteria**:
- `log-error` skill directory exists with valid `SKILL.md` and template
- Orchestrator agent references the `log-error` skill
- Orchestrator error handling section includes auto-log instructions
- Validation tests pass (if `skills.test.js` or `agents.test.js` check for skill references)

### Phase 3: Documentation and Instruction File Updates

**Goal**: Update all documentation, instruction files, and skill instructions to accurately describe the system. Every change describes the current system behavior only — no references to prior behavior or "before/after" language.

**Scope** — files to update:
- `docs/scripts.md` — restructure the action vocabulary to distinguish internal vs. external actions, document the internal action handling pattern and unmapped action guard
- `docs/pipeline.md` — describe master plan pre-read, status normalization, auto-approve for null/null triage, internal action loop
- `docs/agents.md` — document Orchestrator's `log-error` skill
- `docs/skills.md` — add `log-error` skill entry
- `docs/project-structure.md` — add `ERROR-LOG.md` as a project artifact
- `README.md` — update project files list, mention error logging
- `.github/copilot-instructions.md` — add `ERROR-LOG.md` to project files list
- `.github/instructions/project-docs.instructions.md` — add `ERROR-LOG.md` ownership
- `create-master-plan` SKILL.md — document `total_phases` as a required frontmatter field

**Dependencies**: Phase 1 (pipeline engine fixes) and Phase 2 (skill creation + agent updates) must both be complete before documentation begins. Docs describe the system as it exists after all code and skill changes are applied.

**Exit criteria**:
- All 9 files listed above are updated
- No documentation references prior behavior, migration steps, or "before/after" language — everything reads as if the system always worked this way
- `total_phases` is documented as a required field in the master plan skill instructions
- `ERROR-LOG.md` appears in project structure docs, copilot instructions, and project-docs instructions
- `log-error` skill appears in the skills documentation and agents documentation
- Action vocabulary in `docs/scripts.md` clearly distinguishes internal actions (handled by the engine) from external actions (routed to agents)

**Key documentation principle**: Only describe how the system works. Never mention how it used to work.
