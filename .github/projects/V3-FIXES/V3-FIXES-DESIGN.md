---
project: "V3-FIXES"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Design

## Design Overview

V3-FIXES is a purely internal engineering project with no graphical UI. The "interface" is the behavioral contract between the pipeline engine, the Orchestrator agent, and `state.json`. Design decisions here concern the **correctness of state transitions**, the **clarity of agent instruction text**, and the **trust boundaries** between components — not screens or layouts.

This document specifies four design areas: the corrective task state lifecycle (Goal 1), the Orchestrator's self-healing decision hierarchy and event-loop discipline (Goals 2 & 3), the `plan_approved` pre-read redesign (Goal 4), and the CWD-resilient path resolution strategy (Goal 5). Each area defines the exact behavioral flow, the component interaction model, and where applicable, the verbatim instruction wording to be added to agent `.md` files.

---

## Design Area 1 — Corrective Task State Lifecycle (Goal 1)

### Overview

A corrective task retry is a second execution cycle for a task that received a `changes_requested` code review. The design concern is that the task object accumulates fields from the first execution cycle (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`) that must be cleared before the second execution cycle begins — or the resolver enters an unresolvable combination state and returns `display_halted`.

### Corrective Task State Lifecycle

Each row shows the task object's field values at the boundary of each pipeline step, and which handler is responsible for the transition.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: code_review_completed (verdict = changes_requested)            │
│  Handler: handleCodeReviewCompleted                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Task fields AFTER handler:                                             │
│    status          = "failed"                                           │
│    review_action   = "corrective_task_issued"                           │
│    review_verdict  = "changes_requested"                               │
│    review_doc      = "<review-doc-path>"                               │
│    report_doc      = "<report-doc-path>"       ← set from prior step   │
│    report_status   = "completed"               ← set from prior step   │
│    retries         = N + 1                                              │
│    handoff_doc     = "<original-handoff-path>" ← still from first run  │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓  resolver: status=failed, review_action=corrective_task_issued
                    ↓  → action: create_task_handoff

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: task_handoff_created (doc_path = corrective handoff)          │
│  Handler: handleTaskHandoffCreated                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Clearing logic (presence-based, idempotent):                          │
│    if task.report_doc  → clear report_doc, report_status               │
│    if task.review_doc  → clear review_doc, review_verdict, review_action│
│                                                                         │
│  Task fields AFTER handler:                                             │
│    status          = "in_progress"       ← set by handler              │
│    handoff_doc     = "<corrective-handoff-path>"  ← set by handler     │
│    report_doc      = null                ← CLEARED                     │
│    report_status   = null                ← CLEARED                     │
│    review_doc      = null                ← CLEARED                     │
│    review_verdict  = null                ← CLEARED                     │
│    review_action   = null                ← CLEARED                     │
│    retries         = N + 1               ← unchanged (set in step 1)   │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓  resolver: status=in_progress, handoff_doc set, report_doc null, review_doc null
                    ↓  → action: execute_task  ✅

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: task_completed (result succeeds)                               │
│  Handler: handleTaskCompleted                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Task fields AFTER handler:                                             │
│    status          = "completed"                                        │
│    report_doc      = "<corrective-report-path>"                        │
│    report_status   = "completed"                                        │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓  resolver: status=completed, report_doc set
                    ↓  → action: code_review_completed (second review cycle)

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: code_review_completed (second cycle)                           │
│  Handler: handleCodeReviewCompleted                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Three outcome branches (all three must be present — no dangling else): │
│                                                                         │
│  Branch A — ADVANCED:                                                   │
│    phase.current_task += 1                                              │
│    task.review_verdict = "approved"                                     │
│    → resolver → next task or phase_completed                            │
│                                                                         │
│  Branch B — CORRECTIVE_TASK_ISSUED:                                     │
│    (repeat of Step 1 above — another retry cycle if retries remain)     │
│                                                                         │
│  Branch C — HALTED:                                                     │
│    task.status = "halted"                                               │
│    → resolver → display_halted                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Handler Responsibility Map

| Field | Set by | Cleared by | Clearing condition |
|-------|--------|------------|-------------------|
| `status` | `handleTaskHandoffCreated`, `handleCodeReviewCompleted`, `handleTaskCompleted` | — (transitions, not cleared) | — |
| `handoff_doc` | `handleTaskHandoffCreated` | — | — |
| `report_doc` | `handleTaskCompleted` | `handleTaskHandoffCreated` | `if (task.report_doc)` |
| `report_status` | `handleTaskCompleted` | `handleTaskHandoffCreated` | co-clears with `report_doc` |
| `review_doc` | `handleCodeReviewCompleted` | `handleTaskHandoffCreated` | `if (task.review_doc)` |
| `review_verdict` | `handleCodeReviewCompleted` | `handleTaskHandoffCreated` | co-clears with `review_doc` |
| `review_action` | `handleCodeReviewCompleted` | `handleTaskHandoffCreated` | co-clears with `review_doc` |
| `retries` | `handleCodeReviewCompleted` | — (never cleared — accumulates) | — |

### Idempotent Clearing: Definition and Rationale

**Definition**: The clearing logic in `handleTaskHandoffCreated` is idempotent because it uses presence-based guards (`if (task.report_doc)`, `if (task.review_doc)`). On a first-time task handoff these fields are `null`, so the clearing blocks do not execute and no mutation log entries are emitted. On a corrective handoff these fields are set, so the blocks execute and emit log entries. The function produces the same end state (`report_doc=null`, `review_doc=null`) regardless of how many times it is called on the same task object.

**Why clearing belongs in `handleTaskHandoffCreated` (not `handleCodeReviewCompleted`)**:

| Option | Decision boundary | Dirty-state window | Risk |
|--------|------------------|--------------------|------|
| Clear at `code_review_completed` | Review outcome known | Fields are cleared before handoff is created — state is clean between two separate pipeline calls | If handoff creation fails, the cleared fields are gone with no record |
| **Clear at `task_handoff_created`** ✅ | New execution cycle begins | Fields dirty only during the `create_task_handoff` step — one pipeline call | Clearing happens atomically with the new handoff assignment; if the event is never signaled, the state remains dirty but consistent |

The event `task_handoff_created` carries the semantic meaning "a new execution cycle begins for this task." Clearing stale fields at this exact boundary is semantically correct and keeps the state consistent within each pipeline call boundary.

**Why presence-based checking, not `context.is_correction` checking**:

The `is_correction` flag is a resolver-supplied context hint. Presence-based checking (`if task.report_doc`) is more robust because it:
1. Works even if the context flag is omitted or renamed in a future resolver change
2. Is self-describing — the clearing fires if and only if there is something to clear
3. Does not create a hard dependency between the mutation handler and the resolver's context vocabulary

### Corrective Flow: Failure Modes

| State entering `task_handoff_created` | Field combination | Resolver output before fix | Resolver output after fix |
|--------------------------------------|-------------------|---------------------------|--------------------------|
| First-time handoff | `report_doc=null`, `review_doc=null` | `execute_task` ✅ | `execute_task` ✅ (no change) |
| Corrective handoff | `report_doc=set`, `review_doc=set`, `status=failed` | `display_halted` ❌ | `execute_task` ✅ |
| Corrective handoff, only `report_doc` set | `report_doc=set`, `review_doc=null` | Unresolved branch → halted ❌ | `execute_task` ✅ |

---

## Design Area 2 — Orchestrator Self-Healing Interaction Design (Goals 2 & 3)

### Overview

The Orchestrator agent has two interaction design problems: (1) no explicit hierarchy for what to do when it encounters a diagnosable pipeline error, and (2) no explicit rule about when it is permitted to pause the event loop and ask the human for guidance. These are instruction-text design problems — the fix is precise, prioritized wording in `orchestrator.agent.md`.

### Self-Healing Decision Flow

When the Orchestrator encounters a pipeline error (`result.success === false`) or a state inconsistency it recognizes:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PIPELINE ERROR ENCOUNTERED                                             │
│  (result.success = false, or unrecognized/stuck state)                 │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 1 — CAN I RE-SIGNAL THE CORRECT EVENT?                          │
│  Prerequisite: Orchestrator can identify the correct next event         │
│                and the pipeline event was simply not received           │
├─────────────────────────────────────────────────────────────────────────┤
│  YES → Re-invoke pipeline.js with the correct event and context        │
│         No state.json edits required                                   │
│         No human notification required                                 │
│         Continue the event loop                                        │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ↓ NO (stale/incorrect fields in state)
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 2 — CAN I CLEAR OR NULL STALE FIELDS IN state.json?             │
│  Prerequisite: Orchestrator can identify which fields are stale         │
│                and can null them without inventing new values           │
├─────────────────────────────────────────────────────────────────────────┤
│  YES → Edit state.json CONSERVATIVELY:                                 │
│           Null or clear stale fields only                              │
│           Never set a value that was not returned by a pipeline result  │
│           Never restructure or reorder state objects                   │
│         Log the edit via log-error skill                               │
│         Re-invoke pipeline.js to see if the state now resolves         │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ↓ NO (cannot identify stale fields, or
                           ↓      clearing would require inventing values)
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 3 — LOG AND HALT                                                │
│  Log the error via log-error skill                                     │
│  Display result.error to the human                                     │
│  Stop — do not attempt further automatic recovery                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### "Never Do" List for Self-Healing

These actions are explicitly prohibited and must appear as hard prohibitions in the `orchestrator.agent.md` "What you do NOT do" section:

| Prohibited action | Reason |
|-------------------|--------|
| Modify `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, or any pipeline source file | Source file changes bypass all code review and test coverage; they corrupt the shared system for all future runs |
| Modify agent `.agent.md` files or skill `SKILL.md` files mid-run | Same rationale; agent instructions are versioned artifacts |
| Set a `state.json` field to a non-null value that was not returned by a pipeline result | Inventing state values can produce a superficially valid state that routes incorrectly |
| Ask the human for permission before or after a Level 1 or Level 2 recovery | Self-healing actions at these levels are within the Orchestrator's authorized scope; check-in creates unnecessary pipeline friction |
| Treat a completed side-task (error logging, status reporting) as a pipeline pause point | Side-tasks have no `result.action`; the pipeline event loop must resume immediately |

### Instruction Text Design: Self-Healing Hierarchy

The following text is the exact wording to be added to the **Error Handling** section of `orchestrator.agent.md`, inserted **before** the existing 3-step failure protocol:

```
### Self-Healing Hierarchy

When you encounter a pipeline error or stuck state, follow this priority order — do not skip levels:

1. **Re-signal the correct event.** If you can identify the correct next event and the pipeline simply did not receive it, re-invoke `pipeline.js` with that event and context. No state edits required.
2. **Clear stale fields in `state.json`.** If the state contains stale fields from a prior step, null or clear only those fields — never set a value not returned by a pipeline result. Log the edit, then re-invoke the pipeline.
3. **Log and halt.** If neither option resolves the issue, invoke the `log-error` skill, display the error to the human, and stop.

**Never modify pipeline source files** (`mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, or skills) as a self-healing action — this is never acceptable under any circumstances.
```

### Instruction Text Design: "What You Do NOT Do" Additions

Two explicit prohibitions must be added to the "What you do NOT do" section of `orchestrator.agent.md`:

**Prohibition 1 — Source file modification:**
```
- **Never modify pipeline source files** as a self-healing or workaround action — this includes `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, and skill files. Source file changes bypass code review and test coverage.
```

