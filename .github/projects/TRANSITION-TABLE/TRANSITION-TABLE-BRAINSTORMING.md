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

**Rationale**: Today, the same planning step information is scattered — event names are in `mutations.js`, actions are in `PLANNING_STEP_ORDER`, pre-reads are in `pre-reads.js`, constants are in `constants.js`. A single data definition per planning step makes auditing, testing, and future extension trivial.

**Key considerations**:
- Must remain backward-compatible with current `state.json` schema (v3)
- The resolution logic in `resolvePlanning()` currently iterates the array — this keeps working, but now the array is richer
- Pre-read definitions live in `pre-reads.js`; the goal is a pointer from the step definition → pre-read handler, not inlining the pre-read logic

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

**Description**: All changes are internal refactors within the existing `lib/` modules. No new files needed (possibly `lib/transition-table.js` to house the definitions). No npm packages. The module exports (`getMutation`, `resolveNextAction`, `validateTransition`, `preRead`) stay unchanged.

**Rationale**: The pipeline CLI is self-contained with zero dependencies — this must not change. The public API consumed by `pipeline-engine.js` must remain identical so `pipeline.js` and all tests keep working.

**Key considerations**:
- `pipeline-engine.js` need not change at all — this is a refactor of resolver internals
- Tests that call `resolveNextAction()` directly still work; tests that poke at internal resolver functions (`resolveTask`, `resolvePhaseCompletion`) will need updating since those functions may be replaced by table evaluation
- All 13 validator invariants remain unchanged

## Scope Boundaries

### In Scope
- Refactor `resolver.js` to use data-driven rule tables for planning steps, task lifecycle, and phase lifecycle
- Add `TIER_DISPATCH` map with `validEvents` sets per tier
- Possibly add `lib/transition-table.js` as the canonical home for the table definitions
- Update `resolver.js` to iterate tables (no branching engine, no more if/else chains)
- Update behavioral tests to match new internal structure while keeping same end-to-end inputs/outputs

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

## Open Questions

- Should the rule tables live in `resolver.js` (keeping everything in one file) or in a new `lib/transition-table.js`? The latter is easier for `CUSTOM-PIPELINE-STEP` to extend, but adds a file.
- Should rule `condition` functions receive the full state (for multi-field conditions) or just the task/phase object? Current conditions only inspect the task or phase — but the gate mode check in `resolveTaskGate` needs `config`. Likely: condition receives `(task, config)` or `(state, phaseIndex, taskIndex, config)`.
- Should `validEvents` be statically defined per tier, or derived from the mutation `MUTATIONS` map (which already has all event names as keys)? Deriving avoids duplication but couples the valid-events check to the mutation map.
- How do we handle the `start` special-case in `processEvent()`? It's not routed through the tier dispatch — is that acceptable?

## Summary

This project refactors the pipeline's routing layer from implicit if/else function trees into explicit, data-driven rule tables. The planning step sequence, task lifecycle rules, and phase lifecycle rules each become first-match-wins ordered arrays. A `TIER_DISPATCH` map connects tier names to their `validEvents` set and `resolve` function. Externally, the pipeline behaves identically — same events, same actions, same state schema. Internally, the routing logic is now readable as a table rather than traced as a call tree. This is the prerequisite foundation for the `PARALLEL-EXECUTION` and `CUSTOM-PIPELINE-STEP` projects.
