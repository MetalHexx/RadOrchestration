---
name: rad-orchestration
description: Orchestration system runtime, configuration, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance.
user-invocable: false
---

# Orchestration

Unified orchestration skill containing the pipeline runtime, validator, and role-specific reference documents. System configuration (`orchestration.yml`), tier templates, and per-action / per-event instruction files live at `~/.radorc/` and are documented below. All pipeline agents load this skill for system context.

## The Envelope Is the Contract

The orchestrator runs an event-driven loop against the `radorch pipeline signal` CLI. Every successful signal returns a JSON envelope of the shape:

```jsonc
{
  "ok": true,
  "data": {
    "action": "<action-name>",          // the next operation to perform
    "completion_event": "<event-name>", // the event to signal when done — or null for terminal actions
    "prompt": "<composed instructions>",// the sole instruction source for this action
    "context": { /* action-specific payload */ }
  }
}
```

`data.prompt` is the **single source of truth** for what the orchestrator does next. The pipeline assembles it from the per-action and per-event files in `~/.radorc/action-events/` at envelope-build time. The composed prompt already includes the action body, the completion event's "When complete" body, and the derived `Signal: <event> [--flag <value>]` line. Read `data.prompt`, execute the work, and signal `data.completion_event` exactly as the embedded `Signal:` line specifies — no per-action routing table, no separate event signaling reference, no `_started` two-step protocol.

When `data.completion_event` is `null`, the action is terminal (`display_halted`, `display_complete`) — display the message and exit the loop.

## Pipeline Loop, in Brief

1. Signal an event with `radorch pipeline signal --event <name> --project-dir <dir> [...flags]`.
2. Parse the envelope from stdout.
3. Execute `data.prompt`.
4. Signal `data.completion_event` (the `Signal:` line in the prompt is authoritative for flags). Repeat.

Step-node status transitions to `in_progress` are written optimistically by the engine on the same response that returns the action — the orchestrator does **not** signal a `*_started` event before doing the work.

For the full loop, CLI flags, valid pause/stop points, error handling, recovery, and spawning guidance, read [`references/pipeline-guide.md`](references/pipeline-guide.md).

## Reference Documents

Read `references/context.md` first. If your role appears in the table below with an additional reference, read that document too.

| Role | Reference Document | What It Provides |
|------|--------------------|-----------------|
| All agents | [references/context.md](references/context.md) | Agent roles, pipeline flow, naming conventions, key operating rules |
| Orchestrator | [references/pipeline-guide.md](references/pipeline-guide.md) | Envelope shape, event loop, CLI invocation, pause/stop points, error handling, recovery, spawning guidance |
| Orchestrator | [references/corrective-playbook.md](references/corrective-playbook.md) | Orchestrator-only. Mediation guide for `code_review_completed` / `phase_review_completed` with `verdict: changes_requested`. Read on every corrective cycle. |
| All agents | [references/document-conventions.md](references/document-conventions.md) | Document naming, placement, filename patterns, frontmatter field values |

Per-action and per-event instruction prose **does not live in this skill**. It lives in `~/.radorc/action-events/` (one file per action, one file per event). The pipeline reads those files at envelope-build time and composes `data.prompt`. To change what happens for a given action, edit the catalog file — not this skill. Project-level overrides live in `~/.radorc/action-events/custom/` (`action.<name>.pre.md`, `event.<name>.pre.md`, `event.<name>.post.md`); see `~/.radorc/action-events/custom/README.md`.

## Contents

This skill bundles:

- **`schemas/orchestration-state-v5.schema.json`** — State file JSON Schema
- **`radorch` CLI** — Pipeline runtime, including `pipeline signal` (envelope loop) and `plan explode` (Master Plan expansion). Invoked via `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" <subcommand>`.
- **`references/`** — Role-specific reference documents

Runtime user-data files (not shipped inside the skill folder):

- **`~/.radorc/orchestration.yml`** — System configuration; provisioned to the user-data root at install time from `runtime-config/orchestration.yml`
- **`~/.radorc/templates/`** — The four review-intensity tier templates (`extra-high.yml`, `high.yml`, `medium.yml`, `low.yml`); provisioned from `runtime-config/templates/` at install time
- **`~/.radorc/action-events/`** — Per-action and per-event instruction files composed into `data.prompt`; provisioned from `runtime-config/action-events/` at install time. Custom overlays live in `~/.radorc/action-events/custom/`.
