---
project: "TRANSITION-TABLE"
author: "brainstormer-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Brainstorming

## Problem Space

The current pipeline resolver (`resolver.js`, ~261 lines) encodes the pipeline's routing logic as a hand-written function tree — nested `if/else` chains that inspect state fields and return actions. While correct and readable today, the logic is implicit in code structure rather than explicit in data. Understanding "what happens after task review in phase mode" requires tracing through several function calls. Changing the pipeline's routing behavior means editing the function tree, which carries regression risk and makes it hard to see the full picture of valid transitions at a glance.

The pipeline already has embryonic transition-table patterns: `PLANNING_STEP_ORDER` is literally a data table, `resolveTaskOutcome` and `resolvePhaseOutcome` in `mutations.js` are explicit decision tables (first-match-wins rows). This project formalizes the entire routing layer with that same approach — making the implicit explicit.

This is also the **foundation project** for parallelism (`PARALLEL-EXECUTION`) and configurability (`CUSTOM-PIPELINE-STEP`). Those two projects cannot be built cleanly without first having the pipeline routing described as data.

## Validated Goals

### Goal 1: Extract `PLANNING_STEP_ORDER` into a complete planning definition

**Description**: The `PLANNING_STEP_ORDER` array in `resolver.js` already defines the ordered planning steps and their spawn actions. Extend it to also include the expected completion event, what the planning step produces (doc type), and any pre-read requirements. This becomes the canonical source of truth for the planning tier's shape.

**Rationale**: Today, the same planning step information is scattered — event names are in `mutations.js`, actions are in `PLANNING_STEP_ORDER`, constants are in `constants.js`. A single data definition per planning step makes auditing, testing, and future extension trivial.

**Key considerations**:
- Must remain backward-compatible with current `state.json` schema (v3)
- The resolution logic in `resolvePlanning()` currently iterates the array — this keeps working, but now the array is richer
- Pre-read validation is a separate concern handled entirely by `pre-reads.js` — the transition table does not reference or import pre-read handlers. The two systems share event name keys but are deliberately decoupled

### Goal 2: Express the task lifecycle as an explicit ordered rule table

**Description**: Replace the `resolveTask()` if/else chain with a named, data-driven rule set where each rule is `{ id, condition: (task) => bool, action, buildContext: (task, phaseIndex, taskIndex) => object }`. Rules are evaluated first-match-wins in order. The engine iterates the rules; no branching in the engine itself.

**Rationale**: The `resolveTask()` function currently has 5 conditions and a fallback. Adding a new task lifecycle stage (e.g., a security scan between execution and review) requires inserting an if/else in exactly the right place. With an explicit rule table, the change is inserting a row at the right index.

**Key considerations**:
- Rules must cover all current conditions: corrective-handoff, fresh-handoff, execute, review, advanced-gate
- The fallback `halted(...)` case becomes the table's implicit else — no rule matched → halt with diagnostic
- Rule table should be testable in isolation: given a task object, verify which rule fires
- `CUSTOM-PIPELINE-STEP` project will later allow teams to inject rules into this table

### Goal 3: Express the phase lifecycle as an explicit ordered rule table

**Description**: Apply the same first-match-wins rule table pattern to `resolvePhaseCompletion()`. Each row: `{ id, condition: (phase) => bool, action, buildContext: (phase, phaseIndex) => object }`.

**Rationale**: The phase lifecycle (phase_report → phase_review → gate → advance) is currently another if/else chain nested inside `resolvePhaseCompletion()`. Same argument as the task lifecycle — explicit is better than implicit.

**Key considerations**:
- Phase lifecycle rules are simpler than task lifecycle (fewer conditions)
- Must handle the corrective phase review path (corrective_tasks_issued) which currently returns `halted()` with a note that mutations should have reset the pointer — this behavior is preserved, but now documented as an explicit rule row

### Goal 4: Create a `TIER_DISPATCH` table as the top-level routing structure

**Description**: Replace the top-level `resolveNextAction()` dispatch (`if current_tier === 'planning'... else if execution...`) with a `TIER_DISPATCH` map. Keys are tier names, values are `{ validEvents: Set<string>, resolve: (state, config) => { action, context } }`.

**Rationale**: This is the "invalid transition prevention by construction" win discussed in our architecture conversation. Today, sending `task_completed` during the planning tier reaches the mutation handler before the tier check — the validator catches it, but late. With `TIER_DISPATCH`, the engine checks `validEvents.has(event)` before calling any mutation, returning an error immediately with a clear message.

