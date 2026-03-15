---
project: "ORCHESTRATION-REORG"
status: "draft"
author: "product-manager-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Product Requirements

## Problem Statement

The repository structure has grown organically and no longer communicates a coherent story to new users. Runtime scripts, tests, and historical design artifacts are scattered across root-level folders (`src/`, `tests/`, `plan/`, `bin/`) that obscure the relationship between the orchestration system and its supporting code. Adopting the system requires copying two separate directory trees (`.github/` and `src/`), and the monitoring dashboard — a significant feature — is completely invisible in the README and documentation. A new user pulling this repo cannot quickly understand what to copy, what is historical, and how the pieces relate.

## Goals

- **G-1**: Consolidate the orchestration runtime (scripts, schemas, tests) into a single distributable directory so that adopting the system requires copying only one folder
- **G-2**: Separate active system artifacts from historical design documents so that the repository structure clearly communicates what is current vs. archived
- **G-3**: Eliminate dead or empty directories that add noise and confuse contributors
- **G-4**: Surface the monitoring dashboard in README and documentation so that first-time visitors discover it immediately
- **G-5**: Ensure every cross-reference, import path, and documentation link reflects the new structure so the system passes validation with zero regressions
- **G-6**: Maintain full system functionality throughout the reorganization — the orchestration pipeline must remain operational at every stage since it executes its own reorg

## Non-Goals

