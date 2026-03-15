---
project: "MONITORING-UI"
status: "draft"
author: "architect-agent"
created: "2026-03-09T00:00:00Z"
inputs:
  prd: "MONITORING-UI-PRD.md"
  design: "MONITORING-UI-DESIGN.md"
  research: "MONITORING-UI-RESEARCH-FINDINGS.md"
  brainstorming: "MONITORING-UI-BRAINSTORMING.md"
---

# MONITORING-UI — Architecture

## Technical Overview

MONITORING-UI is a real-time, read-only Next.js 14 dashboard that visualizes orchestration pipeline state. The application lives in an isolated `/ui` directory at the workspace root, uses the App Router with TypeScript, and renders project data sourced entirely from the local filesystem. Server-Sent Events powered by chokidar file watching push state changes to the browser in real time, while Server Components handle on-demand file reads for documents and configuration. The UI layer uses shadcn/ui components with Tailwind CSS v4 for a professional developer-tooling aesthetic.

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│               Presentation Layer                            │
│  React components, pages, layouts, drawers, design tokens   │
├─────────────────────────────────────────────────────────────┤
│               Application Layer                             │
│  React hooks, SSE client, theme manager, state management   │
├─────────────────────────────────────────────────────────────┤
│               Domain Layer                                  │
│  TypeScript types, enums, state normalizer, validation      │
├─────────────────────────────────────────────────────────────┤
│               Infrastructure Layer                          │
│  Filesystem reader, chokidar watcher, YAML parser,          │
│  markdown parser, path resolver, API route handlers         │
└─────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `app-shell` | Presentation | `ui/app/` | Next.js App Router: root layout, page, loading/error boundaries |
| `sidebar` | Presentation | `ui/components/sidebar/` | Project list sidebar: `ProjectSidebar`, `ProjectListItem`, `SidebarSearch` |
| `dashboard` | Presentation | `ui/components/dashboard/` | Main dashboard sections: `ProjectHeader`, `PlanningSection`, `ExecutionSection`, `ErrorLogSection`, `FinalReviewSection`, `GateHistorySection`, `LimitsSection` |
| `phases` | Presentation | `ui/components/phases/` | Phase and task cards: `PhaseCard`, `TaskCard`, `ProgressBar` |
| `badges` | Presentation | `ui/components/badges/` | Status indicators: `PipelineTierBadge`, `StatusIcon`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge`, `ConnectionIndicator`, `LockBadge` |
| `documents` | Presentation | `ui/components/documents/` | Document viewer: `DocumentDrawer`, `DocumentMetadata`, `MarkdownRenderer`, `DocumentLink` |
| `config` | Presentation | `ui/components/config/` | Config viewer: `ConfigDrawer`, `ConfigSection` |
| `layout` | Presentation | `ui/components/layout/` | Shell components: `AppHeader`, `ThemeToggle`, `MainDashboard`, `NotInitializedView`, `MalformedStateView` |
| `planning` | Presentation | `ui/components/planning/` | Planning checklist: `PlanningChecklist`, `ErrorSummaryBanner` |
| `hooks` | Application | `ui/lib/hooks/` | React hooks: `useSSE`, `useProjects`, `useTheme`, `useDocumentDrawer`, `useConfigDrawer` |
| `types` | Domain | `ui/types/` | TypeScript type definitions: `state.ts`, `config.ts`, `events.ts`, `components.ts` |
| `normalizer` | Domain | `ui/lib/normalizer.ts` | v1 → v2 state normalization logic |
| `api-events` | Infrastructure | `ui/app/api/events/route.ts` | SSE endpoint: chokidar watcher → event stream |
| `api-projects` | Infrastructure | `ui/app/api/projects/route.ts` | Project list endpoint |
| `api-project-state` | Infrastructure | `ui/app/api/projects/[name]/state/route.ts` | Single project state endpoint |
| `api-project-doc` | Infrastructure | `ui/app/api/projects/[name]/document/route.ts` | Document content endpoint |
| `api-config` | Infrastructure | `ui/app/api/config/route.ts` | Orchestration config endpoint |
| `fs-reader` | Infrastructure | `ui/lib/fs-reader.ts` | Filesystem read utilities (state, documents, project discovery) |
| `path-resolver` | Infrastructure | `ui/lib/path-resolver.ts` | Workspace-relative path resolution |
| `yaml-parser` | Infrastructure | `ui/lib/yaml-parser.ts` | YAML parsing for orchestration.yml |
| `markdown-parser` | Infrastructure | `ui/lib/markdown-parser.ts` | Frontmatter extraction + markdown body splitting |

## Contracts & Interfaces

### Domain Types — `ui/types/state.ts`

```typescript
// ─── Enum Union Types ───────────────────────────────────────────────────────
// Ported from src/lib/constants.js frozen enum objects

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

