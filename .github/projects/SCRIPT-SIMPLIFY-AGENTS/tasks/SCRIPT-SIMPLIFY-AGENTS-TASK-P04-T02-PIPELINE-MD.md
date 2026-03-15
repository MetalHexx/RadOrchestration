---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 2
title: "Rewrite pipeline.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Rewrite pipeline.md

## Objective

Rewrite `docs/pipeline.md` to document the new event-driven pipeline architecture where `pipeline.js` is the sole state-mutation authority. Remove all references to deleted scripts (`next-action.js`, `triage.js`, `validate-state.js`), `STATUS.md`, and the old Tactical-Planner-as-state-writer model. Document the Orchestrator as an event-driven controller and the Tactical Planner as a pure planning agent.

## Context

The orchestration system was refactored from three standalone CLI scripts into a single unified pipeline script (`pipeline.js`). The Orchestrator now operates as an event-driven controller: it signals events to `pipeline.js`, parses JSON results, and routes on an 18-action table. The Tactical Planner no longer writes `state.json` or invokes triage — it is a pure planning agent with 3 modes (phase plans, task handoffs, phase reports). The pipeline script internalizes all state mutations, validation, triage, and next-action resolution. `triage_attempts` is now persisted in `state.json` by the pipeline script (not a runtime counter). The current `docs/pipeline.md` is 208 lines and contains ~10 stale references to the old architecture.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/pipeline.md` | Full rewrite — replace all 208 lines |

## Implementation Steps

1. **Delete all existing content** in `docs/pipeline.md` and start fresh. Keep the `# Pipeline` title.

2. **Write the Pipeline Tiers section** — preserve the existing 4-tier model (`planning → execution → review → complete`) and the `halted` explanation. This is unchanged.

3. **Rewrite the Planning Pipeline section** — update the Mermaid sequence diagram to remove the Tactical Planner from initialization. Replace `ORC->>TP: Initialize project & state.json` with a note that the pipeline script initializes state on the first `start` event. Replace `ORC->>TP: Mark planning complete` with a note that the pipeline script transitions to execution on `plan_approved`. The rest of the planning sequence (Research → PM → UX → Architect) is unchanged. Use this corrected initialization flow:
   ```
   Human->>ORC: "Build me X"
   Note over ORC: pipeline.js --event start (initializes state.json)
   ```
   And this corrected planning-complete flow:
   ```
   ORC->>Human: Review Master Plan
   Human->>ORC: Approved — start execution
   Note over ORC: pipeline.js --event plan_approved (transitions to execution)
   ```

4. **Rewrite the Execution Pipeline section** — update the Mermaid sequence diagram to remove `ORC->>TP: Update state from report` and `ORC->>TP: Mark task complete`. Replace with pipeline script event calls. The corrected task loop is:
   ```
   ORC->>TP: Create Task Handoff
   TP-->>ORC: TASK-HANDOFF.md
   Note over ORC: pipeline.js --event task_handoff_created
   ORC->>COD: Execute task
   COD-->>ORC: TASK-REPORT.md
   Note over ORC: pipeline.js --event task_completed (mutates state + runs triage)
   ORC->>REV: Review code
   REV-->>ORC: CODE-REVIEW.md
   Note over ORC: pipeline.js --event code_review_completed (mutates state + runs triage)
   alt result.action == create_task_handoff (corrective)
       Note over ORC: Corrective retry
   else result.action == display_halted
       ORC->>Human: Intervention required
   else result.action == execute_task / create_task_handoff (next)
       Note over ORC: Continue to next task
   end
   ```
   Replace `ORC->>TP: Advance to next phase` with `Note over ORC: pipeline.js --event phase_review_completed (mutates state + runs triage)`.
   Replace `ORC->>TP: Mark project complete` with `Note over ORC: pipeline.js --event final_approved (transitions to complete)`.

5. **Rewrite the Task Lifecycle section** — remove step 3 ("State update — Tactical Planner reads the report and updates state.json") and step 5 (Triage Executor reference). The new task lifecycle is:
   1. **Handoff** — Tactical Planner creates a self-contained Task Handoff document
   2. **Execution** — Coder implements the task and produces a Task Report
   3. **Review** — Reviewer evaluates the code against PRD, architecture, and design
   4. **Triage** — Pipeline script (`pipeline.js`) processes the review verdict internally via `code_review_completed` event: applies state mutation, runs triage decision table, returns next action (advance, corrective retry, or halt)

