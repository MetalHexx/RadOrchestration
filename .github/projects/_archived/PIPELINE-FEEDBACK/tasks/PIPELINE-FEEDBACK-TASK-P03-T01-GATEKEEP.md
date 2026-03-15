---
project: "PIPELINE-FEEDBACK"
phase: 3
task: 1
title: "Update Orchestrator Agent — Add Gatekeep Blocks"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Orchestrator Agent — Add Gatekeep Blocks

## Objective

Modify the Orchestrator agent file (`.github/agents/orchestrator.agent.md`) section 2d execution loop to add task-level and phase-level gatekeep invariant checks that detect skipped triage and self-correct via a single re-spawn of the Tactical Planner, with a hard one-re-spawn limit that halts the pipeline if triage remains incomplete.

## Context

The Tactical Planner now executes a triage step (reading review documents, writing `review_verdict`/`review_action` or `phase_review_verdict`/`phase_review_action` to `state.json`) before producing task handoffs or phase plans. The Orchestrator needs a mechanical check — comparing two `state.json` fields — to verify triage ran. If a review document path is recorded but the verdict is still `null`, triage was skipped. The Orchestrator re-spawns the Planner once with an explicit instruction; if the invariant persists after re-spawn, the pipeline halts to prevent infinite loops (NFR-07).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | Section 2d execution loop ONLY — all other sections unchanged |

## Implementation Steps

1. **Open** `.github/agents/orchestrator.agent.md` and locate section `#### 2d. Pipeline is \`execution\``.

