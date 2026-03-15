---
project: "EXECUTE-BEHAVIORAL-TESTS"
status: "draft"
author: "architect-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Architecture

## Technical Overview

This is a targeted bug-fix project modifying three existing JavaScript modules in a CommonJS Node.js codebase — no new modules, no new dependencies, no new pipeline stages. The three fixes (triage decision table, mutation handler guard, YAML parser) are applied to existing files in-place, followed by test expectation updates and a full suite run. All changes stay within existing architectural patterns: first-match-wins decision tables, enum-driven action routing, and stack-based YAML parsing.

## System Layers

This project does not introduce new layers. All changes occur within the existing Domain layer (pipeline logic) and an existing Infrastructure utility (YAML parser). The layers below show only the modules touched by this project.

```
┌─────────────────────────────────────────────────────────────────┐
│  Domain (Pipeline Logic)                                        │
│  triage-engine.js · mutations.js · constants.js (read-only)     │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure (Utilities)                                     │
│  yaml-parser.js                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Test Layer                                                     │
│  pipeline-behavioral.test.js                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility | Change Type |
|--------|-------|------|---------------|-------------|
| `triage-engine` | Domain | `.github/orchestration/scripts/lib/triage-engine.js` | Task triage decision table — evaluates task state and returns verdict/action | Modify Row 1 return value; insert new Row 1b |
| `mutations` | Domain | `.github/orchestration/scripts/lib/mutations.js` | Applies triage results to state — routes by action, handles auto-approve | Modify `applyTaskTriage` null/null guard |
| `yaml-parser` | Infrastructure | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | Parses YAML frontmatter into JavaScript objects | Modify list-item branch to support key-value objects |
| `constants` | Domain | `.github/orchestration/scripts/lib/constants.js` | Enum definitions for all pipeline values | **Read-only** — no changes |
| `resolver` | Domain | `.github/orchestration/scripts/lib/resolver.js` | Resolves next pipeline action from state — branch T11 spawns code reviewer | **Read-only** — no changes (T11 becomes reachable) |
| `pipeline-engine` | Domain | `.github/orchestration/scripts/lib/pipeline-engine.js` | Orchestrates mutation → triage → resolve → action loop | **Read-only** — no changes |
| `pipeline-behavioral.test` | Test | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Behavioral test suite — 10 describe blocks, ~45 tests | Modify assertion values only |

## Contracts & Interfaces

### Fix 1: Triage Engine — Row 1 Change Contract

**File:** `.github/orchestration/scripts/lib/triage-engine.js`
**Function:** `triageTask(state, phaseIndex, taskIndex)` (no signature change)

**Row 1 — BEFORE (line ~153):**

```javascript
// ── Row 1: complete, no deviations, no review — skip triage ──
if (reportStatus === 'complete' && !hasDeviations && !task.review_doc) {
  return makeSuccess(
    TRIAGE_LEVELS.TASK, null, null,
    phaseIndex, taskIndex, 1,
    'Row 1: complete, no deviations, no review — skip triage'
  );
}
```

**Row 1 — AFTER:**

```javascript
// ── Row 1: complete, no deviations, no review — spawn code reviewer ──
if (reportStatus === 'complete' && !hasDeviations && !task.review_doc) {
  return makeSuccess(
    TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
    phaseIndex, taskIndex, 1,
    'Row 1: complete, no deviations, no review — spawn code reviewer'
  );
}
```

**Change:** Third argument to `makeSuccess` changes from `null` to `'spawn_code_reviewer'`. Comment and detail string updated. Condition unchanged.

**Downstream effect:** Result now has `{ verdict: null, action: 'spawn_code_reviewer' }`. This bypasses the null/null guard in `applyTaskTriage` and enters the non-null path, which writes `review_action: 'spawn_code_reviewer'` to the task. Since `'spawn_code_reviewer'` is not in `REVIEW_ACTIONS`, the action routing switch falls through without setting task status. The resolver then evaluates T11 (`review_doc === null && review_verdict === null`) and returns `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`.

### Fix 2: Triage Engine — New Row 1b

**File:** `.github/orchestration/scripts/lib/triage-engine.js`
**Insert after:** Row 1 (line ~160, after Row 1's closing brace)
**Insert before:** Current Row 2 (`complete, no deviations, approved — advance`)

```javascript
// ── Row 1b: complete, deviations, no review — spawn code reviewer ──
if (reportStatus === 'complete' && hasDeviations && !task.review_doc) {
  return makeSuccess(
    TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer',
    phaseIndex, taskIndex, 2,
    'Row 1b: complete, deviations, no review — spawn code reviewer'
  );
}
```

**Placement rationale:** Must appear before Rows 3–4 (which require `task.review_doc` to exist and `verdict === APPROVED`). Placed immediately after Row 1 because both handle the "no review doc yet" case. Uses row number `2` in `makeSuccess` since it is the second decision table row evaluated.

**Row renumbering:** After insertion, the original Rows 2–11 shift to Rows 3–12 in evaluation order. The `makeSuccess` row number arguments and detail strings of subsequent rows must be updated to reflect the new numbering:

| Original Row | New Row | Detail String Update |
|-------------|---------|---------------------|
| Row 1 | Row 1 | Comment: "spawn code reviewer" (not "skip triage") |
| (new) | Row 2 | `'Row 1b: complete, deviations, no review — spawn code reviewer'` |
| Row 2 | Row 3 | `'Row 3: complete, no deviations, approved — advance'` |
| Row 3 | Row 4 | `'Row 4: complete, minor deviations, approved — advance'` |
| Row 4 | Row 5 | `'Row 5: complete, architectural deviations, approved — advance'` |
| Row 5 | Row 6 | `'Row 6: complete, changes requested — corrective task'` |
| Row 6 | Row 7 | `'Row 7: complete, rejected — halt'` |
| Row 7 | Row 8 | `'Row 8: partial, no review — skip triage'` |
| Row 8 | Row 9 | `'Row 9: partial, changes requested — corrective task'` |
| Row 9 | Row 10 | `'Row 10: partial, rejected — halt'` |
| Row 10 | Row 11 | `'Row 11: failed, minor severity, retries available — corrective task'` |
| Row 11 | Row 12 | `'Row 12: failed, critical severity or retries exhausted — halt'` |

**Note:** Row numbers in `makeSuccess` are descriptive labels used in detail strings and test assertions. The renumbering is cosmetic but necessary for consistency and to avoid confusing test output.

### Fix 3: Mutations — `applyTaskTriage` Guard Change

**File:** `.github/orchestration/scripts/lib/mutations.js`
**Function:** `applyTaskTriage(state, triageResult)` (no signature change)

**Null/null guard — BEFORE (line ~414):**

```javascript
function applyTaskTriage(state, triageResult) {
  // Null/null case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when task has a report (proof of execution)
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;
      task.review_verdict = REVIEW_VERDICTS.APPROVED;
      task.review_action = REVIEW_ACTIONS.ADVANCED;
      task.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [...]
      };
    }
    // No report → original skip (nothing to auto-approve)
    return { state, mutations_applied: [] };
  }
  // ...non-null path continues
}
```

**Null/null guard — AFTER:**

The guard condition does not change — it still checks `verdict === null && action === null`. After the triage engine fixes, only Row 8 (partial, no review — formerly Row 7) still returns `{ verdict: null, action: null }`. Row 1's return value changes to `{ verdict: null, action: 'spawn_code_reviewer' }`, so it no longer enters this branch.

**What stays the same:**
- The null/null guard block itself is unchanged in structure
- Row 8 (partial reports with `report_doc`) continues to auto-approve through this path
- The non-null path continues to route by action as before

**What changes implicitly:**
- Row 1 results no longer enter the null/null guard (they now have `action: 'spawn_code_reviewer'`)
- Row 1 results flow through the non-null path: `triage_attempts` increments, `review_verdict: null` and `review_action: 'spawn_code_reviewer'` are written, action routing falls through (no matching `REVIEW_ACTIONS` branch)

**Guard update — explicit `REVIEW_VERDICTS.APPROVED` check:**

Per FR-3, the auto-approve path inside the null/null guard should be further guarded to only fire when the triage engine explicitly returned an `approved` verdict. However, since the triage engine fix means Row 1 no longer returns null/null, the existing guard already achieves the correct behavior without code changes. The only row still reaching null/null is Row 8 (partial, no review), which correctly auto-approves.

**Architect's assessment:** The mutations.js guard may not require a code change if the triage engine fix alone is sufficient. The null/null path will only be reached by Row 8 (partial reports), which should auto-approve. However, the PRD (FR-3) explicitly requires the guard to check for an explicit `approved` verdict as a defense-in-depth measure. The Tactical Planner and Coder should evaluate whether to:
- **(Option A)** Skip the mutations.js change entirely — triage fix alone is sufficient
- **(Option B)** Add the explicit `REVIEW_VERDICTS.APPROVED` check as defense-in-depth per FR-3

If Option B is chosen, the guard becomes:

```javascript
if (triageResult.verdict === null && triageResult.action === null) {
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc && triageResult.verdict === REVIEW_VERDICTS.APPROVED) {
      // ...auto-approve path
    }
    return { state, mutations_applied: [] };
  }
