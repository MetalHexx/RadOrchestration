---
project: "STATE-TRANSITION-SCRIPTS"
phase: 4
task: 1
title: "Orchestrator Agent Rewrite"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Orchestrator Agent Rewrite

## Objective

Rewrite the Orchestrator agent definition (`.github/agents/orchestrator.agent.md`) to replace the inline prose decision tree in Step 2d (execution loop) with script-based routing via `node src/next-action.js`, a pattern-match on the returned action enum, and explicit `triage_attempts` counter management.

## Context

The Next-Action Resolver script (`src/next-action.js`) was built in Phases 1–3. It reads `state.json`, evaluates a ~35-branch decision tree, and emits a JSON object to stdout with an `action` field containing one value from the `NEXT_ACTIONS` closed enum. The Orchestrator must now call this script instead of re-deriving routing from prose. The `triage_attempts` counter is a runtime-local variable (never persisted to `state.json`) that prevents infinite triage loops — it increments on triage actions, resets on advance actions, and halts the pipeline if it exceeds 1.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | Rewrite the execution section (Step 2d); preserve all other sections |

## Implementation Steps

1. **Read the current file** at `.github/agents/orchestrator.agent.md` — understand its full structure before making changes.

2. **Preserve unchanged sections** — The following sections remain EXACTLY as they are today (do NOT modify them):
   - YAML frontmatter block (lines 1–14)
   - `# Orchestrator` heading and the opening paragraph
   - `## Role & Constraints` section (entire section)
   - `## Configuration` section (entire section)
   - `## Pipeline Overview` section (entire section)
   - Step 0: Locate the project (entire subsection)
   - Step 1: Read state (entire subsection)
   - Step 2a: New project (entire subsection)
   - Step 2b: Pipeline is `halted` (entire subsection)
   - Step 2c: Pipeline is `planning` (entire subsection)
   - Step 2e: Pipeline is `review` (entire subsection)
   - Step 2f: Pipeline is `complete` (entire subsection)
   - `## Spawning Subagents` section (entire section)
   - `## Status Reporting` section (entire section)

3. **Replace Step 2d (Pipeline is `execution`)** — Remove the ENTIRE current content of Step 2d and replace it with the script-based routing workflow defined below. The new Step 2d must contain:
   - The human gate mode question (first-time `ask` mode prompt — preserve this from the current version)
   - The script invocation command
   - The JSON parsing instruction
   - The `triage_attempts` counter definition
   - The complete action→agent mapping table
   - The `triage_attempts` management rules

4. **Write the script invocation block** inside the new Step 2d:
   ```
   node src/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml
   ```
   - `--state` is required, always pass it
   - `--config` is optional; pass it when the project's `human_gate_mode` is `"ask"` and needs resolution from config

5. **Write the JSON parsing instruction**:
   ```
   Capture stdout from the script. Parse it: result = JSON.parse(stdout).
   If the script exits with code 1 and stdout is not valid JSON, read stderr for diagnostics and halt the pipeline.
   The result object has this shape:
   {
     "action": "<NEXT_ACTIONS enum value>",
     "context": {
       "tier": "<pipeline tier>",
       "phase_index": <number | null>,
       "task_index": <number | null>,
       "phase_id": "<string | null>",
       "task_id": "<string | null>",
       "details": "<explanation>"
     }
   }
   ```

6. **Write the `triage_attempts` counter definition block** (place before the mapping table):
   ```
   triage_attempts is a counter local to the current Orchestrator invocation.
   - Initialize to 0 at the start of the execution loop
   - Increment by 1 when result.action is "triage_task" or "triage_phase"
   - Reset to 0 when result.action is "advance_task" or "advance_phase"  
   - If triage_attempts > 1: HALT the pipeline instead of spawning triage again
     (spawn Tactical Planner to halt with error message identifying the stuck triage invariant)
   - This counter is NEVER persisted to state.json — it is runtime-local only
   ```

7. **Write the complete action→agent mapping table** — Use the exact table from the "Action→Agent Mapping Table" section of this handoff (below). Every row in the table must appear in the rewritten Step 2d.

8. **Write the post-action instruction**: After spawning the indicated agent per the mapping table, the Orchestrator must:
   - Re-read `state.json` (the spawned agent may have changed it)
   - Call the script again: `node src/next-action.js --state ... --config ...`
   - Parse the new result and repeat the pattern-match
   - Continue until the script returns a terminal action (`display_complete` or `display_halted`) or a human gate action (`request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`)

