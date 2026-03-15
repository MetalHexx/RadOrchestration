---
project: "PARALLEL-EXECUTION"
author: "brainstormer-agent"
created: "2026-03-15T00:00:00.000Z"
depends_on: "TRANSITION-TABLE"
---

# PARALLEL-EXECUTION — Brainstorming

## Problem Space

The current pipeline is strictly sequential: one active task at a time, one `current_task` pointer per phase, one action returned per event. For many projects this is fine — tasks have dependencies and must run in order. But for phases where tasks are genuinely independent (e.g., "implement module A" and "implement module B" have no shared dependencies), the sequential model wastes wall-clock time. The orchestrator must wait for task A's full lifecycle (handoff → execute → review → advance) before even starting task B.

The goal is to support **intra-phase parallelism**: within a single phase, multiple independent tasks can run concurrently — each in its own lifecycle, dispatched to separate `@Coder` subagent invocations. The orchestrator spawns multiple agents simultaneously; results come back as separate events, each updating the shared `state.json` sequentially (one event at a time — no concurrent writes).

This project builds directly on `TRANSITION-TABLE`. The task lifecycle table already describes what action to take for a given task state. Parallelism means the resolver evaluates the lifecycle table for **multiple ready tasks** and returns **multiple actions** instead of one. The mutation model (`one event in → one state write out`) is preserved — parallelism is at the **dispatch layer** (what the orchestrator spawns), not the state write layer.

There will always be a single orchestrator for a given project. Two orchestrators can run simultaneously, but they work from entirely separate `state.json` files and never interfere.

## Validated Goals

### Goal 1: Extend the task data model to express dependencies and slot assignments

**Description**: Each task in a phase plan currently has `name`, `status`, `handoff_doc`, `report_doc`, etc. Add two new optional fields: `depends_on: string[]` (names of tasks that must complete before this task starts) and `slot: string | null` (an optional concurrency slot identifier for capacity constraints). Both fields default to empty/null for backward compatibility.

**Rationale**: Without `depends_on`, the pipeline can't know which tasks are safe to run in parallel. The Tactical Planner agent already understands dependencies when creating phase plans — it should express them in the frontmatter. The pipeline reads them from the phase plan document (via pre-read) and stores them in state for resolver use.

**Key considerations**:
- `depends_on` is an array of task **names** (not indices), since names are stable across corrections
- A task with an empty `depends_on` array is eligible to run in parallel with any other unblocked task
- The validator (V12) currently checks allowed status transitions — it doesn't need to know about dependencies; that logic lives in the resolver
- Schema v3 allows new task fields — they're just additional keys. No schema version bump needed if the validator treats unknown keys as ignored

### Goal 2: Add a `max_concurrent` setting per phase (and globally in config)

**Description**: Not every project or team wants unbounded parallelism. Add `max_concurrent: number` to the phase plan definition (read from phase plan frontmatter, stored in the phase object). Add a global default in `orchestration.yml` under `limits`. The resolver uses `min(phase.max_concurrent, config.limits.max_concurrent)` as the concurrency ceiling.

**Rationale**: Controlling concurrency is essential for teams with limited compute, token budgets, or orchestration tool constraints. A team might want at most 2 concurrent tasks even for phases with 5 independent tasks. The orchestrator agent can exceed their budget without this guard.

**Key considerations**:
- Default: `max_concurrent: 1` — backward-compatible sequential behavior. Setting it to 1 makes the pipeline behave exactly as it does today
- The `ask` human gate mode means the human approves each task; parallelism in `ask` mode implies multiple simultaneous approval requests — likely undesirable. Consider: in `ask` mode, `max_concurrent` is forced to 1 regardless of config
- Phase plan frontmatter may omit `max_concurrent`, in which case the global config default applies

### Goal 3: Replace `current_task: number` with a scheduling model in phase state

