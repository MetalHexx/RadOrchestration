---
project: "VALIDATOR"
author: "research-agent"
created: "2026-03-07T12:00:00Z"
---

# VALIDATOR — Research Findings

## Research Scope

Investigated the `.github/` orchestration file structure, conventions, schemas, cross-references, and the existing `validate-orchestration.js` to gather context for building an improved Node.js CLI validator tool.

---

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Existing validator | `validate-orchestration.js` (workspace root) | 725-line Node.js script — the baseline to replace/extend |
| Orchestration config | `.github/orchestration.yml` | Primary config file the validator must parse and check |
| Copilot instructions | `.github/copilot-instructions.md` | Workspace-level instructions; references conventions the validator should enforce |
| Agent files (×8) | `.github/agents/*.agent.md` | Core files to validate — frontmatter schema, tools, agents arrays |
| Skill folders (×14) | `.github/skills/*/` | Folder structure + SKILL.md frontmatter to validate |
| Instruction files (×2) | `.github/instructions/*.instructions.md` | Frontmatter + applyTo globs to validate |
| Prompt files (×1) | `.github/prompts/configure-system.prompt.md` | Prompt frontmatter to validate |
| State schema | `plan/schemas/state-json-schema.md` | Defines state.json contract — useful for project-level validation |
| Config schema | `plan/schemas/orchestration-yml-schema.md` | Defines orchestration.yml contract — validation rules reference |
| Cross-agent map | `plan/schemas/cross-agent-dependency-map.md` | Read/write matrix — useful for ownership validation |
| Project docs instructions | `.github/instructions/project-docs.instructions.md` | Naming rules, file ownership — conventions to enforce |
| State management instructions | `.github/instructions/state-management.instructions.md` | State invariants the validator could check on existing projects |

### Existing Patterns

- **Frontmatter parsing**: The existing validator has a custom YAML-subset parser (`parseFrontmatter()`) that handles `key: value`, `key: 'quoted'`, and `key:\n  - item` list formats. It does NOT use a full YAML parser (no npm dependency).
- **Check grouping**: Validator groups checks into 6 sections: File Structure, Agent Files, Skill Files, orchestration.yml, Instruction Files, Cross-References.
- **Result tracking**: Simple pass/warn/fail counter with emoji-prefixed console output (`✅`, `⚠️`, `❌`).
- **Expected inventories**: Hardcoded arrays (`EXPECTED_AGENTS`, `EXPECTED_SKILLS`) serve as the source of truth for what should exist.
- **Exit codes**: `process.exit(1)` on any failure, `process.exit(0)` on pass (with or without warnings).
- **No external dependencies**: Pure Node.js (`fs`, `path` only). No `yaml`, `chalk`, or other npm packages.
- **No color escapes**: Uses Unicode emoji for visual indicators, not ANSI color codes.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | (system) | No package.json — runs as standalone script |
| Language | JavaScript (CommonJS) | ES2015+ | Uses `require()`, `const`, template literals, spread |
| Dependencies | None | — | Zero npm dependencies; uses only `fs` and `path` |
| Config format | YAML (subset) | — | Custom parser, not a full YAML library |
| Output | Console (stdout) | — | Unicode emoji markers, box-drawing chars for sections |

---

## Detailed Findings

### 1. Agent Files (`.github/agents/*.agent.md`)

**Location**: `.github/agents/`
**Count**: 8 files

| File | `name` field | Tools | Agents |
|------|-------------|-------|--------|
| `orchestrator.agent.md` | Orchestrator | `read`, `search`, `agent` | Research, Product Manager, UX Designer, Architect, Tactical Planner, Coder, Reviewer |
| `research.agent.md` | Research | `read`, `search`, `edit`, `web/fetch`, `todo` | `[]` |
| `product-manager.agent.md` | Product Manager | `read`, `search`, `edit`, `todo` | `[]` |
| `ux-designer.agent.md` | UX Designer | `read`, `search`, `edit`, `todo` | `[]` |
| `architect.agent.md` | Architect | `read`, `search`, `edit`, `todo` | `[]` |
| `tactical-planner.agent.md` | Tactical Planner | `read`, `search`, `edit`, `todo` | `[]` |
| `coder.agent.md` | Coder | `read`, `search`, `edit`, `execute`, `todo` | `[]` |
| `reviewer.agent.md` | Reviewer | `read`, `search`, `edit`, `execute`, `todo` | `[]` |