export type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';

export type Severity = 'minor' | 'critical';

export type HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous';

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

// ─── Planning Step Names ────────────────────────────────────────────────────

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

// ─── Raw State Types (as read from disk) ────────────────────────────────────
// Supports both v1 and v2 schemas

export interface RawStateJson {
  $schema?: string;
  project: {
    name: string;
    description?: string;       // v2 only
    created: string;            // ISO 8601
    updated: string;            // ISO 8601
    brainstorming_doc?: string; // v2 only
  };
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }>;
    human_approved: boolean;
  };
  execution: {
    status: 'not_started' | 'in_progress' | 'complete' | 'halted';
    current_phase: number;
    total_phases: number;
    phases: RawPhase[];
  };
  final_review: {
    status: FinalReviewStatus;
    report_doc: string | null;
    human_approved: boolean;
  };
  errors: {
    total_retries: number;
    total_halts: number;
    active_blockers: string[];
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
  };
}

export interface RawPhase {
  phase_number: number;
  title?: string;               // v2
  name?: string;                // v1
  status: PhaseStatus;
  phase_doc?: string | null;    // v2
  plan_doc?: string | null;     // v1
  current_task: number;
  total_tasks: number;
  tasks: RawTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review?: string | null;
  phase_review_verdict?: ReviewVerdict | null;
  phase_review_action?: PhaseReviewAction | null;
}

export interface RawTask {
  task_number: number;
  title?: string;               // v2
  name?: string;                // v1
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc?: string | null;
  review_verdict?: ReviewVerdict | null;
  review_action?: TaskReviewAction | null;
}

// ─── Normalized Types (consumed by all UI components) ───────────────────────
// v1 fields are mapped to v2 field names; absent fields default to null

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}

export interface NormalizedProjectMeta {
  name: string;
  description: string | null;
  created: string;
  updated: string;
  brainstorming_doc: string | null;
}

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  human_approved: boolean;
}

export interface NormalizedExecution {
  status: 'not_started' | 'in_progress' | 'complete' | 'halted';
  current_phase: number;
  total_phases: number;
  phases: NormalizedPhase[];
}

export interface NormalizedPhase {
  phase_number: number;
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

export interface NormalizedTask {
  task_number: number;
  title: string;
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc: string | null;
  review_verdict: ReviewVerdict | null;
  review_action: TaskReviewAction | null;
}

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

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

### Domain Types — `ui/types/config.ts`

```typescript
export interface OrchestrationConfig {
  version: string;
  projects: {
    base_path: string;
    naming: string;
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
    max_consecutive_review_rejections: number;
  };
  errors: {
    severity: {
      critical: string[];
      minor: string[];
    };
    on_critical: string;
    on_minor: string;
  };
  git: {
    strategy: string;
    branch_prefix: string;
    commit_prefix: string;
    auto_commit: boolean;
  };
  human_gates: {
    after_planning: boolean;
    execution_mode: string;
    after_final_review: boolean;
  };
}

/** Grouped config for the Config Drawer display */
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

### Domain Types — `ui/types/events.ts`

```typescript
import type { NormalizedProjectState } from './state';

/** SSE event types sent from server to client */
export type SSEEventType = 'state_change' | 'project_added' | 'project_removed' | 'connected';

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
}
```

### Domain Types — `ui/types/components.ts`

```typescript
import type { PipelineTier } from './state';

/** Sidebar project entry */
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}

/** Gate history entry for the timeline */
export interface GateEntry {
  gate: string;           // e.g., "Post-Planning", "Phase 1", "Final Review"
  approved: boolean;
  timestamp?: string;     // ISO 8601 if available
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

/** API response for document content */
export interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;        // Markdown body (frontmatter stripped)
  filePath: string;       // Resolved absolute path (for display)
}
```

### State Normalizer — `ui/lib/normalizer.ts`

```typescript
import type { RawStateJson, NormalizedProjectState, RawPhase, NormalizedPhase, RawTask, NormalizedTask } from '@/types/state';

