---
project: "ORCHESTRATION-REORG"
phase: 4
title: "Documentation & README Updates"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-11T22:00:00Z"
---

# Phase 4: Documentation & README Updates

## Phase Goal

Update all user-facing documentation to reflect the post-cutover repository structure (`.github/orchestration/scripts/` paths, single-directory distribution), create dedicated dashboard documentation, and add the dashboard showcase to the README. When complete, a new visitor or contributor encounters zero stale `src/` or `tests/` references in any documentation file.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../ORCHESTRATION-REORG-MASTER-PLAN.md) | Phase 4 scope, exit criteria, file list, reference counts |
| [Architecture](../ORCHESTRATION-REORG-ARCHITECTURE.md) | Layer 4 file table, updated file structure tree, `docs/dashboard.md` specification |
| [Design](../ORCHESTRATION-REORG-DESIGN.md) | README layout (§ README Layout), `docs/dashboard.md` page layout (§ docs/dashboard.md Page Layout), `docs/project-structure.md` updated tree, `docs/scripts.md` path mapping, `docs/getting-started.md` change, `docs/validation.md` change |
| [Phase 3 Report](ORCHESTRATION-REORG-PHASE-REPORT-P03.md) | Carry-forward: docs must reflect post-cutover state; old `src/` retained until Phase 5; pre-existing validate-orchestration failure (triage-report templates/) does not block |
| [Phase 3 Review](PHASE-REVIEW-P03.md) | Verdict: approved → advance. Recommendation: update all `docs/` path references from `src/` to `.github/orchestration/scripts/` |
| [Issues Log](../ORCHESTRATION-REORG-ISSUES.md) | No documentation-related issues; pre-existing issues do not affect Phase 4 |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Update `docs/scripts.md` Path References | — | file editing | 1 | *(created at execution time)* |
| T2 | Update `docs/project-structure.md` Layout Tree | — | file editing | 1 | *(created at execution time)* |
| T3 | Update `docs/getting-started.md` & `docs/validation.md` | — | file editing | 2 | *(created at execution time)* |
| T4 | Create `docs/dashboard.md` | — | file creation | 1 | *(created at execution time)* |
| T5 | Update `README.md` | T4 | file editing | 1 | *(created at execution time)* |
| T6 | Verify Copilot Instructions & Validation Gate | T1, T2, T3, T4, T5 | verification, validation | 0–1 | *(created at execution time)* |

## Task Details

### T1: Update `docs/scripts.md` Path References

**Objective**: Replace all ~21 stale `src/` and `tests/` path references in `docs/scripts.md` with their `.github/orchestration/scripts/` equivalents. Update the architecture diagram, CLI usage examples, test execution examples, and any inline path references.

**Key changes (from Design spec):**
- Architecture diagram: `src/` → `.github/orchestration/scripts/`
- CLI invocations: `node src/<script>.js` → `node .github/orchestration/scripts/<script>.js`
- Test execution: `node tests/<test>.test.js` → `node .github/orchestration/scripts/tests/<test>.test.js`
- Lib module references: `src/lib/<module>.js` → `.github/orchestration/scripts/lib/<module>.js`

**Acceptance criteria:**
- Zero occurrences of `src/` or `tests/` as path prefixes in `docs/scripts.md`
- All ~21 path references updated to `.github/orchestration/scripts/` equivalents
- File renders correctly in Markdown preview

### T2: Update `docs/project-structure.md` Layout Tree

**Objective**: Rewrite the workspace layout tree in `docs/project-structure.md` to reflect the post-reorg structure. Remove `src/`, `tests/`, `plan/`, `bin/` entries. Add `.github/orchestration/` with `scripts/` and `schemas/` subtrees, `archive/`, and `assets/`. Follow the exact tree from the Design spec (§ docs/project-structure.md Layout).

**Acceptance criteria:**
- Layout tree matches Design spec tree (`.github/orchestration/`, `archive/`, `assets/`, `docs/` with `dashboard.md`, no `src/`, `tests/`, `plan/`, `bin/`)
- Accompanying descriptions updated to match new entries
- File renders correctly in Markdown preview

### T3: Update `docs/getting-started.md` & `docs/validation.md`

**Objective**: Make targeted path updates in two small documentation files.

**Changes:**
- `docs/getting-started.md`: Change the copy instruction from "Copy the `.github/` and `src/` directories" to "Copy the `.github/` directory" (single-directory distribution model). Update accompanying explanation to omit `src/` clause.
- `docs/validation.md`: Update 1 CLI reference from `node src/validate-state.js` to `node .github/orchestration/scripts/validate-state.js`.

**Acceptance criteria:**
- `docs/getting-started.md` contains no `src/` copy instruction; single-directory message present
- `docs/validation.md` CLI reference uses `.github/orchestration/scripts/validate-state.js`
- Zero stale `src/` path references in either file

### T4: Create `docs/dashboard.md`

**Objective**: Create a new documentation page for the monitoring dashboard following the Design spec (§ docs/dashboard.md Page Layout) and matching the structural conventions of existing docs pages.

