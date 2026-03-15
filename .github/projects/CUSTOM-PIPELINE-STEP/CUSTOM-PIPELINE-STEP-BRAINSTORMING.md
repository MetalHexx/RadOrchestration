---
project: "CUSTOM-PIPELINE-STEP"
author: "brainstormer-agent"
created: "2026-03-15T00:00:00.000Z"
depends_on: "TRANSITION-TABLE"
---

# CUSTOM-PIPELINE-STEP — Brainstorming

## Problem Space

The current pipeline has a fixed shape: 5 planning steps (research → prd → design → architecture → master_plan), a fixed task lifecycle (handoff → execute → review → gate), and a fixed phase lifecycle (report → review → gate). This works well for general-purpose software projects, but different teams and repositories have specific needs:

- A security-focused team wants a **threat modeling step** between architecture and master plan
- A regulated industry team needs a **compliance review step** after every code review
- An infrastructure team doesn't need a design doc step at all
- A team with an in-house documentation agent wants to add a **doc generation step** after each task's code review
- A repo building an SDK wants a **breaking change analysis step** before phase approval

Today, none of this is possible without forking the engine and editing code. The TRANSITION-TABLE project will make the pipeline routing data-driven (rule tables). This project goes one step further: those rule tables are **loaded from configuration**, making the pipeline shape itself configurable without touching engine code.

This is the capstone of the three-project roadmap:
1. `TRANSITION-TABLE` — routing becomes data (in code)
2. `PARALLEL-EXECUTION` — routing dispatches multiple actions (parallel tasks)
3. `CUSTOM-PIPELINE-STEP` — routing data comes from configuration (not hardcoded)

## Validated Goals

### Goal 1: Move the planning step sequence to `orchestration.yml`

**Description**: The 5 planning steps are currently hardcoded in `PLANNING_STEP_ORDER` in `resolver.js`. Move this definition to `orchestration.yml` under a `planning.steps` key. Each entry specifies: `name`, `action` (the spawn action to return), `event` (the completion event that triggers the next step), and optionally `skip: true` to omit the step. The engine reads this from config at startup.

**Rationale**: Teams that don't need a design doc, or want to add a threat model step, currently cannot do so without editing the engine. With a YAML definition, they edit the config. The Tactical Planner and Research agents already know about these steps via their agent definitions — the groundwork is there.

