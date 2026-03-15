---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 5
title: "INTEGRATION"
status: "pending"
skills_required: ["React", "TypeScript", "integration"]
skills_optional: []
estimated_files: 4
---

# Home Page Wiring and Carry-Forward Fixes

## Objective

Wire file list fetching, document ordering, and all new Phase 4 components into the home page and dashboard layout. Resolve carry-forward items from Phases 2 (CopyButton clipboard error handling) and 3 (redundant `updateTheme` call in MermaidBlock). This is the final integration task of the entire project.

## Context

Tasks T01–T04 created the `document-ordering` utility, the Files API, the `DocumentNavFooter` component (wired into `DocumentDrawer` with optional `docs`/`onNavigate` props), and the enhanced `ErrorLogSection` + new `OtherDocsSection` components (also with optional props). All these components are ready — they just need their props wired from `page.tsx` and `main-dashboard.tsx`. The `useDocumentDrawer` hook already exposes a `navigateTo` method. Two carry-forward fixes are small, isolated edits.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/page.tsx` | Fetch files API, compute ordered docs, derive errorLogPath + otherDocs, pass props down |
| MODIFY | `ui/components/layout/main-dashboard.tsx` | Accept new props, pass to ErrorLogSection and add OtherDocsSection |
| MODIFY | `ui/components/documents/copy-button.tsx` | Add try/catch around clipboard API call (carry-forward P02) |
| MODIFY | `ui/components/documents/mermaid-block.tsx` | Remove redundant `updateTheme` call after `initMermaid` (carry-forward P03) |

## Implementation Steps

1. **`ui/app/page.tsx`** — Add a `useState<string[]>` for `fileList` (initially `[]`). Add a `useEffect` that fetches `GET /api/projects/${encodeURIComponent(selectedProject)}/files` whenever `selectedProject` changes (and is non-null). On success, store the response's `files` array in state. On error, keep `fileList` as `[]` (non-critical — navigation still works without files, just no error log or other docs).

2. **`ui/app/page.tsx`** — Import `getOrderedDocs` from `@/lib/document-ordering` and `type { OrderedDoc }` from `@/types/components`. Compute `orderedDocs` via `useMemo`: call `getOrderedDocs(projectState, selectedProject, fileList)` when `projectState` is non-null, else return `[]`.

3. **`ui/app/page.tsx`** — Derive `errorLogPath` via `useMemo`: find the first entry in `fileList` that ends with `${selectedProject}-ERROR-LOG.md`; return that string or `null`.

4. **`ui/app/page.tsx`** — Derive `otherDocs` via `useMemo`: filter `orderedDocs` to entries with `category === 'other'`, then extract just the `.path` strings.

5. **`ui/app/page.tsx`** — Destructure `navigateTo` from the `useDocumentDrawer` return value. Pass `docs={orderedDocs}` and `onNavigate={navigateTo}` to the `<DocumentDrawer>` component. Pass `errorLogPath={errorLogPath}` and `otherDocs={otherDocs}` to the `<MainDashboard>` component (which already receives `onDocClick={handleDocClick}`).

6. **`ui/components/layout/main-dashboard.tsx`** — Add `errorLogPath?: string | null` and `otherDocs?: string[]` to `MainDashboardProps`. Import `OtherDocsSection` from `@/components/dashboard`. Pass `errorLogPath={errorLogPath}` and `onDocClick={onDocClick}` to `<ErrorLogSection>`. Add `<OtherDocsSection files={otherDocs ?? []} onDocClick={onDocClick} />` after `<ErrorLogSection>` in the dashboard layout.

7. **`ui/components/documents/copy-button.tsx`** — Wrap the `navigator.clipboard.writeText(text)` call inside `handleCopy` in a try/catch. On catch, do nothing (the `setCopied(true)` call should only happen inside the try block after the await succeeds).

8. **`ui/components/documents/mermaid-block.tsx`** — Remove the line `await updateTheme(theme);` from the `render` function inside the `useEffect`. Remove `updateTheme` from the import statement. The `initMermaid(theme)` call already sets the theme internally (it re-initializes when the theme changes), making the separate `updateTheme` redundant.

## Contracts & Interfaces

```typescript
// ui/types/components.ts — OrderedDoc (already exists, do not modify)
export interface OrderedDoc {
  path: string;
  title: string;
  category: 'planning' | 'phase' | 'task' | 'review' | 'error-log' | 'other';
}

