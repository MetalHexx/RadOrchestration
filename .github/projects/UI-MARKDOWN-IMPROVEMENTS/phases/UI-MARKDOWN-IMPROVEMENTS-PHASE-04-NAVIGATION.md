---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
title: "NAVIGATION"
status: "active"
total_tasks: 5
tasks:
  - id: "T01-TYPES-AND-ORDERING"
    title: "OrderedDoc Types and Document Ordering Utility"
  - id: "T02-FILES-API"
    title: "File Listing API and fs-reader Enhancement"
  - id: "T03-NAV-FOOTER"
    title: "DocumentNavFooter Component and Drawer Navigation"
  - id: "T04-DASHBOARD-SECTIONS"
    title: "ErrorLogSection Enhancement and OtherDocsSection"
  - id: "T05-INTEGRATION"
    title: "Home Page Wiring and Carry-Forward Fixes"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 4: NAVIGATION

## Phase Goal

Add Prev/Next document navigation within the document drawer, create a file listing API for error log detection and non-pipeline file discovery, surface error logs and "Other Docs" in the dashboard, and resolve carry-forward items from Phases 1–3.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-MARKDOWN-IMPROVEMENTS-MASTER-PLAN.md) | Phase 4 scope (Navigation, File API, Dashboard Enhancements), exit criteria, execution constraints (max 8 tasks/phase) |
| [Architecture](../UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md) | `document-ordering.ts` contract (`getOrderedDocs`, `getAdjacentDocs`), `FilesResponse`/`OrderedDoc` types, `DocumentNavFooter` props, `useDocumentDrawer` enhanced return type, `GET /api/projects/[name]/files` design, `listProjectFiles` contract, `ErrorLogSection` enhanced props, `OtherDocsSection` props, internal dependency graph, file structure |
| [Design](../UI-MARKDOWN-IMPROVEMENTS-DESIGN.md) | DocumentNavFooter layout/states (UF-2), ErrorLogSection enhancement (UF-6), OtherDocsSection layout (UF-7), accessibility requirements (keyboard nav, ARIA, disabled states), design tokens |
| [PRD](../UI-MARKDOWN-IMPROVEMENTS-PRD.md) | FR-9 (Prev/Next), FR-10 (error log), FR-11 (Other Docs), FR-12 (disabled boundaries), FR-13 (scroll reset on nav), FR-14 (state-derived ordering), FR-16 (file listing API), NFR-7 (keyboard accessibility), NFR-10 (path traversal protection) |
| [Research Findings](../UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md) | Document ordering canonical sequence from state.json, API gap analysis, `resolveProjectDir` security model, `PLANNING_STEP_ORDER` constant |
| [Phase 1 Review](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REVIEW-P01.md) | Carry-forward: mobile width specificity — `!w-full` needed when adding `DocumentNavFooter` to defeat base `data-[side=right]:w-3/4` |
| [Phase 2 Review](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REVIEW-P02.md) | Carry-forward: CopyButton error handling — add try/catch around `navigator.clipboard.writeText()` |
| [Phase 3 Review](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REVIEW-P03.md) | Carry-forward: remove redundant `updateTheme` call in `mermaid-block.tsx` after `initMermaid` |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | OrderedDoc Types and Document Ordering Utility | — | TypeScript, domain logic | 2 | *(created at execution time)* |
| T02 | File Listing API and fs-reader Enhancement | T01 | Node.js, Next.js API routes | 2 | *(created at execution time)* |
| T03 | DocumentNavFooter Component and Drawer Navigation | T01 | React, UI components, accessibility | 4 | *(created at execution time)* |
| T04 | ErrorLogSection Enhancement and OtherDocsSection | T01 | React, UI components | 3 | *(created at execution time)* |
| T05 | Home Page Wiring and Carry-Forward Fixes | T01, T02, T03, T04 | React, integration | 3 | *(created at execution time)* |

## Task Details

### T01 — OrderedDoc Types and Document Ordering Utility

**Objective**: Create the type definitions and document-ordering utility that all subsequent tasks depend on.

**File targets**:
- `ui/types/components.ts` — MODIFY: Add `OrderedDoc` and `FilesResponse` interfaces
- `ui/lib/document-ordering.ts` — CREATE: `getOrderedDocs(state, projectName, allFiles?)` and `getAdjacentDocs(docs, currentPath)` functions