/** Normalize a raw state.json (v1 or v2) into the canonical normalized form. */
function normalizeState(raw: RawStateJson): NormalizedProjectState;

/** Normalize a raw phase object, mapping v1 field names to v2. */
function normalizePhase(raw: RawPhase): NormalizedPhase;

/** Normalize a raw task object, mapping v1 field names to v2. */
function normalizeTask(raw: RawTask): NormalizedTask;

/** Detect schema version from the $schema field. Returns 1 or 2. */
function detectSchemaVersion(raw: RawStateJson): 1 | 2;
```

### Filesystem Reader — `ui/lib/fs-reader.ts`

```typescript
import type { RawStateJson } from '@/types/state';
import type { OrchestrationConfig } from '@/types/config';
import type { ProjectSummary } from '@/types/components';

/** Read and parse orchestration.yml from the workspace root. */
function readConfig(workspaceRoot: string): Promise<OrchestrationConfig>;

/** Discover all projects under the base path. Returns summaries with tier info. */
function discoverProjects(workspaceRoot: string, basePath: string): Promise<ProjectSummary[]>;

/** Read and parse a project's state.json. Returns null if file does not exist. */
function readProjectState(projectDir: string): Promise<RawStateJson | null>;

/** Read a document file and return its raw content. Throws if file does not exist. */
function readDocument(absolutePath: string): Promise<string>;

/** Check if a file exists at the given absolute path. */
function fileExists(absolutePath: string): Promise<boolean>;
```

### Path Resolver — `ui/lib/path-resolver.ts`

```typescript
/**
 * Resolve the workspace root path from the WORKSPACE_ROOT environment variable.
 * Throws if not set.
 */
function getWorkspaceRoot(): string;

/**
 * Resolve the absolute path to the projects base directory.
 * Combines workspace root with the base_path from orchestration.yml.
 */
function resolveBasePath(workspaceRoot: string, basePath: string): string;

/**
 * Resolve a project directory path.
 * Returns: {workspaceRoot}/{basePath}/{projectName}
 */
function resolveProjectDir(workspaceRoot: string, basePath: string, projectName: string): string;

/**
 * Resolve a document path relative to its project directory.
 * Document paths in state.json are relative to the project folder.
 * Returns the absolute filesystem path.
 *
 * Example: resolveDocPath('/workspace', '.github/projects', 'VALIDATOR', 'tasks/VALIDATOR-TASK-P01-T01.md')
 *        → '/workspace/.github/projects/VALIDATOR/tasks/VALIDATOR-TASK-P01-T01.md'
 */
function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string;
```

### YAML Parser — `ui/lib/yaml-parser.ts`

```typescript
/** Parse a YAML string into a typed object. */
function parseYaml<T>(content: string): T;
```

### Markdown Parser — `ui/lib/markdown-parser.ts`

```typescript
import type { DocumentFrontmatter } from '@/types/components';

interface ParsedDocument {
  frontmatter: DocumentFrontmatter;
  content: string;  // Markdown body with frontmatter stripped
}

/** Parse a markdown document, extracting YAML frontmatter and the body. */
function parseDocument(raw: string): ParsedDocument;
```

### Config Transformer — `ui/lib/config-transformer.ts`

```typescript
import type { OrchestrationConfig, ParsedConfig } from '@/types/config';

/** Transform the raw orchestration config into the grouped display format. */
function transformConfig(raw: OrchestrationConfig): ParsedConfig;
```

### SSE Client Hook — `ui/lib/hooks/useSSE.ts`

```typescript
import type { SSEEvent, SSEEventType } from '@/types/events';

interface UseSSEOptions {
  url: string;
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseSSEReturn {
  status: ConnectionStatus;
  reconnect: () => void;
}

/** React hook that manages an EventSource connection to the SSE endpoint. */
function useSSE(options: UseSSEOptions): UseSSEReturn;
```

### Projects State Hook — `ui/lib/hooks/useProjects.ts`

```typescript
import type { ProjectSummary } from '@/types/components';
import type { NormalizedProjectState } from '@/types/state';

interface UseProjectsReturn {
  projects: ProjectSummary[];
  selectedProject: string | null;
  projectState: NormalizedProjectState | null;
  selectProject: (name: string) => void;
  isLoading: boolean;
  error: string | null;
}

/** React hook that manages the project list and selected project state. */
function useProjects(): UseProjectsReturn;
```

### Theme Hook — `ui/lib/hooks/useTheme.ts`

```typescript
type Theme = 'system' | 'dark' | 'light';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';  // Actual applied theme after system resolution
}

