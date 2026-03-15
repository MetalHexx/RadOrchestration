---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 3
task: 2
title: "MERMAID-COMPONENT"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 3
---

# MERMAID-COMPONENT

## Objective

Create `ui/components/documents/mermaid-block.tsx` — a `"use client"` component that renders mermaid diagram source code as inline SVG with loading, rendered, and error states, reactive theme switching, and accessibility attributes. Integrate mermaid detection into the existing `MarkdownRenderer` code component override so that fenced code blocks tagged with ` ```mermaid ` render `<MermaidBlock>` instead of a plain `<code>` element. Export `MermaidBlock` from the barrel file.

## Context

Phase 3 adds mermaid diagram rendering to the document viewer. Task T01 (complete) installed the `mermaid` npm package and created `ui/lib/mermaid-adapter.ts` — a singleton adapter that dynamically imports mermaid and exposes `initMermaid`, `renderDiagram`, and `updateTheme`. This task creates the React component that consumes that adapter and wires it into the existing `MarkdownRenderer`. The `code` component override in `MarkdownRenderer` already distinguishes inline vs. block code via the `className` check — this task adds a `language-mermaid` detection branch before the existing block code fallthrough. The adapter was reviewed and approved with no issues.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/documents/mermaid-block.tsx` | New client-only mermaid rendering component |
| MODIFY | `ui/components/documents/markdown-renderer.tsx` | Add `language-mermaid` detection in `code` component override |
| MODIFY | `ui/components/documents/index.ts` | Add `MermaidBlock` to barrel exports |

## Implementation Steps

1. **Create `mermaid-block.tsx`** — Add `"use client"` directive at the top of the file. Define `MermaidBlockProps` interface with a single `code: string` prop. Implement the component with three states: loading, rendered, and error.

2. **Implement state management** — Use `useState` for three pieces of state: `svgOutput` (string | null), `error` (string | null), and `isLoading` (boolean, default `true`). Generate a stable unique ID for the mermaid render container using `useRef` with a module-level counter (e.g., `mermaid-diagram-${counter++}`).

3. **Implement the render effect** — Use `useEffect` that depends on `code` and `resolvedTheme` (from `useTheme()`). Inside the effect: call `initMermaid(theme)` then `renderDiagram(id, code)`. On success set `svgOutput` to the SVG string and clear error. On failure set `error` to the caught message and clear `svgOutput`. Set `isLoading` to `false` in both cases.

4. **Implement theme reactivity** — When `resolvedTheme` changes (dependency of the effect), call `updateTheme(theme)` followed by `renderDiagram(id, code)` again. The existing effect already handles this since `resolvedTheme` is in the dependency array.

5. **Render loading state** — When `isLoading` is `true`, render: `<div className="bg-muted animate-pulse rounded-md h-48" role="img" aria-label="Loading diagram..." />`.

6. **Render error state** — When `error` is non-null, render: a container with a yellow warning badge (`⚠ Diagram render failed`) above the raw mermaid source displayed in a `<pre><code>` block styled identically to normal code blocks (`bg-muted rounded-md p-3 overflow-x-auto text-sm`).

7. **Render success state** — When `svgOutput` is non-null, render: `<div className="overflow-x-auto" role="img" aria-label={ariaLabel}><div dangerouslySetInnerHTML={{ __html: svgOutput }} /></div>`. Derive `ariaLabel` from the first line of `code`: `"Diagram: " + code.split('\n')[0].trim()`.

8. **Modify `MarkdownRenderer` `code` override** — Import `MermaidBlock` from `./mermaid-block`. In the `code` component function, after the `isInline` check returns inline code, add a mermaid detection branch: `if (className?.includes('language-mermaid'))`. Extract the text content from `children` using the existing `extractText` function. Return `<MermaidBlock code={text} />`.

9. **Update barrel exports** — Add `export { MermaidBlock } from "./mermaid-block";` to `ui/components/documents/index.ts`.

10. **Verify build** — Run `npm run build` in the `ui/` directory and confirm zero errors. Verify the mermaid library is NOT present in the initial page bundle (it is dynamically imported inside `useEffect` only).

## Contracts & Interfaces

### MermaidBlock Props

```typescript
// ui/components/documents/mermaid-block.tsx

interface MermaidBlockProps {
  /** Raw mermaid diagram source code */
  code: string;
}
```

### Mermaid Adapter Exports (from `ui/lib/mermaid-adapter.ts` — DO NOT MODIFY)

```typescript
/**
 * Initialize mermaid with the given theme. Safe to call multiple times —
 * re-initializes if theme has changed, no-op otherwise.
 * Dynamically imports the mermaid library on first call.
 *
 * @param theme - 'dark' or 'light' (maps to mermaid's 'dark' / 'default' themes)
 */
async function initMermaid(theme: 'dark' | 'light'): Promise<void>;

/**
 * Render a mermaid diagram and return the SVG markup.
 *
 * @param id - Unique element ID for the render container
 * @param code - Raw mermaid source code
 * @returns SVG markup string
 * @throws If mermaid fails to parse or render the diagram
 */
async function renderDiagram(id: string, code: string): Promise<string>;

/**
 * Update the mermaid theme. Call when the user toggles dark/light.
 * Subsequent renderDiagram calls will use the new theme.
 *
 * @param theme - 'dark' or 'light'
 */
async function updateTheme(theme: 'dark' | 'light'): Promise<void>;
```

