---
project: "UI-MARKDOWN-IMPROVEMENTS"
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Architecture

## Technical Overview

This project enhances the existing document viewer in the orchestration dashboard — a Next.js 14 / React 18 app using shadcn/ui, Tailwind CSS v4, and `react-markdown`. The architecture adds a `rehype` plugin pipeline (sanitize → shiki → slug → autolink) to the existing `MarkdownRenderer`, introduces two library adapters (`ui/lib/shiki-adapter.ts` and `ui/lib/mermaid-adapter.ts`) that isolate third-party APIs from React components, and adds a document-ordering utility (`ui/lib/document-ordering.ts`) that derives Prev/Next navigation from the normalized project state. A single new API endpoint (`GET /api/projects/[name]/files`) provides file listing for error log detection and "Other Docs" discovery.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Presentation                                                   │
│  DocumentDrawer, MarkdownRenderer, DocumentNavFooter,           │
│  CopyButton, MermaidBlock, OtherDocsSection, ErrorLogSection    │
├─────────────────────────────────────────────────────────────────┤
│  Application                                                    │
│  useDocumentDrawer (enhanced), useTheme (existing)              │
├─────────────────────────────────────────────────────────────────┤
│  Domain                                                         │
│  document-ordering utility, types (OrderedDoc, FilesResponse)   │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure                                                 │
│  shiki-adapter, mermaid-adapter, fs-reader (enhanced),          │
│  GET /api/projects/[name]/files (new), rehype plugin config     │
└─────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `MarkdownRenderer` | Presentation | `ui/components/documents/markdown-renderer.tsx` | **Enhanced** — configures `react-markdown` with full rehype plugin pipeline and custom component overrides for `pre`, `code`, `table`, headings |
| `DocumentDrawer` | Presentation | `ui/components/documents/document-drawer.tsx` | **Enhanced** — wider pane (50vw desktop), fixed header, scrollable body, renders `DocumentNavFooter` |
| `DocumentNavFooter` | Presentation | `ui/components/documents/document-nav-footer.tsx` | **New** — Prev/Next navigation bar; receives ordered doc list and current path; disables at boundaries |
| `CopyButton` | Presentation | `ui/components/documents/copy-button.tsx` | **New** — overlay button on code blocks; copies raw text to clipboard; shows success feedback |
| `MermaidBlock` | Presentation | `ui/components/documents/mermaid-block.tsx` | **New** — client-only component; calls mermaid adapter to render SVG; handles theme switching and error fallback |
| `OtherDocsSection` | Presentation | `ui/components/dashboard/other-docs-section.tsx` | **New** — card listing non-pipeline markdown files with `DocumentLink` items |
| `ErrorLogSection` | Presentation | `ui/components/dashboard/error-log-section.tsx` | **Enhanced** — adds conditional "View Error Log" `DocumentLink` when error log file exists |
| `shiki-adapter` | Infrastructure | `ui/lib/shiki-adapter.ts` | **New** — abstracts `@shikijs/rehype` configuration; exports `getShikiRehypeOptions()` returning the plugin options object (themes, default color, language list) |
| `mermaid-adapter` | Infrastructure | `ui/lib/mermaid-adapter.ts` | **New** — abstracts `mermaid` library; exports `initMermaid(theme)`, `renderDiagram(id, code)`, `updateTheme(theme)`; handles dynamic import and singleton lifecycle |
| `document-ordering` | Domain | `ui/lib/document-ordering.ts` | **New** — exports `getOrderedDocs(state, files?)` that flattens `NormalizedProjectState` + optional file list into an ordered `OrderedDoc[]` for Prev/Next navigation |
| `rehype-config` | Infrastructure | `ui/lib/rehype-config.ts` | **New** — single configuration point for the rehype plugin array and sanitize schema; exports `getRehypePlugins()` and `customSanitizeSchema` |
| `useDocumentDrawer` | Application | `ui/hooks/use-document-drawer.ts` | **Enhanced** — adds `navigateTo(path)` method that resets scroll position and fetches new document without closing the drawer |
| `Files API` | Infrastructure | `ui/app/api/projects/[name]/files/route.ts` | **New** — lists `.md` files in project folder; validates path safety; returns flat filename list |
| `fs-reader` | Infrastructure | `ui/lib/fs-reader.ts` | **Enhanced** — add `listProjectFiles(projectDir)` to enumerate `.md` files recursively |
| `State types` | Domain | `ui/types/state.ts` | **No changes** — existing `NormalizedProjectState` and `PLANNING_STEP_ORDER` are sufficient |
| `Component types` | Domain | `ui/types/components.ts` | **Enhanced** — add `OrderedDoc`, `FilesResponse` types |
| `globals.css` | Presentation | `ui/app/globals.css` | **Enhanced** — register typography plugin, add shiki dual-theme CSS snippet |

