---
project: "UI-PATH-FIX"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-14T12:00:00Z"
---

# UI-PATH-FIX — Design

## Design Overview

This is a data-contract design for a backend bugfix project — there are no new UI screens, layouts, or visual components to design. The design specifies the data transformation pipeline from `state.json` through the normalizer and path resolver to the UI components, ensuring phase/task metadata displays correctly and all document links resolve successfully. The interaction model is unchanged: users click document links in existing phase cards, task cards, and planning checklists; this design ensures those clicks produce content instead of 404 errors.

## User Flows

### Flow 1: Viewing Phase & Task Information

```
Dashboard loads → API returns state.json → normalizeState() transforms raw state →
  normalizePhase() derives phase_number from index if missing →
  normalizeTask() derives task_number from index if missing →
  PhaseCard renders "Phase {N}: {title}" → TaskCard renders "T{N}: {title}"
```

**Current broken behavior**: Pipeline-generated phases lack `phase_number`, causing `PhaseCard` to render "Phase undefined: {title}". Tasks lack `task_number`, causing `TaskCard` to render "Tundefined: {title}".

**Fixed behavior**: The normalizer derives `phase_number` from array position (index + 1) when the field is missing. Same for `task_number`. The `id` field (e.g., `"P01"`, `"T01"`) is used as a secondary fallback source by parsing the numeric suffix.

### Flow 2: Opening a Document Link (Execution Artifacts)

```
User clicks document link on TaskCard/PhaseCard →
  onDocClick(path) fires with path from normalized state →
  useDocumentDrawer.openDocument(path) sets docPath →
  Hook fetches GET /api/projects/{name}/document?path={docPath} →
  API route calls resolveDocPath(root, basePath, projectName, docPath) →
  resolveDocPath detects & strips workspace-relative prefix if present →
  Returns absolute filesystem path → fs reads file → 200 with content →
  DocumentDrawer renders parsed markdown
```

**Current broken behavior**: Pipeline stores workspace-relative paths (e.g., `.github/projects/PROJ/tasks/FILE.md`). `resolveDocPath` joins `root + basePath + projectName + path`, doubling the prefix → file not found → 404.

**Fixed behavior**: `resolveDocPath` detects if `relativePath` starts with the `{basePath}/{projectName}/` prefix and strips it before joining, making the function handle both formats idempotently.

### Flow 3: Opening a Document Link (Planning Artifacts)

```
User clicks document link in PlanningChecklist →
  onDocClick(step.output) fires with output path from state →
  (same resolution chain as Flow 2)
```

Same bug and same fix as Flow 2 — planning step `output` paths are also stored workspace-relative in pipeline-generated projects.

### Flow 4: Existing Project Backward Compatibility

```
Dashboard loads existing project (e.g., PIPELINE-HOTFIX) →
  state.json already has phase_number, task_number, project-relative paths →
  normalizePhase() sees phase_number present → uses it directly (no fallback) →
  resolveDocPath() sees project-relative path → no prefix to strip → joins normally →
  Everything renders as before — zero change in behavior
```

## Layout & Components

No new layouts or pages. All changes are to existing data transformation functions and their contracts with existing components.

### Affected Data Flow Surface

| Layer | Component / Module | Change Type | Notes |
|-------|-------------------|-------------|-------|
| Normalizer | `normalizePhase()` | Modified | Add `phase_number` fallback from index |
| Normalizer | `normalizeTask()` | Modified | Add `task_number` fallback from index |
| Path resolver | `resolveDocPath()` | Modified | Add workspace-relative prefix detection and stripping |
| Pipeline | `handlePlanApproved()` | Modified | Populate `phase_number`, `title`, `total_tasks` |
| Pipeline | `handlePhasePlanCreated()` | Modified | Populate `task_number` on task objects |
| Pipeline | mutation handlers (all path-storing) | Modified | Normalize paths to project-relative before storing |
| Types | `RawPhase` | Unchanged | `phase_number` already typed as `number` (will receive `undefined` gracefully) |
| Types | `RawTask` | Unchanged | `task_number` already typed as `number` (will receive `undefined` gracefully) |
| UI Component | `PhaseCard` | Unchanged | Already renders `phase.phase_number` and `phase.title` from normalized data |
| UI Component | `TaskCard` | Unchanged | Already renders `task.task_number` and `task.title` from normalized data |
| UI Component | `PlanningChecklist` | Unchanged | Already passes `step.output` to `onDocClick` |
| UI Component | `DocumentLink` | Unchanged | Already passes `path` to `onDocClick` |
| Hook | `useDocumentDrawer` | Unchanged | Already passes `docPath` to API |
| API Route | `document/route.ts` | Unchanged | Already calls `resolveDocPath` — fix is in that function |

