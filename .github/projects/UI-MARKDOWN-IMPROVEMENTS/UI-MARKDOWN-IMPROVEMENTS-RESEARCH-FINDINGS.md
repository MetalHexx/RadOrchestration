---
project: "UI-MARKDOWN-IMPROVEMENTS"
author: "research-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Research Findings

## Research Scope

Investigated the orchestration dashboard UI codebase (`ui/`) to understand the current document viewer architecture, assess library compatibility for 11 planned improvements (typography, syntax highlighting, mermaid diagrams, scroll/layout, heading anchors, Prev/Next navigation, error log surfacing, Other Docs), validate rehype plugin ordering requirements, and determine API gaps for file listing and document navigation.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| MarkdownRenderer | `ui/components/documents/markdown-renderer.tsx` | Primary render component — applies `prose` classes (currently non-functional), uses `react-markdown` + `remark-gfm` + `rehype-sanitize`, has custom `components` overrides for `pre`, `code`, `table`, `input` |
| DocumentDrawer | `ui/components/documents/document-drawer.tsx` | Slide-out pane — uses `Sheet` (side="right"), `ScrollArea`, width capped at `sm:max-w-[640px]`, no Prev/Next nav |
| DocumentLink | `ui/components/documents/document-link.tsx` | Clickable link to open a document — calls `onDocClick(path)`, disabled state with tooltip when `path === null` |
| DocumentMetadata | `ui/components/documents/document-metadata.tsx` | Renders frontmatter key/value pairs in a `Card` with `bg-muted` |
| useDocumentDrawer | `ui/hooks/use-document-drawer.ts` | Hook managing drawer open/close, fetch lifecycle, abort controller — fetches from `/api/projects/{name}/document?path=...` |
| Document API | `ui/app/api/projects/[name]/document/route.ts` | Serves individual document content — resolves path, validates traversal, parses frontmatter via `gray-matter`, returns `{ frontmatter, content, filePath }` |
| State API | `ui/app/api/projects/[name]/state/route.ts` | Serves normalized project state |
| Projects API | `ui/app/api/projects/route.ts` | Lists all discovered projects (subdirs of base_path with state.json status) |
| Normalizer | `ui/lib/normalizer.ts` | Converts raw state.json (v1/v2/v3) into `NormalizedProjectState` — maps all doc paths to canonical field names |
| Path Resolver | `ui/lib/path-resolver.ts` | `resolveDocPath()` resolves relative doc paths to absolute filesystem paths; strips project prefix if present |
| FS Reader | `ui/lib/fs-reader.ts` | `discoverProjects()`, `readProjectState()`, `readDocument()`, `fileExists()` — all filesystem operations |
| Markdown Parser | `ui/lib/markdown-parser.ts` | Uses `gray-matter` to split frontmatter from body |
| State Types | `ui/types/state.ts` | Full type definitions — `NormalizedProjectState`, `NormalizedPhase`, `NormalizedTask`, `PLANNING_STEP_ORDER` constant |
| Component Types | `ui/types/components.ts` | `DocumentResponse`, `DocumentFrontmatter`, `ProjectSummary`, `GateEntry` |
| globals.css | `ui/app/globals.css` | Tailwind v4 CSS-first config — `@import "tailwindcss"`, `@custom-variant dark`, full color token system |
| tailwind.config.ts | `ui/tailwind.config.ts` | `darkMode: "class"`, `plugins: []` (empty — typography plugin NOT registered) |
| postcss.config.mjs | `ui/postcss.config.mjs` | Uses `@tailwindcss/postcss` plugin |
| Sheet component | `ui/components/ui/sheet.tsx` | shadcn Sheet built on `@base-ui/react` Dialog — `SheetContent` is a fixed `flex flex-col` container, `data-[side=right]` uses `w-3/4` and `sm:max-w-sm` |
| ScrollArea component | `ui/components/ui/scroll-area.tsx` | shadcn ScrollArea built on `@base-ui/react` — viewport is `size-full`, needs parent height constraint to scroll |
| Theme toggle | `ui/components/theme/theme-toggle.tsx` | System/dark/light toggle using `useTheme` hook |
| useTheme | `ui/hooks/use-theme.ts` | Custom hook — adds/removes `.dark` class on `documentElement`, persists to `localStorage` |
| Layout | `ui/app/layout.tsx` | Inline script applies `.dark` before hydration; Inter font via `--font-inter` variable |
| MainDashboard | `ui/components/layout/main-dashboard.tsx` | Orchestrates all dashboard sections — passes `onDocClick` down to PlanningSection, ExecutionSection, etc. |
| PlanningChecklist | `ui/components/planning/planning-checklist.tsx` | Renders planning steps in `PLANNING_STEP_ORDER`, each with a `DocumentLink` using `step.output` as path |
| PhaseCard | `ui/components/execution/phase-card.tsx` | Renders phase with accordion — `DocumentLink` for phase plan, phase report, phase review |
| TaskCard | `ui/components/execution/task-card.tsx` | Renders task row — `DocumentLink` for handoff, report, review |
| ErrorLogSection | `ui/components/dashboard/error-log-section.tsx` | Shows retry/halt counts and active blockers — does NOT link to error log document |
| FinalReviewSection | `ui/components/dashboard/final-review-section.tsx` | Shows final review status — has `DocumentLink` for `report_doc` |
| Home page | `ui/app/page.tsx` | Top-level page — wires `useProjects`, `useDocumentDrawer`, renders `DocumentDrawer` as overlay |

