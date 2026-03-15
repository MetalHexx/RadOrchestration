---
project: "PIPELINE-BEHAVIORAL-TESTS"
total_phases: 3
status: "draft"
author: "architect-agent"
created: "2026-03-14T19:00:00Z"
updated: "2026-03-14T21:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Master Plan

## Executive Summary

The orchestration pipeline has a systemic mismatch between skill templates (document producers) and pipeline/triage engines (document consumers) — three templates lack YAML frontmatter fields that the engines read at runtime, causing silent fallbacks and forcing the Orchestrator to compensate manually. Additionally, `readDocument` throws on missing files while its callers expect a null return, creating dead code branches and fragile error-handling semantics across 7 call sites. This project fixes both contract misalignments — aligning all three template frontmatter schemas with their consumers (with all new fields REQUIRED and pipeline-validated) and changing `readDocument` to a consistent null-return contract — then creates a comprehensive behavioral test suite covering end-to-end pipeline execution paths (triage rows, gate modes, retry cycles, halt paths, cold-start resume) so that cross-cutting integration failures are caught before they block a live project. This is a greenfield system with no legacy documents — new frontmatter fields are enforced as REQUIRED, with missing fields treated as validation errors rather than silent fallback scenarios. All changes are internal infrastructure — no UI, no new dependencies, no agent prompt changes.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [PIPELINE-BEHAVIORAL-TESTS-BRAINSTORMING.md](PIPELINE-BEHAVIORAL-TESTS-BRAINSTORMING.md) | ✅ |
| Research | [PIPELINE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md](PIPELINE-BEHAVIORAL-TESTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [PIPELINE-BEHAVIORAL-TESTS-PRD.md](PIPELINE-BEHAVIORAL-TESTS-PRD.md) | ✅ |
| Design | [PIPELINE-BEHAVIORAL-TESTS-DESIGN.md](PIPELINE-BEHAVIORAL-TESTS-DESIGN.md) | ✅ |
| Architecture | [PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-6 / FR-7**: `readDocument` shall return `null` when the target file does not exist or cannot be read, instead of throwing — core contract change enabling consistent error handling across all 7 call sites
- **FR-8 / FR-9**: All call sites of `readDocument` shall handle the null-return contract correctly; `createProjectAwareReader` specifically shall use a null-check (not try/catch) for the project-relative fallback path
- **FR-1 / FR-2**: Phase plan template shall include a REQUIRED `tasks` array in frontmatter; pipeline engine shall pre-read it into `context.tasks` at the `phase_plan_created` event and return an error result if the `tasks` array is missing or empty
- **FR-3 / FR-4**: Task report template shall include REQUIRED `has_deviations` and `deviation_type`; phase review template shall include REQUIRED `exit_criteria_met` — pipeline and triage engines validate their presence and return structured errors when absent
- **FR-11 through FR-20**: Behavioral test suite shall cover full happy path, multi-phase/multi-task, all 11 task triage rows, all 5 phase triage rows, human gate modes, retry/corrective cycles, halt paths, cold-start resume, pre-read failures (missing documents AND missing required fields), and frontmatter-driven flows
- **FR-23**: The pipeline and triage engines shall remove fallback logic for the three newly-required frontmatter fields (`tasks`, `has_deviations`/`deviation_type`, `exit_criteria_met`), treating their absence as a validation error rather than a silent default — eliminates dead fallback paths; templates are the contract
- **NFR-1 / NFR-5**: Behavioral tests shall use `node:test` built-in runner with no external dependencies and complete in under 5 seconds

## Key Technical Decisions (from Architecture)

- **Null-return contract for `readDocument`**: Change from throw-on-missing to `return null`, making the 4 triage/pipeline null-check branches live code instead of dead code. This is a 2-line change in `state-io.js` that simplifies the entire call graph.
- **`createProjectAwareReader` null-check fallback**: Replace try/catch with `if (result !== null) return result` — the wrapper must be updated simultaneously with `readDocument` to preserve the project-relative path fallback.
- **New `phase_plan_created` pre-read block with required-field validation**: Modeled after the existing `plan_approved` pre-read pattern — reads phase plan frontmatter `tasks` array into `context.tasks` so `handlePhasePlanCreated` can initialize tasks without relying on the Orchestrator manually passing them. Returns `{ success: false, error: "..." }` if `tasks` is missing or empty.
- **All new frontmatter fields are REQUIRED**: Pipeline and triage engines validate that `tasks`, `has_deviations`, `deviation_type`, and `exit_criteria_met` are present in their respective documents. No fallback logic — missing fields produce structured error results. This simplifies implementation: single code path per field, no dual paths, no fallback chains.
- **Change dependency ordering**: `readDocument` → `createProjectAwareReader` + test updates → pre-read block + required-field validation → template updates → behavioral tests. This sequence prevents green-to-red-to-green test suite oscillations.
- **Test factory duplication**: Behavioral test file duplicates factory functions (`createMockIO`, `createBaseState`, etc.) locally rather than importing from `pipeline-engine.test.js` to avoid cross-file coupling.

## Key Design Constraints (from Design)

- **Frontmatter is the contract interface**: All three template gaps are specified as exact YAML schemas with field names, types, and required status — these schemas are the implementation target, not prose descriptions. All new fields are REQUIRED; there are no default-if-absent values.
- **`readDocument` call site state table**: The design enumerates all 7 call sites with input states, outcomes, and error feedback — each must be verified after the contract change. Includes new rows for missing required fields returning `{ success: false, error: "..." }`.
- **Triage row coverage is exhaustive**: All 11 task-level and 5 phase-level triage decision rows are specified with exact inputs, expected actions, and test label conventions — the behavioral test suite must cover every row
- **Test discoverability conventions**: File at `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`, `describe("Behavioral: {Category}")` blocks, triage tests labeled with row number and inputs — supports `node --test --test-name-pattern "Behavioral"` filtering
- **Error feedback is structured**: Missing documents produce `{ success: false, error: "..." }` with document type and path in the error string; missing required frontmatter fields produce `{ success: false, error: "Required frontmatter field '...' missing from ..." }`; triage missing-report errors use `makeError(...)` — behavioral tests assert these exact feedback shapes

## Phase Outline

### Phase 1: Core Contract Changes

**Goal**: Fix the `readDocument` throw-to-null contract and update `createProjectAwareReader`, keeping the existing test suite green throughout. The null-return contract eliminates the need for try/catch-based fallback chains in `createProjectAwareReader` and simplifies all downstream null-check branches.

**Scope**:
- Change `readDocument` in `state-io.js` to return `null` instead of throwing for missing/unreadable files — refs: [FR-6](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [FR-7](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [readDocument contract](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Update `createProjectAwareReader` in `pipeline-engine.js` from try/catch to null-check fallback, removing the need for exception-driven fallback chains — refs: [FR-9](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [createProjectAwareReader contract](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Update `state-io.test.js` throw assertion to null assertion — refs: [FR-21](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Update `pipeline-engine.test.js` "both fail" `createProjectAwareReader` test — refs: [FR-22](PIPELINE-BEHAVIORAL-TESTS-PRD.md)

**Exit Criteria**:
- [ ] `readDocument` returns `null` for missing files (not throws)
- [ ] `createProjectAwareReader` fallback works via null-check (not try/catch)
- [ ] All existing tests pass with zero regressions

**Phase Doc**: phases/PIPELINE-BEHAVIORAL-TESTS-PHASE-01-CORE-CONTRACT.md *(created at execution time)*

---

### Phase 2: Frontmatter Alignment, Required-Field Validation, and Pre-Read

**Goal**: Add REQUIRED frontmatter fields to the three skill templates, add the `phase_plan_created` pre-read block, add required-field validation to the pipeline and triage engines (removing fallback chains), and update SKILL.md instruction files so agents produce the new fields.

**Scope**:
- Add REQUIRED `tasks` array to phase plan template frontmatter — refs: [FR-1](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [Phase Plan schema](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Add REQUIRED `has_deviations` and `deviation_type` to task report template frontmatter — refs: [FR-3](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [Task Report schema](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Add REQUIRED `exit_criteria_met` to phase review template frontmatter — refs: [FR-4](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [Phase Review schema](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Add `phase_plan_created` pre-read block in `pipeline-engine.js` with validation that `tasks` is present, is an array, and is non-empty — refs: [FR-2](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [pre-read contract](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Add required-field validation for `has_deviations` and `deviation_type` in the `task_completed` pre-read — refs: [FR-3](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [task_completed pre-read contract](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Remove fallback chains in `triage-engine.js` for `has_deviations`/`deviation_type` (no fallback to legacy `deviations` field) and `exit_criteria_met` (no fallback treating undefined as `true`) — refs: [FR-23](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [triage engine contract](PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md)
- Add required-field validation in triage engine: `triagePhase` returns a structured error if `exit_criteria_met` is absent — refs: [FR-23](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Update 3 SKILL.md files with frontmatter field documentation marking all new fields as REQUIRED — refs: [FR-5](PIPELINE-BEHAVIORAL-TESTS-PRD.md)

**Exit Criteria**:
- [ ] All 3 templates declare every pipeline/triage-consumed frontmatter field as REQUIRED
- [ ] All 3 SKILL.md files document the new fields as REQUIRED with types, allowed values, and purpose
- [ ] `phase_plan_created` pre-read extracts `tasks` array from phase plan frontmatter into `context.tasks`; returns error if `tasks` is missing or empty
- [ ] `task_completed` pre-read validates that `has_deviations` and `deviation_type` are present; returns error if either is absent
- [ ] Triage engine validates `exit_criteria_met` is present; returns error if absent — no fallback chains remain
- [ ] All existing tests pass with zero regressions

**Phase Doc**: phases/PIPELINE-BEHAVIORAL-TESTS-PHASE-02-FRONTMATTER.md *(created at execution time)*

---

### Phase 3: Behavioral Test Suite

**Goal**: Create the comprehensive behavioral test file covering all end-to-end pipeline execution paths identified in the PRD, including verification that missing required frontmatter fields produce structured errors.

**Scope**:
- Create `pipeline-behavioral.test.js` with factory functions — refs: [FR-10](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [NFR-4](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Full happy path: start → planning → approval → execution → complete — refs: [FR-11](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Multi-phase multi-task scenario (≥2 phases × ≥2 tasks) — refs: [FR-12](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- All 11 task-level triage rows — refs: [FR-13](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [triage decision table](PIPELINE-BEHAVIORAL-TESTS-DESIGN.md)
- All 5 phase-level triage rows — refs: [FR-14](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [phase triage table](PIPELINE-BEHAVIORAL-TESTS-DESIGN.md)
- Human gate modes (ask, task, phase, autonomous) — refs: [FR-15](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Retry/corrective cycles including retry exhaustion → halt — refs: [FR-16](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Halt paths from rejected reviews and critical failures — refs: [FR-17](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Cold-start resume from various pipeline states — refs: [FR-18](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Pre-read failure scenarios: missing documents AND missing required frontmatter fields (e.g., absent `tasks` → `{ success: false }`, absent `has_deviations` → `{ success: false }`, absent `exit_criteria_met` → error) — refs: [FR-19](PIPELINE-BEHAVIORAL-TESTS-PRD.md), [FR-23](PIPELINE-BEHAVIORAL-TESTS-PRD.md)
- Frontmatter-driven flows using REQUIRED fields from Phase 2 — refs: [FR-20](PIPELINE-BEHAVIORAL-TESTS-PRD.md)

**Exit Criteria**:
- [ ] All behavioral tests pass
- [ ] 11/11 task-level triage rows covered with at least one test each
- [ ] 5/5 phase-level triage rows covered with at least one test each
- [ ] Full happy path (start → complete) verified in at least one test
- [ ] Missing required frontmatter fields produce `{ success: false }` error results (not silent fallbacks)
- [ ] Suite completes in under 5 seconds
- [ ] All existing tests continue to pass

**Phase Doc**: phases/PIPELINE-BEHAVIORAL-TESTS-PHASE-03-BEHAVIORAL-TESTS.md *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Git strategy**: Single branch, sequential commits (`[orch]` prefix)
- **Human gates**: Ask mode at execution start; always gate after planning (master plan) and final review

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| `readDocument` null-return changes break an undiscovered call site that depends on throw for error handling | High | Research identified all 7 call sites; each will be audited and updated in Phase 1. Existing tests validate all known paths. | Coder + Reviewer |
| `createProjectAwareReader` null-check fallback introduces a regression where project-relative path resolution no longer triggers | High | FR-9 explicitly requires the fallback path to remain functional; FR-22 requires updated tests to validate it in Phase 1. | Coder + Reviewer |
| Phase plan `tasks` array pre-read introduces a new failure mode if the frontmatter is malformed | Medium | FR-2 requires the pre-read to return an error result when `tasks` is missing or malformed. Validated in Phase 3 behavioral tests. | Coder |
| Agent produces a document missing a required frontmatter field, causing the pipeline to return an error | Medium | SKILL.md instructions updated in Phase 2 to mark all new fields as REQUIRED with allowed values and purpose. Behavioral tests in Phase 3 verify that the pipeline returns structured errors on absent required fields, ensuring the failure mode is explicit and diagnosable. | Tactical Planner + Coder |
| Behavioral test suite becomes brittle and requires constant updates as the pipeline evolves | Low | NFR-2 mandates test isolation; NFR-7 mandates reuse of existing helpers. Tests validate behavior (actions and state mutations), not internal implementation details. | Coder + Reviewer |