**Prohibition 2 — Event-loop interruption:**
```
- **Never pause the event loop after a non-terminal side-task.** Completing a side-task (error logging, status reporting, workaround application) is not a pipeline gate. Resume the event loop immediately — do not ask the human "should I continue?" unless `result.action` is one of the six valid pause points listed below.
```

### Event-Loop Control Flow: Valid Pause Points

The Orchestrator event loop must only pause or stop at exactly these six `result.action` values:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  VALID PAUSE / STOP POINTS                                              │
├──────────────────────────┬──────────────────────────────────────────────┤
│  display_halted          │  TERMINAL STOP — pipeline halted             │
│  display_complete        │  TERMINAL STOP — pipeline complete           │
├──────────────────────────┼──────────────────────────────────────────────┤
│  request_plan_approval   │  HUMAN GATE — await plan approval            │
│  request_final_approval  │  HUMAN GATE — await final review approval    │
│  gate_task               │  HUMAN GATE — await task gate decision       │
│  gate_phase              │  HUMAN GATE — await phase gate decision      │
└──────────────────────────┴──────────────────────────────────────────────┘

ANY result.action NOT in this list → action immediately, no human check-in.
```

**Instruction Text Design: Valid Pause Points**

The following text is the exact wording to be added to the **Event Loop** or **Loop Termination** section of `orchestrator.agent.md`:

```
### Valid Pause and Stop Points

