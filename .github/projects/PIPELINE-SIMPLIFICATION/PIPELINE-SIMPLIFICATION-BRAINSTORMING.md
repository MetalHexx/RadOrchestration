---
project: "PIPELINE-SIMPLIFICATION"
author: "brainstormer-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Brainstorming

## Problem Space

The orchestration pipeline engine (~2,620 lines across 7 modules) is brittle — fixing one bug routinely causes regressions elsewhere. The root cause is not bad logic, but architectural layering that forces split writes, deferred validation, and internal re-entry loops. The planning pipeline works well (linear, one event → one mutation → one action), but the execution pipeline has compounding complexity from a triage layer bolted on top of mutations, 16 internal actions the Orchestrator never sees, and an implicit task state model spread across 5 fields.

The agents themselves are non-deterministic — they will skip steps, produce wrong artifacts, and take incorrect actions if not constrained. The pipeline's job is to be the deterministic authority: enforce artifact contracts, route agents to the correct next step, and make all sequencing decisions in code. This constraint is non-negotiable. The simplification must preserve deterministic control while reducing the implementation complexity that causes cascading invariant failures.

**Reference document:** [PIPELINE-SIMPLIFICATION-ANALYSIS.md](PIPELINE-SIMPLIFICATION-ANALYSIS.md) — full technical inventory, bug patterns, decision tables, invariant analysis, and action inventory.

## Validated Goals

### Goal 1: Atomic Event Processing — One Event, One Write, One Action

**Description**: Every pipeline event should produce exactly one state mutation, one validation pass, and one state write. No split writes, no deferred validation, no internal action loops.

**Rationale**: The split write pattern is the #1 source of bugs. Currently, `code_review_completed` triggers: (1) mutation sets `review_doc`, (2) triage reads the doc and decides verdict, (3) `applyTaskTriage` sets verdict/action/status, (4) internal loop advances `current_task`. That's 2-3 writes and 2-3 validation passes per event. Invariants V8, V9, V14 exist solely to guard against split-write inconsistencies. The deferred-validation dance in pipeline-engine.js (the snapshot baseline, V8/V9 filtering, timestamp racing fix) is ~150 lines of pure plumbing.

**Key considerations**:
- Mutations must absorb what triage currently does — read document frontmatter, apply the decision table, update all related fields, and advance pointers (current_task, current_phase) in one operation
- The decision table logic (11 task rows, 5 phase rows) is sound and must be preserved — it just needs to run inside the mutation, not in a separate engine
- Pre-read enrichment (extracting frontmatter before mutation) stays — it's the contract enforcement layer

### Goal 2: Eliminate the Triage Engine as a Separate Module

**Description**: Delete `triage-engine.js` (~461 lines). Move the decision table logic into helper functions called directly by the mutation handlers in `mutations.js`.

**Rationale**: The triage engine was created as a separation of concerns, but it created a worse problem — a two-phase write that requires the entire deferred-validation architecture. The 11 task rows and 5 phase rows are ~80 lines of actual logic; the other 380 lines are scaffolding, error builders, document re-reads (the engine reads documents the pipeline already pre-read), and type definitions.

**Key considerations**:
- The decision tables themselves are correct. Rows 1-12 (task) and rows 1-5 (phase) must produce identical outcomes in the new location
- The retry budget check (`checkRetryBudget`) is clean logic — it moves as-is
- `applyTaskTriage()` and `applyPhaseTriage()` in mutations.js also fold into the mutation handlers — they're the second half of the split that shouldn't exist
- Context enrichment (verdict, action, report_status) should be passed through from the pre-read step, not re-read from disk

### Goal 3: Eliminate Internal Actions — Resolver Returns Only External Actions

**Description**: Remove the 16 internal actions (`advance_task`, `advance_phase`, `triage_task`, `update_state_from_task`, etc.) from the constants and resolver. The resolver should only return the ~19 actions that the Orchestrator routes on.

**Rationale**: Internal actions create the re-entry loop in pipeline-engine.js where the engine has to iterate, re-validate, and re-write. The `MAX_INTERNAL_ITERATIONS` guard, the timestamp bumping logic, and the per-iteration validation passes all exist because of this. If mutations produce final state (Goal 1), the resolver only needs to inspect the result and return who to call next.

