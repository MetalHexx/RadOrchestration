---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 5
title: "Update validation.md & project-structure.md"
status: "complete"
files_changed: 2
tests_written: 0
tests_passing: 455
build_status: "pass"
---

# Task Report: Update validation.md & project-structure.md

## Summary

Updated `docs/validation.md` and `docs/project-structure.md` to reflect the post-refactor architecture. Replaced the stale `validate-state.js` CLI section with a new State Transition Validation section documenting all 15 invariants (V1–V15). Updated the workspace layout tree, project folder structure, state files table, scoped instructions table, system files table, and state management section in `project-structure.md` to remove all references to deleted scripts, `STATUS.md`, `schemas/`, and `state-management.instructions.md`.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `docs/validation.md` | +42 −7 | Replaced State Validation section with State Transition Validation including V1–V15 invariant catalog |
| MODIFIED | `docs/project-structure.md` | +11 −22 | Updated workspace tree, project folder, state files, scoped instructions, system files, and state management |

## Tests

| Test | File | Status |
|------|------|--------|
| Full test suite (455 tests, 89 suites) | `.github/orchestration/scripts/tests/*.test.js` | ✅ Pass |

**Test summary**: 455/455 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `docs/validation.md` contains zero occurrences of `validate-state.js` | ✅ Met |
| 2 | `docs/validation.md` contains a complete V1–V15 invariant catalog table with 15 rows | ✅ Met |
| 3 | `docs/validation.md` documents the dual-validation pass for triage events | ✅ Met |
| 4 | `docs/project-structure.md` workspace layout tree shows `pipeline.js` under `.github/orchestration/scripts/` | ✅ Met |
| 5 | `docs/project-structure.md` workspace layout tree shows `mutations.js`, `pipeline-engine.js`, `state-io.js` under `lib/` | ✅ Met |
| 6 | `docs/project-structure.md` contains zero occurrences of `next-action.js`, `triage.js`, `validate-state.js` | ✅ Met |
| 7 | `docs/project-structure.md` contains zero occurrences of `STATUS.md` | ✅ Met |
| 8 | `docs/project-structure.md` contains zero occurrences of `schemas/` directory reference (in orchestration tree) | ✅ Met |
| 9 | `docs/project-structure.md` contains zero occurrences of `state-management.instructions.md` | ✅ Met |
| 10 | `docs/project-structure.md` state.json sole writer is "Pipeline Script" (not "Tactical Planner") | ✅ Met |
| 11 | No lint errors in either file | ✅ Met |
| 12 | Both files are valid Markdown | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (documentation-only changes, no build step)
- **Lint**: ✅ Pass (no lint errors)
- **Tests**: ✅ Pass — 455/455 passing, 0 failures
