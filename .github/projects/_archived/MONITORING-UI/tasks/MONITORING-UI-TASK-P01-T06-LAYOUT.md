---
project: "MONITORING-UI"
phase: 1
task: 6
title: "Root Layout + Global Styles + Error Boundaries"
status: "pending"
skills_required: ["nextjs", "css"]
skills_optional: []
estimated_files: 5
---

# Root Layout + Global Styles + Error Boundaries

## Objective

Replace the default Next.js root layout and global styles with a production-ready configuration — Inter font via `next/font/google`, class-based dark mode with flash-prevention script, all CSS design tokens for pipeline tiers/status/verdicts/severity added alongside the existing shadcn tokens, and root-level error/loading/not-found boundary components.

## Context

The `/ui` directory is a Next.js 14 App Router project with Tailwind CSS v4 and shadcn/ui already configured. The current `layout.tsx` uses Geist local fonts and has default metadata. The current `globals.css` contains shadcn/ui tokens in oklch format with Tailwind v4 `@theme inline` directives. This task extends (not replaces) those tokens with application-specific CSS custom properties for pipeline visualization, and replaces the layout with the project's font and dark mode configuration. The current `page.tsx` is the default create-next-app boilerplate that will be replaced with a minimal placeholder.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/layout.tsx` | Replace: Inter font, metadata, dark mode class, inline theme script |
| MODIFY | `ui/app/globals.css` | Extend: add design tokens for tiers, status, verdicts, severity, connections, layout |
| CREATE | `ui/app/error.tsx` | Root error boundary (client component) |
| CREATE | `ui/app/loading.tsx` | Root loading skeleton |
| CREATE | `ui/app/not-found.tsx` | 404 page |
| MODIFY | `ui/app/page.tsx` | Replace default boilerplate with minimal placeholder |

## Implementation Steps

1. **Modify `ui/app/globals.css`** — Keep ALL existing content (Tailwind imports, `@custom-variant`, `@theme inline`, shadcn tokens in `:root` and `.dark`). APPEND the new CSS custom properties into the existing `:root` block and `.dark` block. Add the `@theme inline` entries for new color tokens that need Tailwind utility support. See the "Full globals.css" section below for the exact final content.

2. **Modify `ui/app/layout.tsx`** — Replace completely. Use `Inter` from `next/font/google` with `subsets: ['latin']`, `variable: '--font-inter'`. Set metadata title to `"Orchestration Dashboard"` and description to `"Real-time monitoring dashboard for the orchestration pipeline"`. The `<html>` tag must have `lang="en"` and `suppressHydrationWarning`. Insert an inline `<script>` inside `<head>` that reads `localStorage.getItem('monitoring-ui-theme')` and applies the `dark` class before first paint. Apply the Inter font variable class to `<body>`. See the "Full layout.tsx" section below.

3. **Create `ui/app/error.tsx`** — Must start with `'use client'`. Accept `error` and `reset` props. Render a centered error card with the error message and a "Try again" button that calls `reset()`. Use Tailwind classes consistent with the design system.

4. **Create `ui/app/loading.tsx`** — Render a skeleton placeholder simulating the dashboard layout (sidebar-shaped skeleton + main content skeletons). Import `Skeleton` from `@/components/ui/skeleton`.

5. **Create `ui/app/not-found.tsx`** — Render a centered 404 message with a link back to the root page. Import `Link` from `next/link`.

6. **Modify `ui/app/page.tsx`** — Replace the entire default create-next-app boilerplate with a minimal placeholder `<div>` containing the text "Orchestration Dashboard" and a subtitle "Dashboard components will be added in Phase 2." This page will be completely replaced in Phase 2.

## Full globals.css

