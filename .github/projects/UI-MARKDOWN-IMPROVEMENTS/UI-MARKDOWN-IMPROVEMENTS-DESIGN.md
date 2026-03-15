---
project: "UI-MARKDOWN-IMPROVEMENTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-15"
---

# UI-MARKDOWN-IMPROVEMENTS — Design

## Design Overview

This design improves the document viewer slide-out pane in the orchestration dashboard, transforming it from a flat text viewer into a rich, navigable reading experience. The interaction model centers on a wider, scrollable Sheet overlay with typographic prose rendering, syntax-highlighted code blocks, visual Mermaid diagrams, heading anchors for in-pane navigation, and sequential Prev/Next document traversal — all respecting the existing dark/light theme system.

## User Flows

### UF-1: Open and Read a Document (US-1, US-2, US-3)

```
User clicks a DocumentLink in any dashboard section
  → Sheet slides in from right at 50vw (desktop) or full-width (mobile)
  → SheetHeader displays document title + filename (fixed, non-scrolling)
  → Content area loads with skeleton → renders rich prose with headings, lists, tables, code blocks
  → User scrolls through content; header remains fixed at top
```

The pane fills the right half of the viewport on desktop, providing ample reading space for dense content. The header stays visible so the user always knows which document they are viewing.

### UF-2: Navigate Between Documents (US-9)

```
User is viewing a document in the pane
  → SheetFooter shows Prev / Next buttons with document title preview
  → User clicks Next → content fades briefly, new document loads, scroll resets to top
  → At first document: Prev button is disabled (visible but non-interactive)
  → At last document: Next button is disabled (visible but non-interactive)
```

Navigation order follows the canonical sequence: planning docs → per-phase docs (plan → tasks → report → review) → final review → error log → other docs. Only documents that exist (non-null paths) appear in the sequence.

### UF-3: Copy Code Block Content (US-6)

```
User hovers over a fenced code block
  → Copy button appears at top-right corner of the block
  → User clicks Copy → content is copied to clipboard
  → Button shows checkmark icon + "Copied!" for 2 seconds → reverts to copy icon
```

### UF-4: Navigate Within a Document via Heading Anchors (US-7)

```
User hovers over a heading (h1–h6)
  → Link icon appears to the left of the heading text
  → User clicks the anchor → pane smooth-scrolls to that heading within the ScrollArea
  → URL hash does NOT change (scroll is scoped to the pane, not the page)
```

### UF-5: View Mermaid Diagrams (US-8)

```
Document contains a ```mermaid fenced code block
  → On first render, a loading placeholder appears
  → Mermaid library loads dynamically (client-side only)
  → Diagram renders as inline SVG within the content flow
  → Diagram respects current theme (dark/light)
  → If rendering fails, fallback shows the raw mermaid source in a code block with a warning badge
```

### UF-6: Access Error Log (US-10)

```
Project has an error log file ({NAME}-ERROR-LOG.md)
  → ErrorLogSection in the dashboard shows a "View Error Log" link
  → User clicks the link → document viewer opens with the error log content
  → Error log is also included in the Prev/Next navigation sequence
```

### UF-7: Discover Other Docs (US-11)

```
Project folder contains non-pipeline markdown files
  → Dashboard shows "Other Docs" section with alphabetical file list
  → User clicks a file name → document viewer opens with that file's content
  → These documents are appended to the end of the Prev/Next navigation sequence
```

### UF-8: Toggle Theme While Viewing (US-12)

```
User toggles dark/light theme via the theme toggle in the header
  → Prose styling switches via prose-invert
  → Syntax highlighting switches via CSS variables (shiki dual-theme)
  → Mermaid diagrams re-render with the appropriate theme
  → Table styling, code block backgrounds, and all UI elements adapt
  → No flash, no layout shift, no re-fetch
