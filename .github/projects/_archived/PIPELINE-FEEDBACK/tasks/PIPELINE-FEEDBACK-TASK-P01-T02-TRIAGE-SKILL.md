---
project: "PIPELINE-FEEDBACK"
phase: 1
task: 2
title: "Create triage-report/SKILL.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Create triage-report/SKILL.md

## Objective

Create the complete `triage-report` skill file at `.github/skills/triage-report/SKILL.md` containing exhaustive decision tables for task-level and phase-level triage, read sequences for both Mode 3 and Mode 4 contexts, the state write contract with verbatim transcription rule, and error handling specifications.

## Context

The orchestration system is adding a review feedback loop. The Tactical Planner needs a triage skill that encodes every possible combination of task report status, deviations, and review verdict into a deterministic action. This skill is embedded within the Planner's Mode 3 (phase planning) and Mode 4 (task handoff) — it is never invoked standalone. The skill produces no output document; it writes verdict/action fields directly to `state.json`. An existing skill file at `.github/skills/review-code/SKILL.md` demonstrates the expected format and frontmatter conventions.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/skills/triage-report/SKILL.md` | New file — complete triage skill with decision tables |

## Implementation Steps

1. **Create the directory** `.github/skills/triage-report/` if it does not exist.

2. **Write the skill frontmatter** at the top of the file using this exact YAML block:
   ```yaml
   ---
   name: triage-report
   description: >-
     Triage task reports and review documents to determine the Planner's next action.
     Embedded within Tactical Planner Mode 3 (phase-level) and Mode 4 (task-level) —
     never invoked standalone. Produces updated state.json fields (no separate document).
   ---
   ```

3. **Write the skill header section** with: skill name, invocation context (embedded in Mode 3 and Mode 4 only — never standalone), and a note that the skill produces no output document — the decision tables ARE the deliverable. Use the exact content from the "Skill Header Content" contract below.

4. **Write the Mode 4 Read Sequence (Task-Level Triage)** section. Use the exact content from the "Mode 4 Read Sequence Contract" below.

5. **Write the Task-Level Decision Table** section with exactly 11 rows. Copy the table verbatim from the "Task-Level Decision Table Contract" below. Include the Row 10 and Row 1/Row 7 clarification notes.

6. **Write the Mode 3 Read Sequence (Phase-Level Triage)** section. Use the exact content from the "Mode 3 Read Sequence Contract" below.

7. **Write the Phase-Level Decision Table** section with exactly 5 rows. Copy the table verbatim from the "Phase-Level Decision Table Contract" below.

8. **Write the State Write Contract** section. Use the exact content from the "State Write Contract" below, including the verbatim transcription rule, write ordering rule, and immutability rule.

9. **Write the Error Handling** section. Use the exact content from the "Error Handling Contract" below.

10. **Verify the file** matches the acceptance criteria: 11 task rows, 5 phase rows, no "use judgment" language, all contracts inlined.

## Contracts & Interfaces

### Skill Header Content

The body of the skill file (after frontmatter) must begin with:

```markdown
# Triage Report

Triage task reports and review documents to determine the Tactical Planner's next action. This skill encodes exhaustive, deterministic decision tables — every input combination maps to exactly one action. No row requires judgment.

## Invocation Context

- **Embedded step** within Tactical Planner Mode 3 (phase-level triage) and Mode 4 (task-level triage) only
- **Never invoked standalone** — the Planner executes this skill inline during planning
- **Produces no output document** — triage writes verdict/action fields to `state.json`; the decision tables themselves are the deliverable
```

### Mode 4 Read Sequence Contract

