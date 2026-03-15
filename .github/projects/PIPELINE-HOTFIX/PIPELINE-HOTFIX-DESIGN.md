---
project: "PIPELINE-HOTFIX"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Design

## Design Overview

This project has no user-facing UI — it fixes 6 bugs in the pipeline engine scripts and adds a structured error-logging skill. The "design surfaces" are data flows through the pipeline engine, document templates consumed/produced by agents, state lifecycle transitions for tasks and phases, and the contract interfaces between the engine, mutation handlers, and resolver. This document specifies each of those surfaces in detail so the Architect and Coder have unambiguous reference for implementation.

## Data Flow Designs

### DF-1: Master Plan Pre-Read for `plan_approved` (Error 1)

This flow adds a new pre-read path in `pipeline-engine.js` that enriches the mutation context with phase count data before `handlePlanApproved` runs.

```
Orchestrator dispatches event: plan_approved
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  pipeline-engine.js  —  pre-mutation enrichment             │
│                                                             │
│  1. Read currentState.planning.steps.master_plan.output     │
│     → masterPlanPath (string)                               │
│                                                             │
│  2. io.readDocument(masterPlanPath)                          │
│     → { frontmatter: { total_phases: N, ... }, body }       │
│                                                             │
│  3. Extract total_phases from frontmatter                   │
│     → context.total_phases = N                              │
│                                                             │
│  4. Guard: if total_phases is missing, NaN, or ≤ 0          │
│     → return hard error (exit 1, no state written)          │
│                                                             │
│  5. Pass enriched context to handlePlanApproved(state, ctx) │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  mutations.js  —  handlePlanApproved(state, context)        │
│                                                             │
│  Reads: context.total_phases                                │
│  Writes:                                                    │
│    state.planning.human_approved = true                     │
│    state.pipeline.current_tier = 'execution'                │
│    state.execution.status = 'in_progress'                   │
│    state.execution.total_phases = context.total_phases      │
│    state.execution.phases = [                               │
│      { status: 'not_started', ... } × context.total_phases  │
│    ]                                                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
  Validate → Resolve → return external action
```

**Context contract** (new field added to `plan_approved` context):

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `total_phases` | `number` (integer ≥ 1) | Master plan frontmatter | Yes | Number of execution phases to initialize |

**Phase entry initialization template** (each entry in `execution.phases[]`):

| Field | Initial Value | Notes |
|-------|---------------|-------|
| `status` | `'not_started'` | From `PHASE_STATUSES.NOT_STARTED` |
| `tasks` | `[]` | Empty; Tactical Planner populates later |
| `phase_plan_doc` | `null` | Set by `phase_plan_created` |
| `phase_report` | `null` | Set by `phase_report_created` |
| `phase_review_doc` | `null` | Set by phase review |
| `phase_review_verdict` | `null` | Set by triage |
| `phase_review_action` | `null` | Set by triage |
| `triage_attempts` | `0` | Counter for triage retries |

**Error conditions**:

| Condition | Behavior | Error Message Pattern |
|-----------|----------|-----------------------|
| `master_plan.output` path missing from state | Hard error, exit 1 | `"Master plan path not found in state.planning.steps.master_plan.output"` |
| `io.readDocument()` fails (file not found) | Hard error, exit 1 | `"Failed to read master plan at '{path}': {reason}"` |
| `total_phases` missing from frontmatter | Hard error, exit 1 | `"Master plan frontmatter missing 'total_phases' field"` |
| `total_phases` not a positive integer | Hard error, exit 1 | `"Master plan total_phases must be a positive integer, got '{value}'"` |

---

### DF-2: Status Normalization for `task_completed` (Error 3)

This flow extends the existing task-report pre-read path in `pipeline-engine.js` with a normalization step between reading the report and passing context to the mutation.

