---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
title: "Behavioral Test Suite"
status: "active"
total_tasks: 5
tasks:
  - id: "T01-SCAFFOLD-HAPPY-PATH"
    title: "Test Scaffold, Factory Functions & Happy Path"
    depends_on: []
  - id: "T02-TASK-TRIAGE-ROWS"
    title: "Task-Level Triage Rows 1–11"
    depends_on: ["T01-SCAFFOLD-HAPPY-PATH"]
  - id: "T03-PHASE-TRIAGE-ROWS"
    title: "Phase-Level Triage Rows 1–5"
    depends_on: ["T01-SCAFFOLD-HAPPY-PATH"]
  - id: "T04-GATES-RETRIES-HALTS"
    title: "Gate Modes, Retry/Corrective Cycles & Halt Paths"
    depends_on: ["T01-SCAFFOLD-HAPPY-PATH"]
  - id: "T05-RESUME-PREREADS-FRONTMATTER"
    title: "Cold-Start Resume, Pre-Read Failures & Frontmatter-Driven Flows"
    depends_on: ["T01-SCAFFOLD-HAPPY-PATH"]
author: "tactical-planner-agent"
created: "2026-03-14T19:00:00Z"
---

# Phase 3: Behavioral Test Suite

## Phase Goal

Create the comprehensive behavioral test file (`pipeline-behavioral.test.js`) covering all end-to-end pipeline execution paths — triage rows, gate modes, retry/corrective cycles, halt paths, cold-start resume, pre-read validation failures, and frontmatter-driven flows — validating the contract changes from Phases 1 and 2 through integrated behavioral scenarios.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-BEHAVIORAL-TESTS-MASTER-PLAN.md) | Phase 3 scope, exit criteria, execution constraints |
| [Architecture](../PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | Module map, `executePipeline` contract, pre-read contracts, triage contracts, factory function patterns, test file structure, cross-cutting concerns (test isolation, `withStrictDates`, mock IO) |
| [Design](../PIPELINE-BEHAVIORAL-TESTS-DESIGN.md) | All 11 task triage rows with exact inputs/actions/test labels, all 5 phase triage rows, `readDocument` call site state table, behavioral test assertion states, error feedback conventions, discoverability conventions |
| [PRD](../PIPELINE-BEHAVIORAL-TESTS-PRD.md) | FR-10 through FR-23 (behavioral test requirements), NFR-1 through NFR-7 (test infrastructure constraints) |
| [Phase 1 Report](../reports/PIPELINE-BEHAVIORAL-TESTS-PHASE-01-REPORT.md) | Carry-forward: behavioral tests should cover null-return paths (`readDocument` null return, `createProjectAwareReader` null-check fallback, both-paths-null) |
| [Phase 2 Report](../reports/PIPELINE-BEHAVIORAL-TESTS-PHASE-02-REPORT.md) | Carry-forward: (1) exercise new pre-read validation paths (`phase_plan_created` missing doc/missing `tasks`/empty `tasks`, `task_completed` missing `has_deviations`/`deviation_type`, `triagePhase` missing `exit_criteria_met`), (2) verify frontmatter-driven triage flows, (3) verify `context.report_deviation_type` extraction |
| [pipeline-engine.test.js](../../orchestration/scripts/tests/pipeline-engine.test.js) | Test patterns: `createMockIO`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `createDefaultConfig` factory functions |
| [triage-engine.test.js](../../orchestration/scripts/tests/triage-engine.test.js) | Triage test patterns: row labeling, `mockReadDocument`, frontmatter fixture construction |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Test Scaffold, Factory Functions & Happy Path | — | `create-task-handoff` | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P03-T01-SCAFFOLD-HAPPY-PATH.md) |
| T02 | Task-Level Triage Rows 1–11 | T01 | `create-task-handoff` | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P03-T02-TASK-TRIAGE-ROWS.md) |
| T03 | Phase-Level Triage Rows 1–5 | T01 | `create-task-handoff` | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P03-T03-PHASE-TRIAGE-ROWS.md) |
| T04 | Gate Modes, Retry/Corrective Cycles & Halt Paths | T01 | `create-task-handoff` | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P03-T04-GATES-RETRIES-HALTS.md) |
| T05 | Cold-Start Resume, Pre-Read Failures & Frontmatter-Driven Flows | T01 | `create-task-handoff` | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P03-T05-RESUME-PREREADS-FRONTMATTER.md) |

