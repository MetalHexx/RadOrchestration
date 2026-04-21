# Iter 18 — Plan-replan cycle (human-driven corrective loop)

> **⚠️ BRAINSTORMING — scope is preliminary. DO NOT plan this iteration without re-opening the brainstorm with the user first.** This iteration was split out of iter-14 during brainstorming on 2026-04-21. The audit half landed in iter-14; the corrective-loop half (replan with audit-feedback context) sits here awaiting further design thought. Several cross-cutting questions remain open — see "Known Open Questions" below. The preliminary scope is a starting point, not a spec.

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Origin

Split out of [iter-14-rad-plan-audit.md](./iter-14-rad-plan-audit.md) on 2026-04-21 during brainstorming. Iter-14 delivers the audit pipeline node + doc + UI rendering, but the audit is **report-only** — its verdict does not change pipeline flow. The human reads findings at the plan-approval gate and chooses approve or reject. Reject today (`plan_rejected` mutation at `.claude/skills/orchestration/scripts/lib/mutations.ts:1218`) resets `master_plan.status` and loops back to the planner **blind**, with no context about why the previous plan was rejected.

The missing piece: a **targeted replan path** that carries audit findings (or operator-supplied notes) into the planner's re-spawn enrichment context, so the next master-plan iteration addresses the flagged issues instead of re-authoring from scratch.

Iter-14 deliberately punted this to keep scope clean. Iter-18 picks it up.

## Preliminary Scope (subject to re-brainstorm)

- **Pipeline event for replan**. Either replace `plan_rejected` entirely with `plan_replan_requested` (single path, optional feedback payload) or add the new event alongside (two paths: blind reject + feedback-carrying replan). Event accepts optional `--audit-doc <path>` and/or `--reason <text>` flags.
- **Mutation behavior**. Same resets as today's `plan_rejected` (master_plan → `not_started`, clear `doc_path`, reset `plan_approval_gate`, clear `phase_loop.iterations`), PLUS store replan context (audit doc path + operator notes) on state for the next planner spawn to read.
- **Context enrichment**. `spawn_master_plan` enrichment branch reads replan context (if present) and threads it into the planner agent's spawn context — either as a path the planner reads during spawn, or as a pre-digested structured payload.
- **Lightweight chat-invoked skill**. Operator runs the skill from agent chat after reading the audit doc. Skill reads the audit doc, prompts for optional notes, and signals the event with payload via pipeline CLI. Name TBD — candidates include `/rad-replan`, a new subcommand of `rad-plan-audit`, or an entirely new skill.
- **UI affordance**. Approval gate surfaces a "Replan" button-equivalent (informational; actual action is chat-invoked). Button styling + position next to "Approve" needs design pass.
- **Orchestration skill references**. `action-event-reference.md`, `pipeline-guide.md`, `SKILL.md` pick up the new event (and possibly removed `plan_rejected`, depending on replace-vs-coexist decision).
- **Re-audit on replan**. After the planner re-authors, the explosion → `plan_audit` → `plan_approval_gate` cycle runs again. No new wiring needed if iter-14's node is in place; verify the loop is clean.

## Known Open Questions

Re-brainstorm these with the user before planning:

1. **Replace vs coexist**. Does `plan_rejected` go away entirely (cleaner surface; one loop-back path) or stay as the "blind reject" variant alongside `plan_replan_requested`? Current `plan_rejected` already loops back (doesn't halt) — the semantics overlap significantly.
2. **Context carry-forward shape**. Does the planner agent receive the audit doc **path** (reads the doc during spawn) or a **pre-digested structured payload** (enrichment parses findings into the context)? Trade-off: path = planner reads raw; payload = enrichment does the parse but introduces a schema contract.
3. **Replan on non-audit rejections**. The operator may want to replan for reasons unrelated to the audit (e.g., they've changed their mind about plan direction). The replan path should accommodate `--reason` without `--audit-doc`. Is that the same skill invocation, or a separate entry point?
4. **UI affordance shape**. Is the approval gate three-way (Approve / Replan / Reject), two-way (Approve / Replan — collapsing reject into replan with no notes), or something else? Needs UX pass.
5. **Lightweight skill location**. `/rad-replan` as its own skill vs embedded as a user-invocable mode of `rad-plan-audit` vs a generic `/signal-event` skill.
6. **Iteration cap**. Superpowers caps review-loops at 5 iterations before human escalation. Should replan loops have a similar cap, or is human-in-the-loop (operator can always stop by approving or abandoning) sufficient? Likely sufficient given the human gate, but worth confirming.
7. **State field naming**. Where does replan context live on `state.json`? Candidates: `pipeline.last_replan_reason`, `master_plan.replan_context`, a new top-level `replan` sub-tree. Decision affects enrichment logic + UI surfacing (if any).
8. **Interaction with iter-10/11 orchestrator mediation**. Those iterations put the orchestrator in the loop for *review* corrections. Replan is *plan-level* and operator-driven — is it orchestrator-mediated at all, or purely event-driven? Preliminary answer: not orchestrator-mediated (operator drives directly). Confirm.

## Code Surface (preliminary)

- Engine (`.claude/skills/orchestration/scripts/lib/`):
  - `constants.ts` — EVENT entry (and possibly removal of `PLAN_REJECTED` if replace decision locks)
  - `context-enrichment.ts` — update `spawn_master_plan` branch to include replan context
  - `mutations.ts` — new or updated mutation handler (`PLAN_REPLAN_REQUESTED` or updated `PLAN_REJECTED`)
  - `events.ts` — new event type literal
  - `engine.ts` / CLI — event signaling surface
- State schema: `.claude/skills/orchestration/schemas/` — new field(s) for replan context
- Skill: new lightweight skill OR extended mode of existing `rad-plan-audit` skill
- Orchestration references:
  - `.claude/skills/orchestration/SKILL.md`
  - `.claude/skills/orchestration/references/action-event-reference.md`
  - `.claude/skills/orchestration/references/pipeline-guide.md`
- UI: approval gate component — new affordance labeled "Replan" next to "Approve"
- Tests: mutation, enrichment, event-routing, integration test covering replan → re-author → re-explode → re-audit loop
- Prompt harness: extension of `plan-audit-e2e/` (iter-14) or new `plan-replan-cycle-e2e/` fixture covering the full loop

## Dependencies

- **Depends on**: [iter-14-rad-plan-audit.md](./iter-14-rad-plan-audit.md) — the `plan_audit` node + audit doc + state fields must exist before a replan flow can reference them as feedback context.
- **Blocks**: iter-17 — docs refresh should cover both iter-14 and iter-18 in one pass, so iter-18 should land before iter-17 runs. (Alternatively, iter-17 defers replan documentation to a follow-up docs touch-up after iter-18 lands.)

## Forward Pointer

This iteration inherits iter-14's audit-doc contract. Any changes to iter-14's `verdict` / `max_severity` frontmatter schema must be reflected here if replan's enrichment consumes those fields programmatically.

## Notes for Next Brainstorm

- User explicitly flagged this needs more thought before planning — session of 2026-04-21.
- Revisit whether operator-supplied notes should be a first-class state field (queryable, UI-surfaceable) or consumed transiently.
- Confirm UX: is "Replan" always routed through the audit, or can the operator replan from `request_plan_approval` without an audit doc (i.e., replan-for-other-reasons)?
- Consider whether the lightweight skill should also support replanning from AFTER execution has started (e.g., during a phase review, operator realizes the plan is wrong) — or is replan strictly bounded to the pre-execute approval gate? Out of scope for now; revisit if the need emerges.
