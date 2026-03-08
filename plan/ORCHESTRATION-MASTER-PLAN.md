# Orchestration System — Master Plan

> **Status**: Phase 5 — Integration & Validation (in progress — Task 5.1 complete)  
> **Last Updated**: 2026-03-07  
> **Version**: 0.7.0

---

## 1. Executive Summary

A document-driven agent orchestration system built entirely on **GitHub Copilot's native primitives**: custom agents (`.agent.md`), skills (`SKILL.md`), prompt files (`.prompt.md`), and instruction files (`.instructions.md`). No custom framework, no external runtime — the orchestration system IS the Copilot configuration files.

The system takes a project from idea → PRD → design → architecture → master plan → phased execution → review, using 8 specialized agents coordinated by a read-only orchestrator that spawns subagents.

---

## 2. Architectural Decisions

### 2.1 Platform & Runtime

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | GitHub Copilot agents/skills/prompts (VS Code native) | No custom framework; leverage existing platform |
| Agent model | Copilot agentic coding tools (agent mode) | Each agent = `.agent.md` with defined tools and instructions |
| Parallelism | Sequential with parallel-ready design | Start simple; design interfaces for future parallelism |
| Git strategy | Single feature branch, sequential commits | Avoids merge conflicts in v1; agents commit sequentially |

### 2.2 Agent Architecture

**8 distinct agents**, each a separate `.agent.md` file. Distinct roles prevent conditional complexity.

| Agent | File | Role | Write Access |
|-------|------|------|-------------|
| Orchestrator | `orchestrator.agent.md` | Spawns subagents, reads state, asks human questions | **None** (read-only, strictest) |
| Research | `research.agent.md` | Explores codebase, docs, web for context | Project docs |
| Product Manager | `product-manager.agent.md` | Creates PRD from research output | Project docs |
| UX Designer | `ux-designer.agent.md` | Creates design doc from PRD | Project docs |
| Architect | `architect.agent.md` | Creates architecture doc from PRD + Design | Project docs |
| Tactical Planner | `tactical-planner.agent.md` | Creates phase plans, task handoffs; **sole state writer** | Project docs + STATUS.md + state.json |
| Coder | `coder.agent.md` | Executes tasks, writes code + tests | Source code + task reports |
| Reviewer | `reviewer.agent.md` | Reviews code against plan/design/architecture | Reports only |

**Key constraints:**
- Orchestrator is **read-only** — uses only read tools + agent spawning tool
- Orchestrator spawns all other agents directly (flat hierarchy — subagents cannot spawn each other in Copilot)
- Tactical Planner is the **sole writer** of STATUS.md and state.json

### 2.3 Skill System

**13 skills**, each a folder under `.github/skills/` with `SKILL.md` + bundled templates.

| Skill | Primary Agent(s) | Template(s) Bundled |
|-------|-------------------|---------------------|
| `create-prd` | Product Manager | PRD.md template |
| `create-design` | UX Designer | DESIGN.md template |
| `create-architecture` | Architect | ARCHITECTURE.md template |
| `create-master-plan` | Architect | MASTER-PLAN.md template |
| `create-phase-plan` | Tactical Planner | PHASE-PLAN.md template |
| `create-task-handoff` | Tactical Planner | TASK-HANDOFF.md template |
| `generate-task-report` | Coder | TASK-REPORT.md template |
| `generate-phase-report` | Tactical Planner | PHASE-REPORT.md template |
| `run-tests` | Coder | — |
| `review-code` | Reviewer | CODE-REVIEW.md template |
| `review-phase` | Reviewer | PHASE-REVIEW.md template |
| `research-codebase` | Research | RESEARCH-FINDINGS.md template |
| `create-agent` | (meta-skill) | AGENT.md template + frontmatter-reference.md |

Skills follow the Agent Skills specification. Templates stored with the skill under `templates/`.

**Meta-skill**: The `create-skill` skill already exists at `.github/skills/create-skill` and defines the exact SKILL.md format, frontmatter rules, folder structure, and validation checklist. All new skills MUST follow this specification.

### 2.3.1 Copilot Platform Constraints

Key constraints from the Copilot Agent Skills and Custom Agents specifications that affect implementation:

- **Skill auto-discovery**: The `description` field in SKILL.md frontmatter is the PRIMARY mechanism for Copilot to decide when to load a skill. Must include WHAT it does AND WHEN to use it with keyword-rich text.
- **Progressive disclosure**: Skills load in 3 levels — L1: frontmatter only (always), L2: SKILL.md body (when relevant), L3: resources/templates (on reference). Keep SKILL.md bodies lean.
- **Name = folder**: The `name` frontmatter field MUST match the parent directory name exactly. Lowercase, hyphens only, max 64 chars.
- **Slash commands**: Skills are invokable via `/skill-name` in chat. The `user-invocable` and `disable-model-invocation` fields control visibility.
- **Agent tools**: Agents define allowed tools in `tools: [list]` frontmatter. Only listed tools are available.
- **Agent subagents**: Agents define `agents: [list]` frontmatter to control which other agents they can spawn as subagents.
- **Agent handoffs**: Copilot supports `handoffs` for sequential workflows with UI buttons. We chose subagent spawning instead for programmatic control, but handoffs remain available for future human-guided workflows.
- **Prompt files — valid vs. invalid uses**: Prompt files support `description`, `mode`, and `tools` frontmatter. There is **no `agent:` field** — prompt files cannot route to a specific custom agent. A prompt with `mode: "agent"` runs in the default Copilot agent mode. Valid use: **administrative/utility prompts** (one-shot tasks like system configuration). Invalid use: **pipeline-routing prompts** that try to invoke `@Orchestrator` — users do this directly in chat. The distinction: utility prompts don't care which agent runs them; pipeline prompts do.
- **Instruction file `applyTo` scoping**: Without `applyTo` frontmatter, `.instructions.md` files load on every interaction. All instruction files under `.github/instructions/` MUST have `applyTo` patterns to scope them to relevant file types. Instruction file patterns are static strings — they cannot be read from config files at load time. This means any config value that affects an `applyTo` pattern (e.g., `projects.base_path`) must be propagated to the instruction file on config change.

### 2.4 Pipeline Design

#### Planning Pipeline (sequential, human reviews Master Plan)

```
Orchestrator
  → spawns Research Agent → outputs research findings
  → spawns PM Agent → reads research → outputs PRD
  → spawns Designer Agent → reads PRD → outputs DESIGN
  → spawns Architect Agent → reads PRD + DESIGN → outputs ARCHITECTURE
  → spawns Architect Agent → reads all → outputs MASTER-PLAN
  → ⛔ HUMAN GATE: review Master Plan before execution
```

#### Execution Pipeline (Orchestrator asks human: phase-by-phase / task-by-task / one-shot)

```
Orchestrator (asks human for gate preference)
  → spawns Tactical Planner → reads master plan + state → outputs PHASE-PLAN
  → spawns Tactical Planner → reads phase plan + state → outputs TASK-HANDOFF(s)
  → spawns Coder → reads task handoff ONLY → writes code + tests → outputs TASK-REPORT
  → spawns Reviewer → reads task report + planning docs → outputs review
  → [loop tasks until phase complete]
  → spawns Reviewer → phase-level review → outputs PHASE-REPORT
  → ⛔ HUMAN GATE (if phase-by-phase mode)
  → [loop phases until project complete]
```

#### Final Review Pipeline

```
Orchestrator
  → spawns Reviewer → comprehensive final review → outputs FINAL-REPORT
  → ⛔ HUMAN GATE: approve/reject/iterate
```

### 2.5 State Management

| File | Format | Writer | Purpose |
|------|--------|--------|---------|
| `STATUS.md` | Markdown | Tactical Planner only | Human-readable project state |
| `state.json` | JSON | Tactical Planner only | Machine-parseable state for orchestrator |

### 2.6 Error Handling

**Severity-based:**
- **Minor** (test failures, lint issues, review suggestions): Auto-retry. Tactical Planner generates corrective task. Configurable max retries.
- **Critical** (build breaks, security issues, architectural violations): Fail-fast. Pipeline stops. Human notified via STATUS.md.

### 2.7 Scope Guards

Hard limits configured in `.github/orchestration.yml`:
- Max phases per project
- Max tasks per phase
- Max retries per task
- Severity classification rules

### 2.8 Human-in-the-Loop

- Orchestrator uses `askQuestion` tool to ask human their gate preference at pipeline start
- Options: phase-by-phase, task-by-task, one-shot (autonomous)
- Hard gate after planning pipeline (Master Plan review) unless human explicitly overrides
- Human can inspect STATUS.md at any time

### 2.9 File Naming & Storage

- **Project docs**: `.github/projects/<PROJECT-NAME>/` (path configurable in orchestration.yml)
- **Naming**: SCREAMING-CASE with project prefix: `<NAME>-PRD.md`, `<NAME>-TASK-P01-T03-AUTH.md`
- **Skills**: `.github/skills/<skill-name>/SKILL.md`
- **Agents**: `.github/agents/<agent-name>.agent.md`

### 2.10 V1 Scope

- Full planning pipeline (Idea → PRD → Design → Architecture → Master Plan)
- Single-phase execution (generate phase → generate tasks → code → test → review)
- All 9 agents, all 13 skills
- Designed for expansion to multi-phase autonomous execution

---

## 3. File Structure