Replace the entire file with the following content. This preserves all existing shadcn tokens and adds the new design tokens.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", monospace;
}

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.58 0.22 27);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: oklch(0.809 0.105 251.813);
    --chart-2: oklch(0.623 0.214 259.815);
    --chart-3: oklch(0.546 0.245 262.881);
    --chart-4: oklch(0.488 0.243 264.376);
    --chart-5: oklch(0.424 0.199 265.638);
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);

    /* ── Pipeline Tier Colors ── */
    --tier-planning: hsl(217, 91%, 60%);
    --tier-execution: hsl(38, 92%, 50%);
    --tier-review: hsl(271, 91%, 65%);
    --tier-complete: hsl(142, 71%, 45%);
    --tier-halted: hsl(0, 84%, 60%);
    --tier-not-initialized: hsl(215, 14%, 57%);

    /* ── Status Colors ── */
    --status-complete: hsl(142, 71%, 45%);
    --status-in-progress: hsl(217, 91%, 60%);
    --status-not-started: hsl(215, 14%, 57%);
    --status-failed: hsl(0, 84%, 60%);
    --status-halted: hsl(0, 84%, 60%);
    --status-skipped: hsl(215, 14%, 57%);

    /* ── Review Verdict Colors ── */
    --verdict-approved: hsl(142, 71%, 45%);
    --verdict-changes-requested: hsl(38, 92%, 50%);
    --verdict-rejected: hsl(0, 84%, 60%);

    /* ── Severity Colors ── */
    --severity-critical: hsl(0, 84%, 60%);
    --severity-minor: hsl(38, 92%, 50%);

    /* ── Connection Status Colors ── */
    --connection-ok: hsl(142, 71%, 45%);
    --connection-warning: hsl(38, 92%, 50%);
    --connection-error: hsl(0, 84%, 60%);

    /* ── Surface & Layout Tokens ── */
    --header-bg: var(--card);
    --header-border: var(--border);
    --sidebar-bg: var(--card);
    --sidebar-width: 260px;
    --sidebar-collapsed-width: 48px;
    --drawer-width: 640px;
    --metadata-bg: var(--muted);
    --color-error-bg: hsl(0, 84%, 97%);
    --color-error-border: hsl(0, 84%, 80%);
    --color-link: hsl(217, 91%, 60%);
    --color-link-disabled: hsl(215, 14%, 57%);
    --color-warning: hsl(38, 92%, 50%);
    --color-progress-fill: hsl(217, 91%, 60%);
    --color-progress-track: hsl(220, 14%, 96%);
  }

  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.87 0.00 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.371 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.809 0.105 251.813);
    --chart-2: oklch(0.623 0.214 259.815);
    --chart-3: oklch(0.546 0.245 262.881);
    --chart-4: oklch(0.488 0.243 264.376);
    --chart-5: oklch(0.424 0.199 265.638);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);

    /* ── Pipeline Tier Colors (same in dark mode per Design) ── */
    --tier-planning: hsl(217, 91%, 60%);
    --tier-execution: hsl(38, 92%, 50%);
    --tier-review: hsl(271, 91%, 65%);
    --tier-complete: hsl(142, 71%, 45%);
    --tier-halted: hsl(0, 84%, 60%);
    --tier-not-initialized: hsl(215, 14%, 57%);

    /* ── Status Colors (same in dark mode per Design) ── */
    --status-complete: hsl(142, 71%, 45%);
    --status-in-progress: hsl(217, 91%, 60%);
    --status-not-started: hsl(215, 14%, 57%);
    --status-failed: hsl(0, 84%, 60%);
    --status-halted: hsl(0, 84%, 60%);
    --status-skipped: hsl(215, 14%, 57%);

    /* ── Review Verdict Colors (same in dark mode) ── */
    --verdict-approved: hsl(142, 71%, 45%);
    --verdict-changes-requested: hsl(38, 92%, 50%);
    --verdict-rejected: hsl(0, 84%, 60%);

    /* ── Severity Colors (same in dark mode) ── */
    --severity-critical: hsl(0, 84%, 60%);
    --severity-minor: hsl(38, 92%, 50%);

    /* ── Connection Status Colors (same in dark mode) ── */
    --connection-ok: hsl(142, 71%, 45%);
    --connection-warning: hsl(38, 92%, 50%);
    --connection-error: hsl(0, 84%, 60%);

    /* ── Surface & Layout Tokens (dark mode overrides) ── */
    --color-error-bg: hsl(0, 63%, 15%);
    --color-error-border: hsl(0, 63%, 31%);
    --color-link: hsl(217, 91%, 65%);
    --color-link-disabled: hsl(215, 14%, 40%);
    --color-progress-track: hsl(215, 28%, 17%);
  }

  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## Full layout.tsx

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Orchestration Dashboard",
  description: "Real-time monitoring dashboard for the orchestration pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('monitoring-ui-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches) || theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Key points:**
