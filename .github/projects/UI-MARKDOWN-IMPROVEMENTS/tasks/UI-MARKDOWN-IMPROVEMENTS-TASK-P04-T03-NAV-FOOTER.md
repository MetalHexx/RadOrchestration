---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 3
title: "NAV-FOOTER"
status: "pending"
skills_required: ["React", "TypeScript", "accessibility"]
skills_optional: ["Tailwind CSS"]
estimated_files: 4
---

# NAV-FOOTER

## Objective

Create the `DocumentNavFooter` component with Prev/Next navigation buttons, add a `navigateTo(path)` method to the `useDocumentDrawer` hook, wire the footer into the `DocumentDrawer` layout, and fix mobile width specificity.

## Context

The document drawer (`ui/components/documents/document-drawer.tsx`) currently renders a Sheet with a header and scrollable content area but no navigation footer. The `useDocumentDrawer` hook (`ui/hooks/use-document-drawer.ts`) exposes `openDocument` and `close` but lacks a `navigateTo` method for in-place navigation. An `OrderedDoc[]` type and `getAdjacentDocs` utility already exist in `ui/lib/document-ordering.ts` (created in T01). The `SheetContent` currently uses `w-full md:!w-[50vw]` but the mobile `w-full` may need `!w-full` to defeat the base shadcn `data-[side=right]:w-3/4` specificity (carry-forward from Phase 1).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/documents/document-nav-footer.tsx` | Prev/Next footer bar component |
| MODIFY | `ui/hooks/use-document-drawer.ts` | Add `navigateTo(path)` method to return type |
| MODIFY | `ui/components/documents/document-drawer.tsx` | Wire `DocumentNavFooter` into layout; fix mobile `!w-full` |
| MODIFY | `ui/components/documents/index.ts` | Export `DocumentNavFooter` |

## Implementation Steps

1. **Create `document-nav-footer.tsx`**: Build a `DocumentNavFooter` component that accepts `docs`, `currentPath`, and `onNavigate` props. Use `getAdjacentDocs` internally to derive prev/next. Render two buttons in a flex row. Disable (not hide) buttons at boundaries. Truncate adjacent doc titles with ellipsis. Apply the styles and accessibility attributes below.

2. **Add `navigateTo` to `useDocumentDrawer`**: In the hook, create a `navigateTo` callback that sets `docPath` to the new path (keeping `isOpen` as true), clears `data` and `error`, and sets `loading` to true. The existing `useEffect` on `[isOpen, docPath, projectName]` will trigger the fetch automatically. The existing scroll-reset `useEffect` on `[docPath]` will handle scroll reset. Return `navigateTo` from the hook.

3. **Wire footer into `DocumentDrawer`**: Add `docs: OrderedDoc[]` and `onNavigate: (path: string) => void` to `DocumentDrawerProps`. Render `<DocumentNavFooter>` after the ScrollArea div, only when `data` is loaded (not during loading/error states). The footer renders inside `SheetContent` below the scroll area wrapper.

4. **Fix mobile width**: Change the `SheetContent` className from `w-full` to `!w-full` so it defeats the shadcn `data-[side=right]:w-3/4` base style on mobile.

5. **Export from barrel**: Add `export { DocumentNavFooter } from "./document-nav-footer"` to `ui/components/documents/index.ts`.

## Contracts & Interfaces

### OrderedDoc (existing — `ui/types/components.ts`)

```typescript
export interface OrderedDoc {
  /** Relative path to the document (same format as state.json paths) */
  path: string;
  /** Display title for the navigation button label */
  title: string;
  /** Category for grouping: planning, phase, task, review, error-log, other */
  category: 'planning' | 'phase' | 'task' | 'review' | 'error-log' | 'other';
}
```

### getAdjacentDocs (existing — `ui/lib/document-ordering.ts`)

```typescript
import type { OrderedDoc } from '@/types/components';

export function getAdjacentDocs(
  docs: OrderedDoc[],
  currentPath: string,
): { prev: OrderedDoc | null; next: OrderedDoc | null; currentIndex: number; total: number };
```

### DocumentNavFooterProps (new — `ui/components/documents/document-nav-footer.tsx`)

```typescript
import type { OrderedDoc } from '@/types/components';

interface DocumentNavFooterProps {
  /** Full ordered document list */
  docs: OrderedDoc[];
  /** Current document path */
  currentPath: string;
  /** Callback when user navigates to a different document */
  onNavigate: (path: string) => void;
}
```

### Enhanced DocumentDrawerProps (modify — `ui/components/documents/document-drawer.tsx`)

Add these two props to the existing `DocumentDrawerProps` interface:

```typescript
/** Ordered document list for Prev/Next navigation */
docs: OrderedDoc[];
/** Callback when user navigates via Prev/Next */
onNavigate: (path: string) => void;
```

### Enhanced UseDocumentDrawerReturn (modify — `ui/hooks/use-document-drawer.ts`)

Add to the existing return type and return object:

```typescript
/** Navigate to a new document without closing the drawer; resets scroll */
navigateTo: (path: string) => void;
```

### Current `useDocumentDrawer` hook (full source to modify)

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { DocumentResponse } from "@/types/components";

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
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

export function useDocumentDrawer({
  projectName,
}: UseDocumentDrawerOptions): UseDocumentDrawerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const openDocument = useCallback((path: string) => {
    setIsOpen(true);
    setDocPath(path);
    setData(null);
    setError(null);
    setLoading(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Fetch effect — triggers on [isOpen, docPath, projectName]
  useEffect(() => { /* fetch logic */ }, [isOpen, docPath, projectName]);

  // Scroll reset effect — triggers on [docPath]
  useEffect(() => {
    if (docPath && scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) { viewport.scrollTop = 0; }
    }
  }, [docPath]);

  return {
    isOpen, docPath, loading, error, data, openDocument, close, scrollAreaRef,
  };
}
```

