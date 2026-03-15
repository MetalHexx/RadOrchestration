---
project: "ORCHESTRATION-REORG"
status: "draft"
author: "architect-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Architecture

## Technical Overview

This is a mechanical repository reorganization — no runtime logic changes, no new features, no refactoring. The architecture defines the exact target file structure, every path migration, every `require()` change, every cross-reference update, and the precise phase ordering that keeps the orchestration pipeline functional while it executes its own reorganization. The technology stack is unchanged: Node.js CommonJS scripts with zero npm dependencies, GitHub Copilot custom agents/skills/instructions/prompts, and a standalone Next.js monitoring dashboard. The critical constraint is self-referential execution: the system must remain fully operational at every intermediate state because it is executing its own reorg.

## System Layers

This project reorganizes a file tree, not a software application. The "system layers" are the categories of files being moved, and the ordering constraints between them.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Runtime Scripts & Schemas                                 │
│  Files that the pipeline executes directly (CLI scripts, lib        │
│  modules, canonical schema). Move first — create at new locations.  │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: Test Suite                                                │
│  Files that exercise Layer 1. Move after scripts are in place       │
│  so import paths can be validated immediately.                      │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3: Cross-References (Agents, Skills, Instructions, Docs)     │
│  Files that REFERENCE Layer 1 by path. Update after Layer 1 files   │
│  exist at new locations — never point to a path that doesn't exist. │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4: Documentation & README                                    │
│  User-facing docs, dashboard page, README updates. Can proceed      │
│  in parallel with Layer 3 — no runtime dependency.                  │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 5: Archive & Cleanup                                         │
│  Destructive operations: delete src/, tests/, plan/, bin/.          │
│  Move historical files to archive/. MUST be last.                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Map

### Layer 1: Runtime Scripts & Schemas

| Module | Current Path | Target Path | Responsibility |
|--------|-------------|-------------|---------------|
| Next-Action CLI | `src/next-action.js` | `.github/orchestration/scripts/next-action.js` | Resolves the next pipeline action from state.json |
| Triage CLI | `src/triage.js` | `.github/orchestration/scripts/triage.js` | Executes triage on task/phase reports |
| Validate-State CLI | `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` | Validates state.json transitions |
| Constants | `src/lib/constants.js` | `.github/orchestration/scripts/lib/constants.js` | Shared enums and constants |
| Resolver | `src/lib/resolver.js` | `.github/orchestration/scripts/lib/resolver.js` | Next-action resolution logic |
| State Validator | `src/lib/state-validator.js` | `.github/orchestration/scripts/lib/state-validator.js` | State transition validation logic |
| Triage Engine | `src/lib/triage-engine.js` | `.github/orchestration/scripts/lib/triage-engine.js` | Triage decision logic |
| State Schema | `plan/schemas/state-json-schema.md` | `.github/orchestration/schemas/state-json-schema.md` | Canonical state.json contract |

### Layer 2: Test Suite

| Module | Current Path | Target Path | Tests |
|--------|-------------|-------------|-------|
| constants.test | `tests/constants.test.js` | `.github/orchestration/scripts/tests/constants.test.js` | Constants module |
| next-action.test | `tests/next-action.test.js` | `.github/orchestration/scripts/tests/next-action.test.js` | Next-Action CLI |
| resolver.test | `tests/resolver.test.js` | `.github/orchestration/scripts/tests/resolver.test.js` | Resolver module |
| state-validator.test | `tests/state-validator.test.js` | `.github/orchestration/scripts/tests/state-validator.test.js` | State Validator module |
| triage-engine.test | `tests/triage-engine.test.js` | `.github/orchestration/scripts/tests/triage-engine.test.js` | Triage Engine module |
| triage.test | `tests/triage.test.js` | `.github/orchestration/scripts/tests/triage.test.js` | Triage CLI |
| validate-state.test | `tests/validate-state.test.js` | `.github/orchestration/scripts/tests/validate-state.test.js` | Validate-State CLI |
| agents.test | `tests/agents.test.js` | `.github/orchestration/scripts/tests/agents.test.js` | Validator: agents check |
| config.test | `tests/config.test.js` | `.github/orchestration/scripts/tests/config.test.js` | Validator: config check |
| cross-refs.test | `tests/cross-refs.test.js` | `.github/orchestration/scripts/tests/cross-refs.test.js` | Validator: cross-refs check |
| frontmatter.test | `tests/frontmatter.test.js` | `.github/orchestration/scripts/tests/frontmatter.test.js` | Validator: frontmatter util |
| fs-helpers.test | `tests/fs-helpers.test.js` | `.github/orchestration/scripts/tests/fs-helpers.test.js` | Validator: fs-helpers util |
| instructions.test | `tests/instructions.test.js` | `.github/orchestration/scripts/tests/instructions.test.js` | Validator: instructions check |
| prompts.test | `tests/prompts.test.js` | `.github/orchestration/scripts/tests/prompts.test.js` | Validator: prompts check |
| reporter.test | `tests/reporter.test.js` | `.github/orchestration/scripts/tests/reporter.test.js` | Validator: reporter + CLI |
| skills.test | `tests/skills.test.js` | `.github/orchestration/scripts/tests/skills.test.js` | Validator: skills check |
| structure.test | `tests/structure.test.js` | `.github/orchestration/scripts/tests/structure.test.js` | Validator: structure check |
| yaml-parser.test | `tests/yaml-parser.test.js` | `.github/orchestration/scripts/tests/yaml-parser.test.js` | Validator: yaml-parser util |

### Layer 3: Cross-Reference Files (Agents, Skills, Instructions)

| File | Current References | Update Needed |
|------|--------------------|--------------|
| `.github/agents/orchestrator.agent.md` | `src/next-action.js` (4 occurrences) | → `.github/orchestration/scripts/next-action.js` |
| `.github/agents/tactical-planner.agent.md` | `src/validate-state.js` (4 occurrences), `src/triage.js` (3 occurrences) | → `.github/orchestration/scripts/validate-state.js`, `.github/orchestration/scripts/triage.js` |
| `.github/instructions/state-management.instructions.md` | `src/validate-state.js` (3 occurrences) | → `.github/orchestration/scripts/validate-state.js` |
| `.github/skills/triage-report/SKILL.md` | `src/triage.js` (1 occurrence) | → `.github/orchestration/scripts/triage.js` |

### Layer 4: Documentation & README

