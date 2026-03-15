---
project: "STATE-TRANSITION-SCRIPTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Product Requirements

## Problem Statement

The orchestration system's execution phase relies on LLMs re-deriving routing and triage decisions from natural language markdown on every invocation. The Orchestrator's routing logic and the Tactical Planner's triage decision tables are encoded in prose — an LLM re-interprets them from scratch each time, producing inconsistent results for identical inputs. The same `state.json` can yield different routing decisions across runs, triage rows can be mismatched or skipped, and write-ordering rules (e.g., verdict before handoff) are unenforced. This non-determinism is the single largest reliability risk in the execution pipeline.

## Goals

- **Deterministic routing**: The same `state.json` always produces the same next-action — zero variance across invocations
- **Deterministic triage**: The same task report + review verdict always produces the same triage verdict/action — no row mismatches, no skipped rows
- **Enforced state invariants**: Every `state.json` write is validated against documented invariants before it is committed — illegal transitions are caught immediately, not downstream
- **Testable logic**: All routing, triage, and validation logic is covered by automated tests that run without an LLM
- **Narrowed LLM role**: Agents delegate mechanical decision-making to scripts and focus on judgment-requiring work (coding, reviewing, designing)

## Non-Goals

- **Full execution driver**: A script that calls LLM agents as subprocesses (the "Option D" full automation path) is out of scope — agents still orchestrate themselves via Copilot Chat
- **Declarative YAML rules**: A generic rule-interpreter consuming YAML/JSON decision tables was considered and deferred — hardcoded JS is simpler and sufficient
- **CI/CD integration**: These scripts run in the VS Code terminal only; no pipeline runner, no GitHub Actions integration at this stage
- **Changes to planning agents**: Research, Product Manager, UX Designer, Architect, and Brainstormer agents are unaffected
- **Changes to Coder or Reviewer agents**: These agents' inputs/outputs do not change
- **Git automation**: No commit, branch, or PR scripting
- **npm dependencies**: No external packages; scripts use Node.js built-ins only

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Orchestrator agent | call a script that reads `state.json` and returns the exact next action as JSON | I no longer re-derive routing from prose on every invocation, eliminating routing variance | P0 |
| 2 | Tactical Planner agent | call a script that reads `state.json` and relevant review documents, then writes the triage verdict/action to `state.json` | I no longer interpret 11-row and 5-row decision tables in natural language, eliminating triage inconsistency | P0 |
| 3 | Tactical Planner agent | call a validator script before every `state.json` write that checks the proposed state against all documented invariants | I catch illegal transitions immediately rather than silently corrupting downstream routing | P0 |
| 4 | Developer maintaining the orchestration system | run a test suite for routing, triage, and validation logic using `node:test` | I can verify correctness of decision logic without running the full agent pipeline | P0 |
| 5 | Orchestrator agent | pattern-match on a closed enum of action strings returned by the resolver | I can use simple, unambiguous branching instead of interpreting free-form prose logic | P1 |
| 6 | Developer maintaining the orchestration system | import shared constants (enums for tiers, statuses, verdicts, actions) from a single module | all scripts and tests use identical values, and I update enums in one place | P1 |
| 7 | Human operator reading agent docs | see the triage-report skill still documenting the decision tables in markdown | I understand what the triage logic does, even though the script is now the authoritative executor | P1 |
| 8 | Tactical Planner agent | receive a structured error message from the validator when a write is invalid | I can report the exact invariant violation in `errors.active_blockers` and halt cleanly | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | **Next-Action Resolver script** — A JavaScript CLI script that reads `state.json` (and optionally `orchestration.yml` for human gate mode) and emits a single JSON object to stdout identifying the exact next action the Orchestrator should take. The output must be one of a closed set of action strings (see NextAction vocabulary in Research Findings §1). The script must be a pure function of its inputs: same state always produces same output. | P0 | Replaces the Orchestrator's prose decision tree (Steps 2a–2f). ~30 distinct action values. |
| FR-2 | **Triage Executor script** — A JavaScript CLI script that reads `state.json` and relevant document paths (task report, code review, phase report, phase review), evaluates the appropriate decision table (task-level: 11 rows; phase-level: 5 rows), and writes the resolved `review_verdict`/`review_action` (or `phase_review_verdict`/`phase_review_action`) directly to `state.json`. The script must enforce write ordering (verdict/action before handoff) and immutability (verdict/action for task N not overwritten by triage of task M). | P0 | Replaces the Tactical Planner's inline triage in Mode 3 and Mode 4. Row 10 has branching logic (retry budget × severity). |
| FR-3 | **State Transition Validator script** — A JavaScript CLI script that takes both the current `state.json` and a proposed updated `state.json` (or a patch/diff), validates that the transition is legal against all documented invariants (V1–V15 in Research Findings §3), and emits a JSON pass/fail result to stdout with structured error messages listing each violated invariant. | P0 | Pre-write check called by the Tactical Planner before saving `state.json`. |
| FR-4 | **Shared constants module** — A JavaScript module exporting named enums for all state values: pipeline tiers, planning step statuses, task statuses, phase statuses, review verdicts, review actions, phase review actions, severity levels, and the NextAction vocabulary. All three scripts and their tests must import from this single module. | P1 | Prevents string-literal drift between scripts. |
| FR-5 | **Orchestrator agent rewrite** — The Orchestrator agent definition must be updated to replace its prose decision tree with a workflow that: (1) calls the Next-Action Resolver script via the terminal, (2) parses the JSON output, (3) pattern-matches on the action string to determine which agent/skill to spawn. The agent must still manage a local `triage_attempts` counter (not persisted to state) and halt if triage re-invocation exceeds one attempt. | P0 | The Orchestrator never writes `state.json` — that rule does not change. |
| FR-6 | **Tactical Planner agent rewrite** — The Tactical Planner agent definition must be updated to: (a) in Mode 3, replace "execute triage-report skill (phase-level)" with a call to the Triage Executor script; (b) in Mode 4, replace "execute triage-report skill (task-level)" with a call to the Triage Executor script; (c) in all modes that write `state.json`, add a call to the State Transition Validator script before committing the write; (d) on validator failure, record the error in `errors.active_blockers` and halt. | P0 | The Tactical Planner remains the sole writer of `state.json` — scripts write through it or are called by it. |
| FR-7 | **Triage-report skill update** — The `triage-report/SKILL.md` must be updated to note that the decision tables are now authoritatively executed by the Triage Executor script. The markdown decision tables remain as human-readable documentation. The skill is demoted from "execution authority" to "documentation-only reference". | P1 | The script is the single source of truth for triage logic; the markdown describes it. |
| FR-8 | **State-management instructions update** — The `state-management.instructions.md` must be updated to add a requirement that the Tactical Planner call the State Transition Validator script before every `state.json` write. The instructions must document the validator's CLI interface and expected pass/fail output. | P1 | Ensures all agents receiving these instructions know validation is mandatory. |
| FR-9 | **Comprehensive test suite** — All three scripts must have test files using `node:test` (`describe`/`it`/`beforeEach` from `require('node:test')`, `require('node:assert')`). Tests must cover: (a) every NextAction resolution path for the resolver; (b) every row of both decision tables (11 task-level + 5 phase-level) for the triage executor; (c) every invariant (V1–V15) for the validator, including both valid and invalid transition cases. Tests must be runnable with `node tests/<file>.test.js` and must not require an LLM or external service. | P0 | Core logic must be exported via `module.exports` for direct `require()` in tests (see NFR-4). |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Dependencies | Zero external dependencies — all scripts use only Node.js built-ins (`fs`, `path`, `os`, `assert`) and existing workspace utilities (`fs-helpers`, `frontmatter`, `yaml-parser`). No npm packages. |
| NFR-2 | Output format | All three scripts emit structured JSON to stdout for machine parsing. Diagnostic messages and errors go to stderr. The Orchestrator and Tactical Planner parse stdout with `JSON.parse()`. |
| NFR-3 | CLI conventions | All scripts follow the existing CLI pattern: shebang (`#!/usr/bin/env node`), `'use strict'`, CommonJS (`require`/`module.exports`), `parseArgs()` for flag parsing, async `main()` with `.catch()` safety net, `if (require.main === module)` guard, exit codes `0` (success) / `1` (failure or validation error). |
| NFR-4 | Testability | Each script exports its core logic functions (not just the CLI `main()`) via `module.exports`, enabling direct `require()` in test files without subprocess spawning. |
| NFR-5 | Determinism | The Next-Action Resolver and Triage Executor must be pure functions of their inputs. Given identical `state.json` (and identical documents for triage), the output must be identical across invocations — no randomness, no time-dependence, no ambient state. |
| NFR-6 | Error handling | Scripts never throw unhandled exceptions. All errors are caught and returned as structured JSON to stdout (for expected conditions like validation failures) or stderr (for unexpected crashes). Functions follow the existing "return null/fail-result, never throw" convention. |
| NFR-7 | Safety — no infinite loops | The Orchestrator's `triage_attempts` counter (runtime-local, not persisted) limits triage re-invocations to one attempt. If a triage invariant violation persists after one re-spawn, the pipeline halts. The resolver script does not track this counter — the Orchestrator agent manages it. |
| NFR-8 | Compatibility | Scripts must run on Node.js 18+ (minimum for stable `node:test` support). No Node.js version-specific APIs beyond what the existing codebase already uses. |
| NFR-9 | Maintainability | Decision table logic is hardcoded as explicit, readable JavaScript objects/arrays with named functions for complex rows (e.g., `checkRetryBudget()` for Row 10). No external rule files, no generic interpreters. |
| NFR-10 | Documentation | JSDoc `@param` and `@returns` annotations on all exported functions, consistent with the existing codebase style. |

