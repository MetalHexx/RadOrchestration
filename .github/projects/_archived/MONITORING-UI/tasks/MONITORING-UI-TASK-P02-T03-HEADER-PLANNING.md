---
project: "MONITORING-UI"
phase: 2
task: 3
title: "Dashboard Header + Planning Section"
status: "pending"
skills_required: ["react", "typescript", "tailwindcss"]
skills_optional: ["accessibility"]
estimated_files: 6
---

# Dashboard Header + Planning Section

## Objective

Create the `ProjectHeader`, `PlanningChecklist`, `ErrorSummaryBanner`, and `PlanningSection` components that form the top portion of the main dashboard — displaying project metadata, the 5-step planning pipeline with status icons and document links, and a conditional error banner for active blockers.

## Context

This is Phase 2, Task 3 of the MONITORING-UI project. Phase 2 builds all dashboard UI components. Tasks P02-T01 (Badge Component Library) and P02-T02 (Sidebar Components + useProjects Hook) are complete. The badge components created in T01 (`PipelineTierBadge`, `StatusIcon`, etc.) are available as imports from `@/components/badges`. The project uses Next.js 14 App Router with TypeScript, shadcn/ui components, and Tailwind CSS v4. All custom CSS variables are defined in `ui/app/globals.css`. Components in this task will be consumed by `MainDashboard` in T06.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/dashboard/project-header.tsx` | ProjectHeader component — project metadata display |
| CREATE | `ui/components/planning/planning-checklist.tsx` | PlanningChecklist — 5 planning steps + human approval row |
| CREATE | `ui/components/planning/error-summary-banner.tsx` | ErrorSummaryBanner — conditional alert for active blockers |
| CREATE | `ui/components/planning/index.ts` | Barrel export for planning module |
| CREATE | `ui/components/dashboard/planning-section.tsx` | PlanningSection — wraps PlanningChecklist in a Card |
| CREATE | `ui/components/dashboard/index.ts` | Partial barrel export (will grow in T04/T05) |

## Implementation Steps

1. **Create `ui/components/dashboard/project-header.tsx`**: Implement `ProjectHeader` as a `"use client"` component. Accept props matching `ProjectHeaderProps` (below). Render: project name in `text-lg font-semibold`, description in `text-sm text-muted-foreground`, `PipelineTierBadge` for the tier, a human gate mode badge (plain `Badge` showing the gate mode value), created/updated timestamps in `text-xs text-muted-foreground font-mono`, and a static "Read-only monitoring" label in `text-xs text-muted-foreground`. Layout with flexbox — name + tier badge on one line, description below, then a row of metadata items.

2. **Create `ui/components/planning/planning-checklist.tsx`**: Implement `PlanningChecklist` as a `"use client"` component. Accept props matching `PlanningChecklistProps` (below). Render an ordered list (`<ol>`) of 5 planning steps using `PLANNING_STEP_ORDER`. For each step, render a row with: `StatusIcon` for the step's status, formatted step name (use `STEP_DISPLAY_NAMES` map defined locally), and a document link button. If `output` is non-null, render a clickable `<button>` with the output path text styled with `--color-link`; on click call `onDocClick(output)`. If `output` is null, render a muted "—" span with `--color-link-disabled`. After the 5 steps, render a divider and a "Human Approval" row showing a `StatusIcon` with status `complete` if `humanApproved` is true, or `not_started` if false, plus the text "Approved" or "Pending".

3. **Create `ui/components/planning/error-summary-banner.tsx`**: Implement `ErrorSummaryBanner` as a `"use client"` component. Accept props matching `ErrorSummaryBannerProps` (below). If `blockers.length === 0`, return `null` (render nothing). Otherwise, render a shadcn `Alert` with `variant="destructive"`, custom background/border using `--color-error-bg` and `--color-error-border` CSS variables. Include an `AlertTriangle` Lucide icon, an `AlertTitle` reading "Active Blockers ({count})", and an `AlertDescription` containing: a `<ul>` listing each blocker as a `<li>`, and a summary line showing total retries and total halts. Add `role="alert"` and `aria-live="assertive"`.

4. **Create `ui/components/planning/index.ts`**: Barrel export `PlanningChecklist` from `./planning-checklist` and `ErrorSummaryBanner` from `./error-summary-banner`.

5. **Create `ui/components/dashboard/planning-section.tsx`**: Implement `PlanningSection` as a `"use client"` component. Accept props matching `PlanningSectionProps` (below). Render a shadcn `Card` with: `CardHeader` containing a `CardTitle` "Planning Pipeline", and `CardContent` containing the `PlanningChecklist` component, passing through `steps`, `humanApproved`, and `onDocClick` props.

6. **Create `ui/components/dashboard/index.ts`**: Barrel export `ProjectHeader` from `./project-header` and `PlanningSection` from `./planning-section`. This file will grow in T04 and T05.

## Contracts & Interfaces

### Type Definitions — from `@/types/state`

```typescript
// Import these types from '@/types/state'

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';
export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';
export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';
export type HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous';
export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  human_approved: boolean;
}