### Existing Patterns

- **Component library**: shadcn/ui components from `@base-ui/react` (not Radix) — `Sheet`, `ScrollArea`, `Accordion`, `Card`, `Button`, `Badge`, `Tooltip`, `ToggleGroup`
- **State management**: `useProjects` hook fetches from `/api/projects` and `/api/projects/[name]/state`, stores in React state, updates via SSE events
- **Document fetch**: `useDocumentDrawer` hook manages drawer state + document fetching; API returns `{ frontmatter, content, filePath }`
- **Doc click pattern**: Every component receiving `onDocClick: (path: string) => void` — prop-drills from `Home` → `MainDashboard` → section → component → `DocumentLink`
- **Naming convention**: Components in `PascalCase`, hooks in `use-kebab-case.ts`, API routes in `route.ts` under RESTful paths
- **Dark mode**: Class-based (`html.dark`), custom `useTheme` hook, `dark:` Tailwind variant with `@custom-variant dark (&:is(.dark *))` in CSS
- **SSE for live updates**: `useSSE` hook with reconnect logic, receives `state_change`, `project_added`, `project_removed` events
- **Path handling**: Doc paths in state.json are relative to project dir; `resolveDocPath()` supports both prefixed and bare relative paths

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14.2.35 | Pages use `"use client"` directive; API routes use Route Handlers |
| React | React | ^18 | Client-side rendering for all dashboard components |
| CSS | Tailwind CSS | ^4.2.1 | v4 CSS-first config via `@import "tailwindcss"` in globals.css |
| PostCSS | @tailwindcss/postcss | ^4.2.1 | PostCSS plugin for Tailwind v4 |
| Component lib | shadcn/ui | ^4.0.2 | Built on `@base-ui/react` ^1.2.0 (not Radix) |
| Markdown | react-markdown | ^9.1.0 | Runtime rendering, `rehypePlugins` and `components` props |
| Remark | remark-gfm | ^4.0.1 | GFM tables, strikethrough, task lists, autolinks |
| Rehype | rehype-sanitize | ^6.0.0 | HTML sanitization with configurable schema |
| Typography | @tailwindcss/typography | ^0.5.19 | Installed but NOT registered — `plugins: []` in config, no `@plugin` in CSS |
| Icons | lucide-react | ^0.300.0 | Icon library |
| Frontmatter | gray-matter | ^4.0.3 | YAML frontmatter parsing |
| YAML | yaml | ^2.8.2 | YAML parsing for orchestration.yml |
| File watch | chokidar | ^3.6.0 | Filesystem watching for SSE events |
| TypeScript | TypeScript | ^5 | Strict mode |

## External Research

### @tailwindcss/typography — Tailwind v4 Registration

