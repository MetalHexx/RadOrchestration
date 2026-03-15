---
project: "MONITORING-UI"
phase: 2
task: 1
title: "Badge Component Library"
status: "pending"
skills_required: ["react", "typescript", "tailwindcss"]
skills_optional: ["accessibility"]
estimated_files: 9
---

# Badge Component Library

## Objective

Create all 8 badge/indicator components used throughout the dashboard and sidebar. Each component uses the shadcn/ui `Badge` as a base (where appropriate), reads colors from CSS custom properties already defined in `globals.css`, and includes proper ARIA labels for accessibility.

## Context

This is the first task of Phase 2 (Dashboard Components + Sidebar). Phase 1 established the project scaffold with Next.js 14 App Router, TypeScript, shadcn/ui, and Tailwind CSS v4. All domain types live in `ui/types/state.ts`. CSS custom properties for tier, status, verdict, severity, connection, and warning colors are already defined in `ui/app/globals.css` under both `:root` and `.dark` selectors. The shadcn/ui `Badge` component is available at `@/components/ui/badge`. Lucide React icons are installed via `lucide-react`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/badges/pipeline-tier-badge.tsx` | PipelineTierBadge component |
| CREATE | `ui/components/badges/status-icon.tsx` | StatusIcon component |
| CREATE | `ui/components/badges/review-verdict-badge.tsx` | ReviewVerdictBadge component |
| CREATE | `ui/components/badges/severity-badge.tsx` | SeverityBadge component |
| CREATE | `ui/components/badges/retry-badge.tsx` | RetryBadge component |
| CREATE | `ui/components/badges/warning-badge.tsx` | WarningBadge component |
| CREATE | `ui/components/badges/connection-indicator.tsx` | ConnectionIndicator component |
| CREATE | `ui/components/badges/lock-badge.tsx` | LockBadge component |
| CREATE | `ui/components/badges/index.ts` | Barrel export for all badge components |

## Implementation Steps

1. Create the `ui/components/badges/` directory.
2. Implement `PipelineTierBadge` — uses shadcn `Badge` with 15% opacity background, full-color text, and a leading colored dot. Maps each tier value to its CSS variable and display label.
3. Implement `StatusIcon` — renders a single Lucide icon with the correct color for each status. The icon for `in_progress` gets `animate-spin`. Always includes `aria-label` and `role="img"`.
4. Implement `ReviewVerdictBadge` — uses shadcn `Badge` with `variant="outline"`. Color from verdict CSS variable. Returns `null` when `verdict` is `null`.
5. Implement `SeverityBadge` — uses shadcn `Badge`. `critical` = red, `minor` = amber via CSS variables. Returns `null` when `severity` is `null`.
6. Implement `RetryBadge` — pill showing "Retries: N/M" using shadcn `Badge` with `variant="secondary"`. When `retries === max`, style with `--color-warning`.
7. Implement `WarningBadge` — `AlertTriangle` icon + message text in amber, using shadcn `Badge` with `variant="outline"` styled with `--color-warning`.
8. Implement `ConnectionIndicator` — colored dot (8×8 rounded-full) + text label, wrapped in `aria-live="polite"`. Dot pulses for `reconnecting` state.
9. Implement `LockBadge` — small `Lock` icon (14×14) in muted foreground color. No text, just `aria-label="Locked (hard default)"`.
10. Create `ui/components/badges/index.ts` barrel file re-exporting all 8 components.

## Contracts & Interfaces

### Types — import from `@/types/state`

```typescript
// ui/types/state.ts (already exists — DO NOT recreate)

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type Severity = 'minor' | 'critical';
```

### Component Props — define in each component file

```typescript
// ─── pipeline-tier-badge.tsx ────────────────────────────────────────────────
interface PipelineTierBadgeProps {
  tier: PipelineTier | 'not_initialized';
}

// ─── status-icon.tsx ────────────────────────────────────────────────────────
interface StatusIconProps {
  status: PlanningStepStatus | PhaseStatus | TaskStatus;
  className?: string;
}

// ─── review-verdict-badge.tsx ───────────────────────────────────────────────
interface ReviewVerdictBadgeProps {
  verdict: ReviewVerdict | null;
}

// ─── severity-badge.tsx ─────────────────────────────────────────────────────
interface SeverityBadgeProps {
  severity: Severity | null;
}

// ─── retry-badge.tsx ────────────────────────────────────────────────────────
interface RetryBadgeProps {
  retries: number;
  max: number;
}

// ─── warning-badge.tsx ──────────────────────────────────────────────────────
interface WarningBadgeProps {
  message: string;
}

// ─── connection-indicator.tsx ───────────────────────────────────────────────
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

