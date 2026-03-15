---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 3
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-14T00:00:00Z"
---

# Code Review: Phase 3, Task 3 — BEHAVIORAL-CORE

## Verdict: APPROVED

## Summary

The behavioral test suite is well-structured, comprehensive, and correctly exercises the engine's multi-event sequences across all 5 required categories. All 44 tests pass, the full suite (356 tests) shows zero regressions, and every acceptance criterion from the handoff is met. Two engine-level deviations (`task_completed` resolver gap, phase advance prematurity) are accurately documented with `// DEVIATION:` comments that explain root cause and expected-vs-actual behavior — these are engine bugs, not test defects.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | Tests import only `processEvent` from `pipeline-engine.js` and helpers from `test-helpers.js` — no direct imports from domain modules. Dependency injection via `createMockIO` is used correctly throughout. |
| Design consistency | ✅ | N/A — CLI test suite, no UI components. |
| Code quality | ✅ | Clean structure with section separators, consistent naming, well-documented helpers (`backdateTimestamp`, `makeDoc`, `makeExecutionStartState`). DEVIATION comments are clear and explain root cause. `'use strict'` enforced. |
| Test coverage | ✅ | 44 tests across 5 categories: happy path (15), multi-phase/multi-task (13), cold-start resume (5), pre-read failures (5), phase lifecycle (6). Every successful event asserts exactly 1 additional write. Every failure asserts 0 writes. |
| Error handling | ✅ | Category 4 thoroughly validates all 5 pre-read events with malformed documents, asserting structured error responses with `event` and `field` identifiers. Category 3 confirms cold-start paths produce zero mutations. |
| Accessibility | ✅ | N/A — CLI test suite. |
| Security | ✅ | No secrets, credentials, or sensitive data. Test constants are synthetic. |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| — | — | — | — | No issues found | — |

## Positive Observations

- **Thorough deviation documentation**: Every engine discrepancy is annotated with a `// DEVIATION:` comment in the test and appears in the `it` description string (e.g., `"display_halted (DEVIATION: expected spawn_code_reviewer)"`). This makes it trivially easy to distinguish intentional assertions from bugs when reading test output.

- **Consistent 1-write-per-event verification**: Every successful standard-path test increments `writeCount` and asserts `io.getWrites().length === writeCount`. This enforces the core architectural invariant (one event → one write) at the behavioral level, complementing the integration tests.

- **Smart state factories**: `makeExecutionStartState(totalPhases)` cleanly produces post-`plan_approved` state with full planning history and V13 safety. This reduces per-test boilerplate and keeps test setup readable.

- **V13 workaround is well-justified**: Using `delete state.project.updated` (rather than the handoff's suggested backdating) is the correct approach and matches the existing `stripTimestamp` pattern from integration tests. The task report clearly explains why backdating alone is insufficient.

- **Category 2 state assertions**: Multi-phase tests verify not just the returned action but also internal state transitions — `execution.current_phase` advances, `phases[0].status` becomes `complete`, tier transitions from `execution → review → complete`. This goes beyond action-level assertions and validates mutation correctness.

- **Category 3 isolation**: Each cold-start test creates its own `io` with an independent state snapshot, preventing inter-test coupling — the right design choice for stateless resume verification.

- **Category 4 uses planning-tier state**: Pre-read validation fires before mutation, so the specific tier of the state is irrelevant. Using `createBaseState()` for all 5 failure tests is correct and avoids unnecessary setup complexity.

## Recommendations

- **Engine fix: `task_completed` resolver gap** (Deviation 1): The resolver needs a branch for `task.status === 'in_progress' && task.handoff_doc && task.report_doc` → `spawn_code_reviewer`. This is the highest-priority engine bug — without it, the happy path emits `display_halted` after every `task_completed` event. Once fixed, the DEVIATION assertions in Categories 1, 2, and 5 should be updated to assert `spawn_code_reviewer`.

- **Engine fix: phase advance prematurity** (Deviation 2): `handlePhaseReviewCompleted` should either leave the next phase at `not_started` (letting the resolver return `create_phase_plan`) or the resolver should treat `in_progress + total_tasks === 0` as needing a phase plan. Once fixed, Category 2 Step 9 and Category 5 Step 6 should be updated.

- **Track deviation cleanup**: When the engine fixes above are implemented (likely a future task), the test file will need a pass to flip DEVIATION assertions back to expected values. Consider noting this in the phase plan or a carry-forward item.
