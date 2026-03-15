---
project: "TRANSITION-TABLE"
status: "draft"
type: "architecture"
author: "architect-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Architecture

## Technical Overview

This project refactors the pipeline's routing layer from implicit if/else function trees in `resolver.js` into explicit, data-driven rule tables in a new `transition-table.js` module. The refactor introduces one new file (`lib/transition-table.js`) containing four named table exports, and modifies one existing file (`lib/resolver.js`) to become a generic table-evaluation engine. All other pipeline modules — `pipeline-engine.js`, `mutations.js`, `pre-reads.js`, `validator.js`, `constants.js`, `state-io.js` — remain unchanged. The technology stack is Node.js with CommonJS modules, zero external dependencies, and `node:test` for testing.

## System Layers

This is a backend CLI pipeline with no UI. The traditional four-layer architecture is adapted to reflect the pipeline's functional layers:

```
┌──────────────────────────────────────────────────────────────┐
│  CLI / Entry Point                                           │  pipeline.js — arg parsing, I/O wiring
├──────────────────────────────────────────────────────────────┤
│  Engine                                                      │  pipeline-engine.js — processEvent recipe
│                                                              │  resolver.js — table evaluation, action resolution
├──────────────────────────────────────────────────────────────┤
│  Data / Rules                                                │  transition-table.js — 4 named rule tables (NEW)
│                                                              │  constants.js — frozen enums, typedefs
├──────────────────────────────────────────────────────────────┤
│  Support                                                     │  mutations.js — event→state mutation handlers
│                                                              │  pre-reads.js — per-event pre-read validation
│                                                              │  validator.js — 13 structural/transition invariants
├──────────────────────────────────────────────────────────────┤
│  Infrastructure                                              │  state-io.js — filesystem reads/writes
└──────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Change | Responsibility |
|--------|-------|------|--------|----------------|
| `transition-table.js` | Data | `.github/orchestration/scripts/lib/transition-table.js` | **NEW** | Exports 4 named rule tables: `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH`. Pure data — no engine logic, no I/O, no side effects. |
| `resolver.js` | Engine | `.github/orchestration/scripts/lib/resolver.js` | **MODIFIED** | Becomes a generic table-evaluation engine. Imports tables from `transition-table.js`, iterates them with first-match-wins semantics. Retains `resolveNextAction` as its single public export with identical signature. |
| `constants.js` | Data | `.github/orchestration/scripts/lib/constants.js` | **MODIFIED** (additive) | Adds 4 new JSDoc typedefs (`PlanningStepDef`, `TaskRuleContext`, `LifecycleRule`, `TierDispatchEntry`). No behavioral changes. All existing enums remain frozen. |
| `pipeline-engine.js` | Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Unchanged | `processEvent` linear recipe — calls `resolveNextAction(state, config)` at step (g). |
| `mutations.js` | Support | `.github/orchestration/scripts/lib/mutations.js` | Unchanged | 17 event→handler mutation map. `resolveTaskOutcome`/`resolvePhaseOutcome` decision tables. |
| `pre-reads.js` | Support | `.github/orchestration/scripts/lib/pre-reads.js` | Unchanged | 5 per-event pre-read validation handlers. Shares event keys with tables but no import dependency. |
| `validator.js` | Support | `.github/orchestration/scripts/lib/validator.js` | Unchanged | 13 invariants (V1–V13). Structural + transition checks. |
| `state-io.js` | Infrastructure | `.github/orchestration/scripts/lib/state-io.js` | Unchanged | Filesystem I/O for state.json and config. |
| `pipeline.js` | CLI | `.github/orchestration/scripts/pipeline.js` | Unchanged | CLI entry point. Parses args, wires real I/O, calls `processEvent()`. |
| `docs/scripts.md` | Documentation | `docs/scripts.md` | **MODIFIED** | Updated with table structure explanations for all 4 tables and the resolver iteration model. |

## Contracts & Interfaces

### New JSDoc Typedefs (added to `constants.js`)

```js
// .github/orchestration/scripts/lib/constants.js (additions)

/**
 * @typedef {Object} PlanningStepDef
 * @property {string} key - Step name matching state.planning.steps[].name
 * @property {string} action - NEXT_ACTIONS value returned when this step is next
 * @property {string} event - Completion event name (informational)
 * @property {string} doc_type - Document type produced (informational)
 */