## Assumptions

- The `state.json` schema and field structure remain stable throughout this project — no concurrent schema migrations
- `task.severity` in `state.json` already contains the classified severity (`"minor"` or `"critical"`) by the time triage runs — the triage script does not need to re-classify from `orchestration.yml` severity lists
- The VS Code terminal tool (`execute`) can run Node.js scripts and capture their stdout — agents can parse the output
- `triage_attempts` remains a runtime-local counter in the Orchestrator, not persisted in `state.json` — this is a design choice, not a constraint
- Limits (`max_phases`, `max_tasks_per_phase`, `max_retries_per_task`) are copied from `orchestration.yml` into `state.json → limits` at project initialization and can be read from `state.json` alone
- Existing workspace utilities (`fs-helpers.js`, `frontmatter.js`, `yaml-parser.js`) are stable and can be imported by the new scripts without modification

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | The Orchestrator's routing decision tree has ~30 branches; encoding all of them correctly in one pass is error-prone | High | Comprehensive test suite (FR-9) covers every resolution path; incremental implementation by tier (planning → execution → review) |
| 2 | Triage Row 10's branching logic (retry budget × severity) requires cross-field reasoning that may have undocumented edge cases | Med | Explicit test cases for all Row 10 combinations (retry at max, retry below max, severity minor, severity critical, severity null) |
| 3 | Agent prose updates (FR-5, FR-6) may be inconsistently applied — the agent may still partially derive routing from prose rather than fully delegating to the script | High | The Orchestrator rewrite must remove all inline routing conditions, not just add script calls alongside them; Phase Review validates this |
| 4 | Validator invariant V14 (write ordering) and V15 (immutability) require comparing before/after state, which is more complex than single-state validation | Med | Design the validator to accept both current and proposed state as inputs; test write-ordering violations explicitly |
| 5 | `triage_attempts` being runtime-local means the Orchestrator agent must still implement this counter correctly in prose — a script cannot enforce it | Med | Clear prose instructions in the rewritten Orchestrator agent; the resolver output vocabulary includes `halt_triage_invariant` and `halt_phase_triage_invariant` as explicit actions |
| 6 | Phase-level triage action uses plural `"corrective_tasks_issued"` while task-level uses singular `"corrective_task_issued"` — this intentional distinction is easy to normalize incorrectly | Low | Shared constants module (FR-4) defines both values; tests assert the exact strings |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Routing determinism | 100% — identical `state.json` always produces identical next-action | Test suite runs all ~30 resolution paths; no flaky tests over 10 consecutive runs |
| Triage determinism | 100% — identical inputs always produce identical verdict/action | Test suite covers all 16 decision table rows (11 task + 5 phase); no flaky tests |
| Invariant coverage | All 15 documented invariants (V1–V15) validated by the validator script | Test suite has at least one positive and one negative test case per invariant |
| Test pass rate | 100% of tests pass on clean checkout with `node tests/<file>.test.js` | Manual verification during review phase |
| Agent prose clarity | Orchestrator and Tactical Planner call scripts and do not inline routing/triage logic | Code review confirms no residual prose-based decision trees remain in rewritten agents |
| Zero regressions | Existing `validate-orchestration` test suite continues to pass after all changes | Run full existing test suite before and after changes |
