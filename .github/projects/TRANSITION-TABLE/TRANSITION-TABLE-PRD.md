---
project: "TRANSITION-TABLE"
status: "draft"
type: "prd"
author: "product-manager-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Product Requirements

## Problem Statement

The pipeline's routing layer encodes all transition logic as nested if/else function trees inside `resolver.js`. Understanding what happens after a given event requires tracing through multiple function calls rather than reading a data table. Modifying routing behavior — adding a step, reordering a lifecycle stage — means editing branching code with high regression risk. Two planned downstream projects (PARALLEL-EXECUTION and CUSTOM-PIPELINE-STEP) cannot be built cleanly without the routing layer expressed as inspectable, extensible data.

## Goals

- **G1 — Single-source planning definition**: All planning step metadata (step key, spawn action, completion event, document type) is defined in one place, eliminating the current scatter across multiple modules
- **G2 — Explicit task lifecycle rules**: The task lifecycle (halted, corrective handoff, fresh handoff, execute, review, gate) is expressed as an ordered, first-match-wins rule table that can be read, tested, and extended as data
- **G3 — Explicit phase lifecycle rules**: The phase completion lifecycle (report, review, gate, corrective, halted) is expressed as an equivalent first-match-wins rule table
- **G4 — Tier dispatch table**: Top-level routing from tier to resolver is a data map with explicit valid-event sets per tier, replacing the implicit if/else dispatch
- **G5 — Dedicated table module**: All four table definitions live in a single, dedicated module that is a dependency-graph leaf — importable, inspectable, and extensible by downstream projects
- **G6 — Behavioral equivalence**: The refactored pipeline produces identical actions, context, and state mutations for every possible event sequence — proven by passing the existing behavioral test suite without modification
- **G7 — Stable foundation for downstream projects**: The table shape (rule IDs, condition signatures, export structure) is designed to support future rule injection and multi-task evaluation without requiring a second refactor
- **G8 — Verified correctness**: All existing behavioral tests pass unmodified, and new unit tests verify individual rule conditions in isolation
- **G9 — Updated documentation**: Project documentation accurately describes the new table structure, rule shapes, and resolver behavior

## Non-Goals

- **Implementing parallelism**: Returning multiple actions per resolver call is the PARALLEL-EXECUTION project's scope
- **Config-driven pipeline customization**: Injecting, removing, or reordering rules from YAML configuration is the CUSTOM-PIPELINE-STEP project's scope
- **Changing the state schema**: The `state.json` v3 schema is unchanged — no new fields, no migration
- **Modifying modules outside the routing layer**: `mutations.js`, `pre-reads.js`, `validator.js`, `state-io.js`, and `pipeline-engine.js` are not modified
- **Adopting external libraries**: The pipeline remains zero-dependency
- **Changing observable pipeline behavior**: No event produces a different action or context after the refactor

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Pipeline maintainer | Open a single file and see every routing rule as a data row | I can audit the full transition logic without tracing function calls | P0 |
| 2 | Pipeline maintainer | See which events are valid for each tier as an explicit set | Invalid events are caught early with clear error messages instead of falling through to unexpected code paths | P0 |
| 3 | Pipeline maintainer | Run the existing behavioral test suite after refactoring | I have proof the refactor is behavior-equivalent with zero regressions | P0 |
| 4 | Pipeline maintainer | Run unit tests that verify individual rule conditions in isolation | I can confirm each rule fires for exactly the right task/phase state without running the full pipeline | P0 |
| 5 | Downstream project developer (PARALLEL-EXECUTION) | Iterate task lifecycle rules against multiple ready tasks in a single pass | I can build intra-phase parallelism on top of stateless, iterable rule definitions | P1 |
| 6 | Downstream project developer (CUSTOM-PIPELINE-STEP) | Insert, remove, or reorder rule rows by stable ID reference | I can extend the pipeline from configuration without modifying resolver internals | P1 |
| 7 | Pipeline maintainer | Read documentation that explains the table structure and resolver behavior | I can onboard to the new architecture without reading source code | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | A dedicated module shall export four named table definitions: planning steps, task lifecycle rules, phase lifecycle rules, and tier dispatch | P0 | Single file, dependency-graph leaf |
| FR-2 | The planning steps table shall define each step's key, spawn action, completion event, and document type | P0 | Extends the existing `PLANNING_STEP_ORDER` structure |
| FR-3 | The task lifecycle rules table shall be an ordered array of rules, each with a stable string ID, a condition function, an action, and a context-builder function | P0 | First-match-wins evaluation |
| FR-4 | The phase lifecycle rules table shall follow the same ordered-rule structure as the task lifecycle table (ID, condition, action, context-builder) | P0 | First-match-wins evaluation |
| FR-5 | The tier dispatch table shall map each tier name to a set of valid events and a resolve function | P0 | Replaces the if/else dispatch in `resolveNextAction` |
| FR-6 | Task lifecycle rule conditions shall receive a uniform context bag containing the task, phase, phase index, task index, and config | P0 | Stateless — no shared mutable context between evaluations |
| FR-7 | Phase lifecycle rule conditions shall receive a uniform context bag containing the phase, phase index, and config | P0 | Stateless — same pattern as task rules |
| FR-8 | The resolver module shall iterate the table definitions to determine routing — no if/else branching for rule selection | P0 | Resolver becomes the engine; tables are the data |
| FR-9 | The resolver's single public export (`resolveNextAction`) shall retain its current signature and return shape | P0 | `(state, config) => { action, context }` |
| FR-10 | When no rule matches in a lifecycle table, the resolver shall return a halted action with diagnostic details | P0 | Equivalent to current fallback behavior |
| FR-11 | Every rule row in the task and phase lifecycle tables shall have a stable string `id` field | P1 | Required as insertion anchor for CUSTOM-PIPELINE-STEP |
| FR-12 | Planning step entries shall retain their existing `key` field as a stable name reference | P1 | Required for CUSTOM-PIPELINE-STEP step injection |
| FR-13 | The table module's export shape shall be a plain object of named arrays, not frozen and not wrapped in accessors | P1 | Enables downstream clone-and-extend |
| FR-14 | Rule condition and context-builder functions shall be pure — no side effects, no imports from pipeline modules | P1 | Receives all data via arguments at evaluation time |
| FR-15 | The tier dispatch valid-event sets shall include all 16 non-start, non-halt events mapped to their correct tier | P0 | `halt` handled separately; `start` stays in pipeline-engine |
| FR-16 | The existing behavioral test suite (all 11 categories, ~62 scenarios) shall pass without any modification to the test file | P0 | Primary acceptance criterion |
| FR-17 | New unit tests shall verify each task lifecycle rule condition fires for the correct task state | P0 | Rule conditions testable in isolation |
| FR-18 | New unit tests shall verify each phase lifecycle rule condition fires for the correct phase state | P0 | Rule conditions testable in isolation |
| FR-19 | Project documentation shall be updated to explain the table structure, rule shapes, and resolver iteration model | P1 | Covers the `docs/scripts.md` file |
| FR-20 | Documentation shall describe the shape of each table (`PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH`) and how the resolver iterates them | P1 | Integrated into existing doc sections |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Maintainability | All routing logic is readable as data tables without tracing function call trees — a new contributor can understand the full pipeline routing by reading one file |
| NFR-2 | Extensibility | The table shape supports downstream rule injection (insert-after by ID) and multi-task iteration without structural changes to the table definitions |
| NFR-3 | Reliability | Zero behavioral regressions — the refactored pipeline is provably equivalent via the unmodified behavioral test suite |
| NFR-4 | Performance | No measurable performance change — table iteration replaces if/else with equivalent computational cost (first-match-wins short-circuits) |
| NFR-5 | Dependency hygiene | Zero external dependencies — the table module imports only from the existing constants module |
| NFR-6 | Module boundaries | The four public exports consumed by `pipeline-engine.js` (`getMutation`, `resolveNextAction`, `validateTransition`, `preRead`) retain identical signatures and return shapes |
| NFR-7 | Testability | Individual rule conditions are testable in isolation: given a context bag, verify which rule ID fires without running the full pipeline |