#### Frontmatter Schema

All agent files use a `chatagent` fenced code block with YAML frontmatter between `---` delimiters at the top.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes (de facto) | Display name shown in agents dropdown |
| `description` | string | Yes (de facto) | Keyword-rich description for agent discovery. Recommended 50–300 chars |
| `argument-hint` | string | Recommended | Hint text guiding user interaction |
| `tools` | string[] | Yes (de facto) | Toolset names or `namespace/tool` individual tools |
| `agents` | string[] | Yes (de facto) | Subagent list; `[]` = none. Orchestrator lists 7 subagent display names |
| `model` | string \| string[] | Optional | Model name or prioritized fallback array |
| `user-invocable` | boolean | Optional | Default `true` |
| `disable-model-invocation` | boolean | Optional | Default `false` |
| `target` | string | Optional | `vscode` or `github-copilot` |
| `handoffs` | object[] | Optional | Transition buttons to other agents |

#### Tool Validation Rules

- **Valid toolsets**: `read`, `search`, `edit`, `execute`, `web`, `todo`, `agent`, `vscode`
- **Valid namespaced tools**: `web/fetch`, `read/readFile`, `read/readDirectory`, `read/listDirectory`, `edit/editFiles`, `edit/createFile`, `edit/deleteFile`, `edit/moveFile`, `execute/runInTerminal`, etc. (full list in frontmatter-reference.md)
- **Deprecated tool names** (should NOT appear): `readFile`, `editFile`, `createFile`, `deleteFile`, `moveFile`, `findFiles`, `listDirectory`, `runInTerminal`, `fetchWebpage`, `searchCodebase`, `searchFiles`, `runTests`
- **Rule**: If `agents` array is non-empty, `agent` MUST be in `tools`
- **Rule**: Non-orchestrator agents MUST have `agents: []`

#### Agent Body Structure Convention

All agent bodies follow this pattern:
1. `# Agent Name` — H1 title
2. Introductory paragraph defining role
3. `## Role & Constraints` — What you do / What you do NOT do / Write access
4. `## Workflow` — Step-by-step instructions
5. `## Skills` — Which skills the agent uses (backtick-wrapped names)
6. `## Output Contract` — Table of output documents with paths and formats
7. `## Quality Standards` — Bullet list of quality gates

### 2. Skill Files (`.github/skills/*/SKILL.md`)

**Location**: `.github/skills/`
**Count**: 14 items (13 directories + 1 bare file)

| Skill Folder | Has `SKILL.md` | Has `templates/` | Template Files |
|-------------|----------------|-------------------|----------------|
| `create-agent/` | ✅ | ✅ | `AGENT.md` |
| `create-architecture/` | ✅ | ✅ | `ARCHITECTURE.md` |
| `create-design/` | ✅ | ✅ | `DESIGN.md` |
| `create-master-plan/` | ✅ | ✅ | `MASTER-PLAN.md` |
| `create-phase-plan/` | ✅ | ✅ | `PHASE-PLAN.md` |
| `create-prd/` | ✅ | ✅ | `PRD.md` |
| `create-task-handoff/` | ✅ | ✅ | `TASK-HANDOFF.md` |
| `generate-phase-report/` | ✅ | ✅ | `PHASE-REPORT.md` |
| `generate-task-report/` | ✅ | ✅ | `TASK-REPORT.md` |
| `research-codebase/` | ✅ | ✅ | `RESEARCH-FINDINGS.md` |
| `review-code/` | ✅ | ✅ | `CODE-REVIEW.md` |
| `review-phase/` | ✅ | ✅ | `PHASE-REVIEW.md` |
| `run-tests/` | ✅ | ❌ (by design) | — |
| `create-skill` | ⚠️ Bare file, not a directory | — | — |

**Anomaly**: `create-skill` is a bare file (not a directory). All other skills are directories containing `SKILL.md`. The existing validator's `EXPECTED_SKILLS` array does NOT include `create-skill`, so it's unchecked. The `create-agent/` skill additionally has a `references/` subfolder with `frontmatter-reference.md`.

#### SKILL.md Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Must match the folder name exactly |
| `description` | string | Yes | 50–200 chars recommended for Copilot auto-discovery |

