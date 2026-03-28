# Agents

The orchestration system uses 10 specialized agents, each with a defined role, scoped tool access, and strict write permissions. Agents communicate through structured markdown documents — never through shared memory or message passing.

## Agent Overview

| Agent | Role | Writes |
|-------|------|--------|
| **Brainstormer** | Collaborative ideation with the human | `BRAINSTORMING.md` |
| **Orchestrator** | Pipeline coordination — spawns agents, reads state | `ERROR-LOG.md` (via log-error skill) |
| **Research** | Codebase and context exploration | `RESEARCH-FINDINGS.md` |
| **Product Manager** | Requirements definition | `PRD.md` |
| **UX Designer** | Interface and interaction design | `DESIGN.md` |
| **Architect** | System architecture and master planning | `ARCHITECTURE.md`, `MASTER-PLAN.md` |
| **Tactical Planner** | Task breakdown and phase reporting | `PHASE-PLAN.md`, `TASK-HANDOFF.md`, `PHASE-REPORT.md` |
| **Coder** | Code implementation | Code, tests, `TASK-REPORT.md` |
| **Reviewer** | Code and phase review | `CODE-REVIEW.md`, `PHASE-REVIEW.md` |
| **Source Control Agent** | Thin-router for git operations — commit and push (PR stubbed for AUTO-PR) | Code (via `git-commit.js` script only) |



---

## Agent Details

### Brainstormer

**Purpose:** Collaboratively explore and refine project ideas before entering the pipeline.

The Brainstormer works directly with the human in a conversational loop — asking probing questions, exploring trade-offs, identifying scope boundaries, and converging on a well-defined goals. It operates outside the main pipeline and is entirely optional.

**Input:** Human prompts and whatever you want.

**Output:** `BRAINSTORMING.md` — validated ideas, scope boundaries, target users, and problem statements.

**Skills:** `orchestration`, `brainstorm`

---

### Orchestrator

**Purpose:** Read project state and coordinate the pipeline by spawning the right agent at the right time.

The Orchestrator is the entry point for all project interactions. It signals events to `pipeline.js`, parses the JSON result, and routes on a 20-action table to spawn the appropriate agent, present human gates, or display terminal messages. When the pipeline returns a failure result, the Orchestrator invokes the log-error skill to append a structured entry to the project's ERROR-LOG.md.

**Input:** Human prompts, `state.json`, pipeline script results
**Output:** None — strictly read-only, prompts agents to do work.

**Skills:** `orchestration`, `log-error`

---

### Research

**Purpose:** Explore the codebase, documentation, and external sources to gather technical context.

The Research agent analyzes the existing project structure, technology stack, patterns, and constraints. If a `BRAINSTORMING.md` exists, it uses that as input context.

**Input:** Codebase, documentation, `BRAINSTORMING.md` (if exists)

**Output:** `RESEARCH-FINDINGS.md` — codebase analysis, technology inventory, patterns discovered, constraints, and recommendations.

**Skills:** `orchestration`, `research-codebase`

---

### Product Manager

**Purpose:** Create a Product Requirements Document from research findings to keep plans grounded in reality.

Translates technical research and brainstorming output into structured requirements with numbered items (FR-1, NFR-1) for cross-referencing throughout the pipeline.

**Input:** `RESEARCH-FINDINGS.md`, `BRAINSTORMING.md`

**Output:** `PRD.md` — functional requirements, non-functional requirements, user stories, etc.

**Skills:** `orchestration`, `create-prd`

---

### UX Designer

**Purpose:** Create a UX Design document from the PRD.

Defines user flows, component layouts, interaction states, responsive behavior, accessibility requirements, and design tokens.

**Input:** `PRD.md`

**Output:** `DESIGN.md` — user flows, layout specifications, component definitions, states, breakpoints, and accessibility requirements.

**Skills:** `orchestration`, `create-design`

---

### Architect

**Purpose:** Define system architecture and synthesize all planning documents into a Master Plan.

The Architect reads Research, PRD, and Design to produce the technical architecture — system layers, module map, API contracts, database schemas, interfaces, and dependency graphs. It then synthesizes all planning documents into a Master Plan with high level a phased execution plan.