The event loop may only pause or stop at these six `result.action` values:

| Action | Type | What to do |
|--------|------|-----------|
| `display_halted` | Terminal stop | Inform human; halt |
| `display_complete` | Terminal stop | Inform human; pipeline complete |
| `request_plan_approval` | Human gate | Display Master Plan; await approval |
| `request_final_approval` | Human gate | Display final review; await approval |
| `gate_task` | Human gate | Display task gate; await decision |
| `gate_phase` | Human gate | Display phase gate; await decision |

Any `result.action` not in this list must be actioned immediately without human check-in. Never ask "should I continue?" after completing a non-terminal side-task.
```

---

## Design Area 3 — `plan_approved` Handler Redesign (Goal 4)

### Overview

`handlePlanApproved` in `pre-reads.js` needs the master plan document path to read `total_phases` from the frontmatter. Currently it reads this path from `context.doc_path`. The documented event API says the context payload for `plan_approved` is `{}`. This mismatch means the Orchestrator must pass a field it is not documented as needing, and may not reliably have.

The fix: derive the path from state when `context.doc_path` is absent. Accept `doc_path` in context when present (backward compatibility).

### Current vs. New Behavior

```
CURRENT BEHAVIOR:
  Orchestrator signals: plan_approved with context = { doc_path: "<master-plan-path>" }
  handlePlanApproved: reads context.doc_path directly
  If doc_path absent → readOrFail fails → success: false

  Problem: Orchestrator must know and supply doc_path.
           Event table documents context as {}.
           Mismatch → fragility → live pipeline failures.