```

**Risk note:** With Option B, `triageResult.verdict === null` and `triageResult.verdict === REVIEW_VERDICTS.APPROVED` are mutually exclusive inside the null/null guard — the auto-approve block would become unreachable. This would break Row 8 (partial report auto-approve). Option B as written is incorrect. The correct defense-in-depth approach is to leave the null/null guard for Row 8 and ensure the triage engine never sends null/null for cases that should route to code review. **The triage engine fix (Fix 1 + Fix 2) is the primary fix; mutations.js changes are optional.**

### Fix 4: YAML Parser — Array-of-Objects Support

**File:** `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js`
**Function:** `parseYaml(text)` (no signature change)

**List-item branch — BEFORE (line ~62):**

```javascript
// ── List item: - value ──────────────────────────────────────────
if (trimmed.startsWith('- ')) {
  if (Array.isArray(current)) {
    const itemContent = trimmed.slice(2).trim();
    current.push(parseScalar(itemContent));
  }
  i++;
  continue;
}
```

**List-item branch — AFTER:**

```javascript
// ── List item: - value ──────────────────────────────────────────
if (trimmed.startsWith('- ')) {
  if (Array.isArray(current)) {
    const itemContent = trimmed.slice(2).trim();
    const colonIdx = findKeyColon(itemContent);
    if (colonIdx !== -1) {
      // Key-value pair → object item
      const obj = {};
      const key = itemContent.slice(0, colonIdx).trim();
      const rawValue = itemContent.slice(colonIdx + 1).trim();
      obj[key] = parseScalar(rawValue);
      // Consume continuation lines (indented deeper than the `- ` prefix)
      const itemIndent = indent + 2; // indent of content after `- `
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextIndent = getIndent(nextLine);
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed === '' || nextIndent <= indent) break;
        const contColonIdx = findKeyColon(nextTrimmed);
        if (contColonIdx !== -1) {
          const contKey = nextTrimmed.slice(0, contColonIdx).trim();
          const contRawValue = nextTrimmed.slice(contColonIdx + 1).trim();
          obj[contKey] = parseScalar(contRawValue);
        }
        i++;
      }
      current.push(obj);
    } else {
      // No colon → scalar item (existing behavior)
      current.push(parseScalar(itemContent));
    }
  }
  i++;
  continue;
}
```

**Change contract:**
- `findKeyColon()` (existing function in same file) detects key-value pairs in list items
- `parseScalar()` (existing function in same file) parses values after the colon
- Continuation lines indented deeper than the list marker are consumed as additional key-value pairs on the same object
- List items without colons retain existing scalar behavior (FR-7)
- One level of nesting only — no recursive descent for deeply nested structures (NFR-7)

**Input/output contract:**

```yaml
# Input
tasks:
  - id: "T01"
    title: "First Task"
  - id: "T02"
    title: "Second Task"
  - plain scalar item
