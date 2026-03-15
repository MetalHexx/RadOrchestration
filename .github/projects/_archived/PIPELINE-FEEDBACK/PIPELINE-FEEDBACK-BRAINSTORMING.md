---
project: "PIPELINE-FEEDBACK"
author: "brainstormer-agent"
created: "2026-03-08T00:00:00Z"
---

# PIPELINE-FEEDBACK — Brainstorming

## Problem Space

The Tactical Planner currently plans future work using Phase Reports and prior Task Reports, but ignores the evaluation documents that actually judge quality — Code Reviews and Phase Reviews. This means the Planner is grounded in *what happened* but not in *what it meant*. Deviations, architectural concerns, and review verdicts don't reliably feed forward into the next handoff or phase plan, making the execution loop less corrective than it should be. The state schema reinforces this gap: review document paths are not tracked, so the Planner has no deterministic way to find and read them.

## Validated Ideas

### Idea 1: Track review documents in state.json

**Description**: Add `review_doc` and `review_verdict` fields to each task entry in the schema, and `phase_review` and `phase_review_verdict` fields to each phase entry. The Reviewer writes these after completing a review and the Tactical Planner reads them as an explicit, required read-step — no path guessing needed.

**Rationale**: If a document path isn't in `state.json`, the Planner can't reliably find it. Making review docs first-class state schema fields turns "the Planner should probably read reviews" into a deterministic, auditable step. The verdict fields also allow the Orchestrator to make routing decisions (advance / corrective task / halt) without reading the full doc.

**Key considerations**:
- `review_verdict` values: `approved | changes_requested | rejected | null`
- `phase_review_verdict` same set
- The **Planner** writes these fields as part of its triage step — sole-writer rule is preserved. The Reviewer produces the review document; the Planner reads it and records the verdict in state before planning next work.
- The Orchestrator reads `review_verdict` from state as a gatekeep signal (see Idea 4); the Planner reads the full `review_doc` for content

### Idea 2: New `triage-report` skill for the Tactical Planner

**Description**: A dedicated skill that gives the Tactical Planner explicit, conditional decision logic for what to do after reading task reports, code reviews, and phase reviews. The skill defines a read sequence (task report always first, then code review and phase review conditional on state.json fields being populated) and a decision table covering all combinations of status and verdict.

**Rationale**: Without explicit triage instructions, the Planner either over-delegates to the Orchestrator or under-reacts to warning signals. Centralizing the decision logic in a skill means it's consistent, auditable, and updateable without touching the agent file directly.

**Key considerations**:
- Task report is always read — it is the factual account of what was built. Even a `complete` task can carry deviations or recommendations for the next task.
- Code review and phase review are conditionally read — only if `review_doc` / `phase_review` is non-null in state.json
- Decision logic by source and condition:
  - Task report `complete`, no deviations → advance, carry any recommendations into next handoff context
  - Task report `complete`, has deviations → surface deviations in next handoff; flag for Reviewer if architectural
  - Task report `partial` → assess issues, issue corrective task handoff or escalate based on severity
  - Task report `failed`, minor severity → retry if under limit, else halt
  - Task report `failed`, critical severity → halt immediately
  - Code review `approved` → mark task complete, advance
  - Code review `changes_requested` → create corrective handoff with specific issues from the review inlined
  - Code review `rejected` → halt, escalate to human
  - Phase review `approved` → advance to next phase
  - Phase review `changes_requested` → create corrective tasks targeting the integration issues identified
  - Phase review `rejected` → halt, escalate to human

### Idea 3: Triage as a mandatory step within Tactical Planner modes

**Description**: The `triage-report` skill is not a separate mode or standalone invocation — it is a required step *within* Mode 3 (Create Phase Plan) and Mode 4 (Create Task Handoff). Before producing any planning output, the Planner reads the relevant reports and reviews, writes the verdict fields into state.json, and then plans accordingly. Triage and planning happen in the same invocation.

**Rationale**: Making triage a separate agent call would add overhead for every task and phase. Since the Planner is already being spawned to produce the next handoff or phase plan, triage is zero extra invocations — it's just a sequenced read-then-decide-then-plan flow. The Planner does both in one shot.

**Key considerations**:
- Mode 3 read sequence: Master Plan → Architecture → Design → state.json → Phase Report (previous) → **Phase Review (previous, if `phase_review` non-null)** → triage → plan
- Mode 4 read sequence: Phase Plan → Architecture → Design → Task Report (dependent tasks) → **Code Review (dependent tasks, if `review_doc` non-null)** → triage → plan
- Triage produces two outputs: (1) updated verdict fields in state.json, (2) the Planner's next action (advance / corrective handoff / halt signal)
- Triage does not produce a separate document — it is a decision step, not a reporting step