| Source | Key Finding |
|--------|-------------|
| [tailwindcss-typography README](https://github.com/tailwindlabs/tailwindcss-typography) | For Tailwind v4 CSS-first config, add `@plugin "@tailwindcss/typography";` to the main CSS file (globals.css). The `plugins` array in `tailwind.config.ts` is the v3 approach and is ignored by Tailwind v4's CSS-first pipeline. |
| Current codebase | `@tailwindcss/typography` v0.5.19 is installed in `dependencies` but NOT registered anywhere — `tailwind.config.ts` has `plugins: []` and `globals.css` has no `@plugin` directive. This is the root cause of flat prose rendering. |
| Dark mode | `prose-invert` class already used in `MarkdownRenderer` (`dark:prose-invert`) — will work once the plugin is registered. |

**Fix**: Add `@plugin "@tailwindcss/typography";` to `ui/app/globals.css` after the existing imports.

### @shikijs/rehype — Syntax Highlighting

| Source | Key Finding |
|--------|-------------|
| [shiki docs](https://shiki.style/packages/rehype) | `@shikijs/rehype` v4.0.2 is a standard rehype plugin — passes directly to `react-markdown`'s `rehypePlugins` prop. Uses a singleton highlighter by default; supports `themes` option for dual themes. |
| [npm](https://www.npmjs.com/package/@shikijs/rehype) | 401K weekly downloads, MIT license, 6 dependencies, actively maintained (last publish 6 days ago), provenance from GitHub Actions. |
| [Dual themes docs](https://shiki.style/guide/dual-themes) | With `themes: { light: '...', dark: '...' }` and `defaultColor: false`, shiki emits CSS variables (`--shiki-light`, `--shiki-dark`) on each `<span>`. Requires a small CSS snippet to toggle based on `.dark` class. |
| Compatibility with react-markdown | Works as a rehype plugin on HAST (HTML AST). `react-markdown` internally uses `remark-parse` → `remark-rehype` → rehype plugins → React elements. `@shikijs/rehype` operates at the rehype stage and is fully compatible. No build step needed. |

**Dual theme CSS** (for class-based dark mode):
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

### rehype-slug + rehype-autolink-headings

| Source | Key Finding |
|--------|-------------|
| [rehype-slug npm](https://www.npmjs.com/package/rehype-slug) | v6.0.0, 1.6M weekly downloads, MIT, 0 open issues. Adds `id` attributes to headings based on text content (uses `github-slugger`). |
| [rehype-autolink-headings npm](https://www.npmjs.com/package/rehype-autolink-headings) | v7.1.0, 893K weekly downloads, MIT, 0 open issues. Adds `<a>` links inside headings that have `id` attributes. Supports behaviors: `prepend`, `append`, `wrap`, `before`, `after`. |
| Dependency | `rehype-autolink-headings` requires headings to already have `id` attributes — must run **after** `rehype-slug`. |

### rehype-sanitize — Plugin Ordering & Compatibility

| Source | Key Finding |
|--------|-------------|
| [rehype-sanitize README](https://github.com/rehypejs/rehype-sanitize) | "Use `rehype-sanitize` **after the last unsafe thing**: everything after `rehype-sanitize` could be unsafe (but is fine if you do trust it)." |
| Syntax highlighting example | For highlighting plugins: Place `rehype-sanitize` **first** with a custom schema allowing `className` patterns on `code` elements (e.g., `/^language-./`), then run the highlighter after. The highlighter operates on already-sanitized content, so its output (inline styles, spans) survives. |
| DOM clobbering example | `rehype-sanitize` prefixes `id` and `name` attributes with `user-content-` by default. If `rehype-slug` runs **after** sanitize, its generated IDs won't be prefixed (since they're added post-sanitization). |
| Shiki specifics | Shiki injects inline `style` attributes with CSS variables on `<span>` elements. `rehype-sanitize` strips inline styles by default. If sanitize runs **after** shiki, all highlighting would be destroyed. Running sanitize **before** shiki avoids this entirely. |

### mermaid — Client-Side Diagram Rendering

| Source | Key Finding |
|--------|-------------|
| [npm](https://www.npmjs.com/package/mermaid) | v11.13.0, 3.6M weekly downloads, MIT, 1092 dependents, OpenSSF Scorecard listed, provenance from GitHub Actions. Actively maintained. |
| SSR safety | Mermaid accesses the DOM directly — must be imported client-side only in Next.js. Use `dynamic(() => import('mermaid'), { ssr: false })` or `useEffect` with `import('mermaid')`. |
| Dark mode | Mermaid has built-in theme support: `mermaid.initialize({ theme: 'dark' })` switches to a dark theme. Can be toggled reactively via `resolvedTheme` from `useTheme`. |
| Interaction with rehype-sanitize | Mermaid should **not** go through the rehype pipeline. The recommended approach is a custom `code` component override in `react-markdown` that detects `language-mermaid` class and renders the diagram client-side via the mermaid API. This bypasses sanitization entirely and avoids conflicts with shiki. |
| Bundle size | Unpacked: 71.1 MB, 820 files. Acceptable per brainstorming constraint ("richness over bundle size"), but should be dynamically imported to avoid loading on pages without mermaid blocks. |

### Library Security & Supply Chain Assessment

| Library | Weekly Downloads | Last Published | Provenance | Assessment |
|---------|-----------------|----------------|------------|------------|
| `@shikijs/rehype` | 401K | 6 days ago | GitHub Actions ✓ | Safe — part of shiki monorepo by @antfu, widely adopted |
| `mermaid` | 3.6M | 6 days ago | GitHub Actions ✓ | Safe — mermaid-js org, OpenSSF Scorecard, extensive CI |
| `rehype-slug` | 1.6M | 3 years ago | unified collective | Safe — mature, zero issues, unified ecosystem |
| `rehype-autolink-headings` | 893K | 2 years ago | unified collective | Safe — mature, zero issues, unified ecosystem |

No supply chain concerns were identified for any proposed library. All are MIT-licensed, maintained by established organizations (shikijs, mermaid-js, rehypejs/unified), and have provenance attestation.

## Constraints Discovered

- **Typography plugin not registered**: `@tailwindcss/typography` v0.5.19 is installed but completely non-functional. The `plugins: []` array in `tailwind.config.ts` is the Tailwind v3 registration approach. Tailwind v4 requires `@plugin "@tailwindcss/typography";` in the CSS file.
- **Sheet width override**: The `SheetContent` base component applies `data-[side=right]:w-3/4` and `data-[side=right]:sm:max-w-sm`. The `DocumentDrawer` adds `className="w-full sm:max-w-[640px]"`. Both need to be overridden for 50vw on desktop.
- **ScrollArea needs height constraint**: `ScrollArea`'s viewport uses `size-full` which requires the parent to have a definite height. In `DocumentDrawer`, the `ScrollArea` has `className="flex-1"` but the parent `SheetContent` is `flex flex-col` — this should work IF the Sheet has `h-full` (it does via `data-[side=right]:h-full`). The issue may be overflow behavior — investigate whether `overflow-hidden` is needed on the parent.
- **No file listing API**: There is no endpoint to enumerate files in a project folder. Needed for "Other Docs" discovery and error log detection. Must be added.
- **rehype-sanitize strips shiki output**: If sanitize runs after shiki, all inline styles are removed. Plugin ordering is critical.
- **rehype-sanitize prefixes IDs**: Default schema prefixes `id`/`name` with `user-content-`. Headings anchored by `rehype-slug` (running after sanitize) won't be affected, but any IDs in the raw markdown will be prefixed.
- **Mermaid SSR crash**: `mermaid` directly accesses `document` and `window`. Must only run client-side in Next.js — dynamic import in `useEffect` or wrapped component.
- **Custom `code` component conflict**: `MarkdownRenderer` already has a custom `code` component override. The mermaid diagram renderer must integrate with (or replace) this existing override, checking for `language-mermaid` before falling through to normal code rendering.
- **Shiki singleton**: `@shikijs/rehype` default export uses a singleton highlighter shared across all renders. This is efficient but means theme configuration is global. Use `themes` option (not `theme`) for dual light/dark.

## Document Ordering for Prev/Next Navigation

### Source of Truth: state.json

All document paths are reliably stored in `state.json` via the normalized state structure. No filesystem scan is needed for the primary document list.

### Canonical Document Order (derived from state.json)

```
1. Planning docs (in PLANNING_STEP_ORDER):
   - planning.steps.research.output
   - planning.steps.prd.output
   - planning.steps.design.output
   - planning.steps.architecture.output
   - planning.steps.master_plan.output

2. Per phase (execution.phases[], in phase_number order):
   a. phase.phase_doc           (Phase Plan)
   b. Per task (phase.tasks[], in task_number order):
      - task.handoff_doc        (Task Handoff)
      - task.report_doc         (Task Report)
      - task.review_doc         (Task Review)
   c. phase.phase_report        (Phase Report)
   d. phase.phase_review        (Phase Review)

3. final_review.report_doc      (Final Review)

4. Error Log                    (filesystem check: {NAME}-ERROR-LOG.md)

5. Other Docs                   (filesystem scan: *.md not matching known patterns)
```

### Key Types for Navigation

From `ui/types/state.ts`:
- `NormalizedProjectState.planning.steps` — Record keyed by `PlanningStepName`, each with `output: string | null`
- `NormalizedPhase.phase_doc`, `.phase_report`, `.phase_review` — `string | null`
- `NormalizedTask.handoff_doc`, `.report_doc`, `.review_doc` — `string | null`
- `NormalizedProjectState.final_review.report_doc` — `string | null`
- `PLANNING_STEP_ORDER` constant defines canonical order: `['research', 'prd', 'design', 'architecture', 'master_plan']`

Only non-null paths should be included in the navigation list. A utility function can flatten the normalized state into an ordered `string[]` of doc paths at render time.

## API Assessment

### Existing Endpoints

| Endpoint | Method | Returns | Notes |
|----------|--------|---------|-------|
| `/api/projects` | GET | `{ projects: ProjectSummary[] }` | Discovers all project subdirs |
| `/api/projects/[name]/state` | GET | `{ state: NormalizedProjectState }` | Normalized state.json |
| `/api/projects/[name]/document?path=` | GET | `{ frontmatter, content, filePath }` | Single document content |
| `/api/config` | GET | `{ config: TransformedConfig }` | Orchestration config |
| `/api/events` | SSE | state_change, project_added, project_removed | Real-time updates |

### New Endpoint Needed: File Listing

**`GET /api/projects/[name]/files`** — List all `.md` files in the project folder.

Purpose: Detect error logs and "Other Docs" (files not tracked in state.json).

Suggested response:
```json
{
  "files": ["UI-MARKDOWN-IMPROVEMENTS-BRAINSTORMING.md", "UI-MARKDOWN-IMPROVEMENTS-ERROR-LOG.md", "SPIKE-NOTES.md"]
}
```

Implementation: Read project dir via `readdir()`, filter for `*.md`, return relative filenames. The client can diff this against known doc paths from state.json to identify:
- Error log: filename matching `{NAME}-ERROR-LOG.md`
- Other docs: all `.md` files not matching any known doc path from state.json

Path safety: Reuse the same `resolveProjectDir()` pattern as existing endpoints. Only list files in the project directory (no recursion into subdirs needed for error log, but `phases/` and `tasks/` subdirs contain task docs — either recurse or list flat + subdirs).

Note: Task handoffs and phase plans are stored in subdirectories (`tasks/`, `phases/`). The file listing should recurse into subdirectories to capture all files, or the "Other Docs" diff could operate only on root-level `.md` files (since all standard pipeline docs are in subdirs with known naming patterns).

## Dark Mode Setup

| Aspect | Implementation |
|--------|---------------|
| Strategy | Class-based: `.dark` on `<html>` element |
| Tailwind config | `darkMode: "class"` in `tailwind.config.ts` |
| CSS variant | `@custom-variant dark (&:is(.dark *));` in `globals.css` |
| Theme hook | `useTheme()` — returns `{ theme, setTheme, resolvedTheme }` |
| Persistence | `localStorage` key `monitoring-ui-theme` |
| Flash prevention | Inline `<script>` in `layout.tsx` applies `.dark` before React hydrates |
| Available themes | `"system"`, `"dark"`, `"light"` |

**Impact on new features**:
- Shiki: Use `themes: { light: '...', dark: '...' }` with `defaultColor: false` + CSS snippet toggling on `html.dark`
- Mermaid: Use `mermaid.initialize({ theme: resolvedTheme === 'dark' ? 'dark' : 'default' })`, reactively via `useTheme().resolvedTheme`
- Typography prose: Already handled by `dark:prose-invert` class (will work once plugin is registered)

## Recommended Rehype Plugin Ordering

For `react-markdown`'s `rehypePlugins` array:

```typescript
rehypePlugins={[
  [rehypeSanitize, customSanitizeSchema],  // 1. Sanitize first — cleans raw HTML
  [rehypeShiki, shikiOptions],             // 2. Shiki — highlights code blocks (output survives, not re-sanitized)
  rehypeSlug,                              // 3. Slug — adds id to headings (not prefixed by sanitize)
  [rehypeAutolinkHeadings, autolinkOpts],  // 4. Autolink — adds <a> inside headings (needs ids from slug)
]}
```

**Custom sanitize schema** (allow `language-*` classes on `code` so shiki can detect language):
```typescript
import { defaultSchema } from 'rehype-sanitize';

const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-./]
    ]
  }
};
```

**Mermaid bypass**: Handled entirely via custom `code` component override in `react-markdown` — not in the rehype pipeline. The component checks for `language-mermaid` class and renders client-side via mermaid API. Shiki will never see mermaid blocks because the custom component intercepts them first.

Wait — correction: `react-markdown`'s `components` overrides run **after** rehype plugins. So shiki would process `language-mermaid` blocks before the component override. To prevent this, configure shiki to skip the `mermaid` language, or accept that shiki may highlight it (the custom component replaces the output anyway since it detects the class and renders mermaid instead of the code content).

Recommended approach: Let `@shikijs/rehype` attempt to highlight `mermaid` blocks — if it doesn't have a mermaid grammar loaded, it will leave the block as-is. The custom `code` component override then detects `language-mermaid` and renders the mermaid diagram, completely replacing the `<code>` content regardless of what shiki did.

## Recommendations

- **Immediate fix (Goal 1)**: Add `@plugin "@tailwindcss/typography";` to `ui/app/globals.css` after existing `@import` lines. This single line fixes flat prose rendering — headings, lists, blockquotes, bold, italic will all render with proper hierarchy. No code changes needed in `MarkdownRenderer`.
- **ScrollArea fix (Goal 2)**: The `ScrollArea` in `DocumentDrawer` needs its parent to constrain height. Add `overflow-hidden` to `SheetContent`'s className override and ensure `ScrollArea` has `className="flex-1 min-h-0"` (the `min-h-0` is critical for flex children to properly shrink/scroll). The `SheetHeader` should remain outside `ScrollArea` to stay fixed.
- **Drawer width (Goal 3)**: Override width on `SheetContent` className: `"w-full md:w-[50vw] md:max-w-[50vw]"`. The base Sheet component applies `data-[side=right]:w-3/4` and `sm:max-w-sm` — these must be overridden explicitly with higher specificity or `!important` utility. Consider updating the `SheetContent` call to replace those defaults.
- **Syntax highlighting (Goal 4)**: Install `@shikijs/rehype`. Add to `rehypePlugins` with dual theme config. Add the dark mode CSS snippet to `globals.css`. Recommended themes: `github-light` / `github-dark` (or `vitesse-light` / `vitesse-dark`).
- **Table styling (Goal 5)**: Once typography plugin is active, GFM tables get `prose` styling automatically. The existing `table` component override wrapping in `div.overflow-x-auto` is good — keep it. Add `prose-table:` element modifiers in the `prose` wrapper if further customization is needed.
- **Copy-to-clipboard (Goal 6)**: Enhance the `pre` component override to include a copy button. Use `navigator.clipboard.writeText()`. Extract raw text from `children` using a recursive text extraction utility. Position the button as `absolute top-2 right-2` inside a `relative` container.
- **Heading anchors (Goal 7)**: Install `rehype-slug` + `rehype-autolink-headings`. Use `behavior: 'prepend'` or `'append'` for the link. Smooth-scroll target should use `ScrollArea`'s viewport ref, not `window.scrollTo`. Style the anchor link with a `#` icon (Lucide's `Link` icon or `Hash` icon).
- **Mermaid (Goal 8)**: Install `mermaid`. Create a `MermaidBlock` client component that dynamically imports mermaid in `useEffect` and renders SVG. Integrate as a `code` component override in `MarkdownRenderer` — check for `className?.includes('language-mermaid')` and render `MermaidBlock` instead. Use `resolvedTheme` from the theme context to set mermaid's theme.
- **Prev/Next (Goal 9)**: Build a `getOrderedDocPaths(state: NormalizedProjectState)` utility that flattens all non-null doc paths from state.json in the canonical order defined above. Pass the ordered list + current `docPath` to `DocumentDrawer`. Render Prev/Next buttons in a `SheetFooter` — disable at first/last. On navigation, call `openDocument(nextPath)` and reset scroll to top.
- **Error log surfacing (Goal 10)**: Use the new `/api/projects/[name]/files` endpoint to detect `{NAME}-ERROR-LOG.md`. Add a `DocumentLink` to the `ErrorLogSection` component when detected. Include in Prev/Next order after final review.
- **Other Docs (Goal 11)**: Use the file listing endpoint to find `.md` files not in state.json's known doc paths. Render as a simple linkable list in a new `OtherDocsSection` component. Include in Prev/Next order (alphabetical, after error log).
- **New API endpoint**: Create `GET /api/projects/[name]/files` that recursively lists all `.md` files in the project directory. Return relative paths. Client-side code diffs against known state.json paths to identify error log and other docs.