```

## Layout & Components

### Document Viewer Pane (DocumentDrawer)

**Breakpoints**: Desktop (≥768px) | Mobile (<768px)

```
┌────────────────────────────────────────────┐
│  SheetHeader (fixed)                       │
│  ┌──────────────────────────────────────┐  │
│  │ Document Title               [Close] │  │
│  │ filename.md                          │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  ScrollArea (flex-1, scrollable)           │
│  ┌──────────────────────────────────────┐  │
│  │ DocumentMetadata (frontmatter card)  │  │
│  ├──────────────────────────────────────┤  │
│  │ MarkdownRenderer                     │  │
│  │   prose prose-sm dark:prose-invert   │  │
│  │   ┌─ Headings with anchor links ──┐ │  │
│  │   │ Rich prose content             │ │  │
│  │   │ Tables with borders/stripes    │ │  │
│  │   │ Code blocks with copy button   │ │  │
│  │   │ Mermaid diagrams (SVG)         │ │  │
│  │   └────────────────────────────────┘ │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  SheetFooter (fixed)                       │
│  ┌──────────────────────────────────────┐  │
│  │ [← Prev: title]    [Next: title →]  │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Overlay root | `Sheet` (side="right") | — | Existing component, no changes |
| Container | `SheetContent` | `w-full md:w-[50vw] md:max-w-[50vw]` | Width override from current `sm:max-w-[640px]` |
| Header | `SheetHeader` | `border-b border-border px-6 py-4` | Fixed at top; contains title + filename |
| Title | `SheetTitle` | `text-lg font-semibold text-foreground` | Document title from frontmatter or filename |
| Subtitle | `SheetDescription` | `text-sm text-muted-foreground font-mono` | Filename only |
| Content | `ScrollArea` | `flex-1 min-h-0 px-6 py-4` | Scrollable body; `min-h-0` enables flex shrinking |
| Metadata | `DocumentMetadata` | `bg-muted` | Existing component, no changes |
| Markdown | `MarkdownRenderer` | `prose prose-sm dark:prose-invert max-w-none` | Enhanced with plugins and component overrides |
| Footer | `DocumentNavFooter` (NEW) | `border-t border-border px-6 py-3` | Fixed at bottom; Prev/Next navigation |

### Error Log Section (Enhanced ErrorLogSection)

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Card | `Card` | — | Existing wrapper |
| Header | `CardTitle` | — | "Error Log" title, existing |
| Stats | Retry/Halt counts | `text-sm font-mono` | Existing |
| Blockers | Blocker list | `text-destructive` | Existing |
| Error log link | `DocumentLink` (NEW addition) | `text-sm` | "View Error Log" — shown conditionally when error log file exists |

### Other Docs Section (New)

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Card | `Card` | — | Reuse existing Card pattern |
| Header | `CardTitle` | — | "Other Documents" |
| File list | List of `DocumentLink` items | `text-sm space-y-1` | Alphabetical; each opens in document viewer |
| Empty state | `<p>` | `text-sm text-muted-foreground` | "No additional documents" — shown when list is empty |

### New Components

| Component | Props | Design Tokens | Description |
|-----------|-------|--------------|-------------|
| `DocumentNavFooter` | `docs: OrderedDoc[]`, `currentPath: string`, `onNavigate: (path: string) => void` | `--border`, `--muted-foreground`, `--foreground` | Fixed footer bar with Prev/Next buttons; disables at boundaries; shows adjacent document titles as button labels |
| `CopyButton` | `text: string` | `--muted`, `--muted-foreground`, `--foreground` | Overlay button on code blocks; copies raw text to clipboard; shows success state for 2s |
| `MermaidBlock` | `code: string` | `--background`, `--foreground` | Client-only component that dynamically imports mermaid, renders SVG diagram, handles theme switching and error fallback |
| `OtherDocsSection` | `files: string[]`, `onDocClick: (path: string) => void` | `--card`, `--muted-foreground` | Card listing non-pipeline markdown files with document links |

## Design Tokens Used

### Existing Tokens (from globals.css)

| Token | Usage in This Design |
|-------|---------------------|
| `--background` / `--foreground` | Base pane background and text color |
| `--card` / `--card-foreground` | Metadata card, other docs card |
| `--muted` / `--muted-foreground` | Code block backgrounds, disabled nav text, secondary text |
| `--border` | Header/footer dividers, table borders |
| `--accent` / `--accent-foreground` | Hover states on nav buttons and heading anchors |
| `--destructive` | Error states, blocker text |
| `--ring` | Focus-visible outlines on interactive elements |
| `--color-link` | Heading anchor icon color, inline link color |
| `--color-link-disabled` | Disabled Prev/Next button text |
| `--drawer-width` | Reference token (currently `640px`, will be updated to `50vw`) |
| `--font-mono` | Code blocks, filename display |

### Shiki Dual-Theme CSS Variables (generated by @shikijs/rehype)

| Token | Usage |
|-------|-------|
| `--shiki-light` | Syntax token color in light mode |
| `--shiki-dark` | Syntax token color in dark mode |
| `--shiki-light-bg` | Code block background in light mode |
| `--shiki-dark-bg` | Code block background in dark mode |

