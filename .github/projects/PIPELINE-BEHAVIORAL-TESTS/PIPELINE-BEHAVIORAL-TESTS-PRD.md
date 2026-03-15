---
project: "PIPELINE-BEHAVIORAL-TESTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-14T16:00:00Z"
updated: "2026-03-14T18:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Product Requirements

## Problem Statement

The orchestration pipeline's skill templates (document producers) and pipeline/triage engines (document consumers) are misaligned — three templates lack YAML frontmatter fields that the engines read at runtime, causing silent fallbacks and forcing the Orchestrator to manually compensate. Additionally, the `readDocument` function throws on missing files while its callers expect a null return, making several error-handling branches dead code and creating fragile semantics. No behavioral tests exist for cross-cutting pipeline execution paths, so systemic integration failures — like those discovered during the UI-PATH-FIX project — go undetected until they block a live project.

## Goals

- **G1 — Frontmatter cohesion**: All skill templates consumed by the pipeline/triage engines declare every frontmatter field those engines read, establishing an explicit producer-consumer contract. The new fields are REQUIRED — templates are the contract, and the pipeline enforces their presence
- **G2 — Consistent `readDocument` contract**: The `readDocument` function returns null for missing files, and every call site handles that contract correctly, eliminating dead null-check branches and reducing wrapper complexity
- **G3 — Behavioral test coverage**: A dedicated test suite covers end-to-end pipeline execution paths — including triage, gates, retries, halts, multi-phase chains, and cold-start resume — so that cross-cutting integration failures are caught before they reach a live project

## Non-Goals

- Changing the triage decision table logic (row definitions, thresholds, or semantics)
- Any UI or dashboard changes
- Modifying Orchestrator agent prompts or agent instructions (beyond skill template instructions that guide frontmatter production)
- Adding frontmatter fields to templates that are not consumed by pipeline or triage code
- Replacing or restructuring existing unit tests (behavioral tests complement, not replace)
- Introducing external test dependencies or a different test runner
- Backward-compatibility fallbacks for absent frontmatter fields — this is a greenfield system with no legacy documents to support

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | pipeline engine | read a REQUIRED `tasks` array from phase plan frontmatter at the `phase_plan_created` event | I can initialize the phase's task list automatically without relying on the Orchestrator to manually pass task definitions | P0 |
| 2 | triage engine | read REQUIRED `has_deviations` and `deviation_type` from task report frontmatter | I can evaluate all 11 task-level triage decision rows using frontmatter data instead of relying on undefined-field fallback logic | P0 |
| 3 | triage engine | read REQUIRED `exit_criteria_met` from phase review frontmatter | I can distinguish between "all exit criteria met" and "partial exit criteria met" phase-level triage outcomes deterministically | P1 |
| 4 | pipeline engine caller | receive null from `readDocument` when a file is missing | I can use simple null-checks for control flow instead of relying on try/catch or layered wrappers to intercept thrown errors | P0 |
| 5 | agent developer making pipeline changes | run a behavioral test suite that covers full execution paths | I can verify that my changes don't break cross-cutting flows (triage chains, gate modes, retry cycles, internal actions) before they reach a live project | P0 |
| 6 | agent developer | find the behavioral test file in a predictable, discoverable location | I know where to look and what to run when validating pipeline changes | P1 |
| 7 | agent (Tactical Planner, Coder, Reviewer) | receive clear skill instructions about which frontmatter fields to produce and their allowed values | I generate documents that satisfy the pipeline's expected contract without needing to inspect pipeline source code | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The phase plan skill template shall include a REQUIRED `tasks` array in its YAML frontmatter, where each entry contains `id` (string) and `title` (string) | P0 | Consumed by `handlePhasePlanCreated` in mutations |
| FR-2 | The pipeline engine shall pre-read the phase plan document's frontmatter `tasks` array into `context.tasks` when processing the `phase_plan_created` event, and shall return an error result if the `tasks` array is missing or empty | P0 | Modeled after the existing `plan_approved` pre-read pattern |
| FR-3 | The task report skill template shall include REQUIRED `has_deviations` (boolean) and `deviation_type` (string or null) in its YAML frontmatter | P0 | Consumed by pipeline `task_completed` pre-read and triage `triageTask` |
| FR-4 | The phase review skill template shall include REQUIRED `exit_criteria_met` (boolean) in its YAML frontmatter | P1 | Consumed by triage `triagePhase` |
| FR-5 | Each updated skill template's corresponding SKILL.md instruction file shall document the new frontmatter fields as REQUIRED, their allowed values, and their purpose | P1 | Ensures agents know to produce the fields |
| FR-6 | `readDocument` shall return null when the target file does not exist, instead of throwing an error | P0 | Core contract change |
| FR-7 | `readDocument` shall return null when the target file exists but cannot be read, instead of throwing an error | P0 | Consistent null-return contract for all failure modes |
| FR-8 | All call sites of `readDocument` shall handle the null-return contract correctly | P0 | Includes `createProjectAwareReader` (switch from try/catch to null-check for fallback), pipeline pre-reads, and triage engine calls |
| FR-9 | The `createProjectAwareReader` wrapper shall use a null-check (not try/catch) to determine whether to attempt project-relative path resolution as a fallback | P0 | Ensures the fallback path is still exercised after the throw-to-null change |
| FR-10 | A dedicated behavioral test file shall exist that covers end-to-end pipeline execution scenarios | P0 | Separate from existing unit tests |
| FR-11 | The behavioral test suite shall cover the full happy path from `start` through all planning steps, plan approval, execution (phase plan → task handoff → task completion → code review → triage → phase report → phase review → phase triage), final review, final approval, and completion | P0 | Single-phase, single-task minimum |
| FR-12 | The behavioral test suite shall cover multi-phase, multi-task execution scenarios | P0 | At least two phases with at least two tasks each |
| FR-13 | The behavioral test suite shall cover all 11 task-level triage decision rows | P0 | Each row exercised in at least one test |
| FR-14 | The behavioral test suite shall cover all 5 phase-level triage decision rows | P0 | Each row exercised in at least one test |
| FR-15 | The behavioral test suite shall cover all human gate execution modes | P1 | ask, task, phase, autonomous |
| FR-16 | The behavioral test suite shall cover retry and corrective task cycles, including retry exhaustion leading to halt | P0 | Validates triage → corrective → retry → resolution or halt |
| FR-17 | The behavioral test suite shall cover halt paths triggered by rejected reviews and critical failures | P0 | Task-level and phase-level halts |
| FR-18 | The behavioral test suite shall cover cold-start resume from various pipeline states | P1 | `start` event with existing state returns correct next action without writes |
| FR-19 | The behavioral test suite shall cover pre-read failure scenarios for missing or malformed documents | P1 | Validates error results when required frontmatter fields are absent |
| FR-20 | The behavioral test suite shall cover frontmatter-driven flows using the new REQUIRED fields from FR-1, FR-3, and FR-4 | P0 | Validates that new frontmatter fields integrate correctly through triage |
| FR-21 | Existing tests that assert `readDocument` throws on missing files shall be updated to assert null return | P0 | Keeps test suite green after the contract change |
| FR-22 | Existing tests for `createProjectAwareReader` shall be updated to reflect the null-check fallback pattern | P0 | Keeps test suite green after the wrapper change |
| FR-23 | The pipeline and triage engines shall remove fallback logic for the three newly-required frontmatter fields (`tasks`, `has_deviations`/`deviation_type`, `exit_criteria_met`), treating their absence as a validation error rather than a silent default | P0 | Eliminates dead fallback paths; templates are the contract |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Test Infrastructure | The behavioral test suite shall use the `node:test` built-in runner with no external test dependencies, matching existing test infrastructure conventions |
| NFR-2 | Test Isolation | Each behavioral test shall be self-contained and not depend on execution order or shared mutable state between tests |
| NFR-3 | Test Reliability | Behavioral tests involving triage or internal action loops shall use the `withStrictDates` helper to avoid V13 timestamp validation collisions |
| NFR-4 | Test Discoverability | The behavioral test file shall be located alongside existing pipeline tests in a predictable directory, with a descriptive filename that signals its purpose |
| NFR-5 | Test Performance | The full behavioral test suite shall complete in under 5 seconds on a standard development machine (all tests are in-memory with mock IO) |
| NFR-6 | Pipeline Integrity | No change shall break currently-passing tests |
| NFR-7 | Maintainability | The behavioral test file shall reuse existing test factory functions and helpers rather than duplicating infrastructure |