```

```javascript
// Output
{
  tasks: [
    { id: "T01", title: "First Task" },
    { id: "T02", title: "Second Task" },
    "plain scalar item"
  ]
}
```

### Fix 5: Test Expectation Updates

**File:** `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
**Change type:** Assertion value changes only — no structural changes to tests

**Tests affected and expected changes:**

| Test Area | Describe Block | Change |
|-----------|---------------|--------|
| Row 1 isolation | Task Triage (~line 623) | Assert `action: SPAWN_CODE_REVIEWER` instead of `GENERATE_PHASE_REPORT`. Assert `review_verdict: null` and `review_action: 'spawn_code_reviewer'` instead of `APPROVED`/`ADVANCED`. |
| Full Happy Path | Full Happy Path (~line 229) | Insert code review step between task_completed and generate_phase_report. Assert `SPAWN_CODE_REVIEWER` action after task completion. |
| Multi-Phase Multi-Task | Multi-Phase Multi-Task (~line 379) | Same pattern — each task completion now routes to code review before advancing. |
| Row 7 (now Row 8) | Task Triage (~line 863) | Row number reference updates only (7 → 8). Auto-approve behavior unchanged. |
| Human Gate Modes | Human Gate Modes (~line 1346) | Update setup/assertion sequences that rely on auto-approve flow. |
| Retry & Corrective | Retry & Corrective Cycles (~line 1603) | Update success path assertions after corrective cycle. |
| Halt Paths | Halt Paths (~line 1702) | Update setup sequences relying on auto-approve. |
| Cold-Start Resume | Cold-Start Resume (~line 1851) | Update pre-built states if they reference old row numbers. |
| Frontmatter-Driven | Frontmatter-Driven Flows (~line 2103) | Update assertions relying on auto-approve for clean tasks. |

