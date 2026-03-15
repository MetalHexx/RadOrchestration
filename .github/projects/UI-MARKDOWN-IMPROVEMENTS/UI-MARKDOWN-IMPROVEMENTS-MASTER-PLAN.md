---
project: "UI-MARKDOWN-IMPROVEMENTS"
total_phases: 4
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Master Plan

## Executive Summary

The document viewer in the orchestration dashboard renders markdown as flat, unstyled text — headings are indistinguishable from body copy, code blocks lack syntax coloring, the content area doesn't scroll, and there is no way to navigate between documents without closing and reopening the pane. This project enhances the existing `react-markdown`-based viewer across four phases: fix the broken Tailwind typography plugin and layout (Phase 1), add a rehype plugin pipeline for syntax highlighting and heading anchors (Phase 2), render Mermaid diagrams client-side (Phase 3), and add Prev/Next document navigation with error log surfacing and an "Other Docs" section (Phase 4). All rendering is runtime-only — no compilation, no MDX — using the existing Next.js 14 / shadcn / Tailwind v4 stack with two new libraries (`@shikijs/rehype` and `mermaid`) and two adapter modules that isolate third-party APIs from React components.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [UI-MARKDOWN-IMPROVEMENTS-BRAINSTORMING.md](UI-MARKDOWN-IMPROVEMENTS-BRAINSTORMING.md) | ✅ |
| Research | [UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md](UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [UI-MARKDOWN-IMPROVEMENTS-PRD.md](UI-MARKDOWN-IMPROVEMENTS-PRD.md) | ✅ |
| Design | [UI-MARKDOWN-IMPROVEMENTS-DESIGN.md](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md) | ✅ |
| Architecture | [UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional requirements and critical non-functional requirements that drive phasing:

- **FR-1**: Markdown prose elements (h1–h6, bold, italic, blockquotes, lists, links, horizontal rules) must render with visually distinct typographic hierarchy
- **FR-2**: Document content area must scroll independently while the pane header remains fixed at top
- **FR-3**: Document pane width must be ~50% of viewport on desktop, full-width on mobile
- **FR-9**: Prev/Next navigation controls must move through all project documents in a defined sequential order derived from project state at render time
- **FR-10**: Error log file must be discoverable and openable from the dashboard when it exists
- **FR-12**: Navigation controls disabled (not hidden) at first/last document boundaries
- **FR-14**: Document navigation order derived from current project state at render time, not hardcoded
- **NFR-1**: All new visual features must respect dark/light theme and switch seamlessly
- **NFR-4**: All markdown processing must happen at runtime in the browser — no build-time compilation
- **NFR-5**: HTML sanitization must be preserved; new features must not bypass or weaken the existing sanitization layer

## Key Technical Decisions (from Architecture)

- **Rehype plugin ordering**: Sanitize → Shiki → Slug → Autolink. This exact order is critical — sanitize runs first so shiki's CSS variable spans survive; slug runs after sanitize so heading IDs aren't prefixed with `user-content-`
- **Library adapters**: `shiki-adapter.ts` and `mermaid-adapter.ts` isolate third-party APIs behind stable interfaces. If shiki or mermaid are swapped, only the adapter changes — no component modifications
- **Mermaid bypasses rehype**: Mermaid rendering uses a custom `code` component override in `react-markdown`, not a rehype plugin. This avoids sanitization conflicts with SVG output and keeps mermaid client-side-only
- **Rehype-config as single source of truth**: `rehype-config.ts` owns the plugin array and custom sanitize schema — `MarkdownRenderer` does not import or configure plugins directly
- **Document ordering utility**: `document-ordering.ts` derives the Prev/Next sequence from `NormalizedProjectState` at render time, using `PLANNING_STEP_ORDER` → per-phase/per-task docs → final review → error log → other docs
- **New Files API**: `GET /api/projects/[name]/files` lists all `.md` files in the project folder for error log detection and "Other Docs" discovery, reusing the existing `resolveProjectDir` security model
- **Dynamic imports for large libraries**: Mermaid (~71MB unpacked) is dynamically imported on first use; shiki grammars lazy-load per language — no initial bundle impact

## Key Design Constraints (from Design)

- **Pane layout**: Fixed `SheetHeader` at top, scrollable `ScrollArea` body (`flex-1 min-h-0`), fixed `DocumentNavFooter` at bottom — three-region flex column within `SheetContent`
- **Width**: `w-full md:w-[50vw] md:max-w-[50vw]` on `SheetContent`, overriding the base Sheet's `data-[side=right]` defaults
- **Shiki dual-theme CSS**: Dark mode toggles via `.dark .shiki span` rule switching `--shiki-light` / `--shiki-dark` CSS variables — no re-render needed on theme change
- **CopyButton visibility**: Appears on hover (desktop) or always visible (touch devices); shows checkmark success state for 2 seconds
- **MermaidBlock states**: Loading placeholder → rendered SVG → error fallback (raw code block with warning badge); theme-reactive via `useTheme().resolvedTheme`
- **Heading anchors**: Hash icon appears on heading hover (`group-hover:opacity-70`), smooth-scroll targets `ScrollArea` viewport (not `window`), respects `prefers-reduced-motion`
- **Typography activation**: Single line `@plugin "@tailwindcss/typography";` in `globals.css` — the plugin is already installed, just not registered for Tailwind v4's CSS-first config

## Phase Outline

### Phase 1: Foundation — Typography, Layout, and Scroll

**Goal**: Fix the three P0 rendering issues — prose styling, pane width, and document scrolling — that require no new library installations.

**Scope**:
- Register `@tailwindcss/typography` in `globals.css` via `@plugin` directive — refs: [FR-1](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Research: Typography](UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md)
- Widen `DocumentDrawer` `SheetContent` to `w-full md:w-[50vw] md:max-w-[50vw]` — refs: [FR-3](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: Layout](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Fix `ScrollArea` layout for proper scrolling with fixed header (`flex-1 min-h-0`, parent `overflow-hidden`) — refs: [FR-2](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: Layout](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Add scroll-reset behavior to `useDocumentDrawer` — refs: [FR-13](UI-MARKDOWN-IMPROVEMENTS-PRD.md)
- Verify `prose prose-sm dark:prose-invert max-w-none` classes render correctly in both themes — refs: [NFR-1](UI-MARKDOWN-IMPROVEMENTS-PRD.md)

**Approximate task count**: 2–3 tasks

**Exit Criteria**:
- [ ] All 6 heading levels render with visually distinct sizes and weights
- [ ] Bold, italic, blockquotes, ordered/unordered lists, links, and horizontal rules render with proper styling
- [ ] `dark:prose-invert` correctly inverts prose colors in dark mode
- [ ] Documents exceeding 500 lines scroll fully with the pane header fixed
- [ ] Pane width is ~50vw on viewports ≥768px and full-width on mobile
- [ ] Scroll position resets to top when a new document is loaded

**Phase Doc**: `phases/UI-MARKDOWN-IMPROVEMENTS-PHASE-01-FOUNDATION.md` *(created at execution time)*

---

### Phase 2: Rehype Pipeline — Syntax Highlighting, Anchors, and Copy

**Goal**: Introduce the rehype plugin pipeline with syntax highlighting, heading anchors, and code block copy-to-clipboard functionality.

**Scope**:
- Install `@shikijs/rehype`, `rehype-slug`, `rehype-autolink-headings` — refs: [Architecture: Dependencies](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/lib/shiki-adapter.ts` — shiki configuration adapter with dual-theme (`github-light`/`github-dark`) and `defaultColor: false` — refs: [Architecture: Shiki Adapter](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/lib/rehype-config.ts` — single source of truth for plugin array (sanitize → shiki → slug → autolink) and custom sanitize schema allowing `language-*` classes — refs: [Architecture: Rehype Config](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Add shiki dual-theme CSS snippet to `globals.css` — refs: [Research: Shiki](UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md), [Design: Shiki Tokens](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Enhance `MarkdownRenderer` to use rehype pipeline from `rehype-config` — refs: [Architecture: Module Map](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/components/documents/copy-button.tsx` — overlay button with clipboard API and success feedback — refs: [FR-6](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: CopyButton](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Add custom heading component overrides for anchor link styling (hash icon, smooth in-pane scroll) — refs: [FR-7](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: Heading Anchors](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Enhanced `pre` component override to include `CopyButton` — refs: [Design: Code Block](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Table styling verification (GFM tables with borders and alternating rows via typography plugin) — refs: [FR-5](UI-MARKDOWN-IMPROVEMENTS-PRD.md)

**Approximate task count**: 3–4 tasks

**Exit Criteria**:
- [ ] Code blocks in JS, TS, JSON, YAML, shell, CSS, and HTML render with token-level syntax coloring
- [ ] Syntax highlighting switches between light and dark themes without re-render (CSS variable toggle)
- [ ] Copy button appears on code block hover; clicking copies raw code to clipboard with visual success feedback
- [ ] Headings display anchor icon on hover; clicking smooth-scrolls within the `ScrollArea` pane
- [ ] GFM tables render with visible borders, alternating row shading, and horizontal scroll on overflow
- [ ] Rehype plugin ordering is sanitize → shiki → slug → autolink (verified in `rehype-config.ts`)
- [ ] Custom sanitize schema allows `language-*` classes on `code` elements

**Phase Doc**: `phases/UI-MARKDOWN-IMPROVEMENTS-PHASE-02-REHYPE-PIPELINE.md` *(created at execution time)*

---

### Phase 3: Mermaid Diagrams

**Goal**: Render Mermaid-tagged fenced code blocks as interactive SVG diagrams with theme support, error fallback, and SSR safety.

**Scope**:
- Install `mermaid` — refs: [Architecture: Dependencies](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/lib/mermaid-adapter.ts` — singleton adapter with `initMermaid(theme)`, `renderDiagram(id, code)`, `updateTheme(theme)`, dynamic import — refs: [Architecture: Mermaid Adapter](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/components/documents/mermaid-block.tsx` — client-only component (`"use client"`) with loading placeholder, SVG render, error fallback, and reactive theme switching via `useTheme()` — refs: [Design: MermaidBlock](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Integrate mermaid detection into `MarkdownRenderer` `code` component override — detect `language-mermaid` class, render `<MermaidBlock>` instead of code — refs: [Architecture: Mermaid Bypass](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Verify SSR safety — mermaid never imported server-side — refs: [FR-15](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [NFR-4](UI-MARKDOWN-IMPROVEMENTS-PRD.md)

**Approximate task count**: 2–3 tasks

**Exit Criteria**:
- [ ] ` ```mermaid ` code blocks render as SVG diagrams (flowchart, sequence diagram, class diagram verified)
- [ ] Diagrams switch themes when the user toggles dark/light mode
- [ ] Failed diagram rendering falls back to a styled code block with a warning badge
- [ ] Mermaid library is dynamically imported — not in initial bundle
- [ ] No SSR errors — mermaid never executes during server-side rendering
- [ ] Mermaid SVGs have `role="img"` and `aria-label` for accessibility

**Phase Doc**: `phases/UI-MARKDOWN-IMPROVEMENTS-PHASE-03-MERMAID.md` *(created at execution time)*

---

### Phase 4: Navigation, File API, and Dashboard Enhancements

**Goal**: Add Prev/Next document navigation, surface error logs and non-standard project files, and wire everything into the dashboard.

**Scope**:
- Add `OrderedDoc` and `FilesResponse` types to `ui/types/components.ts` — refs: [Architecture: Contracts](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/lib/document-ordering.ts` — `getOrderedDocs(state, projectName, allFiles?)` and `getAdjacentDocs(docs, currentPath)` utilities — refs: [Architecture: Document Ordering](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `ui/components/documents/document-nav-footer.tsx` — Prev/Next footer bar with disabled states at boundaries, truncated titles, keyboard accessible — refs: [FR-9](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [FR-12](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: DocumentNavFooter](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Enhance `useDocumentDrawer` with `navigateTo(path)` method (keeps drawer open, fetches new doc, resets scroll) — refs: [Architecture: useDocumentDrawer](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Wire `DocumentNavFooter` into `DocumentDrawer` — refs: [Design: Layout](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Add `listProjectFiles(projectDir)` to `ui/lib/fs-reader.ts` — refs: [Architecture: fs-reader](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Create `GET /api/projects/[name]/files` route — refs: [Architecture: Files API](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Enhance `ErrorLogSection` with conditional "View Error Log" `DocumentLink` when error log exists — refs: [FR-10](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: ErrorLogSection](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Create `ui/components/dashboard/other-docs-section.tsx` — card listing non-pipeline markdown files alphabetically — refs: [FR-11](UI-MARKDOWN-IMPROVEMENTS-PRD.md), [Design: OtherDocsSection](UI-MARKDOWN-IMPROVEMENTS-DESIGN.md)
- Wire file list fetching into the home page and pass to dashboard sections — refs: [Architecture: Internal Dependencies](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)
- Update `ui/components/documents/index.ts` and `ui/components/dashboard/index.ts` exports — refs: [Architecture: File Structure](UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md)

**Approximate task count**: 4–6 tasks

**Exit Criteria**:
- [ ] Prev/Next buttons appear in a fixed footer within the document drawer
- [ ] Navigation traverses all project documents in canonical order: planning → per-phase/per-task → final review → error log → other docs
- [ ] Only documents with non-null paths appear in the navigation sequence
- [ ] Prev button disabled at first document; Next button disabled at last document
- [ ] Navigating via Prev/Next resets scroll position to top
- [ ] File listing API returns all `.md` files in the project directory with path traversal protection
- [ ] Error log link appears in `ErrorLogSection` when `{NAME}-ERROR-LOG.md` exists; clicking opens it in the viewer
- [ ] "Other Docs" section lists non-pipeline `.md` files alphabetically; each opens in the viewer
- [ ] Keyboard navigation works for Prev/Next buttons (focusable, Enter/Space activated, `aria-disabled` on boundaries)

**Phase Doc**: `phases/UI-MARKDOWN-IMPROVEMENTS-PHASE-04-NAVIGATION.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml — this project uses 4)
- **Max tasks per phase**: 8 (from orchestration.yml)
- **Max retries per task**: 2
- **Git strategy**: Single branch, sequential commits, `[orch]` prefix
- **Human gates**: After planning (master plan approval) and after final review (hard defaults); execution mode: "ask"

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| R-1 | Typography plugin incompatible with Tailwind v4 CSS-first config | High | Research confirmed `@plugin` directive is the correct approach. Validate immediately in Phase 1 as the first task — if it fails, investigate alternative registration before proceeding. | Coder |
| R-2 | Rehype plugin ordering causes sanitize to strip shiki output or heading IDs | High | Architecture specifies exact ordering (sanitize → shiki → slug → autolink) encapsulated in `rehype-config.ts`. Phase 2 exit criteria explicitly verify ordering. Integration test with a document containing code + headings. | Coder |
| R-3 | Mermaid crashes during SSR in Next.js | High | Architecture mandates client-only rendering via dynamic import in `useEffect`. `MermaidBlock` is a `"use client"` component. Phase 3 exit criteria verify no SSR errors. | Coder |
| R-4 | Sanitizer strips Mermaid SVG output | Medium | Architecture bypasses this entirely — mermaid renders via component override, not rehype pipeline. No SVG passes through `rehype-sanitize`. | Coder |
| R-5 | New libraries increase bundle size beyond acceptable limits | Medium | Mermaid dynamically imported on first use (never in initial bundle). Shiki grammars lazy-load per language. No upfront cost on pages without code/diagrams. | Coder |
| R-6 | Sheet component base styles resist width override due to CSS specificity | Medium | Research identified the exact `data-[side=right]` selectors to override. May require targeted `!important` or direct style prop. Phase 1 validates this early. | Coder |
| R-7 | Document ordering logic becomes brittle if state schema changes | Low | Ordering derived from `NormalizedProjectState` types via a single utility function (`document-ordering.ts`). Type changes caught at compile time. | Coder |
| R-8 | "Other Docs" surfaces temporary or partial files | Low | Filter to `.md` files only; any committed markdown is intentionally surfaced. Acceptable risk per brainstorming decision. | Human |
