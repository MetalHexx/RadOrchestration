---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 2
title: "REHYPE-PIPELINE"
status: "active"
total_tasks: 3
tasks:
  - id: "T01-REHYPE-INFRASTRUCTURE"
    title: "Rehype Plugin Infrastructure and Shiki Adapter"
  - id: "T02-SYNTAX-COPY-TABLES"
    title: "Syntax Highlighting Integration, CopyButton, and Table Verification"
  - id: "T03-HEADING-ANCHORS"
    title: "Heading Anchor Links with In-Pane Smooth Scrolling"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 2: REHYPE-PIPELINE

## Phase Goal

Introduce the rehype plugin pipeline with syntax highlighting (shiki dual-theme), heading anchors with in-pane smooth scrolling, code block copy-to-clipboard, and centralized plugin configuration — enabling rich code and heading rendering within the prose foundation established in Phase 1.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-MARKDOWN-IMPROVEMENTS-MASTER-PLAN.md) | Phase 2 scope, exit criteria, risk register (R-2: plugin ordering) |
| [Architecture](../UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md) | Module map, contracts for `shiki-adapter.ts`, `rehype-config.ts`, `CopyButton`, heading overrides; rehype plugin ordering diagram; custom sanitize schema |
| [Design](../UI-MARKDOWN-IMPROVEMENTS-DESIGN.md) | CopyButton states (hover/success/focus), heading anchor interaction (group-hover, smooth scroll), code block layout, shiki dual-theme CSS tokens, table styling, accessibility requirements |
| [PRD](../UI-MARKDOWN-IMPROVEMENTS-PRD.md) | FR-4 (syntax highlighting), FR-5 (GFM tables), FR-6 (copy-to-clipboard), FR-7 (heading anchors), NFR-1 (dark mode), NFR-4 (runtime rendering), NFR-5 (sanitization preserved) |
| [Research Findings](../UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md) | Rehype plugin ordering analysis, custom sanitize schema for `language-*` classes, shiki dual-theme CSS snippet, `@shikijs/rehype` compatibility with `react-markdown` |
| [Phase 1 Report](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REPORT-P01.md) | Foundation complete — typography plugin active, ScrollArea scrolling correctly, 50vw width working |
| [Phase 1 Review](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REVIEW-P01.md) | Approved with advance. Carry-forward (mobile width) deferred to Phase 4. Recommendation: verify scroll container stability with larger content blocks from Phase 2 |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Rehype Plugin Infrastructure and Shiki Adapter | — | `create-task-handoff` | 3 | *(created at execution time)* |
| T02 | Syntax Highlighting Integration, CopyButton, and Table Verification | T01 | `create-task-handoff` | 3 | *(created at execution time)* |
| T03 | Heading Anchor Links with In-Pane Smooth Scrolling | T02 | `create-task-handoff` | 1 | *(created at execution time)* |

### T01 — Rehype Plugin Infrastructure and Shiki Adapter

**Objective**: Install the three new rehype dependencies, create the shiki configuration adapter and centralized rehype plugin config, and add the shiki dual-theme CSS snippet — establishing the infrastructure layer that T02 and T03 consume.

**Key Deliverables**:
- Install `@shikijs/rehype`, `rehype-slug`, `rehype-autolink-headings` via npm
- Create `ui/lib/shiki-adapter.ts` — exports `getShikiRehypeOptions()` with dual themes (`github-light`/`github-dark`), `defaultColor: false`
- Create `ui/lib/rehype-config.ts` — exports `getRehypePlugins()` (sanitize → shiki → slug → autolink) and `customSanitizeSchema` that allows `language-*` classes on `code` elements
- Add shiki dual-theme CSS toggle snippet to `ui/app/globals.css` (switches `--shiki-light`/`--shiki-dark` based on `html.dark` class)

**File Targets**:
| Action | File |
|--------|------|
| CREATE | `ui/lib/shiki-adapter.ts` |
| CREATE | `ui/lib/rehype-config.ts` |
| MODIFY | `ui/app/globals.css` |

### T02 — Syntax Highlighting Integration, CopyButton, and Table Verification

**Objective**: Wire the rehype pipeline from T01 into `MarkdownRenderer`, create the `CopyButton` overlay component for code blocks, enhance the `pre` component override to include it, and verify GFM table rendering with the typography plugin.