## Contracts & Interfaces

### Document Ordering (`ui/lib/document-ordering.ts`)

```typescript
// ui/types/components.ts — new types

/** A document in the ordered navigation sequence */
interface OrderedDoc {
  /** Relative path to the document (same format as state.json paths) */
  path: string;
  /** Display title for the navigation button label */
  title: string;
  /** Category for grouping: planning, phase, task, review, error-log, other */
  category: 'planning' | 'phase' | 'task' | 'review' | 'error-log' | 'other';
}

/** Response from GET /api/projects/[name]/files */
interface FilesResponse {
  files: string[];
}
```

```typescript
// ui/lib/document-ordering.ts

import type { NormalizedProjectState } from '@/types/state';
import type { OrderedDoc } from '@/types/components';

/**
 * Derive the canonical document navigation order from project state.
 *
 * Order: planning docs → per-phase (plan → tasks → report → review) →
 *        final review → error log → other docs.
 *
 * Only non-null paths that correspond to existing documents are included.
 *
 * @param state - Normalized project state
 * @param projectName - Project name (for error log detection)
 * @param allFiles - Optional file list from /api/projects/[name]/files (enables error log + other docs)
 * @returns Ordered array of documents for Prev/Next navigation
 */
function getOrderedDocs(
  state: NormalizedProjectState,
  projectName: string,
  allFiles?: string[]
): OrderedDoc[];

/**
 * Find the previous and next documents relative to the current path.
 *
 * @returns { prev: OrderedDoc | null, next: OrderedDoc | null, currentIndex: number, total: number }
 */
function getAdjacentDocs(
  docs: OrderedDoc[],
  currentPath: string
): { prev: OrderedDoc | null; next: OrderedDoc | null; currentIndex: number; total: number };
```

### Shiki Adapter (`ui/lib/shiki-adapter.ts`)

```typescript
// ui/lib/shiki-adapter.ts

import type { RehypeShikiOptions } from '@shikijs/rehype';

/**
 * Returns the options object for @shikijs/rehype.
 * Isolates shiki configuration from the React component layer.
 * If shiki is swapped for another highlighter, only this file changes.
 */
function getShikiRehypeOptions(): RehypeShikiOptions;
```

The returned options object configures:
- `themes: { light: 'github-light', dark: 'github-dark' }` — dual-theme via CSS variables
- `defaultColor: false` — emit CSS variables instead of inline colors
- Lazy loading via shiki's built-in `lazy` imports (each grammar loaded on demand)

### Mermaid Adapter (`ui/lib/mermaid-adapter.ts`)

```typescript
// ui/lib/mermaid-adapter.ts

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

### Rehype Plugin Configuration (`ui/lib/rehype-config.ts`)

```typescript
// ui/lib/rehype-config.ts

import type { PluggableList } from 'unified';

/**
 * Returns the ordered rehype plugin array for react-markdown.
 * Single source of truth for plugin ordering:
 *   1. rehype-sanitize (with custom schema)
 *   2. @shikijs/rehype (syntax highlighting)
 *   3. rehype-slug (heading IDs)
 *   4. rehype-autolink-headings (anchor links)
 *
 * Encapsulates all plugin configuration so MarkdownRenderer
 * does not import or configure plugins directly.
 */
