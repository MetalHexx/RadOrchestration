---
project: "PIPELINE-HOTFIX"
phase: 3
task: 1
title: "Pipeline Engine Documentation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Pipeline Engine Documentation

## Objective

Update `docs/scripts.md` and `docs/pipeline.md` to accurately describe the pipeline engine's current behavior: internal vs. external action distinction, the internal action handling loop, the unmapped action guard, master plan pre-read, status normalization, and auto-approve for null/null triage.

## Context

The pipeline engine (`pipeline-engine.js`) resolves actions into two categories: 18 external actions returned to the Orchestrator, and internal actions (`advance_task`, `advance_phase`) handled within the engine via a bounded re-resolve loop. Status normalization converts task report status synonyms (`pass`→`complete`, `fail`→`failed`) before mutation. On `plan_approved`, the engine pre-reads the master plan to extract `total_phases` from frontmatter. When triage returns null verdict/null action and a report exists, the engine auto-approves the task or phase.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/scripts.md` | Restructure action vocabulary; add internal action handling and unmapped guard sections |
| MODIFY | `docs/pipeline.md` | Add master plan pre-read, status normalization, auto-approve, internal action loop sections |

## Implementation Steps

### `docs/scripts.md`

1. **Restructure the "Action Vocabulary" section** — The section currently presents all 35 resolver actions in a flat list. Restructure it to clearly distinguish **external actions** (18 actions returned to the Orchestrator) from **internal actions** (handled by the engine before returning). Keep the existing tier-based grouping (Planning, Execution-Task, Execution-Phase, Review, Terminal) but annotate each action with whether it is external or internal. Add a short introductory paragraph before the tables explaining the distinction.

2. **Add an "Internal Action Handling" subsection** inside the "Pipeline Internals" section (after the existing "Dual Validation" subsection, before the "I/O Isolation via `PipelineIO`" subsection). Document the internal action loop per the specification in the "Internal Action Handling" section below.

3. **Add an "Unmapped Action Guard" subsection** immediately after the "Internal Action Handling" subsection. Document the guard per the specification in the "Unmapped Action Guard" section below.

### `docs/pipeline.md`

4. **Add a "Master Plan Pre-Read" subsection** inside the "Pipeline Routing" section (after the first paragraph, before the "18-Action Routing Table"). Document with the specification in the "Master Plan Pre-Read" section below.

5. **Add a "Status Normalization" subsection** after the "Master Plan Pre-Read" subsection. Document with the specification in the "Status Normalization" section below.

6. **Add an "Auto-Approve" subsection** after the "Status Normalization" subsection. Document with the specification in the "Auto-Approve" section below.

7. **Add an "Internal Action Loop" subsection** after the "Auto-Approve" subsection. Document with the specification in the "Internal Action Loop" section below.

8. **Read each file before editing** — match existing heading levels, formatting conventions, and prose style. Insert new content at the exact locations specified. Do not rewrite existing content that is still accurate.

## Content Specifications

### Action Vocabulary Restructuring (`docs/scripts.md`)

Add an introductory paragraph at the top of the "Action Vocabulary" section:

> The resolver produces 35 total actions from a closed enum. Of these, **18 are external actions** — returned to the Orchestrator for agent routing. The remaining **17 are internal actions** — handled mechanically by the pipeline engine (state transitions, triage, validation) and never visible to the Orchestrator.

Then restructure the existing tables. The current tables already group actions by tier. Add a **Type** column to each table:

**Planning Tier** — annotate these as:

| Action | Type | Meaning |
|--------|------|---------|
| `init_project` | Internal | Project needs initialization |
| `spawn_research` | External | Spawn Research agent |
| `spawn_prd` | External | Spawn Product Manager |
| `spawn_design` | External | Spawn UX Designer |
| `spawn_architecture` | External | Spawn Architect for architecture |
| `spawn_master_plan` | External | Spawn Architect for master plan |
| `request_plan_approval` | External | Planning complete — request human approval |
| `transition_to_execution` | Internal | Planning approved — transition to execution tier |

**Execution Tier — Task Lifecycle** — annotate these as:

| Action | Type | Meaning |
|--------|------|---------|
| `create_phase_plan` | External | Phase needs a plan |
| `create_task_handoff` | External | Task needs a handoff document |
| `execute_task` | External | Task has handoff, ready to execute |
| `update_state_from_task` | Internal | Task has report, update state |
| `create_corrective_handoff` | Internal | Create corrective task from review feedback |
| `halt_task_failed` | Internal | Task failed — halt for intervention |
| `spawn_code_reviewer` | External | Task needs code review |
| `update_state_from_review` | Internal | Review complete, update state |
| `triage_task` | Internal | Task needs triage decision |
| `halt_triage_invariant` | Internal | Triage loop detected — halt |
| `retry_from_review` | Internal | Review requested changes — retry |
| `halt_from_review` | Internal | Review rejected — halt |
| `advance_task` | Internal | Task approved — advance to next |
| `gate_task` | External | Task gate — request human approval |

**Execution Tier — Phase Lifecycle** — annotate these as:

| Action | Type | Meaning |
|--------|------|---------|
| `generate_phase_report` | External | All tasks complete — generate phase report |
| `spawn_phase_reviewer` | External | Phase needs review |
| `update_state_from_phase_review` | Internal | Phase review complete, update state |
| `triage_phase` | Internal | Phase needs triage decision |
| `halt_phase_triage_invariant` | Internal | Phase triage loop detected — halt |
| `gate_phase` | External | Phase gate — request human approval |
| `advance_phase` | Internal | Phase approved — advance to next |
| `transition_to_review` | Internal | All phases complete — transition to review tier |

**Review Tier** — annotate these as:

| Action | Type | Meaning |
|--------|------|---------|
| `spawn_final_reviewer` | External | Spawn final comprehensive review |
| `request_final_approval` | External | Final review complete — request human approval |
| `transition_to_complete` | Internal | Final review approved — mark complete |

**Terminal** — both are external (unchanged):

| Action | Type | Meaning |
|--------|------|---------|
| `display_halted` | External | Project is halted — display status |
| `display_complete` | External | Project is complete — display status |

### Internal Action Handling (`docs/scripts.md`)

New subsection under "Pipeline Internals":

```markdown
### Internal Action Handling