```
.github/
├── orchestration.yml                          # System configuration
├── copilot-instructions.md                    # Always-on workspace instructions
├── agents/
│   ├── brainstormer.agent.md
│   ├── orchestrator.agent.md
│   ├── research.agent.md
│   ├── product-manager.agent.md
│   ├── ux-designer.agent.md
│   ├── architect.agent.md
│   ├── tactical-planner.agent.md
│   ├── coder.agent.md
│   └── reviewer.agent.md
├── skills/
│   ├── create-skill                           # (flat file — pre-existing meta-skill)
│   ├── create-agent/                          # Meta-skill for creating new agents
│   │   ├── SKILL.md
│   │   ├── templates/
│   │   │   └── AGENT.md
│   │   └── references/
│   │       └── frontmatter-reference.md
│   ├── create-prd/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── PRD.md
│   ├── create-brainstorming/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── BRAINSTORMING.md
│   ├── create-design/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── DESIGN.md
│   ├── create-architecture/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── ARCHITECTURE.md
│   ├── create-master-plan/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── MASTER-PLAN.md
│   ├── create-phase-plan/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── PHASE-PLAN.md
│   ├── create-task-handoff/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── TASK-HANDOFF.md
│   ├── generate-task-report/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── TASK-REPORT.md
│   ├── generate-phase-report/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── PHASE-REPORT.md
│   ├── run-tests/
│   │   └── SKILL.md
│   ├── review-code/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── CODE-REVIEW.md
│   ├── review-phase/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── PHASE-REVIEW.md
│   └── research-codebase/
│       ├── SKILL.md
│       └── templates/
│           └── RESEARCH-FINDINGS.md
├── instructions/                              # Scoped instruction files
│   ├── project-docs.instructions.md           # applyTo: '.github/projects/**'
│   └── state-management.instructions.md       # applyTo: '**/state.json,**/*STATUS.md'
└── projects/                                  # Project artifacts (path from orchestration.yml)
    └── <PROJECT-NAME>/
        ├── <NAME>-BRAINSTORMING.md
        ├── <NAME>-PRD.md
        ├── <NAME>-DESIGN.md
        ├── <NAME>-ARCHITECTURE.md
        ├── <NAME>-MASTER-PLAN.md
        ├── <NAME>-STATUS.md
        ├── state.json
        ├── phases/
        │   └── <NAME>-PHASE-01-<TITLE>.md
        ├── tasks/
        │   └── <NAME>-TASK-P01-T01-<TITLE>.md
        └── reports/
            ├── <NAME>-TASK-REPORT-P01-T01.md
            └── <NAME>-PHASE-REPORT-P01.md
```

---

## 4. Build Plan

### Build Order: Design-First

All template schemas designed and reviewed → then skills built → then agents → then prompts/integration.

### Phase 1: Design Templates & Schemas ✅ COMPLETE

Design every document schema/template before writing any agent or skill code. Each template will later be placed in its skill's `templates/` folder.

| # | Task | Status | Outputs |
|---|------|--------|---------|
| 1.1 | Design `orchestration.yml` schema | ✅ Done | `plan/schemas/orchestration-yml-schema.md` |
| 1.2 | Design `state.json` schema | ✅ Done | `plan/schemas/state-json-schema.md` |
| 1.3 | Design `TASK-HANDOFF.md` template | ✅ Done | `plan/schemas/task-handoff-template.md` |
| 1.4 | Design `TASK-REPORT.md` template | ✅ Done | `plan/schemas/task-report-template.md` |
| 1.5 | Design `STATUS.md` template | ✅ Done | `plan/schemas/status-md-template.md` |
| 1.6 | Design `PRD.md` template | ✅ Done | `plan/schemas/prd-template.md` |
| 1.7 | Design `DESIGN.md` template | ✅ Done | `plan/schemas/design-template.md` |
| 1.8 | Design `ARCHITECTURE.md` template | ✅ Done | `plan/schemas/architecture-template.md` |
| 1.9 | Design `MASTER-PLAN.md` template | ✅ Done | `plan/schemas/master-plan-template.md` |
| 1.10 | Design `PHASE-PLAN.md` template | ✅ Done | `plan/schemas/phase-plan-template.md` |
| 1.11 | Design `PHASE-REPORT.md` template | ✅ Done | `plan/schemas/phase-report-template.md` |
| 1.12 | Design `RESEARCH-FINDINGS.md` template | ✅ Done | `plan/schemas/research-findings-template.md` |
| 1.13 | Design `CODE-REVIEW.md` template | ✅ Done | `plan/schemas/code-review-template.md` |
| 1.14 | Design `PHASE-REVIEW.md` template | ✅ Done | `plan/schemas/phase-review-template.md` |
| 1.15 | Design cross-agent file dependency map | ✅ Done | `plan/schemas/cross-agent-dependency-map.md` |

### Phase 2: Build Skills ✅ COMPLETE

Create all 12 skill folders with `SKILL.md` files and bundled templates from Phase 1.

| # | Task | Status | Outputs |
|---|------|--------|---------|
| 2.1 | Build `create-prd` skill | ✅ Done | `.github/skills/create-prd/` |
| 2.2 | Build `create-design` skill | ✅ Done | `.github/skills/create-design/` |
| 2.3 | Build `create-architecture` skill | ✅ Done | `.github/skills/create-architecture/` |
| 2.4 | Build `create-master-plan` skill | ✅ Done | `.github/skills/create-master-plan/` |
| 2.5 | Build `create-phase-plan` skill | ✅ Done | `.github/skills/create-phase-plan/` |
| 2.6 | Build `create-task-handoff` skill | ✅ Done | `.github/skills/create-task-handoff/` |
| 2.7 | Build `generate-task-report` skill | ✅ Done | `.github/skills/generate-task-report/` |
| 2.8 | Build `generate-phase-report` skill | ✅ Done | `.github/skills/generate-phase-report/` |
| 2.9 | Build `run-tests` skill | ✅ Done | `.github/skills/run-tests/` |
| 2.10 | Build `review-code` skill | ✅ Done | `.github/skills/review-code/` |
| 2.11 | Build `review-phase` skill | ✅ Done | `.github/skills/review-phase/` |
| 2.12 | Build `research-codebase` skill | ✅ Done | `.github/skills/research-codebase/` |