```markdown
## Mode 4 — Task-Level Triage Read Sequence

Execute this read sequence when the Tactical Planner is in Mode 4 (Create Task Handoff), after reading the Phase Plan and Architecture but before producing the Task Handoff document.

| Step | Condition | Read | Source Path |
|------|-----------|------|-------------|
| 1 | ALWAYS | Task Report | `state.json → execution.phases[N].tasks[M].report_doc` |
| 2 | ONLY IF `task.review_doc` is non-null | Code Review | `state.json → execution.phases[N].tasks[M].review_doc` |

- If step 2 is skipped (no review doc), both `review_verdict` and `review_action` remain `null` — do not write them.
- If step 2 is attempted but the file at the path cannot be read, report error and halt (see Error Handling).
```

### Task-Level Decision Table Contract

This is the complete 11-row table. Every row maps to exactly one `review_action` value. No row uses "use judgment" language.

```markdown
## Task-Level Decision Table

The Planner applies this table after completing the Mode 4 read sequence. Match the first row whose conditions are satisfied.

| # | Task Report Status | Has Deviations? | Code Review Verdict | `review_verdict` Written | `review_action` Written | Planner Next Action |
|---|---|---|---|---|---|---|
| 1 | `complete` | No | `null` (no review yet) | *(skip — no review doc)* | *(skip — no review doc)* | Create next task handoff; carry any Recommendations from report into context |
| 2 | `complete` | No | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff normally |
| 3 | `complete` | Yes — minor | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff; surface minor deviations in context section |
| 4 | `complete` | Yes — architectural | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff; include architectural deviation as carry-forward item |
| 5 | `complete` | Any | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Create corrective task handoff; inline specific issues from review Issues table |
| 6 | `complete` | Any | `"rejected"` | `"rejected"` | `"halted"` | Write halt to state.json; do NOT produce a handoff; signal Orchestrator to halt pipeline |
| 7 | `partial` | — | `null` (no review yet) | *(skip — no review doc)* | *(skip — no review doc)* | Assess severity: if minor issues → create corrective handoff; if blocking → halt |
| 8 | `partial` | — | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Create corrective handoff; merge partial-completion issues AND review issues into single handoff |
| 9 | `partial` | — | `"rejected"` | `"rejected"` | `"halted"` | Write halt to state.json; signal Orchestrator to halt |
| 10 | `failed` | — | Any or `null` | *(record if review doc exists)* | See note | If `retries < max_retries` AND `severity == "minor"` → `"corrective_task_issued"`; else → `"halted"` |
| 11 | `failed` | — | Any or `null` — critical severity | *(record if review doc exists)* | `"halted"` | Halt immediately regardless of retry budget |

### Row Clarifications

**Row 10 — failed task, non-critical severity:**
For a `failed` task with an existing review doc, write the `review_verdict` (transcribed verbatim from the review frontmatter), then apply the retry-budget check to determine `review_action`:
- If `task.retries < limits.max_retries_per_task` AND `task.severity == "minor"` → write `review_action` = `"corrective_task_issued"`
- Otherwise → write `review_action` = `"halted"`
- Critical severity always results in `"halted"` regardless of retry budget (see Row 11)

**Row 11 — failed task, critical severity:**
Critical severity means immediate halt. Do not check retry budget. Write `review_action` = `"halted"` unconditionally.

**Row 1 / Row 7 — no review doc:**
When `task.review_doc` is `null` (no Code Review exists yet), skip the verdict/action write entirely — both fields remain `null`. This is NOT a gatekeep violation because the Orchestrator's invariant requires `review_doc != null` to trigger: `review_doc != null AND review_verdict == null`. When `review_doc` is `null`, the first condition is false and the invariant is not triggered.
```

### Mode 3 Read Sequence Contract

```markdown
## Mode 3 — Phase-Level Triage Read Sequence

Execute this read sequence when the Tactical Planner is in Mode 3 (Create Phase Plan), after reading the Master Plan and Architecture but before producing the Phase Plan document.

| Step | Condition | Read | Source Path |
|------|-----------|------|-------------|
| 1 | ALWAYS (skip if first phase) | Phase Report | `state.json → execution.phases[N].phase_report` |
| 2 | ONLY IF `phase.phase_review` is non-null | Phase Review | `state.json → execution.phases[N].phase_review` |

- If step 1 is skipped (first phase — no previous Phase Report), proceed directly to Phase Plan creation without triage.
- If step 2 is skipped (no phase review doc), both `phase_review_verdict` and `phase_review_action` remain `null` — do not write them.
- If step 2 is attempted but the file at the path cannot be read, report error and halt (see Error Handling).
```