After the resolver returns an action, the pipeline engine checks whether it is an external action (returned to the Orchestrator) or an internal action (handled by the engine itself). Internal actions trigger state mutations, re-validation, and re-resolution within a bounded loop.

The engine handles two internal actions:

| Internal Action | Engine Behavior |
|-----------------|-----------------|
| `advance_task` | Increments `phase.current_task` by 1, re-validates, re-resolves |
| `advance_phase` | Sets current phase status to `complete`. If last phase: sets `execution.status` to `complete` and `pipeline.current_tier` to `review` (`current_phase` stays at last valid index). If not last phase: increments `execution.current_phase` by 1. Re-validates, writes state, re-resolves. |

The loop is bounded to a maximum of **2 internal iterations**. If the engine exhausts 2 iterations and the resolved action is still not external, it triggers a hard error (exit 1). Each iteration follows the same sequence: apply internal mutation → re-validate → write state → re-resolve.
```

### Unmapped Action Guard (`docs/scripts.md`)

New subsection immediately after "Internal Action Handling":

```markdown
### Unmapped Action Guard

After all internal action handling completes (or immediately if the first resolved action is external), the engine validates the final action against the `EXTERNAL_ACTIONS` set — a `Set<string>` of the 18 external actions defined at module scope in `pipeline-engine.js`.

If the final action is not in `EXTERNAL_ACTIONS`, the engine returns a hard error:

- **Exit code**: 1
- **Error message**: `"Pipeline resolved unmapped action '{action}'. Expected one of: [list]. This indicates a resolver bug or max internal iterations (2) exceeded."`
- **No state written** for the current mutation (previous valid state preserved)

This guard catches resolver bugs where a new action is added to the resolver but not to the external set, or where the internal loop does not converge to an external action within the iteration bound.
```

### Master Plan Pre-Read (`docs/pipeline.md`)

New subsection:

```markdown
### Master Plan Pre-Read

When the engine processes the `plan_approved` event, it performs a pre-read of the master plan document before applying the mutation:

1. Reads the master plan path from `state.planning.steps.master_plan.output`
2. Loads the document via `io.readDocument()`
3. Extracts `total_phases` from the document's YAML frontmatter
4. Validates that `total_phases` is a positive integer
5. Injects the value into the mutation context as `context.total_phases`

The `handlePlanApproved` mutation then uses `context.total_phases` to initialize `execution.phases[]` with the correct number of phase entries (each starting as `not_started` with empty tasks).

**Error conditions** — all produce a hard error (exit 1, no state written):

| Condition | Error |
|-----------|-------|
| Master plan path missing from state | `"Master plan path not found in state.planning.steps.master_plan.output"` |
| Document not found or unreadable | `"Failed to read master plan at '{path}': {reason}"` |
| `total_phases` missing from frontmatter | `"Master plan total_phases must be a positive integer, got 'undefined'"` |
| `total_phases` not a positive integer | `"Master plan total_phases must be a positive integer, got '{value}'"` |
```

### Status Normalization (`docs/pipeline.md`)

New subsection:

```markdown
### Status Normalization

When the engine processes the `task_completed` event, the existing task report pre-read step normalizes the report's `status` field from frontmatter before passing it to the mutation:

| Raw Value | Normalized Value |
|-----------|------------------|
| `pass` | `complete` |
| `fail` | `failed` |
| `complete` | `complete` (no change) |
| `partial` | `partial` (no change) |
| `failed` | `failed` (no change) |
| Anything else | **Hard error** (exit 1) |

