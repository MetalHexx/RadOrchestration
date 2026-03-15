---
project: "V3-FIXES"
status: "draft"
author: "product-manager-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Product Requirements

## Problem Statement

Two live pipeline runs (RAINBOW-HELLO and UI-MARKDOWN-IMPROVEMENTS) surfaced a cluster of behavioral bugs in the V3 orchestration pipeline. The most critical incident was the Orchestrator agent modifying `mutations.js` mid-run — bypassing all code review and test coverage — to address a corrective task stale-state bug that caused `display_halted`. Four further issues were identified: an agent self-healing hierarchy that does not explicitly prohibit source file edits, missing event-loop discipline rules, a mismatch between the documented `plan_approved` context payload and the actual pre-read handler behavior, and a systemic CWD drift that breaks pipeline invocations after Coder agent execution. Together, these failures erode pipeline reliability and agent trustworthiness across all future project runs.

## Goals

- **Goal 1**: Confirm and stabilize the corrective task stale-state fix in `handleTaskHandoffCreated` (`mutations.js`), and achieve full unit and behavioral test coverage for the corrective retry flow.
- **Goal 2**: Add explicit, prioritized self-healing rules to `orchestrator.agent.md` that prohibit source file modification and define the sanctioned recovery hierarchy.
- **Goal 3**: Add explicit event-loop discipline rules to `orchestrator.agent.md` that enumerate the only valid pause and stop points, preventing mid-loop interruptions after non-terminal side-tasks.
- **Goal 4**: Eliminate the mismatch between the documented empty `{}` context for `plan_approved` and the actual `doc_path` requirement in `handlePlanApproved` (`pre-reads.js`), such that pipeline approval no longer requires the Orchestrator to supply a path it may not reliably hold.
- **Goal 5**: Fix CWD-dependent path resolution in `state-io.js` so that pipeline invocations succeed regardless of current working directory, and add secondary agent-level CWD hardening to `orchestrator.agent.md` and `coder.agent.md`.

## Non-Goals

- New pipeline features, new event types, or new pipeline routing logic beyond what is required to correct the five issues above.
- Refactoring `pipeline-engine.js`, `resolver.js`, or `constants.js` beyond what is required by the fixes above.
- Changes to the UI dashboard or any frontend code.
- Retroactive corrections to `state.json` from already-completed project runs.
- Automated runtime enforcement of Orchestrator self-healing rules (enforcement is instruction-based only).

## User Stories

