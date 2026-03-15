---
project: "PIPELINE-HOTFIX"
author: "brainstormer-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Brainstorming

## Problem Space

The SCRIPT-SIMPLIFY-AGENTS refactor successfully replaced three standalone scripts with a unified pipeline engine, but a benchmark run (RAINBOW-HELLO project) exposed 6 bugs — 2 critical, 2 medium, 2 minor — that prevent the pipeline from completing an end-to-end execution cycle. The bugs cluster into three themes: incomplete state lifecycle in mutation handlers, resolver returning internal actions that aren't in the Orchestrator's routing table, and a schema enforcement gap between the task report skill and the triage decision table. These must be fixed before the pipeline is usable for any real project.

## Validated Ideas

### Idea 1: Master Plan Pre-Read for Phase Initialization (Error 1 — Critical)

**Description**: The `handlePlanApproved` mutation transitions to the execution tier but does not initialize `execution.phases[]` or `total_phases`, causing the resolver to immediately skip to final review. Fix by adding a pre-read step in the pipeline engine (following the existing `task_completed` → task report pre-read pattern). The engine reads the master plan document (path already in `state.planning.steps.master_plan.output`), extracts `total_phases` from frontmatter, and injects `context.total_phases`. The mutation handler then initializes `execution.phases[]` with `not_started` entries. Requires adding `total_phases` to the master plan template frontmatter — a one-line skill template change.

**Rationale**: Follows the established pre-read pattern exactly. Mutations stay pure, I/O stays isolated in the engine, and the master plan becomes the single source of truth for phase count.

**Key considerations**: The `create-master-plan` skill template needs a `total_phases` frontmatter field. The Architect agent's instructions should mention filling it (or the skill can auto-derive it from the phase outline sections).

### Idea 2: Resolver Returns `execute_task` for In-Progress Tasks (Error 2 — Medium)

**Description**: After `task_handoff_created` sets a task to `in_progress`, the resolver returns `update_state_from_task` (an internal action) instead of `execute_task`. Fix the resolver's task-state logic: when a task is `in_progress` with a `handoff_doc` but no `report_doc`, return `execute_task`. This is a ~3-line conditional fix.

**Rationale**: `update_state_from_task` is a mechanical state mutation that should never surface as an external action. The Orchestrator's routing table is the contract — the resolver must only return actions that exist in it.

**Key considerations**: Light defensive check — add a guard in the pipeline engine or resolver that validates the resolved action is in the known action vocabulary before returning. Logs a warning if an unmapped action is produced. Prevents silent routing failures.

### Idea 3: Task Report Status Vocabulary Normalization (Error 3 — Minor)

**Description**: The triage decision table expects `status: complete` but the Coder wrote `status: pass`. Two-part fix: (1) Update the `generate-task-report` skill template and instructions to explicitly constrain the vocabulary to `status: complete | failed`. (2) Add a light normalization in the pipeline engine's task-report pre-read (~3 lines): map `pass` → `complete`, `fail` → `failed`, and reject anything else with a clear error message.

**Rationale**: The skill fix prevents the issue at the source. The normalization is a cheap defensive layer that catches the case where an LLM still uses the wrong word despite instructions.

**Key considerations**: Normalization is intentionally limited to obvious synonyms — not a general-purpose mapper. Unknown values should produce a clear error, not silent normalization.

### Idea 4: Triage Null/Null Auto-Approve for Clean Reports (Error 4 — Critical)

**Description**: Triage Row 1 returns `(verdict: null, action: null)` for clean reports (no deviations, no code review needed), which means nothing happens — the task stays `in_progress` forever. Fix: in `applyTaskTriage` (and `applyPhaseTriage`), when verdict and action are both null and a report_doc exists, treat it as `(APPROVED, ADVANCED)` — auto-approve clean work, advance the task/phase pointer, and set status to `complete`. This is a ~5-10 line guard in each function.

**Rationale**: A clean report with no review needed is the happy path — it should not deadlock the pipeline. Auto-approving clean work is the correct semantic: "nothing to triage" means "everything is fine."

