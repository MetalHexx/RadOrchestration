---
project: "ORCHESTRATION-REORG"
phase: 4
task: 2
title: "Update docs/project-structure.md Layout Tree"
status: "pending"
skills_required: ["file-editing"]
skills_optional: []
estimated_files: 1
---

# Update docs/project-structure.md Layout Tree

## Objective

Rewrite the workspace layout tree in `docs/project-structure.md` to reflect the post-reorg directory structure. Remove the `src/` and `tests/` blocks, add `.github/orchestration/` with `scripts/` and `schemas/` subtrees, add `archive/` and `assets/` root entries, and add `dashboard.md` to the `docs/` listing.

## Context

Phase 4 updates documentation to match the post-cutover structure. The previous task (T01) updated all path references in `docs/scripts.md`. This task updates the visual workspace layout tree in `docs/project-structure.md`. The file has a `## Workspace Layout` section containing a fenced code block with an ASCII directory tree — that entire tree must be replaced. The description text referencing the Deterministic Scripts link at the bottom of the file already uses the correct `scripts.md` reference title.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/project-structure.md` | Replace the workspace layout tree in the `## Workspace Layout` section; update the State Management invariants link text if needed |

## Implementation Steps

1. Open `docs/project-structure.md`.
2. Locate the `## Workspace Layout` section (starts around line 7).
3. Replace the **entire** fenced code block (` ``` ` to ` ``` `) with the exact target tree provided below in the **Target Workspace Layout Tree** section.
4. Verify the rest of the file: the `## Project Folder Structure`, `## Naming Conventions`, `## Document Types`, and `## State Management` sections should remain unchanged.
5. Confirm that no `src/` or `tests/` entries remain as top-level entries in the workspace layout tree (they now live under `.github/orchestration/scripts/`).
6. Confirm the file renders correctly as Markdown (fenced code block is properly closed, no broken formatting).

## Target Workspace Layout Tree

Replace the existing fenced code block under `## Workspace Layout` with exactly this content:

````
```
.github/
├── agents/                    # 9 agent definitions
│   └── ...
├── skills/                    # 17 skill bundles
│   └── ...
├── instructions/              # Scoped instruction files
│   └── ...
├── prompts/                   # Utility prompt files
│   └── ...
├── orchestration/             # Runtime scripts, tests, and schemas
│   ├── scripts/
│   │   ├── next-action.js     # Next-Action Resolver CLI
│   │   ├── triage.js          # Triage Executor CLI
│   │   ├── validate-state.js  # State Validator CLI
│   │   ├── lib/
│   │   │   ├── constants.js
│   │   │   ├── resolver.js
│   │   │   ├── state-validator.js
│   │   │   └── triage-engine.js
│   │   └── tests/             # All test files (18 total)
│   │       └── ...
│   └── schemas/
│       └── state-json-schema.md
├── orchestration.yml          # System configuration
├── copilot-instructions.md    # Workspace-level instructions
└── projects/                  # Project artifacts
    └── {PROJECT-NAME}/
        └── ...
archive/                       # Historical design artifacts
├── ORCHESTRATION-MASTER-PLAN.md
├── orchestration-human-draft.md
└── schemas/                   # Relic templates (14 files)
    └── ...
assets/                        # Static assets
└── dashboard-screenshot.png
docs/                          # Documentation (9 pages)
├── getting-started.md
├── agents.md
├── pipeline.md
├── skills.md
├── configuration.md
├── project-structure.md
├── scripts.md
├── validation.md
└── dashboard.md               # NEW
ui/                            # Monitoring dashboard (Next.js)
└── ...
```
````

## Current File Content (for reference)

The current `## Workspace Layout` fenced code block contains this tree — this is what you are replacing:

