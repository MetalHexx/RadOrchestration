---
project: "MONITORING-UI"
phase: 1
task: 5
title: "API Routes"
status: "pending"
skills_required: ["nextjs", "typescript"]
skills_optional: []
estimated_files: 4
---

# API Routes

## Objective

Implement four Next.js 14 App Router API route handlers that serve project data to the frontend: project list, single project state, document content, and orchestration config. Each route is a thin wrapper that delegates to the infrastructure (`ui/lib/fs-reader.ts`, `ui/lib/path-resolver.ts`, `ui/lib/markdown-parser.ts`) and domain (`ui/lib/normalizer.ts`, `ui/lib/config-transformer.ts`) utility modules already built in previous tasks.

## Context

The `/ui` directory is a Next.js 14.2 App Router project with TypeScript and Tailwind CSS. Four infrastructure modules (`path-resolver.ts`, `yaml-parser.ts`, `fs-reader.ts`, `markdown-parser.ts`) and two domain modules (`normalizer.ts`, `config-transformer.ts`) are implemented and export the functions listed below. All TypeScript types are defined in `ui/types/`. The API routes use `NextResponse.json()` for responses. The `WORKSPACE_ROOT` environment variable is set in `ui/.env.local` and read by `getWorkspaceRoot()`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/app/api/projects/route.ts` | `GET /api/projects` — list all projects |
| CREATE | `ui/app/api/projects/[name]/state/route.ts` | `GET /api/projects/[name]/state` — single project normalized state |
| CREATE | `ui/app/api/projects/[name]/document/route.ts` | `GET /api/projects/[name]/document?path=<relative>` — document content |
| CREATE | `ui/app/api/config/route.ts` | `GET /api/config` — parsed orchestration config |

## Implementation Steps

1. **Create `ui/app/api/projects/route.ts`** — Export a single `GET` handler. Call `getWorkspaceRoot()` to get the workspace root. Call `readConfig(root)` to get the orchestration config. Call `discoverProjects(root, config.projects.base_path)` to get the project list. Return `NextResponse.json({ projects })` with status 200. Wrap everything in try/catch and return `{ error: string }` with status 500 on failure.

2. **Create `ui/app/api/projects/[name]/state/route.ts`** — Export a single `GET` handler that accepts `request: NextRequest` and `{ params }: { params: { name: string } }`. Call `getWorkspaceRoot()`, `readConfig(root)`, then `resolveProjectDir(root, config.projects.base_path, params.name)`. Call `readProjectState(projectDir)` — if it returns `null`, respond with `{ error: "Project not found" }` status 404. Otherwise, call `normalizeState(raw)` and return `{ state }` status 200. Catch `SyntaxError` separately and return `{ error: "Malformed state.json: <message>" }` status 422. All other errors return status 500.

3. **Create `ui/app/api/projects/[name]/document/route.ts`** — Export a single `GET` handler. Extract query param `path` from `request.nextUrl.searchParams.get('path')`. If missing or empty, return `{ error: "Missing required query parameter: path" }` status 400. Call `getWorkspaceRoot()`, `readConfig(root)`, then `resolveDocPath(root, config.projects.base_path, params.name, pathParam)`. Call `readDocument(absPath)` to get raw content. Call `parseDocument(raw)` to split frontmatter and body. Return `{ frontmatter, content, filePath: absPath }` status 200. On `ENOENT` error, return `{ error: "Document not found" }` status 404. All other errors return status 500.

4. **Create `ui/app/api/config/route.ts`** — Export a single `GET` handler. Call `getWorkspaceRoot()`, `readConfig(root)`, then `transformConfig(rawConfig)`. Return `{ config }` status 200. Wrap in try/catch, return `{ error: string }` status 500 on failure.

5. **Verify build** — Run `npm run build` from the `ui/` directory to confirm zero TypeScript errors and successful compilation.

6. **Verify lint** — Run `npm run lint` from the `ui/` directory to confirm zero lint errors.

## Contracts & Interfaces

### Available Infrastructure Functions — `@/lib/path-resolver`

```typescript
/** Resolve workspace root from WORKSPACE_ROOT env var. Throws if not set. */
export function getWorkspaceRoot(): string;

/** Resolve absolute path to projects base directory. */
export function resolveBasePath(workspaceRoot: string, basePath: string): string;

/** Resolve a project directory path: {workspaceRoot}/{basePath}/{projectName} */
export function resolveProjectDir(
  workspaceRoot: string,
  basePath: string,
  projectName: string
): string;

/**
 * Resolve a document path relative to project directory.
 * Example: resolveDocPath('/workspace', '.github/projects', 'VALIDATOR', 'tasks/VALIDATOR-TASK.md')
 *        → '/workspace/.github/projects/VALIDATOR/tasks/VALIDATOR-TASK.md'
 */
export function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string;
```

### Available Infrastructure Functions — `@/lib/fs-reader`

```typescript
/** Read and parse orchestration.yml from the workspace root. Throws if missing or invalid. */
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig>;

/** Discover all projects under base path. Returns summaries with tier info. */
export async function discoverProjects(
  workspaceRoot: string,
  basePath: string
): Promise<ProjectSummary[]>;

