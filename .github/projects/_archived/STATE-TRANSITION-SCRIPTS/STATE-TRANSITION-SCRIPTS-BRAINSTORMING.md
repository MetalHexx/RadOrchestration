---
project: "STATE-TRANSITION-SCRIPTS"
author: "brainstormer-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Brainstorming

## Problem Space

The orchestration system's execution phase lacks determinism. The Orchestrator's routing logic and the Tactical Planner's triage decision tables are encoded in natural language markdown — and an LLM re-derives the correct action from scratch on every invocation. The same `state.json` can produce different routing decisions across runs, triage rows can be mismatched or skipped, and write ordering rules (e.g., `review_verdict` before `handoff_doc`) are unenforced. The documents describe what should happen; nothing guarantees it actually does.

## Validated Ideas

### Idea 1: Next-Action Resolver Script

**Description**: A JavaScript CLI script that takes `state.json` as input and emits a single, exact next-action command — e.g., `{ "action": "create_task_handoff", "phase": 2, "task": 3 }`. This replaces the Orchestrator's prose routing logic with a deterministic pure function: `(state.json) → NextAction`. The Orchestrator calls the script, reads the output, and spawns accordingly.

**Rationale**: Routing is the highest-leverage point for determinism. The LLM currently re-derives all routing conditions every invocation. A script eliminates that entirely — same input always produces same output, the logic is testable, and wrong routing becomes a code bug rather than a hallucination.

**Key considerations**: The Orchestrator must be updated to call this script before making any spawn decision. The script's output vocabulary needs to be a closed enum that the Orchestrator prose can unambiguously pattern-match against.

---

### Idea 2: Triage Execution Script

**Description**: A JavaScript CLI script that takes `state.json`, a task report path, and an optional review doc path, then writes `review_verdict` and `review_action` (or `phase_review_verdict` and `phase_review_action`) directly to `state.json`. Replaces the most fragile step in the pipeline: the LLM "executing" the 11-row task-level and 5-row phase-level decision tables from `triage-report/SKILL.md`.

**Rationale**: Triage is strictly table-driven with one complex row (Row 10: retry budget + severity cross-check). That complexity is exactly what LLMs handle inconsistently. A script eliminates row mismatches, write ordering violations, and verbatim transcription errors. The `triage-report` skill markdown remains as human-readable documentation; the script is the authoritative interpreter.

**Key considerations**: Row 10 requires a cross-document lookup (`state.json → limits.max_retries_per_task`). The script needs to read limits from `state.json` directly rather than from `orchestration.yml` to keep the interface clean. The Tactical Planner must be updated to call this script in Mode 3 and Mode 4 instead of executing the tables itself.

---

### Idea 3: State Transition Validator

**Description**: A JavaScript CLI script that validates a proposed `state.json` write before it is committed — confirms the transition is legal (e.g., task can't go from `complete` to `not_started`, `handoff_doc` can't be set without `review_verdict` being written when `review_doc` is non-null, only one task `in_progress` at a time). Returns pass/fail with a structured error message.

**Rationale**: The Tactical Planner is trusted to write state correctly, but currently nothing enforces the invariants documented in the state schema and triage skill. A validator gives the Planner a fast-fail mechanism — a bad write is caught immediately rather than silently corrupting downstream routing. Complements the resolver and triage scripts rather than replacing them.

**Key considerations**: Could be a pre-write check the Tactical Planner calls before saving, or a post-write check the Orchestrator calls after re-reading state. Pre-write is cleaner. Needs access to both the current state and the proposed updated state to check transitions.

## Scope Boundaries

### In Scope
- Three JavaScript CLI scripts: next-action resolver, triage executor, state transition validator
- Scripts are invokable from the VS Code terminal (Copilot tool: `execute`)
- Scripts encode the logic currently in Orchestrator agent prose and `triage-report` skill
- The agent `.agent.md` files and `triage-report/SKILL.md` are updated to call the scripts
- `orchestration.yml` continues to own tunable config (limits, severity classifications)
- Decision table logic is hardcoded JS — not loaded from an external rules file
- Tables represented as explicit, readable JS objects/arrays (named functions for complex rows like `checkRetryBudget()`)

### Out of Scope
- A full execution driver script that calls LLM agents as subprocesses (the "Option D" full automation path — future)
- Declarative YAML/JSON rule files with a generic interpreter (considered and deferred — adds interpreter complexity without clear gain over readable hardcoded tables)
- Changes to planning pipeline agents (Research, PM, UX Designer, Architect)
- Changes to the Coder or Reviewer agents
- Git automation or commit scripting

## Key Constraints

- VS Code + Copilot Chat runtime only — no separate runner, no CI pipeline integration at this stage
- JavaScript (Node.js) — consistent with existing `src/greet.js` and the `tests/*.test.js` suite
- Scripts are called by agents via the `execute` terminal tool — agents remain in control of when to call them
- No new external dependencies if avoidable — plain Node.js preferred
- The scripts must be independently testable (fits the existing `tests/` Jest suite structure)

## Open Questions

- What is the exact CLI interface for each script? (stdin JSON vs. file path argument vs. flags)
- Should the next-action resolver emit a single action or a sequence (e.g., "create phase plan, then create task 1 handoff")?
- Where do the scripts live in the repo? (`src/orchestration/` or `.github/orchestration/scripts/`?)
- Should the validator run as a pre-write check (called by Tactical Planner) or post-write check (called by Orchestrator)?
- Do all three scripts ship together in one phase, or is there a priority order (triage first, as most fragile)?

## Summary

The execution phase of the orchestration system relies on LLMs re-deriving routing and triage decisions from natural language markdown on every invocation. This produces inconsistent behavior for the same inputs. The project introduces three hardcoded JavaScript CLI scripts — a next-action resolver, a triage executor, and a state transition validator — that encode the routing and decision table logic currently living in agent prose. Agents call the scripts via the terminal tool rather than interpreting the markdown themselves, narrowing the LLM's role to judgment-required work (coding, reviewing) while making routing and state transitions fully deterministic and testable.