6. **Rewrite the Phase Lifecycle section** — remove "Triage Executor processes the phase review verdict". The new phase lifecycle is:
   1. **Phase Report** — Tactical Planner aggregates task results and assesses exit criteria
   2. **Phase Review** — Reviewer performs cross-task integration review
   3. **Triage** — Pipeline script processes the phase review verdict internally via `phase_review_completed` event
   4. **Advance or Correct** — pipeline returns `create_phase_plan` (advance), `create_task_handoff` with `corrective: true` (corrective), or `display_halted` (halt)

7. **Rewrite the Pipeline Routing section** — replace the Next-Action Resolver description with the event-driven pipeline model. Document these key concepts:
   - The Orchestrator signals events to `pipeline.js` and receives one of 18 possible actions
   - All routing is deterministic: same event + same `state.json` = same result
   - The 18 external actions (agent spawns, human gates, terminal displays) are the only actions the Orchestrator sees
   - ~17 internal mechanical actions (state transitions, triage, validation) execute inside the pipeline script and are invisible to the Orchestrator
   - Link to `[Deterministic Scripts](scripts.md)` for the full event vocabulary and CLI reference

   Include this 18-action routing table:

   | # | Action | Category | Orchestrator Operation |
   |---|--------|----------|----------------------|
   | 1 | `spawn_research` | Agent spawn | Spawn Research agent |
   | 2 | `spawn_prd` | Agent spawn | Spawn Product Manager |
   | 3 | `spawn_design` | Agent spawn | Spawn UX Designer |
   | 4 | `spawn_architecture` | Agent spawn | Spawn Architect |
   | 5 | `spawn_master_plan` | Agent spawn | Spawn Architect (master plan) |
   | 6 | `create_phase_plan` | Agent spawn | Spawn Tactical Planner (phase plan mode) |
   | 7 | `create_task_handoff` | Agent spawn | Spawn Tactical Planner (handoff mode) |
   | 8 | `execute_task` | Agent spawn | Spawn Coder |
   | 9 | `spawn_code_reviewer` | Agent spawn | Spawn Reviewer (task review) |
   | 10 | `spawn_phase_reviewer` | Agent spawn | Spawn Reviewer (phase review) |
   | 11 | `generate_phase_report` | Agent spawn | Spawn Tactical Planner (report mode) |
   | 12 | `spawn_final_reviewer` | Agent spawn | Spawn Reviewer (final review) |
   | 13 | `request_plan_approval` | Human gate | Present master plan for approval |
   | 14 | `request_final_approval` | Human gate | Present final review for approval |
   | 15 | `gate_task` | Human gate | Present task results for approval |
   | 16 | `gate_phase` | Human gate | Present phase results for approval |
   | 17 | `display_halted` | Terminal | Display halt message — loop terminates |
   | 18 | `display_complete` | Terminal | Display completion — loop terminates |

8. **Rewrite the Triage Attempts section** — replace the runtime counter description with the persisted `triage_attempts` model:
   - `triage_attempts` is a field in `state.json` under the `execution` section
   - Lifecycle: init → 0, triage trigger event → increment by 1, advance event (task/phase moves forward) → reset to 0
   - If `triage_attempts > 1` after increment, the pipeline returns `display_halted` (loop detection)
   - Triage trigger events: `task_completed`, `code_review_completed`, `phase_review_completed`
   - This replaces the Orchestrator's old runtime counter which was lost on context compaction

9. **Rewrite the State Management section** — replace the sole-writer rule:
   - **Old**: "Only the Tactical Planner writes `state.json`"
   - **New**: "Only the pipeline script (`pipeline.js`) writes `state.json`"
   - Remove the `STATUS.md` line entirely (it no longer exists)
   - Keep the validation invariants bullet (15 invariants validated before every write)
   - Keep the linear task progression bullet (`not_started` → `in_progress` → `complete` | `failed`)
   - Keep the single in-progress task invariant
   - Remove "Every write is validated against 15 invariants before being committed" and replace with: "Every state mutation is validated against invariants before being written to disk. Invalid state never reaches disk."

10. **Preserve unchanged sections** — keep the Human Gates section, Error Handling section, and Retry Budget section largely intact, but:
    - In the Retry Budget section, replace the `[Triage Executor](scripts.md)` link with "The pipeline script" (the triage logic is now internal)
    - Verify no other references to deleted concepts remain