- Refactoring script internals, APIs, or logic — this is a structural move, not a rewrite
- Restructuring Copilot convention directories (agents, skills, instructions, prompts) — these are fixed by platform constraints
- Modifying the UI application code or folder structure
- Changing pipeline configuration, state management, or orchestration.yml project settings
- Updating path references inside completed project artifacts (task reports, phase reports, reviews) — these are frozen historical records
- Extracting shared utilities out of the validate-orchestration skill into a separate package

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | New adopter | copy a single directory to get the complete orchestration system (agents, skills, scripts, schemas, tests, and config) | I don't have to hunt across multiple root-level folders or miss runtime dependencies | P0 |
| 2 | New adopter | see the monitoring dashboard showcased in the README with a screenshot | I discover the UI feature within seconds of visiting the repo | P1 |
| 3 | Contributor | understand from the directory structure alone which files are active system components vs. historical design artifacts | I don't waste time reading or modifying files that are no longer canonical | P0 |
| 4 | Contributor | find dedicated documentation for the monitoring dashboard | I can start, configure, and understand the UI without reading source code | P1 |
| 5 | Pipeline operator | have all agent command references and script paths point to the correct locations after the reorg | the orchestration pipeline continues running end-to-end without path-related failures | P0 |
| 6 | Pipeline operator | have the system remain fully functional at every intermediate stage of the reorganization | I am not blocked by a half-completed migration that breaks the pipeline mid-execution | P0 |
| 7 | Test maintainer | find all tests co-located with the scripts they exercise under one directory tree | I can run, discover, and maintain the full test suite from a single location | P1 |
| 8 | Contributor | see no empty or vestigial folders in the repository root | the workspace feels clean and every directory has a clear purpose | P2 |
| 9 | Documentation reader | have all docs pages (getting started, scripts, project structure, validation) reflect the current file structure | I am not misled by stale path references in documentation | P0 |
| 10 | Adopter | have the canonical state schema file live alongside the runtime code that enforces it | the schema is discoverable in context rather than buried in a folder of archived templates | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The orchestration runtime scripts (3 CLI entry points and 4 library modules) shall be located within the single distributable directory alongside agents, skills, and configuration | P0 | Currently in root `src/`; research identifies 7 files total |
| FR-2 | The test suite (18 test files covering both script modules and validator modules) shall be located within the single distributable directory, co-located with the scripts they test | P1 | Currently in root `tests/` |
| FR-3 | The canonical state schema document shall be located within the single distributable directory alongside the runtime scripts and schemas | P1 | Research confirms this is the only active file among 15 in the schemas folder |
| FR-4 | All historical design artifacts (original master plan, human draft, and 14 relic template files) shall be relocated to a clearly-named archive directory at the repository root | P0 | The archive directory name must signal "historical, not active" |
| FR-5 | The empty `bin/` directory shall be removed from the repository | P2 | Research confirms zero references to this directory |
| FR-6 | The README shall include a visual screenshot of the monitoring dashboard near the top of the document | P1 | No screenshot or UI mention exists today |
| FR-7 | The README shall include a brief description of the monitoring dashboard with a link to dedicated documentation | P1 | — |
| FR-8 | The README quick-start instructions shall be updated to reflect the single-directory distribution model | P0 | Currently instructs copying two separate directories |
| FR-9 | A dedicated documentation page for the monitoring dashboard shall be created, covering purpose, prerequisites, startup procedure, feature overview, data sources, and real-time update mechanism | P1 | Consistent with existing docs pattern (one page per major feature) |
| FR-10 | All agent definition files that contain script invocation commands shall reference the correct post-reorg script locations | P0 | Research identifies 2 agent files with ~8 path references to CLI scripts; these are runtime-critical |
| FR-11 | All instruction files that reference script paths shall be updated to reflect the new locations | P0 | Research identifies 1 instruction file with 3 references |
| FR-12 | All skill files that reference script paths shall be updated to reflect the new locations | P0 | Research identifies 1 skill file with a script reference |
| FR-13 | All documentation pages that reference script, test, or source directory paths shall be updated to reflect the new structure | P0 | Research identifies 4 of 8 docs files needing updates, with ~30 path references total |
| FR-14 | All import/require paths within the relocated scripts shall be updated so that cross-module dependencies resolve correctly at the new locations | P0 | 3 CLI scripts import from the validate-orchestration utility tree; 4 lib modules import from siblings |
| FR-15 | All import/require paths within the relocated test files shall be updated so that test-to-module dependencies resolve correctly at the new locations | P0 | 7 tests import from script modules, 11 tests import from validator modules |
| FR-16 | The workspace-level Copilot instructions file shall reflect the updated repository structure | P1 | This file is loaded by Copilot for all interactions |
| FR-17 | The documentation pages for project structure and getting started shall reflect the updated directory layout | P0 | — |
| FR-18 | The system shall pass the full validate-orchestration check suite with zero regressions after all changes are complete | P0 | Research confirms validator code itself needs no changes — only references to it |
| FR-19 | Frozen project artifacts within the projects directory shall NOT have their internal path references modified | P0 | Research identifies 100+ references across 4 completed projects — all must remain untouched |
| FR-20 | The reorganization shall preserve the system in a fully functional state at each intermediate stage — destructive operations (removing original directories, rewiring paths) shall not occur until new locations are established and verified | P0 | The system is executing its own reorganization; breaking it mid-pipeline halts the project |
| FR-21 | A screenshot image asset shall be added to the repository in a dedicated assets directory for use by the README | P1 | No assets directory exists today |
| FR-22 | The existing docs page covering scripts shall be updated to document the new script locations, updated CLI invocation paths, and updated test execution commands | P0 | Research identifies this as the densest file: ~20 path references |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Reliability | The orchestration pipeline shall remain fully operational throughout the entire reorganization process — no phase may leave the system in a broken state |
| NFR-2 | Reliability | All 18 existing tests shall pass at the new locations with zero failures and no behavioral changes |
| NFR-3 | Integrity | Cross-reference integrity across agents, skills, instructions, prompts, and configuration shall be maintained — validate-orchestration must report zero new errors |
| NFR-4 | Portability | The single distributable directory shall contain all components necessary to adopt the orchestration system in a new project (agents, skills, instructions, prompts, scripts, schemas, tests, and configuration) |
| NFR-5 | Maintainability | The script modules shall continue to have zero npm dependencies — only Node.js built-ins and internal cross-references to other orchestration modules |
| NFR-6 | Maintainability | Internal library module imports (sibling imports within the lib folder) shall remain unchanged — the internal directory structure of the scripts is preserved during the move |
| NFR-7 | Discoverability | A new user should be able to determine the purpose of every root-level directory within 30 seconds of viewing the repository structure |
| NFR-8 | Consistency | All documentation shall reflect the actual file structure — zero stale path references in any active (non-archived) document |
| NFR-9 | Compatibility | The UI dashboard shall continue to function without modification — it reads from the projects directory and configuration file, neither of which changes location |
| NFR-10 | Completeness | The dashboard documentation page shall follow the same structural conventions as existing docs pages (getting-started, scripts, validation, etc.) |

