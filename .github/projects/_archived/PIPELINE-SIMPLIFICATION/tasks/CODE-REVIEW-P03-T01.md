---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 1
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15T01:27:00Z"
---

# Code Review: Phase 3, Task 1 — PIPELINE-ENGINE

## Verdict: APPROVED

## Summary

The `pipeline-engine.js` module faithfully implements the declarative `processEvent` recipe specified in the Task Handoff and Architecture. The code is clean, linear, and contains zero event-type branching in the standard path. The CF-2 carry-forward fix (`report_status: null` in the task template) is correctly applied in `mutations.js`, and the two snapshot assertions in `mutations.test.js` were updated accordingly — a justified minor deviation. All 278 tests pass, all 7 lib-v3 modules import without error, and the `scaffoldInitialState` output matches the v3 schema exactly.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | Engine is a pure orchestration layer calling the 5 peer modules in the specified sequence (pre-read → getMutation → mutate → validate → write → resolve). No domain logic in the engine. Module boundaries honored. |
| Design consistency | ✅ | `processEvent` reads top-to-bottom as a ~20-line recipe per Design spec. Init, cold-start, and no-state are early returns. Standard path is linear with no loops or internal actions. |
| Code quality | ✅ | Clean naming, proper `'use strict'`, aligned imports, minimal surface area (2 exports). `deepClone` is internal. No dead code, no unused variables. 169 lines total — reasonable for the responsibility. |
| Test coverage | ⚠️ | All 278 existing tests pass. No new unit tests for `pipeline-engine.js` itself, but this is explicitly deferred to T02–T04 per the handoff constraints. The CF-2 snapshot updates are correct and minimal. |
| Error handling | ✅ | All four failure paths (no state, pre-read error, unknown event, validation failure) return structured `PipelineResult` with `success: false`, `action: null`, and empty `mutations_applied`. No `io.writeState` call on any failure path. |
| Accessibility | N/A | No UI components — CLI pipeline engine module. |
| Security | ✅ | No secrets, no user input parsing beyond what's passed via the DI boundary. No `fs` import (only `path.basename`). No shell commands, no eval, no dynamic requires. |

## Files Reviewed

### `.github/orchestration/scripts/lib-v3/pipeline-engine.js` (CREATED, 169 lines)

**Imports (lines 1–9):** Six requires — `path` (stdlib), plus the 5 peer lib-v3 modules (`pre-reads`, `mutations`, `validator`, `resolver`, `constants`). Only `SCHEMA_VERSION` imported from constants; only `path.basename` used from `path`. No `fs` import — constraint satisfied.

**`deepClone` (line 13):** JSON round-trip clone. Internal (not exported). Appropriate for plain JSON state objects with no functions, Dates, or circular references — which matches the `StateJson` contract.

**`scaffoldInitialState` (lines 22–53):** Produces the exact v3 schema shape specified in the Architecture and Handoff:
- `$schema: 'orchestration-state-v3'` via `SCHEMA_VERSION` constant ✅
- 5 planning steps with `{ name, status: 'not_started', doc_path: null }` ✅
- `planning.current_step: 'research'` ✅
- `execution.current_tier: 'planning'` ✅
- No `triage_attempts` anywhere ✅
- `project.name` from `path.basename(projectDir)` ✅

**`handleInit` (lines 57–66):** Calls `io.ensureDirectories`, `scaffoldInitialState`, `io.writeState` (exactly once), `resolveNextAction`. Returns success with `mutations_applied: ['project_initialized']`. Matches contract.

**`handleColdStart` (lines 70–78):** Calls `resolveNextAction` only. Zero writes, zero mutations. Returns `mutations_applied: []`. Matches contract.