## Assumptions

- The V13 timestamp fix and `createProjectAwareReader` wrapper from the UI-PATH-FIX project are already deployed and stable
- The existing mock IO pattern (`createMockIO` with in-memory state and documents) is sufficient for behavioral testing without requiring filesystem access
- The `tasks` array format in phase plan frontmatter (objects with `id` and `title`) matches what `handlePhasePlanCreated` already expects in `context.tasks`
- This is a greenfield system — no legacy documents exist that were produced under old templates, so there is no backward-compatibility burden for absent frontmatter fields
- Agents always use the current skill templates; if an agent fails to produce a required frontmatter field, that is a bug in the agent or skill instructions to be fixed, not a scenario to handle gracefully

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | `readDocument` null-return changes break an undiscovered call site that depends on the throw for error handling | High | Research identified all 7 call sites; each will be audited and updated as part of FR-8. Existing tests validate all known paths. |
| 2 | `createProjectAwareReader` null-check fallback introduces a regression where project-relative path resolution no longer triggers | High | FR-9 explicitly requires the fallback path to remain functional; FR-22 requires tests to validate it |
| 3 | Phase plan `tasks` array pre-read introduces a new failure mode if the frontmatter is malformed | Medium | FR-2 requires the pre-read to return an error result when the `tasks` field is missing or malformed; FR-19 requires behavioral tests to cover pre-read failure scenarios |
| 4 | Behavioral test suite becomes brittle and requires constant updates as the pipeline evolves | Low | NFR-2 and NFR-7 mandate isolation and reuse of existing helpers; tests should validate behavior, not internal implementation details |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Template-consumer field alignment | 100% of pipeline/triage-consumed frontmatter fields are declared in the corresponding skill template | Manual audit: count consumed fields vs. template-declared fields across all 5 templates |
| `readDocument` contract consistency | 0 call sites using try/catch to handle missing-file errors from `readDocument` | Code search: no `readDocument` callers wrapped in try/catch for missing-file handling |
| Contract enforcement | Pipeline returns an error result when any of the 3 newly-required frontmatter fields (`tasks`, `has_deviations`/`deviation_type`, `exit_criteria_met`) are absent from their respective documents | Behavioral tests: at least one test per required field verifying the pipeline errors on absence |
| Task-level triage row coverage | 11/11 rows exercised in behavioral tests | Test count: each of the 11 rows has at least one dedicated test assertion |
| Phase-level triage row coverage | 5/5 rows exercised in behavioral tests | Test count: each of the 5 rows has at least one dedicated test assertion |
| End-to-end path coverage | Full happy path (start → complete) verified in at least one behavioral test | Test existence: at least one test drives a complete pipeline lifecycle |
| Existing test suite status | 0 regressions — all currently-passing tests continue to pass | CI: full test suite passes after all changes |
