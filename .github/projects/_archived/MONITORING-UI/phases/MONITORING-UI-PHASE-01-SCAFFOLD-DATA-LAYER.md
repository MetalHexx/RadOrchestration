---
project: "MONITORING-UI"
phase: 1
title: "Project Scaffold + Data Layer"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-09T20:00:00Z"
---

# Phase 1: Project Scaffold + Data Layer

## Phase Goal

Deliver a working Next.js 14 application with all TypeScript type definitions, infrastructure and domain utility modules, four API routes serving real project data from the local filesystem, and a styled root layout with CSS custom properties — the complete server-side foundation that all subsequent phases build on.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../MONITORING-UI-MASTER-PLAN.md) | Phase 1 scope, task outline, exit criteria, execution constraints, risk register |
| [Architecture](../MONITORING-UI-ARCHITECTURE.md) | Module map, file structure, contracts & interfaces, dependency list, API endpoints, cross-cutting concerns |
| [Design](../MONITORING-UI-DESIGN.md) | Design tokens (CSS custom properties), color system, dark mode strategy |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Next.js Project Init + Dependencies + shadcn/ui Setup | — | `scaffold`, `npm` | ~20 | *(created at execution time)* |
| T2 | TypeScript Type Definitions | T1 | `typescript` | 4 | *(created at execution time)* |
| T3 | Infrastructure Utilities | T1, T2 | `typescript`, `node` | 5 | *(created at execution time)* |
| T4 | Domain Utilities | T2, T3 | `typescript` | 3 | *(created at execution time)* |
| T5 | API Routes | T3, T4 | `nextjs`, `typescript` | 4 | *(created at execution time)* |
| T6 | Root Layout + Global Styles + Error Boundaries | T1 | `nextjs`, `css` | 5 | *(created at execution time)* |

## Task Details

### T1: Next.js Project Init + Dependencies + shadcn/ui Setup

**Objective**: Initialize the `/ui` directory with `create-next-app` (App Router, TypeScript, Tailwind CSS v4, ESLint), install all npm dependencies, and configure shadcn/ui with 12 base components.

**File Targets**:
- `ui/package.json` — CREATE
- `ui/tsconfig.json` — CREATE
- `ui/next.config.ts` — CREATE
- `ui/tailwind.config.ts` — CREATE
- `ui/postcss.config.mjs` — CREATE
- `ui/components.json` — CREATE
- `ui/.env.local` — CREATE (`WORKSPACE_ROOT` env var)
- `ui/.gitignore` — CREATE
- `ui/components/ui/*.tsx` — CREATE (12 shadcn components: Badge, Card, Sheet, ScrollArea, Sidebar, Accordion, Input, Tooltip, Skeleton, ToggleGroup, Separator, Alert)

**Acceptance Criteria**:
- [ ] `cd ui && npm install` completes without errors
- [ ] `cd ui && npx tsc --noEmit` passes (no type errors in scaffolded project)
- [ ] `components.json` configured with correct paths and Tailwind CSS v4 settings
- [ ] All 12 shadcn/ui components exist in `ui/components/ui/`
- [ ] `.env.local` contains `WORKSPACE_ROOT` pointing to workspace root
- [ ] `tailwind.config.ts` has `darkMode: 'class'` strategy

**Dependencies**: None (foundation task)

---

### T2: TypeScript Type Definitions

**Objective**: Create all four type definition files that define the domain model consumed by every other module — raw and normalized state types, config types, SSE event types, and UI component prop types.

**File Targets**:
- `ui/types/state.ts` — CREATE
- `ui/types/config.ts` — CREATE
- `ui/types/events.ts` — CREATE
- `ui/types/components.ts` — CREATE

