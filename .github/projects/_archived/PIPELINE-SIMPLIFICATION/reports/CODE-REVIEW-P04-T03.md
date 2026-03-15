---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 3
verdict: "changes_requested"
severity: "minor"
author: "reviewer-agent"
created: "2026-03-14"
---

# Code Review: Phase 4, Task 3 — Documentation & Instructions Update

## Verdict: CHANGES REQUESTED

## Summary

The bulk of the documentation update is excellent — triage references, internal actions, old invariant IDs, and v2 module names have been thoroughly removed across all four docs files and the Architecture doc. Event/action vocabularies, result shapes, module trees, and the pipeline lifecycle narrative are all accurate. However, the invariant descriptions for V5, V6, V7, and V10 in `docs/validation.md` were copied from the task handoff instead of being verified against the actual v3 `validator.js` code, and they are incorrect. This is the only blocking issue.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ⚠️ | Invariant descriptions drift from actual code (see #1 below) |
| Design consistency | ✅ | N/A — documentation-only task |
| Code quality | ✅ | Clean, consistent markdown; good structure throughout |
| Test coverage | ✅ | Grep-based verifications all pass for triage/old-invariant removal |
| Error handling | ✅ | N/A — documentation-only task |
| Accessibility | ✅ | N/A — documentation-only task |
| Security | ✅ | N/A — no code changes |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `docs/validation.md` | 151–154 | minor | **Invariant descriptions for V5, V6, V7, V10 do not match actual v3 code.** The handoff provided incorrect descriptions and the task handoff itself noted "Check the actual v3 validator and use its descriptions", but the Coder used the handoff-provided table instead. The actual `validator.js` checks are different from what the docs describe. See details below. | Update the four rows to match the actual v3 `validator.js` implementation. See corrected table below. |
| 2 | `docs/project-structure.md` | 27–28 | minor | **Out-of-scope residual**: file tree still lists `state-validator.js` and `triage-engine.js` in the `lib/` directory. Not in this task's file targets, but should be a carry-forward item. | Create a follow-up task to update `docs/project-structure.md` file tree (replace `state-validator.js` with `validator.js`, remove `triage-engine.js`, add `pre-reads.js`). |

### Issue #1 Detail — Invariant Mismatch

Current docs/validation.md says:

| ID | Name | Description (docs) |
|----|------|--------------------|
| V5 | Human approval gate | `current_tier` cannot be `execution` unless `planning.human_approved` is `true` |
| V6 | Single active task | At most one task across the entire project may have status `in_progress` |
| V7 | Retry limit | No task's `retries` may exceed `limits.max_retries_per_task` |
| V10 | Schema version | Schema version must be `orchestration-state-v3` |

Actual v3 `validator.js` implementation:

| ID | Name | Actual Check |
|----|------|-------------|
| V5 | Config limits | `phases.length` must not exceed `config.limits.max_phases`; each phase's `tasks.length` must not exceed `config.limits.max_tasks_per_phase` |
| V6 | Human approval gate | Execution tier requires `planning.human_approved` to be `true` |
| V7 | Final review gate | Complete tier with `after_final_review` gate enabled requires `planning.human_approved` to be `true` |
| V10 | Phase-tier consistency | Active phase status must be consistent with `current_tier` (e.g., no `in_progress` phase during planning tier; all phases `complete` or `halted` during review/complete tier) |

Note: There is no "single active task" invariant in v3 (that was V8 in v2, which was removed). There is no "retry limit" invariant as a standalone check (retry budget is enforced inside mutation decision tables). There is no "schema version" check in `validateTransition`.

## Positive Observations

- Thorough removal of all triage-layer references across four documentation files — zero residual matches for `triage_engine`, `triage-engine`, `triage_attempts`, `TRIAGE_LEVELS`
- Event vocabulary correctly lists 17 events with accurate tier assignments and descriptions
- Action vocabulary correctly lists 18 external-only actions organized by tier — clean removal of all internal actions, the Type column, and the 35-action language
- Result shapes updated to match v3 `PipelineResult` — no `triage_ran` or `validation_passed`
- Module tree accurately reflects v3 file layout: `validator.js`, `pre-reads.js`, no `triage-engine.js` or `state-validator.js`
- Architecture doc carry-forward fixes applied correctly: 3-param `validateTransition`, 17-event handler count, `lib/` paths
- Sensible deviation on the 2 remaining `lib-v3/` references in the Architecture doc's Delivery Swap Sequence — these describe the rename operand, not module paths
- Good judgment removing the Auto-Approve and Internal Action Loop sections from pipeline.md, which were purely v2 concepts
- `state-management.instructions.md` verified with no changes needed — already correct from T02

## Recommendations

- Fix the four invariant descriptions (V5, V6, V7, V10) in `docs/validation.md` to match the actual `validator.js` code — this is the only change needed for approval
- Create a follow-up carry-forward item to update `docs/project-structure.md` file tree (not in this task's scope, but still has v2 module names)