NEW BEHAVIOR (Option C — hybrid + fallback):
  Orchestrator signals: plan_approved with context = {} (or optionally context = { doc_path: "..." })
  handlePlanApproved: checks context.doc_path first (backward compat)
                      if absent → reads state.json from projectDir
                                  → derives doc_path from state.planning.steps[4].doc_path
  If state path unavailable → return success: false with descriptive error message
```

### Path Derivation Flow

```
handlePlanApproved(context, readDocument, projectDir)
  │
  ├─ context.doc_path present?
  │     YES → use context.doc_path directly (existing behavior)
  │
  └─ NO → derive from state
           │
           ├─ Read: path.join(projectDir, 'state.json')
           │     FAIL? → return success: false, error: "Cannot derive master plan path: state.json unreadable"
           │
           ├─ Parse state.planning.steps[4].doc_path
           │     NULL/MISSING? → return success: false, error: "Cannot derive master plan path: state.planning.steps[4].doc_path not set"
           │
           └─ Resolve doc_path relative to projectDir if it is a relative path
              Use resolved path as doc_path → continue to readOrFail(readDocument, doc_path, ...)
```

### Data Flow: Where Each Value Comes From

| Value | Source | Notes |
|-------|--------|-------|
| `context.doc_path` | Orchestrator-supplied event payload | Optional; honored if present |
| `projectDir` | `preRead` function parameter | Already available — no signature change needed |
| `state.planning.steps[4].doc_path` | `state.json` written by pipeline after `master_plan_completed` | Reliable after step index 4 completes |
| `total_phases` | Master plan document frontmatter field | Read via `readDocument` — unchanged behavior |

### State Derivation Precondition

`handlePlanApproved` is only invoked when the `plan_approved` event is signaled. This event only occurs after `request_plan_approval`, which only occurs after `master_plan_completed`. By the time `plan_approved` is signaled, `state.planning.steps[4]` **must already be populated** with the master plan path. The derivation is safe to execute without a retry guard.

### Null-Check Guard Design

The null-check must be explicit and return a descriptive `success: false` rather than an unhandled exception:

```
Pseudocode:
  const stateRaw = readFile(path.join(projectDir, 'state.json'))
  if (!stateRaw) → return { success: false, error: '...' }

  const state = JSON.parse(stateRaw)
  const derivedPath = state?.planning?.steps?.[4]?.doc_path
  if (!derivedPath) → return { success: false, error: '...' }

  doc_path = path.isAbsolute(derivedPath)
    ? derivedPath
    : path.join(projectDir, derivedPath)