### Current `code` Component Override (in `markdown-renderer.tsx`)

The existing code override that must be extended:

```typescript
code({ children, className, ...props }) {
  // If inside a <pre>, don't add inline styling (the pre handles it)
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
```

After modification, the mermaid branch is inserted between the inline check and the block fallthrough:

```typescript
code({ children, className, ...props }) {
  const isInline = !className;
  if (isInline) {
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    );
  }
  // Mermaid detection — render diagram instead of code block
  if (className?.includes('language-mermaid')) {
    const text = extractText(children);
    return <MermaidBlock code={text} />;
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
},
```

### extractText Utility (already exists in `markdown-renderer.tsx` — DO NOT RECREATE)

```typescript
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
```

### useTheme Hook (from `next-themes` — already available)

```typescript
import { useTheme } from "next-themes";
// Returns: { resolvedTheme: 'dark' | 'light' | undefined, ... }
```

## Styles & Design Tokens

- **Loading placeholder**: `bg-muted animate-pulse rounded-md h-48` — uses existing `--muted` token for background
- **Rendered SVG wrapper**: `overflow-x-auto` — allows horizontal scrolling for wide diagrams
- **Error badge**: Yellow warning badge above raw code. Use `text-yellow-600 dark:text-yellow-500 text-sm font-medium` for the `⚠ Diagram render failed` text
- **Error raw code block**: `bg-muted rounded-md p-3 overflow-x-auto text-sm font-mono` — matches standard code block styling
- **Mermaid theme mapping**: app `'dark'` → mermaid `'dark'`, app `'light'` → mermaid `'default'` (handled by the adapter, not the component)
- **Diagram placeholder background**: `--muted` (`var(--muted)`)

## Test Requirements

- [ ] A ` ```mermaid ` fenced code block in markdown content renders an SVG diagram (not raw text)
- [ ] The rendered SVG has `role="img"` and an `aria-label` starting with `"Diagram: "` followed by the first line of the mermaid source
- [ ] While the mermaid library loads, a pulsing placeholder (`bg-muted animate-pulse rounded-md h-48`) appears
- [ ] If the mermaid source is invalid (e.g., `invalid!!!`), the component renders the raw source in a code block with a `⚠ Diagram render failed` warning badge
- [ ] Toggling the theme from light to dark (or vice versa) causes the diagram to re-render with the updated mermaid theme
- [ ] Inline code elements (no className) are unaffected — still render with `bg-muted px-1.5 py-0.5 rounded text-sm`
- [ ] Non-mermaid fenced code blocks (e.g., ` ```typescript `) are unaffected — still render with syntax highlighting
- [ ] The `MermaidBlock` component uses `"use client"` directive — no SSR execution of mermaid
- [ ] `npm run build` succeeds with zero errors
- [ ] The mermaid library is NOT present in the initial page load bundle (dynamic import inside `useEffect` only)

## Acceptance Criteria

- [ ] `ui/components/documents/mermaid-block.tsx` exists with `"use client"` directive
- [ ] `MermaidBlock` accepts a `code: string` prop
- [ ] Loading state renders a `div` with classes `bg-muted animate-pulse rounded-md h-48`
- [ ] Rendered state outputs SVG via `dangerouslySetInnerHTML` inside an `overflow-x-auto` wrapper
- [ ] Rendered SVG container has `role="img"` and `aria-label="Diagram: {first line of source}"`
- [ ] Error state renders raw mermaid source in a styled code block with `⚠ Diagram render failed` badge
- [ ] `useTheme().resolvedTheme` drives theme-reactive re-rendering via `useEffect` dependency
- [ ] `MarkdownRenderer`'s `code` override detects `language-mermaid` in `className` and renders `<MermaidBlock>`
- [ ] `extractText` (existing function) is used to extract raw code text from `children`
- [ ] Non-mermaid code blocks and inline code are unaffected by the changes
- [ ] `ui/components/documents/index.ts` exports `MermaidBlock`
- [ ] No top-level `import` of `mermaid` anywhere — dynamic import via adapter only
- [ ] Build succeeds (`npm run build` — zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/lib/mermaid-adapter.ts` — it is complete and reviewed
- Do NOT add mermaid as a top-level import in any file — the adapter handles dynamic import
- Do NOT create a rehype plugin for mermaid — use the component override approach exclusively
- Do NOT add any new npm packages — all dependencies are already installed
- Do NOT recreate the `extractText` utility — it already exists in `markdown-renderer.tsx`
- Do NOT modify the `pre` component override — mermaid intercepts at the `code` level before the `pre` wrapper applies
- Do NOT add unit test files — this task focuses on component implementation; end-to-end verification via build and manual testing
