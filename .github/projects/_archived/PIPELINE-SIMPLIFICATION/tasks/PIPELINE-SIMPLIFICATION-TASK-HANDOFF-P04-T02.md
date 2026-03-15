---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 2
title: "Agent & Skill Prompt Alignment"
status: "pending"
skills_required: ["coder"]
skills_optional: []
estimated_files: 7
---

# Agent & Skill Prompt Alignment

## Objective

Update agent definitions, skill documents, and instruction files to align all terminology and contract references with the v3 pipeline engine. Replace triage-layer references with mutation handler equivalents, unify all context payload keys to `doc_path`, and update state field names to match the v3 schema.

## Context

The v3 pipeline engine (now live in `.github/orchestration/scripts/lib/` after T01 swap) eliminates the triage layer — decision-table logic is absorbed into mutation handlers (`resolveTaskOutcome`, `resolvePhaseOutcome` in `mutations.js`). The v3 engine uses a single `doc_path` context key for all events (replacing `report_path`, `review_path`, `plan_path`, `handoff_path`). The `triage_attempts` field no longer exists in the v3 state schema. The `create_corrective_handoff` action was merged into `create_task_handoff` (distinguished by `context.is_correction`). All changes in this task are editorial — no new agent instructions, no removed responsibilities, no behavioral changes.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | Unify context payloads to `doc_path`; remove triage references; update corrective flag name |
| MODIFY | `.github/agents/tactical-planner.agent.md` | Remove "triage outcomes" from inputs description |
| MODIFY | `.github/skills/create-task-handoff/SKILL.md` | Replace "triage outcomes" with "mutation handler outcomes" |
| MODIFY | `.github/skills/generate-task-report/SKILL.md` | Replace "triage engine" consumer references with "mutation handler" |
| MODIFY | `.github/skills/review-phase/SKILL.md` | Replace "triage engine" consumer references with "pipeline engine" / "mutation handler" |
| MODIFY | `.github/skills/create-phase-plan/SKILL.md` | Fix `phase_review` → `phase_review_doc` field name |
| MODIFY | `.github/instructions/state-management.instructions.md` | Remove triage clause; update module name; update field references to v3 schema |

## Implementation Steps

### Step 1: Update Orchestrator Agent — Context Payloads

In `.github/agents/orchestrator.agent.md`, update the **Action Routing Table** "Event to Signal on Completion" column. Every row that signals an event with a context payload must use `doc_path` as the key:

