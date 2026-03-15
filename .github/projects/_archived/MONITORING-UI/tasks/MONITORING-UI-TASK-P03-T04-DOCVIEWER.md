---
project: "MONITORING-UI"
phase: 3
task: 4
title: "Document Viewer Components"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 5
---

# Document Viewer Components

## Objective

Create the document viewer component library: `DocumentDrawer` (right-side Sheet overlay), `DocumentMetadata` (frontmatter key-value display), `MarkdownRenderer` (GFM markdown rendering), `DocumentLink` (clickable/disabled link for documents), and a barrel export — all as `"use client"` components under `ui/components/documents/`.

## Context

The project already has a document API endpoint at `ui/app/api/projects/[name]/document/route.ts` that accepts `GET /api/projects/{name}/document?path={docPath}` and returns `{ frontmatter, content, filePath }`. The server-side markdown parser (`ui/lib/markdown-parser.ts`) uses `gray-matter` for frontmatter extraction. These components render the client-side UI — they consume the API response and display it in a drawer. The `Sheet` shadcn/ui component is already installed at `ui/components/ui/sheet.tsx`. The npm packages `react-markdown`, `remark-gfm`, `rehype-sanitize`, and `@tailwindcss/typography` are already installed in `package.json`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/documents/document-drawer.tsx` | Right-side Sheet overlay, fetches document on open, shows loading/error/content states |
| CREATE | `ui/components/documents/document-metadata.tsx` | Frontmatter key-value display card |
| CREATE | `ui/components/documents/markdown-renderer.tsx` | react-markdown + remark-gfm + rehype-sanitize rendering |
| CREATE | `ui/components/documents/document-link.tsx` | Clickable link with disabled state + tooltip |
| CREATE | `ui/components/documents/index.ts` | Barrel export for all document components |

## Implementation Steps

1. **Create `document-link.tsx`**: A `"use client"` component. When `path` is non-null, render a `<button>` styled as a link (text color `text-primary`, hover underline) that calls `onDocClick(path)` on click. When `path` is `null`, render a `<span>` with muted text (`text-muted-foreground`) and wrap it in a shadcn `Tooltip` showing "Not available". Include a `FileText` icon from `lucide-react` before the label.

2. **Create `document-metadata.tsx`**: A `"use client"` component. Receives `frontmatter` (a `Record<string, unknown>` with optional known keys). Render a `Card` (size `"sm"`) with a muted background (`bg-muted`). Inside, iterate the frontmatter entries and render each as a row in a compact key-value layout: key as `text-muted-foreground font-medium` label, value as plain text. Skip entries where value is `undefined` or `null`. Format dates with `toLocaleDateString()` when the key is `created` or `updated`. Display verdict/status values with appropriate text coloring.

3. **Create `markdown-renderer.tsx`**: A `"use client"` component. Use `react-markdown` with `remark-gfm` and `rehype-sanitize` plugins. Wrap the output in a `<div>` with Tailwind Typography classes: `prose prose-sm dark:prose-invert max-w-none`. For code blocks, apply `bg-muted rounded-md p-3 overflow-x-auto text-sm` styling via custom `components` override on the `pre` element. For inline `code`, apply `bg-muted px-1.5 py-0.5 rounded text-sm`. For tables, add `overflow-x-auto` wrapper. For task list items, style checkboxes.

4. **Create `document-drawer.tsx`**: A `"use client"` component. Use the shadcn `Sheet` component (right side). Accept props: `open`, `projectName`, `docPath`, `onClose`. When `open` transitions to `true` and `docPath` is non-null, fetch content from `/api/projects/${projectName}/document?path=${encodeURIComponent(docPath)}`. Manage three states via `useState`: `loading`, `error`, `data` (typed as `DocumentResponse | null`). Show `SheetHeader` with the document title (from frontmatter `title` or fallback to the filename extracted from `docPath`). Below the header, render `DocumentMetadata` with the frontmatter, then `MarkdownRenderer` with the content body. Use `ScrollArea` around the body content. Show `Skeleton` lines while loading. Show an error message if fetch fails. Reset state when `docPath` changes. Override max-width to `640px` on `SheetContent` via className.

5. **Create `index.ts`**: Barrel export all four components.

## Contracts & Interfaces

```typescript
// ui/types/components.ts — ALREADY EXISTS, DO NOT MODIFY

/** Document frontmatter metadata */
export interface DocumentFrontmatter {
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

/** API response for document content */
export interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;        // Markdown body (frontmatter stripped)
  filePath: string;       // Resolved absolute path (for display)
}
```

```typescript
// ui/components/documents/document-link.tsx — PROPS CONTRACT

interface DocumentLinkProps {
  /** Document path relative to project dir, or null if document doesn't exist */
  path: string | null;
  /** Display label for the link (e.g., "PRD", "Task Report", "Code Review") */
  label: string;
  /** Callback when the link is clicked (only fires when path is non-null) */
  onDocClick: (path: string) => void;
}
```

```typescript
// ui/components/documents/document-metadata.tsx — PROPS CONTRACT

interface DocumentMetadataProps {
  /** Extracted frontmatter from the document */
  frontmatter: DocumentFrontmatter;
}
```

```typescript
// ui/components/documents/markdown-renderer.tsx — PROPS CONTRACT

interface MarkdownRendererProps {
  /** Markdown content string (frontmatter already stripped) */
  content: string;
}
```

```typescript
// ui/components/documents/document-drawer.tsx — PROPS CONTRACT

