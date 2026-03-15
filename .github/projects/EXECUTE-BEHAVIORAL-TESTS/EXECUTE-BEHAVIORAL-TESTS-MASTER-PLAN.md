---
project: "EXECUTE-BEHAVIORAL-TESTS"
total_phases: 1
status: "draft"
author: "architect-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Master Plan

## Executive Summary

The orchestration pipeline's behavioral test suite cannot produce meaningful results because three known bugs — triage Row 1 auto-approving clean tasks instead of routing to code review, a missing triage row for completed tasks with deviations, and the YAML parser treating array-of-objects as scalar strings — cause false failures that obscure real contract violations. This project applies three targeted fixes to existing modules (triage-engine.js, mutations.js, yaml-parser.js), updates test expectations that assert the old buggy behavior, runs the full behavioral test suite, and produces a structured markdown test report for human triage. All changes stay within existing architectural patterns — no new modules, dependencies, or pipeline stages.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [EXECUTE-BEHAVIORAL-TESTS-BRAINSTORMING.md](.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-BRAINSTORMING.md) | ✅ |
| Research | [EXECUTE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md](.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [EXECUTE-BEHAVIORAL-TESTS-PRD.md](.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-PRD.md) | ✅ |
| Design | [EXECUTE-BEHAVIORAL-TESTS-DESIGN.md](.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-DESIGN.md) | ✅ |
| Architecture | [EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md](.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: Triage engine must return "route to code review" when a task is complete, has no deviations, and has no existing review document — replaces current auto-approve for Row 1
- **FR-2**: Triage engine must return "route to code review" when a task is complete, has deviations, and has no existing review document — new decision table row closing the gap
- **FR-4**: Mutation handler must preserve existing behavior for partial/incomplete task reports (Row 7→8) — partial reports retain auto-approve
- **FR-5/FR-6**: YAML parser must parse list items containing key-value pairs as objects, including indented continuation lines as additional properties
- **FR-7**: YAML parser must continue to parse list items without colons as scalar values — no regression
- **FR-10**: Test expectations asserting old auto-approve behavior for clean completed tasks must be updated to assert new code-review-routing behavior
- **NFR-1**: All fixes must work within existing pipeline architecture — no new stages, events, or action types
- **NFR-2**: No new npm dependencies — test suite runs with native test runner and built-in modules only

## Key Technical Decisions (from Architecture)

- **Triage-first fix strategy**: The triage engine change (Row 1 returning `spawn_code_reviewer` instead of null/null) is the primary fix. Row 1 results no longer enter the mutations null/null guard, making the mutations.js guard change optional defense-in-depth rather than required.
- **Row 1b placement**: New row for `complete + deviations + no review` is inserted immediately after Row 1, before rows requiring `review_doc`. All subsequent rows renumber (original 2–11 become 3–12).
- **Mutations guard assessment**: The Architecture recommends evaluating whether to skip the mutations.js change entirely (triage fix alone is sufficient) or add an explicit `REVIEW_VERDICTS.APPROVED` check as defense-in-depth. The null/null path is only reached by Row 8 (partial reports) after the triage fix.
- **YAML parser scope**: One level of nesting for array-of-objects using existing `findKeyColon()` and `parseScalar()`. Deeply nested structures explicitly unsupported.
- **Resolver unchanged**: Branch T11 (`review_doc === null && review_verdict === null → spawn_code_reviewer`) is already correctly implemented — it just becomes reachable after the triage fix.
- **Test expectation updates only**: ~9 test areas affected. Only assertion values and setup state values change — no new describe blocks, it blocks, or helper functions.

## Key Design Constraints (from Design)

- **Test report is plain markdown**: Frontmatter, executive summary, summary statistics table, per-test results table, failure detail subsections with collapsed stack traces, environment section, and carry-forward items
- **Report verdict is binary**: PASS (zero failures) or FAIL (one or more failures) in bold in the executive summary
- **Triage decision table pattern**: New/modified rows must use numbered comments, `makeSuccess()` with 7 args, descriptive detail strings, constants for enum values, and first-match-wins ordering
- **Mutation handler guard pattern**: Use `REVIEW_VERDICTS.APPROVED` constant (not string literals), no new branches
- **YAML parser pattern**: Use existing `findKeyColon()` and `parseScalar()`, stack-based indent tracking for continuation lines
- **Test assertion pattern**: `node:assert/strict` with `assert.strictEqual`/`assert.deepStrictEqual`, assert on canonical fields (`result.action`, `task.review_verdict`, `task.review_action`, `task.status`)

## Phase Outline

### Phase 1: Fix, Verify, and Report

**Goal**: Apply three pipeline bug fixes, update test expectations, run the full behavioral test suite, and produce a structured test report artifact.

**Scope**:
- Fix triage engine Row 1 to return `spawn_code_reviewer` instead of null/null — refs: [FR-1](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-1), [Fix 1 contract](EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md#fix-1-triage-engine--row-1-change-contract)
- Insert new Row 1b for `complete + deviations + no review → spawn_code_reviewer` and renumber subsequent rows — refs: [FR-2](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-2), [Fix 2 contract](EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md#fix-2-triage-engine--new-row-1b)
- Evaluate and apply mutations.js guard change (defense-in-depth) — refs: [FR-3/FR-4](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-3), [Fix 3 contract](EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md#fix-3-mutations--applytasktriage-guard-change)
- Fix YAML parser list-item branch for array-of-objects support — refs: [FR-5/FR-6/FR-7](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-5), [Fix 4 contract](EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md#fix-4-yaml-parser--array-of-objects-support)
- Update test expectations in `pipeline-behavioral.test.js` for new triage behavior — refs: [FR-10](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-10), [Fix 5 contract](EXECUTE-BEHAVIORAL-TESTS-ARCHITECTURE.md#fix-5-test-expectation-updates)
- Run full test suite and produce `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` — refs: [FR-8/FR-9/FR-11](EXECUTE-BEHAVIORAL-TESTS-PRD.md#fr-8), [Design: Test Report](EXECUTE-BEHAVIORAL-TESTS-DESIGN.md#test-report-document)

**Task Summary** (5 tasks, per Architecture phasing recommendations):

| Task | Title | Dependencies | Key Files |
|------|-------|-------------|-----------|
| T1 | Fix triage engine (Row 1 + Row 1b + renumber) | None | `triage-engine.js` |
| T2 | Fix mutations guard (defense-in-depth evaluation) | None | `mutations.js` |
| T3 | Fix YAML parser (array-of-objects) | None | `yaml-parser.js` |
| T4 | Update test expectations | T1, T2 | `pipeline-behavioral.test.js` |
| T5 | Run tests and produce report | T1, T2, T3, T4 | `pipeline-behavioral.test.js` → `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` |

**Dependency graph**:
```
T1 (triage) ──→ T4 (test expectations) ──→ T5 (run + report)
T2 (mutations) ──→ T4
T3 (yaml-parser) ──→ T5
```

Tasks 1, 2, and 3 can execute in parallel. Task 4 requires T1 and T2. Task 5 requires all prior tasks.

**Exit Criteria**:
- [ ] Triage Row 1 returns `{ verdict: null, action: 'spawn_code_reviewer' }` for clean completed tasks
- [ ] New Row 1b returns `{ verdict: null, action: 'spawn_code_reviewer' }` for completed tasks with deviations and no review
- [ ] Row 8 (partial reports) retains auto-approve behavior unchanged
- [ ] YAML parser produces objects from `- key: value` list items and scalars from `- item` list items
- [ ] All test expectations updated to assert new code-review-routing behavior
- [ ] Full behavioral test suite executes to completion via `node --test`
- [ ] `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` exists with total/pass/fail counts and per-failure details

**Phase Doc**: `phases/EXECUTE-BEHAVIORAL-TESTS-PHASE-01-FIX-VERIFY-REPORT.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml) — this project uses 1
- **Max tasks per phase**: 8 (from orchestration.yml) — this project uses 5
- **Max retries per task**: 2
- **Git strategy**: Single branch, sequential commits, `[orch]` prefix
- **Human gates**: After planning (master plan approval) and after final review. Execution mode: `ask`

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Row renumbering causes test assertion mismatches — original rows 2–11 shift to 3–12, detail strings and row numbers in tests must all be updated | Medium | Architecture provides complete renumbering table. Coder must update all `makeSuccess` row arguments, detail strings, and test assertions referencing row numbers. | Coder |
| Mutation handler guard change (FR-3 Option B) breaks Row 8 auto-approve — `verdict === null` and `verdict === APPROVED` are mutually exclusive inside null/null guard | High | Architecture flags Option B as incorrect. If mutations.js is changed, the guard must NOT add an `APPROVED` check inside the null/null branch. Triage fix alone is sufficient; mutations change is optional. | Coder |
| Test expectation updates miss integration tests relying on auto-approve flow — ~9 test areas identified but edge cases may exist | Medium | Research identified all affected describe blocks with line numbers. Coder must grep for `REVIEW_VERDICTS.APPROVED` and `GENERATE_PHASE_REPORT` assertions in clean-task-completion contexts. | Coder |
| YAML parser continuation-line loop consumes too many or too few lines | Medium | Break on empty line or indent ≤ list item indent. Existing scalar list tests validate no-regression. New object tests validate correct consumption. | Coder |
| `triage_attempts` counter increments for `spawn_code_reviewer` actions, potentially triggering retry exhaustion on heavily-triaged tasks | Low | Counter resets on advance after code review completes. Document as carry-forward item in test report if observed — not fixed in this project. | Reviewer |
| State validator rejects null `review_verdict` with non-null `review_action` after triage writes | Low | Verify validator accepts this combination. If it fails, this is a blocking issue requiring a validator update (would expand scope). | Coder |
