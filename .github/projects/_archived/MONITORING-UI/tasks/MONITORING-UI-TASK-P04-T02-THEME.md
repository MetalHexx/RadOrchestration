---
project: "MONITORING-UI"
phase: 4
task: 2
title: "Theme Toggle + Flash Prevention"
status: "pending"
skills_required: ["react", "typescript"]
skills_optional: ["shadcn"]
estimated_files: 5
---

# Theme Toggle + Flash Prevention

## Objective

Create a three-way theme toggle (System / Dark / Light) with a `useTheme` hook that persists preference to `localStorage`, applies the `dark` class on `<html>` via Tailwind's class strategy, and integrates an inline `<script>` in the root layout to prevent flash-of-wrong-theme (FOWT) on page load. Wire the `ThemeToggle` component into the `AppHeader`.

## Context

The project uses Next.js 15 App Router with Tailwind CSS v4. Dark mode is configured via the `@custom-variant dark (&:is(.dark *))` directive in `globals.css`, which triggers on a `dark` class on any ancestor element. The shadcn `ToggleGroup` component (base-ui backed) is already installed at `ui/components/ui/toggle-group.tsx`. The root layout (`ui/app/layout.tsx`) already contains a `suppressHydrationWarning` attribute on `<html>` and an inline `<script>` that reads `localStorage` key `monitoring-ui-theme` and sets/removes the `dark` class before first paint — this script must be preserved and verified for correctness. The `AppHeader` currently renders a disabled placeholder `<Button>` with a Moon icon where the theme toggle should go — this must be replaced with the new `ThemeToggle` component.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/hooks/use-theme.ts` | `useTheme` hook with localStorage persistence and `matchMedia` listener |
| CREATE | `ui/components/theme/theme-toggle.tsx` | Three-way segmented toggle using shadcn `ToggleGroup` |
| CREATE | `ui/components/theme/index.ts` | Barrel exports |
| MODIFY | `ui/app/layout.tsx` | Verify/update inline theme script for correctness |
| MODIFY | `ui/components/layout/app-header.tsx` | Replace disabled Moon button with `ThemeToggle` |

## Implementation Steps

1. **Create `ui/hooks/use-theme.ts`** — Implement the `useTheme` hook. On mount, read `localStorage` key `monitoring-ui-theme` (default: `"system"`). Set up a `matchMedia('(prefers-color-scheme: dark)')` change listener to re-resolve when OS preference changes. The `setTheme` function writes to `localStorage` and immediately applies/removes the `dark` class on `document.documentElement`. Compute `resolvedTheme` as `"dark"` or `"light"` — when theme is `"system"`, resolve via `matchMedia`. On SSR (no `window`), default `resolvedTheme` to `"light"` and `theme` to `"system"`. Clean up the `matchMedia` listener on unmount.

2. **Create `ui/components/theme/theme-toggle.tsx`** — Build a `ThemeToggle` component using the shadcn `ToggleGroup` and `ToggleGroupItem` from `@/components/ui/toggle-group`. Render three items: Monitor icon (system), Moon icon (dark), Sun icon (light). Import icons from `lucide-react`. Use `useTheme()` to get current `theme` and `setTheme`. Map the `ToggleGroup` value to the active theme and the `onValueChange` callback to `setTheme`. Use variant `"outline"` and size `"sm"` for compact appearance. Add `aria-label="Theme preference"` on the `ToggleGroup`.

3. **Create `ui/components/theme/index.ts`** — Export `ThemeToggle` from `./theme-toggle`.

4. **Verify the inline `<script>` in `ui/app/layout.tsx`** — The existing script reads `monitoring-ui-theme` from `localStorage` and adds/removes the `dark` class. Verify the logic handles all three cases correctly: (a) `"dark"` → add `dark` class, (b) `"light"` → remove `dark` class, (c) `"system"` or absent → check `matchMedia('(prefers-color-scheme: dark)')` and add/remove accordingly. Fix the operator precedence bug in the current script: `(!theme && ...) || (theme === 'system' && ...)` — the existing code has `|| theme === 'system' && ...` without proper grouping. Ensure `suppressHydrationWarning` remains on `<html>`.

5. **Modify `ui/components/layout/app-header.tsx`** — Remove the `Moon` icon import. Remove the disabled `<Button>` placeholder for theme. Import `ThemeToggle` from `@/components/theme`. Render `<ThemeToggle />` in the same position (rightmost in the header button group, after the config button).

6. **Verify dark mode works end-to-end** — Confirm that toggling to Dark applies `class="dark"` on `<html>`, Light removes it, and System follows OS preference. Confirm `localStorage` key `monitoring-ui-theme` is updated on every toggle. Confirm page reload preserves the chosen theme without flash.

## Contracts & Interfaces

```typescript
// ui/hooks/use-theme.ts

type Theme = 'system' | 'dark' | 'light';

