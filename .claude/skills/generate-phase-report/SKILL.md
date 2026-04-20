---
name: generate-phase-report
description: 'Generate a Phase Report summarizing outcomes after all tasks in a phase complete. Use when creating phase summaries, aggregating task results, assessing exit criteria, documenting carry-forward items, or recommending master plan adjustments. Produces a structured report with task results, exit criteria assessment, files changed, issues, and carry-forward items.'
user-invocable: false
---

# Generate Phase Report

Generate a Phase Report after all tasks in a phase are complete. Summarizes phase outcomes, assesses exit criteria, and feeds into the next phase planning cycle.

## When to Use This Skill

- After all tasks in a phase have been completed and reviewed
- When the Orchestrator spawns the Planner to summarize a phase
- When determining carry-forward items for the next phase

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Phase Plan | `{NAME}-PHASE-{NN}-{TITLE}.md` | Task outline, exit criteria |
| Code Reviews | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` (all) | Per-task review verdicts, task-level outcome data |
| State | `state.json` | Retry counts, error aggregation |

## Workflow

1. **Read all inputs**: Load Phase Plan, all Code Reviews, state.json
2. **Summarize**: 2-3 sentences on what was accomplished
3. **Aggregate task results**: Table with task status, retry count, key outcome per task
4. **Assess exit criteria**: Go through each criterion from the Phase Plan, mark as Met/Not Met
5. **Aggregate files changed**: Total files created/modified across all tasks
6. **Document issues**: Compile all issues from Code Reviews with resolutions
7. **Identify carry-forward items**: Anything the next phase must address
8. **Recommend adjustments**: If phase outcomes suggest the Master Plan needs adjustment
9. **Write the Phase Report**: Use the bundled template at [templates/PHASE-REPORT.md](./templates/PHASE-REPORT.md)
10. **Save**: Write based on corrective status:
    - Normal (first-time): `{PROJECT-DIR}/reports/{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md`
    - Corrective: `{PROJECT-DIR}/reports/{NAME}-PHASE-REPORT-P{NN}-{TITLE}-C{corrective_index}.md`

    The `-C{N}` suffix is appended immediately before `.md`. Read `corrective_index` from the event context — do not query the filesystem. The original (non-corrective) report is preserved, not overwritten. (See `orchestration/references/document-conventions.md` → "Corrective Filename Suffix" for the shared pattern.)

## Key Rules

- **Factual aggregation**: No opinions — compile data from code reviews and pipeline state
- **Every task accounted for**: All tasks from the Phase Plan appear in the results table
- **Exit criteria are from the Phase Plan**: Mirror them exactly and verify each one
- **Carry-forward items are concrete**: Specific things the next phase must handle, not vague concerns

## Template

Use the bundled template: [PHASE-REPORT.md](./templates/PHASE-REPORT.md)
