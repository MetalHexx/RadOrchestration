---
name: create-phase-plan
description: 'Create a Phase Plan that breaks a project phase into concrete tasks with execution order, dependencies, and acceptance criteria. Use when planning phase execution, defining task breakdown, establishing task dependencies, or creating a phase-level execution plan. Produces a structured phase plan with task outlines, dependency graphs, execution order, and exit criteria.'
---

# Create Phase Plan

Generate a Phase Plan that breaks a phase from the Master Plan into concrete tasks with execution order, dependencies, and acceptance criteria. This is the Tactical Planner's operational document.

## When to Use This Skill

- At the start of each phase execution loop
- When the Orchestrator spawns the Tactical Planner to plan a phase
- When breaking a high-level phase outline into concrete, sequenced tasks

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Master Plan | `{NAME}-MASTER-PLAN.md` | Phase scope, exit criteria, execution constraints |
| PRD | `{NAME}-PRD.md` | Feature requirements, acceptance criteria |
| Architecture | `{NAME}-ARCHITECTURE.md` | Module map, contracts, file structure |
| Design | `{NAME}-DESIGN.md` | Per-component layouts and interaction states (heading-per-item), optional design tokens and accessibility (if included) |
| State | `state.json` | Current project state, limits |
| Previous Phase Report | `{NAME}-PHASE-REPORT-P{N-1}.md` | Carry-forward items (if not first phase) |

## Workflow

1. **Read inputs**: Load Master Plan (phase section), Architecture, Design, state.json
2. **Check limits**: Verify task count won't exceed `limits.max_tasks_per_phase` from state.json
3. **Define phase goal**: 1-2 sentences — what this phase delivers when complete
4. **Document inputs**: Record which documents and sections were consulted (audit trail)
5. **Break into tasks**: Each task should be achievable in a single agent session
6. **Map dependencies**: T1 → T2 means T1's output files/interfaces are inputs to T2
7. **Define execution order**: Show dependency graph AND sequential order; mark parallel-ready pairs
8. **Set exit criteria**: Mirror from Master Plan plus standard criteria (all tasks complete, build passes, tests pass)
9. **Note risks**: Phase-specific risks
10. **Write the Phase Plan**: Use the bundled template at [templates/PHASE-PLAN.md](./templates/PHASE-PLAN.md)
11. **Save**: Write to the appropriate path based on corrective status:
    - **Normal (first-time)**: `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`
    - **Corrective** (when `is_correction` is true in the event context): `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}-C{corrective_index}.md`
    
    The `-C{N}` suffix is appended immediately before `.md`. Read `corrective_index` from the event context — do not query the filesystem. Examples:
    | Scenario | Filename |
    |----------|----------|
    | Original plan | `MYPROJ-PHASE-02-SETUP.md` |
    | First correction | `MYPROJ-PHASE-02-SETUP-C1.md` |
    | Second correction | `MYPROJ-PHASE-02-SETUP-C2.md` |

## Corrective Phase Plan

When `is_correction` is `true` in your event context, the Orchestrator is spawning you for a corrective cycle (not a fresh phase). The `corrective_index` field tells you which correction this is, and `previous_review` contains the path to the phase review document.

### What to produce

When `is_correction` is true:

1. Read the phase review document at the path provided in `previous_review` (event context)
2. Extract the **Cross-Task Issues** section from the review
3. Create corrective tasks targeting those issues — these tasks come FIRST in the task outline
4. Follow corrective tasks with any remaining normal tasks for the phase
5. Carry-forward items from the phase review become inputs to subsequent tasks
6. Save with the corrective filename suffix: `{NAME}-PHASE-{NN}-{TITLE}-C{corrective_index}.md` — the original phase plan file is preserved (not overwritten)

## Required Frontmatter Fields

The Phase Plan template frontmatter includes fields consumed by the pipeline engine. These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|--------|
| `tasks` | array of `{id: string, title: string}` | **REQUIRED** | Non-empty array; each entry must have `id` (string, e.g., `"T01-AUTH"`) and `title` (string, human-readable) | `handlePhasePlanCreated` via `context.tasks` | Pipeline engine pre-reads this array at the `phase_plan_created` event to initialize the phase's task list automatically |

> **IMPORTANT: The `tasks` array in frontmatter is REQUIRED. The pipeline engine validates that `tasks` is present, is an array, and is non-empty. If `tasks` is missing or empty, the pipeline returns an error result and halts processing for the event. Every phase plan MUST include this field.**

## DO NOT

- Add a Task Details or Task Summaries section — the Task Outline table IS the task description
- Include implementation steps, imports, CSS classes, code snippets, hook calls, JSX, or design token refs — that belongs in the Task Handoff
- Use file paths — refer to modules/components by name (e.g., "SSEProvider context"); file targets are resolved at handoff time

## DO

- Use task IDs for dependencies — T3 depends on T1 means T1's output files are inputs to T3
- Create handoff docs on a tight loop — T1 handoff first, T2 handoff after T1 completes (read T1's report)
- Mark parallel-ready pairs — for future optimization, even though v1 executes sequentially

## Template

Use the bundled template: [PHASE-PLAN.md](./templates/PHASE-PLAN.md)