/**
 * @typedef {Object} TaskRuleContext
 * @property {Task} task - Current task object (phase.tasks[phase.current_task])
 * @property {Phase} phase - Current phase object
 * @property {number} phaseIndex - Zero-based phase index (state.execution.current_phase)
 * @property {number} taskIndex - Zero-based task index (phase.current_task)
 * @property {Config} config - Pipeline configuration
 */

/**
 * @typedef {Object} PhaseRuleContext
 * @property {Phase} phase - Current phase object (all tasks complete)
 * @property {number} phaseIndex - Zero-based phase index
 * @property {Config} config - Pipeline configuration
 */

/**
 * @typedef {Object} LifecycleRule
 * @property {string} id - Stable rule identifier (insertion anchor for CUSTOM-PIPELINE-STEP)
 * @property {function} condition - (ctx) => boolean — pure predicate, no side effects
 * @property {string} action - NEXT_ACTIONS value returned when this rule matches
 * @property {function} buildContext - (ctx) => object — pure context builder, no side effects
 */

/**
 * @typedef {Object} TierDispatchEntry
 * @property {Set<string>} validEvents - Events valid during this tier
 * @property {function} resolve - (state, config) => { action: string, context: object }
 */
```

### `transition-table.js` — Export Contract

```js
// .github/orchestration/scripts/lib/transition-table.js

/**
 * @type {{
 *   PLANNING_STEPS: PlanningStepDef[],
 *   TASK_LIFECYCLE_RULES: LifecycleRule[],
 *   PHASE_LIFECYCLE_RULES: LifecycleRule[],
 *   TIER_DISPATCH: Object<string, TierDispatchEntry>
 * }}
 */
