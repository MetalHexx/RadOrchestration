---
project: "UI-PATH-FIX"
status: "draft"
author: "architect-agent"
created: "2026-03-14T12:00:00Z"
---

# UI-PATH-FIX — Architecture

## Technical Overview

This is a targeted bugfix across two system layers: the Node.js pipeline mutation handlers (CommonJS) and the Next.js/TypeScript UI data-transformation layer. No new modules are created — the fix modifies 3 existing files (mutations.js, normalizer.ts, path-resolver.ts) to populate missing metadata fields at the pipeline side and add defensive fallbacks plus path-prefix stripping at the UI side. The defense-in-depth strategy fixes the data producer (pipeline) and hardens the data consumer (UI) so both old and new state files render correctly.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Presentation       │  PhaseCard, TaskCard, DocumentLink,       │
│                     │  DocumentDrawer, PlanningChecklist         │  UNCHANGED
├─────────────────────────────────────────────────────────────────┤
│  Application        │  normalizer.ts, path-resolver.ts,         │
│                     │  use-document-drawer.ts, document/route.ts │  MODIFIED (2 files)
├─────────────────────────────────────────────────────────────────┤
│  Domain             │  types/state.ts (RawPhase, RawTask,       │
│                     │  NormalizedPhase, NormalizedTask)          │  UNCHANGED
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure     │  mutations.js, pipeline-engine.js,        │
│                     │  fs-reader.ts, orchestration.yml           │  MODIFIED (1 file)
└─────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility | Change |
|--------|-------|------|---------------|--------|
| `mutations` | Infrastructure | `.github/orchestration/scripts/lib/mutations.js` | Applies state transitions for pipeline events | **Modified** — populate missing metadata fields, add path normalization helper |
| `normalizer` | Application | `ui/lib/normalizer.ts` | Transforms raw state into normalized form for UI components | **Modified** — add index-based fallbacks for `phase_number`, `task_number`, `total_tasks` |
| `path-resolver` | Application | `ui/lib/path-resolver.ts` | Resolves document paths from state to absolute filesystem paths | **Modified** — detect and strip workspace-relative prefix |
| `pipeline-engine` | Infrastructure | `.github/orchestration/scripts/lib/pipeline-engine.js` | Orchestrates event → mutation → validate → write | Unchanged — context enrichment for `plan_approved` already exists |
| `state types` | Domain | `ui/types/state.ts` | Defines `RawPhase`, `RawTask`, `NormalizedPhase`, `NormalizedTask` | Unchanged — types already allow missing fields via `?` |
| `document route` | Application | `ui/app/api/projects/[name]/document/route.ts` | API route serving document content | Unchanged — delegates to `resolveDocPath` |
| `document-link` | Presentation | `ui/components/documents/document-link.tsx` | Renders clickable document links | Unchanged |
| `phase-card` | Presentation | `ui/components/execution/phase-card.tsx` | Renders phase header with number and title | Unchanged |
| `task-card` | Presentation | `ui/components/execution/task-card.tsx` | Renders task row with number and title | Unchanged |

## Contracts & Interfaces

### Contract 1: Pipeline → state.json Phase Object

The `handlePlanApproved` mutation must produce phase objects conforming to this shape:

```javascript
// .github/orchestration/scripts/lib/mutations.js — handlePlanApproved
// Each phase object pushed to state.execution.phases:
{
  phase_number: i + 1,                                    // NEW — 1-indexed integer
  title: context.phases?.[i]?.title ?? `Phase ${i + 1}`,  // NEW — from master plan or fallback
  status: 'not_started',
  total_tasks: 0,                                          // NEW — initialized to 0
  tasks: [],
  current_task: 0,
  phase_doc: null,
  phase_report: null,
  phase_review: null,
  phase_review_verdict: null,
  phase_review_action: null,
  triage_attempts: 0,
  human_approved: false
}
```

### Contract 2: Pipeline → state.json Task Object

The `handlePhasePlanCreated` mutation must produce task objects conforming to this shape:

```javascript
// .github/orchestration/scripts/lib/mutations.js — handlePhasePlanCreated
// Each task object in phase.tasks:
{
  id: t.id,
  title: t.title,
  task_number: t.task_number ?? idx + 1,  // NEW — from context or 1-indexed position
  status: 'not_started',
  retries: 0,
  last_error: null,                        // NEW — explicit initialization
  severity: null,                          // NEW — explicit initialization
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null
}
```

### Contract 3: Pipeline Path Normalization Utility

A new local helper function in `mutations.js` to normalize document paths before storing:

