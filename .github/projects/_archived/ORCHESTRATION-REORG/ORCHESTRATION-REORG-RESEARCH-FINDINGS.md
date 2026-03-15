---
project: "ORCHESTRATION-REORG"
author: "research-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Research Findings

## Research Scope

Comprehensive analysis of all file paths, import graphs, and cross-references across the workspace to support the repository reorganization project. The research answers: what exactly lives in `src/`, `tests/`, `plan/`, `bin/`, and `.github/orchestration/`; what imports what; and where every reference to these paths appears in the repository — so that the reorg can update every cross-reference without breaking the system.

---

## Codebase Analysis

### 1. Current File Inventory

#### `src/` — 7 files (3 CLIs + 4 lib modules)

| File | Type | Lines | Imports From |
|------|------|-------|--------------|
| `src/next-action.js` | CLI entry | 83 | `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` (readFile, exists), `../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser` (parseYaml), `./lib/resolver` |
| `src/triage.js` | CLI entry | 126 | `path`, `fs`, `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` (readFile), `../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter` (extractFrontmatter), `./lib/triage-engine`, `./lib/constants` |
| `src/validate-state.js` | CLI entry | 90 | `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` (readFile), `./lib/state-validator` |
| `src/lib/constants.js` | Shared enums | 284 | (none — leaf module) |
| `src/lib/resolver.js` | Domain logic | 495 | `./constants` |
| `src/lib/state-validator.js` | Domain logic | 455 | `./constants.js` |
| `src/lib/triage-engine.js` | Domain logic | 526 | `./constants` |

**Key finding — external dependency**: All 3 CLI scripts import utilities from `.github/skills/validate-orchestration/scripts/lib/utils/` using relative paths like `../.github/skills/...`. This is the primary cross-tree dependency. The 4 lib modules only import from each other (`./constants`).

#### `tests/` — 18 test files

| File | Imports From `src/` | Imports From `.github/skills/validate-orchestration/` |
|------|---------------------|-------------------------------------------------------|
| `tests/constants.test.js` | `../src/lib/constants` | — |
| `tests/next-action.test.js` | `../src/next-action.js` | — |
| `tests/resolver.test.js` | `../src/lib/resolver.js`, `../src/lib/constants.js` | — |
| `tests/state-validator.test.js` | `../src/lib/state-validator.js` | — |
| `tests/triage-engine.test.js` | `../src/lib/triage-engine.js`, `../src/lib/constants.js` | — |
| `tests/triage.test.js` | `../src/triage` | — |
| `tests/validate-state.test.js` | `../src/validate-state.js` | — |
| `tests/agents.test.js` | — | `../. github/skills/validate-orchestration/scripts/lib/checks/agents` |
| `tests/config.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/config` |
| `tests/cross-refs.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs` |
| `tests/frontmatter.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter` |
| `tests/fs-helpers.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` |
| `tests/instructions.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/instructions` |
| `tests/prompts.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/prompts` |
| `tests/reporter.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/reporter`, `../.github/skills/validate-orchestration/scripts/validate-orchestration` |
| `tests/skills.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/skills` |
| `tests/structure.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/checks/structure` |
| `tests/yaml-parser.test.js` | — | `../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser` |

**Key finding — two test families**: 7 tests import from `src/` (state-transition-scripts tests), 11 tests import from `.github/skills/validate-orchestration/` (validator tests). One test (`reporter.test.js`) imports from both the reporter lib and the CLI entry point.

#### `plan/` — 2 files + `schemas/` subfolder with 15 files (17 total)

| File/Folder | Status |
|-------------|--------|
| `plan/ORCHESTRATION-MASTER-PLAN.md` | Historical — original system design |
| `plan/orchestration-human-draft.md` | Historical — original human draft |
| `plan/schemas/state-json-schema.md` | **ACTIVE** — canonical contract consumed at runtime |
| `plan/schemas/architecture-template.md` | Relic — promoted to `.github/skills/create-architecture/templates/` |
| `plan/schemas/code-review-template.md` | Relic |
| `plan/schemas/cross-agent-dependency-map.md` | Relic (reference value) |
| `plan/schemas/design-template.md` | Relic |
| `plan/schemas/master-plan-template.md` | Relic |
| `plan/schemas/orchestration-yml-schema.md` | Relic (reference value) |
| `plan/schemas/phase-plan-template.md` | Relic |
| `plan/schemas/phase-report-template.md` | Relic |
| `plan/schemas/phase-review-template.md` | Relic |
| `plan/schemas/prd-template.md` | Relic |
| `plan/schemas/research-findings-template.md` | Relic |
| `plan/schemas/status-md-template.md` | Relic |
| `plan/schemas/task-handoff-template.md` | Relic |
| `plan/schemas/task-report-template.md` | Relic |

