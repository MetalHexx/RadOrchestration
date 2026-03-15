---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
task: 4
title: "Create POST Gate Approval API Route"
status: "pending"
skills: ["run-tests"]
estimated_files: 1
---

# Create POST Gate Approval API Route

## Objective

Create `ui/app/api/projects/[name]/gate/route.ts` — a POST endpoint that validates the request (event whitelist + project name format), resolves the project directory, invokes `pipeline.js` via `execFile`, and returns structured JSON success/error responses using the gate types from `ui/types/state.ts`.

## Context

This is the first write-path API route in the dashboard — all existing routes are read-only GET endpoints. The gate folder already exists at `ui/app/api/projects/[name]/gate/` but contains no `route.ts`. The route must use `execFile` (not `exec`) to invoke `pipeline.js` as a child process, preventing shell injection. Task T01 already added `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, and `GateErrorResponse` types to `ui/types/state.ts`. The existing SSE infrastructure handles post-approval UI refresh automatically — the route only needs to return the pipeline result.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/app/api/projects/[name]/gate/route.ts` | POST endpoint — the gate folder already exists but is empty |

## Implementation Steps

1. Create `ui/app/api/projects/[name]/gate/route.ts` with the imports listed in the Contracts section below.

2. Add `export const dynamic = 'force-dynamic';` to match the existing API route convention.

3. Export an `async function POST(request, { params })` handler with the Next.js App Router signature shown in the Contracts section.

4. **Parse the request body** as JSON. Extract the `event` field. If the body cannot be parsed as JSON → HTTP 400 `{ error: "Invalid request body." }`.

5. **Validate the event whitelist**: Check that `event` is exactly `'plan_approved'` or `'final_approved'`. If not → HTTP 400:
   ```json
   { "error": "Invalid gate event. Allowed: plan_approved, final_approved." }
   ```

6. **Validate the project name format**: The `name` URL parameter (from `params`) must match `/^[A-Z0-9][A-Z0-9_-]*$/`. If not → HTTP 400:
   ```json
   { "error": "Invalid project name format." }
   ```

7. **Resolve the project directory**: Call `getWorkspaceRoot()` and `readConfig(root)` to get the base path. Call `resolveProjectDir(root, config.projects.base_path, name)`. Check that the project's `state.json` exists using `readProjectState(projectDir)`. If it returns `null` → HTTP 404:
   ```json
   { "error": "Project not found." }
   ```

8. **Resolve the pipeline script path**: `path.join(getWorkspaceRoot(), '.github', 'orchestration', 'scripts', 'pipeline.js')`.

9. **Invoke the pipeline** using `execFileAsync` (promisified `execFile`):
   ```
   process.execPath [pipelineScript, '--event', event, '--project-dir', projectDir]
   ```
   With `{ encoding: 'utf-8' }` options.

10. **Handle the pipeline result**:
    - Parse `stdout` as JSON. If JSON parsing fails → HTTP 500 `{ error: "Invalid pipeline response.", detail: stdout }`.
    - If `result.success === true` → HTTP 200 `{ success: true, action: result.action, mutations_applied: result.mutations_applied }`.
    - If `result.success === false` → HTTP 409 `{ error: "Pipeline rejected the event.", detail: stdout }`.
    - If `execFile` throws (non-zero exit, spawn failure) → HTTP 500 `{ error: "Pipeline execution failed.", detail: stderr || err.message }`. Note: `promisify(execFile)` rejects with an error object that has `stderr` and `stdout` properties when the child process exits with non-zero.

## Contracts & Interfaces

### Gate Types (from `ui/types/state.ts` — added by T01)

```typescript
// ui/types/state.ts — these types are already exported and available for import

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

### Route Handler Signature (Next.js App Router)

```typescript
// ui/app/api/projects/[name]/gate/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
): Promise<NextResponse>
```

### Required Imports

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import type { GateEvent, GateApproveResponse, GateErrorResponse } from '@/types/state';
import { getWorkspaceRoot } from '@/lib/path-resolver';
import { resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readProjectState } from '@/lib/fs-reader';
```

