---
project: "SKILL-RECOMMENDATION"
author: "research-agent"
created: "2026-03-15T00:00:00Z"
---

# SKILL-RECOMMENDATION — Research Findings

## Research Scope

Investigated two behavioral gaps in the planning pipeline: (1) the `skills_required`/`skills_optional` fields in task handoffs are populated with technology labels instead of `.github/skills/` skill names, and (2) the UX Designer always produces a full Design document even for non-UI projects. Analyzed the relevant skills, agents, templates, documentation, and ~30 existing task handoff examples across active and archived projects.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| create-task-handoff skill | `.github/skills/create-task-handoff/SKILL.md` | **Primary target** — no instruction to enumerate `.github/skills/` or select Coder-relevant skills; workflow does not mention the skills field at all |
| Task handoff template | `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` | **Primary target** — contains `skills_required` and `skills_optional` frontmatter fields with placeholder values and no clarifying comment |
| UX Designer agent | `.github/agents/ux-designer.agent.md` | **Primary target** — no triage step; always produces a full Design document regardless of project type |
| create-design skill | `.github/skills/create-design/SKILL.md` | **Primary target** — no triage logic; always uses the full DESIGN.md template |
| Design template | `.github/skills/create-design/templates/DESIGN.md` | Full template with layout, components, tokens, accessibility, responsive sections; no lightweight or stub variant exists |
| Coder agent | `.github/agents/coder.agent.md` | Does NOT reference `skills_required` or `skills_optional` — the Coder has no instruction to consult these fields |
| Tactical Planner agent | `.github/agents/tactical-planner.agent.md` | Creates handoffs via `create-task-handoff` skill; no mention of skill discovery or enumeration |
| Skills documentation | `docs/skills.md` | Lists all skills and agent-skill composition; does not mention skill selection during handoff creation |
| Agents documentation | `docs/agents.md` | Describes all agents; does not mention skill recommendation in Tactical Planner or skill consumption by Coder |

### Existing Patterns

- **Self-contained handoff principle**: The Coder reads ONLY the task handoff. Everything needed must be inlined — contracts, design tokens, file paths. This is enforced by the `create-task-handoff` skill and Coder agent instructions.
- **Skill-agent composition**: Each agent declares its skills in `.agent.md` frontmatter. The Coder currently has `generate-task-report` and `run-tests`. Skills are discovered by Copilot via description-based matching.
- **Template-driven documents**: Every document type has a bundled template in the skill's `templates/` folder. Agents use the template, not custom formats.
- **Sole Writer Policy**: Each document type has exactly one writer agent. DESIGN.md → UX Designer. TASK-HANDOFF.md → Tactical Planner.
- **Pipeline expects DESIGN.md to exist**: Downstream agents (Architect, Tactical Planner) read the Design doc. The pipeline flow assumes it is always produced, even if the content is minimal.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Orchestration | Markdown + YAML frontmatter | — | All agent communication is structured markdown |
| Agents | `.agent.md` files | VS Code Agent API | Custom agents with tool declarations |
| Skills | `SKILL.md` + templates | VS Code Skill API | Reusable capability bundles |
| Config | `orchestration.yml` | YAML | Pipeline limits, error handling, git strategy |

## Existing Task Handoff Skills Field Analysis

### Values Found in ~30 Existing Task Handoffs

| Category | Example Values | Count | Correct? |
|----------|---------------|-------|----------|
| Technology labels | `"typescript"`, `"nodejs"`, `"React"`, `"Tailwind CSS"` | ~15 tasks | **No** — these are not `.github/skills/` names |
| Activity labels | `"code"`, `"coding"`, `"code-modification"`, `"test-update"`, `"scaffold"`, `"npm"`, `"integration"`, `"domain logic"`, `"UI components"`, `"accessibility"` | ~8 tasks | **No** — these are not `.github/skills/` names |
| Actual skill names | `"run-tests"` (3 tasks), `"research-codebase"` (1 task) | 4 tasks | **Yes** — these exist in `.github/skills/` |
| Empty arrays | `[]` | ~12 tasks | Neutral — no guidance given |