### Idea 4: Orchestrator gatekeep via state field invariant

**Description**: The Orchestrator enforces that triage happened before accepting the Planner's output. The invariant is simple: if `review_doc` is non-null and `review_verdict` is still null (or `phase_review` is non-null and `phase_review_verdict` is null), triage was skipped. The Orchestrator re-spawns the Planner with an explicit instruction to complete triage first.

**Rationale**: Triage being embedded in the Planner's modes is an instruction-level constraint — it works if the Planner follows it, but LLMs can skip steps. The state field invariant gives the Orchestrator a mechanical, field-level check that doesn't require reading documents. It creates a verifiable contract: populated verdict fields prove triage ran.

**Key considerations**:
- Invariant: `review_doc != null AND review_verdict == null` → triage did not happen
- Same invariant applies at phase level: `phase_review != null AND phase_review_verdict == null`
- Orchestrator check is a read-only field comparison on state.json — no document parsing needed
- Re-spawn instruction is explicit: "You have a review doc at [path] that has not been triaged. Read it, update the verdict in state, then continue planning."
- This adds zero overhead on the happy path (Planner follows the skill) and provides a recovery mechanism on the unhappy path

## Scope Boundaries

### In Scope
- `state.json` schema: add `review_doc`, `review_verdict` per task; `phase_review`, `phase_review_verdict` per phase
- New `triage-report` skill with decision table covering task reports, code reviews, and phase reviews
- Tactical Planner agent Mode 3 and Mode 4 instruction updates: triage as a mandatory step before planning output, with verdict fields written to state as proof
- Orchestrator agent instruction update: add gatekeep check for triage invariant (`review_doc` / `phase_review` non-null with null verdict → re-spawn Planner)
- State schema reference doc update (`plan/schemas/state-json-schema.md`)

### Out of Scope
- Planning doc updates triggered by execution findings (PRD/Design/Architecture feedback loop) — too complex, deferred
- Per-task reviews mandated after every task (current two-level model — task code review + phase review — is sufficient)
- Any changes to Reviewer agent behavior or review document formats

## Key Constraints

- The Tactical Planner is the sole writer of `state.json` — the Reviewer produces review documents but does not touch state. The Planner reads the review and records the verdict as part of its triage step.
- Triage logic must remain deterministic — no judgment calls left to the Planner's discretion on routing (that's what the decision table in the skill is for)
- Triage and planning are one invocation — triage is a step within Mode 3 and Mode 4, not a separate mode or agent call
- The Orchestrator gatekeep is a field-level check only — it does not read review documents, it checks whether verdict fields are populated
- Backward compatibility: existing state.json files without `review_doc` fields should be treated as `null` (review not yet done, not an error)

## Alternatives Considered and Rejected

- **Orchestrator as sole state writer**: Would make the Orchestrator a god-agent (coordinates, routes, and manages persistence). Loses the clean audit trail of Planner-only writes. Rejected.
- **Scribe agent for state updates**: State writes come in two flavors — bookkeeping (recording what happened) and planning-generated (task entries produced by planning decisions). A Scribe handles bookkeeping cleanly but must interpret planning documents to handle planning-generated writes, which is itself a form of planning. Eventually requires either two agents writing state or an extra hop after every Planner action. Rejected.
- **Reviewer writes verdict fields directly**: Violates sole-writer rule. Rejected.

## Open Questions

- Should `review_verdict` carry the raw reviewer verdict only, or also a Planner-resolved action field (e.g. `corrective_task_issued`, `halted`)? Raw verdict is the audit truth; resolved action is the operational truth. Both have value — could carry both fields, e.g. `review_verdict` (raw) and `review_action` (what the Planner decided to do with it).

## Summary

The Tactical Planner needs to be grounded in evaluation reality, not just factual completion. Three connected changes make this happen: (1) add `review_doc`/`review_verdict` per task and `phase_review`/`phase_review_verdict` per phase to `state.json`, giving the Planner deterministic read paths and the Orchestrator mechanical gatekeep signals; (2) create a `triage-report` skill with an explicit decision table covering task reports, code reviews, and phase reviews — triage runs as a mandatory step within existing Planner modes, zero extra invocations; (3) add an Orchestrator gatekeep that checks the triage invariant (`review_doc` non-null + `review_verdict` null = triage skipped) and re-spawns the Planner if violated. The Tactical Planner remains sole writer of `state.json` throughout.
