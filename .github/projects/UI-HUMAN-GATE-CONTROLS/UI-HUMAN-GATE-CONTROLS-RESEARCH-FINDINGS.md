---
project: "UI-HUMAN-GATE-CONTROLS"
author: "research-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Research Findings

## Research Scope

Investigated the pipeline script CLI, state.json schemas, existing API routes, dashboard components, type definitions, SSE mechanics, and available UI primitives to provide complete technical context for implementing dashboard-based gate approval controls.

---

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Pipeline entry point | `.github/orchestration/scripts/pipeline.js` | CLI the gate API will invoke via execFile |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | Defines `request_plan_approval` / `request_final_approval` logic |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | `handlePlanApproved`, `handleFinalApproved` — what each event mutates |
| Pre-reads | `.github/orchestration/scripts/lib/pre-reads.js` | `plan_approved` pre-read auto-derives master plan path and reads `total_phases` |
| Constants | `.github/orchestration/scripts/lib/constants.js` | `NEXT_ACTIONS` enum — values `request_plan_approval`, `request_final_approval` |
| State types | `ui/types/state.ts` | `NormalizedProjectState`, `NormalizedFinalReview`, `NormalizedPlanning`, `RawStateJson` |
| Component types | `ui/types/components.ts` | `ProjectSummary`, `GateEntry` |
| Event types | `ui/types/events.ts` | `SSEEvent`, `SSEEventType`, `SSEPayloadMap` |
| Normalizer | `ui/lib/normalizer.ts` | Maps raw state.json to normalized form; has v3 final_review gap (see Constraints) |
| Path resolver | `ui/lib/path-resolver.ts` | `getWorkspaceRoot()`, `resolveProjectDir()` used by all API routes |
| Main dashboard | `ui/components/layout/main-dashboard.tsx` | Composes sections; passes props; does NOT pass projectName to sections |
| PlanningSection | `ui/components/dashboard/planning-section.tsx` | Approve Plan button goes here |
| FinalReviewSection | `ui/components/dashboard/final-review-section.tsx` | Approve Final Review button goes here |
| Sheet component | `ui/components/ui/sheet.tsx` | Uses `@base-ui/react/dialog`; only side-panel dialog currently available |
| Button component | `ui/components/ui/button.tsx` | Variants: default, outline, secondary, ghost, destructive |
| useProjects hook | `ui/hooks/use-projects.ts` | Handles SSE `state_change` to auto-update `projectState` |
| SSE route | `ui/app/api/events/route.ts` | Chokidar watcher; emits `state_change` on state.json write |
| State API route | `ui/app/api/projects/[name]/state/route.ts` | Returns normalized state; error format reference |
| Gate route (empty) | `ui/app/api/projects/[name]/gate/` | **Folder exists, no route.ts** — the new endpoint goes here |

---

## Section 1: Pipeline Script CLI Interface

### Invocation

```
node pipeline.js --event <event> --project-dir <abs-path> [--context <json>] [--config <path>]
```

- `--event` and `--project-dir` are required; others optional.
- `--context` is a JSON string with event-specific payload.
- Use `process.execPath` (the running Node binary) to avoid PATH issues from the Next.js server process.

### Output Format

```json
{
  "success": true,
  "action": "spawn_research",
  "context": {},
  "mutations_applied": ["Set planning.human_approved to true"]
}
```

- JSON written to **stdout** (2-space indented).
- **Exit code 0** = success; **exit code 1** = failure.
- On failure: `{ success: false, action: null, context: { error: "...", violations?: [] } }`.
- Fatal argument errors write to **stderr** and exit 1.

### `plan_approved` Event

| Property | Detail |
|----------|--------|
| `--context` required | No — `doc_path` is auto-derived from `state.planning.steps[4].doc_path` |
| Pre-read | Reads master plan frontmatter; extracts `total_phases` (must be positive integer) |
| Failure cases | `state.json` unreadable, `steps[4].doc_path` not set, `total_phases` missing or invalid |
| State mutations | `planning.human_approved = true`, scaffold `execution.phases[]`, `execution.current_tier = 'execution'`, `execution.total_phases = N` |
| Invocation | `pipeline.js --event plan_approved --project-dir <abs-path>` |

### `final_approved` Event

| Property | Detail |
|----------|--------|
| `--context` required | No |
| Pre-read | None |
| State mutations | `execution.final_review_approved = true`, `execution.current_tier = 'complete'` |
| Invocation | `pipeline.js --event final_approved --project-dir <abs-path>` |

---

## Section 2: State.json Structure

### Schema (v3 example — planning complete, awaiting approval)

