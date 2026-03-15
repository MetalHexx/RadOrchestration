---
project: "UI-HUMAN-GATE-CONTROLS"
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Architecture

## Technical Overview

This project adds the first write-path to the orchestration dashboard by introducing a POST API route that invokes the existing `pipeline.js` script to approve the two pipeline-level human gates (post-planning and post-final-review). The frontend adds a reusable centered `Dialog` UI primitive (paralleling the existing `Sheet` side-panel), domain-specific approval components (`ApproveGateButton`, `ConfirmApprovalDialog`, `GateErrorBanner`), and a normalizer fix that enables the Final Review section to render in v3 state schemas. The existing SSE infrastructure (chokidar → broadcast → `useProjects` hook) provides automatic UI refresh after approval — no new real-time plumbing is needed.

## System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│     Presentation                                                    │
│     Dialog primitive, ApproveGateButton, ConfirmApprovalDialog,     │
│     GateErrorBanner, updated PlanningSection & FinalReviewSection   │
├─────────────────────────────────────────────────────────────────────┤
│     Application                                                     │
│     useApproveGate hook, prop threading in MainDashboard            │
├─────────────────────────────────────────────────────────────────────┤
│     Domain                                                          │
│     GateEvent type, GateApproveResponse, GateErrorResponse,         │
│     gate-pending derivation logic, normalizer v3 fix                │
├─────────────────────────────────────────────────────────────────────┤
│     Infrastructure                                                  │
│     POST /api/projects/[name]/gate route, execFile → pipeline.js,   │
│     existing SSE watcher (unchanged)                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `Dialog` primitive | Presentation | `ui/components/ui/dialog.tsx` | Centered modal dialog using `@base-ui/react/dialog`. Exports `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`. Mirrors the `Sheet` component API but uses centered layout. |
| `ApproveGateButton` | Presentation | `ui/components/dashboard/approve-gate-button.tsx` | Compound component managing the full approval lifecycle: renders the approve button, owns dialog open/close state, delegates to `useApproveGate` for the API call, renders `ConfirmApprovalDialog` and `GateErrorBanner` as children. |
| `ConfirmApprovalDialog` | Presentation | `ui/components/dashboard/confirm-approval-dialog.tsx` | Dialog content for gate approval confirmation. Displays title, document name, consequence description, Cancel/Confirm buttons. Disables Confirm and shows spinner when `isPending`. |
| `GateErrorBanner` | Presentation | `ui/components/dashboard/gate-error-banner.tsx` | Inline error display with friendly message, dismiss button, and expandable `<details>` section for raw pipeline output. |
| `PlanningSection` (updated) | Presentation | `ui/components/dashboard/planning-section.tsx` | Existing component — updated to accept `projectName` prop and conditionally render `ApproveGateButton` when the planning gate is pending. |
| `FinalReviewSection` (updated) | Presentation | `ui/components/dashboard/final-review-section.tsx` | Existing component — updated to accept `projectName` and `pipelineTier` props and conditionally render `ApproveGateButton` when the final-review gate is pending. |
| `MainDashboard` (updated) | Presentation | `ui/components/layout/main-dashboard.tsx` | Existing component — updated to thread `projectName` and `pipelineTier` down to `PlanningSection` and `FinalReviewSection`. |
| `useApproveGate` hook | Application | `ui/hooks/use-approve-gate.ts` | Encapsulates gate approval API call. Returns `{ approveGate, isPending, error, clearError }`. Calls `POST /api/projects/[name]/gate` and manages loading/error state. |
| Gate types | Domain | `ui/types/state.ts` | New types: `GateEvent`, `GateApproveResponse`, `GateErrorResponse` — added to the existing state types file. |
| Normalizer v3 fix | Domain | `ui/lib/normalizer.ts` | Fix `normalizeState()` to read `execution.final_review_status`, `execution.final_review_doc`, and `execution.final_review_approved` when `raw.final_review` is undefined (v3 schema). |
| Gate API route | Infrastructure | `ui/app/api/projects/[name]/gate/route.ts` | POST endpoint. Validates event whitelist and project name, resolves project directory, invokes `pipeline.js` via `execFile`, returns structured success/error response. |

