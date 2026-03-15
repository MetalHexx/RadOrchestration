---
project: "TRANSITION-TABLE"
status: "draft"
type: "design"
author: "ux-designer-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Design

## Design Overview

This project has no visual UI, no user-facing flows, and no frontend work. It is a pure backend/infrastructure refactor that replaces implicit if/else routing logic in `resolver.js` with explicit, data-driven rule tables in a new `transition-table.js` module. The "design" for this project is the **data structure schema** for the four rule tables, the **module interface contracts** between `transition-table.js` and `resolver.js`, and the **developer-facing readability model** — how a pipeline maintainer reads, understands, and extends the table definitions.

## Triage Decision

| Criterion | Assessment |
|-----------|------------|
| Has visual UI? | No |
| Has non-visual user-facing flows? | No |
| Project scope | Backend refactor of pipeline routing logic from if/else trees into data-driven rule tables in JavaScript modules |
| **Route** | **Not required (standard UX) — adapted for data structure design** |

Standard UX Design sections (Layout & Components, Design Tokens, States & Interactions, Accessibility, Responsive Behavior) are omitted. This document instead specifies the **data structure schemas**, **module interface contracts**, and **API contract preservation** that serve as the design foundation for the Architecture and Master Plan.

---

## Data Structure Design

This section defines the shape and schema of the four rule tables exported by `transition-table.js`. These are the core design artifacts of this project — they replace the implicit routing logic currently embedded in `resolver.js` function trees.

### DS-1: `PLANNING_STEPS`

**Purpose**: Single-source definition of all planning step metadata. Replaces the current `PLANNING_STEP_ORDER` array (which only has `key` and `action`) with a richer structure that includes the completion event and document type.

**Shape**: Ordered array of step definition objects. Evaluation is sequential — the resolver iterates in order, returning the action for the first incomplete step.

```js
/** @type {PlanningStep[]} */
const PLANNING_STEPS = [
  { key: 'research',     action: 'spawn_research',      event: 'research_completed',      doc_type: 'research_findings' },
  { key: 'prd',          action: 'spawn_prd',           event: 'prd_completed',           doc_type: 'prd' },
  { key: 'design',       action: 'spawn_design',        event: 'design_completed',        doc_type: 'design' },
  { key: 'architecture', action: 'spawn_architecture',  event: 'architecture_completed',  doc_type: 'architecture' },
  { key: 'master_plan',  action: 'spawn_master_plan',   event: 'master_plan_completed',   doc_type: 'master_plan' },
];
```

**Field definitions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | Yes | Stable name reference matching the step key in `state.planning.steps`. Serves as insertion anchor for CUSTOM-PIPELINE-STEP. |
| `action` | `string` | Yes | `NEXT_ACTIONS` constant value — the action returned when this step is the next incomplete step. |
| `event` | `string` | Yes | The event name that completes this step (used for documentation/traceability; not consumed by the resolver at runtime). |
| `doc_type` | `string` | Yes | The document type this step produces (used for documentation/traceability; not consumed by the resolver at runtime). |

**Design decisions**:
- `action` values reference `NEXT_ACTIONS` constants from `constants.js` but are stored as string literals in the table — the table module imports the constants and uses them directly
- `event` and `doc_type` are informational columns that make the table self-documenting; the resolver only reads `key` and `action` at evaluation time
- The array is **not frozen** — downstream CUSTOM-PIPELINE-STEP may clone and extend it
- The existing `key` field doubles as the stable name reference (no new `id` field needed for planning steps)

**Evaluation model**: The resolver iterates `PLANNING_STEPS` in order. For each entry, it looks up `state.planning.steps[key]`. If the step is missing or not `COMPLETE`, the resolver returns `{ action, context: { step: key } }`. If all steps are complete and `!state.planning.human_approved`, the resolver returns `REQUEST_PLAN_APPROVAL`. This matches the existing `resolvePlanning()` behavior exactly.

---

### DS-2: `TASK_LIFECYCLE_RULES`

**Purpose**: Ordered, first-match-wins rule table expressing the complete task lifecycle — from halted detection through handoff creation, execution, review, and gating. Replaces the `resolveTask()` if/else chain.