9. **Remove ALL residual inline routing conditions** — After the rewrite, the execution section must contain ZERO branching logic that depends on reading `state.json` fields directly. ALL routing derives from the script's `result.action` value. The Orchestrator reads `state.json` only for display/context purposes, never for routing decisions.

10. **Verify the final file structure** matches: frontmatter → heading → Role & Constraints → Configuration → Pipeline Overview → Decision Logic (Steps 0, 1, 2a–2f) → Spawning Subagents → Status Reporting.

## Action→Agent Mapping Table

This is the complete action-to-agent mapping. The Orchestrator pattern-matches on `result.action` and performs the corresponding action. Every value in the NEXT_ACTIONS enum (35 values) is covered.

| `result.action` | Agent/Action | Instructions |
|---|---|---|
| `init_project` | Spawn **Tactical Planner** | Initialize project folder, state.json, STATUS.md. Then re-read state and re-run script. |
| `display_halted` | **Display to Human** | Show STATUS.md and `errors.active_blockers` from state.json. Ask human how to proceed. |
| `spawn_research` | Spawn **Research Agent** | Pass brainstorming doc (if exists) + human idea. Output: RESEARCH-FINDINGS.md. Then spawn Tactical Planner to update state. |
| `spawn_prd` | Spawn **Product Manager** | Pass brainstorming doc (if exists) + RESEARCH-FINDINGS.md. Output: PRD.md. Then spawn Tactical Planner to update state. |
| `spawn_design` | Spawn **UX Designer** | Pass PRD.md + RESEARCH-FINDINGS.md. Output: DESIGN.md. Then spawn Tactical Planner to update state. |
| `spawn_architecture` | Spawn **Architect** | Pass PRD.md + DESIGN.md + RESEARCH-FINDINGS.md. Output: ARCHITECTURE.md. Then spawn Tactical Planner to update state. |
| `spawn_master_plan` | Spawn **Architect** | Pass all planning docs. Output: MASTER-PLAN.md. Then spawn Tactical Planner to update state. |
| `request_plan_approval` | **Human Gate** | Display Master Plan summary. Ask human to approve before execution. Once approved, spawn Tactical Planner to set `planning.human_approved = true` and transition to execution. |
| `transition_to_execution` | Spawn **Tactical Planner** | Set `current_tier = "execution"`. Then re-read state and re-run script. |
| `create_phase_plan` | Spawn **Tactical Planner** (Mode 3) | Create Phase Plan for the phase at `result.context.phase_index`. Then re-read state and re-run script. |
| `create_task_handoff` | Spawn **Tactical Planner** (Mode 4) | Create Task Handoff for the task at `result.context.task_index` in phase `result.context.phase_index`. Then re-read state and re-run script. |
| `execute_task` | Spawn **Coder** | Execute the task using the handoff doc. Then spawn Tactical Planner to update state from the task report. Re-read state and re-run script. |
| `update_state_from_task` | Spawn **Tactical Planner** (Mode 2) | Update state.json from the Coder's task report. Then re-read state and re-run script. |
| `create_corrective_handoff` | Spawn **Tactical Planner** (Mode 4) | Create a corrective Task Handoff for the failed task. Then spawn Coder. Then spawn Tactical Planner to update state. Re-read state and re-run script. |
| `halt_task_failed` | Spawn **Tactical Planner** | Halt pipeline — task failed with critical severity or exceeded max retries. Record in `errors.active_blockers`. Then display STATUS.md to human. |
| `spawn_code_reviewer` | Spawn **Reviewer** | Code review for the completed task. Then spawn Tactical Planner to update state (record `review_doc` path). Re-read state and re-run script. |
| `update_state_from_review` | Spawn **Tactical Planner** (Mode 2) | Update state.json with the code review document path. Then re-read state and re-run script. |
| `triage_task` | **Check `triage_attempts`**, then Spawn **Tactical Planner** (Mode 4) | **BEFORE spawning**: increment `triage_attempts`. If `triage_attempts > 1`: do NOT spawn — instead halt pipeline (see `halt_triage_invariant`). Otherwise: spawn Tactical Planner with instruction to read the code review at the task's `review_doc` path, execute triage (call `node src/triage.js --level task`), write `review_verdict` and `review_action` to state.json, then produce the next Task Handoff. Re-read state and re-run script. |
| `halt_triage_invariant` | Spawn **Tactical Planner** | Halt pipeline with error: "Triage invariant still violated after re-spawn. review_doc is set but review_verdict is null. Pipeline halted — requires human intervention." Display STATUS.md to human. |
| `retry_from_review` | Spawn **Tactical Planner** (Mode 4) | Create corrective Task Handoff to address `changes_requested` issues. Then spawn Coder. Then spawn Tactical Planner to update state. Re-read state and re-run script. |
| `halt_from_review` | Spawn **Tactical Planner** | Halt pipeline — code review verdict is `rejected`. Record in `errors.active_blockers`. Display STATUS.md to human. |
| `advance_task` | Spawn **Tactical Planner** (Mode 2) | Advance to next task. **Reset `triage_attempts` to 0.** Update state.json. Re-read state and re-run script. |
| `gate_task` | **Human Gate** | Show task results to human. Wait for approval before continuing. Then re-read state and re-run script. |
| `generate_phase_report` | Spawn **Tactical Planner** (Mode 5) | Generate Phase Report for the completed phase. Then re-read state and re-run script. |
| `spawn_phase_reviewer` | Spawn **Reviewer** | Phase review for the completed phase. Then spawn Tactical Planner to update state (record `phase_review` path). Re-read state and re-run script. |
| `update_state_from_phase_review` | Spawn **Tactical Planner** (Mode 2) | Update state.json with the phase review document path. Then re-read state and re-run script. |
| `triage_phase` | **Check `triage_attempts`**, then Spawn **Tactical Planner** (Mode 3) | **BEFORE spawning**: increment `triage_attempts`. If `triage_attempts > 1`: do NOT spawn — instead halt pipeline (see `halt_phase_triage_invariant`). Otherwise: spawn Tactical Planner with instruction to read the phase review at the phase's `phase_review` path, execute triage (call `node src/triage.js --level phase`), write `phase_review_verdict` and `phase_review_action` to state.json, then produce the Phase Plan for the next phase. Re-read state and re-run script. |
| `halt_phase_triage_invariant` | Spawn **Tactical Planner** | Halt pipeline with error: "Phase triage invariant still violated after re-spawn. phase_review is set but phase_review_verdict is null. Pipeline halted — requires human intervention." Display STATUS.md to human. |
| `gate_phase` | **Human Gate** | Show phase results to human. Wait for approval before continuing. Then re-read state and re-run script. |
| `advance_phase` | Spawn **Tactical Planner** (Mode 2) | Advance to next phase. **Reset `triage_attempts` to 0.** Update state.json (increment `current_phase`). Re-read state and re-run script. |
| `transition_to_review` | Spawn **Tactical Planner** (Mode 2) | Set `current_tier = "review"`. Update state.json. Then re-read state and re-run script. |
| `spawn_final_reviewer` | Spawn **Reviewer** | Final comprehensive review. Then spawn Tactical Planner to update state. Re-read state and re-run script. |
| `request_final_approval` | **Human Gate** | Display final review to human. Ask human to approve or request changes. Once approved, spawn Tactical Planner to set `final_review.human_approved = true` and transition to complete. |
| `transition_to_complete` | Spawn **Tactical Planner** (Mode 2) | Set `current_tier = "complete"`. Update state.json. Then re-read state and re-run script. |
| `display_complete` | **Display to Human** | Show completion summary. No further actions. |