/** React hook that manages theme preference with localStorage persistence. */
function useTheme(): UseThemeReturn;
```

## API Endpoints

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| GET | `/api/events` | — | `text/event-stream` (SSE) | Opens an SSE connection. Server watches all `state.json` files via chokidar. Pushes `SSEEvent` objects as `data:` frames. On connect, sends a `connected` event with the project list. On file change, sends a `state_change` event with the normalized state. On new project directory, sends `project_added`. Cleans up chokidar watcher on client disconnect. |
| GET | `/api/projects` | — | `{ projects: ProjectSummary[] }` | Lists all project directories under the configured base path. Each entry includes the project name, pipeline tier (from state.json), and flags for missing/malformed state. |
| GET | `/api/projects/[name]/state` | — | `{ state: NormalizedProjectState }` or `{ error: string }` (404/422) | Returns the normalized state for a single project. Returns 404 if the project directory does not exist. Returns 422 if state.json is malformed (includes the parse error message). |
| GET | `/api/projects/[name]/document` | Query: `?path=<relative-path>` | `{ frontmatter: DocumentFrontmatter, content: string }` or `{ error: string }` (400/404) | Reads a document file relative to the project directory. Extracts frontmatter metadata and returns the markdown body separately. Returns 400 if `path` query param is missing. Returns 404 if the file does not exist on disk. |
| GET | `/api/config` | — | `{ config: ParsedConfig }` | Reads and parses `orchestration.yml` from the workspace root, transforms it into the grouped display format, and returns it. |

### SSE Event Wire Format

Each SSE frame uses the standard `text/event-stream` format:

```
event: state_change
data: {"type":"state_change","timestamp":"2026-03-09T14:30:00Z","payload":{"projectName":"VALIDATOR","state":{...}}}

event: project_added
data: {"type":"project_added","timestamp":"2026-03-09T14:31:00Z","payload":{"projectName":"NEW-PROJECT"}}

event: connected
data: {"type":"connected","timestamp":"2026-03-09T14:30:00Z","payload":{"projects":["VALIDATOR","MONITORING-UI"]}}
```

### SSE Endpoint Internal Behavior

1. On connection open: discover all projects, send `connected` event
2. Create a chokidar watcher for `{basePath}/**/state.json` (file names matching exactly `state.json`, ignoring `state.json.proposed`, `state.json.empty`, etc.)
3. On chokidar `change` event: read the changed file, normalize it, extract project name from path, send `state_change` event
4. On chokidar `add` event for a new `state.json`: send `project_added` event
5. On chokidar `unlink` event: send `project_removed` event
6. On client disconnect (`close` event on the response): call `watcher.close()` to clean up the chokidar instance
7. Debounce file change events by 300ms to prevent rapid successive pushes during active pipeline writes

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `^14` | App Router framework, server components, API route handlers, streaming response support |
| `react` | `^18` | UI component framework |
| `react-dom` | `^18` | React DOM renderer |
| `typescript` | `^5` | Type-safe development language |
| `tailwindcss` | `^4` | Utility-first CSS framework, dark mode via `class` strategy |
| `@tailwindcss/typography` | `^0.5` | `prose` classes for rendered markdown content in the document viewer |
| `chokidar` | `^3` | Cross-platform filesystem watcher for state.json change detection on the server |
| `gray-matter` | `^4` | YAML frontmatter extraction from markdown documents |
| `react-markdown` | `^9` | Markdown-to-React rendering for the document viewer |
| `remark-gfm` | `^4` | GitHub-Flavored Markdown plugin (tables, task lists, strikethrough, autolinks) |
| `rehype-sanitize` | `^6` | HTML sanitization for rendered markdown to prevent script injection (NFR-12) |
| `yaml` | `^2` | YAML parsing for `orchestration.yml` configuration |
| `lucide-react` | `^0.300` | Icon library (Lucide icons referenced in the Design document for all status indicators) |
| `class-variance-authority` | `^0.7` | Variant-based component styling (required by shadcn/ui) |
| `clsx` | `^2` | Conditional class name composition (required by shadcn/ui) |
| `tailwind-merge` | `^2` | Tailwind class conflict resolution (required by shadcn/ui) |

### shadcn/ui Components (copied into project, not installed as a package)

| Component | Source | Usage |
|-----------|--------|-------|
| `Badge` | `npx shadcn@latest add badge` | `PipelineTierBadge`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge` |
| `Card` | `npx shadcn@latest add card` | `TaskCard`, `DocumentMetadata`, section containers |
| `Sheet` | `npx shadcn@latest add sheet` | `DocumentDrawer`, `ConfigDrawer` |
| `ScrollArea` | `npx shadcn@latest add scroll-area` | Sidebar list, main dashboard, drawer content |
| `Sidebar` | `npx shadcn@latest add sidebar` | `ProjectSidebar` |
| `Accordion` | `npx shadcn@latest add accordion` | `PhaseCard` expansion, `ConfigSection` collapsibles |
| `Input` | `npx shadcn@latest add input` | `SidebarSearch` |
| `Tooltip` | `npx shadcn@latest add tooltip` | Disabled document links, timestamps |
| `Skeleton` | `npx shadcn@latest add skeleton` | Loading states |
| `ToggleGroup` | `npx shadcn@latest add toggle-group` | `ThemeToggle` |
| `Separator` | `npx shadcn@latest add separator` | Section dividers |
| `Alert` | `npx shadcn@latest add alert` | `ErrorSummaryBanner` |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | `^20` | Node.js type definitions for server-side filesystem access |
| `@types/react` | `^18` | React type definitions |
| `@types/react-dom` | `^18` | React DOM type definitions |
| `eslint` | `^8` | Linting |
| `eslint-config-next` | `^14` | Next.js ESLint configuration |