**Shape**: Ordered array of rule objects. Each rule has a stable ID, a condition predicate, an action string, and a context-builder function.

```js
/** @type {TaskLifecycleRule[]} */
const TASK_LIFECYCLE_RULES = [
  {
    id: 'task-halted',
    condition: ({ task }) => task.status === TASK_STATUSES.HALTED,
    action: NEXT_ACTIONS.DISPLAY_HALTED,
    buildContext: ({ task, phaseIndex, taskIndex }) => ({
      details: `Task ${formatId(phaseIndex, taskIndex)} is halted`
    }),
  },
  {
    id: 'task-corrective-handoff',
    condition: ({ task }) =>
      task.status === TASK_STATUSES.FAILED &&
      task.review_action === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED,
    action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
    buildContext: ({ task, phase, phaseIndex, taskIndex }) => ({
      is_correction: true,
      previous_review: task.review_doc,
      reason: task.review_action,
      phase_index: phaseIndex,
      task_index: taskIndex,
      phase_id: formatPhaseId(phaseIndex),
      task_id: formatTaskId(phaseIndex, taskIndex),
    }),
  },
  {
    id: 'task-fresh-handoff',
    condition: ({ task }) =>
      task.status === TASK_STATUSES.NOT_STARTED && !task.handoff_doc,
    action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
    buildContext: ({ phaseIndex, taskIndex }) => ({
      is_correction: false,
      phase_index: phaseIndex,
      task_index: taskIndex,
      phase_id: formatPhaseId(phaseIndex),
      task_id: formatTaskId(phaseIndex, taskIndex),
    }),
  },
  {
    id: 'task-execute',
    condition: ({ task }) =>
      task.status === TASK_STATUSES.IN_PROGRESS &&
      task.handoff_doc && !task.report_doc,
    action: NEXT_ACTIONS.EXECUTE_TASK,
    buildContext: ({ task, phaseIndex, taskIndex }) => ({
      handoff_doc: task.handoff_doc,
      phase_index: phaseIndex,
      task_index: taskIndex,
      phase_id: formatPhaseId(phaseIndex),
      task_id: formatTaskId(phaseIndex, taskIndex),
    }),
  },
  {
    id: 'task-review',
    condition: ({ task }) =>
      task.status === TASK_STATUSES.COMPLETE && !task.review_doc,
    action: NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
    buildContext: ({ task, phaseIndex, taskIndex }) => ({
      report_doc: task.report_doc,
      phase_index: phaseIndex,
      task_index: taskIndex,
      phase_id: formatPhaseId(phaseIndex),
      task_id: formatTaskId(phaseIndex, taskIndex),
    }),
  },
  {
    id: 'task-gate',
    condition: ({ task, config }) =>
      task.status === TASK_STATUSES.COMPLETE &&
      task.review_action === REVIEW_ACTIONS.ADVANCED &&
      (config.execution_mode === HUMAN_GATE_MODES.TASK),
    action: NEXT_ACTIONS.GATE_TASK,
    buildContext: ({ phaseIndex, taskIndex }) => ({
      phase_index: phaseIndex,
      task_index: taskIndex,
      phase_id: formatPhaseId(phaseIndex),
      task_id: formatTaskId(phaseIndex, taskIndex),
    }),
  },
];
```

**Field definitions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Stable string identifier for the rule. Used as insertion anchor by CUSTOM-PIPELINE-STEP and as a diagnostic label when logging which rule matched. |
| `condition` | `(ctx: TaskRuleContext) => boolean` | Yes | Pure predicate. Returns `true` if this rule applies. Receives the uniform context bag. Must have no side effects and no imports. |
| `action` | `string` | Yes | `NEXT_ACTIONS` constant value — the action returned when this rule matches. |
| `buildContext` | `(ctx: TaskRuleContext) => object` | Yes | Pure function that builds the action-specific context object. Receives the same uniform context bag. Must have no side effects and no imports. |

**Context bag (`TaskRuleContext`)**:

| Field | Type | Source |
|-------|------|--------|
| `task` | `Task` | `phase.tasks[phase.current_task]` — the current task object |
| `phase` | `Phase` | `state.execution.phases[state.execution.current_phase]` — the current phase object |
| `phaseIndex` | `number` | `state.execution.current_phase` — zero-based phase index |
| `taskIndex` | `number` | `phase.current_task` — zero-based task index within the phase |
| `config` | `Config` | Pipeline configuration (execution_mode, max_retries_per_task, etc.) |

**Evaluation model**: The resolver iterates `TASK_LIFECYCLE_RULES` in order, calling `rule.condition(ctx)` for each. The **first** rule whose condition returns `true` wins — the resolver returns `{ action: rule.action, context: rule.buildContext(ctx) }`. If no rule matches, the resolver returns a `DISPLAY_HALTED` action with diagnostic details listing the unresolvable task state. This first-match-wins model matches the existing if/else chain semantics exactly.

**Design decisions**:
- `formatPhaseId` and `formatTaskId` are presentation helpers that remain in `resolver.js` — they are not routing data. The `buildContext` closures reference them at evaluation time (they are in scope because the table is defined in a module that imports them, or the resolver passes them)
- Rule order is critical — `task-halted` must precede all other rules, and `task-gate` must come after `task-review` (a task with `review_action === ADVANCED` but still needing a gate will fall through review to gate)
- The `task-gate` rule checks `config.execution_mode === TASK` — in other modes (ASK, PHASE, AUTONOMOUS), a reviewed-and-advanced task does not trigger a per-task gate, so no rule matches for the gate and the resolver falls through to the no-match halted path. However, in the current code, this case is handled by mutations advancing the pointer before the resolver runs — so the resolver never sees this state. The halted fallback is a safety net
- All condition and buildContext functions are **stateless** — they receive everything they need via the context bag. This enables PARALLEL-EXECUTION to evaluate the same rules against multiple tasks in a single pass

---

### DS-3: `PHASE_LIFECYCLE_RULES`

**Purpose**: Ordered, first-match-wins rule table expressing the phase completion lifecycle — report generation, review, gating, corrective handling, and halt detection. Replaces the `resolvePhaseCompletion()` if/else chain.

**Shape**: Same structure as `TASK_LIFECYCLE_RULES` — ordered array with `id`, `condition`, `action`, `buildContext`.

```js
/** @type {PhaseLifecycleRule[]} */
const PHASE_LIFECYCLE_RULES = [
  {
    id: 'phase-report',
    condition: ({ phase }) => !phase.phase_report_doc,
    action: NEXT_ACTIONS.GENERATE_PHASE_REPORT,
    buildContext: ({ phaseIndex }) => ({
      phase_index: phaseIndex,
      phase_id: formatPhaseId(phaseIndex),
    }),
  },
  {
    id: 'phase-review',
    condition: ({ phase }) => !phase.phase_review_doc,
    action: NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
    buildContext: ({ phase, phaseIndex }) => ({
      phase_report_doc: phase.phase_report_doc,
      phase_index: phaseIndex,
      phase_id: formatPhaseId(phaseIndex),
    }),
  },
  {
    id: 'phase-gate-advanced',
    condition: ({ phase, config }) =>
      phase.phase_review_action === PHASE_REVIEW_ACTIONS.ADVANCED &&
      (config.execution_mode === HUMAN_GATE_MODES.PHASE ||
       config.execution_mode === HUMAN_GATE_MODES.TASK),
    action: NEXT_ACTIONS.GATE_PHASE,
    buildContext: ({ phaseIndex }) => ({
      phase_index: phaseIndex,
      phase_id: formatPhaseId(phaseIndex),
    }),
  },
  {
    id: 'phase-corrective',
    condition: ({ phase }) =>
      phase.phase_review_action === PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED,
    action: NEXT_ACTIONS.DISPLAY_HALTED,
    buildContext: ({ phaseIndex }) => ({
      details: `Phase ${formatPhaseId(phaseIndex)}: corrective tasks issued — mutations should have reset the task pointer`,
    }),
  },
  {
    id: 'phase-halted',
    condition: ({ phase }) =>
      phase.phase_review_action === PHASE_REVIEW_ACTIONS.HALTED,
    action: NEXT_ACTIONS.DISPLAY_HALTED,
    buildContext: ({ phaseIndex }) => ({
      details: `Phase ${formatPhaseId(phaseIndex)}: phase review halted the phase`,
    }),
  },
];
```

