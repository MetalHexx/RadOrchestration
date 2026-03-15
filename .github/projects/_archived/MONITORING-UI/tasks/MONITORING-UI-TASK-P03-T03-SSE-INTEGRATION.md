---
project: "MONITORING-UI"
phase: 3
task: 3
title: "Real-Time State Integration + Connection Status"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 3
---

# Real-Time State Integration + Connection Status

## Objective

Wire the `useSSE` hook into the `useProjects` hook so that incoming SSE events (`state_change`, `connected`, `project_added`, `project_removed`) automatically update the dashboard state in real time, and connect the `ConnectionIndicator` in `AppHeader` to the live SSE connection status — replacing the hardcoded `"disconnected"` value.

## Context

The `useSSE` hook (`ui/hooks/use-sse.ts`) is complete and manages an `EventSource` connection to `/api/events`, exposing `{ status, events, reconnect, lastEventTime }`. The `useProjects` hook (`ui/hooks/use-projects.ts`) manages the project list and selected project state via REST fetches. The `ConnectionIndicator` component (`ui/components/badges/connection-indicator.tsx`) renders a colored dot + label based on a `status` prop but is currently hardcoded to `"disconnected"` in `AppHeader`. The `AppHeader` component takes no props. The root page (`ui/app/page.tsx`) destructures `useProjects()` and renders `AppHeader` without passing SSE state.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/hooks/use-projects.ts` | Call `useSSE` internally; handle SSE events to update state; expose `sseStatus` and `reconnect` in return |
| MODIFY | `ui/components/layout/app-header.tsx` | Accept `sseStatus` and `onReconnect` props; pass to `ConnectionIndicator` |
| MODIFY | `ui/app/page.tsx` | Pass `sseStatus` and `reconnect` from `useProjects` return to `AppHeader` |

## Implementation Steps

1. **Modify `ui/hooks/use-projects.ts`** — Import `useSSE` from `@/hooks/use-sse` and the SSE types. Add an `handleSSEEvent` callback that processes each event type:
   - `state_change`: If `payload.projectName` matches `selectedProject`, call `setProjectState(payload.state)`.
   - `connected`: Update the project list by mapping `payload.projects` to summaries (refetch via `/api/projects` to get full `ProjectSummary` objects).
   - `project_added`: Refetch the project list from `/api/projects`.
   - `project_removed`: Remove the project from the local `projects` array. If the removed project was selected, clear `selectedProject` and `projectState`.

2. **Call `useSSE` inside `useProjects`** — Pass `{ url: "/api/events", onEvent: handleSSEEvent }` to `useSSE`. Destructure `{ status: sseStatus, reconnect }` from the return value.

3. **Extend `UseProjectsReturn`** — Add `sseStatus: SSEConnectionStatus` and `reconnect: () => void` fields. Return them from the hook.

4. **Modify `ui/components/layout/app-header.tsx`** — Add an `AppHeaderProps` interface accepting `sseStatus: "connected" | "reconnecting" | "disconnected"` and `onReconnect: () => void`. Pass `status={sseStatus}` to `ConnectionIndicator` instead of the hardcoded `"disconnected"`. When `sseStatus === "disconnected"`, render a small "Retry" text button next to the indicator that calls `onReconnect`.

5. **Modify `ui/app/page.tsx`** — Destructure `sseStatus` and `reconnect` from the `useProjects()` call. Pass them as `sseStatus={sseStatus}` and `onReconnect={reconnect}` to `<AppHeader />`.

6. **Verify SSE event flow end-to-end**: When a `state_change` event arrives for the selected project, the dashboard should re-render with updated data without a full page refresh.

## Contracts & Interfaces

### SSE Types — `ui/types/events.ts`

```typescript
export type SSEEventType = 'state_change' | 'project_added' | 'project_removed' | 'connected' | 'heartbeat';

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  type: T;
  timestamp: string;      // ISO 8601
  payload: SSEPayloadMap[T];
}

export interface SSEPayloadMap {
  state_change: {
    projectName: string;
    state: NormalizedProjectState;
  };
  project_added: {
    projectName: string;
  };
  project_removed: {
    projectName: string;
  };
  connected: {
    projects: string[];
  };
  heartbeat: Record<string, never>;
}

export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
```

### useSSE Hook — `ui/hooks/use-sse.ts`

```typescript
interface UseSSEOptions {
  url: string;
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  maxEvents?: number;  // default: 50
}

interface UseSSEReturn {
  status: SSEConnectionStatus;
  events: SSEEvent[];
  reconnect: () => void;
  lastEventTime: Date | null;
}

