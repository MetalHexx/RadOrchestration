---
project: "PIPELINE-FEEDBACK"
phase: 4
task: 1
title: "Integration Tests — Full Feedback Loop"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Integration Tests — Full Feedback Loop

## Objective

Create `tests/integration-feedback-loop.test.js` with integration tests that validate the complete feedback loop across the Orchestrator gatekeep, Tactical Planner triage, and state.json field transitions. Tests validate file content and state-transition logic — they do NOT execute an actual LLM pipeline.

## Context

This orchestration system uses Markdown agent instruction files and a JSON state file. Phases 1–3 added six new fields to `state.json` (three per task, three per phase), a `triage-report` skill with decision tables, triage steps in the Tactical Planner (Modes 2–4), and gatekeep blocks in the Orchestrator. The tests must confirm that the gatekeep invariant logic is correct, that re-spawn limits are enforced in the instruction text, and that the state schema documents verdict/action field pairs consistently.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/integration-feedback-loop.test.js` | Integration test file — 8 test scenarios |

## Implementation Steps

1. **Set up the test file** using `node:test` (`describe`, `it`) and `node:assert` — this matches the convention in `tests/agents.test.js` and `tests/config.test.js`. Use `'use strict';` at the top.

2. **Read real workspace files in tests** using `fs.readFileSync` with `path.resolve(__dirname, '..')` as the workspace root. The tests validate the actual content of modified files — they are NOT unit tests of executable functions.

3. **Implement test scenario 1 — Happy path (task-level)**:
   - Construct a state object with a task entry where `review_doc = "reports/CODE-REVIEW-P01-T01.md"` AND `review_verdict = "approved"` AND `review_action = "advanced"`.
   - Evaluate the invariant: `task.review_doc != null AND task.review_verdict == null`.
   - Assert the invariant evaluates to `false` (triage was completed — no re-spawn needed).

4. **Implement test scenario 2 — Unhappy path (task-level triage skipped)**:
   - Construct a state object with a task entry where `review_doc = "reports/CODE-REVIEW-P01-T01.md"` AND `review_verdict = null` AND `review_action = null`.
   - Evaluate the invariant: `task.review_doc != null AND task.review_verdict == null`.
   - Assert the invariant evaluates to `true` (triage was skipped — re-spawn needed).
   - Read the Orchestrator agent file at `.github/agents/orchestrator.agent.md`.
   - Assert the file contains the re-spawn instruction template text: `"Triage is incomplete. Task"` AND `"review_verdict is null"` AND `"execute the triage decision table"`.

5. **Implement test scenario 3 — Re-spawn limit (task-level)**:
   - Read the Orchestrator agent file at `.github/agents/orchestrator.agent.md`.
   - Assert the file contains the halt condition text: `"triage_attempts > 1"` (the exact comparison from the pseudocode).
   - Assert the file contains `"Pipeline halted"` and `"requires human intervention"` in the halt error message.

6. **Implement test scenario 4 — Happy path (phase-level)**:
   - Construct a state object with a phase entry where `phase_review = "reports/PHASE-REVIEW-P01.md"` AND `phase_review_verdict = "approved"` AND `phase_review_action = "advanced"`.
   - Evaluate the invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`.
   - Assert the invariant evaluates to `false`.

7. **Implement test scenario 5 — Unhappy path (phase-level triage skipped)**:
   - Construct a state object with a phase entry where `phase_review = "reports/PHASE-REVIEW-P01.md"` AND `phase_review_verdict = null` AND `phase_review_action = null`.
   - Evaluate the invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`.
   - Assert the invariant evaluates to `true`.
   - Read the Orchestrator agent file.
   - Assert the file contains the phase-level re-spawn instruction: `"Phase triage is incomplete"` AND `"phase_review_verdict is null"` AND `"phase-level triage decision table"`.

8. **Implement test scenario 6 — Re-spawn limit (phase-level)**:
   - Read the Orchestrator agent file.
   - Assert the file contains `"Phase triage invariant still violated after re-spawn"` in the phase-level halt message.
   - Assert the file contains the `triage_attempts > 1` check in the phase-level gatekeep block (within the same code block that mentions `phase.phase_review`).

9. **Implement test scenario 7 — Audit trail completeness**:
   - Read the state schema at `plan/schemas/state-json-schema.md`.
   - Assert it documents BOTH `review_verdict` AND `review_action` as task-level fields (both field names appear).
   - Assert it documents BOTH `phase_review_verdict` AND `phase_review_action` as phase-level fields.
   - Read the triage skill at `.github/skills/triage-report/SKILL.md`.
   - Assert the State Write Contract section lists both task-level field pairs and both phase-level field pairs.
   - Verify that for every triaged row in the decision table where verdict is non-null, action is also non-null (never one without the other). This can be validated by checking: the skill file does NOT contain a row where `review_verdict` is a non-null/non-skip value and `review_action` is `null` or `*(skip)`.

10. **Implement test scenario 8 — Zero extra invocations on happy path**:
    - Read the Orchestrator agent file.
    - Locate the task-level gatekeep block (the section containing `task.review_doc != null AND task.review_verdict == null`).
    - Assert the gatekeep block reads ONLY `review_doc` and `review_verdict` fields — it does NOT contain instructions to read/parse review documents (no `Read Code Review`, no `Read Phase Review`, no `readFile` of a review path). The check is a pure field-level comparison.
    - Confirm the gatekeep pseudocode comment includes `"No document parsing"` or refers to field-level comparison only.

## Contracts & Interfaces

### Task-Level Gatekeep Invariant

The Orchestrator checks this after Mode 2 writes `review_doc`:

```
IF task.review_doc != null AND task.review_verdict == null:
  → triage was skipped → re-spawn Planner