| # | As a… | I want to… | So that… | Priority |
|---|-------|-----------|----------|----------|
| US-1 | Pipeline operator | The corrective task retry flow complete automatically without triggering `display_halted` | Failed tasks can be retried without manual state intervention | P0 |
| US-2 | Pipeline operator | The Orchestrator never modify pipeline source files during a live run | All behavioral changes are reviewed, tested, and version-controlled before execution | P0 |
| US-3 | Pipeline operator | Signal `plan_approved` with an empty context payload as documented | I do not need to manually supply internal system paths that the pipeline should already know | P0 |
| US-4 | Pipeline operator | Pipeline invocations succeed regardless of the working directory at call time | A Coder agent changing into a subdirectory does not silently break the entire run | P0 |
| US-5 | Orchestrator agent | Have a clear, ordered self-healing hierarchy (re-signal → state.json edit → halt) in my instructions | I can recover from diagnosable pipeline states without ever modifying source code | P0 |
| US-6 | Orchestrator agent | Know exactly which six actions require me to pause and which require me to continue | I never ask the operator "should I continue?" after completing a non-terminal side-task | P1 |
| US-7 | Developer operating the pipeline | The corrective task flow be covered by unit tests and a behavioral end-to-end test | Future changes to `mutations.js` cannot silently regress the retry path | P1 |
| US-8 | Developer operating the pipeline | The `handleCodeReviewCompleted` branch completeness (ADVANCED, CORRECTIVE_TASK_ISSUED, HALTED) be confirmed and documented | There is a verified record that no dangling-else gap exists in review outcome routing | P1 |
| US-9 | Coder agent | Know I must restore the working directory to the workspace root after running task commands | I do not leave the pipeline in a broken CWD state after completing a task | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | `handleTaskHandoffCreated` in `mutations.js` shall clear `report_doc`, `report_status`, `review_doc`, `review_verdict`, and `review_action` from the current task when those fields are non-null, and shall be a no-op when they are already null (idempotency guarantee). | P0 | Presence-based guard (`if task.report_doc`) is the confirmed correct approach per research; no `is_correction` flag check required |
| FR-2 | A new unit test in `mutations.test.js` shall verify that `handleTaskHandoffCreated` clears all five stale fields and emits corresponding mutation log entries when the task has pre-populated `report_doc` and `review_doc`. | P0 | The `makeExecutionState` helper must be extended or overridden to populate `report_status` for this test |
| FR-3 | A new unit test in `mutations.test.js` shall verify that `handleTaskHandoffCreated` emits zero clearing mutation log entries when all five stale fields are already null (idempotency test). | P1 | Ensures the corrective path does not fire on first-time handoffs |
| FR-4 | A new end-to-end behavioral test category in `pipeline-behavioral.test.js` shall cover the full corrective task flow: a task in `failed`/`review_action=corrective_task_issued` state receives a `task_handoff_created` event, after which the pipeline returns `execute_task`, and the resulting task state has `report_doc=null`, `review_doc=null`, and `review_action=null`. | P0 | Must follow the shared-IO sequential structure used by existing categories |
| FR-5 | The `handleCodeReviewCompleted` function in `mutations.js` shall be confirmed to have all three verdict branches present (ADVANCED, CORRECTIVE_TASK_ISSUED, HALTED) with no dangling-else gap; the confirming task report shall explicitly document this finding. | P1 | Research confirmed all branches exist; confirmation must be on record |
| FR-6 | The "What you do NOT do" section of `orchestrator.agent.md` shall include an explicit prohibition: modifying pipeline source files — including `mutations.js`, `pipeline-engine.js`, agent `.agent.md` files, and skills — is never an acceptable self-healing action under any circumstances. | P0 | Must be a first-class prohibition, not buried in a general "never write files" clause |
| FR-7 | The Error Handling section of `orchestrator.agent.md` shall include a positive self-healing hierarchy above the existing 3-step failure protocol, in the following priority order: (1) re-signal the correct event; (2) clear or null stale fields in `state.json` directly — never set values not derived from a pipeline result; (3) log the error and halt if neither option resolves the issue. | P0 | State edits are conservative: only null/clear, never invent new state values |
| FR-8 | The "What you do NOT do" section of `orchestrator.agent.md` shall include an explicit rule: the Orchestrator must not ask the human "should I continue?" or pause the event loop after completing a non-terminal side-task (error logging, status reporting, workaround application). | P1 | The only valid pause/stop points are enumerated in FR-9 |
| FR-9 | The Orchestrator agent instructions shall enumerate the six and only valid pause or stop points: `display_halted`, `display_complete`, `request_plan_approval`, `request_final_approval`, `gate_task`, and `gate_phase`. Any `result.action` not in this list must be actioned immediately without human check-in. | P1 | Complements FR-8; defines the positive rule alongside the prohibition |
| FR-10 | `handlePlanApproved` in `pre-reads.js` shall be updated to derive the master plan path from `state.planning.steps` when `doc_path` is absent from the event context, using the `projectDir` parameter already available to the `preRead` entry point. | P0 | Hybrid approach: if `doc_path` is present in context, it is still honored (backward compatible) |
| FR-11 | The Orchestrator agent event signaling reference table entry for `plan_approved` shall document that context may optionally include `doc_path`; if omitted, the handler derives it from state. Routing table entry #13 (`request_plan_approval`) shall be updated to remove any implied `doc_path` requirement. | P1 | Documentation update to match post-fix handler behavior |
| FR-12 | The fallback config path resolution in `state-io.js` (`readConfig`) shall be changed to resolve relative to the script file's own on-disk location rather than the process current working directory. | P0 | Eliminates the single CWD-dependent path in the pipeline script layer |
| FR-13 | The Orchestrator agent instructions shall include a rule that all `pipeline.js` invocations must use an absolute path to the script or be prefixed with a `cd` command to the workspace root. | P1 | Secondary hardening; does not replace FR-12 |
| FR-14 | The Coder agent instructions (`coder.agent.md`) shall include an explicit post-task cleanup step: restore the working directory to the workspace root after executing any terminal commands inside a project subdirectory. | P1 | Tertiary hardening; prevents CWD drift at the source |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Test integrity | All new tests must use the Node built-in test runner (`node:test` and `node:assert/strict`). No additional test frameworks shall be introduced. |
| NFR-2 | Test isolation | New behavioral test categories in `pipeline-behavioral.test.js` must follow the existing shared-IO sequential execution pattern. Test state must not leak across categories. |
| NFR-3 | Mutation safety | The stale-field clearing in `handleTaskHandoffCreated` must have zero effect when the five fields are already null. No clearing mutation log entries shall be emitted for first-time (non-corrective) handoffs. |
| NFR-4 | Agent instruction conciseness | All new rules added to `orchestrator.agent.md` and `coder.agent.md` must be concise enough to be followed under pressure. Each new rule should fit within 3–5 lines; verbose treatises are not acceptable. |
| NFR-5 | No regression | Changes to `mutations.js`, `pre-reads.js`, and `state-io.js` must leave all existing tests in `mutations.test.js`, `pipeline-behavioral.test.js`, and `resolver.test.js` passing without modification. |
| NFR-6 | Backward compatibility | The `handlePlanApproved` change must remain backward compatible: if `doc_path` is present in context, it must be honored. State derivation is the fallback, not a replacement of the existing behavior. |