export function useSSE(options: UseSSEOptions): UseSSEReturn;
```

### useProjects Hook — `ui/hooks/use-projects.ts` (current → modified)

Current return interface:
```typescript
interface UseProjectsReturn {
  projects: ProjectSummary[];
  selectedProject: string | null;
  projectState: NormalizedProjectState | null;
  selectProject: (name: string) => void;
  isLoading: boolean;
  error: string | null;
}
```

**Modified return interface** (add two fields):
```typescript
interface UseProjectsReturn {
  projects: ProjectSummary[];
  selectedProject: string | null;
  projectState: NormalizedProjectState | null;
  selectProject: (name: string) => void;
  isLoading: boolean;
  error: string | null;
  /** SSE connection status from useSSE */
  sseStatus: SSEConnectionStatus;
  /** Manual reconnect function — tears down and re-creates EventSource */
  reconnect: () => void;
}
```

### ConnectionIndicator — `ui/components/badges/connection-indicator.tsx`

```typescript
type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

export function ConnectionIndicator({ status }: ConnectionIndicatorProps): JSX.Element;
```

### AppHeader — `ui/components/layout/app-header.tsx` (current → modified)

Current: No props.

**Modified props**:
```typescript
interface AppHeaderProps {
  sseStatus: "connected" | "reconnecting" | "disconnected";
  onReconnect: () => void;
}

export function AppHeader({ sseStatus, onReconnect }: AppHeaderProps): JSX.Element;
```

### ProjectSummary — `ui/types/components.ts`

```typescript
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}
```

### NormalizedProjectState — `ui/types/state.ts`

The full `NormalizedProjectState` type is already imported in `use-projects.ts`. No changes needed to the import.

## Styles & Design Tokens

- `--connection-ok`: `hsl(142, 71%, 45%)` — green dot for "Connected" state
- `--connection-warning`: `hsl(38, 92%, 50%)` — amber dot + pulse animation for "Reconnecting…" state
- `--connection-error`: `hsl(0, 84%, 60%)` — red dot for "Disconnected" state
- `--header-bg`: Header background color (already applied)
- `--header-border`: Header bottom border color (already applied)
- "Retry" button: Use `variant="ghost" size="sm"` from shadcn Button, with `text-xs` text. Only visible when `sseStatus === "disconnected"`.

## Test Requirements

- [ ] `useProjects` returns `sseStatus` field reflecting SSE connection status
- [ ] `useProjects` returns `reconnect` function
- [ ] When a `state_change` SSE event arrives with `projectName` matching `selectedProject`, `projectState` updates without page refresh
- [ ] When a `state_change` SSE event arrives with a different `projectName`, `projectState` does NOT change
- [ ] When a `connected` event arrives, the project list is refreshed
- [ ] When a `project_added` event arrives, the project list is refreshed
- [ ] When a `project_removed` event arrives for the selected project, selection is cleared
- [ ] When a `project_removed` event arrives for a non-selected project, selected project is unaffected
- [ ] `AppHeader` renders `ConnectionIndicator` with the passed `sseStatus` prop (not hardcoded)
- [ ] When `sseStatus` is `"disconnected"`, a "Retry" button is visible next to the indicator
- [ ] Clicking "Retry" calls `onReconnect`
- [ ] When `sseStatus` is `"connected"` or `"reconnecting"`, "Retry" button is NOT visible

## Acceptance Criteria

- [ ] `ui/hooks/use-projects.ts` calls `useSSE` internally with `url: "/api/events"`
- [ ] `UseProjectsReturn` includes `sseStatus: SSEConnectionStatus` and `reconnect: () => void`
- [ ] `state_change` events for the selected project update `projectState` reactively
- [ ] `connected`, `project_added`, `project_removed` events update the project list
- [ ] `AppHeader` accepts `sseStatus` and `onReconnect` props
- [ ] `ConnectionIndicator` receives live `sseStatus` (not hardcoded `"disconnected"`)
- [ ] A "Retry" button appears next to the indicator only when `sseStatus === "disconnected"`
- [ ] Root page passes `sseStatus` and `reconnect` from `useProjects` to `AppHeader`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT modify `ui/hooks/use-sse.ts` — use it as-is
- Do NOT modify `ui/components/badges/connection-indicator.tsx` — its interface is already correct
- Do NOT modify `ui/types/events.ts` — all needed types are already exported
- Do NOT add new files — this task only modifies the three listed files
- Do NOT store SSE events in `useProjects` state — the `useSSE` hook manages its own event buffer internally
- Do NOT fetch project state on every SSE event — only refetch when the event type requires it (`connected`, `project_added`, `project_removed` trigger list refetch; `state_change` uses the inline payload)
- Use `"use client"` directive — already present in all three files
- Keep the `handleSSEEvent` callback stable with `useCallback` and proper dependency array to avoid unnecessary `useSSE` reconnections
