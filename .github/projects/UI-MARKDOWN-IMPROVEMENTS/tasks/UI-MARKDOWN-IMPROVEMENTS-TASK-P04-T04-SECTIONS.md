---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 4
title: "SECTIONS"
status: "pending"
skills_required: ["React", "TypeScript", "UI components"]
skills_optional: ["accessibility"]
estimated_files: 3
---

# ErrorLogSection Enhancement and OtherDocsSection

## Objective

Enhance the existing `ErrorLogSection` component with a conditional "View Error Log" document link, create a new `OtherDocsSection` component that lists non-pipeline markdown files in the dashboard, and export the new component from the dashboard barrel file.

## Context

The dashboard displays project status sections as cards. `ErrorLogSection` currently shows retry/halt counts and active blockers but has no way to open the actual error log document. A new `OtherDocsSection` card is needed to surface non-pipeline markdown files. Both sections receive an `onDocClick` callback to open files in the document viewer drawer. The `DocumentLink` component (from `@/components/documents`) handles the clickable link rendering with an icon.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/components/dashboard/error-log-section.tsx` | Add `errorLogPath` and `onDocClick` props; render conditional DocumentLink |
| CREATE | `ui/components/dashboard/other-docs-section.tsx` | New card listing non-pipeline markdown files |
| MODIFY | `ui/components/dashboard/index.ts` | Add `OtherDocsSection` export |

## Implementation Steps

1. **Modify `error-log-section.tsx`** — Import `DocumentLink` from `@/components/documents`. Extend the `ErrorLogSectionProps` interface to add `errorLogPath: string | null` and `onDocClick: (path: string) => void`. After the blockers list (after the closing of the conditional blockers/empty-state block), add a conditional rendering: when `errorLogPath` is non-null, render a `<DocumentLink>` with `path={errorLogPath}`, `label="View Error Log"`, and `onDocClick={onDocClick}`, wrapped in a `<div>` for spacing.

2. **Create `other-docs-section.tsx`** — Build a new `"use client"` component that receives `files: string[]` and `onDocClick: (path: string) => void`. Import `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card` and `DocumentLink` from `@/components/documents`. Wrap the content in a `<nav aria-label="Other project documents">` landmark. If `files` is empty, show the empty state text. Otherwise, render each file alphabetically as a `DocumentLink`.

3. **Modify `ui/components/dashboard/index.ts`** — Add `export { OtherDocsSection } from "./other-docs-section";` to the barrel file.

## Contracts & Interfaces

### ErrorLogSectionProps (Enhanced)

```typescript
// ui/components/dashboard/error-log-section.tsx

import type { NormalizedErrors } from "@/types/state";

interface ErrorLogSectionProps {
  errors: NormalizedErrors;
  /** Path to error log file, or null if no error log exists */
  errorLogPath: string | null;
  /** Callback to open a document in the viewer */
  onDocClick: (path: string) => void;
}
```

### OtherDocsSectionProps

```typescript
// ui/components/dashboard/other-docs-section.tsx

interface OtherDocsSectionProps {
  /** List of non-pipeline markdown file paths (should already be sorted alphabetically by caller or sorted in component) */
  files: string[];
  /** Callback when a file is clicked to open in the document viewer */
  onDocClick: (path: string) => void;
}
```

### DocumentLink Props (Existing — Reference Only)

```typescript
// ui/components/documents/document-link.tsx — DO NOT MODIFY

interface DocumentLinkProps {
  /** Document path relative to project dir, or null if document doesn't exist */
  path: string | null;
  /** Display label for the link */
  label: string;
  /** Callback when the link is clicked (only fires when path is non-null) */
  onDocClick: (path: string) => void;
}
```

### Current ErrorLogSection Code (Will Be Modified)

```typescript
// ui/components/dashboard/error-log-section.tsx — CURRENT CODE

"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { NormalizedErrors } from "@/types/state";

interface ErrorLogSectionProps {
  errors: NormalizedErrors;
}

export function ErrorLogSection({ errors }: ErrorLogSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            Total Retries: <span className="font-mono">{errors.total_retries}</span>
          </span>
          <span>
            Total Halts: <span className="font-mono">{errors.total_halts}</span>
          </span>
        </div>

        {errors.active_blockers.length > 0 ? (
          <ul className="space-y-1 text-sm text-destructive">
            {errors.active_blockers.map((blocker, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="select-none" aria-hidden="true">•</span>
                <span>{blocker}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active blockers</p>
        )}
      </CardContent>
    </Card>
  );
}
```

## Styles & Design Tokens

- Error log link: `text-sm` — inherits `DocumentLink` styling (uses `text-primary hover:underline`)
- OtherDocsSection card: Uses standard `Card`, `CardHeader`, `CardTitle`, `CardContent` from shadcn/ui
- Empty state text: `text-sm text-muted-foreground` — "No additional documents"
- OtherDocsSection file list container: `space-y-1` for vertical spacing between links
- DocumentLink items use `text-sm` sizing via the existing component's default styles
- Error log link wrapper: `<div>` below blockers with no extra top margin (the parent `space-y-3` on `CardContent` handles spacing)

## Test Requirements

- [ ] `ErrorLogSection` renders the "View Error Log" link when `errorLogPath` is provided as a non-null string
- [ ] `ErrorLogSection` does NOT render any "View Error Log" link when `errorLogPath` is `null`
- [ ] `ErrorLogSection` still renders retry/halt counts and blockers correctly after the prop changes
- [ ] Clicking the "View Error Log" link calls `onDocClick` with the provided `errorLogPath`
- [ ] `OtherDocsSection` renders each file as a `DocumentLink` in alphabetical order
- [ ] `OtherDocsSection` shows "No additional documents" when `files` is an empty array
- [ ] `OtherDocsSection` is wrapped in a `<nav>` element with `aria-label="Other project documents"`

## Acceptance Criteria

- [ ] Error log link appears below the blockers list when `errorLogPath` is non-null; clicking it calls `onDocClick` with the path
- [ ] Error log link is absent when `errorLogPath` is `null` (no empty container, no layout shift)
- [ ] `OtherDocsSection` renders files alphabetically, each as a clickable `DocumentLink`
- [ ] `OtherDocsSection` shows "No additional documents" in muted text when `files` array is empty
- [ ] `OtherDocsSection` wrapped in `<nav aria-label="Other project documents">` landmark
- [ ] `OtherDocsSection` exported from `ui/components/dashboard/index.ts`
- [ ] Existing `ErrorLogSection` functionality (retry/halt counts, blockers) is preserved unchanged
- [ ] All tests pass
- [ ] Build succeeds (`npm run build` with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/app/page.tsx` — wiring props from the home page is T05's responsibility
- Do NOT modify `DocumentLink` — use it as-is from `@/components/documents`
- Do NOT add navigation ordering logic to these components — they receive pre-computed data via props
- Do NOT create any new types outside of the component files — use inline interfaces
- Keep `ErrorLogSection` as a `"use client"` component
- Make `OtherDocsSection` a `"use client"` component
- Derive the display label for each file in `OtherDocsSection` from the filename (strip the `.md` extension)
