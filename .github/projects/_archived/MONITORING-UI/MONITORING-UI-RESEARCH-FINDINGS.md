---
project: "MONITORING-UI"
author: "research-agent"
created: "2026-03-09T00:00:00Z"
---

# MONITORING-UI — Research Findings

## Research Scope

Investigated the orchestration system's data model, file conventions, existing scripts, and workspace configuration to inform the design and architecture of a real-time Next.js monitoring dashboard. Focused on: state.json schema, document types and paths, project on-disk structure, orchestration.yml configuration, and existing Node.js code patterns.

---

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| State JSON Schema | `plan/schemas/state-json-schema.md` | Defines the complete `state.json` structure the dashboard must render — every field, enum, and transition rule |
| STATUS.md Template | `plan/schemas/status-md-template.md` | Defines the human-readable status format the dashboard must replicate visually |
| orchestration.yml Schema | `plan/schemas/orchestration-yml-schema.md` | Defines the configuration structure the config viewer must display |
| orchestration.yml (actual) | `.github/orchestration.yml` | Live configuration file the dashboard reads at runtime |
| Next-Action Resolver | `src/lib/resolver.js` | Pure function `resolveNextAction(state, config)` — reads `state.json` and produces next action. Demonstrates how state is consumed programmatically |
| State Validator | `src/lib/state-validator.js` | Pure validation engine with 15 invariants (V1–V15). Shows all validation rules the dashboard could surface |
| Triage Engine | `src/lib/triage-engine.js` | Task and phase triage logic. Reads review documents and applies decision tables. Shows how review verdicts/actions flow |
| Constants | `src/lib/constants.js` | Complete enum definitions for all state values: pipeline tiers, statuses, review verdicts, actions, severity levels, next-actions. **Critical reference for the UI's type system** |
| CLI: next-action | `src/next-action.js` | CLI entry point for `resolveNextAction`. Shows how state and config are loaded from disk |
| CLI: validate-state | `src/validate-state.js` | CLI entry point for state validation. Shows file-read patterns |
| CLI: triage | `src/triage.js` | CLI entry point for triage. Shows how `projectDir` is used to resolve relative document paths |
| FS Helpers | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` | Shared `readFile`, `exists` utilities used by all CLI scripts |
| YAML Parser | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | `parseYaml` utility for reading `orchestration.yml` |
| Frontmatter Extractor | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | `extractFrontmatter(content)` — used by triage to read document metadata |
| Cross-Agent Dependency Map | `plan/schemas/cross-agent-dependency-map.md` | Read/write matrix showing which agents access which documents — the UI reads everything, writes nothing |

### Existing Patterns

- **Pure functions**: All core logic (`resolver.js`, `state-validator.js`, `triage-engine.js`) is implemented as pure functions with no I/O. I/O is handled at the CLI entry-point layer. The UI should follow this pattern — pure rendering logic, I/O at the server boundary.
- **CommonJS modules**: All existing code uses `require()`/`module.exports` (Node.js CommonJS). No ESM, no TypeScript. The UI will be a separate Next.js app and is free to use ESM + TypeScript.
- **Frozen enum objects**: All enums use `Object.freeze()` and are exported from `src/lib/constants.js`. The UI should replicate these as TypeScript `const` enums or union types.
- **Strict JSDoc types**: Comprehensive `@typedef` annotations define `StateJson`, `Phase`, `Task`, `PlanningStep` types. These serve as the de-facto type specification.
- **Relative path resolution**: Document paths in `state.json` are relative to the project directory. The triage CLI resolves them with `path.resolve(projectDir, docPath)`. The UI must use the same resolution strategy.
- **SCREAMING_CASE naming**: All project files use `{PROJECT-NAME}-{DOC-TYPE}.md` naming. Example: `VALIDATOR-PRD.md`, `MONITORING-UI-BRAINSTORMING.md`.
- **Subdirectory convention**: Each project has `phases/`, `tasks/`, `reports/` subdirectories.
- **Frontmatter metadata**: All document templates include YAML frontmatter with `project`, `status`, `author`, `created` fields at minimum. Some (code reviews, task reports) include structured fields like `verdict`, `severity`, `build_status`.
- **Status icons**: `STATUS.md` uses standardized emoji icons: ✅ (complete), ⬜ (pending), 🔄 (in progress), ❌ (failed/blocked), ⚠️ (warning/partial).

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | Not pinned (no `.nvmrc`) | No `package.json` at workspace root — scripts are standalone |
| Module System | CommonJS | — | All `src/` files use `require()`/`module.exports` |
| Language | JavaScript | ES2020+ | Uses `??`, optional chaining, `Object.freeze()` |
| Configuration | YAML | 1.0 | `.github/orchestration.yml` — parsed via bundled `yaml-parser.js` |
| State Format | JSON | — | `state.json` — the primary data source |
| Documentation | Markdown | — | All project artifacts are `.md` files with YAML frontmatter |
| Testing | Custom | — | Tests in `tests/` directory (`.test.js` files) — no visible test framework in root config |

**Key finding**: There is **no existing UI code**, no `package.json`, no `tsconfig.json`, no `/ui` directory, and no web framework anywhere in the workspace. The UI app will be built from scratch in an isolated `/ui` directory at the workspace root.

---

## state.json — Complete Schema Analysis

### Top-Level Structure

```
state.json
├── $schema: "orchestration-state-v2"
├── project: { name, description?, created, updated, brainstorming_doc? }
├── pipeline: { current_tier, human_gate_mode }
├── planning: { status, steps: { research, prd, design, architecture, master_plan }, human_approved }
├── execution: { status, current_phase, total_phases, phases[] }
├── final_review: { status, report_doc, human_approved }
├── errors: { total_retries, total_halts, active_blockers[] }
└── limits: { max_phases, max_tasks_per_phase, max_retries_per_task }
```

### Field-by-Field Reference

#### `project`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `name` | `string` | SCREAMING_CASE | Project identifier |
| `description` | `string?` | Free text | Present in v2 schema, absent in v1 |
| `created` | `string` | ISO 8601 | Immutable after creation |
| `updated` | `string` | ISO 8601 | Refreshed on every write |
| `brainstorming_doc` | `string?` | Relative path | Present in v2 schema, absent in v1 |

#### `pipeline`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `current_tier` | `string` | `planning` \| `execution` \| `review` \| `complete` \| `halted` | Primary decision point |
| `human_gate_mode` | `string` | `ask` \| `phase` \| `task` \| `autonomous` | Set at execution start |

#### `planning`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `status` | `string` | `not_started` \| `in_progress` \| `complete` | Overall planning status |
| `human_approved` | `boolean` | `true` \| `false` | Must be `true` before execution tier |

#### `planning.steps.*` (5 steps: `research`, `prd`, `design`, `architecture`, `master_plan`)

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `status` | `string` | `not_started` \| `in_progress` \| `complete` \| `failed` \| `skipped` | `skipped` valid for `design` only |
| `output` | `string \| null` | Relative path | Path to output document (e.g., `MONITORING-UI-RESEARCH-FINDINGS.md`) |

#### `execution`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `status` | `string` | `not_started` \| `in_progress` \| `complete` \| `halted` | Overall execution status |
| `current_phase` | `number` | 0-based index | Index into `phases[]` |
| `total_phases` | `number` | ≥ 0 | Total phase count |

#### `execution.phases[]` (Phase object)

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `phase_number` | `number` | 1-based | Display number |
| `title` / `name` | `string` | Free text | v2 uses `title`, v1 uses `name` |
| `status` | `string` | `not_started` \| `in_progress` \| `complete` \| `failed` \| `halted` | Phase lifecycle |
| `phase_doc` / `plan_doc` | `string \| null` | Relative path | v2 uses `phase_doc`, v1 uses `plan_doc` |
| `current_task` | `number` | 0-based index | Index into `tasks[]` |
| `total_tasks` | `number` | ≥ 0 | Task count |
| `phase_report` | `string \| null` | Relative path | Phase report doc |
| `human_approved` | `boolean` | `true` \| `false` | Phase-level gate |
| `phase_review` | `string \| null` | Relative path | Phase review doc |
| `phase_review_verdict` | `string \| null` | `approved` \| `changes_requested` \| `rejected` \| `null` | From reviewer |
| `phase_review_action` | `string \| null` | `advanced` \| `corrective_tasks_issued` \| `halted` \| `null` | From planner triage |

#### `execution.phases[].tasks[]` (Task object)

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `task_number` | `number` | 1-based | Display number |
| `title` / `name` | `string` | Free text | v2 uses `title`, v1 uses `name` |
| `status` | `string` | `not_started` \| `in_progress` \| `complete` \| `failed` \| `halted` | Task lifecycle |
| `handoff_doc` | `string \| null` | Relative path | Task handoff doc |
| `report_doc` | `string \| null` | Relative path | Task report doc |
| `retries` | `number` | ≥ 0 | Retry count (only increases) |
| `last_error` | `string \| null` | Free text | Most recent error description |
| `severity` | `string \| null` | `minor` \| `critical` \| `null` | Error classification |
| `review_doc` | `string \| null` | Relative path | Code review doc |
| `review_verdict` | `string \| null` | `approved` \| `changes_requested` \| `rejected` \| `null` | From reviewer |
| `review_action` | `string \| null` | `advanced` \| `corrective_task_issued` \| `halted` \| `null` | From planner triage (singular) |

#### `final_review`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `status` | `string` | `not_started` \| `in_progress` \| `complete` \| `failed` | Final review lifecycle |
| `report_doc` | `string \| null` | Relative path | Final review doc |
| `human_approved` | `boolean` | `true` \| `false` | Final human gate |

#### `errors`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `total_retries` | `number` | ≥ 0 | Aggregate across all tasks |
| `total_halts` | `number` | ≥ 0 | Total halt count |
| `active_blockers` | `string[]` | Array of strings | Current blocking issues |

#### `limits`

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `max_phases` | `number` | Positive integer | Default: 10 |
| `max_tasks_per_phase` | `number` | Positive integer | Default: 8 |
| `max_retries_per_task` | `number` | Positive integer | Default: 2 |

### Schema Version Differences (v1 vs v2)

| Field | v1 (`orchestration-state-v1`) | v2 (`orchestration-state-v2`) |
|-------|------|------|
| `$schema` | `orchestration-state-v1` | `orchestration-state-v2` |
| `project.description` | Absent | Present |
| `project.brainstorming_doc` | Absent | Present |
| Phase title field | `name` | `title` |
| Phase doc field | `plan_doc` | `phase_doc` |
| Task title field | `name` | `title` |
| `phase_review`, `phase_review_verdict`, `phase_review_action` | May be absent (null-treated) | Present |
| `review_doc`, `review_verdict`, `review_action` | May be absent (null-treated) | Present |

**UI implication**: The dashboard must handle both v1 and v2 schemas gracefully. Use fallback accessors: `phase.title ?? phase.name`, `phase.phase_doc ?? phase.plan_doc`, etc.

---

## Document Types Referenced from state.json

The dashboard's inline document viewer must be able to display any document path found in `state.json`. Here is the complete inventory:

| State Field | Document Type | Naming Pattern | Location | Template |
|-------------|--------------|----------------|----------|----------|
| `planning.steps.research.output` | Research Findings | `{NAME}-RESEARCH-FINDINGS.md` | Project root | `plan/schemas/research-findings-template.md` |
| `planning.steps.prd.output` | PRD | `{NAME}-PRD.md` | Project root | `plan/schemas/prd-template.md` |
| `planning.steps.design.output` | Design | `{NAME}-DESIGN.md` | Project root | `plan/schemas/design-template.md` |
| `planning.steps.architecture.output` | Architecture | `{NAME}-ARCHITECTURE.md` | Project root | `plan/schemas/architecture-template.md` |
| `planning.steps.master_plan.output` | Master Plan | `{NAME}-MASTER-PLAN.md` | Project root | `plan/schemas/master-plan-template.md` |
| `project.brainstorming_doc` | Brainstorming | `{NAME}-BRAINSTORMING.md` | Project root | N/A (freeform) |
| `phases[].phase_doc` / `plan_doc` | Phase Plan | `phases/{NAME}-PHASE-{NN}-{TITLE}.md` | `phases/` subdir | `plan/schemas/phase-plan-template.md` |
| `tasks[].handoff_doc` | Task Handoff | `tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | `tasks/` subdir | `plan/schemas/task-handoff-template.md` |
| `tasks[].report_doc` | Task Report | `reports/{NAME}-TASK-REPORT-P{NN}-T{NN}.md` | `reports/` subdir | `plan/schemas/task-report-template.md` |
| `tasks[].review_doc` | Code Review | `reports/CODE-REVIEW-P{NN}-T{NN}.md` | `reports/` subdir | `plan/schemas/code-review-template.md` |
| `phases[].phase_report` | Phase Report | `reports/{NAME}-PHASE-{NN}-REPORT.md` | `reports/` subdir | `plan/schemas/phase-report-template.md` |
| `phases[].phase_review` | Phase Review | `reports/{NAME}-PHASE-{NN}-REVIEW.md` (inferred) | `reports/` subdir | `plan/schemas/phase-review-template.md` |
| `final_review.report_doc` | Final Review | `reports/{NAME}-FINAL-REVIEW.md` | `reports/` subdir | N/A |