**Context bag (`PhaseRuleContext`)**:

| Field | Type | Source |
|-------|------|--------|
| `phase` | `Phase` | `state.execution.phases[state.execution.current_phase]` — the current phase object (after all tasks complete) |
| `phaseIndex` | `number` | `state.execution.current_phase` — zero-based phase index |
| `config` | `Config` | Pipeline configuration |

**Evaluation model**: Identical to task lifecycle — first-match-wins iteration. The resolver enters phase lifecycle evaluation only when `phase.current_task >= phase.total_tasks` (all tasks in the phase are processed). If no rule matches, the resolver returns `DISPLAY_HALTED` with diagnostic details.

**Design decisions**:
- The `phase-corrective` rule returns `DISPLAY_HALTED` with a diagnostic message — this preserves the existing behavior where corrective task issuance is handled by mutations resetting the task pointer; the resolver seeing this state is a safety net
- The `phase-gate-advanced` rule checks both `PHASE` and `TASK` execution modes — in both modes, a completed phase requires a human gate. In `ASK` mode, the gate is implicit (the orchestrator always asks). In `AUTONOMOUS` mode, no phase gate fires

---

### DS-4: `TIER_DISPATCH`

**Purpose**: Top-level routing from tier to resolver function with explicit valid-event sets per tier. Replaces the if/else dispatch in `resolveNextAction()`.

**Shape**: Plain object keyed by tier name. Each entry defines the set of valid events for that tier and a resolve function.

```js
/** @type {Object<string, TierDispatchEntry>} */
const TIER_DISPATCH = {
  [PIPELINE_TIERS.PLANNING]: {
    validEvents: new Set([
      'research_completed', 'prd_completed', 'design_completed',
      'architecture_completed', 'master_plan_completed', 'plan_approved',
    ]),
    resolve: resolvePlanning,
  },
  [PIPELINE_TIERS.EXECUTION]: {
    validEvents: new Set([
      'phase_plan_created', 'task_handoff_created', 'task_completed',
      'code_review_completed', 'phase_report_created', 'phase_review_completed',
      'task_approved', 'phase_approved',
    ]),
    resolve: resolveExecution,
  },
  [PIPELINE_TIERS.REVIEW]: {
    validEvents: new Set([
      'final_review_completed', 'final_approved',
    ]),
    resolve: resolveReview,
  },
};
```

**Field definitions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `validEvents` | `Set<string>` | Yes | The set of event names valid during this tier. Enables early rejection of misrouted events with a clear diagnostic message. |
| `resolve` | `(state, config) => { action, context }` | Yes | The tier-specific resolver function. Returns the next action and context for the current state. |

**Design decisions**:
- `HALTED` and `COMPLETE` tiers are **not** in the dispatch table — they are terminal states handled directly in `resolveNextAction()` before table lookup (return `DISPLAY_HALTED` or `DISPLAY_COMPLETE` immediately)
- The `halt` event is special — it is processed by the mutation layer (`mutations.js`) and sets `tier → HALTED`. It does not appear in any tier's `validEvents` because `resolveNextAction` runs post-mutation, at which point the tier is already `HALTED`
- The `start` event is handled as initialization logic in `pipeline-engine.js`, outside the transition table entirely
- `validEvents` duplicates event names from the mutation handler map — this is intentional to keep `transition-table.js` self-contained with no imports from `mutations.js`
- The `resolve` functions reference the tier-specific resolver functions (`resolvePlanning`, `resolveExecution`, `resolveReview`) which live in `resolver.js`, not in the table. The table stores function references that are bound at require-time. **Alternative**: the resolve functions could be defined inline in the table, but separating them keeps the table readable as pure data with function references

**Note on `validEvents` usage**: In this initial refactor, `validEvents` is a structural affordance — the sets are defined and exported but the pre-mutation validation check is **not** added to `processEvent()` (since `pipeline-engine.js` is out of scope). The resolver uses `TIER_DISPATCH` post-mutation for dispatch only. CUSTOM-PIPELINE-STEP or a future hardening pass may wire in pre-mutation event validation.