2. **Add a `triage_attempts` definition note** immediately above the execution loop code block (the line that starts with ` ``` `). Insert the following note block:

   ```
   > **Triage attempts counter**: `triage_attempts` is a counter local to the current Orchestrator
   > invocation for a given task or phase transition. It resets to 0 for each new task transition
   > and each new phase transition. It is never persisted to state.json — it is runtime-local.
   > If after one re-spawn the invariant is still true, the pipeline halts —
   > the Orchestrator does NOT loop indefinitely (NFR-07).
   ```

3. **Locate the `IF task.status == "complete"` block** inside the execution loop code block. The current content is:

   ```
     IF task.status == "complete":
       → Spawn Reviewer for code review
       → Spawn Tactical Planner to update state from review
       → IF review verdict is "changes_requested":
         → Treat as minor failure → retry loop
       → IF review verdict is "rejected":
         → Treat as critical failure → halt
       → Advance to next task
   ```

4. **Replace this block** with the following expanded version that adds the task-level gatekeep AFTER "Spawn Tactical Planner to update state from review" and BEFORE the verdict routing:

   ```
     IF task.status == "complete":
       → Spawn Reviewer for code review
       → Spawn Tactical Planner to update state from review

       → RE-READ state.json
       → TASK-LEVEL GATEKEEP:
         task = phases[current_phase].tasks[current_task]
         IF task.review_doc != null AND task.review_verdict == null:
           triage_attempts += 1
           IF triage_attempts > 1:
             → Spawn Tactical Planner to halt pipeline with error:
               "Triage invariant still violated after re-spawn. 
                review_doc={task.review_doc}, review_verdict=null. 
                Pipeline halted — requires human intervention."
             → Display STATUS.md to human
           ELSE:
             → RE-SPAWN Tactical Planner (Mode 4) with instruction:
               "Triage is incomplete. Task {task_number} has a code review at 
                '{task.review_doc}' but review_verdict is null. Read the review 
                document, execute the triage decision table from the triage-report 
                skill, write review_verdict and review_action to state.json for 
                task {task_number} in phase {phase_number}, then produce the 
                Task Handoff for the next task."
             → RE-READ state.json
             → Verify invariant is now false before continuing

       → IF review verdict is "changes_requested":
         → Treat as minor failure → retry loop
       → IF review verdict is "rejected":
         → Treat as critical failure → halt
       → Advance to next task
   ```

5. **Locate the `IF all tasks in phase complete` block**. The current content is:

   ```
   IF all tasks in phase complete:
     → Spawn Tactical Planner to generate Phase Report
     → Spawn Reviewer for Phase Review
     → Spawn Tactical Planner to update state from phase review
     → IF human_gate_mode == "phase":
       → Show phase results to human, wait for approval
     → Advance to next phase
   ```

6. **Replace this block** with the following expanded version that adds the phase-level gatekeep AFTER "Spawn Tactical Planner to update state from phase review" and BEFORE the human gate check:

   ```
   IF all tasks in phase complete:
     → Spawn Tactical Planner to generate Phase Report
     → Spawn Reviewer for Phase Review
     → Spawn Tactical Planner to update state from phase review

     → RE-READ state.json
     → PHASE-LEVEL GATEKEEP:
       phase = phases[current_phase]
       IF phase.phase_review != null AND phase.phase_review_verdict == null:
         triage_attempts += 1
         IF triage_attempts > 1:
           → Spawn Tactical Planner to halt pipeline with error:
             "Phase triage invariant still violated after re-spawn. 
              phase_review={phase.phase_review}, phase_review_verdict=null. 
              Pipeline halted — requires human intervention."
           → Display STATUS.md to human
         ELSE:
           → RE-SPAWN Tactical Planner (Mode 3) with instruction:
             "Phase triage is incomplete. Phase {phase_number} has a phase 
              review at '{phase.phase_review}' but phase_review_verdict is 
              null. Read the phase review document, execute the phase-level 
              triage decision table from the triage-report skill, write 
              phase_review_verdict and phase_review_action to state.json 
              for phase {phase_number}, then produce the Phase Plan for 
              phase {next_phase_number}."
           → RE-READ state.json
           → Verify invariant is now false before continuing

     → IF human_gate_mode == "phase":
       → Show phase results to human, wait for approval
     → Advance to next phase
   ```

7. **Verify** that no content outside section 2d was modified. Sections 2a, 2b, 2c, 2e, and 2f must be byte-identical to their pre-edit state.

8. **Verify** that all existing content within section 2d is preserved — the changes are purely additive insertions.

## Contracts & Interfaces

### Orchestrator Gatekeep — Pseudocode Contract (from Architecture)

The gatekeep check is a pure field-level comparison. The Orchestrator reads two fields from `state.json` and makes a binary decision. No document parsing.

```
// Task-level gatekeep (runs after Planner writes review_doc via Mode 2)
RE-READ state.json
task = phases[current_phase].tasks[current_task]

IF task.review_doc != null AND task.review_verdict == null:
  triage_attempts += 1
  IF triage_attempts > 1:
    → HALT pipeline with error:
      "Triage invariant still violated after re-spawn. review_doc={task.review_doc}
       review_verdict=null. Pipeline halted — requires human intervention."
  ELSE:
    → RE-SPAWN Tactical Planner (Mode 4) with instruction:
      "Triage is incomplete. Task {task_number} has a code review at '{task.review_doc}'
       but review_verdict is null. Read the review document, execute the triage decision
       table from the triage-report skill, write review_verdict and review_action to
       state.json for task {task_number} in phase {phase_number}, then produce the
       Task Handoff for the next task."
    → RE-READ state.json
    → Verify invariant is now false before continuing

// Phase-level gatekeep (runs after Planner writes phase_review via Mode 2)
RE-READ state.json
phase = phases[current_phase]

IF phase.phase_review != null AND phase.phase_review_verdict == null:
  triage_attempts += 1
  IF triage_attempts > 1:
    → HALT pipeline with error:
      "Phase triage invariant still violated after re-spawn. phase_review={phase.phase_review}
       phase_review_verdict=null. Pipeline halted — requires human intervention."
  ELSE:
    → RE-SPAWN Tactical Planner (Mode 3) with instruction:
      "Phase triage is incomplete. Phase {phase_number} has a phase review at
       '{phase.phase_review}' but phase_review_verdict is null. Read the phase review
       document, execute the phase-level triage decision table from the triage-report
       skill, write phase_review_verdict and phase_review_action to state.json for
       phase {phase_number}, then produce the Phase Plan for phase {next_phase_number}."
    → RE-READ state.json
    → Verify invariant is now false before continuing
```

**Re-spawn limit enforcement (NFR-07):** `triage_attempts` is local to the current Orchestrator invocation for a given task or phase transition. If after one re-spawn the verdict field is still `null`, the Orchestrator halts the pipeline by spawning the Tactical Planner (Mode 2) to write a blocker to `errors.active_blockers`, then displays `STATUS.md` to the human. The Orchestrator does NOT loop indefinitely.

### Task-Level Invariant

```
task.review_doc != null AND task.review_verdict == null  →  triage was skipped
```

- `review_doc`: `string | null` — path to Code Review document, set by Planner Mode 2
- `review_verdict`: `string | null` — `"approved"` | `"changes_requested"` | `"rejected"` | `null`
- `review_action`: `string | null` — `"advanced"` | `"corrective_task_issued"` | `"halted"` | `null`

### Phase-Level Invariant

```
phase.phase_review != null AND phase.phase_review_verdict == null  →  phase triage was skipped
```

- `phase_review`: `string | null` — path to Phase Review document, set by Planner Mode 2
- `phase_review_verdict`: `string | null` — `"approved"` | `"changes_requested"` | `"rejected"` | `null`
- `phase_review_action`: `string | null` — `"advanced"` | `"corrective_tasks_issued"` | `"halted"` | `null`

> **Note:** Phase action uses `"corrective_tasks_issued"` (plural) vs task action `"corrective_task_issued"` (singular).

## Styles & Design Tokens

Not applicable — infrastructure/agent instruction file, no UI.

## Test Requirements

- [ ] Section 2d task-complete branch contains the task-level gatekeep block with `RE-READ state.json` and `TASK-LEVEL GATEKEEP:` label
- [ ] Task-level gatekeep uses exact invariant: `task.review_doc != null AND task.review_verdict == null`
- [ ] Task-level re-spawn instruction names: `{task.review_doc}` path, `review_verdict` and `review_action` fields to write, continuation instruction ("produce the Task Handoff for the next task")
- [ ] Section 2d phase-complete branch contains the phase-level gatekeep block with `RE-READ state.json` and `PHASE-LEVEL GATEKEEP:` label
- [ ] Phase-level gatekeep uses exact invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`
- [ ] Phase-level re-spawn instruction names: `{phase.phase_review}` path, `phase_review_verdict` and `phase_review_action` fields to write, continuation instruction ("produce the Phase Plan for phase {next_phase_number}")
- [ ] Both gatekeep blocks check `triage_attempts > 1` and halt on second attempt
- [ ] Halt path spawns Tactical Planner with explicit error message containing the stuck field names
- [ ] `triage_attempts` counter is documented as local to each task/phase transition
- [ ] No content outside section 2d is modified (sections 2a, 2b, 2c, 2e, 2f unchanged)
- [ ] All existing content within section 2d is preserved — changes are additive

## Acceptance Criteria

- [ ] Section 2d task-complete branch contains the task-level gatekeep block
- [ ] Task-level check uses exact invariant: `task.review_doc != null AND task.review_verdict == null`
- [ ] Re-spawn instruction names the review doc path, fields to write, and continuation instruction
- [ ] Section 2d phase-complete branch contains the phase-level gatekeep block
- [ ] Phase-level check uses exact invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`
- [ ] Both gatekeep blocks enforce one-re-spawn limit: halt if `triage_attempts > 1`
- [ ] Halt path writes explicit error to `errors.active_blockers` (via Tactical Planner)
- [ ] `triage_attempts` counter documented as local to each task/phase transition
- [ ] No other sections of the file are modified (2a, 2b, 2c, 2e, 2f remain unchanged)
- [ ] No existing content is removed — all changes are additive insertions
- [ ] Build passes
- [ ] All tests pass

## Constraints

- ONLY modify section 2d (`#### 2d. Pipeline is \`execution\``) — do NOT touch sections 2a, 2b, 2c, 2e, 2f, or any content outside the Decision Logic
- All changes are **additive** — preserve every existing line in section 2d; do not remove, reorder, or rephrase existing content
- The Orchestrator is **read-only** — it never writes files. Halt errors are written by spawning the Tactical Planner (Mode 2), not by the Orchestrator directly
- Gatekeep is **field-level only** (NFR-06) — the Orchestrator compares two `state.json` fields; it never reads or parses any review document
- Re-spawn limit is **one** (NFR-07) — if `triage_attempts > 1`, halt. No looping
- Use the exact invariant expressions from the Contracts section — do not simplify or rephrase
- Use the exact re-spawn instruction templates from the Contracts section — do not paraphrase
- Preserve singular/plural distinction: task-level uses `corrective_task_issued` (singular); phase-level uses `corrective_tasks_issued` (plural)
