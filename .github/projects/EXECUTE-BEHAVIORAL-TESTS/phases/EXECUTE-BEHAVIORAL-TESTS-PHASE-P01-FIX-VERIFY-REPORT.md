---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
title: "Fix, Verify, and Report"
status: "active"
total_tasks: 5
tasks:
  - id: "T01-TRIAGE-FIX"
    title: "Fix triage engine Row 1 + insert Row 1b + renumber"
  - id: "T02-MUTATIONS-GUARD"
    title: "Fix mutations guard (defense-in-depth evaluation)"
  - id: "T03-YAML-PARSER"
    title: "Fix YAML parser array-of-objects"
  - id: "T04-TEST-EXPECTATIONS"
    title: "Update test expectations for new triage behavior"
  - id: "T05-RUN-AND-REPORT"
    title: "Run tests and produce test report"
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
---

# Phase 1: Fix, Verify, and Report

## Phase Goal

Apply three targeted bug fixes to the pipeline (triage engine, mutations guard, YAML parser), update behavioral test expectations to match the corrected behavior, run the full behavioral test suite, and produce a structured markdown test report for human triage.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../EXECUTE-BEHAVIORAL-TESTS-MASTER-PLAN.md) | Phase 1 scope, task summary, dependency graph, exit criteria, execution constraints, risk register |
| [Architecture](../EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | Fix 1–5 contracts (exact before/after code, file paths, line numbers), module map, internal dependencies, row renumbering table, cross-cutting concerns |
| [Design](../EXECUTE-BEHAVIORAL-TESTS-DESIGN.md) | Test report document structure (sections, frontmatter, failure detail format), developer experience conventions (triage table pattern, mutation guard pattern, YAML parser pattern, test assertion pattern) |
| [PRD](../EXECUTE-BEHAVIORAL-TESTS-PRD.md) | FR-1 through FR-11, NFR-1 through NFR-7, risk matrix, success metrics |
| [Research](../EXECUTE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md) | Exact code locations and line numbers, current behavior analysis, full decision table (11 rows), affected test areas (~9 blocks with line references), pipeline engine EXTERNAL_ACTIONS set, resolver T11 branch |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Fix triage engine Row 1 + insert Row 1b + renumber | — | `code` | 1 | `tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T01-TRIAGE-FIX.md` |
| T02 | Fix mutations guard (defense-in-depth evaluation) | — | `code` | 1 | `tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T02-MUTATIONS-GUARD.md` |
| T03 | Fix YAML parser array-of-objects | — | `code` | 1 | `tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T03-YAML-PARSER.md` |
| T04 | Update test expectations for new triage behavior | T01, T02 | `code` | 1 | `tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T04-TEST-EXPECTATIONS.md` |
| T05 | Run tests and produce test report | T01, T02, T03, T04 | `code`, `run-tests` | 1–2 | `tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T05-RUN-AND-REPORT.md` |

## Task Details

### T01 — Fix Triage Engine Row 1 + Insert Row 1b + Renumber

**Objective**: Modify the triage engine's task decision table so that clean completed tasks route to code review instead of being auto-approved, add a new row for completed tasks with deviations but no review, and renumber all subsequent rows for consistency.

**File targets**:

| File | Path | Action |
|------|------|--------|
| `triage-engine.js` | `.github/orchestration/scripts/lib/triage-engine.js` | MODIFY |

**What to change**:
1. **Row 1 (~line 153)**: Change `makeSuccess` 3rd argument from `null` to `'spawn_code_reviewer'`. Update comment from "skip triage" to "spawn code reviewer". Update detail string accordingly. Condition (`complete && !hasDeviations && !task.review_doc`) stays the same.
2. **Insert Row 1b** (after Row 1's closing brace, before original Row 2): New row matching `complete && hasDeviations && !task.review_doc` → return `makeSuccess(TRIAGE_LEVELS.TASK, null, 'spawn_code_reviewer', phaseIndex, taskIndex, 2, 'Row 1b: complete, deviations, no review — spawn code reviewer')`.
3. **Renumber rows 2–11 → 3–12**: Update the `makeSuccess` row number argument and detail string for each subsequent row per the Architecture renumbering table (original Row 2 → Row 3, Row 3 → Row 4, ... Row 11 → Row 12).

**Acceptance criteria**:
- [ ] Row 1: `makeSuccess` returns `{ verdict: null, action: 'spawn_code_reviewer' }` for `complete + no deviations + no review`
- [ ] Row 1b: New row returns `{ verdict: null, action: 'spawn_code_reviewer' }` for `complete + deviations + no review`
- [ ] Row 1b appears after Row 1 and before the original Row 2 (now Row 3)
- [ ] All subsequent rows (original 2–11) have updated row numbers (3–12) in `makeSuccess` arguments and detail strings
- [ ] No condition logic changed on any existing row — only return values and labels
- [ ] First-match-wins evaluation order preserved — no shadowed or unreachable rows

**Constraints**:
- Do NOT modify any row conditions other than Row 1's return value
- Do NOT add new constants to `constants.js` — use string `'spawn_code_reviewer'` for the action (as used by existing code paths)
- Follow the existing pattern: numbered comment, `makeSuccess()` with 7 args, descriptive detail string

---

### T02 — Fix Mutations Guard (Defense-in-Depth Evaluation)

**Objective**: Evaluate whether the `applyTaskTriage` null/null auto-approve guard in `mutations.js` needs a code change, and implement the appropriate option. After the triage fix (T01), only Row 8 (partial, no review — formerly Row 7) still returns `{ verdict: null, action: null }`.

**File targets**:

| File | Path | Action |
|------|------|--------|
| `mutations.js` | `.github/orchestration/scripts/lib/mutations.js` | MODIFY (or EVALUATE + NO-OP) |

**What to evaluate**:
- **Option A — Skip change**: The triage fix alone is sufficient. Row 1 no longer returns null/null, so the null/null guard is only reached by Row 8 (partial reports), which correctly auto-approves. No code change needed. Document the rationale in the task report.
- **Option B — Add explicit guard**: This is architecturally incorrect as documented. Adding `triageResult.verdict === REVIEW_VERDICTS.APPROVED` inside the null/null branch creates an unreachable condition (null ≠ APPROVED). Do NOT implement Option B.

**Architecture recommendation**: Option A (skip) is the correct approach. The triage fix is the primary fix. The null/null guard now only serves Row 8 (partial reports), and its auto-approve behavior is correct for that path.

**What to change (if Option A)**:
1. Add a clarifying code comment to the null/null guard block explaining it now only handles Row 8 (partial reports) after the triage fix. No logic changes.

**Acceptance criteria**:
- [ ] Row 8 (partial reports, null/null) retains auto-approve behavior — `review_verdict: APPROVED`, `review_action: ADVANCED`, `status: COMPLETE` when `report_doc` exists
- [ ] The decision (Option A or other) is documented in the task report with rationale
- [ ] If no code logic change is made, a clarifying comment is added to the null/null guard block
- [ ] No new branches added to `applyTaskTriage`
- [ ] Constants used for all enum comparisons (`REVIEW_VERDICTS.APPROVED`, not string literals)

**Constraints**:
- Do NOT implement Option B (adding `APPROVED` check inside null/null guard — it's mutually exclusive and breaks Row 8)
- Do NOT change the non-null path routing logic
- Row 8's auto-approve behavior MUST be preserved

---

### T03 — Fix YAML Parser Array-of-Objects

**Objective**: Modify the YAML parser's list-item branch to detect key-value pairs in list items and parse them as objects instead of scalar strings, with support for indented continuation lines as additional properties on the same object.

**File targets**:

| File | Path | Action |
|------|------|--------|
| `yaml-parser.js` | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | MODIFY |

**What to change**:
1. **List-item branch (~line 62)**: After extracting `itemContent` from `trimmed.slice(2).trim()`, use `findKeyColon(itemContent)` to detect if the item is a key-value pair.
2. **Key-value path**: If colon found — create an object `{}`, parse first key-value using `parseScalar()`, then consume continuation lines (indented deeper than the `- ` prefix) as additional key-value pairs on the same object. Push the completed object to the current array.
3. **Scalar path**: If no colon found — keep existing `parseScalar(itemContent)` behavior (no regression).
4. **Continuation line loop**: Read subsequent lines while `i + 1 < lines.length`, the next line is non-empty, and its indent is greater than the `- ` line's indent. Parse each continuation line as a key-value pair using `findKeyColon()` and `parseScalar()`. Break on empty line or indent ≤ the list item's indent.

**Acceptance criteria**:
- [ ] `- key: value` list items produce `{ key: value }` objects in the array
- [ ] Multi-line list items (`- id: "T01"` + indented `title: "First"`) produce `{ id: "T01", title: "First" }`
- [ ] `- plain item` (no colon) still produces a scalar string (existing behavior preserved)
- [ ] Continuation lines break on empty line or indent ≤ list item indent
- [ ] Uses existing `findKeyColon()` and `parseScalar()` functions — no new utility functions
- [ ] One level of nesting only — deeply nested structures are explicitly unsupported

**Constraints**:
- Do NOT add recursive descent or multi-level nesting support
- Do NOT modify `findKeyColon()` or `parseScalar()` — use them as-is
- Do NOT change behavior for non-list-item lines
- No new npm dependencies

---

### T04 — Update Test Expectations for New Triage Behavior

**Objective**: Update assertion values in the behavioral test suite to reflect the corrected triage behavior — clean completed tasks now route to code review (`spawn_code_reviewer`) instead of being auto-approved. Only asserted values and setup state values change; no test structure modifications.

**File targets**:

| File | Path | Action |
|------|------|--------|
| `pipeline-behavioral.test.js` | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | MODIFY |

**What to change** (~9 test areas identified by Research):

| Test Area | Describe Block | Approx. Line | Change |
|-----------|---------------|-------------|--------|
| Row 1 isolation | Task Triage | ~623 | Assert `action: SPAWN_CODE_REVIEWER` instead of `GENERATE_PHASE_REPORT`. Assert `review_verdict: null` and `review_action: 'spawn_code_reviewer'` instead of `APPROVED`/`ADVANCED`. |
| Full Happy Path | Full Happy Path | ~229 | Insert code review step between task_completed and generate_phase_report. Assert `SPAWN_CODE_REVIEWER` action after task completion. |
| Multi-Phase Multi-Task | Multi-Phase Multi-Task | ~379 | Same pattern — each task completion now routes to code review before advancing. |
| Row 7 (now Row 8) | Task Triage | ~863 | Row number reference updates only (7 → 8 in detail string assertions). Auto-approve behavior unchanged. |
| Human Gate Modes | Human Gate Modes | ~1346 | Update setup/assertion sequences that rely on auto-approve flow. |
| Retry & Corrective | Retry & Corrective Cycles | ~1603 | Update success path assertions after corrective cycle. |
| Halt Paths | Halt Paths | ~1702 | Update setup sequences relying on auto-approve. |
| Cold-Start Resume | Cold-Start Resume | ~1851 | Update pre-built states if they reference old row numbers. |
| Frontmatter-Driven | Frontmatter-Driven Flows | ~2103 | Update assertions relying on auto-approve for clean tasks. |

**Also update**: Any `makeSuccess` row number references in test assertions that shifted due to the row renumbering (original rows 2–11 → 3–12). Grep for detail strings containing `'Row N:'` patterns and update row numbers accordingly.

**Acceptance criteria**:
- [ ] Row 1 test asserts `action: SPAWN_CODE_REVIEWER` (not `GENERATE_PHASE_REPORT` or auto-approve)
- [ ] Row 1 test asserts `review_verdict: null` and `review_action: 'spawn_code_reviewer'` (not `APPROVED`/`ADVANCED`)
- [ ] Full Happy Path test includes code review step after task completion
- [ ] Row 8 test (formerly Row 7) retains auto-approve assertions, with updated row number reference (7 → 8)
- [ ] All row number references in assertions reflect the new numbering (original 2–11 → 3–12)
- [ ] No new `describe` blocks, `it` blocks, or helper functions added
- [ ] No test structure changes — only assertion values and setup state values modified
- [ ] All assertions use `assert.strictEqual` / `assert.deepStrictEqual` pattern

**Constraints**:
- Do NOT add new tests or test infrastructure
- Do NOT change test organization (describe/it structure)
- Do NOT modify mock IO patterns or state factory functions
- Only change assertion values and pre-built state values that reflect the old auto-approve behavior

---

### T05 — Run Tests and Produce Test Report

**Objective**: Execute the full behavioral test suite after all fixes are applied, capture the results, and produce a structured markdown test report artifact for human triage.

**File targets**:

| File | Path | Action |
|------|------|--------|
| `pipeline-behavioral.test.js` | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | READ (execute via `node --test`) |
| `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` | `.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` | CREATE |

**What to do**:
1. Run the full behavioral test suite: `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js`
2. Capture the test runner output (total tests, pass count, fail count, per-test results, failure details including stack traces)
3. Produce `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` following the Design document structure:
   - **Frontmatter**: project name, type "test-report", author "coder-agent", ISO date, suite "pipeline-behavioral", runner "node --test"
   - **Executive Summary**: Total/pass/fail counts, binary verdict — **PASS** (zero failures) or **FAIL** (one or more)
   - **Summary Statistics**: Table with Total, Passed, Failed, Skipped counts
   - **Results Table**: Per-test row with status (✅/❌), test name, describe block
   - **Failure Details** (if any): One `###` subsection per failure with assertion details, expected/actual values, collapsed `<details>` stack trace
   - **Environment**: Node version, OS, test runner command
   - **Carry-Forward Items**: Known issues observed but out of scope (e.g., `triage_attempts` counter increment for `spawn_code_reviewer`, deep YAML nesting unsupported)

**Acceptance criteria**:
- [ ] Full behavioral test suite executed to completion (no runner crashes)
- [ ] `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` exists in the project folder
- [ ] Report contains total/pass/fail counts matching actual test runner output
- [ ] Report contains binary verdict (**PASS** or **FAIL**) in the executive summary
- [ ] Every test failure has a detail subsection with test name, assertion, expected/actual, and stack trace
- [ ] Carry-forward items section present (even if empty) documenting any known issues observed

**Constraints**:
- Do NOT use any external test frameworks or TAP parsers — native `node --test` output only
- Do NOT modify any source files — this task is read-only execution + report generation
- Test report is plain markdown — no custom formatting beyond what the Design specifies

## Execution Order

```
T01 (triage fix)  ────→ T04 (test expectations) ────→ T05 (run + report)
T02 (mutations guard) ─┘                                    ↑
T03 (yaml-parser)  ──────────────────────────────────────────┘
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T01, T02, and T03 are parallel-ready (no mutual dependencies) but will execute sequentially in v1. T04 requires T01 and T02 (needs to know the new triage behavior and mutations guard decision to set correct assertion values). T05 requires all prior tasks (all fixes and test updates must be in place before running the suite).*

## Phase Exit Criteria

- [ ] Triage Row 1 returns `{ verdict: null, action: 'spawn_code_reviewer' }` for clean completed tasks (FR-1)
- [ ] New Row 1b returns `{ verdict: null, action: 'spawn_code_reviewer' }` for completed tasks with deviations and no review (FR-2)
- [ ] Row 8 (partial reports) retains auto-approve behavior unchanged (FR-4)
- [ ] YAML parser produces objects from `- key: value` list items and scalars from `- item` list items (FR-5, FR-6, FR-7)
- [ ] All test expectations updated to assert new code-review-routing behavior (FR-10)
- [ ] Full behavioral test suite executes to completion via `node --test` (FR-8)
- [ ] `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` exists with total/pass/fail counts and per-failure details (FR-9, FR-11)
- [ ] All tasks complete with status `complete`
- [ ] No new npm dependencies introduced (NFR-2)
- [ ] All fixes use existing architectural patterns — no new pipeline stages, events, or action types (NFR-1)

## Known Risks for This Phase

| Risk | Impact | Mitigation |
|------|--------|------------|
| Row renumbering causes test assertion mismatches — original rows 2–11 shift to 3–12, detail strings and row numbers in tests must all be updated | Medium | Architecture provides complete renumbering table. T04 must update all `makeSuccess` row arguments, detail strings, and test assertions referencing row numbers. |
| Option B for mutations guard (adding `APPROVED` check inside null/null branch) breaks Row 8 auto-approve | High | Architecture explicitly flags Option B as incorrect. T02 handoff will prohibit Option B implementation. |
| Test expectation updates miss integration tests relying on auto-approve flow — ~9 test areas identified but edge cases may exist | Medium | T04 must grep for `REVIEW_VERDICTS.APPROVED` and `GENERATE_PHASE_REPORT` assertions in clean-task-completion contexts. T05 test run will catch any missed updates. |
| YAML parser continuation-line loop consumes too many or too few lines | Medium | Break on empty line or indent ≤ list item indent. Existing scalar list tests validate no-regression. |
| State validator rejects null `review_verdict` with non-null `review_action` after triage writes | Low | Verify validator accepts this combination during T01. If it fails, escalate as blocking issue. |
| `triage_attempts` counter increments for `spawn_code_reviewer` actions, potentially triggering retry exhaustion | Low | Document as carry-forward item in T05 test report if observed. Counter resets on advance after code review completes. |