## Contracts & Interfaces

### Gate Types (`ui/types/state.ts`)

```typescript
// ui/types/state.ts — additions

/** Whitelist of allowed gate events — prevents arbitrary event forwarding. */
export type GateEvent = 'plan_approved' | 'final_approved';

/** POST /api/projects/[name]/gate — request body. */
export interface GateApproveRequest {
  event: GateEvent;
}

/** POST /api/projects/[name]/gate — success response (HTTP 200). */
export interface GateApproveResponse {
  success: true;
  action: string;
  mutations_applied: string[];
}

/** POST /api/projects/[name]/gate — error response (HTTP 400/404/409/500). */
export interface GateErrorResponse {
  error: string;
  detail?: string;
}
```

### `useApproveGate` Hook (`ui/hooks/use-approve-gate.ts`)

```typescript
// ui/hooks/use-approve-gate.ts

import type { GateEvent, GateErrorResponse } from '@/types/state';

interface UseApproveGateReturn {
  /** Invoke the gate approval API. Throws nothing — errors captured in `error`. */
  approveGate: (projectName: string, event: GateEvent) => Promise<boolean>;
  /** True while the API call is in flight. */
  isPending: boolean;
  /** Error object with message and optional raw detail, or null. */
  error: { message: string; detail?: string } | null;
  /** Clear the current error state. */
  clearError: () => void;
}

export function useApproveGate(): UseApproveGateReturn;
```

### `ApproveGateButton` Component (`ui/components/dashboard/approve-gate-button.tsx`)

```typescript
// ui/components/dashboard/approve-gate-button.tsx

import type { GateEvent } from '@/types/state';

interface ApproveGateButtonProps {
  /** The pipeline gate event to fire: 'plan_approved' or 'final_approved'. */
  gateEvent: GateEvent;
  /** The project name (used in the API URL path). */
  projectName: string;
  /** Display name of the document being approved (e.g., "UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md"). */
  documentName: string;
  /** Button label text (e.g., "Approve Plan" or "Approve Final Review"). */
  label: string;
}

export function ApproveGateButton(props: ApproveGateButtonProps): React.ReactElement;
```

### `ConfirmApprovalDialog` Component (`ui/components/dashboard/confirm-approval-dialog.tsx`)

```typescript
// ui/components/dashboard/confirm-approval-dialog.tsx

interface ConfirmApprovalDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title (e.g., "Approve Master Plan"). */
  title: string;
  /** Filename of the document being approved. */
  documentName: string;
  /** Plain-language description of what will change. */
  description: string;
  /** Callback invoked when the user clicks Confirm. */
  onConfirm: () => void;
  /** Whether the approval is currently in flight. */
  isPending: boolean;
}

export function ConfirmApprovalDialog(props: ConfirmApprovalDialogProps): React.ReactElement;
```

### `GateErrorBanner` Component (`ui/components/dashboard/gate-error-banner.tsx`)

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

### `Dialog` Primitive (`ui/components/ui/dialog.tsx`)

```typescript
// ui/components/ui/dialog.tsx

import type { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

/** Root — manages open/close state. */
export function Dialog(props: DialogPrimitive.Root.Props): React.ReactElement;

/** Trigger — opens the dialog on click. */
export function DialogTrigger(props: DialogPrimitive.Trigger.Props): React.ReactElement;

/** Close — closes the dialog on click. */
export function DialogClose(props: DialogPrimitive.Close.Props): React.ReactElement;

/** Overlay/Backdrop — semi-transparent backdrop. */
export function DialogOverlay(props: DialogPrimitive.Backdrop.Props): React.ReactElement;

/** Content/Popup — centered modal container. */
export function DialogContent(props: DialogPrimitive.Popup.Props): React.ReactElement;

/** Title — dialog heading with aria-labelledby. */
export function DialogTitle(props: DialogPrimitive.Title.Props): React.ReactElement;

/** Description — dialog description with aria-describedby. */
export function DialogDescription(props: DialogPrimitive.Description.Props): React.ReactElement;
```

