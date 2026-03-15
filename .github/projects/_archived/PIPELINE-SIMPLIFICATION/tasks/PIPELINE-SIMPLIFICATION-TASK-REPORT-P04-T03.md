---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 3
title: "Documentation Fix — Invariant Descriptions"
status: "complete"
files_changed: 1
tests_written: 0
tests_passing: 0
build_status: "pass"
has_deviations: true
deviation_type: "minor"
---

# Task Report: Documentation Fix — Invariant Descriptions

## Summary

Fixed 4 incorrect invariant descriptions (V5, V6, V7, V10) in `docs/validation.md` to match the actual `validator.js` implementation. Verified V1–V4 and V11–V13; found and fixed two additional inaccuracies in V12's name/description and its transition diagram.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `docs/validation.md` | ~20 | Fixed V5, V6, V7, V10 rows; updated V12 row name and description; rewrote transition diagram section to cover both phase and task transitions with corrected `complete` task transitions |

## Implementation Notes

While verifying V11–V13 (step 7 of the handoff), I found two additional inaccuracies not called out in the handoff:

1. **V12 name/description**: The table row said "Task status transitions" and described only task transitions. The actual `checkV12` in `validator.js` validates **both** phase and task status transitions using `ALLOWED_PHASE_TRANSITIONS` and `ALLOWED_TASK_TRANSITIONS`. Updated the name to "Status transitions" and the description to "Phase and task status changes must follow allowed transition maps."

2. **V12 transition diagram**: The section was titled "Valid Task Status Transitions (V12)" and showed `complete → (terminal)` for tasks. The actual `ALLOWED_TASK_TRANSITIONS` in `constants.js` has `complete: ['failed', 'halted']` — so `complete` is NOT terminal for tasks. Rewrote the section as "Valid Status Transitions (V12)" with separate phase and task diagrams, both matching the actual constants.

## Tests

| Test | File | Status |
|------|------|--------|
| Grep "Human approval gate" → 0 matches | `docs/validation.md` | ✅ Pass |
| Grep "Single active task" → 0 matches | `docs/validation.md` | ✅ Pass |
| Grep "Retry limit" → 0 matches | `docs/validation.md` | ✅ Pass |
| Grep "Schema version" → 0 matches | `docs/validation.md` | ✅ Pass |
| V1–V4 descriptions match validator.js | `docs/validation.md` | ✅ Pass |
| V5–V7 descriptions match validator.js | `docs/validation.md` | ✅ Pass |
| V10 description matches validator.js | `docs/validation.md` | ✅ Pass |
| V11 description matches validator.js | `docs/validation.md` | ✅ Pass |
| V12 description matches validator.js | `docs/validation.md` | ✅ Pass |
| V13 description matches validator.js | `docs/validation.md` | ✅ Pass |
| Phase transition diagram matches constants.js | `docs/validation.md` | ✅ Pass |
| Task transition diagram matches constants.js | `docs/validation.md` | ✅ Pass |

**Test summary**: 12/12 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | V5 row describes config limits check (`max_phases`, `max_tasks_per_phase`) — matches `checkV5` | ✅ Met |
| 2 | V6 row describes execution tier gate (requires `planning.human_approved`) — matches `checkV6` | ✅ Met |
| 3 | V7 row describes final review gate (complete tier + `after_final_review` gate) — matches `checkV7` | ✅ Met |
| 4 | V10 row describes phase-tier consistency (phase status vs `current_tier`) — matches `checkV10` | ✅ Met |

## Build & Lint

- **Build**: N/A — documentation-only task, no source code changes

## Deviations from Handoff

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | Verify V12 and "if V12's name or description is incomplete, fix it" | Renamed V12 from "Task status transitions" to "Status transitions" and updated description to cover both phase and task transitions | `checkV12` in `validator.js` validates both `ALLOWED_PHASE_TRANSITIONS` and `ALLOWED_TASK_TRANSITIONS`; the old name/description was incomplete |
| 2 | Verify the transition diagram "is still accurate" | Rewrote diagram section with separate phase/task diagrams, fixing task `complete → (terminal)` to `complete → failed | halted` | `ALLOWED_TASK_TRANSITIONS` in `constants.js` defines `complete: ['failed', 'halted']`, not terminal |