---

## Module Interface Design

This section defines how `transition-table.js` exports its tables and how `resolver.js` consumes them.

### MI-1: `transition-table.js` Exports

**Module path**: `.github/orchestration/scripts/lib/transition-table.js`

**Export shape**: Single `module.exports` object with four named properties — one per table.

```js
module.exports = {
  PLANNING_STEPS,
  TASK_LIFECYCLE_RULES,
  PHASE_LIFECYCLE_RULES,
  TIER_DISPATCH,
};
```

**Import dependencies**: `constants.js` only. The table module is a dependency-graph leaf.

```
transition-table.js ──→ constants.js
```

**Constraints**:
- No imports from `resolver.js`, `mutations.js`, `pre-reads.js`, `validator.js`, or `pipeline-engine.js`
- No I/O, no side effects, no global state
- Exports are **plain arrays and objects** — not frozen, not wrapped in getters or proxies
- All functions in rule rows (`condition`, `buildContext`) are defined as closures within the module — they capture constants from imports but receive all runtime data via arguments

### MI-2: `resolver.js` Consumption

**Import statement**:
```js
const { PLANNING_STEPS, TASK_LIFECYCLE_RULES, PHASE_LIFECYCLE_RULES, TIER_DISPATCH } = require('./transition-table');
```

**Resolver becomes the engine**: After the refactor, `resolver.js` contains:
1. **Imports** from `constants.js` and `transition-table.js`
2. **Presentation helpers** (`formatPhaseId`, `formatTaskId`) — unchanged
3. **`halted()` convenience function** — unchanged
4. **Table evaluation functions** that iterate rule arrays using first-match-wins
5. **Tier-specific resolver functions** (`resolvePlanning`, `resolveExecution`, `resolveReview`) that build context bags and delegate to table evaluation
6. **`resolveNextAction(state, config)`** — the single public export, unchanged signature

**What moves out of `resolver.js`**:
- `PLANNING_STEP_ORDER` → becomes `PLANNING_STEPS` in `transition-table.js`
- All if/else condition logic in `resolveTask()` → becomes `TASK_LIFECYCLE_RULES` conditions
- All if/else condition logic in `resolvePhaseCompletion()` → becomes `PHASE_LIFECYCLE_RULES` conditions
- Tier-to-function dispatch in `resolveNextAction()` → becomes `TIER_DISPATCH` lookup

**What stays in `resolver.js`**:
- `resolveNextAction(state, config)` — public export (signature unchanged)
- `resolvePlanning(state)` — iterates `PLANNING_STEPS`
- `resolveExecution(state, config)` — delegates to task/phase evaluation
- `resolveReview(state)` — review tier logic (simple, only 2–3 conditions)
- `formatPhaseId(phaseIndex)`, `formatTaskId(phaseIndex, taskIndex)` — presentation helpers
- `halted(details)` — convenience wrapper for `{ action: DISPLAY_HALTED, context: { details } }`

### MI-3: Table Evaluation Pattern

The resolver uses a single, reusable evaluation pattern for both task and phase lifecycle tables:

```js
/**
 * Evaluate a first-match-wins rule table against a context bag.
 * @param {Array<{id, condition, action, buildContext}>} rules
 * @param {object} ctx - Uniform context bag
 * @returns {{ action: string, context: object } | null}
 */
function evaluateRules(rules, ctx) {
  for (const rule of rules) {
    if (rule.condition(ctx)) {
      return { action: rule.action, context: rule.buildContext(ctx) };
    }
  }
  return null; // No rule matched — caller returns halted with diagnostic
}
```

This function:
- Is **generic** — works for both `TASK_LIFECYCLE_RULES` and `PHASE_LIFECYCLE_RULES`
- Returns `null` when no rule matches (caller handles the fallback)
- Short-circuits on first match (equivalent performance to if/else)
- Is trivially testable — pass a rule array and a context bag, verify the result

---

## API Contract Preservation

This section documents the exact public interfaces that must remain unchanged after the refactor.

### AC-1: `resolveNextAction` Signature

