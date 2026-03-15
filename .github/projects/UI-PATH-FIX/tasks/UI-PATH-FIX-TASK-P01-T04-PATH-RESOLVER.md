---
project: "UI-PATH-FIX"
phase: 1
task: 4
title: "UI Path Resolver Prefix Stripping"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 1
---

# UI Path Resolver Prefix Stripping

## Objective

Modify the `resolveDocPath` function in the UI path resolver to detect and strip workspace-relative path prefixes (e.g., `.github/projects/PROJ/`) so that both workspace-relative and project-relative document paths resolve to the correct absolute filesystem path.

## Context

The pipeline stores document paths in `state.json` in workspace-relative format (e.g., `.github/projects/PROJ/tasks/FILE.md`). The UI's `resolveDocPath` joins `workspaceRoot + basePath + projectName + relativePath`, which doubles the prefix when given a workspace-relative path, producing a non-existent path and a 404 error. The fix detects the redundant prefix and strips it before joining. Manually bootstrapped projects already use project-relative paths — those must continue to work unchanged. The function's signature does not change.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/lib/path-resolver.ts` | Add prefix detection and stripping logic to `resolveDocPath` |

## Current File Content

The complete current content of `ui/lib/path-resolver.ts`:

```typescript
import path from 'node:path';

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

/**
 * Resolve the absolute path to the projects base directory.
 * Combines workspace root with the base_path from orchestration.yml.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Relative base path from orchestration.yml (e.g., ".github/projects")
 * @returns Absolute path to the projects base directory
 */
export function resolveBasePath(workspaceRoot: string, basePath: string): string {
  return path.resolve(workspaceRoot, basePath);
}

/**
 * Resolve a project directory path.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Relative base path from orchestration.yml
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

/**
 * Resolve a document path relative to its project directory.
 * Document paths in state.json are relative to the project folder.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Relative base path from orchestration.yml
 * @param projectName - Project name
 * @param relativePath - Document path relative to project dir (e.g., "tasks/MONITORING-UI-TASK-P01-T01.md")
 * @returns Absolute filesystem path
 *
 * Example: resolveDocPath('/workspace', '.github/projects', 'VALIDATOR', 'tasks/VALIDATOR-TASK-P01-T01.md')
 *        → '/workspace/.github/projects/VALIDATOR/tasks/VALIDATOR-TASK-P01-T01.md'
 */
