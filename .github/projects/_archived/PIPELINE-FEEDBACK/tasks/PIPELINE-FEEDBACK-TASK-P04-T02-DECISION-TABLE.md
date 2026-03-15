---
project: "PIPELINE-FEEDBACK"
phase: 4
task: 2
title: "Unit Tests — Decision Table Coverage"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Unit Tests — Decision Table Coverage

## Objective

Create `tests/triage-decision-table.test.js` with unit tests covering all 11 task-level and all 5 phase-level triage decision table rows from the `triage-report` skill. Each test asserts the exact expected `(verdict, action)` output for a given input combination. Tests validate the CONTENT of the skill file — they verify row counts, exact mappings, and the absence of discretionary language.

## Context

The orchestration system uses a `triage-report` skill (`.github/skills/triage-report/SKILL.md`) that encodes two exhaustive decision tables — one for task-level triage (11 rows) and one for phase-level triage (5 rows). Every row maps to exactly one action; no row requires agent judgment. These tests read the skill file, parse its Markdown tables, and verify that each row exists with the correct mapping. The tests do NOT execute triage logic — they validate the specification itself.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/triage-decision-table.test.js` | Unit test file — 16 row-level tests + structural tests |

## Implementation Steps

1. **Set up the test file** using `node:test` (`describe`, `it`) and `node:assert` — matching conventions in `tests/agents.test.js` and `tests/config.test.js`. Use `'use strict';` at the top. Import `fs` and `path`.

2. **Read the triage skill file** using `fs.readFileSync(path.resolve(__dirname, '..', '.github', 'skills', 'triage-report', 'SKILL.md'), 'utf8')` at the top of the `describe` block. Store in a `skillContent` variable.

3. **Extract raw table rows** by writing a helper function that:
   - Finds the task-level table: locate the line `## Task-Level Decision Table`, then find the first Markdown table after it (lines starting with `|`). Skip the header row and the separator row (the `|---|` line). Collect data rows until a non-table line is reached.
   - Finds the phase-level table: locate the line `## Phase-Level Decision Table`, then find the first Markdown table after it. Same skip/collect logic.
   - Returns arrays of raw row strings.

4. **Implement structural test: task-level table has exactly 11 data rows**.
   ```javascript
   it('task-level decision table has exactly 11 data rows', () => {
     assert.strictEqual(taskRows.length, 11,
       `Expected 11 task-level rows, got ${taskRows.length}`);
   });
   ```

5. **Implement structural test: phase-level table has exactly 5 data rows**.
   ```javascript
   it('phase-level decision table has exactly 5 data rows', () => {
     assert.strictEqual(phaseRows.length, 5,
       `Expected 5 phase-level rows, got ${phaseRows.length}`);
   });
   ```

6. **Implement structural test: no discretionary language in skill file**. Search the entire `skillContent` for phrases like `"use judgment"`, `"use discretion"`, `"at your discretion"`, `"case-by-case"`, `"subjective"`. Assert none are found.
   ```javascript
   it('decision tables contain no discretionary language', () => {
     const forbidden = ['use judgment', 'use discretion', 'at your discretion',
                        'case-by-case', 'subjective'];
     const lower = skillContent.toLowerCase();
     for (const phrase of forbidden) {
       assert.ok(!lower.includes(phrase),
         `Skill file contains discretionary language: "${phrase}"`);
     }
   });
   ```

7. **Implement structural test: every row maps to exactly one action**. For each row in both tables, parse the cells and verify that the action column (column index 5 for task-level, column index 4 for phase-level) contains exactly one value — it is not empty, does not contain `/` or `or` as alternative actions (except Row 10's documented conditional which uses `→` branches, not `or` in the action cell itself — Row 10's action cell says `"See note"` and the clarification below defines a deterministic branch).

8. **Implement the 11 task-level row tests** — one `it()` per row inside a `describe('Task-level decision table rows')` block. Each test verifies that the corresponding row in the parsed table contains the expected values. Use the exact mappings from the **Task-Level Decision Table Contract** below.

9. **Implement the 5 phase-level row tests** — one `it()` per row inside a `describe('Phase-level decision table rows')` block. Use the exact mappings from the **Phase-Level Decision Table Contract** below.