```json
{
  "$schema": "orchestration-state-v3",
  "project": { "name": "MY-PROJECT", "created": "...", "updated": "..." },
  "planning": {
    "status": "complete",
    "human_approved": false,
    "steps": [
      { "name": "research",     "status": "complete", "doc_path": "..." },
      { "name": "prd",          "status": "complete", "doc_path": "..." },
      { "name": "design",       "status": "complete", "doc_path": "..." },
      { "name": "architecture", "status": "complete", "doc_path": "..." },
      { "name": "master_plan",  "status": "complete", "doc_path": "..." }
    ],
    "current_step": "research"
  },
  "execution": {
    "status": "not_started",
    "current_tier": "planning",
    "current_phase": 0,
    "total_phases": 0,
    "phases": []
  }
}
```

### `next_action` — NOT Stored in State.json

`next_action` is computed on demand by `resolveNextAction(state, config)` in the pipeline engine. The value is **only returned by the pipeline script's stdout**, not persisted anywhere. The UI must derive button visibility from state fields directly.

### Gate Pending Conditions (Equivalent to Resolver Logic)

| Gate | State Condition | Resolver Action |
|------|----------------|-----------------|
| Plan approval | `planning.status === 'complete'` AND `planning.human_approved === false` | `request_plan_approval` |
| Final approval | `execution.current_tier === 'review'` | `request_final_approval` |

### v3 Final Review Fields (Inside `execution`)

After `final_review_completed` and `final_approved` mutations run, v3 state stores these in `execution`:

```json
"execution": {
  "final_review_doc": ".github/projects/X/reports/FINAL-REVIEW.md",
  "final_review_status": "complete",
  "final_review_approved": true
}
```

**These are NOT in the top-level `final_review` object** — see the normalizer gap in Constraints.

### Errors Field

```json
"errors": {
  "total_retries": 0,
  "total_halts": 0,
  "active_blockers": []
}
```

Optional in v3 (normalizer defaults to zeros).

---

## Section 3: Existing API Route Patterns

### Route Summary

| Route | Method | Status |
|-------|--------|--------|
| `/api/projects` | GET | Implemented |
| `/api/projects/[name]/state` | GET | Implemented |
| `/api/projects/[name]/document` | GET | Implemented |
| `/api/projects/[name]/files` | GET | Implemented |
| `/api/config` | GET | Implemented |
| `/api/events` | GET (SSE) | Implemented |
| `/api/projects/[name]/gate` | POST | **Not implemented — folder exists, no route.ts** |

### Error Response Format (All Existing Routes)

```json
{ "error": "Human-readable message" }
```

HTTP status codes: `400` (bad params), `404` (not found), `422` (malformed state), `500` (server error).

### No `execFile` Usage Yet

**No existing API route invokes a child process.** All routes are read-only. The gate route will be the first to spawn a child process.

### Recommended Pattern for Invoking `pipeline.js`

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const pipelineScript = path.join(getWorkspaceRoot(), '.github', 'orchestration', 'scripts', 'pipeline.js');
const projectDir = resolveProjectDir(root, config.projects.base_path, projectName);

const { stdout, stderr } = await execFileAsync(
  process.execPath,
  [pipelineScript, '--event', event, '--project-dir', projectDir],
  { encoding: 'utf-8' }
);

const result = JSON.parse(stdout);
if (!result.success) {
  return NextResponse.json(
    { error: 'Pipeline rejected the event.', detail: stdout },
    { status: 409 }
  );
}
return NextResponse.json(result, { status: 200 });
```

---

## Section 4: Dashboard Components — Current Props and Interfaces

### `PlanningSection` (`ui/components/dashboard/planning-section.tsx`)

```typescript
interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null; }>;
    human_approved: boolean;
  };
  onDocClick: (path: string) => void;
}
```

- Does **not** receive `projectName` or `pipelineTier`.
- To add Approve Plan button: add `projectName: string` prop; derive visibility from `planning.status === 'complete' && !planning.human_approved`.

### `FinalReviewSection` (`ui/components/dashboard/final-review-section.tsx`)

```typescript
interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview; // { status, report_doc, human_approved }
  onDocClick: (path: string) => void;
}
```

- Does **not** receive `projectName` or `pipelineTier`.
- Currently renders "Pending Approval" text when `human_approved === false` and status !== 'not_started'.
- To add Approve Final Review button: add `projectName: string` and `pipelineTier: PipelineTier` props; derive visibility from `pipelineTier === 'review'`.

### `MainDashboard` Wiring (`ui/components/layout/main-dashboard.tsx`)

```typescript
// Current — does NOT pass projectName or pipeline.current_tier to sections:
<PlanningSection
  planning={projectState.planning}
  onDocClick={onDocClick}
