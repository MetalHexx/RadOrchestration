---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 3
title: "Documentation & Instructions Update"
status: "pending"
skills_required: ["coder"]
skills_optional: []
estimated_files: 6
---

# Documentation & Instructions Update

## Objective

Update all documentation files (`docs/scripts.md`, `docs/pipeline.md`, `docs/validation.md`, `docs/agents.md`) and the Architecture doc to reflect the v3 pipeline engine — removing triage-layer references, internal actions, removed invariants, and `triage_attempts`, and applying carry-forward discrepancy fixes to the Architecture doc.

## Context

The v3 pipeline engine is now in production position (`lib/`). Agent and skill prompts were aligned in T02. Documentation files still describe v2 concepts: 35-action resolver (v3 has ~18 external-only), triage engine module, 15 invariants (v3 has 11), and `triage_attempts` lifecycle. The Architecture doc has two carry-forward discrepancies: `validateTransition` shows 2 params (actual: 3) and "18-event handler lookup table" (actual: 17 handlers). All `lib-v3/` path references in the Architecture doc should be updated to `lib/` since the swap is complete.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/scripts.md` | Remove internal actions, update module inventory, update action count |
| MODIFY | `docs/pipeline.md` | Remove triage layer, update pipeline flow to v3 linear recipe |
| MODIFY | `docs/validation.md` | Remove V8/V9/V14/V15, update invariant count, fix validateTransition signature |
| MODIFY | `docs/agents.md` | Remove `triage_attempts` reference in Orchestrator blurb |
| MODIFY | `.github/projects/PIPELINE-SIMPLIFICATION/PIPELINE-SIMPLIFICATION-ARCHITECTURE.md` | Fix validateTransition params (2→3), fix event handler count (18→17), update all `lib-v3/` paths to `lib/` |
| VERIFY | `.github/instructions/state-management.instructions.md` | Confirm T02 already removed triage references — no changes expected |

## Implementation Steps

### Step 1: Update `docs/scripts.md`

1. **Update the opening paragraph**: Remove "triage" from the description. Change "routing, mutation, triage, and validation" → "routing, mutation, and validation". Remove the "Triage" bullet from the deterministic-decisions list.
2. **Update the Module Architecture section**:
   - Remove `triage-engine.js` from the directory tree and from the `tests/` tree (`triage-engine.test.js`)
   - Rename `state-validator.js` → `validator.js` in the tree and descriptions
   - Add `pre-reads.js` to the `lib/` tree
   - Update Layer 2 description: change "load state → apply mutation → validate transition → run triage (if needed) → resolve next action → write state → return result" → "load → pre-read → mutate → validate → write → resolve → return"
   - Remove the Layer 3 bullet for `triage-engine.js`; add `pre-reads.js` — artifact extraction and validation for 5 event types
   - Update `resolver.js` description: "maps current state to one of 35 next actions" → "maps post-mutation state to one of ~18 external actions"
   - Update `state-validator.js` references → `validator.js` with "checks ~11 invariants"
3. **Update the Event Vocabulary table**:
   - Remove the "Triage?" column entirely
   - Event 9 (`phase_plan_created`): fix description — change `phase.phase_doc` → `phase.phase_plan_doc` and `phase.status` reference to match v3 field names
   - Event 11 (`task_completed`): remove "; triggers **task-level triage**"
   - Event 12 (`code_review_completed`): remove "; triggers **task-level triage**"
   - Event 14 (`phase_review_completed`): remove "; triggers **phase-level triage**"
   - Change the event count in the lead-in text if it says 19 (the v3 engine has 18 events — no `plan_rejected` event; the `halt` event replaces rejection events; verify against the MUTATIONS map: `research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`, `plan_approved`, `phase_plan_created`, `task_handoff_created`, `task_completed`, `code_review_completed`, `phase_report_created`, `phase_review_completed`, `task_approved`, `phase_approved`, `final_review_completed`, `final_approved`, `halt` = 17 events). Update event count and table rows to match the actual v3 MUTATIONS map (17 entries). Remove `plan_rejected`, `gate_approved`, `gate_rejected`, `final_rejected` rows. Add `task_approved`, `phase_approved`, `halt` rows if not present.
4. **Update the Action Vocabulary section**:
   - Remove the "35 total actions" / "17 internal actions" language
   - Remove all rows where Type = "Internal" from every tier table
   - Remove the entire internal action concept — v3 has only external actions
   - Update to "~18 external actions" (count from the actual v3 resolver: `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `request_plan_approval`, `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer`, `generate_phase_report`, `spawn_phase_reviewer`, `gate_task`, `gate_phase`, `spawn_final_reviewer`, `request_final_approval`, `display_halted`, `display_complete` = 18 actions)
   - Remove the "Type" column from action tables (all are external)
   - Consolidate: remove `create_corrective_handoff` (merged into `create_task_handoff` with `context.is_correction`)
   - Consolidate halt actions: `halt_task_failed`, `halt_triage_invariant`, `halt_from_review`, `halt_phase_triage_invariant` all become `display_halted`
   - Remove `init_project`, `transition_to_execution`, `update_state_from_task`, `update_state_from_review`, `triage_task`, `retry_from_review`, `advance_task`, `update_state_from_phase_review`, `triage_phase`, `advance_phase`, `transition_to_review`, `transition_to_complete` from the tables