| File | Updates Needed |
|------|---------------|
| `README.md` | Add dashboard screenshot section; update Quick Start from 2-dir to 1-dir copy; add dashboard row to docs table |
| `docs/getting-started.md` | Update installation step: remove `src/` from copy instruction |
| `docs/scripts.md` | Update ~20 path references (`src/` → `.github/orchestration/scripts/`, `tests/` → `.github/orchestration/scripts/tests/`) |
| `docs/project-structure.md` | Rewrite workspace layout tree (remove `src/`, `tests/`, `plan/`, `bin/`; add `orchestration/`, `archive/`, `assets/`) |
| `docs/validation.md` | Update 1 CLI reference (`src/validate-state.js` → `.github/orchestration/scripts/validate-state.js`) |
| `docs/dashboard.md` | **NEW** — Create dedicated dashboard documentation page |
| `.github/copilot-instructions.md` | Update any workspace structure references if present |

### Layer 5: Archive & Cleanup

| Operation | Source | Target | Type |
|-----------|--------|--------|------|
| Archive master plan | `plan/ORCHESTRATION-MASTER-PLAN.md` | `archive/ORCHESTRATION-MASTER-PLAN.md` | Move |
| Archive human draft | `plan/orchestration-human-draft.md` | `archive/orchestration-human-draft.md` | Move |
| Archive relic schemas | `plan/schemas/*.md` (14 files, excluding `state-json-schema.md`) | `archive/schemas/*.md` | Move |
| Create assets dir | — | `assets/` | Create |
| Add screenshot | — | `assets/dashboard-screenshot.png` | Create |
| Delete `plan/` | `plan/` | — | Delete |
| Delete `src/` | `src/` | — | Delete |
| Delete `tests/` | `tests/` | — | Delete |
| Delete `bin/` | `bin/` | — | Delete |

## Contracts & Interfaces

### Import Path Contracts — CLI Scripts (Post-Move)

The 3 CLI scripts import from two sources: sibling `./lib/` modules (unchanged) and the validate-orchestration utility tree (path changes).

```javascript
// .github/orchestration/scripts/next-action.js
// CURRENT: const { readFile, exists } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
// CURRENT: const { parseYaml } = require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser');
// CURRENT: const { resolveNextAction } = require('./lib/resolver');
//
// NEW:
const { readFile, exists } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { parseYaml } = require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');
const { resolveNextAction } = require('./lib/resolver');  // UNCHANGED — relative to same parent
```

```javascript
// .github/orchestration/scripts/triage.js
// CURRENT: const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
// CURRENT: const { extractFrontmatter } = require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter');
// CURRENT: const { executeTriage } = require('./lib/triage-engine');
// CURRENT: const { TRIAGE_LEVELS } = require('./lib/constants');
//
// NEW:
const { readFile } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { extractFrontmatter } = require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter');
const { executeTriage } = require('./lib/triage-engine');  // UNCHANGED
const { TRIAGE_LEVELS } = require('./lib/constants');      // UNCHANGED
```

```javascript
// .github/orchestration/scripts/validate-state.js
// CURRENT: const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
// CURRENT: const { validateTransition } = require('./lib/state-validator');
//
// NEW:
const { readFile } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { validateTransition } = require('./lib/state-validator');  // UNCHANGED
```

### Import Path Contracts — Internal Lib Modules (UNCHANGED)

The 4 lib modules only import from siblings. Since the `lib/` directory structure is preserved intact, these paths do NOT change:

```javascript
// .github/orchestration/scripts/lib/resolver.js — NO CHANGE
const { /* ... */ } = require('./constants');

// .github/orchestration/scripts/lib/state-validator.js — NO CHANGE
const { /* ... */ } = require('./constants.js');

// .github/orchestration/scripts/lib/triage-engine.js — NO CHANGE
const { /* ... */ } = require('./constants');

// .github/orchestration/scripts/lib/constants.js — NO CHANGE (leaf module, no imports)
```

### Import Path Contracts — Test Files (Post-Move)

#### Family A: Script-Targeting Tests (7 files)

Tests that import from `src/` modules. After both tests and scripts move, the relative path changes.

Current location: `tests/<name>.test.js` → imports `../src/<path>`
New location: `.github/orchestration/scripts/tests/<name>.test.js` → imports `../<path>`

```javascript
// .github/orchestration/scripts/tests/constants.test.js
// CURRENT: require('../src/lib/constants')
// NEW:
const constants = require('../lib/constants');
```

```javascript
// .github/orchestration/scripts/tests/next-action.test.js
// CURRENT: require('../src/next-action.js')  (lines 8 and 182)
// NEW:
const { parseArgs } = require('../next-action.js');
// ... and line 182:
const mod = require('../next-action.js');
```

```javascript
// .github/orchestration/scripts/tests/resolver.test.js
// CURRENT: require('../src/lib/resolver.js') and require('../src/lib/constants.js')
// NEW:
const { resolveNextAction } = require('../lib/resolver.js');
const { /* ... */ } = require('../lib/constants.js');
```

```javascript
// .github/orchestration/scripts/tests/state-validator.test.js
// CURRENT: require('../src/lib/state-validator.js')
// NEW:
const { validateTransition } = require('../lib/state-validator.js');
```

```javascript
// .github/orchestration/scripts/tests/triage-engine.test.js
// CURRENT: require('../src/lib/triage-engine.js') and require('../src/lib/constants.js')
// NEW:
const { executeTriage, checkRetryBudget } = require('../lib/triage-engine.js');
const { /* ... */ } = require('../lib/constants.js');
```

```javascript
// .github/orchestration/scripts/tests/triage.test.js
// CURRENT: require('../src/triage')
// NEW:
const { parseArgs } = require('../triage');
```

```javascript
// .github/orchestration/scripts/tests/validate-state.test.js
// CURRENT: require('../src/validate-state.js')  (lines 8 and 169)
// NEW:
const { parseArgs } = require('../validate-state.js');
// ... and line 169:
const mod = require('../validate-state.js');
```

**Pattern**: For all 7 script-targeting tests, the transformation is: `../src/` → `../` (remove the `src/` segment, since tests now live inside scripts/).

#### Family B: Validator-Targeting Tests (11 files)

Tests that import from `.github/skills/validate-orchestration/`. These tests move from `tests/` to `.github/orchestration/scripts/tests/` — the relative path to the validator tree changes.

Current location: `tests/<name>.test.js` → imports `../.github/skills/validate-orchestration/scripts/lib/...`
New location: `.github/orchestration/scripts/tests/<name>.test.js` → imports `../../../../skills/validate-orchestration/scripts/lib/...`

**Path calculation**: From `.github/orchestration/scripts/tests/` to `.github/skills/validate-orchestration/scripts/lib/`:
- Up 4 levels: `tests/ → scripts/ → orchestration/ → .github/` = `../../../../`
- Then down: `skills/validate-orchestration/scripts/lib/`
- Full prefix: `../../../../skills/validate-orchestration/scripts/lib/`