Only two synonyms are normalized. Any unrecognized status value produces a hard error with message: `"Unrecognized task report status: '{value}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)"`.

The canonical status vocabulary is `complete`, `partial`, `failed`. The normalization acts as a safety net for minor LLM vocabulary drift; the `generate-task-report` skill enforces the canonical values at the source.
```

### Auto-Approve (`docs/pipeline.md`)

New subsection:

```markdown
### Auto-Approve

When the triage engine returns a null verdict and null action (Row 1 of the triage decision table — task status is `complete`, no deviations, no review doc), the mutation functions `applyTaskTriage` and `applyPhaseTriage` check for an existing report as proof of execution:

**Task-level auto-approve** (in `applyTaskTriage`):
- Condition: `triageResult.verdict === null && triageResult.action === null && task.report_doc` is truthy
- Mutations applied: `task.status → complete`, `task.review_verdict → approved`, `task.review_action → advanced`, `task.triage_attempts → 0`, `execution.triage_attempts → 0`

**Phase-level auto-approve** (in `applyPhaseTriage`):
- Condition: `triageResult.verdict === null && triageResult.action === null && phase.phase_report` is truthy
- Mutations applied: `phase.phase_review_verdict → approved`, `phase.phase_review_action → advanced`, `phase.triage_attempts → 0`, `execution.triage_attempts → 0`

If null/null is returned but **no report exists**, the original skip behavior is preserved (no mutations applied). The report requirement prevents auto-approving tasks or phases that have not actually been executed.
```

### Internal Action Loop (`docs/pipeline.md`)

New subsection:

```markdown
### Internal Action Loop

After the resolver returns an action, the pipeline engine checks whether it is in the `EXTERNAL_ACTIONS` set (18 actions the Orchestrator handles). If not, the engine enters a bounded internal handling loop:

1. If the action is `advance_task`: increment `phase.current_task`, re-validate, write state, re-resolve
2. If the action is `advance_phase`: set current phase to `complete`, advance `current_phase` index (or mark execution complete if last phase), re-validate, write state, re-resolve
3. Unknown internal action: break to unmapped action guard

The loop runs for a maximum of **2 iterations**. If the resolved action is still not external after 2 iterations, the engine returns a hard error (exit 1). In practice, a typical internal sequence is: task auto-approved → `advance_task` (iteration 1) → re-resolve produces `create_task_handoff` (external) → loop exits.

See [Pipeline Script — Internal Action Handling](scripts.md#internal-action-handling) for the full specification.
```

## Test Requirements

- [ ] No test requirements — this is a documentation-only task

## Acceptance Criteria

- [ ] `docs/scripts.md` action vocabulary tables include a "Type" column distinguishing internal vs. external actions for all 35 actions
- [ ] `docs/scripts.md` contains an "Internal Action Handling" subsection under "Pipeline Internals" documenting `advance_task` and `advance_phase` with the bounded loop (max 2 iterations)
- [ ] `docs/scripts.md` contains an "Unmapped Action Guard" subsection documenting the `EXTERNAL_ACTIONS` validation and hard error behavior
- [ ] `docs/pipeline.md` contains a "Master Plan Pre-Read" subsection describing `total_phases` extraction from frontmatter, context enrichment, and all 4 error conditions
- [ ] `docs/pipeline.md` contains a "Status Normalization" subsection documenting the synonym map (`pass`→`complete`, `fail`→`failed`) and hard error for unknown values
- [ ] `docs/pipeline.md` contains an "Auto-Approve" subsection documenting null/null triage handling for both task-level and phase-level, including the report existence requirement
- [ ] `docs/pipeline.md` contains an "Internal Action Loop" subsection describing the bounded re-resolve loop (max 2 iterations) handling `advance_task` and `advance_phase`
- [ ] Both `advance_task` and `advance_phase` are documented as internally handled actions in both files
- [ ] No documentation references prior behavior, migration steps, "before/after" language, or bug fix context
- [ ] No references to external planning documents (PRD, Architecture, Design, Master Plan)
- [ ] Existing accurate content in both files is preserved (not rewritten)
- [ ] New content matches each file's existing heading levels, formatting conventions, and prose style

## Constraints

- Do NOT add test files or implementation code — this task is documentation only
- Do NOT reference prior behavior, before/after comparisons, or migration steps
- Do NOT reference external planning documents (PRD, Design, Architecture, Master Plan)
- Do NOT rewrite sections that are already accurate — only insert new content or restructure as specified
- Do NOT change the "Event Vocabulary" section in `docs/scripts.md` — it is already accurate
- Do NOT change the "18-Action Routing Table" in `docs/pipeline.md` — it is already accurate
- Match each file's existing style (heading levels, list formats, code block conventions)