5. **Update the Result Shapes section**:
   - Remove `triage_ran` and `validation_passed` from the success JSON example — v3 `PipelineResult` has: `success`, `action`, `context`, `mutations_applied`

### Step 2: Update `docs/pipeline.md`

1. **Update the opening paragraph**: Remove "triage" from "state transitions, validation, triage, and next-action resolution" → "state transitions, validation, and next-action resolution"
2. **Execution Pipeline → task lifecycle**: In step 4, change "Triage — Pipeline script (`pipeline.js`) processes the review verdict internally via `code_review_completed` event: applies state mutation, runs triage decision table, returns next action (advance, corrective retry, or halt)" → "Resolution — Pipeline script processes the `code_review_completed` event: applies state mutation, validates, resolves next action (advance to next task, corrective retry via `create_task_handoff` with `context.is_correction`, or halt)"
3. **Execution Pipeline → phase lifecycle**: In step 3, change "Triage — Pipeline script processes the phase review verdict internally via `phase_review_completed` event" → "Resolution — Pipeline script processes the `phase_review_completed` event". In step 4, remove "corrective: true" and update to use v3 action names
4. **Execution Pipeline → Mermaid diagram notes**: Change `(mutates state + runs triage)` → `(mutates state + resolves action)` for the three annotated events
5. **Remove the "Triage Attempts" subsection entirely** — the entire section under "### Triage Attempts" with the lifecycle diagram, trigger events list, and loop detection explanation. This concept does not exist in v3.
6. **Error Handling → Retry Budget section**: Remove the sentence about `triage_attempts`. The retry mechanism in v3 is handled by decision tables inside `mutations.js`, not by a separate triage engine. Update language accordingly: "When a task receives a `changes_requested` review verdict: if retries remain (`task.retries < config.limits.max_retries_per_task`), a corrective task handoff is issued; if retries are exhausted, the pipeline halts."
7. **Update the sentence** "The pipeline script encodes this logic in a deterministic decision table — the same review verdict with the same retry state always produces the same action." — this is fine as-is, no change needed.

### Step 3: Update `docs/validation.md`

1. **State Transition Validation section**: 
   - Change `validateTransition(current, proposed)` → `validateTransition(current, proposed, config)` in both the prose and the code signature
   - Change the return shape from `{ valid: boolean, invariants_checked: 15, errors?: InvariantError[] }` → `ValidationError[]` (v3 returns an array of errors; empty array means valid)
   - Change "checks all 15 invariants" → "checks ~11 invariants"
   - Remove "For triage-triggering events, validation runs **twice**: once after mutation and once after triage." → Replace with "Validation runs once per event, after the mutation."
