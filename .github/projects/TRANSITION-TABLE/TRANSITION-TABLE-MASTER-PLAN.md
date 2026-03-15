---
project: "TRANSITION-TABLE"
total_phases: 3
status: "draft"
type: "master-plan"
author: "architect-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Master Plan

## Executive Summary

This project refactors the pipeline's routing layer from implicit if/else function trees in `resolver.js` into explicit, data-driven rule tables in a new `transition-table.js` module. A single new file (`.github/orchestration/scripts/lib/transition-table.js`) exports four named tables — planning steps, task lifecycle rules, phase lifecycle rules, and tier dispatch — while `resolver.js` becomes a generic table-evaluation engine that iterates them. All other pipeline modules (`pipeline-engine.js`, `mutations.js`, `pre-reads.js`, `validator.js`, `constants.js`, `state-io.js`) remain unchanged, and the pipeline's observable behavior is provably identical — validated by passing all ~62 scenarios in `pipeline-behavioral.test.js` without modification. This refactor is the prerequisite foundation for the downstream PARALLEL-EXECUTION and CUSTOM-PIPELINE-STEP projects, which require routing logic expressed as inspectable, extensible data.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [TRANSITION-TABLE-BRAINSTORMING.md](.github/projects/TRANSITION-TABLE/TRANSITION-TABLE-BRAINSTORMING.md) | ✅ |
| Research | [TRANSITION-TABLE-RESEARCH-FINDINGS.md](.github/projects/TRANSITION-TABLE/TRANSITION-TABLE-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [TRANSITION-TABLE-PRD.md](.github/projects/TRANSITION-TABLE/TRANSITION-TABLE-PRD.md) | ✅ |
| Design | [TRANSITION-TABLE-DESIGN.md](.github/projects/TRANSITION-TABLE/TRANSITION-TABLE-DESIGN.md) | ✅ |
| Architecture | [TRANSITION-TABLE-ARCHITECTURE.md](.github/projects/TRANSITION-TABLE/TRANSITION-TABLE-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional and critical non-functional requirements that drive phasing:

- **FR-1**: A dedicated module (`transition-table.js`) shall export four named table definitions: `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, and `TIER_DISPATCH` — single file, dependency-graph leaf
- **FR-3 / FR-4**: Task and phase lifecycle rules shall be ordered arrays with stable string IDs, condition predicates, actions, and context-builder functions — first-match-wins evaluation
- **FR-8**: The resolver module shall iterate table definitions to determine routing — no if/else branching for rule selection
- **FR-9**: The resolver's public export (`resolveNextAction`) shall retain its current signature and return shape: `(state, config) => { action, context }`
- **FR-16**: The existing behavioral test suite (all 11 categories, ~62 scenarios) shall pass without any modification to the test file — primary acceptance criterion
- **FR-17 / FR-18**: New unit tests shall verify each task and phase lifecycle rule condition fires for the correct state in isolation
- **FR-19 / FR-20**: Documentation shall be updated to explain the table structure, rule shapes, and resolver iteration model
- **NFR-3**: Zero behavioral regressions — the refactored pipeline is provably equivalent via the unmodified behavioral test suite
- **NFR-5**: Zero external dependencies — the table module imports only from `constants.js`

## Key Technical Decisions (from Architecture)

- **One new file, one modified file**: `transition-table.js` (NEW, ~120 lines) contains all four table definitions; `resolver.js` (MODIFIED, ~180 lines down from ~260) becomes the table-evaluation engine. `constants.js` receives additive-only JSDoc typedef changes.
- **Dependency-graph leaf**: `transition-table.js` imports only from `constants.js`. No reverse dependencies. The dependency flow is strictly `resolver.js → transition-table.js → constants.js`.
- **Generic `evaluateRules()` function**: A single reusable loop replaces all if/else chains — iterates a rule array with a context bag, returns the first match or `null`.
- **Binding strategy for `TIER_DISPATCH`**: Table defines `validEvents` as static data with `resolve: null` placeholders. `resolver.js` binds the `resolve` function references at module load time to avoid circular dependencies.
- **Context bag pattern**: `formatPhaseId` and `formatTaskId` helpers are passed via the context bag to `buildContext` closures, keeping `transition-table.js` free of resolver imports.
- **Tables are not frozen**: Exported as plain arrays/objects (not `Object.freeze()`) — enabling downstream CUSTOM-PIPELINE-STEP to clone-and-extend.
- **Stable rule IDs**: Every rule row has a stable string `id` field (e.g., `task-halted`, `phase-report`) serving as insertion anchors for CUSTOM-PIPELINE-STEP.
- **Preserved public API**: The four module exports consumed by `pipeline-engine.js` (`resolveNextAction`, `getMutation`, `validateTransition`, `preRead`) retain identical signatures and return shapes.

## Key Design Constraints (from Design)

- **No visual UI**: This is a pure backend/infrastructure refactor — the "design" is the data structure schema for the four rule tables and the module interface contracts
- **Action-context contracts are behavioral contracts**: Each rule's `buildContext` must produce the exact context shape currently returned by the equivalent if/else branch — deviations break `pipeline-behavioral.test.js`
- **Rule order is critical**: `task-halted` must precede all other task rules; `task-gate` must follow `task-review`; `phase-report` must precede `phase-review` — evaluation order is the execution priority
- **Stateless condition functions**: All `condition` and `buildContext` functions receive everything via the context bag — no side effects, no imports, no shared mutable state between evaluations
- **Planning steps retain `key` as stable name reference**: No new `id` field needed; `event` and `doc_type` are informational columns not consumed at runtime
- **`HALTED` and `COMPLETE` tiers excluded from `TIER_DISPATCH`**: Terminal states are handled directly in `resolveNextAction()` before table lookup
- **`halt` and `start` events live outside the transition table**: `halt` is handled by the mutation layer; `start` is initialization logic in `pipeline-engine.js`

## Phase Outline

### Phase 1: Table Definitions + Unit Tests

**Goal**: Create `transition-table.js` with all 4 table exports and a new unit test file verifying rule conditions in isolation.

**Scope**:
- Create `.github/orchestration/scripts/lib/transition-table.js` with `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH` (with `resolve: null` placeholders) — refs: [FR-1](TRANSITION-TABLE-PRD.md#fr-1), [FR-3](TRANSITION-TABLE-PRD.md#fr-3), [FR-4](TRANSITION-TABLE-PRD.md#fr-4), [FR-5](TRANSITION-TABLE-PRD.md#fr-5)
- Add JSDoc typedefs to `.github/orchestration/scripts/lib/constants.js`: `PlanningStepDef`, `TaskRuleContext`, `PhaseRuleContext`, `LifecycleRule`, `TierDispatchEntry` — refs: [Architecture: Contracts](TRANSITION-TABLE-ARCHITECTURE.md#contracts--interfaces)
- Create `.github/orchestration/scripts/tests/transition-table.test.js` with isolated condition tests for each rule — refs: [FR-17](TRANSITION-TABLE-PRD.md#fr-17), [FR-18](TRANSITION-TABLE-PRD.md#fr-18)
- Verify all 6 task lifecycle rule conditions fire for the correct task state with no false positives
- Verify all 5 phase lifecycle rule conditions fire for the correct phase state with no false positives

**Files created**:
- `.github/orchestration/scripts/lib/transition-table.js` (NEW)
- `.github/orchestration/scripts/tests/transition-table.test.js` (NEW)

**Files modified**:
- `.github/orchestration/scripts/lib/constants.js` (additive JSDoc typedefs only)

**Exit Criteria**:
- [ ] `transition-table.js` exports 4 named tables: `PLANNING_STEPS` (5 entries), `TASK_LIFECYCLE_RULES` (6 rules), `PHASE_LIFECYCLE_RULES` (5 rules), `TIER_DISPATCH` (3 tier entries with `resolve: null`)
- [ ] `transition-table.js` imports only from `constants.js` — dependency-graph leaf verified
- [ ] Every task lifecycle rule has at least one unit test verifying its condition fires for the correct state
- [ ] Every phase lifecycle rule has at least one unit test verifying its condition fires for the correct state
- [ ] All new unit tests in `transition-table.test.js` pass
- [ ] All existing tests (`mutations.test.js`, `resolver.test.js`, `validator.test.js`, `pipeline-engine.test.js`, `pipeline-behavioral.test.js`) still pass — no regressions from additive changes

**Phase Doc**: `phases/TRANSITION-TABLE-PHASE-01-TABLE-DEFINITIONS.md` *(created at execution time)*

---

### Phase 2: Resolver Refactor + Behavioral Validation

**Goal**: Refactor `resolver.js` to consume tables from `transition-table.js` and validate behavioral equivalence by running the full existing test suite.

**Scope**:
- Add `evaluateRules(rules, ctx)` generic table-evaluation function to `resolver.js` — refs: [Architecture: evaluateRules](TRANSITION-TABLE-ARCHITECTURE.md#evaluaterules--the-generic-table-engine)
- Replace `resolveTask()` / `resolveTaskGate()` if/else chains with `evaluateRules(TASK_LIFECYCLE_RULES, ctx)` — refs: [FR-8](TRANSITION-TABLE-PRD.md#fr-8)
- Replace `resolvePhaseCompletion()` / `resolvePhaseGate()` if/else chains with `evaluateRules(PHASE_LIFECYCLE_RULES, ctx)` — refs: [FR-8](TRANSITION-TABLE-PRD.md#fr-8)
- Refactor `resolveNextAction()` to use `TIER_DISPATCH` lookup for active tiers — refs: [FR-5](TRANSITION-TABLE-PRD.md#fr-5)
- Bind `TIER_DISPATCH[tier].resolve` references at module load time
- Remove replaced internal functions: `resolveTask`, `resolveTaskGate`, `resolvePhaseCompletion`, `resolvePhaseGate`, `resolvePhaseInProgress`
- Remove `PLANNING_STEP_ORDER` (replaced by imported `PLANNING_STEPS`)
- Replace `resolvePlanning()` to iterate `PLANNING_STEPS` from the table
- Run the **entire existing test suite** to prove behavioral equivalence:
  - `pipeline-behavioral.test.js` — all 11 categories, ~62 scenarios, **zero modifications** (primary acceptance criterion)
  - `mutations.test.js` — must pass unmodified
  - `resolver.test.js` — may need updates if it tests removed internal functions
  - `validator.test.js` — must pass unmodified
  - `pipeline-engine.test.js` — must pass unmodified
- Run `transition-table.test.js` (from Phase 1) to confirm unit tests still pass after resolver wiring

**Files modified**:
- `.github/orchestration/scripts/lib/resolver.js` (MODIFIED — refactored to table-evaluation engine)

**Files unchanged (contractual)**:
- `.github/orchestration/scripts/lib/pipeline-engine.js`
- `.github/orchestration/scripts/lib/mutations.js`
- `.github/orchestration/scripts/lib/pre-reads.js`
- `.github/orchestration/scripts/lib/validator.js`
- `.github/orchestration/scripts/lib/state-io.js`
- `.github/orchestration/scripts/pipeline.js`
- `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`

**Exit Criteria**:
- [ ] `pipeline-behavioral.test.js` passes all 11 categories (~62 scenarios) with zero modifications to the test file
- [ ] `mutations.test.js` passes without modification
- [ ] `validator.test.js` passes without modification
- [ ] `pipeline-engine.test.js` passes without modification
- [ ] `transition-table.test.js` (Phase 1 unit tests) still passes
- [ ] `resolver.js` contains zero if/else chains for rule selection — all routing uses table evaluation
- [ ] `resolveNextAction` export signature unchanged: `(state, config) => { action, context }`
- [ ] `resolver.js` imports `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH` from `transition-table.js`
- [ ] No changes to any files outside `resolver.js` (except `resolver.test.js` if internal function tests need updating)

**Phase Doc**: `phases/TRANSITION-TABLE-PHASE-02-RESOLVER-REFACTOR.md` *(created at execution time)*

---

### Phase 3: Documentation Updates

**Goal**: Update `docs/scripts.md` with comprehensive explanations of the new table structure, rule shapes, resolver iteration model, and dependency relationships.

**Scope**:
- Update `docs/scripts.md` to explain what `transition-table.js` contains and why it exists — refs: [FR-19](TRANSITION-TABLE-PRD.md#fr-19)
- Document the shape of all four rule tables: `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH` — refs: [FR-20](TRANSITION-TABLE-PRD.md#fr-20)
- Explain how the resolver now iterates tables using `evaluateRules()` with first-match-wins semantics
- Document the context bag pattern (`TaskRuleContext`, `PhaseRuleContext`)
- Document the rule ID naming convention and its purpose as insertion anchors for CUSTOM-PIPELINE-STEP
- Document the new dependency relationship: `resolver.js → transition-table.js → constants.js`
- Integrate updates into existing document sections where appropriate — do not create a standalone separate document

**Files modified**:
- `docs/scripts.md` (MODIFIED — table structure explanations added)

**Exit Criteria**:
- [ ] `docs/scripts.md` describes the purpose and contents of `transition-table.js`
- [ ] `docs/scripts.md` documents the shape of all 4 tables (`PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, `TIER_DISPATCH`)
- [ ] `docs/scripts.md` explains the resolver iteration model (first-match-wins, context bags, `evaluateRules`)
- [ ] `docs/scripts.md` documents the dependency relationship (`resolver.js → transition-table.js → constants.js`)
- [ ] Documentation is concise and integrated into existing sections, not a standalone appendix
- [ ] No code changes in this phase — documentation only

**Phase Doc**: `phases/TRANSITION-TABLE-PHASE-03-DOCUMENTATION.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml`)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Git strategy**: `single_branch` — sequential commits with `[orch]` prefix
- **Human gates**: `after_planning: true` (hard default), `execution_mode: ask`, `after_final_review: true` (hard default)

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Subtle behavioral divergence not covered by existing tests | High | FR-16 mandates all ~62 behavioral scenarios pass unmodified; FR-17/FR-18 add isolated rule-condition unit tests. Phase 2 exit criteria require 100% pass rate across all test files. | Coder + Reviewer |
| Table shape doesn't accommodate downstream project needs (PARALLEL-EXECUTION, CUSTOM-PIPELINE-STEP), requiring a second refactor | Medium | FR-11, FR-12, FR-13 encode downstream requirements: stable `id` fields as insertion anchors, plain (non-frozen) exports for clone-and-extend, stateless rule conditions for multi-task iteration. Design doc specifies exact field shapes. | Architect |
| Circular dependency introduced between `transition-table.js` and `resolver.js` | Low | `transition-table.js` is a dependency-graph leaf by design — imports only from `constants.js`. `TIER_DISPATCH.resolve` uses `null` placeholders bound by `resolver.js` at load time. Phase 1 exit criteria verify import-only-from-constants. | Coder |
| Internal resolver tests (`resolver.test.js`) break due to removed helper functions | Low | Only `pipeline-behavioral.test.js` is contractual. Internal test updates for removed functions (`resolveTask`, `resolvePhaseCompletion`, etc.) are expected and scoped within Phase 2. | Coder |
| Action-context shape mismatch causing silent behavioral divergence | Medium | Architecture documents exact required context fields per rule ID (11 rules, each with specified fields). `pipeline-behavioral.test.js` validates context shapes end-to-end. | Coder + Reviewer |
