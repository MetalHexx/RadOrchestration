---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
title: "ENGINE-ASSEMBLY"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-ENGINE"
    title: "Pipeline Engine Module"
  - id: "T02-ENGINE-TESTS"
    title: "Engine Integration Tests & Test Infrastructure"
  - id: "T03-BEHAVIORAL-CORE"
    title: "Behavioral Tests — Core Flows"
  - id: "T04-BEHAVIORAL-EDGE"
    title: "Behavioral Tests — Edge Cases & Review Tier"
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
---

# Phase 3: ENGINE-ASSEMBLY

## Phase Goal

Wire all six existing lib-v3 modules into the declarative `processEvent` engine recipe and validate end-to-end behavior with a comprehensive behavioral test suite covering all 10 scenario categories — replacing the current 2,200+ line behavioral tests with tests for the new one-write-per-event semantics.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-SIMPLIFICATION-MASTER-PLAN.md) | Phase 3 scope (pipeline-engine.js + behavioral tests), exit criteria, execution constraints |
| [Architecture](../PIPELINE-SIMPLIFICATION-ARCHITECTURE.md) | `processEvent` contract, `scaffoldInitialState` signature, cross-module dependency graph, PipelineIO interface, PipelineResult contract, CLI interface |
| [Design](../PIPELINE-SIMPLIFICATION-DESIGN.md) | Entry point readability rules (~20-line recipe), test authoring patterns (createMockIO, state factories, assertion patterns), test organization (10 scenario categories), 7 developer flows |
| [PRD](../PIPELINE-SIMPLIFICATION-PRD.md) | FR-14 (single linear code path), FR-15 (execution sequence), FR-16 (result contract unchanged), FR-17 (behavioral test suite rewrite), FR-18 (per-module unit tests) |
| [Phase 2 Report](PIPELINE-SIMPLIFICATION-PHASE-REPORT-P02.md) | 5 carry-forward items (see below) |
| [Phase 2 Review](PIPELINE-SIMPLIFICATION-PHASE-REVIEW-P02.md) | 4 recommendations (see below) |

## Carry-Forward Items from Phase 2

| # | Item | Source | Addressed In |
|---|------|--------|-------------|
| CF-1 | End-to-end review tier behavioral test: verify `state.execution.final_review_doc` and `state.execution.final_review_approved` through wired modules (`final_review_completed` → `code_review_completed` → `final_approved`) | Phase Report + Phase Review | T04 |
| CF-2 | Add `report_status: null` to task template in `handlePhasePlanCreated` (mutations.js) — minor schema completeness fix | Phase Review Observation #1 | T01 |
| CF-3 | `makeReviewState()` test factory cleanup — remove top-level `final_review` object if v3 schema formalizes without it | Phase Report + Phase Review | T02 |
| CF-4 | Architecture doc `validateTransition` parameter discrepancy (2 vs 3 params) — carried from Phase 1 | Phase Report | Deferred to Phase 4 (documentation alignment) |
| CF-5 | `halted` tier coverage in V10 — confirm no edge case when wiring `validateTransition` into `processEvent` | Phase Report | T02 (validated in engine integration tests) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Pipeline Engine Module | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T02 | Engine Integration Tests & Test Infrastructure | T01 | `create-task-handoff` | 1 | *(created at execution time)* |
| T03 | Behavioral Tests — Core Flows | T01, T02 | `create-task-handoff` | 1 | *(created at execution time)* |
| T04 | Behavioral Tests — Edge Cases & Review Tier | T01, T03 | `create-task-handoff` | 1 | *(created at execution time)* |

### T01 — Pipeline Engine Module

**Objective**: Create `lib-v3/pipeline-engine.js` — the ~70-line module that wires all six existing modules into the declarative `processEvent` recipe: load → pre-read → mutate → validate → write → resolve → return. Also includes `scaffoldInitialState` for new project initialization, `handleInit` for first-run, and `handleColdStart` for resuming existing projects with a `start` event.

