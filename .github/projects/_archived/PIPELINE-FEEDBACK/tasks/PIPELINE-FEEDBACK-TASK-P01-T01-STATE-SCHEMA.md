---
project: "PIPELINE-FEEDBACK"
phase: 1
task: 1
title: "Update state-json-schema.md to v2"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update state-json-schema.md to v2

## Objective

Modify `plan/schemas/state-json-schema.md` to add six new review-tracking fields (three per task entry, three per phase entry), bump the schema version to v2, add validation rules for triage invariants and backward compatibility, and update the Orchestrator pseudocode with gatekeep check placeholders.

## Context

The orchestration system is adding a review feedback loop. The state schema must be extended so the Tactical Planner can record review document paths and triage outcomes, and the Orchestrator can perform mechanical gatekeep checks using field-level comparisons. All changes are additive — no existing content is removed. The schema version bumps from v1 to v2. Absent fields are treated as `null` for backward compatibility with legacy state files.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `plan/schemas/state-json-schema.md` | Add 6 fields, bump version, add field reference entries, add validation rules, update pseudocode |

## Implementation Steps

1. **Bump schema version**: In the root JSON block under `## Schema`, change `"$schema": "orchestration-state-v1"` to `"$schema": "orchestration-state-v2"`.

2. **Add 3 fields to the task entry JSON block**: In the `execution.phases[].tasks[]` object within the Schema JSON block, add these three fields after `"severity": null`:
   ```json
   "review_doc": null,
   "review_verdict": null,
   "review_action": null
   ```

3. **Add 3 fields to the phase entry JSON block**: In the `execution.phases[]` object within the Schema JSON block, add these three fields after `"human_approved": false`:
   ```json
   "phase_review": null,
   "phase_review_verdict": null,
   "phase_review_action": null
   ```

4. **Add Field Reference entries for task-level fields**: In the `## Field Reference` section, under the `### execution.phases[].tasks[]` subsection, append documentation for the three new task fields. Use the exact field definitions from the Contracts section below.

5. **Add Field Reference entries for phase-level fields**: In the `## Field Reference` section, under the `### execution.phases[]` subsection (or create it if needed after the tasks subsection), append documentation for the three new phase fields. Use the exact field definitions from the Contracts section below.

6. **Add Validation Rule 8** (task-level triage invariant): Append to the `## Validation Rules` numbered list.

7. **Add Validation Rule 9** (phase-level triage invariant): Append to the `## Validation Rules` numbered list.

8. **Add Validation Rule 10** (backward compatibility null-treatment): Append to the `## Validation Rules` numbered list.

9. **Update pseudocode**: In the `## State Transitions` section's pseudocode block, insert a gatekeep check after the `task.status == "complete"` branch and after the phase completion branch.

10. **Verify all changes are additive**: Confirm no existing fields, rules, or pseudocode lines were removed or replaced.

## Contracts & Interfaces

### Task Entry — Updated JSON Block

The complete task entry object after modification (the Coder should match this structure in the Schema JSON block):

```json
{
  "task_number": 1,
  "title": "Task Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "handoff_doc": "tasks/PROJECT-TASK-P01-T01-TITLE.md",
  "report_doc": null,
  "retries": 0,
  "last_error": null,
  "severity": null,
  "review_doc": null,
  "review_verdict": null,
  "review_action": null
}
```

### Task Entry — New Field Definitions

| Field | Type | Written When | Enum Values |
|-------|------|-------------|-------------|
| `review_doc` | `string \| null` | Planner Mode 2 — after Reviewer saves the Code Review | Relative path string (e.g., `reports/CODE-REVIEW-P01-T01.md`) or `null` |
| `review_verdict` | `string \| null` | Planner Mode 4 triage — transcribed verbatim from review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `review_action` | `string \| null` | Planner Mode 4 triage — Planner's resolved decision after applying decision table | `"advanced"` \| `"corrective_task_issued"` \| `"halted"` \| `null` |

### Task Entry — Triage Invariant

```
task.review_doc != null AND task.review_verdict == null  →  triage was skipped
```

Used by the Orchestrator gatekeep. If this condition is true, the Orchestrator re-spawns the Tactical Planner to complete triage.

---

### Phase Entry — Updated JSON Block

The complete phase entry object after modification (the Coder should match this structure in the Schema JSON block):

```json
{
  "phase_number": 1,
  "title": "Phase Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "phase_doc": "phases/PROJECT-PHASE-01-TITLE.md",
  "current_task": 0,
  "total_tasks": 0,
  "tasks": [],
  "phase_report": null,
  "human_approved": false,
  "phase_review": null,
  "phase_review_verdict": null,
  "phase_review_action": null
}
```

### Phase Entry — New Field Definitions

| Field | Type | Written When | Enum Values |
|-------|------|-------------|-------------|
| `phase_review` | `string \| null` | Planner Mode 2 — after Reviewer saves the Phase Review | Relative path string (e.g., `reports/PHASE-REVIEW-P01.md`) or `null` |
| `phase_review_verdict` | `string \| null` | Planner Mode 3 triage — transcribed verbatim from review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `phase_review_action` | `string \| null` | Planner Mode 3 triage — Planner's resolved decision after applying decision table | `"advanced"` \| `"corrective_tasks_issued"` \| `"halted"` \| `null` |