### Updated Section Props

```typescript
// ui/components/dashboard/planning-section.tsx — updated interface
interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null }>;
    human_approved: boolean;
  };
  projectName: string;          // NEW — needed for API call
  onDocClick: (path: string) => void;
}

// ui/components/dashboard/final-review-section.tsx — updated interface
interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  projectName: string;          // NEW — needed for API call
  pipelineTier: PipelineTier;   // NEW — needed for button visibility
  onDocClick: (path: string) => void;
}
```

### Gate API Route (`ui/app/api/projects/[name]/gate/route.ts`)

```typescript
// ui/app/api/projects/[name]/gate/route.ts

import { NextRequest, NextResponse } from 'next/server';

/** POST handler — invokes pipeline.js with a whitelisted gate event. */
export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
): Promise<NextResponse>;
```

## API Endpoints

| Method | Path | Request Body | Success Response (200) | Error Responses | Auth |
|--------|------|-------------|----------------------|-----------------|------|
| POST | `/api/projects/[name]/gate` | `{ "event": GateEvent }` | `{ "success": true, "action": string, "mutations_applied": string[] }` | 400: invalid event or project name; 404: project not found; 409: pipeline rejected (wrong state); 500: spawn/crash failure | None (local dev tool) |

### Request Validation Rules

1. **Event whitelist**: `event` must be exactly `"plan_approved"` or `"final_approved"`. Any other value → HTTP 400.
2. **Project name format**: `name` (from URL path) must match `/^[A-Z0-9][A-Z0-9_-]*$/`. Any mismatch → HTTP 400.
3. **Project existence**: `resolveProjectDir()` must resolve to an existing directory with a `state.json`. Missing → HTTP 404.

### Pipeline Invocation

```
process.execPath pipeline.js --event <event> --project-dir <abs-project-dir>
```

- Use `process.execPath` (not `'node'`) to avoid PATH resolution failures in the Next.js server process.
- Parse stdout as JSON. Exit code 0 + `result.success === true` → HTTP 200. Exit code 0 + `result.success === false` → HTTP 409 with `{ error, detail: stdout }`. Non-zero exit / spawn failure → HTTP 500.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@base-ui/react` | `1.2.0+` | Dialog primitives (`Dialog.Root`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`, `Dialog.Trigger`, `Dialog.Close`) — already installed |
| `lucide-react` | existing | `Loader2` (spinner icon), `AlertCircle` (error icon), `CheckCircle2`, `Circle` — already installed |
| `next` | existing | App Router API routes, `NextRequest`, `NextResponse` — already installed |
| `node:child_process` | built-in | `execFile` for invoking `pipeline.js` from the API route |
| `node:util` | built-in | `promisify` to wrap `execFile` |

### Internal Dependencies (module → module)

```
ApproveGateButton
  → useApproveGate (hook)
  → ConfirmApprovalDialog (component)
  → GateErrorBanner (component)
  → Dialog primitive (ui component)
  → GateEvent type (types/state.ts)

PlanningSection (updated)
  → ApproveGateButton

FinalReviewSection (updated)
  → ApproveGateButton

MainDashboard (updated)
  → PlanningSection (passes projectName)
  → FinalReviewSection (passes projectName, pipelineTier)

useApproveGate
  → GateEvent, GateApproveResponse, GateErrorResponse (types/state.ts)

POST /api/projects/[name]/gate/route.ts
  → path-resolver.ts (getWorkspaceRoot, resolveProjectDir)
  → fs-reader.ts (readConfig)
  → node:child_process (execFile)

normalizer.ts (fix)
  → types/state.ts (existing types — no new dependencies)

ConfirmApprovalDialog
  → Dialog, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose (dialog.tsx)
  → Button (button.tsx)

GateErrorBanner
  → Button (button.tsx)
```

## File Structure