**Key Deliverables**:
- Enhance `MarkdownRenderer` to import `getRehypePlugins()` and pass as `rehypePlugins` prop to `react-markdown`
- Create `ui/components/documents/copy-button.tsx` — overlay button with clipboard API, Copy/Check icon swap, 2-second success state, hover visibility, focus ring, `aria-label`, `aria-live` announcement
- Add custom `pre` component override with `relative` positioning and `CopyButton` overlay extracting raw text from children
- Verify GFM tables render with borders, alternating row shading, and horizontal scroll via typography plugin + existing `table` override
- Export `CopyButton` from `ui/components/documents/index.ts`

**File Targets**:
| Action | File |
|--------|------|
| CREATE | `ui/components/documents/copy-button.tsx` |
| MODIFY | `ui/components/documents/markdown-renderer.tsx` |
| MODIFY | `ui/components/documents/index.ts` |

### T03 — Heading Anchor Links with In-Pane Smooth Scrolling

**Objective**: Add custom heading component overrides (h1–h6) to `MarkdownRenderer` that style the anchor links generated by `rehype-autolink-headings` with a hover-visible hash icon and implement smooth in-pane scrolling targeting the `ScrollArea` viewport.

**Key Deliverables**:
- Add custom heading component overrides (h1–h6) to `MarkdownRenderer`'s `components` prop
- Style anchor links with Hash icon (Lucide), `group-hover:opacity-70` transition, `text-muted-foreground`
- Implement click handler that smooth-scrolls to heading `id` within the `ScrollArea` viewport (not `window`)
- Respect `prefers-reduced-motion` (instant scroll when reduced motion preferred)
- Ensure anchor links have `aria-label="Link to section: {heading text}"` and visible focus ring

**File Targets**:
| Action | File |
|--------|------|
| MODIFY | `ui/components/documents/markdown-renderer.tsx` |

## Execution Order

```
T01 (REHYPE-INFRASTRUCTURE)
 └→ T02 (SYNTAX-COPY-TABLES — depends on T01)
     └→ T03 (HEADING-ANCHORS — depends on T02)
```

**Sequential execution order**: T01 → T02 → T03

T01 creates the infrastructure modules (`shiki-adapter.ts`, `rehype-config.ts`, shiki CSS). T02 wires the pipeline into `MarkdownRenderer` and adds the `CopyButton`/`pre` override. T03 adds heading component overrides to the same `MarkdownRenderer` — it depends on T02 because both modify the `components` prop of `react-markdown` and T03 needs the rehype pipeline (including `rehype-slug` and `rehype-autolink-headings`) to be actively running in `MarkdownRenderer` for heading anchors to function.

No parallel-ready pairs exist — each task builds on the previous task's output file.

## Phase Exit Criteria

- [ ] Code blocks in JS, TS, JSON, YAML, shell, CSS, and HTML render with token-level syntax coloring
- [ ] Syntax highlighting switches between light and dark themes without re-render (CSS variable toggle)
- [ ] Copy button appears on code block hover; clicking copies raw code to clipboard with visual success feedback
- [ ] Headings display anchor icon on hover; clicking smooth-scrolls within the `ScrollArea` pane
- [ ] GFM tables render with visible borders, alternating row shading, and horizontal scroll on overflow
- [ ] Rehype plugin ordering is sanitize → shiki → slug → autolink (verified in `rehype-config.ts`)
- [ ] Custom sanitize schema allows `language-*` classes on `code` elements
- [ ] All tasks complete with status `complete`
- [ ] Build passes
- [ ] All tests pass
- [ ] Phase review passed

## Known Risks for This Phase

- **R-2 (from Master Plan): Rehype plugin ordering causes sanitize to strip shiki output or heading IDs** — Mitigated by encapsulating the exact ordering (sanitize → shiki → slug → autolink) in `rehype-config.ts` as a single source of truth. T01 establishes the ordering; T02 verifies it by rendering syntax-highlighted code blocks; T03 verifies heading IDs are not prefixed.
- **Shiki `language-*` class stripping**: If the custom sanitize schema is misconfigured, `rehype-sanitize` will strip `language-*` classes from `code` elements before shiki can detect languages, resulting in no syntax highlighting. T01 must configure the schema correctly, and T02 will validate by rendering multi-language code blocks.
- **Scroll container interaction with overlays**: Phase 1 Review recommends verifying that `CopyButton` overlays and heading anchor links interact correctly with the `ScrollArea` viewport. T02 and T03 must verify these interactive elements work within the established scroll container.
