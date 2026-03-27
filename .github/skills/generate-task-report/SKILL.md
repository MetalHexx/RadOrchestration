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
9. **Save**: Write to `{PROJECT-DIR}/reports/{NAME}-TASK-REPORT-P{NN}-T{NN}-{TITLE}.md`

## Key Rules

- **Factual only**: Report what happened, not what was intended — no aspirational language
- **Test results are actual**: You must run the tests, not assume they pass
- **Build status is actual**: You must run the build, not assume it passes
- **Status classification matters**: `complete` (acceptance criteria met) or `failed` (acceptance criteria not met) — there is no middle-ground status. Document pre-existing or out-of-scope issues in the "Pre-existing Issues" section.
- **Every handoff file target must be accounted for**: In the Files Changed table
- **Every handoff acceptance criterion must have a result**: In the Acceptance Criteria Results table

> **IMPORTANT: The `status` field in the frontmatter MUST be exactly one of: `complete` or `failed`. Do NOT use synonyms like `pass`, `fail`, `success`, `done`, `partial`, or any other word. The pipeline engine will reject reports with unrecognized status values. Legacy reports using `partial` are mapped to `complete` for backward compatibility.**

## Required Frontmatter Fields

The Task Report template frontmatter includes fields consumed by the pipeline engine (mutation handler and pre-read). These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|--------|
| `has_deviations` | boolean | **REQUIRED** | `true` or `false` | Mutation handler `resolveTaskOutcome`, pipeline `task_completed` pre-read | Indicates whether the agent deviated from the task handoff instructions during implementation |
| `deviation_type` | string or null | **REQUIRED** | `"minor"` \| `"architectural"` \| `null` | Mutation handler `resolveTaskOutcome` | Classifies the severity of any deviation; must be `null` when `has_deviations` is `false` |

> **IMPORTANT: Both `has_deviations` and `deviation_type` are REQUIRED in task report frontmatter. The pipeline engine validates that both fields are present. If either is missing, the pipeline returns an error result and halts processing. Set `has_deviations: false` and `deviation_type: null` when there are no deviations — do NOT omit the fields.**

## Status Classification

| Status | Meaning | When to Use |
|--------|---------|-------------|
| `complete` | Task done; deliverables meet acceptance criteria | Default. Use even when pre-existing issues exist outside the task's scope. Document concerns in the "Pre-existing Issues" section of the report. |
| `failed` | Task could not be completed; acceptance criteria not met | Use only when the task's own acceptance criteria cannot be satisfied. |

## Pre-existing Issues Guidance

When you discover issues during implementation that are **outside the scope** of the task's acceptance criteria (e.g., pre-existing test failures, unrelated bugs, technical debt), do NOT use `failed` to signal these. Instead:

- Set `status: complete` if the task's own acceptance criteria are met
- Document the out-of-scope issues in the **Pre-existing Issues** section of the report (see template)
- The Reviewer's verdict is the authoritative outcome — your self-reported status informs but does not override the review

Use `failed` **only** when you cannot satisfy the task's own acceptance criteria.

## Template

Use the bundled template: [TASK-REPORT.md](./templates/TASK-REPORT.md)