Wait — let me recalculate more carefully:
- From `.github/orchestration/scripts/tests/<file>` the `..` chain is:
  - `../` = `.github/orchestration/scripts/`
  - `../../` = `.github/orchestration/`
  - `../../../` = `.github/`
  - So `../../../skills/validate-orchestration/scripts/lib/` is the correct prefix.

```javascript
// .github/orchestration/scripts/tests/agents.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/agents')
// NEW:
const checkAgents = require('../../../skills/validate-orchestration/scripts/lib/checks/agents');
```

```javascript
// .github/orchestration/scripts/tests/config.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/config')
// NEW:
const checkConfig = require('../../../skills/validate-orchestration/scripts/lib/checks/config');
```

```javascript
// .github/orchestration/scripts/tests/cross-refs.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs')
// NEW:
const checkCrossRefs = require('../../../skills/validate-orchestration/scripts/lib/checks/cross-refs');
```

```javascript
// .github/orchestration/scripts/tests/frontmatter.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')
// NEW:
const { extractFrontmatter } = require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter');
```

```javascript
// .github/orchestration/scripts/tests/fs-helpers.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')
// NEW:
const { exists, isDirectory, listFiles, listDirs, readFile } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
```

```javascript
// .github/orchestration/scripts/tests/instructions.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/instructions')
// NEW:
const checkInstructions = require('../../../skills/validate-orchestration/scripts/lib/checks/instructions');
```

```javascript
// .github/orchestration/scripts/tests/prompts.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/prompts')
// NEW:
const checkPrompts = require('../../../skills/validate-orchestration/scripts/lib/checks/prompts');
```

```javascript
// .github/orchestration/scripts/tests/reporter.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/reporter')
// CURRENT: require('../.github/skills/validate-orchestration/scripts/validate-orchestration')  (line 215)
// NEW:
const { report, printHelp } = require('../../../skills/validate-orchestration/scripts/lib/reporter');
// ... and line 215:
const { parseArgs } = require('../../../skills/validate-orchestration/scripts/validate-orchestration');
```

```javascript
// .github/orchestration/scripts/tests/skills.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/skills')
// NEW:
const checkSkills = require('../../../skills/validate-orchestration/scripts/lib/checks/skills');
```

```javascript
// .github/orchestration/scripts/tests/structure.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/checks/structure')
// NEW:
const checkStructure = require('../../../skills/validate-orchestration/scripts/lib/checks/structure');
```

```javascript
// .github/orchestration/scripts/tests/yaml-parser.test.js
// CURRENT: require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')
// NEW:
const { parseYaml } = require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');
```

**Pattern**: For all 11 validator-targeting tests, the transformation is: `../.github/skills/` → `../../../skills/` (3 levels up from `tests/` reaches `.github/`, then descend into `skills/`).

**Special case — dynamically constructed paths**: `agents.test.js` and `config.test.js` (and possibly others) construct paths using `path.resolve()` or `path.join()` with variables like `fsHelpersPath` and `frontmatterPath`. These tests build require paths from string constants — the code must be inspected line-by-line during implementation to catch ALL dynamic `require()` calls, not just the static top-level ones listed above.

### Agent CLI Invocation Contracts (Post-Move)

These exact strings appear in agent `.md` files and must be updated:

```bash
# orchestrator.agent.md — 4 occurrences
# CURRENT:
node src/next-action.js --state <path> --config .github/orchestration.yml
# NEW:
node .github/orchestration/scripts/next-action.js --state <path> --config .github/orchestration.yml
```

```bash
# tactical-planner.agent.md — validate-state (4 occurrences)
# CURRENT:
node src/validate-state.js --current <current> --proposed <proposed>
# NEW:
node .github/orchestration/scripts/validate-state.js --current <current> --proposed <proposed>
```

```bash
# tactical-planner.agent.md — triage (3 occurrences)
# CURRENT:
node src/triage.js --report <path> --state <path> --config .github/orchestration.yml
# NEW:
node .github/orchestration/scripts/triage.js --report <path> --state <path> --config .github/orchestration.yml
```

### Instruction File Path Contracts (Post-Move)

```markdown
<!-- .github/instructions/state-management.instructions.md — 3 occurrences -->
<!-- CURRENT: -->
node src/validate-state.js --current <current-state.json> --proposed <proposed-state.json>
<!-- NEW: -->
node .github/orchestration/scripts/validate-state.js --current <current-state.json> --proposed <proposed-state.json>
```

### Skill File Path Contracts (Post-Move)

```markdown
<!-- .github/skills/triage-report/SKILL.md — 1 occurrence -->
<!-- CURRENT: src/triage.js -->
<!-- NEW: .github/orchestration/scripts/triage.js -->
```

## Dependencies

### External Dependencies

No changes. The scripts have zero npm dependencies — only Node.js built-ins (`path`, `fs`, `node:test`, `node:assert`). The validate-orchestration skill utilities are an internal cross-tree dependency, not an npm package.

### Internal Dependency Graph (Post-Move)

```
.github/orchestration/scripts/next-action.js
  → ./lib/resolver                                                    (UNCHANGED)
  → ../../skills/validate-orchestration/scripts/lib/utils/fs-helpers  (NEW path)
  → ../../skills/validate-orchestration/scripts/lib/utils/yaml-parser (NEW path)

.github/orchestration/scripts/triage.js
  → ./lib/triage-engine                                               (UNCHANGED)
  → ./lib/constants                                                   (UNCHANGED)
  → ../../skills/validate-orchestration/scripts/lib/utils/fs-helpers  (NEW path)
  → ../../skills/validate-orchestration/scripts/lib/utils/frontmatter (NEW path)

.github/orchestration/scripts/validate-state.js
  → ./lib/state-validator                                             (UNCHANGED)
  → ../../skills/validate-orchestration/scripts/lib/utils/fs-helpers  (NEW path)

.github/orchestration/scripts/lib/resolver.js       → ./constants    (UNCHANGED)
.github/orchestration/scripts/lib/state-validator.js → ./constants.js (UNCHANGED)
.github/orchestration/scripts/lib/triage-engine.js   → ./constants   (UNCHANGED)
.github/orchestration/scripts/lib/constants.js       → (leaf)        (UNCHANGED)
```

### Cross-Tree Dependency — Validate-Orchestration Utilities

The scripts depend on 3 utility modules within the validate-orchestration skill. These modules do NOT move — only the import paths from the scripts change.

