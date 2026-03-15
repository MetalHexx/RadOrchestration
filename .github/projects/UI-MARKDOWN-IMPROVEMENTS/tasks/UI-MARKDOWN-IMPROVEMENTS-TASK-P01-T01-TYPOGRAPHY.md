---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 1
task: 1
title: "Register Typography Plugin and Verify Prose Styling"
status: "pending"
skills_required: ["CSS", "Tailwind v4"]
skills_optional: []
estimated_files: 1
---

# Register Typography Plugin and Verify Prose Styling

## Objective

Add the `@plugin "@tailwindcss/typography";` directive to `ui/app/globals.css` so the existing `prose prose-sm dark:prose-invert max-w-none` classes on `MarkdownRenderer` produce actual typographic styling (headings, lists, blockquotes, links, etc.). This is a one-line CSS change — the plugin package (`@tailwindcss/typography` v0.5.19) is already installed but was never registered for Tailwind v4's CSS-first pipeline.

## Context

The project uses Tailwind CSS v4 with CSS-first configuration (`@import "tailwindcss"` in `globals.css`). Tailwind v4 ignores the `plugins: []` array in `tailwind.config.ts` — plugins must be registered via `@plugin "package-name";` directives in the CSS file. The `MarkdownRenderer` component (`ui/components/documents/markdown-renderer.tsx`, line 68) already wraps content in `<div className="prose prose-sm dark:prose-invert max-w-none">`, but these classes are no-ops because the typography plugin is not registered. Dark mode uses class-based toggling via `html.dark` with `@custom-variant dark (&:is(.dark *));` already defined in `globals.css`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/globals.css` | Add `@plugin "@tailwindcss/typography";` after the existing `@import` directives block |

## Implementation Steps

1. Open `ui/app/globals.css`
2. Locate the import block at the top of the file (lines 1–3):
   ```css
   @import "tailwindcss";
   @import "tw-animate-css";
   @import "shadcn/tailwind.css";
   ```
3. Add the `@plugin` directive immediately after the imports and before the `@custom-variant` line:
   ```css
   @plugin "@tailwindcss/typography";
   ```
4. The final top section of the file should read:
   ```css
   @import "tailwindcss";
   @import "tw-animate-css";
   @import "shadcn/tailwind.css";

   @plugin "@tailwindcss/typography";

   @custom-variant dark (&:is(.dark *));
   ```
5. Verify the build completes successfully with no new warnings or errors (`npm run build` or the project's build command from the `ui/` directory)
6. Visually confirm (or verify via build output) that the `prose` utility classes now generate actual CSS rules for typographic elements (headings, paragraphs, lists, blockquotes, links, code, tables, horizontal rules)

## Contracts & Interfaces

No new interfaces or contracts are introduced by this task. The change is purely CSS configuration.

**Existing component that consumes the typography classes** (no modifications needed):

```tsx
// ui/components/documents/markdown-renderer.tsx (line 68, READ ONLY — do NOT modify)
<div className="prose prose-sm dark:prose-invert max-w-none">
```

The `prose` class (from `@tailwindcss/typography`) styles all child HTML elements with typographic defaults:
- `h1`–`h6`: distinct sizes, weights, spacing
- `p`: line-height, margin
- `ul`, `ol`: list styling with markers
- `blockquote`: left border, italic
- `a`: link color, underline
- `code`: inline code background, font
- `pre`: code block background, padding
- `table`: borders, padding
- `hr`: horizontal rule styling
- `strong`, `em`: bold, italic

The `prose-sm` modifier applies a smaller base (`14px`).
The `dark:prose-invert` modifier inverts all prose colors for dark mode — this uses Tailwind's dark variant which is configured via `@custom-variant dark (&:is(.dark *))` in `globals.css`.

## Styles & Design Tokens

No new design tokens are introduced. The typography plugin generates its own internal styles based on the `prose` class system.

**Relevant existing tokens** (already in `globals.css`, no changes needed):
- `--foreground`: Base text color — typography plugin inherits this via Tailwind's color system
- `--background`: Base background — inherited by prose elements
- Dark mode variant: `@custom-variant dark (&:is(.dark *));` — enables `dark:prose-invert` to work

**Tailwind v4 CSS-first plugin registration syntax**:
- Directive: `@plugin "package-name";`
- Must appear at the top level of the CSS file (not inside `@layer` or `@theme`)
- Must appear after `@import "tailwindcss";` (the base import must come first)

## Test Requirements

- [ ] Run the project build (`npm run build` from `ui/`) — must complete with zero new errors and zero new warnings
- [ ] Verify that `prose` class generates CSS rules (the build output or dev server should show typography styles being applied to heading, paragraph, list, blockquote, link, code, table, and hr elements)
- [ ] Verify that `dark:prose-invert` generates the dark mode variant (prose colors should invert when `html` has `class="dark"`)

## Acceptance Criteria

- [ ] `ui/app/globals.css` contains `@plugin "@tailwindcss/typography";` after the `@import` directives
- [ ] All 6 heading levels (h1–h6) render with visually distinct sizes and weights inside `.prose` containers
- [ ] Bold, italic, blockquotes, ordered/unordered lists, links, and horizontal rules render with proper styling inside `.prose` containers
- [ ] `dark:prose-invert` correctly inverts prose colors in dark mode
- [ ] Build passes with no new warnings or errors
- [ ] No regressions to existing UI elements outside the prose context

## Constraints

- Do NOT modify `ui/components/documents/markdown-renderer.tsx` — the component already applies the correct prose classes
- Do NOT modify `ui/tailwind.config.ts` — the `plugins: []` array is the Tailwind v3 approach and is irrelevant to Tailwind v4
- Do NOT add the `@plugin` directive inside `@layer base`, `@theme inline`, or any other block — it must be at the top level
- Do NOT install any new packages — `@tailwindcss/typography` v0.5.19 is already in `dependencies`
- Do NOT add custom prose overrides or typography customizations — this task is strictly about plugin registration
- Preserve all existing content in `globals.css` — only add the single `@plugin` line
