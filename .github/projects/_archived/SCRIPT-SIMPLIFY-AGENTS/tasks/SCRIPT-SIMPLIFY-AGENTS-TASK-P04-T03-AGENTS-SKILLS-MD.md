---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 3
title: "Update agents.md & skills.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Update agents.md & skills.md

## Objective

Update `docs/agents.md` and `docs/skills.md` to accurately describe the post-refactor agent roles, skill inventory, and state-management authority — replacing all references to deleted scripts, removed skills, and the old Tactical-Planner-as-state-authority model with the `pipeline.js` event-driven system.

## Context

The orchestration system was refactored so that `pipeline.js` is the sole writer of `state.json`. The Orchestrator is now an event-driven controller that signals events to `pipeline.js` and routes on an 18-action table. The Tactical Planner was reduced to 3 modes (phase planning, task handoffs, phase reports) and no longer writes `state.json` or `STATUS.md`. The `review-code` skill was renamed to `review-task`. The `triage-report` skill was deleted. The standalone scripts `next-action.js`, `triage.js`, and `validate-state.js` were deleted and replaced by `pipeline.js`. `STATUS.md` was removed from the system entirely.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/agents.md` | Fix agent overview table, remove stale subsections, update 4 agent detail blocks |
| MODIFY | `docs/skills.md` | Fix review skills table, delete triage-report row, update skill-agent composition |

## Implementation Steps

### docs/agents.md

1. **Agent Overview table — Tactical Planner row**: Change the Role cell from `Task breakdown, state management, triage` to `Task breakdown and phase reporting`. Change the Writes cell from `` `state.json`, `STATUS.md`, phase plans, task handoffs, phase reports `` to `Phase plans, task handoffs, phase reports`.

2. **"Read-Only Orchestrator" subsection** (under Design Constraints): Replace the sentence:
   ```
   It reads `state.json` to determine the current pipeline position, invokes the [Next-Action Resolver](scripts.md) to get deterministic routing, and spawns the appropriate agent.
   ```
   with:
   ```
   It reads `state.json` to determine the current pipeline position, signals events to `pipeline.js` to get deterministic routing, and spawns the appropriate agent.
   ```

3. **"Tactical Planner as State Authority" subsection** (under Design Constraints): Replace the entire subsection with:
   ```markdown
   ### Pipeline Script as State Authority

   Only the pipeline script (`pipeline.js`) writes `state.json`. Before every write, the pipeline engine runs integrated state-transition validation to check all invariants. If validation fails, the write is rejected and the error is returned in the result object. No agent — including the Tactical Planner — writes `state.json` directly.
   ```

4. **Orchestrator detail section**: Replace the paragraph:
   ```
   The Orchestrator is the entry point for all project interactions. It reads `state.json`, calls the [Next-Action Resolver](scripts.md) to determine the next action deterministically, and spawns the appropriate agent. It also manages a runtime `triage_attempts` counter to prevent infinite triage loops.
   ```
   with:
   ```
   The Orchestrator is the entry point for all project interactions. It signals events to `pipeline.js`, parses the JSON result, and routes on an 18-action table to spawn the appropriate agent, present human gates, or display terminal messages. The pipeline script manages `triage_attempts` as a persisted field in `state.json`.
   ```

5. **Tactical Planner detail section**: Replace the entire purpose line and mode list:
   ```
   **Purpose:** Break phases into tasks, manage pipeline state, and execute triage decisions.

   The Tactical Planner is the most operationally complex agent. It operates in multiple modes:

   1. **Initialize** — create project state and `STATUS.md`
   2. **Update state** — advance tasks, phases, and tiers based on reports and reviews
   3. **Phase triage** — call the [Triage Executor](scripts.md) for phase-level review decisions
   4. **Task triage** — call the Triage Executor for task-level review decisions
   5. **Phase planning** — break a phase into tasks with dependencies and execution order
   6. **Task handoffs** — create self-contained coding instructions for the Coder
   7. **Phase reports** — aggregate task results and assess exit criteria

   Before every `state.json` write, the Tactical Planner calls the [State Transition Validator](scripts.md) to ensure all invariants are satisfied.

   **Output:** `state.json`, `STATUS.md`, phase plans, task handoffs, phase reports

   **Skills:** `create-phase-plan`, `create-task-handoff`, `generate-task-report`, `generate-phase-report`, `triage-report`, `run-tests`
   ```
   with:
   ```
   **Purpose:** Break phases into tasks, create self-contained task handoffs, and generate phase reports.

   The Tactical Planner is a pure planning agent that operates in 3 modes:

   1. **Phase planning** — break a phase into tasks with dependencies and execution order
   2. **Task handoffs** — create self-contained coding instructions for the Coder
   3. **Phase reports** — aggregate task results and assess exit criteria

   The pipeline script (`pipeline.js`) handles all state mutations, validation, and triage. The Tactical Planner reads `state.json` for context but never writes it.

   **Output:** Phase plans, task handoffs, phase reports

   **Skills:** `create-phase-plan`, `create-task-handoff`, `generate-phase-report`
   ```

6. **Reviewer detail section — Skills line**: Replace:
   ```
   **Skills:** `review-code`, `review-phase`
   ```
   with:
   ```
   **Skills:** `review-task`, `review-phase`
   ```

7. **Final sweep within agents.md**: Verify zero remaining occurrences of: `STATUS.md`, `next-action.js`, `triage.js`, `validate-state.js`, `Next-Action Resolver`, `Triage Executor`, `State Transition Validator`, `triage-report`, `review-code` (as a skill name).

### docs/skills.md

8. **Review Skills table**: Replace the row:
   ```
   | `review-code` | Review code changes against PRD, architecture, and design — produce verdicts with severity | Reviewer |
   ```
   with:
   ```
   | `review-task` | Review task output against the task handoff, architecture, and design — produce verdicts with severity | Reviewer |
   ```

9. **Review Skills table**: Delete the entire `triage-report` row:
   ```
   | `triage-report` | Reference documentation for the triage decision tables. The authoritative executor is the [Triage Executor script](scripts.md) | Tactical Planner |
   ```

10. **Skill-Agent Composition table — Tactical Planner row**: Replace:
    ```
    | Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-task-report`, `generate-phase-report`, `triage-report`, `run-tests` |
    ```
    with:
    ```
    | Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
    ```

