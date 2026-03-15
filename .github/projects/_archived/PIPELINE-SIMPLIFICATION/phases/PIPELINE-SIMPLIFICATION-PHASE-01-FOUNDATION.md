---
project: "PIPELINE-SIMPLIFICATION"
phase: 1
title: "FOUNDATION"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-CONSTANTS"
    title: "Constants & Type Definitions"
  - id: "T02-STATE-IO"
    title: "State I/O Module"
  - id: "T03-PRE-READS"
    title: "Pre-Reads Module"
  - id: "T04-VALIDATOR"
    title: "Validator Module"
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
---

# Phase 1: FOUNDATION

## Phase Goal

Establish the v3 type system, reduced enum set, I/O layer, artifact validation module, and state invariant checker that all other modules depend on. After this phase, every foundational module in `lib-v3/` is implemented and unit-tested, ready to be consumed by Phase 2 (mutations, resolver) and Phase 3 (engine assembly).

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-SIMPLIFICATION-MASTER-PLAN.md) | Phase 1 scope and exit criteria |
| [Architecture](../PIPELINE-SIMPLIFICATION-ARCHITECTURE.md) | Module map, contracts (PipelineIO, PipelineResult, StateJson, PreReadSuccess/Failure, ValidationError), file structure (`lib-v3/`), internal dependency graph, constants enum definitions, allowed status transitions, invariant catalog |
| [Design](../PIPELINE-SIMPLIFICATION-DESIGN.md) | Module API surfaces (constants, state-io, pre-reads, validator), test authoring patterns (createMockIO, state factories, assertion patterns), test organization, status normalization rules, entry point readability constraints |
| [PRD](../PIPELINE-SIMPLIFICATION-PRD.md) | FR-4 (external-only actions), FR-6/FR-7 (pre-read requirements), FR-8/FR-9 (validator invariants), FR-10 (partial→failed normalization), FR-13 (schema v3), FR-23 (structured error IDs), NFR-1 (line count target), NFR-2 (DI for I/O), NFR-3 (zero external test deps) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Constants & Type Definitions | — | `execute_task` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P01-T01-CONSTANTS.md) |
| T02 | State I/O Module | T01 | `execute_task` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P01-T02-STATE-IO.md) |
| T03 | Pre-Reads Module | T01 | `execute_task` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P01-T03-PRE-READS.md) |
| T04 | Validator Module | T01 | `execute_task` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P01-T04-VALIDATOR.md) |

## Task Details

### T01 — Constants & Type Definitions

**Objective**: Create `lib-v3/constants.js` with all frozen enum objects and JSDoc `@typedef` definitions for the v3 state schema, plus `tests-v3/constants.test.js` verifying freeze and completeness.

