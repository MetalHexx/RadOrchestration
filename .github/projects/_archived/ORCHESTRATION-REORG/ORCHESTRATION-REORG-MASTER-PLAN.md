---
project: "ORCHESTRATION-REORG"
status: "draft"
author: "architect-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Master Plan

## Executive Summary

This project reorganizes the repository so the entire orchestration system ships as a single directory (`.github/`), historical design artifacts move to a clearly-named `archive/` folder, and the monitoring dashboard becomes visible in the README and documentation. The runtime scripts in `src/`, the test suite in `tests/`, and the one active schema in `plan/schemas/` are consolidated under `.github/orchestration/`, while the 14 relic templates and original design docs move to `archive/`. Because the orchestration pipeline is executing its own reorganization, the work is phased so that new files are created and validated before any references are cut over, and original directories are deleted only as the final step — keeping the system fully functional at every intermediate state.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [ORCHESTRATION-REORG-BRAINSTORMING.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-BRAINSTORMING.md) | ✅ |
| Research Findings | [ORCHESTRATION-REORG-RESEARCH-FINDINGS.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [ORCHESTRATION-REORG-PRD.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md) | ✅ |
| Design | [ORCHESTRATION-REORG-DESIGN.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-DESIGN.md) | ✅ |
| Architecture | [ORCHESTRATION-REORG-ARCHITECTURE.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional and critical non-functional requirements that drive phasing. Full details in the [PRD](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md).

- **FR-1**: Runtime scripts (3 CLIs + 4 lib modules) shall reside within the single distributable `.github/` directory
- **FR-14**: All `require()` paths in relocated scripts shall resolve correctly at new locations (5 cross-tree imports change; sibling `./lib/` imports stay the same)
- **FR-15**: All `require()` paths in relocated test files shall resolve correctly (7 script-targeting tests + 11 validator-targeting tests, including dynamic `require()` paths)
- **FR-10 / FR-11 / FR-12**: Agent, instruction, and skill files containing script invocation commands shall reference correct post-reorg paths (11 replacements across 2 agent files, 3 in 1 instruction file, 1 in 1 skill file)
- **FR-20**: The system shall remain fully functional at each intermediate stage — destructive operations only after new locations are established and verified
- **FR-18**: The validate-orchestration check suite shall pass with zero regressions after all changes
- **FR-19**: Frozen project artifacts in `.github/projects/` shall NOT be modified
- **NFR-1**: The pipeline shall remain fully operational throughout — no phase may leave the system broken

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation. Full details in the [Architecture](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md).

- **Five-layer ordering**: Files are treated as five layers (scripts → tests → cross-references → docs → cleanup) with strict ordering constraints — each layer depends on the previous being in place
- **Dual-path coexistence**: During transition, both `src/` and `.github/orchestration/scripts/` contain the scripts; old files remain as a safety net until the final cleanup phase
- **`require()` path transformation**: CLI scripts change from `../.github/skills/...` to `../../skills/...`; script-targeting tests change `../src/` to `../`; validator-targeting tests change `../.github/skills/` to `../../../skills/`; internal `./lib/` imports are unchanged
- **No validator code changes**: The validate-orchestration tool checks only `.github/` structure — it does not inspect `src/`, `tests/`, `plan/`, or `bin/`, so its code needs zero modifications
- **Atomic cross-reference cutover**: All agent/instruction/skill path references must be updated in a single phase — never leave half pointing to old paths and half to new
- **Frozen artifact boundary**: Only files in the cross-reference audit (Categories A–I in Architecture) are modified; everything under `.github/projects/*/` (except this project's own status files) is never touched
- **Validation gates at every phase**: Each phase ends with targeted validation (module load checks, test suite runs, validate-orchestration, stale-path grep)

## Key Design Constraints (from Design)

Curated design decisions that affect implementation. Full details in the [Design](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-DESIGN.md).

- **Root directory clarity**: Post-reorg root contains exactly `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md` — every entry has an immediately obvious purpose
- **Archive naming**: Historical artifacts go to `archive/` (not `plan/`, `historical/`, or `legacy/`) — universally understood as "preserved, not active"
- **Dashboard in README above-the-fold**: The "Monitoring Dashboard" section with screenshot is placed after the pipeline diagram and before Key Features — highest visibility position
- **Single-directory adoption message**: README Quick Start changes from "copy `.github/` and `src/`" to "copy `.github/`"
- **Tests co-located with scripts**: Tests live at `.github/orchestration/scripts/tests/` inside the distributable tree, not at a separate root directory
- **New `docs/dashboard.md` page**: Follows existing docs conventions (title, intro, sections for purpose, prerequisites, startup, features, data sources, real-time updates)
- **Four intermediate states**: Pre-Reorg → Dual-Path → Path Cutover → Cleanup Complete — each must be fully functional

## Phase Outline

### Phase 1: Script & Schema Migration

**Goal**: Create all 7 runtime scripts and the active schema at their new `.github/orchestration/` locations with correct `require()` paths, without modifying originals.

**Scope**:
- Create directory structure: `.github/orchestration/scripts/`, `.github/orchestration/scripts/lib/`, `.github/orchestration/schemas/`
- Copy 3 CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) to `.github/orchestration/scripts/` with updated cross-tree `require()` paths (5 path changes total: `../.github/skills/...` → `../../skills/...`)
- Copy 4 lib modules (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) to `.github/orchestration/scripts/lib/` (no import changes — sibling paths preserved)
- Copy `plan/schemas/state-json-schema.md` to `.github/orchestration/schemas/state-json-schema.md`
- Validation gate: verify all 7 modules load without import errors at new locations — refs: [FR-1](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-14](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [Architecture § Layer 1](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] All 7 scripts load without errors at `.github/orchestration/scripts/` (node `-e require()` check)
- [ ] All `require()` paths in CLI scripts resolve correctly at new locations
- [ ] Original `src/` scripts remain untouched and functional
- [ ] `state-json-schema.md` exists at `.github/orchestration/schemas/`

**Dependencies**: None — this is the foundation phase.

**Phase Doc**: `phases/ORCHESTRATION-REORG-PHASE-01-SCRIPT-SCHEMA-MIGRATION.md` *(created at execution time)*

---

### Phase 2: Test Suite Migration

**Goal**: Migrate all 18 test files to `.github/orchestration/scripts/tests/` with corrected `require()` paths, without deleting originals.

**Scope**:
- Create directory: `.github/orchestration/scripts/tests/`
- Copy and update Family A tests (7 script-targeting files, 11 `require()` changes): `../src/` → `../`
- Copy and update Family B tests (11 validator-targeting files, 12 `require()` changes): `../.github/skills/` → `../../../skills/`
- Handle dynamic `require()` paths in test files that construct paths from variables (e.g., `agents.test.js`, `config.test.js`)
- Validation gate: all 18 tests pass at new locations — refs: [FR-15](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [Architecture § Layer 2](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] All 18 tests pass at new locations with zero failures
- [ ] All `require()` paths (static and dynamic) resolve correctly
- [ ] Original `tests/` files remain untouched and functional

**Dependencies**: Phase 1 (scripts must exist at new locations before tests can import them).

**Phase Doc**: `phases/ORCHESTRATION-REORG-PHASE-02-TEST-SUITE-MIGRATION.md` *(created at execution time)*

---

### Phase 3: Cross-Reference Cutover

**Goal**: Update all runtime-critical path references in agent, instruction, and skill files to point to new script locations. After this phase, the pipeline uses the new paths.

**Scope**:
- Update `.github/agents/orchestrator.agent.md`: 4 occurrences `src/next-action.js` → `.github/orchestration/scripts/next-action.js`
- Update `.github/agents/tactical-planner.agent.md`: 4 occurrences `src/validate-state.js` + 3 occurrences `src/triage.js` → new paths
- Update `.github/instructions/state-management.instructions.md`: 3 occurrences `src/validate-state.js` → new path
- Update `.github/skills/triage-report/SKILL.md`: 1 occurrence `src/triage.js` → new path
- Execute as a single atomic unit — never leave partial references pointing to old paths
- Validation gate: validate-orchestration passes; grep confirms zero stale `src/` references in agent/instruction/skill files — refs: [FR-10](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-11](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-12](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [Architecture § Layer 3](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] Zero occurrences of `src/next-action.js`, `src/validate-state.js`, `src/triage.js` in any agent, instruction, or skill file
- [ ] validate-orchestration reports zero errors
- [ ] Pipeline can execute using the new script paths

**Dependencies**: Phase 1 (new scripts must exist before references point to them).

**Phase Doc**: `phases/ORCHESTRATION-REORG-PHASE-03-CROSS-REFERENCE-CUTOVER.md` *(created at execution time)*

---

### Phase 4: Documentation & README Updates

**Goal**: Update all documentation to reflect the new structure, create dashboard documentation, and update the README with the dashboard showcase and single-directory adoption message.

**Scope**:
- Update `docs/scripts.md`: ~21 path references (`src/` → `.github/orchestration/scripts/`, `tests/` → `.github/orchestration/scripts/tests/`)
- Update `docs/project-structure.md`: Rewrite workspace layout tree per Design specification
- Update `docs/getting-started.md`: Change copy instruction from 2-dir to 1-dir
- Update `docs/validation.md`: Update 1 CLI reference
- Create `docs/dashboard.md`: New page covering purpose, prerequisites, startup, features, data sources, real-time updates, component architecture
- Update `README.md`: Add Monitoring Dashboard section (screenshot + description + link), update Quick Start to single-directory copy, add dashboard row to documentation table
- Verify/update `.github/copilot-instructions.md` if it contains stale structure references — refs: [FR-6](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-7](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-8](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-9](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-13](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-17](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-22](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [Design § README Layout](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-DESIGN.md), [Design § docs/dashboard.md](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-DESIGN.md)

**Exit Criteria**:
- [ ] Zero stale `src/` or `tests/` path references in any `docs/*.md` file or `README.md`
- [ ] `docs/dashboard.md` exists with all required sections (purpose, prerequisites, startup, features, data sources, real-time updates)
- [ ] `README.md` contains dashboard screenshot section, updated Quick Start (single-directory), and dashboard row in documentation table
- [ ] validate-orchestration reports zero errors

**Dependencies**: Phase 3 (docs should document the current state after cutover, not the transitional state).

**Phase Doc**: `phases/ORCHESTRATION-REORG-PHASE-04-DOCUMENTATION-README.md` *(created at execution time)*

---

### Phase 5: Archive, Assets & Cleanup

**Goal**: Create the archive directory for historical artifacts, add the dashboard screenshot asset, and delete all original directories (`src/`, `tests/`, `plan/`, `bin/`). This is the only phase with destructive operations.

**Scope**:
- Create `archive/` and `archive/schemas/` directories
- Move `plan/ORCHESTRATION-MASTER-PLAN.md` and `plan/orchestration-human-draft.md` to `archive/`
- Move 14 relic schema files from `plan/schemas/` to `archive/schemas/` (excluding `state-json-schema.md`, already promoted in Phase 1)
- Create `assets/` directory and add `assets/dashboard-screenshot.png` (capture from running UI or create placeholder)
- Delete `src/` (7 files, all migrated in Phase 1)
- Delete `tests/` (18 files, all migrated in Phase 2)
- Delete `plan/` (all files either promoted to `.github/orchestration/schemas/` or archived)
- Delete `bin/` (empty, zero references)
- Final validation gate: full test suite (18/18), validate-orchestration, directory existence checks, frozen artifact integrity — refs: [FR-4](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-5](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [FR-21](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-PRD.md), [Architecture § Layer 5](.github/projects/ORCHESTRATION-REORG/ORCHESTRATION-REORG-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] `archive/` exists with `ORCHESTRATION-MASTER-PLAN.md`, `orchestration-human-draft.md`, and `schemas/` subfolder (14 relic files)
- [ ] `assets/` exists with `dashboard-screenshot.png`
- [ ] `src/`, `tests/`, `plan/`, `bin/` no longer exist
- [ ] Full test suite passes (18/18) from `.github/orchestration/scripts/tests/`
- [ ] validate-orchestration reports zero errors
- [ ] Zero modifications to frozen project artifacts (verified by git diff)
- [ ] Root directory contains: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`

**Dependencies**: Phases 1–4 (all migrations and reference updates must be complete before deleting originals).

**Phase Doc**: `phases/ORCHESTRATION-REORG-PHASE-05-ARCHIVE-ASSETS-CLEANUP.md` *(created at execution time)*

---

## Phase Dependency Graph

```
Phase 1 (Scripts & Schema) ─────► Phase 2 (Tests)
         │                                  │
         │                                  │
         ▼                                  ▼
Phase 3 (Cross-Ref Cutover) ◄──────────────┘
         │
         ├──────► Phase 4 (Docs & README)
         │                    │
         ▼                    ▼
Phase 5 (Archive & Cleanup) ◄┘
```

- **Phase 1 → Phase 2**: Tests import from scripts — scripts must exist at new locations first
- **Phase 1 → Phase 3**: References must not point to non-existent paths
- **Phase 2 → Phase 3**: Tests should be validated before the critical cutover
- **Phase 3 → Phase 4**: Documentation should reflect the post-cutover state
- **Phases 3 & 4 → Phase 5**: All content must be migrated and all references updated before destructive deletions

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml`) — this plan uses 5
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2
- **Max consecutive review rejections**: 3
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: After planning (this Master Plan) and after final review — configured as `after_planning: true`, `execution_mode: ask`, `after_final_review: true`
- **Error handling**: Critical errors (build failure, security vulnerability, architectural violation, data loss risk) → halt pipeline; Minor errors (test failure, lint error, review suggestion) → auto-retry

## Risk Register

| # | Risk | Impact | Mitigation | Source |
|---|------|--------|-----------|--------|
| R-1 | **Broken pipeline mid-execution**: updating agent script paths before new scripts exist halts the currently-running pipeline | High | Phase 1 creates scripts at new locations first; Phase 3 updates references only after scripts are verified; old `src/` remains as safety net until Phase 5 | PRD R-1, Architecture § Phasing |
| R-2 | **Missed cross-reference**: a stale path in an agent, skill, instruction, or doc causes silent pipeline failure or user confusion | High | Research audit identifies 30+ active references across 9 files; Architecture provides exhaustive cross-reference inventory (Categories A–I); validate-orchestration + stale-path grep run after every phase | PRD R-2, Architecture § Validation |
| R-3 | **Test import breakage**: incorrectly updated `require()` paths cause test failures blocking validation | Medium | Two test families handled as separate batches with distinct path calculations; full test suite run after Phase 2; Architecture specifies exact path transformations for all 23 `require()` changes | PRD R-3, Architecture § Contracts |
| R-4 | **Historical artifact contamination**: accidentally modifying frozen project documents breaks the historical record | Medium | Strict boundary enforced: only files in Architecture Categories A–I are modified; Coder must NOT run blanket find-and-replace across the repo; git diff of frozen project dirs verified in Phase 5 | PRD R-4, Architecture § Cross-Cutting |
| R-5 | **Screenshot asset missing or broken**: dashboard screenshot doesn't render on GitHub or locally | Low | Commit as standard PNG in `assets/`; use relative path in README; verify rendering in both contexts | PRD R-5 |
| R-6 | **Undiscovered references**: cross-references not captured in research cause post-reorg breakage | Medium | Full-text grep for old path patterns after each phase; validate-orchestration as integrity check; full test suite as final gate | PRD R-6, Architecture § Validation |
| R-7 | **Dynamic `require()` paths missed in tests**: test files that construct paths from variables (e.g., `path.resolve()`) not caught by static analysis | Medium | Architecture flags `agents.test.js` and `config.test.js` as special cases; Coder must grep each test file for ALL `require()` calls including dynamically-built ones | Architecture § Category F |
| R-8 | **Phase 5 destructive operations irreversible**: deleting `src/`, `tests/`, `plan/`, `bin/` cannot be easily undone | High | Phase 5 gated behind full validation of all prior phases; every deleted file already migrated and verified; git history preserves originals as ultimate rollback | Architecture § Risk-Aware Sequencing |
