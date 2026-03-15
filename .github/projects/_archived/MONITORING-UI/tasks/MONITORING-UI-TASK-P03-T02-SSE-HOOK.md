---
project: "MONITORING-UI"
phase: 3
task: 2
title: "SSE Client Hook"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# SSE Client Hook

## Objective

Create a `useSSE` React hook at `ui/hooks/use-sse.ts` that manages an `EventSource` connection to `/api/events`, tracks connection status (`connected`, `reconnecting`, `disconnected`), parses incoming SSE events into typed objects, auto-reconnects with exponential backoff on disconnect, and exposes a manual reconnect function. Add the `SSEConnectionStatus` client-side type to `ui/types/events.ts`.

## Context

The SSE server endpoint already exists at `ui/app/api/events/route.ts` (created in P03-T01). It streams named events (`connected`, `state_change`, `project_added`, `project_removed`, `heartbeat`) via the SSE wire format `event: {type}\ndata: {JSON}\n\n`. The data payload for each event is a JSON-serialized `SSEEvent` object with `type`, `timestamp`, and `payload` fields. This hook will be consumed by `useProjects` in T03 to wire live updates into the dashboard. The hook lives at `ui/hooks/use-sse.ts` — this is the canonical hooks directory (resolving carry-forward CF-3 from Phase 2).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/types/events.ts` | Add `SSEConnectionStatus` type export |
| CREATE | `ui/hooks/use-sse.ts` | `useSSE` hook — full EventSource lifecycle manager |

## Implementation Steps

1. **Add client-side type to `ui/types/events.ts`**: Append the following type after the existing exports:
   ```typescript
   export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
   ```

2. **Create `ui/hooks/use-sse.ts`** with `"use client"` directive at top.

3. **Define the hook options and return interfaces** inside the hook file:
   ```typescript
   interface UseSSEOptions {
     url: string;
     onEvent?: (event: SSEEvent) => void;
     onError?: (error: Event) => void;
     onOpen?: () => void;
     maxEvents?: number; // max buffered events, default 50
   }

   interface UseSSEReturn {
     status: SSEConnectionStatus;
     events: SSEEvent[];
     reconnect: () => void;
     lastEventTime: Date | null;
   }
   ```

4. **Implement EventSource connection lifecycle** in the hook body:
   - Create `EventSource` pointing to `options.url`
   - Register listeners for each known SSE event type using `es.addEventListener(eventType, handler)` for: `'connected'`, `'state_change'`, `'project_added'`, `'project_removed'`, `'heartbeat'`
   - In each listener, parse `event.data` as JSON into an `SSEEvent` object, call `options.onEvent?.(parsed)`, append to internal events buffer, and update `lastEventTime`

5. **Implement connection status tracking**:
   - On `EventSource.onopen`: set status to `'connected'`, reset backoff delay to initial value, call `options.onOpen?.()`
   - On `EventSource.onerror`: set status to `'reconnecting'`, close the current `EventSource`, call `options.onError?.(error)`, schedule reconnection using exponential backoff
   - If reconnection attempts exhaust the max backoff ceiling, set status to `'disconnected'`

6. **Implement exponential backoff reconnection**:
   - Initial delay: `1000ms`, multiplier: `2`, max delay: `30000ms`, max attempts before `disconnected`: `10`
   - Use `setTimeout` to schedule `createConnection()` after the current delay
   - Store the timeout ID in a ref so it can be cleared on cleanup or manual reconnect
   - On successful `onopen`, reset attempt counter and delay to initial values

7. **Implement manual `reconnect()` function**:
   - Clear any pending reconnection timeout
   - Close the current `EventSource` if it exists
   - Reset backoff delay and attempt counter
   - Create a new `EventSource` immediately
   - Expose via the return object (wrap in `useCallback`)

8. **Implement events buffer management**:
   - Store events in a `useRef<SSEEvent[]>` + `useState` trigger pattern, or directly in `useState<SSEEvent[]>`
   - When a new event arrives, prepend it to the array (newest first)
   - If array length exceeds `maxEvents` (default 50), slice to `maxEvents`

9. **Implement cleanup on unmount**:
   - In `useEffect` cleanup function: close `EventSource`, clear reconnection timeout, clear any pending state updates
   - Use a `mountedRef` to prevent state updates after unmount

10. **Export the hook** as a named export: `export function useSSE(options: UseSSEOptions): UseSSEReturn`

## Contracts & Interfaces

### Existing types in `ui/types/events.ts` — use these as-is:

```typescript
// ui/types/events.ts
import type { NormalizedProjectState } from './state';

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
```

### New type to add to `ui/types/events.ts`:

```typescript
/** Connection status for the SSE client hook */
export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
```

### Hook interfaces (defined inside `ui/hooks/use-sse.ts`):

```typescript
import type { SSEEvent, SSEEventType, SSEConnectionStatus } from '@/types/events';

interface UseSSEOptions {
  /** SSE endpoint URL (e.g., '/api/events') */
  url: string;
  /** Called for every parsed SSE event */
  onEvent?: (event: SSEEvent) => void;
  /** Called on EventSource error */
  onError?: (error: Event) => void;
  /** Called when connection opens successfully */
  onOpen?: () => void;
  /** Max events to keep in buffer (default: 50) */
  maxEvents?: number;
}

