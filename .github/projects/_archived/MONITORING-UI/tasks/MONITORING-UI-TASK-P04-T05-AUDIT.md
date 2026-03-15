---
project: "MONITORING-UI"
phase: 4
task: 5
title: "Accessibility Audit + Contrast Validation"
status: "pending"
skills_required: ["accessibility", "css"]
skills_optional: []
estimated_files: 5
---

# Accessibility Audit + Contrast Validation

## Objective

Audit every CSS color token in `globals.css` for WCAG 2.1 AA contrast compliance in both light and dark themes, fix any violations found, add a unified `focus-visible` ring style, verify all badge components have adequate contrast, perform a final ARIA attribute audit, and add an architecture contract comment noting the `useSSE` signature drift (CF-C).

## Context

This is the final task in Phase 4 and the final task of the entire project. All components are built: sidebar, dashboard, SSE, document viewer, config drawer, theme toggle, keyboard navigation, loading skeletons, and error boundaries. Badge components use CSS custom properties for color, applied via inline `style` attributes. The `PipelineTierBadge` uses a `color-mix(in srgb, var(...) 15%, transparent)` background with full-color text. Other badges (`SeverityBadge`, `ReviewVerdictBadge`, `WarningBadge`, `RetryBadge`) use outline variants with colored text and borders. The theme system uses a `.dark` class on `<html>` with oklch values for base tokens and HSL for semantic tokens. Currently, semantic color tokens (tier, status, verdict, severity, connection) share the SAME HSL values in both light and dark modes, which creates contrast issues against different backgrounds.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/globals.css` | Fix contrast violations in dark-mode semantic tokens; add `focus-visible` ring utility |
| MODIFY | `ui/components/badges/pipeline-tier-badge.tsx` | Adjust background opacity if needed for contrast; verify `aria-label` |
| MODIFY | `ui/components/badges/severity-badge.tsx` | Add tinted background for better contrast on dark backgrounds |
| MODIFY | `ui/components/badges/review-verdict-badge.tsx` | Add tinted background for better contrast on dark backgrounds |
| MODIFY | `ui/components/badges/status-icon.tsx` | Verify/fix icon color contrast in both themes |

## Implementation Steps

1. **Audit light-mode contrast** — For each semantic color token in `:root`, compute the contrast ratio of that color against `--background` (oklch(1 0 0) = white `#ffffff`). Flag any token below 4.5:1 for text or 3:1 for UI components. Use the following reference conversions:

   | Token | HSL Value | Approximate Hex | Against white (#fff) |
   |-------|-----------|-----------------|---------------------|
   | `--tier-planning` / `--status-in-progress` | `hsl(217, 91%, 60%)` | `#3b82f6` | ~3.1:1 — **FAIL for text, PASS for UI** |
   | `--tier-execution` / `--verdict-changes-requested` / `--severity-minor` / `--color-warning` | `hsl(38, 92%, 50%)` | `#f59e0b` | ~2.1:1 — **FAIL** |
   | `--tier-review` | `hsl(271, 91%, 65%)` | `#a855f7` | ~3.3:1 — **FAIL for text, PASS for UI** |
   | `--tier-complete` / `--status-complete` / `--verdict-approved` / `--connection-ok` | `hsl(142, 71%, 45%)` | `#22c55e` | ~2.8:1 — **FAIL** |
   | `--tier-halted` / `--status-failed` / `--severity-critical` / `--connection-error` | `hsl(0, 84%, 60%)` | `#ef4444` | ~3.9:1 — **FAIL for text, PASS for UI** |
   | `--tier-not-initialized` / `--status-not-started` / `--status-skipped` | `hsl(215, 14%, 57%)` | `#8b95a5` | ~3.3:1 — **FAIL for text, PASS for UI** |

2. **Audit dark-mode contrast** — For each semantic token in `.dark`, compute the contrast ratio against `--background` (oklch(0.145 0 0) ≈ `#1c1c1c`). The same HSL values that were too light on white may be fine on dark — but amber/green may still fail against dark backgrounds. Check:

   | Token | Against dark (#1c1c1c approx) |
   |-------|-------------------------------|
   | `--tier-planning` / blue | ~5.7:1 — PASS |
   | `--tier-execution` / amber | ~8.5:1 — PASS |
   | `--tier-review` / purple | ~5.9:1 — PASS |
   | `--tier-complete` / green | ~6.1:1 — PASS |
   | `--tier-halted` / red | ~4.6:1 — PASS |
   | `--tier-not-initialized` / slate | ~4.3:1 — borderline, bump to pass |

3. **Fix light-mode token values** — Override ONLY `:root` semantic tokens that fail. Darken them to meet 4.5:1 against white. Apply these corrected values in `:root`:

   | Token Group | Current Light | Corrected Light | Contrast vs white |
   |-------------|---------------|-----------------|-------------------|
   | Blue (planning, in-progress, link, progress-fill) | `hsl(217, 91%, 60%)` | `hsl(217, 91%, 45%)` | ~5.1:1 ✓ |
   | Amber (execution, changes-requested, minor, warning) | `hsl(38, 92%, 50%)` | `hsl(32, 95%, 34%)` | ~4.6:1 ✓ |
   | Purple (review) | `hsl(271, 91%, 65%)` | `hsl(271, 91%, 46%)` | ~5.2:1 ✓ |
   | Green (complete, approved, connection-ok) | `hsl(142, 71%, 45%)` | `hsl(142, 71%, 33%)` | ~4.8:1 ✓ |
   | Red (halted, failed, critical, connection-error) | `hsl(0, 84%, 60%)` | `hsl(0, 84%, 45%)` | ~5.5:1 ✓ |
   | Slate (not-initialized, not-started, skipped) | `hsl(215, 14%, 57%)` | `hsl(215, 14%, 43%)` | ~4.8:1 ✓ |

   Update ALL tokens in `:root` that reference these base colors. Also update `--color-link`, `--color-progress-fill`, and `--color-warning` to use the corrected values.

4. **Fix dark-mode token values** — Override `.dark` semantic tokens that need adjustment. The main concern is the slate group borderline. Apply:

   | Token Group | Current Dark | Corrected Dark | Contrast vs dark bg |
   |-------------|-------------|----------------|---------------------|
   | Slate (not-initialized, not-started, skipped) | `hsl(215, 14%, 57%)` | `hsl(215, 14%, 63%)` | ~5.0:1 ✓ |

   All other dark-mode semantic tokens already pass. Update the slate tokens in `.dark` to the corrected value.

5. **Add `focus-visible` ring utility** — Add a global rule in `globals.css` (inside `@layer base`) that provides a visible focus ring for interactive elements:

   ```css
   /* ── Focus-visible ring ── */
   :focus-visible {
     outline: 2px solid var(--ring);
     outline-offset: 2px;
   }
   ```

   This works in both themes because `--ring` is already defined separately for `:root` (oklch(0.708 0 0) — ~4.0:1 vs white) and `.dark` (oklch(0.556 0 0) — ~4.3:1 vs #1c1c1c). Both exceed the 3:1 requirement for focus indicators.

6. **Fix badge backgrounds for text contrast** — The `PipelineTierBadge` uses a 15% opacity tinted background. With darkened text colors in light mode, this combination works well (dark text on light tint). Verify and leave as-is if passing.

   For `SeverityBadge` and `ReviewVerdictBadge`, which use `variant="outline"` with colored text on transparent background: Add a tinted background (same `color-mix` pattern as `PipelineTierBadge`) so the badge has its own surface and doesn't rely on the page background for contrast:

   ```tsx
   // SeverityBadge — add tinted background
   style={{
     backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
     color: `var(${config.cssVar})`,
     borderColor: 'transparent',
   }}
   ```

   ```tsx
   // ReviewVerdictBadge — add tinted background
   style={{
     backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
     color: `var(${config.cssVar})`,
     borderColor: 'transparent',
   }}
   ```

7. **Verify `StatusIcon` contrast** — `StatusIcon` uses colored icons (16px Lucide icons). Icons are UI components so they need 3:1 contrast. With the corrected token values, all status icons should meet 3:1 against both light and dark backgrounds. Verify by inspection. If the slate icons (not-started, skipped) still fall short, add an explicit light/dark override. Ensure every icon retains its `role="img"` and `aria-label`.

8. **Final ARIA audit pass** — Grep across all component files to verify:
   - Every interactive element (`button`, `a`, toggle) has an accessible name (`aria-label`, visible text, or `aria-labelledby`)
   - Decorative icons have `aria-hidden="true"` (dot indicators in `PipelineTierBadge` and `ConnectionIndicator`)
   - All `role` attributes are properly paired (`listbox`/`option`, `list`/`listitem`, `dialog`/`aria-modal`, `progressbar`/`aria-valuenow`)
   - `aria-live` regions exist for dynamic content (`ConnectionIndicator`, error banners)
   - No color-only status indicators exist — every colored element has a text label or icon

   Add `aria-hidden="true"` to the decorative dot `<span>` in `PipelineTierBadge`:
   ```tsx
   <span
     className="inline-block h-1.5 w-1.5 rounded-full"
     style={{ backgroundColor: `var(${config.cssVar})` }}
     aria-hidden="true"
   />
   ```

9. **CF-C: Add architecture contract comment for useSSE drift** — The Architecture doc defines `useSSE` as returning `{ status, reconnect }`. The actual implementation returns `{ status, events, reconnect, lastEventTime }` and accepts additional options `maxEvents`. Add a JSDoc comment at the top of `ui/hooks/use-sse.ts` is NOT in scope (we don't modify files not in our target list). Instead, add a comment in the `status-icon.tsx` file header is also wrong. Per the Phase Plan, CF-C is deferred to post-project. Simply note in the handoff that CF-C is acknowledged as documentation-only drift and accept per the Phase Plan deferral decision. **No file change needed for CF-C.**

10. **Verify build and lint** — Run `npm run build` and `npm run lint` from `ui/` directory. Both must pass with zero errors and zero warnings.

## Contracts & Interfaces

### Badge Component Props (existing — do not change signatures)

```typescript
// ui/components/badges/pipeline-tier-badge.tsx
interface PipelineTierBadgeProps {
  tier: PipelineTier | "not_initialized";
}

// ui/components/badges/severity-badge.tsx
interface SeverityBadgeProps {
  severity: Severity | null;
}

// ui/components/badges/review-verdict-badge.tsx
interface ReviewVerdictBadgeProps {
  verdict: ReviewVerdict | null;
}

// ui/components/badges/status-icon.tsx
interface StatusIconProps {
  status: PlanningStepStatus | PhaseStatus | TaskStatus;
  className?: string;
}
```

### CSS Token Contract (all values in `globals.css`)

Light mode (`:root`) background: `oklch(1 0 0)` = `#ffffff`
Dark mode (`.dark`) background: `oklch(0.145 0 0)` ≈ `#1c1c1c`

All semantic color tokens must achieve:
- **4.5:1** contrast ratio against their theme's background for text usage
- **3:1** contrast ratio against their theme's background for UI component usage (icons, borders, dots)

### Focus Ring Contract

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

`:root` `--ring`: `oklch(0.708 0 0)` — ≥3:1 against white
`.dark` `--ring`: `oklch(0.556 0 0)` — ≥3:1 against dark bg

## Styles & Design Tokens

### Corrected Light-Mode Tokens (`:root`)

| Token Group | Corrected Value | Purpose |
|-------------|----------------|---------|
| Blue | `hsl(217, 91%, 45%)` | `--tier-planning`, `--status-in-progress`, `--color-link`, `--color-progress-fill` |
| Amber | `hsl(32, 95%, 34%)` | `--tier-execution`, `--verdict-changes-requested`, `--severity-minor`, `--color-warning`, `--connection-warning` |
| Purple | `hsl(271, 91%, 46%)` | `--tier-review` |
| Green | `hsl(142, 71%, 33%)` | `--tier-complete`, `--status-complete`, `--verdict-approved`, `--connection-ok` |
| Red | `hsl(0, 84%, 45%)` | `--tier-halted`, `--status-failed`, `--status-halted`, `--severity-critical`, `--verdict-rejected`, `--connection-error` |
| Slate | `hsl(215, 14%, 43%)` | `--tier-not-initialized`, `--status-not-started`, `--status-skipped`, `--color-link-disabled` |

### Corrected Dark-Mode Tokens (`.dark`)

| Token Group | Corrected Value | Purpose |
|-------------|----------------|---------|
| Slate | `hsl(215, 14%, 63%)` | `--tier-not-initialized`, `--status-not-started`, `--status-skipped`, `--color-link-disabled` |

All other dark-mode semantic tokens remain unchanged (they already pass 4.5:1).

### Dark-Mode Token Values (unchanged — kept for reference)

| Token | Value |
|-------|-------|
| Blue | `hsl(217, 91%, 60%)` |
| Amber | `hsl(38, 92%, 50%)` |
| Purple | `hsl(271, 91%, 65%)` |
| Green | `hsl(142, 71%, 45%)` |
| Red | `hsl(0, 84%, 60%)` |

### Badge Background Pattern

```css
background-color: color-mix(in srgb, var(--token) 15%, transparent);
color: var(--token);
border-color: transparent;
```

Used by: `PipelineTierBadge` (existing), `SeverityBadge` (to add), `ReviewVerdictBadge` (to add).

## Test Requirements

- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings
- [ ] In light mode: blue token text (`--tier-planning`) is visibly darker than before against white background
- [ ] In light mode: amber token text (`--tier-execution`) is visibly darker than before against white background
- [ ] In light mode: green token text (`--tier-complete`) is visibly darker than before against white background
- [ ] In dark mode: slate token text (`--tier-not-initialized`) is readable against dark background
- [ ] `SeverityBadge` and `ReviewVerdictBadge` have tinted backgrounds (not transparent)
- [ ] `PipelineTierBadge` dot `<span>` has `aria-hidden="true"`
- [ ] All pages render correctly in both light and dark modes (no visual regressions)
- [ ] `:focus-visible` ring is visible when tabbing through interactive elements
- [ ] `prefers-reduced-motion` still disables animations (verify no regression from CSS changes)

## Acceptance Criteria

- [ ] Every `:root` semantic color token achieves ≥4.5:1 contrast against `#ffffff` for text usage
- [ ] Every `.dark` semantic color token achieves ≥4.5:1 contrast against the dark background for text usage
- [ ] `SeverityBadge` renders with `color-mix` tinted background and `borderColor: 'transparent'`
- [ ] `ReviewVerdictBadge` renders with `color-mix` tinted background and `borderColor: 'transparent'`
- [ ] `PipelineTierBadge` decorative dot has `aria-hidden="true"`
- [ ] `globals.css` contains a `:focus-visible` rule with `outline: 2px solid var(--ring)` and `outline-offset: 2px`
- [ ] No color-only status indicators exist — every colored element has an accompanying text label or icon
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] CF-C acknowledged: no file change needed (Architecture drift is documentation-only, deferred per Phase Plan)

## Constraints

- Do NOT change component prop interfaces or function signatures
- Do NOT modify files outside the 5 target files listed above
- Do NOT add new components or new files
- Do NOT change the badge rendering pattern — only adjust CSS values and inline style properties
- Do NOT remove any existing `aria-label` or `role` attributes
- Do NOT modify the `useTheme` hook or `ThemeToggle` component
- Do NOT change the `prefers-reduced-motion` media query (already correct from T04)
- Use HSL values for semantic tokens (not oklch) to maintain consistency with the existing token system
- Keep the same CSS custom property names — only change values
