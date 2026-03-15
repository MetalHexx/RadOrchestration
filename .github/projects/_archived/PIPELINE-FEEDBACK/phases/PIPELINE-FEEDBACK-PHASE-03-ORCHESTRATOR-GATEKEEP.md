---
project: "PIPELINE-FEEDBACK"
phase: 3
title: "Orchestrator Gatekeep"
status: "active"
total_tasks: 1
author: "tactical-planner-agent"
created: "2026-03-08T23:00:00Z"
---

# Phase 3: Orchestrator Gatekeep

## Phase Goal

Add mechanical gatekeep invariant checks to the Orchestrator's execution loop so the pipeline self-corrects when the Tactical Planner skips triage, with a one-re-spawn hard limit to prevent infinite loops.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-FEEDBACK-MASTER-PLAN.md) | Phase 3 scope (1 task), exit criteria, re-spawn limit requirement (NFR-07) |
| [Architecture](../PIPELINE-FEEDBACK-ARCHITECTURE.md) | Orchestrator Gatekeep Pseudocode Contract, task-level and phase-level invariant definitions, re-spawn instruction templates, `triage_attempts` counter semantics |
| [PRD](../PIPELINE-FEEDBACK-PRD.md) | FR-08 (task-level gatekeep), FR-09 (phase-level gatekeep), NFR-07 (re-spawn limit), NFR-06 (field-level only — no document parsing) |
| [Phase 2 Report](../reports/PIPELINE-FEEDBACK-PHASE-REPORT-P02.md) | All 3 tasks complete with zero retries/deviations; carry-forward: singular/plural enum distinction (`corrective_task_issued` vs `corrective_tasks_issued`) must be preserved in re-spawn instructions |
| [Orchestrator Agent](../../agents/orchestrator.agent.md) | Current section 2d execution loop structure — task-complete branch, phase-complete branch; current spawn instruction patterns |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Update Orchestrator agent — add task-level and phase-level gatekeep blocks with re-spawn limit | — | `create-task-handoff` | 1 | *(created at execution time)* |

## Execution Order

```
T1 (sole task — no dependencies)
```

**Sequential execution order**: T1

*Note: Single-task phase — no parallelism considerations.*

## Task T1 Detail: Update Orchestrator Agent

**File**: `.github/agents/orchestrator.agent.md` (MODIFY)

**What to add (high-level outline — full detail will be in the Task Handoff):**

1. **`triage_attempts` counter definition and reset rule** — add a subsection or inline definition in the execution loop preamble:
   - `triage_attempts` is a counter local to each task or phase transition within a single Orchestrator invocation
   - Resets to `0` at the start of each new task transition and each new phase transition
   - Never persisted to state.json — it is runtime-local

2. **Task-level gatekeep block** — insert into section 2d, within the `task.status == "complete"` branch, after `→ Spawn Tactical Planner to update state from review`:
   - Re-read state.json
   - Check invariant: `task.review_doc != null AND task.review_verdict == null`
   - If true: increment `triage_attempts`
     - If `triage_attempts > 1` → halt pipeline: spawn Tactical Planner (Mode 2) to write explicit error to `errors.active_blockers` with message naming the review doc path and the stuck field
     - Else → re-spawn Tactical Planner (Mode 4) with explicit instruction template that names: the review doc path, the fields to write (`review_verdict`, `review_action`), and the continuation instruction (produce Task Handoff for next task)
   - After re-spawn: re-read state.json, verify invariant is now false before continuing

3. **Phase-level gatekeep block** — insert into the phase-complete branch, after `→ Spawn Tactical Planner to update state from phase review`:
   - Re-read state.json
   - Check invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`
   - If true: increment `triage_attempts`
     - If `triage_attempts > 1` → halt pipeline: spawn Tactical Planner (Mode 2) to write explicit error to `errors.active_blockers` with message naming the phase review path and the stuck field
     - Else → re-spawn Tactical Planner (Mode 3) with explicit instruction template that names: the phase review path, the fields to write (`phase_review_verdict`, `phase_review_action`), and the continuation instruction (produce Phase Plan for next phase)
   - After re-spawn: re-read state.json, verify invariant is now false before continuing

**Key constraints for the Coder:**
- The Orchestrator is **read-only** — it never writes files. Halt errors are written via spawning the Tactical Planner (Mode 2), not by the Orchestrator directly.
- Gatekeep is **field-level only** (NFR-06) — the Orchestrator compares two state.json fields. It never reads or parses any review document.
- Re-spawn instruction templates must be **explicit**: name the exact path from `review_doc`/`phase_review`, name the exact fields to write, and specify the continuation action.
- The re-spawn limit is **one** (NFR-07) — if `triage_attempts > 1`, halt. No looping.
- Preserve the existing execution loop structure — the gatekeep blocks are additive insertions, not rewrites.

## Phase Exit Criteria

- [ ] Orchestrator section 2d execution loop contains a task-level gatekeep block in the task-complete branch
- [ ] Task-level gatekeep check uses the exact invariant: `task.review_doc != null AND task.review_verdict == null`
- [ ] Re-spawn instruction template names the review doc path, the fields to write, and the continuation instruction (produce next task handoff)
- [ ] Orchestrator section 2d execution loop contains a phase-level gatekeep block in the phase-complete branch
- [ ] Phase-level gatekeep check uses the exact invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`
- [ ] Both gatekeep blocks enforce the one-re-spawn limit: halt pipeline if `triage_attempts > 1`
- [ ] Halt path writes an explicit error to `errors.active_blockers` (via Tactical Planner Mode 2)
- [ ] `triage_attempts` counter documented as local to each task/phase transition
- [ ] All changes are additive — no existing execution loop logic removed
- [ ] Build passes
- [ ] All tests pass

## Known Risks for This Phase

- **LLM instruction fidelity**: The gatekeep pseudocode must be translated into natural-language Markdown instructions in the Orchestrator agent file. The Coder must preserve the exact invariant expressions and the counter semantics without simplification or omission.
- **Re-spawn instruction template ambiguity**: If the re-spawn instruction to the Planner is not sufficiently explicit (missing path, missing field names, missing continuation), the Planner may not resolve the triage invariant on re-spawn, causing a halt. The template must be precise.
- **Singular/plural enum in re-spawn instructions**: Phase-level re-spawn references `phase_review_verdict` and `phase_review_action`; task-level references `review_verdict` and `review_action`. The Coder must not confuse these in the instruction templates (carry-forward from Phase 2).
