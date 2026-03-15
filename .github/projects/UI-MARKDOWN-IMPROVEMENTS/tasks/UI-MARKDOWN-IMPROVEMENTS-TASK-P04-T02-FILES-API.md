---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 2
title: "FILES-API"
status: "pending"
skills_required: ["Node.js", "Next.js API routes", "TypeScript"]
skills_optional: []
estimated_files: 2
---

# File Listing API and fs-reader Enhancement

## Objective

Add a `listProjectFiles` function to `ui/lib/fs-reader.ts` that recursively enumerates all `.md` files in a project directory, and create a new `GET /api/projects/[name]/files` API route that exposes this file list for error log detection and "Other Docs" discovery.

## Context

The orchestration dashboard has a filesystem reader module (`ui/lib/fs-reader.ts`) that currently reads project state, documents, and checks file existence but cannot list files. A new API endpoint is needed to return all `.md` files in a project folder so the client can pass them to `getOrderedDocs(state, projectName, allFiles)` (created in T01) for navigation ordering, error log detection, and "Other Docs" discovery. The existing `GET /api/projects/[name]/state` route demonstrates the pattern: resolve project dir via `resolveProjectDir`, handle 404/500 errors, and return JSON.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/lib/fs-reader.ts` | Add `listProjectFiles(projectDir)` export |
| CREATE | `ui/app/api/projects/[name]/files/route.ts` | New `GET` handler returning `FilesResponse` |

## Implementation Steps

1. **Add `listProjectFiles` to `ui/lib/fs-reader.ts`**: Add a new exported async function after the existing `fileExists` function. It must recursively walk the given `projectDir`, collect all files ending in `.md`, and return their paths relative to `projectDir`. Use `readdir` with `{ withFileTypes: true }` (already imported) plus `stat` (already imported) for directory traversal. Do NOT follow symlinks — check `entry.isDirectory()` only (symlinks return `false` for `isDirectory()` from `readdir` with `withFileTypes`). Use `path.relative(projectDir, fullPath)` to compute relative paths with forward slashes (normalize with `.replace(/\\/g, '/')` for Windows compatibility).

2. **Implement the recursive walk**: Create an inner async function (e.g., `walk(dir)`) that reads directory entries, recurses into subdirectories, and pushes `.md` file paths. Guard against `..` in entry names — skip any entry whose name contains `..`. This prevents symlink tricks or malformed directory entries from escaping the project directory.

3. **Create `ui/app/api/projects/[name]/files/route.ts`**: Follow the exact pattern from the existing state route. Import `getWorkspaceRoot`, `resolveProjectDir` from `@/lib/path-resolver`, `readConfig`, `listProjectFiles` from `@/lib/fs-reader`. Export `const dynamic = 'force-dynamic'`. Implement a `GET` handler that resolves the project directory from the `[name]` route param, calls `listProjectFiles`, and returns the result.

4. **Handle errors in the API route**: If `listProjectFiles` throws with `code === 'ENOENT'` (project directory doesn't exist), return `404 { error: "Project not found" }`. For all other errors, return `500 { error: message }`.

5. **Verify the project directory exists before listing**: After resolving `projectDir` via `resolveProjectDir`, call `listProjectFiles`. The ENOENT from `readdir` on a non-existent directory naturally produces the 404 case. No separate existence check needed.

## Contracts & Interfaces

### `listProjectFiles` function signature

```typescript
// ui/lib/fs-reader.ts — new export

import { readFile, readdir, stat } from 'node:fs/promises'; // already imported
import path from 'node:path'; // already imported

/**
 * Recursively list all .md files in a project directory.
 * Returns paths relative to the project directory using forward slashes.
 * Does not follow symlinks. Skips entries containing "..".
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Array of relative file paths (e.g., ["PRD.md", "tasks/TASK-P01-T01.md"])
 */
export async function listProjectFiles(projectDir: string): Promise<string[]> {
  // Implementation: recursive walk using readdir({ withFileTypes: true })
}
```

### `FilesResponse` type (already exists from T01)

```typescript
// ui/types/components.ts — already created in T01

/** Response from GET /api/projects/[name]/files */
export interface FilesResponse {
  files: string[];
}
```

### API route pattern (follow existing state route)

```typescript
// ui/app/api/projects/[name]/files/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, listProjectFiles } from '@/lib/fs-reader';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
    const files = await listProjectFiles(projectDir);

    return NextResponse.json({ files }, { status: 200 });
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';

    if (isNotFound) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Path resolver functions (existing — DO NOT modify)

```typescript
// ui/lib/path-resolver.ts — existing functions used by the API route

export function getWorkspaceRoot(): string;
  // Returns process.env.WORKSPACE_ROOT or throws

export function resolveProjectDir(
  workspaceRoot: string,
  basePath: string,
  projectName: string
): string;
  // Returns path.resolve(workspaceRoot, basePath, projectName)
```

### Current `fs-reader.ts` exports (existing — DO NOT modify these)

```typescript
// ui/lib/fs-reader.ts — existing exports to preserve

export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig>;
export async function discoverProjects(workspaceRoot: string, basePath: string): Promise<ProjectSummary[]>;
export async function readProjectState(projectDir: string): Promise<RawStateJson | null>;
export async function readDocument(absolutePath: string): Promise<string>;
export async function fileExists(absolutePath: string): Promise<boolean>;
```

## Test Requirements

- [ ] `listProjectFiles` returns `.md` files from the project root directory (e.g., `"PRD.md"`)
- [ ] `listProjectFiles` returns `.md` files from subdirectories with relative paths using forward slashes (e.g., `"tasks/TASK-P01-T01.md"`, `"phases/PHASE-01.md"`)
- [ ] `listProjectFiles` excludes non-`.md` files (e.g., `state.json`, `image.png`)
- [ ] `listProjectFiles` throws ENOENT for a non-existent directory
- [ ] `listProjectFiles` skips entries containing `..` in the name
- [ ] API route returns `200` with `{ files: string[] }` for an existing project
- [ ] API route returns `404` with `{ error: "Project not found" }` for a non-existent project name

## Acceptance Criteria

- [ ] `listProjectFiles` is exported from `ui/lib/fs-reader.ts`
- [ ] `listProjectFiles` recursively finds `.md` files in root and subdirectories (`phases/`, `tasks/`, `reports/`)
- [ ] `listProjectFiles` returns paths relative to the project directory using forward slashes
- [ ] `listProjectFiles` does not follow symlinks and does not traverse outside the project directory
- [ ] `listProjectFiles` skips directory entries containing `..`
- [ ] API route exists at `ui/app/api/projects/[name]/files/route.ts`
- [ ] API route returns `200` with `{ files: [...] }` for valid project names
- [ ] API route returns `404` for non-existent projects
- [ ] API route returns `500` on unexpected filesystem errors
- [ ] No path traversal vulnerability — only files within the project directory are listed
- [ ] All existing `fs-reader.ts` exports remain unchanged and functional
- [ ] Build succeeds (`npm run build` with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify any existing functions in `fs-reader.ts` — only add the new `listProjectFiles` export
- Do NOT modify `path-resolver.ts` — use the existing `resolveProjectDir` as-is
- Do NOT add any user-supplied path parameters to the API route — the only input is the `[name]` route segment
- Do NOT follow symlinks in the recursive directory walk
- Do NOT import or use `FilesResponse` type in the server-side code — it is a client-side type; the API route just returns `{ files }` directly
- Use the exact same error handling pattern as the existing `state/route.ts` (ENOENT → 404, other errors → 500)
- Keep `export const dynamic = 'force-dynamic'` on the API route to prevent Next.js caching
