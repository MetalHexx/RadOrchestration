---
name: review-task
description: 'Review completed tasks against the plan, architecture, and design. Use when performing task-level code review, evaluating code quality, checking architectural consistency, validating design adherence, assessing test coverage, security review, or accessibility audit. Produces a structured review with verdicts, checklists, issues found, and recommendations.'
---

# Review Task

Perform a structured task review after a coding task completes. Evaluate code quality, architectural consistency, design adherence, test coverage, error handling, accessibility, and security.

## When to Use This Skill

- After a Coder completes a task
- When the Orchestrator spawns the Reviewer Agent to validate a task
- When assessing whether code changes meet the plan's requirements

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Task Handoff | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | Original task requirements, contracts, acceptance criteria |
| Architecture | `{NAME}-ARCHITECTURE.md` | Contracts, module map, file structure |
| Design | `{NAME}-DESIGN.md` | Components, design tokens, accessibility |
| PRD | `{NAME}-PRD.md` | Requirements being validated |
| Source Code | Actual files listed in Task Handoff | The code to review |

## Workflow

1. **Read the Task Handoff**: Understand what was supposed to be built
2. **Read the source code**: Review every file listed in the Task Handoff's File Targets section
3. **Check architectural consistency**: Do modules follow the Architecture's module map? Are contracts honored?
4. **Check design consistency**: Do components match the Design's specs? Are design tokens correct?
5. **Assess code quality**: Clean code, proper naming, no dead code, appropriate abstractions
6. **Verify test coverage**: Are the required tests present and meaningful?
7. **Check error handling**: Proper error boundaries, edge cases handled
8. **Check accessibility**: WCAG AA compliance, keyboard navigation, screen reader support
9. **Check security**: No exposed secrets, proper input validation, auth checks
10. **Determine verdict**: approved, changes_requested, or rejected
11. **Write the Code Review**: Use the bundled template at [templates/CODE-REVIEW.md](./templates/CODE-REVIEW.md)
12. **Save**: Write to `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md`

## Verdict Rules

| Verdict | When | Planner Action |
|---------|------|----------------|
| `approved` | All checklist items ✅ or ⚠️ with no critical issues | Mark task complete |
| `changes_requested` | Minor issues that need fixing | Generate corrective task |
| `rejected` | Critical issues, architectural violations, security problems | Halt or escalate |

## Key Rules

- **Read the actual code**: Inspect the source files directly
- **Binary assessments**: Each checklist item is ✅ (good), ⚠️ (minor concern), or ❌ (needs fixing)
- **Issues have suggestions**: Every issue found must include a concrete fix suggestion
- **Severity matters**: minor issues trigger retries; critical issues halt the pipeline

## Template

Use the bundled template: [CODE-REVIEW.md](./templates/CODE-REVIEW.md)