module.exports = {
  PLANNING_STEPS,
  TASK_LIFECYCLE_RULES,
  PHASE_LIFECYCLE_RULES,
  TIER_DISPATCH,
};
```

**Import contract** — `transition-table.js` imports ONLY from `constants.js`:

```js
const {
  PIPELINE_TIERS, PLANNING_STEP_STATUSES, TASK_STATUSES, PHASE_STATUSES,
  REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS, HUMAN_GATE_MODES, NEXT_ACTIONS,
} = require('./constants');
```

No imports from `resolver.js`, `mutations.js`, `pre-reads.js`, `validator.js`, or `pipeline-engine.js`. This is enforced by design — the module is a dependency-graph leaf.

### Table DS-1: `PLANNING_STEPS`

Ordered array of planning step definitions. The resolver iterates in order, returning the action for the first incomplete step.

```js
/** @type {PlanningStepDef[]} */
const PLANNING_STEPS = [
  { key: 'research',     action: NEXT_ACTIONS.SPAWN_RESEARCH,     event: 'research_completed',     doc_type: 'research_findings' },
  { key: 'prd',          action: NEXT_ACTIONS.SPAWN_PRD,          event: 'prd_completed',          doc_type: 'prd' },
  { key: 'design',       action: NEXT_ACTIONS.SPAWN_DESIGN,       event: 'design_completed',       doc_type: 'design' },
  { key: 'architecture', action: NEXT_ACTIONS.SPAWN_ARCHITECTURE, event: 'architecture_completed', doc_type: 'architecture' },
  { key: 'master_plan',  action: NEXT_ACTIONS.SPAWN_MASTER_PLAN,  event: 'master_plan_completed',  doc_type: 'master_plan' },
];
```

- `key` and `action` are consumed by the resolver at evaluation time
- `event` and `doc_type` are informational columns for self-documentation and downstream tooling
- Array is **not frozen** — downstream CUSTOM-PIPELINE-STEP may clone and extend

### Table DS-2: `TASK_LIFECYCLE_RULES`

Ordered, first-match-wins rule array. 6 rules covering the full task lifecycle. Each rule's `condition` and `buildContext` receive a `TaskRuleContext` bag at evaluation time.

| Order | Rule ID | Condition Summary | Action |
|-------|---------|-------------------|--------|
| 1 | `task-halted` | `task.status === HALTED` | `display_halted` |
| 2 | `task-corrective-handoff` | `task.status === FAILED && task.review_action === CORRECTIVE_TASK_ISSUED` | `create_task_handoff` |
| 3 | `task-fresh-handoff` | `task.status === NOT_STARTED && !task.handoff_doc` | `create_task_handoff` |
| 4 | `task-execute` | `task.status === IN_PROGRESS && task.handoff_doc && !task.report_doc` | `execute_task` |
| 5 | `task-review` | `task.status === COMPLETE && !task.review_doc` | `spawn_code_reviewer` |
| 6 | `task-gate` | `task.status === COMPLETE && task.review_action === ADVANCED && config.human_gates.execution_mode === TASK` | `gate_task` |

Rule order is critical — `task-halted` must be first (takes priority over all other states); `task-gate` must follow `task-review` (a task needing review is dispatched to review before any gate check).

### Table DS-3: `PHASE_LIFECYCLE_RULES`

Ordered, first-match-wins rule array. 5 rules covering phase completion lifecycle. Each rule's `condition` and `buildContext` receive a `PhaseRuleContext` bag.

| Order | Rule ID | Condition Summary | Action |
|-------|---------|-------------------|--------|
| 1 | `phase-report` | `!phase.phase_report_doc` | `generate_phase_report` |
| 2 | `phase-review` | `!phase.phase_review_doc` | `spawn_phase_reviewer` |
| 3 | `phase-gate-advanced` | `phase.phase_review_action === ADVANCED && (mode === PHASE \|\| mode === TASK)` | `gate_phase` |
| 4 | `phase-corrective` | `phase.phase_review_action === CORRECTIVE_TASKS_ISSUED` | `display_halted` |
| 5 | `phase-halted` | `phase.phase_review_action === HALTED` | `display_halted` |

### Table DS-4: `TIER_DISPATCH`

Plain object keyed by tier name. Maps each tier to its valid event set and resolver function.

```js
/** @type {Object<string, TierDispatchEntry>} */
const TIER_DISPATCH = {
  [PIPELINE_TIERS.PLANNING]: {
    validEvents: new Set([
      'research_completed', 'prd_completed', 'design_completed',
      'architecture_completed', 'master_plan_completed', 'plan_approved',
    ]),
    resolve: null, // Bound to resolvePlanning at require-time by resolver.js
  },
  [PIPELINE_TIERS.EXECUTION]: {
    validEvents: new Set([
      'phase_plan_created', 'task_handoff_created', 'task_completed',
      'code_review_completed', 'phase_report_created', 'phase_review_completed',
      'task_approved', 'phase_approved',
    ]),
    resolve: null, // Bound to resolveExecution at require-time by resolver.js
  },
  [PIPELINE_TIERS.REVIEW]: {
    validEvents: new Set([
      'final_review_completed', 'final_approved',
    ]),
    resolve: null, // Bound to resolveReview at require-time by resolver.js
  },
};
```

**Note on `resolve` functions**: The `TIER_DISPATCH` table defines `validEvents` as static data. The `resolve` function references are **not** defined in `transition-table.js` — they are bound by `resolver.js` after `require()`, since the tier-specific resolvers (`resolvePlanning`, `resolveExecution`, `resolveReview`) live in `resolver.js` and depend on table-evaluation functions that also live there. This avoids a circular dependency: `transition-table.js` → `constants.js` only, and `resolver.js` → `transition-table.js` + `constants.js`.

**Alternative**: Define `TIER_DISPATCH` entirely in `resolver.js` since it references resolver-local functions. This eliminates the binding step but splits the "complete routing picture" across two files. The architecture prefers keeping all four tables in one file for discoverability, with the resolver binding the `resolve` references at module load time.

### `resolver.js` — Refactored Internal Contract

After refactoring, `resolver.js` contains:

```js
// .github/orchestration/scripts/lib/resolver.js

// ─── Imports ────────────────────────────────────────────────────
const { PIPELINE_TIERS, PLANNING_STEP_STATUSES, PHASE_STATUSES,
        TASK_STATUSES, NEXT_ACTIONS } = require('./constants');
const { PLANNING_STEPS, TASK_LIFECYCLE_RULES, PHASE_LIFECYCLE_RULES,
        TIER_DISPATCH } = require('./transition-table');

// ─── Presentation Helpers (unchanged) ───────────────────────────
/** @param {number} phaseIndex @returns {string} e.g. "P01" */
function formatPhaseId(phaseIndex) { /* unchanged */ }

/** @param {number} phaseIndex @param {number} taskIndex @returns {string} e.g. "P01-T01" */
function formatTaskId(phaseIndex, taskIndex) { /* unchanged */ }