### T01 — Test Scaffold, Factory Functions & Happy Path

**Objective**: Create `pipeline-behavioral.test.js` with all factory functions (duplicated locally per Architecture guidance), imports, and two foundational behavioral tests: the full single-phase single-task happy path (start → plan → approve → execute → complete) and the multi-phase multi-task scenario (≥2 phases × ≥2 tasks).

**Scope**:
- CREATE `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- Imports: `node:test` (`describe`, `it`), `node:assert/strict`, `executePipeline` from `pipeline-engine.js`, constants from `constants.js`
- Duplicate factory functions locally: `createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`
- `describe("Behavioral: Full Happy Path")`: Single-phase single-task from `start` through all planning steps, `plan_approved`, execution (phase plan created → task handoff created → task completed → code reviewed → triage → phase report → phase review → phase triage), final review, final approval, and `display_complete` (FR-11)
- `describe("Behavioral: Multi-Phase Multi-Task")`: ≥2 phases × ≥2 tasks, validates phase/task advancement chaining and `current_phase` increment (FR-12)
- All tests use `withStrictDates` for triage/internal-action loops (NFR-3)
- PRD refs: FR-10, FR-11, FR-12, NFR-1, NFR-2, NFR-4, NFR-7

**Estimated files**: 1 (CREATE)

---

### T02 — Task-Level Triage Rows 1–11

**Objective**: Add `describe("Behavioral: Task Triage")` block with 11 tests covering every task-level triage decision row, using the exact row numbers, inputs, and test label conventions from the Design doc.

**Scope**:
- MODIFY `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- One test per row (Rows 1–11), each exercising `executePipeline` with a `task_completed` or `code_review_completed` event and appropriate mock documents
- Row inputs use REQUIRED frontmatter fields (`has_deviations`, `deviation_type`) — no legacy fallback fields
- Test names follow convention: `"Row N: {status}, {conditions} → {expected action}"` (Design doc §Triage Engine States)
- Assertions: `result.action` matches expected, state mutations match (e.g., `review_action` set correctly)
- Carry-forward from Phase 2: verify `context.report_deviation_type` propagation through triage for rows 3–4
- PRD refs: FR-13, FR-20

**Estimated files**: 1 (MODIFY)

---

### T03 — Phase-Level Triage Rows 1–5

**Objective**: Add `describe("Behavioral: Phase Triage")` block with 5 tests covering every phase-level triage decision row, using REQUIRED `exit_criteria_met` field from the Phase Review frontmatter.

**Scope**:
- MODIFY `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- One test per row (Phase Rows 1–5), each exercising `executePipeline` with a `phase_review_completed` event and appropriate mock documents
- Row inputs use REQUIRED `exit_criteria_met` (boolean) — no legacy fallback
- Test names follow convention: `"Phase Row N: {conditions} → {expected action}"` (Design doc §Phase-Level Triage)
- Assertions: `result.action` matches expected, phase state mutations correct (e.g., `phase_review_action`)
- Carry-forward from Phase 2: verify `exit_criteria_met` drives row selection, no fallback treating undefined as true
- PRD refs: FR-14, FR-20

**Estimated files**: 1 (MODIFY)

---

### T04 — Gate Modes, Retry/Corrective Cycles & Halt Paths

**Objective**: Add test sections for human gate mode behavior, retry/corrective task cycles (including retry exhaustion → halt), and halt paths from rejected reviews and critical failures.

**Scope**:
- MODIFY `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- `describe("Behavioral: Human Gate Modes")`: Tests for `autonomous` (no gate), `ask` (gate at each decision point), `task` (gate per task), `phase` (gate per phase) — verifies gate actions vs. auto-advance (FR-15)
- `describe("Behavioral: Retry & Corrective Cycles")`: Task receives `changes_requested` → corrective task issued → retry → resolution; retry exhaustion (`retries >= max_retries_per_task`) → halt (FR-16)
- `describe("Behavioral: Halt Paths")`: Rejected review → halt at task level (Row 6, Row 9); rejected review → halt at phase level (Phase Row 5); critical failure → halt (Row 11) (FR-17)
- All retry/triage tests use `withStrictDates` (NFR-3)
- PRD refs: FR-15, FR-16, FR-17

**Estimated files**: 1 (MODIFY)

---

### T05 — Cold-Start Resume, Pre-Read Failures & Frontmatter-Driven Flows

