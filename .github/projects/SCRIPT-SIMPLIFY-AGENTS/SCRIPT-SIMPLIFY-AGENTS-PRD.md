---
project: "SCRIPT-SIMPLIFY-AGENTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-12T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Product Requirements

## Problem Statement

The orchestration system's Tactical Planner agent violates single responsibility by owning both judgment-requiring planning work and mechanical state management. The state-management half — mutating JSON fields, enforcing transitions, running triage — is deterministic logic that an LLM re-derives from prose instructions each cycle, producing incorrect mutations (premature completions, skipped steps, wrong field values). Meanwhile, the Orchestrator delegates all state control to the Tactical Planner, then re-reads state and re-runs the resolver to verify, creating indirection that causes skipped steps and inconsistent pipeline progression. Three prose shadow documents (`state-json-schema.md`, `state-management.instructions.md`, and the `triage-report` skill) duplicate contracts already defined more completely in code, creating dual authority where agents follow stale prose instead of the canonical, tested implementations.

## Goals

- **G-1**: Eliminate LLM-originated state mutation errors by moving all state writes, validation, triage, and transition logic into a single deterministic script
- **G-2**: Reduce the Tactical Planner to a pure planning agent (phase plans, task handoffs, phase reports) with zero state-write responsibilities
- **G-3**: Simplify the Orchestrator to a thin event-driven controller that signals events and follows script-returned instructions, reducing its action vocabulary from ~35 to ~18
- **G-4**: Eliminate dual-authority documentation by removing prose shadow documents whose content is already defined and enforced in code
- **G-5**: Preserve all existing pure logic modules (resolver, triage engine, state validator, constants) and their test suites unchanged
- **G-6**: Persist `triage_attempts` in `state.json` so triage retry logic survives context compaction

## Non-Goals