```javascript
// .github/orchestration/scripts/lib/mutations.js — new helper
/**
 * Strip workspace-relative prefix from a document path, returning project-relative.
 * Idempotent: already project-relative paths pass through unchanged.
 *
 * @param {string|null} docPath - Document path from context
 * @param {string} basePath - From orchestration.yml projects.base_path (e.g., ".github/projects")
 * @param {string} projectName - Project name (e.g., "RAINBOW-HELLO")
 * @returns {string|null} Project-relative path or null
 */
function normalizeDocPath(docPath, basePath, projectName) {
  // signature only — no implementation body per architecture rules
}
```

Behavior contract:

| Input `docPath` | `basePath` | `projectName` | Output |
|-----------------|-----------|---------------|--------|
| `.github/projects/PROJ/tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `.github/projects/PROJ/PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `null` | any | any | `null` |
| `''` | any | any | `''` |

Prefix construction: `basePath + '/' + projectName + '/'` — uses forward slashes to match state.json path format. Comparison uses `startsWith`.

### Contract 4: Pipeline Mutation Handlers — Path Normalization Application

All mutation handlers that store document paths must call `normalizeDocPath` before writing to state. The `basePath` and `projectName` values are derived from state:

```javascript
// basePath is available from the config loaded in pipeline-engine.js
// projectName is available from state.project.name
```

Affected handlers and the fields they write:

| Handler | Event | Field Written | Context Source |
|---------|-------|--------------|---------------|
| `completePlanningStep` | `research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed` | `planning.steps[key].output` | `context.doc_path` |
| `handlePhasePlanCreated` | `phase_plan_created` | `phase.phase_doc` | `context.plan_path` |
| `handleTaskHandoffCreated` | `task_handoff_created` | `task.handoff_doc` | `context.handoff_path` |
| `handleTaskCompleted` | `task_completed` | `task.report_doc` | `context.report_path` |
| `handleCodeReviewCompleted` | `code_review_completed` | `task.review_doc` | `context.review_path` |
| `handlePhaseReportCreated` | `phase_report_created` | `phase.phase_report` | `context.report_path` |
| `handlePhaseReviewCompleted` | `phase_review_completed` | `phase.phase_review` | `context.review_path` |
| `handleFinalReviewCompleted` | `final_review_completed` | `final_review.report_doc` | `context.review_path` |