**Total document types**: 13 distinct types that can appear as links in the dashboard.

### Document Frontmatter Fields (key metadata for the viewer)

All documents include YAML frontmatter. Key fields the viewer may want to extract and display:

| Document Type | Key Frontmatter Fields |
|---------------|----------------------|
| Task Handoff | `project`, `phase`, `task`, `title`, `status`, `skills_required`, `estimated_files` |
| Task Report | `project`, `phase`, `task`, `title`, `status` (`complete`/`partial`/`failed`), `files_changed`, `tests_written`, `tests_passing`, `build_status` |
| Code Review | `project`, `phase`, `task`, `verdict` (`approved`/`changes_requested`/`rejected`), `severity`, `author`, `created` |
| Phase Plan | `project`, `phase`, `title`, `status`, `total_tasks`, `author`, `created` |
| Phase Report | `project`, `phase`, `title`, `status`, `tasks_completed`, `tasks_total`, `author`, `created` |
| Phase Review | `project`, `phase`, `verdict`, `severity`, `author`, `created` |
| PRD | `project`, `status` (`draft`/`review`/`approved`), `author`, `created` |
| Design | `project`, `status`, `author`, `created` |
| Architecture | `project`, `status`, `author`, `created` |
| Master Plan | `project`, `status` (`draft`/`approved`), `author`, `created` |