### Representative Examples

| Project | Task | `skills_required` | `skills_optional` |
|---------|------|-------------------|-------------------|
| UI-LIVE-PROJECTS | P01-T01 | `["typescript", "nodejs", "chokidar"]` | `[]` |
| UI-MARKDOWN-IMPROVEMENTS | P04-T03 | `["React", "TypeScript", "accessibility"]` | `["Tailwind CSS"]` |
| UI-MARKDOWN-IMPROVEMENTS | P04-T02 | `["Node.js", "Next.js API routes", "TypeScript"]` | `[]` |
| PIPELINE-BEHAVIORAL-TESTS | P01-T01 | `["code-modification", "test-update"]` | `[]` |
| MONITORING-UI | P01-T01 | `["scaffold", "npm"]` | `[]` |
| EXECUTE-BEHAVIORAL-TESTS | P01-T05 | `["code", "run-tests"]` | `[]` |
| UI-PATH-FIX | P01-T02 | `["research-codebase"]` | `["run-tests"]` |
| STATE-TRANSITION-SCRIPTS | P01-T01 | `["coding"]` | `[]` |
| VALIDATOR | P01-T01 | `[]` | `[]` |

### Key Finding

Only ~4 out of ~30 task handoffs contain an actual `.github/skills/` name. The rest use technology labels, vague activity labels, or empty arrays. The `skills_optional` field is nearly always empty — the required/optional distinction provides no practical value.

## Available Skills Inventory (17 skills)

| Skill Name | Description | Coder-Relevant? |
|------------|-------------|-----------------|
| `brainstorm` | Collaboratively brainstorm and refine project goals through ideation | No — planning only |
| `create-agent` | Create new custom agents (`.agent.md`) for the orchestration system | Yes — if task creates an agent |
| `create-architecture` | Create a technical Architecture document from a PRD and Design document | No — planning only |
| `create-design` | Create a UX Design document from a PRD | No — planning only |
| `create-master-plan` | Create a Master Plan document as single source of truth for a project | No — planning only |
| `create-phase-plan` | Create a Phase Plan breaking a phase into concrete tasks | No — planning only |
| `create-prd` | Create a PRD from research findings | No — planning only |
| `create-skill` | Create new Agent Skills for GitHub Copilot | Yes — if task creates a skill |
| `create-task-handoff` | Create a self-contained Task Handoff document for a Coding Agent | No — planning only |
| `generate-phase-report` | Generate a Phase Report after all tasks in a phase complete | No — Tactical Planner only |
| `generate-task-report` | Generate a Task Report after completing a coding task | Yes — always (Coder already has this) |
| `log-error` | Log pipeline execution errors to a structured error log | No — Orchestrator only |
| `research-codebase` | Research and analyze the codebase to gather context | Possibly — if task needs exploration |
| `review-phase` | Review an entire phase after all tasks complete | No — Reviewer only |
| `review-task` | Review completed tasks against plan, architecture, and design | No — Reviewer only |
| `run-tests` | Run the project test suite and report results | Yes — if task has test requirements |
| `validate-orchestration` | Comprehensive validation of the orchestration system ecosystem | Possibly — if task modifies orchestration files |

### Skills the Tactical Planner Should Consider for the Coder