interface UseThemeReturn {
  /** Current theme preference (what the user chose) */
  theme: Theme;
  /** Update theme preference — writes to localStorage and applies dark class */
  setTheme: (theme: Theme) => void;
  /** Actual applied theme after system resolution — always 'dark' or 'light' */
  resolvedTheme: 'dark' | 'light';
}

function useTheme(): UseThemeReturn;
```

```typescript
// ui/components/theme/theme-toggle.tsx

// No external props — ThemeToggle is self-contained, uses useTheme() internally
export function ThemeToggle(): JSX.Element;
```

```typescript
// ui/components/layout/app-header.tsx — updated props (unchanged)
interface AppHeaderProps {
  sseStatus: "connected" | "reconnecting" | "disconnected";
  onReconnect: () => void;
  onConfigClick?: () => void;
}
```

## Styles & Design Tokens

- **Dark mode activation**: `@custom-variant dark (&:is(.dark *))` in `globals.css` — Tailwind dark classes activate when any ancestor has `class="dark"`
- **localStorage key**: `monitoring-ui-theme`
- **Default theme**: `system`
- **Header background**: `var(--header-bg)` (light: `oklch(1 0 0)`, dark: `oklch(0.205 0 0)`)
- **Header border**: `var(--header-border)` (light: `oklch(0.922 0 0)`, dark: `oklch(1 0 0 / 10%)`)
- **Muted foreground (for inactive icons)**: `var(--muted-foreground)` (light: `oklch(0.556 0 0)`, dark: `oklch(0.708 0 0)`)
- **Foreground (for active/pressed state)**: `var(--foreground)` (light: `oklch(0.145 0 0)`, dark: `oklch(0.985 0 0)`)
- **Toggle pressed state**: The shadcn `ToggleGroupItem` uses `aria-pressed:bg-muted` / `data-[state=on]:bg-muted` for pressed styling — no custom token needed
- **Lucide icons**: `Monitor` (system), `Moon` (dark), `Sun` (light) — size 14px (`size={14}`)
- **ToggleGroup variant**: `"outline"`, size: `"sm"`

## Test Requirements

- [ ] `useTheme` returns `{ theme: 'system', resolvedTheme: 'dark' | 'light' }` on initial load with no localStorage value
- [ ] `setTheme('dark')` adds `dark` class to `document.documentElement` and writes `'dark'` to `localStorage` key `monitoring-ui-theme`
- [ ] `setTheme('light')` removes `dark` class from `document.documentElement` and writes `'light'` to localStorage
- [ ] `setTheme('system')` resolves based on `matchMedia('(prefers-color-scheme: dark)')` — adds `dark` if OS is dark, removes if OS is light
- [ ] `ThemeToggle` renders three toggle items (System, Dark, Light) with correct Lucide icons
- [ ] Clicking a toggle item calls `setTheme` with the corresponding value and highlights the active option
- [ ] Inline `<script>` in layout.tsx correctly applies `dark` class before first paint when localStorage has `'dark'` or when OS prefers dark and no preference is saved
- [ ] No flash of wrong theme on page reload in any of the three states
- [ ] `AppHeader` renders `ThemeToggle` in the rightmost position (after config button)

## Acceptance Criteria

- [ ] `ui/hooks/use-theme.ts` exports a `useTheme` hook matching the `UseThemeReturn` interface
- [ ] `useTheme` persists preference to `localStorage` key `monitoring-ui-theme`
- [ ] `useTheme` applies/removes `dark` class on `document.documentElement`
- [ ] `useTheme` listens for `matchMedia` changes and updates `resolvedTheme` when OS preference changes
- [ ] `ThemeToggle` renders a three-way segmented toggle (Monitor/Moon/Sun icons) using shadcn `ToggleGroup`
- [ ] Active theme option is visually highlighted (pressed state)
- [ ] `ThemeToggle` appears in `AppHeader` in the rightmost position
- [ ] Inline `<script>` in `layout.tsx` prevents FOWT for all three theme states (system/dark/light)
- [ ] `<html>` element has `suppressHydrationWarning` attribute
- [ ] Dark mode CSS custom properties apply correctly — background, foreground, card colors, etc.
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT install `next-themes` or any third-party theme library — implement `useTheme` from scratch
- Do NOT modify `globals.css` — the dark mode tokens are already fully defined
- Do NOT remove `suppressHydrationWarning` from the `<html>` element
- Do NOT change the `AppHeaderProps` interface — `ThemeToggle` is self-contained and takes no props from the header
- Do NOT add theme-related props to `page.tsx` — `ThemeToggle` reads state from `useTheme` directly
- Use only icons from `lucide-react` (already installed): `Monitor`, `Moon`, `Sun`
- Use the existing shadcn `ToggleGroup` and `ToggleGroupItem` from `@/components/ui/toggle-group` — do not create a custom toggle component
- Accessibility enhancements beyond basic `aria-label` on the toggle group are deferred to T03
