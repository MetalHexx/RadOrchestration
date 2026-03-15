---
project: "MONITORING-UI"
phase: 3
task: 5
title: "Document Viewer Hook + Dashboard Wiring"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 8
---

# Document Viewer Hook + Dashboard Wiring

## Objective

Create the `useDocumentDrawer` hook to manage drawer state and document fetching with `AbortController` cleanup, render `DocumentDrawer` at the root page level, and wire every document link throughout the dashboard so clicking any document reference opens the drawer with rendered content.

## Context

The document viewer components were created in the previous task: `DocumentDrawer`, `DocumentMetadata`, `MarkdownRenderer`, and `DocumentLink` — all exported from `ui/components/documents/index.ts`. Currently, `page.tsx` defines `handleDocClick` as a `console.log` stub. The `onDocClick: (path: string) => void` callback is already threaded from `page.tsx` → `MainDashboard` → all sections → individual components. The T04 Code Review identified two issues to fix: (1) effect ordering race condition in DocumentDrawer's internal fetch, and (2) missing `AbortController` for fetch cleanup. Both are resolved by moving fetch lifecycle into the new hook.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/hooks/use-document-drawer.ts` | Hook: open/close state, fetch with AbortController |
| MODIFY | `ui/components/documents/document-drawer.tsx` | Remove internal fetch — accept data/loading/error as props |
| MODIFY | `ui/app/page.tsx` | Add useDocumentDrawer + render DocumentDrawer |
| MODIFY | `ui/components/planning/planning-checklist.tsx` | Replace inline button with DocumentLink |
| MODIFY | `ui/components/execution/phase-card.tsx` | Replace Button doc links with DocumentLink |
| MODIFY | `ui/components/execution/task-card.tsx` | Replace DocLinkButton with DocumentLink |
| MODIFY | `ui/components/dashboard/final-review-section.tsx` | Replace Button link with DocumentLink |
| MODIFY | `ui/components/layout/not-initialized-view.tsx` | Replace button with DocumentLink |

## Implementation Steps

### Step 1: Create `ui/hooks/use-document-drawer.ts`

Create the hook managing drawer open/close state, current document path, and document fetching with `AbortController`.

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { DocumentResponse } from "@/types/components";

interface UseDocumentDrawerOptions {
  /** Project name for constructing the fetch URL */
  projectName: string | null;
}

