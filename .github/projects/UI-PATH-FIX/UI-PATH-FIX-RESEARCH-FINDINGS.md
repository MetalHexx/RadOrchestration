---
project: "UI-PATH-FIX"
author: "research-agent"
created: "2026-03-14T12:00:00Z"
---

# UI-PATH-FIX — Research Findings

## Research Scope

Investigation of two UI display bugs discovered during the PIPELINE-HOTFIX project: (1) phases/tasks showing as "Unnamed" due to missing metadata fields, and (2) document links returning 404 due to a path format mismatch between the pipeline and the UI. Research covered the pipeline mutation handlers, UI normalizer, path resolver, API routes, and all existing project `state.json` files.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Mutation handlers | `.github/orchestration/scripts/lib/mutations.js` | Handles `plan_approved`, `phase_plan_created`, `task_handoff_created` — where phase/task objects are initialized in `state.json` |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | Resolves next pipeline action; provides phase/task IDs but doesn't feed them into state |
| Pipeline engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Orchestrates events → mutations → state writes; `scaffoldInitialState()` bootstraps empty execution |
| State validator | `.github/orchestration/scripts/lib/state-validator.js` | Validates state transitions; does NOT check for `phase_number` or `task_number` presence |
| UI normalizer | `ui/lib/normalizer.ts` | Transforms `RawPhase`/`RawTask` → `NormalizedPhase`/`NormalizedTask`; expects `phase_number`, `task_number`, `title` |
| UI path resolver | `ui/lib/path-resolver.ts` | `resolveDocPath()` joins workspace root + base_path + project name + relative path |
| Document API route | `ui/app/api/projects/[name]/document/route.ts` | Calls `resolveDocPath()` to resolve absolute path; reads file; returns 404 on ENOENT |
| State types | `ui/types/state.ts` | Defines `RawPhase`, `RawTask` interfaces with expected fields |
| Document link | `ui/components/documents/document-link.tsx` | Passes `path` (from state) directly to `onDocClick` callback |
| Document drawer hook | `ui/hooks/use-document-drawer.ts` | Fetches `/api/projects/{name}/document?path={docPath}` with path from state |
| Planning checklist | `ui/components/planning/planning-checklist.tsx` | Passes `step.output` directly as document path |
| Task card | `ui/components/execution/task-card.tsx` | Passes `task.handoff_doc`, `task.report_doc`, `task.review_doc` as document paths |
| Phase card | `ui/components/execution/phase-card.tsx` | Passes `phase.phase_doc`, `phase.phase_report`, `phase.phase_review` as document paths |

### Issue 1: Missing `phase_number`, `title`, `task_number` on Phases/Tasks

#### Pipeline Analysis

**`handlePlanApproved`** (mutations.js lines ~100–120) creates phase objects with:

```js
{
  status: 'not_started',
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

**Missing fields**: `phase_number`, `title`, `total_tasks`

**`handlePhasePlanCreated`** (mutations.js lines ~139–170) creates task objects with:

```js
{
  id: t.id,
  title: t.title,
  status: 'not_started',
  retries: 0,
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null
}
```

**Missing fields**: `task_number`, `last_error`, `severity`

Note: `handlePhasePlanCreated` DOES set `phase.total_tasks = context.tasks.length`, but never sets `phase.phase_number` or `phase.title`.

#### UI Normalizer Analysis

`normalizePhase()` (normalizer.ts) maps:
- `phase_number: raw.phase_number` → passes through as `undefined` when missing (no fallback)
- `title: raw.title ?? raw.name ?? 'Unnamed Phase'` → falls back correctly
- `total_tasks: raw.total_tasks` → passes through as `undefined` when missing

`normalizeTask()` maps:
- `task_number: raw.task_number` → passes through as `undefined` (no fallback)
- `title: raw.title ?? raw.name ?? 'Unnamed Task'` → falls back correctly

#### State.json Evidence Across Projects

| Project | Phase has `phase_number`? | Phase has `title`? | Task has `task_number`? | Task has `title`? | Created by |
|---------|--------------------------|-------------------|------------------------|------------------|------------|
| VALIDATOR | ✅ Yes | ❌ (uses `name`) | ✅ Yes | ❌ (uses `name`) | Manual (v1 schema) |
| MONITORING-UI | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Manual (v2 schema) |
| PIPELINE-FEEDBACK | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Manual (v1 schema) |
| PIPELINE-HOTFIX | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Manual bootstrap |
| RAINBOW-HELLO | ❌ No (has `id`) | ✅ Yes | ❌ No (has `id`) | ✅ Yes | Pipeline-generated |
| AMENDMENT | N/A (no phases) | N/A | N/A | N/A | Pipeline (planning only) |

**Key finding**: RAINBOW-HELLO is the only project that was fully run through the automated pipeline. Its phases lack `phase_number` and its tasks lack `task_number`. They have `id` instead (e.g., `"P01"`, `"T01"`), set by the Tactical Planner via `context.tasks[].id`. Phase `title` exists because the Orchestrator/agent happened to include it in state — but the pipeline mutation handler never explicitly sets it.

#### Issue 1 Verdict: REAL BUG — Still present in pipeline code

The `handlePlanApproved` mutation does not set `phase_number` or `title` on phases. The `handlePhasePlanCreated` mutation does not set `task_number` on tasks. These fields are expected by the UI normalizer's `RawPhase` and `RawTask` interfaces. The `title` field happens to work due to the `??` fallback chain in the normalizer, but `phase_number` and `task_number` pass through as `undefined` with no fallback.

---

### Issue 2: Document Path Format Mismatch

#### Path Resolution Chain

1. **State stores path** → e.g., `task.handoff_doc`, `phase.phase_doc`, `planning.steps.research.output`
2. **UI component** passes path directly to `onDocClick(path)` → `openDocument(path)` → sets `docPath`
3. **Hook fetches** `/api/projects/{name}/document?path={docPath}`
4. **API route** calls `resolveDocPath(root, basePath, projectName, pathParam)`
5. **`resolveDocPath`** returns `path.resolve(workspaceRoot, basePath, projectName, relativePath)`

Expected: `relativePath` should be **project-relative** (e.g., `tasks/FOO.md`)

If workspace-relative (e.g., `.github/projects/PROJ/tasks/FOO.md`), the resolved path becomes:
```
{root}/.github/projects/PROJ/.github/projects/PROJ/tasks/FOO.md
                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                              DOUBLED — does not exist → ENOENT → 404
```

#### State.json Path Format Evidence

| Project | Planning doc paths | Execution doc paths | Format |
|---------|-------------------|-------------------|--------|
| VALIDATOR | `VALIDATOR-RESEARCH-FINDINGS.md` | `tasks/VALIDATOR-TASK-P01-T01-FS-HELPERS.md` | ✅ Project-relative |
| MONITORING-UI | `MONITORING-UI-RESEARCH-FINDINGS.md` | `tasks/MONITORING-UI-TASK-P01-T01-INIT.md` | ✅ Project-relative |
| PIPELINE-FEEDBACK | `PIPELINE-FEEDBACK-RESEARCH-FINDINGS.md` | `tasks/PIPELINE-FEEDBACK-TASK-P01-T01-STATE-SCHEMA.md` | ✅ Project-relative |
| PIPELINE-HOTFIX | `PIPELINE-HOTFIX-RESEARCH-FINDINGS.md` | `tasks/PIPELINE-HOTFIX-TASK-P01-T01.md` | ✅ Project-relative |
| RAINBOW-HELLO | `.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-RESEARCH-FINDINGS.md` | `.github/projects/RAINBOW-HELLO/tasks/RAINBOW-HELLO-TASK-P01-T01-SCAFFOLDING.md` | ❌ Workspace-relative |
| AMENDMENT | `.github/projects/AMENDMENT/AMENDMENT-RESEARCH-FINDINGS.md` | N/A (no execution) | ❌ Workspace-relative |

**Key finding**: The 4 projects with project-relative paths (VALIDATOR, MONITORING-UI, PIPELINE-FEEDBACK, PIPELINE-HOTFIX) were all manually created or bootstrapped. The 2 projects with workspace-relative paths (RAINBOW-HELLO, AMENDMENT) were run through the automated pipeline. This confirms the pipeline/Orchestrator naturally produces workspace-relative paths.

#### Where Paths Originate

The pipeline mutation handlers (`completePlanningStep`, `handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, `handlePhaseReviewCompleted`) all store `context.{x}_path` or `context.doc_path` verbatim — no normalization. The Orchestrator provides these context values based on what the spawned agent outputs.

The `resolveDocPath` function's JSDoc explicitly states: "Document paths in state.json are relative to the project folder" — but the pipeline doesn't enforce this constraint.