**Key considerations**:
- `validEvents` per tier replaces the implicit "this event shouldn't reach here" assumption
- The `resolve` function for each tier delegates to the planning/execution/review rule tables
- Must not break the existing `processEvent()` linear recipe — the tier dispatch is called after mutation, not before
- The valid-events check happens **before** mutation (pre-validation), while post-mutation `resolveNextAction()` still uses the tier dispatch

### Goal 5: Keep zero external dependencies; keep the same module boundaries

**Description**: All changes are internal refactors within the `lib/` modules. One new file is permitted: `lib/transition-table.js` (the table-definitions module, added in Goal 6). No npm packages. The module exports (`getMutation`, `resolveNextAction`, `validateTransition`, `preRead`) stay unchanged.

**Rationale**: The pipeline CLI is self-contained with zero dependencies — this must not change. The public API consumed by `pipeline-engine.js` must remain identical so `pipeline.js` and all tests keep working.

**Key considerations**:
- `pipeline-engine.js` need not change at all — this is a refactor of resolver internals
- Tests that call `resolveNextAction()` directly still work; tests that poke at internal resolver functions (`resolveTask`, `resolvePhaseCompletion`) will need updating since those functions may be replaced by table evaluation
- All 13 validator invariants remain unchanged

### Goal 6: House all table definitions in a dedicated `lib/transition-table.js` module

**Description**: All four table definitions — `PLANNING_STEP_ORDER`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, and `TIER_DISPATCH` — live in a single dedicated `lib/transition-table.js` module. The file exports arrays and maps, contains no resolver logic, and has no side effects. `resolver.js` `require()`s this module and iterates the tables but does not define them. `resolver.js` becomes the engine; `transition-table.js` becomes the data it runs on.

**Rationale**: The primary benefit of this project is making routing logic visible as data. A dedicated file maximizes that discoverability — anyone can open `transition-table.js` and see the complete pipeline routing picture without reading resolver code. It also gives the downstream `CUSTOM-PIPELINE-STEP` project a clean, stable import target for rule injection without ever touching resolver internals.

**Key considerations**:
- `transition-table.js` is a dependency-graph leaf: it imports nothing from the pipeline lib. Pre-read validation is handled entirely by `pre-reads.js` and is not referenced in the table. Rule `condition` and `buildContext` closures receive `state`/`config` as arguments at evaluation time — no imports needed
- The `condition` and `buildContext` closures defined inside the table rows are the only functions in this file; all iteration and dispatch logic stays in `resolver.js`
- No circular dependencies are possible by construction
- This is the stable public surface that `CUSTOM-PIPELINE-STEP` will `require()` and extend — its shape matters

### Goal 7: Behavioral test suite validates the refactor without modification

**Description**: After the refactor, all scenarios in `pipeline-behavioral.test.js` must pass without any changes to the test file. The test file is the contract; the implementation must satisfy it. If any test fails, fix the implementation, not the test.

**Rationale**: `pipeline-behavioral.test.js` exhaustively covers all 11 test categories of the pipeline's observable behavior (full happy path, multi-phase/multi-task, cold-start resume, pre-read validation failures, phase lifecycle, halt paths, pre-read failure flows, review tier, CF-1 end-to-end, edge cases, and corrective task flow). Passing all scenarios without touching the file is proof the refactor is fully behavior-equivalent.

**Key considerations**:
- The test file must not be altered — it is a fixed external contract for this project
- All 11 categories must pass: Categories 1–11 as defined in the file
- This is the primary acceptance criterion for the project


### Goal 8: Architect the table surface as a stable foundation for downstream projects

**Description**: Two future projects depend directly on the table definitions produced by this refactor: [`PARALLEL-EXECUTION`](../PARALLEL-EXECUTION/PARALLEL-EXECUTION-BRAINSTORMING.md) (intra-phase task parallelism) and [`CUSTOM-PIPELINE-STEP`](../CUSTOM-PIPELINE-STEP/CUSTOM-PIPELINE-STEP-BRAINSTORMING.md) (config-driven pipeline extensibility). The table definitions in `lib/transition-table.js` — their shape, export surface, and row structure — must be designed with these consumers in mind. Specifically: `PARALLEL-EXECUTION` needs to evaluate task lifecycle rules against **multiple ready tasks** in a single resolver pass, and `CUSTOM-PIPELINE-STEP` needs to **inject, remove, and reorder rows** in all three rule tables at startup from YAML configuration.