#### `bin/` — Empty folder

Confirmed empty. No `.gitkeep` or other files.

#### `.github/orchestration/` — Empty folder

Confirmed empty. This is the target destination for scripts, schemas, and tests.

---

### 2. Complete Cross-Reference Audit

#### 2.1 References to `src/` paths (ACTIVE files — must update)

Files outside `src/` and `tests/` that reference `src/` and are **not** frozen historical project artifacts:

| File | Path Referenced | Context |
|------|----------------|---------|
| `.github/agents/orchestrator.agent.md` | `src/next-action.js` | CLI invocation command (lines 131, 196, 205, 220) |
| `.github/agents/tactical-planner.agent.md` | `src/validate-state.js` | CLI invocation (lines 76, 131, 178, 215) |
| `.github/agents/tactical-planner.agent.md` | `src/triage.js` | CLI invocation (lines 105, 147) |
| `.github/agents/tactical-planner.agent.md` | `src/triage.js` | Reference in skill description (line 225) |
| `.github/instructions/state-management.instructions.md` | `src/validate-state.js` | CLI usage docs (lines 42, 47, 90) |
| `.github/skills/triage-report/SKILL.md` | `src/triage.js` | Execution authority notice (line 8) |
| `README.md` | `src/` | Quick Start step 2: "Copy `.github/` and `src/`" (line 102) |
| `docs/getting-started.md` | `src/` | Installation step 3: "Copy `.github/` and `src/`" (line 24) |
| `docs/scripts.md` | `src/` | Architecture diagram, CLI usage, constants path, testing (lines 19, 39, 69, 91, 170, 173, 194, 195, 227, 243, 280) |
| `docs/scripts.md` | `tests/` | Test execution commands (lines 325–331) |
| `docs/project-structure.md` | `src/` | Workspace layout tree (line 48) |
| `docs/project-structure.md` | `tests/` | Workspace layout tree (line 56) |
| `docs/validation.md` | `src/validate-state.js` | State validation CLI reference (line 136) |

**Total active `src/` references to update: ~30+ across 9 files**

#### 2.2 References to `src/` in FROZEN project artifacts (do NOT update)

These are historical records in `.github/projects/` — they document what existed at the time:

| Project | Files Affected |
|---------|---------------|
| `STATE-TRANSITION-SCRIPTS` | Architecture, phase plans, task handoffs, reports, reviews (~80+ references) |
| `PIPELINE-FEEDBACK` | Architecture, master plan, task handoffs, reports (~20+ references) |
| `VALIDATOR` | Research findings (~5 references) |
| `MONITORING-UI` | Research findings (~2 references) |

**Rule**: These are frozen. No updates needed.

#### 2.3 References to `tests/` (ACTIVE files — must update)

| File | Context |
|------|---------|
| `docs/scripts.md` | Test execution commands: `node tests/constants.test.js` etc. (lines 325–331) |
| `docs/project-structure.md` | Workspace layout tree (line 56) |

**Total active `tests/` references to update: ~8 across 2 files**

#### 2.4 References to `plan/schemas/state-json-schema.md` (ACTIVE files — must update)

| File | Context |
|------|---------|
| `plan/ORCHESTRATION-MASTER-PLAN.md` | Design output references (lines 276, 380, 593) — **this file moves to `archive/` so self-references become internal** |

**Finding**: All other references to `plan/schemas/state-json-schema.md` are in frozen project artifacts (STATE-TRANSITION-SCRIPTS, PIPELINE-FEEDBACK, VALIDATOR, MONITORING-UI). The master plan itself moves to `archive/` — its internal references become self-referential within the archive and don't need updating.

**No active non-archive files reference `plan/schemas/state-json-schema.md`.** The schema can be promoted to `.github/orchestration/schemas/` without breaking live cross-references.