**Architecture decision**: Rather than modifying each handler individually, path normalization is applied centrally in `pipeline-engine.js`'s `executePipeline` function by normalizing all `context.*_path` / `context.doc_path` values before the mutation handler is called. This avoids touching 8 handler functions and centralizes the concern.

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js — before mutation call
// Normalize all path-valued context fields
function normalizeContextPaths(context, basePath, projectName) {
  // signature only
}
```

Fields to normalize in context:

| Context Key | Used By |
|-------------|---------|
| `context.doc_path` | `completePlanningStep` |
| `context.plan_path` | `handlePhasePlanCreated` |
| `context.handoff_path` | `handleTaskHandoffCreated` |
| `context.report_path` | `handleTaskCompleted`, `handlePhaseReportCreated` |
| `context.review_path` | `handleCodeReviewCompleted`, `handlePhaseReviewCompleted`, `handleFinalReviewCompleted` |

### Contract 5: UI Normalizer — Phase Fallback Chain

```typescript
// ui/lib/normalizer.ts — normalizePhase updated signature
export function normalizePhase(raw: RawPhase, index: number): NormalizedPhase;
```

Field derivation:

| Field | Priority 1 | Priority 2 (new) | Priority 3 (new) |
|-------|-----------|-------------------|-------------------|
| `phase_number` | `raw.phase_number` | Parse numeric suffix from `raw.id` (e.g., `"P01"` → `1`) | `index + 1` |
| `title` | `raw.title` | `raw.name` | `'Unnamed Phase'` |
| `total_tasks` | `raw.total_tasks` | `raw.tasks?.length` | `0` |

ID parsing logic: strip leading non-digit characters, parse remaining string as base-10 integer. If result is `NaN`, fall through to index-based fallback.

### Contract 6: UI Normalizer — Task Fallback Chain

```typescript
// ui/lib/normalizer.ts — normalizeTask updated signature
export function normalizeTask(raw: RawTask, index: number): NormalizedTask;
```

| Field | Priority 1 | Priority 2 (new) | Priority 3 (new) |
|-------|-----------|-------------------|-------------------|
| `task_number` | `raw.task_number` | Parse numeric suffix from `raw.id` (e.g., `"T01"` → `1`) | `index + 1` |
| `title` | `raw.title` | `raw.name` | `'Unnamed Task'` |

### Contract 7: UI Path Resolver — Prefix Stripping

```typescript
// ui/lib/path-resolver.ts — resolveDocPath updated signature (same params)
export function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string;
```

Updated behavior contract:

```
1. Construct prefix = basePath + '/' + projectName + '/'
2. Normalize slashes in both prefix and relativePath (replace \ with /)
3. If relativePath starts with prefix: strip prefix
4. Proceed with path.resolve(workspaceRoot, basePath, projectName, strippedPath)
```

| Input `relativePath` | Prefix Match | Effective `relativePath` | Result |
|---------------------|-------------|-------------------------|--------|
| `tasks/FILE.md` | No | `tasks/FILE.md` | `{root}/.github/projects/PROJ/tasks/FILE.md` |
| `.github/projects/PROJ/tasks/FILE.md` | Yes → strip | `tasks/FILE.md` | `{root}/.github/projects/PROJ/tasks/FILE.md` |
| `PROJ-PRD.md` | No | `PROJ-PRD.md` | `{root}/.github/projects/PROJ/PROJ-PRD.md` |
| `.github/projects/PROJ/PROJ-PRD.md` | Yes → strip | `PROJ-PRD.md` | `{root}/.github/projects/PROJ/PROJ-PRD.md` |

**Security note**: The existing traversal check (`..` rejection and `absPath.startsWith(projectDir)` guard in the API route) remains intact and is unaffected by this change. The prefix-stripping occurs before `path.resolve`, so the traversal guard still validates the final absolute path.

## API Endpoints

No new API endpoints. The existing document API route is unchanged:

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | `/api/projects/[name]/document?path={docPath}` | Query param `path` (string) | `{ frontmatter, content, filePath }` or `{ error }` | None |

The fix is entirely within `resolveDocPath` which this route calls — the route itself needs no modification.

## Dependencies

### External Dependencies

No new external dependencies. All changes use built-in Node.js modules (`path`) and existing project dependencies.

| Package | Version | Purpose |
|---------|---------|---------|
| `path` (Node built-in) | N/A | Path resolution in both pipeline and UI |
| `next` | Existing | App Router API routes (unchanged) |

### Internal Dependencies (module → module)

```
pipeline-engine.js → mutations.js (calls normalizeDocPath + mutation handlers)
                   → resolver.js  (unchanged)
                   → state-validator.js (unchanged)

document/route.ts → path-resolver.ts (calls resolveDocPath — now with prefix stripping)
                  → fs-reader.ts (unchanged)
                  → markdown-parser.ts (unchanged)

normalizer.ts ← ui/app/api/projects/[name]/route.ts (imports normalizeState — unchanged call site)
              ← types/state.ts (reads RawPhase, RawTask — unchanged types)
```

No new dependency edges are introduced. All changes are within existing module boundaries.

## File Structure

```
.github/orchestration/scripts/lib/
├── mutations.js              # MODIFIED — add normalizeDocPath helper; populate phase_number,
│                             #   title, total_tasks in handlePlanApproved; populate task_number,
│                             #   last_error, severity in handlePhasePlanCreated
├── pipeline-engine.js        # MODIFIED — normalize context path fields before mutation call
├── resolver.js               # Unchanged
├── state-validator.js        # Unchanged
├── constants.js              # Unchanged
└── triage-engine.js          # Unchanged

ui/lib/
├── normalizer.ts             # MODIFIED — add index param to normalizePhase/normalizeTask;
│                             #   add fallback chains for phase_number, task_number, total_tasks
├── path-resolver.ts          # MODIFIED — add workspace-relative prefix detection & stripping
│                             #   in resolveDocPath
├── fs-reader.ts              # Unchanged
├── markdown-parser.ts        # Unchanged
├── config-transformer.ts     # Unchanged
├── utils.ts                  # Unchanged
└── yaml-parser.ts            # Unchanged