**Key considerations**:
- Tier transitions (`transition_to_execution`, `transition_to_review`, `transition_to_complete`) become part of the mutation — when the last task in the last phase is approved, the mutation sets `current_tier = 'review'`
- `advance_task` and `advance_phase` become part of the mutation — when a task is approved, the mutation bumps `current_task`; when a phase is approved, the mutation bumps `current_phase` and sets phase status
- The resolver becomes a pure inspector: "given this final state, who should run next?"
- Action count drops from 35 to ~19

### Goal 4: Reduce Validator to Structural Guards

**Description**: Remove invariants V8, V9, V14, V15 (they exist solely for split-write protection). Simplify V11-V13 (transition checks). Keep V1-V7, V10 (structural bounds and gates).

**Rationale**: With atomic writes, half the invariants become impossible to violate by construction. V8 can't trip because verdict is set in the same write as review_doc. V14 can't trip because there's no two-phase write ordering. V13 simplifies because there's only one write per event (no timestamp racing). The validator drops from 372 lines to ~150 lines, and from current-vs-proposed comparison to mostly single-state validation.

**Key considerations**:
- V11 (retry monotonicity) and V12 (status transitions) still need current-vs-proposed comparison — but they're straightforward
- V13 (timestamp) simplifies to a basic "proposed timestamp > current timestamp" check with no racing workaround
- Removing V15 (cross-task immutability) is safe because with atomic writes, only one task changes per event by construction
- The validator should still return structured errors with invariant IDs for debugging

### Goal 5: Preserve Deterministic Artifact Enforcement

**Description**: The pipeline must continue to pre-read agent outputs and reject events when required frontmatter fields are missing or invalid. This is the contract enforcement layer that ensures agents produce the right artifacts.

**Rationale**: Agents are non-deterministic. Without pipeline enforcement: code reviews get skipped, task reports lack required fields, phase plans come back with empty task arrays. The pre-read validation is what makes the system reliable despite agent non-determinism.

**Key considerations**:
- Every pre-read contract stays as-is:
  - `task_completed`: report must have `status`, `has_deviations`, `deviation_type`
  - `code_review_completed`: review must have `verdict`
  - `phase_plan_created`: plan must have non-empty `tasks` array
  - `phase_review_completed`: review must have `verdict`, `exit_criteria_met`
  - `plan_approved`: master plan must have positive integer `total_phases`
- Pre-read data should be passed through to mutations via context enrichment (no re-reads)
- This is the pipeline's primary value: making the non-deterministic agents conform to the deterministic process

### Goal 6: Preserve the Execution Sequence

**Description**: The execution sequence the pipeline enforces must remain:
1. Plan phase → create task handoffs one at a time → code (produces task report) → review → next task
2. After all tasks: phase report (by Tactical Planner) → phase review → next phase
3. After all phases: final review → human approval

The code reviewer always runs. The Coder always produces a task report (self-declaration of what was done). The Tactical Planner synthesizes phase reports from all task results. No steps are optional.

**Rationale**: This is the pipeline doing its job. The simplification is about implementation, not behavior. The Orchestrator agent should see the exact same sequence of actions in the same order. The only change is that each action arrives in fewer round-trips.

**Key considerations**:
- The Orchestrator's action routing table (18 external actions) stays mostly unchanged
- The Orchestrator's event signaling (18 events) stays unchanged
- The JSON result contract (`{ success, action, context, mutations_applied }`) stays unchanged
- Existing projects with in-flight `state.json` need a migration path or backward compatibility

### Goal 7: Simplify pipeline-engine.js to a Linear Recipe

**Description**: The core engine should be a single straight-line flow with no branching paths:
```
load state → pre-read documents → normalize paths → apply mutation → validate → write → resolve → return
```

No triage path vs. non-triage path. No internal action loop. No deferred validation vs. immediate validation. One code path for all events.

**Rationale**: The current engine has 3 code paths (init, cold start, standard), and the standard path forks into triage vs. non-triage, each with its own validation strategy. The triage path has a sub-fork for triage_attempts exceeded. The total cyclomatic complexity is high. A single code path is easier to reason about, test, and debug. When something goes wrong, there's only one place to look.

