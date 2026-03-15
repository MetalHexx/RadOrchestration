---
project: "ORCHESTRATION-REORG"
phase: 5
title: "Archive, Assets & Cleanup"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-12T08:00:00Z"
---

# Phase 5: Archive, Assets & Cleanup

## Phase Goal

Create the archive directory for historical artifacts, add the dashboard screenshot asset, fix remaining carry-forward items, delete all original directories (`src/`, `tests/`, `plan/`, `bin/`), and run a final validation gate confirming the repository matches the post-reorg target structure. This is the only phase with destructive operations.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../ORCHESTRATION-REORG-MASTER-PLAN.md) | Phase 5 scope, exit criteria, risk R-8 (destructive operations) |
| [Architecture](../ORCHESTRATION-REORG-ARCHITECTURE.md) | Layer 5 operations table, final directory structure, deleted entries |
| [Phase 4 Report](ORCHESTRATION-REORG-PHASE-REPORT-P04.md) | Carry-forward: stale `tests/` refs in validate-orchestration README, `triage-report` templates/ missing, `assets/dashboard-screenshot.png` not yet created |
| [Phase 4 Review](PHASE-REVIEW-P04.md) | Cross-task issues: stale `tests/` refs at lines 155, 171–172, 176; screenshot asset pending |
| [Issues Log](../ORCHESTRATION-REORG-ISSUES.md) | ISSUE-001 through ISSUE-004 — context only, no action required |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Fix Carry-Forward Items | — | file editing | ~2 | *(created at execution time)* |
| T2 | Create Archive & Move Historical Files | — | file operations | ~18 | *(created at execution time)* |
| T3 | Create Assets Directory & Placeholder Screenshot | — | file operations | ~1 | *(created at execution time)* |
| T4 | Delete Original Directories | T2 | destructive file ops | ~42 deleted | *(created at execution time)* |
| T5 | Final Validation Gate | T1, T2, T3, T4 | `run-tests`, validation | 0 | *(created at execution time)* |

## Execution Order