```
Orchestrator dispatches event: task_completed
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  pipeline-engine.js  —  existing task report pre-read       │
│                                                             │
│  1. io.readDocument(context.report_path)                    │
│     → { frontmatter: { status, severity, ... }, body }      │
│                                                             │
│  2. Extract status from frontmatter                         │
│     → raw_status (string)                                   │
│                                                             │
│  ┌──────────────────────────────────────────┐  ← NEW STEP  │
│  │  3. Normalize status vocabulary           │               │
│  │     Synonym map:                          │               │
│  │       'pass' → 'complete'                 │               │
│  │       'fail' → 'failed'                   │               │
│  │     Valid set after normalization:         │               │
│  │       { 'complete', 'partial', 'failed' } │               │
│  │                                           │               │
│  │  4. Guard: if status ∉ valid set          │               │
│  │     → hard error (exit 1, no state)       │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  5. context.report_status = normalized_status               │
│     Pass enriched context to handleTaskCompleted             │
└─────────────────────────────────────────────────────────────┘
```

**Normalization map**:

| Raw Value | Normalized Value | Rationale |
|-----------|------------------|-----------|
| `'pass'` | `'complete'` | Common LLM synonym observed in RAINBOW-HELLO benchmark |
| `'fail'` | `'failed'` | Obvious grammatical variant |
| `'complete'` | `'complete'` | Already valid — no change |
| `'partial'` | `'partial'` | Already valid — no change |
| `'failed'` | `'failed'` | Already valid — no change |
| Anything else | **HARD ERROR** | Unknown vocabulary must not be silently accepted |

**Error condition**:

| Condition | Behavior | Error Message Pattern |
|-----------|----------|-----------------------|
| Status not in valid set after normalization | Hard error, exit 1 | `"Unrecognized task report status: '{raw_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)"` |

---

### DF-3: Internal `advance_phase` Re-Resolve Loop (Error 5)

After the resolver returns an action, the pipeline engine must check whether the action is internal. If it is `advance_phase`, the engine handles it internally and re-resolves to obtain an external action.

```
  resolveNextAction(proposedState, config)
        │
        ▼
  ┌─ Is action 'advance_phase'? ──────────────────────────────┐
  │  YES                                            NO         │
  │   │                                              │         │
  │   ▼                                              │         │
  │  Apply phase advancement:                        │         │
  │   ├─ currentPhase.status = 'complete'            │         │
  │   ├─ Is last phase?                              │         │
  │   │   YES → execution.status = 'complete'        │         │
  │   │         current_phase stays at last index     │         │
  │   │   NO  → current_phase += 1                   │         │
  │   │                                              │         │
  │   ▼                                              │         │
  │  Re-validate proposedState                       │         │
  │   ├─ Validation fails → hard error (exit 1)     │         │
  │   │                                              │         │
  │   ▼                                              │         │
  │  Re-resolve: resolveNextAction(proposedState)    │         │
  │   │                                              │         │
  │   ▼                                              │         │
  │  Is new action still internal/unmapped?          │         │
  │   YES → hard error (exit 1, bounded loop)       │         │
  │   NO  → use new action as final result           │         │
  └────────────────────────────────────────┬─────────┘         │
                                           │                   │
                                           ▼                   ▼
                                  Return external action to Orchestrator
```

**Re-resolve loop bound**: Maximum 1 internal iteration. If the second resolve returns another internal action, the engine produces a hard error.

**Phase advancement state mutations** (applied during internal handling):

| Mutation | Last Phase | Non-Last Phase |
|----------|-----------|----------------|
| `currentPhase.status` | `'complete'` | `'complete'` |
| `execution.current_phase` | **unchanged** (stays at last valid index) | `+= 1` |
| `execution.status` | `'complete'` | unchanged |
| `pipeline.current_tier` | `'review'` (if last phase) | unchanged |

**Expected external actions after re-resolve**:

| Scenario | Expected External Action |
|----------|------------------------|
| Mid-project (more phases remain) | `create_phase_plan` |
| Last phase completed | `transition_to_review` → handled internally → `spawn_final_reviewer` or `request_final_approval` |

---

### DF-4: Unmapped Action Guard

After the pipeline engine obtains a final resolved action (including after any internal re-resolve iterations), it validates the action against the known external vocabulary before returning it.

```
  Final resolved action
        │
        ▼
  ┌─ Is action in EXTERNAL_ACTIONS set (18 values)? ──┐
  │  YES                                        NO     │
  │   │                                          │     │
  │   ▼                                          ▼     │
  │  Return { success: true, action, ... }   Hard error│
  │                                          exit 1    │
  │                                          "Unmapped │
  │                                          action:   │
  │                                          '{name}'" │
  └────────────────────────────────────────────────────┘
```

