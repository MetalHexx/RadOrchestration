---
project: "UI-MARKDOWN-IMPROVEMENTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Product Requirements

## Problem Statement

The document viewer in the orchestration dashboard renders markdown as flat, unstyled text — headings are indistinguishable from body copy, code blocks lack syntax coloring, and tables appear without borders or structure. The content area does not scroll, making long planning documents (PRDs, architecture docs, phase plans) partially inaccessible, and the pane is too narrow for comfortable reading. There is no way to navigate between project documents without closing and reopening the viewer, and critical artifacts like error logs and non-standard project files are invisible in the UI. These deficiencies make the document viewer unsuitable as a first-class reading and review experience for the developers and operators who depend on it daily.

## Goals

- **G1**: All markdown prose elements (headings, lists, blockquotes, bold, italic, links) render with correct visual hierarchy and styling
- **G2**: Long documents are fully accessible via a scrollable content area with a fixed pane header
- **G3**: The document pane is wide enough for comfortable reading on desktop screens (approximately half the viewport width)
- **G4**: Fenced code blocks render with language-aware syntax highlighting at VS Code quality
- **G5**: GFM tables render with visible structure (borders, alternating row shading) and handle overflow gracefully
- **G6**: Users can copy code block content to the clipboard with a single click
- **G7**: Headings within a document are navigable via anchor links with smooth in-pane scrolling
- **G8**: Mermaid-tagged code blocks render as visual diagrams (flowcharts, sequence diagrams, dependency graphs) instead of raw text
- **G9**: Users can move sequentially through all documents in a project without leaving the viewer
- **G10**: Pipeline error logs are discoverable and readable directly from the dashboard
- **G11**: Non-standard markdown files in a project folder are surfaced and accessible in the UI

## Non-Goals