interface UseDocumentDrawerReturn {
  /** Whether the drawer is currently open */
  isOpen: boolean;
  /** Current document path (relative to project dir), or null */
  docPath: string | null;
  /** True while the document is being fetched */
  loading: boolean;
  /** Error message if fetch failed, or null */
  error: string | null;
  /** Fetched document data, or null */
  data: DocumentResponse | null;
  /** Open the drawer with a specific document path */
  openDocument: (path: string) => void;
  /** Close the drawer and reset state */
  close: () => void;
}
```

**Implementation requirements**:
- `openDocument(path)`: sets `isOpen = true`, `docPath = path`, resets `data`/`error`/`loading`
- `close()`: sets `isOpen = false` (preserve `docPath` and `data` so closing animation shows content)
- `useEffect` watches `isOpen`, `docPath`, and `projectName`:
  - If all three are truthy, fetch from `/api/projects/${encodeURIComponent(projectName)}/document?path=${encodeURIComponent(docPath)}`
  - Create an `AbortController`; pass `signal` to `fetch()`
  - On success: `setData(json)`, `setLoading(false)`
  - On error: if `signal.aborted`, ignore; otherwise `setError(message)`, `setLoading(false)`
  - Cleanup function: call `controller.abort()`
- Use `useRef` for the `AbortController` so re-renders don't lose the reference
- Export the hook as a named export

### Step 2: Modify `ui/components/documents/document-drawer.tsx`

Convert `DocumentDrawer` from an internally-fetching component to a controlled component that receives fetched data as props. This resolves T04 Code Review issues #1 (effect ordering race) and #2 (missing AbortController) because fetching is now managed by the hook.

**Current props** (remove `projectName`, add `loading`/`error`/`data`):
```typescript
interface DocumentDrawerProps {
  open: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  onClose: () => void;
}
```

**Changes**:
- Remove the `projectName` prop
- Add `loading: boolean`, `error: string | null`, `data: DocumentResponse | null` props
- Remove `useState` for `loading`, `error`, `data`
- Remove `fetchDocument` callback
- Remove both `useEffect` hooks (fetch effect and reset effect)
- Keep the `extractFilename` helper
- Keep the rendering logic (Sheet, SheetHeader, SheetContent, ScrollArea, LoadingSkeleton, error display, DocumentMetadata + MarkdownRenderer)
- The `title` derivation: `data?.frontmatter?.title || (docPath ? extractFilename(docPath) : "Document")`
- Keep `LoadingSkeleton` internal component unchanged

### Step 3: Modify `ui/app/page.tsx`

Wire `useDocumentDrawer` hook and render `DocumentDrawer` at root level.

**Changes**:
- Import `useDocumentDrawer` from `@/hooks/use-document-drawer`
- Import `DocumentDrawer` from `@/components/documents`
- Call `useDocumentDrawer({ projectName: selectedProject })` — destructure `isOpen`, `docPath`, `loading`, `error`, `data`, `openDocument`, `close`
- Replace `handleDocClick` body: change from `console.log("Document clicked:", path)` to calling `openDocument(path)`
- After the closing `</SidebarProvider>`, render:
  ```tsx
  <DocumentDrawer
    open={isOpen}
    docPath={docPath}
    loading={loading}
    error={error}
    data={data}
    onClose={close}
  />
  ```
- The `DocumentDrawer` must be inside the root `<div>` but outside `<SidebarProvider>`

### Step 4: Modify `ui/components/planning/planning-checklist.tsx`

Replace the inline `<button>` for step output links with the `DocumentLink` component.

**Current** (lines ~43-55):
```tsx
{step.output ? (
  <button
    type="button"
    className="text-sm hover:underline cursor-pointer ml-auto bg-transparent border-none p-0"
    style={{ color: "var(--color-link)" }}
    onClick={() => onDocClick(step.output!)}
  >
    {step.output}
  </button>
) : (
  <span
    className="text-sm ml-auto"
    style={{ color: "var(--color-link-disabled)" }}
  >
    —
  </span>
)}
```

**Replace with**:
```tsx
<span className="ml-auto">
  <DocumentLink
    path={step.output}
    label={step.output ?? STEP_DISPLAY_NAMES[stepName]}
    onDocClick={onDocClick}
  />
</span>
```

- Import `DocumentLink` from `@/components/documents`
- When `step.output` is `null`, `DocumentLink` renders as disabled with "Not available" tooltip
- When `step.output` is non-null, use the output filename as the label

### Step 5: Modify `ui/components/execution/phase-card.tsx`

Replace `Button` icon buttons for phase documents with `DocumentLink`.

**Change 1 — phase_doc link** (in AccordionTrigger area):
Replace the current `Button variant="ghost" size="icon-xs"` inside the `div[role="presentation"]` with:
```tsx
{phase.phase_doc && (
  <div
    role="presentation"
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => e.stopPropagation()}
  >
    <DocumentLink
      path={phase.phase_doc}
      label="Phase Plan"
      onDocClick={onDocClick}
    />
  </div>
)}
```

**Change 2 — phase_report link** (in AccordionContent footer):
Replace the `Button variant="ghost" size="xs"` for phase report with:
```tsx
<DocumentLink
  path={phase.phase_report}
  label="Phase Report"
  onDocClick={onDocClick}