/>
<FinalReviewSection
  finalReview={projectState.final_review}
  onDocClick={onDocClick}
/>
```

Both `projectState.project.name` and `projectState.pipeline.current_tier` are available in MainDashboard and can be threaded down.

---

## Section 5: Type Definitions

### Existing Types to Reuse

```typescript
// ui/types/state.ts
export interface NormalizedFinalReview {
  status: FinalReviewStatus;   // 'not_started' | 'in_progress' | 'complete' | 'failed'
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedPlanning {
  status: PlanningStatus;      // 'not_started' | 'in_progress' | 'complete'
  steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null; }>;
  human_approved: boolean;
}

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';
```

### New Types to Add

```typescript
// Whitelist of allowed gate events — prevents arbitrary event forwarding
export type GateEvent = 'plan_approved' | 'final_approved';

// POST /api/projects/[name]/gate — success response body
export interface GateApproveResponse {
  success: boolean;
  action: string;               // next_action returned by pipeline
  mutations_applied: string[];
}

// POST /api/projects/[name]/gate — error response body
export interface GateErrorResponse {
  error: string;
  detail?: string;              // raw pipeline output for collapsed debug section
}
```

---

## Section 6: `next_action` Flow Analysis

`next_action` does **not** exist in `state.json`, `NormalizedProjectState`, or any SSE payload. It is computed only when `pipeline.js` is invoked. For button visibility, state-flag derivation is recommended:

```typescript
// In PlanningSection (or MainDashboard before passing prop):
const showApprovePlan =
  planning.status === 'complete' && !planning.human_approved;

// In FinalReviewSection (using pipelineTier prop for reliability):
const showApproveFinal =
  pipelineTier === 'review';
  // Note: do NOT rely on finalReview.human_approved for v3 states
  //       until the normalizer gap is fixed (see Constraints).
```

This is mathematically equivalent to the resolver's logic for these two gates and requires no extra API call.

---

## Section 7: SSE Auto-Refresh Mechanism

### Flow After Approval

```
1. User clicks Approve → opens ConfirmDialog
2. User confirms → POST /api/projects/[name]/gate { event: 'plan_approved' }
3. API: execFile pipeline.js → pipeline writes state.json → API returns { success, action, ... }
4. Client: clears isPending, closes dialog
5. Meanwhile: chokidar detects state.json change (awaitWriteFinish: 200ms stabilityThreshold)
6. SSE: debounced 300ms → fires state_change { projectName, state: NormalizedProjectState }
7. useProjects.handleSSEEvent: matches selected project → setProjectState(payload.state)
8. Components re-render: buttons disappear, approved states show
```

### Key Numbers

| Timing | Value |
|--------|-------|
| Chokidar stabilityThreshold | 200ms |
| SSE debounce per project | 300ms |
| Expected UI update lag | ~500ms after API responds |

### `useProjects` SSE Handler (Relevant Excerpt)

```typescript
case "state_change": {
  const payload = event.payload as { projectName: string; state: NormalizedProjectState };
  if (payload.projectName === currentSelected) {
    setProjectState(payload.state);   // triggers re-render of all dashboard sections
  }
  break;
}
```

No manual polling or re-fetch required. Button `isPending` state covers the gap.

---

## Section 8: Dialog/Confirmation Patterns

### What Exists

| Component | Type | Primitive |
|-----------|------|-----------|
| `Sheet` (`ui/components/ui/sheet.tsx`) | Side-panel drawer | `@base-ui/react/dialog` |
| **No inline Dialog** | — | missing |
| **No AlertDialog** | — | missing |

### `@base-ui/react/dialog` API (Already Installed v1.2.0+)

The library exports: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`. Sheet already uses this full set. Adding a centered `dialog.tsx` component requires the same primitives in a different layout.

### Button Variants for Dialog

- **Confirm/Approve**: `variant="default"` (primary blue)
- **Cancel**: `variant="outline"`
- **Disabled/Loading**: `disabled` prop + spinner in button text

### Recommended Pattern

Add `ui/components/ui/dialog.tsx` using `@base-ui/react/dialog` with a centered backdrop modal. Then create a project-specific `ApproveGateDialog` or a generic `ConfirmDialog` component in `ui/components/dashboard/` or shared `ui/components/`.

---

## Section 9: Error Handling Patterns

### API Error Pattern (Existing Routes)

