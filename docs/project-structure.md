# Project Structure

This page documents the file layout, naming conventions, document types, and state management model.

## Workspace Layout

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

```
.github/
├── agents/                    # Agent definitions
│   └── ...
├── skills/                    # Skill bundles
│   ├── orchestration/         # Unified orchestration skill
│   │   ├── SKILL.md           # Role-based router
│   │   ├── config/
│   │   │   └── orchestration.yml  # System configuration
│   │   ├── schemas/
│   │   │   └── state-v4.schema.json  # Canonical v4 state JSON Schema
│   │   ├── references/
│   │   │   ├── context.md     # System context (all agents)
│   │   │   ├── pipeline-guide.md  # Pipeline guide (Orchestrator)
│   │   │   └── validation-guide.md  # Validation guide (Reviewer, Tactical Planner)
│   │   └── scripts/
│   │       ├── pipeline.js    # Unified pipeline CLI (sole state writer)
│   │       ├── migrate-to-v4.js  # Migration CLI tool
│   │       ├── lib/           # Pipeline library modules
│   │       │   └── ...
│   │       ├── tests/         # Pipeline test files
│   │       │   └── ...
│   │       └── validate/      # Validator scripts
│   │           ├── validate-orchestration.js  # Validator CLI entry point
│   │           ├── lib/       # Validator library modules
│   │           │   └── ...
│   │           └── __tests__/ # Validator test files
│   │               └── ...
│   └── ...                    # Other skills
├── instructions/              # Scoped instruction files
│   └── ...
├── prompts/                   # Utility prompt files
│   └── ...
├── copilot-instructions.md    # Workspace-level instructions
└── projects/                  # Project artifacts (default -- configurable via orchestration.yml)
    └── {PROJECT-NAME}/
        └── ...
archive/                       # Historical design artifacts -- the plan that started this repository
├── ORCHESTRATION-MASTER-PLAN.md
├── orchestration-human-draft.md
└── schemas/                   # Relic templates (14 files)
    └── ...
assets/                        # Static assets
└── dashboard-screenshot.png
docs/                          # Documentation (10 pages)
├── getting-started.md
├── agents.md
├── pipeline.md
├── skills.md
├── templates.md
├── configuration.md
├── project-structure.md
├── scripts.md
├── validation.md
└── dashboard.md
ui/                            # Monitoring dashboard (Next.js)
└── components/
    └── badges/
        ├── pipeline-tier-badge.tsx
        ├── review-verdict-badge.tsx
        ├── status-icon.tsx
        └── stage-badge.tsx    # Stage badge component
```

## Project Folder Structure

Each project gets its own subfolder under the configured `base_path` (default: `.github/projects/` — configurable via `orchestration.yml`). The `base_path` supports both relative paths (resolved from workspace root) and absolute paths (used as-is, useful for git worktree setups):

```
{PROJECT-NAME}/
├── state.json                 # Pipeline state (sole writer: pipeline script)
├── BRAINSTORMING.md           # Optional ideation output
├── {NAME}-RESEARCH-FINDINGS.md
├── {NAME}-PRD.md
├── {NAME}-DESIGN.md
├── {NAME}-ARCHITECTURE.md
├── {NAME}-MASTER-PLAN.md
├── {NAME}-ERROR-LOG.md
├── phases/
│   ├── {NAME}-PHASE-01-{TITLE}.md
│   └── {NAME}-PHASE-02-{TITLE}.md
├── tasks/
│   ├── {NAME}-TASK-P01-T01-{TITLE}.md
│   ├── {NAME}-TASK-P01-T02-{TITLE}.md
│   └── ...
└── reports/
    ├── {NAME}-TASK-REPORT-P01-T01.md
    ├── {NAME}-TASK-REPORT-P01-T02.md
    ├── CODE-REVIEW-P01-T01.md
    ├── {NAME}-PHASE-REPORT-P01.md
    └── PHASE-REVIEW-P01.md
```

## Naming Conventions

### Project Files

Project files use `SCREAMING-CASE` (configurable) with the project name as a prefix:

| Pattern | Example |
|---------|---------|
| `{NAME}-PRD.md` | `MYAPP-PRD.md` |
| `{NAME}-DESIGN.md` | `MYAPP-DESIGN.md` |
| `{NAME}-PHASE-{NN}-{TITLE}.md` | `MYAPP-PHASE-01-CORE-API.md` |
| `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | `MYAPP-TASK-P01-T03-AUTH.md` |
| `{NAME}-TASK-REPORT-P{NN}-T{NN}.md` | `MYAPP-TASK-REPORT-P01-T03.md` |
| `{NAME}-PHASE-REPORT-P{NN}.md` | `MYAPP-PHASE-REPORT-P01.md` |
| `CODE-REVIEW-P{NN}-T{NN}.md` | `CODE-REVIEW-P01-T03.md` |
| `{NAME}-ERROR-LOG.md` | `MYAPP-ERROR-LOG.md` |

### System Files

| Component | Convention | Example |
|-----------|-----------|---------|
| Agents | lowercase with hyphens | `orchestrator.agent.md` |
| Skills | lowercase with hyphens | `.github/skills/create-prd/` |
| Instructions | lowercase with hyphens | `project-docs.instructions.md` |
| Prompts | lowercase with hyphens | `configure-system.prompt.md` |

## Document Types

### Planning Documents

| Document | Sole Writer | Contents |
|----------|-------------|----------|
| `BRAINSTORMING.md` | Brainstormer | Validated ideas, scope boundaries, problem statements |
| `RESEARCH-FINDINGS.md` | Research | Codebase analysis, patterns, constraints, tech inventory |
| `PRD.md` | Product Manager | Problem statement, user stories, requirements (FR-/NFR-), risks, metrics |
| `DESIGN.md` | UX Designer | User flows, layouts, components, states, breakpoints, accessibility |
| `ARCHITECTURE.md` | Architect | System layers, module map, contracts, APIs, schemas, dependency graph |
| `MASTER-PLAN.md` | Architect | Executive summary, phase outlines, exit criteria, risk register |

### Execution Documents

| Document | Sole Writer | Contents |
|----------|-------------|----------|
| `PHASE-PLAN.md` | Tactical Planner | Task breakdown, dependencies, execution order, acceptance criteria |
| `TASK-HANDOFF.md` | Tactical Planner | Self-contained coding instructions with inlined contracts and requirements |
| `TASK-REPORT.md` | Coder | Changed files, test results, deviations, discoveries |
| `PHASE-REPORT.md` | Tactical Planner | Aggregated results, exit criteria assessment, carry-forward items |
| `CODE-REVIEW.md` | Reviewer | Verdict, checklist, issues, severity classification |
| `PHASE-REVIEW.md` | Reviewer | Cross-task integration assessment, exit criteria verification |
| `ERROR-LOG.md` | Orchestrator (via `log-error` skill) | Append-only numbered error entries from pipeline failures |

### State Files

| File | Sole Writer | Purpose |
|------|-------------|---------|
| `state.json` | Pipeline Script (`pipeline.js`) | Machine-readable pipeline state |

## State Management

### `state.json` Schema

- The `state.json` file is the single source of truth for pipeline state.  
- Each project folder contains its own `state.json` that tracks the current phase, task, agent, and other relevant metadata. 
- The pipeline script (`pipeline.js`) is the sole writer of `state.json` — no agent directly modifies it. 
- Agents read `state.json` for context but never write to it.
- The schema identifier is `orchestration-state-v4`. The full JSON Schema is defined in [`.github/skills/orchestration/schemas/state-v4.schema.json`](../.github/skills/orchestration/schemas/state-v4.schema.json).

### Invariants

The pipeline engine (`pipeline-engine.js`) runs all 12 invariant checks (V1–V2, V5–V7, V10–V16) on every state transition — see [Validation](validation.md) for the full invariant catalog. Only the pipeline script (`pipeline.js`) writes `state.json`; no agent touches it directly.

## Scoped Instructions

Instruction files use `applyTo` glob patterns to load context-specific rules only when Copilot is working with matching files:

| File | Applies To | Rules |
|------|-----------|-------|
| `project-docs.instructions.md` | `.github/projects/**` | Naming conventions, file ownership (sole writer policy), document quality standards |

> **Note:** The `applyTo` glob in `project-docs.instructions.md` must match the `base_path` configured in `orchestration.yml`. If you change `base_path`, update `applyTo` to `{new_base_path}/**` or run `/configure-system` to sync automatically.

## Prompt Files

Prompt files provide utility workflows accessible via `/` commands in Copilot:

| Prompt | Command | Purpose |
|--------|---------|---------|
| `configure-system.prompt.md` | `/configure-system` | Create or update `orchestration.yml`, scan for stale path references |
| `rad-plan.prompt.md` | `/rad-plan` | Start the full planning pipeline for a new project — Research through Master Plan |
| `rad-execute.prompt.md` | `/rad-execute` | Approve a Master Plan and begin execution |

## Next Steps

- [Templates](templates.md) — customization rules and the full template inventory
- [Validation](validation.md) — how to validate your project structure and state
