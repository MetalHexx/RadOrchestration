---
project: "PIPELINE-SIMPLIFICATION"
status: "draft"
author: "product-manager-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Product Requirements

## Problem Statement

The orchestration pipeline engine (~2,620 lines across 7 modules) is brittle — fixing one bug routinely causes regressions elsewhere. The root cause is architectural layering that forces split writes, deferred validation, and internal re-entry loops: a single event can trigger 2–3 state writes, 2–3 validation passes, and an internal action loop before producing a result. Half the codebase (~1,300 lines of triage scaffolding, internal action wiring, split-write invariants, and deferred-validation plumbing) exists solely to manage complexity that the architecture itself introduced. This makes the system expensive to maintain and dangerous to modify, while the pipeline's core job — deterministic sequencing and artifact enforcement over non-deterministic agents — is sound and must be preserved.

## Goals

- **G1: Atomic event processing** — Every pipeline event produces exactly one state mutation, one validation pass, and one state write, eliminating split-write inconsistencies
- **G2: Eliminate the triage layer** — Remove the separate triage module; absorb its ~80 lines of decision logic into the mutation handlers, eliminating ~380 lines of scaffolding
- **G3: Eliminate internal actions** — Reduce the action set from ~35 (18 external + 17 internal) to ~19 external-only, removing the internal re-entry loop from the engine
- **G4: Reduce the validator** — Remove invariants that exist solely for split-write protection (currently 5 of 15), keeping only structural and transition guards
- **G5: Behavioral equivalence** — The simplified pipeline must produce the same external action for the same state + event combination; the Orchestrator's routing logic remains unchanged (apart from removed actions)
- **G6: Full test coverage for new semantics** — Deliver a rewritten test suite covering one-write-per-event semantics, merged actions, and the reduced decision tables
- **G7: Non-destructive delivery** — Deliver as a parallel write-new-then-swap: new modules written alongside old, swapped only after full verification
- **G8: Prompt alignment** — All agent definitions, skills, and templates accurately reflect the refactored pipeline's contracts — no stale actions, no phantom fields, no drifted descriptions
- **G9: Updated documentation** — All supporting documentation reflects the simplified architecture, replacing duplicated code inventories with pointers to canonical source files

## Non-Goals