```typescript
// All routes use this:
const message = err instanceof Error ? err.message : 'Internal server error';
return NextResponse.json({ error: message }, { status: 500 });
```

### Gate API Error Strategy

```typescript
// Status mapping:
// 400 — invalid event (not 'plan_approved' or 'final_approved')
// 404 — project not found
// 409 — pipeline returned success: false (wrong pipeline state for this event)
// 500 — execFile threw (spawn failure, pipeline crash)

// Error response with debug detail:
return NextResponse.json(
  { error: 'Pipeline rejected the event.', detail: stdout },
  { status: 409 }
);
```

### Client-Side Error Display (Inline Pattern)

No global toast system exists. Established pattern: `const [error, setError] = useState<string | null>(null)` and render inline below the triggering element. For the gate error, a `<details>/<summary>` or a collapsiblr `<pre>` block can expose the raw `detail` field for debugging.

---

## Section 10: Critical Constraint — v3 Final Review Normalizer Gap

### The Problem

v3 mutations store final review data **inside `execution`** (not top-level `final_review`):

```javascript
// mutations.js
state.execution.final_review_doc = context.doc_path;      // after final_review_completed
state.execution.final_review_status = 'complete';
state.execution.final_review_approved = true;              // after final_approved
```

The current normalizer (`ui/lib/normalizer.ts`) maps:

```typescript
final_review: raw.final_review ?? { status: 'not_started', report_doc: null, human_approved: false }
```

In v3, `raw.final_review` is undefined → normalizer always returns `status: 'not_started'` even after final review completes.

### Impact on This Feature

- `FinalReviewSection` currently shows nothing (`return null`) when `finalReview.status === 'not_started'` — it will never display in v3.
- `final_review.human_approved` is always `false` in v3 → cannot use it for button visibility.

### Fix Required

Update `normalizeState()` to fall back to `execution`-embedded fields for v3:

```typescript
final_review: raw.final_review ?? {
  status: (raw.execution as any).final_review_status ?? 'not_started',
  report_doc: (raw.execution as any).final_review_doc ?? null,
  human_approved: (raw.execution as any).final_review_approved ?? false,
}
```

This fix is a prerequisite for `FinalReviewSection` to function in v3 and for the final approval button to work correctly.

---

## Constraints Discovered

- `next_action` is not stored in state; must be derived from state flags for UI button visibility.
- `pipeline.js` must be invoked using `process.execPath` — not `'node'` string — to avoid PATH failures.
- Gate API must whitelist only `plan_approved` and `final_approved`; no arbitrary event forwarding.
- No Dialog/AlertDialog component exists; must be added using `@base-ui/react/dialog` (installed, v1.2.0+).
- `PlanningSection` and `FinalReviewSection` must receive a new `projectName` prop (not currently passed).
- `FinalReviewSection` needs `pipelineTier` prop to determine final approval button visibility reliably.
- v3 normalizer does not read `execution.final_review_*` fields — fix required for `FinalReviewSection` to render and for the approve button to work (see Section 10).
- `MainDashboard` must be updated to thread `projectName` and `pipelineTier` to both sections.
- SSE debounce (~500ms total) creates a brief gap between API response and UI update — button `isPending` state must cover this.
- No auth on gate API — confirmed out of scope per brainstorming doc.

---

## Recommendations

1. **Create `POST /api/projects/[name]/gate/route.ts`** using `execFile` + `process.execPath`. Whitelist `plan_approved` / `final_approved` only. Return `{ success, action, mutations_applied }` on success; `{ error, detail }` on pipeline failure with HTTP 409.

2. **Fix the v3 final_review normalizer gap** in `ui/lib/normalizer.ts` before or alongside adding the final review approve button. Without this, `FinalReviewSection` is broken for v3 states.

3. **Add `ui/components/ui/dialog.tsx`** using `@base-ui/react/dialog` primitives following the `sheet.tsx` pattern (centered modal instead of side panel).

4. **Thread `projectName` and `pipelineTier` props** to `PlanningSection` and `FinalReviewSection` from `MainDashboard`.

5. **Derive button visibility from state flags** (no extra API calls): `planning.status === 'complete' && !planning.human_approved` for plan; `pipelineTier === 'review'` for final.

6. **In-flight state**: Local `isPending: boolean` + `error: string | null` per section. Disable button and show spinner during the API call. Show friendly error with expandable pipeline detail on failure.

7. **Gate API security**: Validate `projectName` is non-empty and contains only `[A-Z0-9_-]` characters before resolving the project directory. Path traversal is mitigated by `resolveProjectDir` but allow-listing format prevents other injection vectors.