10. **Implement structural test: `"corrective_tasks_issued"` (plural) appears in phase table; `"corrective_task_issued"` (singular) appears in task table**. Assert both variants exist in the skill file and that they appear in their respective table sections.

## Contracts & Interfaces

### Task-Level Decision Table Contract

Each row is defined by its input conditions and must map to the exact output values below. The Coder must assert these values for each row parsed from the skill file.

| Row | `Task Report Status` | `Has Deviations?` | `Code Review Verdict` | Expected `review_verdict` Written | Expected `review_action` Written |
|-----|---------------------|-------------------|----------------------|----------------------------------|----------------------------------|
| 1 | `complete` | `No` | `null` (no review yet) | `*(skip — no review doc)*` | `*(skip — no review doc)*` |
| 2 | `complete` | `No` | `"approved"` | `"approved"` | `"advanced"` |
| 3 | `complete` | `Yes — minor` | `"approved"` | `"approved"` | `"advanced"` |
| 4 | `complete` | `Yes — architectural` | `"approved"` | `"approved"` | `"advanced"` |
| 5 | `complete` | `Any` | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 6 | `complete` | `Any` | `"rejected"` | `"rejected"` | `"halted"` |
| 7 | `partial` | `—` | `null` (no review yet) | `*(skip — no review doc)*` | `*(skip — no review doc)*` |
| 8 | `partial` | `—` | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 9 | `partial` | `—` | `"rejected"` | `"rejected"` | `"halted"` |
| 10 | `failed` | `—` | `Any or \|null\|` | `*(record if review doc exists)*` | `See note` |
| 11 | `failed` | `—` | `Any or \|null\| — critical severity` | `*(record if review doc exists)*` | `"halted"` |

**Row 10 conditional logic (both branches must be tested):**
- Branch A: `retries < max_retries` AND `severity == "minor"` → `review_action` = `"corrective_task_issued"`
- Branch B: Otherwise → `review_action` = `"halted"`
- The skill file's Row 10 clarification section must contain BOTH `"corrective_task_issued"` and `"halted"` as conditional outcomes.

**Row 11:**
- Critical severity → `review_action` = `"halted"` unconditionally, regardless of retry budget.

### Phase-Level Decision Table Contract

| Row | `Phase Review Verdict` | `Exit Criteria Assessment` | Expected `phase_review_verdict` Written | Expected `phase_review_action` Written |
|-----|----------------------|---------------------------|----------------------------------------|---------------------------------------|
| 1 | `null` (no phase review yet) | `—` | `*(skip — no review doc)*` | `*(skip — no review doc)*` |
| 2 | `"approved"` | `All exit criteria met` | `"approved"` | `"advanced"` |
| 3 | `"approved"` | `Some exit criteria unmet` | `"approved"` | `"advanced"` |
| 4 | `"changes_requested"` | `—` | `"changes_requested"` | `"corrective_tasks_issued"` |
| 5 | `"rejected"` | `—` | `"rejected"` | `"halted"` |

**Singular vs. plural:**
- Phase-level action uses `"corrective_tasks_issued"` (plural — a phase review can produce multiple corrective tasks).
- Task-level action uses `"corrective_task_issued"` (singular).
- Do NOT normalize these values. Both exact strings must appear in the skill file.

### Helper Function Contract: `parseTableRows(content, sectionHeading)`

```javascript
/**
 * Extract data rows from a Markdown table under a specific heading.
 * @param {string} content - Full Markdown file content.
 * @param {string} sectionHeading - The heading text to locate (e.g., 'Task-Level Decision Table').
 * @returns {string[][]} Array of rows, each row an array of cell values (trimmed).
 */
function parseTableRows(content, sectionHeading) {
  const lines = content.split('\n');
  let inSection = false;
  let headerFound = false;
  let separatorSkipped = false;
  const rows = [];

  for (const line of lines) {
    // Detect target section heading (## or ###)
    if (/^#{2,3}\s+/.test(line) && line.includes(sectionHeading)) {
      inSection = true;
      continue;
    }
    // Stop at next heading of same or higher level
    if (inSection && /^#{2,3}\s+/.test(line) && !line.includes(sectionHeading)) {
      break;
    }
    if (!inSection) continue;

    // Skip non-table lines
    if (!line.startsWith('|')) continue;

    // First table line = header row
    if (!headerFound) {
      headerFound = true;
      continue;
    }
    // Second table line = separator (|---|---|...)
    if (!separatorSkipped) {
      separatorSkipped = true;
      continue;
    }
    // Data rows
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    rows.push(cells);
  }
  return rows;
}
```