- Switching to a different markdown rendering library or adopting a compile-time / MDX approach
- Adding a markdown editor or write mode to the document viewer
- Modifying any dashboard panels or sections unrelated to the document viewer and project document listing
- Generating or editing markdown content through the UI
- Supporting non-markdown file formats (e.g., images, PDFs) in the document viewer

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| US-1 | developer reviewing docs | see headings, lists, and blockquotes rendered with proper visual hierarchy | I can quickly scan and comprehend the structure of planning documents | P0 |
| US-2 | developer reviewing docs | scroll through long documents while the pane header stays visible | I can read an entire architecture doc or PRD without losing context about which document I'm viewing | P0 |
| US-3 | developer reviewing docs | read documents in a pane wide enough for dense content | tables, code blocks, and long paragraphs don't feel cramped or get clipped | P0 |
| US-4 | developer reviewing docs | see code blocks with syntax-colored keywords, strings, and types | I can parse code snippets and configuration examples faster | P1 |
| US-5 | developer reviewing docs | see tables with borders and alternating row shading | I can read requirement matrices, API contracts, and comparison tables without losing my place | P1 |
| US-6 | developer reviewing docs | click a button to copy a code block's content | I can paste commands or code snippets directly into my editor or terminal without manual selection | P1 |
| US-7 | developer reviewing docs | click a heading anchor and smooth-scroll to that section within the pane | I can jump to specific sections in long documents without manually scrolling | P1 |
| US-8 | developer reviewing docs | see Mermaid diagram definitions rendered as visual flowcharts and sequence diagrams | I understand system architecture and data flows at a glance instead of parsing diagram source code | P1 |
| US-9 | pipeline operator | click Previous and Next buttons to move through all project documents in order | I can review an entire project's planning and execution documents in sequence without closing and reopening the viewer | P0 |
| US-10 | pipeline operator | see and open the error log directly from the dashboard when the pipeline encounters failures | I can diagnose pipeline errors immediately without navigating the filesystem | P0 |
| US-11 | pipeline operator | see a list of non-standard markdown files (brainstorming notes, spike docs, ADRs) in the project | important context documents don't become orphaned or invisible just because they aren't part of the standard pipeline | P1 |
| US-12 | developer reviewing docs | have all rendering features (highlighting, diagrams, prose styling) respect the current dark/light theme | the reading experience is consistent and comfortable regardless of my theme preference | P0 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | Markdown prose elements (h1–h6, bold, italic, blockquotes, ordered/unordered lists, links, horizontal rules) must render with visually distinct typographic hierarchy | P0 | Root cause: the typography styling system is installed but not activated |
| FR-2 | The document content area must scroll independently while the pane header (document title and filename) remains fixed at the top | P0 | Long planning documents currently overflow and are cut off |
| FR-3 | The document pane width must be approximately 50% of the viewport on desktop-sized screens and full-width on mobile/small screens | P0 | Current width cap is too narrow for dense content |
| FR-4 | Fenced code blocks must render with language-aware syntax highlighting that differentiates keywords, strings, types, comments, and other token categories | P1 | Highlighting must support all languages commonly used in project documents (JS/TS, JSON, YAML, Markdown, shell, CSS, HTML) |
| FR-5 | GFM tables must render with visible cell borders, alternating row backgrounds, and horizontal scrolling when content overflows the pane width | P1 | Tables are used extensively in PRDs and architecture docs |
| FR-6 | Each code block must include a copy-to-clipboard button that copies the raw code content (without line numbers or decorations) to the system clipboard | P1 | Button should provide visual feedback on successful copy |
| FR-7 | Headings must have anchor links that, when clicked, smooth-scroll to the heading position within the document pane (not the browser window) | P1 | Anchor link should be visible on hover; scroll target is the pane's scrollable area |
| FR-8 | Fenced code blocks tagged with the `mermaid` language identifier must render as visual SVG diagrams instead of raw text | P1 | Must support flowcharts, sequence diagrams, and other standard Mermaid diagram types |
| FR-9 | The document pane must include Previous and Next navigation controls that move through all project documents in a defined sequential order | P0 | Order: planning docs → per-phase/per-task docs → phase summaries → final review → error log → other docs |
| FR-10 | When a project's error log file exists, it must be discoverable and openable from the dashboard's error log section | P0 | Error log follows the naming convention `{NAME}-ERROR-LOG.md` |
| FR-11 | Markdown files in the project folder that do not match standard pipeline naming conventions must be listed in a dedicated "Other Docs" section | P1 | Displayed in alphabetical order; each item opens in the document viewer |
| FR-12 | Navigation controls must be disabled (not hidden) when the user is at the first or last document in the sequence | P0 | Prevents confusion about navigation boundaries |
| FR-13 | Navigating to a new document via Previous/Next must reset the scroll position to the top of the content area | P0 | Prevents disorientation when switching documents |
| FR-14 | The document navigation order must be derived from the project's current state at render time, not hardcoded | P0 | Projects vary in number of phases and tasks; only documents that exist should appear in the sequence |
| FR-15 | Mermaid diagrams must render only on the client side, never during server-side rendering | P1 | The diagram library requires browser DOM APIs that are unavailable during SSR |
| FR-16 | The project file listing required for error log detection and "Other Docs" discovery must be available via an API that enumerates markdown files in the project folder | P1 | Currently no such endpoint exists |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Dark Mode | All new visual features (syntax highlighting, diagrams, prose styling, table styling) must respect the application's dark/light theme and switch seamlessly when the user toggles themes |
| NFR-2 | Performance | Document rendering (including syntax highlighting and diagram generation) must complete within 2 seconds for documents up to 2,000 lines |
| NFR-3 | Performance | Large libraries (diagram renderer, syntax highlighter) should be loaded on demand rather than included in the initial page bundle |
| NFR-4 | Runtime Rendering | All markdown processing must happen at runtime in the browser — no build-time compilation, no server-side markdown rendering, no MDX transforms |
| NFR-5 | Security | HTML sanitization of markdown content must be preserved; new rendering features must not bypass or weaken the existing sanitization layer |
| NFR-6 | Responsiveness | The document pane must be usable on viewports from 320px (mobile) to 2560px+ (ultrawide), with appropriate layout adaptations at each breakpoint |
| NFR-7 | Accessibility | Navigation controls (Previous/Next, copy button, anchor links) must be keyboard-accessible and include appropriate ARIA labels |
| NFR-8 | Accessibility | Syntax-highlighted code must maintain sufficient color contrast ratios (WCAG AA minimum: 4.5:1 for normal text) in both light and dark themes |
| NFR-9 | Compatibility | All new rendering plugins and libraries must be compatible with the existing markdown processing pipeline without requiring a library migration |
| NFR-10 | API Safety | The file listing endpoint must validate paths to prevent directory traversal attacks; only files within the project directory should be accessible |

## Assumptions