/** @param {string} details @returns {{ action: string, context: { details: string } }} */
function halted(details) { /* unchanged */ }

// ─── Generic Rule Evaluator ─────────────────────────────────────
/**
 * @param {LifecycleRule[]} rules - Ordered rule array
 * @param {object} ctx - Uniform context bag (TaskRuleContext or PhaseRuleContext)
 * @returns {{ action: string, context: object } | null}
 */
function evaluateRules(rules, ctx) { /* new */ }

// ─── Tier Resolvers (refactored to iterate tables) ──────────────
/** @param {StateJson} state @returns {{ action: string, context: object }} */
function resolvePlanning(state) { /* iterates PLANNING_STEPS */ }

/** @param {StateJson} state @param {Config} config @returns {{ action: string, context: object }} */
function resolveExecution(state, config) { /* delegates to evaluateRules with TASK_LIFECYCLE_RULES or PHASE_LIFECYCLE_RULES */ }

/** @param {StateJson} state @returns {{ action: string, context: object }} */
function resolveReview(state) { /* unchanged — 2 conditions, simple enough without a table */ }

// ─── TIER_DISPATCH Binding ──────────────────────────────────────
TIER_DISPATCH[PIPELINE_TIERS.PLANNING].resolve = resolvePlanning;
TIER_DISPATCH[PIPELINE_TIERS.EXECUTION].resolve = resolveExecution;
TIER_DISPATCH[PIPELINE_TIERS.REVIEW].resolve = resolveReview;

// ─── Public Export (signature unchanged) ────────────────────────
/**
 * @param {StateJson} state - Post-mutation, post-validation state
 * @param {Config} config - Parsed orchestration config
 * @returns {{ action: string, context: object }}
 */
function resolveNextAction(state, config) { /* uses TIER_DISPATCH lookup */ }

module.exports = { resolveNextAction };
```

### `evaluateRules` — The Generic Table Engine

```js
/**
 * Evaluate a first-match-wins rule table against a context bag.
 * Returns the matched rule's action and built context, or null if no rule matches.
 *
 * @param {LifecycleRule[]} rules
 * @param {object} ctx
 * @returns {{ action: string, context: object } | null}
 */
function evaluateRules(rules, ctx) {
  for (const rule of rules) {
    if (rule.condition(ctx)) {
      return { action: rule.action, context: rule.buildContext(ctx) };
    }
  }
  return null;
}
```

This function is the core of the refactor. It replaces all if/else chains with a single generic loop. The caller handles the `null` (no-match) case by returning `halted(...)` with diagnostic details.

### `resolveNextAction` — Refactored Dispatch

```js
function resolveNextAction(state, config) {
  const tier = state.execution.current_tier;

  // Terminal tiers — handled directly, not in TIER_DISPATCH
  if (tier === PIPELINE_TIERS.HALTED) {
    return halted(state.execution.halt_reason || 'Pipeline is halted');
  }
  if (tier === PIPELINE_TIERS.COMPLETE) {
    return { action: NEXT_ACTIONS.DISPLAY_COMPLETE, context: {} };
  }

  // Active tiers — dispatch via table
  const entry = TIER_DISPATCH[tier];
  if (!entry) {
    return halted('Unknown tier: ' + tier);
  }
  return entry.resolve(state, config);
}
```

### `resolveExecution` — Refactored to Use Tables

```js
function resolveExecution(state, config) {
  const exec = state.execution;
  const phaseIndex = exec.current_phase;
  const phase = exec.phases[phaseIndex];

  if (!phase) {
    return halted('No phase found at current_phase index ' + phaseIndex);
  }

  if (phase.status === PHASE_STATUSES.HALTED) {
    return halted(`Phase ${formatPhaseId(phaseIndex)} (${phase.name}) is halted`);
  }

  if (phase.status === PHASE_STATUSES.NOT_STARTED) {
    return {
      action: NEXT_ACTIONS.CREATE_PHASE_PLAN,
      context: { phase_index: phaseIndex, phase_id: formatPhaseId(phaseIndex) },
    };
  }

  if (phase.status === PHASE_STATUSES.IN_PROGRESS) {
    const taskIndex = phase.current_task;

    // All tasks processed → phase lifecycle rules
    if (taskIndex >= phase.total_tasks) {
      const ctx = { phase, phaseIndex, config };
      return evaluateRules(PHASE_LIFECYCLE_RULES, ctx)
        || halted(`Unresolvable phase completion state at ${formatPhaseId(phaseIndex)}`);
    }

    // Active task → task lifecycle rules
    const task = phase.tasks[taskIndex];
    if (!task) {
      return halted(`No task found at index ${taskIndex} in phase ${formatPhaseId(phaseIndex)}`);
    }

    const ctx = { task, phase, phaseIndex, taskIndex, config };
    return evaluateRules(TASK_LIFECYCLE_RULES, ctx)
      || halted(`Unresolvable task state at ${formatTaskId(phaseIndex, taskIndex)}: status=${task.status}, handoff=${!!task.handoff_doc}, report=${!!task.report_doc}, review=${!!task.review_doc}`);
  }

  return halted('Unexpected phase status: ' + phase.status);
}
```

### Action-Context Contracts Per Rule

Each rule's `buildContext` must produce the **exact** context shape currently returned by the equivalent if/else branch. These shapes are the behavioral contract verified by `pipeline-behavioral.test.js`.

| Rule ID | Action | Required Context Fields |
|---------|--------|------------------------|
| `task-halted` | `display_halted` | `details` (string — includes task ID and name) |
| `task-corrective-handoff` | `create_task_handoff` | `is_correction` (true), `previous_review`, `reason`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-fresh-handoff` | `create_task_handoff` | `is_correction` (false), `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-execute` | `execute_task` | `handoff_doc`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-review` | `spawn_code_reviewer` | `report_doc`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-gate` | `gate_task` | `phase_index`, `task_index`, `phase_id`, `task_id` |
| `phase-report` | `generate_phase_report` | `phase_index`, `phase_id` |
| `phase-review` | `spawn_phase_reviewer` | `phase_report_doc`, `phase_index`, `phase_id` |
| `phase-gate-advanced` | `gate_phase` | `phase_index`, `phase_id` |
| `phase-corrective` | `display_halted` | `details` (string — diagnostic about corrective tasks) |
| `phase-halted` | `display_halted` | `details` (string — diagnostic about halted phase) |

