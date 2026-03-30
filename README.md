# Rad Orchestration System

A **document-driven agent orchestration system** that takes software projects from idea through planning, execution, and review — built on native AI coding assistant primitives and a small set of simple Node.js scripts.

Agents communicate through structured markdown documents. Routing, triage, and state validation are handled by a single pipeline script (`pipeline.js`). No external services, no Docker, no npm install (unless you use the Dashboard UI).

## What It Does

Tell the Orchestrator your project idea, and it coordinates **12 specialized agents** through a structured pipeline — research, requirements, design, architecture, planning, coding, and review — producing working software with full traceability from idea to implementation.  It's automated spec-driven development!

```mermaid
flowchart TD
    START([💡 Idea]) --> BRAINSTORM[Brainstorm]
    BRAINSTORM --> |Goals| RESEARCH

    subgraph PLANNING [Planning]
        direction TB
        RESEARCH[Researcher] --> |Research| PRD[Product Manager]
        PRD --> |Requirements, Research| DESIGN[UX Designer]
        DESIGN --> |Design, Requirements, Research| ARCH[Architect]
        ARCH --> |Requirements, Architecture, Design, Research| MASTERPLAN[Create Master Plan]
    end

    MASTERPLAN --> GATE1(["✋ Human Approval"])

    subgraph EXECUTION [Execution Loop]
        direction TB
        GATE1 --> PHASE[Plan Phase Tactical Planner]
        PHASE --> HANDOFF[Plan Task]
        HANDOFF --> |handoff| CODE[Code]
        CODE --> |code, task report|REVIEW[Code Review]
        REVIEW -->|needs correction | HANDOFF
        REVIEW -->|approved| COMMIT[🔀 Commit Code]
        COMMIT --> MORETASKS{more tasks?}
        MORETASKS -->|yes| HANDOFF
        MORETASKS -->|no| PHASEREVIEW[Phase Review]
        PHASEREVIEW -->|next phase| PHASE
        PHASEREVIEW -->|needs correction| PHASE
    end

    PHASEREVIEW --> FINAL[Final Review]
    FINAL --> GATE2(["✋ Human Approval"])
    GATE2 --> DONE([✅ Complete])
```

## Monitoring Dashboard

The system includes a real-time monitoring dashboard — a Next.js web application
that visualizes project state, pipeline progress, documents, and configuration.

<div style="width: 1000px; height: 800px; margin: 0 auto; overflow: hidden;">
    <img src="assets/dashboard-screenshot.png" object-fit: cover;">
</div>

Track active projects, drill into phase and task execution, read rendered planning
documents, and view configuration — all updated in real time by reading the state.json 
file in each project.  The project displayed in the screenshot was the project used to 
build the UI in 1-shot.

[Learn more about the dashboard →](docs/dashboard.md)

## Key Features

### Specialized Agents

Twelve agents with strict separation of concerns. Each agent has a defined role, scoped tool access, and explicit write permissions. The Orchestrator is a thin skill-driven coordinator — it loads the `orchestration` skill, signals pipeline events, and routes via a compact action routing table. Never writes files directly. The Coder reads only its task handoff.

[Learn more about agents →](docs/agents.md)

### Document-Driven Architecture

Documents are the inter-agent API. Every agent reads specific input documents, does its job, and writes its output document. There is no shared memory, no message passing, no runtime coupling between agents. Every interaction produces a traceable artifact.

CLI scripts, essentially a state machine, handles the mechanical decisions *around* that document exchange — routing, triage, and state validation — but agents themselves still communicate exclusively through structured markdown. The document-driven model is what makes the system portable and auditable.

[Learn more about the pipeline →](docs/pipeline.md)

### Human Gates

Configurable critical human checkpoints are reliably enforced.  Humans approve the Master Plan before any code is written and approve final results before completion. Execution gates are configurable: per-phase, per-task, or fully autonomous. 

### Deterministic Routing & Triage

Pipeline routing, triage, and state validation are handled by a unified pipeline script (`pipeline.js`) — not LLM interpretation of prose. One event in, one deterministic action out. The script encodes 20 external actions as a pure event-action lookup, internalizes triage decisions, and validates state invariants before every write. Same input always produces the same output.

