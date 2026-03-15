---
project: "PIPELINE-BEHAVIORAL-TESTS"
author: "brainstormer-agent"
created: "2026-03-14T14:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Brainstorming

## Problem Space

During execution of the UI-PATH-FIX project, four issues were discovered (documented in UI-PATH-FIX-DISCOVERED-ISSUES.md and UI-PATH-FIX-ERROR-LOG.md). Two were fixed in-flight (triage crash on project-relative paths, V13 timestamp race). Two remain unfixed and affect pipeline robustness for all future projects. Beyond those specific issues, a broader pattern emerged: **pipeline code reads frontmatter fields that skill templates never define**, creating a systemic mismatch between document producers (agents using skill templates) and document consumers (pipeline/triage engines). Additionally, the existing unit tests validate individual functions but not cross-cutting event chains — the blocking issues would have been caught by behavioral tests.

## Validated Goals

### Goal 1: Frontmatter cohesion across skill templates and pipeline consumers

**Description**: Audit and align all skill templates so that their YAML frontmatter fields match what the pipeline and triage engines actually read. Three concrete gaps were identified through research:

| Template | Missing Field(s) | Consumer |
|----------|------------------|----------|
| Phase Plan (`PHASE-PLAN.md`) | `tasks` array (id + title per task) | `pipeline-engine.js` pre-read for `phase_plan_created` — currently there is no pre-read; the Orchestrator must manually pass `context.tasks` |
| Task Report (`TASK-REPORT.md`) | `has_deviations`, `deviation_type` | `triage-engine.js` `triageTask` — reads these from frontmatter to determine triage outcome |
| Phase Review (`PHASE-REVIEW.md`) | `exit_criteria_met` | `triage-engine.js` `triagePhase` — reads this from frontmatter but template only has `verdict` and `severity` |

Additionally, templates that already work correctly should serve as the reference pattern:
- **Master Plan**: `total_phases` in frontmatter → consumed by `plan_approved` pre-read ✓
- **Code Review**: `verdict`, `severity` in frontmatter → consumed by task triage ✓

**Rationale**: Instead of reacting to individual issues as they surface, establish a consistent convention: every document field the pipeline reads must exist in the corresponding skill template's frontmatter. This makes the contract explicit and prevents future mismatch bugs. The phase plan `tasks` gap is the most impactful — without it, the Orchestrator must manually extract and pass task definitions, and if it fails the phase initializes with zero tasks.

**Key considerations**: Template changes must be backward-compatible — agents may already produce documents using the old templates. The pipeline should fall back gracefully when optional frontmatter fields are absent. Existing documents from completed projects should not break. Each template fix should be paired with updates to the corresponding skill instructions so agents know to produce the new fields.

### Goal 2: Fix `readDocument` throw/null mismatch

**Description**: Change `readDocument` in `state-io.js` to return `null` for missing files instead of throwing. Audit all call sites to ensure they handle the null return correctly.
**Rationale**: The triage engine's `triageTask` and `triagePhase` functions check `if (!taskReport)` after calling `readDocument()`, expecting null for missing files. But `readDocument` throws, making those null-check fallback paths dead code. The `createProjectAwareReader` wrapper partially mitigates this but adds complexity. Changing the source function to return null is the more elegant fix that keeps the codebase simple — one clear contract instead of layered workarounds.
**Key considerations**: This is a signature change requiring an audit of every `readDocument` call site. Any caller that depends on the throw for error handling must be updated. The `createProjectAwareReader` wrapper's catch-and-retry logic may simplify or become unnecessary after this change.

### Goal 3: Comprehensive behavioral test suite for pipeline execution paths

**Description**: Create a dedicated behavioral test file that simulates complete pipeline execution scenarios end-to-end using the existing mock IO infrastructure. Tests should drive `executePipeline` through full event chains — from `start` through planning, execution, triage, gates, reviews, and terminal states.
**Rationale**: The UI-PATH-FIX project hit two blocking issues that would have been caught by behavioral tests exercising the triage + internal advance path. Current unit tests validate individual functions but don't catch cross-cutting failures where one mutation's output becomes another component's input. A behavioral suite makes it safe to iterate faster on pipeline changes.
**Key considerations**: The test file should be a separate, easy-to-discover file (not buried inside `pipeline-engine.test.js`) so that agents working on pipeline changes can find and run it. The mock IO pattern (`createMockIO` with in-memory state/documents) and `withStrictDates` helper already exist and should be reused. Coverage should include at minimum: (1) full happy path, (2) multi-phase/multi-task, (3) all 11 task-level triage rows, (4) all 5 phase-level triage rows, (5) all human gate modes, (6) retry/corrective cycles, (7) halt paths, (8) path normalization through triage, (9) cold start resume, (10) pre-read failures, (11) frontmatter-driven flows for the new fields from Goal 1.

## Scope Boundaries

### In Scope
- Frontmatter alignment for phase plan, task report, and phase review templates
- Corresponding skill instruction updates for agents producing those documents
- `phase_plan_created` pre-read in `pipeline-engine.js` (enabled by phase plan frontmatter fix)
- `readDocument` signature change from throw to null-return in `state-io.js`
- Audit and update all `readDocument` call sites
- Behavioral test suite covering all major pipeline paths
- Regression tests for the two issues fixed during UI-PATH-FIX (triage path crash, V13 race)

### Out of Scope
- Changes to the triage decision table logic itself (row definitions stay the same)
- UI changes
- Orchestrator agent prompt changes
- Adding frontmatter fields to templates that aren't consumed by pipeline code
- Changes to existing unit tests (behavioral tests complement, not replace)

## Key Constraints

- Pipeline integrity is paramount — changes must not break existing projects or in-flight state
- The V13 timestamp fix and `createProjectAwareReader` from UI-PATH-FIX are already deployed; this project builds on them
- Tests must use `node:test` runner (no external dependencies) to match existing infrastructure
- Template changes must be backward-compatible — absent frontmatter fields should trigger graceful fallbacks, not crashes

## Resolved Questions

- **Frontmatter structure**: Research identified the consistent pattern — pipeline-consumed fields go in YAML frontmatter, body content stays as markdown. Three specific gaps found (phase plan tasks, task report deviations, phase review exit criteria). Master Plan and Code Review serve as reference examples of correct producer-consumer alignment.
- **Test file location**: A separate, easy-to-discover test file — not merged into `pipeline-engine.test.js`. Agents making pipeline changes should be able to find and run it naturally.
- **`readDocument` fix approach**: Option (b) — change `readDocument` to return null. It's the more elegant solution that keeps the codebase simple instead of layering workarounds.

## Summary

PIPELINE-BEHAVIORAL-TESTS addresses a systemic mismatch between skill templates (document producers) and pipeline/triage engines (document consumers) — three templates lack frontmatter fields that the pipeline reads at runtime. It also fixes the `readDocument` throw/null contract to eliminate dead code paths in triage, and creates a comprehensive behavioral test suite that covers end-to-end pipeline execution paths. The frontmatter cohesion work establishes a convention that prevents future mismatches; the test suite enables confident iteration on pipeline changes.
