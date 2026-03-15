---
project: "PIPELINE-FEEDBACK"
phase: 4
task: 3
title: "Backward Compatibility Validation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Backward Compatibility Validation

## Objective

Create `tests/backward-compat.test.js` with tests that validate legacy `state.json` files (v1 schema, all six new fields absent) work correctly with the updated pipeline — absent fields are treated as `null`, gatekeep invariants evaluate to `false`, and no errors are thrown.

## Context

The orchestration system's state schema was bumped from `orchestration-state-v1` to `orchestration-state-v2`. Six new fields were added: three per task (`review_doc`, `review_verdict`, `review_action`) and three per phase (`phase_review`, `phase_review_verdict`, `phase_review_action`). Legacy v1 state files lack these fields entirely. The backward compatibility policy states that absent fields are treated as `null`, and the gatekeep invariant `null != null` evaluates to `false` — so legacy files never trigger spurious re-spawns. Tests must verify this contract.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/backward-compat.test.js` | Backward compatibility test file — 7 test scenarios |

## Implementation Steps

1. **Set up the test file** using `node:test` (`describe`, `it`) and `node:assert` — matching conventions in `tests/config.test.js` and `tests/agents.test.js`. Use `'use strict';` at the top. Import `fs` and `path` for reading the schema file.

2. **Create a legacy v1 state.json fixture** as an inline JS object. The fixture must:
   - Have `"$schema": "orchestration-state-v1"` at the root
   - Contain at least one phase entry with tasks
   - Task entries must NOT contain `review_doc`, `review_verdict`, or `review_action`
   - Phase entries must NOT contain `phase_review`, `phase_review_verdict`, or `phase_review_action`
   - All other standard fields (`task_number`, `title`, `status`, `handoff_doc`, `report_doc`, `retries`, `last_error`, `severity`) must be present with valid values
   - Use the exact fixture defined in the **Legacy v1 Fixture** section below

3. **Implement test: absent fields treated as null**. Access each of the 6 absent fields on the fixture's task and phase entries. Verify:
   - Direct access (`task.review_doc`) returns `undefined`
   - Nullish coalescing (`task.review_doc ?? null`) yields `null`
   - Repeat for all 6 fields (3 task-level, 3 phase-level)

4. **Implement test: task-level invariant safety**. For the legacy task entry, evaluate the gatekeep invariant expression:
   ```javascript
   const reviewDoc = task.review_doc ?? null;
   const reviewVerdict = task.review_verdict ?? null;
   const invariant = reviewDoc !== null && reviewVerdict === null;
   assert.strictEqual(invariant, false);
   ```
   This proves that when both fields are absent (both treated as `null`), the invariant `null !== null` is `false` — legacy tasks never trigger a re-spawn.

5. **Implement test: phase-level invariant safety**. Same logic for phase entries:
   ```javascript
   const phaseReview = phase.phase_review ?? null;
   const phaseReviewVerdict = phase.phase_review_verdict ?? null;
   const invariant = phaseReview !== null && phaseReviewVerdict === null;
   assert.strictEqual(invariant, false);
   ```

6. **Implement test: schema version detection**. Read the state schema file at `plan/schemas/state-json-schema.md`. Verify:
   - The file contains the string `"orchestration-state-v2"` (current version)
   - The file documents backward compatibility: contains `"orchestration-state-v1"` reference as legacy
   - The file contains the text `Absent fields are treated as` or `Absent fields` (null-treatment policy is documented)

7. **Implement test: no field-not-found errors**. Access all 6 absent fields on the legacy fixture using both direct property access and optional chaining. Wrap in a function and verify it does NOT throw:
   ```javascript
   assert.doesNotThrow(() => {
     const t = legacyState.execution.phases[0].tasks[0];
     const p = legacyState.execution.phases[0];
     // Direct access — returns undefined, not an error
     void t.review_doc;
     void t.review_verdict;
     void t.review_action;
     void p.phase_review;
     void p.phase_review_verdict;
     void p.phase_review_action;
     // Optional chaining
     void t?.review_doc;
     void p?.phase_review_verdict;
   });
   ```