export interface NormalizedProjectMeta {
  name: string;
  description: string | null;
  created: string;       // ISO 8601
  updated: string;       // ISO 8601
  brainstorming_doc: string | null;
}

export interface NormalizedErrors {
  total_retries: number;
  total_halts: number;
  active_blockers: string[];
}
```

### Component Props

```typescript
// ─── ProjectHeader Props ────────────────────────────────────────────────────
// File: ui/components/dashboard/project-header.tsx

interface ProjectHeaderProps {
  project: {
    name: string;
    description: string | null;
    created: string;       // ISO 8601
    updated: string;       // ISO 8601
  };
  tier: PipelineTier;
  gateMode: HumanGateMode;
}

// ─── PlanningChecklist Props ────────────────────────────────────────────────
// File: ui/components/planning/planning-checklist.tsx

interface PlanningChecklistProps {
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  humanApproved: boolean;
  onDocClick: (path: string) => void;
}

// ─── ErrorSummaryBanner Props ───────────────────────────────────────────────
// File: ui/components/planning/error-summary-banner.tsx

interface ErrorSummaryBannerProps {
  blockers: string[];
  totalRetries: number;
  totalHalts: number;
}

// ─── PlanningSection Props ──────────────────────────────────────────────────
// File: ui/components/dashboard/planning-section.tsx

interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }>;
    human_approved: boolean;
  };
  onDocClick: (path: string) => void;
}
```

### Available Badge Imports — from `@/components/badges`

```typescript
// All available from '@/components/badges'
import { PipelineTierBadge } from "@/components/badges";   // Props: { tier: PipelineTier | 'not_initialized' }
import { StatusIcon } from "@/components/badges";           // Props: { status: PlanningStepStatus | PhaseStatus | TaskStatus, className?: string }
import { ReviewVerdictBadge } from "@/components/badges";   // Props: { verdict: ReviewVerdict | null }
import { SeverityBadge } from "@/components/badges";        // Props: { severity: Severity | null }
import { RetryBadge } from "@/components/badges";           // Props: { retries: number, max: number }
import { WarningBadge } from "@/components/badges";         // Props: { message: string }
import { ConnectionIndicator } from "@/components/badges";  // Props: { status: "connected" | "reconnecting" | "disconnected" }
import { LockBadge } from "@/components/badges";             // No props
```

### Available shadcn/ui Imports

```typescript
// Card — from '@/components/ui/card'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// Alert — from '@/components/ui/alert'
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Badge — from '@/components/ui/badge'
import { Badge } from "@/components/ui/badge";

// Separator — from '@/components/ui/separator'
// May need: npx shadcn@latest add separator (if not already installed)
```

### Available Utilities

```typescript
// Class name merging utility — from '@/lib/utils'
import { cn } from "@/lib/utils";