**Description**: The phase object currently tracks one task at a time via `current_task: number` (0-based pointer). Replace (or extend) this with a scheduling model: `ready_queue: number[]` (task indices eligible to start), `in_flight: number[]` (task indices currently executing), `completed: number[]` (task indices finished), and retain `current_task` as a compatibility alias pointing to the lowest non-completed task.

**Rationale**: The resolver needs to know which tasks are ready (dependencies met, not yet started) and how many are in-flight (to enforce `max_concurrent`). Without this scheduling state, the resolver would have to recompute readiness from scratch on every call. Storing it in state makes the resolver read-only (no side effects from readiness computation) and makes the state auditable.

**Key considerations**:
- `ready_queue` and `in_flight` are **derived** from the task array — they could be recomputed rather than stored. Storing them avoids recomputation cost and makes state.json self-describing. Tradeoff: they must be kept consistent by mutations
- The `handleTaskHandoffCreated` mutation moves a task from `ready_queue` to `in_flight`
- The `handleCodeReviewCompleted` mutation moves a task from `in_flight` to `completed` (on advance) or back to `ready_queue` (on retry/corrective)
- V1/V2 validator checks (bounds on `current_task`) need to be updated or complemented for the scheduling fields
- Must remain serializable to JSON (no Sets — use arrays)

### Goal 4: Resolver returns an array of actions

**Description**: Change the resolver's return type from `{ action, context }` to `{ actions: [{ action, context }] }` — an array, which is typically length 1 but can be longer for parallel dispatch. The engine passes the array back to the orchestrator. The orchestrator spawns one agent invocation per action.

**Rationale**: This is the core architectural change that enables parallelism. The pipeline's internal model stays the same (one event in, one state write out), but the orchestrator now receives multiple things to do simultaneously. The resolver determines how many by inspecting `ready_queue.length`, `in_flight.length`, and `max_concurrent`.

**Key considerations**:
- Backward compatibility: the orchestrator's current code reads `result.action` (singular). This breaks existing orchestrator agent behavior. Options: (a) keep `result.action` as `result.actions[0]` alias alongside `result.actions`, or (b) make it a clean break with a new field name. A migration shim is simple.
- The `pipeline.js` CLI output format currently prints a single action — update the output contract to print an actions array (even if length 1 for sequential compatibility)
- For sequential phases (all `depends_on` chains), the actions array always has length 1 — no behavior change
- The orchestrator must handle partial completion: if 3 tasks are dispatched and task A returns `task_completed` but B and C are still running, the pipeline processes A's event and returns the next set of actions (which might be "send A to review + B and C are still in-flight, no new dispatches")

### Goal 5: Preserve the single-writer, single-event guarantee

**Description**: Even in parallel execution mode, the `state.json` is written once per event. Events arriving from parallel subagents are processed sequentially — the orchestrator queues them. There is no concurrent write to `state.json`. This constraint is non-negotiable and must be made explicit in the architecture.

**Rationale**: Concurrent writes to `state.json` would require locking, conflict resolution, and rollback — enormous complexity for a system designed to be simple and auditable. The parallelism is at the **agent execution level** (multiple Coder agents running), not the **state write level**. The orchestrator is the single coordinator that funnels events into the pipeline one at a time.

**Key considerations**:
- The pipeline engine already assumes sequential events — `validateTransition()` compares current vs proposed states, which assumes no concurrent mutations
- Document this explicitly in `pipeline-engine.js` and in the pipeline architecture docs so it's never accidentally violated
- For the `ask` human gate mode, the human must approve tasks one at a time — parallelism is suspended at gate points in `ask` mode

### Goal 6: Task dependency resolution in the resolver

**Description**: The resolver, when building the `ready_queue` for dispatch, must evaluate task dependencies: a task is "ready" if all tasks in its `depends_on` array have status `complete`. The resolver evaluates the full task array once, identifies all ready-but-not-started tasks, respects `max_concurrent`, and returns actions for up to `max_concurrent - in_flight.length` tasks.

**Rationale**: This is the scheduling logic. It needs to live in the resolver (or the transition table evaluation engine) because the resolver's job is to determine what should happen next given the current state.

