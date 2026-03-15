---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 6
title: "Planning Skill Updates"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Planning Skill Updates

## Objective

Add "Prior Context (Corrective Handling)" sections to the `create-phase-plan` and `create-task-handoff` skills so the Tactical Planner reads computed triage outcomes from `state.json` and adjusts planning accordingly — producing corrective task handoffs or corrective phase plans when the pipeline signals issues.

## Context

The pipeline script now persists `review_action` (per-task) and `phase_review_action` (per-phase) in `state.json`. The Tactical Planner agent already has Prior Context routing tables in its agent definition that read these fields. The two planning skills must mirror this guidance so any agent using the skill receives the same routing instructions. Currently neither skill mentions `state.json` triage fields or corrective handling.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-phase-plan/SKILL.md` | Add Prior Context section, add `state.json` to Inputs table |
| MODIFY | `.github/skills/create-task-handoff/SKILL.md` | Add Prior Context section, add `state.json` to Inputs table |

## Implementation Steps

### Step 1: Modify `create-phase-plan/SKILL.md`

1. In the **Inputs Required** table, verify that `state.json` already appears. It currently has this row:

   ```
   | State | `state.json` | Current project state, limits |
   ```

   This row already exists — no change needed to the Inputs table.

2. Add a new `## Prior Context (Corrective Handling)` section immediately **after** the `## Workflow` section and **before** the `## Key Rules` section. Insert the following exact content:

   ```markdown
   ## Prior Context (Corrective Handling)

   Before creating the phase plan, check for corrective routing:

   1. **Read** `state.json → execution.phases[current].phase_review_action`
   2. **Route** based on the value:

   | `phase_review_action` value | What to produce |
   |-----------------------------|-----------------|
   | `null` (no review) | Normal Phase Plan for the next phase |
   | `"advance"` | Normal Phase Plan (include carry-forward tasks if any exit criteria were unmet) |
   | `"corrective_tasks_issued"` | Phase Plan that opens with corrective tasks addressing the Phase Review's Cross-Task Issues; new tasks come after |
   | `"halted"` | DO NOT produce a Phase Plan — inform the Orchestrator the pipeline is halted |

   ### Corrective Phase Plan

   When `phase_review_action == "corrective_tasks_issued"`:

   1. Read the phase review document at the phase's `phase_review` path in `state.json`
   2. Extract the **Cross-Task Issues** section from the review
   3. Create corrective tasks targeting those issues — these tasks come FIRST in the task outline
   4. Follow corrective tasks with any remaining normal tasks for the phase
   5. Carry-forward items from the phase review become inputs to subsequent tasks
   ```

### Step 2: Modify `create-task-handoff/SKILL.md`

1. In the **Inputs Required** table, add a new row for `state.json`. The table currently ends with:

   ```
   | Previous Task Report | `{NAME}-TASK-REPORT-P{NN}-T{NN}.md` | Output from prior task (if dependency exists) |
   ```

   Add the following row immediately after:

   ```
   | State | `state.json` | Current project state, review actions, triage outcomes |
   ```

2. Add a new `## Prior Context (Corrective Handling)` section immediately **after** the `## Workflow` section and **before** the `## Key Rules` section. Insert the following exact content:

   ```markdown
   ## Prior Context (Corrective Handling)

   Before creating the task handoff, check for corrective routing:

   1. **Read** `state.json → execution.phases[current].tasks[previous].review_action`
   2. **Route** based on the value:

   | `review_action` value | What to produce |
   |-----------------------|-----------------|
   | `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context |
   | `"advanced"` / `"advance"` | Normal Task Handoff; include carry-forward items in context |
   | `"corrective_task_issued"` | Corrective Task Handoff; inline all Issues from Code Review; include original acceptance criteria |
   | `"halted"` | DO NOT produce a Task Handoff — inform the Orchestrator the pipeline is halted |

   ### Corrective Task Handoff

   When `review_action == "corrective_task_issued"`:

   1. Read the code review document at the task's `review_doc` path in `state.json`
   2. Extract the **Issues** table from the review
   3. These issues become the primary objective of the corrective handoff
   4. Include the original task's acceptance criteria (they still apply)
   5. Focus implementation steps ONLY on fixing the identified issues — do not re-implement the full task
   6. Save with the same task ID (overwrite or append `-fix` suffix as appropriate)
   ```

## Contracts & Interfaces

No code contracts — these are Markdown skill files. The routing tables must match the Tactical Planner agent's Prior Context routing tables exactly:

**Phase Plan routing field**: `state.json → execution.phases[current].phase_review_action`
- Values: `null`, `"advance"`, `"corrective_tasks_issued"`, `"halted"`

**Task Handoff routing field**: `state.json → execution.phases[current].tasks[previous].review_action`
- Values: `null`, `"advanced"` / `"advance"`, `"corrective_task_issued"`, `"halted"`

## Styles & Design Tokens

N/A — Markdown documentation files only.

## Test Requirements

- [ ] `create-phase-plan/SKILL.md` contains a `## Prior Context (Corrective Handling)` heading
- [ ] `create-task-handoff/SKILL.md` contains a `## Prior Context (Corrective Handling)` heading
- [ ] `create-task-handoff/SKILL.md` Inputs Required table includes a `state.json` row
- [ ] Phase plan skill references `phase_review_action` field from `state.json`
- [ ] Task handoff skill references `review_action` field from `state.json`
- [ ] Both routing tables have exactly 4 rows (matching the agent's tables)
- [ ] Corrective handling subsections describe how to read the review document and extract issues

## Acceptance Criteria

- [ ] `create-phase-plan/SKILL.md` has a "Prior Context (Corrective Handling)" section between Workflow and Key Rules
- [ ] `create-task-handoff/SKILL.md` has a "Prior Context (Corrective Handling)" section between Workflow and Key Rules
- [ ] `create-task-handoff/SKILL.md` Inputs Required table includes `state.json` row
- [ ] Phase plan skill routing table lists values: `null`, `"advance"`, `"corrective_tasks_issued"`, `"halted"`
- [ ] Task handoff skill routing table lists values: `null`, `"advanced"/"advance"`, `"corrective_task_issued"`, `"halted"`
- [ ] Routing tables match the Tactical Planner agent's Prior Context tables exactly (same values, same descriptions)
- [ ] No other sections of either skill file are modified beyond the additions described
- [ ] No lint errors in modified files

## Constraints

- Do NOT modify the `## Workflow` steps themselves — only add a new section after Workflow
- Do NOT modify the `## Key Rules`, `## Quality Checklist`, or `## Template` sections
- Do NOT modify any template files in `templates/` subdirectories
- Do NOT touch any agent definition files (`.agent.md`) — those are handled by other tasks
- Do NOT modify `state.json` — this is a documentation-only task
- Do NOT rename, delete, or create any skill directories
- Do NOT change the skill frontmatter (`name`, `description` fields)
- Preserve all existing content in both skill files — additions only, no deletions