```

### Phase-Level Gatekeep Invariant

```
IF phase.phase_review != null AND phase.phase_review_verdict == null:
  → phase triage was skipped → re-spawn Planner
```

### State Schema v2 — Task Entry Fields

```json
{
  "review_doc": null,
  "review_verdict": null,
  "review_action": null
}
```

- `review_verdict` enum: `"approved"` | `"changes_requested"` | `"rejected"` | `null`
- `review_action` enum: `"advanced"` | `"corrective_task_issued"` | `"halted"` | `null`

### State Schema v2 — Phase Entry Fields

```json
{
  "phase_review": null,
  "phase_review_verdict": null,
  "phase_review_action": null
}
```

- `phase_review_verdict` enum: `"approved"` | `"changes_requested"` | `"rejected"` | `null`
- `phase_review_action` enum: `"advanced"` | `"corrective_tasks_issued"` | `"halted"` | `null`

### Re-spawn Limit

`triage_attempts` is a runtime-local counter (not persisted). If `triage_attempts > 1` after a re-spawn, the pipeline halts with an error written to `errors.active_blockers`.

### File Paths to Read in Tests

| File | Path (relative to workspace root) | Purpose |
|------|----------------------------------|---------|
| Orchestrator agent | `.github/agents/orchestrator.agent.md` | Validate gatekeep blocks, re-spawn instructions, halt conditions |
| State schema | `plan/schemas/state-json-schema.md` | Validate verdict+action field pairs documented |
| Triage skill | `.github/skills/triage-report/SKILL.md` | Validate state write contract, decision table audit trail |

## Styles & Design Tokens

Not applicable — this is a test file, not a UI component.

## Test Requirements

Each test scenario below is a separate `it()` block inside a `describe('Integration: feedback loop')` block.

### Scenario 1: Happy path — task-level invariant is false

```javascript
it('task-level: invariant is false when review_verdict is populated', () => {
  const task = {
    review_doc: 'reports/CODE-REVIEW-P01-T01.md',
    review_verdict: 'approved',
    review_action: 'advanced'
  };
  const invariant = task.review_doc != null && task.review_verdict == null;
  assert.strictEqual(invariant, false);
});
```

### Scenario 2: Unhappy path — task-level triage skipped

```javascript
it('task-level: invariant is true when review_doc set but review_verdict is null', () => {
  const task = {
    review_doc: 'reports/CODE-REVIEW-P01-T01.md',
    review_verdict: null,
    review_action: null
  };
  const invariant = task.review_doc != null && task.review_verdict == null;
  assert.strictEqual(invariant, true);
});

it('orchestrator contains task-level re-spawn instruction template', () => {
  const content = fs.readFileSync(
    path.resolve(ROOT, '.github/agents/orchestrator.agent.md'), 'utf8'
  );
  assert.ok(content.includes('Triage is incomplete. Task'),
    'Missing task-level re-spawn instruction');
  assert.ok(content.includes('review_verdict is null'),
    'Re-spawn instruction must mention review_verdict is null');
  assert.ok(content.includes('execute the triage decision table'),
    'Re-spawn instruction must direct Planner to execute triage');
});
```

### Scenario 3: Re-spawn limit — task-level

```javascript
it('orchestrator enforces task-level re-spawn limit (triage_attempts > 1)', () => {
  const content = fs.readFileSync(
    path.resolve(ROOT, '.github/agents/orchestrator.agent.md'), 'utf8'
  );
  assert.ok(content.includes('triage_attempts > 1'),
    'Must contain triage_attempts > 1 halt condition');
  assert.ok(content.includes('Pipeline halted'),
    'Halt message must say "Pipeline halted"');
  assert.ok(content.includes('requires human intervention'),
    'Halt message must require human intervention');
});
```

### Scenario 4: Happy path — phase-level invariant is false

```javascript
it('phase-level: invariant is false when phase_review_verdict is populated', () => {
  const phase = {
    phase_review: 'reports/PHASE-REVIEW-P01.md',
    phase_review_verdict: 'approved',
    phase_review_action: 'advanced'
  };
  const invariant = phase.phase_review != null && phase.phase_review_verdict == null;
  assert.strictEqual(invariant, false);
});
```

### Scenario 5: Unhappy path — phase-level triage skipped

```javascript
it('phase-level: invariant is true when phase_review set but phase_review_verdict is null', () => {
  const phase = {
    phase_review: 'reports/PHASE-REVIEW-P01.md',
    phase_review_verdict: null,
    phase_review_action: null
  };
  const invariant = phase.phase_review != null && phase.phase_review_verdict == null;
  assert.strictEqual(invariant, true);
});

