---
project: "MONITORING-UI"
phase: 4
task: 4
title: "Loading States + Error Boundaries + Carry-Forward Hardening"
status: "pending"
skills_required: ["react", "next.js", "typescript"]
skills_optional: ["accessibility"]
estimated_files: 8
---

# Loading States + Error Boundaries + Carry-Forward Hardening

## Objective

Add skeleton loading states for sidebar and dashboard sections, improve the root error boundary with retry+detail UX, add a chokidar error handler to the SSE endpoint (carry-forward CF-B), reconcile the page title to "Orchestration Monitor" (carry-forward CF-E), add `role="list"` to the task card container in phase-card (T03 review fix), and add `prefers-reduced-motion` CSS support for animations.

## Context

The dashboard is fully functional with SSE real-time updates, document viewer, config viewer, and theme toggle. The sidebar already has basic `SidebarMenuSkeleton` usage during loading. This task adds skeleton placeholders to the dashboard header area and execution section, wraps dashboard sections in a lightweight error boundary component, adds `prefers-reduced-motion` CSS to disable pulse/spin/transition animations, and closes two carry-forward items from Phase 3. The `Skeleton` component from shadcn is already installed at `ui/components/ui/skeleton.tsx`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/components/sidebar/project-sidebar.tsx` | Enhance skeleton: show 5 shimmer rows during `isLoading` with empty project list |
| MODIFY | `ui/components/dashboard/project-header.tsx` | Add a `ProjectHeaderSkeleton` named export for loading state |
| MODIFY | `ui/components/execution/execution-section.tsx` | Add an `ExecutionSectionSkeleton` named export for loading state |
| MODIFY | `ui/app/error.tsx` | Improve with error digest display and better UX |
| MODIFY | `ui/app/api/events/route.ts` | Add `watcher.on('error', ...)` handler (CF-B) |
| MODIFY | `ui/app/layout.tsx` | Change metadata title to "Orchestration Monitor" (CF-E) |
| MODIFY | `ui/components/execution/phase-card.tsx` | Add `role="list"` to task card container |
| MODIFY | `ui/app/globals.css` | Add `prefers-reduced-motion` CSS rules |

## Implementation Steps

1. **`ui/components/sidebar/project-sidebar.tsx`** — The sidebar already renders `SidebarMenuSkeleton` rows when `isLoading && projects.length === 0`. Verify this is 5 shimmer rows (it currently renders 5). No code change needed if already correct. If fewer than 5, adjust to 5.

2. **`ui/components/dashboard/project-header.tsx`** — Add a `ProjectHeaderSkeleton` component below the existing `ProjectHeader`:
   ```tsx
   export function ProjectHeaderSkeleton() {
     return (
       <div className="flex flex-col gap-1">
         <div className="flex items-center gap-2">
           <Skeleton className="h-6 w-40" />
           <Skeleton className="h-5 w-20 rounded-full" />
           <Skeleton className="h-5 w-16 rounded-full" />
         </div>
         <Skeleton className="h-4 w-72" />
         <div className="flex items-center gap-3">
           <Skeleton className="h-3 w-36" />
           <Skeleton className="h-3 w-36" />
         </div>
       </div>
     );
   }
   ```

3. **`ui/components/execution/execution-section.tsx`** — Add an `ExecutionSectionSkeleton` component below the existing `ExecutionSection`:
   ```tsx
   export function ExecutionSectionSkeleton() {
     return (
       <Card>
         <CardHeader>
           <Skeleton className="h-5 w-40" />
         </CardHeader>
         <CardContent>
           <div className="space-y-3">
             {Array.from({ length: 2 }).map((_, i) => (
               <div key={i} className="rounded-md border p-3 space-y-2">
                 <div className="flex items-center gap-2">
                   <Skeleton className="h-5 w-5 rounded-full" />
                   <Skeleton className="h-4 w-48" />
                 </div>
                 <Skeleton className="h-2 w-full rounded-full" />
               </div>
             ))}
           </div>
         </CardContent>
       </Card>
     );
   }
   ```

4. **`ui/app/error.tsx`** — Improve the root error boundary. The current version already has a "Try again" button and error message display, which is good. Enhance it with:
   - Display the error `digest` when available (helps debugging in production)
   - Add `role="alert"` on the error container
   - Add a descriptive paragraph about what happened
   
   The current file content is:
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
           <div className="mb-4 text-4xl" role="img" aria-label="Warning">⚠️</div>
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
   
   Replace the return JSX to add `role="alert"` on the outer card div, and append the error digest when available:
   ```tsx
   return (
     <div className="flex min-h-screen items-center justify-center bg-background p-4">
       <div role="alert" className="mx-auto max-w-md rounded-lg border border-destructive/50 bg-card p-6 text-center shadow-sm">
         <div className="mb-4 text-4xl" role="img" aria-label="Warning">⚠️</div>
         <h2 className="mb-2 text-lg font-semibold text-card-foreground">
           Something went wrong
         </h2>
         <p className="mb-4 text-sm text-muted-foreground">
           {error.message || "An unexpected error occurred."}
         </p>
         {error.digest && (
           <p className="mb-4 font-mono text-xs text-muted-foreground">
             Error ID: {error.digest}
           </p>
         )}
         <button
           onClick={reset}
           className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
         >
           Try again
         </button>
       </div>
     </div>
   );
   ```

5. **`ui/app/api/events/route.ts`** — Add a `watcher.on('error', ...)` handler immediately after the existing `watcher.on('unlink', ...)` block. This closes carry-forward CF-B (chokidar OS-level errors).

   Insert after the unlink handler block:
   ```typescript
   // error handler — log OS-level watcher errors (CF-B)
   watcher.on('error', (error: Error) => {
     console.error('[SSE] Chokidar watcher error:', error);
   });
   ```

6. **`ui/app/layout.tsx`** — Change the metadata title from `"Orchestration Dashboard"` to `"Orchestration Monitor"` to match the AppHeader title and establish consistent naming (CF-E).

   Current:
   ```typescript
   export const metadata: Metadata = {
     title: "Orchestration Dashboard",
   ```
   Change to:
   ```typescript
   export const metadata: Metadata = {
     title: "Orchestration Monitor",
   ```

7. **`ui/components/execution/phase-card.tsx`** — Add `role="list"` to the `<div>` that wraps the task card `.map()` loop. This fixes the orphaned `role="listitem"` on `TaskCard` (T03 review issue #1).

   Current:
   ```tsx
   <div className="space-y-1 pl-2">
     {phase.tasks.map((task) => (
   ```
   Change to:
   ```tsx
   <div role="list" className="space-y-1 pl-2">
     {phase.tasks.map((task) => (
   ```

8. **`ui/app/globals.css`** — Add a `@media (prefers-reduced-motion: reduce)` block at the end of the file that disables pulse animations (skeleton shimmer), spin animations (Loader2), and progress bar transitions.

   Append:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .animate-pulse {
       animation: none;
     }
     .animate-spin {
       animation: none;
     }
     .transition-all,
     .transition-colors,
     .transition-opacity,
     .transition-transform {
       transition-duration: 0.01ms !important;
     }
   }
   ```

## Contracts & Interfaces

```typescript
// ui/components/dashboard/project-header.tsx — new named export
export function ProjectHeaderSkeleton(): JSX.Element;
// No props — renders a static skeleton placeholder

// ui/components/execution/execution-section.tsx — new named export
export function ExecutionSectionSkeleton(): JSX.Element;
// No props — renders a static skeleton placeholder
```

The existing `Skeleton` component from `ui/components/ui/skeleton.tsx`:
```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

The `ProjectSidebar` already accepts `isLoading: boolean` and renders `SidebarMenuSkeleton` when loading with empty project list — no interface change needed.

## Styles & Design Tokens

- **Skeleton shimmer**: `animate-pulse` class from Tailwind (applied by shadcn `Skeleton`). Background: `bg-muted` (`--color-muted`)
- **Progress bar transition**: `transition-all` class on the fill `<div>` inside `ProgressBar`. Color: `var(--color-progress-fill)` on track `var(--color-progress-track)`
- **Spinner animation**: `animate-spin` class on loading spinner elements
- **Error boundary card**: `border-destructive/50` border, `bg-card` background, `text-card-foreground` heading, `text-muted-foreground` body text, `bg-primary` / `text-primary-foreground` button
- **Error digest**: `font-mono text-xs text-muted-foreground`
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` — disable `animate-pulse`, `animate-spin`, set all transitions to `0.01ms`

## Test Requirements

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings
- [ ] `ProjectHeaderSkeleton` renders without errors when imported and rendered in isolation
- [ ] `ExecutionSectionSkeleton` renders without errors when imported and rendered in isolation
- [ ] The root error boundary (`error.tsx`) displays error message, digest (when available), and a working "Try again" button
- [ ] `watcher.on('error', ...)` handler is present in `ui/app/api/events/route.ts`
- [ ] Page metadata title reads "Orchestration Monitor" (verify in `layout.tsx`)
- [ ] The task card container in `phase-card.tsx` has `role="list"` attribute
- [ ] `globals.css` contains `@media (prefers-reduced-motion: reduce)` block disabling `animate-pulse`, `animate-spin`, and transition durations

## Acceptance Criteria

- [ ] `ui/components/dashboard/project-header.tsx` exports a `ProjectHeaderSkeleton` component that renders Skeleton elements matching the header layout (name, tier badge, gate badge, description, timestamps)
- [ ] `ui/components/execution/execution-section.tsx` exports an `ExecutionSectionSkeleton` component that renders Skeleton elements inside a Card matching the execution section layout (2 phase card placeholders with icon + title + progress bar shapes)
- [ ] `ui/app/error.tsx` has `role="alert"` on the error card container and displays `error.digest` when available
- [ ] `ui/app/api/events/route.ts` has a `watcher.on('error', ...)` handler that calls `console.error` with the error
- [ ] `ui/app/layout.tsx` metadata title is `"Orchestration Monitor"`
- [ ] `ui/components/execution/phase-card.tsx` task container `<div>` has `role="list"` attribute
- [ ] `ui/app/globals.css` includes a `prefers-reduced-motion: reduce` media query disabling `animate-pulse`, `animate-spin`, and setting transition durations to near-zero
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes with zero warnings

## Constraints

- Do NOT modify component prop interfaces — skeleton components are standalone, zero-prop exports
- Do NOT wrap individual dashboard sections in React error boundary components — that is out of scope; the root `error.tsx` boundary is sufficient for now. Only improve the existing root boundary.
- Do NOT modify `useSSE` reconnection logic — it already has exponential backoff and max retry attempts. The hook is complete.
- Do NOT rename any existing file or change any component's file location
- Do NOT add new dependencies — use existing `Skeleton` from shadcn and built-in CSS
- Keep the sidebar skeleton as-is if it already renders 5 `SidebarMenuSkeleton` rows (it does)
- The chokidar error handler must only `console.error` — do NOT close the stream or call `cleanup()` on watcher errors