**Objective**: Add test sections for cold-start resume, pre-read failure scenarios (missing documents AND missing required frontmatter fields), and frontmatter-driven flow integration — completing all carry-forward items from Phase 2.

**Scope**:
- MODIFY `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- `describe("Behavioral: Cold-Start Resume")`: `start` event with existing state at various pipeline positions (planning mid-step, execution mid-task, review tier) → returns correct next action with zero writes (FR-18)
- `describe("Behavioral: Pre-Read Failures")`:
  - Missing document scenarios: missing master plan at `plan_approved`, missing task report at `task_completed`, missing phase plan at `phase_plan_created` → `{ success: false }` with error describing missing document (FR-19)
  - Missing required frontmatter field scenarios (carry-forward from Phase 2):
    - `phase_plan_created` with document present but `tasks` absent → `{ success: false, error: "Required frontmatter field 'tasks' missing..." }`
    - `phase_plan_created` with `tasks` empty array → `{ success: false, error: "Phase plan 'tasks' array must not be empty" }`
    - `task_completed` with `has_deviations` absent → `{ success: false, error: "Required frontmatter field 'has_deviations' missing..." }`
    - `task_completed` with `deviation_type` absent → `{ success: false, error: "Required frontmatter field 'deviation_type' missing..." }`
    - `phase_review_completed` / triage with `exit_criteria_met` absent → error result (FR-19, FR-23)
  - Carry-forward from Phase 1: `readDocument` null-return path coverage (both-paths-null in `createProjectAwareReader`)
- `describe("Behavioral: Frontmatter-Driven Flows")`:
  - `tasks` array from `phase_plan_created` pre-read flows into `handlePhasePlanCreated` → tasks initialized in state (FR-20)
  - `has_deviations`/`deviation_type` drive correct triage row selection through full pipeline path (FR-20)
  - `exit_criteria_met` drives correct phase triage outcome through full pipeline path (FR-20)
  - `context.report_deviation_type` extraction verified (carry-forward from Phase 2)
- PRD refs: FR-18, FR-19, FR-20, FR-23

**Estimated files**: 1 (MODIFY)

## Execution Order

```
T01 (scaffold + happy path — creates the file)
 ├→ T02 (task triage rows — depends on T01)
 ├→ T03 (phase triage rows — depends on T01)
 ├→ T04 (gates, retries, halts — depends on T01)
 └→ T05 (resume, pre-reads, frontmatter — depends on T01)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T02, T03, T04, T05 are parallel-ready (no mutual dependencies — each adds an independent `describe` block to the same file) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] All behavioral tests pass (`node --test pipeline-behavioral.test.js`)
- [ ] 11/11 task-level triage rows covered with at least one test each (FR-13)
- [ ] 5/5 phase-level triage rows covered with at least one test each (FR-14)
- [ ] Full happy path (start → complete) verified in at least one test (FR-11)
- [ ] Multi-phase multi-task scenario (≥2 phases × ≥2 tasks) verified (FR-12)
- [ ] Missing required frontmatter fields produce `{ success: false }` error results, not silent fallbacks (FR-19, FR-23)
- [ ] Suite completes in under 5 seconds (NFR-5)
- [ ] All existing tests continue to pass — zero regressions (NFR-6)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes

## Known Risks for This Phase

- **Single-file contention**: All 5 tasks modify the same file (`pipeline-behavioral.test.js`). T01 creates it; T02–T05 append sections. If a corrective task requires restructuring T01's factory functions, subsequent tasks may need adjustment. Mitigation: T01 establishes comprehensive factories covering all downstream needs.
- **Triage row coverage completeness**: With 11+5 rows, each requiring specific state/document setups, there's risk of a test exercising the wrong row due to incorrect mock frontmatter. Mitigation: each test asserts `result.action` and validates the specific row behavior, not just success/failure.
- **`withStrictDates` scope**: Tests involving multi-step pipeline execution (happy path, retry cycles) need `withStrictDates` to avoid V13 timestamp validation collisions. Missing this wrapper would cause intermittent failures. Mitigation: skill instructions specify which tests require it (NFR-3).
- **Test suite performance**: The 5-second budget (NFR-5) must cover all behavioral tests. All tests use in-memory mock IO, so this should be well within budget, but multi-step happy path tests involve many sequential `executePipeline` calls. Mitigation: each test is self-contained with minimal setup overhead.