**Key considerations**:
- Each custom step needs a corresponding agent that can handle it — the config entry should optionally reference an agent or skill name so the orchestrator knows what to invoke
- The `state.json` stores planning steps as an array with `name`, `status`, `doc_path` — this is already flexible (it doesn't hardcode 5 specific step names). Adding or removing steps just changes the array length
- The validator checks come from constants (`PLANNING_STEP_ORDER`) — if that comes from config, the validator needs to read config at validation time (it currently gets config passed in)
- Default config should replicate today's behavior exactly (the 5 standard steps in order)
- Step names must be URL-safe identifiers (used in file paths): lowercase with hyphens

### Goal 2: Allow teams to add custom task lifecycle stages

**Description**: The task lifecycle rule table (from `TRANSITION-TABLE`) is the ordered list of conditions that determine what action to take for a task. Expose this as a configurable extension point in `orchestration.yml`. Teams can insert custom lifecycle stages at specific positions (before review, after review, etc.) with named condition hooks and action targets.

**Rationale**: The most common customization request is inserting an additional step into the task lifecycle. "After code review is approved but before the task is gated, run a security scan on the changes." With a configurable lifecycle, this is a YAML entry. Without it, it's a code change that forks the engine.

**Key considerations**:
- Custom stages have custom events — the engine's `validEvents` sets (from `TIER_DISPATCH`) and the mutation map must accept them. This means the engine needs a registration mechanism for custom event handlers
- A custom task stage needs: a `condition` (which task state it fires on), an `action` (what to tell the orchestrator to do), and a `completion_event` (what event signals its done)
- The simplest model: custom stages are **insertion points** between named built-in stages. The YAML entry says `insert_after: code_review_completed` — it goes between the review stage and the gate stage
- Custom stages should fall back gracefully: if a custom stage is configured but its pre-read or mutation handler is not registered, the pipeline emits a clear config error rather than a cryptic failure

### Goal 3: Plugin-style custom mutation and pre-read registration

**Description**: Custom steps require custom events, which require custom mutation handlers (what state change does `threat_model_completed` cause?) and possibly custom pre-reads (what frontmatter fields does the threat model document need?). Provide a registration API in the pipeline engine so teams can supply these without modifying core files.

**Rationale**: The fork-to-customize problem is most severe for mutation handlers. A team needs to add 10 lines of state mutation code but has to fork the entire engine. A registration API (`pipeline.registerMutation(event, handler)`) lets them drop a module in their repo that registers their handlers, loaded by the engine at startup.

**Key considerations**:
- Handlers registered via the API must follow the same signature as built-in handlers: `(state, context, config) => { state, mutations_applied }`
- The engine should refuse to register a handler for a built-in event name (prevent overriding core behavior accidentally)
- Custom handlers are loaded from a path specified in `orchestration.yml` (e.g., `extensions: ./custom-pipeline.js`) — the engine `require()`s this file which calls `pipeline.registerMutation()`
- This is the only place where the zero-npm-dependency rule could flex slightly: the custom extension file can use whatever it wants; the core engine still has zero dependencies

### Goal 4: Config-driven phase lifecycle customization

**Description**: Apply the same configurability to the phase lifecycle — the sequence of steps that happen after all tasks complete (report → review → gate). Teams may want to add a phase-level security audit, a client demo sign-off stage, or skip the phase review entirely for low-risk projects.

**Rationale**: Phase-level customization is less common than task-level customization, but the architectural pattern is identical. Once the task lifecycle is configurable, making the phase lifecycle configurable is marginal additional work.

**Key considerations**:
- The default phase lifecycle (generate report → spawn phase reviewer → gate) is preserved as the built-in default
- Skipping the phase review entirely (e.g., autonomous teams) means the phase advances directly to the gate after the report
- A custom phase stage follows the same insertion model as task stages: `insert_after: phase_report_created`
- The phase review verdict decision table (`resolvePhaseOutcome`) is a built-in that processes the phase reviewer's output — custom phase stages would need their own outcome resolution

### Goal 5: Validation of custom pipeline definitions at startup

**Description**: When the engine loads a custom config, it validates the custom step definitions before processing any events. Errors in the config (missing action name, unknown insertion point, circular step references, undefined event handler) surface immediately with clear messages, not mid-pipeline failures.

**Rationale**: A misconfigured YAML step that silently falls through to a `halted()` state mid-pipeline is a terrible debugging experience. Fail fast at startup with a config validation pass that catches structural errors before any agent is invoked.

**Key considerations**:
- The `validate-orchestration` skill in `.github/skills/validate-orchestration/` already validates the orchestration system structure — extend it to validate custom pipeline step definitions
- Validation should check: all `insert_after` references point to known built-in stage names, all `action` values are valid NEXT_ACTIONS or new custom actions registered via the extension file, all `completion_event` names don't collide with built-in event names
- Runtime validation of the full config on the `start` event (before any agent work begins) is the right trigger point

## Scope Boundaries

### In Scope
- `orchestration.yml` planning step sequence definition (replaces `PLANNING_STEP_ORDER`)
- `orchestration.yml` task lifecycle extension points (`insert_after` model)
- `orchestration.yml` phase lifecycle extension points
- Plugin registration API for custom mutation handlers and pre-reads
- Startup config validation for custom step definitions
- Updates to `validate-orchestration` skill to cover custom step definitions
- Documentation for how to write a custom pipeline extension
- Default config that replicates today's exact behavior

### Out of Scope
- The TRANSITION-TABLE and PARALLEL-EXECUTION features (prerequisites, not in this scope)
- Custom validator invariants — teams cannot add their own V-invariants through config (this would be a separate project if ever needed)
- A visual pipeline builder UI — config is YAML, not a drag-and-drop editor
- Cross-project config inheritance (one org-level config that all repos share) — too much complexity for now
- Changing the `state.json` schema per custom config — the schema remains v3; custom steps add fields to the existing task/phase objects

## Key Constraints

- **TRANSITION-TABLE is a prerequisite**: Custom pipeline steps are config entries in the rule table. Without a rule table, there's nothing to insert into.
- **Default behavior is unchanged**: A repo with no customizations in `orchestration.yml` runs the exact same pipeline as today
- **Core engine has zero external dependencies**: Custom extension files loaded by the engine may use any dependencies they want — but the core engine itself stays zero-dep
- **Fail fast on bad config**: Misconfigured custom steps surface at startup, not mid-pipeline
- **Built-in events are immutable**: Custom registrations cannot override handlers for built-in events (`research_completed`, `task_completed`, etc.) — only extend with new event names
- **Single orchestrator per project**: Custom steps don't affect the single-writer/single-orchestrator constraint

## Open Questions

- Should custom planning steps be first-class citizens with agents defined in `.github/agents/`, or can they be completely external (pointing to an agent in another repo or a webhook)? The agent model currently only handles local agents invoked via VS Code.
- For the plugin registration API, should it be a `pipeline.registerMutation(event, fn)` imperative API or a declarative export from the extension file (`module.exports = { mutations: {...}, preReads: {...} }`)? The declarative approach is safer (no shared mutable state).
- How are custom action names declared? If a custom step returns `action: 'spawn_threat_modeler'`, the orchestrator needs to know how to handle that. Does the extension file also export an action registry? Or does the orchestrator fall back to a generic "spawn agent by name" capability?
- Should `orchestration.yml` schema validation (the existing `validate-orchestration` skill) be extended to run full custom step validation, or should custom step validation be a separate `validate-extensions` skill for repos that use extensions?
- For teams that want to **remove** a built-in step (e.g., skip design docs entirely), is `skip: true` sufficient, or should they be able to fully delete the entry? Deletion is cleaner but risks confusion if someone references the step by name elsewhere.

## Summary

This project makes the pipeline shape configurable — planning step sequences, task lifecycle stages, and phase lifecycle stages can all be extended or modified through `orchestration.yml` without editing engine code. A plugin registration API allows teams to provide custom mutation handlers for their custom events. The engine validates custom definitions at startup and fails fast on misconfigurations. The default configuration replicates today's exact pipeline behavior, so repos without customizations are unaffected. This is the third and final step in the roadmap: `TRANSITION-TABLE` makes routing data-driven, `PARALLEL-EXECUTION` makes routing multi-output, and `CUSTOM-PIPELINE-STEP` makes the routing data itself configurable.