**Critical implementation note**: The `task-corrective-handoff` rule's `buildContext` must use `reason: task.review_verdict` (matching the current `resolver.js` line behavior), and the `task-gate` rule must check `config.human_gates.execution_mode` (not `config.execution_mode`). The `buildContext` closures also call `formatPhaseId`/`formatTaskId` which live in `resolver.js` — the closures reference these functions via module scope since the tables import them or they are passed at evaluation time. See the Binding Strategy section below.

### Binding Strategy: `buildContext` Access to Resolver Helpers

Rule `buildContext` closures need access to `formatPhaseId` and `formatTaskId` (presentation helpers in `resolver.js`). Two approaches:

**Chosen approach**: Pass helpers via the context bag. The resolver adds `formatPhaseId` and `formatTaskId` to the context bag before calling `evaluateRules`:

```js
const ctx = { task, phase, phaseIndex, taskIndex, config, formatPhaseId, formatTaskId };
```

This keeps `transition-table.js` free of imports from `resolver.js` and allows `buildContext` closures to call `ctx.formatPhaseId(ctx.phaseIndex)`. The table module remains a dependency-graph leaf.

**Alternative considered**: Define the helpers in `transition-table.js` or in `constants.js`. Rejected because they are presentation concerns, not routing data.

### Preserved Public API

These four module exports are consumed by `pipeline-engine.js` and must retain identical signatures:

| Module | Export | Signature | Status |
|--------|--------|-----------|--------|
| `resolver.js` | `resolveNextAction` | `(state: StateJson, config: Config) => { action: string, context: object }` | Unchanged |
| `mutations.js` | `getMutation` | `(event: string) => function \| undefined` | Unchanged |
| `validator.js` | `validateTransition` | `(current: StateJson, proposed: StateJson, config: Config) => ValidationError[]` | Unchanged |
| `pre-reads.js` | `preRead` | `(event, context, readDocument, projectDir) => { context, error }` | Unchanged |

## API Endpoints

Not applicable — this project has no HTTP API. The pipeline is a CLI tool invoked via `node pipeline.js <event> <projectDir> [context] [configPath]`.

## Dependencies

### External Dependencies

None. The pipeline is zero-dependency by design. No `package.json` changes.

