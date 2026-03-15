---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
task: 1
title: "USE-APPROVE-GATE-HOOK"
status: "pending"
skills: ["run-tests", "generate-task-report"]
estimated_files: 1
---

# USE-APPROVE-GATE-HOOK

## Objective

Create the `useApproveGate` React hook in `ui/hooks/use-approve-gate.ts` that encapsulates the gate approval API call, manages loading and error state locally via `useState`, and returns `{ approveGate, isPending, error, clearError }`.

## Context

The orchestration dashboard has a `POST /api/projects/[name]/gate` endpoint (created in Phase 1) that accepts a `{ event: GateEvent }` body and invokes `pipeline.js` to approve human gates. This hook wraps that endpoint so downstream UI components (`ApproveGateButton`, created in a later task) can call `approveGate(projectName, event)` and react to pending/error states without managing fetch logic themselves. The hook uses only local `useState` — no global state or context. The existing SSE infrastructure handles post-approval state refresh automatically; this hook only needs to manage the API call lifecycle.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/hooks/use-approve-gate.ts` | New hook file; follows existing hook patterns (`use-projects.ts`, `use-sse.ts`) |

## Implementation Steps

1. Create `ui/hooks/use-approve-gate.ts` with the `"use client"` directive at the top (all hooks in this project use this directive).
2. Import `useState` and `useCallback` from `react`.
3. Import `GateEvent` and `GateErrorResponse` from `@/types/state`.
4. Define and export a `UseApproveGateError` interface: `{ message: string; detail?: string }`.
5. Define the internal `UseApproveGateReturn` interface (not exported — used only for the return type annotation).
6. Implement the `useApproveGate` function:
   - Initialize `isPending` state as `false` via `useState<boolean>(false)`.
   - Initialize `error` state as `null` via `useState<UseApproveGateError | null>(null)`.
   - Implement `clearError` as a stable callback (`useCallback`) that sets `error` to `null`.
   - Implement `approveGate(projectName: string, event: GateEvent)` as a stable `useCallback` that:
     a. Sets `isPending` to `true` and clears any existing error.
     b. Calls `fetch(\`/api/projects/\${encodeURIComponent(projectName)}/gate\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) })`.
     c. On `res.ok` (HTTP 200): sets `isPending` to `false`, returns `true`.
     d. On `!res.ok`: parses the response body as `GateErrorResponse`, sets `error` to `{ message: parsed.error, detail: parsed.detail }`, sets `isPending` to `false`, returns `false`. If JSON parsing fails, uses a fallback message `"Approval request failed (HTTP ${res.status})."`.
     e. On network/unexpected error (catch block): sets `error` to `{ message: "Network error. Please check your connection and try again." }`, sets `isPending` to `false`, returns `false`.
     f. Use a `try/finally` structure to guarantee `isPending` is set to `false`.
7. Return the object `{ approveGate, isPending, error, clearError }` from the hook.
8. Export the `useApproveGate` function as a named export.

## Contracts & Interfaces

### Gate Types (from `ui/types/state.ts` — already exist, DO NOT modify)

```typescript
// ui/types/state.ts — these types already exist from Phase 1

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

### Hook Return Interface (to implement in this file)

```typescript
// ui/hooks/use-approve-gate.ts

import type { GateEvent, GateErrorResponse } from '@/types/state';

/** Structured error object surfaced by the hook. */
export interface UseApproveGateError {
  message: string;
  detail?: string;
}

interface UseApproveGateReturn {
  /** Invoke the gate approval API. Never throws — errors captured in `error` state. */
  approveGate: (projectName: string, event: GateEvent) => Promise<boolean>;
  /** True while the API call is in flight. */
  isPending: boolean;
  /** Structured error with message and optional raw pipeline detail, or null. */
  error: UseApproveGateError | null;
  /** Clear the current error state. */
  clearError: () => void;
}

export function useApproveGate(): UseApproveGateReturn;
```

### API Endpoint Details

| Method | Path | Request Body | Success (200) | Error (400/404/409/500) |
|--------|------|-------------|---------------|------------------------|
| POST | `/api/projects/[name]/gate` | `{ "event": "plan_approved" \| "final_approved" }` | `{ "success": true, "action": string, "mutations_applied": string[] }` | `{ "error": string, "detail"?: string }` |

- **Content-Type**: `application/json` (both request and response)
- **URL construction**: `/api/projects/${encodeURIComponent(projectName)}/gate`
- The endpoint returns `GateApproveResponse` on success and `GateErrorResponse` on failure
- The hook does NOT need to inspect the success response body beyond confirming `res.ok`

### Existing Hook Patterns (for reference)

All hooks in this project follow these conventions:

```typescript
// Pattern from ui/hooks/use-projects.ts and ui/hooks/use-sse.ts

"use client";                                    // Always present

import { useState, useCallback } from "react";   // React imports first
import type { ... } from "@/types/state";         // Type imports use @/ alias

export function useHookName(): ReturnType {       // Named export, not default
  const [state, setState] = useState<Type>(init); // Local state via useState
  // ...
  const stableCallback = useCallback((...) => {   // Callbacks wrapped in useCallback
    // ...
  }, [deps]);

  return { ... };                                 // Return object
}
```

Key conventions:
- `"use client"` directive on the first line
- Import path alias: `@/` maps to `ui/` root
- Named exports (not default exports)
- `useCallback` for functions returned to consumers (referential stability)
- `useState` for local state; no global store or context used

## Styles & Design Tokens

Not applicable — this is a hook with no visual output. The consuming `ApproveGateButton` component (a later task) handles all styling.

## Test Requirements

- [ ] Hook compiles without TypeScript errors
- [ ] Calling `approveGate("MY-PROJECT", "plan_approved")` issues a `POST` to `/api/projects/MY-PROJECT/gate` with body `{ "event": "plan_approved" }`
- [ ] `isPending` is `true` while the fetch is in flight and `false` after it settles
- [ ] On a successful response (`res.ok`), `approveGate` returns `true` and `error` is `null`
- [ ] On an error response (e.g., HTTP 409), `approveGate` returns `false` and `error` is set to `{ message: <error field from body>, detail: <detail field from body> }`
- [ ] On a network failure (fetch throws), `approveGate` returns `false` and `error.message` is a user-friendly string
- [ ] `clearError()` resets `error` to `null`
- [ ] Calling `approveGate` while a previous call is still pending does not crash (no guard required, but must not throw)
- [ ] The `projectName` parameter is encoded in the URL via `encodeURIComponent`

## Acceptance Criteria

- [ ] File `ui/hooks/use-approve-gate.ts` exists and exports `useApproveGate` as a named export
- [ ] File exports the `UseApproveGateError` interface as a named export
- [ ] Hook returns the exact shape: `{ approveGate, isPending, error, clearError }`
- [ ] `approveGate` calls `POST /api/projects/${encodeURIComponent(projectName)}/gate` with `{ event }` body and `Content-Type: application/json` header
- [ ] `approveGate` returns `Promise<boolean>` — `true` on success, `false` on failure
- [ ] `isPending` transitions: `false` → `true` (call starts) → `false` (call settles, success or failure)
- [ ] On API error: `error` is set to `{ message, detail? }` parsed from `GateErrorResponse` body
- [ ] On network error: `error` is set to `{ message }` with a user-friendly string (no raw exception message leaked)
- [ ] `clearError()` resets `error` to `null`
- [ ] Hook never throws — all errors are captured in the `error` state
- [ ] `"use client"` directive present on first line
- [ ] No global state — only `useState` for `isPending` and `error`
- [ ] Imports use `@/` path alias
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT create any test files — test requirements are verified by the Reviewer
- Do NOT modify `ui/types/state.ts` — the gate types already exist from Phase 1
- Do NOT add any global state, context providers, or external state management
- Do NOT implement optimistic UI — the hook only tracks the API call lifecycle
- Do NOT add retry logic inside the hook — retries are the user's responsibility via re-clicking
- Do NOT add request deduplication or abort controllers — keep the hook simple
- Do NOT install any new packages — all dependencies (`react`, `@/types/state`) are already available
- Do NOT create a barrel export entry — that is handled in a later task (T05)