> **IMPORTANT:** Phase action uses `"corrective_tasks_issued"` (plural) vs task action `"corrective_task_issued"` (singular). Do NOT normalize these — they are intentionally different.

### Phase Entry — Triage Invariant

```
phase.phase_review != null AND phase.phase_review_verdict == null  →  phase triage was skipped
```

Used by the Orchestrator gatekeep. If this condition is true, the Orchestrator re-spawns the Tactical Planner to complete phase triage.

---

### Validation Rules to Append

Append these three rules to the existing numbered list (currently ends at rule 7):

**Rule 8 — Task-level triage invariant:**
```
task.review_doc != null AND task.review_verdict == null → triage was skipped
```
If this invariant is true, the Orchestrator must re-spawn the Tactical Planner (Mode 4) with an explicit triage instruction including the review document path and task/phase numbers.

**Rule 9 — Phase-level triage invariant:**
```
phase.phase_review != null AND phase.phase_review_verdict == null → phase triage was skipped
```
If this invariant is true, the Orchestrator must re-spawn the Tactical Planner (Mode 3) with an explicit phase triage instruction including the phase review path and phase number.

**Rule 10 — Backward compatibility (null-treatment):**
Absent fields are treated as `null`. The invariant `null != null` evaluates to `false`, so legacy state files (v1 schema without the new fields) never trigger the gatekeep check. No migration tooling is required.

---

### Pseudocode — Gatekeep Additions

Insert this block into the existing pseudocode **after** the `if task.status == "complete"` branch (after `→ spawn Reviewer` and before `→ advance to next task`):

```
    if task.status == "complete":
      → spawn Tactical Planner to create task handoff (if not exists)
      → spawn Coder to execute task
      → spawn Reviewer
      → spawn Tactical Planner to update state (records review_doc)
      → GATEKEEP: if task.review_doc != null AND task.review_verdict == null:
          → re-spawn Tactical Planner (Mode 4) with triage instruction
      → advance to next task
```

Insert this block into the existing pseudocode **after** the phase completion branch (after `→ spawn Reviewer for phase review`):

```
  if all tasks complete:
    → spawn Reviewer for phase review
    → spawn Tactical Planner to update state (records phase_review)
    → GATEKEEP: if phase.phase_review != null AND phase.phase_review_verdict == null:
        → re-spawn Tactical Planner (Mode 3) with phase triage instruction
    → if human_gate_mode == "phase": wait for human
    → advance to next phase
```

## Styles & Design Tokens

Not applicable — this is a schema documentation file with no UI components.

## Test Requirements

- [ ] The `$schema` field in the root JSON block reads `"orchestration-state-v2"` (not v1)
- [ ] The task entry JSON block contains exactly 3 new fields: `review_doc`, `review_verdict`, `review_action` — all with `null` as their default value
- [ ] The phase entry JSON block contains exactly 3 new fields: `phase_review`, `phase_review_verdict`, `phase_review_action` — all with `null` as their default value
- [ ] All 6 new fields appear in the Field Reference section with: type (`string | null`), written-when description, and enum values
- [ ] The `review_action` enum values are: `"advanced"`, `"corrective_task_issued"`, `"halted"` (singular "task")
- [ ] The `phase_review_action` enum values are: `"advanced"`, `"corrective_tasks_issued"`, `"halted"` (plural "tasks")
- [ ] Validation Rules 8, 9, and 10 are present and correctly describe the invariants
- [ ] The pseudocode contains the task-level gatekeep placeholder with `GATEKEEP:` keyword
- [ ] The pseudocode contains the phase-level gatekeep placeholder with `GATEKEEP:` keyword
- [ ] All existing content (fields, rules 1–7, original pseudocode logic) is preserved — nothing removed

## Acceptance Criteria

- [ ] `$schema` value is `"orchestration-state-v2"`
- [ ] Task entry JSON block has `review_doc`, `review_verdict`, `review_action` fields
- [ ] Phase entry JSON block has `phase_review`, `phase_review_verdict`, `phase_review_action` fields
- [ ] All 6 fields appear in Field Reference with type, written-when, and enum values
- [ ] Validation Rules section has rules 8, 9, 10 (invariants + backward compat)
- [ ] Pseudocode updated with gatekeep placeholder
- [ ] No existing content is removed — all changes are additive

## Constraints

- Do NOT modify any file other than `plan/schemas/state-json-schema.md`
- Do NOT remove existing fields, rules, or pseudocode — all changes are additive (append or insert)
- Do NOT replace existing pseudocode lines — insert new lines at the specified locations
- Do NOT normalize the plural/singular difference between `"corrective_task_issued"` (task) and `"corrective_tasks_issued"` (phase) — they are intentionally different
- Do NOT add migration tooling, scripts, or automated conversion utilities
- Do NOT change the existing field order for pre-existing fields
