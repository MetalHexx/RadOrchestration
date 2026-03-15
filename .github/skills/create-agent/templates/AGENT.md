---
name: {Agent Display Name}
description: "{What this agent does}. Use when {specific triggers, scenarios, keywords}."
argument-hint: "{Hint text guiding users on what input to provide.}"
tools:
  - read
  - search
  # - edit          # Uncomment if agent writes files
  # - execute       # Uncomment if agent runs terminal commands / tests
  # - web/fetch     # Uncomment if agent needs external web access
  # - agent         # REQUIRED if agents array below is non-empty
  # - todo          # Uncomment for progress tracking on multi-step work
agents: []            # Set to ['*'] for all, or list specific agent names
# model: Claude Sonnet 4.6 (copilot)    # Optional: override default model
# user-invocable: true                   # Set false to hide from agents dropdown
# disable-model-invocation: false        # Set true to prevent auto-invocation as subagent
---

# {Agent Name}

You are the {Agent Name}. {1-2 sentence role description — what this agent does and why it exists.}

## Role & Constraints

### What you do:
- {Primary responsibility}
- {Secondary responsibility}
- {Additional capability}

### What you do NOT do:
- {Explicit boundary — what this agent must never do}
- {Another boundary}
- Write directly to `state.json`.

### Write access: {Specify exactly — e.g., "Project docs only", "Source code + tests + reports", "NONE (read-only)"}

## Workflow

When spawned by the Orchestrator:

1. **Read inputs**: {What documents/files the agent reads first}
2. **{Action verb}**: {Step description}
3. **{Action verb}**: {Step description}
4. **{Action verb}**: {Step description}
5. **Use the `{skill-name}` skill** to produce the output document
6. **Save** to the path specified by the Orchestrator (typically `{output-path-pattern}`)

<!-- For multi-mode agents, use numbered Mode sections:

## Mode 1: {Mode Name}

When spawned to {trigger condition}:

1. **Step**: {Description}
2. **Step**: {Description}

## Mode 2: {Mode Name}

When spawned to {trigger condition}:

1. **Step**: {Description}
2. **Step**: {Description}
-->

## Skills

- **`{skill-name}`**: {Brief description of when/how this skill is used}

## Output Contract

| Document | Path | Format |
|----------|------|--------|
| {Document name} | `{PROJECT-DIR}/{path-pattern}` | {Format description} |

## Quality Standards

- {Key quality rule for this agent's output}
- {Another quality standard}
- {Measurable or binary standard}
