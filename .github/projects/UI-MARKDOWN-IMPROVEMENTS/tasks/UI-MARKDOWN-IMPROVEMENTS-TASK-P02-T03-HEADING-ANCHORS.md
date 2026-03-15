---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 2
task: 3
title: "HEADING-ANCHORS"
status: "pending"
skills_required: ["run-tests"]
skills_optional: ["generate-task-report"]
estimated_files: 1
---

# HEADING-ANCHORS

## Objective

Add custom heading component overrides (h1–h6) to `MarkdownRenderer` that display a hover-visible hash-icon anchor link on each heading and implement smooth in-pane scrolling targeting the `ScrollArea` viewport element — not the browser window — so heading anchor clicks scroll within the document drawer.

## Context

The `MarkdownRenderer` component already uses a centralized rehype plugin pipeline (`getRehypePlugins()` from `@/lib/rehype-config`) that includes `rehype-slug` (adds `id` attributes to headings) and `rehype-autolink-headings` (adds `<a>` anchor links inside headings). These plugins are active and producing heading IDs and anchor elements in the rendered output. The document content renders inside a `ScrollArea` component in `DocumentDrawer`; the scrollable viewport is the element with `data-slot="scroll-area-viewport"`. The `Hash` icon from `lucide-react` is the anchor icon. Carry-forward from T02 review: no blocking issues; the T02 review recommended a future try/catch for `CopyButton` — this is unrelated to T03.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/components/documents/markdown-renderer.tsx` | Add heading component overrides (h1–h6) with anchor link styling and click handler |

## Implementation Steps

1. **Import `Hash` from `lucide-react`** at the top of `markdown-renderer.tsx`.

2. **Create a `HeadingAnchor` helper component** inside `markdown-renderer.tsx` (not exported) that renders an anchor link with the `Hash` icon. It accepts `id` (heading id), `children` (heading content), and `level` (1–6). The component:
   - Wraps the heading element (`h1`–`h6` based on `level`) with `className="group"` to enable group-hover on descendants.
   - Renders the heading's children followed by an `<a>` element containing the `<Hash>` icon.
   - The `<a>` element has:
     - `href={`#${id}`}` so the link is semantically correct
     - `aria-label={`Link to section: ${extractText(children)}`}` for screen readers
     - `className="inline-flex items-center ml-1 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"`
   - The `<Hash>` icon has `size={level <= 2 ? 18 : 14}` and `aria-hidden="true"`.
   - An `onClick` handler that calls `event.preventDefault()` then smooth-scrolls to the target heading within the `ScrollArea` viewport (see step 3).

3. **Implement the smooth scroll click handler** inside the `<a>` `onClick`:
   ```
   event.preventDefault();
   const target = document.getElementById(id);
   if (!target) return;
   const viewport = target.closest('[data-slot="scroll-area-viewport"]');
   if (!viewport) return;
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   viewport.scrollTo({
     top: target.offsetTop - viewport.getBoundingClientRect().top + viewport.scrollTop - 16,
     behavior: prefersReducedMotion ? 'instant' : 'smooth',
   });
   ```
   The key logic: find the target element by `id`, locate its nearest `ScrollArea` viewport ancestor via `data-slot="scroll-area-viewport"`, compute the scroll offset relative to the viewport, and scroll with `behavior: 'smooth'` (or `'instant'` when the user prefers reduced motion). The `- 16` provides a small top margin above the heading.

   **Simplified scroll offset**: Since the target heading is a descendant of the viewport, use `target.offsetTop` relative to the viewport's scroll container. The correct calculation:
   ```
   const targetTop = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
   viewport.scrollTo({ top: targetTop - 16, behavior: prefersReducedMotion ? 'instant' : 'smooth' });
   ```

4. **Create heading override entries** in the `components` object. For each level (h1–h6), add a component override that delegates to `HeadingAnchor`:
   ```
   h1({ children, id, ...props }) {
     return <HeadingAnchor level={1} id={id} {...props}>{children}</HeadingAnchor>;
   },
   h2({ children, id, ...props }) {
     return <HeadingAnchor level={2} id={id} {...props}>{children}</HeadingAnchor>;
   },
   // ... h3 through h6
   ```
   Place these inside the existing `components` object alongside the `pre`, `code`, `table`, and `input` overrides.

5. **Verify the URL hash does NOT change** on anchor click. The `event.preventDefault()` in step 3 prevents the browser from updating the URL hash — the scroll is purely scoped to the pane.

6. **Run `npm run build`** from `ui/` to verify zero build errors and zero type errors.

## Contracts & Interfaces

The `HeadingAnchor` component is internal to `markdown-renderer.tsx` — no exported interface. It must conform to the `react-markdown` component override signature:

```typescript
// react-markdown component override signature for headings
// The `id` prop is injected by rehype-slug
interface HeadingOverrideProps {
  children?: React.ReactNode;
  id?: string;
  [key: string]: unknown;
}