**Scope**:
- All frozen enums: `PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `PHASE_STATUSES`, `TASK_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`, `NEXT_ACTIONS`
- `NEXT_ACTIONS` reduced to exactly 18 external-only entries (6 planning + 4 execution-task + 2 execution-phase + 2 gates + 2 review + 2 terminal)
- `TRIAGE_LEVELS` enum must NOT exist
- `SCHEMA_VERSION` constant: `'orchestration-state-v3'`
- JSDoc `@typedef` for `StateJson`, `ProjectMeta`, `Planning`, `PlanningStep`, `Execution`, `Phase`, `Task`, `PipelineResult`, `PipelineIO`, `ParsedDocument`, `Config` — all matching v3 schema (no `triage_attempts` fields)
- Allowed status transition maps: `ALLOWED_TASK_TRANSITIONS`, `ALLOWED_PHASE_TRANSITIONS` (exported for validator)

**Files**:
- CREATE `.github/orchestration/scripts/lib-v3/constants.js` (~170 lines)
- CREATE `.github/orchestration/scripts/tests-v3/constants.test.js`

**Acceptance criteria**:
- All enum objects are `Object.freeze`'d
- `NEXT_ACTIONS` has exactly 18 entries
- No `TRIAGE_LEVELS` export exists
- `SCHEMA_VERSION` equals `'orchestration-state-v3'`
- JSDoc types define v3 schema with no `triage_attempts` fields
- All tests pass via `node --test`

---

### T02 — State I/O Module

**Objective**: Create `lib-v3/state-io.js` implementing the `PipelineIO` interface (filesystem-backed) with `writeState` as the sole setter of `project.updated`, plus `tests-v3/state-io.test.js`.

**Scope**:
- `readState(projectDir)` → `StateJson | null` — read and parse `state.json`
- `writeState(projectDir, state)` → void — set `project.updated` to current ISO timestamp then write `state.json`
- `readConfig(configPath?)` → `Config` — read `orchestration.yml`, merge with defaults
- `readDocument(docPath)` → `{ frontmatter, body } | null` — parse markdown with frontmatter
- `ensureDirectories(projectDir)` → void — create project subdirectories
- `createRealIO()` → `PipelineIO` — factory that bundles the above into the DI interface
- Port from existing `lib/state-io.js` with the `writeState` rationalization (sole `project.updated` setter)
- Import existing utility functions from `validate-orchestration/scripts/lib/utils/` (fs-helpers, yaml-parser, frontmatter)

**Dependencies**: T01 — uses `SCHEMA_VERSION` constant for schema validation on read (optional check in this phase; hard enforcement deferred to engine assembly).

**Files**:
- CREATE `.github/orchestration/scripts/lib-v3/state-io.js` (~130 lines)
- CREATE `.github/orchestration/scripts/tests-v3/state-io.test.js`

**Acceptance criteria**:
- `writeState` is the sole setter of `project.updated` (no other module sets this timestamp)
- `readState` returns `null` for missing file, parsed `StateJson` otherwise
- `readDocument` returns `{ frontmatter, body }` or `null`
- `createRealIO()` returns an object conforming to `PipelineIO` interface
- All tests pass via `node --test`

---

### T03 — Pre-Reads Module

**Objective**: Create `lib-v3/pre-reads.js` implementing artifact extraction and validation for 5 event types via lookup-table dispatch, plus `tests-v3/pre-reads.test.js` with per-event extraction, missing field, invalid value, and normalization tests.

**Scope**:
- `preRead(event, context, readDocument, projectDir)` → `PreReadSuccess | PreReadFailure`
- Lookup table dispatching to per-event handlers for 5 events:
  - `plan_approved` → extract `total_phases` (positive integer) from master plan frontmatter
  - `task_completed` → extract `status`, `has_deviations`, `deviation_type` from task report; normalize status (`complete`/`pass` → `complete`; `failed`/`fail`/`partial` → `failed`)
  - `code_review_completed` → extract `verdict` from code review
  - `phase_plan_created` → extract `tasks` (non-empty array) from phase plan
  - `phase_review_completed` → extract `verdict`, `exit_criteria_met` from phase review
- Events not in lookup table → pass through with unmodified context (no error)
- Structured error on failure: `{ error: string, event: string, field?: string }`
- Pure functions — no state mutation, no side effects beyond the `readDocument` call

**Dependencies**: T01 — imports normalization status values from `constants.js`.

**Files**:
- CREATE `.github/orchestration/scripts/lib-v3/pre-reads.js` (~100 lines)
- CREATE `.github/orchestration/scripts/tests-v3/pre-reads.test.js`

**Acceptance criteria**:
- All 5 events extract correct frontmatter fields into enriched context
- Status normalization: `partial` → `failed`, `pass` → `complete`, `fail` → `failed`
- Missing document → structured error with event name
- Missing required field → structured error with field name
- Invalid `total_phases` (zero, negative, non-integer) → structured error
- Empty `tasks` array → structured error
- Non-pre-read events pass through with unmodified context
- All tests pass via `node --test`

---

### T04 — Validator Module

**Objective**: Create `lib-v3/validator.js` implementing ~11 structural and transition invariant checks with structured error output, plus `tests-v3/validator.test.js` with per-invariant tests confirming V8/V9/V14/V15 are absent.

**Scope**:
- `validateTransition(current, proposed)` → `ValidationError[]`
- ~11 invariants (V1–V7, V10–V13):
  - V1: `current_phase` within `[0, phases.length)` (proposed only)
  - V2: `current_task` within `[0, tasks.length)` for active phase (proposed only)
  - V3: `total_phases` matches `phases.length` (proposed only)
  - V4: `total_tasks` matches `tasks.length` per phase (proposed only)
  - V5: Phase/task counts within config limits (proposed only)
  - V6: Human approval required before execution tier (proposed only)
  - V7: Human approval required before completion per config (proposed only)
  - V10: Active phase `status` valid for current tier (proposed only)
  - V11: `retries` only increases monotonically (current→proposed comparison)
  - V12: Task/phase status transitions follow allowed map (current→proposed comparison)
  - V13: `project.updated` timestamp advances (current→proposed comparison, simplified — no racing workaround)
- Removed invariants: V8, V9, V14, V15 must NOT be present in the code
- Structured `ValidationError`: `{ invariant, message, field, current?, proposed? }`
- Import allowed transition maps from `constants.js`

**Dependencies**: T01 — imports `ALLOWED_TASK_TRANSITIONS`, `ALLOWED_PHASE_TRANSITIONS`, tier/status enums from `constants.js`.

**Files**:
- CREATE `.github/orchestration/scripts/lib-v3/validator.js` (~150 lines)
- CREATE `.github/orchestration/scripts/tests-v3/validator.test.js`

**Acceptance criteria**:
- `validateTransition` returns empty array for valid transitions
- Each of the ~11 invariants (V1–V7, V10–V13) has a dedicated test triggering a violation
- Each `ValidationError` includes `invariant` ID (e.g., `'V1'`), `message`, and `field`
- Transition invariants (V11, V12, V13) compare current-vs-proposed state
- V8, V9, V14, V15 are NOT checked — tests confirm these conditions do not produce errors
- All tests pass via `node --test`

## Execution Order

```
T01 (constants — foundation for all other modules)
 ├→ T02 (state-io — depends on T01 for SCHEMA_VERSION)
 ├→ T03 (pre-reads — depends on T01 for status normalization constants)
 └→ T04 (validator — depends on T01 for enums and transition maps)