it('orchestrator contains phase-level re-spawn instruction template', () => {
  const content = fs.readFileSync(
    path.resolve(ROOT, '.github/agents/orchestrator.agent.md'), 'utf8'
  );
  assert.ok(content.includes('Phase triage is incomplete'),
    'Missing phase-level re-spawn instruction');
  assert.ok(content.includes('phase_review_verdict is null'),
    'Phase re-spawn instruction must mention phase_review_verdict is null');
  assert.ok(content.includes('phase-level triage decision table'),
    'Phase re-spawn instruction must direct Planner to execute phase-level triage');
});
```

### Scenario 6: Re-spawn limit — phase-level

```javascript
it('orchestrator enforces phase-level re-spawn limit', () => {
  const content = fs.readFileSync(
    path.resolve(ROOT, '.github/agents/orchestrator.agent.md'), 'utf8'
  );
  assert.ok(
    content.includes('Phase triage invariant still violated after re-spawn'),
    'Must contain phase-level halt message'
  );
});
```

### Scenario 7: Audit trail completeness

```javascript
it('state schema documents both verdict AND action for task-level fields', () => {
  const schema = fs.readFileSync(
    path.resolve(ROOT, 'plan/schemas/state-json-schema.md'), 'utf8'
  );
  assert.ok(schema.includes('review_verdict'), 'Schema must document review_verdict');
  assert.ok(schema.includes('review_action'), 'Schema must document review_action');
});

it('state schema documents both verdict AND action for phase-level fields', () => {
  const schema = fs.readFileSync(
    path.resolve(ROOT, 'plan/schemas/state-json-schema.md'), 'utf8'
  );
  assert.ok(schema.includes('phase_review_verdict'), 'Schema must document phase_review_verdict');
  assert.ok(schema.includes('phase_review_action'), 'Schema must document phase_review_action');
});

it('triage skill state write contract lists both field pairs', () => {
  const skill = fs.readFileSync(
    path.resolve(ROOT, '.github/skills/triage-report/SKILL.md'), 'utf8'
  );
  // Task-level pair
  assert.ok(skill.includes('review_verdict'), 'Skill must list review_verdict in write contract');
  assert.ok(skill.includes('review_action'), 'Skill must list review_action in write contract');
  // Phase-level pair
  assert.ok(skill.includes('phase_review_verdict'), 'Skill must list phase_review_verdict');
  assert.ok(skill.includes('phase_review_action'), 'Skill must list phase_review_action');
});
```

### Scenario 8: Zero extra invocations on happy path

```javascript
it('orchestrator gatekeep is a pure field-level check — no document parsing', () => {
  const content = fs.readFileSync(
    path.resolve(ROOT, '.github/agents/orchestrator.agent.md'), 'utf8'
  );
  // The gatekeep block must read only review_doc and review_verdict fields
  // It must NOT contain instructions to read/parse review documents
  assert.ok(
    content.includes('review_doc != null AND task.review_verdict == null') ||
    content.includes('review_doc != null AND review_verdict == null'),
    'Gatekeep must check review_doc and review_verdict fields'
  );
  // Verify the orchestrator mentions "No document parsing" or "field-level"
  // in reference to the gatekeep
  const hasFieldLevelRef =
    content.includes('field-level') ||
    content.includes('No document parsing') ||
    content.includes('pure field-level comparison');
  assert.ok(hasFieldLevelRef,
    'Gatekeep documentation must reference field-level comparison (no doc parsing)');
});
```

## Acceptance Criteria

- [ ] File exists at `tests/integration-feedback-loop.test.js`
- [ ] Tests use `node:test` (`describe`, `it`) and `node:assert` — matching `tests/agents.test.js` conventions
- [ ] Tests cover happy path (task-level and phase-level) where invariant is false (scenarios 1, 4)
- [ ] Tests cover unhappy path where invariant is true — triage skipped (scenarios 2, 5)
- [ ] Tests verify re-spawn limit enforcement — halt after 1 re-spawn (scenarios 3, 6)
- [ ] Tests verify audit trail completeness — verdict + action field pairs in schema and triage skill (scenario 7)
- [ ] Tests verify orchestrator gatekeep is a pure field-level check with no document parsing (scenario 8)
- [ ] All tests pass when run with `node --test tests/integration-feedback-loop.test.js`
- [ ] No lint errors

## Constraints

- Do NOT import or execute any agent logic — tests validate file content and state-transition invariants only
- Do NOT mock the file system — read the real workspace files using `fs.readFileSync`
- Do NOT create separate helper modules — all test logic lives in the single test file
- Do NOT test decision table row-by-row coverage — that is Task T2's scope
- Do NOT test backward compatibility with legacy state files — that is Task T3's scope
- Use `path.resolve(__dirname, '..')` as the workspace root (the `tests/` directory is one level below the workspace root)
- Keep test descriptions concise and specific — each `it()` block tests exactly one assertion or tightly related group
