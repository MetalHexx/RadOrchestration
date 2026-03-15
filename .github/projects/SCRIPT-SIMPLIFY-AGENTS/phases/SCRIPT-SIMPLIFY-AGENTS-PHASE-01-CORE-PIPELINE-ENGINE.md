---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
title: "Core Pipeline Engine"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-12T00:00:00Z"
---

# Phase 1: Core Pipeline Engine

## Phase Goal

Build the unified event-driven pipeline script with all 19 event handlers, triage integration, validation, and deterministic I/O — fully replacing the 3 standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) with a single `pipeline.js` entry point backed by modular internals.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../SCRIPT-SIMPLIFY-AGENTS-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints (max 8 tasks/phase) |
| [Architecture](../SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) | Four-layer module composition, PipelineIO/PipelineRequest/PipelineResult contracts, Mutations interface, State I/O interface, Pipeline CLI interface, internal dependency graph, file structure, triage trigger rules, `triage_attempts` lifecycle |
| [Design](../SCRIPT-SIMPLIFY-AGENTS-DESIGN.md) | CLI interface design, event vocabulary (19 events), pipeline result schema, error result schema, pipeline internal state machine (PARSE_ARGS → LOAD_STATE → ... → OUTPUT), triage trigger rules, task report pre-read pattern |
| [PRD](../SCRIPT-SIMPLIFY-AGENTS-PRD.md) | FR-1 through FR-10 (pipeline script functional requirements), NFR-1 through NFR-8 (compatibility, testability, determinism, conventions) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | State I/O Module + Tests | — | — | 2 | *(created at execution time)* |
| T2 | Mutations Module — All 18 Handlers + Helpers | — | — | 1 | *(created at execution time)* |
| T3 | Mutations Unit Tests | T2 | — | 1 | *(created at execution time)* |
| T4 | Pipeline Engine | T1, T2 | — | 1 | *(created at execution time)* |
| T5 | Pipeline Engine Integration Tests | T4 | — | 1 | *(created at execution time)* |
| T6 | Pipeline CLI Entry Point + Tests | T4 | — | 2 | *(created at execution time)* |

## Execution Order

```
T1 (State I/O Module + Tests)
T2 (Mutations Module — All 18 Handlers + Helpers) ← parallel-ready with T1
 └→ T3 (Mutations Unit Tests — depends on T2)
T4 (Pipeline Engine — depends on T1, T2)
 ├→ T5 (Pipeline Engine Integration Tests — depends on T4) ← parallel-ready with T6
 └→ T6 (Pipeline CLI Entry Point + Tests — depends on T4) ← parallel-ready with T5
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T1 and T2 are parallel-ready (no mutual dependency). T5 and T6 are parallel-ready (both depend only on T4). All will execute sequentially in v1.*

## Task Details

### T1: State I/O Module + Tests

**Objective**: Create `state-io.js` — the filesystem I/O isolation boundary that all other pipeline modules call for reading/writing state, config, and documents. Also create its test suite.

**Files**:
- **CREATE** `.github/orchestration/scripts/lib/state-io.js` (~80–120 lines)
- **CREATE** `.github/orchestration/scripts/tests/state-io.test.js` (~150–200 lines)

**Key requirements**:
- Exports: `readState(projectDir)`, `writeState(projectDir, state)`, `readConfig(configPath)`, `readDocument(docPath)`, `ensureDirectories(projectDir)`
- `readState` returns `null` if file doesn't exist (no throw)
- `writeState` updates `project.updated` timestamp before writing, uses `writeFileSync`
- `readConfig` auto-discovers `orchestration.yml` if path omitted, falls back to built-in defaults
- `readDocument` parses markdown frontmatter using shared `frontmatter.js` from validate-orchestration utils
- `ensureDirectories` creates `projectDir/`, `phases/`, `tasks/`, `reports/` (no-op if exists)
- Reuse shared utilities: `fs-helpers.js`, `yaml-parser.js`, `frontmatter.js` from `.github/skills/validate-orchestration/scripts/lib/utils/`
- CommonJS, `'use strict'`, Node.js built-ins only

**Acceptance criteria**:
- All 5 exported functions work correctly
- Tests cover: read existing state, read missing state (returns null), write state (updates timestamp), read config with explicit path, config auto-discovery, config defaults fallback, read document with frontmatter, read missing document (throws), ensure directories creates structure, ensure directories is idempotent

---

### T2: Mutations Module — All 18 Handlers + Helpers

**Objective**: Create `mutations.js` — the event-to-mutation lookup table with one named pure function per event type, plus triage mutation helpers and API functions.

**Files**:
- **CREATE** `.github/orchestration/scripts/lib/mutations.js` (~300–400 lines)

**Key requirements**:
- Export: `MUTATIONS` record (18 entries), `getMutation(event)`, `needsTriage(event, state)`, `applyTaskTriage(state, triageResult)`, `applyPhaseTriage(state, triageResult)`
- 18 named mutation handler functions, each ≤15 lines, each pure `(state, context) → MutationResult`
- `MutationResult` = `{ state, mutations_applied: string[] }`
- Handlers (planning tier): `handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted`, `handlePlanApproved`, `handlePlanRejected`
- Handlers (execution tier): `handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, `handlePhaseReviewCompleted`, `handleGateApproved`, `handleGateRejected`, `handleFinalReviewCompleted`, `handleFinalApproved`, `handleFinalRejected`
- `needsTriage` returns `{ shouldTriage, level }` — triggers on `task_completed`, `code_review_completed` (level: task), `phase_review_completed` (level: phase)
- `applyTaskTriage` / `applyPhaseTriage`: apply triage verdict/action to state, manage `triage_attempts` (increment on triage, reset on advance)
- Import only `constants.js` from preserved libs
- CommonJS, `'use strict'`, zero I/O