```

### API Documentation Updates

After the handler change, the event signaling reference table must be updated to reflect that `doc_path` is optional:

| Event | Before | After |
|-------|--------|-------|
| `plan_approved` context | `{}` (documented) vs. `{ doc_path }` (required) — **mismatch** | `{ doc_path?: string }` — optional; handler derives from state if absent |

Routing table entry #13 (`request_plan_approval`) must remove any implied `doc_path` requirement from its description.

---

## Design Area 4 — CWD Hardening (Goal 5)

### Overview

Three layers of defense are needed: (1) fix the single CWD-dependent path in `state-io.js` so config discovery never fails due to CWD; (2) add an Orchestrator rule to always invoke `pipeline.js` with a stable reference; (3) add a Coder agent rule to restore CWD after task execution.

### Layer 1: `state-io.js` Path Resolution (Primary Fix)

**File**: `.github/orchestration/scripts/lib/state-io.js`  
**Function**: `readConfig`  
**Location**: The fallback config path (triggered when `--config` flag is absent)

```
BEFORE (CWD-dependent):
  resolvedPath = path.join(process.cwd(), '.github', 'orchestration.yml')
  Problem: if CWD ≠ workspace root → orchestration.yml not found → MODULE_NOT_FOUND

AFTER (__dirname-relative):
  resolvedPath = path.resolve(__dirname, '../../../orchestration.yml')
  Result: always resolves to <workspace-root>/.github/orchestration.yml
          regardless of process.cwd()
```

**Path derivation verification**:

```
__dirname = <repo>/.github/orchestration/scripts/lib
../        = <repo>/.github/orchestration/scripts
../../     = <repo>/.github/orchestration
../../../  = <repo>/.github
../../../orchestration.yml = <repo>/.github/orchestration.yml  ✅
```

**Change scope**: One line change in `readConfig`. No other files affected. All existing tests continue to pass (they do not depend on CWD for config discovery).

### Layer 2: Orchestrator Agent Pipeline Invocation Rule (Secondary Hardening)

**File**: `.github/agents/orchestrator.agent.md`

The Orchestrator must invoke `pipeline.js` with a stable reference that does not depend on the current working directory being the workspace root.

**Instruction Text Design** — exact wording to be added to the Pipeline Execution section of `orchestrator.agent.md`:

```
### Pipeline Invocation Rule

Always invoke `pipeline.js` using one of these two forms — never use a relative path alone:

1. **Absolute path**: `node /absolute/path/to/.github/orchestration/scripts/pipeline.js ...`
2. **cd prefix**: `cd <workspace-root> && node .github/orchestration/scripts/pipeline.js ...`

A Coder agent may have changed the working directory during task execution. Using a relative path without a `cd` prefix will fail silently if CWD has drifted.
```

### Layer 3: Coder Agent CWD Restoration Rule (Tertiary Hardening)

**File**: `.github/agents/coder.agent.md`

The Coder agent's workflow currently has no post-task cleanup step. It must explicitly restore CWD after running task commands.

**Instruction Text Design** — exact wording to be added to the Coder agent's workflow steps, as the final step before saving the Task Report:

```
**CWD restoration**: After running any terminal commands inside a project subdirectory,
restore the working directory to the workspace root before signaling task completion:
  cd <workspace-root>
Failure to restore CWD will silently break all subsequent pipeline.js invocations in this run.
```

### Interaction Between the Three Layers

```
                    WITHOUT ANY FIX:
Coder runs: cd /project/subdir && npm test
  → CWD = /project/subdir
Orchestrator runs: node .github/orchestration/scripts/pipeline.js ...
  → Node.js cannot find pipeline.js (relative from /project/subdir)
  → or pipeline.js finds state-io.js, which looks for:
       /project/subdir/.github/orchestration.yml  ← WRONG ❌

                    WITH LAYER 1 ONLY (state-io.js fix):
Coder misses CWD restore → CWD = /project/subdir
Orchestrator runs: node .github/orchestration/scripts/pipeline.js ...
  → Node.js fails to find pipeline.js if relative path used ❌
  → BUT if absolute path used: pipeline.js found ✓
  → state-io.js config lookup: path.resolve(__dirname, '...') → CORRECT ✅

                    WITH ALL THREE LAYERS:
Coder restores CWD to workspace root (Layer 3)
Orchestrator uses cd prefix or absolute path (Layer 2)
state-io.js never depends on CWD (Layer 1)
  → pipeline.js found ✅
  → orchestration.yml found ✅
  → all path resolutions correct ✅
```

### Defense-in-Depth Summary

| Layer | File | Fix type | Failure prevented |
|-------|------|----------|--------------------|
| 1 (Primary) | `state-io.js` | Code change | config discovery fails even when pipeline.js is found |
| 2 (Secondary) | `orchestrator.agent.md` | Instruction text | pipeline.js invocation fails because CWD drifted |
| 3 (Tertiary) | `coder.agent.md` | Instruction text | CWD drifts in the first place |

---

## Behavioral Interface Summary

This section consolidates the exact instruction additions across both agent files for review clarity.

### `orchestrator.agent.md` — Additions

**In "What you do NOT do"**:
1. Prohibition against pipeline source file modification (see Design Area 2)
2. Prohibition against pausing after non-terminal side-tasks (see Design Area 2)

**In "Error Handling"** (before existing 3-step protocol):
3. Self-healing hierarchy (Level 1: re-signal → Level 2: conservative state.json clear → Level 3: log+halt) (see Design Area 2)

**In "Event Loop" or "Loop Termination"**:
4. Valid pause and stop points table with exactly six entries (see Design Area 2)

**In pipeline execution instructions**:
5. Pipeline invocation rule (cd prefix or absolute path) (see Design Area 4)

### `coder.agent.md` — Additions

**In workflow steps (final step before Task Report)**:
6. CWD restoration step (see Design Area 4)

### `pre-reads.js` — Behavioral Change

**`handlePlanApproved`**:
7. Derive `doc_path` from `state.planning.steps[4].doc_path` when `context.doc_path` is absent; null-check with descriptive error on failure; backward compatible when `doc_path` is present in context (see Design Area 3)

### `state-io.js` — Code Change

**`readConfig` fallback path**:
8. Replace `path.join(process.cwd(), '.github', 'orchestration.yml')` with `path.resolve(__dirname, '../../../orchestration.yml')` (see Design Area 4)

---

## Error State Handling

| Scenario | Designed behavior | Failure signal |
|----------|-------------------|----------------|
| Corrective handoff created; `report_doc` already null | Clearing block skips; zero mutation log entries emitted | None — silent no-op (correct) |
| Corrective handoff created; `report_doc` set | Clearing block executes; mutation log entries emitted | Visible in pipeline output |
| `plan_approved` with no `context.doc_path` and no state | `handlePlanApproved` returns `success: false` with "Cannot derive master plan path" message | Pipeline halts; human-readable error |
| `plan_approved` with `state.planning.steps[4].doc_path` set | Path derived from state; pre-read succeeds | None |
| Pipeline invoked from wrong CWD after Layer 1 fix | `state-io.js` config found via `__dirname`; pipeline continues | None (fixed) |
| Pipeline invoked from wrong CWD without Layer 1 fix | `orchestration.yml` not found; MODULE_NOT_FOUND error | Node.js process error |
| Coder changes CWD; doesn't restore; Orchestrator uses absolute path | Layers 1+2 absorb the failure | None with correct invocation |
| Coder changes CWD; doesn't restore; Orchestrator uses relative path | Layers 1+2 cannot absorb; pipeline.js not found | Node.js process error |

---

## Design Constraints

| Constraint | Source | Design impact |
|------------|--------|---------------|
| Agent instructions are the only enforcement mechanism for Orchestrator self-healing rules | PRD / Research | Rules must be placed in highest-attention sections; hard prohibitions, not guidelines |
| `pre-reads.js` has no existing `readState` dependency | Research | `handlePlanApproved` must add a minimal `readFile` + `JSON.parse` pattern, not a full state-reader abstraction |
| All five cleared fields (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`) must be covered | FR-1 | `handleTaskHandoffCreated` guards must check both `report_doc` and `review_doc` as independent conditions |
| `handleTaskHandoffCreated` fix must not affect first-time handoffs | NFR-3 | Presence-based guard ensures zero side-effects when fields are null |
| New agent instruction rules must fit within 3–5 lines per rule | NFR-4 | Verbatim instruction text above is designed to be concise; no verbose treatises |
| Backward compatibility: `doc_path` in context must still be honored | NFR-6 | Hybrid approach: context check first, state derivation as fallback |