- Changing the planning pipeline (it works correctly today)
- Changing agent behavior or adding new agent capabilities (agents do the same jobs — prompts just get accurate)
- Adding new pipeline features (new events, new actions, new tiers)
- Changing the Orchestrator's event signaling protocol
- Dashboard or UI changes
- Changing the configuration schema
- In-place migration of existing in-flight projects (schema version bump requires a clean restart)

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Pipeline maintainer | have each event produce exactly one state write | I can diagnose bugs by reading one mutation instead of tracing split writes, deferred validation, and re-entry loops | P0 |
| 2 | Pipeline maintainer | have a single code path through the engine for all standard events | there is only one place to look when something goes wrong, instead of 3 forking paths with sub-forks | P0 |
| 3 | Orchestrator agent | receive a single external action per event | I can route directly without the pipeline performing internal iteration behind the scenes | P0 |
| 4 | Orchestrator agent | receive a generic halt action with reason in context | I can display the blocker and stop, without needing per-halt-type routing branches | P1 |
| 5 | Orchestrator agent | receive a single task handoff action with a correction flag in context | I can route to the Tactical Planner once, passing the flag, instead of handling separate fresh and corrective actions | P1 |
| 6 | Pipeline maintainer | have the validator only contain invariants that can actually be violated | I'm not maintaining and testing invariants that are impossible to trip under the new architecture | P1 |
| 7 | Pipeline maintainer | have a comprehensive behavioral test suite for the simplified engine | I can verify end-to-end scenarios without tests coupled to the old split-write/triage architecture | P0 |
| 8 | Pipeline maintainer | have new modules written alongside old ones and swapped only after verification | I can roll back if the new engine has issues, without the old code being destroyed mid-project | P0 |
| 9 | Tactical Planner agent | receive accurate context about whether a task handoff is fresh or corrective | I can produce the right handoff document without relying on a separate action name that no longer exists | P1 |
| 10 | Pipeline maintainer | have agent prompts and skill descriptions match the actual pipeline contracts | agents don't hallucinate steps, reference deleted actions, or produce artifacts with phantom fields | P1 |
| 11 | Pipeline maintainer | have documentation point to canonical source for exhaustive lists instead of duplicating them | documentation doesn't drift from code after every change | P2 |
| 12 | Pipeline maintainer | have the pipeline continue to pre-read and validate agent output artifacts before mutation | non-deterministic agents are forced to conform to artifact contracts, preserving system reliability | P0 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | Each pipeline event must produce exactly one state mutation and one state write — no split writes, no deferred validation, no internal action loops | P0 | Core architectural change |
| FR-2 | Decision table logic (task outcomes and phase outcomes) must be absorbed into the mutation layer, producing identical outcomes to the current triage engine for the same inputs | P0 | The 8 task rows and 5 phase rows must map 1:1 |
| FR-3 | The triage module must be eliminated as a separate component; all its decision logic must be callable from the mutation layer | P0 | ~80 lines of logic preserved, ~380 lines of scaffolding removed |
| FR-4 | Internal actions must be eliminated from the action set; the resolver must return only the ~19 actions that the Orchestrator routes on | P0 | Removes the internal re-entry loop from the engine |
| FR-5 | Tier transitions (to execution, to review, to complete) and pointer advances (next task, next phase) must occur within the mutation, not as separate internal actions | P0 | Consequence of FR-1 and FR-4 |
| FR-6 | The pipeline must continue to pre-read and validate agent output documents before applying mutations, rejecting events when required frontmatter fields are missing or invalid | P0 | 5 event types require pre-read: plan approval, task completion, code review completion, phase plan creation, phase review completion |
| FR-7 | Pre-read data (extracted frontmatter fields) must be passed into mutations via context enrichment — mutations must not re-read documents from disk | P0 | Eliminates redundant I/O |
| FR-8 | The validator must retain structural and transition invariants (bounds checks, gate enforcement, status transition legality, retry monotonicity, timestamp ordering) | P0 | Currently V1–V7, V10–V13 or their equivalents |
| FR-9 | The validator must remove invariants that exist solely for split-write protection and are impossible to violate under atomic writes | P1 | Currently V8, V9, V14, V15 |
| FR-10 | The `partial` task report status must be treated as `failed`, reducing the task decision table from 11 rows to 8 | P1 | Pre-read accepts `complete` or `failed` (plus synonyms); `partial` maps to `failed` |
| FR-11 | Halt actions must be consolidated into a single generic halt with the reason provided in the result context | P1 | Replaces multiple halt-specific actions |
| FR-12 | The corrective task handoff action must be merged into the standard task handoff action, distinguished by a correction flag in context | P1 | One action, richer context |
| FR-13 | The state schema must bump to a new version, removing triage-specific fields (global triage attempts, per-phase triage attempts) | P1 | Clean break; existing projects restart |
| FR-14 | The engine must have a single linear code path for standard events: load state → pre-read → mutate → validate → write → resolve → return | P0 | Init and cold-start remain as simple separate paths |
| FR-15 | The execution sequence must be preserved exactly: phase plan → task handoffs (one at a time) → code → review → next task; after all tasks: phase report → phase review → next phase; after all phases: final review → human approval | P0 | Behavioral equivalence |
| FR-16 | The pipeline result contract must remain unchanged: `{ success, action, context, mutations_applied }` | P0 | Orchestrator compatibility |
| FR-17 | The behavioral test suite must be rewritten to cover the simplified pipeline semantics, including: full happy paths, multi-phase/multi-task scenarios, retry and corrective cycles, halt paths, cold-start resume, pre-read validation failures, and human gate modes | P0 | Current tests are coupled to the old architecture |
| FR-18 | Per-module unit tests must be rewritten to cover the refactored module interfaces (mutations with absorbed decision logic, resolver with external-only actions, validator with reduced invariants) | P0 | — |
| FR-19 | New pipeline modules must be written as a parallel set alongside the existing modules, with old modules only removed after the new set is fully verified | P0 | Write-new-then-swap delivery |
| FR-20 | The Orchestrator agent definition must be updated to reflect the modified action set (removed corrective handoff, consolidated halt actions, updated action count) | P1 | — |
| FR-21 | Agent definitions, skills, and templates that reference removed or renamed pipeline concepts (triage engine, corrective handoff action, specific halt actions, triage attempts) must be updated to reflect the actual contracts | P1 | Alignment pass |
| FR-22 | Documentation must be updated to reflect the simplified architecture: remove triage references, update invariant catalogs, update module inventories, and replace exhaustive code-derived lists with pointers to canonical source files | P2 | Final step after pipeline is verified |
| FR-23 | The validator must continue to return structured errors with invariant identifiers for debugging | P1 | Diagnostic continuity |
| FR-24 | The pipeline must remain a zero-external-dependency system | P0 | Constraint preservation |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Maintainability | The total pipeline engine codebase should be significantly smaller than the current ~2,620 lines (target: ~970 lines) with reduced cyclomatic complexity |
| NFR-2 | Testability | All pipeline modules must support dependency injection for I/O operations, enabling pure unit testing without filesystem access |
| NFR-3 | Testability | Test suite must use only the built-in test runner and assertion library — zero external test dependencies |
| NFR-4 | Reliability | Under identical inputs (same state + same event), the simplified pipeline must produce the same external action as the current pipeline for all non-removed actions |
| NFR-5 | Debuggability | Validation errors, pre-read failures, and mutation failures must include structured identifiers (invariant IDs, event names, field names) sufficient for root-cause analysis |
| NFR-6 | Recoverability | The write-new-then-swap delivery must preserve old modules as a rollback safety net until the new pipeline is verified in production use |
| NFR-7 | Modularity | The new pipeline must be decomposed by concern (constants, mutations, pre-reads, resolver, validator, state I/O) with each module having a single responsibility |
| NFR-8 | Readability | The top-level pipeline entry point must read as a declarative recipe (~20 lines) that a reader can follow without jumping into implementation details |
| NFR-9 | Compatibility | The JSON result contract and event signaling protocol must remain backward-compatible so the Orchestrator agent and UI dashboard continue to work without modification (beyond action set changes) |