**Key considerations**: Must carefully handle the task advancement (increment `current_task`, set task status) to avoid introducing a new lifecycle gap. Needs thorough regression tests covering the null/null path for both task and phase triage.

### Idea 5: Internal Action Handling for `advance_phase` (Error 5 — Medium, also fixes Error 6)

**Description**: The resolver returns `advance_phase` when a phase is approved, but this is an internal mechanical action (increment phase pointer, set phase status to `complete`) that the Orchestrator should never see. Fix: the pipeline engine handles `advance_phase` internally — applies the advancement mutation, re-validates, re-resolves to get the next *external* action. The advancement logic sets the current phase to `complete` and either increments `current_phase` to the next phase or sets `execution.status = complete` if it was the last phase (triggering `transition_to_review` on re-resolve). This also fixes Error 6 because `current_phase` never goes past the last valid index — the "past-the-end" state is avoided entirely.

**Rationale**: This is exactly the kind of mechanical state mutation the pipeline script was designed to internalize. Keeping phase advancement inside the engine eliminates the routing gap (Error 5) and the validator edge case (Error 6) in one fix.

**Key considerations**: The re-resolve loop must be bounded (max 1 internal iteration) to prevent infinite loops. If the re-resolved action is still internal, that's a bug — return an error. Test the boundary case: last phase completes → `current_phase` stays at last index → `execution.status = complete` → resolver returns `transition_to_review`.

### Idea 6: Error Logging Skill for the Orchestrator

**Description**: Create a lightweight `log-error` skill that gives the Orchestrator a structured template and instructions for logging execution errors to a per-project error log file (`{NAME}-ERROR-LOG.md`). The Orchestrator auto-logs when the pipeline script returns `success: false` (validation failures, triage failures, unmapped actions) and can optionally log agent-level issues (invalid output, repeated review rejections, stalls, human gate problems). Each error entry captures: when it happened, what event/action triggered it, the symptom, root cause (if known), pipeline output, workaround applied, and severity. The file is append-only — new errors are added as numbered sections.

**Rationale**: The RAINBOW-HELLO error log was created manually by steering the Orchestrator. Formalizing this as a skill means every project automatically accumulates a diagnostic log, making it easy to track systemic issues across runs and stabilize the pipeline over time. It also benefits end users of the orchestration system who hit unexpected errors.

**Key considerations**: The skill template should be lightweight — just enough structure for consistent entries without being burdensome. The Orchestrator agent definition needs to reference this skill and include instructions for when to invoke it. Auto-logging on pipeline failure should be near-mandatory in the Orchestrator's error handling flow; agent-level logging is at the Orchestrator's discretion.

### Idea 7: Regression Test Suite for All 6 Error Scenarios

**Description**: Add targeted test cases covering each of the 6 failure scenarios discovered in the RAINBOW-HELLO benchmark. These tests should exercise the exact state + event + context combinations that triggered the bugs, verifying the fixes produce the correct output. Tests go in the existing pipeline test files (`mutations.test.js`, `pipeline-engine.test.js`).

**Rationale**: These are known failure modes that slipped through the original test suite. Regression tests ensure they never recur and serve as documentation of the edge cases.

**Key considerations**: Tests should use the same mocked I/O pattern as existing pipeline engine tests. Each test should set up the pre-condition state, fire the event, and assert the correct post-condition (not just "no error").

### Idea 8: Documentation and Instruction File Updates

**Description**: Update all documentation, instruction files, and skill instructions to accurately describe the system after fixes are applied. This includes: (1) `docs/scripts.md` — restructure the action vocabulary to distinguish internal vs. external actions, document the internal action handling pattern and unmapped action guard; (2) `docs/pipeline.md` — describe master plan pre-read, status normalization, auto-approve for null/null triage, internal action loop; (3) `docs/agents.md` — Orchestrator gains `log-error` skill; (4) `docs/skills.md` — add `log-error` skill entry; (5) `docs/project-structure.md` — add `ERROR-LOG.md` as a project artifact; (6) `README.md` — update project files, error logging mention; (7) `.github/copilot-instructions.md` — add `ERROR-LOG.md` to project files list; (8) `.github/instructions/project-docs.instructions.md` — add `ERROR-LOG.md` ownership; (9) `create-master-plan` SKILL.md instructions — document `total_phases` as a required frontmatter field. Documentation should only describe how the system works today — no references to prior behavior or "before/after" language.

