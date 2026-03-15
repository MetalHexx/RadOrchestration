---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
task: 2
title: "GATE-ERROR-BANNER"
status: "pending"
skills: ["run-tests", "generate-task-report"]
estimated_files: 1
---

# GATE-ERROR-BANNER

## Objective

Create the `GateErrorBanner` component in `ui/components/dashboard/gate-error-banner.tsx` — an inline error display with a friendly message, dismiss button (X icon), and an expandable `<details>` section for raw pipeline output. The component uses `role="alert"` and `aria-live="polite"` for screen reader announcements.

## Context

The orchestration dashboard will display this banner below the approve gate button when a gate approval API call fails. The parent component (`ApproveGateButton`, created in a later task) passes `message`, optional `detail`, and an `onDismiss` callback. This component is purely presentational — it owns no state. It uses the existing `Button` component from `@/components/ui/button`, the `cn` utility from `@/lib/utils`, and `AlertCircle` / `X` icons from `lucide-react`. The existing dashboard components (e.g., `ErrorLogSection`) follow a `"use client"` directive, named export, and Card-based layout pattern within `ui/components/dashboard/`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/dashboard/gate-error-banner.tsx` | New component file; follows existing dashboard component patterns |

## Implementation Steps

1. Create `ui/components/dashboard/gate-error-banner.tsx` with the `"use client"` directive at the top.
2. Import `AlertCircle` and `X` from `lucide-react`, `Button` from `@/components/ui/button`, and `cn` from `@/lib/utils`.
3. Define the `GateErrorBannerProps` interface with `message: string`, `detail?: string`, and `onDismiss: () => void`.
4. Export named function `GateErrorBanner` accepting destructured props.
5. Render the outer container `<div>` with:
   - `role="alert"` and `aria-live="polite"` for accessibility
   - Classes: `rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm`
6. Inside the container, render a flex row (`flex items-start gap-2`) containing:
   - `AlertCircle` icon: `className="size-4 shrink-0 text-destructive mt-0.5"` with `aria-hidden="true"`
   - A `<div className="flex-1 min-w-0">` wrapper for message text and optional detail
   - Dismiss `Button`: `variant="ghost"` `size="icon-xs"` with the `X` icon, `onClick={onDismiss}`, `aria-label="Dismiss error"`
7. Render the message text in a `<p>` with classes `text-destructive font-medium`.
8. Conditionally render the `<details>` / `<summary>` block only when `detail` is provided:
   - `<details className="mt-2">` wrapping a `<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show pipeline detail</summary>`
   - `<pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-auto max-h-32 rounded bg-muted p-2">` containing `{detail}`
9. Verify the component compiles without type errors and lints cleanly.

## Contracts & Interfaces

```typescript
// ui/components/dashboard/gate-error-banner.tsx

interface GateErrorBannerProps {
  /** Friendly user-facing error message. */
  message: string;
  /** Raw pipeline output for debugging. Shown in expandable detail section. */
  detail?: string;
  /** Callback to dismiss (clear) the error. */
  onDismiss: () => void;
}

export function GateErrorBanner(props: GateErrorBannerProps): React.ReactElement;
```

### Consuming Component (future — T04 context only, do NOT implement)

```typescript
// How ApproveGateButton will use this component (T04):
<GateErrorBanner
  message={error.message}
  detail={error.detail}
  onDismiss={clearError}
/>
```

## Styles & Design Tokens

All tokens are CSS custom properties defined in `ui/app/globals.css`.

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--destructive` | `oklch(0.58 0.22 27)` | `oklch(0.704 0.191 22.216)` | Error icon color, message text accent, border tint |
| `--color-error-bg` | `hsl(0, 84%, 97%)` | `hsl(0, 63%, 15%)` | Available but NOT used — component uses `bg-destructive/5` to stay consistent with the Design spec |
| `--color-error-border` | `hsl(0, 84%, 80%)` | `hsl(0, 63%, 31%)` | Available but NOT used — component uses `border-destructive/30` per Design spec |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Detail `<pre>` background (`bg-muted`) |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Summary text, detail text |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Summary hover text |

### CSS Classes Reference

- **Container**: `rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm`
- **Message text**: `text-destructive font-medium`
- **Alert icon**: `size-4 shrink-0 text-destructive mt-0.5` + `aria-hidden="true"`
- **Dismiss button**: `Button variant="ghost" size="icon-xs"` + `aria-label="Dismiss error"`
- **Detail summary**: `cursor-pointer text-xs text-muted-foreground hover:text-foreground`
- **Detail pre**: `mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-auto max-h-32 rounded bg-muted p-2`

### Existing Utility

```typescript
// ui/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Existing Button Component

```typescript
// ui/components/ui/button.tsx — relevant API
import { Button } from "@/components/ui/button"

// Variant "ghost" — transparent background, hover:bg-muted
// Size "icon-xs" — size-6 (24px), rounded-[min(var(--radius-md),10px)]
// Usage: <Button variant="ghost" size="icon-xs" onClick={...} aria-label="..."><X className="size-3" /></Button>
```

## Test Requirements

- [ ] Component renders without crashing when given `message="Test error"` and `onDismiss={() => {}}`
- [ ] `role="alert"` attribute is present on the container element
- [ ] `aria-live="polite"` attribute is present on the container element
- [ ] Message text renders with the `text-destructive` and `font-medium` classes
- [ ] `AlertCircle` icon renders with `aria-hidden="true"`
- [ ] Dismiss button has `aria-label="Dismiss error"` and calls `onDismiss` when clicked
- [ ] When `detail` is provided: a `<details>` element is rendered containing a `<summary>` with "Show pipeline detail" text and a `<pre>` with the detail content
- [ ] When `detail` is `undefined`: no `<details>` element is rendered in the DOM
- [ ] Detail `<pre>` has `max-h-32 overflow-auto` classes to constrain height and enable scrolling

## Acceptance Criteria

- [ ] File `ui/components/dashboard/gate-error-banner.tsx` exists and exports `GateErrorBanner`
- [ ] Component compiles without TypeScript errors
- [ ] Container has `role="alert"` and `aria-live="polite"` attributes
- [ ] Dismiss button invokes the `onDismiss` callback when clicked
- [ ] `<details>` section renders only when `detail` prop is provided
- [ ] `<details>` section does NOT render when `detail` is `undefined`
- [ ] Detail `<pre>` constrains height with `max-h-32` and enables scroll with `overflow-auto`
- [ ] `AlertCircle` icon has `aria-hidden="true"`
- [ ] Dismiss button has `aria-label="Dismiss error"`
- [ ] No lint errors
- [ ] Build succeeds

## Constraints

- Do NOT create or modify any other files — only `ui/components/dashboard/gate-error-banner.tsx`
- Do NOT add this component to the barrel export `ui/components/dashboard/index.ts` — that is handled in task T05
- Do NOT import or depend on any global state, context, or hooks — this component is purely presentational
- Do NOT use the `--color-error-bg` / `--color-error-border` tokens directly — use `bg-destructive/5` and `border-destructive/30` Tailwind classes as specified in the Design doc
- Do NOT add optimistic UI, loading state, or API call logic — those belong to `ApproveGateButton` (task T04)
- Use the existing `Button` component from `@/components/ui/button` for the dismiss button — do NOT create a custom close button
- Use named export (`export function GateErrorBanner`) — do NOT use default export