---

## Project On-Disk Structure

### Directory Layout (from `orchestration.yml` → `projects.base_path: ".github/projects"`)

```
.github/projects/
├── .gitkeep
├── BRAINSTORMER/           # Brainstorming-only project (no state.json)
│   ├── phases/             # Empty
│   ├── tasks/              # Empty
│   └── reports/            # Empty
├── HELLO-WORLD/            # Scaffold project (no state.json, no docs)
│   ├── phases/
│   ├── tasks/
│   └── reports/
├── MONITORING-UI/          # Current project — planning tier
│   ├── MONITORING-UI-BRAINSTORMING.md
│   ├── MONITORING-UI-STATUS.md
│   ├── state.json
│   ├── state.json.empty
│   ├── state.json.proposed
│   ├── phases/             # Empty (no execution yet)
│   ├── tasks/              # Empty
│   └── reports/            # Empty
├── PIPELINE-FEEDBACK/      # In-progress project — has planning docs
│   ├── PIPELINE-FEEDBACK-BRAINSTORMING.md
│   ├── PIPELINE-FEEDBACK-ARCHITECTURE.md
│   ├── PIPELINE-FEEDBACK-MASTER-PLAN.md
│   ├── PIPELINE-FEEDBACK-PRD.md
│   ├── PIPELINE-FEEDBACK-RESEARCH-FINDINGS.md
│   ├── PIPELINE-FEEDBACK-STATUS.md
│   ├── PIPELINE-FEEDBACK-AGENT-EXECUTION-REPORT.md
│   ├── state.json
│   ├── phases/
│   ├── tasks/
│   └── reports/
├── STATE-TRANSITION-SCRIPTS/ # In-progress — has all planning docs
│   ├── STATE-TRANSITION-SCRIPTS-*.md (brainstorm, research, prd, design, arch, master-plan, status)
│   ├── state.json
│   ├── state.json.proposed
│   ├── phases/
│   ├── tasks/
│   └── reports/
├── VALIDATOR/               # Complete project — full lifecycle
│   ├── VALIDATOR-*.md (idea-draft, research, prd, design, arch, master-plan, status)
│   ├── state.json
│   ├── phases/
│   │   ├── VALIDATOR-PHASE-01-CORE-INFRASTRUCTURE.md
│   │   ├── VALIDATOR-PHASE-02-VALIDATION-CHECKS.md
│   │   └── VALIDATOR-PHASE-03-POLISH-HARDENING.md
│   ├── tasks/
│   │   ├── VALIDATOR-TASK-P01-T01-FS-HELPERS.md
│   │   ├── ... (17 task handoffs total)
│   │   └── VALIDATOR-TASK-P03-T05-E2E-VALIDATION.md
│   └── reports/
│       ├── VALIDATOR-TASK-REPORT-P01-T01.md
│       ├── ... (23 task reports total)
│       ├── VALIDATOR-PHASE-01-REPORT.md
│       ├── VALIDATOR-PHASE-01-REVIEW.md
│       ├── VALIDATOR-PHASE-02-REPORT.md
│       ├── VALIDATOR-PHASE-02-REVIEW.md
│       ├── VALIDATOR-PHASE-03-REPORT.md
│       └── VALIDATOR-FINAL-REVIEW.md
└── VALIDATOR-ENHANCEMENTS/  # Brainstorming-only (no state.json)
    └── VALIDATOR-ENHANCEMENTS-BRAINSTORMING.md
```