// Planning step order constant — from '@/types/state'
import { PLANNING_STEP_ORDER } from "@/types/state";
import type { PlanningStepName, PlanningStepStatus, PipelineTier, HumanGateMode, NormalizedPlanning } from "@/types/state";
```

## Styles & Design Tokens

### ProjectHeader

- Project name: `text-lg font-semibold` (18px/28px)
- Description: `text-sm text-muted-foreground` (14px/20px)
- Timestamps: `text-xs text-muted-foreground font-mono` (12px/16px)
- "Read-only monitoring" label: `text-xs text-muted-foreground`
- `PipelineTierBadge`: renders its own styling via `--tier-*` CSS variables
- Gate mode badge: use shadcn `Badge` with `variant="outline"` and `text-xs`

### PlanningChecklist

- Step row: flexbox row, `gap-2`, `items-center`, vertical padding `py-2`
- Step name: `text-sm` (14px/20px)
- Document link (available): styled as button, `text-sm`, `color: var(--color-link)`, `hover:underline`, `cursor-pointer`
- Document link (unavailable): `text-sm`, `color: var(--color-link-disabled)`, show "—"
- Human approval divider: `border-t border-border my-2`
- StatusIcon: 16px, inherits color from `--status-*` CSS variables

### ErrorSummaryBanner

- Banner background: `var(--color-error-bg)`
- Banner border: `1px solid var(--color-error-border)`
- Banner border radius: `rounded-lg`
- Icon: `AlertTriangle` from Lucide, `size={16}`
- Title: `text-sm font-medium` in destructive color
- Blocker list: `<ul>` with `list-disc pl-4`, each `<li>` in `text-sm`
- Stats line: `text-xs text-muted-foreground`, format: "Total retries: {n} · Total halts: {n}"

### PlanningSection

- Wrapper: shadcn `Card` component
- Section title: `CardTitle` — "Planning Pipeline"
- Content: `CardContent` wrapping `PlanningChecklist`

### Planning Step Display Names

```typescript
const STEP_DISPLAY_NAMES: Record<PlanningStepName, string> = {
  research: "Research",
  prd: "PRD",
  design: "Design",
  architecture: "Architecture",
  master_plan: "Master Plan",
};
```

## Test Requirements

- [ ] `ProjectHeader` renders with project name "TEST-PROJECT" visible in the output
- [ ] `ProjectHeader` renders `PipelineTierBadge` with the provided tier value
- [ ] `ProjectHeader` renders gate mode badge showing the provided gate mode
- [ ] `ProjectHeader` renders both created and updated timestamps
- [ ] `ProjectHeader` renders "Read-only monitoring" label
- [ ] `PlanningChecklist` renders all 5 planning steps in order: Research, PRD, Design, Architecture, Master Plan
- [ ] `PlanningChecklist` renders `StatusIcon` with correct status for each step
- [ ] `PlanningChecklist` calls `onDocClick` with the output path when a document link is clicked
- [ ] `PlanningChecklist` renders disabled indicator ("—") for steps with null output
- [ ] `PlanningChecklist` renders "Human Approval" row with approved state (checkmark) when `humanApproved` is true
- [ ] `PlanningChecklist` renders "Human Approval" row with pending state (circle) when `humanApproved` is false
- [ ] `ErrorSummaryBanner` returns null (renders nothing) when `blockers` array is empty
- [ ] `ErrorSummaryBanner` renders alert with blocker count when blockers exist
- [ ] `ErrorSummaryBanner` lists each blocker as a bullet item
- [ ] `ErrorSummaryBanner` shows total retries and total halts stats
- [ ] `PlanningSection` renders "Planning Pipeline" heading
- [ ] `PlanningSection` renders `PlanningChecklist` inside a Card
- [ ] `npm run build` passes with zero TypeScript errors

## Acceptance Criteria

- [ ] `ProjectHeader` renders project name, description, tier badge, gate mode, timestamps, and "Read-only monitoring" label
- [ ] `PlanningChecklist` renders all 5 planning steps with correct status icons
- [ ] Planning steps with an output document render a clickable link (calls `onDocClick`)
- [ ] Planning steps with null output render a disabled/muted indicator
- [ ] Human approval row shows approved (checkmark) or pending (circle) state
- [ ] `ErrorSummaryBanner` renders when blockers exist and is absent when there are none
- [ ] `ErrorSummaryBanner` includes `role="alert"` and `aria-live="assertive"` attributes
- [ ] All components include `"use client"` directive
- [ ] All components use CSS custom properties from `globals.css` (no hardcoded colors)
- [ ] Barrel exports work: `@/components/planning` exports `PlanningChecklist` and `ErrorSummaryBanner`; `@/components/dashboard` exports `ProjectHeader` and `PlanningSection`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No lint errors

## Constraints

- Do NOT create any page files or modify `page.tsx` — that is T06's responsibility
- Do NOT implement document drawer or document viewing — that is Phase 3
- Do NOT add new CSS custom properties to `globals.css` — all needed tokens already exist
- Do NOT use hardcoded color values — always reference CSS variables via `var(--token-name)` or Tailwind classes mapped to them
- Do NOT modify any existing badge components — import them as-is from `@/components/badges`
- Do NOT install new npm packages — all required shadcn/ui components and Lucide icons are already installed
- The `onDocClick` callback is a placeholder — it will be wired to the document drawer in Phase 3. For now, accept it as a prop and call it on click.
- Keep components focused — no data fetching in these components (data is passed via props from the parent)
