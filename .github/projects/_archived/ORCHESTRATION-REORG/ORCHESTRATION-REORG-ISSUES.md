---
project: "ORCHESTRATION-REORG"
type: "issues-log"
created: "2026-03-10"
updated: "2026-03-10"
---

# ORCHESTRATION-REORG — Issues Log

Running log of problems, bugs, and workarounds encountered during execution.

## Issues

### ISSUE-001: Premature `current_task` Advancement Skips Code Reviews

- **Severity**: High
- **Discovered**: Phase 1 execution (T01-T03 reviews skipped)
- **Component**: Orchestrator workflow / Tactical Planner state updates
- **Root Cause**: When the Orchestrator instructed the Tactical Planner to update state after a task completion (`update_state_from_task`), it also told it to advance `current_task` to the next index. This caused the resolver (`src/lib/resolver.js` line 376) to skip past the completed task before it could trigger `spawn_code_reviewer`. The resolver correctly returns `SPAWN_CODE_REVIEWER` when a complete task has `review_doc === null && review_verdict === null` (line 230-231), but it only examines `phase.tasks[phase.current_task]` — so once `current_task` advances, the unreviewed task is invisible.
- **Correct Behavior**: `current_task` should ONLY advance on the `advance_task` action (which fires after a review verdict of "approved"). During `update_state_from_task`, only the task's `status` and `report_doc` should be updated — `current_task` must stay pointing at the same task so the resolver can route through the review cycle: `complete → spawn_code_reviewer → triage_task → advance_task`.
- **Impact**: T01, T02, T03 in Phase 1 had no code reviews. T04 only got reviewed because it was the last task and `current_task` couldn't advance past it (it was still index 3 when the resolver checked).
- **Workaround**: For remaining phases, the Orchestrator must NOT instruct the Tactical Planner to advance `current_task` during `update_state_from_task`. Only advance on `advance_task`.
- **Fix Required**: Update Orchestrator agent instructions and/or the Tactical Planner's Mode 2 logic to enforce this invariant. Consider adding a pre-advance check in the resolver that scans for unreviewed complete tasks.

### ISSUE-002: Tactical Planner Should Consult Reviews When Planning Tasks

- **Severity**: Medium
- **Discovered**: Phase 1 execution
- **Component**: Tactical Planner Mode 4 (task handoff creation)
- **Root Cause**: The Tactical Planner creates task handoffs without consulting review feedback from prior tasks. When a reviewer flags issues, patterns, or recommendations, this feedback should inform subsequent task handoffs (e.g., "the reviewer noted X pattern in T02, so T03 should also watch for X").
- **Correct Behavior**: When creating a task handoff, the Tactical Planner should read available `review_doc` files from previously completed tasks in the same phase and incorporate relevant findings into the new handoff's context or constraints section.
- **Impact**: Low for Phase 1 (straightforward file operations), but higher risk for later phases with complex cross-references where reviewer feedback could prevent repeated mistakes.
- **Fix Required**: Update the Tactical Planner's Mode 4 (create-task-handoff skill) to include a step that reads prior review documents and extracts actionable items for the next task.

### ISSUE-003: Validator V2 and Resolver Disagree on `current_task` Bounds

- **Severity**: High (blocks phase transitions)
- **Discovered**: Phase 1 completion — cannot advance past last task
- **Component**: `src/lib/state-validator.js` V2 check vs `src/lib/resolver.js` line 371
- **Root Cause**: The validator (V2, line 101) rejects `current_task >= tasks.length` as out of bounds. But the resolver (line 371) uses `phase.current_task >= phase.tasks.length` as the signal to enter phase lifecycle (phase report → phase review → advance phase). These are contradictory: the resolver needs `current_task == tasks.length` to be valid, but the validator blocks it.
- **Impact**: Cannot complete the advance_task → phase lifecycle transition for ANY last task in a phase. Pipeline stalls.
- **Workaround**: Skip the `advance_task` write for the last task. Instead, directly set the phase status to trigger phase lifecycle. Alternative: change V2 check from `ct >= tasks.length` to `ct > tasks.length`.
- **Fix Required**: Either (a) change V2 bounds check to allow `ct === tasks.length`, or (b) change the resolver to use a different signal (e.g., check if all tasks are complete rather than relying on index overflow).

### ISSUE-004: Tactical Planner Two-Step Transition Still Advances `current_task`

- **Severity**: High (recurring)
- **Discovered**: Phase 4 execution (P04-T03 review skipped)
- **Component**: Tactical Planner Mode 2 state update logic
- **Root Cause**: Despite ISSUE-001 workaround instructions telling the Tactical Planner not to advance `current_task` during `update_state_from_task`, the two-step transition (`not_started -> in_progress`) appears to still advance it. When the Tactical Planner processes the `not_started -> in_progress` intermediate step, it sometimes sets `current_task` to the task being transitioned rather than leaving it at the previous value. This results in the same review-skipping behavior documented in ISSUE-001.
- **Recurrence**: P04-T03 — `current_task` jumped to 3 (T04) after T03 was marked complete. Resolver returned `create_task_handoff` for T04 instead of `spawn_code_reviewer` for T03.
- **Workaround**: Orchestrator must check `current_task` vs task review state after every Tactical Planner state update. If `current_task` has advanced past an unreviewed task, manually roll it back before running the resolver. This was done successfully for P04-T03 (rolled `current_task` from 3 back to 2).
- **Fix Required**: The Tactical Planner's two-step transition logic needs explicit guards: (a) during `update_state_from_task`, NEVER modify `current_task`; (b) only the `advance_task` action modifies `current_task`. Consider adding a resolver-side safety check that scans backward from `current_task` for unreviewed complete tasks before routing.