function getRehypePlugins(): PluggableList;

/**
 * Custom sanitize schema that extends the default to allow
 * `language-*` classes on `code` elements (required for shiki
 * to detect code block languages).
 */
const customSanitizeSchema: object;
```

### DocumentNavFooter (`ui/components/documents/document-nav-footer.tsx`)

```typescript
// ui/components/documents/document-nav-footer.tsx

import type { OrderedDoc } from '@/types/components';

interface DocumentNavFooterProps {
  /** Full ordered document list */
  docs: OrderedDoc[];
  /** Current document path */
  currentPath: string;
  /** Callback when user navigates to a different document */
  onNavigate: (path: string) => void;
}

function DocumentNavFooter(props: DocumentNavFooterProps): React.JSX.Element;
```

### CopyButton (`ui/components/documents/copy-button.tsx`)

```typescript
// ui/components/documents/copy-button.tsx

interface CopyButtonProps {
  /** Raw text content to copy to clipboard */
  text: string;
}

function CopyButton(props: CopyButtonProps): React.JSX.Element;
```

### MermaidBlock (`ui/components/documents/mermaid-block.tsx`)

```typescript
// ui/components/documents/mermaid-block.tsx

interface MermaidBlockProps {
  /** Raw mermaid diagram source code */
  code: string;
}

function MermaidBlock(props: MermaidBlockProps): React.JSX.Element;
```

### OtherDocsSection (`ui/components/dashboard/other-docs-section.tsx`)

```typescript
// ui/components/dashboard/other-docs-section.tsx

interface OtherDocsSectionProps {
  /** List of non-pipeline markdown filenames (alphabetically sorted) */
  files: string[];
  /** Callback when a file is clicked to open in the document viewer */
  onDocClick: (path: string) => void;
}

function OtherDocsSection(props: OtherDocsSectionProps): React.JSX.Element;
```

### Enhanced ErrorLogSection (`ui/components/dashboard/error-log-section.tsx`)

```typescript
// ui/components/dashboard/error-log-section.tsx — enhanced props

interface ErrorLogSectionProps {
  errors: NormalizedErrors;
  /** Path to error log file, or null if no error log exists */
  errorLogPath: string | null;
  /** Callback to open a document in the viewer */
  onDocClick: (path: string) => void;
}
```

### Enhanced useDocumentDrawer (`ui/hooks/use-document-drawer.ts`)

```typescript
// ui/hooks/use-document-drawer.ts — enhanced return type

interface UseDocumentDrawerReturn {
  isOpen: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  openDocument: (path: string) => void;
  /** Navigate to a new document without closing the drawer; resets scroll */
  navigateTo: (path: string) => void;
  close: () => void;
}
```

`navigateTo` behaves like `openDocument` but is intended for Prev/Next navigation — it keeps the drawer open, sets the new `docPath`, triggers a fetch, and signals the `ScrollArea` to reset scroll position to top.

### Files API (`ui/app/api/projects/[name]/files/route.ts`)

```typescript
// ui/app/api/projects/[name]/files/route.ts

// GET /api/projects/{name}/files
// Response: { files: string[] }
//
// Lists all .md files in the project directory (recursively).
// Returns relative filenames (e.g., "UI-MARKDOWN-IMPROVEMENTS-PRD.md",
// "tasks/UI-MARKDOWN-IMPROVEMENTS-TASK-P01-T01-TYPOGRAPHY.md").
//
// Security: Validates project name, resolves project dir via resolveProjectDir(),
// and only lists files within that directory. No user-supplied path parameter.
```

### Enhanced fs-reader (`ui/lib/fs-reader.ts`)

```typescript
// ui/lib/fs-reader.ts — new export

/**
 * Recursively list all .md files in a project directory.
 * Returns paths relative to the project directory.
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Array of relative file paths (e.g., ["PRD.md", "tasks/TASK-P01-T01.md"])
 */