// ui/types/components.ts — FilesResponse (already exists, do not modify)
export interface FilesResponse {
  files: string[];
}
```

```typescript
// ui/lib/document-ordering.ts — getOrderedDocs signature (already exists, do not modify)
export function getOrderedDocs(
  state: NormalizedProjectState,
  projectName: string,
  allFiles?: string[],
): OrderedDoc[]
```

```typescript
// ui/hooks/use-document-drawer.ts — navigateTo is already returned
// Destructure it alongside existing returns:
const {
  isOpen, docPath,
  loading: docLoading, error: docError, data: docData,
  openDocument, close: closeDocument, navigateTo,
  scrollAreaRef,
} = useDocumentDrawer({ projectName: selectedProject });
```

```typescript
// ui/components/documents/document-drawer.tsx — current props (already accept optional docs/onNavigate)
interface DocumentDrawerProps {
  open: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  onClose: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  docs?: OrderedDoc[];           // ← pass orderedDocs here
  onNavigate?: (path: string) => void;  // ← pass navigateTo here
}
```

```typescript
// ui/components/dashboard/error-log-section.tsx — current props (already accept optional errorLogPath/onDocClick)
interface ErrorLogSectionProps {
  errors: NormalizedErrors;
  errorLogPath?: string | null;     // ← pass errorLogPath here
  onDocClick?: (path: string) => void;  // ← pass onDocClick here
}
```

```typescript
// ui/components/dashboard/other-docs-section.tsx — current props
interface OtherDocsSectionProps {
  files: string[];                     // ← pass otherDocs here
  onDocClick: (path: string) => void;  // ← pass onDocClick here
}
```

```typescript
// MODIFIED: ui/components/layout/main-dashboard.tsx — new props to add
interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
  errorLogPath?: string | null;   // NEW
  otherDocs?: string[];            // NEW
}
```

## Current Source: `ui/app/page.tsx`

```tsx
"use client";

import { useProjects } from "@/hooks/use-projects";
import { useDocumentDrawer } from "@/hooks/use-document-drawer";
import { useConfigDrawer } from "@/hooks/use-config-drawer";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/sidebar";
import { AppHeader, MainDashboard } from "@/components/layout";
import { DocumentDrawer } from "@/components/documents";
import { ConfigDrawer } from "@/components/config";
import type { ProjectSummary } from "@/types/components";

export default function Home() {
  const {
    projects,
    selectedProject,
    projectState,
    selectProject,
    isLoading,
    error,
    sseStatus,
    reconnect,
  } = useProjects();

  const {
    isOpen,
    docPath,
    loading: docLoading,
    error: docError,
    data: docData,
    openDocument,
    close: closeDocument,
    scrollAreaRef,
  } = useDocumentDrawer({ projectName: selectedProject });

  const configDrawer = useConfigDrawer();

  const handleDocClick = (path: string) => {
    openDocument(path);
  };

  const selected: ProjectSummary | undefined = projects.find(
    (p) => p.name === selectedProject
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader sseStatus={sseStatus} onReconnect={reconnect} onConfigClick={configDrawer.open} />

      <SidebarProvider>
        <ProjectSidebar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={selectProject}
          isLoading={isLoading}
        />

        <SidebarInset id="main-content">
          {isLoading && !selected ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading projects…
                </p>
              </div>
            </div>
          ) : error && !selected ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          ) : selected ? (
            <MainDashboard
              projectState={projectState}
              project={selected}
              onDocClick={handleDocClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center">
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  Orchestration Monitor
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select a project from the sidebar to view its dashboard.
                </p>
              </div>
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>

      <DocumentDrawer
        open={isOpen}
        docPath={docPath}
        loading={docLoading}
        error={docError}
        data={docData}
        onClose={closeDocument}
        scrollAreaRef={scrollAreaRef}
      />

      <ConfigDrawer
        open={configDrawer.isOpen}
        config={configDrawer.config}
        loading={configDrawer.loading}
        error={configDrawer.error}
        onClose={configDrawer.close}
      />
    </div>
  );
}
```

## Current Source: `ui/components/layout/main-dashboard.tsx`

```tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectHeader } from "@/components/dashboard/project-header";
import { ErrorSummaryBanner } from "@/components/planning/error-summary-banner";
import { PlanningSection } from "@/components/dashboard/planning-section";
import { ExecutionSection } from "@/components/execution/execution-section";
import { FinalReviewSection } from "@/components/dashboard/final-review-section";
import { ErrorLogSection } from "@/components/dashboard/error-log-section";
import { GateHistorySection } from "@/components/dashboard/gate-history-section";
import { LimitsSection } from "@/components/dashboard/limits-section";
import { NotInitializedView } from "./not-initialized-view";
import { MalformedStateView } from "./malformed-state-view";
import type { NormalizedProjectState } from "@/types/state";
import type { ProjectSummary, GateEntry } from "@/types/components";

interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
}

function deriveGateEntries(state: NormalizedProjectState): GateEntry[] {
  const gates: GateEntry[] = [];

  // Post-Planning gate
  gates.push({
    gate: "Post-Planning",
    approved: state.planning.human_approved,
  });

  // Per-phase gates
  for (const phase of state.execution.phases) {
    gates.push({
      gate: `Phase ${phase.phase_number}: ${phase.title}`,
      approved: phase.human_approved,
    });
  }

  // Final Review gate
  if (state.final_review.status !== "not_started") {
    gates.push({
      gate: "Final Review",
      approved: state.final_review.human_approved,
    });
  }

  return gates;
}

export function MainDashboard({
  projectState,
  project,
  onDocClick,
}: MainDashboardProps) {
  // Malformed state takes priority
  if (projectState === null && project.hasMalformedState) {
    return (
      <MalformedStateView
        projectName={project.name}
        errorMessage={project.errorMessage ?? "Unable to parse state.json"}
      />
    );
  }

  // Not initialized
  if (projectState === null && !project.hasState) {
    return (
      <NotInitializedView
        projectName={project.name}
        brainstormingDoc={project.brainstormingDoc}
        onDocClick={onDocClick}
      />
    );
  }

  // No state available (fallback)
  if (projectState === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          No project state available.
        </p>
      </div>
    );
  }

  const gates = deriveGateEntries(projectState);

  return (
    <ScrollArea className="h-[calc(100vh-56px)]">
      <div className="space-y-6 p-6">
        <ErrorSummaryBanner
          blockers={projectState.errors.active_blockers}
          totalRetries={projectState.errors.total_retries}
          totalHalts={projectState.errors.total_halts}
        />

        <ProjectHeader
          project={projectState.project}
          tier={projectState.pipeline.current_tier}
          gateMode={projectState.pipeline.human_gate_mode}
        />

        <PlanningSection
          planning={projectState.planning}
          onDocClick={onDocClick}
        />

        <ExecutionSection
          execution={projectState.execution}
          limits={projectState.limits}
          onDocClick={onDocClick}
        />

        <FinalReviewSection
          finalReview={projectState.final_review}
          onDocClick={onDocClick}
        />

        <ErrorLogSection errors={projectState.errors} />

        <GateHistorySection gates={gates} />

        <LimitsSection limits={projectState.limits} />
      </div>
    </ScrollArea>
  );
}
```

## Current Source: `ui/components/documents/copy-button.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  /** Raw text content to copy to clipboard */
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code to clipboard"
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 rounded-md p-1.5 bg-background/80 backdrop-blur-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
```

## Current Source: `ui/components/documents/mermaid-block.tsx`

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import { initMermaid, renderDiagram, updateTheme } from "@/lib/mermaid-adapter";

interface MermaidBlockProps {
  /** Raw mermaid diagram source code */
  code: string;
}

let idCounter = 0;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const [svgOutput, setSvgOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const idRef = useRef(`mermaid-diagram-${idCounter++}`);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const theme = resolvedTheme === "dark" ? "dark" : "light";

    async function render() {
      try {
        setIsLoading(true);
        await initMermaid(theme);
        await updateTheme(theme);
        const svg = await renderDiagram(idRef.current, code);
        if (!cancelled) {
          setSvgOutput(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvgOutput(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedTheme]);

  if (isLoading) {
    return (
      <div
        className="bg-muted animate-pulse rounded-md h-48"
        role="img"
        aria-label="Loading diagram..."
      />
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-yellow-600 dark:text-yellow-500 text-sm font-medium">
          ⚠ Diagram render failed
        </p>
        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-sm">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    );
  }

  const ariaLabel = "Diagram: " + code.split("\n")[0].trim();

  return (
    <div
      className="overflow-x-auto"
      role="img"
      aria-label={ariaLabel}
    >
      <div dangerouslySetInnerHTML={{ __html: svgOutput! }} />
    </div>
  );
}
```

