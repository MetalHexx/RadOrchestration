---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 3
task: 2
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15"
---

# Code Review: Phase 3, Task 2 — MERMAID-COMPONENT

## Verdict: APPROVED

## Summary

The MermaidBlock component is cleanly implemented with correct three-state rendering (loading, SVG, error), proper async cleanup, theme reactivity via the local `useTheme` hook, and full accessibility attributes. The MarkdownRenderer integration inserts the `language-mermaid` detection branch in exactly the right position — between the inline code check and the block code fallthrough — using the existing `extractText` utility. The barrel export is added. Build passes with zero errors and zero type/lint issues. The one deviation (importing `useTheme` from `@/hooks/use-theme` instead of `next-themes`) is correct — `next-themes` is not installed and the local hook provides an identical `resolvedTheme` API.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | MermaidBlock lives in Presentation layer, consumes mermaid-adapter from Infrastructure layer per the module map. No direct mermaid import in components. |
| Design consistency | ✅ | Loading placeholder classes (`bg-muted animate-pulse rounded-md h-48`), error badge styling (`text-yellow-600 dark:text-yellow-500 text-sm font-medium`), and rendered wrapper (`overflow-x-auto`) all match the Design spec exactly. |
| Code quality | ✅ | Clean component with proper effect cleanup via `cancelled` flag, stable ID generation via `useRef` with module-level counter, clear state separation. The `updateTheme` call after `initMermaid` is technically redundant (initMermaid already sets the theme) but causes no harm — just a no-op on every invocation. |
| Test coverage | ✅ | No unit test files per handoff constraint. Build and type checking pass. Manual/E2E verification is the intended strategy for this task. |
| Error handling | ✅ | Effect wraps async render in try/catch; error state displays meaningful fallback with raw source; cancelled flag prevents state-after-unmount. |
| Accessibility | ✅ | Loading state has `role="img"` + `aria-label="Loading diagram..."`. Rendered SVG has `role="img"` + `aria-label="Diagram: {first line}"`. Matches handoff requirements. |
| Security | ✅ | SVG output comes from mermaid's `render()` which uses DOMPurify internally. No user-supplied HTML is injected outside of mermaid's rendering pipeline. No exposed secrets or auth concerns. |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| — | — | — | — | No issues found | — |

## Positive Observations

- **Proper async cleanup**: The `cancelled` flag pattern in the useEffect prevents React state updates after unmount — a common pitfall that was handled correctly here.
- **Correct deviation**: The Coder identified that `next-themes` is not installed and correctly substituted the project's own `useTheme` hook which provides the same `resolvedTheme: 'dark' | 'light'` contract.
- **Minimal, focused changes**: Only three files touched, each with a clear, narrow purpose. The MarkdownRenderer change is exactly 4 lines of logic inserted at the right spot — no unnecessary refactoring.
- **Architecture boundary respected**: The component never imports `mermaid` directly — all interaction goes through the adapter, preserving the infrastructure abstraction boundary.
- **Build verified**: `npm run build` passes cleanly. Mermaid library is dynamically imported inside `useEffect` via the adapter — not present in the initial page bundle.

## Recommendations

- The redundant `await updateTheme(theme)` call on line 29 of `mermaid-block.tsx` (after `initMermaid` already sets the theme) could be removed in a future cleanup pass, but is not blocking.
- Phase 3 is ready for phase-level review once all tasks complete.
