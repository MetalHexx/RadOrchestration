---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 2
task: 2
title: "SYNTAX-COPY-TABLES"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 3
---

# SYNTAX-COPY-TABLES

## Objective

Wire the rehype plugin pipeline into `MarkdownRenderer`, create the `CopyButton` overlay component for code blocks, add a custom `pre` component override that includes it, and verify GFM table rendering with the typography plugin.

## Context

Phase 2 Task 1 created two infrastructure modules: `ui/lib/shiki-adapter.ts` (exports `getShikiRehypeOptions()`) and `ui/lib/rehype-config.ts` (exports `getRehypePlugins()` returning the ordered plugin array: sanitize → shiki → slug → autolink). The shiki dual-theme CSS snippet is already in `globals.css`. `MarkdownRenderer` currently imports `rehype-sanitize` directly and passes it as its sole rehype plugin — this must be replaced with the centralized `getRehypePlugins()` call. The typography plugin (`@tailwindcss/typography`) was activated in Phase 1 and provides base table styling via `prose` classes.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/documents/copy-button.tsx` | New `CopyButton` overlay component |
| MODIFY | `ui/components/documents/markdown-renderer.tsx` | Replace `rehype-sanitize` with `getRehypePlugins()`, add enhanced `pre` override with `CopyButton` |
| MODIFY | `ui/components/documents/index.ts` | Export `CopyButton` |

## Implementation Steps

1. **Create `ui/components/documents/copy-button.tsx`**: Implement the `CopyButton` component as a `"use client"` component. It receives a `text` prop, uses `navigator.clipboard.writeText()` on click, swaps between `Copy` and `Check` icons (from `lucide-react`) with a 2-second success timeout, and includes an `aria-live="polite"` region for screen reader announcements.

2. **Update `MarkdownRenderer` imports**: Remove the direct `import rehypeSanitize from "rehype-sanitize"` line. Add `import { getRehypePlugins } from "@/lib/rehype-config"` and `import { CopyButton } from "./copy-button"`.

3. **Replace the `rehypePlugins` prop**: Change `rehypePlugins={[rehypeSanitize]}` to `rehypePlugins={getRehypePlugins()}` on the `ReactMarkdown` component.

4. **Enhance the `pre` component override**: Wrap the existing `<pre>` in a `relative group` container div. Position the `CopyButton` absolutely at `top-2 right-2`. Extract raw text from the `children` prop by recursively walking the React element tree to collect all text node strings, then pass the concatenated result as the `text` prop to `CopyButton`.

5. **Verify `code` component override**: Ensure the existing `code` override still correctly distinguishes inline code (no `className`) from fenced code blocks (has `className` with `language-*`). No changes should be needed to the inline code path.

6. **Verify `table` component override**: The existing `table` override wraps tables in `<div className="overflow-x-auto">`. Combined with the typography plugin's prose table styles, GFM tables should render with visible borders and alternating row shading. Confirm this works — no code changes expected unless prose table styles are missing borders or striping.

7. **Export `CopyButton` from `ui/components/documents/index.ts`**: Add `export { CopyButton } from "./copy-button"` to the barrel file.

8. **Build and verify**: Run `npm run build` from the `ui/` directory to confirm zero errors. Visually verify (if possible) that code blocks show syntax highlighting with the Copy button overlay, and tables render with borders.

## Contracts & Interfaces

### CopyButton Props

```typescript
// ui/components/documents/copy-button.tsx

interface CopyButtonProps {
  /** Raw text content to copy to clipboard */
  text: string;
}

function CopyButton(props: CopyButtonProps): React.JSX.Element;
```

### getRehypePlugins (from T01 — already implemented)

```typescript
// ui/lib/rehype-config.ts — import this, do NOT reimplement

import type { PluggableList } from 'unified';

/**
 * Returns the ordered rehype plugin array for react-markdown.
 * Plugin order: rehype-sanitize → @shikijs/rehype → rehype-slug → rehype-autolink-headings
 */
export function getRehypePlugins(): PluggableList;
```

### Current MarkdownRenderer (replace contents)

The current file at `ui/components/documents/markdown-renderer.tsx` is:

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  /** Markdown content string (frontmatter already stripped) */
  content: string;
}

const components: Components = {
  pre({ children, ...props }) {
    return (
      <pre
        className="bg-muted rounded-md p-3 overflow-x-auto text-sm"
        {...props}
      >
        {children}
      </pre>
    );
  },
  code({ children, className, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted px-1.5 py-0.5 rounded text-sm"
          {...props}
        >
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
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-1.5 align-middle"
          {...props}
        />
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
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### Current documents/index.ts (add CopyButton export)

```typescript
export { DocumentDrawer } from "./document-drawer";
export { DocumentMetadata } from "./document-metadata";
export { MarkdownRenderer } from "./markdown-renderer";
export { DocumentLink } from "./document-link";
```

## Styles & Design Tokens

### CopyButton Visual States

- **Default (hidden)**: Not visible; parent `pre` block is not hovered
- **Visible (hover on pre)**: Fades in via `group-hover:opacity-100` on the parent `div.group` wrapper. Position: `absolute top-2 right-2`. Background: `bg-background/80 backdrop-blur-sm`. Text: `text-muted-foreground`. Border: `rounded-md`. Padding: `p-1.5` or `h-8 w-8`.
- **Hover (on button itself)**: `bg-accent text-accent-foreground`
- **Success state**: Icon swaps to `Check` (lucide-react), color changes to `text-green-500` for 2 seconds, then reverts
- **Focus**: Visible focus ring via `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Touch devices**: Always visible (no hover) — use `opacity-0 group-hover:opacity-100` which degrades to always-visible on touch where `:hover` is sticky

