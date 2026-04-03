# Guides

Now that you're set up, here's how to use the orchestration system to plan and build projects.

## Your First Project

There are two ways to start a new project, depending on how well-defined your idea is.

### Option A: Start with Brainstorming

If you have a rough idea but want to explore it first:

1. Open Copilot Chat and select the `Brainstormer` agent
2. Describe your idea — the Brainstormer asks questions, explores trade-offs, and helps you converge on a clear concept
3. Provide any additional documents, code references, or resources as context alongside the conversation
4. The Brainstormer produces a brainstorming document in your project folder
5. Type `/rad-plan` in Copilot Chat — the orchestrator picks up the brainstorming document and runs the full planning pipeline

### Option B: Start Directly

If you already know what you want to build:

1. Open Copilot Chat and type `/rad-plan` with a description of your project:
   ```text
   /rad-plan Build a REST API for managing inventory with auth, CRUD operations, and a React dashboard
   ```
2. You can include additional documents, images, or code references alongside your description for extra context
3. The orchestrator runs the full planning pipeline automatically

## What Happens Next

Once planning begins, the orchestrator sequences agents through the pipeline:

1. **Research** — analyzes your codebase, tech stack, and relevant patterns
2. **Product Manager** — creates a PRD with requirements, user stories, and success metrics
3. **UX Designer** — produces a design document with flows, layouts, and accessibility specs
4. **Architect** — defines system architecture, module structure, API contracts, and interfaces
5. **Master Plan** — synthesizes everything into a phased execution plan

After planning completes, the orchestrator presents the Master Plan for your review. No code is written until you approve it.

Once you approve, type `/rad-execute` to begin execution:

6. **Tactical Planner** — breaks each phase into concrete tasks
7. **Coder** — implements tasks from self-contained handoff documents
8. **Reviewer** — reviews code against the plan
9. The pipeline loops through all phases, then performs a final review

You control how much oversight to apply — gate at task completion, phase completion, or run fully autonomous.

## Continuing a Project

Use `/rad-execute` to resume a project that is already in progress:

```text
/rad-execute
```

Or use the `Orchestrator` agent directly:

```text
@orchestrator continue the project
```

The orchestrator reads the current project state and picks up from wherever you left off.

## Checking Status

Ask the orchestrator for a status update at any time:

```text
@orchestrator what's the current status?
```

For real-time monitoring, use the [UI Status Dashboard](dashboard.md) — it surfaces the current status, recent activity, and next steps in a visual format.

## Advanced Usage

> **Coming Soon** — Advanced topics like parallel execution, custom pipelines, and project chaining.

## Next Steps

- [Pipeline](pipeline.md) — understand the pipeline stages and flow
- [Agents](agents.md) — learn what each agent does
- [Configuration](configuration.md) — customize system behavior