**Required sections (from Design spec):**
1. Title: `# Monitoring Dashboard`
2. Intro paragraph (2–3 sentences)
3. Screenshot: `![Monitoring Dashboard](../assets/dashboard-screenshot.png)`
4. Prerequisites: Node.js v18+, npm, workspace with orchestration projects
5. Getting Started: `cd ui && npm install && npm run dev` with `.env.local` setup
6. Features: Subsections for Project Sidebar, Dashboard Overview, Planning Pipeline, Execution Drill-Down, Document Viewer, Configuration Viewer, Status Indicators, Theme Support
7. Data Sources: What files the dashboard reads
8. Real-Time Updates: SSE + chokidar file watching
9. Component Architecture: High-level component map
10. Next Steps: Links to related docs

**Acceptance criteria:**
- `docs/dashboard.md` exists with all 10 sections
- Follows existing docs conventions: `#` title, `##` major sections, `###` subsections, code blocks with language hints, tables for reference info
- Links to other docs use correct relative paths

### T5: Update `README.md`

**Objective**: Add the Monitoring Dashboard section, update Quick Start for single-directory distribution, and add the dashboard row to the documentation table. Follow the Design spec (§ README Layout).

**Changes:**
1. **New section** — "Monitoring Dashboard" (Section 3 per Design): screenshot image, 2-sentence description, link to `docs/dashboard.md`. Placed after pipeline diagram, before Key Features.
2. **Modified section** — Quick Start (Section 5 per Design): change step 2 from "Copy the `.github/` and `src/` directories" to "Copy the `.github/` directory"
3. **Modified section** — Documentation table (Section 6 per Design): add row `| [Monitoring Dashboard](docs/dashboard.md) | Dashboard startup, features, data sources, real-time updates |` after the last current entry

**Acceptance criteria:**
- README contains "## Monitoring Dashboard" section with screenshot and link to `docs/dashboard.md`
- Quick Start references single-directory copy (`.github/` only, no `src/`)
- Documentation table includes "Monitoring Dashboard" row
- All links resolve to valid targets

### T6: Verify Copilot Instructions & Validation Gate

**Objective**: Verify `.github/copilot-instructions.md` contains no stale structure references, and run the full validation gate to confirm Phase 4 deliverables.

**Verification steps:**
1. Grep `.github/copilot-instructions.md` for stale `src/`, `tests/`, `plan/`, `bin/` path references. If found, update them.
2. Grep all `docs/*.md` and `README.md` for any remaining stale `src/` or `tests/` path prefixes — must be zero.
3. Run `node .github/orchestration/scripts/tests/*.test.js` (node --test) — all 307+ tests must pass.
4. Run `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` — check for errors (pre-existing `triage-report` failure is acceptable).
5. Verify `docs/dashboard.md` exists and contains all required sections.

**Acceptance criteria:**
- `.github/copilot-instructions.md` contains zero stale path references (or was already clean)
- Zero stale `src/` or `tests/` path prefixes in any `docs/*.md` file or `README.md`
- Test suite passes (307/307+)
- validate-orchestration reports no new errors beyond pre-existing `triage-report` failure
- `docs/dashboard.md` exists with all required sections

## Execution Order

```
T1 (docs/scripts.md)
T2 (docs/project-structure.md)  ← parallel-ready with T1
T3 (getting-started + validation) ← parallel-ready with T1, T2
T4 (docs/dashboard.md)          ← parallel-ready with T1, T2, T3
 └→ T5 (README.md — depends on T4 for dashboard.md link)
T6 (Validation Gate — depends on T1, T2, T3, T4, T5)
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T1, T2, T3, and T4 are parallel-ready (no mutual dependencies) but will execute sequentially in v1. T5 depends on T4 because the README links to `docs/dashboard.md`. T6 depends on all tasks as the final validation gate.*

## Phase Exit Criteria

- [ ] Zero stale `src/` or `tests/` path references in any `docs/*.md` file or `README.md`
- [ ] `docs/dashboard.md` exists with all required sections (purpose, prerequisites, startup, features, data sources, real-time updates)
- [ ] `README.md` contains dashboard screenshot section, updated Quick Start (single-directory), and dashboard row in documentation table
- [ ] validate-orchestration reports zero new errors (pre-existing `triage-report` failure acceptable)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Test suite passes (307/307+)

## Known Risks for This Phase

- **Stale `src/` references in unexpected locations**: The Phase 3 broad sweep found matches in frozen `.github/projects/` artifacts. Phase 4 scope is limited to `docs/`, `README.md`, and `.github/copilot-instructions.md` — project artifacts are intentionally excluded as they are historical records.
- **Dashboard screenshot asset does not exist yet**: `assets/dashboard-screenshot.png` is created in Phase 5. The `docs/dashboard.md` and README sections will reference it, but the image will show as broken until Phase 5. This is acceptable per the phased approach — the link path is correct even if the asset is not yet present.
- **README structure variation**: The README may have been modified outside this project. T5 must read the current README and locate sections by content, not line numbers.