### `getWorkspaceRoot()` — from `ui/lib/path-resolver.ts`

```typescript
/**
 * Resolve the workspace root path from the WORKSPACE_ROOT environment variable.
 * Throws Error if WORKSPACE_ROOT is not set.
 */
export function getWorkspaceRoot(): string {
  const root = process.env.WORKSPACE_ROOT;
  if (!root) {
    throw new Error(
      'WORKSPACE_ROOT environment variable is not set. ' +
      'Set it in ui/.env.local to the absolute path of the workspace root.'
    );
  }
  return root;
}
```

### `resolveProjectDir()` — from `ui/lib/path-resolver.ts`

```typescript
/**
 * Resolve a project directory path.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Relative base path from orchestration.yml (e.g., ".github/projects")
 * @param projectName - Project name (e.g., "MONITORING-UI")
 * @returns Absolute path: {workspaceRoot}/{basePath}/{projectName}
 */
export function resolveProjectDir(
  workspaceRoot: string,
  basePath: string,
  projectName: string
): string {
  return path.resolve(workspaceRoot, basePath, projectName);
}
```

### `readConfig()` — from `ui/lib/fs-reader.ts`

```typescript
/**
 * Read and parse orchestration.yml from the workspace root.
 * Returns OrchestrationConfig with projects.base_path (e.g., ".github/projects").
 */
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig>;
```

### `readProjectState()` — from `ui/lib/fs-reader.ts`

```typescript
/**
 * Read and parse a project's state.json. Returns null if file does not exist.
 * Throws if state.json exists but is malformed JSON.
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Parsed RawStateJson, or null if state.json does not exist
 */
export async function readProjectState(projectDir: string): Promise<RawStateJson | null>;
```

### Existing API Route Pattern (Reference: `ui/app/api/projects/[name]/state/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readProjectState } from '@/lib/fs-reader';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
    const raw = await readProjectState(projectDir);

    if (raw === null) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // ... process and return
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Pipeline Invocation Pattern

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Pipeline script location:
const pipelineScript = path.join(root, '.github', 'orchestration', 'scripts', 'pipeline.js');

// Invocation (use process.execPath, NOT 'node'):
const { stdout, stderr } = await execFileAsync(
  process.execPath,
  [pipelineScript, '--event', event, '--project-dir', projectDir],
  { encoding: 'utf-8' }
);
```

### Pipeline Output Format

```json
// Success (exit code 0, result.success === true):
{
  "success": true,
  "action": "spawn_research",
  "context": {},
  "mutations_applied": ["Set planning.human_approved to true"]
}