**External actions set** (18 values — from constants.js):

`spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `request_plan_approval`, `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer`, `generate_phase_report`, `spawn_phase_reviewer`, `spawn_final_reviewer`, `request_final_approval`, `gate_task`, `gate_phase`, `display_halted`, `display_complete`

**Error message pattern**: `"Pipeline resolved unmapped action '{action}'. Expected one of: [list]. This indicates a resolver bug."`

---

## State Lifecycle Designs

### SL-1: Corrected Task State Lifecycle (after Errors 2, 3, 4)

```
                          ┌────────────────────────────────────────────────────────┐
                          │              TASK STATE LIFECYCLE (corrected)           │
                          └────────────────────────────────────────────────────────┘

  not_started ──(task_handoff_created)──► in_progress
       │                                      │
       │                                      ├── handoff_doc set, no report_doc
       │                                      │   → Resolver returns: execute_task     ◄── Error 2 fix
       │                                      │
       │                                      ├── (Coder executes task)
       │                                      │
       │                                      ├── handoff_doc set, report_doc set
       │                                      │   → Resolver returns: update_state_from_task
       │                                      │
       │                                      ▼
       │                              task_completed event
       │                                      │
       │                                      ├── Pre-read: normalize status           ◄── Error 3 fix
       │                                      │   'pass' → 'complete'
       │                                      │   'fail' → 'failed'
       │                                      │   unknown → HARD ERROR
       │                                      │
       │                                      ▼
       │                              Triage evaluates report
       │                                      │
       │                   ┌──────────────────┼──────────────────┐
       │                   │                  │                  │
       │                   ▼                  ▼                  ▼
       │            null verdict/      verdict set         verdict set
       │            null action        action set          action set
       │            + report exists                        (corrective/halt)
       │                   │                  │                  │
       │                   ▼                  ▼                  ▼
       │           AUTO-APPROVE ◄── Error 4   Standard       Halt / Retry
       │           task.status =    fix       triage path    path
       │             'complete'               (unchanged)    (unchanged)
       │           verdict =
       │             'approved'
       │           action =
       │             'advanced'
       │           triage_attempts = 0
       │                   │
       │                   ▼
       │              complete ──(advance)──► (task done; phase checks next task)
       │
       └──────────────────────────────────────────────────────────────────────────
```

**Key design decisions for task lifecycle**:

| Decision | Rationale |
|----------|-----------|
| Auto-approve only when `report_doc` exists | Prevents auto-approving tasks that haven't been executed yet — the report is proof of execution |
| Reset `triage_attempts` to 0 on auto-approve | Clean tasks should not carry triage attempt counts into the completed state |
| Resolver split on `in_progress` by presence of `report_doc` | A task with a handoff but no report needs execution; a task with both needs state update from the report |

---

### SL-2: Corrected Phase State Lifecycle (after Errors 4, 5, 6)

```
                          ┌────────────────────────────────────────────────────────┐
                          │             PHASE STATE LIFECYCLE (corrected)           │
                          └────────────────────────────────────────────────────────┘

  not_started ──(phase_plan_created)──► in_progress
       │                                      │
       │                                      ├── Tasks execute: task lifecycle (SL-1)
       │                                      │
       │                                      ├── All tasks complete
       │                                      │   → generate_phase_report
       │                                      │
       │                                      ├── phase_report set
       │                                      │   → spawn_phase_reviewer
       │                                      │
       │                                      ├── phase_review_doc set
       │                                      │   → triage_phase
       │                                      │
       │                                      ▼
       │                              Phase Triage evaluates
       │                                      │
       │                   ┌──────────────────┼──────────────────┐
       │                   │                  │                  │
       │                   ▼                  ▼                  ▼
       │            null verdict/      verdict set         verdict set
       │            null action        action set          action set
       │            + phase_report                         (halt / retry)
       │              exists                               
       │                   │                  │                  │
       │                   ▼                  ▼                  ▼
       │           AUTO-APPROVE ◄── Error 4   Standard       Halt / Retry
       │           verdict =        fix       triage path    path
       │             'approved'               (unchanged)    (unchanged)
       │           action =
       │             'advanced'
       │           triage_attempts = 0
       │                   │
       │                   ▼
       │           Resolver returns: advance_phase
       │                   │
       │                   ▼
       │           ┌─ INTERNAL HANDLING ──────────────────┐    ◄── Error 5 fix
       │           │                                      │
       │           │  phase.status = 'complete'           │
       │           │                                      │
       │           │  ┌─ Last phase? ───────────┐         │
       │           │  │  YES                 NO │         │
       │           │  │  current_phase       current_phase│
       │           │  │  stays at last       += 1         │
       │           │  │  index                            │
       │           │  │  execution.status                 │
       │           │  │  = 'complete'                     │
       │           │  └─────────────────────────┘         │
       │           │                                      │
       │           │  Re-validate → Re-resolve            │
       │           └──────────────────────────────────────┘
       │                   │                          │
       │                   ▼                          ▼
       │           (last phase)              (more phases)
       │           External action:          External action:
       │           transition_to_review →    create_phase_plan
       │           spawn_final_reviewer
       │                                              ◄── Error 6 resolved:
       │                                                  current_phase never
       │                                                  exceeds last valid index
       └──────────────────────────────────────────────────────────────────────────