interface UseSSEReturn {
  /** Current connection status */
  status: SSEConnectionStatus;
  /** Recent events buffer (newest first), capped at maxEvents */
  events: SSEEvent[];
  /** Manually tear down and re-create the EventSource */
  reconnect: () => void;
  /** Timestamp of the last received event, or null if none */
  lastEventTime: Date | null;
}
```

### SSE Wire Format (what the server sends):

```
event: connected
data: {"type":"connected","timestamp":"2026-03-10T01:00:00.000Z","payload":{"projects":["MONITORING-UI"]}}

event: state_change
data: {"type":"state_change","timestamp":"2026-03-10T01:00:01.000Z","payload":{"projectName":"MONITORING-UI","state":{...}}}

event: heartbeat
data: {"type":"heartbeat","timestamp":"2026-03-10T01:00:30.000Z","payload":{}}
```

Each SSE frame uses the format: `event: {type}\ndata: {JSON}\n\n`

The `data` field is a JSON string that deserializes to an `SSEEvent` object.

### EventSource Event Listener Pattern:

```typescript
// For each known event type, register a named event listener:
const EVENT_TYPES: SSEEventType[] = [
  'connected',
  'state_change',
  'project_added',
  'project_removed',
  'heartbeat',
];

EVENT_TYPES.forEach((eventType) => {
  es.addEventListener(eventType, (messageEvent: MessageEvent) => {
    const parsed: SSEEvent = JSON.parse(messageEvent.data);
    // handle parsed event...
  });
});
```

### Exponential Backoff Constants:

```typescript
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MULTIPLIER = 2;
const BACKOFF_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_MAX_EVENTS = 50;
```

## Styles & Design Tokens

Not applicable — this is a pure logic hook with no UI rendering.

## Test Requirements

- [ ] Hook returns `status: 'disconnected'` as the initial state before connection opens
- [ ] After `EventSource.onopen` fires, `status` transitions to `'connected'`
- [ ] After `EventSource.onerror` fires, `status` transitions to `'reconnecting'`
- [ ] After max reconnect attempts (10) are exhausted, `status` transitions to `'disconnected'`
- [ ] Calling `reconnect()` closes the current EventSource and creates a new one immediately
- [ ] Calling `reconnect()` resets the backoff counter
- [ ] `events` array contains parsed `SSEEvent` objects in newest-first order
- [ ] `events` array never exceeds `maxEvents` length (default 50)
- [ ] `lastEventTime` updates to a `Date` object after each received event
- [ ] `lastEventTime` is `null` before any event is received
- [ ] EventSource is closed on component unmount
- [ ] Reconnection timeout is cleared on component unmount
- [ ] No state updates occur after unmount (mounted guard)
- [ ] `onEvent` callback is called for every parsed event
- [ ] `onOpen` callback is called when connection opens
- [ ] `onError` callback is called on EventSource error
- [ ] JSON parse errors in event data are caught and logged, not thrown

## Acceptance Criteria

- [ ] `ui/hooks/use-sse.ts` exists and exports `useSSE` function
- [ ] `ui/types/events.ts` exports `SSEConnectionStatus` type
- [ ] `useSSE` accepts `UseSSEOptions` with `url`, `onEvent`, `onError`, `onOpen`, `maxEvents`
- [ ] `useSSE` returns `{ status, events, reconnect, lastEventTime }` matching `UseSSEReturn`
- [ ] `status` is one of `'connected'`, `'reconnecting'`, `'disconnected'`
- [ ] `EventSource` connects to the provided `url` parameter
- [ ] Named event listeners are registered for all five SSE event types: `connected`, `state_change`, `project_added`, `project_removed`, `heartbeat`
- [ ] Events are parsed from `MessageEvent.data` JSON into typed `SSEEvent` objects
- [ ] Auto-reconnection uses exponential backoff (1s → 2s → 4s → ... → 30s cap)
- [ ] After 10 failed reconnect attempts, status becomes `'disconnected'` (stops retrying)
- [ ] `reconnect()` tears down the existing EventSource and creates a new one immediately
- [ ] `EventSource.close()` is called in the `useEffect` cleanup (unmount)
- [ ] Pending reconnection timeouts are cleared on unmount
- [ ] A `mountedRef` (or equivalent) prevents state updates after unmount
- [ ] `events` buffer is capped at `maxEvents` (default 50)
- [ ] `lastEventTime` is a `Date` or `null`
- [ ] File uses `"use client"` directive
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT import from or reference any Architecture, Design, PRD, or Master Plan documents
- Do NOT create any React components — this is a hook-only task
- Do NOT modify `ui/app/api/events/route.ts` — the server endpoint is complete
- Do NOT modify `ui/hooks/use-projects.ts` — SSE integration into useProjects is T03's scope
- Do NOT add any npm dependencies — `EventSource` is a browser native API
- Do NOT store `NormalizedProjectState` objects in this hook — state management is T03's scope
- Do NOT use `es.onmessage` — use `es.addEventListener(eventType, ...)` for named events
- Place the hook at `ui/hooks/use-sse.ts` (NOT `ui/lib/hooks/`) — this is the canonical hooks directory