#### Phase 2 Learnings & Decisions

**Skill structure pattern followed for all 12 skills:**

```
.github/skills/<skill-name>/
├── SKILL.md            # Frontmatter (name + description) + body
└── templates/
    └── <TEMPLATE>.md   # Production template (stripped from schema docs)
```

**What was done:**
1. Each SKILL.md has YAML frontmatter with `name` (matching folder name) and a keyword-rich `description` (50-200 chars, includes WHAT + WHEN + trigger keywords) for Copilot's auto-discovery system.
2. SKILL.md body follows a consistent pattern: title → overview → "When to Use" → "Inputs Required" (table) → "Workflow" (numbered steps) → "Key Rules" (bullets) → "Template" (relative link).
3. Templates were extracted from `plan/schemas/*-template.md` design docs by stripping the schema design notes, field definitions, anti-patterns, and quality checklists — keeping ONLY the production template itself. Quality checklists for the Planner were moved into the SKILL.md body.
4. The `run-tests` skill is instructions-only (no template). It guides test runner discovery across Node.js, Python, Rust, and Go projects.
5. The `create-skill` meta-skill at `.github/skills/create-skill` is a flat file (not a directory) — it predates this project. All 12 new skills were created as proper directories.

**Key observation for Phase 3 agent:** Each skill's "Inputs Required" table and "Key Rules" section define exactly what an agent using that skill needs to read and write. These map directly to the cross-agent dependency map at `plan/schemas/cross-agent-dependency-map.md`. When building agents, reference the skill SKILL.md files to understand what each agent's workflow looks like.

