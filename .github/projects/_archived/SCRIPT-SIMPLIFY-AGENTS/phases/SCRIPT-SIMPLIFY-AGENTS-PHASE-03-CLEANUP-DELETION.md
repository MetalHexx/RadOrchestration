---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
title: "Cleanup & Deletion"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-12T00:00:00Z"
---

# Phase 3: Cleanup & Deletion

## Phase Goal

Remove all deprecated standalone scripts, their tests, prose shadow documents, and the `schemas/` directory, then update the validation test suites to reflect the post-refactor file structure and address all carry-forward items from Phase 2.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../SCRIPT-SIMPLIFY-AGENTS-MASTER-PLAN.md) | Phase 3 scope, exit criteria, execution constraints |
| [Architecture](../SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) | Scripts (Deleted) table, Documents (Deleted) table, Module Map |
| [Phase 2 Report](../reports/SCRIPT-SIMPLIFY-AGENTS-PHASE-02-REPORT.md) | Carry-forward items: 3 stale test comments, `review-code` → `review-task` cross-refs, `triage-report` cross-refs, old standalone script references in docs |

### Carry-Forward Items (from Phase 2)

Phase 2 `phase_review_action` is `"advance"`. The following items carry forward into this phase:

1. **3 stale test comments** — `pipeline-engine.test.js` (lines 560–567: V1 TENSION comment describing old increment logic; line 831: "Row 5 is unreachable due to V8 tension" now inaccurate) and `mutations.test.js` (line 608: comment describing old increment logic superseded by V1 fix)
2. **`review-code` → `review-task` cross-references** — External docs and validation test cross-reference checks may still reference the old `review-code` skill name
3. **`triage-report` cross-references** — External docs or validation tests may still reference the deleted `triage-report` skill
4. **Old standalone script references in docs** — `docs/scripts.md` and similar may still reference `next-action.js`, `triage.js`, `validate-state.js`

> **Note**: Items 2–4 span Phase 3 (file deletions, validation test updates, reference sweep) and Phase 4 (documentation overhaul). This phase handles deletions, test updates, and a sweep to identify/fix stale references in non-doc files. Phase 4 handles the comprehensive documentation rewrite.

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Delete Standalone Scripts & Their Tests | — | — | 6 (delete) | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P03-T01-DELETE-SCRIPTS.md) |
| T2 | Delete Shadow Documents & Schemas Directory | — | — | 2 files + 1 dir (delete) | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P03-T02-DELETE-DOCS.md) |
| T3 | Update Validation Test Suites | T1, T2 | — | ~5 (modify) | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P03-T03-VALIDATION-TESTS.md) |
| T4 | Fix Carry-Forward Stale Comments & Reference Sweep | T1, T2 | — | ~3–5 (modify) | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P03-T04-CARRY-FORWARD-SWEEP.md) |

### Task Details

#### T1 — Delete Standalone Scripts & Their Tests

Delete the 3 deprecated standalone CLI scripts that have been replaced by `pipeline.js`, and their corresponding test files.

**Files to delete:**
- `.github/orchestration/scripts/next-action.js`
- `.github/orchestration/scripts/triage.js`
- `.github/orchestration/scripts/validate-state.js`
- `.github/orchestration/scripts/tests/next-action.test.js`
- `.github/orchestration/scripts/tests/triage.test.js`
- `.github/orchestration/scripts/tests/validate-state.test.js`

**Verification:** No other module `require()`s these scripts. The preserved lib modules (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) are imported by `pipeline-engine.js` and `mutations.js`, not by the standalone scripts. The new pipeline modules (`pipeline.js`, `pipeline-engine.js`, `mutations.js`, `state-io.js`) do not reference the old scripts. All 4 preserved lib test suites and 4 new pipeline test suites must still pass after deletion.

---

#### T2 — Delete Shadow Documents & Schemas Directory

Delete the prose shadow documents and the now-empty `schemas/` directory.

**Files to delete:**
- `.github/orchestration/schemas/state-json-schema.md` — prose shadow of `constants.js` + `state-validator.js`
- `.github/orchestration/schemas/` directory — empty after schema deletion
- `.github/instructions/state-management.instructions.md` — all 6 sections are wrong/redundant post-refactor (updated in Phase 2 T7, now to be deleted entirely)

**Verification:** No agent loads `state-json-schema.md` at runtime. `state-management.instructions.md` targets files no agent writes post-refactor (its `applyTo: **/state.json` pattern applied to agents, but the pipeline script now owns state mutations). The `copilot-instructions.md` no longer references these files after Phase 2 updates.

---

#### T3 — Update Validation Test Suites

Update the 5 validation test suites to reflect the post-refactor file structure: deleted files, renamed skills, deleted skills, and new pipeline files.