[Learn more about the scripts →](docs/scripts.md)

### Composable Skills

Eighteen reusable skills bundle domain knowledge, templates, and instructions. Agents are composed with the skills they need — the system can be extended with new agents, capabilities, or adapted to new workflows by remixing skills.

[Learn more about skills →](docs/skills.md)

### Configurable Pipeline

A single `orchestration.yml` controls everything: project storage, pipeline limits, and human gate behavior. Sensible defaults out of the box, fully customizable.

[Learn more about configuration →](docs/configuration.md)

### Source Control Automation

Automatic git commits after each approved task. The Source Control Agent constructs conventional-format commit messages from task metadata and executes them — no manual git workflow needed. Configurable via `orchestration.yml` with `auto_commit: always | ask | never` (default `ask`, resolved at project start).

[Learn more about source control →](docs/source-control.md)

### Continuous Verification

Every task produces a report. Every report is reviewed against the plan.  Code reviewers never fully trust the coder reports. :)  Minor issues trigger automatic corrective tasks. Critical issues halt the pipeline for human intervention. Plans don't drift unchecked. Pipeline failures are logged to a structured, append-only error log (`ERROR-LOG.md`) in each project folder.

### Built-in Validation

A zero-dependency Node.js CLI validates the entire orchestration ecosystem — agents, skills, instructions, configuration, cross-references, and file structure. CI-friendly with structured exit codes.

[Learn more about validation →](docs/validation.md)

## Getting Started

[Full getting started guide →](docs/getting-started.md)

### Alternative: Manual Installation

1. Clone the repo and open in VS Code with GitHub Copilot
2. Copy the `.github/` directory _(or your [configured root](docs/configuration.md))_ into the root of your target project
3. Run `/configure-system` to set up `orchestration.yml`
4. Use `Orchestrator` agent with your project goals to start the pipeline

> **Migrating an existing project?** Run `node .github/skills/orchestration/scripts/migrate-to-v4.js` to upgrade `state.json` files from earlier schema versions. The script creates `.backup` copies before writing.

## Documentation

| Page | Description |
|------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, first project walkthrough, common commands |
| [Agents](docs/agents.md) | All 10 agents — roles, access control, design constraints |
| [Pipeline](docs/pipeline.md) | Planning and execution flow, human gates, error handling |
| [Skills](docs/skills.md) | All 19 skills and how they compose with agents |
| [Configuration](docs/configuration.md) | `orchestration.yml` reference — all options explained |
| [Source Control](docs/source-control.md) | Auto-commit configuration, agent modes, commit format, pipeline events |
| [Project Structure](docs/project-structure.md) | File layout, naming conventions, document types, state management |
| [Pipeline Script](docs/scripts.md) | Unified event-driven CLI — routing, triage, state mutations, validation |
| [Validation](docs/validation.md) | Zero-dependency validation CLI tool |
| [Monitoring Dashboard](docs/dashboard.md) | Dashboard startup, features, data sources, real-time updates |

## Design Principles

1. **Documents as interfaces** — Agents never share memory. Every interaction is mediated by a structured markdown document.
2. **Sole writer policy** — Every document type has exactly one agent that may write it.
3. **Self-contained handoffs** — The Coder never reads external planning documents. Everything is inlined.
4. **Deterministic where possible** — Routing, triage, and validation are pure functions. LLMs handle judgment work.
5. **Human in the loop** — Critical gates are enforced. Humans approve plans and results.
6. **Continuous verification** — Every task is reported and reviewed against the plan.
7. **Zero dependencies** — Node.js built-ins only. No npm install.

## Platform Support

**Currently supported:** GitHub Copilot (VS Code) — custom agents, skills, prompt files, instruction files, and agent mode.

The document-driven architecture is inherently portable. Agents communicate through markdown and YAML, not platform APIs. Adapting to other AI assistants primarily involves translating agent definitions to the target format.

## License

See [LICENSE](LICENSE) for details.
