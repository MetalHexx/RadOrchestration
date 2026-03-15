---
project: "UI-MARKDOWN-IMPROVEMENTS"
author: "brainstormer-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Brainstorming

## Problem Space

The document viewer slide-out pane in the orchestration dashboard renders markdown as plain, unstyled text — headings look identical to body copy, code blocks lack syntax coloring, and there is no scrollbar on the content area, making long documents unusable. The pane is also too narrow to comfortably read dense planning documents. Navigation between documents is non-existent — the only way to move from one doc to the next is to close the pane and click a different link. Error logs and non-standard project docs are also not surfaced anywhere in the UI. These issues collectively make the document viewer feel unpolished and difficult to use as a first-class reading experience.

## Validated Goals

### Goal 1: Fix markdown heading and prose rendering

**Description**: Headings (h1–h6), bold, italic, blockquotes, lists, and other prose elements should render with proper visual hierarchy.  
**Rationale**: Currently `@tailwindcss/typography` is installed but not registered in `tailwind.config.ts`, so the `prose` classes in `MarkdownRenderer` have no effect. This is the root cause of the flat rendering.  
**Key considerations**: Tailwind v4 is in use; typography plugin registration differs from v3 and must be verified. No library switch needed — `react-markdown` already renders at runtime without compilation.

### Goal 2: Add scrollbar to the document content area

**Description**: The content area of the drawer should scroll independently, keeping the pane header (title + filename) fixed while the document body scrolls.  
**Rationale**: Long documents (PRDs, architecture docs, phase plans) overflow without scroll, cutting off content with no way to access it.  
**Key considerations**: The `ScrollArea` from shadcn is already imported in `document-drawer.tsx` but its layout context (flex, height) likely needs fixing to engage properly.

### Goal 3: Widen the slide-out pane to ~50% of the screen

**Description**: The drawer should be 50vw on large screens and full-width on mobile.  
**Rationale**: Planning documents are dense; the current `sm:max-w-[640px]` cap is insufficient on larger monitors.  
**Key considerations**: Responsive behavior — full-width on small screens, 50vw on `md`+ breakpoints. Currently set via `className="w-full sm:max-w-[640px]"` on `SheetContent`.

### Goal 4: Syntax highlighting for code blocks

**Description**: Fenced code blocks should render with VS Code-quality syntax coloring using shiki.  
**Rationale**: Architecture docs and task handoffs frequently contain code snippets; uncolored monospace blocks are hard to read.  
**Key considerations**: Use `@shikijs/rehype` — shiki's official rehype plugin, runtime-only, no compilation required. Richness is preferred over bundle size. Light/dark theme awareness needed (shiki supports dual themes via `defaultColor: false` or CSS variables).

### Goal 5: Table styling

**Description**: GFM tables should render with visible borders, alternating row backgrounds, and horizontal scroll on overflow.  
**Rationale**: PRDs and architecture docs use tables extensively for requirements and API contracts.  
**Key considerations**: `remark-gfm` already enables table parsing; styling is currently absent. Can be handled via prose plugin overrides or explicit `components` overrides in `MarkdownRenderer`.

### Goal 6: Copy-to-clipboard for code blocks

**Description**: Code blocks should have a copy button that copies the raw code to the clipboard.  
**Rationale**: Developers frequently copy commands or snippets from task handoffs; a click target is faster than manual selection.  
**Key considerations**: Component-level enhancement to the `pre`/`code` renderer in `MarkdownRenderer`. Uses the browser Clipboard API — no extra dependencies needed.

### Goal 7: Anchor links on headings

**Description**: Hovering a heading reveals a `#` anchor; clicking it smooth-scrolls to that heading within the pane.  
**Rationale**: Long documents benefit from in-pane navigation; the drawer is not a standard page so fragment URLs are not applicable.  
**Key considerations**: Requires slug generation (`rehype-slug`) and autolink injection (`rehype-autolink-headings`). Scroll target is the heading element inside the `ScrollArea` container, not `window`. No copy-to-clipboard — smooth-scroll only.

### Goal 8: Mermaid diagram rendering