async function listProjectFiles(projectDir: string): Promise<string[]>;
```

## API Endpoints

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | `/api/projects/[name]/files` | — | `FilesResponse` (`{ files: string[] }`) | None |
| GET | `/api/projects/[name]/document?path=` | `?path={relative}` | `DocumentResponse` | None (existing) |
| GET | `/api/projects/[name]/state` | — | `{ state: NormalizedProjectState }` | None (existing) |

### `GET /api/projects/[name]/files` — Detailed Design

**Purpose**: Enumerate all `.md` files in a project folder so the client can detect the error log and discover non-pipeline files ("Other Docs").

**Implementation**:
1. Resolve `projectDir` via `resolveProjectDir(root, basePath, projectName)`
2. Call `listProjectFiles(projectDir)` to get all `.md` files recursively
3. Return `{ files: [...] }` with relative paths

**Path safety**:
- The `[name]` parameter is used only to resolve the project dir via `resolveProjectDir` — no user-supplied path joins
- `listProjectFiles` only walks within `projectDir` — no symlink following, no `..` traversal
- Exactly the same security model as the existing `/api/projects/[name]/state` endpoint

**Error handling**:
- Project dir not found → `404 { error: "Project not found" }`
- Filesystem error → `500 { error: message }`

## Dependencies

### External Dependencies (New)

| Package | Version | Purpose |
|---------|---------|---------|
| `@shikijs/rehype` | `^3.0.0` | Rehype plugin for syntax highlighting via shiki; dual-theme CSS variable output |
| `mermaid` | `^11.0.0` | Client-side diagram rendering (flowcharts, sequence diagrams, etc.) |
| `rehype-slug` | `^6.0.0` | Adds `id` attributes to headings based on text content |
| `rehype-autolink-headings` | `^7.0.0` | Adds anchor links inside headings (requires `rehype-slug` to run first) |

### External Dependencies (Existing — No Version Changes)

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | `^9.1.0` | Runtime markdown rendering with rehype/remark plugin support |
| `remark-gfm` | `^4.0.1` | GFM tables, strikethrough, task lists |
| `rehype-sanitize` | `^6.0.0` | HTML sanitization with configurable schema |
| `@tailwindcss/typography` | `^0.5.19` | Typography plugin for prose classes — installed, needs CSS registration |
| `lucide-react` | `^0.300.0` | Icons (Copy, Check, Hash, ChevronLeft, ChevronRight) |

### Internal Dependencies (module → module)

```
DocumentDrawer (enhanced)
  → DocumentNavFooter (new)
  → MarkdownRenderer (enhanced)
  → useDocumentDrawer (enhanced)
  → document-ordering utility

MarkdownRenderer (enhanced)
  → rehype-config (new)         → shiki-adapter (new) → @shikijs/rehype
                                → rehype-sanitize, rehype-slug, rehype-autolink-headings
  → CopyButton (new)
  → MermaidBlock (new)          → mermaid-adapter (new) → mermaid

OtherDocsSection (new)
  → DocumentLink (existing)

ErrorLogSection (enhanced)
  → DocumentLink (existing)

Home page (existing)
  → Files API (new)             → fs-reader.listProjectFiles (new)
  → document-ordering utility   → state types (existing)