**Constraint:** Only assertion values and setup state values change. No new `describe` blocks, `it` blocks, helper functions, or test infrastructure.

## Dependencies

### External Dependencies

None. No new packages. All modules use Node.js built-ins only (`node:test`, `node:assert/strict`, `node:fs`, `node:path`).

### Internal Dependencies (module → module)

```
triage-engine.js ──imports──→ constants.js (TRIAGE_LEVELS, REVIEW_VERDICTS, REVIEW_ACTIONS)
mutations.js     ──imports──→ constants.js (TASK_STATUSES, REVIEW_VERDICTS, REVIEW_ACTIONS)
resolver.js      ──imports──→ constants.js (NEXT_ACTIONS, TASK_STATUSES, REVIEW_VERDICTS)
pipeline-engine.js ──calls──→ triage-engine.js (executeTriage)
pipeline-engine.js ──calls──→ mutations.js (applyTaskTriage)
pipeline-engine.js ──calls──→ resolver.js (resolve)
pipeline-behavioral.test.js ──calls──→ pipeline-engine.js (executePipeline)
yaml-parser.js   ──standalone── (no pipeline module imports)
```

**Fix dependency order:** The triage engine fix (Fix 1 + Fix 2) must be applied before test expectations are updated, because test assertions depend on the new triage behavior. The YAML parser fix (Fix 4) is independent and can be applied in any order. The mutations.js guard (Fix 3) is optional per the architect's assessment above.

```
Fix 1 (triage Row 1)  ─┐
Fix 2 (triage Row 1b)  ─┼──→ Fix 5 (test expectations) ──→ Run tests ──→ Report
Fix 3 (mutations guard) ─┘                                        ↑
Fix 4 (yaml-parser)    ────────────────────────────────────────────┘
```

## File Structure

All files already exist. No new files are created except the final test report.

