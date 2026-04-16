---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
task: {TASK-NUMBER}
title: "{TASK-TITLE}"
status: "pending"
skills: ["{skill-1}", "{skill-2}"]
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

<!-- CONDITIONAL: Include this section only for UI tasks with design token references in scope -->
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