```js
/**
 * @param {StateJson} state - The current (post-mutation) pipeline state
 * @param {Config} config - Pipeline configuration
 * @returns {{ action: string, context: object }}
 */
function resolveNextAction(state, config)
```

**Return shape** — always has exactly two fields:

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | One of the 18 `NEXT_ACTIONS` constant values |
| `context` | `object` | Action-specific data. Shape varies by action. |

**Guarantee**: Every code path returns `{ action, context }`. There is no `undefined` or `null` return.

### AC-2: Module Exports

```js
// resolver.js — before and after
module.exports = { resolveNextAction };
```

Single named export. No additional exports added, no exports removed.

### AC-3: Four Pipeline-Engine Exports (Unchanged Modules)

The following module exports are consumed by `pipeline-engine.js` and must not change in any way:

| Module | Export | Signature |
|--------|--------|-----------|
| `resolver.js` | `resolveNextAction` | `(state, config) => { action, context }` |
| `mutations.js` | `getMutation` | `(event) => mutationFn \| undefined` |
| `validator.js` | `validateTransition` | `(current, proposed, config) => ValidationError[]` |
| `pre-reads.js` | `preRead` | `(event, context, readDocument, projectDir) => { context, error }` |

None of these signatures change. `mutations.js`, `validator.js`, and `pre-reads.js` are entirely untouched by this refactor.

### AC-4: Action-Context Contracts Per Rule

Each rule's `buildContext` must produce the exact context shape currently returned by the equivalent if/else branch. The following table documents the required context fields per action:

| Rule ID | Action | Required Context Fields |
|---------|--------|------------------------|
| `task-halted` | `display_halted` | `details` |
| `task-corrective-handoff` | `create_task_handoff` | `is_correction`, `previous_review`, `reason`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-fresh-handoff` | `create_task_handoff` | `is_correction`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-execute` | `execute_task` | `handoff_doc`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-review` | `spawn_code_reviewer` | `report_doc`, `phase_index`, `task_index`, `phase_id`, `task_id` |
| `task-gate` | `gate_task` | `phase_index`, `task_index`, `phase_id`, `task_id` |
| `phase-report` | `generate_phase_report` | `phase_index`, `phase_id` |
| `phase-review` | `spawn_phase_reviewer` | `phase_report_doc`, `phase_index`, `phase_id` |
| `phase-gate-advanced` | `gate_phase` | `phase_index`, `phase_id` |
| `phase-corrective` | `display_halted` | `details` |
| `phase-halted` | `display_halted` | `details` |

These context shapes are the behavioral contract verified by `pipeline-behavioral.test.js`. Any deviation breaks tests.

---

## Developer Experience Design

This section defines how a pipeline maintainer reads, understands, and works with the new table-driven architecture.

### DX-1: File Organization & Discoverability

A developer wanting to understand "what does the pipeline do after event X?" should:

1. **Open `transition-table.js`** — single file, all routing rules visible as data rows
2. **Find the relevant table** — `PLANNING_STEPS` for planning, `TASK_LIFECYCLE_RULES` for task-level routing, `PHASE_LIFECYCLE_RULES` for phase completion, `TIER_DISPATCH` for top-level tier routing
3. **Read rules top-to-bottom** — first-match-wins means the rule order is the execution priority
4. **Read `condition` inline** — conditions are short, pure predicates with descriptive field access (e.g., `task.status === TASK_STATUSES.HALTED`)

No function-call tracing required. No jumping between files to understand routing.

### DX-2: Rule Naming Convention

Rule IDs follow the pattern `{scope}-{lifecycle-stage}`:

| Scope | Rule IDs |
|-------|----------|
| `task-*` | `task-halted`, `task-corrective-handoff`, `task-fresh-handoff`, `task-execute`, `task-review`, `task-gate` |
| `phase-*` | `phase-report`, `phase-review`, `phase-gate-advanced`, `phase-corrective`, `phase-halted` |

IDs are:
- Lowercase, hyphen-separated
- Stable across versions (used as insertion anchors by CUSTOM-PIPELINE-STEP)
- Unique within their table
- Self-descriptive — a developer can infer the rule's purpose from its ID

### DX-3: Adding a New Rule

To add a new lifecycle stage (e.g., a security scan between task execution and review):

1. Define a new rule object with `id`, `condition`, `action`, `buildContext`
2. Insert it at the correct position in the rule array (after `task-execute`, before `task-review`)
3. The resolver evaluates it automatically — no engine changes needed

```js
// Example: insert after 'task-execute'
{
  id: 'task-security-scan',
  condition: ({ task }) => task.status === TASK_STATUSES.COMPLETE && !task.security_scan_doc,
  action: NEXT_ACTIONS.SPAWN_SECURITY_SCANNER,
  buildContext: ({ phaseIndex, taskIndex }) => ({
    phase_index: phaseIndex,
    task_index: taskIndex,
  }),
},
```

This is the extensibility model that CUSTOM-PIPELINE-STEP will formalize with config-driven rule injection.

### DX-4: JSDoc Type Definitions

New JSDoc typedefs will be added to `constants.js` (following the existing convention):

```js
/**
 * @typedef {Object} PlanningStepDef
 * @property {string} key - Step name matching state.planning.steps key
 * @property {string} action - NEXT_ACTIONS value to return
 * @property {string} event - Completion event name
 * @property {string} doc_type - Document type produced
 */

