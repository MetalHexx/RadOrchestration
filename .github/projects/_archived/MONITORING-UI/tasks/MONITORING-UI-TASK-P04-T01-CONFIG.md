---
project: "MONITORING-UI"
phase: 4
task: 1
title: "Config Viewer"
status: "pending"
skills_required: ["react", "shadcn", "typescript"]
skills_optional: []
estimated_files: 5
---

# Config Viewer

## Objective

Create a config viewer drawer system — `useConfigDrawer` hook, `ConfigSection` component, `ConfigDrawer` component, and barrel exports — then wire the existing disabled Config button in `AppHeader` to open the drawer with live data fetched from `GET /api/config`.

## Context

The dashboard already has a `GET /api/config` endpoint that returns `{ config: ParsedConfig }` — a grouped, camelCased transformation of `orchestration.yml`. The `AppHeader` component renders a disabled Settings button that needs to be wired to open the config drawer. The project uses shadcn/ui components built on `@base-ui/react`. A `Sheet` component (right-side slide-over) and `Accordion` component (collapsible sections) are already installed. The `DocumentDrawer` (in `ui/components/documents/document-drawer.tsx`) demonstrates the Sheet usage pattern — follow the same open/close/`onOpenChange` approach.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/hooks/use-config-drawer.ts` | Hook managing drawer open/close state + config data fetching |
| CREATE | `ui/components/config/config-section.tsx` | Collapsible section card using shadcn Accordion |
| CREATE | `ui/components/config/config-drawer.tsx` | Sheet/drawer rendering 5 config sections |
| CREATE | `ui/components/config/index.ts` | Barrel exports |
| MODIFY | `ui/app/page.tsx` | Add `ConfigDrawer`, wire `useConfigDrawer`, pass callbacks to `AppHeader` |
| MODIFY | `ui/components/layout/app-header.tsx` | Accept + wire `onConfigClick` prop, remove `disabled` from Config button |

## Implementation Steps

1. **Create `ui/hooks/use-config-drawer.ts`** — Implement a `useConfigDrawer` hook that manages `isOpen` (boolean), `loading` (boolean), `error` (string | null), and `config` (`ParsedConfig | null`) state. Expose `open()`, `close()`, and the state values. On `open()`, set `isOpen = true`, then fetch `GET /api/config`. Parse the JSON response body as `{ config: ParsedConfig }`. Set `config` from the response. Handle errors by setting `error`. Use `AbortController` to cancel in-flight requests (same pattern as `useDocumentDrawer`).

2. **Create `ui/components/config/config-section.tsx`** — A reusable component that wraps children in a shadcn `AccordionItem` with an `AccordionTrigger` showing the section title and `AccordionContent` containing the children. Accept props: `value: string` (unique key for accordion), `title: string`, and `children: React.ReactNode`.

3. **Create `ui/components/config/config-drawer.tsx`** — A `ConfigDrawer` component using the shadcn `Sheet`. Accept props: `open`, `config`, `loading`, `error`, `onClose`. Render a `Sheet` with `SheetContent` on the right side, max width 560px. The header shows "Pipeline Configuration". The body renders 5 `ConfigSection` components inside an `Accordion` (type `"multiple"`, all open by default). Each section renders key-value pairs as a definition list or simple rows. The Human Gates section renders `LockBadge` next to `after_planning` and `after_final_review` entries. Show a loading skeleton while `loading` is true. Show an error message when `error` is non-null.

4. **Create `ui/components/config/index.ts`** — Barrel file exporting `ConfigDrawer` and `ConfigSection`.

5. **Modify `ui/components/layout/app-header.tsx`** — Add an `onConfigClick?: () => void` prop to `AppHeaderProps`. Remove the `disabled` attribute from the Settings `Button`. Attach `onClick={onConfigClick}` to it.

6. **Modify `ui/app/page.tsx`** — Import `useConfigDrawer` and `ConfigDrawer`. Call `useConfigDrawer()` in the `Home` component. Pass `onConfigClick={configDrawer.open}` to `AppHeader`. Render `<ConfigDrawer open={configDrawer.isOpen} config={configDrawer.config} loading={configDrawer.loading} error={configDrawer.error} onClose={configDrawer.close} />` at the same level as `DocumentDrawer`.

## Contracts & Interfaces

### ParsedConfig — `ui/types/config.ts` (already exists)

```typescript
export interface ParsedConfig {
  projectStorage: {
    basePath: string;
    naming: string;
  };
  pipelineLimits: {
    maxPhases: number;
    maxTasksPerPhase: number;
    maxRetriesPerTask: number;
    maxConsecutiveReviewRejections: number;
  };
  errorHandling: {
    critical: string[];
    minor: string[];
    onCritical: string;
    onMinor: string;
  };
  gitStrategy: {
    strategy: string;
    branchPrefix: string;
    commitPrefix: string;
    autoCommit: boolean;
  };
  humanGates: {
    afterPlanning: { value: boolean; locked: true };
    executionMode: string;
    afterFinalReview: { value: boolean; locked: true };
  };
}
```

### API response — `GET /api/config`

```typescript
// Success (200):
{ config: ParsedConfig }