**Acceptance criteria**:
- All 18 handlers registered in MUTATIONS table
- `getMutation` returns the correct handler for each event name
- `needsTriage` returns correct trigger rules for all 19 events
- All handler functions are pure (no I/O, no side effects beyond mutating the cloned state object)
- Each handler ≤15 lines

---

### T3: Mutations Unit Tests

**Objective**: Create comprehensive unit tests for all 18 mutation handlers, the two triage mutation helpers, and the `needsTriage`/`getMutation` API functions.

**Files**:
- **CREATE** `.github/orchestration/scripts/tests/mutations.test.js` (~500–600 lines)

**Key requirements**:
- One `describe` block per event/function, one or more tests per expected state change
- Test each planning handler: sets correct step status to `"complete"`, stores doc path
- Test `handleMasterPlanCompleted`: sets `planning.status` to `"complete"`
- Test `handlePlanApproved`: sets `planning.human_approved` to `true`, transitions tier to `"execution"`, sets `execution.status` to `"in_progress"`
- Test `handlePlanRejected`: sets tier to `"halted"`, adds active blocker
- Test execution handlers: `phase_plan_created` sets phase_doc + tasks, `task_handoff_created` sets handoff_doc + status, `task_completed` sets task status + report_doc + severity, etc.
- Test `handleGateApproved` for both task and phase gate types (advance behavior)
- Test `handleGateRejected` for both types (halt)
- Test `handleFinalReviewCompleted`, `handleFinalApproved`, `handleFinalRejected`
- Test `applyTaskTriage`: verdict/action written, `triage_attempts` incremented, advance resets attempts
- Test `applyPhaseTriage`: verdict/action written, `triage_attempts` incremented, advance resets attempts
- Test `needsTriage` for all 19 events (true for 3, false for the rest)
- Test `getMutation` for all 18 events + unknown event returns `undefined`
- Use `node:test` and `node:assert`, no npm dependencies

**Acceptance criteria**:
- Tests cover all 18 handlers, both triage helpers, `needsTriage`, and `getMutation`
- All tests pass
- Tests use fixture state objects (no filesystem access)

---

### T4: Pipeline Engine

**Objective**: Create `pipeline-engine.js` — the core orchestration module that implements the linear recipe: load state → apply mutation → validate → write → triage check → resolve → return result. This module receives a `PipelineIO` interface via dependency injection.

**Files**:
- **CREATE** `.github/orchestration/scripts/lib/pipeline-engine.js` (~150–200 lines)

**Key requirements**:
- Export: `executePipeline(request, io)` where `request` is `PipelineRequest` and `io` is `PipelineIO`
- Init path: when `readState` returns `null` and event is `start` → read config → ensure directories → scaffold initial state (including `triage_attempts: 0` in execution section) → write state → resolve → return
- Cold start path: when state exists and event is `start` → skip mutation → resolve → return
- Standard path: look up mutation → deep-clone state → apply mutation → validate transition → write state → check triage → resolve → return
- Task report pre-read: for `task_completed` event, call `io.readDocument(context.report_path)` to extract frontmatter, enrich context with `report_status`, `report_severity`, `report_deviations`
- Triage path: after standard write, call `needsTriage(event, state)` → if yes, check `triage_attempts > 1` (halt) → call `triageEngine.executeTriage(state, level, io.readDocument)` → apply triage mutation → validate → write
- Error handling: unknown event → error result; validation failure → error result (state NOT written); triage failure → error result
- Result shape: `{ success, action, context, mutations_applied, triage_ran, validation_passed }` on success; `{ success: false, error, event, state_snapshot, mutations_applied, validation_passed }` on failure
- Import: `mutations.js`, `state-validator.js`, `resolver.js`, `triage-engine.js`, `constants.js`
- CommonJS, `'use strict'`

**Acceptance criteria**:
- `executePipeline` handles init path (no state.json + start event)
- `executePipeline` handles cold start (state.json exists + start event)
- `executePipeline` handles all 18 standard events
- Validation failure returns error result and does NOT call writeState
- Triage triggers on the 3 triage events
- `triage_attempts > 1` returns halt
- Task report pre-read enriches context for `task_completed`
- Error results include event, mutations_applied, state_snapshot