### Internal Dependencies (module → module)

**Before refactor:**

```
pipeline.js (CLI)
  └── pipeline-engine.js
        ├── pre-reads.js ──→ constants.js
        ├── mutations.js ──→ constants.js
        ├── validator.js ──→ constants.js
        ├── resolver.js  ──→ constants.js
        └── constants.js
```

**After refactor:**

```
pipeline.js (CLI)
  └── pipeline-engine.js
        ├── pre-reads.js      ──→ constants.js
        ├── mutations.js      ──→ constants.js
        ├── validator.js      ──→ constants.js
        ├── resolver.js       ──→ constants.js, transition-table.js  [CHANGED]
        ├── transition-table.js ──→ constants.js                      [NEW]
        └── constants.js
```

`transition-table.js` is a **dependency-graph leaf** — it imports only from `constants.js`. No circular dependencies are possible by construction. The dependency flow is strictly unidirectional:

```
resolver.js → transition-table.js → constants.js
```

### Decoupled Systems (shared event keys only)

`transition-table.js` and `pre-reads.js` both reference event name strings (e.g., `'research_completed'`, `'task_completed'`). They share these keys but have **no import dependency** — they are deliberately decoupled parallel systems:

- `transition-table.js`: Defines which events are valid per tier (`TIER_DISPATCH.validEvents`)
- `pre-reads.js`: Defines which events require pre-read validation (`PRE_READ_HANDLERS`)

## File Structure

### Files Changed

```
.github/orchestration/scripts/
├── lib/
│   ├── transition-table.js       # NEW — 4 named table exports (~120 lines)
│   ├── resolver.js               # MODIFIED — table evaluation engine (~180 lines, down from ~260)
│   └── constants.js              # MODIFIED — 4 new JSDoc typedefs (additive only)
├── tests/
│   ├── transition-table.test.js  # NEW — isolated rule condition unit tests
│   └── pipeline-behavioral.test.js  # UNCHANGED — primary acceptance criterion
```

### Files Unchanged

```
.github/orchestration/scripts/
├── pipeline.js                   # CLI entry point
├── lib/
│   ├── pipeline-engine.js        # processEvent recipe
│   ├── mutations.js              # 17 event→handler mutation map
│   ├── pre-reads.js              # 5 per-event pre-read validators
│   ├── validator.js              # 13 invariants (V1–V13)
│   └── state-io.js               # Filesystem I/O
├── tests/
│   ├── helpers/
│   │   └── test-helpers.js       # Mock I/O factory, state factories
│   └── pipeline-behavioral.test.js  # 11 categories, ~62 scenarios — MUST PASS UNMODIFIED
```

### Documentation Updated