- Changes to the Coder, Reviewer, Research, Product Manager, UX Designer, Architect, or Brainstormer agent behavior
- Changes to planning document formats (PRD, Design, Architecture, Master Plan templates)
- Changes to report/review document formats (task reports, code reviews, phase reports, phase reviews)
- Schema changes to `state.json` beyond the `triage_attempts` addition
- CI/CD integration or GitHub Actions
- Adding npm dependencies
- Git automation
- Dashboard/UI changes
- Broader skill hardening (task report self-assessment, test runner determinism, review verification protocols)

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Orchestrator agent | signal a completion event and receive the next action in a single script call | I don't need to coordinate multiple scripts, triage, and state writes across separate steps | P0 |
| 2 | Orchestrator agent | rely on a reduced action vocabulary (~18 external actions) | my agent definition is shorter, less error-prone, and more resilient to context compaction | P0 |
| 3 | Tactical Planner agent | focus exclusively on planning (phase plans, task handoffs, phase reports) | I never perform mechanical state mutations that I'm unreliable at | P0 |
| 4 | Tactical Planner agent | read computed triage outcomes (`review_action`, `phase_review_action`) directly from `state.json` | I can create corrective handoffs without re-deriving triage decisions | P0 |
| 5 | Orchestrator agent | have `triage_attempts` persisted in `state.json` | triage retry logic survives context compaction and is fully deterministic | P0 |
| 6 | system maintainer | have a single source of truth for state transitions, validation, and triage logic in code | I don't have to reconcile prose documents with code implementations | P1 |
| 7 | system maintainer | have project initialization handled by a deterministic script | initial `state.json` always matches the schema exactly, without LLM-generated JSON | P1 |
| 8 | system maintainer | have the `review-code` skill renamed to `review-task` | the skill name reflects its actual scope (task-level verification, not just code quality) | P1 |
| 9 | system maintainer | have up-to-date documentation reflecting the new architecture | the README, docs, agent definitions, and instruction files accurately describe the system that exists | P1 |
| 10 | Orchestrator agent | no longer read or reference `STATUS.md` | I rely on `state.json` as the single state representation without maintaining a redundant prose summary | P1 |
| 11 | developer extending the system | find each event's mutation logic in a single small named function | I can understand and modify pipeline behavior without reading a monolithic script | P2 |
| 12 | developer extending the system | run the pipeline engine in tests with mocked I/O | I can integration-test state transitions without touching the filesystem | P2 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The system shall provide a unified pipeline script that accepts an event name and context, and returns a JSON result specifying the next action for the Orchestrator | P0 | Replaces the multi-script loop (`next-action.js` → agent → Tactical Planner → `next-action.js`) |
| FR-2 | The pipeline script shall handle cold-start resolution (no prior event) when `state.json` exists, replacing the standalone `next-action.js` | P0 | Invoked as a `start` event |
| FR-3 | The pipeline script shall handle project initialization (directory creation, `state.json` scaffolding) when no `state.json` exists, replacing Tactical Planner Mode 1 | P0 | Reads `orchestration.yml` for limits and gate defaults |
| FR-4 | The pipeline script shall apply state mutations internally for each event type (e.g., `task_completed`, `code_review_completed`, `phase_plan_created`), replacing Tactical Planner Mode 2 | P0 | One deterministic mutation per event type |
| FR-5 | The pipeline script shall validate state transitions internally after each mutation, replacing standalone `validate-state.js` calls | P0 | Uses existing `state-validator.js` (unchanged) |
| FR-6 | The pipeline script shall execute triage internally when triggered by specific events, replacing standalone `triage.js` and Tactical Planner triage steps | P0 | Uses existing `triage-engine.js` (unchanged) |
| FR-7 | The pipeline script shall resolve the next action after mutation/triage/validation, replacing standalone `next-action.js` | P0 | Uses existing `resolver.js` (unchanged) |
| FR-8 | The pipeline script shall read task report frontmatter directly (status, deviations, severity) when handling task-completion events | P0 | Orchestrator passes only the report path as event context |
| FR-9 | The pipeline script shall manage `triage_attempts` as a persisted field in `state.json`, incrementing on triage events and resetting on advance events | P0 | Replaces runtime-local counter in Orchestrator |
| FR-10 | The pipeline script shall be deterministic: the same event + same state shall always produce the same result | P0 | — |
| FR-11 | The Tactical Planner agent definition shall be updated to remove all state mutation responsibilities (Modes 1 and 2), triage invocation, and `STATUS.md` references | P0 | Retains Modes 3, 4, 5 (phase plan, task handoff, phase report) |
| FR-12 | The Orchestrator agent definition shall be rewritten to use an event-driven loop: call pipeline script → parse result → act (spawn agent / human gate / display) → signal completion → repeat | P0 | Action table reduced from ~35 to ~18 external-only actions |
| FR-13 | The `triage-report` skill shall be deleted | P0 | Planning-relevant guidance moves to `create-task-handoff` and `create-phase-plan` skills |
| FR-14 | The `create-task-handoff` skill shall gain a "Prior Context" section describing how to read `review_action` from `state.json` and, if corrective, extract issues from the code review | P0 | Replaces triage skill guidance for task-level corrective handling |
| FR-15 | The `create-phase-plan` skill shall gain a "Prior Context" section describing how to read `phase_review_action` from `state.json` and, if corrective, extract cross-task issues from the phase review | P0 | Replaces triage skill guidance for phase-level corrective handling |
| FR-16 | `state-json-schema.md` shall be deleted | P1 | Content is covered by `constants.js`, `state-validator.js`, and pipeline engine |
| FR-17 | `state-management.instructions.md` shall be deleted | P1 | All 6 sections become wrong or redundant post-refactor |
| FR-18 | The `.github/orchestration/schemas/` directory shall be removed after schema deletion | P1 | Directory becomes empty |
| FR-19 | `STATUS.md` shall be eliminated from the system — no agent generates it, no agent reads it | P1 | Dashboard reads `state.json` directly; Orchestrator uses `state.json` for status |
| FR-20 | The `review-code` skill shall be renamed to `review-task`, including directory, frontmatter, and all cross-references | P1 | Reflects actual scope: task-level verification, not just code quality |
| FR-21 | The Reviewer agent definition shall be updated to reference `review-task` instead of `review-code` | P1 | — |
| FR-22 | All 9 agent definitions shall be updated to remove `STATUS.md` references and outdated Tactical Planner sole-writer language | P1 | 7 non-Orchestrator/non-Planner agents have "only the Tactical Planner does that" language |
| FR-23 | `copilot-instructions.md` shall be updated to reflect the new state-write authority (pipeline script) and remove `STATUS.md` references | P1 | Workspace-level instructions loaded for every agent session |
| FR-24 | `project-docs.instructions.md` shall be updated: `state.json` ownership changes, `STATUS.md` row removed | P1 | — |
| FR-25 | `README.md` and all `docs/` files shall be updated to reflect the new architecture | P1 | Covers pipeline description, script interfaces, agent descriptions, skill catalog, project structure |
| FR-26 | The Tactical Planner agent definition shall remove the `execute` tool from its tool list | P1 | No longer calls scripts; retains `read`, `search`, `edit`, `todo` |
| FR-27 | Standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) shall be removed with no backward-compatibility wrappers | P1 | Full replacement, no thin wrappers |
| FR-28 | The pipeline script shall be structured as a composition of focused modules: entry point, pipeline engine, mutations module, and state I/O module | P2 | Avoids monolithic script; each module independently testable |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Compatibility | All new code shall use Node.js built-ins only — zero external npm dependencies |
| NFR-2 | Compatibility | The system shall run on Node.js 18+ (existing requirement for `node:test`) |
| NFR-3 | Correctness | The 4 existing lib module test suites (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js` — 3,593 lines) shall continue to pass unmodified |
| NFR-4 | Testability | The pipeline engine shall be testable with mocked I/O (no filesystem access required in unit/integration tests) |
| NFR-5 | Testability | Each mutation function shall be independently unit-testable |
| NFR-6 | Maintainability | Adding a new event type shall require only adding a mutation function and pipeline engine wiring — no changes to existing mutation functions |
| NFR-7 | Determinism | The pipeline script shall produce identical output given identical input (event + state), with no reliance on runtime counters, timestamps from ambient context, or random values, except for `project.updated` timestamps |
| NFR-8 | Consistency | The pipeline script shall follow existing codebase conventions: CommonJS modules, `'use strict'`, shebang line on CLI entry point, `require.main === module` guard, GNU long-option CLI style, stdout for JSON data, stderr for diagnostics, exit code 0/1 |
| NFR-9 | Reliability | The Orchestrator shall be able to recover from context compaction by re-calling the pipeline script — all state is in `state.json`, not in agent memory |
| NFR-10 | Documentation | All user-facing (`README.md`, `docs/`) and system-facing (agent definitions, instruction files, skill files) documentation shall accurately reflect the post-refactor architecture |
| NFR-11 | Separation of concerns | No agent shall directly write `state.json` — all state mutations flow through the pipeline script |

## Assumptions

- The existing 4 lib modules (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) are functionally correct and complete — they are composed, not modified
- The `state.json` schema is stable and only needs one addition (`triage_attempts`) — no other structural changes are needed
- The UI dashboard already reads `state.json` directly and has no dependency on `STATUS.md`
- The `triage-engine.js` dependency injection pattern (`readDocument` callback) is sufficient for the pipeline engine's needs
- The `validate-orchestration` shared utilities (`fs-helpers`, `yaml-parser`, `frontmatter`) are stable and suitable for reuse by the pipeline script
- The ~18 remaining Orchestrator actions are sufficient to cover all agent-spawn, human-gate, and display scenarios

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Pipeline script mutation logic has bugs that current Tactical Planner happens to get right in some cases | High | Comprehensive test suite for every mutation function; integration tests covering all event types against the full pipeline engine; existing validator catches invalid transitions |
| 2 | Removing prose shadow documents causes agents to lose context they were implicitly relying on | Medium | Research findings confirm no agent imports or loads `state-json-schema.md` at runtime; `state-management.instructions.md` targets files no agent writes post-refactor; planning-relevant triage guidance is explicitly folded into `create-task-handoff` and `create-phase-plan` skills |
| 3 | Orchestrator agent definition rewrite breaks the interaction loop for edge cases not covered in testing | Medium | The event-driven loop is simpler (fewer action paths) than the current loop; `triage_attempts` persistence eliminates the compaction vulnerability; integration testing against all ~18 action paths |
| 4 | Documentation update scope is underestimated — 11+ files need changes and prose may have subtle cross-references | Medium | Research findings provide a complete inventory of affected files with specific changes needed; documentation should be a dedicated phase, not appended to implementation tasks |
| 5 | Eliminating `STATUS.md` removes a human-readable artifact that some users relied on outside the dashboard | Low | The dashboard provides richer status information; `state.json` is the single source of truth; users can query the Orchestrator for status which reads `state.json` directly |
| 6 | Renaming `review-code` to `review-task` misses cross-references in documents or tests | Low | Research findings enumerate all known references (reviewer agent, docs/skills.md, docs/agents.md, cross-refs.test.js); a grep-based sweep during implementation catches any others |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| State mutation errors per pipeline run | 0 | Pipeline script is deterministic; same input always produces same output. Verify by running the full test suite with no state validation failures |
| Tactical Planner state-write references | 0 | Grep the Tactical Planner agent definition for `state.json` write operations, `STATUS.md`, triage invocation, and Mode 1/2 content — count must be zero |
| Orchestrator action vocabulary | ≤ 18 actions | Count distinct action values in the Orchestrator agent definition's action table |
| Prose shadow documents remaining | 0 | Verify `state-json-schema.md`, `state-management.instructions.md`, and `triage-report` skill directory do not exist |
| Existing lib test suites | 100% pass, 0 modifications | Run `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js` — all must pass with zero changes to test files |
| New pipeline script test coverage | All event types covered | Every mutation function in `mutations.js` has at least one unit test; pipeline engine has integration tests for all event types |
| Documentation accuracy | All affected files updated | Every file listed in research findings Section 7 has been reviewed and updated to reflect the post-refactor architecture |
| `triage_attempts` persistence | Survives simulated compaction | Test that `triage_attempts` value in `state.json` is preserved and correctly incremented/reset across pipeline calls |