/>
```

**Change 3 — phase_review link** (in AccordionContent footer):
If `phase.phase_review` exists, add a `DocumentLink` for it next to the verdict badge:
```tsx
{phase.phase_review && (
  <DocumentLink
    path={phase.phase_review}
    label="Phase Review"
    onDocClick={onDocClick}
  />
)}
```

- Import `DocumentLink` from `@/components/documents`
- Remove the `Button` import if no longer used, and `FileText` import from `lucide-react` if no longer used

### Step 6: Modify `ui/components/execution/task-card.tsx`

Replace the internal `DocLinkButton` helper with `DocumentLink`.

**Current `DocLinkButton`** (lines ~60-80):
```tsx
function DocLinkButton({
  label,
  path,
  onDocClick,
}: {
  label: string;
  path: string | null;
  onDocClick: (path: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={path === null}
      onClick={path ? () => onDocClick(path) : undefined}
      aria-label={path ? label : `${label} (unavailable)`}
      style={{ color: path ? "var(--color-link)" : "var(--color-link-disabled)" }}
    >
      <FileText />
    </Button>
  );
}
```

**Replace each usage** of `<DocLinkButton>` with `<DocumentLink>`:
```tsx
<DocumentLink path={task.handoff_doc} label="Handoff" onDocClick={onDocClick} />
<DocumentLink path={task.report_doc} label="Report" onDocClick={onDocClick} />
<DocumentLink path={task.review_doc} label="Review" onDocClick={onDocClick} />
```

- Import `DocumentLink` from `@/components/documents`
- Remove the `DocLinkButton` function entirely
- Remove `Button` and `FileText` imports if no longer used

### Step 7: Modify `ui/components/dashboard/final-review-section.tsx`

Replace the `Button variant="link"` for the review report with `DocumentLink`.

**Current** (lines ~35-47):
```tsx
<Button
  variant="link"
  disabled={finalReview.report_doc === null}
  onClick={() => {
    if (finalReview.report_doc) {
      onDocClick(finalReview.report_doc);
    }
  }}
  className="px-0"
  style={{
    color: finalReview.report_doc
      ? "var(--color-link)"
      : "var(--color-link-disabled)",
  }}
>
  Review Report
</Button>
```

**Replace with**:
```tsx
<DocumentLink
  path={finalReview.report_doc}
  label="Review Report"
  onDocClick={onDocClick}
/>
```

- Import `DocumentLink` from `@/components/documents`
- Remove `Button` import if no longer used

### Step 8: Modify `ui/components/layout/not-initialized-view.tsx`

Replace the plain `<button>` for the brainstorming doc with `DocumentLink`.

**Current** (lines ~30-38):
```tsx
{brainstormingDoc && (
  <button
    type="button"
    className="text-sm underline underline-offset-2"
    style={{ color: "var(--color-link)" }}
    onClick={() => onDocClick(brainstormingDoc)}
  >
    View Brainstorming Document
  </button>
)}
```

**Replace with**:
```tsx
<DocumentLink
  path={brainstormingDoc ?? null}
  label="View Brainstorming Document"
  onDocClick={onDocClick}
/>
```

- Import `DocumentLink` from `@/components/documents`
- `brainstormingDoc` is `string | null | undefined` — coerce to `string | null` with `?? null`

## Contracts & Interfaces

### `useDocumentDrawer` Hook — `ui/hooks/use-document-drawer.ts`

```typescript
interface UseDocumentDrawerOptions {
  projectName: string | null;
}

interface UseDocumentDrawerReturn {
  isOpen: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  openDocument: (path: string) => void;
  close: () => void;
}

function useDocumentDrawer(options: UseDocumentDrawerOptions): UseDocumentDrawerReturn;
```

### `DocumentDrawer` Modified Props — `ui/components/documents/document-drawer.tsx`

```typescript
interface DocumentDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Relative document path, or null */
  docPath: string | null;
  /** Whether document content is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetched document response, or null */
  data: DocumentResponse | null;
  /** Callback to close the drawer */
  onClose: () => void;
}
```

### `DocumentLink` Props — `ui/components/documents/document-link.tsx` (existing, unchanged)

```typescript
interface DocumentLinkProps {
  /** Document path relative to project dir, or null if document doesn't exist */
  path: string | null;
  /** Display label for the link */
  label: string;
  /** Callback when the link is clicked (only fires when path is non-null) */
  onDocClick: (path: string) => void;
}
```

### `DocumentResponse` — `ui/types/components.ts` (existing, unchanged)

```typescript
interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;
  filePath: string;
}

interface DocumentFrontmatter {
  [key: string]: unknown;
  project?: string;
  status?: string;
  author?: string;
  created?: string;
  verdict?: string;
  severity?: string;
  phase?: number;
  task?: number;
  title?: string;
}
```

### Component Prop Chains (existing, unchanged)

All these components accept `onDocClick: (path: string) => void` — no changes to their interfaces:

```typescript
// MainDashboard
interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
}

// PlanningSection
interface PlanningSectionProps {
  planning: { status: PlanningStatus; steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null }>; human_approved: boolean };
  onDocClick: (path: string) => void;
}

// ExecutionSection
interface ExecutionSectionProps {
  execution: NormalizedExecution;
  limits: NormalizedLimits;
  onDocClick: (path: string) => void;
}

// PhaseCard
interface PhaseCardProps {
  phase: NormalizedPhase;
  isActive: boolean;
  maxRetries: number;
  onDocClick: (path: string) => void;
}