**Files to modify:**
- `.github/orchestration/scripts/tests/instructions.test.js` — Update mock data that references `state-management.instructions.md` (lines 196, 211); the file no longer exists, so test mock data should use only `project-docs.instructions.md` or a generic test name
- `.github/orchestration/scripts/tests/structure.test.js` — Verify/update structure expectations if the check module references `schemas/` or the old scripts; add expectations for new pipeline files if the check module validates script presence
- `.github/orchestration/scripts/tests/cross-refs.test.js` — Update any test scenarios that reference `review-code` skill (should be `review-task`); update any scenarios referencing `triage-report` skill; verify cross-reference checks for deleted artifacts produce correct results
- `.github/orchestration/scripts/tests/skills.test.js` — Update any test scenarios that reference `triage-report` or `review-code` skill names; skill discovery should find `review-task` not `review-code`
- `.github/orchestration/scripts/tests/agents.test.js` — Update any test scenarios that reference old agent behavior or deleted skills/scripts in agent definitions

**Verification:** All 5 validation test suites pass. All existing preserved lib tests and pipeline tests still pass.

---

#### T4 — Fix Carry-Forward Stale Comments & Reference Sweep

Address the 3 stale test comments from Phase 2 carry-forward and perform a comprehensive reference sweep to catch any remaining dangling references to deleted artifacts.

**Stale comments to fix:**
1. `.github/orchestration/scripts/tests/pipeline-engine.test.js` lines 560–567 — V1 TENSION comment block describing old increment logic that was fixed in Phase 2 T1; update to accurately describe the current behavior (V1 last-phase sentinel is now handled correctly)
2. `.github/orchestration/scripts/tests/pipeline-engine.test.js` line 831 — "Row 5 is unreachable due to V8 tension" comment; V8 deferral was fixed in Phase 2 T1 so Row 5 is now reachable; update comment accordingly
3. `.github/orchestration/scripts/tests/mutations.test.js` line 608 — "after increment" comment describing old logic superseded by V1 fix; update to reflect current behavior

**Reference sweep targets** (grep across all non-project, non-report files):
- `next-action.js`, `triage.js`, `validate-state.js` — should not appear in any file except project planning docs
- `state-json-schema.md` — should not appear anywhere
- `state-management.instructions.md` — should not appear except in project planning docs
- `review-code` (skill name) — should be `review-task` everywhere except project planning docs
- `triage-report` (skill name) — should not appear except in project planning docs
- `STATUS.md` — should not appear in any agent/skill/instruction/config file
- `.github/orchestration/schemas/` — should not appear anywhere

**Verification:** All stale comments are updated. Grep sweep confirms zero dangling references to deleted artifacts in active system files. All test suites pass.

## Execution Order

```
T1 (Delete Scripts & Tests) ──┐
                                ├──→ T3 (Update Validation Tests)
T2 (Delete Shadow Docs)       ──┘         │
                                ├──→ T4 (Carry-Forward + Sweep)
                                          │
                                (parallel-ready: T3 ∥ T4)
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T1 and T2 are parallel-ready (independent deletions, no mutual dependency). T3 and T4 are parallel-ready (touch different files — T3 updates validation test suites, T4 updates pipeline test comments and sweeps non-test files). All four will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] `next-action.js`, `triage.js`, `validate-state.js` do not exist
- [ ] `next-action.test.js`, `triage.test.js`, `validate-state.test.js` do not exist
- [ ] `state-json-schema.md` does not exist; `.github/orchestration/schemas/` directory does not exist
- [ ] `state-management.instructions.md` does not exist
- [ ] All validation test suites pass: `agents.test.js`, `cross-refs.test.js`, `skills.test.js`, `instructions.test.js`, `structure.test.js`
- [ ] No dangling cross-references to deleted files anywhere in active system files (agents, skills, instructions, config, scripts, tests)
- [ ] All 4 preserved lib test suites still pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] All 4 new pipeline test suites pass (`mutations.test.js`, `pipeline-engine.test.js`, `state-io.test.js`, `pipeline.test.js`)
- [ ] Stale test comments (V1 TENSION, V8 tension, old increment) are updated or removed
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all imports resolve)
- [ ] Phase review passed

## Known Risks for This Phase

- **Validation check modules (not just tests) may need updates**: The structure check module (`validate-orchestration/scripts/lib/checks/structure.js`) may validate the presence of `schemas/` or specific scripts. If so, the check module itself (not just the test) needs updating. T3 should investigate the check modules as part of its scope.
- **Hidden cross-references in non-obvious locations**: The reference sweep (T4) may discover references in files not anticipated by the Master Plan (e.g., archive docs, sample apps, UI components). The sweep must cover the entire workspace, not just `.github/`.
- **`review-code` → `review-task` rename may have incomplete coverage**: Phase 2 renamed the skill directory and updated agents/skills, but the validation check modules and their tests may still hardcode the old name. T3 must verify the check modules, not just the test data.