### Key Observations

- **Every project folder has** `phases/`, `tasks/`, `reports/` subdirectories (even if empty)
- **Not all projects have `state.json`**: BRAINSTORMER, HELLO-WORLD, VALIDATOR-ENHANCEMENTS lack it. The UI must handle this — show these as "not started" projects
- **`state.json.proposed`** and **`state.json.empty`** may exist as temp/reference files — the UI should watch only `state.json`
- **Naming is consistent**: `{PROJECT-NAME}-{DOC-TYPE}.md` at root, subdir files use the patterns from the naming conventions doc
- **7 project folders** exist currently; some are active, some are stubs

### Project Discovery Algorithm

1. Read `orchestration.yml` → `projects.base_path` (default: `.github/projects`)
2. List all subdirectories under `base_path` (exclude `.gitkeep` and files)
3. For each subdirectory:
   - Check for `state.json` — if present, parse it for tier/status
   - If `state.json` absent, mark as `"not_initialized"` state
   - Extract project name from directory name (already SCREAMING_CASE)

---

## orchestration.yml — Complete Structure Analysis

### Actual Values (from `.github/orchestration.yml`)

```yaml
version: "1.0"
projects:
  base_path: ".github/projects"
  naming: "SCREAMING_CASE"
limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 2
  max_consecutive_review_rejections: 3
errors:
  severity:
    critical: ["build_failure", "security_vulnerability", "architectural_violation", "data_loss_risk"]
    minor: ["test_failure", "lint_error", "review_suggestion", "missing_test_coverage", "style_violation"]
  on_critical: "halt"
  on_minor: "retry"
git:
  strategy: "single_branch"
  branch_prefix: "orch/"
  commit_prefix: "[orch]"
  auto_commit: true
human_gates:
  after_planning: true           # Hard default — cannot be overridden
  execution_mode: "ask"
  after_final_review: true       # Hard default — cannot be overridden
```