```

## File Structure

```
ui/
├── app/
│   ├── globals.css                                    # Enhanced: @plugin typography, shiki CSS
│   └── api/
│       └── projects/
│           └── [name]/
│               ├── document/route.ts                  # Existing (no changes)
│               ├── state/route.ts                     # Existing (no changes)
│               └── files/route.ts                     # NEW: list project .md files
├── components/
│   ├── documents/
│   │   ├── markdown-renderer.tsx                      # Enhanced: rehype pipeline, component overrides
│   │   ├── document-drawer.tsx                        # Enhanced: 50vw width, footer, scroll reset
│   │   ├── document-nav-footer.tsx                    # NEW: Prev/Next navigation bar
│   │   ├── copy-button.tsx                            # NEW: code block copy button
│   │   ├── mermaid-block.tsx                          # NEW: client-only mermaid renderer
│   │   ├── document-link.tsx                          # Existing (no changes)
│   │   ├── document-metadata.tsx                      # Existing (no changes)
│   │   └── index.ts                                   # Enhanced: export new components
│   └── dashboard/
│       ├── error-log-section.tsx                      # Enhanced: error log link
│       ├── other-docs-section.tsx                     # NEW: non-pipeline file list
│       └── index.ts                                   # Enhanced: export OtherDocsSection
├── hooks/
│   └── use-document-drawer.ts                         # Enhanced: navigateTo method
├── lib/
│   ├── shiki-adapter.ts                               # NEW: shiki configuration adapter
│   ├── mermaid-adapter.ts                             # NEW: mermaid library adapter
│   ├── document-ordering.ts                           # NEW: document navigation ordering
│   ├── rehype-config.ts                               # NEW: rehype plugin pipeline config
│   ├── fs-reader.ts                                   # Enhanced: listProjectFiles
│   └── normalizer.ts                                  # Existing (no changes)
└── types/
    ├── state.ts                                       # Existing (no changes)
    └── components.ts                                  # Enhanced: OrderedDoc, FilesResponse
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Dark mode** | All new features react to the existing class-based dark mode (`html.dark`). Shiki uses dual-theme CSS variables toggled via `.dark` selector. Mermaid re-initializes with 'dark'/'default' theme via `useTheme().resolvedTheme`. Typography uses `dark:prose-invert`. No new theme infrastructure needed. |
| **Error handling** | Mermaid render failures fall back to a styled code block with a warning badge — the adapter throws, the `MermaidBlock` component catches. Shiki failures are non-catastrophic (code blocks render unstyled). Files API returns appropriate HTTP status codes. Copy-to-clipboard failures are silently ignored (browser security may block in some contexts). |
| **Performance / lazy loading** | Mermaid (~71MB unpacked) is dynamically imported on first use via the mermaid adapter — never in the initial bundle. Shiki grammars are lazy-loaded per language by `@shikijs/rehype`. No performance impact on pages without code blocks or diagrams. |
| **Security / sanitization** | `rehype-sanitize` runs **first** in the plugin pipeline with a custom schema allowing `language-*` classes on `code` elements. Shiki and heading plugins run after sanitization, so their output is not re-sanitized. Mermaid bypasses the rehype pipeline entirely — it renders client-side via the adapter, producing SVG in a controlled component. The Files API has no user-supplied path parameter — only the project name from the route, resolved via the existing `resolveProjectDir` helper. |
| **SSR safety** | Mermaid runs client-side only — `MermaidBlock` is a `"use client"` component that dynamically imports via `useEffect`. All other rehype plugins are safe for both client and server rendering. The `CopyButton` uses `navigator.clipboard` which is browser-only but is only called on user interaction (click), not during render. |
| **State management** | No new global state. Document ordering is derived at render time from the existing `NormalizedProjectState` (already fetched and stored by `useProjects`). The file list is fetched similarly to state and cached in component state. The mermaid adapter maintains a module-level singleton (initialized flag + current theme) — not React state. |
| **Accessibility** | Keyboard navigation: all new interactive elements (Prev/Next buttons, copy button, heading anchors) are focusable and operable via keyboard. Disabled nav buttons use `aria-disabled="true"`. Copy success announced via `aria-live` region. Mermaid SVGs wrapped in `role="img"` with `aria-label`. Reduced motion: `prefers-reduced-motion` disables smooth-scroll and transitions. |

## Rehype Plugin Pipeline — Detailed Ordering

This is the most critical architectural decision. The plugin array for `react-markdown`'s `rehypePlugins` prop must follow this exact order:

```
                    ┌──────────────────┐
  Raw HTML AST ───▶ │ rehype-sanitize  │ ── Cleans raw HTML, allows language-* classes
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ @shikijs/rehype  │ ── Highlights code blocks, emits CSS var spans
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   rehype-slug    │ ── Adds id attributes to h1–h6
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ rehype-autolink  │ ── Adds <a> links inside headings with ids
                    └────────┬─────────┘
                             │
              React elements ◀──────────
```

