---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "pending"
skills: ["{skill-1}", "{skill-2}"]  # Skill folder names from  agent skills folder — NOT technology or framework names
estimated_files: {NUMBER}
---

# {TASK-TITLE}

## Objective

{1-3 sentences. What this task accomplishes. Written as a completion statement: "Create...", "Implement...", "Configure..."}

## Context

{Minimal context the agent needs. NOT project history — just the immediate technical context.}

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `{path}` | {Notes} |
| MODIFY | `{path}` | {Notes} |

## Implementation Steps

1. {Step 1 — specific, actionable}
2. {Step 2 — specific, actionable}
3. {Step 3 — specific, actionable}

## Contracts & Interfaces

{Pre-defined interfaces, function signatures, API contracts, or component props this task must conform to. Inlined from the Architecture doc.}

```typescript
// {path/to/types.ts}
interface {InterfaceName} {
  {field}: {type};
}
```

## Styles & Design Tokens

{Specific design tokens, variables, component names from design system. Actual values, not references.}

- {Token}: `{value}` ({usage})

## Test Requirements

- [ ] {Test 1 — specific, verifiable}
- [ ] {Test 2 — specific, verifiable}
- [ ] {Test 3 — specific, verifiable}

## Acceptance Criteria

- [ ] {Criterion 1 — binary pass/fail}
- [ ] {Criterion 2 — binary pass/fail}
- [ ] {Criterion 3 — binary pass/fail}
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- {Constraint 1 — e.g., "Do NOT modify the auth middleware"}
- {Constraint 2 — e.g., "Use existing Button component from design system"}