```

**Sequential execution order**: T01 → T02 → T03 → T04

*Note: T02, T03, and T04 are parallel-ready (no mutual dependencies — each depends only on T01) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] `constants.js` exports all frozen enums; `NEXT_ACTIONS` has exactly 18 entries; `TRIAGE_LEVELS` does not exist; JSDoc types define v3 schema (no `triage_attempts` fields)
- [ ] `state-io.js` passes unit tests; `writeState` is the sole setter of `project.updated`
- [ ] `pre-reads.js` handles all 5 events with correct extraction and validation; status normalization maps `partial` → `failed`; non-pre-read events pass through unchanged
- [ ] `validator.js` has exactly ~11 invariant checks; V8/V9/V14/V15 are absent; structured errors include invariant IDs
- [ ] All Phase 1 unit tests pass (`node --test tests-v3/constants.test.js tests-v3/state-io.test.js tests-v3/pre-reads.test.js tests-v3/validator.test.js`)
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all modules importable)

## Known Risks for This Phase

- **State I/O external utility imports**: `state-io.js` depends on utilities in `validate-orchestration/scripts/lib/utils/` (fs-helpers, yaml-parser, frontmatter). These are stable but paths must be verified during implementation. If imports fail, the Coder should use the same import paths as the current `lib/state-io.js`.
- **Constants entry count precision**: The Master Plan says "~18" external actions but the Architecture enumerates exactly 18. The Coder should match the Architecture's exact enumeration (18 entries). If the count differs, flag it in the task report.
- **Pre-reads is a new module**: Unlike the other three modules which are ports/reductions of existing code, `pre-reads.js` is entirely new — its logic currently lives inline in `pipeline-engine.js`. The Coder must extract from the existing engine source, not write from scratch, to preserve behavioral equivalence.
- **Validator config dependency**: V5 (config limits) and V7 (human gate config) require access to config values. The validator signature takes `(current, proposed)` without config — the Coder may need to pass config as a third parameter or embed limits in the proposed state. The Architecture contract shows `validateTransition(current, proposed)` — if config is needed, the engine can embed relevant limits into the proposed state object or the validator can accept an optional config parameter.