8. **Implement test: null-treatment table completeness**. Read the state schema file. Verify all 6 field names appear in the document as part of the null-treatment / backward compatibility documentation:
   - `review_doc`
   - `review_verdict`
   - `review_action`
   - `phase_review` (as a distinct field, not just a substring of the other two)
   - `phase_review_verdict`
   - `phase_review_action`

## Contracts & Interfaces

### Legacy v1 Fixture

Use this exact inline JS object as the legacy state.json fixture:

```javascript
const legacyState = {
  "$schema": "orchestration-state-v1",
  "project": {
    "name": "LEGACY-PROJECT",
    "created": "2025-06-01T00:00:00Z",
    "updated": "2025-06-15T12:00:00Z"
  },
  "pipeline": {
    "current_tier": "execution",
    "human_gate_mode": "autonomous"
  },
  "planning": {
    "status": "complete",
    "steps": {
      "research":     { "status": "complete", "output": "LEGACY-PROJECT-RESEARCH-FINDINGS.md" },
      "prd":          { "status": "complete", "output": "LEGACY-PROJECT-PRD.md" },
      "design":       { "status": "skipped",  "output": null },
      "architecture": { "status": "complete", "output": "LEGACY-PROJECT-ARCHITECTURE.md" },
      "master_plan":  { "status": "complete", "output": "LEGACY-PROJECT-MASTER-PLAN.md" }
    },
    "human_approved": true
  },
  "execution": {
    "status": "in_progress",
    "current_phase": 0,
    "total_phases": 1,
    "phases": [
      {
        "phase_number": 1,
        "title": "Core Implementation",
        "status": "in_progress",
        "phase_doc": "phases/LEGACY-PROJECT-PHASE-01-CORE.md",
        "current_task": 1,
        "total_tasks": 2,
        "tasks": [
          {
            "task_number": 1,
            "title": "Setup project structure",
            "status": "complete",
            "handoff_doc": "tasks/LEGACY-PROJECT-TASK-P01-T01-SETUP.md",
            "report_doc": "reports/LEGACY-PROJECT-TASK-REPORT-P01-T01.md",
            "retries": 0,
            "last_error": null,
            "severity": null
          },
          {
            "task_number": 2,
            "title": "Implement API layer",
            "status": "in_progress",
            "handoff_doc": "tasks/LEGACY-PROJECT-TASK-P01-T02-API.md",
            "report_doc": null,
            "retries": 0,
            "last_error": null,
            "severity": null
          }
        ],
        "phase_report": null,
        "human_approved": false
      }
    ]
  },
  "final_review": {
    "status": "not_started",
    "report_doc": null,
    "human_approved": false
  },
  "errors": {
    "total_retries": 0,
    "total_halts": 0,
    "active_blockers": []
  },
  "limits": {
    "max_phases": 10,
    "max_tasks_per_phase": 8,
    "max_retries_per_task": 2
  }
};
```

**Key properties of this fixture:**
- `$schema` is `"orchestration-state-v1"` — identifies it as a legacy file
- Task entries have all standard fields (`task_number`, `title`, `status`, `handoff_doc`, `report_doc`, `retries`, `last_error`, `severity`) but DO NOT have `review_doc`, `review_verdict`, or `review_action`
- Phase entry has all standard fields (`phase_number`, `title`, `status`, `phase_doc`, `current_task`, `total_tasks`, `tasks`, `phase_report`, `human_approved`) but DOES NOT have `phase_review`, `phase_review_verdict`, or `phase_review_action`

### Six New v2 Fields (Must Be Absent in Legacy Fixture)