#### SKILL.md Body Structure Convention

1. `# Skill Title` — H1 title
2. Introductory paragraph
3. `## When to Use This Skill` — Trigger list
4. `## Inputs Required` — Table of inputs (source, description)
5. `## Workflow` — Numbered steps
6. `## Key Rules` — Bullet list of constraints
7. `## Template` — Link to `./templates/TEMPLATE.md`

#### Expected Subdirectory Structure

```
.github/skills/<skill-name>/
├── SKILL.md              # Required: frontmatter + instructions
├── templates/            # Required (except run-tests): template .md files
│   └── <TEMPLATE>.md
├── references/           # Optional: reference materials (e.g., create-agent)
│   └── *.md
├── scripts/              # Optional: helper scripts
└── assets/               # Optional: images, diagrams
```

### 3. Instruction Files (`.github/instructions/*.instructions.md`)

**Location**: `.github/instructions/`
**Count**: 2 files

| File | `applyTo` Pattern | Purpose |
|------|-------------------|---------|
| `project-docs.instructions.md` | `.github/projects/**` | Naming rules, file ownership, quality standards for project docs |
| `state-management.instructions.md` | `**/state.json,**/*STATUS.md` | State machine rules, invariants, pipeline tiers, error severity |

#### Frontmatter Schema

Instruction files use a standard `instructions` fenced code block wrapper with YAML frontmatter:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applyTo` | string (glob) | Yes | File glob pattern controlling when the instruction is loaded |

**Validation rule**: Without `applyTo`, the instruction loads on EVERY Copilot interaction (global scope), which is wasteful.

### 4. Configuration (`.github/orchestration.yml`)

**Location**: `.github/orchestration.yml`
**Format**: Full YAML

#### Schema Fields

| Section | Field | Type | Valid Values | Required |
|---------|-------|------|-------------|----------|
| (root) | `version` | string | `"1.0"` | Yes |
| `projects` | `base_path` | string | Valid relative path | Yes |
| `projects` | `naming` | string | `SCREAMING_CASE` \| `lowercase` \| `numbered` | Yes |
| `limits` | `max_phases` | int (>0) | Positive integer | Yes |
| `limits` | `max_tasks_per_phase` | int (>0) | Positive integer | Yes |
| `limits` | `max_retries_per_task` | int (>0) | Positive integer | Yes |
| `limits` | `max_consecutive_review_rejections` | int (>0) | Positive integer | Yes |
| `errors.severity` | `critical` | string[] | List of error category strings | Yes |
| `errors.severity` | `minor` | string[] | List of error category strings | Yes |
| `errors` | `on_critical` | string | `halt` \| `report_and_continue` | Yes |
| `errors` | `on_minor` | string | `retry` \| `halt` \| `skip` | Yes |
| `git` | `strategy` | string | `single_branch` \| `branch_per_phase` \| `branch_per_task` | Yes |
| `git` | `branch_prefix` | string | Any string | Yes |
| `git` | `commit_prefix` | string | Any string | Yes |
| `git` | `auto_commit` | boolean | `true` \| `false` | Yes |
| `human_gates` | `after_planning` | boolean | Must be `true` (hard gate) | Yes |
| `human_gates` | `execution_mode` | string | `ask` \| `phase` \| `task` \| `autonomous` | Yes |
| `human_gates` | `after_final_review` | boolean | Must be `true` (hard gate) | Yes |

#### Validation Rules (from schema doc)

1. `version` must be `"1.0"`
2. All `limits.*` values must be positive integers
3. `errors.severity.critical` and `errors.severity.minor` must not overlap
4. `errors.on_critical` must be one of: `halt`, `report_and_continue`
5. `errors.on_minor` must be one of: `retry`, `halt`, `skip`
6. `git.strategy` must be one of: `single_branch`, `branch_per_phase`, `branch_per_task`
7. `human_gates.execution_mode` must be one of: `ask`, `phase`, `task`, `autonomous`
8. `projects.base_path` must be a valid relative path

**Note**: The schema document describes an optional `agents:` section with per-agent model overrides. The live `orchestration.yml` does NOT have this section. The existing validator warns if it's present (deprecated).

### 5. Prompt Files (`.github/prompts/*.prompt.md`)

**Location**: `.github/prompts/`
**Count**: 1 file

| File | `description` | `agent` | `tools` |
|------|---------------|---------|---------|
| `configure-system.prompt.md` | "Configure the orchestration system..." | `agent` | `read`, `edit`, `search` |

#### Prompt Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | What the prompt does |
| `agent` | string | Optional | Target agent (`agent` = default agent) |
| `tools` | string[] | Optional | Tools available during prompt execution |

**Note**: The existing validator does NOT check prompt files at all.

### 6. Schema Templates (`plan/schemas/`)

**Location**: `plan/schemas/`
**Count**: 15 files

| Template File | Corresponding Skill Template | Match? |
|--------------|------------------------------|--------|
| `architecture-template.md` | `.github/skills/create-architecture/templates/ARCHITECTURE.md` | Conceptual pair |
| `code-review-template.md` | `.github/skills/review-code/templates/CODE-REVIEW.md` | Conceptual pair |
| `design-template.md` | `.github/skills/create-design/templates/DESIGN.md` | Conceptual pair |
| `master-plan-template.md` | `.github/skills/create-master-plan/templates/MASTER-PLAN.md` | Conceptual pair |
| `phase-plan-template.md` | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | Conceptual pair |
| `phase-report-template.md` | `.github/skills/generate-phase-report/templates/PHASE-REPORT.md` | Conceptual pair |
| `phase-review-template.md` | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | Conceptual pair |
| `prd-template.md` | `.github/skills/create-prd/templates/PRD.md` | Conceptual pair |
| `research-findings-template.md` | `.github/skills/research-codebase/templates/RESEARCH-FINDINGS.md` | Conceptual pair |
| `task-handoff-template.md` | `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` | Conceptual pair |
| `task-report-template.md` | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Conceptual pair |
| `state-json-schema.md` | (no skill template) | Schema definition only |
| `status-md-template.md` | (no skill template) | Schema definition only |
| `orchestration-yml-schema.md` | (no skill template) | Schema definition only |
| `cross-agent-dependency-map.md` | (no skill template) | Reference doc only |

**Note**: `plan/schemas/` templates are planning/reference documents from the system design phase. The `.github/skills/*/templates/` templates are the live, agent-facing templates. The validator should focus on the live templates in `.github/skills/`.

### 7. Cross-References

#### How Agents Reference Skills

Agents reference skills by backtick-wrapped name in their `## Skills` section:
```markdown
## Skills
- **`create-prd`**: Primary skill — guides PRD creation...
```
The existing validator extracts these with regex `\`([a-z][a-z0-9-]+)\`` from the Skills section and checks that each referenced name matches an existing skill folder.