```

**Key design decisions for phase lifecycle**:

| Decision | Rationale |
|----------|-----------|
| Auto-approve when `phase_report` exists and triage returns null/null | Same pattern as task-level: report proves phase work is done |
| `advance_phase` handled internally by engine, not surfaced to Orchestrator | This is a mechanical state transition, not an agent-dispatched action |
| `current_phase` capped at last valid index | Prevents V1 validation error; `execution.status = 'complete'` is the completion signal, not index overflow |
| Re-resolve bounded to 1 internal iteration | Prevents infinite loops; surfaces bugs immediately via hard error |

---

### SL-3: Full Pipeline State Transition Overview (Plan Approval → Completion)

```
plan_approved
  │
  ├── Pre-read master plan → extract total_phases         (DF-1)
  ├── handlePlanApproved → initialize phases[]            (Error 1 fix)
  ├── Resolve → create_phase_plan (for phase 0)
  │
  ▼
create_phase_plan → phase_plan_created
  │
  ├── Resolve → create_task_handoff (for task 0)
  │
  ▼
[Task loop — repeated for each task in phase]
  create_task_handoff → task_handoff_created
    │
    ├── Resolve → execute_task                            (Error 2 fix)
    │
    ▼
  execute_task → task_completed
    │
    ├── Pre-read: normalize status                        (Error 3 fix)
    ├── handleTaskCompleted → set report_doc
    ├── Triage → null/null (clean report)
    ├── applyTaskTriage → auto-approve                    (Error 4 fix)
    ├── Resolve → create_task_handoff (next task)
    │            OR generate_phase_report (all tasks done)
    │
    ▼
[End task loop]
  │
  generate_phase_report → phase_report_created
    │
    ├── Resolve → spawn_phase_reviewer
    │
    ▼
  spawn_phase_reviewer → phase_review_completed
    │
    ├── Phase triage → null/null (clean report)
    ├── applyPhaseTriage → auto-approve                   (Error 4 fix)
    ├── Resolve → advance_phase
    ├── Internal: advance phase pointer                   (Error 5 fix)
    ├── current_phase stays valid                         (Error 6 fix)
    ├── Re-resolve → create_phase_plan (next phase)
    │               OR transition_to_review (last phase)
    │
    ▼
[Phase loop — repeated for remaining phases]
  │
  ▼
transition_to_review (internal) → spawn_final_reviewer
  │
  ▼
Final review → request_final_approval → display_complete
```

---

## Error Log Document Design

### EL-1: `{NAME}-ERROR-LOG.md` Document Structure

The error log is a per-project, append-only markdown document. The Orchestrator appends new entries when the pipeline returns `success: false`. No agent rewrites or edits existing entries.

**File path**: `{PROJECT-DIR}/{NAME}-ERROR-LOG.md`

**Document template**:

```markdown
---
project: "{PROJECT-NAME}"
type: "error-log"
created: "{ISO-DATE}"
last_updated: "{ISO-DATE}"
entry_count: {N}
---

