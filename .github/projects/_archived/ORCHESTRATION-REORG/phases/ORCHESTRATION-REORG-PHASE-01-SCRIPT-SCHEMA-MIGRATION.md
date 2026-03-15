---
project: "ORCHESTRATION-REORG"
phase: 1
title: "Script & Schema Migration"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-10T21:30:00Z"
---

# Phase 1: Script & Schema Migration

## Phase Goal

Create all 7 runtime scripts and the active state schema at their new `.github/orchestration/` locations with correct `require()` paths, without modifying the originals in `src/`. After this phase, both old and new locations coexist (dual-path state).

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../ORCHESTRATION-REORG-MASTER-PLAN.md) | Phase 1 scope, exit criteria, dependency ordering |
| [Architecture](../ORCHESTRATION-REORG-ARCHITECTURE.md) | Layer 1 module map, import path contracts (CLI scripts + lib modules), file structure |
| [Design](../ORCHESTRATION-REORG-DESIGN.md) | Target directory layout under `.github/orchestration/` |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Create directory structure | — | file creation | 0 (dirs only) | `tasks/ORCHESTRATION-REORG-TASK-P01-T01-CREATE-DIRS.md` |
| T2 | Copy lib modules and schema (no-change files) | T1 | file copy | 5 | `tasks/ORCHESTRATION-REORG-TASK-P01-T02-COPY-LIB-SCHEMA.md` |
| T3 | Copy and update CLI scripts with corrected require() paths | T1 | file copy, path rewrite | 3 | `tasks/ORCHESTRATION-REORG-TASK-P01-T03-COPY-CLI-SCRIPTS.md` |
| T4 | Validation gate — module load and integrity checks | T2, T3 | testing, validation | 0 (verification only) | `tasks/ORCHESTRATION-REORG-TASK-P01-T04-VALIDATION-GATE.md` |

## Task Details

### T1: Create Directory Structure

**Objective**: Create the 3 target directories that all subsequent tasks depend on.

**Directories to create**:
- `.github/orchestration/scripts/`
- `.github/orchestration/scripts/lib/`
- `.github/orchestration/schemas/`

**Acceptance Criteria**:
- [ ] All 3 directories exist
- [ ] No files created (dirs only)

---

### T2: Copy Lib Modules and Schema (No-Change Files)

**Objective**: Copy the 4 lib modules and 1 schema file verbatim — these files have no import path changes because their internal imports use sibling-relative paths (`./constants`, etc.) that are preserved by the directory structure.

**Files to copy (verbatim, no modifications)**:

| Source | Target |
|--------|--------|
| `src/lib/constants.js` | `.github/orchestration/scripts/lib/constants.js` |
| `src/lib/resolver.js` | `.github/orchestration/scripts/lib/resolver.js` |
| `src/lib/state-validator.js` | `.github/orchestration/scripts/lib/state-validator.js` |
| `src/lib/triage-engine.js` | `.github/orchestration/scripts/lib/triage-engine.js` |
| `plan/schemas/state-json-schema.md` | `.github/orchestration/schemas/state-json-schema.md` |

**Acceptance Criteria**:
- [ ] All 5 files exist at target locations
- [ ] File contents are byte-identical to source files
- [ ] Original source files remain untouched

---

### T3: Copy and Update CLI Scripts with Corrected require() Paths

**Objective**: Copy the 3 CLI scripts to `.github/orchestration/scripts/` and update only their cross-tree `require()` paths. The `./lib/` relative imports remain unchanged because the directory structure is preserved.

**Files to copy and modify**:

| Source | Target | Path Changes |
|--------|--------|-------------|
| `src/next-action.js` | `.github/orchestration/scripts/next-action.js` | 2 changes |
| `src/triage.js` | `.github/orchestration/scripts/triage.js` | 2 changes |
| `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` | 1 change |

**Exact require() transformations (5 total)**:

In `next-action.js`:
1. `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` → `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
2. `require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` → `require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')`

In `triage.js`:
3. `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` → `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
4. `require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` → `require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')`

In `validate-state.js`:
5. `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` → `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`

**Unchanged imports (preserved as-is)**:
- `next-action.js`: `require('./lib/resolver')` — unchanged
- `triage.js`: `require('./lib/triage-engine')`, `require('./lib/constants')` — unchanged
- `validate-state.js`: `require('./lib/state-validator')` — unchanged

**Acceptance Criteria**:
- [ ] All 3 CLI scripts exist at target locations
- [ ] Exactly 5 `require()` paths updated as specified above
- [ ] All `./lib/` relative imports remain unchanged
- [ ] No other code modifications — only the require() path strings change
- [ ] Original `src/` scripts remain untouched

---

### T4: Validation Gate — Module Load and Integrity Checks

**Objective**: Verify that all 7 migrated modules load correctly at their new locations and that original files were not modified.

**Validation steps**:

1. **Module load checks** — Run `node -e "require()"` for each of the 7 scripts:
   - `node -e "require('./.github/orchestration/scripts/next-action.js')"`
   - `node -e "require('./.github/orchestration/scripts/triage.js')"`
   - `node -e "require('./.github/orchestration/scripts/validate-state.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/constants.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/resolver.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/state-validator.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/triage-engine.js')"`

2. **Schema existence check** — Verify `state-json-schema.md` exists at `.github/orchestration/schemas/state-json-schema.md`

3. **Original file integrity** — Verify original `src/` scripts still load without error:
   - `node -e "require('./src/next-action.js')"`
   - `node -e "require('./src/triage.js')"`
   - `node -e "require('./src/validate-state.js')"`

4. **Content diff** — Verify original files are byte-identical to their pre-migration state (no accidental edits)

**Acceptance Criteria**:
- [ ] All 7 modules at `.github/orchestration/scripts/` load without errors
- [ ] All `require()` paths in CLI scripts resolve correctly at new locations
- [ ] `state-json-schema.md` exists at `.github/orchestration/schemas/`
- [ ] Original `src/` scripts remain untouched and functional
- [ ] Zero import/require errors across all 7 new-location modules

## Execution Order

```
T1 (create directories)
 ├→ T2 (copy lib + schema, no changes)
 └→ T3 (copy CLI scripts, path updates)  ← parallel-ready with T2
T4 (validation gate, depends on T2 + T3)
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T2 and T3 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] All 7 scripts load without errors at `.github/orchestration/scripts/` (`node -e require()` check)
- [ ] All `require()` paths in CLI scripts resolve correctly at new locations
- [ ] Original `src/` scripts remain untouched and functional
- [ ] `state-json-schema.md` exists at `.github/orchestration/schemas/`
- [ ] All 4 tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Cross-tree require() resolution**: The path `../../skills/validate-orchestration/scripts/lib/utils/fs-helpers` depends on the exact directory depth of `.github/orchestration/scripts/`. If the target path changes, all 5 transformations must be recalculated.
- **Node.js module caching**: During validation, `require()` caching may mask resolution failures if modules are loaded in a specific order. Each module load check should run in its own `node -e` invocation to avoid cache effects.
- **Self-referential execution**: The pipeline itself uses `src/validate-state.js` and `src/triage.js` during this phase. Since originals are preserved, this is safe — but accidental modification of originals would break the pipeline mid-execution.