#### Agent-to-Skill Map (discovered from agent bodies)

| Agent | Referenced Skills |
|-------|-------------------|
| Research | `research-codebase` |
| Product Manager | `create-prd` |
| UX Designer | `create-design` |
| Architect | `create-architecture`, `create-master-plan` |
| Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| Coder | `generate-task-report`, `run-tests` |
| Reviewer | `review-code`, `review-phase` |
| Orchestrator | (none — delegates to subagents) |

#### How Skills Reference Templates

Skills reference their templates with a relative markdown link:
```markdown
## Template
Use the bundled template: [PRD.md](./templates/PRD.md)
```

#### How Instructions Reference File Patterns

Via `applyTo` frontmatter glob:
```yaml
applyTo: '.github/projects/**'
applyTo: '**/state.json,**/*STATUS.md'
```

#### How `orchestration.yml` References Paths

- `projects.base_path`: `".github/projects"` — determines where project folders live
- All other paths are relative conventions documented in agents/skills, not in the YML itself

### 8. Existing Validator Analysis (`validate-orchestration.js`)

**Size**: 725 lines, 6 check sections + main + helpers

#### What It Already Does

| Check | Coverage | Notes |
|-------|----------|-------|
| **File structure** | ✅ Required folders/files exist | Checks `.github/`, `agents/`, `skills/`, `instructions/`, `prompts/`, `orchestration.yml`, `copilot-instructions.md` |
| **Agent frontmatter** | ✅ Thorough | Validates `name`, `description`, `argument-hint`, `tools`, `agents`. Checks Orchestrator's agent list matches expected 7 subagents |
| **Tool validation** | ✅ Good | Checks against valid toolsets + namespaced tools. Detects deprecated tool names |
| **Skill folders** | ✅ Good | Validates folder exists, SKILL.md exists, `name` matches folder, `description` length, `templates/` subfolder presence |
| **orchestration.yml** | ⚠️ Shallow | Uses string-matching (not full YAML parse). Checks presence of sections/fields but NOT value validation |
| **Instruction files** | ✅ Basic | Checks frontmatter exists, `applyTo` present |
| **Cross-references** | ✅ Good | Validates Orchestrator agents[] match real agent names. Validates skill references in agent bodies point to real skill folders |