### Internal Dependencies (module → module)

```
Presentation Layer
├── sidebar → hooks/useProjects, types/components, badges
├── dashboard → hooks/useProjects, types/state, phases, badges, planning, documents
├── phases → types/state, badges, documents
├── badges → types/state
├── documents → hooks/useDocumentDrawer, types/components, markdown-parser (client-side rendering)
├── config → hooks/useConfigDrawer, types/config
├── layout → hooks/useTheme, hooks/useSSE, badges
└── planning → types/state, badges, documents

Application Layer
├── hooks/useSSE → types/events
├── hooks/useProjects → types/state, types/components
├── hooks/useTheme → (localStorage only, no module deps)
├── hooks/useDocumentDrawer → types/components
└── hooks/useConfigDrawer → types/config

Domain Layer
├── types/state → (standalone, no imports)
├── types/config → (standalone, no imports)
├── types/events → types/state
├── types/components → types/state
└── normalizer → types/state

Infrastructure Layer
├── api-events → fs-reader, path-resolver, normalizer, chokidar
├── api-projects → fs-reader, path-resolver, normalizer
├── api-project-state → fs-reader, path-resolver, normalizer
├── api-project-doc → fs-reader, path-resolver, markdown-parser
├── api-config → fs-reader, path-resolver, yaml-parser, config-transformer
├── fs-reader → path-resolver, yaml-parser
├── path-resolver → (env var only, no module deps)
├── yaml-parser → yaml (npm)
└── markdown-parser → gray-matter (npm)
```

## File Structure