**Key requirements**:
- `OrderedDoc` has `path`, `title`, and `category` fields per Architecture contract
- `getOrderedDocs` derives canonical navigation order from `NormalizedProjectState`: planning docs → per-phase (plan → tasks → report → review) → final review → error log → other docs
- Only non-null paths included in the sequence
- `getAdjacentDocs` returns `{ prev, next, currentIndex, total }`
- Error log detected by `{NAME}-ERROR-LOG.md` pattern in `allFiles`
- "Other docs" = files in `allFiles` that don't match any known pipeline doc path

**Acceptance criteria**:
- Types compile without errors
- `getOrderedDocs` with a multi-phase state returns docs in canonical order
- `getAdjacentDocs` returns correct prev/next at boundaries (first → prev null, last → next null)

---

### T02 — File Listing API and fs-reader Enhancement

**Objective**: Add server-side file enumeration and expose it via a new API endpoint for error log detection and "Other Docs" discovery.

**File targets**:
- `ui/lib/fs-reader.ts` — MODIFY: Add `listProjectFiles(projectDir)` that recursively lists all `.md` files
- `ui/app/api/projects/[name]/files/route.ts` — CREATE: `GET` handler returning `FilesResponse`

**Key requirements**:
- `listProjectFiles` recursively walks `projectDir`, collects `.md` files, returns paths relative to project dir
- No symlink following, no `..` traversal — stays within project directory
- API route resolves project dir via existing `resolveProjectDir()` security model
- Returns `{ files: string[] }` — flat list of relative paths
- 404 if project not found, 500 on filesystem errors
- NFR-10: path traversal protection (no user-supplied path joins)

**Acceptance criteria**:
- `listProjectFiles` returns files from root and subdirectories (`phases/`, `tasks/`, `reports/`)
- API returns 200 with correct file list for an existing project
- API returns 404 for a non-existent project
- No path traversal vulnerability — only files within the project directory are accessible

---

### T03 — DocumentNavFooter Component and Drawer Navigation

**Objective**: Create the Prev/Next navigation footer and enhance the document drawer to support in-place document navigation.

**File targets**:
- `ui/components/documents/document-nav-footer.tsx` — CREATE: Prev/Next footer bar component
- `ui/hooks/use-document-drawer.ts` — MODIFY: Add `navigateTo(path)` method
- `ui/components/documents/document-drawer.tsx` — MODIFY: Wire `DocumentNavFooter` into layout, apply mobile width fix (`!w-full`)
- `ui/components/documents/index.ts` — MODIFY: Export `DocumentNavFooter`

**Key requirements**:
- `DocumentNavFooter` receives `docs: OrderedDoc[]`, `currentPath: string`, `onNavigate: (path: string) => void`
- Prev button disabled (not hidden) at first doc; Next disabled at last doc
- Disabled buttons use `aria-disabled="true"`, `opacity-50 cursor-not-allowed`
- Active buttons have `hover:bg-accent hover:text-accent-foreground` transition
- Adjacent doc titles truncated with ellipsis
- `navigateTo(path)` keeps drawer open, sets new `docPath`, triggers fetch, resets scroll position
- Footer sits below `ScrollArea` in fixed position: `border-t border-border px-6 py-3`
- **Carry-forward (P01)**: Add `!w-full` to mobile width class on `SheetContent` to defeat base specificity

**Acceptance criteria**:
- Prev/Next buttons render in a fixed footer within the document drawer
- Clicking Next/Prev loads the adjacent document without closing the drawer
- Scroll resets to top on navigation
- Prev disabled at first document; Next disabled at last document
- Keyboard accessible: focusable, Enter/Space activated
- `aria-label` includes adjacent document title
- Mobile width is full-width (not 75%)

---

### T04 — ErrorLogSection Enhancement and OtherDocsSection

**Objective**: Surface the error log document and non-pipeline files in the dashboard.

**File targets**:
- `ui/components/dashboard/error-log-section.tsx` — MODIFY: Add conditional "View Error Log" `DocumentLink` when error log exists
- `ui/components/dashboard/other-docs-section.tsx` — CREATE: Card listing non-pipeline markdown files
- `ui/components/dashboard/index.ts` — MODIFY: Export `OtherDocsSection`

**Key requirements**:
- `ErrorLogSection` gains `errorLogPath: string | null` and `onDocClick: (path: string) => void` props
- When `errorLogPath` is non-null, render a `DocumentLink` styled as `text-sm` with `--color-link` below the blockers list
- `OtherDocsSection` receives `files: string[]` and `onDocClick: (path: string) => void`
- Files listed alphabetically; each rendered as a `DocumentLink`
- Empty state: "No additional documents" in `text-muted-foreground`
- Section wrapped in `<nav aria-label="Other project documents">`