These are auto-generated per-span by shiki. A CSS rule toggles between them based on `html.dark` class.

## States & Interactions

### DocumentDrawer (Enhanced)

| State | Visual Treatment |
|-------|-----------------|
| Closed | Sheet hidden; no DOM overlay |
| Loading | Sheet open at target width; skeleton pulse in content area; footer hidden |
| Error | Sheet open; error alert with red border + destructive text in content area; footer hidden |
| Loaded | Sheet open; header shows title/filename; content scrollable; footer shows Prev/Next |
| Navigating (Prev/Next) | Content area briefly shows loading skeleton; scroll resets to top; new content renders |

### DocumentNavFooter

| State | Visual Treatment |
|-------|-----------------|
| Middle of list | Both Prev and Next buttons active; show adjacent doc titles truncated with ellipsis |
| At first document | Prev button: `opacity-50 cursor-not-allowed`, `aria-disabled="true"`; Next active |
| At last document | Next button: `opacity-50 cursor-not-allowed`, `aria-disabled="true"`; Prev active |
| Single document | Both buttons disabled |
| Hover (active button) | `bg-accent text-accent-foreground` background transition |

### CopyButton

| State | Visual Treatment |
|-------|-----------------|
| Default (hidden) | Not visible; parent `pre` block is not hovered |
| Visible (hover) | `Copy` icon (Lucide) appears at `absolute top-2 right-2`; `bg-background/80 backdrop-blur-sm` pill with `text-muted-foreground` |
| Hover (button) | `bg-accent text-accent-foreground` |
| Copied (success) | Icon swaps to `Check` (Lucide); `text-green-500` for 2 seconds; tooltip text changes to "Copied!" |
| Focus | Visible focus ring via `--ring` |

### MermaidBlock

| State | Visual Treatment |
|-------|-----------------|
| Loading | Gray placeholder rectangle (`bg-muted animate-pulse rounded-md h-48`) while mermaid library loads dynamically |
| Rendered | SVG diagram inline, inheriting theme colors; `overflow-x-auto` wrapper for wide diagrams |
| Error | Falls back to raw code block display (styled as normal code block) with a yellow `⚠ Diagram render failed` badge above |
| Theme change | Diagram re-renders with updated mermaid theme (`default` for light, `dark` for dark) |

### Heading Anchors

| State | Visual Treatment |
|-------|-----------------|
| Default | Anchor link icon hidden |
| Heading hovered | `Hash` icon (Lucide) appears to the left of heading text; `text-muted-foreground opacity-0 group-hover:opacity-70` transition |
| Anchor clicked | Pane smooth-scrolls to heading position within `ScrollArea` viewport |
| Anchor focused | Visible focus ring via `--ring`; icon fully opaque |

### Code Block (Enhanced Pre)

| State | Visual Treatment |
|-------|-----------------|
| Default | `bg-muted rounded-md` container; syntax-highlighted content via shiki; language badge top-left if language specified |
| Hovered | Copy button fades in at top-right |
| Overflow | `overflow-x-auto` with subtle scrollbar; content scrolls horizontally |

### Tables (GFM)

| State | Visual Treatment |
|-------|-----------------|
| Default | `prose` table styling via typography plugin — visible borders, header row bold |
| Alternating rows | Even rows: `bg-muted/50` (light), `bg-muted/30` (dark) via prose table customization |
| Overflow | Horizontal scroll via existing `overflow-x-auto` wrapper |
| Dark mode | Borders and row shading adapt via prose-invert and dark mode tokens |

### ErrorLogSection (Enhanced)

| State | Visual Treatment |
|-------|-----------------|
| No error log file | Section displays as today (retry/halt counts + blockers); no "View Error Log" link |
| Error log exists | "View Error Log" `DocumentLink` appears below the blockers list; styled as `text-sm` link with `--color-link` |

### OtherDocsSection

| State | Visual Treatment |
|-------|-----------------|
| No other docs | "No additional documents" in `text-muted-foreground`; section may optionally be hidden entirely |
| Has other docs | Alphabetical list of `DocumentLink` items; each shows filename |

## Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation — Drawer | Tab order: Close button → ScrollArea content → Prev button → Next button. Focus trapped within Sheet when open (existing Sheet behavior). |
| Keyboard navigation — Code blocks | Copy button is focusable via Tab within the content flow; activates on Enter/Space. |
| Keyboard navigation — Heading anchors | Anchor links are focusable via Tab; activate on Enter. Smooth-scroll targets the ScrollArea viewport. |
| Keyboard navigation — Prev/Next | Buttons focusable via Tab; disabled buttons have `aria-disabled="true"` and `tabindex="-1"` to skip in tab order. |
| Screen reader — Drawer | `aria-label="Document viewer: {title}"` on `SheetContent` (existing). Document title announced via `SheetTitle`. |
| Screen reader — Copy button | `aria-label="Copy code to clipboard"`. On success: announce "Copied to clipboard" via `aria-live="polite"` region. |
| Screen reader — Heading anchors | Anchor links have `aria-label="Link to section: {heading text}"`. Headings retain semantic levels (h1–h6). |
| Screen reader — Prev/Next | `aria-label="Previous document: {title}"` / `aria-label="Next document: {title}"`. Disabled state communicated via `aria-disabled`. |
| Screen reader — Mermaid diagrams | SVG wrapped in `role="img"` with `aria-label="Diagram: {first line of mermaid source}"`. Error fallback retains code block semantics. |
| Screen reader — Other Docs | Section uses `<nav aria-label="Other project documents">` landmark. Each link is a standard anchor. |
| Color contrast | All text meets WCAG AA (4.5:1). Syntax highlighting themes (`github-light` / `github-dark`) are WCAG AA compliant. Mermaid themes use built-in accessible palettes. |
| Focus indicators | All interactive elements (buttons, links, anchors) use the existing `focus-visible` ring (`2px solid var(--ring)`, `outline-offset: 2px`). |
| Reduced motion | Smooth-scroll and copy button transitions respect `prefers-reduced-motion: reduce` — animations disabled, scroll is instant. |

## Responsive Behavior

| Breakpoint | Layout Change |
|-----------|--------------|
| Desktop (≥768px) | Pane width: `50vw`. Header, content, footer all at `px-6`. Code blocks and tables scroll horizontally within content area. Mermaid diagrams may overflow horizontally with scroll wrapper. |
| Mobile (<768px) | Pane width: `100vw` (full-width). Padding reduced to `px-4`. Prev/Next footer stacks labels below icons if titles are long (`flex-wrap`). Code blocks use smaller font (`text-xs`). Tables scroll horizontally. |
| Ultrawide (≥2560px) | Pane width remains `50vw` (up to ~1280px readable width). `max-w-none` on prose ensures content fills available width. No additional constraints needed — 50vw at ultrawide is comfortable. |

### Per-Component Responsive Notes

| Component | Desktop | Mobile |
|-----------|---------|--------|
| `SheetContent` | `w-[50vw] max-w-[50vw]` | `w-full` (default Sheet behavior) |
| `DocumentNavFooter` | Prev/Next side-by-side with truncated titles | Prev/Next side-by-side; titles truncated more aggressively or hidden |
| `CopyButton` | Appears on hover | Always visible (no hover on touch devices); smaller size |
| `MermaidBlock` | Full-width within content; `overflow-x-auto` for wide diagrams | Same, but more likely to need horizontal scroll |
| Code blocks | `text-sm` | `text-xs` for better fit |
| Tables | Prose styling; horizontal scroll on overflow | Same; horizontal scroll more frequently triggered |
| Heading anchors | Icon appears on hover | Icon always visible at reduced opacity (no hover on touch) |

## Design System Additions

### New CSS Custom Properties

| Type | Name | Light Value | Dark Value | Rationale |
|------|------|-------------|------------|-----------|
| Token | `--drawer-width-md` | `50vw` | `50vw` | Desktop document pane width; replaces hardcoded `640px` max-width |
| Token | `--copy-success` | `hsl(142, 71%, 33%)` | `hsl(142, 71%, 45%)` | Copy button success state (matches `--status-complete`) |
| Token | `--code-block-bg` | `var(--muted)` | `var(--muted)` | Explicit code block background; allows shiki to override per-block |
| Token | `--diagram-placeholder-bg` | `var(--muted)` | `var(--muted)` | Mermaid loading placeholder background |

### New CSS Rules

| Rule | Purpose |
|------|---------|
| `@plugin "@tailwindcss/typography"` in globals.css | Activates the already-installed typography plugin for Tailwind v4 |
| Shiki dark mode toggle (`.dark .shiki, .dark .shiki span`) | Switches syntax highlighting tokens between light/dark CSS variables |
| `@media (prefers-reduced-motion: reduce)` scroll override | Disables smooth-scroll for heading anchors |

### New Utility Classes (via Tailwind)

No new utility classes are needed. All styling is achievable with existing Tailwind + typography plugin utilities and the tokens defined above.
