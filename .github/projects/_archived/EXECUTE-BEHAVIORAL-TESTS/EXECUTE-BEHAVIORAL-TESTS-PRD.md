---
project: "EXECUTE-BEHAVIORAL-TESTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Product Requirements

## Problem Statement

The orchestration pipeline's behavioral test suite (produced by the PIPELINE-BEHAVIORAL-TESTS project) cannot be meaningfully executed because three known bugs cause false failures — noise that obscures real behavioral contract violations. Triage Row 1 auto-approves clean completed tasks instead of routing them through code review, the triage decision table has no row for completed tasks with deviations but no review, and the YAML parser cannot parse arrays of objects in frontmatter. Until these bugs are fixed, running the test suite yields unreliable results, and there is no structured artifact for a human to triage test outcomes.

## Goals

- **G1: Restore code review enforcement for clean completed tasks** — Completed tasks with no deviations and no existing review must be routed to code review, not auto-approved. The most common task completion path must no longer bypass the code review step.
- **G2: Close the triage decision table gap for completed tasks with deviations** — Completed tasks that have deviations but no existing review must be routed to code review. The triage engine must return a deterministic result for every valid combination of task completion state.
- **G3: Enable YAML parsing of arrays of objects** — List items containing key-value pairs must be parsed as objects (not scalar strings), restoring functionality for frontmatter structures that include arrays of objects (e.g., phase plan task lists).
- **G4: Execute the full behavioral test suite and produce a test report** — After all fixes are applied, run the entire behavioral test suite and produce a structured pass/fail report that a human can use to assess pipeline health and decide whether follow-on fixes are needed.

## Non-Goals

- **NG1: Custom test runner or TAP parser** — Native test runner output is sufficient. No custom runner scripts, output parsers, or reporting frameworks.
- **NG2: CI integration or scheduled execution** — Execution is a one-time manual run. Automated scheduling or CI pipeline integration is out of scope.
- **NG3: Observation tagging** — Slow test detection, flaky test identification, and performance annotations are out of scope for this fix-and-verify pass.
- **NG4: Structural changes to tests** — The test suite structure (describe blocks, test organization, helper utilities) must not be modified. Only test expectations (asserted values) may be updated where they assert the old buggy behavior.
- **NG5: Deep nesting in YAML parser** — One level of nesting for array-of-objects is sufficient. Deeply nested YAML structures are out of scope.
- **NG6: Changes to Row 7 (partial report) behavior** — Partial/incomplete task reports (Row 7) must retain their current behavior. Partial reports are not ready for code review; they represent in-progress work that will be re-triaged on next completion. Only the mutation handler's auto-approve guard needs to distinguish "complete + clean → route to review" from "partial → keep current behavior."
- **NG7: Structural changes to the pipeline engine flow** — Fixes must stay within existing architecture: triage table values, missing rows, parser logic, and mutation guards. No new pipeline stages, events, or action types.

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Pipeline operator | have clean completed tasks routed through code review | every task gets a review before advancing, and the reviewer resolver branch is no longer dead code for the most common path | P0 |
| 2 | Pipeline operator | have completed tasks with deviations (but no review) routed to code review | the triage engine returns a deterministic result instead of a "no row matched" error | P0 |
| 3 | Pipeline operator | have the YAML parser correctly parse arrays of objects in frontmatter | phase plan pre-read blocks can extract task lists and other structured frontmatter data | P0 |
| 4 | Pipeline operator | see partial (incomplete) task reports remain auto-approved as today | in-progress work is re-triaged on next completion without being prematurely sent to code review | P0 |
| 5 | Human reviewer | receive a structured test report after the full suite runs | I can triage pass/fail results and decide whether follow-on fixes are needed without reading raw terminal output | P1 |
| 6 | Human reviewer | see per-failure details (test name, assertion, stack trace) in the test report | I can understand what failed and why, without re-running tests locally | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The triage engine must return a "route to code review" result when a task is complete, has no deviations, and has no existing review document. | P0 | Replaces current auto-approve behavior for Row 1. |
| FR-2 | The triage engine must return a "route to code review" result when a task is complete, has deviations, and has no existing review document. | P0 | New decision table row — closes the gap that causes "no row matched" errors. |
| FR-3 | The mutation handler must only set a task to auto-approved status when the triage engine explicitly returns an "approved" verdict. A null verdict must not be interpreted as approval. | P0 | Guards the auto-approve path. Ensures Row 1 fix flows through to the resolver. |
| FR-4 | The mutation handler must preserve existing behavior for partial/incomplete task reports (Row 7). When triage returns null verdict and null action for a partial report, the task must retain its current auto-approve-on-report behavior. | P0 | Prevents the FR-3 guard from breaking Row 7. The guard distinguishes by checking whether the triage verdict is explicitly "approved" rather than matching on null/null. |
| FR-5 | The YAML parser must parse list items containing key-value pairs as objects instead of scalar strings. | P0 | `- key: value` must produce `{ key: value }`, not the string `'key: value'`. |
| FR-6 | The YAML parser must parse indented continuation lines after a list-item key-value pair as additional properties on the same object. | P0 | Multi-line list items like `- id: T01` followed by indented `title: First` must produce `{ id: "T01", title: "First" }`. |
| FR-7 | The YAML parser must continue to parse list items without colons as scalar values. | P0 | Existing scalar list behavior (e.g., `- item1`, `- item2`) must not regress. |
| FR-8 | After all fixes are applied, the full behavioral test suite must be executed and a test report produced. | P1 | Single execution pass using native test runner. |
| FR-9 | The test report must include: total test count, pass count, fail count, and a per-failure section with test name, assertion details, and stack trace. | P1 | Plain markdown format. |
| FR-10 | Test expectations in the behavioral test suite that assert the old auto-approve behavior for clean completed tasks must be updated to assert the new code-review-routing behavior. | P0 | This includes the Row 1 isolation test plus any integration tests (happy path, multi-phase, gate modes, etc.) that rely on the old auto-approve flow. Only asserted values change — test structure remains intact. |
| FR-11 | The test report must be saved as a project artifact in the project folder. | P1 | File name: `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`. |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Compatibility | All fixes must work within the existing pipeline architecture — no new pipeline stages, events, action types, or enum values. |
| NFR-2 | Compatibility | No new npm dependencies. The test suite runs with the native test runner and built-in modules only. |
| NFR-3 | Correctness | The state validator must continue to pass after mutations and triage. Fixes must not violate existing validation invariants. |
| NFR-4 | Correctness | The triage engine's first-match-wins evaluation order must be preserved. New or modified rows must be placed so they do not shadow existing rows or create unreachable conditions. |
| NFR-5 | Correctness | The resolver's existing branch for "no review doc and no verdict → spawn code reviewer" must become reachable for clean completed tasks after the fix. No changes to the resolver are required. |
| NFR-6 | Maintainability | Decision table rows must follow the existing pattern: numbered comments, descriptive detail strings, and consistent use of the result constructor. |
| NFR-7 | Scope control | YAML parser changes are limited to one level of nesting for array items. Deeply nested structures are explicitly unsupported. |