**`processEvent` (lines 87–159):** The main recipe. Reviewed step by step:
1. `io.readConfig(configPath)` — loads config ✅
2. `io.readState(projectDir)` — loads state ✅
3. Init check: `!currentState && event === 'start'` → early return ✅
4. Cold-start check: `currentState && event === 'start'` → early return ✅
5. No-state + non-start: returns failure with descriptive error ✅
6. `preRead(event, context, io.readDocument, projectDir)` — 4 args match contract ✅
7. Pre-read error check: returns `preReadResult.error` directly as context ✅
8. `getMutation(event)` — checks for `undefined`, returns labeled error ✅
9. `mutationFn(deepClone(currentState), preReadResult.context, config)` — deep clones before mutation ✅
10. `validateTransition(currentState, proposed.state, config)` — 3 args match validator contract ✅
11. Validation error check: returns `{ error, violations }` structure ✅
12. `io.writeState(projectDir, proposed.state)` — exactly one write on success path ✅
13. `resolveNextAction(proposed.state, config)` — post-write resolution ✅
14. Returns `{ success, action, context, mutations_applied }` — matches `PipelineResult` contract ✅

No event-type branching in the standard path (lines 120–159). No loops. No internal actions. No triage layer.

**Exports (line 163):** `{ processEvent, scaffoldInitialState }` — exactly 2 exports, matching contract.

### `.github/orchestration/scripts/lib-v3/mutations.js` (MODIFIED, +1 line)

**`handlePhasePlanCreated` (lines 207–233):** The task template object in the `.map()` callback now includes `report_status: null` after `retries: 0`. This completes the CF-2 carry-forward fix — the task template now matches the full `Task` typedef in the Architecture (which includes `report_status`). Correct and minimal change.

### `.github/orchestration/scripts/tests-v3/mutations.test.js` (MODIFIED, +2 lines)

**Lines 398 and 411:** Two `assert.deepEqual` snapshot assertions for the task template now include `report_status: null`. This is a direct consequence of the CF-2 fix: the `deepEqual` assertions must match the actual object shape. The deviation (modifying test files despite the handoff saying "Do NOT modify the existing test files") is justified — the CF-2 fix and the "all tests pass" acceptance criterion are both mandatory, and they conflict. The minimal resolution (2 lines added to snapshots) is the correct approach.

## Acceptance Criteria Assessment

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | `pipeline-engine.js` exists at correct path | ✅ Met |
| 2 | `processEvent` exported with correct signature | ✅ Met (5 params, returns PipelineResult) |
| 3 | `scaffoldInitialState` exported with correct signature | ✅ Met (2 params, returns StateJson) |
| 4 | Init path: ensureDirectories → scaffold → writeState (×1) → resolve → success | ✅ Met |
| 5 | Cold-start path: resolve only, zero writes, `mutations_applied: []` | ✅ Met |
| 6 | Standard path: preRead → getMutation → clone+mutate → validate → write → resolve → success | ✅ Met |
| 7 | Standard path calls `io.writeState` exactly once | ✅ Met |
| 8 | All failure paths: `success: false`, `action: null`, zero writes | ✅ Met |
| 9 | Unknown event returns error with event name | ✅ Met |
| 10 | Pre-read failure returns structured error | ✅ Met |
| 11 | Validation failure returns violations array | ✅ Met |
| 12 | `scaffoldInitialState` produces `$schema: 'orchestration-state-v3'` | ✅ Met |
| 13 | No `triage_attempts` in scaffold output | ✅ Met |
| 14 | 5 planning steps + `current_step: 'research'` | ✅ Met |
| 15 | CF-2: `report_status: null` in task template | ✅ Met |
| 16 | No event-type branching in standard path | ✅ Met |
| 17 | All 278 tests pass | ✅ Met |
| 18 | All 7 lib-v3 modules importable | ✅ Met |

## Issues Found

No issues found. All checklist items pass.

## Positive Observations

- The engine module is remarkably linear and readable — the `processEvent` standard path reads exactly as the Architecture's "load → pre-read → mutate → validate → write → resolve → return" recipe with no detours.
- Clean separation of concerns: the engine is purely orchestration — zero domain logic, zero event-specific branching in the standard path.
- The failure result shapes exactly match the contracts specified in the Task Handoff, with consistent `{ success: false, action: null, context: {error}, mutations_applied: [] }` structure.
- The deviation (snapshot updates for CF-2) was handled thoughtfully — minimal 2-line change with clear documentation in the task report.
- `deepClone` correctly kept internal (not exported) — avoids polluting the module's public API.

## Recommendations

- Proceed to T02–T04 for integration and behavioral tests of `processEvent`, which will exercise the init, cold-start, standard, and failure paths end-to-end with mock I/O.
