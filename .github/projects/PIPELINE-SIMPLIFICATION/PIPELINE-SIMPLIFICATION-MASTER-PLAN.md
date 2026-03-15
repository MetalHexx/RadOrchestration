---
project: "PIPELINE-SIMPLIFICATION"
total_phases: 4
status: "draft"
author: "architect-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Master Plan

## Executive Summary

The orchestration pipeline engine (~2,620 lines across 7 modules) suffers from architectural complexity — split writes, a bolted-on triage layer, 16 internal actions, and deferred validation — that makes every bug fix a regression risk. This project replaces it with a ~1,100-line engine enforcing one invariant: one event → one mutation → one validation → one write → one external action. The triage layer is eliminated (decision-table logic absorbed into mutations), internal actions are removed (mutations produce final state including pointer advances and tier transitions), and the validator drops from 15 to ~11 invariants by removing split-write guards impossible to violate under atomic writes. Delivery is write-new-then-swap: new modules in `lib-v3/` alongside the existing `lib/`, swapped only after a full test suite passes, with a final alignment pass across all agent definitions, skills, templates, and documentation.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [PIPELINE-SIMPLIFICATION-BRAINSTORMING.md](PIPELINE-SIMPLIFICATION-BRAINSTORMING.md) | ✅ |
| Research | [PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md](PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [PIPELINE-SIMPLIFICATION-PRD.md](PIPELINE-SIMPLIFICATION-PRD.md) | ✅ |
| Design | [PIPELINE-SIMPLIFICATION-DESIGN.md](PIPELINE-SIMPLIFICATION-DESIGN.md) | ✅ |
| Architecture | [PIPELINE-SIMPLIFICATION-ARCHITECTURE.md](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: Each pipeline event must produce exactly one state mutation and one state write — no split writes, no deferred validation, no internal action loops
- **FR-2**: Decision table logic (8 task rows, 5 phase rows) must be absorbed into the mutation layer, producing identical outcomes to the current triage engine
- **FR-4**: Internal actions must be eliminated; the resolver returns only the ~18 external actions the Orchestrator routes on
- **FR-6**: The pipeline must continue to pre-read and validate agent output documents before applying mutations (5 event types: `plan_approved`, `task_completed`, `code_review_completed`, `phase_plan_created`, `phase_review_completed`)
- **FR-14**: The engine must have a single linear code path for standard events: load → pre-read → mutate → validate → write → resolve → return
- **FR-15**: The execution sequence must be preserved exactly: phase plan → task handoffs → code → review → phase report → phase review → next phase → final review → human approval
- **FR-17**: The behavioral test suite must be rewritten covering all 10 scenario categories (happy path, multi-phase, retry, halt, cold-start, pre-read, human gates, etc.)
- **FR-19**: New pipeline modules must be written as a parallel set alongside existing modules, swapped only after full verification
- **NFR-1**: Total pipeline engine codebase target ≤ ~1,100 lines (down from ~2,620)
- **NFR-2**: All pipeline modules must support dependency injection for I/O, enabling pure unit testing without filesystem access

## Key Technical Decisions (from Architecture)

- **Schema version bump to v3**: Clean break — `orchestration-state-v2` → `orchestration-state-v3`. Existing in-flight projects restart; no in-place migration. Removes `execution.triage_attempts` and `phase.triage_attempts` fields
- **New `pre-reads.js` module**: Extracts all 5 pre-read blocks from `pipeline-engine.js` into a dedicated module with per-event pure functions dispatched via lookup table
- **Decision tables absorbed into `mutations.js`**: `resolveTaskOutcome` (8-row) and `resolvePhaseOutcome` (5-row) are internal helpers called directly by mutation handlers — not a separate engine
- **Resolver returns external-only actions (~18)**: All 16 internal actions eliminated. `create_corrective_handoff` merged into `create_task_handoff` (distinguished by `context.is_correction`). Specific halt actions merged into `display_halted` (reason in `context.details`)
- **Validator reduced to ~11 invariants**: V8, V9, V14, V15 removed (split-write guards impossible to violate under atomic writes). V13 simplified (no timestamp racing workaround)
- **Parallel write directory**: New modules in `.github/orchestration/scripts/lib-v3/`, new tests in `.github/orchestration/scripts/tests-v3/`. Old `lib/` untouched until swap
- **`partial` report status treated as `failed`**: Pre-read normalizes `partial` → `failed`, reducing the task decision table from 11 rows to 8
- **`writeState` is the sole setter of `project.updated`**: Eliminates the current double-timestamp pattern

## Key Design Constraints (from Design)

- **Entry point readability**: `processEvent` must read as a ~20-line declarative recipe — load → pre-read → mutate → validate → write → resolve → return — with no branching by event type in the standard path
- **Mock I/O factory is the sole test DI mechanism**: `createMockIO({ state, documents, config })` provides in-memory I/O; all inputs/outputs deep-cloned to prevent cross-test leaks
- **State factory pattern with spread overrides**: `createBaseState()`, `createExecutionState()`, `createReviewState()` produce valid v3 state; scenario-specific tests use spread overrides
- **One `processEvent` call per `it` block**: Behavioral tests enforce one-event-one-write; failures are atomic and traceable
- **Decision table tests named by row number**: `it('task row 4: changes_requested + complete + retries left → corrective')` makes coverage auditable
- **PipelineResult contract unchanged**: `{ success, action, context, mutations_applied }` — the Orchestrator parses this from stdout without modification
- **Three error categories**: CLI arg errors → stderr + exit 1; pre-read failures → structured `PipelineResult` with event/field; validation failures → structured `PipelineResult` with invariant ID array
- **Status normalization during pre-read**: `complete`/`pass` → `complete`; `failed`/`fail`/`partial` → `failed`

## Phase Outline

### Phase 1: Foundation — Constants, State I/O, Pre-Reads, Validator

**Goal**: Establish the v3 type system, reduced enum set, I/O layer, artifact validation module, and state invariant checker that all other modules depend on.

**Scope**:
- `lib-v3/constants.js` — all frozen enums with `NEXT_ACTIONS` reduced to ~18 external-only entries, `TRIAGE_LEVELS` removed, all JSDoc `@typedef` definitions updated for v3 schema — refs: [Architecture: Constants](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#constants--enums), [PRD: FR-4](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements), [PRD: FR-13](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `lib-v3/state-io.js` — ported from current `state-io.js`, `writeState` rationalized as sole `project.updated` setter — refs: [Architecture: state-io](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#module-stateiojs-filesystem-io)
- `lib-v3/pre-reads.js` — 5-event lookup table, per-event extraction/validation, status normalization (`partial` → `failed`) — refs: [Architecture: pre-reads](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#pre-read-contracts), [Design: Pre-Read Contracts](PIPELINE-SIMPLIFICATION-DESIGN.md#module-prereadsjs-new--artifact-extraction), [PRD: FR-6, FR-7, FR-10](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `lib-v3/validator.js` — ~11 invariants (V1–V7, V10–V13), structured error output with invariant IDs, V8/V9/V14/V15 removed — refs: [Architecture: Validator](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#validator-contracts), [PRD: FR-8, FR-9](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `tests-v3/constants.test.js` — enum freeze, entry count, completeness
- `tests-v3/state-io.test.js` — I/O operations (if changes warrant)
- `tests-v3/pre-reads.test.js` — per-event extraction, missing fields, invalid values, normalization
- `tests-v3/validator.test.js` — per-invariant tests, confirm V8/V9/V14/V15 not checked

**Exit Criteria**:
- [ ] `constants.js` exports all frozen enums; `NEXT_ACTIONS` has exactly 18 entries; `TRIAGE_LEVELS` does not exist; JSDoc types define v3 schema (no `triage_attempts` fields)
- [ ] `state-io.js` passes unit tests; `writeState` is the sole setter of `project.updated`
- [ ] `pre-reads.js` handles all 5 events with correct extraction and validation; status normalization maps `partial` → `failed`; non-pre-read events pass through unchanged
- [ ] `validator.js` has exactly ~11 invariant checks; V8/V9/V14/V15 are absent; structured errors include invariant IDs
- [ ] All Phase 1 unit tests pass

**Phase Doc**: [phases/PIPELINE-SIMPLIFICATION-PHASE-01-FOUNDATION.md](phases/PIPELINE-SIMPLIFICATION-PHASE-01-FOUNDATION.md) *(created at execution time)*

---

### Phase 2: Core Logic — Mutations with Absorbed Decision Tables, Resolver

**Goal**: Build the mutation layer that processes all 18 events with absorbed decision-table logic and the resolver that maps post-mutation state to exactly one external action.

**Scope**:
- `lib-v3/mutations.js` — 18-event handler lookup table (`MUTATIONS` map), `resolveTaskOutcome` (8-row task decision table), `resolvePhaseOutcome` (5-row phase decision table), `checkRetryBudget`, pointer advances (`current_task`, `current_phase`) and tier transitions within mutations, `normalizeDocPath` — refs: [Architecture: Mutation Contracts](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#mutation-contracts), [Design: Task Decision Table](PIPELINE-SIMPLIFICATION-DESIGN.md#module-mutationsjs-event-handlers--decision-logic), [PRD: FR-1, FR-2, FR-3, FR-5](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `lib-v3/resolver.js` — `resolveNextAction` with ~18 external-only actions, planning/execution/review/gate resolution, corrective context enrichment (`is_correction`, `previous_review`, `reason`), halt consolidation into `display_halted` with `context.details` — refs: [Architecture: Resolver Contracts](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#resolver-contracts), [PRD: FR-4, FR-11, FR-12](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `tests-v3/mutations.test.js` — per-handler unit tests, decision table row coverage (8 task rows + 5 phase rows named by row number), pointer advance verification, tier transition verification
- `tests-v3/resolver.test.js` — all ~18 external actions, per-tier resolution, corrective handoff context, halt context consolidation

**Exit Criteria**:
- [ ] `mutations.js` handles all 18 events; `resolveTaskOutcome` covers all 8 task rows with identical outcomes to current triage engine; `resolvePhaseOutcome` covers all 5 phase rows; pointer advances and tier transitions occur within the mutation
- [ ] `resolver.js` returns only external actions (~18); no internal actions exist; `create_corrective_handoff` does not exist as a separate action; all halts return `display_halted` with reason in context
- [ ] Decision table unit tests name each row explicitly; every row of 8-task and 5-phase tables has a dedicated test
- [ ] All Phase 2 unit tests pass

**Phase Doc**: [phases/PIPELINE-SIMPLIFICATION-PHASE-02-CORE-LOGIC.md](phases/PIPELINE-SIMPLIFICATION-PHASE-02-CORE-LOGIC.md) *(created at execution time)*

---

### Phase 3: Engine Assembly — Pipeline Engine Integration, Behavioral Tests

**Goal**: Wire all modules into the declarative engine recipe and validate end-to-end behavior with comprehensive behavioral tests.

**Scope**:
- `lib-v3/pipeline-engine.js` — the ~20-line `processEvent` declarative recipe (load → pre-read → mutate → validate → write → resolve → return), `scaffoldInitialState` for v3, init/cold-start early returns — refs: [Architecture: processEvent](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#processevent--engine-entry-point), [Design: Entry Point Readability](PIPELINE-SIMPLIFICATION-DESIGN.md#pipeline-entry-point-readability), [PRD: FR-14, FR-16](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- `tests-v3/pipeline-engine.test.js` — engine integration tests (init path, cold-start path, standard path, pre-read failure path, validation failure path)
- `tests-v3/pipeline-behavioral.test.js` — end-to-end scenarios via `processEvent` covering all 10 categories: full happy path, multi-phase/multi-task, retry & corrective cycles, halt paths, cold-start resume, pre-read validation failures, human gate modes, phase lifecycle, frontmatter-driven flows — refs: [PRD: FR-15, FR-17, FR-18](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements), [Design: Test Organization](PIPELINE-SIMPLIFICATION-DESIGN.md#test-organization)

**Exit Criteria**:
- [ ] `processEvent` follows the linear recipe with no branching by event type in the standard path; init and cold-start are early returns
- [ ] `scaffoldInitialState` produces valid v3 state (`$schema: 'orchestration-state-v3'`, no `triage_attempts`)
- [ ] Behavioral test suite covers all 10 scenario categories from the current test suite
- [ ] Every behavioral test verifies exactly one `writeState` call per successful standard event (`io.getWrites().length === 1`)
- [ ] Full `tests-v3/` test suite passes (all modules integrated end-to-end)

**Phase Doc**: [phases/PIPELINE-SIMPLIFICATION-PHASE-03-ENGINE-ASSEMBLY.md](phases/PIPELINE-SIMPLIFICATION-PHASE-03-ENGINE-ASSEMBLY.md) *(created at execution time)*

---

### Phase 4: Swap & Alignment — Swap lib-v3 → lib, Update Prompts, Update Docs

**Goal**: Put the new engine into production position, align all agent/skill/template prompts with the refactored contracts, and update documentation.

**Scope**:
- Execute swap sequence: `lib/` → `lib-old/`, `lib-v3/` → `lib/`, update `pipeline.js` require paths, copy `tests-v3/` tests to `tests/` (overwrite), delete `tests/triage-engine.test.js` — refs: [Architecture: Delivery Swap Sequence](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#delivery-swap-sequence), [PRD: FR-19](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- Update Orchestrator agent definition: routing table removes `create_corrective_handoff`, consolidates halt actions to `display_halted`, updates action count — refs: [PRD: FR-20](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements), [Research: Agent Definitions](PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md#agent-definitions-alignment-targets)
- Update Tactical Planner agent/skill: `is_correction` context flag replaces separate corrective action — refs: [PRD: FR-21](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements)
- Update skills referencing triage engine: `generate-task-report` and `review-phase` "triage engine" → "mutation handler" in consumer columns — refs: [Research: Skills](PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md#skills-alignment-targets)
- Update `state-management.instructions.md`: remove "after every triage mutation" clause — refs: [Research: Instructions](PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md#instructions)
- Update documentation: `docs/scripts.md` (remove internal action tables, update module inventory), `docs/pipeline.md` (update triage references), `docs/validation.md` (remove V8/V9/V14/V15, update "runs twice" → "runs once"), `docs/agents.md` (update `triage_attempts` reference) — refs: [PRD: FR-22](PIPELINE-SIMPLIFICATION-PRD.md#functional-requirements), [Research: Documentation](PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md#documentation-update-targets)
- Delete `lib-old/` after full test suite passes in production position — refs: [Architecture: Cross-Cutting — Rollback Safety](PIPELINE-SIMPLIFICATION-ARCHITECTURE.md#cross-cutting-concerns)

**Exit Criteria**:
- [ ] Pipeline runs against its own project (`pipeline.js` invokes `lib/` which is the new engine)
- [ ] Full test suite passes from the production `tests/` directory
- [ ] No `.agent.md`, `SKILL.md`, or template references `triage_engine`, `create_corrective_handoff`, `triage_attempts`, or any of the 16 removed internal actions as live concepts
- [ ] `docs/scripts.md` no longer lists internal actions; `docs/validation.md` lists only ~11 invariants; `docs/pipeline.md` has no triage-layer description
- [ ] `lib-old/` deleted

**Phase Doc**: [phases/PIPELINE-SIMPLIFICATION-PHASE-04-SWAP-ALIGNMENT.md](phases/PIPELINE-SIMPLIFICATION-PHASE-04-SWAP-ALIGNMENT.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml — this project uses 4)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Max consecutive review rejections**: 3
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: After planning (always), execution mode `ask`, after final review (always)

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Decision table logic produces different outcomes after relocation into mutations | High | Exhaustive input/output unit tests: every row of the 8-task and 5-phase decision tables must produce identical results to current triage engine. Tests named by row number for audit | Coder + Reviewer |
| Pipeline is used to run this very project — mid-project breakage could halt execution | High | Write-new-then-swap delivery: old engine remains functional in `lib/` until new engine in `lib-v3/` is fully verified. Old modules kept as `lib-old/` rollback after swap | Orchestrator |
| Atomic write assumption masks edge cases where split-write sequence handled subtle ordering | Medium | Write tests that confirm V8/V9/V14/V15 conditions cannot arise under the new architecture. Behavioral tests verify no split writes occur (exactly 1 `writeState` per event) | Coder + Reviewer |
| Agent prompt alignment introduces unintended behavioral changes | Medium | Alignment is editorial only — no new instructions, no removed responsibilities. Each prompt change reviewed against actual pipeline contract. Grep audit for removed terms after alignment | Reviewer |
| Existing projects with in-flight state cannot use new engine without restarting | Low | Documented constraint; schema version bump (`v2` → `v3`) makes incompatibility explicit. Acceptable given internal restructuring scope | Human |
| Documentation pointers to source files become stale if paths change | Low | Pointer targets are stable module names (`constants.js`, `validator.js`), not deep line-number references | Coder |
