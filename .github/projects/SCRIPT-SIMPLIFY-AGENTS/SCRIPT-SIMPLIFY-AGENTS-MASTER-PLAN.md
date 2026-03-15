---
project: "SCRIPT-SIMPLIFY-AGENTS"
status: "draft"
author: "architect-agent"
created: "2026-03-12T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Master Plan

## Executive Summary

This project refactors the orchestration system's control flow by replacing three standalone CLI scripts and the Tactical Planner's state-management responsibilities with a single, unified event-driven pipeline script (`pipeline.js`). The pipeline script internalizes all state mutations, validation, triage, and next-action resolution into one deterministic call per cycle, eliminating the class of bugs where an LLM re-derives mechanical JSON mutations from prose instructions. The Tactical Planner becomes a pure planning agent (phase plans, task handoffs, phase reports), the Orchestrator shrinks to an ~18-action event-driven controller, and three prose shadow documents (`state-json-schema.md`, `state-management.instructions.md`, `triage-report` skill) are eliminated because their content is already defined more completely in code. The project concludes with a comprehensive documentation overhaul so that all user-facing and system-facing docs accurately describe the post-refactor architecture.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [SCRIPT-SIMPLIFY-AGENTS-BRAINSTORMING.md](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-BRAINSTORMING.md) | ✅ |
| Research Findings | [SCRIPT-SIMPLIFY-AGENTS-RESEARCH-FINDINGS.md](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [SCRIPT-SIMPLIFY-AGENTS-PRD.md](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md) | ✅ |
| Design | [SCRIPT-SIMPLIFY-AGENTS-DESIGN.md](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-DESIGN.md) | ✅ |
| Architecture | [SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional requirements and critical non-functional requirements that drive phasing. See [PRD](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md) for the complete list.

- **FR-1**: Unified pipeline script accepts an event name + context and returns a JSON result specifying the Orchestrator's next action — replaces the multi-script loop
- **FR-4**: Pipeline script applies state mutations internally for each event type (one deterministic mutation per event), replacing Tactical Planner Mode 2
- **FR-6**: Pipeline script executes triage internally when triggered, using the existing `triage-engine.js` (unchanged), replacing standalone `triage.js` and Tactical Planner triage steps
- **FR-9**: `triage_attempts` persisted in `state.json` — incremented on triage events, reset on advance events — replacing the Orchestrator's runtime-local counter that was lost on context compaction
- **FR-11**: Tactical Planner agent definition stripped of all state mutation responsibilities (Modes 1 & 2), triage invocation, and `STATUS.md` references
- **FR-12**: Orchestrator agent definition rewritten to an event-driven loop with ~18-action routing table (down from ~35)
- **FR-13**: `triage-report` skill deleted; planning-relevant guidance folded into `create-task-handoff` and `create-phase-plan` skills
- **NFR-3**: The 4 existing lib module test suites (3,593 lines: `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`) must continue to pass **unmodified**
- **NFR-4**: Pipeline engine testable with mocked I/O — all filesystem access isolated in `state-io.js`
- **NFR-11**: No agent directly writes `state.json` — all state mutations flow through the pipeline script

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation. See [Architecture](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) for full contracts and interfaces.

- **Four-layer module composition**: CLI layer (`pipeline.js`) → Orchestration layer (`pipeline-engine.js`) → Domain layer (`mutations.js`, preserved libs) → Infrastructure layer (`state-io.js`, shared utilities). Each layer has a single responsibility and clear dependency direction.
- **I/O isolation via dependency injection**: `pipeline-engine.js` receives a `PipelineIO` interface (read/write state, read config, read documents, ensure directories). This is the sole mockable boundary — domain logic is pure functions with zero I/O.
- **Mutation lookup table pattern**: `mutations.js` exports a `MUTATIONS` record mapping event names to handler functions. Each handler is a pure function ≤15 lines: `(state, context) → MutationResult`. Adding a new event requires only adding a function and registering it.
- **Task report pre-read by engine**: The pipeline engine reads task report frontmatter via `io.readDocument()` and enriches the context before passing it to the mutation function, keeping mutations pure.
- **Dual validation passes for triage events**: After the initial mutation, validate + write. After the triage mutation, validate + write again. Invalid state never reaches disk.
- **Reuse shared utilities from `validate-orchestration`**: `state-io.js` imports `fs-helpers.js`, `yaml-parser.js`, and `frontmatter.js` from the existing validate-orchestration skill utils — no new parsing code needed.
- **`triage_attempts` in `execution` section**: Placed alongside other execution state because triage only occurs during the execution tier. Lifecycle: init → 0, triage → increment, advance → reset, >1 → halt.
- **CommonJS + Node.js built-ins only**: Zero npm dependencies. Follows all existing conventions: `'use strict'`, shebang line, `require.main === module` guard, GNU long-option CLI, stdout for JSON, stderr for diagnostics.

## Key Design Constraints (from Design)

Curated design decisions that affect implementation. See [Design](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-DESIGN.md) for complete flows and schemas.

- **Atomic event-action contract**: Each pipeline call is atomic — one event in, one `{ success, action, context, mutations_applied, triage_ran, validation_passed }` result out. The Orchestrator never sees intermediate state.
- **Closed event vocabulary (19 events)**: All pipeline inputs must use exact event names from the closed enum (`start`, `research_completed`, ..., `final_rejected`). No freeform event strings.
- **~18-action reduced vocabulary**: The Orchestrator's routing table only contains external actions (agent spawns, human gates, terminal displays). ~17 internal mechanical actions are handled inside the pipeline script.
- **Uniform error result shape**: Error results include the event that failed, mutations attempted before the error, the validation result, and a state snapshot for debugging. State is NOT written on validation failure.
- **Context compaction recovery**: The Orchestrator calls `pipeline.js --event start` to recover from any state. All state is in `state.json` (including `triage_attempts`). No runtime counters or agent memory required.
- **Corrective context flow via skills**: `create-task-handoff` and `create-phase-plan` skills gain "Prior Context" sections that instruct the Planner to read computed triage outcomes (`review_action`, `phase_review_action`) from `state.json` and adjust planning output accordingly — the Planner never derives triage outcomes itself.

## Phase Outline

### Phase 1: Core Pipeline Engine

**Goal**: Build the unified event-driven pipeline script with all 19 event handlers, triage integration, validation, and deterministic I/O — fully replacing the 3 standalone scripts.

**Scope**:
- Create `state-io.js` — filesystem I/O isolation module with `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories` — refs: [Architecture: State I/O Interface](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md#state-io-interface)
- Create `mutations.js` — 18 event mutation handlers + `applyTaskTriage`, `applyPhaseTriage`, `needsTriage`, `getMutation` — refs: [Architecture: Mutations Interface](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md#mutations-interface)
- Create `pipeline-engine.js` — linear recipe: load → mutate → validate → write → triage → resolve → return — refs: [Architecture: Pipeline Engine Interface](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md#pipeline-engine-interface), [FR-1, FR-4, FR-5, FR-6, FR-7](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Create `pipeline.js` — CLI entry point with arg parsing (~20 lines) — refs: [Architecture: Pipeline CLI Interface](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md#pipeline-cli-interface)
- Add `triage_attempts` to `state.json` scaffolding in the init path — refs: [FR-9](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Create `mutations.test.js` — unit tests for all 18 mutation handlers + triage mutation helpers
- Create `pipeline-engine.test.js` — integration tests with mocked `PipelineIO` for all 19 events
- Create `state-io.test.js` — I/O module tests
- Create `pipeline.test.js` — CLI arg parsing + E2E integration tests

**Dependencies**: None (first phase)

**Estimated tasks**: 6–8

**Exit Criteria**:
- [ ] All 19 events produce correct deterministic output (verified by `pipeline-engine.test.js`)
- [ ] All 18 mutation functions have unit tests (`mutations.test.js`)
- [ ] Pipeline handles init (no `state.json`), cold start, and all steady-state events
- [ ] `triage_attempts` is persisted, incremented on triage, reset on advance, >1 triggers halt
- [ ] All 4 preserved lib test suites pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] CLI entry point parses all flags and returns valid JSON on stdout
- [ ] Error paths return structured error JSON with exit code 1 and do NOT write invalid state

**Phase Doc**: `phases/SCRIPT-SIMPLIFY-AGENTS-PHASE-01-CORE-PIPELINE-ENGINE.md` *(created at execution time)*

---

### Phase 2: Agent & Skill Refactoring

**Goal**: Update all agent definitions, skills, and instruction files to match the new pipeline architecture — removing state-write responsibilities from the Tactical Planner, rewriting the Orchestrator for event-driven operation, and aligning skills with the new control flow.

**Scope**:
- Rewrite Orchestrator agent definition — event-driven loop, ~18-action routing table, event signaling reference, recovery instructions, remove `STATUS.md` — refs: [FR-12](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements), [Architecture: Agent Definition Changes](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md#agent-definition-changes)
- Rewrite Tactical Planner agent definition — 3 modes (phase plan, task handoff, phase report), remove `execute` tool, remove state-write/triage prose, remove `STATUS.md` — refs: [FR-11, FR-26](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update Reviewer agent — `review-code` → `review-task` reference — refs: [FR-20, FR-21](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update all 7 other agent definitions — remove "only the Tactical Planner does that" / `STATUS.md` language — refs: [FR-22](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Rename `review-code` skill to `review-task` (directory, frontmatter, SKILL.md) — refs: [FR-20](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Delete `triage-report` skill directory — refs: [FR-13](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update `create-task-handoff` skill — add "Prior Context" section for corrective handling — refs: [FR-14](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update `create-phase-plan` skill — add "Prior Context" section for corrective handling — refs: [FR-15](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update `copilot-instructions.md` — pipeline script as state authority, remove `STATUS.md` — refs: [FR-23](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update `project-docs.instructions.md` — `state.json` ownership to pipeline script, remove `STATUS.md` row — refs: [FR-24](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)

**Dependencies**: Phase 1 (pipeline script must exist for agent definitions to reference it)

**Estimated tasks**: 6–8

**Exit Criteria**:
- [ ] Orchestrator agent definition has ~18-action routing table and event-driven loop
- [ ] Tactical Planner has exactly 3 modes, no `execute` tool, no state-write instructions
- [ ] No agent definition mentions `STATUS.md`
- [ ] No agent definition contains "only the Tactical Planner" sole-writer language for `state.json`
- [ ] `triage-report` skill directory does not exist
- [ ] `review-task` skill directory exists with updated SKILL.md; `review-code` directory does not exist
- [ ] `create-task-handoff` and `create-phase-plan` skills contain "Prior Context" sections
- [ ] `copilot-instructions.md` references pipeline script as state authority
- [ ] `project-docs.instructions.md` reflects updated ownership and has no `STATUS.md` row

**Phase Doc**: `phases/SCRIPT-SIMPLIFY-AGENTS-PHASE-02-AGENT-SKILL-REFACTORING.md` *(created at execution time)*

---

### Phase 3: Cleanup & Deletion

**Goal**: Remove all deprecated files (standalone scripts, their tests, prose shadow documents, `schemas/` directory) and update validation test suites to reflect the new file structure.

**Scope**:
- Delete standalone scripts: `next-action.js`, `triage.js`, `validate-state.js` — refs: [FR-27](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Delete standalone script tests: `next-action.test.js`, `triage.test.js`, `validate-state.test.js`
- Delete `state-json-schema.md` and `.github/orchestration/schemas/` directory — refs: [FR-16, FR-18](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Delete `state-management.instructions.md` — refs: [FR-17](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements)
- Update `cross-refs.test.js` — skill rename, file deletions
- Update `agents.test.js` — agent definition changes
- Update `skills.test.js` — triage deleted, `review-code` → `review-task`
- Update `instructions.test.js` — `state-management.instructions.md` deleted
- Update `structure.test.js` — directory structure changes (`schemas/` removed, new pipeline files)

**Dependencies**: Phase 2 (agent/skill updates must be complete so that validation tests can verify the new state)

**Estimated tasks**: 4–6

**Exit Criteria**:
- [ ] `next-action.js`, `triage.js`, `validate-state.js` do not exist
- [ ] `next-action.test.js`, `triage.test.js`, `validate-state.test.js` do not exist
- [ ] `state-json-schema.md` does not exist; `.github/orchestration/schemas/` directory does not exist
- [ ] `state-management.instructions.md` does not exist
- [ ] All validation test suites pass: `agents.test.js`, `cross-refs.test.js`, `skills.test.js`, `instructions.test.js`, `structure.test.js`
- [ ] No dangling cross-references to deleted files anywhere in the system
- [ ] All 4 preserved lib test suites still pass unmodified

**Phase Doc**: `phases/SCRIPT-SIMPLIFY-AGENTS-PHASE-03-CLEANUP-DELETION.md` *(created at execution time)*

---

### Phase 4: Documentation Overhaul

**Goal**: Comprehensively update all user-facing and system-facing documentation to accurately reflect the post-refactor architecture.

**Scope**:
- Major rewrite: `docs/scripts.md` — pipeline.js replaces 3 scripts, new CLI interface, reduced action vocabulary, event vocabulary — refs: [FR-25](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-PRD.md#functional-requirements), [Research: Section 7](.github/projects/SCRIPT-SIMPLIFY-AGENTS/SCRIPT-SIMPLIFY-AGENTS-RESEARCH-FINDINGS.md#7-documentation)
- Major rewrite: `docs/pipeline.md` — event-driven loop, pipeline script flow, triage_attempts lifecycle
- Update: `docs/agents.md` — Tactical Planner 3 modes, Orchestrator event loop, Reviewer skill rename
- Update: `docs/skills.md` — triage deleted, `review-task`, skill Prior Context additions
- Update: `docs/project-structure.md` — `schemas/` removed, `STATUS.md` removed, new pipeline files added
- Update: `docs/configuration.md` — state-write authority change
- Update: `docs/validation.md` — remove stale references to deleted files
- Update: `docs/getting-started.md` — remove `STATUS.md` references, update workflow descriptions
- Review: `docs/dashboard.md` — verify no `STATUS.md` dependency (expected: none)
- Update: `README.md` — pipeline description, agent roles, key rules, project structure overview

**Dependencies**: Phase 3 (all code and structural changes must be complete before documenting the final state)

**Estimated tasks**: 5–7

**Exit Criteria**:
- [ ] No documentation file references `STATUS.md`, `state-json-schema.md`, `state-management.instructions.md`, `next-action.js`, `triage.js`, `validate-state.js`, or `triage-report` skill
- [ ] `docs/scripts.md` documents the `pipeline.js` CLI interface, event vocabulary, and reduced action vocabulary
- [ ] `docs/pipeline.md` describes the event-driven loop and pipeline script internal flow
- [ ] `docs/agents.md` accurately describes the Orchestrator event loop and Tactical Planner 3-mode structure
- [ ] `README.md` reflects the new architecture, agent roles, and key rules
- [ ] All documentation validation tests pass

**Phase Doc**: `phases/SCRIPT-SIMPLIFY-AGENTS-PHASE-04-DOCUMENTATION-OVERHAUL.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml`)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Max consecutive review rejections**: 3 (from `orchestration.yml`)
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: After planning (hard default), execution mode `ask`, after final review (hard default)
- **Error handling**: Critical errors (build failure, security vulnerability, architectural violation, data loss risk) → halt; minor errors (test failure, lint error, review suggestion, missing coverage, style violation) → retry

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| 1 | Pipeline script mutation logic has bugs that the current Tactical Planner happens to get right in some cases | High | Comprehensive unit tests for every mutation function; integration tests covering all 19 event types against the full pipeline engine; existing `state-validator.js` catches invalid transitions at runtime | Coder + Reviewer |
| 2 | Removing prose shadow documents causes agents to lose context they implicitly relied on | Medium | Research confirms no agent loads `state-json-schema.md` at runtime; `state-management.instructions.md` targets files no agent writes post-refactor; planning-relevant triage guidance is explicitly folded into `create-task-handoff` and `create-phase-plan` skills | Architect + Tactical Planner |
| 3 | Orchestrator agent definition rewrite breaks the interaction loop for edge cases | Medium | The event-driven loop is simpler (fewer action paths) than the current loop; `triage_attempts` persistence eliminates the compaction vulnerability; integration testing against all ~18 action paths | Coder + Reviewer |
| 4 | Documentation update scope is underestimated — 11+ files need changes with subtle cross-references | Medium | Research findings provide a complete inventory of affected files with specific changes needed per file; documentation is a dedicated phase (Phase 4), not appended to implementation tasks; validation tests catch dangling cross-references | Tactical Planner |
| 5 | Eliminating `STATUS.md` removes a human-readable artifact some users relied on | Low | Dashboard provides richer status information; `state.json` is the single source of truth; Orchestrator can present status by reading `state.json` directly | Human gate review |
| 6 | Renaming `review-code` to `review-task` misses cross-references | Low | Research findings enumerate all known references; `cross-refs.test.js` validates cross-reference integrity; grep sweep during implementation catches any others | Coder + Reviewer |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| State mutation errors per pipeline run | 0 | Pipeline is deterministic; full test suite with no state validation failures |
| Tactical Planner state-write references | 0 | Grep agent definition — no `state.json` write operations, `STATUS.md`, triage invocation, or Mode 1/2 content |
| Orchestrator action vocabulary | ≤ 18 actions | Count distinct action values in the Orchestrator's routing table |
| Prose shadow documents remaining | 0 | Verify `state-json-schema.md`, `state-management.instructions.md`, and `triage-report/` directory do not exist |
| Existing lib test suites | 100% pass, 0 modifications | Run all 4 preserved test files — all pass with zero changes to test code |
| New pipeline script test coverage | All event types covered | Every mutation function has at least one unit test; pipeline engine has integration tests for all 19 events |
| Documentation accuracy | All affected files updated | Every file in the Research Findings Section 7 inventory has been updated; no references to deleted artifacts |
| `triage_attempts` persistence | Survives simulated compaction | Test verifies `triage_attempts` is preserved and correctly incremented/reset across pipeline calls |