**Skill-to-Agent mapping (for Phase 3):**
| Agent | Skills it uses | Read access | Write access |
|-------|---------------|-------------|-------------|
| Brainstormer | `create-brainstorming` | (conversation context) | BRAINSTORMING |
| Research | `research-codebase` | BRAINSTORMING | RESEARCH-FINDINGS |
| Product Manager | `create-prd` | BRAINSTORMING, RESEARCH-FINDINGS | PRD |
| UX Designer | `create-design` | PRD, RESEARCH-FINDINGS | DESIGN |
| Architect | `create-architecture`, `create-master-plan` | PRD, DESIGN, RESEARCH-FINDINGS | ARCHITECTURE, MASTER-PLAN |
| Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-phase-report` | MASTER-PLAN, ARCHITECTURE, DESIGN, state.json, orchestration.yml, task reports, code reviews | PHASE-PLAN, TASK-HANDOFF, PHASE-REPORT, STATUS.md, state.json |
| Coder | `generate-task-report`, `run-tests` | TASK-HANDOFF (sole input) | Source code, tests, TASK-REPORT |
| Reviewer | `review-code`, `review-phase` | TASK-REPORT, TASK-HANDOFF, ARCHITECTURE, DESIGN, PRD, source code | CODE-REVIEW, PHASE-REVIEW |
| Orchestrator | (none — reads state only) | state.json, STATUS.md, orchestration.yml | **NOTHING** (read-only) |

### Phase 3: Build Agents ✅ COMPLETE

Create all 8 agent `.agent.md` files at `.github/agents/` with proper tool lists, subagent configs, and instructions.

| # | Task | Status | Outputs |
|---|------|--------|---------|
| 3.1 | Build `orchestrator.agent.md` | ✅ Done | `.github/agents/orchestrator.agent.md` |
| 3.2 | Build `research.agent.md` | ✅ Done | `.github/agents/research.agent.md` |
| 3.3 | Build `product-manager.agent.md` | ✅ Done | `.github/agents/product-manager.agent.md` |
| 3.4 | Build `ux-designer.agent.md` | ✅ Done | `.github/agents/ux-designer.agent.md` |
| 3.5 | Build `architect.agent.md` | ✅ Done | `.github/agents/architect.agent.md` |
| 3.6 | Build `tactical-planner.agent.md` | ✅ Done | `.github/agents/tactical-planner.agent.md` |
| 3.7 | Build `coder.agent.md` | ✅ Done | `.github/agents/coder.agent.md` |
| 3.8 | Build `reviewer.agent.md` | ✅ Done | `.github/agents/reviewer.agent.md` |

#### Phase 3 Learnings & Decisions

**Agent file structure pattern followed for all 8 agents:**

```
.github/agents/<agent-name>.agent.md
```

Each file has YAML frontmatter (`name`, `description`, `tools`, optionally `agents`) + a markdown body.

**What was done:**

1. Each agent has YAML frontmatter with:
   - `name`: Display name (e.g., "Orchestrator", "Tactical Planner")
   - `description`: Keyword-rich description for Copilot's agent discovery — includes WHAT the agent does AND WHEN to use it
   - `tools`: Principle of least privilege — only the tools each agent needs
   - `agents`: Only the Orchestrator has this field, listing all 7 other agents for subagent spawning

2. Agent body follows a consistent pattern: Role heading → Role & Constraints (do/do NOT/write access) → Workflow (numbered steps per mode) → Skills (linked skills) → Output Contract (table) → Quality Standards

3. Multi-modal agents (Architect has Architecture + Master Plan modes; Reviewer has Code Review + Phase Review + Final Review modes; Tactical Planner has 5 modes: Initialize, Update State, Create Phase Plan, Create Task Handoff, Generate Phase Report) use numbered "Mode" sections.

4. The Orchestrator encodes the full decision logic from `plan/schemas/state-json-schema.md` pseudocode directly in its body — it can determine the next action by reading `state.json` and following the decision tree.

5. Every agent explicitly states what it does NOT do and its write access boundaries to prevent scope creep.

**Tool permissions summary (as implemented — corrected for namespaced tools):**

| Agent | tools | agents |
|-------|-------|--------|
| Orchestrator | `read, search, agent` | `Research, Product Manager, UX Designer, Architect, Tactical Planner, Coder, Reviewer` |
| Research | `read, search, edit, web/fetch, todo` | `[]` |
| Product Manager | `read, search, edit, todo` | `[]` |
| UX Designer | `read, search, edit, todo` | `[]` |
| Architect | `read, search, edit, todo` | `[]` |
| Tactical Planner | `read, search, edit, todo` | `[]` |
| Coder | `read, search, edit, execute, todo` | `[]` |
| Reviewer | `read, search, edit, execute, todo` | `[]` |

**Key design decisions (updated after tool namespacing fix):**
- **All tools are now namespaced**: Old names (`readFile`, `editFile`, `createFile`, `findFiles`, `runInTerminal`, `fetchWebpage`) are deprecated. Use toolsets (`read`, `search`, `edit`, `execute`, `web`) or namespaced individual tools (`read/readFile`, `edit/editFiles`).
- **`agent` tool is required**: The Orchestrator must include `agent` in its `tools` list to use `agents` array — this was a critical bug fixed in session #4.
- **`agents: []` explicitly set**: All non-orchestrator agents explicitly declare `agents: []` to prevent unintended subagent spawning.
- **Agent names in `agents` array use display names**: Must match the `name` field (e.g., `Tactical Planner`), not the filename stem (e.g., `tactical-planner`).
- **`argument-hint` added to all agents**: Provides guidance on what input to provide when the agent is selected.
- **`todo` tool added to worker agents**: Enables progress tracking for multi-step workflows (all agents except the read-only Orchestrator).
- **Toolsets preferred over individual tools**: Simpler, more maintainable, and forward-compatible as new tools are added to categories.

**Skill bindings (as documented in agent bodies):**

| Agent | Skills Referenced |
|-------|------------------|
| Research | `research-codebase` |
| Product Manager | `create-prd` |
| UX Designer | `create-design` |
| Architect | `create-architecture`, `create-master-plan` |
| Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| Coder | `generate-task-report`, `run-tests` |
| Reviewer | `review-code`, `review-phase` |
| Orchestrator | (none — reads state only) |

**Note for Phase 4 agent**: The agents are now complete but need workspace-level glue:
1. `copilot-instructions.md` should reference the orchestration system and tell Copilot about the agents.
2. `.instructions.md` files may be needed for cross-cutting concerns (e.g., "always use the project's naming convention").
3. Prompt files (`.prompt.md`) could provide quick-start workflows (e.g., "start a new project" prompt that invokes the Orchestrator).

**New skill created**: `create-agent` skill was built at `.github/skills/create-agent/` to enable creating new agents in the orchestration system. It includes:
- `SKILL.md` — Workflow, key rules, tool selection guide, validation checklist
- `templates/AGENT.md` — Production template matching the established agent body pattern
- `references/frontmatter-reference.md` — Complete tool/toolset/model reference for frontmatter authoring

This brings the total skill count to **13** (12 original + 1 new `create-agent` skill).

### Phase 4: Build Prompts & Instructions ✅ COMPLETE (reworked in session #6)

Create workspace configuration, instruction files, and the central config file. ~~Prompt files~~ were removed after review — see learnings.

| # | Task | Status | Outputs |
|---|------|--------|---------|
| 4.1 | Create workspace `copilot-instructions.md` | ✅ Done | `.github/copilot-instructions.md` |
| 4.2 | Create scoped `.instructions.md` files | ✅ Done | `.github/instructions/` (2 files) |
| 4.3 | ~~Create pipeline prompt files~~ | ❌ Removed | Deleted in rework — invalid frontmatter, no routing mechanism |
| 4.4 | Create `orchestration.yml` config file | ✅ Done | `.github/orchestration.yml` |
| 4.5 | ~~Create `agent-development.instructions.md`~~ | ❌ Removed | Deleted in rework — redundant with `create-agent` + `create-skill` skills |
| 4.6 | Create `configure-system.prompt.md` utility prompt | ✅ Done | `.github/prompts/configure-system.prompt.md` |

#### Phase 4 Learnings & Decisions

**Session #5 — initial build:**

Created `copilot-instructions.md`, 3 instruction files, 3 prompt files, and `orchestration.yml`. See session log.

**Session #6 — cohesion review & rework:**

A comprehensive review found several alignment issues that were corrected:

**Issue 1: Hardcoded project paths**
- `copilot-instructions.md` and `project-docs.instructions.md` hardcoded `.github/projects/` instead of referencing `orchestration.yml` as the authority.
- **Fix**: Both files now reference `orchestration.yml → projects.base_path` and note the default. The agents already used `{base_path}` placeholders — they were correct.

**Issue 2: `agent-development.instructions.md` was redundant**
- The `create-agent` skill (`.github/skills/create-agent/`) already teaches agent creation: frontmatter, tool selection, body structure, validation checklist.
- The `create-skill` meta-skill already teaches skill creation: frontmatter, folder structure, description best practices.
- The instruction file duplicated content from both skills (tool permissions table, frontmatter rules) and had no `applyTo` scoping — so it loaded on EVERY interaction, polluting agent sessions that would never create agents.
- **Fix**: Deleted entirely. The meta-skills are the authoritative sources for agent/skill development rules. They load only when relevant (Copilot's progressive skill loading).

**Issue 3: Prompt files had invalid frontmatter and couldn't route to agents**
- All 3 prompt files used `agent: "Orchestrator"` in frontmatter — this is not a valid Copilot prompt file field. Valid fields: `description`, `mode`, `tools`.
- There is **no mechanism in Copilot prompt files to route to a specific custom agent**. A prompt with `mode: "agent"` runs with the default Copilot agent in agent mode, not with `@Orchestrator`.
- The prompts couldn't deliver their stated purpose (starting, continuing, or checking project status via the Orchestrator).
- The Orchestrator already handles all three entry points via its decision logic — the prompts added no value.
- **Fix**: Deleted all 3 prompt files. Users invoke `@Orchestrator` directly in the chat panel.
- **Learning**: Copilot prompt files are pre-fill templates for chat messages, not routing mechanisms. They can't target custom agents.

**Issue 4: Remaining instruction files lacked `applyTo` scoping**
- Copilot instruction files in `.github/instructions/` without `applyTo` frontmatter load on **every** interaction.
- `project-docs.instructions.md` should only load when working with project documents.
- `state-management.instructions.md` should only load when working with state files.
- **Fix**: Added `applyTo` frontmatter to both:
  - `project-docs.instructions.md`: `applyTo: '.github/projects/**'`
  - `state-management.instructions.md`: `applyTo: '**/state.json,**/*STATUS.md'`

**Issue 5: `orchestration.yml` agents section was unenforceable**
- The `agents.*.model` section defined per-agent model overrides, but Copilot reads model selection from the `.agent.md` frontmatter `model` field — not from external YAML.
- There is no mechanism to dynamically read orchestration.yml and apply model overrides at agent spawn time.
- This section was aspirational with no enforcement path.
- **Fix**: Removed the `agents` section entirely. Model selection belongs in `.agent.md` frontmatter. Added a comment pointing to agent files for model config.

**Issue 6: `orchestration.yml` enforcement model — clarified**
- The current design is correct: `orchestration.yml` is read at project initialization, limits are copied into `state.json`, and `state.json` is the runtime authority.
- The Orchestrator reads `orchestration.yml` at start for `base_path` and `human_gates`.
- The Tactical Planner reads it during project init and copies `limits` into `state.json`.
- The Tactical Planner enforces limits from `state.json` on every state write — this is efficient (no repeated YAML parsing) and makes state.json self-contained.
- **Decision**: No changes to agent files needed. The load-once model is the right design for v1. If hot-reloadable config is needed later, the Tactical Planner can be updated to re-read orchestration.yml on state writes.

**Complete workspace file tree after Phase 4 rework:**

```
.github/
├── orchestration.yml                          # System configuration
├── copilot-instructions.md                    # Always-on workspace instructions
├── agents/                                    # 8 agent files (from Phase 3)
│   ├── orchestrator.agent.md
│   ├── research.agent.md
│   ├── product-manager.agent.md
│   ├── ux-designer.agent.md
│   ├── architect.agent.md
│   ├── tactical-planner.agent.md
│   ├── coder.agent.md
│   └── reviewer.agent.md
├── skills/                                    # 13 skill folders (from Phase 2)
│   ├── create-agent/
│   ├── create-architecture/
│   ├── create-design/
│   ├── create-master-plan/
│   ├── create-phase-plan/
│   ├── create-prd/
│   ├── create-skill                           # (flat file — pre-existing meta-skill)
│   ├── create-task-handoff/
│   ├── generate-phase-report/
│   ├── generate-task-report/
│   ├── research-codebase/
│   ├── review-code/
│   ├── review-phase/
│   └── run-tests/
├── instructions/                              # Scoped instruction files (applyTo patterns)
│   ├── project-docs.instructions.md           # applyTo: '.github/projects/**'
│   └── state-management.instructions.md       # applyTo: '**/state.json,**/*STATUS.md'
├── prompts/                                   # Utility prompt files (not pipeline routing)
│   └── configure-system.prompt.md              # Admin utility: configure orchestration.yml, propagate changes
├── orchestration/                             # (empty — reserved for future use)
└── projects/                                  # Project artifacts (path from orchestration.yml)
```

**Note for Phase 5 agent**: The orchestration system is now structurally complete with good cohesion:
- 8 agents with frontmatter, tools, skill bindings, and multi-mode workflows
- 13 skills with SKILL.md files and production templates (including 2 meta-skills: `create-agent`, `create-skill`)
- 1 config file (`orchestration.yml`) — authority for paths, limits, errors, gates, git strategy. No dead-weight sections.
- 1 admin utility prompt (`configure-system.prompt.md`) — safe to use in agent mode; creates/updates `orchestration.yml`, scans `.github/` for stale path references, propagates changes.
- 1 workspace instruction file (`copilot-instructions.md`) — always-on context for the orchestration system
- 2 scoped instruction files — targeted context injection via `applyTo` patterns
- Users invoke `@Orchestrator` directly in chat — no intermediate prompt files

**Configuration enforcement chain:**
1. `orchestration.yml` → read by Orchestrator (base_path, human_gates) and Tactical Planner (limits, at init)
2. Tactical Planner copies limits into `state.json` at project init
3. `state.json` is the runtime authority — Tactical Planner validates against it on every write
4. Model selection → `.agent.md` frontmatter (Copilot-native, not orchestration.yml)

### Phase 5: Integration & Validation ← CURRENT

End-to-end testing of the orchestration pipeline.

| # | Task | Status | Outputs |
|---|------|--------|---------|
| 5.1 | Static validation of all orchestration files | ✅ Done | `validate-orchestration.js` — 144 checks, 0 failures, 13 warnings |
| 5.2 | Test planning pipeline (idea → master plan) | ⬜ Not Started | Test results |
| 5.3 | Test execution pipeline (single phase) | ⬜ Not Started | Test results |
| 5.4 | Test error handling & scope guards | ⬜ Not Started | Test results |
| 5.5 | Documentation pass | ⬜ Not Started | README / usage guide |

#### Phase 5 Learnings & Decisions (ongoing)

**Session #8 — Task 5.1: Static Validation Script**

Built `validate-orchestration.js` at the workspace root — a Node.js (CommonJS) script with no external dependencies. Runs 144 checks across 6 categories:

1. **File structure**: all required folders and files exist
2. **Agent files (8)**: frontmatter parsing, tool name validity, agents[] content, argument-hint presence
3. **Skill files (13)**: name matches folder, description present, templates/ subfolder and template files exist
4. **orchestration.yml**: all required sections and sub-fields present
5. **Instruction files**: applyTo frontmatter scoping present on every file
6. **Cross-references**: Orchestrator agents[] names match real agent name fields; all skill names referenced in agent bodies exist as real skill folders

**Results: 131 passed, 13 warnings, 0 failures**

**Issues found and fixed:**
- `.github/projects/` folder did not exist yet → created with `.gitkeep`. The Tactical Planner creates project subfolders here; the parent should pre-exist.
- Windows CRLF line endings caused the cross-reference regex to find no skill references in agent bodies on first run → fixed by normalizing `\r\n` → `\n` before matching.

**Outstanding warnings (by design — not blocking):**
- All 13 skill SKILL.md `description` fields are 322–438 chars. The Phase 2 spec recommendation was 50–200 chars. These were written with intentionally rich keyword text for Copilot auto-discovery. The validator now reports them as warnings. Decision: **accept as-is for v1**. The longer descriptions increase keyword coverage for auto-discovery; the token cost is minimal at L1 scan. If auto-discovery noise becomes a problem in testing, trim to ≤200 chars.

**Next steps (Task 5.2):**
With static validation clean, start the E2E planning pipeline test:
- Open new chat, invoke `@Orchestrator` with the VALIDATOR project idea (a Node.js CLI that validates `.github/` orchestration files)
- Observe: Tactical Planner init → Research → PRD → Design → Architecture → Master Plan → Human gate
- Validate state.json + STATUS.md created and updated correctly after each step

---

## 5. Open Design Questions

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| Q1 | What fields belong in state.json? | ✅ Resolved | See `plan/schemas/state-json-schema.md` — full schema with pipeline tier, phase/task tracking, error aggregation, limits copy |
| Q2 | What's configurable in orchestration.yml beyond limits and paths? | ✅ Resolved | See `plan/schemas/orchestration-yml-schema.md` — adds severity classification lists, git strategy, human gate defaults. Per-agent model overrides were removed (session #6) — model selection belongs in `.agent.md` frontmatter, not external YAML. |
| Q3 | Severity classification: what's minor vs critical? | ✅ Resolved | Critical: build_failure, security_vulnerability, architectural_violation, data_loss_risk. Minor: test_failure, lint_error, review_suggestion, missing_test_coverage, style_violation |
| Q4 | Orchestrator needs `agent` tool for subagent spawning — confirm tool list | ✅ Resolved | Orchestrator gets: `tools: ['read', 'search', 'agent']` + `agents: ['Research', 'Product Manager', ...]`. The `agent` tool is **required** when the `agents` array is non-empty (Rule 1). Agent names in `agents` must match the `name` field in the target `.agent.md`, not the filename. |
| Q5 | Cross-agent file read/write dependency graph | ✅ Resolved | See `plan/schemas/cross-agent-dependency-map.md` — full R/W matrix, data flow diagram, sole-writer rules |
| Q6 | How does Orchestrator "ask human" if it's read-only? (needs askQuestion tool) | ✅ Resolved | In Copilot agent mode, asking the user a question is a chat response, not a file write. The Orchestrator can ask questions and display information as part of the chat conversation. No special tool needed — it's inherent to being an agent. |

---

## 6. Session Log

| Date | Session | Work Completed |
|------|---------|----------------|
| 2025-03-07 | #1 | Brainstorming: reviewed draft, identified gaps, surveyed all architectural decisions, created master plan |
| 2025-03-07 | #1 | Phase 1 complete: designed all 14 document templates + orchestration.yml + state.json + cross-agent dependency map |
| 2025-03-07 | #1 | Handoff review: resolved all 6 open design questions, added Copilot platform constraints (Section 2.3.1), added Phase 2 agent instructions, referenced create-skill meta-skill |
| 2026-03-07 | #2 | Phase 2 complete: built all 12 skills (SKILL.md + templates) under `.github/skills/` following create-skill meta-spec |
| 2026-03-07 | #2 | Updated master plan with Phase 2 learnings, skill-to-agent mapping table, and Phase 3 agent instructions for context continuity |
| 2026-03-07 | #3 | Phase 3 complete: built all 8 agents (`.agent.md` files) under `.github/agents/` with frontmatter, tool permissions, skill bindings, and multi-mode workflows |
| 2026-03-07 | #3 | Updated master plan with Phase 3 learnings, tool permissions table, skill bindings table, and Phase 4 notes for context continuity |
| 2026-03-07 | #4 | Phase 3 fix: corrected all 8 agents' frontmatter — migrated deprecated tool names to namespaced format (toolsets), added missing `agent` tool to Orchestrator, added `argument-hint` and `todo` to all agents, fixed agent names in `agents` array to use display names, set `agents: []` explicitly on all non-orchestrator agents |
| 2026-03-07 | #4 | Created `create-agent` skill (`.github/skills/create-agent/`) with SKILL.md, AGENT.md template, and frontmatter-reference.md — brings total skills to 13 |
| 2026-03-07 | #4 | Updated master plan with corrected tool permissions table, namespacing learnings, Q4 resolution fix, and new skill documentation |
| 2026-03-07 | #5 | Phase 4 complete: created `copilot-instructions.md` (always-on workspace instructions), 3 `.instructions.md` files (project-docs, state-management, agent-development), 3 `.prompt.md` files (start-project, continue-project, project-status), and `orchestration.yml` config file |
| 2026-03-07 | #5 | Updated master plan with Phase 4 learnings, complete file tree, and Phase 5 preparation notes |
| 2026-03-07 | #6 | Phase 4 rework: comprehensive cohesion review — deleted `agent-development.instructions.md` (redundant with meta-skills), deleted all 3 prompt files (invalid frontmatter, no agent routing mechanism), added `applyTo` scoping to remaining instruction files, removed unenforceable `agents` section from `orchestration.yml`, fixed hardcoded paths to reference `orchestration.yml` as authority |
| 2026-03-07 | #6 | Updated master plan with Phase 4 rework learnings, corrected file tree, documented configuration enforcement chain, and clarified Copilot platform constraints (prompt files cannot route to custom agents, instruction files need `applyTo` scoping, model selection lives in `.agent.md` frontmatter) |
| 2026-03-07 | #7 | Created `configure-system.prompt.md` — an admin utility prompt (mode: agent, no custom agent routing) that creates/updates `orchestration.yml` and propagates `projects.base_path` changes across all instruction files and any other hardcoded path references in `.github/`. Clarified distinction: utility prompts (administrative, one-shot) are valid; pipeline-routing prompts (trying to invoke @Orchestrator) are not supported by the platform. |
| 2026-03-07 | #7 | Updated master plan Phase 4 task table (task 4.6 added), file tree (prompts/ now shows configure-system.prompt.md) |
| 2026-03-07 | #8 | Task 5.1 complete: built `validate-orchestration.js` — 144 checks, 131 passed, 0 failures, 13 warnings (all skill descriptions over 200-char spec; accepted as-is for v1). Created `.github/projects/` with `.gitkeep`. Fixed Windows CRLF line endings in cross-reference regex. Updated task table and Phase 5 learnings section. |

---

## 7. References

- [Original brainstorming draft](orchestration-human-draft.md)
- [GitHub Copilot Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files)
- [Custom Instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Agent Skills Specification](https://agentskills.io/specification)
