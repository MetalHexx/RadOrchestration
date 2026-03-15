---
project: "MONITORING-UI"
phase: 2
task: 5
title: "Remaining Dashboard Sections"
status: "pending"
skills_required: ["react", "typescript", "shadcn-ui"]
skills_optional: ["accessibility"]
estimated_files: 5
---

# Remaining Dashboard Sections

## Objective

Create the four remaining dashboard content sections — `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, and `LimitsSection` — and update the dashboard barrel export to re-export all dashboard components. These sections complete the main dashboard content area before the layout shell wires everything together in T06.

## Context

Phase 2 builds all dashboard components. Tasks T01–T04 delivered badge components, sidebar, header + planning section, and execution section. This task delivers the remaining four content sections that render below the execution section in the main dashboard scroll area. All four components are `"use client"` React components using shadcn/ui primitives and CSS custom property design tokens. The `GateHistorySection` derives gate entries from planning and execution state — it accepts a pre-derived `GateEntry[]` array. The dashboard barrel export at `ui/components/dashboard/index.ts` must re-export all dashboard section components for T06 to import.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/dashboard/final-review-section.tsx` | Conditional section for final review status |
| CREATE | `ui/components/dashboard/error-log-section.tsx` | Error stats and active blockers list |
| CREATE | `ui/components/dashboard/gate-history-section.tsx` | Human gate approval timeline |
| CREATE | `ui/components/dashboard/limits-section.tsx` | Collapsible pipeline limits display |
| MODIFY | `ui/components/dashboard/index.ts` | Add exports for the 4 new components |

## Implementation Steps

1. **Create `FinalReviewSection`** at `ui/components/dashboard/final-review-section.tsx`:
   - Accept props: `finalReview: NormalizedFinalReview`, `onDocClick: (path: string) => void`
   - Return `null` when `finalReview.status === 'not_started'` (component not rendered)
   - Render inside a shadcn `Card` with `CardHeader` title "Final Review"
   - Show `StatusIcon` for `finalReview.status`
   - Show report doc link as a `Button` (variant `"link"`) — disabled when `finalReview.report_doc` is `null`, calls `onDocClick(report_doc)` when available
   - Show human approval indicator: `CheckCircle2` icon (green) when `human_approved === true`, `Circle` icon (muted) when `false`, with text label "Human Approved" or "Pending Approval"

2. **Create `ErrorLogSection`** at `ui/components/dashboard/error-log-section.tsx`:
   - Accept props: `errors: NormalizedErrors`
   - Always rendered (unlike FinalReviewSection)
   - Render inside a shadcn `Card` with `CardHeader` title "Error Log"
   - Show two compact stat items side by side: "Total Retries: {N}" and "Total Halts: {N}" using `font-mono` for the numbers
   - Below stats, show `active_blockers` as a bulleted list using `text-destructive` text color
   - If `active_blockers` is empty, show muted text: "No active blockers"

3. **Create `GateHistorySection`** at `ui/components/dashboard/gate-history-section.tsx`:
   - Accept props: `gates: GateEntry[]`
   - Render inside a shadcn `Card` with `CardHeader` title "Gate History"
   - Render a semantic ordered list (`<ol>`) with `list-none` (no default markers)
   - Each `<li>` entry: gate name text, approval icon (`CheckCircle2` if approved, `Circle` if pending), optional timestamp in `text-xs text-muted-foreground font-mono`
   - Use `--status-complete` color for approved icon, `--status-not-started` color for pending icon

4. **Create `LimitsSection`** at `ui/components/dashboard/limits-section.tsx`:
   - Accept props: `limits: NormalizedLimits`
   - Render as a shadcn `Accordion` (type `"single"`, collapsible, default closed)
   - `AccordionTrigger` text: "Pipeline Limits"
   - `AccordionContent`: three key-value rows — "Max Phases", "Max Tasks per Phase", "Max Retries per Task" — with `font-mono` for the numeric values
   - Wrap the Accordion in a shadcn `Card` for visual consistency

5. **Update `ui/components/dashboard/index.ts`** — append these exports:
   ```typescript
   export { FinalReviewSection } from "./final-review-section";
   export { ErrorLogSection } from "./error-log-section";
   export { GateHistorySection } from "./gate-history-section";
   export { LimitsSection } from "./limits-section";
   ```

## Contracts & Interfaces

All types consumed by these components. Copy these exactly — do NOT import from external docs.

```typescript
// From @/types/state

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

export type Severity = 'minor' | 'critical';

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedErrors {
  total_retries: number;
  total_halts: number;
  active_blockers: string[];
}

export interface NormalizedLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
}

// From @/types/components

export interface GateEntry {
  gate: string;           // e.g., "Post-Planning", "Phase 1", "Final Review"
  approved: boolean;
  timestamp?: string;     // ISO 8601 if available
}
```

### Component Props Interfaces

Define these locally in each component file:

```typescript
// final-review-section.tsx
interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  onDocClick: (path: string) => void;
}

// error-log-section.tsx
interface ErrorLogSectionProps {
  errors: NormalizedErrors;
}

// gate-history-section.tsx
interface GateHistorySectionProps {
  gates: GateEntry[];
}

// limits-section.tsx
interface LimitsSectionProps {
  limits: NormalizedLimits;
}
```

### Available Imports

Badge components (from `@/components/badges`):
```typescript
import { StatusIcon } from "@/components/badges";
// StatusIcon accepts: status: PlanningStepStatus | PhaseStatus | TaskStatus
// Maps to Lucide icons: CheckCircle2 (complete), Loader2 (in_progress),
// Circle (not_started), XCircle (failed), OctagonX (halted), MinusCircle (skipped)
```

shadcn/ui components:
```typescript
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
```

Lucide icons (direct import for icons not covered by StatusIcon):
```typescript
import { CheckCircle2, Circle } from "lucide-react";
```

Type imports:
```typescript
import type { NormalizedFinalReview, NormalizedErrors, NormalizedLimits } from "@/types/state";
import type { GateEntry } from "@/types/components";
```

## Styles & Design Tokens

Use CSS custom properties registered in `globals.css`. Never hardcode hex/HSL values.

- `--status-complete`: `hsl(142, 71%, 45%)` — green, for approved/complete icons
- `--status-not-started`: `hsl(215, 14%, 57%)` — slate, for pending/not-started icons
- `--status-in-progress`: `hsl(217, 91%, 60%)` — blue, for in-progress status
- `--status-failed`: `hsl(0, 84%, 60%)` — red, for failed status
- `--color-destructive`: Error text color for active blockers
- `--color-link`: `hsl(217, 91%, 60%)` — blue, for clickable report link
- `--color-link-disabled`: `hsl(215, 14%, 57%)` — slate, for disabled report link

Apply colors via inline `style` attributes referencing CSS variables:
```tsx
<CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-complete)' }} />
<Circle className="h-4 w-4" style={{ color: 'var(--status-not-started)' }} />
```

Typography tokens:
- `font-mono` — Tailwind class for monospaced values (limit numbers, timestamps)
- `text-xs` — 12px, for timestamps, secondary labels
- `text-sm` — 14px, for body text, list items
- `text-muted-foreground` — Tailwind class for secondary text

Spacing:
- `space-y-3` — vertical gap between list items
- `gap-4` — gap between stat items in ErrorLogSection
- Card internal padding handled by shadcn Card's built-in `CardContent` padding

## Test Requirements

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero lint errors
- [ ] `FinalReviewSection` renders nothing when `finalReview.status === 'not_started'`
- [ ] `FinalReviewSection` renders status icon, report link, and approval indicator when status is not `'not_started'`
- [ ] `ErrorLogSection` renders total retries and total halts values
- [ ] `ErrorLogSection` renders "No active blockers" when `active_blockers` is empty
- [ ] `ErrorLogSection` renders blockers list when `active_blockers` has entries
- [ ] `GateHistorySection` renders one list item per `GateEntry`
- [ ] `GateHistorySection` shows approved icon (CheckCircle2) for approved gates and pending icon (Circle) for pending gates
- [ ] `LimitsSection` accordion is collapsed by default
- [ ] `LimitsSection` shows all three limit values when expanded
- [ ] All four components export from `@/components/dashboard/index.ts`

Do NOT add a test framework or write unit test files — testing is deferred.

## Acceptance Criteria

- [ ] `FinalReviewSection` renders only when `final_review.status` is not `'not_started'`
- [ ] `FinalReviewSection` shows status badge, report link, and human approval indicator
- [ ] `ErrorLogSection` renders total retries and total halts as stats
- [ ] `ErrorLogSection` renders active blockers as a list (or shows "No active blockers" when empty)
- [ ] `GateHistorySection` renders a timeline entry for each gate in the `gates` array
- [ ] `GateHistorySection` shows approved (green check) or pending (muted circle) per gate
- [ ] `LimitsSection` is collapsed by default and expands to show limit values
- [ ] `LimitsSection` uses `font-mono` for numeric values
- [ ] All 4 new components export from `ui/components/dashboard/index.ts`
- [ ] All components are `"use client"` components with proper TypeScript typing
- [ ] All components use CSS custom properties for colors (no hardcoded color values)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No lint errors

## Constraints

- Do NOT modify any existing component files (`project-header.tsx`, `planning-section.tsx`, etc.) — only create new files and update `index.ts`
- Do NOT add a test framework or write unit test files — testing is deferred
- Do NOT import from or reference Architecture, Design, PRD, or Master Plan documents
- Do NOT add new CSS custom properties to `globals.css` — use the existing tokens
- Do NOT install new npm packages — all required dependencies are already installed
- Do NOT create layout wiring or page-level integration — that is T06's responsibility
- Use `"use client"` directive at the top of every `.tsx` component file
- Use `Button` variant `"link"` for the report doc link (not raw `<a>` tags) — the drawer integration in Phase 3 requires callback-based navigation via `onDocClick`
- Keep component files focused and single-responsibility — no shared utility functions across files