// ─── lock-badge.tsx ─────────────────────────────────────────────────────────
// No props — renders a static lock icon
```

### Existing shadcn Badge API — `@/components/ui/badge`

```tsx
import { Badge } from "@/components/ui/badge";

// Renders as a <span> by default
// Variants: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
// Styling: h-5, text-xs, rounded-4xl, inline-flex, items-center
// Usage:
<Badge variant="outline" className="...">Label text</Badge>
```

## Styles & Design Tokens

All CSS custom properties below are already defined in `ui/app/globals.css` — do NOT modify that file.

### Pipeline Tier — PipelineTierBadge

Each tier renders as a shadcn `Badge` with:
- **Background**: tier color at 15% opacity — use Tailwind arbitrary: `bg-[var(--tier-{key})]/15`
- **Text color**: full tier color — use: `text-[var(--tier-{key})]`
- **Leading dot**: 6×6px, `rounded-full`, full tier color background
- **ARIA**: `aria-label="Pipeline tier: {label}"`

| Tier Value | CSS Variable | Display Label |
|------------|-------------|---------------|
| `planning` | `--tier-planning` | "Planning" |
| `execution` | `--tier-execution` | "Execution" |
| `review` | `--tier-review` | "Review" |
| `complete` | `--tier-complete` | "Complete" |
| `halted` | `--tier-halted` | "Halted" |
| `not_initialized` | `--tier-not-initialized` | "Not Started" |

Implementation pattern — use inline `style` for dynamic CSS variable colors:
```tsx
const TIER_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning:        { label: 'Planning',    cssVar: '--tier-planning' },
  execution:       { label: 'Execution',   cssVar: '--tier-execution' },
  review:          { label: 'Review',      cssVar: '--tier-review' },
  complete:        { label: 'Complete',    cssVar: '--tier-complete' },
  halted:          { label: 'Halted',      cssVar: '--tier-halted' },
  not_initialized: { label: 'Not Started', cssVar: '--tier-not-initialized' },
};

// Use inline styles for the dynamic color:
<Badge
  variant="outline"
  className="gap-1.5 border-transparent"
  style={{
    backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
    color: `var(${config.cssVar})`,
  }}
  aria-label={`Pipeline tier: ${config.label}`}
>
  <span
    className="inline-block h-1.5 w-1.5 rounded-full"
    style={{ backgroundColor: `var(${config.cssVar})` }}
  />
  {config.label}
</Badge>
```

### Status Icons — StatusIcon

Renders one Lucide icon colored by the status CSS variable. Icon size: `size={16}`.

| Status | Lucide Import | CSS Variable | Aria Label |
|--------|---------------|-------------|------------|
| `complete` | `CheckCircle2` | `--status-complete` `hsl(142,71%,45%)` green | "Complete" |
| `in_progress` | `Loader2` | `--status-in-progress` `hsl(217,91%,60%)` blue | "In Progress" |
| `not_started` | `Circle` | `--status-not-started` `hsl(215,14%,57%)` slate | "Not Started" |
| `failed` | `XCircle` | `--status-failed` `hsl(0,84%,60%)` red | "Failed" |
| `halted` | `OctagonX` | `--status-halted` `hsl(0,84%,60%)` red | "Halted" |
| `skipped` | `MinusCircle` | `--status-skipped` `hsl(215,14%,57%)` slate | "Skipped" |

Implementation pattern:
```tsx
import { CheckCircle2, Loader2, Circle, XCircle, OctagonX, MinusCircle } from 'lucide-react';

const STATUS_CONFIG = {
  complete:    { icon: CheckCircle2, cssVar: '--status-complete',    label: 'Complete' },
  in_progress: { icon: Loader2,     cssVar: '--status-in-progress', label: 'In Progress' },
  not_started: { icon: Circle,      cssVar: '--status-not-started', label: 'Not Started' },
  failed:      { icon: XCircle,     cssVar: '--status-failed',      label: 'Failed' },
  halted:      { icon: OctagonX,    cssVar: '--status-halted',      label: 'Halted' },
  skipped:     { icon: MinusCircle, cssVar: '--status-skipped',     label: 'Skipped' },
};

// Render:
const { icon: Icon, cssVar, label } = STATUS_CONFIG[status];
<Icon
  size={16}
  className={cn(status === 'in_progress' && 'animate-spin', className)}
  style={{ color: `var(${cssVar})` }}
  role="img"
  aria-label={label}