// Error (500):
{ error: string }
```

### useConfigDrawer hook

```typescript
// ui/hooks/use-config-drawer.ts
interface UseConfigDrawerReturn {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  config: ParsedConfig | null;
  open: () => void;
  close: () => void;
}

function useConfigDrawer(): UseConfigDrawerReturn;
```

### ConfigDrawer props

```typescript
interface ConfigDrawerProps {
  open: boolean;
  config: ParsedConfig | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}
```

### ConfigSection props

```typescript
interface ConfigSectionProps {
  value: string;
  title: string;
  children: React.ReactNode;
}
```

### AppHeader updated props

```typescript
interface AppHeaderProps {
  sseStatus: "connected" | "reconnecting" | "disconnected";
  onReconnect: () => void;
  onConfigClick?: () => void;
}
```

### LockBadge — `ui/components/badges/lock-badge.tsx` (already exists)

```tsx
import { LockBadge } from "@/components/badges";
// Renders: <Lock size={14} className="text-muted-foreground" role="img" aria-label="Locked (hard default)" />
```

## Styles & Design Tokens

- Drawer width: `sm:max-w-[560px]` on `SheetContent` (design spec: 560px max)
- Drawer background: `bg-background` (inherited from Sheet default)
- Section title font: `text-sm font-medium` (shadcn AccordionTrigger default)
- Key label: `text-sm text-muted-foreground`
- Value text: `text-sm text-foreground`
- Lock badge placement: inline after the value for `afterPlanning` and `afterFinalReview` gates
- Boolean display: `"true"` / `"false"` as text
- Array display (critical/minor severities): comma-separated inline or as wrapped tags
- Loading skeleton: reuse `Skeleton` from `@/components/ui/skeleton` — 5 section placeholders
- Error state: red-tinted border + background matching DocumentDrawer pattern (`border-destructive/50 bg-destructive/10 text-destructive`)

## Test Requirements

- [ ] `useConfigDrawer` — calling `open()` sets `isOpen` to `true` and triggers a fetch to `/api/config`
- [ ] `useConfigDrawer` — successful fetch sets `config` to `ParsedConfig` and `loading` to `false`
- [ ] `useConfigDrawer` — failed fetch sets `error` to a message string and `loading` to `false`
- [ ] `useConfigDrawer` — calling `close()` sets `isOpen` to `false`
- [ ] `ConfigDrawer` — renders "Pipeline Configuration" as the Sheet title
- [ ] `ConfigDrawer` — renders all 5 section titles: "Project Storage", "Pipeline Limits", "Error Handling", "Git Strategy", "Human Gates"
- [ ] `ConfigDrawer` — shows `LockBadge` next to `afterPlanning` and `afterFinalReview` values
- [ ] `ConfigDrawer` — shows loading skeleton when `loading` is `true`
- [ ] `ConfigDrawer` — shows error message when `error` is non-null
- [ ] `AppHeader` — Settings button is not disabled and calls `onConfigClick` when clicked

## Acceptance Criteria

- [ ] Clicking the Settings button in AppHeader opens a right-side Sheet drawer titled "Pipeline Configuration"
- [ ] The drawer displays 5 collapsible sections: Project Storage, Pipeline Limits, Error Handling, Git Strategy, Human Gates
- [ ] All sections are expanded by default (accordion type `"multiple"`, all values in `defaultValue`)
- [ ] Each section shows correct key-value pairs matching the `ParsedConfig` structure
- [ ] `afterPlanning` and `afterFinalReview` entries in Human Gates show a `LockBadge` icon
- [ ] A loading skeleton is shown while config data is being fetched
- [ ] An error message is displayed if the fetch fails
- [ ] Closing the drawer (X button, overlay click, or Escape) properly resets the open state
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT create new API routes — use the existing `GET /api/config` endpoint
- Do NOT modify `ui/types/config.ts` — the `ParsedConfig` type already exists
- Do NOT modify `ui/lib/config-transformer.ts` or `ui/app/api/config/route.ts`
- Do NOT install new dependencies — use existing shadcn `Sheet`, `Accordion`, `Skeleton`, `ScrollArea`
- Do NOT add accessibility attributes beyond basic props — that is handled in T03
- Do NOT add loading skeletons to AppHeader or Sidebar — that is handled in T04
- Use `"use client"` directive on all new component and hook files
- Follow the exact same Sheet usage pattern as `DocumentDrawer` (`open`, `onOpenChange`, `SheetContent` with `side="right"`)