// Rejection (exit code 0, result.success === false):
{
  "success": false,
  "action": null,
  "context": { "error": "..." }
}
```

- JSON written to **stdout** (2-space indented).
- **Exit code 0** = pipeline ran (check `success` field). **Non-zero exit** = crash/spawn failure.
- Fatal argument errors write to **stderr** and exit 1.

### HTTP Response Mapping

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| Valid event, pipeline returns `success: true` | 200 | `{ success: true, action: string, mutations_applied: string[] }` |
| Event not in whitelist | 400 | `{ error: "Invalid gate event. Allowed: plan_approved, final_approved." }` |
| Project name fails `/^[A-Z0-9][A-Z0-9_-]*$/` | 400 | `{ error: "Invalid project name format." }` |
| Invalid JSON request body | 400 | `{ error: "Invalid request body." }` |
| `readProjectState()` returns `null` | 404 | `{ error: "Project not found." }` |
| Pipeline returns `success: false` | 409 | `{ error: "Pipeline rejected the event.", detail: stdout }` |
| `execFile` throws (non-zero exit / spawn failure) | 500 | `{ error: "Pipeline execution failed.", detail: stderr \|\| err.message }` |
| `stdout` is not valid JSON | 500 | `{ error: "Invalid pipeline response.", detail: stdout }` |
| Unexpected server error | 500 | `{ error: err.message }` |

### Event Whitelist Constant

```typescript
const ALLOWED_GATE_EVENTS: ReadonlySet<string> = new Set(['plan_approved', 'final_approved']);
```

### Project Name Validation Regex

```typescript
const PROJECT_NAME_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
```

## Styles & Design Tokens

Not applicable — this is a backend API route with no UI rendering.

## Test Requirements

- [ ] Sending `POST` with `{ "event": "plan_approved" }` and a valid project name returns HTTP 200 with `{ success, action, mutations_applied }` when the pipeline succeeds
- [ ] Sending `POST` with `{ "event": "final_approved" }` and a valid project name returns HTTP 200 with `{ success, action, mutations_applied }` when the pipeline succeeds
- [ ] Sending `POST` with `{ "event": "something_else" }` returns HTTP 400 with `{ error: "Invalid gate event. Allowed: plan_approved, final_approved." }`
- [ ] Sending `POST` with an empty `event` field returns HTTP 400
- [ ] Sending `POST` to a project name containing lowercase letters (e.g., `my-project`) returns HTTP 400 with `{ error: "Invalid project name format." }`
- [ ] Sending `POST` to a project name starting with `-` returns HTTP 400
- [ ] Sending `POST` to a non-existent project returns HTTP 404 with `{ error: "Project not found." }`
- [ ] When the pipeline returns `{ success: false, ... }`, the route returns HTTP 409 with `{ error: "Pipeline rejected the event.", detail: ... }`
- [ ] When `execFile` throws (spawn failure), the route returns HTTP 500
- [ ] `execFile` is used (not `exec`) — no shell spawned
- [ ] `process.execPath` is used (not the string `'node'`)
- [ ] The route compiles without TypeScript errors

## Acceptance Criteria

- [ ] `POST /api/projects/[name]/gate` returns HTTP 200 with `{ success: true, action, mutations_applied }` for valid `plan_approved` / `final_approved` events on an eligible project
- [ ] Returns HTTP 400 for events not in the whitelist (`plan_approved`, `final_approved`)
- [ ] Returns HTTP 400 for project names not matching `/^[A-Z0-9][A-Z0-9_-]*$/`
- [ ] Returns HTTP 400 for unparseable request bodies
- [ ] Returns HTTP 404 for non-existent projects (`readProjectState` returns `null`)
- [ ] Returns HTTP 409 when pipeline returns `success: false`
- [ ] Returns HTTP 500 for spawn failures or unparseable pipeline output
- [ ] Uses `execFile` (not `exec`) — no shell spawned
- [ ] Uses `process.execPath` (not the string `'node'`)
- [ ] Imports `GateEvent`, `GateApproveResponse`, `GateErrorResponse` from `@/types/state`
- [ ] Follows the existing API route pattern (`export const dynamic = 'force-dynamic'`, `NextRequest`/`NextResponse`, try/catch error handling)
- [ ] Project compiles without type errors (`tsc --noEmit`)
- [ ] No lint errors

## Constraints

- **Do NOT use `exec`** — only `execFile` (no shell spawned, prevents shell injection)
- **Do NOT use the string `'node'`** for the executable — use `process.execPath`
- **Do NOT modify any existing files** — this task creates exactly one new file
- **Do NOT add authentication or authorization** — this is a local dev tool (confirmed out of scope)
- **Do NOT write to `state.json` directly** — the pipeline script handles all state mutations
- **Do NOT add global state, caching, or in-memory stores** — this is a stateless request handler
- **Do NOT install new npm packages** — all required packages (`next`, `node:child_process`, `node:util`, `node:path`) are already available
- **Do NOT create test files** — test requirements are verified by manual testing and type checking