#### Issue 2 Verdict: REAL BUG — Pre-existing in all pipeline-generated projects

The pipeline stores document paths in whatever format the Orchestrator provides. The UI's `resolveDocPath()` only handles project-relative paths. All projects generated through the automated pipeline have broken document links. This affects both planning document links and execution document links.

---

### Existing Patterns

- **Normalizer fallback pattern**: The normalizer uses `raw.field ?? raw.v1_field ?? 'Default'` for safe mapping. This pattern is used for `title` but not for `phase_number` or `task_number`.
- **Path resolution pattern**: `resolveDocPath` does a simple `path.resolve(root, base, project, relative)` with no prefix detection or stripping.
- **State mutation pattern**: All mutation handlers store context values verbatim with no normalization or validation of path formats.
- **API route security pattern**: The document API route includes `..` traversal rejection and `absPath.startsWith(projectDir)` defense-in-depth check. The workspace-relative path bug passes this check because the doubled path does start with `projectDir`.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Pipeline scripts | Node.js / CommonJS | N/A | Pure functions, no framework |
| UI | Next.js + React | Next.js (App Router) | TypeScript, server-side API routes |
| UI Components | shadcn/ui + Tailwind | N/A | Component library |
| Path resolution | Node `path` module | Built-in | Used in both pipeline and UI |

## Constraints Discovered

- **Pipeline is the sole writer of `state.json`** — fixes to path format or field population must go through mutation handlers in `mutations.js` or through path normalization in `pipeline-engine.js`
- **State validator doesn't check field presence** — `state-validator.js` checks transition invariants but does not verify that `phase_number`, `task_number`, or `total_tasks` exist on phase/task objects
- **Orchestrator provides paths as context** — the Orchestrator agent is an LLM that provides whatever path format the spawned agent used; this is inherently inconsistent
- **Backward compatibility** — existing project `state.json` files (RAINBOW-HELLO) have workspace-relative paths that can't be bulk-migrated automatically; the UI must handle both formats
- **Planning and execution paths affected equally** — the path mismatch applies to `planning.steps[x].output` paths as well as phase/task document paths

## Recommendations

### Issue 1 Fixes (Phase/Task Metadata)

1. **Pipeline fix — `handlePlanApproved`**: Add `phase_number: i + 1` and `total_tasks: 0` to the phase initialization loop in `mutations.js`
2. **Pipeline fix — `handlePhasePlanCreated`**: Add `task_number` to task objects using either `t.task_number` from context (if provided) or derive from array index `(idx + 1)`; add `last_error: null` and `severity: null`
3. **Pipeline fix — phase title**: Either (a) accept phase titles from master plan frontmatter during `handlePlanApproved` via `context.phases[i].title`, or (b) set phase title during `handlePhasePlanCreated` from the phase plan's frontmatter via a new `context.phase_title` field
4. **UI defensive fix — normalizer**: Add fallback for `phase_number` (derive from array index + 1) and `task_number` (derive from array index + 1) in `normalizePhase` and `normalizeTask`

### Issue 2 Fixes (Path Format)

1. **UI defensive fix — `resolveDocPath`**: Detect if `relativePath` starts with the `basePath/projectName` prefix (the workspace-relative prefix) and strip it before joining. This makes `resolveDocPath` handle both formats.
2. **Pipeline normalization fix**: In `pipeline-engine.js`, normalize all `context.*_path` values to project-relative format before passing to mutation handlers. Strip the `{basePath}/{projectName}/` prefix if present.
3. **Both fixes recommended**: The UI fix provides backward compatibility with existing state files; the pipeline fix prevents new state files from storing incorrect formats.

### Priority

| Fix | Severity | Scope | Risk |
|-----|----------|-------|------|
| UI `resolveDocPath` prefix stripping | **High** | Affects ALL document links in pipeline-generated projects | Low — purely additive logic |
| Pipeline `handlePlanApproved` metadata | **Medium** | Affects phase display in UI (cosmetic but confusing) | Low — adds fields to initialization |
| Pipeline `handlePhasePlanCreated` task_number | **Medium** | Affects task display in UI | Low — adds field to initialization |
| UI normalizer fallbacks for phase_number/task_number | **Medium** | Defensive — handles existing state files | Low — already uses fallback pattern for title |
| Pipeline path normalization | **Low** | Prevents future incorrect paths | Medium — need to identify correct prefix stripping logic |
