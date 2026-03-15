---
project: "UI-PATH-FIX"
phase: 1
title: "Pipeline & UI Bugfix"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-14T12:30:00Z"
---

# Phase 1: Pipeline & UI Bugfix

## Phase Goal

Fix both confirmed bugs — missing metadata fields and path format mismatch — across the pipeline mutation handlers and UI data-transformation layer, achieving defense-in-depth so that both existing and future `state.json` files render correctly in the dashboard.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-PATH-FIX-MASTER-PLAN.md) | Phase 1 scope, exit criteria, risk register, suggested task breakdown |
| [Architecture](../UI-PATH-FIX-ARCHITECTURE.md) | Contracts 1–7 (pipeline phase/task object shape, normalizeDocPath, normalizeContextPaths, normalizer fallback chains, path resolver prefix stripping), module map, file structure, internal dependency graph |
| [Design](../UI-PATH-FIX-DESIGN.md) | Data contracts for normalizer input/output, path resolution behavior table, pipeline mutation field tables, ID parsing fallback logic |
| [PRD](../UI-PATH-FIX-PRD.md) | FR-1 through FR-10, NFR-1 through NFR-5, success metrics |
| [Research Findings](../UI-PATH-FIX-RESEARCH-FINDINGS.md) | Root cause analysis, state.json evidence across projects, existing code patterns, path resolution chain analysis |

## Task Outline

| # | Task | Dependencies | Files Modified | Est. Files | Handoff Doc |
|---|------|-------------|----------------|-----------|-------------|
| T1 | Pipeline Metadata & Path Helper | — | `mutations.js` | 1 | [Link](../tasks/UI-PATH-FIX-TASK-P01-T01-PIPELINE-METADATA.md) |
| T2 | Centralized Path Normalization | T1 | `pipeline-engine.js` | 1 | [Link](../tasks/UI-PATH-FIX-TASK-P01-T02-PATH-NORMALIZATION.md) |
| T3 | UI Normalizer Fallback Chains | — | `normalizer.ts` | 1 | [Link](../tasks/UI-PATH-FIX-TASK-P01-T03-NORMALIZER-FALLBACKS.md) |
| T4 | UI Path Resolver Prefix Stripping | — | `path-resolver.ts` | 1 | [Link](../tasks/UI-PATH-FIX-TASK-P01-T04-PATH-RESOLVER.md) |

### T1 — Pipeline Metadata & Path Helper (`mutations.js`)

**Objective**: Populate missing metadata fields on phase and task objects in the pipeline mutation handlers, and add the `normalizeDocPath` path-normalization utility function.

**Scope**:
- In `handlePlanApproved`: add `phase_number` (1-indexed from loop), `title` (from `context.phases[i].title` with `"Phase ${i+1}"` fallback), and `total_tasks: 0` to each phase object initialization
- In `handlePhasePlanCreated`: add `task_number` (from `t.task_number` or `idx + 1`), `last_error: null`, and `severity: null` to each task object initialization
- Add new `normalizeDocPath(docPath, basePath, projectName)` helper function that strips the `{basePath}/{projectName}/` prefix if present, passes through `null`/`undefined`/empty string, and is idempotent

**Acceptance criteria**:
- Phase objects include `phase_number`, `title`, `total_tasks` after `handlePlanApproved` executes
- Task objects include `task_number`, `last_error`, `severity` after `handlePhasePlanCreated` executes
- `normalizeDocPath` strips workspace-relative prefix correctly per Contract 3 behavior table
- `normalizeDocPath` is exported for use by `pipeline-engine.js`
- Null/undefined/empty inputs to `normalizeDocPath` pass through without throwing

**Refs**: FR-1, FR-2, FR-3, FR-8, FR-10 · Architecture Contracts 1, 2, 3

### T2 — Centralized Path Normalization (`pipeline-engine.js`)

**Objective**: Add a centralized `normalizeContextPaths` call in the pipeline engine that normalizes all `context.*_path` / `context.doc_path` fields to project-relative format before mutation handlers execute.

**Scope**:
- Import `normalizeDocPath` from `mutations.js`
- Add `normalizeContextPaths(context, basePath, projectName)` function that applies `normalizeDocPath` to: `context.doc_path`, `context.plan_path`, `context.handoff_path`, `context.report_path`, `context.review_path`
- Call `normalizeContextPaths` in `executePipeline` after pre-read enrichment but before the mutation handler call
- Derive `basePath` from loaded config and `projectName` from `state.project.name`

**Acceptance criteria**:
- All `context.*_path` fields are project-relative by the time mutation handlers receive them
- Pre-read enrichment (which needs workspace-relative paths to find files) is not affected — normalization occurs after pre-reads
- Already project-relative paths pass through unchanged (idempotent)
- No changes to mutation handler signatures or behavior

**Refs**: FR-8 · Architecture Contract 4

### T3 — UI Normalizer Fallback Chains (`normalizer.ts`)

**Objective**: Add index-based fallback chains to `normalizePhase` and `normalizeTask` so that phases and tasks display correct numbers even when `phase_number` / `task_number` are missing from raw state.