- `suppressHydrationWarning` on `<html>` prevents React mismatch warnings from the inline script
- The inline `<script>` reads `localStorage` synchronously before first paint to prevent flash-of-wrong-theme (FOWT)
- Logic: if stored theme is `'dark'`, or theme is `'system'`/not-set and OS prefers dark → add `dark` class; otherwise remove it
- `--font-inter` CSS variable is set by `next/font/google` for Tailwind's `font-sans` via `@theme inline`
- `font-sans` utility class applies the Inter font stack defined in `@theme inline`

## Full error.tsx

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md rounded-lg border border-destructive/50 bg-card p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-card-foreground">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

## Full loading.tsx

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="flex h-full w-[260px] flex-col gap-3 border-r border-border bg-card p-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-full" />
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>

        {/* Planning section skeleton */}
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Phase cards skeleton */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Full not-found.tsx

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-6xl font-bold text-muted-foreground">404</div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

## Full page.tsx (Placeholder)

Replace the entire file with:

```tsx
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Orchestration Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Dashboard components will be added in Phase 2.
        </p>
      </div>
    </div>
  );
}
```

## Contracts & Interfaces

No new TypeScript interfaces are defined in this task. The files produced are React components using standard Next.js conventions:

```typescript
// Next.js root layout signature (app/layout.tsx)
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element;

// Next.js error boundary signature (app/error.tsx — "use client")
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element;

// Next.js loading component signature (app/loading.tsx)
export default function Loading(): JSX.Element;

// Next.js not-found component signature (app/not-found.tsx)
export default function NotFound(): JSX.Element;
```

## Styles & Design Tokens

All design tokens are inlined in the "Full globals.css" section above. Summary of tokens added:

**Pipeline Tier Colors** (same light/dark):
- `--tier-planning`: `hsl(217, 91%, 60%)` — blue-500, planning tier badge
- `--tier-execution`: `hsl(38, 92%, 50%)` — amber-500, execution tier badge
- `--tier-review`: `hsl(271, 91%, 65%)` — purple-400, review tier badge
- `--tier-complete`: `hsl(142, 71%, 45%)` — green-500, complete tier badge
- `--tier-halted`: `hsl(0, 84%, 60%)` — red-500, halted tier badge
- `--tier-not-initialized`: `hsl(215, 14%, 57%)` — slate-400, not initialized state

**Status Colors** (same light/dark):
- `--status-complete`: `hsl(142, 71%, 45%)` — green-500
- `--status-in-progress`: `hsl(217, 91%, 60%)` — blue-500
- `--status-not-started`: `hsl(215, 14%, 57%)` — slate-400
- `--status-failed`: `hsl(0, 84%, 60%)` — red-500
- `--status-halted`: `hsl(0, 84%, 60%)` — red-500
- `--status-skipped`: `hsl(215, 14%, 57%)` — slate-400

**Review Verdict Colors** (same light/dark):
- `--verdict-approved`: `hsl(142, 71%, 45%)` — green-500
- `--verdict-changes-requested`: `hsl(38, 92%, 50%)` — amber-500
- `--verdict-rejected`: `hsl(0, 84%, 60%)` — red-500

**Severity Colors** (same light/dark):
- `--severity-critical`: `hsl(0, 84%, 60%)` — red-500
- `--severity-minor`: `hsl(38, 92%, 50%)` — amber-500

**Connection Status Colors** (same light/dark):
- `--connection-ok`: `hsl(142, 71%, 45%)` — green-500
- `--connection-warning`: `hsl(38, 92%, 50%)` — amber-500
- `--connection-error`: `hsl(0, 84%, 60%)` — red-500