// Internal HeadingAnchor component props
interface HeadingAnchorProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id?: string;
  children?: React.ReactNode;
}
```

The heading tag is dynamically selected based on `level`:

```typescript
const Tag = `h${level}` as const;
```

## Styles & Design Tokens

- **Anchor link (default)**: `opacity-0` — hidden until heading is hovered or anchor is focused
- **Anchor link (heading hovered)**: `group-hover:opacity-70` — appears at 70% opacity when the heading row is hovered
- **Anchor link (focused)**: `focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded` — fully visible with focus ring
- **Anchor link text color**: `text-muted-foreground` (maps to `--muted-foreground` CSS variable)
- **Anchor link transition**: `transition-opacity` for smooth fade-in/out
- **Hash icon size**: `18px` for h1 and h2; `14px` for h3–h6
- **Hash icon attributes**: `aria-hidden="true"` (decorative, the `<a>` has `aria-label`)
- **Anchor spacing**: `ml-1` (4px margin-left) between heading text and hash icon
- **Anchor display**: `inline-flex items-center` to vertically center the icon with the heading text
- **Heading wrapper**: `className="group"` on the heading element (`h1`–`h6`) to enable `group-hover` on the anchor child
- **Scroll behavior**: `behavior: 'smooth'` (or `'instant'` when `prefers-reduced-motion: reduce` matches)
- **Scroll offset padding**: `16px` (1rem) above the heading after scrolling

## Current File State

The current `ui/components/documents/markdown-renderer.tsx` (as modified by P02-T02):

```tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getRehypePlugins } from "@/lib/rehype-config";
import { CopyButton } from "./copy-button";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return extractText(children);
  }
  return "";
}

const components: Components = {
  pre({ children, ...props }) {
    const text = extractText(children);
    return (
      <div className="relative group">
        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-sm" {...props}>
          {children}
        </pre>
        <CopyButton text={text} />
      </div>
    );
  },
  code({ children, className, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto">
        <table {...props}>{children}</table>
      </div>
    );
  },
  input({ type, checked, ...props }) {
    if (type === "checkbox") {
      return (
        <input type="checkbox" checked={checked} disabled className="mr-1.5 align-middle" {...props} />
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={getRehypePlugins()}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

## Scroll Target Details

The document content renders inside `DocumentDrawer` → `ScrollArea`. The `ScrollArea` component (from `@base-ui/react/scroll-area`) renders a **viewport element** with `data-slot="scroll-area-viewport"`. This viewport is the actual scrollable container — NOT the window.

DOM structure in `DocumentDrawer`:
```
<div ref={scrollAreaRef} className="flex-1 min-h-0">
  <ScrollArea className="h-full">
    <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="size-full ...">
      <div className="px-6 py-4">
        <!-- DocumentMetadata -->
        <!-- MarkdownRenderer (heading targets live here) -->
      </div>
    </ScrollAreaPrimitive.Viewport>
  </ScrollArea>
</div>
```

To smooth-scroll to a heading, the click handler must:
1. Find the target heading element by its `id` attribute (set by `rehype-slug`)
2. Walk up the DOM to find the nearest ancestor with `data-slot="scroll-area-viewport"`
3. Call `viewport.scrollTo({ top: ..., behavior: 'smooth' })` with the calculated offset
4. Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and use `'instant'` if true

## Test Requirements

- [ ] Each heading level (h1–h6) renders with a `group` class on the heading element
- [ ] Each heading contains an `<a>` child with `aria-label` starting with "Link to section:"
- [ ] The `<a>` element contains a `Hash` icon (Lucide) with `aria-hidden="true"`
- [ ] Anchor links are invisible by default (`opacity-0`) and visible on heading hover (`group-hover:opacity-70`)
- [ ] Anchor links are fully visible when focused (`focus-visible:opacity-100`) with a focus ring
- [ ] Clicking an anchor link does NOT change the URL hash (confirmed by `event.preventDefault()`)
- [ ] Clicking an anchor link smooth-scrolls within the `ScrollArea` viewport to the target heading
- [ ] When `prefers-reduced-motion: reduce` is active, scrolling is instant (not smooth)
- [ ] `npm run build` succeeds with zero errors from `ui/`

## Acceptance Criteria

- [ ] `ui/components/documents/markdown-renderer.tsx` contains heading component overrides for h1–h6 in the `components` object
- [ ] Each heading override renders a `group`-classed heading tag with an anchor link containing a `Hash` icon
- [ ] Anchor link has `aria-label="Link to section: {heading text}"` using `extractText()` to derive heading text
- [ ] Anchor link classes include `opacity-0 group-hover:opacity-70 transition-opacity text-muted-foreground`
- [ ] Anchor link has `focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring` for keyboard accessibility
- [ ] Click handler calls `event.preventDefault()` and scrolls the `[data-slot="scroll-area-viewport"]` element (not `window.scrollTo`)
- [ ] Click handler respects `prefers-reduced-motion: reduce` by using `behavior: 'instant'`
- [ ] Hash icon size is `18` for h1/h2 and `14` for h3–h6
- [ ] `Hash` is imported from `lucide-react`
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors

## Constraints

- Do NOT modify any file other than `ui/components/documents/markdown-renderer.tsx`
- Do NOT change the existing `pre`, `code`, `table`, or `input` component overrides
- Do NOT modify `ui/lib/rehype-config.ts` — the plugin pipeline is already configured with `rehype-slug` and `rehype-autolink-headings`
- Do NOT use `window.scrollTo` — all scrolling must target the `ScrollArea` viewport element
- Do NOT update the URL hash on anchor click — use `event.preventDefault()`
- Do NOT add new npm dependencies — `lucide-react` is already installed
- Do NOT export `HeadingAnchor` — it is an internal helper component
- Reuse the existing `extractText()` function for deriving heading text for `aria-label`