/**
 * @typedef {Object} TaskRuleContext
 * @property {Task} task - Current task object
 * @property {Phase} phase - Current phase object
 * @property {number} phaseIndex - Zero-based phase index
 * @property {number} taskIndex - Zero-based task index
 * @property {Config} config - Pipeline configuration
 */

/**
 * @typedef {Object} LifecycleRule
 * @property {string} id - Stable rule identifier
 * @property {function} condition - (ctx) => boolean predicate
 * @property {string} action - NEXT_ACTIONS value to return
 * @property {function} buildContext - (ctx) => object context builder
 */

/**
 * @typedef {Object} TierDispatchEntry
 * @property {Set<string>} validEvents - Events valid during this tier
 * @property {function} resolve - (state, config) => { action, context }
 */
```

### DX-5: Traceability Map

For developers migrating from the old code or debugging, this map shows where each current function maps to in the new architecture:

| Current Code (resolver.js) | New Location | New Form |
|----------------------------|-------------|----------|
| `PLANNING_STEP_ORDER` array | `transition-table.js` → `PLANNING_STEPS` | Enriched array (key, action, event, doc_type) |
| `resolveTask()` if/else chain | `transition-table.js` → `TASK_LIFECYCLE_RULES` | 6 rule rows, first-match-wins |
| `resolvePhaseCompletion()` if/else chain | `transition-table.js` → `PHASE_LIFECYCLE_RULES` | 5 rule rows, first-match-wins |
| `resolveNextAction()` tier dispatch | `transition-table.js` → `TIER_DISPATCH` | Object keyed by tier name |
| `resolveTaskGate()` helper | `transition-table.js` → `task-gate` rule condition | Inlined into rule condition (checks config.execution_mode) |
| `resolvePhaseGate()` helper | `transition-table.js` → `phase-gate-advanced` rule condition | Inlined into rule condition (checks config.execution_mode) |
| `resolvePlanning()` function | `resolver.js` (stays) | Iterates `PLANNING_STEPS` instead of `PLANNING_STEP_ORDER` |
| `resolveExecution()` function | `resolver.js` (stays) | Delegates to `evaluateRules()` with appropriate table |
| `resolveReview()` function | `resolver.js` (stays) | Unchanged — simple enough to not need a table |
| `formatPhaseId()`, `formatTaskId()` | `resolver.js` (stays) | Presentation helpers, unchanged |
| `halted()` | `resolver.js` (stays) | Convenience wrapper, unchanged |

---

## Sections Omitted

The following standard Design sections are intentionally omitted because this project has no visual UI, no user-facing flows, and no frontend components:

- **User Flows** — No user-facing flows; pipeline routing is internal, event-driven
- **Layout & Components** — No views, pages, or UI components
- **Design Tokens** — No visual styling
- **States & Interactions** — No interactive UI elements (rule "states" are documented in Data Structure Design above)
- **Accessibility** — No user interface to make accessible
- **Responsive Behavior** — No rendered output
- **Design System Additions** — Nothing to add to a visual design system
