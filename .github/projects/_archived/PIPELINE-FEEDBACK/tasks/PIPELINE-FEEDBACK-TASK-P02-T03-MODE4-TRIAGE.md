---
project: "PIPELINE-FEEDBACK"
phase: 2
task: 3
title: "Update Tactical Planner Mode 4 (Create Task Handoff)"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Tactical Planner Mode 4 (Create Task Handoff)

## Objective

Insert triage steps into the Tactical Planner's Mode 4 read sequence (steps 5–6), add a decision routing table keyed on `review_action`, update the Corrective Task Handoff sub-section with a "subsumed by triage" note, and add `triage-report` to the Skills section. The final Mode 4 read sequence must have exactly 8 numbered steps.

## Context

The Tactical Planner agent file (`.github/agents/tactical-planner.agent.md`) has already been updated: Mode 2 gained two new write operations (T1) and Mode 3 gained triage steps 6–7 plus a decision routing table (T2). This task completes Phase 2 by applying the same triage pattern to Mode 4. The triage skill at `.github/skills/triage-report/SKILL.md` contains both task-level and phase-level decision tables — Mode 4 uses the task-level table. The `review_action` field uses singular `"corrective_task_issued"` (not plural) — this is intentionally distinct from the phase-level `"corrective_tasks_issued"`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/tactical-planner.agent.md` | Mode 4 section, Corrective Task Handoffs subsection, Skills section only |

## Implementation Steps

### A) Replace Mode 4 numbered list (steps 1–8) with the new 8-step sequence

Find the current Mode 4 numbered steps (from `1. **Read the Phase Plan**` through `8. **Update `state.json`**: Set task handoff_doc path`) and replace the entire block with:

```markdown
1. **Read the Phase Plan** — task outline, dependencies
2. **Read the Architecture** — contracts, interfaces, file structure
3. **Read the Design** — design tokens, component specs (if UI task)
4. **Read previous Task Report(s)** — for each dependent completed task: path from `state.json → task.report_doc`
5. **IF `state.json → task.review_doc != null`** (for the relevant completed task):
   Read the Code Review at the path from `state.json → task.review_doc`
6. **Execute `triage-report` skill** (task-level decision table):
   - Write `task.review_verdict` ← verdict from Code Review frontmatter (or skip if no review doc)
   - Write `task.review_action` ← resolved from task-level decision table (or skip if no review doc)

**Decision routing after triage (step 6→7):**

| `review_action` value | What to produce in step 7 |
|-----------------------|--------------------------|
| `"advanced"` | Normal Task Handoff for next task; include any carry-forward items in context section |
| `"corrective_task_issued"` | Corrective Task Handoff; inline all Issues from Code Review; include original acceptance criteria |
| `"halted"` | DO NOT produce a Task Handoff — write halt to state.json; stop |
| `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context section |

7. **PLAN**: Produce Task Handoff (or corrective handoff, or halt) based on triage outcome:
   - Write a self-contained handoff: Everything the Coder needs in ONE document
     - Objective (1-3 sentences)
     - Context (max 5 sentences — immediate technical context only)
     - File targets with exact paths and CREATE/MODIFY actions
     - Implementation steps (max 10, specific and actionable)
     - **Inline contracts** — copy exact interfaces from Architecture, do NOT reference it
     - **Inline design tokens** — copy actual values from Design, do NOT say "see design doc"
     - Test requirements (specific, verifiable)
     - Acceptance criteria (binary pass/fail)
     - Constraints (what NOT to do)
   - **Use the `create-task-handoff` skill** to produce the document
   - **Save** to `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md`
8. **Update `state.json`**: Set task `handoff_doc` path
```

**Exact text to find (current steps 1–8):**