```
ui/
├── .env.local                          # WORKSPACE_ROOT environment variable
├── .gitignore                          # Node modules, .next, etc.
├── next.config.ts                      # Next.js configuration
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── tailwind.config.ts                  # Tailwind CSS configuration (dark mode: 'class')
├── postcss.config.mjs                  # PostCSS configuration for Tailwind
├── components.json                     # shadcn/ui configuration
│
├── app/
│   ├── layout.tsx                      # Root layout: ThemeProvider, font loading, global styles
│   ├── page.tsx                        # Root page: AppHeader + ProjectSidebar + MainDashboard
│   ├── loading.tsx                     # Root loading skeleton
│   ├── error.tsx                       # Root error boundary
│   ├── globals.css                     # Global styles, Tailwind directives, CSS custom properties
│   │
│   └── api/
│       ├── events/
│       │   └── route.ts               # GET /api/events — SSE stream (chokidar watcher)
│       ├── projects/
│       │   ├── route.ts               # GET /api/projects — list all projects
│       │   └── [name]/
│       │       ├── state/
│       │       │   └── route.ts       # GET /api/projects/[name]/state
│       │       └── document/
│       │           └── route.ts       # GET /api/projects/[name]/document?path=...
│       └── config/
│           └── route.ts               # GET /api/config — orchestration.yml
│
├── components/
│   ├── ui/                             # shadcn/ui base components (auto-generated)
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── sheet.tsx
│   │   ├── scroll-area.tsx
│   │   ├── sidebar.tsx
│   │   ├── accordion.tsx
│   │   ├── input.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   ├── toggle-group.tsx
│   │   ├── separator.tsx
│   │   └── alert.tsx
│   │
│   ├── badges/
│   │   ├── PipelineTierBadge.tsx       # Color-coded pipeline tier indicator
│   │   ├── StatusIcon.tsx              # Status → icon + color mapping
│   │   ├── ReviewVerdictBadge.tsx      # Review outcome badge
│   │   ├── SeverityBadge.tsx           # Error severity badge
│   │   ├── RetryBadge.tsx              # Retry count pill
│   │   ├── WarningBadge.tsx            # Amber warning triangle for malformed state
│   │   ├── ConnectionIndicator.tsx     # SSE connection status dot + label
│   │   ├── LockBadge.tsx              # Lock icon for hard-default gates
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── sidebar/
│   │   ├── ProjectSidebar.tsx          # Full sidebar: header, search, list, footer
│   │   ├── ProjectListItem.tsx         # Single project row: name + tier badge
│   │   ├── SidebarSearch.tsx           # Filter input for project list
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── dashboard/
│   │   ├── ProjectHeader.tsx           # Project name, description, tier badge, timestamps
│   │   ├── PlanningSection.tsx         # Planning pipeline with checklist wrapper
│   │   ├── ExecutionSection.tsx        # Phase array with section header
│   │   ├── FinalReviewSection.tsx      # Final review status, report link, approval
│   │   ├── ErrorLogSection.tsx         # Aggregate error stats + active blockers
│   │   ├── GateHistorySection.tsx      # Timeline of human gate decisions
│   │   ├── LimitsSection.tsx           # Collapsible pipeline limits display
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── phases/
│   │   ├── PhaseCard.tsx               # Expandable phase: status, progress, task list
│   │   ├── TaskCard.tsx                # Task row: status, title, doc links, error info
│   │   ├── ProgressBar.tsx             # Horizontal task completion bar
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── planning/
│   │   ├── PlanningChecklist.tsx        # 5-step checklist + human approval row
│   │   ├── ErrorSummaryBanner.tsx       # Prominent banner when blockers are active
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── documents/
│   │   ├── DocumentDrawer.tsx          # Right-side sheet for document viewing
│   │   ├── DocumentMetadata.tsx        # Frontmatter key-value display card
│   │   ├── MarkdownRenderer.tsx        # react-markdown + remark-gfm rendering
│   │   ├── DocumentLink.tsx            # Clickable/disabled link to open documents
│   │   └── index.ts                    # Public re-exports
│   │
│   ├── config/
│   │   ├── ConfigDrawer.tsx            # Right-side sheet for config viewing
│   │   ├── ConfigSection.tsx           # Collapsible config category card
│   │   └── index.ts                    # Public re-exports
│   │
│   └── layout/
│       ├── AppHeader.tsx               # Top bar: title, connection indicator, config button, theme toggle
│       ├── ThemeToggle.tsx             # Three-way toggle: System/Dark/Light
│       ├── MainDashboard.tsx           # Container rendering all dashboard sections for selected project
│       ├── NotInitializedView.tsx      # Placeholder for projects without state.json
│       ├── MalformedStateView.tsx      # Warning view for unparseable state
│       └── index.ts                    # Public re-exports
│
├── lib/
│   ├── normalizer.ts                   # v1 → v2 state normalization
│   ├── fs-reader.ts                    # Filesystem read utilities (server-only)
│   ├── path-resolver.ts               # Workspace root + path resolution
│   ├── yaml-parser.ts                  # YAML parsing wrapper
│   ├── markdown-parser.ts             # Frontmatter extraction (gray-matter wrapper)
│   ├── config-transformer.ts          # OrchestrationConfig → ParsedConfig
│   ├── utils.ts                        # cn() helper (clsx + tailwind-merge)
│   │
│   └── hooks/
│       ├── useSSE.ts                   # SSE EventSource connection manager
│       ├── useProjects.ts              # Project list + selected project state
│       ├── useTheme.ts                 # Theme preference with localStorage
│       ├── useDocumentDrawer.ts        # Document drawer open/close + content loading
│       └── useConfigDrawer.ts          # Config drawer open/close + config loading
│
└── types/
    ├── state.ts                        # ProjectState, Phase, Task, enums (raw + normalized)
    ├── config.ts                       # OrchestrationConfig, ParsedConfig
    ├── events.ts                       # SSEEvent, SSEEventType, payloads
    └── components.ts                   # ProjectSummary, GateEntry, DocumentFrontmatter, DocumentResponse
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | All filesystem reads are wrapped in try/catch at the infrastructure layer. API routes return structured error responses (`{ error: string }`) with appropriate HTTP status codes (400, 404, 422, 500). React error boundaries at the root layout and per-section level catch rendering exceptions. The SSE client hook detects `EventSource` errors and transitions the connection indicator to "reconnecting" or "disconnected" state. Malformed `state.json` parsing errors surface as degraded `MalformedStateView` components rather than crashes. |
| **SSE reconnection** | The browser's native `EventSource` reconnection mechanism handles transient disconnections automatically. The `useSSE` hook tracks connection status (`connected`, `reconnecting`, `disconnected`), exposes a manual `reconnect()` function for the UI's retry button, and emits status changes so the `ConnectionIndicator` component updates in real time. On reconnect, the server sends a fresh `connected` event with the full project list, and the client requests full state for the selected project. |
| **Path resolution** | The workspace root is read from the `WORKSPACE_ROOT` environment variable (set in `ui/.env.local`). All paths are resolved via `path-resolver.ts`: workspace root + base path (from `orchestration.yml`) + project name + relative document path. This matches the existing pattern used by `src/triage.js` where `path.resolve(projectDir, docPath)` resolves relative document paths. The path resolver is the single source of truth — no other module constructs filesystem paths directly. |
| **State normalization** | The `normalizer.ts` module converts raw `state.json` (v1 or v2) into a single `NormalizedProjectState` type. v1 → v2 field mappings: `phase.name → phase.title`, `phase.plan_doc → phase.phase_doc`, `task.name → task.title`. Absent v2-only fields (`description`, `brainstorming_doc`, `phase_review`, `phase_review_verdict`, `phase_review_action`, `review_doc`, `review_verdict`, `review_action`) default to `null`. All UI components consume only normalized types — raw state types are never used in the Presentation or Application layers. |
| **Theme management** | Theme state is managed by the `useTheme` hook with three modes: `system`, `dark`, `light`. The resolved theme is applied via Tailwind's `class` dark mode strategy — the `<html>` element receives or loses the `dark` class. Preference is persisted to `localStorage` under the key `monitoring-ui-theme`. An inline `<script>` in the root layout reads `localStorage` before first paint to prevent flash-of-wrong-theme (FOWT). Default is `system`, which resolves `dark` as the effective theme when the OS preference is dark. |
| **Security (read-only enforcement)** | The infrastructure layer exposes only read operations (`fs.readFile`, `fs.readdir`, `fs.stat`). No write, unlink, or rename operations are imported or available. API route handlers accept only GET requests. The `chokidar` watcher is configured with `persistent: true` and no write callbacks. Rendered markdown is sanitized via `rehype-sanitize` to prevent script injection from document content (NFR-12). The server binds to `localhost` only — `next.config.ts` does not expose the app on external interfaces. |
| **Resource cleanup** | The SSE endpoint tracks the `Response` writable stream. When the client disconnects (the `close` event fires on the request), the route handler calls `watcher.close()` on the chokidar instance to release file handles and prevent memory leaks. This is critical for long-running sessions where a developer may open/close the dashboard repeatedly. |
| **File watcher filtering** | The chokidar watcher uses a glob pattern `{basePath}/**/state.json` and filters to watch only files named exactly `state.json`. Files like `state.json.proposed` and `state.json.empty` are explicitly excluded. The `awaitWriteFinish` option (`{ stabilityThreshold: 200 }`) prevents reading partially-written files during active pipeline execution. |
| **Debouncing** | File change events are debounced at 300ms per project before pushing to the SSE stream. This prevents rapid successive re-renders when the Tactical Planner writes multiple state transitions in quick succession. The debounce is keyed by project name so changes to different projects are not delayed by each other. |

## Phasing Recommendations

The following phasing is advisory — the Tactical Planner makes final phasing decisions.

### Phase 1: Project Scaffold + Data Layer

**Goal**: Working Next.js app with TypeScript types, filesystem reading, and API routes that serve real project data.

**Scope**:
- Initialize `/ui` with `create-next-app` (App Router, TypeScript, Tailwind, ESLint)
- Install all npm dependencies
- Configure shadcn/ui (`components.json`, install base components)
- Define all TypeScript types (`types/state.ts`, `types/config.ts`, `types/events.ts`, `types/components.ts`)
- Implement `lib/path-resolver.ts`, `lib/yaml-parser.ts`, `lib/fs-reader.ts`, `lib/normalizer.ts`, `lib/markdown-parser.ts`, `lib/config-transformer.ts`
- Implement all API routes: `/api/projects`, `/api/projects/[name]/state`, `/api/projects/[name]/document`, `/api/config`
- Set up `.env.local` with `WORKSPACE_ROOT`
- Root layout with `globals.css` (CSS custom properties from Design doc)

**Exit criteria**: All API routes return correct data when tested with curl/browser. Types compile without errors. Project list reflects actual workspace projects.

### Phase 2: Dashboard Components + Sidebar

**Goal**: Full static dashboard rendering — all sections display project state, sidebar navigation works, but no real-time updates yet.

**Scope**:
- Implement all badge components (`PipelineTierBadge`, `StatusIcon`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge`, `ConnectionIndicator`, `LockBadge`)
- Implement sidebar components (`ProjectSidebar`, `ProjectListItem`, `SidebarSearch`)
- Implement dashboard sections (`ProjectHeader`, `PlanningSection`, `PlanningChecklist`, `ExecutionSection`, `PhaseCard`, `TaskCard`, `ProgressBar`, `ErrorSummaryBanner`, `ErrorLogSection`, `FinalReviewSection`, `GateHistorySection`, `LimitsSection`)
- Implement layout components (`AppHeader`, `MainDashboard`, `NotInitializedView`, `MalformedStateView`)
- Implement `useProjects` hook (initial data fetch via API, no SSE yet)
- Page loads, sidebar populates, selecting a project renders its full dashboard

