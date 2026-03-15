# MONITORING-UI — Orchestration Issues Log

> **Project**: MONITORING-UI
> **Created**: 2026-03-09
> **Purpose**: Documents all known issues with the orchestration scripts and agent protocols discovered during MONITORING-UI project execution.

---

## Summary Table

| # | Severity | Area | Script / Component | Status |
|---|----------|------|--------------------|--------|
| 1 | Medium | Agent | Coder agent (timeout/context limit) | Open |
| 2 | Medium | Protocol | Tactical Planner — `current_task` advancement | Mitigated |
| 3 | Critical | Script | `src/lib/state-validator.js` (V2) vs `src/lib/resolver.js` | Open |
| 4 | Critical | Script | `src/lib/state-validator.js` (V1) vs `src/lib/resolver.js` | Open (not yet triggered) |
| 5 | Low | Script | `src/lib/state-validator.js` (V14) | Open |

---

## Table of Contents

- [Issue #1: Coder Agent Timeout on Large Tasks](#issue-1-coder-agent-timeout-on-large-tasks)
- [Issue #2: Tactical Planner Prematurely Advances current_task](#issue-2-tactical-planner-prematurely-advances-current_task)
- [Issue #3: V2 Invariant Conflicts with Resolver Phase Completion Detection](#issue-3-v2-invariant-conflicts-with-resolver-phase-completion-detection)
- [Issue #4: V1 Invariant Will Have Same Problem at Project Completion](#issue-4-v1-invariant-will-have-same-problem-at-project-completion)
- [Issue #5: V14 Invariant Forces Two-Step Writes for Review Fields](#issue-5-v14-invariant-forces-two-step-writes-for-review-fields)

---

## Issue #1: Coder Agent Timeout on Large Tasks

| Field | Value |
|-------|-------|
| **Discovered during** | P01-T01 (Next.js Project Init) |
| **Script** | N/A (agent-level issue) |
| **Severity** | Medium |
| **Status** | Open |

### Description

The Coder agent returned no response ("Sorry, no response was returned") when given a large task handoff (P01-T01) that involved many terminal operations (`create-next-app`, `npm install`, 12× `shadcn add` commands, build verification). Likely hit a context or timeout limit.

### Impact

Had to retry the task with a more focused prompt or execute manually.

### Workaround

Break large scaffold tasks into smaller steps, or provide the Coder with explicit context about existing state rather than expecting it to execute everything from scratch.

### Suggested Fix

Consider splitting scaffold tasks into 2–3 smaller tasks in the phase plan, or adding timeout/retry logic at the Orchestrator level for agent spawning.

---

## Issue #2: Tactical Planner Prematurely Advances current_task

| Field | Value |
|-------|-------|
| **Discovered during** | P01-T02 (TypeScript Type Definitions) state update |
| **Script** | Tactical Planner behavior (not a script bug per se, but a protocol violation) |
| **Severity** | Medium |
| **Status** | Mitigated |

### Description

When updating `state.json` after T02 completion (Mode 2 — update state from task report), the Tactical Planner advanced `current_task` from 1 to 2 even though the Orchestrator protocol says `current_task` should only advance when the `next-action` script returns `advance_task` (which happens AFTER code review).

### Impact

The resolver skipped code review for T02 entirely — it jumped from `advance_task` (which the resolver returned for T01) straight to `create_task_handoff` for T03 because `current_task` was already pointing past T02.

### Root Cause

The Orchestrator's instruction to the Tactical Planner didn't explicitly say "do NOT advance `current_task`." The Planner inferred it should advance as part of marking the task complete.

### Workaround

All subsequent Tactical Planner spawn instructions now include explicit **"CRITICAL: Do NOT change `current_task`"** language.

### Suggested Fix

Add documentation in the Tactical Planner's agent instructions or skill file that Mode 2 (update state from task report) must **NEVER** advance `current_task`. Only Mode 2 with an explicit "advance task" instruction should change `current_task`.

---

## Issue #3: V2 Invariant Conflicts with Resolver Phase Completion Detection

| Field | Value |
|-------|-------|
| **Discovered during** | P01-T06 advance (last task in Phase 1) |
| **Script** | `src/lib/state-validator.js` (V2 invariant) vs `src/lib/resolver.js` (`resolveExecution`) |
| **Severity** | Critical |
| **Status** | Open |

### Description

The state validator's V2 invariant enforces `current_task < tasks.length` (strict bounds check). However, the resolver's `resolveExecution()` function checks `phase.current_task >= phase.tasks.length` to detect that all tasks in a phase are processed and route to phase lifecycle (`generate_phase_report`, etc.).

Since V2 prevents `current_task` from ever reaching `tasks.length`, the resolver can never detect phase completion through its intended mechanism.

### Impact

Creates an infinite loop at phase boundaries: `advance_task` → try to set `current_task=N` → V2 rejects → `current_task` stays at N-1 → resolver sees approved task → `advance_task` → loop forever.

### Root Cause

V2 uses `ct >= tasks.length` as an error condition, but the resolver uses `current_task >= tasks.length` as the phase completion signal. These two invariants are mutually exclusive.

### Workaround

Skip `validate-state.js` when advancing past the last task in a phase (set `current_task = tasks.length` directly).

### Suggested Fix

Change V2 in `state-validator.js` to allow `current_task == tasks.length` as a valid sentinel value:

```javascript
// BEFORE (line ~104):
if (tasks.length > 0 && (ct < 0 || ct >= tasks.length)) {

// AFTER:
if (tasks.length > 0 && (ct < 0 || ct > tasks.length)) {
```

This allows `current_task == tasks.length` (all tasks processed) while still rejecting values beyond that. Same fix needed for V1 (`current_phase` bounds) for the same reason at the phase level.

---

## Issue #4: V1 Invariant Will Have Same Problem at Project Completion

| Field | Value |
|-------|-------|
| **Discovered during** | Analysis of Issue #3 |
| **Script** | `src/lib/state-validator.js` (V1 invariant) vs `src/lib/resolver.js` (`resolveExecution`) |
| **Severity** | Critical (not yet triggered) |
| **Status** | Open |

### Description

V1 enforces `current_phase < phases.length`. The resolver checks `currentPhaseIndex >= phases.length` to detect all phases complete and transition to review tier. Same pattern as Issue #3 — V1 will block the transition when we finish Phase 4.

### Impact

Will create an infinite loop when all phases complete, preventing transition to the review tier.

### Suggested Fix

Same as Issue #3 — change V1 to use `>` instead of `>=`:

```javascript
// BEFORE (line ~84):
if (phases.length > 0 && (cp < 0 || cp >= phases.length)) {

// AFTER:
if (phases.length > 0 && (cp < 0 || cp > phases.length)) {
```

---

## Issue #5: V14 Invariant Forces Two-Step Writes for Review Fields

| Field | Value |
|-------|-------|
| **Discovered during** | Recording code reviews for P01-T01, T03, T04, T05, T06 |
| **Script** | `src/lib/state-validator.js` (V14 invariant) |
| **Severity** | Low (functional but inefficient) |
| **Status** | Open |

### Description

V14 prevents `review_doc` and `review_verdict`/`review_action` from changing in the same write. Combined with V8 (which requires `review_verdict` to exist before `review_doc` is set), this forces every code review recording to be a two-step write:

1. First set `review_verdict` and `review_action`.
2. Then set `review_doc`.

This is by design but adds unnecessary complexity and doubles the number of state writes for a routine operation.

### Impact

Every code review recording requires **2 validated writes** instead of 1. Not a blocker but creates overhead.

### Suggested Fix

Consider whether V14 is actually necessary. If the intent is to prevent the triage step from being skipped, a simpler invariant might be:

> "If `review_doc` transitions from `null` to non-null, `review_verdict` must also transition from `null` to non-null in the same write **OR** already be non-null."

This would allow single-write review recording while still enforcing triage.
