---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 1
title: "FOUNDATION"
status: "active"
total_tasks: 2
tasks:
  - id: "T01-TYPOGRAPHY"
    title: "Register Typography Plugin and Verify Prose Styling"
  - id: "T02-LAYOUT-SCROLL"
    title: "Fix Pane Width, Scroll Behavior, and Scroll Reset"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 1: FOUNDATION

## Phase Goal

Fix the three P0 rendering issues — prose styling, pane width, and document scrolling — that require no new library installations. When complete, markdown documents render with full typographic hierarchy, the pane occupies ~50vw on desktop, and long documents scroll with a fixed header and scroll-reset on navigation.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-MARKDOWN-IMPROVEMENTS-MASTER-PLAN.md) | Phase 1 scope: typography registration, pane width, scroll fix, scroll reset; exit criteria |
| [Architecture](../UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md) | Module map (globals.css, DocumentDrawer, useDocumentDrawer); file structure; cross-cutting dark mode strategy |
| [Design](../UI-MARKDOWN-IMPROVEMENTS-DESIGN.md) | Layout specs (SheetContent width classes, ScrollArea flex-1 min-h-0, header/footer regions); responsive breakpoints; dark mode prose-invert |
| [PRD](../UI-MARKDOWN-IMPROVEMENTS-PRD.md) | FR-1 (prose hierarchy), FR-2 (independent scroll), FR-3 (50vw width), FR-13 (scroll reset); NFR-1 (dark mode) |
| [Research Findings](../UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md) | Typography plugin v4 registration via `@plugin` directive; Sheet width override specificity (`data-[side=right]` selectors); ScrollArea height constraint details |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Register Typography Plugin and Verify Prose Styling | — | CSS, Tailwind v4 | 1 | `tasks/UI-MARKDOWN-IMPROVEMENTS-TASK-P01-T01-TYPOGRAPHY.md` |
| T02 | Fix Pane Width, Scroll Behavior, and Scroll Reset | T01 | React, shadcn/ui, CSS | 2 | `tasks/UI-MARKDOWN-IMPROVEMENTS-TASK-P01-T02-LAYOUT-SCROLL.md` |

### T01 — Register Typography Plugin and Verify Prose Styling

**Objective**: Add the `@plugin "@tailwindcss/typography"` directive to `ui/app/globals.css` so the existing `prose prose-sm dark:prose-invert max-w-none` classes on `MarkdownRenderer` produce actual typographic styling. This is the single highest-risk item in Phase 1 (Risk R-1) — it validates that the Tailwind v4 CSS-first plugin registration approach works with `@tailwindcss/typography` v0.5.19.

**File targets**:
- `ui/app/globals.css` — MODIFY: add `@plugin "@tailwindcss/typography";` after existing `@import` and `@plugin` directives

**Key details**:
- The plugin is already installed (`@tailwindcss/typography` v0.5.19) but not registered. The `plugins: []` array in `tailwind.config.ts` is the Tailwind v3 approach — ignored by v4's CSS-first pipeline
- Tailwind v4 registration requires `@plugin "@tailwindcss/typography";` in the CSS file
- `MarkdownRenderer` already applies `prose prose-sm dark:prose-invert max-w-none` — no component code changes needed
- `dark:prose-invert` will automatically work once the plugin is active (class-based dark mode via `html.dark`)

**Acceptance criteria**:
- All 6 heading levels (h1–h6) render with visually distinct sizes and weights
- Bold, italic, blockquotes, ordered/unordered lists, links, and horizontal rules render with proper styling
- `dark:prose-invert` correctly inverts prose colors in dark mode
- Build passes with no new warnings or errors
- No regressions to existing UI elements outside the prose context

### T02 — Fix Pane Width, Scroll Behavior, and Scroll Reset

**Objective**: Widen the document drawer pane to ~50vw on desktop, fix the ScrollArea layout so long documents scroll with a fixed header, and add scroll-reset behavior when navigating to a new document.

**File targets**:
- `ui/components/documents/document-drawer.tsx` — MODIFY: update `SheetContent` width classes; fix `ScrollArea` parent/child layout for proper scrolling
- `ui/hooks/use-document-drawer.ts` — MODIFY: add scroll-reset behavior when document changes (either via ref callback or state signal)

**Key details**:
- **Width**: Replace current `sm:max-w-[640px]` on `SheetContent` with `w-full md:w-[50vw] md:max-w-[50vw]`. Must override the Sheet component's base `data-[side=right]:w-3/4` and `data-[side=right]:sm:max-w-sm` selectors — may require specificity handling
- **Scroll layout**: `SheetContent` is `flex flex-col` with `h-full`. `ScrollArea` needs `className="flex-1 min-h-0"` — the `min-h-0` is critical for flex children to shrink below content size. `SheetHeader` remains outside `ScrollArea` to stay fixed. Parent may need `overflow-hidden` to prevent double scrollbars
- **Scroll reset**: When `docPath` changes (e.g., user opens a different document via `openDocument`), the `ScrollArea` viewport should reset to `scrollTop = 0`. This can be implemented via a ref on the `ScrollArea` viewport and an effect that triggers on `docPath` change, or by exposing a reset signal from `useDocumentDrawer`
- **Responsive**: `w-full` (no md: prefix) handles mobile (<768px) — Sheet takes full width. `md:w-[50vw]` handles desktop (≥768px)

**Acceptance criteria**:
- Pane width is ~50vw on viewports ≥768px and full-width on mobile
- Documents exceeding 500 lines scroll fully with the pane header fixed at top
- No double scrollbars appear (page-level vs pane-level)
- Scroll position resets to top when a new document is loaded
- Existing document loading/error states still function correctly
- Build passes with no new warnings or errors

## Execution Order

```
T01 (typography plugin registration)
 └→ T02 (layout + scroll — depends on T01)
```

**Sequential execution order**: T01 → T02

T02 depends on T01 because typography styling must be active to meaningfully verify that the layout and scroll behavior work with properly styled, variable-height prose content. T01 also validates Risk R-1 (plugin compatibility) — if it fails, T02's approach may need adjustment.

## Phase Exit Criteria

- [ ] All 6 heading levels render with visually distinct sizes and weights
- [ ] Bold, italic, blockquotes, ordered/unordered lists, links, and horizontal rules render with proper styling
- [ ] `dark:prose-invert` correctly inverts prose colors in dark mode
- [ ] Documents exceeding 500 lines scroll fully with the pane header fixed
- [ ] Pane width is ~50vw on viewports ≥768px and full-width on mobile
- [ ] Scroll position resets to top when a new document is loaded
- [ ] All tasks complete with status `complete`
- [ ] Build passes
- [ ] Phase review passed

## Known Risks for This Phase

- **R-1 (High)**: Typography plugin may be incompatible with Tailwind v4 CSS-first config. T01 is isolated specifically to validate this immediately. Fallback: investigate alternative registration methods or manual prose styles if `@plugin` directive fails.
- **R-6 (Medium)**: Sheet component base styles (`data-[side=right]:w-3/4`, `data-[side=right]:sm:max-w-sm`) may resist width override due to CSS specificity. Research identified the exact selectors. May require targeted `!important` or direct style prop if standard className override is insufficient.
- **ScrollArea height constraint**: If `min-h-0` on `ScrollArea` is insufficient, investigate adding explicit `overflow-hidden` on `SheetContent` or restructuring the flex layout. The Sheet provides `h-full` via `data-[side=right]:h-full`, which should establish the height constraint.