ui/types/
└── state.ts                  # Unchanged — RawPhase/RawTask already typed with optional fields
```

Total files modified: **4** (mutations.js, pipeline-engine.js, normalizer.ts, path-resolver.ts)

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Backward compatibility** | UI normalizer fallback chains handle missing fields gracefully — existing state files with `phase_number`/`task_number` already set are used as-is (priority 1 in the fallback). Path resolver's `startsWith` check is a no-op for already-project-relative paths. No state migration needed. |
| **Idempotency** | Both `normalizeDocPath` (pipeline) and `resolveDocPath` prefix stripping (UI) are idempotent: stripping an already-relative path is a no-op because it won't match the prefix pattern. Applying both fixes simultaneously cannot cause double-stripping. |
| **Error handling** | `normalizeDocPath` passes through `null`/`undefined`/empty string without throwing. Normalizer ID-parsing fallback catches `NaN` and falls through to index. No new exceptions introduced. |
| **Security** | Existing traversal protections (`..` rejection, `absPath.startsWith(projectDir)` guard) in the document API route are preserved and continue to validate the final resolved path after prefix stripping. `normalizeDocPath` only strips a known-safe prefix — it cannot produce paths that escape the project directory. |
| **State management** | Only `mutations.js` (via `pipeline-engine.js`) writes to `state.json`. This architecture does not change the sole-writer pattern. The UI normalizer is read-only. The state validator is unchanged. |
| **Testing** | No automated test infrastructure exists for integration testing. Verification is manual: inspect pipeline-generated `state.json` for correct field values, and load document links in the UI for both RAINBOW-HELLO (pipeline-generated, workspace-relative paths) and PIPELINE-HOTFIX (manually bootstrapped, project-relative paths). |

## Phasing Recommendations

**Recommended: Single phase** with 3-4 tasks.

Rationale: The changes are tightly coupled — the pipeline metadata fix and path normalization fix both affect the same data flow (state.json → UI), and the UI-side fixes (normalizer fallbacks + path resolver) are defensive companions to the pipeline fixes. Splitting into two phases would require re-verifying backward compatibility after each phase, adding overhead with no isolation benefit.

### Suggested Task Breakdown

1. **Task 1 — Pipeline metadata fix**: Modify `handlePlanApproved` to populate `phase_number`, `title`, `total_tasks`. Modify `handlePhasePlanCreated` to populate `task_number`, `last_error`, `severity`.

2. **Task 2 — Pipeline path normalization**: Add `normalizeDocPath` helper to `mutations.js`. Add `normalizeContextPaths` call in `pipeline-engine.js` before mutation handlers execute. This normalizes all `context.*_path` fields to project-relative format.

3. **Task 3 — UI normalizer fallbacks**: Add `index` parameter to `normalizePhase` and `normalizeTask`. Implement fallback chains for `phase_number` (raw → id parse → index+1), `task_number` (raw → id parse → index+1), and `total_tasks` (raw → tasks.length → 0). Update the `normalizeState` call site to pass the index through `.map()`.

4. **Task 4 — UI path resolver fix**: Modify `resolveDocPath` to detect workspace-relative prefix (`basePath/projectName/`) and strip it before path resolution. Normalize backslashes to forward slashes before comparison.

### Task Dependencies

```
Task 1 ─┐
         ├─ (independent, can be parallel)
Task 2 ─┘
Task 3 ─┐
         ├─ (independent, can be parallel)
Task 4 ─┘
```

All four tasks are independent and can execute in any order. The pipeline fixes (Tasks 1-2) and UI fixes (Tasks 3-4) are complementary — together they achieve defense-in-depth, but each provides value alone.

### Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Double path stripping if both pipeline and UI normalize | Low | Med — would break links for new projects | Both `normalizeDocPath` and `resolveDocPath` stripping are idempotent by construction — stripping an already-relative path is a no-op because `startsWith(prefix)` returns false |
| R2 | `context.phases` not available in `handlePlanApproved` for phase titles | Med | Low — cosmetic fallback `"Phase N"` | Fallback `Phase ${i + 1}` provides a reasonable display name; Orchestrator can enrichen later |
| R3 | Custom `base_path` in orchestration.yml differs from hardcoded `.github/projects` | Low | High — prefix detection fails | Both normalizeDocPath and resolveDocPath use the configured `basePath` dynamically, never hardcoded |
| R4 | Regression in existing manually-bootstrapped projects | Low | High — breaks working dashboard | Normalizer fallbacks only activate when fields are missing; resolveDocPath prefix strip only activates when prefix matches; existing project-relative paths pass through unchanged |
| R5 | `normalizePhase`/`normalizeTask` signature change breaks call sites | Low | Med — TypeScript error | Only one call site each (in `normalizeState`), both are `.map()` calls where the index is the second argument automatically provided by `Array.prototype.map` |
| R6 | Backslash path separators on Windows cause prefix mismatch | Low | Med — UI 404s persist on Windows dev environments | Normalize slashes to forward slashes before prefix comparison in `resolveDocPath` |
| R7 | `pipeline-engine.js` context normalization occurs too late (after pre-read enrichment) | Med | Med — pre-read uses unnormalized path; mutation stores normalized | Context normalization must occur **after** pre-reads (which need the original workspace-relative path to find the file) but before mutation calls. Architecture places it between pre-read and mutation. |