**Input:** `RESEARCH-FINDINGS.md`, `PRD.md`, `DESIGN.md`

**Output:** `ARCHITECTURE.md`, `MASTER-PLAN.md`

**Skills:** `orchestration`, `create-architecture`, `create-master-plan`

---

### Tactical Planner

**Purpose:** Builds individual phase plans, breaks phases into tasks, creates self-contained task handoffs, and generates phase reports.  All plans and tasks created reference the planning documents to keep the work grounded in the original plans.  

The tactical planner also reviews the Coder / Reviewer agents reports and reviews to keep the plans grounded in the current reality of the code.  For example, ff a code review fails, the task planner will issue corrective tasks.

The Tactical Planner is a pure planning agent that operates in 3 modes:

1. **Phase planning** — break a phase into tasks with dependencies and execution order
2. **Task handoffs** — create self-contained coding instructions for the Coder
3. **Phase reports** — aggregate task results and assess exit criteria

**Input:** `ARCHITECTURE.md`, `PRD.md`, `MASTER-PLAN.md`, `DESIGN.md`, `CODE-REVIEW.md`, `TASK-REPORT.md`, `state.json`

**Output:**`PHASE-PLAN.md`, `PHASE-REPORT.md`, `TASK-HANDOFF.md`

**Skills:** `orchestration`, `create-phase-plan`, `create-task-handoff`, `generate-phase-report`

---

### Coder

**Purpose:** Execute coding tasks from self-contained Task Handoff documents.

Reads a single Task Handoff, implements the code changes, writes tests, runs the build, and produces a Task Report documenting what was done, what changed, and any deviations or discoveries.

**Input:** `TASK-HANDOFF.md`

**Output:** Source code, tests, `TASK-REPORT.md`

**Skills:** `orchestration`, `execute-coding-task`, `generate-task-report`, `run-tests`

---

### Reviewer

**Purpose:** Review code changes and entire phases checking for code quality, bugs, etc.  It also checks the code against all the planning documents to ensure the code is meeting all expected requirements.

Issues found by the reviewer will signal for corrective tasks.  The Tactical Planner uses this to course correct the execution leading to code that works right the first time.

The Reviewer operates at three levels:
- **Code review** — evaluates individual task output against PRD, architecture, and design
- **Phase review** — assesses cross-task integration, module consistency, and exit criteria
- **Final review** — comprehensive project-level review before completion

**Input:** Code changes, `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PHASE-PLAN.md`, `TASK-REPORT.md`

**Output:** `CODE-REVIEW.md`, `PHASE-REVIEW.md`

**Skills:** `orchestration`, `review-task`, `review-phase`

---

### Source Control Agent

**Purpose:** Execute git commit and push operations after approved tasks, delegating all logic to the `source-control` skill.

The Source Control Agent is a thin router — it loads the `source-control` skill and delegates entirely to the skill's routing table. In commit mode, it reads `pipeline.source_control` from state, constructs a conventional commit message, and runs `git-commit.js` to stage, commit, and push. In PR mode (AUTO-PR), it will delegate to `pr-guide.md` and `gh-pr.js` — both are currently stubs.

**Modes:**

| Mode | Trigger Action | Skill Reference | Script |
|------|---------------|-----------------|--------|
| commit | `invoke_source_control_commit` | `references/operations-guide.md` | `scripts/git-commit.js` |
| PR *(AUTO-PR)* | `invoke_source_control_pr` | `references/pr-guide.md` *(stub)* | `scripts/gh-pr.js` *(stub)* |

**Tool restrictions:** `read`, `execute`, `todo` only — no `edit` tool. Source files are the Coder's domain.

**Input:** `state.json` (`pipeline.source_control` sub-object), task handoff title (for commit message prefix)

**Output:** Structured commit result (commit hash, push status, errors) signaled back via `task_committed` event.

**Skills:** `orchestration`, `source-control`

## Next Steps

- [Skills](skills.md) — Explore the 19 skill bundles agents use
- [Templates](templates.md) — See the 16 output templates skills produce