## Assumptions

- The three bugs documented in the PIPELINE-BEHAVIORAL-TESTS error log are the only blocking issues preventing meaningful test execution. No additional undocumented bugs exist in the triage engine, mutation handler, or YAML parser that would affect the same code paths.
- The resolver's "spawn code reviewer" branch (T11) is already correctly implemented and only needs to become reachable — no resolver changes are required.
- The mutation handler's non-null action path correctly writes triage results to the task and falls through action routing when the action is not in the review actions enum. This fall-through behavior is intentional and correct for "spawn code reviewer" actions.
- The existing YAML parser test file uses a custom test harness (not the native test runner) and is run separately. The behavioral test suite and YAML parser tests are independent.
- The behavioral test suite's mock IO and state factory patterns are sufficient for testing the fixed behavior — no new test infrastructure is needed.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Mutation handler guard for FR-3/FR-4 incorrectly breaks Row 7 (partial report) auto-approve behavior | High | FR-4 explicitly requires Row 7 preservation. The guard must check for explicit "approved" verdict rather than matching on null/null. Row 7 tests in the suite will catch regressions. |
| 2 | Test expectation updates (FR-10) are more extensive than anticipated — many integration tests rely on the old auto-approve flow | Medium | Research identified ~9 test areas affected. The scope is limited to assertion value changes only, not structural test changes. Each affected test is traceable from the research findings. |
| 3 | Triage row insertion shifts row numbers, breaking row-number references in log messages or assertions | Low | Row numbers are descriptive labels in detail strings, not functional identifiers. Update detail strings and test assertions for shifted rows. |
| 4 | YAML parser fix introduces regressions for existing scalar list parsing | Medium | FR-7 explicitly requires scalar list behavior preservation. Existing YAML parser tests cover scalar lists and must continue to pass. |
| 5 | The `triage_attempts` counter increments for spawn-code-reviewer triage results, potentially triggering retry exhaustion on tasks that cycle through triage multiple times | Low | Research flagged this as a consideration. The counter increment is on the non-null path. If this proves problematic during test execution, it should be documented in the test report as a carry-forward item — not fixed in this project. |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Triage Row 1 behavior | Clean completed tasks route to code review instead of auto-approve | Row 1 behavioral test asserts spawn-code-reviewer action |
| Triage completeness | No "no row matched" error for complete + deviations + no review | New row behavioral test asserts spawn-code-reviewer action |
| Row 7 preservation | Partial task reports retain auto-approve behavior | Row 7 behavioral test continues to pass unchanged |
| YAML array-of-objects | Parser produces objects from key-value list items | YAML parser tests pass for array-of-objects input |
| Test suite execution | Full behavioral suite runs to completion | Test report artifact exists with total/pass/fail counts |
| Test report quality | All failures documented with name, assertion, and stack trace | Test report contains per-failure detail sections |