- The typography styling system is already installed as a dependency and only needs to be activated/registered — no new dependency is required for prose styling
- The existing markdown rendering library supports the plugin architecture needed for syntax highlighting, heading anchors, and sanitization in a composable pipeline
- The project state data structure reliably tracks all standard pipeline document paths, making it a sufficient source of truth for building the navigation sequence
- The current component library provides scrollable area and slide-out panel primitives that support the needed layout changes (fixed header + scrollable body)
- The diagram rendering library can be loaded on demand (dynamic import) to avoid impacting initial page load performance
- Error logs follow a consistent naming pattern (`{NAME}-ERROR-LOG.md`) that can be reliably detected without changes to the pipeline

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | The typography styling system may not be fully compatible with the current CSS framework version's configuration approach | High | Research has identified the likely activation method; validate during implementation with a focused integration test |
| R-2 | Rendering plugin ordering conflicts could cause sanitization to strip syntax highlighting output, or heading anchors to be removed | High | Research has established a specific plugin ordering; enforce order in a single configuration point with integration tests covering each plugin |
| R-3 | The diagram library accesses browser-only APIs and will crash during server-side rendering in the application framework | High | Require client-side-only loading (dynamic import or effect-based initialization); include SSR safety as an acceptance criterion |
| R-4 | The HTML sanitizer may strip SVG output generated by the diagram renderer | Medium | Diagram rendering should bypass the sanitization pipeline entirely by using a component-level override rather than a rendering plugin |
| R-5 | New libraries (syntax highlighter, diagram renderer) significantly increase bundle size | Medium | Use dynamic/lazy loading so these libraries are only fetched when a document containing code blocks or diagrams is opened |
| R-6 | The slide-out panel component's base styling may resist width overrides due to specificity conflicts in the component library | Medium | Research has identified the specific styles that need overriding; may require targeted specificity escalation during implementation |
| R-7 | The document navigation ordering logic becomes brittle if the project state structure changes in future versions | Low | Derive the ordered list from the normalized state type at render time using a single utility function that can be updated alongside any state schema changes |
| R-8 | Non-standard files detected for "Other Docs" may include partially written or temporary files that shouldn't be surfaced | Low | Filter the file listing to only include `.md` files; accept that any committed markdown file is intentional and worth surfacing |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Prose rendering fidelity | All 6 heading levels, bold, italic, blockquotes, ordered/unordered lists, links, and horizontal rules render with visually distinct styling | Manual visual inspection in both light and dark themes |
| Document scrollability | 100% of document content is reachable via scrolling; header remains fixed | Test with documents exceeding 500 lines in the viewer |
| Pane width on desktop | Pane occupies approximately 50% of the viewport on screens ≥ 768px | Measure pane width at 1280px, 1920px, and 2560px viewports |
| Syntax highlighting coverage | Code blocks in JS, TS, JSON, YAML, shell, CSS, and HTML render with token-level coloring | Open documents containing fenced code blocks in each language and verify color differentiation |
| Table readability | GFM tables render with borders, alternating rows, and horizontal scroll on overflow | Test with tables from existing PRD and architecture documents |
| Copy-to-clipboard | Clicking the copy button places the exact raw code content on the clipboard | Paste into a text editor and verify content matches the code block |
| Heading anchors | Clicking an anchor smooth-scrolls to the heading within the pane | Test with a document containing 10+ headings; verify scroll target and animation |
| Mermaid rendering | Mermaid-tagged blocks render as SVG diagrams (not raw text) in both themes | Test with flowchart, sequence diagram, and class diagram blocks |
| Prev/Next navigation | User can traverse all N documents in a project (N ≥ 5) using only Prev/Next buttons | Load a project with planning + multi-phase execution docs; navigate end-to-end without closing the pane |
| Error log discoverability | Error log link appears in the dashboard when `{NAME}-ERROR-LOG.md` exists; clicking it opens the log in the viewer | Create a project with an error log and verify the link appears and functions |
| Other docs discoverability | Non-standard `.md` files appear in the "Other Docs" section | Add a non-pipeline markdown file to a project folder and verify it appears in the UI |
| Dark mode consistency | All 11 features render correctly in both light and dark themes | Toggle theme while viewing a document with prose, code, tables, and diagrams; verify all elements switch cleanly |
| Render performance | Documents up to 2,000 lines render within 2 seconds, including syntax highlighting | Measure time-to-interactive for a large document with multiple code blocks |
