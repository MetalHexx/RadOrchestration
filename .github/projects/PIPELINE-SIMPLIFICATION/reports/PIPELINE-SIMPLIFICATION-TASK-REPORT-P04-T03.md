---
status: "complete"
has_deviations: true
deviation_type: "minor"
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 3
title: "Documentation & Instructions Update"
files_changed: 5
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Documentation & Instructions Update

## Summary

Updated all four documentation files (`docs/scripts.md`, `docs/pipeline.md`, `docs/validation.md`, `docs/agents.md`) and the Architecture doc to reflect the v3 pipeline engine. Removed triage-layer references, internal actions, removed invariants (V8/V9/V14/V15), `triage_attempts` lifecycle, and updated counts, signatures, and path references throughout. Applied carry-forward fixes to the Architecture doc (validateTransition 2→3 params, 18→17 event handler count, lib-v3/ → lib/ paths).

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `docs/scripts.md` | ~120 lines changed | Removed triage references, internal actions, updated module tree, event vocabulary (17 events), action vocabulary (18 external-only), result shapes, mutation lookup table, shared constants enum table, testing section |
| MODIFIED | `docs/pipeline.md` | ~40 lines changed | Removed triage from opening, updated task/phase lifecycle steps, removed Triage Attempts subsection, removed Auto-Approve and Internal Action Loop sections, updated retry budget, removed internal action references |
| MODIFIED | `docs/validation.md` | ~25 lines changed | Updated validateTransition signature to 3 params, updated invariant catalog to V1-V7/V10-V13 (~11), removed V8/V9/V14/V15, updated return type to ValidationError[], validation runs once not twice |
| MODIFIED | `docs/agents.md` | ~3 lines changed | Removed triage_attempts sentence from Orchestrator, removed "triage" from Tactical Planner description |
| MODIFIED | `.github/projects/PIPELINE-SIMPLIFICATION/PIPELINE-SIMPLIFICATION-ARCHITECTURE.md` | ~30 lines changed | Fixed validateTransition to 3 params, updated 18→17 event handler count, updated all lib-v3/ module paths to lib/, updated File Structure to post-swap state, updated phasing section paths |
| VERIFIED | `.github/instructions/state-management.instructions.md` | 0 | Already correct — has 3-param validateTransition, no triage references, v3 schema note. No changes needed. |

## Tests

No code tests — this is a documentation-only task. Verification performed via grep searches:

| Test | Status |
|------|--------|
| Grep docs for `triage_engine`, `triage-engine`, `triage_attempts`, `TRIAGE_LEVELS` → 0 matches | ✅ Pass |
| Grep `docs/scripts.md` for "Internal" action type → 0 matches (only benign "internal dependencies" and "Pipeline Internals" heading) | ✅ Pass |
| Grep `docs/validation.md` for V8, V9, V14, V15 invariant IDs → 0 matches | ✅ Pass |
| Grep `docs/validation.md` for "15 invariants" → 0 matches | ✅ Pass |
| Grep `docs/scripts.md` for "35 actions" or "35 values" → 0 matches | ✅ Pass |
| Grep Architecture doc for `validateTransition(current, proposed)` (2-param) → 0 matches | ✅ Pass |
| Grep Architecture doc for "18-event" or "18 event" → 0 matches | ✅ Pass |
| Grep `state-management.instructions.md` for `triage` → 1 match (correct: "There is no `triage_attempts` field in v3") | ✅ Pass |
| Grep Architecture doc for `lib-v3/` → 2 matches (both in Delivery Swap Sequence/Rollback — see Deviations) | ✅ Pass |

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `docs/scripts.md` module tree lists correct modules, no `triage-engine.js` or `state-validator.js` | ✅ Met |
| 2 | `docs/scripts.md` action vocabulary describes only ~18 external actions with no "Internal" type column | ✅ Met |
| 3 | `docs/scripts.md` result shape shows only `success`, `action`, `context`, `mutations_applied` | ✅ Met |
| 4 | `docs/pipeline.md` contains zero references to "triage" as a pipeline concept | ✅ Met |
| 5 | `docs/pipeline.md` does not contain a "Triage Attempts" subsection | ✅ Met |
| 6 | `docs/validation.md` invariant catalog lists exactly V1–V7, V10–V13 (11 invariants) | ✅ Met |
| 7 | `docs/validation.md` shows `validateTransition(current, proposed, config)` (3 params) | ✅ Met |
| 8 | `docs/validation.md` states validation runs once per event (not twice) | ✅ Met |
| 9 | `docs/agents.md` contains zero references to `triage_attempts` | ✅ Met |
| 10 | Architecture doc `validateTransition` signature shows 3 params | ✅ Met |
| 11 | Architecture doc references "17-event handler lookup table" (not 18) | ✅ Met |
| 12 | Architecture doc has zero `lib-v3/` path references (all updated to `lib/`) | ⚠️ Partial — see Deviations |
| 13 | `state-management.instructions.md` has zero `triage` references (verified, no changes) | ✅ Met |
| 14 | All modified files are valid Markdown with no syntax errors | ✅ Met |
| 15 | Build passes (no code changes — N/A) | ✅ Met (N/A) |

## Build & Lint

- **Build**: N/A — documentation-only task, no code changes
- **Lint**: N/A — markdown files, no linter configured
- **Type check**: N/A — no code changes

## Deviations from Handoff

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | Update ALL `lib-v3/` paths to `lib/` in Architecture doc | Left 2 `lib-v3/` references in Delivery Swap Sequence table (line ~706: `Rename lib-v3/ → lib/`) and Rollback safety note (line ~726: `restore by renaming lib/ → lib-v3/`) | These references describe the *rename operations themselves* where `lib-v3/` is the operand being acted upon — not a path to module locations. Changing them would make the swap procedure description nonsensical (e.g., "Rename `lib/` → `lib/`"). |
| 2 | Handoff described removing Auto-Approve and Internal Action Loop from pipeline.md | Removed both subsections entirely | The Auto-Approve section referenced triage engine concepts (`applyTaskTriage`, `applyPhaseTriage`, `triage_attempts → 0`) and the Internal Action Loop section described v2 internal action handling. Both were fully v2 concepts with no v3 equivalent in the documentation context. |
