---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 4
title: "Carry-Forward Stale Comments & Reference Sweep"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 4
---

# Carry-Forward Stale Comments & Reference Sweep

## Objective

Fix 3 stale test comments left over from Phase 2 (V1 TENSION, V8 Row 5 unreachable, old increment logic), then perform a comprehensive reference sweep across the entire workspace to identify and fix any remaining dangling references to deleted artifacts in active system files outside `.github/projects/`.

## Context

Phase 2 T1 fixed the V1 last-phase sentinel bug — `handleGateApproved` now checks `current_phase >= phases.length - 1` before incrementing rather than blindly incrementing and producing an out-of-bounds sentinel. Phase 2 T1 also fixed V8 pre-triage validation deferral so Row 5 of the triage decision table is now reachable. Three test comments still describe the old broken behavior. Phase 2 also renamed `review-code` → `review-task`, deleted the `triage-report` skill, and Phase 3 T1–T2 deleted the 3 standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`), `state-json-schema.md`, `state-management.instructions.md`, and the `schemas/` directory. References to these deleted artifacts may still exist in active system files.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Fix V1 TENSION comment (lines 560–567) and V8 Row 5 unreachable comment (line 831) |
| MODIFY | `.github/orchestration/scripts/tests/mutations.test.js` | Fix old increment logic comment (line 608) |
| MODIFY | `.github/skills/create-agent/templates/AGENT.md` | Fix `STATUS.md` + sole-writer language (line 33) |
| MODIFY | `.github/skills/brainstorm/SKILL.md` | Remove `STATUS.md` reference (line 40) |

## Implementation Steps

1. **Open `.github/orchestration/scripts/tests/pipeline-engine.test.js`** and locate the comment block at lines 560–567:
   ```javascript
   /*
    * V1 TENSION for gate_approved (phase) on the LAST phase:
    *
    * When gate_approved completes the last phase, it sets current_phase = phases.length.
    * V1 considers current_phase >= phases.length out of bounds, even though this is
    * the intended "all phases done" sentinel. To test gate_approved (phase) successfully,
    * we use 2 phases and approve the first, so current_phase stays within bounds.
    */
   ```
   Replace with a comment that accurately describes the current behavior: `handleGateApproved` checks `current_phase >= phases.length - 1` (last phase detection) before incrementing. The test uses 2 phases to exercise the "advance to next phase" path (non-last-phase branch). The last-phase branch is tested separately in `mutations.test.js`. Remove all "TENSION" language — the V1 fix resolved this.

2. **In the same file**, locate the comment at line 831:
   ```javascript
   // Uses Row 10 (failed report, minor severity, no review_doc) to trigger
   // non-skip triage without hitting V8. Row 5 is unreachable due to V8 tension.
   ```
   Remove the sentence `Row 5 is unreachable due to V8 tension.` — V8 pre-triage validation deferral was fixed in Phase 2 T1, so Row 5 is now reachable. Keep the first sentence about Row 10 usage.

3. **Open `.github/orchestration/scripts/tests/mutations.test.js`** and locate the comment at line 608:
   ```javascript
   // 1 phase, current_phase = 0 → after increment = 1 >= 1
   ```
   Update to reflect the current logic: `handleGateApproved` no longer increments on the last phase. The current behavior is: `current_phase (0) >= phases.length - 1 (0)` → last phase detected → sets `current_tier = review`, `status = complete`. Replace with a comment like:
   ```javascript
   // 1 phase, current_phase = 0 >= phases.length - 1 (0) → last phase → tier = review, status = complete
   ```

4. **Open `.github/skills/create-agent/templates/AGENT.md`** and locate line 33:
   ```markdown
   - Write to `state.json` or `STATUS.md` — only the Tactical Planner does that
   ```
   Replace with:
   ```markdown
   - Write to `state.json` — all state mutations flow through the pipeline script (`pipeline.js`)
   ```
   `STATUS.md` no longer exists. The pipeline script (not the Tactical Planner) is the sole state authority.

5. **Open `.github/skills/brainstorm/SKILL.md`** and locate line 40:
   ```markdown
   - **Minimal folder creation**: Only create the project folder and the BRAINSTORMING.md file. No state.json, no STATUS.md, no subfolders
   ```
   Remove the `STATUS.md` reference:
   ```markdown
   - **Minimal folder creation**: Only create the project folder and the BRAINSTORMING.md file. No state.json, no subfolders
   ```

6. **Run a comprehensive grep sweep** across the entire workspace (excluding `.github/projects/` and `archive/`) for each of these strings:
   - `review-code` (as a skill name — ignore occurrences inside quoted project-history text)
   - `triage-report` (as a skill name)
   - `next-action.js`
   - `triage.js` (but NOT `triage-engine.js` — that is a preserved lib module)
   - `validate-state.js`
   - `STATUS.md`
   - `state-json-schema.md`
   - `state-management.instructions.md`
   - `.github/orchestration/schemas/` (as a path)

   Scope: all files NOT in `.github/projects/` and NOT in `archive/`. This includes `.github/agents/`, `.github/skills/`, `.github/instructions/`, `.github/orchestration/`, `.github/copilot-instructions.md`, `docs/`, `README.md`, `ui/`, `sample-apps/`.

7. **For any hits found in non-docs files** (i.e., not in `docs/`): fix them using the same patterns as steps 4–5. After steps 4–5, the expected result is zero remaining hits in non-docs, non-project, non-archive files.

8. **For any hits found in `docs/` files**: Do NOT fix them. Document them in the Task Report as carry-forward items for Phase 4 (Documentation Overhaul). The known `docs/` hits are:
   - `docs/scripts.md` — extensive references to `next-action.js`, `triage.js`, `validate-state.js` (entire sections)
   - `docs/project-structure.md` — `next-action.js`, `triage.js`, `validate-state.js`, `state-json-schema.md`, `STATUS.md`, `state-management.instructions.md` in file tree and tables
   - `docs/skills.md` — `review-code` (2 occurrences), `triage-report` (2 occurrences)
   - `docs/agents.md` — `review-code` (1 occurrence), `triage-report` (1 occurrence), `STATUS.md` (5 occurrences)
   - `docs/pipeline.md` — `STATUS.md` (1 occurrence)
   - `docs/getting-started.md` — `STATUS.md` (1 occurrence)
   - `docs/validation.md` — `validate-state.js` (1 occurrence)

9. **Verify all test suites pass** after making the comment changes:
   - All 4 preserved lib test suites: `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`
   - All 4 pipeline test suites: `mutations.test.js`, `pipeline-engine.test.js`, `state-io.test.js`, `pipeline.test.js`
   - All 5 validation test suites: `agents.test.js`, `cross-refs.test.js`, `skills.test.js`, `instructions.test.js`, `structure.test.js`

## Contracts & Interfaces

No contracts apply — this task modifies comments and template text only. No functional code changes.

## Styles & Design Tokens

Not applicable — no UI changes.

## Test Requirements

- [ ] All 4 preserved lib test suites pass unchanged (141 tests): `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`
- [ ] All 4 pipeline test suites pass (180+ tests): `mutations.test.js`, `pipeline-engine.test.js`, `state-io.test.js`, `pipeline.test.js`
- [ ] All 5 validation test suites pass: `agents.test.js`, `cross-refs.test.js`, `skills.test.js`, `instructions.test.js`, `structure.test.js`
- [ ] Comment-only changes — no test logic or assertions are modified

## Acceptance Criteria

- [ ] `pipeline-engine.test.js` lines 560–567: V1 TENSION comment block replaced with accurate description of current `handleGateApproved` behavior (no "TENSION" language)
- [ ] `pipeline-engine.test.js` line 831: "Row 5 is unreachable due to V8 tension" sentence removed
- [ ] `mutations.test.js` line 608: old increment comment replaced with accurate description of current last-phase detection logic
- [ ] `.github/skills/create-agent/templates/AGENT.md` line 33: `STATUS.md` removed, sole-writer language replaced with pipeline-script language
- [ ] `.github/skills/brainstorm/SKILL.md` line 40: `STATUS.md` reference removed
- [ ] Grep sweep confirms zero occurrences of `review-code`, `triage-report`, `next-action.js`, `triage.js`, `validate-state.js`, `STATUS.md`, `state-json-schema.md`, `state-management.instructions.md` in files outside `.github/projects/`, `archive/`, and `docs/`
- [ ] All `docs/` dangling references documented in Task Report as carry-forward for Phase 4
- [ ] All test suites pass (no regressions)
- [ ] Build succeeds (no syntax errors)

## Constraints

- Do NOT modify any file in `docs/` — those are deferred to Phase 4 (Documentation Overhaul)
- Do NOT modify any file in `.github/projects/` or `archive/`
- Do NOT change test assertions or test logic — comment-only changes in test files
- Do NOT modify any functional source code (`.js` modules under `lib/`)
- Do NOT update `state.json` — the pipeline script handles all state mutations