**Acceptance Criteria**:
- [ ] `ui/types/state.ts` exports all enum union types (`PipelineTier`, `PlanningStatus`, `PlanningStepStatus`, `PhaseStatus`, `TaskStatus`, `ReviewVerdict`, `TaskReviewAction`, `PhaseReviewAction`, `Severity`, `HumanGateMode`, `FinalReviewStatus`), `PLANNING_STEP_ORDER`, `RawStateJson`, `RawPhase`, `RawTask`, and all normalized interfaces (`NormalizedProjectState`, `NormalizedProjectMeta`, `NormalizedPlanning`, `NormalizedExecution`, `NormalizedPhase`, `NormalizedTask`, `NormalizedFinalReview`, `NormalizedErrors`, `NormalizedLimits`)
- [ ] `ui/types/config.ts` exports `OrchestrationConfig` and `ParsedConfig` interfaces
- [ ] `ui/types/events.ts` exports `SSEEventType`, `SSEEvent`, `SSEPayloadMap` interfaces
- [ ] `ui/types/components.ts` exports `ProjectSummary`, `GateEntry`, `DocumentFrontmatter`, `DocumentResponse` interfaces
- [ ] `npx tsc --noEmit` passes with zero errors

**Dependencies**: T1 (project must exist with tsconfig.json)

---

### T3: Infrastructure Utilities

**Objective**: Implement the four infrastructure modules that handle all filesystem interaction, path resolution, YAML parsing, and markdown frontmatter extraction. Also create the `cn()` utility helper.

**File Targets**:
- `ui/lib/path-resolver.ts` — CREATE
- `ui/lib/yaml-parser.ts` — CREATE
- `ui/lib/fs-reader.ts` — CREATE
- `ui/lib/markdown-parser.ts` — CREATE
- `ui/lib/utils.ts` — CREATE

**Acceptance Criteria**:
- [ ] `path-resolver.ts` exports `getWorkspaceRoot()`, `resolveBasePath()`, `resolveProjectDir()`, `resolveDocPath()` — throws on missing `WORKSPACE_ROOT`
- [ ] `yaml-parser.ts` exports `parseYaml<T>()` using the `yaml` npm package
- [ ] `fs-reader.ts` exports `readConfig()`, `discoverProjects()`, `readProjectState()`, `readDocument()`, `fileExists()` — all read-only operations
- [ ] `markdown-parser.ts` exports `parseDocument()` returning `{ frontmatter, content }` using `gray-matter`
- [ ] `utils.ts` exports `cn()` utility (clsx + tailwind-merge)
- [ ] All modules import types from `@/types/*` (no inline type definitions)
- [ ] No write, unlink, or rename filesystem operations exist in any file
- [ ] `npx tsc --noEmit` passes

**Dependencies**: T1 (npm packages installed), T2 (type definitions)

---

### T4: Domain Utilities

**Objective**: Implement the state normalizer (v1/v2 field mapping with null defaults) and the config transformer (raw orchestration config to grouped display format).

**File Targets**:
- `ui/lib/normalizer.ts` — CREATE
- `ui/lib/config-transformer.ts` — CREATE

**Acceptance Criteria**:
- [ ] `normalizer.ts` exports `normalizeState()`, `normalizePhase()`, `normalizeTask()`, `detectSchemaVersion()`
- [ ] v1 field mappings: `phase.name → title`, `phase.plan_doc → phase_doc`, `task.name → title`
- [ ] Absent v2-only fields default to `null`: `description`, `brainstorming_doc`, `phase_review`, `phase_review_verdict`, `phase_review_action`, `review_doc`, `review_verdict`, `review_action`
- [ ] `config-transformer.ts` exports `transformConfig()` mapping `OrchestrationConfig` → `ParsedConfig`
- [ ] `after_planning` and `after_final_review` gates are marked `{ value: boolean, locked: true }`
- [ ] `npx tsc --noEmit` passes

**Dependencies**: T2 (type definitions), T3 (infrastructure — normalizer may use utility functions)

---

### T5: API Routes

**Objective**: Implement the four API route handlers that serve project data to the frontend — project list, single project state, document content, and orchestration config.

**File Targets**:
- `ui/app/api/projects/route.ts` — CREATE (`GET /api/projects`)
- `ui/app/api/projects/[name]/state/route.ts` — CREATE (`GET /api/projects/[name]/state`)
- `ui/app/api/projects/[name]/document/route.ts` — CREATE (`GET /api/projects/[name]/document`)
- `ui/app/api/config/route.ts` — CREATE (`GET /api/config`)

