---
project: "PIPELINE-HOTFIX"
status: "draft"
author: "product-manager-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Product Requirements

## Problem Statement

The unified pipeline engine (`pipeline.js`) introduced by the SCRIPT-SIMPLIFY-AGENTS refactor cannot complete an end-to-end execution cycle. A benchmark run (RAINBOW-HELLO project) exposed 6 bugs spanning mutation handlers, the resolver, triage application, and skill template vocabulary — 2 critical, 2 medium, and 2 minor. Until these are fixed, no project can progress from planning approval through task execution to completion. Additionally, the Orchestrator has no structured mechanism for logging execution errors, forcing manual error tracking.

## Goals

- **G1**: All 6 identified pipeline bugs are fixed and verified by regression tests
- **G2**: The RAINBOW-HELLO benchmark scenario (or an equivalent synthetic equivalent) runs end-to-end without manual intervention or pipeline stalls
- **G3**: The Orchestrator can systematically log execution errors to a persistent, per-project error log using a dedicated skill
- **G4**: All 4 preserved library test suites (`constants`, `resolver`, `state-validator`, `triage-engine`) continue to pass unmodified
- **G5**: All documentation and instruction files accurately describe the system as it exists after the fixes — no stale references to action vocabulary, pipeline behaviors, or project structure

## Non-Goals

- New pipeline features or capabilities beyond the 6 bug fixes and error logging skill
- Refactoring beyond what is strictly required to fix the bugs
- Broad documentation overhaul beyond the 9 directly affected files (that wider scope remains in SCRIPT-SIMPLIFY-AGENTS Phase 4)
- Changes to the triage decision table rows themselves (null/null is handled by callers)
- Agent definition or skill rewrites beyond the specific template corrections and Orchestrator error-logging additions
- Dashboard or UI changes

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Pipeline Orchestrator | have execution phases initialized when the plan is approved | the execution tier starts with a valid phase array instead of immediately skipping to final review | P0 |
| 2 | Pipeline Orchestrator | receive an actionable external action when a task is in progress with a handoff | I can route the action to the correct agent instead of receiving an unmapped internal action | P0 |
| 3 | Pipeline Engine | normalize task report status vocabulary before triage | triage never fails due to synonym mismatches between what the Coder writes and what the decision table expects | P1 |
| 4 | Pipeline Engine | auto-approve clean task and phase reports when triage returns no verdict | tasks and phases with clean reports advance instead of deadlocking in an infinite triage loop | P0 |
| 5 | Pipeline Engine | handle phase advancement internally when a phase is approved | the Orchestrator never receives an unmapped `advance_phase` action, and the phase pointer never exceeds array bounds | P0 |
| 6 | Pipeline Orchestrator | log execution errors to a structured per-project error log | I have a persistent diagnostic record of pipeline failures across runs without manual tracking | P1 |
| 7 | Pipeline Developer | have regression tests covering all 6 failure scenarios | these specific bugs never recur and edge cases are documented as executable specifications | P1 |

## Functional Requirements

### Bug Fix 1: Phase Initialization on Plan Approval (Error 1 — Critical)

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | When the `plan_approved` event is processed, the pipeline engine shall read the master plan document (path stored in `state.planning.steps.master_plan.output`) and extract `total_phases` from its frontmatter before the mutation runs | P0 | Follows the existing task-report pre-read pattern in the pipeline engine |
| FR-2 | The `handlePlanApproved` mutation handler shall use the injected `total_phases` context to populate `execution.phases[]` with the correct number of phase entries (each initialized to `not_started` status) and set `execution.total_phases` | P0 | Without this, `phases.length = 0` causes the resolver to skip the entire execution tier |
| FR-3 | The master plan skill template shall include a `total_phases` field in its YAML frontmatter | P0 | One-line template change; the Architect fills this value when creating the master plan |

### Bug Fix 2: Resolver Returns Correct Action for In-Progress Tasks (Error 2 — Medium)

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-4 | When a task has status `in_progress` with a `handoff_doc` but no `report_doc`, the resolver's `resolveTaskLifecycle` function shall return `execute_task` (spawn the Coder) | P0 | Currently returns `update_state_from_task`, an internal action not in the Orchestrator's routing table |
| FR-5 | When a task has status `in_progress` with both a `handoff_doc` and a `report_doc`, the resolver shall return `update_state_from_task` | P1 | Preserves existing behavior for the case where the Coder has already produced output |

### Bug Fix 3: Task Report Status Vocabulary (Error 3 — Minor)

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-6 | The `generate-task-report` skill shall explicitly constrain the status vocabulary to exactly `complete`, `partial`, or `failed` with prominent instructional text (not just a table reference) | P1 | Prevents the issue at the source — LLM agents need explicit constraints |
| FR-7 | The pipeline engine's task-report pre-read shall normalize known status synonyms: `pass` → `complete`, `fail` → `failed` | P1 | Defensive layer for when an agent uses the wrong word despite instructions |
| FR-8 | The pipeline engine shall return a hard error (exit code 1, no state written) if the task report status is not in the set `{complete, partial, failed}` after normalization | P1 | Unknown values indicate a skill template violation and must not be silently accepted |