**Rationale**: If the table shape only satisfies the current sequential pipeline, the downstream projects will need to restructure it — defeating the purpose of doing this refactor first. Designing the exports to be iterable, indexable, and extensible from the start avoids a second refactor cycle. This doesn't mean building parallelism or extensibility features now — it means ensuring the data shape doesn't prevent them later.

**Key considerations**:
- `PARALLEL-EXECUTION` iterates `TASK_LIFECYCLE_RULES` for each ready task — the rules must be stateless (no shared mutable context between evaluations) and receive task identity as a parameter
- `CUSTOM-PIPELINE-STEP` splices rows into rule tables by `insert_after` reference — each rule row needs a stable `id` field that custom steps can reference as an insertion anchor
- `PLANNING_STEP_ORDER` entries need a stable `name` key so `CUSTOM-PIPELINE-STEP` can add `skip: true` or insert new steps by name reference
- The export shape of `transition-table.js` should be a plain object of named arrays (not frozen, not wrapped in accessors) so downstream consumers can clone-and-extend without fighting the API
- No parallelism or extensibility logic is implemented in this project — only the structural affordances that make those projects possible without reshaping the tables

## Scope Boundaries

### In Scope
- Refactor `resolver.js` to use data-driven rule tables for planning steps, task lifecycle, and phase lifecycle
- Add `TIER_DISPATCH` map with `validEvents` sets per tier
- Add `lib/transition-table.js` as the canonical module for all table definitions
- Update `resolver.js` to iterate tables (no branching engine, no more if/else chains)
- Verify `pipeline-behavioral.test.js` passes without modification as the acceptance criterion

### Out of Scope
- Parallelism (returning multiple actions) — that is `PARALLEL-EXECUTION`
- Config-driven pipeline step customization — that is `CUSTOM-PIPELINE-STEP`
- Any changes to `mutations.js`, `pre-reads.js`, `validator.js`, `state-io.js`, or `pipeline-engine.js`
- Changes to `state.json` schema (stays v3)
- XState or any external library adoption

## Key Constraints

- **Zero external dependencies**: No npm packages under any circumstances
- **Same public API**: The four module exports consumed by `pipeline-engine.js` must not change signatures
- **Behavioral equivalence**: All existing end-to-end test scenarios must produce identical actions and context; this is a refactor, not a behavioral change
- **Single writer per project**: The state.json model doesn't change — one event in, one state write out, one action back
- **Current `state.json` schema v3 is unchanged**: No schema migration triggered by this project

## Resolved Questions

- **Rule condition signatures**: Uniform context bag. Task lifecycle rules receive `{ task, phase, phaseIndex, taskIndex, config }`. Phase lifecycle rules receive `{ phase, phaseIndex, config }`. The engine passes the same shape to every rule; rules ignore fields they don't need. This keeps the engine a trivial loop with no per-rule branching.
- **`validEvents` definition**: Static sets in the table. Each tier in `TIER_DISPATCH` explicitly lists its valid events. This duplicates event names from the mutation map but keeps `transition-table.js` import-free and self-contained.
- **`start` event handling**: Special case in `pipeline-engine.js`. The `start` event is initialization logic (create fresh state or resume), not routing. It stays as a hard-coded branch in `processEvent()`, outside `TIER_DISPATCH` entirely. The transition table only covers post-initialization routing.

## Summary

This project refactors the pipeline's routing layer from implicit if/else function trees into explicit, data-driven rule tables. The planning step sequence, task lifecycle rules, and phase lifecycle rules each become first-match-wins ordered arrays. A `TIER_DISPATCH` map connects tier names to their `validEvents` set and `resolve` function. All four table definitions live in a single dedicated `lib/transition-table.js` module — a pure-data leaf with no pipeline imports — while `resolver.js` becomes the engine that iterates them. Externally, the pipeline behaves identically — same events, same actions, same state schema — proven by passing all 11 categories of `pipeline-behavioral.test.js` without modification. Internally, the routing logic is readable as a table rather than traced as a call tree. This is the prerequisite foundation for the `PARALLEL-EXECUTION` and `CUSTOM-PIPELINE-STEP` projects.