| Skill | When to Recommend |
|-------|-------------------|
| `run-tests` | Any task with test requirements or acceptance criteria involving test passage |
| `generate-task-report` | Always — the Coder must produce a task report (already in Coder's skill set) |
| `create-skill` | Tasks that create or scaffold a new skill |
| `create-agent` | Tasks that create or scaffold a new agent |
| `validate-orchestration` | Tasks that modify agents, skills, instructions, or `orchestration.yml` |
| `research-codebase` | Tasks that require understanding unfamiliar parts of the codebase before implementing |

## UX Designer Over-Production Analysis

### Evidence from Non-UI Projects

| Project | Type | Design Content Produced |
|---------|------|------------------------|
| PIPELINE-BEHAVIORAL-TESTS | Test infrastructure — no UI | Full doc; "User Flows" describe agent behavior, not visual flows; no layouts, tokens, or accessibility apply |
| VALIDATOR | CLI tool — terminal output only | Full doc; invented ANSI color tokens as "design tokens"; CLI flags treated as "user flows" |
| STATE-TRANSITION-SCRIPTS | CLI scripts — JSON stdin/stdout | Full doc; "Agent Workflows" replace user flows; JSON output format treated as design |

### Root Cause

Neither `ux-designer.agent.md` nor `create-design/SKILL.md` contains any triage logic. The workflow always proceeds: Read PRD → Design overview → Map user flows → Define layouts → Define components → Document design tokens → States & interactions → Accessibility → Responsive → Save. This forces the agent to fill every section even when the project has no visual interface.

### Current Agent Workflow (no triage)

```
Read PRD → Read Research → Design overview → Map flows → Define layouts →
Define components → Document tokens → Specify states → Define accessibility →
Specify responsive → Write full DESIGN.md → Save
```

### Current Template Sections (all mandatory)

1. Design Overview
2. User Flows
3. Layout & Components (with breakpoints, regions, components table)
4. New Components (props, tokens, descriptions)
5. Design Tokens Used
6. States & Interactions
7. Accessibility (keyboard nav, screen readers, contrast, focus)
8. Responsive Behavior (breakpoint layout changes)
9. Design System Additions

### Impact

- Non-UI projects get a fabricated design document with invented content (ANSI color tokens as "design tokens", CLI flags as "user flows")
- Downstream agents (Architect, Tactical Planner) receive misleading inputs
- The pipeline's expectation that DESIGN.md exists means the file must be produced — but a stub that records "not required" satisfies this without adding noise

## Constraints Discovered

- **DESIGN.md must always be produced**: The pipeline assumes the file exists; downstream agents read it. A stub is acceptable but the file must exist.
- **No script changes needed**: All fixes are in `.md` instruction and template files — no changes to `pipeline.js` or `orchestration.yml`.
- **Forward-only template change**: Existing task handoffs with `skills_required`/`skills_optional` will not be migrated. The new `skills` field applies only to new handoffs.
- **Coder agent does not consume the skills field**: The Coder agent instructions (`coder.agent.md`) do not reference `skills_required` or `skills_optional`. The brainstorming doc notes this is out of scope — the Coder already has its skills declared in its agent frontmatter.
- **Tactical Planner agent changes are out of scope**: The brainstorming doc explicitly excludes changes to `tactical-planner.agent.md`. The fix goes in the `create-task-handoff` skill and template, which the Tactical Planner reads.

## Recommendations

- **Add a skill discovery step to `create-task-handoff/SKILL.md`**: Insert a workflow step before writing the handoff that instructs the Tactical Planner to enumerate `.github/skills/`, read each `SKILL.md` frontmatter description, and select skills that would help the Coder complete the task.
- **Replace `skills_required`/`skills_optional` with a single `skills` field in the template**: Add an inline YAML comment clarifying valid values are skill folder names from `.github/skills/`, not technology or framework names.
- **Add triage logic to both `ux-designer.agent.md` and `create-design/SKILL.md`**: A step before producing any content that evaluates the PRD and routes to one of three output paths: full doc (visual UI), flows-only doc (non-visual flows), or a "not required" stub.
- **Create lightweight template variants**: A flows-only template (User Flows section only, no layout/tokens/accessibility/responsive) and a "not required" stub (frontmatter + one-section rationale), in addition to the existing full template.
- **Add a brief note to `docs/skills.md`**: Explain that the Tactical Planner enumerates `.github/skills/` when creating task handoffs and selects skills that help the Coder, not technology labels.