**Surface & Layout Tokens** (vary by mode):
- `--header-bg`: `var(--card)` — app header background
- `--header-border`: `var(--border)` — app header bottom border
- `--sidebar-bg`: `var(--card)` — sidebar background
- `--sidebar-width`: `260px` — sidebar expanded width
- `--sidebar-collapsed-width`: `48px` — sidebar collapsed width
- `--drawer-width`: `640px` — document/config drawer max width
- `--metadata-bg`: `var(--muted)` — frontmatter metadata card background
- `--color-error-bg`: light `hsl(0, 84%, 97%)` / dark `hsl(0, 63%, 15%)` — error banner background
- `--color-error-border`: light `hsl(0, 84%, 80%)` / dark `hsl(0, 63%, 31%)` — error banner border
- `--color-link`: light `hsl(217, 91%, 60%)` / dark `hsl(217, 91%, 65%)` — document link color
- `--color-link-disabled`: light `hsl(215, 14%, 57%)` / dark `hsl(215, 14%, 40%)` — disabled link
- `--color-warning`: `hsl(38, 92%, 50%)` — warning indicators
- `--color-progress-fill`: `hsl(217, 91%, 60%)` — progress bar fill
- `--color-progress-track`: light `hsl(220, 14%, 96%)` / dark `hsl(215, 28%, 17%)` — progress bar track

**Typography** (via `@theme inline`):
- `--font-sans`: `var(--font-inter), ui-sans-serif, system-ui, sans-serif` — Inter as primary
- `--font-mono`: `ui-monospace, "JetBrains Mono", monospace` — JetBrains Mono for code

## Test Requirements

- [ ] `npx tsc --noEmit` passes with zero errors across all modified/created files
- [ ] `npm run build` succeeds with zero errors (production build)
- [ ] `npm run lint` passes with zero ESLint errors
- [ ] Opening `localhost:3000` renders the placeholder page without console errors
- [ ] Opening `localhost:3000/nonexistent` renders the 404 page

## Acceptance Criteria

- [ ] `globals.css` contains all three Tailwind `@import` directives, the `@custom-variant dark` directive, the `@theme inline` block with shadcn color mappings PLUS `--font-sans` and `--font-mono` entries
- [ ] `globals.css` `:root` block contains all original shadcn tokens PLUS all pipeline tier tokens (`--tier-planning` through `--tier-not-initialized`), status tokens (`--status-complete` through `--status-skipped`), verdict tokens, severity tokens, connection tokens, and surface/layout tokens
- [ ] `globals.css` `.dark` block contains all original shadcn dark tokens PLUS all design tokens with correct dark-mode overrides (e.g., `--color-error-bg: hsl(0, 63%, 15%)`, `--color-link: hsl(217, 91%, 65%)`)
- [ ] `layout.tsx` uses `Inter` from `next/font/google` with `variable: '--font-inter'` and `subsets: ['latin']`
- [ ] `layout.tsx` `<html>` tag has `lang="en"` and `suppressHydrationWarning`
- [ ] `layout.tsx` includes an inline `<script>` that reads `localStorage.getItem('monitoring-ui-theme')` and applies the `dark` class before first paint
- [ ] `layout.tsx` metadata has `title: "Orchestration Dashboard"`
- [ ] `error.tsx` starts with `'use client'` and accepts `error` and `reset` props
- [ ] `error.tsx` renders an error message and a "Try again" button that calls `reset()`
- [ ] `loading.tsx` imports and uses `Skeleton` from `@/components/ui/skeleton`
- [ ] `loading.tsx` renders sidebar-shaped and main-content-shaped skeleton placeholders
- [ ] `not-found.tsx` renders a 404 message with a `Link` back to `/`
- [ ] `page.tsx` renders a minimal placeholder (not the default create-next-app boilerplate)
- [ ] `npm run build` succeeds with zero errors

## Constraints

- Do NOT remove or alter any existing shadcn token values in `:root` or `.dark` — only ADD new tokens
- Do NOT install new npm packages — all dependencies (`next/font/google`, `next/link`, `@/components/ui/skeleton`) are already available
- Do NOT create component directories or files outside of `ui/app/` — this task only touches `app/` files
- Do NOT add any `'use server'` directives — these are all standard Next.js components
- Do NOT reference external documents (Architecture, Design, etc.) — everything needed is in this handoff
- The `error.tsx` file MUST start with `'use client'` as the first line (Next.js error boundary requirement)
- Keep the Geist font files in `ui/app/fonts/` — do not delete them (they may be referenced by shadcn components)
