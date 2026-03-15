---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 2
task: 1
title: "REHYPE-INFRASTRUCTURE"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 3
---

# REHYPE-INFRASTRUCTURE

## Objective

Install the three new rehype dependencies (`@shikijs/rehype`, `rehype-slug`, `rehype-autolink-headings`), create the shiki configuration adapter (`ui/lib/shiki-adapter.ts`) and the centralized rehype plugin config module (`ui/lib/rehype-config.ts`), and add the shiki dual-theme CSS snippet to `ui/app/globals.css` — establishing the infrastructure layer that subsequent tasks in this phase consume.

## Context

The project uses `react-markdown` with `remark-gfm` and `rehype-sanitize` for runtime markdown rendering inside a document viewer pane. Phase 1 registered the `@tailwindcss/typography` plugin and fixed the scroll/layout.  This task creates two new library adapter modules — `shiki-adapter.ts` isolates shiki's API behind a stable interface, and `rehype-config.ts` is the single source of truth for the rehype plugin array and sanitize schema. Dark mode is class-based (`html.dark`) controlled by a custom `useTheme` hook. The existing `rehype-sanitize` (already a dependency at `^6.0.0`) strips `language-*` classes from `code` elements by default — the custom sanitize schema created here must allow them so shiki can detect languages.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/lib/shiki-adapter.ts` | Shiki configuration adapter — exports `getShikiRehypeOptions()` |
| CREATE | `ui/lib/rehype-config.ts` | Centralized rehype plugin config — exports `getRehypePlugins()` and `customSanitizeSchema` |
| MODIFY | `ui/app/globals.css` | Add shiki dual-theme CSS toggle snippet after existing rules |

## Implementation Steps

1. **Install npm packages** — Run `npm install @shikijs/rehype@^3.0.0 rehype-slug@^6.0.0 rehype-autolink-headings@^7.0.0` from the `ui/` directory. These are runtime dependencies (not devDependencies).

2. **Create `ui/lib/shiki-adapter.ts`** — Export a `getShikiRehypeOptions()` function that returns an `RehypeShikiOptions` object configured with dual themes (`github-light` / `github-dark`), `defaultColor: false` to emit CSS variables instead of inline colors, and shiki's built-in lazy loading for grammars.

3. **Create `ui/lib/rehype-config.ts`** — Export `getRehypePlugins()` returning the ordered rehype plugin array and export `customSanitizeSchema`. Import the sanitize schema from `rehype-sanitize`, shiki options from `./shiki-adapter`, and the three rehype plugins. The plugin array must follow this exact order:
   1. `rehype-sanitize` (with `customSanitizeSchema`)
   2. `@shikijs/rehype` (with shiki options from adapter)
   3. `rehype-slug`
   4. `rehype-autolink-headings`

4. **Build the custom sanitize schema** in `rehype-config.ts` — Extend `defaultSchema` from `rehype-sanitize` to allow `className` values matching `/^language-./` on `code` elements. This permits shiki to detect the code block language after sanitization.

5. **Add shiki dual-theme CSS** to `ui/app/globals.css` — Append the CSS snippet at the end of the file (after the closing `}` of the `.dark` block in `@layer base`). The snippet toggles shiki's CSS variables based on the `html.dark` class.

6. **Verify build** — Run `npm run build` from the `ui/` directory to confirm zero errors. The new modules are not yet imported by any component (that happens in T02), but they must compile cleanly.

## Contracts & Interfaces

### Shiki Adapter (`ui/lib/shiki-adapter.ts`)

```typescript
// ui/lib/shiki-adapter.ts

import type { RehypeShikiOptions } from '@shikijs/rehype';

/**
 * Returns the options object for @shikijs/rehype.
 * Isolates shiki configuration from the React component layer.
 * If shiki is swapped for another highlighter, only this file changes.
 */
export function getShikiRehypeOptions(): RehypeShikiOptions {
  return {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  };
}
```

Configuration details:
- `themes.light: 'github-light'` — light theme for syntax tokens
- `themes.dark: 'github-dark'` — dark theme for syntax tokens
- `defaultColor: false` — emit CSS variables (`--shiki-light`, `--shiki-dark`) instead of inline colors; enables theme switching without re-render

### Rehype Plugin Config (`ui/lib/rehype-config.ts`)

```typescript
// ui/lib/rehype-config.ts

import type { PluggableList } from 'unified';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeShiki from '@shikijs/rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getShikiRehypeOptions } from './shiki-adapter';

/**
 * Custom sanitize schema that extends the default to allow
 * `language-*` classes on `code` elements (required for shiki
 * to detect code block languages).
 */
export const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-./],
    ],
  },
};

/**
 * Returns the ordered rehype plugin array for react-markdown.
 * Single source of truth for plugin ordering:
 *   1. rehype-sanitize (with custom schema)
 *   2. @shikijs/rehype (syntax highlighting)
 *   3. rehype-slug (heading IDs)
 *   4. rehype-autolink-headings (anchor links)
 */
export function getRehypePlugins(): PluggableList {
  return [
    [rehypeSanitize, customSanitizeSchema],
    [rehypeShiki, getShikiRehypeOptions()],
    rehypeSlug,
    rehypeAutolinkHeadings,
  ];
}
```