### Current `DocumentDrawer` component (full source to modify)

```typescript
"use client";

import type React from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentResponse } from "@/types/components";
import { DocumentMetadata } from "./document-metadata";
import { MarkdownRenderer } from "./markdown-renderer";

interface DocumentDrawerProps {
  open: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  onClose: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

export function DocumentDrawer({
  open, docPath, loading, error, data, onClose, scrollAreaRef,
}: DocumentDrawerProps) {
  const title = data?.frontmatter?.title || (docPath ? extractFilename(docPath) : "Document");

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full md:!w-[50vw] md:!max-w-[50vw] overflow-hidden"
        aria-label={`Document viewer: ${title}`}
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {docPath ? extractFilename(docPath) : "No document selected"}
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollAreaRef} className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              {loading && <LoadingSkeleton />}
              {error && ( /* error alert */ )}
              {data && !loading && !error && (
                <div className="space-y-4">
                  <DocumentMetadata frontmatter={data.frontmatter} />
                  <MarkdownRenderer content={data.content} />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Current barrel export (`ui/components/documents/index.ts`)

```typescript
export { CopyButton } from "./copy-button";
export { DocumentDrawer } from "./document-drawer";
export { DocumentMetadata } from "./document-metadata";
export { MarkdownRenderer } from "./markdown-renderer";
export { MermaidBlock } from "./mermaid-block";
export { DocumentLink } from "./document-link";
```

## Styles & Design Tokens

### DocumentNavFooter layout

- Footer container: `border-t border-border px-6 py-3` — sits below the `ScrollArea` wrapper in `SheetContent`
- Inner layout: `flex items-center justify-between` — Prev on left, Next on right
- Position counter (optional): `text-xs text-muted-foreground` centered — e.g., "3 of 12"

### Button styles

- **Active button**: `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Disabled button**: Add `opacity-50 cursor-not-allowed` — remove hover styles. Set `aria-disabled="true"` and `tabindex="-1"`. Prevent `onClick` when disabled (guard in handler, not via HTML disabled attribute on the div/button).
- **Prev label**: `← {prev.title}` — title truncated via `max-w-[150px] truncate`
- **Next label**: `{next.title} →` — title truncated via `max-w-[150px] truncate`

### Accessibility

- `aria-label="Previous document: {title}"` on Prev button
- `aria-label="Next document: {title}"` on Next button
- `aria-disabled="true"` on disabled buttons (not HTML `disabled`)
- `tabindex="-1"` on disabled buttons to skip in tab order
- Buttons activated by Enter/Space (native `<button>` behavior)

### Mobile width fix (carry-forward from Phase 1)

- Change `SheetContent` className from `w-full` to `!w-full` to defeat the base `data-[side=right]:w-3/4` specificity from shadcn

### Footer visibility

- **Show footer** when `data` is loaded and no error (i.e., `data && !loading && !error`)
- **Hide footer** during loading, error, or when no document is loaded
- Footer also hidden when `docs` array is empty

## Test Requirements

- [ ] `DocumentNavFooter` renders Prev and Next buttons when positioned in the middle of a document list
- [ ] Prev button is disabled (has `aria-disabled="true"`, `opacity-50`) when `currentPath` is the first doc
- [ ] Next button is disabled when `currentPath` is the last doc
- [ ] Both buttons disabled when only one document in the list
- [ ] Clicking an active Next button calls `onNavigate` with the next doc's path
- [ ] Clicking an active Prev button calls `onNavigate` with the prev doc's path
- [ ] Clicking a disabled button does NOT call `onNavigate`
- [ ] `aria-label` on Prev contains the previous document's title
- [ ] `aria-label` on Next contains the next document's title

## Acceptance Criteria

- [ ] `DocumentNavFooter` component exists at `ui/components/documents/document-nav-footer.tsx`
- [ ] Prev/Next buttons render in a footer below the scroll area inside the drawer
- [ ] Clicking Next/Prev calls `onNavigate` with the adjacent document path
- [ ] `navigateTo` method exists on `useDocumentDrawer` return — sets `docPath`, keeps drawer open, triggers fetch and scroll reset
- [ ] Prev button disabled at first document; Next button disabled at last document
- [ ] Disabled buttons have `aria-disabled="true"`, `opacity-50 cursor-not-allowed`, `tabindex="-1"`
- [ ] Active buttons have `hover:bg-accent hover:text-accent-foreground` transition
- [ ] `aria-label` on each button includes the adjacent document title
- [ ] Footer hidden during loading and error states
- [ ] Mobile `SheetContent` uses `!w-full` (not `w-full`) to defeat base specificity
- [ ] `DocumentNavFooter` exported from `ui/components/documents/index.ts`
- [ ] All tests pass
- [ ] Build succeeds (`npm run build` with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/app/page.tsx` — wiring `docs` and `navigateTo` into the page is T05's responsibility
- Do NOT modify `ui/lib/document-ordering.ts` — use it as-is
- Do NOT modify `ui/types/components.ts` — `OrderedDoc` is already defined
- Do NOT add new npm dependencies — use existing `lucide-react` for arrow icons if needed
- Do NOT create a `SheetFooter` from shadcn — build the footer as a plain `div` to avoid conflicting sheet layout constraints
- Keep `DocumentNavFooter` purely presentational — it calls `getAdjacentDocs` internally but has no state or side effects