```
T1 (fix carry-forward items)
T2 (create archive & move files)  ← parallel-ready with T1, T3
T3 (create assets & screenshot)   ← parallel-ready with T1, T2
T4 (delete original directories)  ← depends on T2
T5 (final validation gate)        ← depends on T1, T2, T3, T4
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5

*Note: T1, T2, and T3 are parallel-ready (no mutual dependencies) but will execute sequentially in v1. T4 MUST follow T2 because `plan/` contents must be archived before `plan/` is deleted.*

## Task Details

### T1: Fix Carry-Forward Items

**Objective**: Address the two carry-forward issues from Phase 4 before the final validation gate.

**Scope**:
- Fix 4 stale `tests/` path references in `.github/skills/validate-orchestration/README.md`:
  - Line 155: `tests/` → `.github/orchestration/scripts/tests/` (directory tree entry)
  - Line 171: `node tests/agents.test.js` → `node .github/orchestration/scripts/tests/agents.test.js`
  - Line 172: `node tests/skills.test.js` → `node .github/orchestration/scripts/tests/skills.test.js`
  - Line 176: `Get-ChildItem tests/*.test.js` → `Get-ChildItem .github/orchestration/scripts/tests/*.test.js`
- Create missing `templates/` subdirectory in `.github/skills/triage-report/` (resolves the pre-existing validate-orchestration failure: 70/71 → 71/71)

**Acceptance Criteria**:
- Zero stale `tests/` path references in `.github/skills/validate-orchestration/README.md`
- `.github/skills/triage-report/templates/` directory exists
- validate-orchestration passes 71/71 (zero failures)

### T2: Create Archive & Move Historical Files

**Objective**: Create the archive directory structure and relocate all historical planning artifacts.

**Scope**:
- Create `archive/` directory at workspace root
- Create `archive/schemas/` subdirectory
- Copy `plan/ORCHESTRATION-MASTER-PLAN.md` → `archive/ORCHESTRATION-MASTER-PLAN.md`
- Copy `plan/orchestration-human-draft.md` → `archive/orchestration-human-draft.md`
- Copy 14 relic schema files from `plan/schemas/` → `archive/schemas/`:
  1. `architecture-template.md`
  2. `code-review-template.md`
  3. `cross-agent-dependency-map.md`
  4. `design-template.md`
  5. `master-plan-template.md`
  6. `orchestration-yml-schema.md`
  7. `phase-plan-template.md`
  8. `phase-report-template.md`
  9. `phase-review-template.md`
  10. `prd-template.md`
  11. `research-findings-template.md`
  12. `status-md-template.md`
  13. `task-handoff-template.md`
  14. `task-report-template.md`
- Note: `state-json-schema.md` is EXCLUDED (already promoted to `.github/orchestration/schemas/` in Phase 1)

**Acceptance Criteria**:
- `archive/` exists with exactly 2 files at root level
- `archive/schemas/` exists with exactly 14 files
- All 16 archived files are byte-identical to their `plan/` originals
- `state-json-schema.md` is NOT present in `archive/schemas/`

### T3: Create Assets Directory & Placeholder Screenshot

**Objective**: Create the assets directory and add a placeholder screenshot PNG so that `docs/dashboard.md` and `README.md` image references resolve.

**Scope**:
- Create `assets/` directory at workspace root
- Create `assets/dashboard-screenshot.png` as a valid minimal PNG placeholder (1×1 pixel or small badge-style image)

**Acceptance Criteria**:
- `assets/` directory exists
- `assets/dashboard-screenshot.png` is a valid PNG file (starts with PNG magic bytes)
- Image link in `README.md` and `docs/dashboard.md` resolves to this file

### T4: Delete Original Directories

**Objective**: Remove the four original workspace-root directories whose contents have been fully migrated, archived, or were already empty.

**CRITICAL CONSTRAINT**: This task performs destructive operations. All content must already be archived (T2) or migrated (Phases 1–2) before deletion. Do NOT modify any files under `.github/projects/` (frozen artifact boundary).

**Scope**:
- Delete `src/` directory and all contents (7 files: 3 CLI scripts + 4 lib modules — all migrated in Phase 1)
- Delete `tests/` directory and all contents (18 test files — all migrated in Phase 2)
- Delete `plan/` directory and all contents (2 root files archived in T2 + 15 schema files: 14 archived in T2, 1 promoted in Phase 1)
- Delete `bin/` directory (empty — zero references found in research)

**Acceptance Criteria**:
- `src/` does not exist
- `tests/` does not exist
- `plan/` does not exist
- `bin/` does not exist
- No files under `.github/projects/` were modified (frozen artifact boundary)
- `.github/orchestration/scripts/` still contains all 7 migrated scripts
- `.github/orchestration/scripts/tests/` still contains all 18 migrated tests

### T5: Final Validation Gate

**Objective**: Comprehensive validation confirming the repository matches the post-reorg target structure and all systems work correctly.

**Scope**:
- Run full test suite: `node --test .github/orchestration/scripts/tests/*.test.js` — expect 307/307+ pass
- Run validate-orchestration — expect zero errors (71/71+)
- Directory existence checks:
  - EXISTS: `archive/`, `archive/schemas/` (14 files), `assets/`, `assets/dashboard-screenshot.png`, `.github/orchestration/scripts/`, `.github/orchestration/scripts/tests/`, `docs/`
  - NOT EXISTS: `src/`, `tests/`, `plan/`, `bin/`
- Root directory structure: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`
- Frozen artifact integrity: zero modifications to files under `.github/projects/`
- Stale path grep: zero matches for `\bsrc/(next-action|triage|validate-state|lib/)` and `\btests/.*\.test\.js` in active files

**Acceptance Criteria**:
- All tests pass (307/307+)
- validate-orchestration zero errors
- All directory existence/absence checks pass
- Root directory matches target structure
- Frozen artifact boundary intact
- Zero stale path references to deleted directories

## Phase Exit Criteria

- [ ] `archive/` exists with `ORCHESTRATION-MASTER-PLAN.md`, `orchestration-human-draft.md`, and `schemas/` subfolder (14 relic files)
- [ ] `assets/` exists with `dashboard-screenshot.png`
- [ ] `src/`, `tests/`, `plan/`, `bin/` no longer exist
- [ ] Full test suite passes (307/307+) from `.github/orchestration/scripts/tests/`
- [ ] validate-orchestration reports zero errors
- [ ] Zero modifications to frozen project artifacts (`.github/projects/`)
- [ ] Root directory contains: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **R-8 (from Master Plan): Destructive operations irreversible** — Deleting `src/`, `tests/`, `plan/`, `bin/` cannot be easily undone. Mitigation: T4 runs only after T2 archives all content; git history preserves originals as ultimate rollback.
- **Stale references to deleted paths**: Any reference missed by Phases 3–4 will break after T4 deletes the directories. Mitigation: T5 runs comprehensive stale-path grep; T1 fixes last known carry-forward items before T4 executes.
- **Frozen artifact contamination**: Coder must NOT use blanket find-and-replace that touches `.github/projects/` files. Mitigation: explicit constraint in T4 handoff; T5 verifies no frozen files were modified.