---

### T5: Pipeline Engine Integration Tests

**Objective**: Create integration tests for the pipeline engine using mocked `PipelineIO`, covering all 19 events including init, cold start, triage triggers, validation failures, and error paths.

**Files**:
- **CREATE** `.github/orchestration/scripts/tests/pipeline-engine.test.js` (~400–500 lines)

**Key requirements**:
- Create a mock `PipelineIO` factory that returns in-memory implementations of `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`
- Test init path: no state → `start` event → creates state with `triage_attempts: 0`, returns `spawn_research` action
- Test cold start: existing state at various stages → `start` event → returns correct next action without mutation
- Test each planning event: `research_completed` through `plan_approved` → correct mutations + correct next action
- Test execution events: `phase_plan_created`, `task_handoff_created`, `task_completed`, `code_review_completed`, `phase_report_created`, `phase_review_completed` → correct mutations + triage triggers
- Test triage flow: `task_completed` → triage runs → verdict/action written → correct next action
- Test `triage_attempts` lifecycle: increment on triage, reset on advance, >1 triggers halt
- Test gate events: `gate_approved` (task + phase), `gate_rejected`
- Test final events: `final_review_completed`, `final_approved`, `final_rejected`
- Test error paths: unknown event → error result, validation failure → state NOT written
- Test task report pre-read: `task_completed` calls `readDocument` with report path
- Use `node:test` and `node:assert`

**Acceptance criteria**:
- All 19 events have at least one integration test
- Triage flow tested end-to-end through mocked I/O
- `triage_attempts` lifecycle fully tested
- Error paths tested (unknown event, validation failure)
- No filesystem access — all I/O mocked

---

### T6: Pipeline CLI Entry Point + Tests

**Objective**: Create `pipeline.js` — the thin CLI entry point (~20 lines) that parses arguments, calls the pipeline engine with real `state-io` functions, prints JSON to stdout, and exits with code 0 or 1. Also create its test suite.

**Files**:
- **CREATE** `.github/orchestration/scripts/pipeline.js` (~30–50 lines including shebang and required patterns)
- **CREATE** `.github/orchestration/scripts/tests/pipeline.test.js` (~200–300 lines)

**Key requirements**:
- Shebang line: `#!/usr/bin/env node`
- `'use strict'`, `require.main === module` guard
- Parse CLI flags: `--event` (required), `--project-dir` (required), `--config` (optional), `--context` (optional, JSON string)
- Call `executePipeline(request, io)` with real state-io functions as PipelineIO
- Print result JSON to stdout
- Print diagnostics to stderr
- Exit 0 on success, exit 1 on error
- Export `parseArgs` for unit testing
- GNU long-option CLI style
- Test `parseArgs`: valid args, missing required flags, invalid context JSON, optional flags
- E2E integration tests: spawn `pipeline.js` as child process, verify stdout JSON, verify exit codes
- Test with a temp directory for real filesystem E2E tests
- Use `node:test`, `node:assert`, `node:child_process` for E2E

**Acceptance criteria**:
- `parseArgs` correctly handles all flag combinations
- Missing `--event` or `--project-dir` produces a clear error
- Invalid `--context` JSON produces a clear error
- E2E test: `--event start` with no state.json initializes project and returns valid JSON on stdout
- E2E test: error case returns exit code 1
- Existing 4 preserved lib test suites still pass unmodified

## Phase Exit Criteria

- [ ] All 19 events produce correct deterministic output (verified by `pipeline-engine.test.js`)
- [ ] All 18 mutation functions have unit tests (`mutations.test.js`)
- [ ] Pipeline handles init (no `state.json`), cold start, and all steady-state events
- [ ] `triage_attempts` is persisted, incremented on triage, reset on advance, >1 triggers halt
- [ ] All 4 preserved lib test suites pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] CLI entry point parses all flags and returns valid JSON on stdout
- [ ] Error paths return structured error JSON with exit code 1 and do NOT write invalid state
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all imports resolve)
- [ ] All new test suites pass (`state-io.test.js`, `mutations.test.js`, `pipeline-engine.test.js`, `pipeline.test.js`)

## Known Risks for This Phase

- **Mutation logic correctness**: 18 handlers each performing specific state mutations — subtle bugs (wrong field path, missing timestamp update) can cascade. Mitigated by comprehensive mutation unit tests (T3) and integration tests (T5).
- **Triage integration complexity**: The pipeline engine's dual-validation-pass flow (post-mutation + post-triage) is the most complex code path. Mitigated by dedicated triage flow integration tests in T5.
- **Shared utility compatibility**: `state-io.js` reuses `fs-helpers.js`, `yaml-parser.js`, `frontmatter.js` from validate-orchestration utils — these must be import-compatible from the new location. Mitigated by T1 tests verifying actual imports work.
- **State validator sensitivity**: The preserved `state-validator.js` enforces 15 invariants (V1–V15). Mutations must produce transitions that pass all invariants. Mitigated by integration tests that exercise the real validator against all mutation outputs.
