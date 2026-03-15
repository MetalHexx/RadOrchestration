---
project: "MONITORING-UI"
phase: 1
task: 3
title: "Infrastructure Utilities"
status: "pending"
skills_required: ["typescript", "node"]
skills_optional: []
estimated_files: 5
---

# Infrastructure Utilities

## Objective

Implement the four infrastructure modules (`path-resolver.ts`, `yaml-parser.ts`, `fs-reader.ts`, `markdown-parser.ts`) that handle all filesystem interaction, path resolution, YAML parsing, and markdown frontmatter extraction. Also update the existing `utils.ts` entry to serve as the canonical `cn()` utility. These modules form the foundation all API routes and server components depend on.

## Context

The `/ui` directory is a Next.js 14 App Router project with TypeScript, Tailwind CSS v4, and shadcn/ui already scaffolded (T01). All TypeScript type definitions exist in `ui/types/` (T02). The `yaml` (v2) and `gray-matter` (v4) npm packages are already installed in `ui/package.json`. The `@/*` path alias maps to `ui/*` via tsconfig. The workspace root is provided via the `WORKSPACE_ROOT` environment variable set in `ui/.env.local`. The `ui/lib/utils.ts` file already exists and exports the `cn()` utility — it must not be modified or overwritten.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/lib/path-resolver.ts` | Workspace root resolution and path construction |
| CREATE | `ui/lib/yaml-parser.ts` | Generic YAML parsing wrapper using `yaml` npm package |
| CREATE | `ui/lib/fs-reader.ts` | Read-only filesystem utilities for state, config, documents, project discovery |
| CREATE | `ui/lib/markdown-parser.ts` | Frontmatter extraction and markdown body splitting using `gray-matter` |

## Implementation Steps

1. **Create `ui/lib/path-resolver.ts`** — Implement four exported functions: `getWorkspaceRoot()`, `resolveBasePath()`, `resolveProjectDir()`, `resolveDocPath()`. Use Node.js `path.resolve()` and `path.join()` for all path construction. `getWorkspaceRoot()` reads `process.env.WORKSPACE_ROOT` and throws an `Error` with a clear message if the variable is not set. All functions are synchronous — no async needed.

2. **Create `ui/lib/yaml-parser.ts`** — Implement one generic exported function: `parseYaml<T>(content: string): T`. Import `parse` from the `yaml` npm package (v2). Call `parse(content)` and cast the result to `T`. This is a thin wrapper — no error handling beyond what `yaml.parse` provides natively.

3. **Create `ui/lib/fs-reader.ts`** — Implement five exported async functions. Import `fs/promises` for `readFile`, `readdir`, `stat`. Import types from `@/types/state`, `@/types/config`, `@/types/components`. Import `getWorkspaceRoot`, `resolveBasePath`, `resolveProjectDir`, `resolveDocPath` from `@/lib/path-resolver`. Import `parseYaml` from `@/lib/yaml-parser`. Each function follows the contract below. Use `readFile` with `'utf-8'` encoding. Use `JSON.parse` for state.json. Use `parseYaml<OrchestrationConfig>` for orchestration.yml. Wrap stat/readFile in try/catch for existence checks.

4. **Create `ui/lib/markdown-parser.ts`** — Implement one exported function: `parseDocument(raw: string): ParsedDocument`. Import `matter` from `gray-matter`. Call `matter(raw)` to extract frontmatter and content. Return `{ frontmatter: result.data as DocumentFrontmatter, content: result.content }`. The function is synchronous.

5. **Verify TypeScript compilation** — Run `npx tsc --noEmit` from the `ui/` directory. Fix any type errors.

6. **Verify build** — Run `npm run build` from the `ui/` directory to confirm the production build succeeds.

## Contracts & Interfaces

### Path Resolver — `ui/lib/path-resolver.ts`

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

### YAML Parser — `ui/lib/yaml-parser.ts`

```typescript
import { parse } from 'yaml';

/**
 * Parse a YAML string into a typed object.
 *
 * @param content - Raw YAML string
 * @returns Parsed object cast to type T
 */
