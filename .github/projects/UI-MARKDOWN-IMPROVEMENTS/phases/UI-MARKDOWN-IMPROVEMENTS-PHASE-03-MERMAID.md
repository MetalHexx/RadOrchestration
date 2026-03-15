---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 3
title: "MERMAID"
status: "active"
total_tasks: 2
tasks:
  - id: "T01-MERMAID-ADAPTER"
    title: "Install Mermaid and Create Adapter Module"
  - id: "T02-MERMAID-COMPONENT"
    title: "MermaidBlock Component and MarkdownRenderer Integration"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 3: MERMAID

## Phase Goal

Render Mermaid-tagged fenced code blocks as interactive SVG diagrams with theme support, error fallback, and SSR safety — using a library adapter pattern consistent with the shiki-adapter established in Phase 2, and a client-only component that dynamically imports mermaid to avoid initial bundle impact and SSR crashes.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-MARKDOWN-IMPROVEMENTS-MASTER-PLAN.md) | Phase 3 scope (mermaid install, adapter, component, integration) and exit criteria |
| [Architecture](../UI-MARKDOWN-IMPROVEMENTS-ARCHITECTURE.md) | Mermaid adapter contract (`initMermaid`, `renderDiagram`, `updateTheme`), MermaidBlock props, mermaid bypass strategy (component override, not rehype plugin), cross-cutting concerns (SSR safety, dynamic import, theme switching) |
| [Design](../UI-MARKDOWN-IMPROVEMENTS-DESIGN.md) | MermaidBlock states (loading → rendered → error), theme-reactive rendering via `useTheme().resolvedTheme`, accessibility (`role="img"`, `aria-label`), responsive overflow handling |
| [PRD](../UI-MARKDOWN-IMPROVEMENTS-PRD.md) | FR-8 (mermaid renders as SVG), FR-15 (client-side only, no SSR), NFR-4 (runtime rendering, no build-time compilation) |
| [Research Findings](../UI-MARKDOWN-IMPROVEMENTS-RESEARCH-FINDINGS.md) | Mermaid library analysis (v11, 3.6M weekly downloads, MIT, DOM-dependent — must dynamically import), dark mode via `mermaid.initialize({ theme: 'dark' })`, component override approach to bypass rehype-sanitize |
| [Phase 2 Review](../reports/UI-MARKDOWN-IMPROVEMENTS-PHASE-REVIEW-P02.md) | Carry-forward: `code` component override in `MarkdownRenderer` uses `isInline = !className` check — supports clean `language-mermaid` detection branch; adapter pattern established by `shiki-adapter.ts` should be followed |

## Carry-Forward from Phase 2

The Phase 2 Review (verdict: approved, action: advanced) identified the following items relevant to Phase 3:

1. **Code override structure ready for mermaid**: The `code` component override in `MarkdownRenderer` checks `isInline` via the absence of `className`. The non-inline path renders `<code className={className}>` — Phase 3 adds a `language-mermaid` detection branch before this fallthrough (P02 Review §Recommendations).
2. **Adapter pattern precedent**: `shiki-adapter.ts` isolates shiki configuration from components. `mermaid-adapter.ts` must follow the same pattern — module-level singleton, stable exports, no React dependencies in the adapter (P02 Review §Recommendations).
3. **CopyButton error handling** (minor, P02 Cross-Task Issue #1): Not addressed in Phase 3 — deferred to Phase 4 polish.

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Install Mermaid and Create Adapter Module | — | `create-task-handoff` | 2 | [Link](../tasks/UI-MARKDOWN-IMPROVEMENTS-TASK-P03-T01-MERMAID-ADAPTER.md) |
| T02 | MermaidBlock Component and MarkdownRenderer Integration | T01 | `create-task-handoff` | 3 | [Link](../tasks/UI-MARKDOWN-IMPROVEMENTS-TASK-P03-T02-MERMAID-COMPONENT.md) |

### T01 — Install Mermaid and Create Adapter Module

**Scope**: Install the `mermaid` npm package and create `ui/lib/mermaid-adapter.ts` — a singleton adapter that dynamically imports mermaid on first use, exposes `initMermaid(theme)`, `renderDiagram(id, code)`, and `updateTheme(theme)`, and maps the app's `'dark'`/`'light'` theme values to mermaid's `'dark'`/`'default'` themes.

**Key deliverables**:
- `mermaid` package added to `package.json` dependencies
- `ui/lib/mermaid-adapter.ts` created with the three exported functions matching the Architecture contract
- Dynamic import via `import('mermaid')` — no top-level import
- Module-level singleton: `initialized` flag + `currentTheme` tracking to avoid redundant re-initialization
- Theme mapping: app `'dark'` → mermaid `'dark'`, app `'light'` → mermaid `'default'`

**Estimated files**: 2 (`package.json`, `ui/lib/mermaid-adapter.ts`)

### T02 — MermaidBlock Component and MarkdownRenderer Integration

**Scope**: Create `ui/components/documents/mermaid-block.tsx` as a `"use client"` component with loading/rendered/error states and reactive theme switching. Integrate mermaid detection into `MarkdownRenderer`'s `code` component override — when `className` contains `language-mermaid`, render `<MermaidBlock>` instead of a code element. Update the barrel export in `ui/components/documents/index.ts`. Verify SSR safety (mermaid never imported server-side).

**Key deliverables**:
- `ui/components/documents/mermaid-block.tsx` — client-only component:
  - Loading state: `bg-muted animate-pulse rounded-md h-48` placeholder
  - Rendered state: SVG diagram inline with `overflow-x-auto` wrapper, `role="img"` and `aria-label`
  - Error state: raw code block with warning badge (`⚠ Diagram render failed`)
  - Theme reactivity: `useTheme().resolvedTheme` triggers `updateTheme()` + re-render via `useEffect`
  - Unique ID generation for render containers
- `ui/components/documents/markdown-renderer.tsx` — enhanced `code` override:
  - Add `language-mermaid` detection: if `className?.includes('language-mermaid')`, extract text from `children` and render `<MermaidBlock code={text} />`
  - Falls through to existing inline/block code handling for all other languages
- `ui/components/documents/index.ts` — add `MermaidBlock` export
- SSR verification: `MermaidBlock` uses `"use client"` directive; mermaid imported only inside `useEffect`; no top-level or render-time imports

**Estimated files**: 3 (`mermaid-block.tsx`, `markdown-renderer.tsx`, `index.ts`)

## Execution Order

```
T01 (infrastructure — adapter module)
 └→ T02 (presentation — component + integration, depends on T01)
```

**Sequential execution order**: T01 → T02

*No parallel-ready pairs — T02 imports from T01's adapter module.*

## Phase Exit Criteria

- [ ] `mermaid` package is installed and listed in `package.json` dependencies
- [ ] ` ```mermaid ` code blocks render as SVG diagrams (flowchart, sequence diagram, class diagram verified)
- [ ] Diagrams switch themes when the user toggles dark/light mode
- [ ] Failed diagram rendering falls back to a styled code block with a warning badge
- [ ] Mermaid library is dynamically imported — not in initial bundle
- [ ] No SSR errors — mermaid never executes during server-side rendering
- [ ] Mermaid SVGs have `role="img"` and `aria-label` for accessibility
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes (`npm run build` with zero errors)

## Known Risks for This Phase

- **R-3 (from Master Plan): Mermaid crashes during SSR in Next.js** — Mitigated by Architecture mandate: `MermaidBlock` is `"use client"`, mermaid is dynamically imported inside `useEffect` only. Phase exit criteria explicitly verify no SSR errors.
- **R-4 (from Master Plan): Sanitizer strips Mermaid SVG output** — Mitigated by Architecture: mermaid renders via component override, not rehype pipeline. No SVG passes through `rehype-sanitize`. The `code` component intercepts `language-mermaid` blocks before they reach the DOM.
- **R-5 (from Master Plan): Mermaid increases bundle size** — Mitigated by dynamic import on first use. Mermaid (~71MB unpacked) is loaded only when a document containing a mermaid block is viewed. No upfront cost.
- **Shiki may attempt to highlight mermaid source**: `@shikijs/rehype` processes all code blocks before component overrides run. If shiki lacks a mermaid grammar, it leaves the block as-is. The `code` component override replaces the output regardless — no functional impact.