11. **Skill-Agent Composition table — Reviewer row**: Replace:
    ```
    | Reviewer | `review-code`, `review-phase` |
    ```
    with:
    ```
    | Reviewer | `review-task`, `review-phase` |
    ```

12. **Final sweep within skills.md**: Verify zero remaining occurrences of: `review-code` (as skill name), `triage-report`, `Triage Executor`, `next-action.js`, `triage.js`, `validate-state.js`, `STATUS.md`.

## Contracts & Interfaces

Not applicable — this is a documentation-only task. No code interfaces are involved.

## Styles & Design Tokens

Not applicable — no UI components are modified.

## Test Requirements

- [ ] Grep `docs/agents.md` for `STATUS.md` — zero matches
- [ ] Grep `docs/agents.md` for `next-action.js` — zero matches
- [ ] Grep `docs/agents.md` for `triage.js` (bare, not inside a longer word like `triage.json`) — zero matches
- [ ] Grep `docs/agents.md` for `validate-state.js` — zero matches
- [ ] Grep `docs/agents.md` for `Next-Action Resolver` — zero matches
- [ ] Grep `docs/agents.md` for `Triage Executor` — zero matches
- [ ] Grep `docs/agents.md` for `State Transition Validator` — zero matches
- [ ] Grep `docs/agents.md` for `triage-report` — zero matches
- [ ] Grep `docs/agents.md` for `review-code` — zero matches
- [ ] Grep `docs/skills.md` for `review-code` — zero matches
- [ ] Grep `docs/skills.md` for `triage-report` — zero matches
- [ ] Grep `docs/skills.md` for `Triage Executor` — zero matches
- [ ] Grep `docs/skills.md` for `STATUS.md` — zero matches
- [ ] Grep `docs/skills.md` for `next-action.js` — zero matches
- [ ] Verify `docs/agents.md` contains the string `pipeline.js` at least 3 times
- [ ] Verify `docs/agents.md` Tactical Planner section lists exactly 3 modes (not 7)
- [ ] Verify `docs/skills.md` Review Skills table has `review-task` row and no `triage-report` row
- [ ] Verify `docs/skills.md` Skill-Agent Composition Tactical Planner row contains exactly 3 skills

## Acceptance Criteria

- [ ] `docs/agents.md` Agent Overview table shows Tactical Planner writes = "Phase plans, task handoffs, phase reports" (no `state.json`, no `STATUS.md`)
- [ ] `docs/agents.md` contains "Pipeline Script as State Authority" subsection (not "Tactical Planner as State Authority")
- [ ] `docs/agents.md` Orchestrator detail describes event-driven loop with `pipeline.js` and 18-action routing table (not Next-Action Resolver)
- [ ] `docs/agents.md` Tactical Planner detail lists exactly 3 modes: phase planning, task handoffs, phase reports
- [ ] `docs/agents.md` Tactical Planner skills = `create-phase-plan`, `create-task-handoff`, `generate-phase-report` (no `triage-report`, no `generate-task-report`, no `run-tests`)
- [ ] `docs/agents.md` Tactical Planner output = "Phase plans, task handoffs, phase reports" (no `state.json`, no `STATUS.md`)
- [ ] `docs/agents.md` Reviewer skills = `review-task`, `review-phase` (not `review-code`)
- [ ] `docs/skills.md` Review Skills table contains `review-task` (not `review-code`) and does NOT contain `triage-report`
- [ ] `docs/skills.md` Skill-Agent Composition: Tactical Planner = `create-phase-plan`, `create-task-handoff`, `generate-phase-report`; Reviewer = `review-task`, `review-phase`
- [ ] Zero occurrences across both files of: `STATUS.md`, `next-action.js`, `triage.js` (bare), `validate-state.js`, `Next-Action Resolver`, `Triage Executor`, `State Transition Validator`, `triage-report`, `review-code`
- [ ] All existing cross-links (e.g., `[scripts.md]`, `[validation.md]`, `[skills.md]`) still resolve to valid targets
- [ ] Both files are well-formed Markdown with consistent heading hierarchy
- [ ] No content outside the specified changes is modified

## Constraints

- Do NOT modify any file other than `docs/agents.md` and `docs/skills.md`
- Do NOT rewrite sections that are not stale — only change what is specified in the implementation steps
- Do NOT update `state.json` — the pipeline script handles all state mutations
- Do NOT add new sections or restructure the documents — preserve existing heading hierarchy
- Do NOT remove the "Adding New Agents" section at the bottom of `agents.md`
- Do NOT remove the "Creating New Skills" or "Skill File Structure" sections at the bottom of `skills.md`
- Do NOT change skill descriptions for skills that were not renamed (e.g., `review-phase` description stays the same)
- Preserve all Markdown formatting conventions (bold agent names in tables, backtick-wrapped skill names, etc.)