**Key considerations**:
- Init path (no state + `start`) is unavoidable — keep it, but it's simple
- Cold start path (state exists + `start`) is also simple — resolve and return
- The standard path should be the only complex one, and it should be straight-line
- Pre-read enrichment varies by event — use a lookup table of event → pre-read function
- Mutation varies by event — use the existing MUTATIONS lookup table
- Validation is uniform (same checks for all events)

### Goal 8: Rewrite Behavioral Tests for the New Pipeline

**Description**: Rewrite the behavioral test suite (`pipeline-behavioral.test.js`) from scratch to cover the simplified pipeline's expectations. The current test suite (~2,200+ lines, 10 describe blocks) is tightly coupled to the split-write/triage/internal-action architecture and cannot be incrementally patched.

**Rationale**: The existing behavioral tests exercise the exact patterns being eliminated — triage triggering, internal action loops, deferred validation, V8/V9 filtering, split-write sequences. These tests encode the current architecture, not the desired behavior. Trying to adapt them would mean maintaining the old complexity in test form. Additionally, the current per-module unit tests (`mutations.test.js`, `resolver.test.js`, `triage-engine.test.js`, `state-validator.test.js`, `pipeline-engine.test.js`) will need to be updated or replaced to match the refactored modules.

**Key considerations**:
- The 10 existing behavioral test suites cover: full happy path, multi-phase multi-task, task triage, phase triage, human gate modes, retry & corrective cycles, halt paths, cold-start resume, pre-read failures, frontmatter-driven flows
- The new tests should cover equivalent scenarios but assert on one-write-per-event semantics, merged actions, and the simplified decision table (8 task rows, 5 phase rows)
- Tests should verify that `partial` report status is treated as `failed`
- Tests should verify that `create_corrective_handoff` no longer exists (merged into `create_task_handoff` with `is_correction` context)
- Tests should verify schema v3 expectations
- The mock I/O factory pattern (`createMockIO`) is clean and should be preserved
- `triage-engine.test.js` is deleted along with the module — its logic is tested through mutation tests and behavioral tests
- Per-module unit tests (`mutations.test.js`, `resolver.test.js`, `state-validator.test.js`) must be rewritten to match the refactored interfaces

## Scope Boundaries

### In Scope

- Refactoring all 7 pipeline engine modules (`pipeline-engine.js`, `resolver.js`, `triage-engine.js`, `mutations.js`, `state-validator.js`, `constants.js`, `state-io.js`)
- Preserving all external behavior: same events, same actions, same artifact contracts, same JSON result format
- Preserving the decision table logic (11 task rows + 5 phase rows) in its new location
- Migrating or maintaining backward compatibility with existing `state.json` files
- Rewriting the behavioral test suite (`pipeline-behavioral.test.js`) from scratch for the new pipeline semantics
- Rewriting per-module unit tests (`mutations.test.js`, `resolver.test.js`, `state-validator.test.js`, `pipeline-engine.test.js`) to match refactored interfaces
- Deleting `triage-engine.test.js` along with the triage engine module
- Updating the Orchestrator agent definition if the action set changes
- Writing the new pipeline as a parallel set of scripts (write-new-then-swap), not modifying the old scripts in-place
- Auditing and updating agent definitions, skills, and templates to align with the refactored pipeline's contracts, actions, and artifact requirements

### Goal 9: Write-New-Then-Swap — Modular, Non-Destructive Delivery

**Description**: The new pipeline scripts are written as a complete, standalone set alongside the existing scripts. The old scripts are only deleted after the new pipeline is fully implemented and tested. The new codebase must be well-modularized — not a monolithic rewrite — and the top-level pipeline entry point (`pipeline.js`) should read as a clean, declarative recipe.

**Rationale**: The pipeline scripts are the engine that runs the orchestration system — including potentially **this very project**. Modifying them in-place while they're being used to execute tasks risks mid-project breakage where the pipeline can't process its own events. Writing the new scripts as a parallel set guarantees the old engine remains functional until the new one is verified. Additionally, the current monolithicity of `pipeline-engine.js` (502 lines of branching logic) is itself a complexity problem — the rewrite should decompose into focused modules.