### File Path to Read in Tests

| File | Path (relative to workspace root) | Purpose |
|------|----------------------------------|---------|
| Triage skill | `.github/skills/triage-report/SKILL.md` | Source of truth for decision tables |

## Styles & Design Tokens

Not applicable — this is a test file, not a UI component.

## Test Requirements

Each test below is a separate `it()` block. Group task-level row tests in `describe('Task-level decision table rows')` and phase-level row tests in `describe('Phase-level decision table rows')`. Structural tests go in `describe('Decision table structure')`.

### Structure Tests

- [ ] Task-level table has exactly 11 data rows
- [ ] Phase-level table has exactly 5 data rows
- [ ] No discretionary language (`use judgment`, `use discretion`, `at your discretion`, `case-by-case`, `subjective`) in skill file
- [ ] Every action column contains exactly one unambiguous value (no slash-separated alternatives)
- [ ] `"corrective_tasks_issued"` (plural) appears in phase-level table section; `"corrective_task_issued"` (singular) appears in task-level table section

### Task-Level Row Tests

- [ ] Row 1: `complete` / No deviations / `null` verdict → skip verdict, skip action
- [ ] Row 2: `complete` / No deviations / `"approved"` → `"approved"` / `"advanced"`
- [ ] Row 3: `complete` / minor deviations / `"approved"` → `"approved"` / `"advanced"`
- [ ] Row 4: `complete` / architectural deviations / `"approved"` → `"approved"` / `"advanced"`
- [ ] Row 5: `complete` / Any deviations / `"changes_requested"` → `"changes_requested"` / `"corrective_task_issued"`
- [ ] Row 6: `complete` / Any deviations / `"rejected"` → `"rejected"` / `"halted"`
- [ ] Row 7: `partial` / — / `null` verdict → skip verdict, skip action
- [ ] Row 8: `partial` / — / `"changes_requested"` → `"changes_requested"` / `"corrective_task_issued"`
- [ ] Row 9: `partial` / — / `"rejected"` → `"rejected"` / `"halted"`
- [ ] Row 10: `failed` / — / Any or null → conditional: `"corrective_task_issued"` or `"halted"` (both branches documented)
- [ ] Row 11: `failed` / — / critical severity → `"halted"` unconditionally

### Phase-Level Row Tests

- [ ] Row 1: `null` verdict → skip verdict, skip action
- [ ] Row 2: `"approved"` / All met → `"approved"` / `"advanced"`
- [ ] Row 3: `"approved"` / Some unmet → `"approved"` / `"advanced"`
- [ ] Row 4: `"changes_requested"` → `"changes_requested"` / `"corrective_tasks_issued"`
- [ ] Row 5: `"rejected"` → `"rejected"` / `"halted"`

## Acceptance Criteria

- [ ] File exists at `tests/triage-decision-table.test.js`
- [ ] All 11 task-level rows have individual test cases
- [ ] All 5 phase-level rows have individual test cases
- [ ] Tests verify no `"use judgment"` or discretionary language exists in the skill
- [ ] Tests verify exact row counts (11 task-level data rows, 5 phase-level data rows)
- [ ] Phase action uses `"corrective_tasks_issued"` (plural); task action uses `"corrective_task_issued"` (singular) — both verified
- [ ] All tests pass when run with `node --test tests/triage-decision-table.test.js`
- [ ] No lint errors

## Constraints

- Do NOT import or execute any agent or planner logic — tests validate the skill file content only
- Do NOT mock the file system — read the real `SKILL.md` using `fs.readFileSync`
- Do NOT create separate helper modules — all test logic (including `parseTableRows`) lives in the single test file
- Do NOT test integration scenarios (gatekeep, re-spawn, state transitions) — that is Task T1's scope
- Do NOT test backward compatibility with legacy state — that is Task T3's scope
- Use `path.resolve(__dirname, '..', '.github', 'skills', 'triage-report', 'SKILL.md')` to locate the skill file
- Keep test descriptions concise — each `it()` block tests exactly one row or one structural property
- Use `'use strict';` at the top of the file