#### What's Missing / Could Be Improved

| Gap | Impact | Priority |
|-----|--------|----------|
| **No YAML parsing** for `orchestration.yml` — uses regex/string matching | Can't validate types, enum values, numeric constraints | High |
| **No value validation** for `orchestration.yml` — only checks field presence | Misses invalid enum values (e.g., `strategy: "invalid"`) | High |
| **No prompt file validation** | `configure-system.prompt.md` is completely unchecked | Medium |
| **No validation of `create-skill` anomaly** | Bare file instead of skill directory goes unreported | Low |
| **No ANSI color codes** | Uses emoji only; the idea draft asks for colored output | Medium |
| **No `--fix` or `--json` output modes** | Only console text report | Low |
| **No schema overlap check** | Doesn't check `critical`/`minor` severity list overlap (per schema rules) | Medium |
| **No `human_gates` value enforcement** | `after_planning` and `after_final_review` must be `true` — not checked | Medium |
| **No project-level validation** | Doesn't validate `state.json` or project file naming conventions | Low |
| **Hardcoded expected lists** | `EXPECTED_AGENTS` and `EXPECTED_SKILLS` are hardcoded — could be discovered dynamically | Low |
| **No skill template link validation** | Doesn't check that `./templates/X.md` links in SKILL.md actually resolve | Medium |
| **No agent body structure checks** | Doesn't verify agents have the expected H2 sections (`## Role & Constraints`, etc.) | Low |
| **No description keyword validation** | Doesn't check descriptions are keyword-rich for discovery | Low |
| **No `--watch` mode** | Can't auto-re-run on file changes | Low |
| **`create-agent` references/ subfolder** | Not validated — only `templates/` is checked | Low |

---

## Constraints Discovered

- **Zero npm dependencies**: The existing validator uses no packages. The idea draft says "minimized deps" — keep dependencies to the absolute minimum (consider vendoring or using only core modules).
- **CommonJS module format**: Existing code uses `require()`. Maintain consistency or justify an ESM migration.
- **Custom YAML parser limitations**: The existing parser handles only the simple YAML subset used in frontmatter. For `orchestration.yml` it uses regex. A real YAML parser would be needed for robust config validation but conflicts with zero-deps goal.
- **Windows + Unix paths**: The validator uses `path.join()` consistently, so it works cross-platform.
- **No test suite**: There are no tests for the existing validator itself.
- **Emoji output**: The existing tool uses Unicode emoji (✅ ❌ ⚠️) for pass/fail markers. These render inconsistently in some terminals. ANSI color codes would be more reliable.

---

## Recommendations

- **Add proper YAML value validation** for `orchestration.yml` — at minimum, validate enum fields, type constraints, and the `critical`/`minor` no-overlap rule. Consider a lightweight YAML parser or expand the regex approach.
- **Add ANSI color output** for terminal readability, as specified in the idea draft. Provide a `--no-color` flag for CI/pipe usage.
- **Validate prompt files** — check `description` field presence and `tools` array validity.
- **Add skill template link resolution** — verify that `./templates/X.md` links in SKILL.md bodies actually exist on disk.
- **Add `human_gates` hard gate enforcement** — warn if `after_planning` or `after_final_review` are not `true`.
- **Add severity overlap check** — ensure `critical` and `minor` error lists share no entries.
- **Consider a modular architecture** — the current 725-line single file could be split into modules (e.g., `checks/agents.js`, `checks/skills.js`, etc.) for maintainability and testability.
- **Add `--json` output mode** — emit structured JSON for programmatic consumption (CI integration).
- **Add project-level validation** (optional scope extension) — validate `state.json` against the schema, check project file naming conventions.
- **Flag the `create-skill` anomaly** — it's a bare file, not a directory. Either convert it or explicitly skip it with a note.