````
```
.github/
├── agents/                    # 9 agent definitions
│   ├── orchestrator.agent.md
│   ├── brainstormer.agent.md
│   ├── research.agent.md
│   ├── product-manager.agent.md
│   ├── ux-designer.agent.md
│   ├── architect.agent.md
│   ├── tactical-planner.agent.md
│   ├── coder.agent.md
│   └── reviewer.agent.md
├── skills/                    # 17 skill bundles
│   ├── brainstorm/
│   ├── research-codebase/
│   ├── create-prd/
│   ├── create-design/
│   ├── create-architecture/
│   ├── create-master-plan/
│   ├── create-phase-plan/
│   ├── create-task-handoff/
│   ├── generate-task-report/
│   ├── generate-phase-report/
│   ├── run-tests/
│   ├── review-code/
│   ├── review-phase/
│   ├── triage-report/
│   ├── create-agent/
│   ├── create-skill/
│   └── validate-orchestration/
├── instructions/              # Scoped instruction files
│   ├── project-docs.instructions.md
│   └── state-management.instructions.md
├── prompts/                   # Utility prompt files
│   ├── configure-system.prompt.md
│   └── execute-plan.prompt.md
├── orchestration.yml          # System configuration
├── copilot-instructions.md    # Workspace-level instructions (always loaded)
└── projects/                  # Project artifacts (path configurable)
    └── {PROJECT-NAME}/
        └── ...
src/
├── lib/
│   ├── constants.js           # Shared enums (pipeline tiers, statuses, actions)
│   ├── resolver.js            # Next-Action Resolver (pure function)
│   └── state-validator.js     # State Transition Validator (15 invariants)
├── validate-state.js          # State Validator CLI entry point
├── next-action.js             # Next-Action Resolver CLI entry point
└── triage.js                  # Triage Executor CLI entry point
tests/
└── ...                        # Test files for all scripts and utilities
```
````

## Contracts & Interfaces

Not applicable — this is a documentation-only file edit with no code contracts.

## Styles & Design Tokens

Not applicable — no UI components or design tokens involved.

## Test Requirements

- [ ] `grep -c "^src/" docs/project-structure.md` returns 0 (no top-level `src/` entry in the tree)
- [ ] `grep -c "^tests/" docs/project-structure.md` returns 0 (no top-level `tests/` entry in the tree)
- [ ] `grep -c "orchestration/" docs/project-structure.md` returns at least 1 (new orchestration subtree present)
- [ ] `grep -c "archive/" docs/project-structure.md` returns at least 1 (new archive entry present)
- [ ] `grep -c "assets/" docs/project-structure.md` returns at least 1 (new assets entry present)
- [ ] `grep -c "dashboard.md" docs/project-structure.md` returns at least 1 (new dashboard.md entry present)

## Acceptance Criteria

- [ ] The workspace layout tree in `docs/project-structure.md` matches the target tree exactly (all entries, comments, and indentation)
- [ ] No `src/` or `tests/` entries appear as top-level directories in the workspace layout tree
- [ ] `.github/orchestration/` subtree with `scripts/`, `lib/`, `tests/`, and `schemas/` is present
- [ ] `archive/` entry with `ORCHESTRATION-MASTER-PLAN.md`, `orchestration-human-draft.md`, and `schemas/` is present
- [ ] `assets/` entry with `dashboard-screenshot.png` is present
- [ ] `docs/` listing includes `dashboard.md` marked as `# NEW`
- [ ] The rest of the file (Project Folder Structure, Naming Conventions, Document Types, State Management) is unchanged
- [ ] File renders correctly in Markdown preview (fenced code block properly opened and closed)

## Constraints

- Do NOT modify any section other than the `## Workspace Layout` fenced code block
- Do NOT change the `## Project Folder Structure` tree (it documents the per-project subfolder layout, which is unchanged)
- Do NOT add or remove any sections — only replace the content of the existing workspace layout tree
- Do NOT expand `archive/schemas/` to list all 14 template files — use `└── ...` as shown in the target tree
- Do NOT reference any external planning documents — all information needed is in this handoff
