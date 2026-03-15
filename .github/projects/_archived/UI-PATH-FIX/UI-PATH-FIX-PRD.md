---
project: "UI-PATH-FIX"
status: "draft"
author: "product-manager-agent"
created: "2026-03-14T12:00:00Z"
---

# UI-PATH-FIX — Product Requirements

## Problem Statement

The orchestration system's automated pipeline produces project state that the UI cannot correctly display. When projects are generated through the pipeline (as opposed to manually bootstrapped), two defects emerge: (1) phase and task objects in `state.json` are missing `phase_number`, `task_number`, and sometimes `title` metadata, causing the UI to render "Unnamed Phase" / "Unnamed Task" labels; and (2) document paths are stored in workspace-relative format while the UI expects project-relative format, causing every document link (handoffs, reports, plans, reviews) to return a 404 error. These bugs affect all pipeline-generated projects and undermine the core value of the orchestration dashboard.

## Goals

- **G-1**: All phases and tasks created by the pipeline display their correct title and number in the UI without manual state edits
- **G-2**: All document links in pipeline-generated projects resolve successfully and display the correct document content in the UI
- **G-3**: Existing projects (RAINBOW-HELLO, AMENDMENT, and all manually bootstrapped projects) continue to display correctly after the fixes — zero regressions
- **G-4**: The system handles both workspace-relative and project-relative path formats gracefully, so historical state files work without migration

## Non-Goals

- **NG-1**: Migrating or rewriting existing `state.json` files — historical state files must be handled as-is
- **NG-2**: Redesigning the state schema or introducing breaking changes to the `state.json` structure
- **NG-3**: Adding new UI features, dashboard enhancements, or visual changes beyond fixing the display of existing data
- **NG-4**: Fixing the state validator to enforce metadata field presence — that is a separate improvement
- **NG-5**: Changing the orchestration pipeline's event/mutation architecture

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Developer using the dashboard | see correct phase titles and numbers in the Execution Progress panel | I can identify which phase I'm looking at without inspecting raw state | P0 |
| 2 | Developer using the dashboard | see correct task titles and numbers within each phase | I can track individual task progress and status at a glance | P0 |
| 3 | Developer using the dashboard | click any document link (handoff, report, plan, review) and see its content | I can review pipeline-generated artifacts without leaving the dashboard | P0 |
| 4 | Developer with an existing project | continue using the dashboard after the fix is deployed | my existing projects are not broken by the changes | P0 |
| 5 | Developer running a new pipeline project | have the pipeline produce correctly formatted state from the start | I don't need to manually patch `state.json` after every pipeline run | P1 |
| 6 | Developer viewing planning documents | click planning step output links (research, PRD, design, architecture) and see their content | I can review planning artifacts alongside execution artifacts | P0 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | When the pipeline creates phase entries in `state.json`, each phase must include a populated `phase_number` field (1-indexed integer) | P0 | Currently missing from `handlePlanApproved` |
| FR-2 | When the pipeline creates phase entries in `state.json`, each phase must include a populated `title` field | P1 | Depends on master plan providing phase titles via context |
| FR-3 | When the pipeline creates task entries in `state.json`, each task must include a populated `task_number` field (1-indexed integer) | P0 | Currently missing from `handlePhasePlanCreated` |
| FR-4 | The UI must derive a sensible fallback for `phase_number` when it is missing from state (e.g., from array position) | P0 | Defensive handling for existing state files |
| FR-5 | The UI must derive a sensible fallback for `task_number` when it is missing from state (e.g., from array position) | P0 | Defensive handling for existing state files |
| FR-6 | The UI's document path resolution must correctly handle workspace-relative paths (e.g., `.github/projects/PROJ/tasks/FILE.md`) by stripping the redundant prefix before resolution | P0 | Core fix for 404 errors |
| FR-7 | The UI's document path resolution must continue to handle project-relative paths (e.g., `tasks/FILE.md`) correctly | P0 | Regression guard for manually created projects |
| FR-8 | The pipeline must normalize document paths to project-relative format before storing them in `state.json` | P1 | Prevents future incorrect paths; defense in depth |
| FR-9 | Document links in planning steps, phase cards, and task cards must all resolve correctly for both path formats | P0 | All link surfaces use the same resolution chain |
| FR-10 | The phase `total_tasks` field must be populated when tasks are added to a phase | P1 | Already partially implemented; confirm completeness |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Backward Compatibility | All fixes must be additive — no existing `state.json` field may be removed or renamed. Existing projects must render correctly without state file modifications. |
| NFR-2 | Correctness | Path resolution must never resolve to a path outside the project directory (existing traversal protections must be preserved). |
| NFR-3 | Reliability | The normalizer and path resolver must handle `null`, `undefined`, and empty string inputs without throwing exceptions. |
| NFR-4 | Testability | Each fix must be verifiable by inspecting pipeline-generated `state.json` output and by loading document links in the UI for both pipeline-generated and manually created projects. |
| NFR-5 | Maintainability | Fixes should follow existing code patterns (normalizer fallback chains, mutation handler field initialization) rather than introducing new patterns. |

## Assumptions

- The master plan's YAML frontmatter can provide phase titles (or they can be derived from phase plan context) for the pipeline to store
- The `basePath` and `projectName` values used by `resolveDocPath` are always correct and available at resolution time
- The workspace-relative path prefix always follows the pattern `{basePath}/{projectName}/` (e.g., `.github/projects/PROJ/`), making it reliably detectable
- Existing manually bootstrapped projects (VALIDATOR, MONITORING-UI, PIPELINE-FEEDBACK, PIPELINE-HOTFIX) already use project-relative paths and will not be affected
- The `task.id` field (e.g., `"T01"`) set by the Tactical Planner can serve as a fallback source for deriving `task_number` if it is not explicitly set

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Path prefix detection logic may not account for all edge cases (e.g., custom `base_path` in orchestration.yml) | Med | Use the configured `basePath` value for prefix detection rather than hardcoding `.github/projects/` |
| 2 | Phase titles may not be available in the context passed to `handlePlanApproved` if the master plan format varies | Low | Provide a fallback (e.g., `"Phase {N}"`) when title is unavailable; UI normalizer already has `'Unnamed Phase'` fallback |
| 3 | Fixing the pipeline path format could cause double-stripping if the UI also strips the prefix | Med | Ensure both fixes are idempotent — stripping an already project-relative path should be a no-op |
| 4 | Other agents or tools may read paths from `state.json` and depend on the current workspace-relative format | Low | Research found no consumers other than the UI; pipeline reads state but does not consume stored doc paths |
| 5 | Regression in existing project rendering after normalizer changes | High | Include explicit verification of RAINBOW-HELLO and at least one manually bootstrapped project (e.g., PIPELINE-HOTFIX) as acceptance criteria |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Phase/task display correctness | 100% of phases and tasks show correct titles and numbers in the UI | Manual inspection of RAINBOW-HELLO and any new pipeline-generated project |
| Document link resolution | 0 document link 404s for pipeline-generated projects | Click every document link type (handoff, report, plan, review) in RAINBOW-HELLO and verify content renders |
| Backward compatibility | 0 regressions in existing manually bootstrapped projects | Verify PIPELINE-HOTFIX and VALIDATOR document links and phase/task display remain correct |
| Path format in new state files | 100% of paths in newly pipeline-generated `state.json` are project-relative | Inspect `state.json` output after running a pipeline project end-to-end |