### Bug Fix 4: Auto-Approve Clean Reports on Triage Null/Null (Error 4 — Critical)

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-9 | When `applyTaskTriage` receives a null verdict and null action, and the task has a `report_doc`, it shall treat this as auto-approval: set the task status to `complete`, verdict to `approved`, action to `advanced`, and reset triage attempts | P0 | Currently applies zero mutations, leaving the task in `in_progress` forever |
| FR-10 | When `applyPhaseTriage` receives a null verdict and null action, and the phase has a phase report, it shall treat this as auto-approval: set the phase review verdict to `approved`, action to `advanced`, and reset triage attempts | P0 | Same deadlock pattern at the phase level |
| FR-11 | The triage decision table itself shall NOT be modified — Row 1 still returns null/null; the auto-approve translation is the responsibility of the `applyTaskTriage` and `applyPhaseTriage` callers | P0 | Preserves the triage engine's existing test suite |

### Bug Fix 5: Internal Phase Advancement (Error 5 — Medium, also fixes Error 6)

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-12 | When the resolver returns `advance_phase`, the pipeline engine shall handle it internally: apply phase advancement (set current phase to `complete`, advance the phase pointer or mark execution complete if it was the last phase), re-validate, and re-resolve to obtain the next external action | P0 | `advance_phase` is not in the Orchestrator's routing table |
| FR-13 | The internal re-resolve loop shall be bounded to a maximum of 1 internal iteration; if the re-resolved action is still an internal/unmapped action, the engine shall return a hard error | P0 | Prevents infinite loops from chained internal actions |
| FR-14 | When the last phase is advanced, `current_phase` shall remain at the last valid array index and `execution.status` shall be set to `complete` — the phase pointer shall never exceed `phases.length - 1` | P0 | Eliminates the V1 validator out-of-bounds error (Error 6) without modifying the validator |

### Unmapped Action Guard

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-15 | After resolving the next action, the pipeline engine shall validate that the action is in the Orchestrator's known 18-action external vocabulary; if not, the engine shall return a hard error (exit code 1) with a descriptive message naming the unmapped action | P1 | Catches future resolver bugs before they silently fail in the routing table |

### Error Logging Skill

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-16 | A `log-error` skill shall be created that provides the Orchestrator with a structured template for appending error entries to a per-project error log file (`{NAME}-ERROR-LOG.md`) | P1 | Follows the existing skill directory structure: `SKILL.md` + `templates/` |
| FR-17 | Each error log entry shall capture: entry number, timestamp, triggering event/action, symptom, root cause (if known), pipeline output, workaround applied (if any), and severity classification | P1 | Structured enough for pattern analysis, lightweight enough not to burden the Orchestrator |
| FR-18 | The error log file shall be append-only — new entries are added as sequentially numbered sections; no agent rewrites existing entries | P1 | Preserves the diagnostic history |
| FR-19 | The Orchestrator agent definition shall reference the `log-error` skill and include instructions to invoke it automatically when the pipeline returns `success: false` | P1 | Makes error logging a near-mandatory part of the error handling flow |

### Regression Tests

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-20 | A regression test shall verify that `plan_approved` with a master plan pre-read correctly initializes the phase array with the expected number of `not_started` entries | P1 | Covers Error 1 |
| FR-21 | A regression test shall verify that after `task_handoff_created`, the resolver returns `execute_task` (not `update_state_from_task`) for an in-progress task with a handoff but no report | P1 | Covers Error 2 |
| FR-22 | A regression test shall verify that a task report with `status: 'pass'` is normalized to `complete` before triage, and that an unknown status like `status: 'banana'` produces a hard error | P1 | Covers Error 3 |
| FR-23 | A regression test shall verify that `applyTaskTriage` with null/null verdict/action and a `report_doc` present results in auto-approval (task status `complete`, verdict `approved`) | P1 | Covers Error 4 (task level) |
| FR-24 | A regression test shall verify that `applyPhaseTriage` with null/null verdict/action and a phase report present results in auto-approval | P1 | Covers Error 4 (phase level) |
| FR-25 | A regression test shall verify that `advance_phase` is handled internally by the pipeline engine, producing the correct next external action (`create_phase_plan` for mid-project, `transition_to_review` for last phase) | P1 | Covers Errors 5 and 6 |
| FR-26 | A regression test shall verify that after the last phase completes, `current_phase` remains at the last valid array index and `execution.status = 'complete'` — no V1 validation error | P1 | Covers Error 6 specifically |
| FR-27 | The existing `applyTaskTriage` skip-case test (which asserts zero mutations for null/null) shall be updated to reflect the new auto-approve behavior when a report_doc exists | P1 | Existing test will break without this update |

### Phase 3: Documentation & Instruction File Updates