/** Read and parse a project's state.json. Returns null if file does not exist. Throws SyntaxError if malformed JSON. */
export async function readProjectState(projectDir: string): Promise<RawStateJson | null>;

/** Read a document file. Throws ENOENT if missing. */
export async function readDocument(absolutePath: string): Promise<string>;

/** Check if a file exists. */
export async function fileExists(absolutePath: string): Promise<boolean>;
```

### Available Domain Functions — `@/lib/normalizer`

```typescript
/** Normalize a raw state.json (v1 or v2) into canonical NormalizedProjectState. */
export function normalizeState(raw: RawStateJson): NormalizedProjectState;
```

### Available Domain Functions — `@/lib/config-transformer`

```typescript
/** Transform raw OrchestrationConfig into grouped ParsedConfig for display. */
export function transformConfig(raw: OrchestrationConfig): ParsedConfig;
```

### Available Infrastructure Functions — `@/lib/markdown-parser`

```typescript
export interface ParsedDocument {
  frontmatter: DocumentFrontmatter;
  content: string;  // Markdown body with frontmatter stripped
}

/** Parse a markdown document, extracting YAML frontmatter and the body. */
export function parseDocument(raw: string): ParsedDocument;
```

### Response Types — `@/types/components`

```typescript
/** Sidebar project entry — returned by GET /api/projects */
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}

/** Document frontmatter metadata */
export interface DocumentFrontmatter {
  [key: string]: unknown;
  project?: string;
  status?: string;
  author?: string;
  created?: string;
  verdict?: string;
  severity?: string;
  phase?: number;
  task?: number;
  title?: string;
}

/** API response for document content — returned by GET /api/projects/[name]/document */
export interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;        // Markdown body (frontmatter stripped)
  filePath: string;       // Resolved absolute path (for display)
}
```

### Response Types — `@/types/config`

```typescript
/** Grouped config — returned by GET /api/config */
export interface ParsedConfig {
  projectStorage: {
    basePath: string;
    naming: string;
  };
  pipelineLimits: {
    maxPhases: number;
    maxTasksPerPhase: number;
    maxRetriesPerTask: number;
    maxConsecutiveReviewRejections: number;
  };
  errorHandling: {
    critical: string[];
    minor: string[];
    onCritical: string;
    onMinor: string;
  };
  gitStrategy: {
    strategy: string;
    branchPrefix: string;
    commitPrefix: string;
    autoCommit: boolean;
  };
  humanGates: {
    afterPlanning: { value: boolean; locked: true };
    executionMode: string;
    afterFinalReview: { value: boolean; locked: true };
  };
}
```

### Response Types — `@/types/state` (key normalized types)

```typescript
export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: { current_tier: PipelineTier; human_gate_mode: HumanGateMode };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}
```

### API Route Response Contracts

| Route | Success Response (200) | Error Responses |
|-------|----------------------|-----------------|
| `GET /api/projects` | `{ projects: ProjectSummary[] }` | `500: { error: string }` |
| `GET /api/projects/[name]/state` | `{ state: NormalizedProjectState }` | `404: { error: "Project not found" }`, `422: { error: "Malformed state.json: <detail>" }`, `500: { error: string }` |
| `GET /api/projects/[name]/document` | `{ frontmatter: DocumentFrontmatter, content: string, filePath: string }` | `400: { error: "Missing required query parameter: path" }`, `404: { error: "Document not found" }`, `500: { error: string }` |
| `GET /api/config` | `{ config: ParsedConfig }` | `500: { error: string }` |

## Styles & Design Tokens

Not applicable — API routes have no UI rendering.

## Test Requirements

- [ ] `npm run build` succeeds with zero errors (routes compile and are recognized by Next.js)
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero type errors
- [ ] Each route file exports only a `GET` function (no POST, PUT, DELETE, PATCH)
- [ ] All error responses use the shape `{ error: string }` with the correct HTTP status code

## Acceptance Criteria

- [ ] `GET /api/projects` returns `{ projects: ProjectSummary[] }` reflecting actual workspace projects
- [ ] `GET /api/projects/[name]/state` returns `{ state: NormalizedProjectState }` for valid projects, 404 for missing projects, 422 for malformed state
- [ ] `GET /api/projects/[name]/document?path=<relative>` returns `{ frontmatter, content, filePath }` for valid paths, 400 for missing `path` param, 404 for missing files
- [ ] `GET /api/config` returns `{ config: ParsedConfig }` with grouped orchestration.yml data
- [ ] All routes accept only GET requests (only `GET` is exported)
- [ ] Projects without `state.json` appear in project list with `hasState: false`
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors from `npm run lint`

## Constraints

- Do NOT create test files in this task — test execution is handled by the Reviewer
- Do NOT implement the SSE `/api/events` endpoint — that is a Phase 3 task
- Do NOT add any filesystem write operations — the dashboard is strictly read-only
- Do NOT define any new types — use exclusively from `@/types/*`
- Do NOT duplicate logic already in the utility modules — routes must be thin wrappers delegating to `@/lib/*`
- Do NOT modify any existing files — all four route files are CREATE only
- Import types from `@/types/*` and utilities from `@/lib/*` using the `@/` path alias