**Scope**:
- CREATE `.github/orchestration/scripts/lib-v3/pipeline-engine.js`
  - `processEvent(event, projectDir, context, io, configPath)` → PipelineResult
  - `scaffoldInitialState(config, projectDir)` → StateJson (v3 schema, no `triage_attempts`)
  - `handleInit` — early return: scaffold → ensureDirectories → write → resolve → return
  - `handleColdStart` — early return: resolve only, no mutation, no write
  - Standard path: preRead → getMutation → deepClone(state) → mutate → validate → writeState → resolve → return
  - No branching by event type in the standard path
  - Unknown event (no mutation handler) → failure result
- MODIFY `.github/orchestration/scripts/lib-v3/mutations.js`
  - Add `report_status: null` to the task template object in `handlePhasePlanCreated` (carry-forward CF-2)

**Key contracts to implement**:
- `processEvent` follows the linear recipe per Architecture §processEvent and Design §Pipeline Entry Point Readability
- `PipelineResult { success, action, context, mutations_applied }` per Architecture §PipelineResult
- Three error categories: pre-read failure → structured result, validation failure → structured result with violations array, unknown event → structured result
- Exactly one `io.writeState` call per successful standard event; zero calls on any failure path
- `scaffoldInitialState` produces `$schema: 'orchestration-state-v3'`, no `triage_attempts` fields

### T02 — Engine Integration Tests & Test Infrastructure

**Objective**: Create `tests-v3/pipeline-engine.test.js` with the shared test infrastructure (`createMockIO`, state factories) and integration tests that verify all engine paths: init, cold-start, standard event, pre-read failure, validation failure, and unknown event.

**Scope**:
- CREATE `.github/orchestration/scripts/tests-v3/pipeline-engine.test.js`
  - Test infrastructure: `createMockIO({ state, documents, config })` per Design §Mock I/O Factory
  - State factories: `createBaseState(overrides?)`, `createExecutionState(overrides?)`, `createReviewState(overrides?)` per Design §State Factory Functions
  - Test suites:
    - `describe('processEvent — init path')` — no state + start → scaffold + write + spawn_research
    - `describe('processEvent — cold-start path')` — state exists + start → resolve only, 0 writes
    - `describe('processEvent — standard event path')` — successful mutation → 1 write, correct result
    - `describe('processEvent — pre-read failure')` — malformed document → 0 writes, structured error
    - `describe('processEvent — validation failure')` — invariant violation → 0 writes, violations in context
    - `describe('processEvent — unknown event')` — no handler → 0 writes, failure result
    - `describe('scaffoldInitialState')` — produces valid v3 state, correct schema version, no triage fields
  - Carry-forward CF-5: include a test confirming `validateTransition` in `halted` tier does not produce false positives
  - Carry-forward CF-3: ensure `createReviewState` factory does not include top-level `final_review` object

**Key assertions**:
- `io.getWrites().length === 1` for successful standard events
- `io.getWrites().length === 0` for all failure paths
- Result shape conforms to `PipelineResult` contract
- `scaffoldInitialState` output has `$schema: 'orchestration-state-v3'`

### T03 — Behavioral Tests — Core Flows

**Objective**: Create `tests-v3/pipeline-behavioral.test.js` with end-to-end behavioral tests covering the first 5 scenario categories: full happy path, multi-phase/multi-task, cold-start resume, pre-read validation failures, and phase lifecycle.

**Scope**:
- CREATE `.github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js`
  - Import test infrastructure from pipeline-engine.test.js OR self-contain factories (per Design §Test Infrastructure Rules: no cross-file factory imports — each test file self-contains its factories)
  - Scenario categories:
    1. **Full happy path (single phase, single task)**: init → research → prd → design → architecture → master_plan → plan_approved → phase_plan_created → task_handoff_created → task_completed → code_review_completed → phase_report_created → phase_review_completed → final_review_completed → final_approved → display_complete
    2. **Multi-phase/multi-task**: 2+ phases, 2+ tasks per phase — verify pointer advances, phase transitions, and tier transitions through full execution
    3. **Cold-start resume**: existing state at various points → start event → resolver produces correct next action, 0 writes
    4. **Pre-read validation failures**: all 5 pre-read events with malformed documents — verify 0 writes, structured error with event and field names
    5. **Phase lifecycle**: plan → task handoffs → code → review → report → phase review → next phase — verify phase status transitions and pointer advances
  - Design rules: one `processEvent` call per `it` block; verify `io.getWrites().length === 1` per successful event
  - Self-contained factories: `createMockIO`, `createBaseState`, `createExecutionState` duplicated in this file