## Assumptions

- The existing behavioral test suite (`pipeline-behavioral.test.js`) is comprehensive and correct — passing all 62 scenarios without modification is sufficient proof of behavioral equivalence
- The `state.json` v3 schema provides all fields needed by rule conditions — no new state fields are required
- The `halt` event continues to be handled by the mutation layer before reaching the resolver, and does not need to appear in tier-dispatch valid-event sets
- The `start` event remains a special case in `pipeline-engine.js` initialization logic, outside the transition table entirely
- Presentation helpers (`formatPhaseId`, `formatTaskId`) and the `halted()` convenience function remain in the resolver module, not in the table definitions
- The existing decision tables in `mutations.js` (`resolveTaskOutcome`, `resolvePhaseOutcome`) are unrelated to this refactor and remain unchanged

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Subtle behavioral divergence not covered by existing tests | High | FR-16 mandates all 62 behavioral scenarios pass unmodified; FR-17/FR-18 add isolated rule-condition tests for additional coverage |
| 2 | Table shape doesn't accommodate downstream project needs, requiring a second refactor | Medium | FR-11, FR-12, FR-13 encode downstream requirements (stable IDs, plain exports, name references) based on analyzed PARALLEL-EXECUTION and CUSTOM-PIPELINE-STEP specifications |
| 3 | Circular dependency introduced between new table module and resolver | Low | The table module is a dependency-graph leaf by design — it imports only from constants, and the resolver imports from it (one-directional) |
| 4 | Internal resolver tests break due to removed helper functions | Low | Only the behavioral test suite is contractual; internal test updates are expected and scoped as part of the implementation |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Behavioral test pass rate | 62/62 scenarios pass (100%) | Run `pipeline-behavioral.test.js` with zero modifications — all 11 categories green |
| New unit test coverage | Every task lifecycle rule and every phase lifecycle rule has at least one isolated condition test | Run new unit test file — all pass |
| Routing logic in data | 100% of planning steps, task lifecycle conditions, phase lifecycle conditions, and tier dispatch expressed as table rows | Code review: `resolver.js` contains zero if/else chains for rule selection |
| Module boundary preservation | 0 signature changes to `resolveNextAction`, `getMutation`, `validateTransition`, `preRead` | Code review: export signatures identical before and after |
| Zero external dependencies | `package.json` unchanged (or nonexistent) | Dependency audit |
| Documentation accuracy | `docs/scripts.md` updated with table structure explanations for all four tables and the resolver iteration model | Documentation review |