**Exit criteria**: Dashboard renders all sections for a project with real data. Sidebar lists all workspace projects with tier badges. Switching projects loads the correct state. Not-initialized and malformed projects display appropriate views.

### Phase 3: Real-Time Updates (SSE) + Document Viewer

**Goal**: Dashboard updates live when state changes on disk. Documents can be viewed inline.

**Scope**:
- Implement SSE endpoint (`/api/events/route.ts`) with chokidar watcher, debouncing, and cleanup
- Implement `useSSE` hook with connection status tracking and reconnection
- Wire `useSSE` into `useProjects` to update project state in real time
- Implement `ConnectionIndicator` live status in `AppHeader`
- Implement `DocumentDrawer`, `DocumentMetadata`, `MarkdownRenderer`, `DocumentLink`
- Implement `useDocumentDrawer` hook (fetch document content via API on open)
- Wire document links throughout the dashboard (planning step outputs, phase docs, task handoffs, reports, reviews)

**Exit criteria**: Changing a `state.json` file on disk causes the dashboard to update within 2 seconds without manual refresh. SSE connection status indicator reflects actual connection state. Document links open the drawer with rendered content and frontmatter metadata. Missing documents show as disabled links.

### Phase 4: Config Viewer + Theme + Polish

**Goal**: Feature-complete dashboard with config viewer, theme toggle, accessibility compliance, and error resilience.

**Scope**:
- Implement `ConfigDrawer`, `ConfigSection`, `LockBadge`
- Implement `useConfigDrawer` hook
- Implement `ThemeToggle` with `useTheme` hook, `localStorage` persistence, and inline script for flash prevention
- Add keyboard navigation: sidebar listbox, phase card expansion, drawer focus trap, skip-to-content link
- Add ARIA attributes: `role`, `aria-label`, `aria-expanded`, `aria-live`, `aria-modal`, `aria-selected`
- Add loading skeletons for sidebar and main dashboard
- Add error boundaries at section level
- Test malformed state handling, missing file handling, SSE disconnection/reconnection
- Validate WCAG 2.1 AA contrast ratios in both themes

**Exit criteria**: Config drawer displays all orchestration.yml sections with correct grouping. Theme toggle works with persistence. All interactive elements are keyboard-navigable. Screen reader labels are present on all status indicators. Error boundaries catch section-level failures without crashing the full dashboard.