### Data Contract: Normalizer Input → Output

#### `normalizePhase(raw: RawPhase, index: number)` — Updated Signature

The normalizer function gains an `index` parameter (the phase's position in the `phases` array) to enable positional fallback.

| Output Field | Derivation (priority order) | Current | After Fix |
|-------------|---------------------------|---------|-----------|
| `phase_number` | `raw.phase_number` → **(new)** parse from `raw.id` (e.g., `"P01"` → `1`) → **(new)** `index + 1` | `raw.phase_number` (undefined if missing) | Falls back to index-derived value |
| `title` | `raw.title` → `raw.name` → `'Unnamed Phase'` | Already correct | No change |
| `total_tasks` | `raw.total_tasks` → **(new)** `raw.tasks.length` | `raw.total_tasks` (undefined if missing) | Falls back to actual array length |

#### `normalizeTask(raw: RawTask, index: number)` — Updated Signature

| Output Field | Derivation (priority order) | Current | After Fix |
|-------------|---------------------------|---------|-----------|
| `task_number` | `raw.task_number` → **(new)** parse from `raw.id` (e.g., `"T01"` → `1`) → **(new)** `index + 1` | `raw.task_number` (undefined if missing) | Falls back to index-derived value |
| `title` | `raw.title` → `raw.name` → `'Unnamed Task'` | Already correct | No change |

#### ID Parsing Fallback Logic

The `raw.id` field (set by the Tactical Planner, e.g., `"P01"`, `"T03"`) can be parsed to extract a numeric suffix:
- Strip leading alpha characters, parse remaining digits as integer
- `"P01"` → `1`, `"T03"` → `3`, `"P10"` → `10`
- If parse fails (NaN or non-string `id`), fall through to index-based fallback

### Data Contract: Path Resolution

#### `resolveDocPath(workspaceRoot, basePath, projectName, relativePath)` — Updated Behavior

| Input `relativePath` | Detection | Action | Output |
|---------------------|-----------|--------|--------|
| `tasks/FILE.md` | Does NOT start with `{basePath}/{projectName}/` | No-op (pass through) | `path.resolve(root, basePath, projectName, 'tasks/FILE.md')` |
| `.github/projects/PROJ/tasks/FILE.md` | Starts with `{basePath}/{projectName}/` | Strip prefix | `path.resolve(root, basePath, projectName, 'tasks/FILE.md')` |
| `PROJ-PRD.md` | Does NOT start with prefix | No-op | `path.resolve(root, basePath, projectName, 'PROJ-PRD.md')` |
| `.github/projects/PROJ/PROJ-PRD.md` | Starts with prefix | Strip prefix | `path.resolve(root, basePath, projectName, 'PROJ-PRD.md')` |
| `null` | N/A | Not called | `DocumentLink` renders disabled state |
| `''` (empty string) | Does NOT start with prefix | No-op | Handled by existing ENOENT → 404 |

**Prefix construction**: `const prefix = basePath + '/' + projectName + '/'` — uses forward slashes to match the format stored in state.json. The `basePath` value comes from `orchestration.yml` (`projects.base_path`), which is always forward-slash-delimited (e.g., `.github/projects`).

**Idempotency requirement**: Stripping an already project-relative path must be a no-op. The prefix test (`relativePath.startsWith(prefix)`) naturally ensures this — project-relative paths like `tasks/FILE.md` will never start with `.github/projects/PROJ/`.

### Data Contract: Pipeline Mutations

#### `handlePlanApproved` — Phase Object Initialization

| Field | Current Value | After Fix |
|-------|--------------|-----------|
| `phase_number` | *(not set)* | `i + 1` (loop index + 1) |
| `title` | *(not set)* | `context.phases?.[i]?.title ?? 'Phase ' + (i + 1)` |
| `total_tasks` | *(not set)* | `0` |
| `status` | `'not_started'` | No change |
| `tasks` | `[]` | No change |
| `current_task` | `0` | No change |
| `phase_doc` to `triage_attempts` | *(existing values)* | No change |

#### `handlePhasePlanCreated` — Task Object Initialization

| Field | Current Value | After Fix |
|-------|--------------|-----------|
| `task_number` | *(not set)* | `t.task_number ?? idx + 1` |
| `last_error` | *(not set)* | `null` |
| `severity` | *(not set)* | `null` |
| `id` | `t.id` | No change |
| `title` | `t.title` | No change |
| `status` to `review_action` | *(existing values)* | No change |

#### Pipeline Path Normalization

All mutation handlers that store document paths (`completePlanningStep`, `handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, `handlePhaseReviewCompleted`) must normalize `context.*_path` values to project-relative format before storing.

**Normalization function** (new utility in mutations.js or pipeline-engine.js):

| Input | Output | Logic |
|-------|--------|-------|
| `.github/projects/PROJ/tasks/FILE.md` | `tasks/FILE.md` | Strip `{basePath}/{projectName}/` prefix |
| `tasks/FILE.md` | `tasks/FILE.md` | Already project-relative — no-op |
| `PROJ-PRD.md` | `PROJ-PRD.md` | Already project-relative — no-op |
| `null` | `null` | Pass through |

The normalization function requires `basePath` and `projectName` — both available from state (`state.project.name`) and config (loaded at pipeline startup).

## States & Interactions

### Document Link States (Existing — No Change)

| Component | State | Visual Treatment | Trigger |
|-----------|-------|-----------------|---------|
| `DocumentLink` | Available | Blue text link with file icon | `path` is non-null |
| `DocumentLink` | Unavailable | Muted text, `cursor-not-allowed`, "Not available" tooltip | `path` is null |
| `DocumentDrawer` | Loading | Loading spinner | `openDocument(path)` called |
| `DocumentDrawer` | Content loaded | Rendered markdown content | API returns 200 |
| `DocumentDrawer` | Error (404) | Error message: "Document not found" | API returns 404 |
| `DocumentDrawer` | Error (other) | Error message with details | API returns 500 |

### Phase/Task Display States (Existing Logic, Fixed Data)

| Component | State | Current (Broken) | After Fix |
|-----------|-------|-----------------|-----------|
| `PhaseCard` header | `phase_number` undefined | "Phase undefined: Core Setup" | "Phase 1: Core Setup" |
| `PhaseCard` aria-label | `phase_number` undefined | "Phase undefined: Core Setup" | "Phase 1: Core Setup" |
| `TaskCard` label | `task_number` undefined | "Tundefined: Scaffold Project" | "T1: Scaffold Project" |
| `TaskCard` aria-label | `task_number` undefined | "Task undefined: Scaffold..." | "Task 1: Scaffold..." |
| `ProgressBar` total | `total_tasks` undefined | Division by undefined → NaN | Shows correct fraction (e.g., "2/5") |

### Error / Edge Case States

| Scenario | Current Behavior | After Fix | Component Affected |
|----------|-----------------|-----------|-------------------|
| Phase missing `phase_number` AND `id` | Renders "Phase undefined" | Renders "Phase {index+1}" (positional) | `PhaseCard` via normalizer |
| Task missing `task_number` AND `id` | Renders "Tundefined" | Renders "T{index+1}" (positional) | `TaskCard` via normalizer |
| Document path is workspace-relative | 404 error, drawer shows error | Content loads successfully | `DocumentDrawer` via `resolveDocPath` |
| Document path is already project-relative | Content loads successfully | Content loads successfully (no change) | `DocumentDrawer` via `resolveDocPath` |
| Document path is null | Link disabled with tooltip | Link disabled with tooltip (no change) | `DocumentLink` |
| `basePath` in config uses backslashes | Prefix detection may fail | Normalize slashes before prefix comparison | `resolveDocPath` |
| Path contains only the project-relative filename (e.g., `PROJ-PRD.md`) | Resolves correctly | Resolves correctly (no change) | `resolveDocPath` |

## Accessibility

No accessibility changes required. All existing accessibility features are preserved:

| Requirement | Current Implementation | Impact of Fix |
|-------------|----------------------|---------------|
| Keyboard navigation | Tab order through phase cards → task cards → document links | No change — structure unchanged |
| Screen reader | `aria-label` on `PhaseCard` includes phase number and title | **Improved** — "Phase undefined" → "Phase 1" |
| Screen reader | `aria-label` on `TaskCard` includes task number, title, status | **Improved** — "Task undefined" → "Task 1" |
| Color contrast | All text meets WCAG AA (4.5:1 minimum) | No change |
| Focus indicators | Visible focus ring on all interactive elements including `DocumentLink` | No change |
| Document link disabled state | `aria-disabled="true"` and tooltip "Not available" | No change |
| Document drawer | Focus trap when open, Escape to close | No change |

## Responsive Behavior

No responsive behavior changes. All fixes are in the data transformation layer — no layout or component rendering changes.

## Design System Additions

No new design tokens, components, or visual additions required. All fixes operate below the component layer in the normalizer, path resolver, and pipeline mutation handlers.
