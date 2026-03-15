---
project: "STATE-TRANSITION-SCRIPTS"
status: "draft"
author: "architect-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Master Plan

## Executive Summary

The orchestration system's execution phase relies on LLMs re-deriving routing and triage decisions from natural language markdown on every invocation, producing inconsistent results for identical inputs. This project introduces three deterministic JavaScript CLI scripts — a Next-Action Resolver, a Triage Executor, and a State Transition Validator — that encode the routing decision tree, triage decision tables, and state invariant checks currently living in agent prose. Agents call these scripts via the VS Code terminal and parse structured JSON output, narrowing the LLM's role to judgment-requiring work (coding, reviewing, designing) while making routing and state transitions fully deterministic and testable. The scripts are zero-dependency Node.js CommonJS modules following the existing `validate-orchestration` CLI pattern, with all shared enums in a single constants module to prevent string-literal drift.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [STATE-TRANSITION-SCRIPTS-BRAINSTORMING.md](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-BRAINSTORMING.md) | ✅ |
| Research Findings | [STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [STATE-TRANSITION-SCRIPTS-PRD.md](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md) | ✅ |
| Design | [STATE-TRANSITION-SCRIPTS-DESIGN.md](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-DESIGN.md) | ✅ |
| Architecture | [STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional and critical non-functional requirements that drive phasing. Full details in the [PRD](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md).

- **FR-1 — Next-Action Resolver script**: A JS CLI that reads `state.json` and emits a single JSON next-action from a closed ~30-value enum. Pure function: same state always produces same output.
- **FR-2 — Triage Executor script**: A JS CLI that reads `state.json` + review/report documents, evaluates the 11-row task-level or 5-row phase-level decision table, and writes verdict/action to `state.json` with enforced write ordering and immutability.
- **FR-3 — State Transition Validator script**: A JS CLI that validates a proposed `state.json` against all 15 documented invariants (V1–V15), emitting pass/fail with structured error messages.
- **FR-4 — Shared constants module**: Single source of truth for all enum values (tiers, statuses, verdicts, actions, NextAction vocabulary) imported by all scripts and tests.
- **FR-5 — Orchestrator agent rewrite**: Replace prose decision tree with script invocation + pattern-matching on the action enum. Manage runtime-local `triage_attempts` counter.
- **FR-6 — Tactical Planner agent rewrite**: Replace inline triage in Mode 3/4 with script calls. Add pre-write validation in all state-writing modes.
- **FR-9 — Comprehensive test suite**: `node:test`-based tests covering every resolution path (~30), every decision table row (16), and every invariant (V1–V15, positive + negative).
- **NFR-1 — Zero external dependencies**: All scripts use only Node.js built-ins and existing workspace utilities.

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation. Full details in the [Architecture](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md).

- **Four-layer architecture**: CLI entry points (I/O) → Domain logic (pure functions) → Shared constants → Infrastructure utilities (reused from validate-orchestration). Domain modules never import filesystem utilities directly.
- **Dependency injection for triage**: `executeTriage(state, level, readDocument)` accepts a callback for document reading, keeping the triage engine pure and testable without filesystem mocks.
- **Scripts live under `src/`**: Core pipeline infrastructure goes in `src/` (not `.github/skills/`) to signal runtime dependency. File structure: `src/{script}.js` + `src/lib/{module}.js`.
- **Reuse existing utilities by relative import**: `fs-helpers.js`, `frontmatter.js`, `yaml-parser.js` from `.github/skills/validate-orchestration/scripts/lib/utils/` — no duplication.
- **Constants as leaf module**: `src/lib/constants.js` has zero dependencies. All other modules import from it. All enums are `Object.freeze()`-d.
- **Triage engine does NOT write state.json directly**: The domain function returns the resolved verdict/action. The CLI entry point (`src/triage.js`) performs the actual `state.json` write using the atomic read-modify-write pattern.
- **Scripts read limits from `state.json`**: Limits are copied from `orchestration.yml` at project init; scripts consume `state.json → limits` to keep the interface clean (one input file). Only the resolver optionally reads `orchestration.yml` for `human_gate_mode`.
- **`triage_attempts` is runtime-local**: This counter lives only in the Orchestrator's context, not in `state.json`. The resolver script does not track it — the Orchestrator agent manages it in prose.

## Key Design Constraints (from Design)

Curated design decisions that affect implementation. Full details in the [Design](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-DESIGN.md).

- **JSON stdout / stderr separation**: All structured output goes to stdout via `JSON.stringify(result, null, 2)`. Diagnostics and crash messages go to stderr. Agents parse stdout exclusively with `JSON.parse()`.
- **Exit code semantics**: `0` = success (valid JSON on stdout), `1` = failure (structured error JSON on stdout for expected failures; diagnostic on stderr for crashes). Agents differentiate by attempting `JSON.parse(stdout)`.
- **Atomic write pattern**: `state.json` is always fully rewritten (`JSON.stringify` → `fs.writeFileSync`), never incrementally patched.
- **Immutability check before write**: Triage executor verifies target verdict/action fields are `null` before writing. Returns `IMMUTABILITY_VIOLATION` error if non-null.
- **CLI flag conventions**: GNU long-option style (`--state`, `--level`, `--current`, `--proposed`). Parsed by a `parseArgs()` function exported for testability.
- **Decision table: first-match wins**: Both task-level (11 rows) and phase-level (5 rows) tables evaluate sequentially; first matching row determines the output.
- **`REVIEW_ACTIONS` vs. `PHASE_REVIEW_ACTIONS`**: Task-level uses singular `corrective_task_issued`; phase-level uses plural `corrective_tasks_issued`. This distinction is intentional and must not be normalized.
- **Pre-write validation flow**: Tactical Planner writes proposed state to a temp file → calls validator with `--current` and `--proposed` → commits only on `valid: true` → halts and reports on `valid: false`.

## Phase Outline

### Phase 1: Foundation

**Goal**: Establish the shared constants module and the State Transition Validator — the two foundational pieces that have no dependencies on other scripts and are needed by everything else.

**Scope**:
- `src/lib/constants.js` — All frozen enums: `PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `PHASE_STATUSES`, `TASK_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`, `TRIAGE_LEVELS`, `NEXT_ACTIONS` — refs: [FR-4](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: Constants Interface](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md)
- `src/lib/state-validator.js` — Pure function `validateTransition(current, proposed)` checking all 15 invariants (V1–V15) — refs: [FR-3](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: State Validator Interfaces](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md), [Research: §3 Invariants](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md)
- `src/validate-state.js` — CLI entry point: parses `--current` and `--proposed` flags, reads both files, calls `validateTransition()`, emits JSON to stdout — refs: [Design: Script 3 CLI Interface](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-DESIGN.md)
- `tests/constants.test.js` — Enum completeness, no value overlap across enums, `Object.freeze()` verification
- `tests/state-validator.test.js` — All 15 invariants with at least one positive (valid) and one negative (violation) test case per invariant

**Exit Criteria**:
- [ ] `src/lib/constants.js` exports all 12 enum objects, all `Object.freeze()`-d
- [ ] `node tests/constants.test.js` passes — all enum values present, no cross-enum collisions where unintended
- [ ] `src/lib/state-validator.js` exports `validateTransition(current, proposed)` returning `ValidationResult`
- [ ] `node tests/state-validator.test.js` passes — 15+ positive and 15+ negative test cases (one per invariant minimum)
- [ ] `src/validate-state.js` runs end-to-end: `node src/validate-state.js --current <path> --proposed <path>` emits valid JSON and exits with code 0 (valid) or 1 (invalid)
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard

**Phase Doc**: `phases/STATE-TRANSITION-SCRIPTS-PHASE-01-FOUNDATION.md` *(created at execution time)*

---

### Phase 2: Next-Action Resolver

**Goal**: Implement the core routing logic that replaces the Orchestrator's prose decision tree with a deterministic pure function encoding ~30 distinct next-action resolutions.

**Scope**:
- `src/lib/resolver.js` — Pure function `resolveNextAction(state, config?)` implementing the full routing decision tree across all pipeline tiers (planning → execution → review → complete/halted) — refs: [FR-1](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: Resolver Interfaces](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md), [Research: §1 Routing Decision Tree](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md)
- `src/next-action.js` — CLI entry point: parses `--state` and optional `--config` flags, reads files, calls `resolveNextAction()`, emits JSON to stdout — refs: [Design: Script 1 CLI Interface](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-DESIGN.md)
- `tests/resolver.test.js` — Tests for every NextAction resolution path (~30 values). Imports `resolveNextAction` directly. Tests organized by tier: planning actions, execution task-lifecycle actions, execution phase-lifecycle actions, review actions, terminal actions — refs: [FR-9](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md)
- Imports `NEXT_ACTIONS`, `PIPELINE_TIERS`, and other enums from `src/lib/constants.js` (Phase 1 output)

**Exit Criteria**:
- [ ] `src/lib/resolver.js` exports `resolveNextAction(state, config?)` returning `NextActionResult`
- [ ] Every value in the `NEXT_ACTIONS` enum has at least one test case exercising the state conditions that produce it
- [ ] `node tests/resolver.test.js` passes — all ~30 resolution paths covered
- [ ] `src/next-action.js` runs end-to-end: `node src/next-action.js --state <path>` emits valid JSON with `action` and `context` fields
- [ ] Resolver is a pure function: no filesystem access, no `Date.now()`, no ambient state — identical inputs always produce identical output
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard

**Phase Doc**: `phases/STATE-TRANSITION-SCRIPTS-PHASE-02-RESOLVER.md` *(created at execution time)*

---

### Phase 3: Triage Executor

**Goal**: Implement the triage engine that replaces the Tactical Planner's inline execution of the 11-row task-level and 5-row phase-level decision tables with a deterministic, dependency-injected script.

**Scope**:
- `src/lib/triage-engine.js` — Pure function `executeTriage(state, level, readDocument)` implementing both decision tables. Named helper `checkRetryBudget(task, limits)` for Row 10 branching logic. Uses dependency-injected `readDocument` callback — refs: [FR-2](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: Triage Engine Interfaces](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md), [Research: §2 Decision Tables](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md)
- `src/triage.js` — CLI entry point: parses `--state`, `--level`, `--project-dir` flags. Wires real `readDocument` using `fs-helpers` + `frontmatter`. Writes resolved verdict/action to `state.json` using atomic write pattern. Emits result JSON to stdout — refs: [Design: Script 2 CLI Interface](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-DESIGN.md), [Architecture: Dependency Injection Design](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md)
- `tests/triage-engine.test.js` — Tests for all 16 decision table rows (11 task-level + 5 phase-level) plus error cases (`DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`). Uses mock `readDocument` callback — no filesystem access in tests — refs: [FR-9](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md)
- Imports `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS` from `src/lib/constants.js` (Phase 1 output)

**Exit Criteria**:
- [ ] `src/lib/triage-engine.js` exports `executeTriage(state, level, readDocument)` and `checkRetryBudget(task, limits)`
- [ ] All 11 task-level rows have at least one test case each
- [ ] All 5 phase-level rows have at least one test case each
- [ ] Row 10 branching logic (`checkRetryBudget`) has dedicated tests for: retry at max, retry below max, severity minor, severity critical, severity null
- [ ] Error cases tested: `DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`
- [ ] `node tests/triage-engine.test.js` passes — all 16+ rows and error cases covered
- [ ] `src/triage.js` runs end-to-end: reads `state.json`, reads documents, writes verdict/action to `state.json`, emits valid JSON to stdout
- [ ] Write ordering enforced: verdict/action written atomically in single JSON rewrite
- [ ] Immutability enforced: script refuses to overwrite non-null verdict/action fields
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard

**Phase Doc**: `phases/STATE-TRANSITION-SCRIPTS-PHASE-03-TRIAGE.md` *(created at execution time)*

---

### Phase 4: Agent & Skill Integration

**Goal**: Rewrite Orchestrator and Tactical Planner agent prose to call the scripts, update the triage-report skill to reference scripts as authoritative, update state-management instructions, and verify end-to-end consistency.

**Scope**:
- Orchestrator agent rewrite (`.github/agents/orchestrator.agent.md`) — Replace prose decision tree (Steps 2a–2f) with: (1) call `node src/next-action.js --state <path> --config <path>`, (2) parse JSON output, (3) pattern-match on `result.action` to spawn agents. Add `triage_attempts` counter management: increment on `triage_task`/`triage_phase`, reset on `advance_task`/`advance_phase`, halt if > 1 — refs: [FR-5](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: Agent Prose Changes](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md)
- Tactical Planner agent rewrite (`.github/agents/tactical-planner.agent.md`) — Mode 3: replace triage-report skill invocation with `node src/triage.js --state <path> --level phase --project-dir <dir>`. Mode 4: replace with `--level task`. All state-writing modes (2, 3, 4, 5): add pre-write validation via `node src/validate-state.js --current <path> --proposed <path>`. On validation failure: record errors in `errors.active_blockers`, halt — refs: [FR-6](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md), [Architecture: Agent Prose Changes](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md)
- Triage-report skill update (`.github/skills/triage-report/SKILL.md`) — Add notice that decision tables are now documentation-only; authoritative executor is `src/triage.js`. Tables remain for human readability — refs: [FR-7](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md)
- State-management instructions update (`.github/instructions/state-management.instructions.md`) — Add requirement for Tactical Planner to call `src/validate-state.js` before every `state.json` write. Document CLI interface and expected output format — refs: [FR-8](.github/projects/STATE-TRANSITION-SCRIPTS/STATE-TRANSITION-SCRIPTS-PRD.md)
- End-to-end validation: Run existing `validate-orchestration` test suite to confirm no regressions. Verify updated agents/skills reference correct script paths and CLI flags.

**Exit Criteria**:
- [ ] Orchestrator agent calls `node src/next-action.js` and pattern-matches on the action enum — no residual inline routing conditions remain
- [ ] Orchestrator agent documents `triage_attempts` counter logic: increment on triage actions, reset on advance actions, halt if > 1
- [ ] Tactical Planner agent calls `node src/triage.js --level task` in Mode 4 and `--level phase` in Mode 3 — no residual inline triage table interpretation
- [ ] Tactical Planner agent calls `node src/validate-state.js` before every `state.json` write in Modes 2, 3, 4, and 5
- [ ] Tactical Planner agent documents: on validation failure → record errors in `errors.active_blockers` → halt → do NOT commit write
- [ ] `triage-report/SKILL.md` includes notice that the triage script is the authoritative executor; tables are documentation-only
- [ ] `state-management.instructions.md` includes instruction to call validator before every write, with CLI interface and output format documented
- [ ] Existing `validate-orchestration` tests continue to pass (no regressions)
- [ ] No residual prose-based decision trees remain in rewritten agents (confirmed by review)

**Phase Doc**: `phases/STATE-TRANSITION-SCRIPTS-PHASE-04-INTEGRATION.md` *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml`)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: `after_planning: true` (hard default), `execution_mode: "ask"`, `after_final_review: true` (hard default)

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| 1 | Agent prose changes may be missed or incomplete — Orchestrator or Tactical Planner may still partially derive routing/triage from prose rather than fully delegating to scripts | High | Phase 4 exit criteria require that no residual inline routing or triage conditions remain. Phase Review validates this explicitly. Orchestrator rewrite must remove all inline routing conditions, not just add script calls alongside them. | Reviewer |
| 2 | Decision table rows may have edge cases not covered by tests — particularly Row 10's branching logic (retry budget × severity) and the interaction between `report_status`, `has_deviations`, and `review_doc` | Med | Explicit test cases for all Row 10 combinations (retry at max, retry below max, severity minor, severity critical, severity null). Phase 3 exit criteria require dedicated `checkRetryBudget` tests. | Coder + Reviewer |
| 3 | Utility imports may break if validate-orchestration paths change — scripts import `fs-helpers.js`, `frontmatter.js`, `yaml-parser.js` via relative paths from `src/` to `.github/skills/validate-orchestration/scripts/lib/utils/` | Med | Pin the import paths in the Architecture doc. Phase 1 tests verify imports resolve correctly. If paths change, the fix is a single-line path update per import. | Coder |
| 4 | `triage_attempts` runtime counter needs careful handling in Orchestrator rewrite — since the counter is not persisted in `state.json`, the Orchestrator prose must implement it correctly and consistently | Med | The resolver output vocabulary includes explicit `halt_triage_invariant` and `halt_phase_triage_invariant` actions. Orchestrator prose documents the counter logic clearly with increment/reset/halt rules. Phase 4 review validates the counter implementation. | Coder + Reviewer |
| 5 | The Orchestrator's routing decision tree has ~30 branches; encoding all correctly in one pass is error-prone | High | Comprehensive test suite covers every resolution path. Incremental implementation by tier (planning → execution → review). Each `NEXT_ACTIONS` enum value must have at least one corresponding test. | Coder + Reviewer |
| 6 | Phase-level triage uses plural `corrective_tasks_issued` while task-level uses singular `corrective_task_issued` — easy to normalize incorrectly | Low | Shared constants module defines both values as separate enums (`REVIEW_ACTIONS` vs. `PHASE_REVIEW_ACTIONS`). Tests assert exact strings. | Coder |
| 7 | Validator invariants V14 (write ordering) and V15 (immutability) require comparing before/after state, which is more complex than single-state validation | Med | Validator accepts both current and proposed state as inputs. Dedicated test cases for write-ordering violations and cross-task immutability violations. | Coder + Reviewer |