All documentation shall describe only the current system behavior — no references to prior behavior, migration steps, or "before/after" language.

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-28 | `docs/scripts.md` shall restructure the action vocabulary to distinguish internal actions (handled entirely within the pipeline engine) from external actions (returned to the Orchestrator). `advance_phase` and `update_state_from_task` shall be documented as internal. The unmapped action guard shall be documented. | P1 | Eliminates the stale 35-action list that includes internal actions as if they are Orchestrator-visible |
| FR-29 | `docs/pipeline.md` shall document the master plan pre-read on `plan_approved`, task report status normalization, null/null auto-approve for clean triage, and the bounded internal action re-resolve loop | P1 | Core pipeline behaviors that are undocumented |
| FR-30 | `docs/agents.md` shall document the Orchestrator's `log-error` skill usage and auto-log behavior on pipeline failure | P1 | New skill added in Phase 2 |
| FR-31 | `docs/skills.md` shall include a `log-error` skill entry consistent with the format of other skill entries | P1 | New skill added in Phase 2 |
| FR-32 | `docs/project-structure.md` shall list `{NAME}-ERROR-LOG.md` as a project artifact created by the Orchestrator during error conditions | P1 | New file type introduced in Phase 2 |
| FR-33 | `README.md` shall include `ERROR-LOG.md` in the project files overview and mention the error logging capability | P1 | Top-level documentation must reflect the new skill |
| FR-34 | `.github/copilot-instructions.md` shall add `ERROR-LOG.md` to the Project Files list under the Execution docs section | P1 | Always-loaded instructions must be accurate |
| FR-35 | `.github/instructions/project-docs.instructions.md` shall add a row for `ERROR-LOG.md` with ownership attributed to the Orchestrator | P1 | Instruction files govern how agents interact with project documents |
| FR-36 | `create-master-plan` SKILL.md instructions shall document `total_phases` as a required frontmatter field, explaining that the pipeline engine reads it on plan approval to initialize the execution phase array | P0 | Without this instruction, Architects may omit the field |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Backward Compatibility | All 4 preserved library test suites (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`) shall pass unmodified |
| NFR-2 | Architectural Consistency | All fixes shall follow the existing patterns: pre-read for I/O, pure mutation handlers, I/O isolation via the `PipelineIO` interface |
| NFR-3 | Dependency Constraint | Zero npm dependencies; CommonJS + Node.js built-ins only |
| NFR-4 | Error Clarity | All new error conditions (unmapped actions, unknown report statuses, pre-read failures) shall produce descriptive error messages that name the specific failing value and expected values |
| NFR-5 | Test Quality | Regression tests shall assert correct post-condition state (not just absence of errors) and use the existing mock I/O and fixture factory patterns |
| NFR-6 | Scope Discipline | No changes beyond what is strictly required to fix the 6 bugs, add the error logging skill, update affected templates, add regression tests, and update the 9 directly affected documentation files |

## Assumptions

- The `total_phases` frontmatter field in the master plan is a reliable source of truth for the number of execution phases (filled by the Architect at plan creation time)
- The existing 4 preserved test suites comprehensively cover resolver, validator, triage, and constants behavior — if they pass, the fixes have not introduced regressions in those modules
- The Coder agent will respect skill template vocabulary constraints more consistently once they are made more prominent, but the normalization layer is a necessary safety net
- The triage engine's Row 1 (null/null for clean reports) is correct behavior — "nothing to triage" semantically means "auto-approve"

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Auto-approve logic in `applyTaskTriage`/`applyPhaseTriage` might incorrectly advance tasks that should have been reviewed | High | The auto-approve only activates when triage returns null/null AND a report exists — Row 1 already requires `complete` + no deviations + no review doc. Regression tests verify the exact conditions. |
| 2 | Bounded re-resolve loop (max 1 iteration) might not be sufficient for future complex state transitions | Med | Current analysis shows only `advance_phase` triggers re-resolve. If future internal actions are added, the bound can be increased. Hard error on exceeding the bound makes the issue immediately visible. |
| 3 | Status normalization might mask genuine skill template issues by silently correcting wrong values | Low | Normalization is limited to 2 obvious synonyms (`pass`→`complete`, `fail`→`failed`). All other unknown values produce a hard error. The skill template fix addresses the root cause. |
| 4 | Existing skip-case test update (FR-27) changes the meaning of an established test — could introduce subtle test coverage gaps | Low | The old test asserted behavior for a case that was buggy. The new test asserts the correct behavior. The null/null-without-report case should still be tested separately. |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bug fix coverage | All 6 identified errors resolved | Each error has at least one regression test that fails before the fix and passes after |
| End-to-end execution | Pipeline completes the RAINBOW-HELLO benchmark (or equivalent) from `plan_approved` through `display_complete` without stalls or routing errors | Manual or automated benchmark run |
| Preserved test suites | 4/4 preserved test suites pass | `node --test` on `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js` |
| Error logging adoption | Orchestrator auto-logs on every `success: false` pipeline result | Presence of `log-error` skill reference in Orchestrator agent definition and error handling instructions |
| Regression test count | Minimum 7 new test cases (1 per error + 1 for phase-level null/null) | Test file line count delta in `mutations.test.js` and `pipeline-engine.test.js` |
| Documentation accuracy | All 9 affected documentation files updated; no references to prior behavior | Grep check for stale action names (`update_state_from_task`, `advance_phase` as external actions) and absent `ERROR-LOG.md` references |