### Plugin Ordering Rationale (DO NOT deviate)

```
Raw HTML AST
  → rehype-sanitize    Cleans raw HTML; allows language-* classes on code
  → @shikijs/rehype    Highlights code blocks; emits CSS variable spans (survives because sanitize already ran)
  → rehype-slug        Adds id attributes to h1–h6 (IDs not prefixed because sanitize already ran)
  → rehype-autolink    Adds <a> links inside headings (requires ids from slug)
  → React elements
```

- Sanitize runs **first** so shiki's inline `style` attributes with CSS variables are not stripped
- Slug runs **after** sanitize so heading IDs are not prefixed with `user-content-`
- Autolink runs **last** because it requires headings to already have `id` attributes from slug

## Styles & Design Tokens

### Shiki Dual-Theme CSS Snippet

Add this CSS at the end of `ui/app/globals.css` (outside of `@layer base`, after all existing rules):

```css
/* ── Shiki Dual-Theme Toggle ── */
html.dark .shiki,
html.dark .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
```

This snippet toggles between the light and dark shiki CSS variables. In light mode, shiki's default output uses `--shiki-light` / `--shiki-light-bg`. When `html.dark` is applied, the snippet overrides to `--shiki-dark` / `--shiki-dark-bg`. Theme switching requires no re-render — CSS handles it.

### Shiki CSS Variables (auto-generated per span by `@shikijs/rehype`)

| Variable | Purpose |
|----------|---------|
| `--shiki-light` | Token text color in light mode |
| `--shiki-dark` | Token text color in dark mode |
| `--shiki-light-bg` | Code block background in light mode |
| `--shiki-dark-bg` | Code block background in dark mode |
| `--shiki-dark-font-style` | Font style in dark mode |
| `--shiki-dark-font-weight` | Font weight in dark mode |
| `--shiki-dark-text-decoration` | Text decoration in dark mode |

## Test Requirements

- [ ] `npm run build` completes with zero errors and zero new warnings from the `ui/` directory
- [ ] `ui/lib/shiki-adapter.ts` compiles and exports `getShikiRehypeOptions` as a function
- [ ] `ui/lib/rehype-config.ts` compiles and exports `getRehypePlugins` as a function and `customSanitizeSchema` as an object
- [ ] `getRehypePlugins()` returns an array of exactly 4 entries in the order: sanitize, shiki, slug, autolink
- [ ] `customSanitizeSchema.attributes.code` includes a regex pattern entry matching `language-*` classes
- [ ] The shiki dual-theme CSS snippet is present in `globals.css` and targets `html.dark .shiki` and `html.dark .shiki span`
- [ ] TypeScript types resolve correctly — `RehypeShikiOptions` from `@shikijs/rehype` and `PluggableList` from `unified`

## Acceptance Criteria

- [ ] `@shikijs/rehype`, `rehype-slug`, and `rehype-autolink-headings` are listed in `ui/package.json` `dependencies`
- [ ] `ui/lib/shiki-adapter.ts` exists and exports `getShikiRehypeOptions()` returning an object with `themes: { light: 'github-light', dark: 'github-dark' }` and `defaultColor: false`
- [ ] `ui/lib/rehype-config.ts` exists and exports `getRehypePlugins()` returning a `PluggableList` with exactly 4 plugins in order: rehype-sanitize → @shikijs/rehype → rehype-slug → rehype-autolink-headings
- [ ] `ui/lib/rehype-config.ts` exports `customSanitizeSchema` that extends `defaultSchema` to allow `className` matching `/^language-./` on `code` elements
- [ ] `ui/app/globals.css` contains the shiki dual-theme CSS snippet that toggles `--shiki-dark` / `--shiki-dark-bg` variables on `html.dark .shiki` and `html.dark .shiki span`
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/components/documents/markdown-renderer.tsx` — wiring the rehype pipeline into the renderer is Task T02
- Do NOT import or use the new modules in any React component — this task only creates the infrastructure modules
- Do NOT modify `ui/lib/normalizer.ts`, `ui/types/state.ts`, or any existing component files
- Use the exact theme names `github-light` and `github-dark` — do not substitute alternative themes
- Use `defaultColor: false` in shiki options — this is required for the dual-theme CSS variable approach
- The plugin ordering (sanitize → shiki → slug → autolink) is architecturally mandated — do not reorder
- Install packages as regular `dependencies`, not `devDependencies`
- The shiki CSS snippet must use `html.dark` (not `.dark`) to match the app's dark mode strategy (class on `<html>` element)