**Description**: Fenced code blocks tagged ` ```mermaid ` should render as interactive SVG diagrams, not raw text.  
**Rationale**: Architecture docs and design documents use Mermaid for flowcharts, sequence diagrams, and dependency graphs — rendering them as visuals is essential for readability.  
**Key considerations**: Requires the `mermaid` JS library (runtime, no compilation). Must initialize mermaid client-side only (no SSR). Dark mode support via mermaid's built-in theme config. Must coexist with `rehype-sanitize` — mermaid blocks may need to bypass sanitization or be processed via a custom `code` component override in `react-markdown`.

### Goal 9: Previous / Next document navigation

**Description**: The document drawer should have Prev and Next buttons that move through all project documents in a defined top-to-bottom order matching how links are rendered in the UI.  
**Rationale**: Reviewing a project end-to-end requires repeatedly closing and reopening the pane to navigate between docs. Inline navigation keeps the user in flow.  
**Key considerations**: The canonical document order follows the UI rendering sequence:
1. Planning docs (in `PLANNING_STEP_ORDER`: Research → PRD → Design → Architecture → Master Plan)
2. Per-phase, per-task documents in execution order: Phase Plan → Task Handoffs (T1…Tn) → Task Reports → Task Reviews
3. Phase Report → Phase Review (after all tasks in a phase)
4. Error Log (if present)
5. Other Docs (non-standard project files — see Goal 11)

The ordered list must be derived from the current project's `state.json` output documents at render time — not hardcoded — since phases and tasks vary per project. Buttons should be disabled (not hidden) at the first and last document. Navigating to the next/prev doc should reset scroll position to the top of the content area.

### Goal 10: Error log surfacing in the UI

**Description**: If a project has an `{NAME}-ERROR-LOG.md` file (created by the `log-error` skill), it should be visible and openable in the document viewer.  
**Rationale**: Error logs are critical operational artifacts — when the pipeline fails, developers need a clear path to find and read the error log without digging through the filesystem. Currently there is no UI surface for them.  
**Key considerations**: Error logs follow the naming convention `{NAME}-ERROR-LOG.md` in the project folder. The UI should detect their presence (via the project's file listing or `state.json`) and render a link in the dashboard — likely in a dedicated "Error Log" section or appended to the existing error log card. Should appear in the Prev/Next navigation order (after all phase/task docs, before Other Docs).

### Goal 11: "Other Docs" section for non-standard project files

**Description**: Any markdown files in the project folder that do not match the standard naming conventions (PRD, Design, Architecture, etc.) should be discoverable via an "Other Docs" section in the UI.  
**Rationale**: Projects may accumulate non-pipeline docs — brainstorming files, spike notes, ADRs, etc. These are invisible in the current UI. An "Other Docs" bucket prevents important context from becoming orphaned.  
**Key considerations**: Detection logic: scan the project folder for `.md` files not claimed by the standard naming patterns. Display as a simple list of clickable links. Ordering within Other Docs is alphabetical. These docs appear last in the Prev/Next navigation sequence.

## Scope Boundaries

### In Scope
- `MarkdownRenderer` component styling and plugin enhancements
- `DocumentDrawer` layout (width, scroll area, flex structure, prev/next navigation)
- Tailwind typography plugin configuration fix
- Syntax highlighting via `@shikijs/rehype` (runtime, VS Code-quality)
- Mermaid diagram rendering via `mermaid` JS library (runtime, client-side only)
- Table, code block, and heading component overrides within `react-markdown`
- Anchor smooth-scroll for headings within the pane
- Prev/Next document navigation buttons with ordering derived from `state.json`
- Error log detection and surfacing in the dashboard UI
- "Other Docs" section for non-standard project markdown files

### Out of Scope
- Switching away from `react-markdown` — MDX and compiled approaches are rejected (real-time pull required)
- Editing or generating markdown content
- Adding a markdown editor / write mode
- Other dashboard panels beyond the document viewer and project doc sections

## Key Constraints

- **Runtime-only rendering**: Markdown must be processed entirely in the browser at runtime. No build-time compilation, no MDX transform, no server-side rendering of markdown content.
- **Existing stack**: `react-markdown` + `remark-gfm` + `rehype-sanitize` are already installed and should be preserved. New plugins must be compatible.
- **Richness over bundle size**: For syntax highlighting, shiki is chosen over rehype-highlight for VS Code-quality output, accepting the larger bundle as a worthwhile tradeoff.
- **Tailwind v4**: Plugin registration syntax differs from v3 — must verify typography plugin works under the v4 `@import "tailwindcss"` CSS-first config (may require `@plugin` directive in `globals.css`).
- **shadcn/ui**: Sheet, ScrollArea, and other primitives come from shadcn; layout changes must work within those component constraints.
- **Dark mode**: The app uses a `dark` class toggle; shiki themes, mermaid themes, and prose styles must all respect `dark:` variants.
- **SSR safety**: Mermaid must only initialize client-side — use dynamic import or `useEffect` to avoid SSR errors in Next.js.

## Open Questions

- Does `@tailwindcss/typography` fully support Tailwind v4's CSS-first config? Research should verify whether `@plugin "@tailwindcss/typography"` in `globals.css` is required instead of the `plugins` array in `tailwind.config.ts`.
- What rehype plugin ordering is required for shiki + rehype-slug + rehype-autolink-headings + rehype-sanitize to coexist? Sanitization may strip attributes injected by slug/autolink plugins if it runs in the wrong order, or may need schema adjustments.
- How should mermaid blocks interact with `rehype-sanitize`? The sanitizer may strip SVG output. A custom `code` component override that detects `language-mermaid` and renders client-side may be cleaner than the rehype pipeline.
- What is the best source of truth for building the Prev/Next ordered document list? `state.json` has `output` paths on each step/task — Research should confirm whether all doc paths are reliably populated there, or whether a filesystem scan is needed as a fallback.
- How does the existing `/api/projects` or document fetch API expose the project folder's file listing? Surfacing Other Docs and Error Logs requires enumerating files not already tracked in `state.json` — Research should determine if a new API endpoint is needed.

## Summary

The document viewer in the orchestration dashboard needs a focused round of UX polish across 11 goals: fix the broken Tailwind typography plugin (root cause of flat rendering), enable pane scrolling with a fixed header, widen the drawer to 50vw on desktop, add VS Code-quality syntax highlighting via shiki (`@shikijs/rehype`), style GFM tables, add copy-to-clipboard on code blocks, add smooth-scroll heading anchors, render Mermaid diagrams via the `mermaid` JS library, add Prev/Next navigation through all project docs in UI-render order, surface error logs in the dashboard, and add an "Other Docs" section for non-standard project files. All rendering changes are runtime-only — no compilation, no MDX. New libraries: `@shikijs/rehype`, `mermaid`. Primary file targets are `ui/components/documents/markdown-renderer.tsx`, `ui/components/documents/document-drawer.tsx`, `ui/components/dashboard/`, and `ui/app/globals.css`.