### Config Viewer Display Sections

The UI's config viewer should group these into logical sections:

| Section | Fields | Display Format |
|---------|--------|---------------|
| Project Storage | `base_path`, `naming` | Key-value table |
| Pipeline Limits | `max_phases`, `max_tasks_per_phase`, `max_retries_per_task`, `max_consecutive_review_rejections` | Key-value table with numeric values |
| Error Handling | `severity.critical[]`, `severity.minor[]`, `on_critical`, `on_minor` | Two lists + action labels |
| Git Strategy | `strategy`, `branch_prefix`, `commit_prefix`, `auto_commit` | Key-value table |
| Human Gates | `after_planning`, `execution_mode`, `after_final_review` | Key-value with badge for locked defaults |

---

## External Research

| Source | Key Finding |
|--------|-------------|
| Next.js App Router | Server Components can read the filesystem directly via `fs` in server-side code. API Routes can maintain long-lived SSE connections. Route Handlers (`app/api/.../route.ts`) support streaming responses natively. |
| chokidar (npm) | File watcher with native OS support. `chokidar.watch(path, { persistent: true })` watches for file changes. Events: `change`, `add`, `unlink`. Must call `.close()` on watcher when SSE connection drops to prevent memory leaks. |
| Server-Sent Events (SSE) | Unidirectional server→client push over HTTP. Uses `text/event-stream` content type. Native browser `EventSource` API. Automatic reconnection built into the spec. Ideal for this read-only, infrequent-update use case. |
| shadcn/ui | Component library built on Radix UI + Tailwind CSS. Not installed as a package — components are copied into the project via `npx shadcn@latest add`. Provides: Card, Badge, Table, Sheet/Drawer, Dialog, Tabs, ScrollArea, Sidebar, etc. |
| Tailwind CSS v4 | Utility-first CSS framework. Pairs with shadcn/ui. Dark mode support via `darkMode: "class"` config. |
| react-markdown / remark | Markdown rendering in React. `react-markdown` with `remark-gfm` handles GitHub-Flavored Markdown (tables, task lists). Can add `remark-frontmatter` to strip/parse YAML frontmatter before rendering. |
| gray-matter (npm) | YAML frontmatter parser for markdown files. Extracts `{ data, content }` — `data` is the parsed frontmatter object, `content` is the markdown body. Useful for the document viewer metadata display. |