export function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string {
  return path.resolve(workspaceRoot, basePath, projectName, relativePath);
}
```

## API Route (Consumer — DO NOT MODIFY)

The document API route at `ui/app/api/projects/[name]/document/route.ts` calls `resolveDocPath` and applies traversal protections. This file must NOT be modified. It is included here for context only:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot, resolveDocPath, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readDocument } from '@/lib/fs-reader';
import { parseDocument } from '@/lib/markdown-parser';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const pathParam = request.nextUrl.searchParams.get('path');

  if (!pathParam) {
    return NextResponse.json(
      { error: 'Missing required query parameter: path' },
      { status: 400 }
    );
  }

  // Reject paths containing ".." to prevent path traversal attempts
  if (pathParam.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
    const absPath = resolveDocPath(root, config.projects.base_path, params.name, pathParam);

    // Defense-in-depth: verify resolved path stays within the project directory
    if (!absPath.startsWith(projectDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }
    const raw = await readDocument(absPath);
    const { frontmatter, content } = parseDocument(raw);

    return NextResponse.json({ frontmatter, content, filePath: absPath }, { status: 200 });
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';

    if (isNotFound) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Key traversal protections in the API route (these remain intact and are NOT modified by this task):
1. `pathParam.includes('..')` — rejects any path containing `..`
2. `absPath.startsWith(projectDir)` — verifies the resolved absolute path stays within the project directory

## Implementation Steps

1. Open `ui/lib/path-resolver.ts` and locate the `resolveDocPath` function.

2. Inside `resolveDocPath`, before the `path.resolve` call, construct the workspace-relative prefix:
   ```typescript
   const prefix = basePath + '/' + projectName + '/';
   ```

3. Normalize backslashes to forward slashes in both `prefix` and `relativePath` to handle Windows paths:
   ```typescript
   const normalizedPrefix = prefix.replace(/\\/g, '/');
   const normalizedRelPath = relativePath.replace(/\\/g, '/');
   ```

4. Check if `normalizedRelPath` starts with `normalizedPrefix`. If it does, strip the prefix:
   ```typescript
   const strippedPath = normalizedRelPath.startsWith(normalizedPrefix)
     ? normalizedRelPath.slice(normalizedPrefix.length)
     : relativePath;
   ```

5. Use `strippedPath` instead of `relativePath` in the existing `path.resolve` call:
   ```typescript
   return path.resolve(workspaceRoot, basePath, projectName, strippedPath);
   ```

6. Verify the function signature remains unchanged — same four parameters, same return type.

7. Verify no other functions in the file are modified (`getWorkspaceRoot`, `resolveBasePath`, `resolveProjectDir` are untouched).

8. Confirm there are no TypeScript compilation errors by running the TypeScript compiler.

## Contracts & Interfaces

### `resolveDocPath` — Updated Behavior (signature unchanged)

```typescript
// ui/lib/path-resolver.ts
export function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string;
```

**Prefix stripping behavior:**

```
1. Construct prefix = basePath + '/' + projectName + '/'
2. Normalize slashes in both prefix and relativePath (replace \ with /)
3. If normalizedRelativePath starts with normalizedPrefix: strip prefix
4. Proceed with path.resolve(workspaceRoot, basePath, projectName, strippedPath)
```

**Behavior table:**

| Input `relativePath` | Prefix Match | Effective path after stripping | Resolved output |
|---------------------|-------------|-------------------------------|----------------|
| `tasks/FILE.md` | No | `tasks/FILE.md` | `{root}/.github/projects/PROJ/tasks/FILE.md` |
| `.github/projects/PROJ/tasks/FILE.md` | Yes → strip | `tasks/FILE.md` | `{root}/.github/projects/PROJ/tasks/FILE.md` |
| `PROJ-PRD.md` | No | `PROJ-PRD.md` | `{root}/.github/projects/PROJ/PROJ-PRD.md` |
| `.github/projects/PROJ/PROJ-PRD.md` | Yes → strip | `PROJ-PRD.md` | `{root}/.github/projects/PROJ/PROJ-PRD.md` |
| `.github\\projects\\PROJ\\tasks\\FILE.md` | Yes (after slash normalization) → strip | `tasks/FILE.md` | `{root}/.github/projects/PROJ/tasks/FILE.md` |

**Idempotency**: Stripping an already project-relative path is a no-op — `tasks/FILE.md` does not start with `.github/projects/PROJ/`, so it passes through unchanged.

**Security**: The prefix-stripping occurs before `path.resolve`. The API route's traversal guards (`..` rejection and `absPath.startsWith(projectDir)`) still validate the final resolved path. Stripping a known-safe prefix cannot produce paths that escape the project directory.

## Styles & Design Tokens

Not applicable — this task modifies a server-side utility function with no UI or visual output.

## Test Requirements

- [ ] Workspace-relative path `resolveDocPath('/ws', '.github/projects', 'PROJ', '.github/projects/PROJ/tasks/FILE.md')` returns `/ws/.github/projects/PROJ/tasks/FILE.md` (not a doubled path)
- [ ] Project-relative path `resolveDocPath('/ws', '.github/projects', 'PROJ', 'tasks/FILE.md')` returns `/ws/.github/projects/PROJ/tasks/FILE.md` (unchanged behavior)
- [ ] Root-level file `resolveDocPath('/ws', '.github/projects', 'PROJ', 'PROJ-PRD.md')` returns `/ws/.github/projects/PROJ/PROJ-PRD.md` (unchanged behavior)
- [ ] Workspace-relative root-level file `resolveDocPath('/ws', '.github/projects', 'PROJ', '.github/projects/PROJ/PROJ-PRD.md')` returns `/ws/.github/projects/PROJ/PROJ-PRD.md`
- [ ] Windows backslash path `resolveDocPath('/ws', '.github/projects', 'PROJ', '.github\\projects\\PROJ\\tasks\\FILE.md')` resolves correctly after slash normalization
- [ ] Idempotent — calling with an already-stripped project-relative path produces the same result as the current implementation
- [ ] TypeScript compilation succeeds with no errors

## Acceptance Criteria

- [ ] Workspace-relative paths (e.g., `.github/projects/PROJ/tasks/FILE.md`) resolve to the correct absolute path without prefix doubling
- [ ] Project-relative paths (e.g., `tasks/FILE.md`) continue to resolve correctly — zero regression
- [ ] Root-level project files (e.g., `PROJ-PRD.md`) continue to resolve correctly
- [ ] Backslash-containing paths on Windows are handled via slash normalization before prefix comparison
- [ ] Prefix stripping is idempotent — applying it to an already-stripped path is a no-op
- [ ] No TypeScript compilation errors
- [ ] Existing `..` traversal protections in `ui/app/api/projects/[name]/document/route.ts` are preserved (file is not modified)
- [ ] The `resolveDocPath` function signature is unchanged (same four parameters, same return type)
- [ ] No other functions in `path-resolver.ts` are modified

## Constraints

- Do NOT modify `ui/app/api/projects/[name]/document/route.ts` — the traversal protections in this route must remain exactly as they are
- Do NOT modify `getWorkspaceRoot`, `resolveBasePath`, or `resolveProjectDir` functions in `path-resolver.ts`
- Do NOT change the `resolveDocPath` function signature or its export
- Do NOT hardcode `.github/projects` — use the `basePath` parameter for prefix construction
- Do NOT add new dependencies or imports beyond what already exists in the file (`path` from `node:path`)
- Do NOT add any path traversal logic (e.g., `..` handling) to `resolveDocPath` — that concern is handled by the API route