**Rationale**: Documentation that doesn't match the code is actively harmful — agents and humans will make wrong assumptions. A dedicated documentation phase ensures every affected file is updated in one sweep.

**Key considerations**: 10+ files need updates. Each update is small but the sweep must be comprehensive. No "previously X, now Y" language — docs should read as if the system always worked this way.

## Scope Boundaries

### In Scope
- Fix all 6 bugs identified in the RAINBOW-HELLO error log
- Add `total_phases` to master plan template frontmatter (simple field, no auto-derive)
- Add master plan pre-read to pipeline engine for `plan_approved` event
- Fix resolver logic for `in_progress` tasks with handoffs
- Update `generate-task-report` skill to constrain status vocabulary
- Add status normalization in pipeline engine task-report pre-read
- Fix `applyTaskTriage` and `applyPhaseTriage` null/null handling
- Add internal `advance_phase` handling in pipeline engine
- Add hard error guard for unmapped actions in resolver output
- Create `log-error` skill with error log template
- Update Orchestrator agent definition to reference `log-error` skill and auto-log on pipeline failure
- Add regression tests for all 6 error scenarios
- Update any tests broken by the fixes

- Update `docs/scripts.md` — restructure action vocabulary (internal vs. external), document unmapped action guard
- Update `docs/pipeline.md` — master plan pre-read, status normalization, auto-approve, internal action loop
- Update `docs/agents.md` — Orchestrator error logging skill
- Update `docs/skills.md` — add `log-error` skill entry
- Update `docs/project-structure.md` — add `ERROR-LOG.md` as project artifact
- Update `README.md` — project files, error logging
- Update `.github/copilot-instructions.md` — add `ERROR-LOG.md` to project files
- Update `.github/instructions/project-docs.instructions.md` — `ERROR-LOG.md` ownership
- Update `create-master-plan` SKILL.md — document `total_phases` required frontmatter field
- All documentation describes current system behavior only — no references to prior behavior

### Out of Scope
- New features or pipeline capabilities
- Refactoring beyond what's needed for the fixes
- Documentation overhaul (the SCRIPT-SIMPLIFY-AGENTS Phase 4 handles that)
- Changes to the triage decision table itself (Row 1 null/null is handled by the caller, not by changing the table)
- Agent definition or skill rewrites beyond the specific template changes noted (except Orchestrator error-logging additions)
- Dashboard or UI changes

## Key Constraints

- All 4 preserved lib test suites must continue to pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- Fixes must follow the existing architectural patterns (pre-read for I/O, pure mutations, I/O isolation via `state-io.js`)
- CommonJS + Node.js built-ins only, zero npm dependencies
- The triage decision table itself is not modified — the null/null case is handled by the callers (`applyTaskTriage`, `applyPhaseTriage`)

## Resolved Questions

- **`total_phases` in master plan frontmatter**: Simple frontmatter field filled by the Architect — no auto-derive mechanics in the skill. Keep it straightforward.
- **Unmapped action guard**: Hard error (exit code 1, no state written). Unmapped actions are always bugs and should be caught immediately, not papered over.

## Open Questions

- None at this time.

## Summary

This project fixes the 6 bugs discovered during the RAINBOW-HELLO benchmark that prevent the pipeline from completing an end-to-end execution cycle. The fixes target mutation handlers (`plan_approved` phase initialization, task completion lifecycle), the resolver (internal vs. external action boundaries), skill templates (task report status vocabulary), and triage application (null/null auto-approve). It also adds a `log-error` skill so the Orchestrator can systematically log execution errors going forward. A regression test suite covers all 6 scenarios. A final documentation phase sweeps all affected docs, instruction files, and skill instructions to accurately describe the system — no references to prior behavior, just the current system. The project is small and surgical — targeted fixes, one new lightweight skill, and a comprehensive documentation sweep.