---

## Constraints Discovered

- **No `package.json` at workspace root**: The existing codebase has no Node.js package manifest. The UI must initialize its own `package.json` within the `/ui` directory.
- **No TypeScript in existing code**: All existing scripts are plain JavaScript with JSDoc. The UI can freely adopt TypeScript without conflicts.
- **Schema version coexistence**: Two state.json versions exist in the workspace (v1 from VALIDATOR, v2 from MONITORING-UI). The UI must support both — absent fields should be treated as `null` per the schema's backward compatibility rule.
- **Field name inconsistency across versions**: `title` vs `name` on phases/tasks, `phase_doc` vs `plan_doc`. The UI must normalize these with fallback accessors.
- **Relative path resolution**: All document paths in `state.json` are relative to the project directory. The UI server must resolve paths as `{workspace_root}/{base_path}/{project_name}/{relative_path}`.
- **Temporary files on disk**: `state.json.proposed` and `state.json.empty` files may coexist alongside `state.json`. The chokidar watcher should filter to watch only files named exactly `state.json`.
- **Projects without state**: Some project directories have no `state.json` (brainstorming-only, stubs). The project switcher must handle these gracefully.
- **Read-only constraint is absolute**: The UI must never write any file. Zero mutation risk to orchestration state.
- **Local-only**: No authentication, no remote access. `localhost` only.
- **No existing build toolchain**: No webpack, vite, or bundler config exists. Next.js brings its own.

---

## Recommendations

### For the Product Manager (PRD)