| Utility | Location (UNCHANGED) | Consumed By |
|---------|---------------------|-------------|
| `fs-helpers.js` | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers` | All 3 CLI scripts |
| `yaml-parser.js` | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser` | `next-action.js` |
| `frontmatter.js` | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter` | `triage.js` |

**Path calculation**: From `.github/orchestration/scripts/<file>`:
- `../` = `.github/orchestration/`
- `../../` = `.github/`
- `../../skills/validate-orchestration/scripts/lib/utils/<module>` ✓

## File Structure

### Target Repository Root (Post-Reorg)

```
.github/
├── agents/                                    # 9 agent definitions (UNCHANGED)
│   ├── orchestrator.agent.md                  # Updated: script paths
│   ├── tactical-planner.agent.md              # Updated: script paths
│   ├── brainstormer.agent.md
│   ├── research.agent.md
│   ├── product-manager.agent.md
│   ├── ux-designer.agent.md
│   ├── architect.agent.md
│   ├── coder.agent.md
│   └── reviewer.agent.md
├── instructions/                              # Instruction files (UNCHANGED location)
│   ├── project-docs.instructions.md
│   └── state-management.instructions.md       # Updated: script paths
├── skills/                                    # 17 skill bundles (UNCHANGED location)
│   ├── triage-report/
│   │   └── SKILL.md                           # Updated: script path
│   ├── validate-orchestration/                # UNCHANGED — utilities stay here
│   │   └── scripts/
│   │       ├── validate-orchestration.js
│   │       └── lib/
│   │           ├── reporter.js
│   │           ├── checks/
│   │           │   ├── agents.js
│   │           │   ├── config.js
│   │           │   ├── cross-refs.js
│   │           │   ├── instructions.js
│   │           │   ├── prompts.js
│   │           │   ├── skills.js
│   │           │   └── structure.js
│   │           └── utils/
│   │               ├── constants.js
│   │               ├── frontmatter.js
│   │               ├── fs-helpers.js
│   │               └── yaml-parser.js
│   └── ...                                    # 15 other skills (UNCHANGED)
├── prompts/                                   # Prompt files (UNCHANGED)
├── orchestration/                             # NEW — consolidated runtime
│   ├── scripts/
│   │   ├── next-action.js                     # Moved from src/next-action.js
│   │   ├── triage.js                          # Moved from src/triage.js
│   │   ├── validate-state.js                  # Moved from src/validate-state.js
│   │   ├── lib/
│   │   │   ├── constants.js                   # Moved from src/lib/constants.js
│   │   │   ├── resolver.js                    # Moved from src/lib/resolver.js
│   │   │   ├── state-validator.js             # Moved from src/lib/state-validator.js
│   │   │   └── triage-engine.js               # Moved from src/lib/triage-engine.js
│   │   └── tests/
│   │       ├── agents.test.js                 # Moved from tests/agents.test.js
│   │       ├── config.test.js                 # Moved from tests/config.test.js
│   │       ├── constants.test.js              # Moved from tests/constants.test.js
│   │       ├── cross-refs.test.js             # Moved from tests/cross-refs.test.js
│   │       ├── frontmatter.test.js            # Moved from tests/frontmatter.test.js
│   │       ├── fs-helpers.test.js             # Moved from tests/fs-helpers.test.js
│   │       ├── instructions.test.js           # Moved from tests/instructions.test.js
│   │       ├── next-action.test.js            # Moved from tests/next-action.test.js
│   │       ├── prompts.test.js                # Moved from tests/prompts.test.js
│   │       ├── reporter.test.js               # Moved from tests/reporter.test.js
│   │       ├── resolver.test.js               # Moved from tests/resolver.test.js
│   │       ├── skills.test.js                 # Moved from tests/skills.test.js
│   │       ├── state-validator.test.js        # Moved from tests/state-validator.test.js
│   │       ├── structure.test.js              # Moved from tests/structure.test.js
│   │       ├── triage-engine.test.js          # Moved from tests/triage-engine.test.js
│   │       ├── triage.test.js                 # Moved from tests/triage.test.js
│   │       ├── validate-state.test.js         # Moved from tests/validate-state.test.js
│   │       └── yaml-parser.test.js            # Moved from tests/yaml-parser.test.js
│   └── schemas/
│       └── state-json-schema.md               # Promoted from plan/schemas/
├── orchestration.yml                          # System config (UNCHANGED)
├── copilot-instructions.md                    # Workspace instructions (may update)
└── projects/                                  # Project artifacts (UNCHANGED, FROZEN)
    └── ...

archive/                                       # NEW — historical design artifacts
├── ORCHESTRATION-MASTER-PLAN.md               # Moved from plan/
├── orchestration-human-draft.md               # Moved from plan/
└── schemas/                                   # Moved from plan/schemas/ (14 relic files)
    ├── architecture-template.md
    ├── code-review-template.md
    ├── cross-agent-dependency-map.md
    ├── design-template.md
    ├── master-plan-template.md
    ├── orchestration-yml-schema.md
    ├── phase-plan-template.md
    ├── phase-report-template.md
    ├── phase-review-template.md
    ├── prd-template.md
    ├── research-findings-template.md
    ├── status-md-template.md
    ├── task-handoff-template.md
    └── task-report-template.md

assets/                                        # NEW — static repository assets
└── dashboard-screenshot.png                   # Dashboard screenshot for README

docs/                                          # Documentation (UNCHANGED location)
├── agents.md                                  # UNCHANGED
├── configuration.md                           # UNCHANGED
├── dashboard.md                               # NEW — monitoring dashboard docs
├── getting-started.md                         # Updated: single-dir copy instruction
├── pipeline.md                                # UNCHANGED
├── project-structure.md                       # Updated: workspace layout tree
├── scripts.md                                 # Updated: ~20 path references
├── skills.md                                  # UNCHANGED
└── validation.md                              # Updated: 1 CLI reference

ui/                                            # Monitoring dashboard (UNCHANGED)
└── ...

