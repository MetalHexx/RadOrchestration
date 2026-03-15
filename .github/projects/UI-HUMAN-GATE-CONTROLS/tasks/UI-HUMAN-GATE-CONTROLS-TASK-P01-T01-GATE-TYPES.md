---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
task: 1
title: "Add Gate Domain Types to state.ts"
status: "pending"
skills: ["generate-task-report", "run-tests"]
estimated_files: 1
---

# Add Gate Domain Types to state.ts

## Objective

Add four exported gate-related type definitions — `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, and `GateErrorResponse` — to the existing `ui/types/state.ts` file. These types define the domain contract for the gate approval API used by the POST `/api/projects/[name]/gate` route and the `useApproveGate` hook.

## Context

The file `ui/types/state.ts` contains all shared type definitions for the orchestration dashboard — raw state types (read from disk), normalized types (consumed by UI components), and enum union types. The new gate types must be appended to this file as a new section, following the existing code style: each section is separated by a comment banner using the pattern `// ─── Section Name ───...`. The file currently ends after the `NormalizedLimits` interface at approximately line 203. All types must be exported at their declaration site (no barrel re-exports needed — the file is already the canonical import target).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/types/state.ts` | Append new gate types section after the existing `NormalizedLimits` interface |

## Implementation Steps

1. Open `ui/types/state.ts`.
2. After the closing brace of the `NormalizedLimits` interface (the last interface in the file), add a blank line and a section comment banner: `// ─── Gate Approval Types ───` (using the existing `─` character pattern for visual consistency).
3. Add the `GateEvent` type alias as an exported string union type with exactly two members: `'plan_approved'` and `'final_approved'`. Include a JSDoc comment explaining this is a whitelist of allowed gate events.
4. Add the `GateApproveRequest` interface as an exported interface with a single field `event: GateEvent`. Include a JSDoc comment noting this is the POST request body.
5. Add the `GateApproveResponse` interface as an exported interface with three fields: `success: true` (literal), `action: string`, and `mutations_applied: string[]`. Include a JSDoc comment noting this is the success response (HTTP 200).
6. Add the `GateErrorResponse` interface as an exported interface with two fields: `error: string` and optional `detail?: string`. Include a JSDoc comment noting this is the error response (HTTP 400/404/409/500).
7. Verify the file compiles without type errors by running the build.

## Contracts & Interfaces

The four types below must be added exactly as specified. These are the canonical contracts that downstream modules (API route, hook, components) will import.

```typescript
// ui/types/state.ts — append after NormalizedLimits

// ─── Gate Approval Types ────────────────────────────────────────────────────

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

### Existing File Structure (end of file, for placement reference)

The file currently ends with these interfaces. Append the new section after the closing brace of `NormalizedLimits`:

```typescript
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
```

### Existing Section Banner Pattern (for style consistency)

The file uses this pattern for section separators — follow the same style:

```typescript
// ─── Enum Union Types ───────────────────────────────────────────────────────
// ─── Planning Step Names ────────────────────────────────────────────────────
// ─── Raw State Types (as read from disk) ────────────────────────────────────
// ─── Normalized Types (consumed by all UI components) ───────────────────────
```

## Styles & Design Tokens

Not applicable — this task is pure TypeScript type definitions with no UI rendering.

## Test Requirements

- [ ] `GateEvent` accepts `'plan_approved'` and `'final_approved'` — no other string values
- [ ] `GateApproveRequest` has exactly one field: `event` of type `GateEvent`
- [ ] `GateApproveResponse` has `success` typed as literal `true` (not `boolean`), `action` as `string`, `mutations_applied` as `string[]`
- [ ] `GateErrorResponse` has `error` as `string` and `detail` as optional `string`
- [ ] All four types compile and are importable: `import type { GateEvent, GateApproveRequest, GateApproveResponse, GateErrorResponse } from '@/types/state'`

## Acceptance Criteria

- [ ] `GateEvent` is exported from `ui/types/state.ts` as exactly `'plan_approved' | 'final_approved'` — no wider string type
- [ ] `GateApproveRequest` is exported from `ui/types/state.ts` with a single `event: GateEvent` field
- [ ] `GateApproveResponse` is exported from `ui/types/state.ts` with `success: true`, `action: string`, `mutations_applied: string[]`
- [ ] `GateErrorResponse` is exported from `ui/types/state.ts` with `error: string` and optional `detail?: string`
- [ ] All four types include JSDoc comments
- [ ] New types are placed in a `// ─── Gate Approval Types ───` section after `NormalizedLimits`
- [ ] No existing types or interfaces in `state.ts` are modified
- [ ] Build succeeds (`next build` or `tsc --noEmit` passes)
- [ ] No lint errors

## Constraints

- Do NOT modify any existing types or interfaces in `ui/types/state.ts` — append only
- Do NOT create a new file — all four types go in the existing `ui/types/state.ts`
- Do NOT add runtime code — these are pure type definitions (types and interfaces only)
- Do NOT use `enum` — use string union types and interfaces to match the existing file style
- Do NOT add a barrel re-export — `ui/types/state.ts` is already the canonical import path
- `GateEvent` must be a narrow string union (`'plan_approved' | 'final_approved'`), not `string`
- `GateApproveResponse.success` must be the literal type `true`, not `boolean`