**Key considerations**:
- Circular dependency detection: the phase plan pre-read (pre-reads.js) should validate that the `depends_on` graph is a DAG before storing tasks in state. If a cycle is detected, the phase plan event returns an error.
- Tasks with no `depends_on` (array empty or field absent) are always eligible immediately — this is the default for existing projects
- The phase plan document's `tasks` frontmatter field currently holds a flat array of task names. It needs to become an array of objects: `[{ name: "task-name", depends_on: [] }]` — or a parallel `task_deps` field to avoid breaking the schema

## Scope Boundaries

### In Scope
- New task fields: `depends_on`, `slot` (optional, backward-compatible)
- New phase fields: `max_concurrent`, `ready_queue`, `in_flight` 
- New global config: `limits.max_concurrent` (default: 1)
- Resolver returns `{ actions: [...] }` instead of `{ action, context }`
- Dependency resolution and DAG validation in the phase plan pre-read
- Engine / CLI output format updated to handle actions array
- Orchestrator agent definition updated to handle multiple simultaneous dispatches
- Behavioral tests updated for parallel scenarios + sequential compatibility

### Out of Scope
- Config-driven custom pipeline steps — that is `CUSTOM-PIPELINE-STEP`
- Concurrent state writers (explicitly out — single-writer guarantee is preserved)  
- Cross-phase parallelism (running phase 2 while phase 1 is completing) — overly complex, deferred
- Resource/cost accounting for parallel subagent invocations — out of scope for engine
- XState or actor-model adoption

## Key Constraints

- **Single writer**: State is written exactly once per event regardless of how many agents are running in parallel
- **Sequential events**: The orchestrator queues events from parallel agents; the engine processes them one at a time
- **Backward compatibility**: A project with no `depends_on` tasks and no `max_concurrent` override behaves identically to today's sequential pipeline
- **`max_concurrent: 1` is the default**: Parallelism is opt-in, not the default behavior
- **TRANSITION-TABLE is a prerequisite**: The task lifecycle rule table must exist before parallelism is layered on top. The resolver's "evaluate rules for multiple tasks" logic assumes a clean rule table to iterate
- **No external dependencies**: Still zero npm packages

## Open Questions

- Should the `PARALLEL-EXECUTION` project update the phase plan document schema (frontmatter `tasks` array → objects with `depends_on`) or add a parallel `task_deps` map? The schema change is cleaner but requires updates to the Tactical Planner agent's output contract.
- In `ask` gate mode, when a human-approval gate fires mid-parallel-cluster, does the orchestrator suspend all remaining in-flight tasks? Or let them run and gate them all when they complete? The simpler answer is: gate before dispatch (only dispatch when in_flight is empty in `ask` mode).
- Should `in_flight` and `ready_queue` be stored in `state.json` or recomputed on every resolver call? Stored = auditable and fast; recomputed = simpler mutations (they don't need to maintain the scheduling fields). Given state.json's purpose as an audit trail, stored seems right.
- How does `pipeline.js` (the CLI) present multiple actions to the orchestrator agent? Current output is `Action: spawn_code_reviewer`. Does it become a numbered list? JSON array? The orchestrator agent parses this output.
- Should the phase plan pre-read reject a phase plan with tasks that have `depends_on` references to non-existent task names? (Yes — fail fast rather than silently ignoring bad references.)

## Summary

This project adds intra-phase parallelism to the pipeline by introducing a dependency model for tasks and changing the resolver to return an array of actions instead of one. The phase plan can declare which tasks can run in parallel (via `depends_on`), and a `max_concurrent` limit (default: 1 for backward compatibility) controls how many agents are dispatched simultaneously. The single-writer, single-event guarantee is preserved — concurrency lives at the agent dispatch level, not the state write level. This project requires `TRANSITION-TABLE` as a foundation, since a rule table over tasks is the natural structure for multi-task resolver evaluation.