## NEXT_ACTIONS Enum Reference

These are the 35 exact string values the script can return in `result.action`. Defined in `src/lib/constants.js`:

```javascript
const NEXT_ACTIONS = Object.freeze({
  INIT_PROJECT: 'init_project',
  DISPLAY_HALTED: 'display_halted',
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  TRANSITION_TO_EXECUTION: 'transition_to_execution',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  UPDATE_STATE_FROM_TASK: 'update_state_from_task',
  CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
  HALT_TASK_FAILED: 'halt_task_failed',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
  TRIAGE_TASK: 'triage_task',
  HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
  RETRY_FROM_REVIEW: 'retry_from_review',
  HALT_FROM_REVIEW: 'halt_from_review',
  ADVANCE_TASK: 'advance_task',
  GATE_TASK: 'gate_task',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
  TRIAGE_PHASE: 'triage_phase',
  HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
  GATE_PHASE: 'gate_phase',
  ADVANCE_PHASE: 'advance_phase',
  TRANSITION_TO_REVIEW: 'transition_to_review',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  TRANSITION_TO_COMPLETE: 'transition_to_complete',
  DISPLAY_COMPLETE: 'display_complete'
});
```

## Script Output Schema

The script emits JSON to stdout. Parse with `JSON.parse(stdout)`. The result object shape:

```javascript
// Success (exit code 0):
{
  "action": "create_phase_plan",         // One of NEXT_ACTIONS values
  "context": {
    "tier": "execution",                  // PIPELINE_TIERS enum
    "phase_index": 0,                     // 0-based, or null
    "task_index": null,                   // 0-based, or null
    "phase_id": "P01",                    // Human-readable, or null
    "task_id": null,                      // Human-readable, or null
    "details": "Phase 1 status is not_started — creating phase plan"
  }
}

// Error (exit code 1, stdout parseable):
{
  "action": "error",
  "context": {
    "tier": null,
    "phase_index": null,
    "task_index": null,
    "phase_id": null,
    "task_id": null,
    "details": "Failed to read state.json: ENOENT"
  }
}
```

## Current Agent File Structure (What to Preserve vs. Remove)

The current file `.github/agents/orchestrator.agent.md` has this structure:

```
Lines 1-14:    YAML frontmatter (---...---)           → PRESERVE
Lines 16-17:   # Orchestrator heading + intro          → PRESERVE
Lines 19-31:   ## Role & Constraints                   → PRESERVE  
Lines 33-40:   ## Configuration                        → PRESERVE
Lines 42-47:   ## Pipeline Overview                    → PRESERVE
Lines 49-52:   ## Decision Logic                       → PRESERVE heading
Lines 54-62:   ### Step 0: Locate the project          → PRESERVE
Lines 64-70:   ### Step 1: Read state                  → PRESERVE
Lines 72-82:   #### 2a. New project                    → PRESERVE
Lines 84-90:   #### 2b. Pipeline is halted             → PRESERVE
Lines 92-117:  #### 2c. Pipeline is planning           → PRESERVE
Lines 119-220: #### 2d. Pipeline is execution          → REMOVE & REPLACE (this is the target)
Lines 222-228: #### 2e. Pipeline is review             → PRESERVE
Lines 230-232: #### 2f. Pipeline is complete           → PRESERVE
Lines 234-244: ## Spawning Subagents                   → PRESERVE
Lines 246-252: ## Status Reporting                     → PRESERVE
```

**The rewrite target is ONLY section 2d** — everything between the `#### 2d.` heading and the `#### 2e.` heading. Remove the entire inline decision tree (the pseudocode `IF/ELSE` blocks, the `triage_attempts` inline blocks, all of it) and replace with the script-based workflow.

## Styles & Design Tokens

Not applicable — this is a markdown agent definition file, not a UI component.

## Test Requirements

- [ ] No automated tests required for this task (it modifies a markdown agent definition, not source code)
- [ ] Manual verification: read the final file and confirm all 35 NEXT_ACTIONS values are covered in the mapping table
- [ ] Manual verification: confirm no `IF task.status ==` or `IF phase.status ==` conditionals remain in Step 2d

## Acceptance Criteria

- [ ] Step 2d contains the script invocation: `node src/next-action.js --state <path>` with `--config <path>` (optional)
- [ ] Step 2d contains the JSON parsing instruction with the complete output schema
- [ ] Step 2d contains the complete action→agent mapping table covering all 35 NEXT_ACTIONS enum values
- [ ] Step 2d contains the `triage_attempts` counter definition with: initialize to 0, increment on `triage_task`/`triage_phase`, reset on `advance_task`/`advance_phase`, halt if > 1
- [ ] NO residual inline routing conditions remain in Step 2d — zero `IF task.status ==`, `IF phase.status ==`, `IF task.review_doc !=` conditionals
- [ ] All non-execution sections are preserved unchanged: frontmatter, Role & Constraints, Configuration, Pipeline Overview, Steps 0/1/2a/2b/2c/2e/2f, Spawning Subagents, Status Reporting
- [ ] The script path is `src/next-action.js` (NOT `resolve-next-action.js`)
- [ ] The CLI flags are `--state` and `--config` (NOT `--state-file` or `--config-file`)
- [ ] The file renders as valid markdown (no broken code blocks, no unclosed fences)
- [ ] Build succeeds (no syntax errors — this is a markdown file, so just verify valid markdown structure)

## Constraints

- Do NOT modify the YAML frontmatter block
- Do NOT modify any section outside of Step 2d (the execution section)
- Do NOT add new sections to the agent file
- Do NOT reference external documents from the mapping table — all information is inline in the table
- Do NOT add the `triage_attempts` counter to `state.json` — it is runtime-local to the Orchestrator only
- Do NOT change the agent's tools or other agents listed in the frontmatter
- Do NOT modify Steps 2a, 2b, 2c, 2e, or 2f — only Step 2d is rewritten
- Use the actual script path `src/next-action.js`, NOT the Design doc's draft name `resolve-next-action.js`
- Use the actual flag names `--state` and `--config`, NOT any alternative names