```
1. **Read the Phase Plan** — task outline, dependencies
2. **Read the Architecture** — contracts, interfaces, file structure
3. **Read the Design** — design tokens, component specs (if UI task)
4. **Read previous Task Report** (if task has dependencies on completed tasks)
5. **Write a self-contained handoff**: Everything the Coder needs in ONE document
   - Objective (1-3 sentences)
   - Context (max 5 sentences — immediate technical context only)
   - File targets with exact paths and CREATE/MODIFY actions
   - Implementation steps (max 10, specific and actionable)
   - **Inline contracts** — copy exact interfaces from Architecture, do NOT reference it
   - **Inline design tokens** — copy actual values from Design, do NOT say "see design doc"
   - Test requirements (specific, verifiable)
   - Acceptance criteria (binary pass/fail)
   - Constraints (what NOT to do)
6. **Use the `create-task-handoff` skill** to produce the document
7. **Save** to `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md`
8. **Update `state.json`**: Set task handoff_doc path
```

### B) Add "subsumed by triage" note to Corrective Task Handoffs subsection

Find the Corrective Task Handoffs subsection. Immediately after the heading line `### Corrective Task Handoffs`, insert a blockquote note BEFORE the existing "When creating a corrective handoff…" paragraph.

**Current text:**

```
### Corrective Task Handoffs

When creating a corrective handoff after a review finds issues:
```

**Replace with:**

```
### Corrective Task Handoffs

> **NOTE:** The corrective handoff path is now subsumed by the triage step (step 6). When triage produces `review_action: "corrective_task_issued"`, the Planner follows these rules to construct the corrective handoff.

When creating a corrective handoff after a review finds issues:
```

Keep existing steps 1–6 exactly as they are.

### C) Add `triage-report` to the Skills section

Find the Skills section. After the last skill bullet, add a new bullet.

**Current text:**

```
## Skills

- **`create-phase-plan`**: Guides phase planning and provides template
- **`create-task-handoff`**: Guides task handoff creation and provides template
- **`generate-phase-report`**: Guides phase report generation and provides template
```

**Replace with:**

```
## Skills

- **`create-phase-plan`**: Guides phase planning and provides template
- **`create-task-handoff`**: Guides task handoff creation and provides template
- **`generate-phase-report`**: Guides phase report generation and provides template
- **`triage-report`**: Decision tables for task-level and phase-level triage — read sequences, verdict/action resolution, state write contract
```

## Contracts & Interfaces

Not applicable — this task modifies a Markdown agent instruction file, not source code.

## Styles & Design Tokens

Not applicable — no UI components.

## Test Requirements

- [ ] Run `npm test` (or equivalent) — all existing tests must pass (11/11)
- [ ] Build succeeds with no errors
- [ ] Verify Mode 4 has exactly 8 numbered steps by visual inspection
- [ ] Verify the decision routing table has exactly 4 rows (excluding header)
- [ ] Verify Mode 2, Mode 3, Mode 5, Output Contract, and Quality Standards sections are unchanged

## Acceptance Criteria

- [ ] Mode 4 has exactly 8 numbered steps
- [ ] Step 5 is a conditional Code Review read (only if `task.review_doc != null`)
- [ ] Step 6 executes the triage-report skill and writes `review_verdict` and `review_action` to state.json
- [ ] Decision routing table with 4 rows is present between steps 6 and 7
- [ ] Step 7 preserves the self-contained handoff quality requirements (inline contracts, inline design tokens, etc.)
- [ ] Corrective Task Handoffs subsection has the "subsumed by triage" note as a blockquote
- [ ] Skills section lists `triage-report` alongside existing skills
- [ ] No other sections of the file are modified (Mode 1, Mode 2, Mode 3, Mode 5, Output Contract, Quality Standards unchanged)
- [ ] All tests pass
- [ ] Build succeeds

## Constraints

- ONLY modify Mode 4, Corrective Task Handoffs subsection, and Skills section
- Do NOT touch Mode 1, Mode 2, Mode 3, or Mode 5
- Do NOT touch Output Contract or Quality Standards sections
- Preserve the heading `## Mode 4: Create Task Handoff`
- Use singular `"corrective_task_issued"` (not plural) in the decision routing table — this is the task-level action enum
- Keep self-contained handoff quality guidance in step 7 (inline contracts, inline design tokens, etc.)