## Styles & Design Tokens

No new design tokens are introduced in this task. All styling is already defined on the components being wired:

- `DocumentNavFooter` footer container: `border-t border-border px-6 py-3` (already built)
- `ErrorLogSection` "View Error Log" link: `text-sm` `DocumentLink` (already built)
- `OtherDocsSection` empty state: `text-sm text-muted-foreground` (already built)
- Dashboard section spacing: `space-y-6 p-6` (existing in `MainDashboard`)

## Test Requirements

- [ ] File list fetched when a project is selected — verify `fileList` state populates from `GET /api/projects/{name}/files`
- [ ] Ordered docs computed correctly from `projectState` + `fileList` — `orderedDocs` is non-empty when `projectState` is non-null
- [ ] `<DocumentDrawer>` receives `docs` and `onNavigate` props — Prev/Next footer appears and navigating loads adjacent documents
- [ ] `errorLogPath` is correctly detected from the file list (matches `{PROJECT-NAME}-ERROR-LOG.md` pattern) and passed through to `ErrorLogSection`
- [ ] `otherDocs` (non-pipeline files) correctly derived and passed to `OtherDocsSection`
- [ ] CopyButton: calling `handleCopy()` when `navigator.clipboard` is unavailable does NOT throw an unhandled rejection
- [ ] MermaidBlock: only `initMermaid(theme)` is called before `renderDiagram` — no `updateTheme` call present
- [ ] Build passes with zero TypeScript errors (`npm run build`)

## Acceptance Criteria

- [ ] `page.tsx` fetches file list on project selection and stores it in state
- [ ] `page.tsx` computes `orderedDocs` from `getOrderedDocs(projectState, selectedProject, fileList)` via `useMemo`
- [ ] `page.tsx` passes `docs={orderedDocs}` and `onNavigate={navigateTo}` to `<DocumentDrawer>`
- [ ] `page.tsx` derives `errorLogPath` from file list and passes it to `<MainDashboard>`
- [ ] `page.tsx` derives `otherDocs` from ordered docs and passes it to `<MainDashboard>`
- [ ] `MainDashboard` accepts `errorLogPath` and `otherDocs` props and passes them to `ErrorLogSection` and `OtherDocsSection`
- [ ] `ErrorLogSection` receives `errorLogPath` and `onDocClick` — "View Error Log" link appears when error log exists
- [ ] `OtherDocsSection` renders in the dashboard with non-pipeline files
- [ ] CopyButton `handleCopy` wraps `navigator.clipboard.writeText(text)` in try/catch — no unhandled promise rejection on failure
- [ ] MermaidBlock no longer imports or calls `updateTheme` — only `initMermaid` and `renderDiagram` are used
- [ ] All existing functionality preserved (document viewer, sidebar, config drawer, etc.)
- [ ] All tests pass
- [ ] Build succeeds (`npm run build` with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/components/documents/document-drawer.tsx` — it already accepts optional `docs`/`onNavigate` props from T03
- Do NOT modify `ui/components/dashboard/error-log-section.tsx` — it already accepts optional `errorLogPath`/`onDocClick` props from T04
- Do NOT modify `ui/components/dashboard/other-docs-section.tsx` — it is complete from T04
- Do NOT modify `ui/hooks/use-document-drawer.ts` — it already returns `navigateTo`
- Do NOT modify `ui/lib/document-ordering.ts` — it is complete from T01
- Do NOT modify `ui/app/api/projects/[name]/files/route.ts` — it is complete from T02
- Do NOT create any new files — this task only modifies existing files
- Do NOT add any new dependencies
- The file list fetch failure must be non-fatal — if the API call fails, `fileList` stays `[]` and the app works normally without error log / other docs / nav features