```
docs/
└── scripts.md                    # MODIFIED — table structure explanations added
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | No-match fallback: when no rule in a lifecycle table matches, the resolver returns `halted(...)` with diagnostic details listing the unresolvable state. This preserves the current fallback behavior exactly. |
| **State management** | No changes to `state.json` schema (v3). Rule conditions and `buildContext` functions are **stateless** — they receive all data via the context bag and produce no side effects. No shared mutable context between evaluations. |
| **Module boundaries** | The four pipeline-engine exports (`resolveNextAction`, `getMutation`, `validateTransition`, `preRead`) retain identical signatures. `transition-table.js` is a leaf with no reverse dependencies. |
| **Testability** | Individual rule conditions are testable in isolation: construct a context bag, call `rule.condition(ctx)`, assert the result. The `evaluateRules` function is testable independently of the pipeline. Behavioral tests remain the primary acceptance gate. |
| **Extensibility** | Table exports are **plain arrays/objects, not frozen** — downstream CUSTOM-PIPELINE-STEP can clone and splice. Every rule has a stable string `id` field usable as an insertion anchor. Planning step `key` fields serve as name references for step injection. |
| **Performance** | First-match-wins iteration with short-circuit is computationally equivalent to if/else chains. No measurable performance change. |
| **Documentation** | `docs/scripts.md` updated to describe all 4 table shapes and the resolver iteration model. Traceability map (current function → new table/rule) included for migration reference. |

## Traceability Map (Before → After)

This map documents where each current resolver function maps to in the new architecture:

| Current Code (`resolver.js`) | After Refactor | New Form |
|------------------------------|---------------|----------|
| `PLANNING_STEP_ORDER` array (lines 12–18) | `transition-table.js` → `PLANNING_STEPS` | Enriched array: `{ key, action, event, doc_type }` |
| `resolveTask()` if/else chain | `transition-table.js` → `TASK_LIFECYCLE_RULES` | 6 rules, first-match-wins |
| `resolveTaskGate()` helper | `transition-table.js` → `task-gate` rule | Inlined: condition checks `config.human_gates.execution_mode` |
| `resolvePhaseCompletion()` if/else chain | `transition-table.js` → `PHASE_LIFECYCLE_RULES` | 5 rules, first-match-wins |
| `resolvePhaseGate()` helper | `transition-table.js` → `phase-gate-advanced` rule | Inlined: condition checks `config.human_gates.execution_mode` |
| `resolveNextAction()` tier if/else | `transition-table.js` → `TIER_DISPATCH` + `resolver.js` lookup | Object keyed by tier, terminal tiers still handled directly |
| `resolvePlanning()` function | `resolver.js` (stays) | Iterates `PLANNING_STEPS` instead of `PLANNING_STEP_ORDER` |
| `resolveExecution()` function | `resolver.js` (stays) | Builds context bags, calls `evaluateRules()` with table reference |
| `resolvePhaseInProgress()` function | `resolver.js` → merged into `resolveExecution()` | Phase-in-progress logic is inlined — no separate function needed |
| `resolveReview()` function | `resolver.js` (stays) | Unchanged — 2 conditions, simple enough without a table |
| `formatPhaseId()`, `formatTaskId()` | `resolver.js` (stays) | Presentation helpers, unchanged |
| `halted()` | `resolver.js` (stays) | Convenience wrapper, unchanged |

## Phasing Recommendations

The Tactical Planner makes final phasing decisions. The following is advisory.

### Phase 1: Table Definitions + Unit Tests

**Goal**: Create `transition-table.js` with all 4 table exports and a new unit test file verifying rule conditions in isolation.

**Scope**:
- Create `.github/orchestration/scripts/lib/transition-table.js` with `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH` (with `resolve: null` placeholders)
- Add JSDoc typedefs to `constants.js` (`PlanningStepDef`, `TaskRuleContext`, `PhaseRuleContext`, `LifecycleRule`, `TierDispatchEntry`)
- Create `.github/orchestration/scripts/tests/transition-table.test.js` with isolated condition tests for each rule
- All new unit tests pass

**Exit criteria**: `transition-table.js` exports 4 named tables. Unit tests verify every task lifecycle rule condition (6 rules) and every phase lifecycle rule condition (5 rules) fires for the correct state, with no false positives.

### Phase 2: Resolver Refactor + Behavioral Validation

**Goal**: Refactor `resolver.js` to consume tables from `transition-table.js`. All 62 behavioral test scenarios pass unmodified.

**Scope**:
- Add `evaluateRules()` generic table-evaluation function to `resolver.js`
- Replace `resolveTask()` if/else chain with `evaluateRules(TASK_LIFECYCLE_RULES, ctx)`
- Replace `resolvePhaseCompletion()` if/else chain with `evaluateRules(PHASE_LIFECYCLE_RULES, ctx)`
- Refactor `resolveNextAction()` to use `TIER_DISPATCH` lookup for active tiers
- Bind `TIER_DISPATCH[tier].resolve` references at module load time
- Remove `resolveTask`, `resolveTaskGate`, `resolvePhaseCompletion`, `resolvePhaseGate`, `resolvePhaseInProgress` (replaced by table evaluation)
- Remove `PLANNING_STEP_ORDER` (replaced by imported `PLANNING_STEPS`)
- Run all 62 behavioral tests — 100% pass rate required, zero modifications to test file

**Exit criteria**: `pipeline-behavioral.test.js` passes all 11 categories (~62 scenarios) without modification. `resolver.js` contains zero if/else chains for rule selection. All new unit tests from Phase 1 continue to pass.

### Phase 3: Documentation

**Goal**: Update `docs/scripts.md` with table structure explanations.

**Scope**:
- Add section to `docs/scripts.md` describing `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH` shapes
- Document the resolver iteration model (first-match-wins, context bags, `evaluateRules`)
- Include the traceability map (before → after) for migration reference

**Exit criteria**: `docs/scripts.md` accurately describes all 4 tables, the resolver iteration model, and the rule ID naming convention.