### CopyButton Accessibility

- `aria-label="Copy code to clipboard"` on the button
- On success: screen reader announcement "Copied to clipboard" via a sibling `<span className="sr-only" aria-live="polite">` element
- Button is focusable and activates on Enter/Space (native `<button>` behavior)

### Pre/Code Block Container

- Wrapper: `<div className="relative group">` around `<pre>`
- Pre element: `bg-muted rounded-md p-3 overflow-x-auto text-sm` (existing styles preserved)
- Shiki will inject its own background via CSS variables — the `bg-muted` acts as a fallback for unsupported languages

### Table Styling (verification only — no code changes expected)

- Typography plugin provides: visible borders on `<th>` and `<td>`, bold header row, alternating row shading
- Horizontal scroll: existing `overflow-x-auto` wrapper from the `table` component override
- Dark mode: `prose-invert` handles table color inversion

### Shiki Dual-Theme CSS (already in globals.css — reference only)

```css
html.dark .shiki,
html.dark .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
```

## Test Requirements

- [ ] `npm run build` completes with zero errors in the `ui/` directory
- [ ] `MarkdownRenderer` no longer imports `rehype-sanitize` directly — it uses `getRehypePlugins()` from `@/lib/rehype-config`
- [ ] `getRehypePlugins()` is the sole value passed to `rehypePlugins` on the `ReactMarkdown` component
- [ ] `CopyButton` renders a `<button>` with `aria-label="Copy code to clipboard"`
- [ ] `CopyButton` calls `navigator.clipboard.writeText(text)` on click and shows `Check` icon for 2 seconds
- [ ] `CopyButton` includes an `aria-live="polite"` region that announces "Copied to clipboard" on success
- [ ] The `pre` component override wraps content in a `relative group` container with `CopyButton` positioned at `absolute top-2 right-2`
- [ ] The `pre` override extracts raw text from children for the `CopyButton` `text` prop
- [ ] Fenced code blocks with language annotations (e.g., ` ```js `) render with token-level syntax coloring via shiki
- [ ] Syntax highlighting respects dark/light theme (CSS variable toggle, no re-render)
- [ ] GFM tables render with visible borders and horizontal scroll on overflow
- [ ] `CopyButton` is exported from `ui/components/documents/index.ts`

## Acceptance Criteria

- [ ] `MarkdownRenderer` uses `getRehypePlugins()` from `@/lib/rehype-config` as its `rehypePlugins` value — no direct `rehype-sanitize` import remains
- [ ] `ui/components/documents/copy-button.tsx` exists and exports `CopyButton` with the contracted props interface
- [ ] `CopyButton` has `"use client"` directive, uses `navigator.clipboard.writeText()`, shows `Copy`→`Check` icon swap with 2-second timeout
- [ ] `CopyButton` has `aria-label="Copy code to clipboard"` and an `aria-live="polite"` success announcement
- [ ] The `pre` component override has a `relative group` wrapper with `CopyButton` overlay at `absolute top-2 right-2`, visibility toggled via `opacity-0 group-hover:opacity-100`
- [ ] Raw text extraction from `pre` children works for multi-line, multi-element code blocks (recursive text collection)
- [ ] Fenced code blocks render with shiki syntax highlighting (token-level coloring visible)
- [ ] GFM tables render with visible borders inside the `overflow-x-auto` wrapper
- [ ] `CopyButton` is exported from `ui/components/documents/index.ts`
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/lib/rehype-config.ts` or `ui/lib/shiki-adapter.ts` — they are complete from T01
- Do NOT modify `ui/app/globals.css` — the shiki CSS snippet is already in place from T01
- Do NOT add heading component overrides (h1–h6) — that is T03's scope
- Do NOT install any new npm packages — all dependencies were installed in T01
- Do NOT add a language label/badge to code blocks — out of scope for this task
- Use `lucide-react` for icons (`Copy`, `Check`) — do not add a new icon library
- Keep the `code` component override's inline code path unchanged
- Keep the `table` component override unchanged (only verify it works with prose styles)
- Keep the `input` (checkbox) component override unchanged