### T04 — Behavioral Tests — Edge Cases & Review Tier

**Objective**: Extend `tests-v3/pipeline-behavioral.test.js` with the remaining 5 scenario categories: retry & corrective cycles, halt paths, human gate modes, frontmatter-driven flows, and review tier end-to-end. This completes the 10-category coverage requirement.

**Scope**:
- MODIFY `.github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js`
  - Scenario categories:
    6. **Retry & corrective cycles**: changes_requested verdict → task retries increment → corrective handoff issued with `context.is_correction: true` → re-execute → second review → approved
    7. **Halt paths**: task halt (rejected verdict), task halt (retry budget exhausted), phase halt (phase review rejected) — verify `display_halted` action with descriptive `context.details`
    8. **Human gate modes**: test `ask`, `phase`, `task`, `autonomous` modes — verify gate actions emitted (or skipped) per config
    9. **Frontmatter-driven flows**: `phase_plan_created` with tasks array → tasks initialized in state; `plan_approved` with `total_phases` → phases scaffolded
    10. **Review tier end-to-end** (carry-forward CF-1): `final_review_completed` → verify `state.execution.final_review_doc` set; `final_approved` → verify `state.execution.final_review_approved: true` and `current_tier: 'complete'`; full flow through `resolveReview` → `display_complete`
  - Design rules: same as T03 — one `processEvent` per `it`, single write assertion
  - Final validation: run full `tests-v3/` suite (all 7 test files) to confirm zero regressions against Phase 1 + Phase 2 tests

## Execution Order

```
T01 (Pipeline Engine Module)
 └→ T02 (Engine Integration Tests — depends on T01)
     └→ T03 (Behavioral Core — depends on T01, T02)
         └→ T04 (Behavioral Edge — depends on T01, T03)
```

**Sequential execution order**: T01 → T02 → T03 → T04

*No parallel-ready pairs — each task builds on its predecessor: T02 needs the engine to test, T03 needs both the engine and the test infrastructure, T04 extends the behavioral test file from T03.*

## Phase Exit Criteria

- [ ] `processEvent` follows the linear recipe with no branching by event type in the standard path; init and cold-start are early returns
- [ ] `scaffoldInitialState` produces valid v3 state (`$schema: 'orchestration-state-v3'`, no `triage_attempts` fields)
- [ ] `handlePhasePlanCreated` task template includes `report_status: null` (carry-forward CF-2)
- [ ] Behavioral test suite covers all 10 scenario categories from the Master Plan
- [ ] Every behavioral test verifies exactly one `writeState` call per successful standard event (`io.getWrites().length === 1`)
- [ ] Every failure path behavioral test verifies zero `writeState` calls (`io.getWrites().length === 0`)
- [ ] Review tier end-to-end flow tested through wired modules (carry-forward CF-1)
- [ ] `createReviewState` factory does not scaffold `state.final_review` top-level object (carry-forward CF-3)
- [ ] Full `tests-v3/` test suite passes (all 7+ test files: Phase 1 + Phase 2 + Phase 3, zero regressions)
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all 7 lib-v3 modules importable via `require()`)

## Known Risks for This Phase

- **Cross-module integration gaps**: The engine wires 6 modules together for the first time — subtle contract mismatches (like the final review state path fixed in P02-T05) may surface. Mitigation: the integration test suite (T02) exercises every path through the wired engine before behavioral tests begin.
- **Behavioral test scope**: The 10-category behavioral suite is the largest deliverable of the project. Risk of incomplete coverage or tests that verify the wrong invariant. Mitigation: split into two tasks (T03 core flows, T04 edge cases) so review catches gaps early; each test names its scenario category explicitly.
- **Test file size**: The behavioral test file may approach 1,000+ lines. This is acceptable for a behavioral test suite (the current one is 2,200+ lines). The file is organized by `describe` blocks per scenario category for navigability.
- **V10 halted tier edge case** (carry-forward CF-5): The validator's `checkV10` falls through silently for `halted` tier — must confirm this doesn't produce false positives when the engine calls `validateTransition` with `halted` tier state. Mitigation: dedicated integration test in T02.
