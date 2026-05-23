# `cli/src/lib/pipeline/` — Contributing Guide

## Purpose

This folder is the pipeline engine — the library that drives the orchestrator's event loop, mutates `state.json`, and resolves the next action the orchestrator must dispatch. Every pipeline event the orchestrator receives flows through `processEvent` in `engine.ts`, which reads current state, applies the appropriate mutation, validates the result, persists the updated state, and returns the next action with its enriched context. Nothing in the skills layer writes pipeline state directly; all state transitions flow through this library.

## How it works

The standard event-processing recipe is: **preRead → mutate → validate → write → resolve** (via `walkDAG`). A cold `start` event with no existing `state.json` runs a shorter path: scaffold a fresh state from the template, validate, write, then walk. In both paths the single entry point is `processEvent`, which owns the full request/response lifecycle.

Each module has a distinct responsibility:

- **`engine.ts`** — the single entry point (`processEvent`). Orchestrates every other module in order; owns cold-start scaffolding and out-of-band event routing; returns a `PipelineResult` carrying the next action and its context.
- **`mutations.ts`** — the registry of event-to-mutation functions. Each mutation receives a deep clone of the current state plus the event context and returns a `MutationResult` with the updated state. `getMutation(event)` is the lookup surface.
- **`dag-walker.ts`** — traverses the template graph after each mutation to determine the next action. Returns a `WalkerResult` (action + raw context) that the engine hands to `context-enrichment.ts` before returning to the caller.
- **`validator.ts`** — runs the full battery of state-validity checks (schema, graph status, node status enumerations, allowed transitions, iteration limits, kind-matches-template) before any write. All checks must pass or the engine returns an error without persisting.
- **`schema-validator.ts`** — JSON Schema check delegated to by `validator.ts`. Validates the proposed state document against `schemas/orchestration-state-v5.schema.json` as the first validation step.
- **`template-loader.ts`** — reads and parses a `.yml` template file; builds the `eventIndex` map (`event name → entry`) used by the engine for standard event routing.
- **`template-resolver.ts`** — determines which template to load, with priority: state-pinned `template_id` → CLI `--template` flag → `config.default_template` → fallback `extra-high`. Also handles project-local snapshot lookup.
- **`template-validator.ts`** — validates the structure of a loaded template before it is used; surfaced to callers that need to reject malformed template files early.
- **`pre-reads.ts`** — performs document reads declared in the template's `pre_read` entries for the current event. Results are merged into the event context before the mutation runs.
- **`scaffold.ts`** — converts a template node definition into an initial `NodeState` for cold-start projects.
- **`state-io.ts`** — the filesystem I/O surface. Exports `readState`, `writeState`, `readConfig`, `readDocument`, and `ensureDirectories`. Consumers program against the `IOAdapter` interface so tests can inject stubs.
- **`context-enrichment.ts`** — enriches a raw walker context with resolved phase/task indices, document paths, and other caller-facing fields before the engine returns the `PipelineResult`.
- **`condition-evaluator.ts`** — evaluates the conditional expressions (`eq`, `neq`, `in`, `not_in`, `truthy`, `falsy`) used by `CONDITIONAL` and `PARALLEL` nodes during DAG traversal.
- **`frontmatter-validators.ts`** — validates YAML frontmatter fields on task-handoff and other pipeline documents that are read via `pre-reads.ts`.
- **`constants.ts`** — frozen enum objects (`NODE_KINDS`, `NODE_STATUSES`, `GRAPH_STATUSES`, `EVENTS`, `NEXT_ACTIONS`, `REVIEW_VERDICTS`) and the `ALLOWED_NODE_TRANSITIONS` map. The authoritative source for every string literal used across the engine.
- **`types.ts`** — all shared TypeScript types and interfaces for the engine, mutations, walker, and callers.
- **`config-validator.ts`** — validates an `OrchestrationConfig` object loaded from `orchestration.yml` before the engine uses it.
- **`path-context.ts`** — resolves the `PathContext` (scripts directory and templates directory) from environment variables or OS defaults. Both CLI command consumers depend on this to build the `PathContext` they pass to `processEvent`.
- **`schemas/orchestration-state-v5.schema.json`** — the JSON Schema artifact that `schema-validator.ts` validates every proposed write against.

## Coding standards specific to engine modifications

All event and status string literals come from the frozen enum objects in `constants.ts` — never hardcode string values inline. When a new node status or event is introduced, add it to the corresponding `Object.freeze(...)` export in `constants.ts` and update the matching `ALLOWED_*_TRANSITIONS` map in the same file to declare which transitions are legal. The `ALLOWED_NODE_TRANSITIONS` map is the enforcement surface for the validator; an omitted transition causes all writes to fail validation.

Every mutation function in `mutations.ts` receives a deep clone of the current state and returns a new state object in `MutationResult.state`. Mutations must not touch the live state reference passed in. `MutationResult.mutations_applied` is an internal observability field consumed only by the engine; it is not surfaced in the `PipelineResult` envelope returned to callers.

When a mutation handles `code_review_completed` or `phase_review_completed` with a `verdict: changes_requested`, the current node pointer advances only after the corrective cycle completes — not at the time the review event is processed. The mutation marks the corrective task as active and leaves the pointer on the review node until the corrective's own completion event fires. Mutations that need to branch on this deferral pattern must consult the corrective-task entry in state, not assume the pointer has moved.

Any change to the state shape must be accompanied by a corresponding update to `schemas/orchestration-state-v5.schema.json`. The schema is the contract between the engine and all external consumers (UI, state-inspection tools, tests). A shape change without a schema update will cause `schema-validator.ts` to reject every write.

## Seams to other CLI modules

`cli/src/commands/pipeline/signal.ts` is the primary consumer. It constructs an `IOAdapter` and `PathContext`, calls `processEvent`, and projects the result into the canonical CLI envelope (`{ ok, data, error }`). Signal is the only path through which pipeline events reach the engine during normal orchestrator operation.

`cli/src/commands/gate/shared.ts` is the entry point for the gate subcommands (`gate approve-plan` and `gate approve-final`). It re-exports `processEvent` and `resolvePathContext` so both gate commands drive the same engine without duplicating construction logic. The gate path is the only other sanctioned caller of `processEvent` inside the CLI.

`cli/src/lib/pipeline/path-context.ts` is the shared root resolver both consumers depend on. It reads `RADORCH_TEMPLATES_DIR` from the environment or falls back to `~/.radorch/templates`, keeping both signal and gate consistent on template lookup without duplicating the resolution logic.

`cli/src/lib/pipeline/schemas/orchestration-state-v5.schema.json` validates every write. External tools that read `state.json` can use this schema as the ground-truth contract for the document shape.

## Cross-reference

For the complete event-to-action routing table and signaling reference, see the rad-orchestration skill's [`references/action-event-reference.md`](~/.claude/skills/rad-orchestration/references/action-event-reference.md). That document is the authoritative lookup during pipeline operation; no event table is transcribed here.