```
.github/
├── orchestration/
│   └── scripts/
│       ├── lib/
│       │   ├── triage-engine.js        # Fix 1 + Fix 2: Row 1 change + Row 1b insertion
│       │   ├── mutations.js            # Fix 3 (optional): applyTaskTriage guard
│       │   ├── constants.js            # Read-only
│       │   ├── resolver.js             # Read-only (T11 becomes reachable)
│       │   └── pipeline-engine.js      # Read-only
│       └── tests/
│           └── pipeline-behavioral.test.js  # Fix 5: assertion value updates
├── skills/
│   └── validate-orchestration/
│       └── scripts/
│           └── lib/
│               └── utils/
│                   └── yaml-parser.js       # Fix 4: array-of-objects support
└── projects/
    └── EXECUTE-BEHAVIORAL-TESTS/
        └── EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md  # Output artifact (created by Coder)
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Error handling | No new error handling. Existing `makeSuccess`/`makeError` pattern in triage engine. Existing validation via `state-validator.js` after mutations. |
| State validation | State validator runs after triage mutations (V8, V9, V13, V14 invariants). Fixes must not violate these. The non-null path writes `review_verdict: null` and `review_action: 'spawn_code_reviewer'` — validator must accept null verdict with non-null action. |
| Row evaluation order | First-match-wins. New Row 1b must appear before Rows 3–5 (which require `review_doc`). Row 1 remains first. |
| `triage_attempts` counter | The non-null path increments `triage_attempts`. After Fix 1, Row 1 results enter the non-null path, so `triage_attempts` will increment for `spawn_code_reviewer`. This is cosmetic and not a blocking issue — document in test report carry-forward items if observed. |
| Row 8 (partial report) preservation | Row 8 (formerly Row 7) still returns null/null. The null/null guard in `applyTaskTriage` still auto-approves partial reports with `report_doc`. No behavior change for this path. |
| YAML parser backward compatibility | Scalar list items (`- item` without colon) must continue to produce string values. The `findKeyColon()` check gates the new object path. |

## Risk Register

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|-----------|
| R1 | Row renumbering causes test assertion mismatches | Medium | Medium | Update all `makeSuccess` row number arguments and detail strings. Update all test assertions that reference row numbers. |
| R2 | `applyTaskTriage` non-null path writes `review_verdict: null` — state validator may reject this | High | Low | Verify state validator accepts null `review_verdict` when `review_action` is non-null. If not, this is a blocking issue requiring a validator update (out of current scope). |
| R3 | Test expectation updates miss an integration test that relies on auto-approve | Medium | Medium | Research identified ~9 affected test areas. Coder must grep for `REVIEW_VERDICTS.APPROVED` assertions in the context of Row 1 / clean task completion and update all instances. |
| R4 | YAML parser continuation-line loop consumes too many lines or too few | Medium | Low | Break condition: empty line or indent ≤ list item indent. Existing YAML parser tests for scalar lists validate no-regression. New object tests validate correct consumption. |
| R5 | `triage_attempts` counter increment for `spawn_code_reviewer` triggers retry exhaustion | Low | Low | Document as carry-forward item. Counter resets on advance after code review completes. |

## Phasing Recommendations

This is a small, tightly-scoped project. A single phase with ordered tasks is sufficient.

**Recommended single phase with 5 tasks:**

1. **Task 1 — Fix triage engine** (Fixes 1 + 2): Modify Row 1 return value, insert Row 1b, renumber subsequent rows. This is the foundational fix — everything downstream depends on it.
2. **Task 2 — Fix mutations guard** (Fix 3, optional): Add defense-in-depth check to `applyTaskTriage`. Evaluate whether this is needed given the triage fix. If skipped, document the rationale.
3. **Task 3 — Fix YAML parser** (Fix 4): Modify list-item branch. Independent of triage/mutations fixes.
4. **Task 4 — Update test expectations** (Fix 5): Update assertion values in `pipeline-behavioral.test.js`. Depends on Tasks 1–2 being complete so new expected values are known.
5. **Task 5 — Run tests and produce report**: Execute `node --test`, capture output, write `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`. Depends on all prior tasks.

**Dependency graph:**

```
Task 1 (triage) ──→ Task 4 (test expectations) ──→ Task 5 (run + report)
Task 2 (mutations) ──→ Task 4
Task 3 (yaml-parser) ──→ Task 5
```

Tasks 1, 2, and 3 can execute in parallel. Task 4 requires 1 and 2. Task 5 requires all prior tasks.
