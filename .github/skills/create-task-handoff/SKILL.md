---
name: create-task-handoff
description: 'Create a self-contained Task Handoff document for a Coding Agent. Use when creating task handoffs, preparing coding tasks, defining implementation steps, specifying file targets, or generating task assignments with contracts, interfaces, test requirements, and acceptance criteria. The handoff is the SOLE input the Coder reads — it must be completely self-contained with no external document references.'
---

# Create Task Handoff

Generate a self-contained Task Handoff document that is the sole input a Coding Agent reads. Everything the coder needs — objective, context, file targets, implementation steps, contracts, design tokens, tests, acceptance criteria — must be compiled into this single document.

## When to Use This Skill

- After a Phase Plan defines the task outline and you need to create individual task handoffs
- When the Orchestrator spawns the Tactical Planner to prepare a task for the Coder
- When creating a corrective task after a review finds issues

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Phase Plan | `{NAME}-PHASE-{NN}-{TITLE}.md` | Task outline, dependencies, execution order |
| Architecture | `{NAME}-ARCHITECTURE.md` | Contracts, interfaces, file structure |
| Design | `{NAME}-DESIGN.md` | Design tokens, component specs (if UI task) |
| Previous Task Report | `{NAME}-TASK-REPORT-P{NN}-T{NN}.md` | Output from prior task (if dependency exists) |
| State | `state.json` | Current project state, review actions, mutation handler outcomes |

## Workflow

1. **Read inputs**: Load Phase Plan, Architecture, Design (if relevant), and any prior task reports
2. **Discover available skills**: Discover agent skills in the skills directory to recommend relevant ones for the task handoff
3. **Write objective**: 1-3 sentences as a completion statement ("Create...", "Implement...", "Configure...")
4. **Write context**: Minimal immediate technical context (max 5 sentences) — NOT project history
5. **Define file targets**: Exact file paths with CREATE/MODIFY action types
6. **Write implementation steps**: Specific, actionable, ordered steps (max 10)
7. **Inline contracts**: Copy the exact interfaces/contracts from Architecture — do NOT reference the Architecture doc
8. **Inline design tokens**: Copy the actual token values from Design — do NOT say "see design doc"
9. **Define test requirements**: Specific, verifiable test cases
10. **Define acceptance criteria**: Binary pass/fail checklist
11. **Add constraints**: Explicit boundaries (what NOT to do)
12. **Write the Task Handoff**: Use the bundled template at [templates/TASK-HANDOFF.md](./templates/TASK-HANDOFF.md)
13. **Save**: Write to `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md`

## Prior Context (Corrective Handling)

Before creating the task handoff, check for corrective routing:

1. **Read** `state.json → execution.phases[current_phase - 1].tasks[task_index].review.action`
2. **Route** based on the value:

| `review.action` value | What to produce |
|-----------------------|------------------|
| `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context |
| `"advanced"` / `"advance"` | Normal Task Handoff; include carry-forward items in context |
| `"corrective_task_issued"` | Corrective Task Handoff; inline all Issues from Code Review; include original acceptance criteria |
| `"halted"` | DO NOT produce a Task Handoff — inform the Orchestrator the pipeline is halted |

### Corrective Task Handoff

When `review.action == "corrective_task_issued"`:

1. Read the code review document at the task's `docs.review` path in `state.json`
2. Extract the **Issues** table from the review
3. These issues become the primary objective of the corrective handoff
4. Include the original task's acceptance criteria (they still apply)
5. Focus implementation steps ONLY on fixing the identified issues — do not re-implement the full task
6. Save with the same task ID (overwrite or append `-fix` suffix as appropriate)

## Key Rules

- **Self-contained**: The Coder reads ONLY this document — zero external doc references
- **High signal-to-noise**: Every line must be actionable — no background, no rationale, no history
- **Deterministic**: Two different agents reading the same handoff should produce similar output
- **Verifiable**: All acceptance criteria are binary pass/fail — no subjective judgments
- **Inline everything**: Contracts, design tokens, and styles are copied in — never "see Architecture doc"

## Quality Checklist

Before producing a task handoff, verify:

- [ ] Can an agent complete this task reading ONLY this document?
- [ ] Are all file paths concrete (no placeholders like "appropriate directory")?
- [ ] Are all interfaces/contracts fully defined (not "TBD")?
- [ ] Is every acceptance criterion binary (yes/no, pass/fail)?
- [ ] Are there zero references to external planning documents?
- [ ] Are design tokens actual values, not "see design system"?
- [ ] Is the task scope achievable in a single agent session?

## Skill Discovery and Assignment
> **Note:** `{orch_root}` is your orchestration root folder — `.github` by default. Set via `system.orch_root` in `orchestration.yml`.

- Enumerate `{orch_root}/skills/` folder names. For each skill, read the `description` field from its `SKILL.md` frontmatter. 
- Evaluate each skill against this task's objective and implementation steps using the lens: "would a coder working on this task benefit from invoking this skill?" 
- Select only skills with a direct functional match. Populate the `skills` frontmatter field with the selected skill folder names. 
- Technology or framework names (e.g., "TypeScript", "React") are NOT valid values — only `{orch_root}/skills/` folder names.

## Template

Use the bundled template: [TASK-HANDOFF.md](./templates/TASK-HANDOFF.md)
