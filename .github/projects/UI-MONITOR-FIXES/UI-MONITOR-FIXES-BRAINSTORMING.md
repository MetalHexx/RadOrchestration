---
project: "UI-MONITOR-FIXES"
author: "brainstormer-agent"
created: "2026-03-10T00:00:00Z"
---

# UI-MONITOR-FIXES — Brainstorming

## Problem Space

The monitoring UI (`ui/`) has several functional and presentation bugs that degrade the experience of working with the orchestration pipeline:

1. **Stale project data**: Several API routes were prerendered at `next build` time, so new projects created after a build never appear until the app is rebuilt.
2. **Document panel too narrow and not scrollable**: When opening a markdown document in the side panel, the panel width is too small and content at the bottom gets cut off with no way to scroll to it.
3. **Markdown not rendering properly**: Document content is displayed as raw or poorly styled text rather than rendered markdown — headings, tables, code blocks, and inline code are not styled as expected.

See screenshots in this project folder for reference:
- `Monitor-UI-Markdown-Rendering.png` — current state: how the ORCHESTRATION-REORG Master Plan document appears in the monitoring UI, showing the narrow panel and unstyled/poorly rendered markdown
- `Actual-Markdown-Rendering.png` — target state: the same document rendered correctly in VS Code, showing proper heading hierarchy, styled tables, inline code, and readable prose

## Validated Ideas

### Idea 1: Force Dynamic Rendering on All Filesystem-Reading API Routes

**Description**: Add `export const dynamic = 'force-dynamic'` to each API route handler that reads from the filesystem — specifically `/api/projects`, `/api/config`, and `/api/projects/[name]/state` and `/api/projects/[name]/document`. The `/api/events` route already has this correctly set.

**Rationale**: The root cause of missing/stale project data is that Next.js prerendered these routes at build time and cached them in `.next/server/app/api/*.body` files. Since the orchestration data changes constantly (new projects, state transitions, document updates), these routes must never be statically cached — every request must hit the live filesystem.

**Key considerations**:
- `events` route already has `force-dynamic` — it was done right the first time, the pattern just wasn't applied consistently
- Dynamic segments like `[name]` don't automatically imply dynamic rendering in the App Router; `force-dynamic` is still needed for filesystem reads
- The `config` route changes rarely but should still be dynamic to avoid a stale config bug after the user edits `orchestration.yml`

### Idea 3: Document Panel — Wider Width and Scrollable Content Area

**Description**: The document side panel (drawer) that opens when a user clicks a document link is too narrow, and there is no vertical scroll on the content area — so long markdown files are cut off at the bottom. The panel should be made wider and the content body should have `overflow-y: auto` (or equivalent) so all content is reachable.

**Rationale**: Documents like the Master Plan are long, structured files (multiple sections, tables, phase outlines). Truncating them without scroll makes the panel unusable for anything but the shortest files.

**Key considerations**:
- The panel is likely a `Sheet` or `Drawer` component from shadcn/ui — width is typically controlled via a `className` prop (e.g., `sm:max-w-xl` → `sm:max-w-2xl` or wider)
- The content area inside the panel needs its own scroll container, separate from the page scroll — a `max-h` + `overflow-y-auto` on the inner content div
- Width choice should balance reading comfort against not obscuring the main dashboard on smaller screens
- See `Monitor-UI-Markdown-Rendering.png` for current state (also shows the panel width and scroll issue)

### Idea 4: Markdown Rendering — Proper Typography and Component Styles

**Description**: The document panel displays markdown content, but it does not render with proper visual hierarchy. Headings, tables, code blocks, inline code, bold/italic, and lists should all be rendered with appropriate styles. The target rendering quality is shown in `Actual-Markdown-Rendering.png` (VS Code rendering) — clear heading levels, styled tables, code blocks with monospace fonts, and readable prose. Compare against `Monitor-UI-Markdown-Rendering.png` to see the gap.

**Rationale**: The primary purpose of the document panel is to read planning documents (PRDs, designs, architecture docs, master plans). These documents are heavily structured markdown. Without proper rendering they are hard to read and the panel adds no value over opening the raw file.

**Key considerations**:
- The app likely uses a markdown rendering library already (check for `react-markdown`, `marked`, or similar) — the issue may be that the output isn't styled with Tailwind Typography (`@tailwindcss/typography` `prose` classes)
- If `prose` classes are already applied, the issue might be specificity conflicts with global CSS or a missing `dark:prose-invert` for dark mode
- Code blocks should use a monospace font and have a distinct background — check that `pre` and `code` styles aren't being reset
- Tables should be bordered and have alternating row colors for readability
- See `Actual-Markdown-Rendering.png` for the expected output (VS Code) and `Monitor-UI-Markdown-Rendering.png` for the current broken state

### Idea 2: Audit and Validate That No Other Routes Are Accidentally Prerendered

**Description**: Add a test or validation step that checks all API routes under `ui/app/api/` for the presence of `force-dynamic` (or equivalent dynamic signals), failing the build or test suite if any filesystem-reading route is missing it.

**Rationale**: The same prerendering mistake could be reintroduced by any new API route added in the future. A lightweight structural test would catch this automatically, preventing the same class of bug from recurring.

**Key considerations**:
- Could be a simple unit test that reads the route source files and asserts the export is present
- Could live in the existing `tests/` directory alongside other validation tests
- Should not be overly strict — only routes that read from the filesystem need this flag

## Scope Boundaries

### In Scope
- Adding `force-dynamic` to `/api/projects/route.ts`
- Adding `force-dynamic` to `/api/config/route.ts`
- Adding `force-dynamic` to `/api/projects/[name]/state/route.ts`
- Adding `force-dynamic` to `/api/projects/[name]/document/route.ts`
- Widening the document side panel
- Making the document panel content area vertically scrollable
- Fixing markdown rendering so headings, tables, code blocks, and inline code are properly styled
- Optionally adding a test to prevent the prerendering bug from recurring

### Out of Scope
- Rebuilding or refactoring the API layer
- Changing the SSE/events architecture
- Caching strategy with `revalidate` timers
- A full UI redesign or theme change
- Adding new document types or panel features

## Key Constraints

- All changes are in the `ui/` directory; no backend or orchestration logic is affected
- Must not break the existing SSE (`/api/events`) behavior
- The `force-dynamic` fix must work without requiring a new `next build` — once the app is restarted with the fix in place, routes should be live
- Panel width changes must remain usable at common screen sizes (1280px+); avoid breaking layout on smaller viewports
- Markdown styling must work in both light and dark mode

## Open Questions

- What markdown library is currently in use for the document panel — `react-markdown`, `marked`, or something else? Is `@tailwindcss/typography` already installed?
- Is the panel a shadcn/ui `Sheet` component, a custom drawer, or something else? This determines how width is controlled.
- Are there any routes that could safely benefit from short-lived caching (e.g., 5s revalidate) rather than full dynamic rendering? (Likely not — the dataset is small)
- Should the build process be changed to warn when static output is detected for API routes?

## Summary

This project addresses three related bugs in the monitoring UI. First, several API routes are statically prerendered at build time, making new projects invisible until the app is rebuilt — fixed by adding `export const dynamic = 'force-dynamic'` to the affected handlers. Second, the document side panel is too narrow and lacks a scroll container, cutting off content in long files — fixed by widening the panel and adding overflow scroll to the content area. Third, markdown documents are not rendering with proper visual hierarchy (headings, tables, code blocks) — fixed by ensuring the correct Tailwind Typography `prose` classes (and dark mode variant) are applied to the rendered output. All three fixes are contained within the `ui/` directory.