**Why this order**:
1. **Sanitize first**: Cleans any raw HTML in markdown input. Must run before shiki because shiki emits inline `style` attributes with CSS variables — if sanitize ran after, it would strip them.
2. **Shiki second**: Operates on sanitized HAST. Its output (spans with CSS variables) is not re-processed by sanitize.
3. **Slug third**: Adds `id` to headings after sanitization, so IDs are not prefixed with `user-content-` by the sanitizer's default behavior.
4. **Autolink last**: Requires headings to already have `id` attributes (from slug).

**Mermaid bypass**: Mermaid code blocks are handled by a custom `code` component override in `react-markdown`, not by a rehype plugin. When `MarkdownRenderer` encounters a `code` element with `className` containing `language-mermaid`, it renders `<MermaidBlock>` instead of the default code output. This happens after all rehype plugins have run — shiki may attempt to highlight the mermaid source (it will leave it as-is if it lacks a mermaid grammar), but the component override replaces the entire output regardless.

**Custom sanitize schema**: The default `rehype-sanitize` schema strips all classes from `code` elements. The custom schema extends it to allow `className` values matching `/^language-./` on `code` elements, which shiki needs to detect the code block language.

## Phasing Recommendations

The following phases are advisory — the Tactical Planner makes final phasing decisions.

### Phase 1: Foundation — Typography, Layout, and Scroll

Independent of all other phases. Fixes the three P0 issues that require no new dependencies:

- Register `@tailwindcss/typography` plugin in `globals.css` (`@plugin` directive)
- Widen `DocumentDrawer` to 50vw on desktop
- Fix `ScrollArea` for proper scrolling with fixed header
- Add scroll reset behavior to `useDocumentDrawer`

**Exit criteria**: Prose elements render with visual hierarchy. Documents scroll fully. Pane is 50vw on desktop.

### Phase 2: Rehype Pipeline — Syntax Highlighting and Heading Anchors

Depends on Phase 1 (MarkdownRenderer changes). Introduces the rehype plugin pipeline and library adapters:

- Create `ui/lib/shiki-adapter.ts` (shiki configuration adapter)
- Create `ui/lib/rehype-config.ts` (plugin pipeline configuration)
- Install `@shikijs/rehype`, `rehype-slug`, `rehype-autolink-headings`
- Add shiki dual-theme CSS to `globals.css`
- Enhance `MarkdownRenderer` to use the rehype pipeline from `rehype-config`
- Create `CopyButton` component
- Add custom heading component overrides for anchor link styling

**Exit criteria**: Code blocks have syntax highlighting in both themes. Headings have anchor links with smooth in-pane scroll. Copy button works on code blocks.

### Phase 3: Mermaid Diagrams

Can run in parallel with Phase 4. Depends on Phase 2 (MarkdownRenderer component overrides):

- Create `ui/lib/mermaid-adapter.ts` (mermaid library adapter)
- Create `MermaidBlock` component
- Install `mermaid`
- Integrate mermaid detection into `MarkdownRenderer` code component override
- Handle theme switching, error fallback, loading state

**Exit criteria**: Mermaid-tagged code blocks render as SVG diagrams. Theme switching works. Errors fall back to code display.

### Phase 4: Navigation, File API, and Dashboard Enhancements

Can run in parallel with Phase 3. Depends on Phase 1 (DrawerLayout changes):

- Create `ui/lib/document-ordering.ts` (document ordering utility)
- Add `OrderedDoc` and `FilesResponse` types to `ui/types/components.ts`
- Create `DocumentNavFooter` component
- Enhance `useDocumentDrawer` with `navigateTo` method
- Wire navigation into `DocumentDrawer`
- Add `listProjectFiles` to `ui/lib/fs-reader.ts`
- Create `GET /api/projects/[name]/files` endpoint
- Enhance `ErrorLogSection` with error log document link
- Create `OtherDocsSection` component
- Wire file list fetching and other docs into the dashboard

**Exit criteria**: Prev/Next navigation traverses all project docs. Error log is discoverable and openable. Other docs section lists non-pipeline files.