2. **Invariant Catalog**:
   - Change heading from "Invariant Catalog (V1–V15)" → "Invariant Catalog (V1–V7, V10–V13)"
   - Remove rows V8, V9, V14, V15 from the table
   - Update V3 description: "Retry limit" → "`total_phases` matches `phases.length`" is wrong — V3 in the current doc says "Retry limit" but in v3 code V3 is "total_phases matches phases.length". Check the actual v3 validator and use its descriptions. The v3 invariant IDs and descriptions are:

     | ID | Check |
     |----|-------|
     | V1 | `current_phase` within bounds |
     | V2 | `current_task` within bounds for active phase |
     | V3 | `total_phases` matches `phases.length` |
     | V4 | `total_tasks` matches `tasks.length` per phase |
     | V5 | `planning.human_approved` required before execution tier |
     | V6 | At most one task `in_progress` across entire project |
     | V7 | Retry limit: no task's `retries` exceeds config limit |
     | V10 | Schema version must be `orchestration-state-v3` |
     | V11 | Retry monotonicity: retries never decrease |
     | V12 | Valid task status transitions |
     | V13 | Timestamp monotonicity: `project.updated` strictly increases |

   - Update V12 valid transitions: keep the existing transition diagram (it's unchanged)
3. **Remove** mention of "15 invariants" anywhere — replace with "~11 invariants"

### Step 4: Update `docs/agents.md`

1. **Orchestrator section**: Remove the sentence "The pipeline script manages `triage_attempts` as a persisted field in `state.json`."
2. **Pipeline Script as State Authority section**: Change "runs integrated state-transition validation to check all invariants" — this is fine as-is, just ensure it doesn't say "15" anywhere

### Step 5: Update Architecture Doc (Carry-Forward Fixes)

1. **Fix `validateTransition` parameter count** (CF-4 since Phase 1):
   - Line ~425: `function validateTransition(current, proposed) { /* ... */ }` → `function validateTransition(current, proposed, config) { /* ... */ }`
   - Update the JSDoc above it to include the `@param {Config} config` parameter
2. **Fix event handler count**:
   - All references to "18 event→handler lookup table" or "18-event handler" → "17-event handler lookup table" (the actual MUTATIONS map has 17 entries: 5 planning + 1 plan_approved + 6 execution + 2 gate + 2 review + 1 halt)
3. **Update `lib-v3/` paths to `lib/`**: The swap is complete. All path references like `.github/orchestration/scripts/lib-v3/pipeline-engine.js` → `.github/orchestration/scripts/lib/pipeline-engine.js`. This applies to:
   - Module Map table (paths column) — 7 rows
   - All code block path comments (e.g., `// .github/orchestration/scripts/lib-v3/state-io.js`)
   - Cross-Module Dependencies heading: "within `lib-v3/`" → "within `lib/`"
   - Technical Overview paragraph mentioning `lib-v3/`
4. **Update `tests-v3/` references to `tests/`** if any remain in the Architecture doc

### Step 6: Verify `state-management.instructions.md`

1. Read `.github/instructions/state-management.instructions.md` and confirm it already has:
   - `validator.validateTransition(current, proposed, config)` (3 params) ✓
   - No "triage" references ✓
   - v3 schema note with `_doc` suffixes ✓
2. **No changes expected** — T02 already updated this file. If any residual triage references are found, fix them.

## Contracts & Interfaces

### v3 PipelineResult (the only result shape)

```javascript
// .github/orchestration/scripts/lib/constants.js
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success
 * @property {string | null} action
 * @property {Object} context
 * @property {string[]} mutations_applied
 */
```

### v3 validateTransition Signature

```javascript
// .github/orchestration/scripts/lib/validator.js
/**
 * @param {StateJson} current
 * @param {StateJson} proposed
 * @param {Config} config
 * @returns {ValidationError[]}
 */
function validateTransition(current, proposed, config) { /* ... */ }
```

### v3 MUTATIONS Map (17 entries)

```javascript
// .github/orchestration/scripts/lib/mutations.js
const MUTATIONS = Object.freeze({
  // Planning events (5)
  research_completed, prd_completed, design_completed,
  architecture_completed, master_plan_completed,
  // Plan approval (1)
  plan_approved,
  // Execution events (6)
  phase_plan_created, task_handoff_created, task_completed,
  code_review_completed, phase_report_created, phase_review_completed,
  // Gate events (2)
  task_approved, phase_approved,
  // Review events (2)
  final_review_completed, final_approved,
  // Halt (1)
  halt,
});
```

### v3 External Actions (18 entries)

```
spawn_research, spawn_prd, spawn_design, spawn_architecture,
spawn_master_plan, request_plan_approval, create_phase_plan,
create_task_handoff, execute_task, spawn_code_reviewer,
generate_phase_report, spawn_phase_reviewer, gate_task, gate_phase,
spawn_final_reviewer, request_final_approval, display_halted,
display_complete
```

### v3 Invariants (11)

```
V1: current_phase bounds
V2: current_task bounds
V3: total_phases matches phases.length
V4: total_tasks matches tasks.length
V5: human_approved gate
V6: single active task
V7: retry limit
V10: schema version
V11: retry monotonicity
V12: task status transitions
V13: timestamp monotonicity
```

## Styles & Design Tokens

N/A — documentation-only task.

## Test Requirements

- [ ] Grep all modified doc files for `triage_engine`, `triage-engine`, `triage_attempts`, `TRIAGE_LEVELS` — 0 matches expected
- [ ] Grep `docs/scripts.md` for "internal" action type / "Internal" in action tables — 0 matches expected (no internal actions in v3)
- [ ] Grep `docs/validation.md` for `V8`, `V9`, `V14`, `V15` as invariant IDs — 0 matches expected
- [ ] Grep `docs/validation.md` for "15 invariants" — 0 matches expected
- [ ] Grep `docs/scripts.md` for "35 actions" or "35 values" — 0 matches expected
- [ ] Grep Architecture doc for `lib-v3/` — 0 matches expected (all updated to `lib/`)
- [ ] Grep Architecture doc for `validateTransition(current, proposed)` (2-param) — 0 matches expected
- [ ] Grep Architecture doc for "18-event" or "18 event" — 0 matches expected (should be 17)
- [ ] Verify `state-management.instructions.md` has 0 matches for `triage`

## Acceptance Criteria

- [ ] `docs/scripts.md` module tree lists `constants.js`, `state-io.js`, `pre-reads.js`, `validator.js`, `mutations.js`, `resolver.js`, `pipeline-engine.js` — no `triage-engine.js`, no `state-validator.js`
- [ ] `docs/scripts.md` action vocabulary describes only ~18 external actions with no "Internal" type column
- [ ] `docs/scripts.md` result shape example shows only `success`, `action`, `context`, `mutations_applied` (no `triage_ran`, `validation_passed`)
- [ ] `docs/pipeline.md` contains zero references to "triage" as a pipeline concept
- [ ] `docs/pipeline.md` does not contain a "Triage Attempts" subsection
- [ ] `docs/validation.md` invariant catalog lists exactly V1–V7, V10–V13 (11 invariants); V8, V9, V14, V15 are absent
- [ ] `docs/validation.md` shows `validateTransition(current, proposed, config)` (3 params)
- [ ] `docs/validation.md` states validation runs once per event (not twice)
- [ ] `docs/agents.md` contains zero references to `triage_attempts`
- [ ] Architecture doc `validateTransition` signature shows 3 params (`current, proposed, config`)
- [ ] Architecture doc references "17-event handler lookup table" (not 18)
- [ ] Architecture doc has zero `lib-v3/` path references (all updated to `lib/`)
- [ ] `.github/instructions/state-management.instructions.md` has zero `triage` references (verified, no changes)
- [ ] All modified files are valid Markdown with no syntax errors
- [ ] Build passes (no code changes — N/A)

## Constraints

- Do NOT modify any source code in `.github/orchestration/scripts/lib/`, `tests/`, or `pipeline.js`
- Do NOT modify agent files (`.agent.md`) or skill files (`SKILL.md`) — those were updated in T02
- Do NOT modify project planning documents (PRD, Design, Master Plan, Phase Plans, Task Reports) — those are historical records
- Only modify files in `docs/`, `.github/instructions/`, and the Architecture doc at `.github/projects/PIPELINE-SIMPLIFICATION/PIPELINE-SIMPLIFICATION-ARCHITECTURE.md`
- Changes are editorial: update terminology, counts, and references — do not add new documentation sections or restructure existing ones
- The Architecture doc is a planning document, but the carry-forward fixes are factual corrections (param count, handler count, path updates) — these are explicitly authorized