export function parseYaml<T>(content: string): T {
  return parse(content) as T;
}
```

### Filesystem Reader — `ui/lib/fs-reader.ts`

```typescript
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { RawStateJson } from '@/types/state';
import type { OrchestrationConfig } from '@/types/config';
import type { ProjectSummary } from '@/types/components';
import type { PipelineTier } from '@/types/state';

import { resolveBasePath, resolveProjectDir } from '@/lib/path-resolver';
import { parseYaml } from '@/lib/yaml-parser';

/**
 * Read and parse orchestration.yml from the workspace root.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Parsed OrchestrationConfig
 * @throws If orchestration.yml does not exist or is invalid YAML
 */
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig> {
  const configPath = path.join(workspaceRoot, '.github', 'orchestration.yml');
  const content = await readFile(configPath, 'utf-8');
  return parseYaml<OrchestrationConfig>(content);
}

/**
 * Discover all projects under the base path. Returns summaries with tier info.
 * Each subdirectory under basePath is treated as a project.
 * If state.json exists and is parseable, extract the pipeline tier.
 * If state.json is missing, mark hasState: false.
 * If state.json is malformed, mark hasMalformedState: true with errorMessage.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Relative base path (e.g., ".github/projects")
 * @returns Array of ProjectSummary objects
 */
export async function discoverProjects(
  workspaceRoot: string,
  basePath: string
): Promise<ProjectSummary[]> {
  const absBasePath = resolveBasePath(workspaceRoot, basePath);
  const entries = await readdir(absBasePath, { withFileTypes: true });
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectName = entry.name;
    const projectDir = resolveProjectDir(workspaceRoot, basePath, projectName);
    const statePath = path.join(projectDir, 'state.json');

    try {
      const raw = await readFile(statePath, 'utf-8');
      const state: RawStateJson = JSON.parse(raw);
      projects.push({
        name: projectName,
        tier: state.pipeline.current_tier as PipelineTier,
        hasState: true,
        hasMalformedState: false,
        brainstormingDoc: state.project.brainstorming_doc ?? null,
      });
    } catch (err) {
      // Determine if the file is missing or malformed
      const isNotFound =
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'ENOENT';

      if (isNotFound) {
        projects.push({
          name: projectName,
          tier: 'not_initialized',
          hasState: false,
          hasMalformedState: false,
        });
      } else {
        projects.push({
          name: projectName,
          tier: 'not_initialized',
          hasState: true,
          hasMalformedState: true,
          errorMessage:
            err instanceof Error ? err.message : 'Unknown parse error',
        });
      }
    }
  }

  return projects;
}

/**
 * Read and parse a project's state.json. Returns null if file does not exist.
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Parsed RawStateJson, or null if state.json does not exist
 * @throws If state.json exists but is malformed JSON
 */
export async function readProjectState(
  projectDir: string
): Promise<RawStateJson | null> {
  const statePath = path.join(projectDir, 'state.json');
  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as RawStateJson;
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) return null;
    throw err;
  }
}

/**
 * Read a document file and return its raw content.
 *
 * @param absolutePath - Absolute filesystem path to the document
 * @returns Raw file content as a string
 * @throws If file does not exist
 */
export async function readDocument(absolutePath: string): Promise<string> {
  return readFile(absolutePath, 'utf-8');
}

/**
 * Check if a file exists at the given absolute path.
 *
 * @param absolutePath - Absolute filesystem path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}
```

### Markdown Parser — `ui/lib/markdown-parser.ts`

```typescript
import matter from 'gray-matter';
import type { DocumentFrontmatter } from '@/types/components';

interface ParsedDocument {
  frontmatter: DocumentFrontmatter;
  content: string;  // Markdown body with frontmatter stripped
}

/**
 * Parse a markdown document, extracting YAML frontmatter and the body.
 *
 * @param raw - Raw markdown string (may or may not include frontmatter)
 * @returns Object with extracted frontmatter and markdown body content
 */
export function parseDocument(raw: string): ParsedDocument {
  const result = matter(raw);
  return {
    frontmatter: result.data as DocumentFrontmatter,
    content: result.content,
  };
}
```

### Existing Utility — `ui/lib/utils.ts` (DO NOT MODIFY)

```typescript
// Already exists — included here for reference only
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Type Imports Reference

All modules must import types from `@/types/*`. Here is the complete list of types used by infrastructure modules:

```typescript
// From @/types/state
import type { RawStateJson, PipelineTier } from '@/types/state';

// From @/types/config
import type { OrchestrationConfig } from '@/types/config';

// From @/types/components
import type { ProjectSummary, DocumentFrontmatter } from '@/types/components';
```

## Styles & Design Tokens

Not applicable — infrastructure modules have no UI rendering. No design tokens needed.

## Test Requirements

- [ ] `npx tsc --noEmit` passes with zero TypeScript errors from the `ui/` directory
- [ ] `npm run build` succeeds with zero errors from the `ui/` directory
- [ ] `getWorkspaceRoot()` throws an `Error` when `WORKSPACE_ROOT` is not set (verify by temporarily unsetting the env var)
- [ ] `getWorkspaceRoot()` returns the value of `WORKSPACE_ROOT` when it is set
- [ ] `resolveBasePath('/workspace', '.github/projects')` returns `/workspace/.github/projects` (or platform equivalent)
- [ ] `resolveProjectDir('/workspace', '.github/projects', 'VALIDATOR')` returns `/workspace/.github/projects/VALIDATOR`
- [ ] `resolveDocPath('/workspace', '.github/projects', 'VALIDATOR', 'tasks/V-TASK-P01-T01.md')` returns `/workspace/.github/projects/VALIDATOR/tasks/V-TASK-P01-T01.md`
- [ ] `parseYaml<T>()` correctly parses a valid YAML string into a typed object
- [ ] `readConfig()` reads and parses `orchestration.yml` from the workspace root and returns an `OrchestrationConfig` object
- [ ] `discoverProjects()` returns a `ProjectSummary[]` with correct `hasState`, `hasMalformedState`, and `tier` values for real workspace projects
- [ ] `readProjectState()` returns parsed `RawStateJson` for a project with valid `state.json`
- [ ] `readProjectState()` returns `null` for a project directory without `state.json`
- [ ] `readDocument()` reads a file and returns its content as a string
- [ ] `fileExists()` returns `true` for an existing file and `false` for a non-existent path
- [ ] `parseDocument()` extracts frontmatter and body from a markdown string with YAML frontmatter
- [ ] `parseDocument()` returns empty frontmatter object and full content for a markdown string without frontmatter

## Acceptance Criteria

- [ ] `path-resolver.ts` exports `getWorkspaceRoot()`, `resolveBasePath()`, `resolveProjectDir()`, `resolveDocPath()` — throws on missing `WORKSPACE_ROOT`
- [ ] `yaml-parser.ts` exports `parseYaml<T>()` using the `yaml` npm package
- [ ] `fs-reader.ts` exports `readConfig()`, `discoverProjects()`, `readProjectState()`, `readDocument()`, `fileExists()` — all read-only operations
- [ ] `markdown-parser.ts` exports `parseDocument()` returning `{ frontmatter, content }` using `gray-matter`
- [ ] `utils.ts` already exports `cn()` utility (clsx + tailwind-merge) — verified, not modified
- [ ] All modules import types from `@/types/*` — no inline type definitions duplicating domain types
- [ ] No `writeFile`, `unlink`, `rename`, `rmdir`, `mkdir`, or any write filesystem operations exist in any created file
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors from `npm run lint`

## Constraints

- **Do NOT modify `ui/lib/utils.ts`** — it already exists with the correct `cn()` export from T01
- **Do NOT create any write filesystem operations** — no `writeFile`, `unlink`, `rename`, `rmdir`, `mkdir`, `copyFile`, or equivalent. All modules are strictly read-only.
- **Do NOT inline type definitions** that already exist in `ui/types/*` — always import them
- **Do NOT install additional npm packages** — `yaml` (v2) and `gray-matter` (v4) are already in `package.json`
- **Do NOT create test files** in this task — test execution is handled by the Reviewer
- **Use `node:` protocol for Node.js imports** — e.g., `import path from 'node:path'`, `import { readFile } from 'node:fs/promises'`
- **All functions must match the exact signatures** specified in the Contracts section above — same function names, same parameter names, same return types
- **Export the `ParsedDocument` interface** from `markdown-parser.ts` so downstream modules (API routes) can import it