/>
```

### Review Verdict — ReviewVerdictBadge

Returns `null` when `verdict` is `null`. Otherwise renders shadcn `Badge` with `variant="outline"`.

| Verdict | CSS Variable | Display Label |
|---------|-------------|---------------|
| `approved` | `--verdict-approved` `hsl(142,71%,45%)` green | "Approved" |
| `changes_requested` | `--verdict-changes-requested` `hsl(38,92%,50%)` amber | "Changes Requested" |
| `rejected` | `--verdict-rejected` `hsl(0,84%,60%)` red | "Rejected" |

Style the Badge with inline `style={{ color: var(--verdict-...), borderColor: var(--verdict-...) }}`.

### Severity — SeverityBadge

Returns `null` when `severity` is `null`. Otherwise renders shadcn `Badge` with `variant="outline"`.

| Severity | CSS Variable | Display Label |
|----------|-------------|---------------|
| `critical` | `--severity-critical` `hsl(0,84%,60%)` red | "Critical" |
| `minor` | `--severity-minor` `hsl(38,92%,50%)` amber | "Minor" |

### Retry — RetryBadge

- Renders shadcn `Badge` with `variant="secondary"`
- Text format: `"Retries: {retries}/{max}"`
- When `retries === max`: switch to `variant="outline"` with color/borderColor set to `var(--color-warning)` (`hsl(38, 92%, 50%)` amber)
- ARIA: `aria-label="Retry count: {retries} of {max}"`

### Warning — WarningBadge

- Renders shadcn `Badge` with `variant="outline"`
- Icon: `AlertTriangle` from `lucide-react`, size 14
- Layout: icon + message text
- Color/borderColor: `var(--color-warning)` (`hsl(38, 92%, 50%)` amber)
- ARIA: `aria-label="Warning: {message}"`

### Connection — ConnectionIndicator

- Renders a `<div>` with `aria-live="polite"` containing a dot + label
- Dot: 8×8px `rounded-full` circle
- For `reconnecting`: add `animate-pulse` class to the dot

| Status | CSS Variable | Dot Class Extras | Label |
|--------|-------------|-----------------|-------|
| `connected` | `--connection-ok` green | — | "Connected" |
| `reconnecting` | `--connection-warning` amber | `animate-pulse` | "Reconnecting…" |
| `disconnected` | `--connection-error` red | — | "Disconnected" |

### Lock — LockBadge

- Icon: `Lock` from `lucide-react`, size 14
- Color: inherit from `text-muted-foreground` (Tailwind utility class — this maps to `hsl(220, 9%, 46%)` light / `hsl(217, 10%, 64%)` dark)
- ARIA: `aria-label="Locked (hard default)"`

## Test Requirements

- [ ] All 8 components render without runtime errors
- [ ] `PipelineTierBadge` renders correctly for each of the 6 tier values (`planning`, `execution`, `review`, `complete`, `halted`, `not_initialized`)
- [ ] `StatusIcon` renders the correct Lucide icon for each of the 6 status values
- [ ] `StatusIcon` applies `animate-spin` class only for `in_progress` status
- [ ] `ReviewVerdictBadge` returns `null` when `verdict` is `null`
- [ ] `SeverityBadge` returns `null` when `severity` is `null`
- [ ] `RetryBadge` shows highlighted warning styling when `retries === max`
- [ ] `ConnectionIndicator` renders all 3 states with correct dot color and label
- [ ] All badges have appropriate `aria-label` attributes
- [ ] `npm run build` passes with zero TypeScript errors

## Acceptance Criteria

- [ ] All 8 components export from `ui/components/badges/index.ts`
- [ ] Each badge uses CSS custom properties from `globals.css` — no hardcoded color values (no raw `hsl(...)` in component files)
- [ ] `StatusIcon` renders the correct Lucide icon for each of the 6 status values (`complete`, `in_progress`, `not_started`, `failed`, `halted`, `skipped`)
- [ ] `PipelineTierBadge` renders all 6 tier values (including `not_initialized`) with correct 15%-opacity background, full-color text, and colored dot
- [ ] `ReviewVerdictBadge` and `SeverityBadge` render nothing (return `null`) when passed `null`
- [ ] All badges include accessible text labels via `aria-label` — no color-only information
- [ ] `ConnectionIndicator` wraps content in an `aria-live="polite"` region
- [ ] Every component file starts with `"use client"` directive
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No lint errors

## Constraints

- Do NOT create any test files — no unit test framework is set up yet
- Do NOT modify `ui/app/globals.css` — all CSS variables are already defined
- Do NOT modify any existing files in `ui/components/ui/`
- Do NOT hardcode color values — always reference CSS custom properties via `var(--token-name)`
- Do NOT use `@apply` directives — use Tailwind utility classes only
- Use `"use client"` directive at the top of every component file
- Import types from `@/types/state` — do NOT redefine type aliases locally
- Use kebab-case file naming: `pipeline-tier-badge.tsx`, NOT `PipelineTierBadge.tsx`
- Import Lucide icons from `lucide-react` (already installed as a dependency)
- Import shadcn Badge from `@/components/ui/badge`
- Use `cn()` utility from `@/lib/utils` for conditional class merging