| Level | Field | Type When Present | Default When Absent |
|-------|-------|-------------------|---------------------|
| Task | `review_doc` | `string \| null` | treated as `null` |
| Task | `review_verdict` | `"approved" \| "changes_requested" \| "rejected" \| null` | treated as `null` |
| Task | `review_action` | `"advanced" \| "corrective_task_issued" \| "halted" \| null` | treated as `null` |
| Phase | `phase_review` | `string \| null` | treated as `null` |
| Phase | `phase_review_verdict` | `"approved" \| "changes_requested" \| "rejected" \| null` | treated as `null` |
| Phase | `phase_review_action` | `"advanced" \| "corrective_tasks_issued" \| "halted" \| null` | treated as `null` |

### Gatekeep Invariant Expressions

These are the exact expressions the Orchestrator uses. Tests must evaluate them against the legacy fixture and assert `false`.

**Task-level:**
```javascript
// From orchestrator.agent.md — task-level gatekeep
const reviewDoc = task.review_doc ?? null;     // absent → undefined ?? null → null
const reviewVerdict = task.review_verdict ?? null; // absent → undefined ?? null → null
const invariantFired = (reviewDoc !== null) && (reviewVerdict === null);
// null !== null → false → short-circuit → invariantFired = false
```

**Phase-level:**
```javascript
// From orchestrator.agent.md — phase-level gatekeep
const phaseReview = phase.phase_review ?? null;           // absent → null
const phaseReviewVerdict = phase.phase_review_verdict ?? null; // absent → null
const invariantFired = (phaseReview !== null) && (phaseReviewVerdict === null);
// null !== null → false → short-circuit → invariantFired = false
```

### Schema File Path

| File | Relative Path | Purpose |
|------|--------------|---------|
| State schema | `plan/schemas/state-json-schema.md` | Canonical schema definition; must document v2 version and null-treatment policy |

## Styles & Design Tokens

Not applicable — this is a test file, not a UI component.

## Test Requirements

Group all tests under `describe('Backward compatibility — legacy v1 state.json')`. Each scenario is a separate `it()` block.

- [ ] Legacy v1 fixture is a valid JS object with `$schema: "orchestration-state-v1"`
- [ ] Absent task fields (`review_doc`, `review_verdict`, `review_action`) return `undefined` on direct access and `null` via nullish coalescing
- [ ] Absent phase fields (`phase_review`, `phase_review_verdict`, `phase_review_action`) return `undefined` on direct access and `null` via nullish coalescing
- [ ] Task-level gatekeep invariant evaluates to `false` for legacy task entries
- [ ] Phase-level gatekeep invariant evaluates to `false` for legacy phase entries
- [ ] State schema file contains `"orchestration-state-v2"` as the current version
- [ ] State schema file references `"orchestration-state-v1"` as legacy
- [ ] Accessing all 6 absent fields on legacy fixture does not throw
- [ ] State schema documents null-treatment for all 6 fields

## Acceptance Criteria

- [ ] File exists at `tests/backward-compat.test.js`
- [ ] Tests use a legacy v1 state.json fixture (task entries without the 6 new fields)
- [ ] Tests verify absent fields are treated as null (undefined → null via `??`)
- [ ] Tests verify task-level gatekeep invariant is `false` for legacy state (`null !== null` = `false`)
- [ ] Tests verify phase-level gatekeep invariant is `false` for legacy state
- [ ] Tests verify state schema version is documented as `"orchestration-state-v2"`
- [ ] Tests verify no field-not-found errors when accessing absent fields
- [ ] Tests verify null-treatment is documented for all 6 fields in the schema
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any existing files — this task creates one new test file only
- Do NOT import or require any project-specific modules — tests operate on inline fixtures and read Markdown files via `fs`
- Do NOT use external test frameworks (Jest, Mocha, etc.) — use only `node:test` and `node:assert`
- Do NOT test triage decision table logic — that is T2's scope
- Do NOT test the full integration feedback loop — that is T1's scope
- Test file must be runnable standalone: `node --test tests/backward-compat.test.js`