## Assumptions

- `state.planning.steps[4].doc_path` reliably contains the master plan document path after `master_plan_completed` is processed. The `handlePlanApproved` pre-read handler can depend on this field being set.
- Document paths stored in `state.planning.steps` are resolvable from `projectDir` (either absolute, or workspace-relative paths the handler can join with `projectDir`).
- No pipeline scripts other than `state-io.js` use `process.cwd()` for config or path resolution, consistent with the CWD audit in the research findings.
- The Orchestrator agent will comply with instruction updates on its next invocation; no runtime enforcement exists, and none is required for this project.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | The state-derivation path in `handlePlanApproved` fails if `state.planning.steps` is missing or malformed, producing a new failure mode that replaces the old one | Medium | Guard with null-check before state access; fall back to halting with a descriptive `success: false` error message rather than an unhandled exception |
| R-2 | Presence-based clearing in `handleTaskHandoffCreated` is correct now, but if a future event legitimately leaves `report_doc` set before a first-time handoff this check would silently clear it | Low | The clearing logic emits mutation log entries, making any unintended clearing visible in the pipeline output and error log |
| R-3 | Agent instruction updates have no runtime enforcement; a sufficiently confused Orchestrator may still violate the self-healing hierarchy under unanticipated conditions | Medium | Rules must be placed in the highest-attention sections ("What you do NOT do") and must be phrased as hard prohibitions, not guidelines |
| R-4 | The `__dirname`-relative path fix in `state-io.js` assumes the file is at a stable location relative to the workspace root; if the file is relocated, the derived path breaks silently | Low | The script location is stable; no relocation is planned or in scope |
| R-5 | The behavioral test for the corrective flow must synthesize mid-flight pipeline state (task in `failed`/`corrective_task_issued` status) which the test helpers do not natively support today | Medium | The `makeExecutionState` helper (or local per-test state setup) must be extended to support pre-populating corrective task fields; this is explicitly an in-scope implementation concern |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| New unit tests pass | 100% pass rate | `node:test` output for `mutations.test.js` — 2 new tests (FR-2, FR-3) green |
| Corrective flow behavioral test passes | Pass | `pipeline-behavioral.test.js` new category (FR-4) returns `execute_task` with all stale fields null |
| Existing test suite unchanged | Zero regressions | All pre-existing tests in `mutations.test.js`, `pipeline-behavioral.test.js`, and `resolver.test.js` green after changes |
| `plan_approved` no longer requires `doc_path` | Zero `success: false` failures on `plan_approved` in CI | `pipeline-behavioral.test.js` existing plan-approval test passes with `{}` context |
| CWD-resilient pipeline invocation | Zero `MODULE_NOT_FOUND` errors from pipeline calls following Coder execution | Verified by a post-task pipeline call test or manual run |
| Orchestrator self-healing rules present | Rules confirmed in review | Reviewer agent flags FR-6 and FR-7 as met in the task review document |
| Event-loop discipline rules present | Rules confirmed in review | Reviewer agent flags FR-8 and FR-9 as met in the task review document |