README.md                                      # Updated: dashboard section, quick start, docs table
```

### Deleted Entries (Final Cleanup)

```
src/                    # DELETED — contents moved to .github/orchestration/scripts/
tests/                  # DELETED — contents moved to .github/orchestration/scripts/tests/
plan/                   # DELETED — contents moved to archive/ and .github/orchestration/schemas/
bin/                    # DELETED — was empty
```

## Complete Path Migration Map

Every file that moves, with exact old and new paths:

### Scripts (7 files)

| # | Old Path | New Path |
|---|----------|----------|
| 1 | `src/next-action.js` | `.github/orchestration/scripts/next-action.js` |
| 2 | `src/triage.js` | `.github/orchestration/scripts/triage.js` |
| 3 | `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` |
| 4 | `src/lib/constants.js` | `.github/orchestration/scripts/lib/constants.js` |
| 5 | `src/lib/resolver.js` | `.github/orchestration/scripts/lib/resolver.js` |
| 6 | `src/lib/state-validator.js` | `.github/orchestration/scripts/lib/state-validator.js` |
| 7 | `src/lib/triage-engine.js` | `.github/orchestration/scripts/lib/triage-engine.js` |

### Tests (18 files)

| # | Old Path | New Path |
|---|----------|----------|
| 8 | `tests/agents.test.js` | `.github/orchestration/scripts/tests/agents.test.js` |
| 9 | `tests/config.test.js` | `.github/orchestration/scripts/tests/config.test.js` |
| 10 | `tests/constants.test.js` | `.github/orchestration/scripts/tests/constants.test.js` |
| 11 | `tests/cross-refs.test.js` | `.github/orchestration/scripts/tests/cross-refs.test.js` |
| 12 | `tests/frontmatter.test.js` | `.github/orchestration/scripts/tests/frontmatter.test.js` |
| 13 | `tests/fs-helpers.test.js` | `.github/orchestration/scripts/tests/fs-helpers.test.js` |
| 14 | `tests/instructions.test.js` | `.github/orchestration/scripts/tests/instructions.test.js` |
| 15 | `tests/next-action.test.js` | `.github/orchestration/scripts/tests/next-action.test.js` |
| 16 | `tests/prompts.test.js` | `.github/orchestration/scripts/tests/prompts.test.js` |
| 17 | `tests/reporter.test.js` | `.github/orchestration/scripts/tests/reporter.test.js` |
| 18 | `tests/resolver.test.js` | `.github/orchestration/scripts/tests/resolver.test.js` |
| 19 | `tests/skills.test.js` | `.github/orchestration/scripts/tests/skills.test.js` |
| 20 | `tests/state-validator.test.js` | `.github/orchestration/scripts/tests/state-validator.test.js` |
| 21 | `tests/structure.test.js` | `.github/orchestration/scripts/tests/structure.test.js` |
| 22 | `tests/triage-engine.test.js` | `.github/orchestration/scripts/tests/triage-engine.test.js` |
| 23 | `tests/triage.test.js` | `.github/orchestration/scripts/tests/triage.test.js` |
| 24 | `tests/validate-state.test.js` | `.github/orchestration/scripts/tests/validate-state.test.js` |
| 25 | `tests/yaml-parser.test.js` | `.github/orchestration/scripts/tests/yaml-parser.test.js` |

### Schema (1 file promoted)

| # | Old Path | New Path |
|---|----------|----------|
| 26 | `plan/schemas/state-json-schema.md` | `.github/orchestration/schemas/state-json-schema.md` |

### Archive (16 files moved)

| # | Old Path | New Path |
|---|----------|----------|
| 27 | `plan/ORCHESTRATION-MASTER-PLAN.md` | `archive/ORCHESTRATION-MASTER-PLAN.md` |
| 28 | `plan/orchestration-human-draft.md` | `archive/orchestration-human-draft.md` |
| 29 | `plan/schemas/architecture-template.md` | `archive/schemas/architecture-template.md` |
| 30 | `plan/schemas/code-review-template.md` | `archive/schemas/code-review-template.md` |
| 31 | `plan/schemas/cross-agent-dependency-map.md` | `archive/schemas/cross-agent-dependency-map.md` |
| 32 | `plan/schemas/design-template.md` | `archive/schemas/design-template.md` |
| 33 | `plan/schemas/master-plan-template.md` | `archive/schemas/master-plan-template.md` |
| 34 | `plan/schemas/orchestration-yml-schema.md` | `archive/schemas/orchestration-yml-schema.md` |
| 35 | `plan/schemas/phase-plan-template.md` | `archive/schemas/phase-plan-template.md` |
| 36 | `plan/schemas/phase-report-template.md` | `archive/schemas/phase-report-template.md` |
| 37 | `plan/schemas/phase-review-template.md` | `archive/schemas/phase-review-template.md` |
| 38 | `plan/schemas/prd-template.md` | `archive/schemas/prd-template.md` |
| 39 | `plan/schemas/research-findings-template.md` | `archive/schemas/research-findings-template.md` |
| 40 | `plan/schemas/status-md-template.md` | `archive/schemas/status-md-template.md` |
| 41 | `plan/schemas/task-handoff-template.md` | `archive/schemas/task-handoff-template.md` |
| 42 | `plan/schemas/task-report-template.md` | `archive/schemas/task-report-template.md` |

### New Files (2 files created)

| # | Path | Type |
|---|------|------|
| 43 | `assets/dashboard-screenshot.png` | Image asset (captured from running UI) |
| 44 | `docs/dashboard.md` | New documentation page |

### Deleted Directories (4 directories)

| # | Path | Reason |
|---|------|--------|
| 45 | `src/` | Contents moved to `.github/orchestration/scripts/` |
| 46 | `tests/` | Contents moved to `.github/orchestration/scripts/tests/` |
| 47 | `plan/` | Contents moved to `archive/` and `.github/orchestration/schemas/` |
| 48 | `bin/` | Empty, zero references |

## Cross-Reference Inventory

Every file that contains path references needing updates, organized by category. This is the exhaustive audit of what the Coder must change.

### Category A: Agent Files (Runtime-Critical)

These references are executed by the pipeline. Incorrect paths halt the system.

| File | Line(s) | Current Reference | New Reference |
|------|---------|-------------------|---------------|
| `.github/agents/orchestrator.agent.md` | 131, 196, 205, 220 | `src/next-action.js` | `.github/orchestration/scripts/next-action.js` |
| `.github/agents/tactical-planner.agent.md` | 76, 131, 178, 215 | `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` |
| `.github/agents/tactical-planner.agent.md` | 105, 147, 225 | `src/triage.js` | `.github/orchestration/scripts/triage.js` |

**Total: 11 replacements across 2 files**

### Category B: Instruction Files (AI-Behavior-Critical)

These references are loaded by Copilot and affect agent behavior.

| File | Line(s) | Current Reference | New Reference |
|------|---------|-------------------|---------------|
| `.github/instructions/state-management.instructions.md` | 42, 47, 90 | `src/validate-state.js` | `.github/orchestration/scripts/validate-state.js` |

**Total: 3 replacements across 1 file**

### Category C: Skill Files

| File | Line(s) | Current Reference | New Reference |
|------|---------|-------------------|---------------|
| `.github/skills/triage-report/SKILL.md` | ~8 | `src/triage.js` | `.github/orchestration/scripts/triage.js` |

**Total: 1 replacement across 1 file**

### Category D: Script `require()` Statements

| File | Current `require()` Path | New `require()` Path |
|------|--------------------------|----------------------|
| `next-action.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers'` | `'../../skills/validate-orchestration/scripts/lib/utils/fs-helpers'` |
| `next-action.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser'` | `'../../skills/validate-orchestration/scripts/lib/utils/yaml-parser'` |
| `triage.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers'` | `'../../skills/validate-orchestration/scripts/lib/utils/fs-helpers'` |
| `triage.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter'` | `'../../skills/validate-orchestration/scripts/lib/utils/frontmatter'` |
| `validate-state.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers'` | `'../../skills/validate-orchestration/scripts/lib/utils/fs-helpers'` |