## Assumptions

- The Copilot platform requires agents, skills, instructions, and prompts directories to remain at their current fixed locations under `.github/`
- The validate-orchestration skill's checks validate only `.github/` directory structure and do not inspect `src/`, `tests/`, `plan/`, or `bin/` — confirmed by research
- The 14 template files in the schemas folder are true relics whose content has been fully promoted into skill templates — no active consumer depends on them
- The `bin/` directory has no tracked files beyond a possible `.gitkeep` and nothing references it
- The UI application has no dependency on `src/`, `tests/`, or `plan/` — confirmed by research
- Historical project artifacts are considered frozen and must not be modified under any circumstances
- The monitoring dashboard screenshot is available or can be captured from the running UI

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | Broken pipeline mid-execution: updating script paths in agent files before new script locations are established breaks the currently-running orchestration pipeline | High | Phase work so that new files are created and validated before original locations are removed; maintain dual-path compatibility during transition |
| R-2 | Missed cross-reference: a stale path reference in an agent, skill, instruction, or doc file causes silent pipeline failure or user confusion | High | Use comprehensive path auditing — research identifies 30+ active references across 9 files; verify each is addressed; run validate-orchestration after every phase |
| R-3 | Test import breakage: incorrectly updated require paths cause test failures that block validation | Medium | Update the two test families (7 script-targeting and 11 validator-targeting) as separate batches with distinct path calculations; run full test suite after each batch |
| R-4 | Historical artifact contamination: accidentally modifying frozen project documents breaks the historical record | Medium | Enforce a strict boundary — only files identified in the active cross-reference audit (research §2.1, §2.3) are modified; project artifacts (research §2.2) are never touched |
| R-5 | Screenshot asset missing or broken: the dashboard screenshot doesn't render correctly on GitHub or in local clones | Low | Commit the image as a standard PNG in a dedicated assets directory; use relative paths in README; verify rendering in both contexts |
| R-6 | Undiscovered references: cross-references not captured in the research findings cause post-reorg breakage | Medium | Run full-text search for old path patterns after the reorg is complete; run validate-orchestration; run the full test suite as a final verification gate |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Validate-orchestration pass rate | 100% — zero errors, zero regressions | Run `validate-orchestration` CLI after final phase and compare output to pre-reorg baseline |
| Test suite pass rate | 100% — all 18 tests pass at new locations | Run full test suite (`node:test`) from new test directory |
| Distribution directory count | 1 directory required for adoption (down from 2) | Verify README quick-start instructions reference a single directory |
| Stale path references in active files | 0 | Full-text search for old path patterns (`src/`, `tests/`, `plan/schemas/`, `bin/`) across all active (non-archived) files |
| Root-level directory clarity | Every root directory has an obvious, non-overlapping purpose | Manual review of root directory listing — no empty, vestigial, or ambiguously-named folders |
| Dashboard discoverability | Dashboard is visible in README within first scroll viewport | Manual review — screenshot and description appear above the fold or within the first major section |
| Documentation completeness | Dedicated dashboard docs page exists with startup instructions | Verify file exists and covers: purpose, prerequisites, startup, features, data sources |
| Frozen artifact integrity | 0 modifications to completed project documents | Git diff of projects directory shows zero changes to completed project files |