**Acceptance criteria**:
- Error log link appears when `errorLogPath` is provided; clicking opens the document viewer
- Error log link hidden when `errorLogPath` is null (no layout shift)
- OtherDocsSection renders files alphabetically with working links
- OtherDocsSection shows empty state when file list is empty
- Section is accessible (`nav` landmark with `aria-label`)

---

### T05 — Home Page Wiring and Carry-Forward Fixes

**Objective**: Wire file list fetching, document ordering, and all new components into the home page. Resolve carry-forward items from Phases 2 and 3.

**File targets**:
- `ui/app/page.tsx` — MODIFY: Fetch file list from Files API, compute ordered docs, pass props to `DocumentDrawer`, `ErrorLogSection`, `OtherDocsSection`
- `ui/components/documents/copy-button.tsx` — MODIFY: Add try/catch around `navigator.clipboard.writeText()` (carry-forward P02)
- `ui/components/documents/mermaid-block.tsx` — MODIFY: Remove redundant `updateTheme` call after `initMermaid` (carry-forward P03)

**Key requirements**:
- Fetch `GET /api/projects/{name}/files` alongside state fetch; store file list in component state
- Call `getOrderedDocs(state, projectName, fileList)` to derive doc navigation sequence
- Pass `docs` and `navigateTo` to `DocumentDrawer` (which passes to `DocumentNavFooter`)
- Derive `errorLogPath` from file list (match `{NAME}-ERROR-LOG.md`), pass to `ErrorLogSection`
- Derive "other docs" list by diffing file list against known pipeline doc paths, pass to `OtherDocsSection`
- **Carry-forward (P02)**: Wrap `navigator.clipboard.writeText(text)` in try/catch in `CopyButton`
- **Carry-forward (P03)**: Remove the `await updateTheme(theme)` call in `MermaidBlock` that follows `initMermaid(theme)`

**Acceptance criteria**:
- File list fetched and available for error log detection and Other Docs
- Ordered docs computed and passed to drawer; Prev/Next navigation traverses full sequence
- Error log path correctly detected and passed to `ErrorLogSection`
- Other docs correctly identified and passed to `OtherDocsSection`
- CopyButton handles clipboard API failures gracefully (no unhandled rejection)
- MermaidBlock no longer calls redundant `updateTheme` after `initMermaid`
- Build passes with zero errors

## Execution Order

```
T01 (foundation — types + ordering utility)
 ├→ T02 (depends on T01 — backend)
 ├→ T03 (depends on T01 — navigation UI)
 └→ T04 (depends on T01 — dashboard sections)
T05 (depends on T01, T02, T03, T04 — integration + polish)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T02, T03, and T04 are parallel-ready (no mutual dependencies) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] Prev/Next buttons appear in a fixed footer within the document drawer
- [ ] Navigation traverses all project documents in canonical order: planning → per-phase/per-task → final review → error log → other docs
- [ ] Only documents with non-null paths appear in the navigation sequence
- [ ] Prev button disabled at first document; Next button disabled at last document
- [ ] Navigating via Prev/Next resets scroll position to top
- [ ] File listing API returns all `.md` files in the project directory with path traversal protection
- [ ] Error log link appears in `ErrorLogSection` when `{NAME}-ERROR-LOG.md` exists; clicking opens it in the viewer
- [ ] "Other Docs" section lists non-pipeline `.md` files alphabetically; each opens in the viewer
- [ ] Keyboard navigation works for Prev/Next buttons (focusable, Enter/Space activated, `aria-disabled` on boundaries)
- [ ] Mobile width is full-width (carry-forward from Phase 1)
- [ ] CopyButton error handling resolved (carry-forward from Phase 2)
- [ ] Redundant `updateTheme` call removed (carry-forward from Phase 3)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes (`npm run build` with zero errors)

## Known Risks for This Phase

- **Document ordering brittleness (R-7)**: The ordering utility depends on `NormalizedProjectState` shape. Mitigated by deriving from typed state at render time via a single utility function — type changes caught at compile time.
- **"Other Docs" surfacing temporary files (R-8)**: Any committed `.md` file is surfaced. Acceptable per brainstorming decision — filter is `.md` extension only.
- **Most scope of any phase**: 5 tasks spanning types, API, UI components, and integration. Risk of integration issues in T05. Mitigated by T01 establishing a clean contract layer consumed by all subsequent tasks.
- **Props drilling complexity**: New props (`docs`, `navigateTo`, `errorLogPath`, `files`) must flow from `page.tsx` through `MainDashboard` to section components. May require intermediate component prop changes. T05 handles this wiring holistically.
