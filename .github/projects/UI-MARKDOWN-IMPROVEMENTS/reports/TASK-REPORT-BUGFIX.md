---
project: "UI-MARKDOWN-IMPROVEMENTS"
type: "task-report"
task: "BUGFIX"
date: "2026-03-15T00:00:00Z"
build_status: "passed"
---

# UI-MARKDOWN-IMPROVEMENTS — Task Report: BUGFIX

## Summary

Two tasks completed: pipeline error log created for the UI-MARKDOWN-IMPROVEMENTS project, and the `runSync finished async. Use run instead` crash in the markdown document viewer was fixed by moving shiki syntax highlighting out of the rehype plugin pipeline and into a client-side React component.

---

## Files Created

| File | Action |
|------|--------|
| `.github/projects/UI-MARKDOWN-IMPROVEMENTS/UI-MARKDOWN-IMPROVEMENTS-ERROR-LOG.md` | Created |
| `ui/components/documents/syntax-highlighter.tsx` | Created |
| `.github/projects/UI-MARKDOWN-IMPROVEMENTS/reports/TASK-REPORT-BUGFIX.md` | Created (this file) |

## Files Modified

| File | Change |
|------|--------|
| `ui/lib/rehype-config.ts` | Removed `rehypeShiki` + `getShikiRehypeOptions` imports and plugin entry |
| `ui/lib/shiki-adapter.ts` | Added `highlightCode(code, lang)` async export using `codeToHtml` from `shiki` |
| `ui/components/documents/markdown-renderer.tsx` | Updated `pre` override to pass-through; updated `code` override to use `SyntaxHighlighter`; removed unused `CopyButton` import |
| `ui/components/documents/index.ts` | Added `SyntaxHighlighter` export |

---

## Task 1: Error Log

**Status: Complete**

Created `.github/projects/UI-MARKDOWN-IMPROVEMENTS/UI-MARKDOWN-IMPROVEMENTS-ERROR-LOG.md` with the required frontmatter, entry table, symptom, pipeline output (JSON), root cause, and workaround sections. File did not previously exist.

---

## Task 2: Fix `runSync finished async`

### Root Cause Addressed

`@shikijs/rehype` registers an async plugin. `react-markdown` v9 calls unified's `runSync` internally, which throws `runSync finished async. Use run instead` when it encounters any async plugin. The fix removes `rehypeShiki` from the rehype pipeline entirely and delegates highlighting to a `"use client"` component that calls `codeToHtml` from `shiki` inside a `useEffect`.

### Fix Approach

1. **`rehype-config.ts`** — `rehypeShiki` and `getShikiRehypeOptions` removed from imports and plugin array. Remaining plugins (`rehypeSanitize`, `rehypeSlug`, `rehypeAutolinkHeadings`) are all synchronous.

2. **`shiki-adapter.ts`** — Added `highlightCode(code, lang): Promise<string>` using `codeToHtml` from `shiki` (already available as a transitive dep via `@shikijs/rehype`). Uses the same dual-theme config (`github-light` / `github-dark`, `defaultColor: false`). Gracefully falls back to `lang: 'text'` if the language is unrecognized.

3. **`syntax-highlighter.tsx`** (`"use client"`) — New component. On mount, calls `highlightCode` and stores result in state. Renders a loading `<pre>` fallback while shiki resolves, then swaps to `dangerouslySetInnerHTML` with the highlighted HTML. Owns its own `<CopyButton>` and `<div className="relative group">` wrapper.

4. **`markdown-renderer.tsx`** — `pre` override simplified to `<>{children}</>` (no wrapper, no `CopyButton`). `code` override routes block code to `<SyntaxHighlighter code={...} lang={...} />`. Mermaid detection and inline code rendering unchanged. Unused `CopyButton` import removed.

5. **`index.ts`** — `SyntaxHighlighter` exported.

### Dual-Theme CSS

No change required. Shiki's `codeToHtml` with `defaultColor: false` still emits `<pre class="shiki ...">` output with `--shiki-light` / `--shiki-dark` CSS variables. The existing CSS in `globals.css` (lines 231–238) continues to work unchanged.

---

## Build Result

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (5/5)
✓ Collecting build traces
✓ Finalizing page optimization
```

**Status: PASSED** — no TypeScript errors, no new warnings beyond the pre-existing `fsevents` platform warning (expected on Windows, unrelated to this change).

---

## Acceptance Criteria

| Criterion | Result |
|-----------|--------|
| Error log created at correct path with required content | Met |
| `runSync finished async` error eliminated | Met — async plugin removed from rehype pipeline |
| Code blocks still highlighted using shiki dual-theme | Met — `highlightCode` uses same config; globals.css unchanged |
| Mermaid detection unchanged | Met |
| Inline code rendering unchanged | Met |
| Heading anchor components unchanged | Met |
| `rehype-slug` and `rehype-autolink-headings` retained | Met |
| `rehype-sanitize` retained | Met |
| Build passes with no TypeScript errors | Met |
| No double-wrapping of `<pre>` / `<CopyButton>` | Met — `SyntaxHighlighter` owns both; `pre` override is a passthrough |