### Phase-Level Decision Table Contract

This is the complete 5-row table. Every row maps to exactly one `phase_review_action` value.

```markdown
## Phase-Level Decision Table

The Planner applies this table after completing the Mode 3 read sequence. Match the first row whose conditions are satisfied.

| # | Phase Review Verdict | Exit Criteria Assessment | `phase_review_verdict` Written | `phase_review_action` Written | Planner Next Action |
|---|---|---|---|---|---|
| 1 | `null` (no phase review yet) | — | *(skip — no review doc)* | *(skip — no review doc)* | Skip phase triage; proceed with phase planning using Phase Report only |
| 2 | `"approved"` | All exit criteria met | `"approved"` | `"advanced"` | Proceed to plan next phase normally |
| 3 | `"approved"` | Some exit criteria unmet | `"approved"` | `"advanced"` | Plan next phase; surface unmet criteria as explicit carry-forward tasks in Phase Plan |
| 4 | `"changes_requested"` | — | `"changes_requested"` | `"corrective_tasks_issued"` | Create corrective task(s) targeting integration issues from review; include review's Cross-Task Issues table in handoff context |
| 5 | `"rejected"` | — | `"rejected"` | `"halted"` | Write halt to state.json; do NOT produce a Phase Plan; signal Orchestrator to halt pipeline |

> **Note:** `phase_review_action` uses `"corrective_tasks_issued"` (plural) — a phase review can result in multiple corrective tasks. This is intentionally different from task-level `review_action` which uses `"corrective_task_issued"` (singular). Do NOT normalize these values.
```

### State Write Contract

```markdown
## State Write Contract

The Tactical Planner is the **sole writer** of all triage fields in `state.json`. No other agent may write these fields.

### Task-Level Fields

After executing the task-level decision table, write to `state.json → execution.phases[N].tasks[M]`:

| Field | Value Source | Allowed Values |
|-------|-------------|----------------|
| `review_verdict` | Verbatim from Code Review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `review_action` | Resolved from task-level decision table | `"advanced"` \| `"corrective_task_issued"` \| `"halted"` \| `null` |

### Phase-Level Fields

After executing the phase-level decision table, write to `state.json → execution.phases[N]`:

| Field | Value Source | Allowed Values |
|-------|-------------|----------------|
| `phase_review_verdict` | Verbatim from Phase Review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `phase_review_action` | Resolved from phase-level decision table | `"advanced"` \| `"corrective_tasks_issued"` \| `"halted"` \| `null` |

### Verbatim Transcription Rule

`review_verdict` and `phase_review_verdict` values MUST be copied exactly from the Reviewer's frontmatter `verdict` field. The allowed values are:
- `"approved"`
- `"changes_requested"`
- `"rejected"`

**No casing normalization.** Do not convert to uppercase, lowercase, or title case.
**No mapping.** Do not translate verdict values (e.g., do not map `"changes_requested"` to `"needs_changes"`).
**No invention.** If the frontmatter `verdict` field contains a value not in the allowed set, report an error and halt (see Error Handling).

### Write Ordering

Verdict and action fields MUST be written to `state.json` BEFORE `task.handoff_doc` (when creating a task handoff) or before the Phase Plan entry (when creating a phase plan). The Planner must never write `handoff_doc` without first writing `review_verdict` and `review_action` when `review_doc` is non-null.

Correct order:
1. Write `review_verdict` and `review_action` (or `phase_review_verdict` and `phase_review_action`)
2. Write `handoff_doc` (or create Phase Plan entry)

### Immutability

Once written, verdict and action fields for a specific task or phase MUST NOT be overwritten by triage of a different task or phase. Each task's triage fields are indexed by `task_number` — the Planner writes to the specific task entry matching the task being triaged. Each phase's triage fields are indexed by `phase_number`.
```