| Row | Old Payload | New Payload |
|-----|-------------|-------------|
| 6 (`create_phase_plan`) | `{ "plan_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 7 (`create_task_handoff`) | `{ "handoff_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 8 (`execute_task`) | `{ "report_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 9 (`spawn_code_reviewer`) | `{ "review_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 10 (`generate_phase_report`) | `{ "report_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 11 (`spawn_phase_reviewer`) | `{ "review_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |
| 12 (`spawn_final_reviewer`) | `{ "review_path": "<output-path>" }` | `{ "doc_path": "<output-path>" }` |

In the same row 7, change `result.context.corrective` → `result.context.is_correction` in the Orchestrator Operation column.

### Step 2: Update Orchestrator Agent — Event Signaling Reference

In `.github/agents/orchestrator.agent.md`, update the **Event Signaling Reference** table. Change every context payload key to `doc_path`:

| Event | Old Context Payload | New Context Payload |
|-------|--------------------|--------------------|
| `phase_plan_created` | `{ "plan_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `task_handoff_created` | `{ "handoff_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `task_completed` | `{ "report_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `code_review_completed` | `{ "review_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `phase_report_created` | `{ "report_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `phase_review_completed` | `{ "review_path": "<path>" }` | `{ "doc_path": "<path>" }` |
| `final_review_completed` | `{ "review_path": "<path>" }` | `{ "doc_path": "<path>" }` |

Note: The planning events (`research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`) already use `doc_path` — do NOT change them.

### Step 3: Update Orchestrator Agent — Remove Triage References

In `.github/agents/orchestrator.agent.md`, make these three changes:

1. **Line ~40** — Find: `- Never manage state mutations, validation, or triage — the pipeline script handles all of this internally`  
   Replace with: `- Never manage state mutations or validation — the pipeline script handles all of this internally`

2. **Line ~41** — Find and DELETE the entire line: `- Never track `triage_attempts` — this counter is persisted in `state.json` by the pipeline script`

3. **Line ~170** (Recovery section) — Find: `The pipeline loads `state.json`, skips mutation, and resolves the next action from the current state. All state — including `triage_attempts` — is persisted in `state.json` by the pipeline script, so no runtime memory is needed.`  
   Replace with: `The pipeline loads `state.json`, skips mutation, and resolves the next action from the current state. All state is persisted in `state.json` by the pipeline script, so no runtime memory is needed.`

### Step 4: Update Tactical Planner Agent

In `.github/agents/tactical-planner.agent.md`, find:
```
4. **Read `state.json`** (read-only) — current state, limits, triage outcomes
```
Replace with:
```
4. **Read `state.json`** (read-only) — current state, config limits
```

### Step 5: Update create-task-handoff Skill

In `.github/skills/create-task-handoff/SKILL.md`, in the Inputs Required table, find:
```
| State | `state.json` | Current project state, review actions, triage outcomes |
```
Replace with:
```
| State | `state.json` | Current project state, review actions, mutation handler outcomes |
```

### Step 6: Update generate-task-report Skill

In `.github/skills/generate-task-report/SKILL.md`, make these three changes:

1. Find: `The Task Report template frontmatter includes fields consumed by the pipeline and triage engines. These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.`  
   Replace with: `The Task Report template frontmatter includes fields consumed by the pipeline engine (mutation handler and pre-read). These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.`

2. In the Required Frontmatter Fields table, find the `has_deviations` row Consumer column:  
   Old: `Triage engine `triageTask` rows 1–4, pipeline `task_completed` pre-read`  
   New: `Mutation handler `resolveTaskOutcome`, pipeline `task_completed` pre-read`

3. In the same table, find the `deviation_type` row Consumer column:  
   Old: `Triage engine `triageTask` rows 3–4`  
   New: `Mutation handler `resolveTaskOutcome``

### Step 7: Update review-phase Skill

In `.github/skills/review-phase/SKILL.md`, make these three changes:

1. Find: `The Phase Review template frontmatter includes fields consumed by the triage engine. These fields are **REQUIRED** — the triage engine validates their presence and returns an error if they are missing.`  
   Replace with: `The Phase Review template frontmatter includes fields consumed by the pipeline engine. These fields are **REQUIRED** — the pipeline engine validates their presence and returns an error if they are missing.`

2. In the Required Frontmatter Fields table, find the `exit_criteria_met` row Consumer column:  
   Old: `Triage engine `triagePhase` rows 2–3`  
   New: `Mutation handler `resolvePhaseOutcome``

3. Find the IMPORTANT callout:  
   Old: `> **IMPORTANT: The `exit_criteria_met` field is REQUIRED in phase review frontmatter. The triage engine validates that this field is present and is a boolean. If `exit_criteria_met` is missing, the triage engine returns an error. Set `exit_criteria_met: true` only when ALL exit criteria are verified as met. Set `exit_criteria_met: false` when any exit criterion is not met or only partially met.**`  
   New: `> **IMPORTANT: The `exit_criteria_met` field is REQUIRED in phase review frontmatter. The pipeline engine validates that this field is present and is a boolean. If `exit_criteria_met` is missing, the pipeline engine returns an error. Set `exit_criteria_met: true` only when ALL exit criteria are verified as met. Set `exit_criteria_met: false` when any exit criterion is not met or only partially met.**`

### Step 8: Update create-phase-plan Skill

In `.github/skills/create-phase-plan/SKILL.md`, in the Corrective Phase Plan section, find:
```
1. Read the phase review document at the phase's `phase_review` path in `state.json`
```
Replace with:
```
1. Read the phase review document at the phase's `phase_review_doc` path in `state.json`
```

### Step 9: Update state-management.instructions.md

In `.github/instructions/state-management.instructions.md`, make these three changes:

1. **Pre-Write Validation section** — Find:  
   `Validation is handled internally by the pipeline script. The pipeline engine calls `state-validator.validateTransition(current, proposed)` after every mutation and after every triage mutation. On validation failure, the state is NOT written — the previous valid state is preserved.`  
   Replace with:  
   `Validation is handled internally by the pipeline script. The pipeline engine calls `validator.validateTransition(current, proposed, config)` after every mutation. On validation failure, the state is NOT written — the previous valid state is preserved.`

2. **Limits invariant** — Find:  
   `- **Validate limits before advancing**: `phases.length <= limits.max_phases`, `phase.tasks.length <= limits.max_tasks_per_phase`, `task.retries <= limits.max_retries_per_task``  
   Replace with:  
   `- **Validate limits before advancing**: `phases.length <= config.limits.max_phases`, `phase.tasks.length <= config.limits.max_tasks_per_phase`, `task.retries <= config.limits.max_retries_per_task` (limits come from `orchestration.yml` config, not from `state.json`)`

3. **Add v3 schema note** — After the `## Sole Writer: Pipeline Script` section's last bullet point (`- The Orchestrator is responsible for invoking the pipeline script...`), add a blank line and then:  
   `- The v3 state schema uses `$schema: "orchestration-state-v3"`. Phase fields use `phase_plan_doc`, `phase_report_doc`, `phase_review_doc` (with `_doc` suffix). Task fields use `handoff_doc`, `report_doc`, `review_doc`. There is no `triage_attempts` field in v3.`

### Step 10: Verify Templates Already Correct

After completing all edits, verify that the following skill templates already contain the required v3 pre-read frontmatter fields (these should already be present — confirm and do NOT modify templates if they are correct):

| Template | Path | Required Field(s) | Expected |
|----------|------|--------------------|----------|
| Task Report | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | `status`, `has_deviations`, `deviation_type` | Already present |
| Phase Plan | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | `tasks` array | Already present |
| Code Review | `.github/skills/review-task/templates/CODE-REVIEW.md` | `verdict` | Already present |
| Phase Review | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | `verdict`, `exit_criteria_met` | Already present |
| Master Plan | `.github/skills/create-master-plan/templates/MASTER-PLAN.md` | `total_phases` | Already present |

If any template is missing its required field, add it to the frontmatter. If all are present, no action needed on templates.

## Contracts & Interfaces

### v3 Context Payload Contract

All events signaled to the pipeline use a single `doc_path` key for document references:

```javascript
// Every event that passes a document path uses this shape:
{ "doc_path": "<path-to-document>" }

// The ONLY exception: gate events use gate_type, not doc_path
{ "gate_type": "task" | "phase" }

// Planning events already use doc_path — no change
{ "doc_path": "<path>" }
```

### v3 State Schema — Key Field Names

```javascript
// Phase-level document fields (use _doc suffix):
phase.phase_plan_doc    // NOT phase_doc
phase.phase_report_doc  // NOT phase_report  
phase.phase_review_doc  // NOT phase_review

// Task-level document fields:
task.handoff_doc
task.report_doc
task.review_doc

// Removed fields (do NOT reference):
// execution.triage_attempts  — REMOVED
// phase.triage_attempts      — REMOVED
// limits.*                   — lives in config, not state
// errors.*                   — tracked per task, not top-level
```

### v3 Action Set — Corrective Handoff Merge

```javascript
// OLD (v2): Two separate actions
CREATE_TASK_HANDOFF       // for fresh handoffs
CREATE_CORRECTIVE_HANDOFF // for corrective handoffs

// NEW (v3): One action, distinguished by context flag
CREATE_TASK_HANDOFF       // for both fresh AND corrective
// context.is_correction: true  → corrective handoff
// context.is_correction: false → fresh handoff
// context.previous_review      → path to the review that triggered correction
// context.reason               → human-readable correction reason
```

### v3 Module Names

```javascript
// OLD v2 modules (no longer exist):
// triage-engine.js  → REMOVED (absorbed into mutations.js)
// state-validator.js → REMOVED (replaced by validator.js)
// resolver-engine.js → was never a real name, but if referenced, correct to resolver.js

// NEW v3 modules:
// mutations.js      — includes resolveTaskOutcome, resolvePhaseOutcome (absorbed triage)
// validator.js      — ~11 invariants, runs once per event
// pre-reads.js      — artifact extraction for 5 event types
// pipeline-engine.js — processEvent declarative recipe
// resolver.js       — external-only action resolution (~18 actions)
// constants.js      — frozen enums, JSDoc types
// state-io.js       — filesystem I/O with DI
```

## Styles & Design Tokens

N/A — no UI components in this task.

## Test Requirements

- [ ] No automated tests to write — this is an editorial-only task modifying `.md` files
- [ ] Verify each modified file is syntactically valid Markdown with correct YAML frontmatter (no broken tables, no unclosed code blocks)
- [ ] Grep verification: after all edits, confirm ZERO occurrences of these terms as live concepts in any `.agent.md` or `SKILL.md` file: `triage_engine`, `triage-engine`, `triageTask`, `triagePhase`, `triage_attempts`, `TRIAGE_LEVELS`, `create_corrective_handoff`, `CREATE_CORRECTIVE_HANDOFF`
- [ ] Grep verification: confirm ZERO occurrences of `report_path`, `review_path`, `plan_path`, `handoff_path` in `.github/agents/orchestrator.agent.md`
- [ ] Grep verification: confirm ZERO occurrences of `state-validator` in `.github/instructions/state-management.instructions.md`

## Acceptance Criteria

- [ ] `.github/agents/orchestrator.agent.md` Action Routing Table rows 6–12 all use `{ "doc_path": ... }` in the "Event to Signal on Completion" column
- [ ] `.github/agents/orchestrator.agent.md` Event Signaling Reference uses `{ "doc_path": ... }` for all 7 document-passing events
- [ ] `.github/agents/orchestrator.agent.md` row 7 references `result.context.is_correction` (not `corrective`)
- [ ] `.github/agents/orchestrator.agent.md` contains zero references to `triage_attempts`, `triage engine`, or `triage` as a pipeline concept
- [ ] `.github/agents/tactical-planner.agent.md` contains zero references to `triage outcomes`
- [ ] `.github/skills/create-task-handoff/SKILL.md` Inputs table references "mutation handler outcomes" (not "triage outcomes")
- [ ] `.github/skills/generate-task-report/SKILL.md` Consumer columns reference `resolveTaskOutcome` (not `triageTask`)
- [ ] `.github/skills/review-phase/SKILL.md` references "pipeline engine" (not "triage engine") and `resolvePhaseOutcome` (not `triagePhase`)
- [ ] `.github/skills/create-phase-plan/SKILL.md` references `phase_review_doc` (not `phase_review`)
- [ ] `.github/instructions/state-management.instructions.md` references `validator.validateTransition(current, proposed, config)` (not `state-validator`), has no "triage mutation" clause, includes v3 field name note
- [ ] All 5 skill templates already contain the required v3 pre-read frontmatter fields (verified, not modified unless missing)
- [ ] All modified files are valid Markdown with no syntax errors
- [ ] Build passes (no `.md` changes affect build)

## Constraints

- **Editorial changes ONLY** — do not add new agent instructions, remove existing responsibilities, or change behavioral semantics
- Do NOT modify any files in `lib/`, `tests/`, `lib-old/`, or `tests-v3/`
- Do NOT modify `pipeline.js`
- Do NOT modify `state.json`
- Do NOT modify project documents in `.github/projects/`
- Do NOT modify skill templates (`.github/skills/*/templates/`) unless a required pre-read field is genuinely missing
- Do NOT rename or delete any files — all changes are in-place text edits
- Preserve all existing Markdown formatting (table alignment, heading levels, code block syntax)