```
ui/
├── app/
│   └── api/
│       └── projects/
│           └── [name]/
│               └── gate/
│                   └── route.ts              # NEW — POST gate approval endpoint
├── components/
│   ├── dashboard/
│   │   ├── approve-gate-button.tsx           # NEW — compound approval button
│   │   ├── confirm-approval-dialog.tsx       # NEW — confirmation dialog content
│   │   ├── gate-error-banner.tsx             # NEW — inline error with expandable detail
│   │   ├── planning-section.tsx              # MODIFIED — add projectName prop, render ApproveGateButton
│   │   ├── final-review-section.tsx          # MODIFIED — add projectName + pipelineTier props, render ApproveGateButton
│   │   └── index.ts                          # MODIFIED — re-export new components
│   ├── layout/
│   │   └── main-dashboard.tsx                # MODIFIED — thread projectName + pipelineTier to sections
│   └── ui/
│       └── dialog.tsx                        # NEW — centered modal Dialog primitive
├── hooks/
│   └── use-approve-gate.ts                   # NEW — gate approval API hook
├── lib/
│   └── normalizer.ts                         # MODIFIED — v3 final_review fallback fix
└── types/
    └── state.ts                              # MODIFIED — add GateEvent, GateApproveRequest, GateApproveResponse, GateErrorResponse
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Error handling | **API route**: Structured try/catch. Pipeline stdout parsed as JSON; `success: false` → HTTP 409 with `{ error, detail }`. Spawn failure / non-JSON stdout → HTTP 500 with generic message. **Client**: `useApproveGate` captures errors in state; `GateErrorBanner` renders friendly message + expandable raw detail. Errors never silently swallowed. |
| Input validation | **API route**: Event whitelist (`plan_approved`, `final_approved`) checked before any filesystem or process operation. Project name validated against `/^[A-Z0-9][A-Z0-9_-]*$/` to prevent path traversal or injection. `resolveProjectDir` uses `path.resolve` which normalizes traversal attempts, but the allow-list pattern prevents them at the gate. |
| State management | **No global state added.** `useApproveGate` uses local `useState` for `isPending` and `error`. The SSE-driven `useProjects` hook already handles post-approval state refresh — when `pipeline.js` writes `state.json`, chokidar emits a `state_change` event, and the hook calls `setProjectState()`. Button visibility is derived from the normalized state props, so buttons disappear automatically after approval. |
| Accessibility | Dialog uses `role="alertdialog"`, `aria-labelledby` (title), `aria-describedby` (description). Focus traps inside dialog while open. Cancel button receives initial focus (safe default). Focus returns to trigger on close. Error banner uses `role="alert"` and `aria-live="polite"`. Loading button sets `aria-busy="true"` and `aria-disabled="true"`. All interactive elements inherit existing `focus-visible` ring styles. |
| Security | **Event whitelist** prevents arbitrary pipeline event injection — only the two defined gate events are accepted. **Project name validation** prevents path traversal and command injection via the URL parameter. **No shell invocation** — `execFile` is used (not `exec`), which does not spawn a shell and prevents shell injection. No authentication required (local dev tool, confirmed out of scope). |
| Optimistic UI | **Not used.** The button disables with a spinner during the API call (`isPending`), and the SSE event arrives ~500ms after the pipeline writes state.json. The `isPending` state covers the gap. No optimistic state mutation is performed — the source of truth is always the SSE-delivered normalized state. |

## Phasing Recommendations

The Tactical Planner makes final phasing decisions, but the following advisory phasing reflects the dependency graph:

1. **Phase 1 — Foundation**: Domain types (`GateEvent`, `GateApproveRequest`, `GateApproveResponse`, `GateErrorResponse` in `types/state.ts`), the `Dialog` UI primitive (`dialog.tsx`), the normalizer v3 fix (`normalizer.ts`), and the POST API route (`gate/route.ts`). These are the foundational pieces with no UI-component dependencies. The normalizer fix is a prerequisite for the Final Review section to render at all in v3.

2. **Phase 2 — UI Components & Integration**: The `useApproveGate` hook, `GateErrorBanner`, `ConfirmApprovalDialog`, `ApproveGateButton`, updated `PlanningSection` and `FinalReviewSection` props, and `MainDashboard` prop threading. All presentation and application layer work, building on Phase 1 artifacts.