**Scope**:
- Add `index: number` parameter to `normalizePhase` signature
- Implement `phase_number` fallback: `raw.phase_number` → parse numeric suffix from `raw.id` → `index + 1`
- Implement `total_tasks` fallback: `raw.total_tasks` → `raw.tasks?.length` → `0`
- Add `index: number` parameter to `normalizeTask` signature
- Implement `task_number` fallback: `raw.task_number` → parse numeric suffix from `raw.id` → `index + 1`
- ID parsing: strip leading non-digit characters, parse remaining as base-10 integer; fall through on `NaN`
- Update `normalizeState` call sites — `.map()` already provides index as second argument, so only the function signature needs to change

**Acceptance criteria**:
- `normalizePhase` returns valid `phase_number` for phases with the field set, with only `id`, or with neither
- `normalizeTask` returns valid `task_number` for tasks with the field set, with only `id`, or with neither
- `total_tasks` falls back to `tasks.length` when not explicitly set
- Existing phases/tasks with `phase_number` / `task_number` already set use priority-1 value (no regression)
- No TypeScript compilation errors

**Refs**: FR-4, FR-5, FR-10 · Architecture Contracts 5, 6

### T4 — UI Path Resolver Prefix Stripping (`path-resolver.ts`)

**Objective**: Modify `resolveDocPath` to detect and strip workspace-relative path prefixes so that both workspace-relative and project-relative document paths resolve correctly.

**Scope**:
- Construct prefix as `basePath + '/' + projectName + '/'`
- Normalize backslashes to forward slashes in both `prefix` and `relativePath` before comparison
- If `relativePath.startsWith(prefix)`: strip the prefix
- Proceed with existing `path.resolve(workspaceRoot, basePath, projectName, strippedPath)` logic
- Existing traversal protections (`..` rejection, `absPath.startsWith(projectDir)` guard in the API route) must remain intact and unmodified

**Acceptance criteria**:
- Workspace-relative paths (e.g., `.github/projects/PROJ/tasks/FILE.md`) resolve to the correct absolute path
- Project-relative paths (e.g., `tasks/FILE.md`) continue to resolve correctly (no regression)
- Root-level project files (e.g., `PROJ-PRD.md`) continue to resolve correctly
- Backslash-containing paths on Windows are handled via slash normalization
- Prefix stripping is idempotent — applying it to an already-stripped path is a no-op
- No TypeScript compilation errors
- Existing `..` traversal protections in the document API route are preserved

**Refs**: FR-6, FR-7, NFR-2 · Architecture Contract 7

## Execution Order

```
T1 (Pipeline Metadata & Path Helper — mutations.js)
 └→ T2 (Centralized Path Normalization — pipeline-engine.js)   ← depends on T1
T3 (UI Normalizer Fallback Chains — normalizer.ts)             ← independent
T4 (UI Path Resolver Prefix Stripping — path-resolver.ts)      ← independent
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T3 and T4 are parallel-ready with each other and with T2. Only T2 depends on T1 (it imports `normalizeDocPath` from `mutations.js`). Executing T1 first ensures the path helper is available for T2. T3 and T4 can execute at any point in the sequence since they modify independent UI files.*

## Phase Exit Criteria

- [ ] Pipeline-generated `state.json` includes `phase_number`, `title`, `total_tasks` on all phase objects
- [ ] Pipeline-generated `state.json` includes `task_number`, `last_error`, `severity` on all task objects
- [ ] All document paths in newly pipeline-generated `state.json` are project-relative format
- [ ] RAINBOW-HELLO phases display correct numbers and titles in the UI (existing workspace-relative paths handled by UI fallbacks)
- [ ] RAINBOW-HELLO document links resolve successfully (no 404s)
- [ ] PIPELINE-HOTFIX phases, tasks, and document links continue to render correctly (zero regressions)
- [ ] No TypeScript compilation errors in the UI project
- [ ] Existing `..` traversal protections in the document API route remain intact
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Double path stripping if both pipeline and UI normalize the same path | Low | Med | Both `normalizeDocPath` and `resolveDocPath` stripping are idempotent — `startsWith(prefix)` returns false for already-relative paths |
| R2 | `context.phases` not available in `handlePlanApproved` for phase titles | Med | Low | Fallback `"Phase ${i+1}"` provides a reasonable display name; UI normalizer has `'Unnamed Phase'` fallback |
| R3 | Custom `base_path` in orchestration.yml differs from expected pattern | Low | High | Both `normalizeDocPath` and `resolveDocPath` use the configured `basePath` dynamically, never hardcoded |
| R4 | Regression in PIPELINE-HOTFIX or other manually bootstrapped projects | Low | High | Normalizer fallbacks only activate when fields are missing; path prefix strip only activates on prefix match; explicit regression verification in exit criteria |
| R5 | `normalizePhase`/`normalizeTask` signature change breaks call sites | Low | Med | Only one call site each in `normalizeState` — both are `.map()` calls where index is automatically provided as the second argument |
| R6 | Backslash path separators on Windows cause prefix mismatch | Low | Med | T4 explicitly normalizes slashes to forward slashes before prefix comparison |
| R7 | Context path normalization in `pipeline-engine.js` occurs before pre-read enrichment needs the original path | Med | Med | T2 must place normalization after pre-reads (which need workspace-relative paths to find files) but before mutation calls |
| R8 | T1 and T2 both touch pipeline layer — coder on T2 must see T1's changes | Low | Low | T2 depends on T1; task handoff for T2 is created after T1 completes and includes T1's report |