**Key considerations**:
- Write new scripts into a new directory (e.g., `.github/orchestration/scripts/lib-v3/`) while old scripts remain in `lib/`
- The new `pipeline.js` entry point should read like a declarative recipe:
  ```
  load state → pre-read & validate artifacts → apply mutation → validate state → write → resolve → return
  ```
  Each step should be a clear function call, not inline logic. A reader should understand the pipeline flow by reading ~20 lines of the entry point
- Modularize by concern, not by size:
  - **`constants.js`** — enums, types (~19 external actions, reduced enums)
  - **`mutations.js`** — event handlers with absorbed decision logic
  - **`pre-reads.js`** (new) — artifact extraction/validation per event type
  - **`resolver.js`** — state → next external action (no internal actions)
  - **`validator.js`** — structural invariant checks (~10 invariants)
  - **`state-io.js`** — filesystem I/O (largely unchanged)
- Only after the full new test suite passes: swap `lib/` → `lib-old/`, `lib-v3/` → `lib/`, update `pipeline.js` require paths
- Old scripts (`lib-old/`) are kept temporarily as a rollback safety net, then deleted in a final cleanup
- The Orchestrator agent definition is updated to reflect any action changes only after the swap

### Goal 10: Update Documentation to Reflect the Simplified Pipeline

**Description**: Update `README.md` and all supporting docs under `docs/` to accurately reflect the simplified pipeline. Where documentation would otherwise duplicate or restate code — action lists, event tables, module inventories, decision tables — replace the prose with a pointer to the canonical file instead of maintaining a copy that will drift.

**Rationale**: Several docs pages today enumerate things that live authoritatively in code: the action constants in `constants.js`, the event-to-mutation map in `mutations.js`, the invariant list in `validator.js`, the module breakdown. Every time that code changes, there's a corresponding documentation update that rarely happens. The fix isn't to maintain better docs — it's to stop duplicating the code in docs. Narrative explanations of *how* and *why* belong in docs. Exhaustive lists of *what* belong next to the code.

**Key considerations**:
- `README.md` high-level descriptions (what the system does, pipeline overview, key features, mermaid diagram) stay — these are narrative, not code duplicates. Update only what reflects the new architecture (e.g., module count, line count claims, action count)
- `docs/scripts.md` currently restates every event, action, and internal action. After the rewrite: keep the conceptual explanation of the pipeline flow; replace exhaustive action/event tables with a pointer to `constants.js` as the canonical source
- `docs/pipeline.md` describes the execution sequence — this is narrative and stays, but any wiring details (retry logic, triage behavior) should reference module source rather than restate it
- `docs/agents.md` and `docs/skills.md` are agent/skill definitions, not code mirrors — update only where the Orchestrator's action routing description references removed actions (e.g., `create_corrective_handoff`, `halt_task_failed`)
- `docs/validation.md` lists invariants by ID — after removing V8/V9/V14/V15, update the list; point to `validator.js` for the authoritative invariant definitions
- Do not add new prose that could drift; do not remove explanations of intent and design rationale
- Documentation updates are the final step — they happen after the new pipeline is verified and swapped in

### Goal 11: Align Agent Definitions, Skills, and Templates with Pipeline Contracts

**Description**: Audit every agent definition (`.agent.md`), skill (`SKILL.md`), and document template against the actual pipeline code and contracts. Fix drift — remove references to deleted actions, update event/action names, correct artifact field lists, and tighten prompt language. All prompt updates must be concise, pattern-consistent, and high signal-to-noise.

**Rationale**: The pipeline is the deterministic authority, but agents and skills contain their own descriptions of actions, events, artifact fields, and sequencing. After a major pipeline refactor (Goals 1-9), these descriptions will be stale — referencing `create_corrective_handoff`, listing 35 actions instead of 19, describing triage behavior that no longer exists. Stale prompts cause agents to hallucinate steps and produce wrong artifacts. The prompts must reflect what the pipeline actually enforces, not what it used to enforce.