## Assumptions

- The planning pipeline is stable and correct — it requires no changes from this project
- The execution sequence the pipeline enforces (plan → handoff → code → review → phase report → phase review) is the correct sequence and does not need modification
- Existing in-flight projects will restart under the new schema version rather than requiring in-place migration
- The decision table logic in the current triage engine is correct — the 8 task rows and 5 phase rows produce the right outcomes and need only relocation, not redesign
- The Orchestrator agent already handles corrective context on task handoffs (routing row 7 checks `result.context.corrective`), so merging the corrective action is functionally transparent
- Agent definitions and skills contain only minor drift from pipeline contracts — the alignment pass is editorial, not behavioral
- The UI dashboard reads `state.json` passively and will not break from internal pipeline refactoring, provided the result contract and state schema field set (minus removed triage fields) remain stable

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Decision table logic produces different outcomes after relocation into mutations | High | Verify with exhaustive input/output tests: every row of the 8-task and 5-phase decision tables must produce identical results to the current triage engine |
| 2 | Pipeline is used to run this very project — mid-project breakage could halt execution | High | Write-new-then-swap delivery ensures the old engine remains functional until the new one is fully verified; old modules kept as rollback |
| 3 | Atomic write assumption masks edge cases where the current split-write sequence handled a subtle ordering concern | Medium | The removed invariants (V8, V9, V14, V15) should be tested as "impossible to violate" — write tests that confirm these conditions cannot arise under the new architecture |
| 4 | Agent prompt alignment pass introduces unintended behavioral changes in agent outputs | Medium | Alignment is editorial only — no new instructions, no removed responsibilities; review each prompt change against the actual pipeline contract |
| 5 | Existing projects with in-flight state cannot use the new engine without restarting | Low | Documented constraint; schema version bump makes this explicit. Acceptable given the scope of internal changes |
| 6 | Documentation pointers to source files become stale if source file paths change | Low | Pointer targets should be stable module names, not deep line-number references |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pipeline engine line count | ≤ 1,000 lines across all modules (down from ~2,620) | Count non-blank, non-comment lines across all pipeline engine modules |
| Action set size | ≤ 19 external-only actions (down from 35 total) | Count entries in the actions constant enum |
| Validator invariant count | ≤ 11 invariants (down from 15) | Count invariant checks in the validator module |
| Code paths through engine | 1 standard path (down from 3+ forking paths) | Audit the main engine function for branching |
| State writes per event | Exactly 1 for all standard events | Verify in behavioral tests that writeState is called exactly once per processEvent invocation |
| Behavioral test coverage | All 10 existing scenario categories covered (happy path, multi-phase, retry, halt, cold-start, pre-read, human gates, etc.) | Map new test describe blocks to the 10 original categories |
| Decision table equivalence | 100% row-for-row match on the 8 task + 5 phase decision table outcomes | Decision table unit tests with explicit row coverage |
| External behavioral equivalence | Same external action for same (state, event) inputs across all non-removed action paths | Regression tests comparing old and new engine outputs for representative state/event combinations |
| Agent/skill alignment | Zero references to deleted actions or phantom fields in any agent definition, skill, or template | Grep audit of all `.agent.md`, `SKILL.md`, and template files for removed terms |
| Rollback capability | Old modules preserved and functional until new pipeline verified | Confirm old module directory exists and passes its own test suite until final cleanup |