# {PROJECT-NAME} — Error Log

## Error 1: {Brief Symptom Title}

| Field | Value |
|-------|-------|
| **Entry** | 1 |
| **Timestamp** | {ISO-8601 timestamp} |
| **Pipeline Event** | {event name that was being processed, e.g. `task_completed`} |
| **Pipeline Action** | {resolved action at time of failure, if available, e.g. `advance_phase`} |
| **Severity** | {`critical` \| `high` \| `medium` \| `low`} |
| **Phase** | {phase index or `N/A`} |
| **Task** | {task index or `N/A`} |

### Symptom

{1-3 sentences: What happened? What was the observable failure?}

### Pipeline Output

```json
{Raw JSON output from the pipeline engine — the `{ success: false, error: "...", ... }` object}
```

### Root Cause

{1-3 sentences: Why did it happen? If unknown, state "Under investigation."}

### Workaround Applied

{What the Orchestrator or human did to proceed, if anything. Otherwise "None — awaiting fix."}

---
```

**Append pattern**: Each new error entry is appended after the last `---` horizontal rule. The frontmatter `entry_count` and `last_updated` are updated on each append.

### EL-2: Error Log Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Entry | integer | Yes | Sequential entry number, starting at 1 |
| Timestamp | ISO-8601 string | Yes | When the error occurred |
| Pipeline Event | string | Yes | The event being processed when the error occurred |
| Pipeline Action | string \| `'N/A'` | Yes | The resolved action at failure time, or `'N/A'` if failure was pre-resolution |
| Severity | enum | Yes | One of: `critical`, `high`, `medium`, `low` |
| Phase | integer \| `'N/A'` | Yes | Current phase index, or `'N/A'` if not in execution tier |
| Task | integer \| `'N/A'` | Yes | Current task index, or `'N/A'` if not in task context |
| Symptom | markdown text | Yes | Observable failure description (1-3 sentences) |
| Pipeline Output | JSON code block | Yes | Raw pipeline engine output object |
| Root Cause | markdown text | Yes | Diagnosis or "Under investigation." |
| Workaround Applied | markdown text | Yes | Recovery action or "None — awaiting fix." |

### EL-3: Severity Classification Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| `critical` | Pipeline cannot proceed; blocks all execution | Unmapped action, validation error, phase initialization failure |
| `high` | Pipeline produces incorrect state but doesn't crash | Wrong action returned, task stuck in wrong status |
| `medium` | Pipeline works around the issue with degraded behavior | Status synonym normalized instead of matching directly |
| `low` | Cosmetic or informational; no pipeline impact | Verbose error message, minor output formatting issue |

---

## Contract Changes

### CC-1: `handlePlanApproved` — New Context Field

**Function**: `handlePlanApproved(state, context)` in `mutations.js`

**Current context contract**:

| Field | Type | Source |
|-------|------|--------|
| *(no context fields used)* | — | — |

**Updated context contract**:

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `total_phases` | `number` (integer ≥ 1) | Master plan frontmatter, injected by pipeline engine pre-read | Yes | Number of execution phases to initialize in `execution.phases[]` |

**Return contract** (updated `mutations_applied` entries):

| Mutation Description | New? |
|----------------------|------|
| `'planning.human_approved → true'` | Existing |
| `'pipeline.current_tier → execution'` | Existing |
| `'execution.status → in_progress'` | Existing |
| `'execution.total_phases → {N}'` | **New** |
| `'execution.phases → [{N} phases initialized]'` | **New** |

---

### CC-2: `applyTaskTriage` — Auto-Approve Path

**Function**: `applyTaskTriage(state, triageResult)` in `mutations.js`

**Current null/null behavior**: Returns `{ state, mutations_applied: [] }` — zero mutations.

**Updated null/null behavior when task has `report_doc`**:

| Mutation | Value |
|----------|-------|
| `task.status` | `TASK_STATUSES.COMPLETE` (`'complete'`) |
| `task.review_verdict` | `REVIEW_VERDICTS.APPROVED` (`'approved'`) |
| `task.review_action` | `REVIEW_ACTIONS.ADVANCED` (`'advanced'`) |
| `task.triage_attempts` | `0` |

**Condition for auto-approve**: `triageResult.verdict === null && triageResult.action === null` AND the task at `triageResult.phase_index` / `triageResult.task_index` has a truthy `report_doc`.

**Condition for original skip** (preserved): `triageResult.verdict === null && triageResult.action === null` AND the task does NOT have a `report_doc` → return `{ state, mutations_applied: [] }` as before.

**Updated `mutations_applied` for auto-approve path**:

```
[
  'task[P{phase_index}T{task_index}].status → complete (auto-approved: clean report, no triage action)',
  'task[P{phase_index}T{task_index}].review_verdict → approved',
  'task[P{phase_index}T{task_index}].review_action → advanced',
  'task[P{phase_index}T{task_index}].triage_attempts → 0'
]
```

---

### CC-3: `applyPhaseTriage` — Auto-Approve Path

**Function**: `applyPhaseTriage(state, triageResult)` in `mutations.js`

**Current null/null behavior**: Returns `{ state, mutations_applied: [] }` — zero mutations.

**Updated null/null behavior when phase has `phase_report`**:

| Mutation | Value |
|----------|-------|
| `phase.phase_review_verdict` | `REVIEW_VERDICTS.APPROVED` (`'approved'`) |
| `phase.phase_review_action` | `PHASE_REVIEW_ACTIONS.ADVANCED` (`'advanced'`) |
| `phase.triage_attempts` | `0` |

**Condition for auto-approve**: `triageResult.verdict === null && triageResult.action === null` AND the phase at `triageResult.phase_index` has a truthy `phase_report`.

**Condition for original skip** (preserved): `triageResult.verdict === null && triageResult.action === null` AND the phase does NOT have a `phase_report` → return `{ state, mutations_applied: [] }` as before.

**Updated `mutations_applied` for auto-approve path**:

```
[
  'phase[P{phase_index}].phase_review_verdict → approved (auto-approved: clean report, no triage action)',
  'phase[P{phase_index}].phase_review_action → advanced',
  'phase[P{phase_index}].triage_attempts → 0'
]
```

---

### CC-4: `resolveTaskLifecycle` — Conditional Action for `in_progress`

**Function**: `resolveTaskLifecycle(state, phase, task, phaseIndex, taskIndex)` in `resolver.js`

**Current `in_progress` branch**: Always returns `update_state_from_task`.

**Updated `in_progress` branch**:

| Condition | Returned Action | Rationale |
|-----------|----------------|-----------|
| `task.handoff_doc` is truthy AND `task.report_doc` is falsy | `execute_task` | Task has been handed off but not executed — spawn the Coder |
| `task.handoff_doc` is truthy AND `task.report_doc` is truthy | `update_state_from_task` | Task has been executed — engine should process the report |
| `task.handoff_doc` is falsy | `create_task_handoff` | Defensive: task in_progress without a handoff shouldn't happen but handle gracefully |

---

### CC-5: Pipeline Engine — Internal Action Handler

**New behavior in pipeline-engine.js**: After `resolveNextAction` returns, the engine checks whether the action requires internal handling.

**Internal action handling contract**:

| Internal Action | Handler Behavior | Re-resolve Expected Action |
|-----------------|------------------|--------------------------|
| `advance_phase` | Apply phase advancement mutations, re-validate, re-resolve | `create_phase_plan` (mid-project) or next external action from review tier |

**Bounded loop invariant**: The engine allows at most 1 internal re-resolve iteration. If the re-resolved action is also not in the external actions set, the engine returns a hard error:

```
"Internal re-resolve produced unmapped action '{action}' after handling '{original_action}'. Max internal iterations (1) exceeded."
```

---

### CC-6: Master Plan Template — New Frontmatter Field

**File**: `.github/skills/create-master-plan/templates/MASTER-PLAN.md`

**Current frontmatter**:
```yaml
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
```

**Updated frontmatter**:
```yaml
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
total_phases: {NUMBER}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_phases` | integer ≥ 1 | Total number of execution phases in this master plan. Must match the number of phase outlines in the document body. |

---

### CC-7: Task Report Skill — Reinforced Vocabulary Constraint

**File**: `.github/skills/generate-task-report/SKILL.md`

The existing status table is correct but insufficient — the LLM Coder used `pass` instead of `complete`. The skill instructions need reinforcement:

**Required additions to SKILL.md**:
1. An explicit constraint block (bold/highlighted) immediately before the status table:

> **IMPORTANT: The `status` field in the frontmatter MUST be exactly one of: `complete`, `partial`, or `failed`. Do NOT use synonyms like `pass`, `fail`, `success`, `done`, or any other word. The pipeline engine will reject reports with unrecognized status values.**

2. The template frontmatter comment should reinforce the constraint:
```yaml
status: "complete"   # MUST be exactly: complete | partial | failed
```

---

## Resolver Fix Design (Error 2)

### RF-1: `resolveTaskLifecycle` Decision Matrix

The following matrix documents every combination of task state fields and the expected resolver output for the `in_progress` status. This replaces the current unconditional `update_state_from_task` return.

| `task.status` | `task.handoff_doc` | `task.report_doc` | `task.review_doc` | Returned Action | Notes |
|---------------|-------------------|-------------------|-------------------|----------------|-------|
| `in_progress` | truthy | falsy | falsy | `execute_task` | **Error 2 fix**: Coder hasn't run yet |
| `in_progress` | truthy | truthy | falsy | `update_state_from_task` | Coder finished; engine processes report |
| `in_progress` | truthy | truthy | truthy | *(subsequent branches handle review)* | Review exists; handled by review verdict branches |
| `in_progress` | falsy | falsy | falsy | `create_task_handoff` | Defensive catch for malformed state |

---

## Test Design Implications

This section documents the state fixtures and assertions that regression tests should validate. Test implementation details are left to the Architect and Coder — this section specifies the **what**, not the **how**.

### TD-1: Regression Test Scenarios

| Test ID | Error | Scenario | Key Assertion |
|---------|-------|----------|---------------|
| RT-1 | Error 1 | `plan_approved` with master plan pre-read containing `total_phases: 3` | `execution.phases.length === 3`, all entries `status: 'not_started'`, `execution.total_phases === 3` |
| RT-2 | Error 1 | `plan_approved` with master plan missing `total_phases` | Hard error returned, no state written |
| RT-3 | Error 2 | Resolver called with `in_progress` task, `handoff_doc` set, no `report_doc` | Returns `execute_task` |
| RT-4 | Error 2 | Resolver called with `in_progress` task, both `handoff_doc` and `report_doc` set | Returns `update_state_from_task` |
| RT-5 | Error 3 | Task report pre-read with `status: 'pass'` | `context.report_status === 'complete'` after normalization |
| RT-6 | Error 3 | Task report pre-read with `status: 'banana'` | Hard error returned |
| RT-7 | Error 4 | `applyTaskTriage` with null/null and task has `report_doc` | Task: `status = 'complete'`, `review_verdict = 'approved'`, `review_action = 'advanced'` |
| RT-8 | Error 4 | `applyTaskTriage` with null/null and task has NO `report_doc` | Zero mutations (original skip behavior preserved) |
| RT-9 | Error 4 | `applyPhaseTriage` with null/null and phase has `phase_report` | Phase: `review_verdict = 'approved'`, `review_action = 'advanced'` |
| RT-10 | Error 5 | Pipeline engine processes `advance_phase` for non-last phase | Internal handling produces `create_phase_plan` as external action; `current_phase` incremented |
| RT-11 | Error 5 | Pipeline engine processes `advance_phase` for last phase | Internal handling produces review-tier external action; `current_phase` stays at last index; `execution.status = 'complete'` |
| RT-12 | Error 6 | After last phase advancement, V1 validation passes | No V1 error; `current_phase < phases.length` |
| RT-13 | Guard | Resolver returns an unmapped action | Hard error with descriptive message naming the action |

### TD-2: Existing Test Update (mutations.test.js skip-case)

The existing test at approximately line 710 of `mutations.test.js` asserts:
- `mutations_applied` is `[]`
- State is unchanged after null/null triage

This test must be split into two cases:
1. **With `report_doc`**: Assert auto-approve mutations (RT-7)
2. **Without `report_doc`**: Assert original skip behavior (RT-8)

The original test fixture at line 710 should be checked for whether the task in `makeExecutionState()` has a `report_doc` set — if so, the fixture needs adjustment for the "without report" case.