#### 2.5 References to `plan/` (non-schema) (ACTIVE files — must update)

| File | Context |
|------|---------|
| (none found in active files outside `plan/` itself) | All `plan/` references are in frozen project artifacts or in the master plan itself |

**Finding**: No active system files reference `plan/` — it can be archived cleanly.

#### 2.6 References to `bin/`

| File | Context |
|------|---------|
| `ui/package-lock.json` | npm dependency `bin/` fields (unrelated — these are node_modules binaries) |
| `src/*.js` shebang lines | `#!/usr/bin/env node` (unrelated — standard shebang) |

**Finding**: Zero actual references to the project's `bin/` directory. Safe to delete.

---

### 3. Import/Require Path Graph

#### CLI Scripts → Validate-Orchestration Utility Imports

```
src/next-action.js
  → ../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers (readFile, exists)
  → ../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser (parseYaml)
  → ./lib/resolver

src/triage.js
  → ../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers (readFile)
  → ../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter (extractFrontmatter)
  → ./lib/triage-engine
  → ./lib/constants

src/validate-state.js
  → ../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers (readFile)
  → ./lib/state-validator
```

**After move to `.github/orchestration/scripts/`**: The relative path from `.github/orchestration/scripts/next-action.js` to `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` becomes `../../skills/validate-orchestration/scripts/lib/utils/fs-helpers` — shorter and within the same `.github/` tree.

#### Internal Lib Dependencies

```
src/lib/resolver.js        → ./constants
src/lib/state-validator.js  → ./constants.js
src/lib/triage-engine.js    → ./constants
```

These are self-contained — they only import from siblings. The relative paths stay the same after the move since the `lib/` subfolder structure is preserved.

---

### 4. Validate-Orchestration Skill Analysis

#### Structure

```
.github/skills/validate-orchestration/
├── SKILL.md                          # Skill documentation
├── README.md                         # (if exists)
└── scripts/
    ├── validate-orchestration.js     # CLI entry point
    └── lib/
        ├── reporter.js               # Output formatter
        ├── checks/
        │   ├── structure.js          # Checks .github/ directory structure
        │   ├── agents.js             # Validates .agent.md files
        │   ├── skills.js             # Validates skill directories
        │   ├── config.js             # Validates orchestration.yml
        │   ├── instructions.js       # Validates instruction files
        │   ├── prompts.js            # Validates prompt files
        │   └── cross-refs.js         # Cross-reference integrity
        └── utils/
            ├── constants.js          # Validator constants
            ├── frontmatter.js        # YAML frontmatter parser
            ├── fs-helpers.js         # File system utilities (readFile, exists, listFiles, etc.)
            └── yaml-parser.js        # YAML parser
```

#### What `structure.js` Validates (Hardcoded Paths)

The structure check validates ONLY `.github/` directories:
- Required dirs: `.github`, `.github/agents`, `.github/skills`, `.github/instructions`
- Optional dir: `.github/prompts`
- Required files: `.github/orchestration.yml`, `.github/copilot-instructions.md`

**Key finding**: `structure.js` does **NOT** check for `src/`, `tests/`, `plan/`, or `bin/`. No changes needed to its validation logic for the reorg.

#### What Other Checks Do

- `agents.js` — validates `.agent.md` frontmatter, tools, subagent declarations
- `skills.js` — validates `SKILL.md` exists per skill with valid frontmatter
- `config.js` — validates `orchestration.yml` syntax and values
- `instructions.js` — validates `.instructions.md` frontmatter and `applyTo` patterns
- `prompts.js` — validates `.prompt.md` frontmatter
- `cross-refs.js` — checks referential integrity (skills↔agents, subagents exist, etc.)

**Finding**: None of these checks reference `src/`, `tests/`, or `plan/`. The validator is `.github/`-centric. **No validator code changes needed for the file moves.**

#### Utility Functions Used by `src/` Scripts

The `src/` scripts reuse 3 utility modules from the validator:
- `fs-helpers.js` — `readFile()`, `exists()`
- `yaml-parser.js` — `parseYaml()`
- `frontmatter.js` — `extractFrontmatter()`

These utilities stay in place at `.github/skills/validate-orchestration/scripts/lib/utils/`. Only the import paths from the scripts change (since the scripts move).

---

### 5. UI Dashboard Analysis

#### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 14.2.35 |
| Language | TypeScript | ^5 |
| UI Library | React | ^18 |
| Styling | Tailwind CSS | ^4.2.1 |
| Components | shadcn/ui | ^4.0.2 |
| Icons | Lucide React | ^0.300.0 |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | ^9.1.0 |
| YAML | yaml | ^2.8.2 |
| File watching | chokidar | ^3.6.0 |
| Frontmatter | gray-matter | ^4.0.3 |

#### How to Start

```bash
cd ui
npm install   # first time only
npm run dev   # starts at localhost:3000
```

Requires `WORKSPACE_ROOT` environment variable set in `ui/.env.local` pointing to the workspace root.

#### Architecture

- **3 API routes**: `/api/projects` (lists projects), `/api/config` (reads orchestration.yml), `/api/events` (SSE stream for real-time updates via chokidar file watching)
- **Reads from**: `.github/projects/` (project state, documents) and `.github/orchestration.yml` (config)
- **Read-only**: The UI monitors but never modifies files
- **Components**: sidebar (project list), dashboard (overview), planning (pipeline steps), execution (phase/task drill-down), documents (markdown viewer), config (YAML viewer), badges (status indicators), theme (dark/light)
- **Real-time**: SSE endpoint watches for file changes and pushes updates to the browser

#### UI Component Inventory

| Category | Components |
|----------|-----------|
| `badges/` | connection-indicator, lock-badge, pipeline-tier-badge, retry-badge, review-verdict-badge, severity-badge, status-icon, warning-badge |
| `config/` | config drawer |
| `dashboard/` | main dashboard view |
| `documents/` | document viewer/drawer |
| `execution/` | phase/task execution views |
| `layout/` | layout wrappers |
| `planning/` | planning pipeline visualization |
| `sidebar/` | project sidebar |
| `theme/` | theme provider |
| `ui/` | shadcn base components |

---

### 6. README Current State

The README (`README.md`) is 152 lines and contains:
- Title and description of the document-driven orchestration system
- Mermaid pipeline diagram
- Key features (9 sections with links to docs)
- Getting Started section — **references `src/` on line 102**: "Copy the `.github/` and `src/` directories"
- Documentation table (links to 8 docs pages)
- Design principles (7 items)
- Platform support note
- License reference

**What's missing**:
- No mention of the UI dashboard anywhere
- No screenshot
- No link to dashboard documentation
- No `assets/` folder exists for images

---

### 7. Documentation Inventory

| File | Lines | References `src/` | References `tests/` | References `plan/` |
|------|-------|-------------------|---------------------|---------------------|
| `docs/getting-started.md` | 115 | Yes (line 24) | No | No |
| `docs/agents.md` | 174 | No | No | No |
| `docs/pipeline.md` | 208 | No | No | No |
| `docs/skills.md` | 98 | No | No | No |
| `docs/configuration.md` | 139 | No | No | No |
| `docs/project-structure.md` | 218 | Yes (line 48) | Yes (line 56) | No |
| `docs/scripts.md` | 340 | Yes (~15 refs) | Yes (~6 refs) | No |
| `docs/validation.md` | 152 | Yes (line 136) | No | No |

**Docs files needing updates**: 4 of 8 files reference `src/` or `tests/` paths.

---

## Existing Patterns

- **CommonJS modules**: All scripts use `'use strict'`, `require()`, `module.exports`. No ESM.
- **Shebang line**: All CLI entry points start with `#!/usr/bin/env node`.
- **`if (require.main === module)` guard**: All CLIs export `parseArgs()` for testing and guard `main()` behind this check.
- **Zero npm dependencies**: Scripts use only Node.js built-ins. The only external `require()` calls go to `.github/skills/validate-orchestration/scripts/lib/utils/`.
- **`node:test` framework**: Tests use Node.js built-in test runner (`node:test` + `node:assert`).
- **Frozen project artifacts**: Completed projects in `.github/projects/` are historical records — internal path references are never updated.
- **Sole writer policy**: Every document type has exactly one agent writer.
- **Skill template pattern**: Skills bundle templates in `{skill}/templates/` subdirectories.

---

## Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | v18+ | Zero npm dependencies for scripts |
| Test framework | `node:test` | Built-in | No external test runner |
| AI platform | GitHub Copilot | VS Code | Custom agents, skills, prompts, instructions |
| Config format | YAML | — | `orchestration.yml` |
| State format | JSON | — | `state.json` |
| Document format | Markdown | — | All planning/execution docs |
| UI framework | Next.js | 14.2.35 | Standalone dashboard |
| UI styling | Tailwind CSS | 4.2.1 | With shadcn/ui components |

---

## Constraints Discovered

1. **Self-referential execution**: This project will be executed by the orchestration system itself. The pipeline reads agents, skills, scripts, and state from the current file structure. Destructive moves (`src/`, `tests/`, `plan/` deletion) and path rewiring must be deferred to a final cleanup phase after all new files are in place and validated.

2. **Copilot conventions are fixed**: `.github/agents/`, `.github/skills/`, `.github/instructions/`, `.github/prompts/` must remain at their current paths — Copilot expects them there.

3. **Validate-orchestration utility coupling**: The `src/` scripts import from `.github/skills/validate-orchestration/scripts/lib/utils/`. This dependency stays; only the relative paths change.

4. **Two test families with different targets**: 7 tests cover `src/` modules, 11 tests cover `.github/skills/validate-orchestration/` modules. Both families must have their import paths updated after the move.

5. **Agent files reference script paths by name**: `orchestrator.agent.md` and `tactical-planner.agent.md` contain literal `node src/...` CLI commands that agents execute. These are runtime-critical — incorrect paths halt the pipeline.

6. **Instruction files reference script paths**: `state-management.instructions.md` contains `src/validate-state.js` references that Copilot loads contextually. These are consumed by AI agents and affect behavior.

7. **No validator code changes needed**: The `validate-orchestration` tool's structure checks only validate `.github/` directories. It does not check `src/`, `tests/`, `plan/`, or `bin/`. No code modifications are needed to the validator itself.

8. **`state-json-schema.md` is safe to move**: No active (non-archive) files reference `plan/schemas/state-json-schema.md`. All references are in frozen project artifacts. The master plan itself moves to `archive/`.

9. **Zero references to `bin/`**: Safe to delete unconditionally.

10. **UI is standalone**: The `ui/` folder is a self-contained Next.js app that reads from `.github/projects/` and `.github/orchestration.yml` via the `WORKSPACE_ROOT` environment variable. It has no dependency on `src/`, `tests/`, or `plan/`.

---

## Recommendations

1. **Phase the work with dual-path compatibility**: Since the system executes its own reorg, create new files at target locations first, verify they work, then delete originals in a final phase. The brainstorming document's "self-referential execution" constraint is critical.

2. **Update agent files early and carefully**: `orchestrator.agent.md` and `tactical-planner.agent.md` contain the literal script paths that drive the pipeline. These must be updated atomically with the script move — or use a dual-path phase where both old and new paths work.

3. **Group test import updates by family**: The 7 `src/`-targeting tests and 11 validator-targeting tests need different path adjustments. Handle them as two batches.

4. **Consolidate `docs/scripts.md` updates**: This file has ~20 references to `src/` and `tests/` paths — the densest concentration of cross-references. Treat it as a single focused task.

5. **Create `assets/` directory for screenshots**: No `assets/` folder exists yet. Create it for the dashboard screenshot.

6. **Create `docs/dashboard.md`**: No dashboard documentation exists. The UI is a full Next.js app with SSE, file watching, config viewing, document rendering, and real-time status — it deserves dedicated docs.

7. **Archive `plan/` to `archive/` wholesale**: Since no active files depend on anything in `plan/` (the one active schema file is being promoted separately), the entire folder can be renamed/moved without cascading changes.

8. **Run validation after each phase**: Use `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` after each phase to verify `.github/` integrity. This catches agent/skill breakage early.

9. **New import paths after move**: When scripts move to `.github/orchestration/scripts/`, the relative path to validate-orchestration utilities changes from `../.github/skills/validate-orchestration/scripts/lib/utils/` to `../../skills/validate-orchestration/scripts/lib/utils/`. Similarly, test imports change from `../.github/orchestration/scripts/...` (for the `src/`-family) and deeper relative paths for the validator-family.

10. **Consider the `copilot-instructions.md` workspace instructions**: The attached workspace instructions reference `src/` indirectly through the project structure description. Verify if the workspace structure description auto-generated by Copilot needs manual correction, or if it self-updates.