**Total: 5 `require()` changes across 3 files. All `./lib/` imports are UNCHANGED.**

### Category E: Test `require()` Statements — Script-Targeting (Family A)

| File | Current `require()` Path | New `require()` Path |
|------|--------------------------|----------------------|
| `constants.test.js` | `'../src/lib/constants'` | `'../lib/constants'` |
| `next-action.test.js` | `'../src/next-action.js'` (×2) | `'../next-action.js'` (×2) |
| `resolver.test.js` | `'../src/lib/resolver.js'` | `'../lib/resolver.js'` |
| `resolver.test.js` | `'../src/lib/constants.js'` | `'../lib/constants.js'` |
| `state-validator.test.js` | `'../src/lib/state-validator.js'` | `'../lib/state-validator.js'` |
| `triage-engine.test.js` | `'../src/lib/triage-engine.js'` | `'../lib/triage-engine.js'` |
| `triage-engine.test.js` | `'../src/lib/constants.js'` | `'../lib/constants.js'` |
| `triage.test.js` | `'../src/triage'` | `'../triage'` |
| `validate-state.test.js` | `'../src/validate-state.js'` (×2) | `'../validate-state.js'` (×2) |

**Total: 11 `require()` changes across 7 files. Pattern: remove `/src` from path.**

### Category F: Test `require()` Statements — Validator-Targeting (Family B)

| File | Current `require()` Path | New `require()` Path |
|------|--------------------------|----------------------|
| `agents.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/agents'` | `'../../../skills/validate-orchestration/scripts/lib/checks/agents'` |
| `config.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/config'` | `'../../../skills/validate-orchestration/scripts/lib/checks/config'` |
| `cross-refs.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs'` | `'../../../skills/validate-orchestration/scripts/lib/checks/cross-refs'` |
| `frontmatter.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter'` | `'../../../skills/validate-orchestration/scripts/lib/utils/frontmatter'` |
| `fs-helpers.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers'` | `'../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers'` |
| `instructions.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/instructions'` | `'../../../skills/validate-orchestration/scripts/lib/checks/instructions'` |
| `prompts.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/prompts'` | `'../../../skills/validate-orchestration/scripts/lib/checks/prompts'` |
| `reporter.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/reporter'` | `'../../../skills/validate-orchestration/scripts/lib/reporter'` |
| `reporter.test.js` | `'../.github/skills/validate-orchestration/scripts/validate-orchestration'` | `'../../../skills/validate-orchestration/scripts/validate-orchestration'` |
| `skills.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/skills'` | `'../../../skills/validate-orchestration/scripts/lib/checks/skills'` |
| `structure.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/checks/structure'` | `'../../../skills/validate-orchestration/scripts/lib/checks/structure'` |
| `yaml-parser.test.js` | `'../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser'` | `'../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser'` |

**Total: 12 `require()` changes across 11 files. Pattern: `../.github/skills/` → `../../../skills/`.**

**Special case — dynamic `require()` paths**: `agents.test.js` and `config.test.js` construct require paths using `path.resolve()` with variables (`fsHelpersPath`, `frontmatterPath`). These dynamically-built paths also need updating. The Coder must grep each test file for ALL `require()` calls (including those built from variables) to catch every reference.

### Category G: Documentation Files

| File | ~Count | Old Pattern | New Pattern |
|------|--------|-------------|-------------|
| `docs/scripts.md` | ~15 | `src/next-action.js`, `src/triage.js`, `src/validate-state.js`, `src/lib/constants.js` | `.github/orchestration/scripts/next-action.js`, etc. |
| `docs/scripts.md` | ~6 | `tests/*.test.js`, `node tests/...` | `.github/orchestration/scripts/tests/*.test.js`, `node .github/orchestration/scripts/tests/...` |
| `docs/project-structure.md` | ~3 | `src/` tree, `tests/` entry, layout tree | Rewrite layout tree per Design spec |
| `docs/getting-started.md` | ~1 | `"Copy .github/ and src/"` | `"Copy .github/"` |
| `docs/validation.md` | ~1 | `node src/validate-state.js` | `node .github/orchestration/scripts/validate-state.js` |

**Total: ~26 path references across 5 files**

### Category H: README

| Section | Change |
|---------|--------|
| Quick Start (line ~102) | `"Copy .github/ and src/"` → `"Copy .github/"` |
| NEW: Monitoring Dashboard section | Add screenshot + description + link after pipeline diagram |
| Documentation table | Add "Monitoring Dashboard" row linking to `docs/dashboard.md` |

### Category I: Workspace-Level Instructions

| File | Change |
|------|--------|
| `.github/copilot-instructions.md` | Verify/update any workspace structure references |

### EXCLUDED — Frozen Project Artifacts (DO NOT TOUCH)

The following project directories contain 100+ references to `src/`, `tests/`, and `plan/` paths. **These are historical records and MUST NOT be modified:**