interface DocumentDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** The project name (used to construct the API URL) */
  projectName: string;
  /** Relative document path, or null if no document selected */
  docPath: string | null;
  /** Callback to close the drawer */
  onClose: () => void;
}
```

```typescript
// API endpoint: GET /api/projects/{name}/document?path={docPath}
// Returns: { frontmatter: DocumentFrontmatter, content: string, filePath: string }
// 400 if missing path param
// 404 if document not found
// 500 on server error
```

## Styles & Design Tokens

- **Drawer max-width**: `640px` (CSS var `--drawer-width`)
- **Metadata card background**: `bg-muted` (CSS var `--metadata-bg` maps to shadcn `muted`)
- **Link text color (active)**: `text-primary` (CSS var `--color-link`)
- **Link text color (disabled)**: `text-muted-foreground` (CSS var `--color-link-disabled`)
- **Prose typography**: `prose prose-sm dark:prose-invert max-w-none` (from `@tailwindcss/typography`)
- **Code block background**: `bg-muted rounded-md p-3 overflow-x-auto text-sm`
- **Inline code**: `bg-muted px-1.5 py-0.5 rounded text-sm`
- **Loading skeletons**: Use `<Skeleton />` from `@/components/ui/skeleton` with `animate-pulse rounded-md bg-muted`
- **Icon for document link**: `FileText` from `lucide-react`, size 14px (`className="h-3.5 w-3.5"`)
- **Drawer slide animation**: Handled by Sheet component's built-in animations (200ms ease-out open, 150ms ease-in close)

### shadcn/ui Component Imports

```typescript
// Sheet (right-side drawer)
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";

// Card (metadata container)
import { Card, CardContent } from "@/components/ui/card";

// Tooltip (disabled link)
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";

// Skeleton (loading state)
import { Skeleton } from "@/components/ui/skeleton";

// ScrollArea (scrollable drawer body)
import { ScrollArea } from "@/components/ui/scroll-area";
```

### Accessibility Requirements

- `DocumentDrawer`: The Sheet component provides `role="dialog"`, `aria-modal="true"` automatically. Set `aria-label` on `SheetContent` to `"Document viewer: {title}"`. Focus traps and `Escape` close are built-in.
- `DocumentLink` (active): Render as `<button>` with `aria-label="{label}"`, focusable via Tab.
- `DocumentLink` (disabled): Render as `<span>` with `aria-disabled="true"`. Wrap in `Tooltip` for "Not available" context.
- `DocumentMetadata`: Use semantic `<dl>`, `<dt>`, `<dd>` elements for key-value pairs.

## Test Requirements

- [ ] `DocumentLink` with a non-null `path` calls `onDocClick` with the path when clicked
- [ ] `DocumentLink` with a `null` path renders as disabled (muted text, not clickable)
- [ ] `DocumentLink` with a `null` path shows "Not available" tooltip on hover
- [ ] `DocumentMetadata` renders all non-null frontmatter entries as key-value pairs
- [ ] `DocumentMetadata` skips entries where the value is `null` or `undefined`
- [ ] `MarkdownRenderer` renders a GFM table as an HTML `<table>` element
- [ ] `MarkdownRenderer` renders task list items with checkboxes
- [ ] `MarkdownRenderer` renders fenced code blocks with `bg-muted` styling
- [ ] `DocumentDrawer` shows loading skeletons when `open` is `true` and content is being fetched
- [ ] `DocumentDrawer` displays rendered markdown and metadata after successful fetch
- [ ] `DocumentDrawer` displays an error message when the API returns a non-200 response
- [ ] `DocumentDrawer` resets content when `docPath` changes (does not show stale content)

## Acceptance Criteria

- [ ] `ui/components/documents/document-drawer.tsx` exists as a `"use client"` component that renders a right-side `Sheet` with max-width `640px`
- [ ] `ui/components/documents/document-metadata.tsx` exists as a `"use client"` component that renders frontmatter as a `<dl>` key-value list inside a `Card`
- [ ] `ui/components/documents/markdown-renderer.tsx` exists as a `"use client"` component that uses `react-markdown` + `remark-gfm` + `rehype-sanitize` with `prose` classes
- [ ] `ui/components/documents/document-link.tsx` exists as a `"use client"` component with active/disabled states
- [ ] `ui/components/documents/index.ts` barrel-exports all four components
- [ ] `DocumentDrawer` fetches from `/api/projects/{name}/document?path={docPath}` when opened
- [ ] `DocumentDrawer` shows `Skeleton` loading state while fetching
- [ ] `DocumentDrawer` shows error state when fetch fails (message displayed in body)
- [ ] `DocumentLink` with `null` path renders as disabled with "Not available" `Tooltip`
- [ ] `DocumentLink` with valid path calls `onDocClick(path)` on click
- [ ] `DocumentMetadata` renders frontmatter using `<dl>`/`<dt>`/`<dd>` elements
- [ ] `MarkdownRenderer` correctly renders GFM tables, task lists, and fenced code blocks
- [ ] All components use proper TypeScript types (no `any`)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT modify any existing files — all files in this task are CREATE-only
- Do NOT import from or reference external planning documents
- Do NOT create the `useDocumentDrawer` hook — that belongs to T05
- Do NOT wire these components into the dashboard — that belongs to T05
- Do NOT modify `ui/types/components.ts` — use the existing `DocumentFrontmatter` and `DocumentResponse` types as-is
- Do NOT use `ui/lib/markdown-parser.ts` on the client — that is a server-side module using `gray-matter`. Use `react-markdown` directly for client-side rendering
- Use named exports (not default exports) for all components
- All components must be `"use client"` since they use React hooks or browser APIs