// TaskCard
interface TaskCardProps {
  task: NormalizedTask;
  maxRetries: number;
  onDocClick: (path: string) => void;
}

// FinalReviewSection
interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  onDocClick: (path: string) => void;
}

// PlanningChecklist
interface PlanningChecklistProps {
  steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null }>;
  humanApproved: boolean;
  onDocClick: (path: string) => void;
}

// NotInitializedView
interface NotInitializedViewProps {
  projectName: string;
  brainstormingDoc?: string | null;
  onDocClick: (path: string) => void;
}
```

## Styles & Design Tokens

- `--drawer-width`: `640px` — DocumentDrawer max-width (already applied via `sm:max-w-[640px]`)
- `--color-link`: Document link active color (already used by DocumentLink)
- `--color-link-disabled`: Document link disabled color (already used by DocumentLink)
- DocumentLink icon size: `h-3.5 w-3.5` (FileText icon, already in component)
- DocumentLink active: `text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring`
- DocumentLink disabled: `text-muted-foreground cursor-not-allowed` with "Not available" tooltip
- Loading skeleton in drawer: `Skeleton` component from `@/components/ui/skeleton`
- Error display in drawer: `border-destructive/50 bg-destructive/10 text-destructive`

## Test Requirements

- [ ] `useDocumentDrawer` returns `isOpen: false` and `docPath: null` initially
- [ ] Calling `openDocument("tasks/FOO.md")` sets `isOpen: true` and `docPath: "tasks/FOO.md"`
- [ ] Calling `close()` sets `isOpen: false`
- [ ] When `isOpen` and `docPath` are set, a fetch is triggered to the correct URL
- [ ] Changing `docPath` while a fetch is in-flight aborts the previous request (AbortController)
- [ ] Calling `close()` while a fetch is in-flight aborts the request
- [ ] `DocumentDrawer` renders loading skeleton when `loading: true`
- [ ] `DocumentDrawer` renders error message when `error` is non-null
- [ ] `DocumentDrawer` renders metadata + markdown when `data` is provided
- [ ] All document links in `PlanningChecklist` use `DocumentLink` component
- [ ] All document links in `PhaseCard` use `DocumentLink` component
- [ ] All document links in `TaskCard` use `DocumentLink` component
- [ ] `FinalReviewSection` report link uses `DocumentLink` component
- [ ] `NotInitializedView` brainstorming link uses `DocumentLink` component
- [ ] Null document paths render as disabled `DocumentLink` with "Not available" tooltip

## Acceptance Criteria

- [ ] `ui/hooks/use-document-drawer.ts` exists as a `"use client"` module exporting `useDocumentDrawer`
- [ ] `useDocumentDrawer` manages `isOpen`, `docPath`, `loading`, `error`, `data` state
- [ ] `useDocumentDrawer` creates an `AbortController` per fetch and calls `abort()` on cleanup
- [ ] `DocumentDrawer` no longer fetches internally — accepts `loading`, `error`, `data` as props
- [ ] `DocumentDrawer` no longer accepts `projectName` prop
- [ ] `page.tsx` calls `useDocumentDrawer` and renders `DocumentDrawer` at root level
- [ ] `page.tsx` `handleDocClick` calls `openDocument(path)` instead of `console.log`
- [ ] `PlanningChecklist` uses `DocumentLink` for step output links
- [ ] `PhaseCard` uses `DocumentLink` for phase_doc, phase_report, and phase_review links
- [ ] `TaskCard` uses `DocumentLink` instead of `DocLinkButton` for handoff/report/review links
- [ ] `FinalReviewSection` uses `DocumentLink` for the review report link
- [ ] `NotInitializedView` uses `DocumentLink` for the brainstorming doc link
- [ ] Null document paths render as disabled links with "Not available" tooltip (FR-24)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT modify `DocumentLink` component (`document-link.tsx`) — use it as-is
- Do NOT modify `DocumentMetadata` or `MarkdownRenderer` — they remain unchanged
- Do NOT modify the `onDocClick` prop signature on any intermediate component (`MainDashboard`, `PlanningSection`, `ExecutionSection`) — the callback chain stays the same
- Do NOT add document fetching logic to any component — all fetching lives in `useDocumentDrawer`
- Do NOT install new npm packages — all required dependencies are already installed
- Do NOT create test files — no test file paths are in scope
- Place the hook at `ui/hooks/use-document-drawer.ts` (following `use-sse.ts`, `use-projects.ts` convention)