- **Define the exact state-to-visual mapping**: Each `state.json` field should map to a specific UI element (badge, progress bar, list item, icon). The PlanningStep checklist, phase progress grid, and task lifecycle indicators should all be enumerated.
- **Specify error/blocker display**: Active blockers (`errors.active_blockers[]`) and per-task errors (`last_error`, `severity`) need clear visual treatment — this is critical operational information.
- **Address v1/v2 schema gracefully**: Define behavior for missing fields rather than erroring. Degraded but functional display.
- **Define "not initialized" project state**: How should projects without `state.json` appear in the sidebar? The brainstorming doc is a useful indicator — show it if available.

### For the Architect (Architecture)

- **Isolate the UI app entirely**: Source in `/ui` at workspace root. Its own `package.json`, `tsconfig.json`, `next.config.js`. Zero coupling to existing `src/` code.
- **Create a shared TypeScript type module**: Port the JSDoc types from `src/lib/constants.js` into proper TypeScript types (`StateJson`, `Phase`, `Task`, `PlanningStep`, etc.). Include all enum unions.
- **SSE architecture**: Single API route (`/api/sse`) that opens one chokidar watcher per connection, scoped to `{base_path}/**/state.json`. Push deltas or full state on each change event. Close watcher on disconnect.
- **Document path resolver**: Utility function: `resolveDocPath(workspaceRoot, basePath, projectName, relativePath) → absolutePath`. Used by both the SSE handler and the document viewer API.
- **Config loading**: Read and parse `orchestration.yml` once on server startup (or per-request via Server Component). No live-watching needed — config changes are extremely rare.
- **Markdown rendering pipeline**: `gray-matter` (frontmatter extraction) → `react-markdown` + `remark-gfm` (rendering). Display frontmatter metadata as a header card above the rendered body.
- **Normalize v1/v2 differences at the data layer**: Create a normalization function that maps v1 field names to v2 field names. All UI components consume only the normalized type.

### For the UX Designer (Design)

- **Dashboard layout**: Two-column layout — narrow sidebar (project list) + wide main area (project dashboard).
- **Status icon system**: Reuse the existing emoji convention from `STATUS.md` (✅ ⬜ 🔄 ❌ ⚠️) — users already recognize these from the raw files.
- **Pipeline tier badge**: Color-coded badge component. Suggested mapping: `planning` → blue, `execution` → amber, `review` → purple, `complete` → green, `halted` → red.
- **Document viewer**: Sheet/drawer sliding in from the right. Rendered markdown with frontmatter metadata header. Close button returns to dashboard.
- **Config viewer**: Dedicated tab or page. Grouped sections matching the `orchestration.yml` structure.

---

## Appendix: Enum Reference (from `src/lib/constants.js`)

### Pipeline Tiers
`planning` | `execution` | `review` | `complete` | `halted`

### Planning Step Statuses
`not_started` | `in_progress` | `complete` | `failed` | `skipped`

### Phase Statuses
`not_started` | `in_progress` | `complete` | `failed` | `halted`

### Task Statuses
`not_started` | `in_progress` | `complete` | `failed` | `halted`

### Review Verdicts
`approved` | `changes_requested` | `rejected`

### Task Review Actions
`advanced` | `corrective_task_issued` | `halted`

### Phase Review Actions
`advanced` | `corrective_tasks_issued` | `halted`

### Severity Levels
`minor` | `critical`

### Human Gate Modes
`ask` | `phase` | `task` | `autonomous`

### Next Actions (35 values)
`init_project` | `display_halted` | `spawn_research` | `spawn_prd` | `spawn_design` | `spawn_architecture` | `spawn_master_plan` | `request_plan_approval` | `transition_to_execution` | `create_phase_plan` | `create_task_handoff` | `execute_task` | `update_state_from_task` | `create_corrective_handoff` | `halt_task_failed` | `spawn_code_reviewer` | `update_state_from_review` | `triage_task` | `halt_triage_invariant` | `retry_from_review` | `halt_from_review` | `advance_task` | `gate_task` | `generate_phase_report` | `spawn_phase_reviewer` | `update_state_from_phase_review` | `triage_phase` | `halt_phase_triage_invariant` | `gate_phase` | `advance_phase` | `transition_to_review` | `spawn_final_reviewer` | `request_final_approval` | `transition_to_complete` | `display_complete`