**Acceptance Criteria**:
- [ ] `GET /api/projects` returns `{ projects: ProjectSummary[] }` reflecting actual workspace projects
- [ ] `GET /api/projects/[name]/state` returns `{ state: NormalizedProjectState }` for valid projects, 404 for missing projects, 422 for malformed state
- [ ] `GET /api/projects/[name]/document?path=<relative>` returns `{ frontmatter, content }` for valid paths, 400 for missing `path` param, 404 for missing files
- [ ] `GET /api/config` returns `{ config: ParsedConfig }` with grouped orchestration.yml data
- [ ] All routes accept only GET requests
- [ ] Projects without `state.json` appear in project list with `hasState: false`
- [ ] `npm run build` succeeds with zero errors

**Dependencies**: T3 (infrastructure utilities), T4 (domain utilities — normalizer, config transformer)

---

### T6: Root Layout + Global Styles + Error Boundaries

**Objective**: Set up the Next.js root layout with font loading, the global CSS file with Tailwind directives and all CSS custom properties from the Design document, and the root-level loading/error boundary components.

**File Targets**:
- `ui/app/layout.tsx` — CREATE (root layout with `<html>` dark mode class, font, inline theme script)
- `ui/app/globals.css` — CREATE (Tailwind directives, CSS custom properties for all design tokens — tier colors, status colors, spacing, typography)
- `ui/app/loading.tsx` — CREATE (root loading skeleton)
- `ui/app/error.tsx` — CREATE (root error boundary with `'use client'`)
- `ui/app/page.tsx` — CREATE (placeholder root page)

**Acceptance Criteria**:
- [ ] `globals.css` contains Tailwind `@import` directives and CSS custom properties for all pipeline tier colors (blue/amber/purple/green/red/slate), status colors, spacing tokens, and typography tokens from the Design document
- [ ] `layout.tsx` sets `<html lang="en">` with dark mode class support and includes an inline `<script>` for flash-of-wrong-theme prevention
- [ ] `loading.tsx` renders a skeleton placeholder
- [ ] `error.tsx` is a client component with error boundary fallback UI
- [ ] `page.tsx` renders a minimal placeholder (will be replaced in Phase 2)
- [ ] `npm run build` succeeds

**Dependencies**: T1 (project setup with Tailwind and shadcn)

## Execution Order

```
T1 (foundation — project init, deps, shadcn/ui)
 ├→ T2 (type definitions)
 │   ├→ T3 (infrastructure utilities — needs types)
 │   │   ├→ T4 (domain utilities — needs types + infrastructure)
 │   │   │   └→ T5 (API routes — needs infrastructure + domain)
 │   │   └────────┘
 │   └──────────────┘
 └→ T6 (root layout + globals.css — needs project setup)  ← parallel-ready with T2
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T2 and T6 are parallel-ready (both depend only on T1, no mutual dependency) but will execute sequentially in v1. T6 is placed last because it has no downstream dependents, allowing the critical path (T1→T2→T3→T4→T5) to execute first.*

## Phase Exit Criteria

- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `GET /api/projects` returns a JSON array reflecting actual workspace projects
- [ ] `GET /api/projects/VALIDATOR/state` returns a normalized state object for an existing project (substitute any real project name)
- [ ] `GET /api/projects/VALIDATOR/document?path=VALIDATOR-PRD.md` returns frontmatter + markdown body
- [ ] `GET /api/config` returns the parsed `orchestration.yml` in grouped format
- [ ] v1 and v2 `state.json` files are normalized identically (field mapping logic correct)
- [ ] Projects without `state.json` appear in the project list with `hasState: false`
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes
- [ ] All tests pass (if any unit tests are created)

## Known Risks for This Phase

- **Incorrect v1/v2 normalization logic** misses edge cases for absent fields → mitigate with test cases against real workspace `state.json` files during T4
- **`WORKSPACE_ROOT` misconfiguration at startup** → mitigate with a clear error thrown in `path-resolver.ts` when the env var is missing (T3)
- **shadcn/ui Tailwind CSS v4 compatibility** — shadcn components are designed for Tailwind v3 conventions; v4 has breaking changes in configuration → mitigate by verifying component imports compile cleanly after shadcn setup in T1
- **Large file count in T1** (~20 generated files) — risk of incomplete setup → mitigate by using `create-next-app` and `npx shadcn` CLI tools rather than manual file creation
