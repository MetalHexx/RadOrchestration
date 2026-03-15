---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 7
title: "Instruction & Configuration File Updates"
status: "complete"
files_changed: 3
tests_written: 0
tests_passing: 321
build_status: "pass"
---

# Task Report: Instruction & Configuration File Updates

## Summary

Updated `copilot-instructions.md`, `project-docs.instructions.md`, and `state-management.instructions.md` to reflect the pipeline-driven architecture. Replaced Tactical Planner as sole state writer with the pipeline script, removed all `STATUS.md` references, and removed all references to deleted standalone scripts (`validate-state.js`, `next-action.js`, `triage.js`). Verified `orchestration.yml` has no stale references — no changes needed.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/copilot-instructions.md` | 4 edits | Updated "Check status" bullet, Agents table, Key Rule #3, Project Files section |
| MODIFIED | `.github/instructions/project-docs.instructions.md` | 2 edits | Changed state.json owner to Pipeline Script, removed STATUS.md row |
| MODIFIED | `.github/instructions/state-management.instructions.md` | 4 edits | Updated applyTo, sole writer heading, removed STATUS.md Rules section, replaced Pre-Write Validation section |
| VERIFIED | `.github/orchestration.yml` | 0 | No stale references found — no changes needed |

## Tests

| Test | File | Status |
|------|------|--------|
| Full test suite (321 tests across 8 files, 74 suites) | `.github/orchestration/scripts/tests/*.test.js` | ✅ Pass |

**Test summary**: 321/321 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `copilot-instructions.md` "Check status" bullet references `state.json` instead of `STATUS.md` | ✅ Met |
| 2 | `copilot-instructions.md` Agents table describes Tactical Planner as "Breaks phases into tasks, creates task handoffs, generates phase reports" (no "sole writer" language) | ✅ Met |
| 3 | `copilot-instructions.md` Key Rule #3 reads: "No agent directly writes `state.json` — all state mutations flow through the pipeline script (`pipeline.js`)." | ✅ Met |
| 4 | `copilot-instructions.md` Project Files section lists `State: state.json` (no `STATUS.md`) | ✅ Met |
| 5 | `project-docs.instructions.md` ownership table shows `state.json` → `Pipeline Script ('pipeline.js')` | ✅ Met |
| 6 | `project-docs.instructions.md` ownership table has no `STATUS.md` row | ✅ Met |
| 7 | `state-management.instructions.md` frontmatter `applyTo` no longer includes `STATUS.md` pattern | ✅ Met |
| 8 | `state-management.instructions.md` sole writer is "Pipeline Script" (not "Tactical Planner") | ✅ Met |
| 9 | `state-management.instructions.md` has no `STATUS.md Rules` section | ✅ Met |
| 10 | `state-management.instructions.md` Pre-Write Validation section references pipeline script internals (not `validate-state.js` CLI) | ✅ Met |
| 11 | `orchestration.yml` has no references to `next-action.js`, `triage.js`, or `validate-state.js` | ✅ Met |
| 12 | Zero occurrences of `STATUS.md` across all four files | ✅ Met |
| 13 | Zero occurrences of `validate-state.js` across all four files | ✅ Met |
| 14 | All 321 existing tests pass | ✅ Met |
| 15 | No lint errors in modified files | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (N/A — Markdown/YAML files only)
- **Lint**: ✅ Pass — no errors in modified files
- **Test suite**: ✅ 321/321 pass, 0 fail, 0 cancelled