## Contracts & Interfaces

### Pipeline CLI Interface

```bash
node .github/orchestration/scripts/pipeline.js \
  --event <event_name> \
  --project-dir <path> \
  [--config <path>] \
  [--context '<json>']
```

### Success Result Shape (returned to Orchestrator)

```json
{
  "success": true,
  "action": "<one of 18 external actions>",
  "context": {
    "phase": 0,
    "task": 2,
    "doc_path": "/path/to/relevant/doc",
    "corrective": false,
    "message": "Human-readable description"
  },
  "mutations_applied": ["task_status → complete", "review_verdict → approved"],
  "triage_ran": true,
  "validation_passed": true
}
```

### Error Result Shape

```json
{
  "success": false,
  "error": "Validation failed: V6 — multiple in_progress tasks",
  "event": "task_completed",
  "state_snapshot": { "current_phase": 0, "current_task": 1 },
  "mutations_applied": ["task_status → complete"],
  "validation_passed": false
}
```

### `triage_attempts` Lifecycle

```
Init (new project)          → 0
Triage trigger event        → increment by 1
triage_attempts > 1         → pipeline returns display_halted
Advance event (task/phase)  → reset to 0
Cold start                  → preserve existing value from state.json
```

Triage trigger events: `task_completed`, `code_review_completed`, `phase_review_completed`.

### Triage Trigger Rules

| Event | Triggers Triage? | Level |
|-------|-----------------|-------|
| `task_completed` | Yes | `task` |
| `code_review_completed` | Yes | `task` |
| `phase_review_completed` | Yes | `phase` |
| All other events | No | — |

## Styles & Design Tokens

*Not applicable — documentation-only task.*

## Test Requirements

- [ ] No occurrences of `next-action.js` in `docs/pipeline.md`
- [ ] No occurrences of `triage.js` (as script reference) in `docs/pipeline.md`
- [ ] No occurrences of `validate-state.js` in `docs/pipeline.md`
- [ ] No occurrences of `STATUS.md` in `docs/pipeline.md`
- [ ] No occurrences of `Next-Action Resolver` in `docs/pipeline.md`
- [ ] No occurrences of `Triage Executor` in `docs/pipeline.md`
- [ ] No occurrences of "Only the Tactical Planner writes" in `docs/pipeline.md`
- [ ] The phrase `pipeline.js` appears at least 5 times in the document
- [ ] The 18-action routing table is present and complete
- [ ] Mermaid sequence diagrams render valid syntax (no broken arrows or undefined participants)

## Acceptance Criteria

- [ ] `docs/pipeline.md` describes the event-driven pipeline loop where the Orchestrator signals events to `pipeline.js` and routes on `result.action`
- [ ] `docs/pipeline.md` states that only the pipeline script (`pipeline.js`) writes `state.json`
- [ ] `docs/pipeline.md` documents `triage_attempts` as a persisted field in `state.json` (not a runtime counter)
- [ ] The 18-action routing table is present with all 18 actions listed
- [ ] The planning sequence diagram does not include `ORC->>TP: Initialize project` or `ORC->>TP: Mark planning complete`
- [ ] The execution sequence diagram does not include `ORC->>TP: Update state from report` or `ORC->>TP: Mark task complete`
- [ ] The task lifecycle does not mention the Tactical Planner updating state
- [ ] The phase lifecycle does not mention a Triage Executor
- [ ] Zero references to `STATUS.md`, `next-action.js`, `triage.js`, `validate-state.js`, `Next-Action Resolver`, or `Triage Executor`
- [ ] All internal cross-links (e.g., `[Deterministic Scripts](scripts.md)`, `[Project Structure](project-structure.md)`) are present and use correct targets
- [ ] The document is well-structured Markdown with proper heading hierarchy

## Constraints

- Do NOT modify any file other than `docs/pipeline.md`
- Do NOT reference the old 3-script architecture or any deleted script names (except in contrast if absolutely necessary for clarity — and even then, avoid it)
- Do NOT add references to `STATUS.md` — it no longer exists
- Do NOT describe the Tactical Planner as writing `state.json` or invoking triage
- Do NOT introduce new architectural concepts not documented in the orchestrator agent definition — stick to the 18-action model
- Do NOT change the Human Gates section content beyond removing stale references (the gate modes are unchanged)
- Do NOT use ~30 actions or ~35 actions — the correct number is 18 external actions