**Key considerations**:
- This is an alignment pass, not a behavior change — agents do the same jobs, the prompts just accurately describe the contracts they operate under
- Orchestrator agent definition: update action routing table (remove deleted actions like `create_corrective_handoff`, `halt_task_failed`; reflect merged `display_halted` + reason-in-context)
- Tactical Planner skill/agent: update to reflect `is_correction` context flag on `create_task_handoff` instead of separate corrective action
- Coder agent: verify task report field requirements match the pre-read contract (`status`, `has_deviations`, `deviation_type`)
- Reviewer agent: verify review field requirements match the pre-read contract (`verdict` for task; `verdict`, `exit_criteria_met` for phase)
- Templates (task handoff, task report, phase report, phase review): verify required frontmatter fields match what the pipeline actually reads
- Prompt style: every update should be terse and pattern-consistent — no filler, no restating what other agents do, no aspirational language. If the pipeline enforces it, state it as a constraint. If it doesn't, remove it
- Audit for duplicated information that will drift — if a prompt lists all 19 actions, it will go stale. Prefer describing the agent's own inputs/outputs, not the full system

### Out of Scope

- Changing the planning pipeline (it works fine)
- Changing agent behavior or adding new agent capabilities (agents do the same jobs — prompts just get accurate)
- Adding new pipeline features (new events, new actions, new tiers)
- Changing the `state.json` schema (except removing triage-specific fields if they become unnecessary)
- Changing the Orchestrator's event signaling protocol
- UI dashboard changes
- Changing `orchestration.yml` configuration schema

## Key Constraints

- **Determinism is non-negotiable**: The pipeline must remain the deterministic authority over sequencing and artifact enforcement. No agent decision-making for process flow.
- **Behavioral preservation**: The simplified pipeline must produce the same external action for the same state + event combination. The Orchestrator should not need to change its routing logic (beyond removing actions that no longer exist).
- **Existing project compatibility**: Projects currently in-flight should either work with the new engine or have a clear migration path.
- **Testability**: The new engine must be at least as testable as the current one — dependency injection for I/O, pure functions where possible.
- **Node.js, no dependencies**: The pipeline runs as a CLI tool with zero external dependencies. Must stay that way.

## Resolved Questions

### State Schema Version → **Bump to v3**
Clean break. Schema bumps from `orchestration-state-v2` to `orchestration-state-v3`. Existing in-flight projects will need to restart with the new engine. This is acceptable given the scope of internal changes (removed fields, restructured task state).

### Triage Attempts Counter → **Keep `task.retries` only, drop `triage_attempts`**
With atomic writes, the "triage ran twice" scenario is impossible by construction. The per-task `retries` counter is sufficient for the retry budget check (`retries < max_retries_per_task`). The global `execution.triage_attempts` field is removed from the schema.

### Corrective vs Fresh Handoff → **Merge into one `create_task_handoff` action**
Both actions spawn the Tactical Planner to write a handoff doc. The distinction (fresh vs. corrective) is communicated via context: `{ is_correction: true, previous_review: "...", reason: "changes_requested" }`. One action, simpler routing table. The Orchestrator passes richer context to the Tactical Planner so it knows whether it's creating a fresh handoff or a corrective one.

### Halt Reason Specificity → **Generic `display_halted` + reason in context**
One halt action. The reason (failed task, rejected review, phase rejected, etc.) lives in `result.context.details`. The Orchestrator doesn't need to route differently per halt type — it always shows the blocker and stops. This removes `halt_task_failed`, `halt_from_review`, and any other specific halt actions.

### Partial Report Status → **Treat `partial` as `failed`**
Simplifies the task decision table. If the Coder didn't complete the task, that's a failure — the corrective cycle handles it. Removes rows 8-10 from the task decision table, reducing it from 11 rows to 8. The pre-read validation accepts `complete` or `failed` (plus synonyms `pass`/`fail`). `partial` maps to `failed`.

## Summary

Simplify the pipeline engine from ~2,620 lines to ~970 lines by eliminating the triage layer (absorb into mutations), eliminating internal actions (mutations produce final state), and reducing the validator (remove invariants that exist solely for split-write protection). Rewrite the behavioral and unit test suites to cover the simplified pipeline's one-write-per-event semantics, merged actions, and reduced decision tables. Deliver as a parallel write-new-then-swap: new modular scripts written alongside the old, swapped in only after full test verification, with a clean declarative entry point. Audit and tighten all agent definitions, skills, and templates so prompts reflect the refactored pipeline's actual contracts — no stale actions, no phantom fields, no drifted descriptions. The pipeline's fundamental role — deterministic sequencing and artifact enforcement over non-deterministic agents — is preserved. Same events, same external actions, same contracts. The Orchestrator sees the same interface. The implementation just stops fighting itself.
