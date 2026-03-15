---
project: "UI-PATH-FIX"
total_phases: 1
status: "draft"
author: "architect-agent"
created: "2026-03-14T12:00:00Z"
---

# UI-PATH-FIX — Master Plan

## Executive Summary

The orchestration system's automated pipeline produces `state.json` files with two defects: missing metadata fields (`phase_number`, `task_number`, `total_tasks`) cause the UI to render "Phase undefined" / "Tundefined" labels, and workspace-relative document paths (e.g., `.github/projects/PROJ/tasks/FILE.md`) cause every document link to 404 because the UI's path resolver doubles the prefix. This project applies a defense-in-depth fix: the pipeline mutation handlers are corrected to populate missing fields and normalize paths at write time, and the UI normalizer and path resolver are hardened with fallback chains and prefix-stripping so that both old and new `state.json` files render correctly. All changes touch 4 existing files with no new modules, no schema changes, and no migration of existing state files.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Research | [UI-PATH-FIX-RESEARCH-FINDINGS.md](UI-PATH-FIX-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [UI-PATH-FIX-PRD.md](UI-PATH-FIX-PRD.md) | ✅ |
| Design | [UI-PATH-FIX-DESIGN.md](UI-PATH-FIX-DESIGN.md) | ✅ |
| Architecture | [UI-PATH-FIX-ARCHITECTURE.md](UI-PATH-FIX-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: Pipeline must populate `phase_number` (1-indexed integer) on every phase object in `state.json` — [PRD FR-1](UI-PATH-FIX-PRD.md#functional-requirements)
- **FR-3**: Pipeline must populate `task_number` (1-indexed integer) on every task object — [PRD FR-3](UI-PATH-FIX-PRD.md#functional-requirements)
- **FR-4 / FR-5**: UI must derive fallback values for `phase_number` and `task_number` when missing (from `id` parse or array index) — [PRD FR-4, FR-5](UI-PATH-FIX-PRD.md#functional-requirements)
- **FR-6**: UI path resolution must handle workspace-relative paths by stripping the redundant `{basePath}/{projectName}/` prefix — [PRD FR-6](UI-PATH-FIX-PRD.md#functional-requirements)
- **FR-7**: Project-relative paths must continue to resolve correctly (backward compat) — [PRD FR-7](UI-PATH-FIX-PRD.md#functional-requirements)
- **FR-8**: Pipeline must normalize document paths to project-relative format before storing — [PRD FR-8](UI-PATH-FIX-PRD.md#functional-requirements)
- **NFR-1**: All fixes must be additive — no existing `state.json` fields removed or renamed — [PRD NFR-1](UI-PATH-FIX-PRD.md#non-functional-requirements)
- **NFR-2**: Path resolution must never resolve outside the project directory — [PRD NFR-2](UI-PATH-FIX-PRD.md#non-functional-requirements)

## Key Technical Decisions (from Architecture)

- **Defense-in-depth**: Fix both the data producer (pipeline) and the data consumer (UI) so that existing state files with workspace-relative paths work without migration and new state files are written correctly — [Architecture: Technical Overview](UI-PATH-FIX-ARCHITECTURE.md#technical-overview)
- **Centralized path normalization**: Rather than modifying 8 individual mutation handlers, path normalization is applied centrally in `pipeline-engine.js` before mutation handlers execute — [Architecture: Contract 4](UI-PATH-FIX-ARCHITECTURE.md#contract-4-pipeline-mutation-handlers--path-normalization-application)
- **Idempotent prefix stripping**: Both the pipeline `normalizeDocPath` and the UI `resolveDocPath` prefix-stripping use `startsWith(prefix)` which is inherently idempotent — already-relative paths never match — [Architecture: Cross-Cutting Concerns](UI-PATH-FIX-ARCHITECTURE.md#cross-cutting-concerns)
- **No new modules**: All changes are within existing files (`mutations.js`, `pipeline-engine.js`, `normalizer.ts`, `path-resolver.ts`) following existing code patterns — [Architecture: File Structure](UI-PATH-FIX-ARCHITECTURE.md#file-structure)
- **Array.map index as fallback**: The normalizer's `normalizePhase`/`normalizeTask` gain an `index` parameter — `Array.prototype.map` natively provides this as the second argument, requiring only a signature change, not a call-site rewrite — [Architecture: Contract 5, Risk R5](UI-PATH-FIX-ARCHITECTURE.md#contract-5-ui-normalizer--phase-fallback-chain)

## Key Design Constraints (from Design)

- **Normalizer fallback priority chain**: `raw.field` → parse numeric suffix from `raw.id` → `index + 1` — three-tier fallback covers all known state file variants — [Design: Data Contract](UI-PATH-FIX-DESIGN.md#data-contract-normalizer-input--output)
- **Path prefix construction**: Prefix is `basePath + '/' + projectName + '/'` using the configured `basePath` from `orchestration.yml`, never hardcoded — [Design: Path Resolution](UI-PATH-FIX-DESIGN.md#data-contract-path-resolution)
- **No UI component changes**: All presentation components (`PhaseCard`, `TaskCard`, `DocumentLink`, `DocumentDrawer`) are unchanged — fixes are entirely in the data transformation layer — [Design: Layout & Components](UI-PATH-FIX-DESIGN.md#layout--components)
- **Null/empty passthrough**: `normalizeDocPath` passes through `null`/`undefined`/empty string without throwing; ID parsing catches `NaN` and falls through — [Design: Pipeline Path Normalization](UI-PATH-FIX-DESIGN.md#data-contract-pipeline-mutations)

## Phase Outline

### Phase 1: Pipeline & UI Bugfix

**Goal**: Fix both confirmed bugs (missing metadata and path format mismatch) across the pipeline and UI layers with defense-in-depth.

**Scope**:
- Populate `phase_number`, `title`, `total_tasks` in `handlePlanApproved` mutation — refs: [FR-1](UI-PATH-FIX-PRD.md#functional-requirements), [Contract 1](UI-PATH-FIX-ARCHITECTURE.md#contract-1-pipeline--statejson-phase-object)
- Populate `task_number`, `last_error`, `severity` in `handlePhasePlanCreated` mutation — refs: [FR-3](UI-PATH-FIX-PRD.md#functional-requirements), [Contract 2](UI-PATH-FIX-ARCHITECTURE.md#contract-2-pipeline--statejson-task-object)
- Add `normalizeDocPath` helper and centralized `normalizeContextPaths` call in pipeline — refs: [FR-8](UI-PATH-FIX-PRD.md#functional-requirements), [Contract 3](UI-PATH-FIX-ARCHITECTURE.md#contract-3-pipeline-path-normalization-utility), [Contract 4](UI-PATH-FIX-ARCHITECTURE.md#contract-4-pipeline-mutation-handlers--path-normalization-application)
- Add index-based fallback chains in `normalizePhase` and `normalizeTask` — refs: [FR-4, FR-5](UI-PATH-FIX-PRD.md#functional-requirements), [Contract 5](UI-PATH-FIX-ARCHITECTURE.md#contract-5-ui-normalizer--phase-fallback-chain), [Contract 6](UI-PATH-FIX-ARCHITECTURE.md#contract-6-ui-normalizer--task-fallback-chain)
- Add workspace-relative prefix detection and stripping in `resolveDocPath` — refs: [FR-6, FR-7](UI-PATH-FIX-PRD.md#functional-requirements), [Contract 7](UI-PATH-FIX-ARCHITECTURE.md#contract-7-ui-path-resolver--prefix-stripping)

**Exit Criteria**:
- [ ] Pipeline-generated `state.json` includes `phase_number`, `title`, `total_tasks` on all phase objects
- [ ] Pipeline-generated `state.json` includes `task_number`, `last_error`, `severity` on all task objects
- [ ] All document paths in newly pipeline-generated `state.json` are project-relative format
- [ ] RAINBOW-HELLO phases display correct numbers and titles in the UI (existing workspace-relative paths handled by UI fallbacks)
- [ ] RAINBOW-HELLO document links resolve successfully (no 404s)
- [ ] PIPELINE-HOTFIX phases, tasks, and document links continue to render correctly (zero regressions)
- [ ] No TypeScript compilation errors in the UI project
- [ ] Existing `..` traversal protections in the document API route remain intact

**Phase Doc**: phases/UI-PATH-FIX-PHASE-01-PIPELINE-UI-BUGFIX.md *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Git strategy**: Single branch, `orch/` prefix, `[orch]` commit prefix, auto-commit enabled
- **Human gates**: After planning (master plan review), ask mode for execution, after final review

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Double path stripping if both pipeline and UI normalize the same path | Med | Both `normalizeDocPath` and `resolveDocPath` stripping are idempotent — `startsWith(prefix)` returns false for already-relative paths | Coder |
| `context.phases` not available in `handlePlanApproved` for phase titles | Low | Fallback `"Phase ${i + 1}"` provides a reasonable display name; UI normalizer already has `'Unnamed Phase'` fallback | Coder |
| Custom `base_path` in orchestration.yml differs from expected pattern | High | Both normalizeDocPath and resolveDocPath use the configured `basePath` dynamically, never hardcoded | Coder |
| Regression in existing manually-bootstrapped projects (PIPELINE-HOTFIX, VALIDATOR) | High | Normalizer fallbacks only activate when fields are missing; resolveDocPath prefix strip only activates on prefix match; explicit regression verification in exit criteria | Reviewer |
| `normalizePhase`/`normalizeTask` signature change breaks call sites | Med | Only one call site each in `normalizeState` — both are `.map()` calls where index is automatically provided as the second argument | Coder |
| Backslash path separators on Windows cause prefix mismatch | Med | Normalize slashes to forward slashes before prefix comparison in `resolveDocPath` | Coder |
| Context path normalization in `pipeline-engine.js` occurs before pre-read enrichment needs the original path | Med | Normalization must occur after pre-reads (which need workspace-relative paths to find files) but before mutation calls — architecture places it between the two stages | Coder |
