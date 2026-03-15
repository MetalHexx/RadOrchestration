---
name: generate-task-report
description: 'Generate a Task Report after completing a coding task. Use when reporting task completion, documenting files changed, test results, acceptance criteria results, build status, or deviations from task handoff. Produces a structured report with file inventory, test summary, acceptance criteria assessment, and issue details.'
---

# Generate Task Report

Generate a Task Report after completing a coding task. The report documents what happened — files changed, tests run, criteria met or missed, issues encountered. Read by the Tactical Planner (to update state) and the Reviewer (to validate).

## When to Use This Skill

- After completing a coding task (all implementation steps done)
- When the Coder Agent needs to produce a structured output report
- After running tests and build to capture actual results

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Task Handoff | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | The task that was executed — file targets, acceptance criteria |
| Actual Results | Agent's work | Files created/modified, test output, build output |

## Workflow

1. **Inventory files changed**: List every file created, modified, or deleted with line counts
2. **Run tests**: Execute the test suite and record per-test results (actual, not assumed)
3. **Run build**: Execute the build and record pass/fail (actual, not assumed)
4. **Assess acceptance criteria**: Go through each criterion from the handoff, mark as Met/Partial/Not Met
5. **Document issues**: If any issues occurred, record with severity classification
6. **Document deviations**: If you deviated from the handoff instructions, explain what and why
7. **Write recommendations**: Optional — flag anything the Planner should know for next tasks
8. **Write the Task Report**: Use the bundled template at [templates/TASK-REPORT.md](./templates/TASK-REPORT.md)
9. **Save**: Write to `{PROJECT-DIR}/reports/{NAME}-TASK-REPORT-P{NN}-T{NN}.md`

## Key Rules

- **Factual only**: Report what happened, not what was intended — no aspirational language
- **Test results are actual**: You must run the tests, not assume they pass
- **Build status is actual**: You must run the build, not assume it passes
- **Status classification matters**: `complete` (all met), `partial` (some met), `failed` (blocking issues)
- **Every handoff file target must be accounted for**: In the Files Changed table
- **Every handoff acceptance criterion must have a result**: In the Acceptance Criteria Results table

> **IMPORTANT: The `status` field in the frontmatter MUST be exactly one of: `complete`, `partial`, or `failed`. Do NOT use synonyms like `pass`, `fail`, `success`, `done`, or any other word. The pipeline engine will reject reports with unrecognized status values.**

## Required Frontmatter Fields

The Task Report template frontmatter includes fields consumed by the pipeline engine (mutation handler and pre-read). These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|--------|
| `has_deviations` | boolean | **REQUIRED** | `true` or `false` | Mutation handler `resolveTaskOutcome`, pipeline `task_completed` pre-read | Indicates whether the agent deviated from the task handoff instructions during implementation |
| `deviation_type` | string or null | **REQUIRED** | `"minor"` \| `"architectural"` \| `null` | Mutation handler `resolveTaskOutcome` | Classifies the severity of any deviation; must be `null` when `has_deviations` is `false` |

> **IMPORTANT: Both `has_deviations` and `deviation_type` are REQUIRED in task report frontmatter. The pipeline engine validates that both fields are present. If either is missing, the pipeline returns an error result and halts processing. Set `has_deviations: false` and `deviation_type: null` when there are no deviations — do NOT omit the fields.**

## Status Classification

| Status | Meaning | Planner Action |
|--------|---------|----------------|
| `complete` | All acceptance criteria met, tests pass, build passes | Mark task complete, advance |
| `partial` | Some criteria met, minor issues remain | Check severity → auto-retry or escalate |
| `failed` | Blocking issues, build broken, critical errors | Check severity → halt or corrective task |

## Template

Use the bundled template: [TASK-REPORT.md](./templates/TASK-REPORT.md)
