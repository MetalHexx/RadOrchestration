---
project: "MONITORING-UI"
phase: 1
task: 1
title: "Next.js Project Init + Dependencies + shadcn/ui Setup"
status: "complete"
files_changed: 3
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Next.js Project Init + Dependencies + shadcn/ui Setup

## Summary

Fixed the Tailwind CSS v3/v4 mismatch that was causing the Next.js production build to fail. Upgraded `tailwindcss` from v3 (`^3.4.1`) to v4 (`^4.2.1`), installed `@tailwindcss/postcss` as a dev dependency, updated `postcss.config.mjs` to use the v4 PostCSS plugin, and rewrote `globals.css` to use v4-style imports (`@import "tailwindcss"`), a `@theme inline` block for design token registration, and `@custom-variant dark` for class-based dark mode. The build, TypeScript check, and lint all pass with zero errors.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `ui/package.json` | 49 | Upgraded `tailwindcss` to `^4.2.1`, added `@tailwindcss/postcss@^4.2.1` to devDependencies |
| MODIFIED | `ui/postcss.config.mjs` | 8 | Changed plugin from `tailwindcss` to `@tailwindcss/postcss` |
| MODIFIED | `ui/app/globals.css` | 119 | Removed v3 `@tailwind` directives; added `@import "tailwindcss"`; added `@theme inline` block for color/radius token registration; added `@custom-variant dark` for class-based dark mode; removed unused `.theme` and `html` rules |

## Implementation Notes

The scaffold from the previous attempt had a Tailwind v3/v4 mismatch: `shadcn@4.0.2` generated v4-era CSS imports (`@import "shadcn/tailwind.css"`, `@import "tw-animate-css"`) but `tailwindcss@^3.4.1` was installed and the CSS also contained v3 `@tailwind base/components/utilities` directives.

Key migration decisions for Tailwind v4:

1. **`@import "tailwindcss"` replaces `@tailwind base/components/utilities`** — this is the v4 entry point that brings in all base styles, components, and utilities.
2. **`@theme inline { ... }` registers CSS custom properties as Tailwind theme tokens** — v4 requires explicit theme registration for custom colors. Each `--color-*` entry maps a shadcn design token (e.g., `--border`) to a Tailwind utility class (e.g., `border-border`). Radius tokens (`--radius-sm/md/lg/xl`) are also registered.
3. **`@custom-variant dark (&:is(.dark *))` enables class-based dark mode** — replaces v3's `darkMode: "class"` in `tailwind.config.ts`. The `tailwind.config.ts` file is retained for shadcn CLI compatibility but is no longer the primary config source.
4. **Removed `.theme { --font-sans: var(--font-sans); }` and `html { @apply font-sans; }` rules** — the circular `--font-sans` self-reference was a no-op, and the font is already applied via Next.js's local font loading in `layout.tsx`.

## Tests

No test files were created for this task — the handoff specifies command-line verification only (build, tsc, lint).

| Test | File | Status |
|------|------|--------|
| `npm install` exits code 0 | — | ✅ Pass |
| `npx tsc --noEmit` exits code 0 | — | ✅ Pass |
| `npm run build` exits code 0 | — | ✅ Pass |
| `npm run lint` exits code 0 | — | ✅ Pass |
| All 12 shadcn components exist | `ui/components/ui/*.tsx` | ✅ Pass |
| `lib/utils.ts` exports `cn()` | `ui/lib/utils.ts` | ✅ Pass |
| `.env.local` contains `WORKSPACE_ROOT` | `ui/.env.local` | ✅ Pass |
| `components.json` valid JSON | `ui/components.json` | ✅ Pass |
| `tsconfig.json` has `@/*` path alias | `ui/tsconfig.json` | ✅ Pass |

**Test summary**: 9/9 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `cd ui && npm install` completes without errors | ✅ Met |
| 2 | `cd ui && npx tsc --noEmit` passes (no type errors in scaffolded project) | ✅ Met |
| 3 | `components.json` is configured with correct paths and shadcn/ui settings | ✅ Met |
| 4 | All 12 shadcn/ui components exist in `ui/components/ui/` | ✅ Met |
| 5 | `.env.local` contains `WORKSPACE_ROOT` pointing to workspace root | ✅ Met |
| 6 | `tailwind.config.ts` has `darkMode: 'class'` strategy | ✅ Met — retained in file; v4 dark mode also configured via `@custom-variant dark` in CSS |
| 7 | `tsconfig.json` has `@/*` path alias mapping to `./*` | ✅ Met |
| 8 | `lib/utils.ts` exists and exports `cn()` utility | ✅ Met |
| 9 | `npm run build` succeeds with zero errors | ✅ Met |
| 10 | No lint errors from `npm run lint` | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: ✅ Pass

## Deviations from Handoff

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | Use `@tailwind base; @tailwind components; @tailwind utilities;` in globals.css | Used `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark` | Tailwind v4 replaces the v3 directive syntax with CSS-native `@import`. The v3 directives caused the build to fail. |
| 2 | `darkMode: "class"` only in `tailwind.config.ts` | Also added `@custom-variant dark (&:is(.dark *))` in CSS | Tailwind v4 uses CSS-based configuration; `@custom-variant dark` is the v4 equivalent of the v3 `darkMode: "class"` config option. The `tailwind.config.ts` setting is retained for shadcn CLI compatibility. |
| 3 | Scaffold fresh via `create-next-app` | Fixed existing scaffold | The `ui/` directory already existed with all dependencies and components installed. Only the Tailwind v3/v4 mismatch needed resolution. |

## Recommendations for Next Task

- The `tailwind.config.ts` file is retained primarily for shadcn CLI compatibility (`components.json` references it). In Tailwind v4, all runtime configuration lives in CSS. Future tasks should add theme extensions via `@theme` in `globals.css`, not in `tailwind.config.ts`.
- The `@tailwindcss/typography` plugin (`^0.5.19`) is a v3-era package. If prose styling is needed in later tasks, verify compatibility with Tailwind v4 or use the v4-native `@tailwindcss/typography` equivalent.