### Error Handling Contract

```markdown
## Error Handling

### Review Document Not Found

If the review document at the path stored in `state.json` cannot be read (file does not exist or is unreadable):
- Report error: `"review document not found at '{path}'"`
- Write the error to `state.json → errors.active_blockers`
- Halt the pipeline — do NOT skip triage silently
- Do NOT write verdict/action fields — leave them as `null`

### Invalid Verdict Value

If the `verdict` field in the review document's frontmatter contains a value not in the allowed enum set (`"approved"`, `"changes_requested"`, `"rejected"`):
- Report error: `"invalid verdict value '{value}' in review frontmatter at '{path}' — allowed values: approved, changes_requested, rejected"`
- Write the error to `state.json → errors.active_blockers`
- Halt the pipeline — do NOT proceed with triage
- Do NOT write verdict/action fields — leave them as `null`
```

## Styles & Design Tokens

Not applicable — this is an instruction/skill file with no UI components.

## Test Requirements

- [ ] File exists at `.github/skills/triage-report/SKILL.md`
- [ ] File begins with valid YAML frontmatter containing `name: triage-report` and a `description` field
- [ ] Task-level decision table contains exactly 11 numbered rows (# column: 1 through 11)
- [ ] Every task-level row has exactly one `review_action` value — no "use judgment" or discretionary language
- [ ] Phase-level decision table contains exactly 5 numbered rows (# column: 1 through 5)
- [ ] Every phase-level row has exactly one `phase_review_action` value — no "use judgment" or discretionary language
- [ ] Mode 4 read sequence section is present with ALWAYS/CONDITIONAL steps
- [ ] Mode 3 read sequence section is present with ALWAYS/CONDITIONAL steps
- [ ] State write contract section specifies verbatim transcription rule
- [ ] State write contract section specifies write ordering (verdict/action before handoff_doc)
- [ ] State write contract section specifies immutability rule
- [ ] Error handling section covers "review document not found" case
- [ ] Error handling section covers "invalid verdict value" case
- [ ] `phase_review_action` uses `"corrective_tasks_issued"` (plural) — not normalized to singular
- [ ] `review_action` uses `"corrective_task_issued"` (singular) — not normalized to plural

## Acceptance Criteria

- [ ] File exists at `.github/skills/triage-report/SKILL.md`
- [ ] Has proper skill frontmatter (`name: triage-report`, `description`)
- [ ] Contains task-level decision table with exactly 11 rows
- [ ] All 11 rows have exactly one `review_action` value (no "use judgment" rows)
- [ ] Contains phase-level decision table with exactly 5 rows
- [ ] All 5 rows have exactly one `phase_review_action` value
- [ ] Documents Mode 4 read sequence (task-level triage)
- [ ] Documents Mode 3 read sequence (phase-level triage)
- [ ] Documents state write contract with verbatim transcription rule
- [ ] Documents write ordering (verdict/action before handoff_doc)
- [ ] Documents error handling for missing review docs and invalid verdict values
- [ ] Contains no "use judgment" or discretionary rows

## Constraints

- Do NOT create any other files — no `templates/` subdirectory, no `scripts/`, no `references/`
- The skill produces NO output document — the decision tables ARE the deliverable; do not add a template section
- Do NOT reference external documents (Architecture, PRD, etc.) in the skill body — all content is self-contained
- Do NOT normalize `"corrective_tasks_issued"` (plural, phase-level) to match `"corrective_task_issued"` (singular, task-level) — they are intentionally different
- Do NOT add rows beyond the 11 task-level and 5 phase-level rows specified
- Do NOT add "use judgment", "assess situation", or any discretionary language to any decision table row
- Follow the existing skill format: YAML frontmatter with `name` and `description`, then Markdown body (as demonstrated by `.github/skills/review-code/SKILL.md`)