- `.github/projects/STATE-TRANSITION-SCRIPTS/` (~80+ references)
- `.github/projects/PIPELINE-FEEDBACK/` (~20+ references)
- `.github/projects/VALIDATOR/` (~5 references)
- `.github/projects/MONITORING-UI/` (~2 references)
- `.github/projects/ORCHESTRATION-REORG/` (current project — its own docs reference old paths as "current state")

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Self-referential execution safety | Create new files first, validate, then update references, then delete originals. The pipeline reads agent files and scripts from the live file tree — never point a reference to a path that doesn't exist yet, never delete a file that's still referenced. |
| Dual-path compatibility | During the transition, both `src/` and `.github/orchestration/scripts/` contain the scripts. Agent files and references are updated to point to new paths only AFTER new files are created and verified. Old files remain as a safety net until final cleanup. |
| Frozen artifact protection | A strict boundary: only files listed in Categories A–I above are modified. Any file under `.github/projects/*/` (except the ORCHESTRATION-REORG project's own status files) is NEVER touched. The Coder must NOT run blanket find-and-replace across the entire repo. |
| Validation gates | After each phase, run: (1) `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` to verify .github/ integrity, (2) `node .github/orchestration/scripts/tests/<test>.test.js` for moved test files, (3) full-text grep for stale path patterns to catch missed references. |
| Path pattern grep verification | After all reference updates, search for stale patterns to verify completeness: `grep -r "node src/" --include="*.md" --include="*.js"` (excluding `archive/`, `.github/projects/`), `grep -r "require.*\.\./src/" --include="*.js"` (excluding `.github/projects/`), `grep -r "tests/" --include="*.md" docs/` |
| Error handling | No changes to error handling — this is a file reorganization, not a code change |
| State management | No changes to state.json schema or state machine — only the CLI path in instruction files |

## Validation Strategy

### Gate 1: Post-Script-Move Validation

Run after scripts are created at new locations with updated `require()` paths:

```bash
# Verify each script can be loaded without import errors
node -e "require('./.github/orchestration/scripts/next-action.js')"
node -e "require('./.github/orchestration/scripts/triage.js')"
node -e "require('./.github/orchestration/scripts/validate-state.js')"

# Verify lib modules load
node -e "require('./.github/orchestration/scripts/lib/constants.js')"
node -e "require('./.github/orchestration/scripts/lib/resolver.js')"
node -e "require('./.github/orchestration/scripts/lib/state-validator.js')"
node -e "require('./.github/orchestration/scripts/lib/triage-engine.js')"
```

### Gate 2: Post-Test-Move Validation

Run after tests are created at new locations with updated `require()` paths:

```bash
# Run each test individually to verify imports resolve
node --test .github/orchestration/scripts/tests/constants.test.js
node --test .github/orchestration/scripts/tests/resolver.test.js
node --test .github/orchestration/scripts/tests/state-validator.test.js
node --test .github/orchestration/scripts/tests/triage-engine.test.js
node --test .github/orchestration/scripts/tests/next-action.test.js
node --test .github/orchestration/scripts/tests/triage.test.js
node --test .github/orchestration/scripts/tests/validate-state.test.js

# Then run validator-family tests
node --test .github/orchestration/scripts/tests/agents.test.js
node --test .github/orchestration/scripts/tests/config.test.js
node --test .github/orchestration/scripts/tests/cross-refs.test.js
node --test .github/orchestration/scripts/tests/frontmatter.test.js
node --test .github/orchestration/scripts/tests/fs-helpers.test.js
node --test .github/orchestration/scripts/tests/instructions.test.js
node --test .github/orchestration/scripts/tests/prompts.test.js
node --test .github/orchestration/scripts/tests/reporter.test.js
node --test .github/orchestration/scripts/tests/skills.test.js
node --test .github/orchestration/scripts/tests/structure.test.js
node --test .github/orchestration/scripts/tests/yaml-parser.test.js
```

### Gate 3: Post-Reference-Update Validation

Run after agent/instruction/skill/doc path references are updated:

```bash
# Run validate-orchestration to verify .github/ integrity
node .github/skills/validate-orchestration/scripts/validate-orchestration.js

# Grep for stale path patterns in active files (should return 0 results)
# Exclude: archive/, .github/projects/, node_modules/
grep -rn "node src/" --include="*.md" --include="*.js" . | grep -v "archive/" | grep -v ".github/projects/" | grep -v "node_modules/"
grep -rn "require.*'\.\./src/" --include="*.js" . | grep -v ".github/projects/" | grep -v "node_modules/"
grep -rn "require.*'\.\./\.github/" --include="*.js" .github/orchestration/ | grep -v "node_modules/"
```

### Gate 4: Final Cleanup Validation

Run after `src/`, `tests/`, `plan/`, `bin/` are deleted:

```bash
# Full test suite from new location
node --test .github/orchestration/scripts/tests/*.test.js

# Validate-orchestration
node .github/skills/validate-orchestration/scripts/validate-orchestration.js

# Verify deleted directories don't exist
test ! -d src && echo "src/ deleted" || echo "ERROR: src/ still exists"
test ! -d tests && echo "tests/ deleted" || echo "ERROR: tests/ still exists"
test ! -d plan && echo "plan/ deleted" || echo "ERROR: plan/ still exists"
test ! -d bin && echo "bin/ deleted" || echo "ERROR: bin/ still exists"

# Verify new directories exist
test -d .github/orchestration/scripts && echo "scripts/ exists" || echo "ERROR: scripts/ missing"
test -d .github/orchestration/scripts/tests && echo "tests/ exists" || echo "ERROR: tests/ missing"
test -d .github/orchestration/schemas && echo "schemas/ exists" || echo "ERROR: schemas/ missing"
test -d archive && echo "archive/ exists" || echo "ERROR: archive/ missing"
test -d assets && echo "assets/ exists" || echo "ERROR: assets/ missing"

# Final frozen-artifact integrity check: no changes to completed project files
# (verify via git diff if in a git repo)
git diff --name-only .github/projects/STATE-TRANSITION-SCRIPTS/ .github/projects/PIPELINE-FEEDBACK/ .github/projects/VALIDATOR/ .github/projects/MONITORING-UI/
# Expected output: empty (no files changed)
```

## Phasing Recommendations

The following phasing strategy is advisory — the Tactical Planner makes final decisions. The ordering is driven by the self-referential execution constraint: the pipeline must stay functional at every intermediate state.

### Phase 1: Script & Schema Migration (Foundation)

**Goal**: Create all runtime scripts and the active schema at their new locations with correct `require()` paths. Do NOT modify or delete originals.

**Scope**:
- Create directory structure: `.github/orchestration/scripts/`, `.github/orchestration/scripts/lib/`, `.github/orchestration/schemas/`
- Copy 7 script files to `.github/orchestration/scripts/` (3 CLIs + 4 lib modules)
- Update `require()` paths in the 3 CLI scripts (5 changes — the `../.github/skills/` → `../../skills/` transformation)
- Do NOT update `./lib/` imports (they're unchanged)
- Copy `plan/schemas/state-json-schema.md` to `.github/orchestration/schemas/state-json-schema.md`
- **Validation gate**: Run Gate 1 (node -e require checks for all 7 modules)

**Safety**: Old `src/` scripts remain untouched and functional. The pipeline still uses `src/` paths (agent files not yet updated). Both old and new scripts coexist.

**Exit criteria**:
- All 7 scripts load without errors at new locations
- All `require()` paths in CLI scripts resolve correctly at new locations
- Old `src/` scripts remain functional (no changes to originals)
- `state-json-schema.md` exists at `.github/orchestration/schemas/`

### Phase 2: Test Suite Migration

**Goal**: Migrate all 18 test files to `.github/orchestration/scripts/tests/` with corrected `require()` paths. Do NOT delete originals.

**Scope**:
- Create directory: `.github/orchestration/scripts/tests/`
- Copy 18 test files to `.github/orchestration/scripts/tests/`
- Update Family A test imports (7 files, 11 changes): `../src/` → `../`
- Update Family B test imports (11 files, 12 changes): `../.github/skills/` → `../../../skills/`
- Handle dynamic `require()` paths in `agents.test.js`, `config.test.js`, and any other files that construct paths from variables
- **Validation gate**: Run Gate 2 (all 18 tests pass at new locations)

**Safety**: Old `tests/` files remain untouched. Both old and new test locations coexist.

**Exit criteria**:
- All 18 tests pass at new locations with zero failures
- All `require()` paths (static and dynamic) resolve correctly
- Old `tests/` files remain functional (no changes to originals)

### Phase 3: Cross-Reference Cutover (Agent, Instruction, Skill Path Updates)

**Goal**: Update all runtime-critical path references in agent files, instruction files, and skill files to point to the new script locations. This is the "point of no return" for the pipeline — after this phase, the pipeline uses the new paths.

**Scope**:
- Update `.github/agents/orchestrator.agent.md`: 4 occurrences of `src/next-action.js` → `.github/orchestration/scripts/next-action.js`
- Update `.github/agents/tactical-planner.agent.md`: 4 occurrences of `src/validate-state.js` → `.github/orchestration/scripts/validate-state.js`, 3 occurrences of `src/triage.js` → `.github/orchestration/scripts/triage.js`
- Update `.github/instructions/state-management.instructions.md`: 3 occurrences of `src/validate-state.js` → `.github/orchestration/scripts/validate-state.js`
- Update `.github/skills/triage-report/SKILL.md`: 1 occurrence of `src/triage.js` → `.github/orchestration/scripts/triage.js`
- **Validation gate**: Run Gate 3 (validate-orchestration + grep for stale paths)

**Safety**: New scripts already exist and are validated (Phase 1). Old scripts still exist at `src/` as a rollback safety net. The cutover is purely updating markdown references.

**CRITICAL NOTE**: This phase must be executed as a single atomic unit. Do not update half the references and leave the other half pointing to old paths — that creates an inconsistent state where different agents invoke different script locations.

**Exit criteria**:
- Zero occurrences of `src/next-action.js`, `src/validate-state.js`, `src/triage.js` in any agent, instruction, or skill file
- validate-orchestration passes with zero errors
- The pipeline can execute using the new script paths

### Phase 4: Documentation & README Updates

**Goal**: Update all documentation to reflect the new structure. Create the dashboard documentation page. Update the README with the dashboard showcase and single-directory adoption message.

**Scope**:
- Update `docs/scripts.md`: ~21 path references (`src/` → `.github/orchestration/scripts/`, `tests/` → `.github/orchestration/scripts/tests/`)
- Update `docs/project-structure.md`: Rewrite workspace layout tree per Design specification
- Update `docs/getting-started.md`: Change copy instruction from 2-dir to 1-dir
- Update `docs/validation.md`: Update 1 CLI reference
- Create `docs/dashboard.md`: New page per Design specification (purpose, prerequisites, startup, features, data sources, real-time updates, component architecture)
- Update `README.md`: Add Monitoring Dashboard section (screenshot + description + link), update Quick Start, add docs table row
- Verify/update `.github/copilot-instructions.md` if it contains stale structure references

**Safety**: Documentation changes don't affect runtime behavior. This phase has no risk of breaking the pipeline.

**Exit criteria**:
- Zero stale `src/` or `tests/` path references in any `docs/*.md` file or `README.md`
- `docs/dashboard.md` exists with all required sections
- `README.md` contains dashboard screenshot section, updated Quick Start, and dashboard docs table row
- validate-orchestration passes with zero errors

### Phase 5: Archive, Assets & Cleanup (Destructive)

**Goal**: Create the archive, add the screenshot asset, and delete all original directories. This is the final phase — only safe after all new files are in place and all references are updated.

**Scope**:
- Create `archive/` directory and `archive/schemas/` subdirectory
- Move `plan/ORCHESTRATION-MASTER-PLAN.md` → `archive/ORCHESTRATION-MASTER-PLAN.md`
- Move `plan/orchestration-human-draft.md` → `archive/orchestration-human-draft.md`
- Move 14 relic schema files from `plan/schemas/` → `archive/schemas/`
- Create `assets/` directory
- Add `assets/dashboard-screenshot.png` (capture from running UI or create placeholder)
- Delete `src/` directory (all 7 files already migrated in Phase 1)
- Delete `tests/` directory (all 18 files already migrated in Phase 2)
- Delete `plan/` directory (all files either promoted or archived)
- Delete `bin/` directory (empty)
- **Validation gate**: Run Gate 4 (full test suite, validate-orchestration, directory existence checks, frozen artifact integrity)

**Safety**: This is the only phase with destructive operations. Every file being deleted has already been migrated and validated in earlier phases. If any earlier phase failed, this phase should not execute.

**Exit criteria**:
- `archive/` exists with 2 files + `schemas/` subfolder (14 files)
- `assets/` exists with `dashboard-screenshot.png`
- `src/`, `tests/`, `plan/`, `bin/` no longer exist
- Full test suite passes (18/18) from new locations
- validate-orchestration reports zero errors
- Zero changes to frozen project artifacts (verified by git diff)
- Root directory contains exactly: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`, plus any other existing root files (LICENSE, etc.)

### Phase Dependency Graph

```
Phase 1 (Scripts & Schema) ─────► Phase 2 (Tests)
         │                                  │
         │                                  │
         ▼                                  ▼
Phase 3 (Cross-Ref Cutover) ◄──────────────┘
         │
         ├──────► Phase 4 (Docs & README)
         │                    │
         ▼                    ▼
Phase 5 (Archive & Cleanup) ◄┘
```

- Phase 1 must complete before Phase 2 (tests import from scripts — scripts must exist first)
- Phase 1 must complete before Phase 3 (references must not point to non-existent paths)
- Phase 3 should complete before Phase 4 (docs should document the current state, not the transitional state)
- Phase 4 and Phase 3 could technically run in parallel, but sequential is safer
- Phase 5 MUST be last — it deletes originals that serve as safety nets during earlier phases

### Risk-Aware Sequencing Summary

| Phase | Risk Level | Rollback Strategy |
|-------|-----------|-------------------|
| Phase 1 | Low | Delete new files; originals untouched |
| Phase 2 | Low | Delete new test files; originals untouched |
| Phase 3 | **Medium** | Revert agent/instruction/skill files to reference `src/` paths (old scripts still exist) |
| Phase 4 | Low | Revert documentation changes (no runtime impact) |
| Phase 5 | **High** | Cannot easily undo directory deletions — this is why it's gated behind full validation of all prior phases |
