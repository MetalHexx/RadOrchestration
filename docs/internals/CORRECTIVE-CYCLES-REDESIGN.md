# Corrective Cycles Redesign

> **Status**: alignment locked. This document is the single source of truth for the corrective-cycles redesign. Iteration planning consumes it directly — there is no intermediate brainstorming layer. Action/event names, payload shapes, and document conventions are in scope and captured here.

## Problem

When a reviewer rejects work, someone needs to turn the rejection into actionable guidance for the next attempt. Today that authoring role is undefined — the legacy `tactical-planner` agent that used to fill it was removed, and the gap hasn't been closed. Reviewers emit verdicts and findings, but no agent is responsible for converting those findings into a fresh task handoff the coder can execute against.

Task-level corrective cycles still work today because the coder has historically synthesized fixes from broad context (requirements + planning docs + prior review). Phase-level corrective cycles are broken — the walker branch that handled them was stubbed pending this redesign. Final-level corrective cycles have never existed.

## Scope of this redesign

**In scope:**
- Task-level corrective cycles
- Phase-level corrective cycles

See the **Out of scope** section at the end of this document for what is explicitly excluded.

## Core shift: orchestrator becomes the mediator

The orchestrator is a large-model agent with long-running context across the whole project. It is in the best position to:

- Read the reviewer's output and exercise judgment about which findings warrant correction
- Author corrective task handoffs with full project awareness
- Coordinate where the corrective work lands in the pipeline

We elevate the orchestrator from a deterministic dispatcher to an active mediator for review cycles. This is an architectural commitment — the orchestrator's role expands — but the change is contained and reversible later if needed.

**Hard firewall on orchestrator scope.** The expanded role is strictly *facilitate the correction-and-review process*. The orchestrator reads review documents, reads project artifacts (source, tests, planning docs, requirements) as needed to judge findings fairly, authors review-document addenda, and authors corrective task handoffs. **The orchestrator never writes, modifies, or produces project source or tests.** Code authorship remains exclusively with the coder agents. The orchestrator's write surface is limited to: (1) the review-document addendum appended to an existing review doc (plus additive, namespaced frontmatter fields), and (2) a corrective task handoff document. Nothing else.

**Engagement is triggered by reviewer findings, not by every review.** The orchestrator mediates *only* when a reviewer returns `changes_requested`. An `approved` review propagates untouched — the orchestrator does not second-guess approvals, does not write an addendum on approved reviews, and does not elevate clean reviews to `changes_requested`. Reviewer authority flows in one direction: approvals stand; only rejections are subject to orchestrator filtering.

## The process

At a high level, when a reviewer returns `changes_requested`:

1. **Orchestrator reads the review document.**
2. **Orchestrator judges validity of each finding.** Not every finding warrants a corrective cycle. The orchestrator can filter — some findings get actioned, others get flagged as noted-but-not-actioned.
3. **Orchestrator records its judgment** as an addendum appended to the reviewer's review document. The review doc becomes the single audit artifact carrying both the reviewer's findings and the orchestrator's decisions about them.
4. **Orchestrator authors a corrective task handoff** if at least one finding was actioned. The handoff is fully self-contained:
   - Prose preamble about the original task's intent (what we were trying to accomplish)
   - The corrective steps for the new attempt
   - No prior implementation details — the coder writes fresh code, not a delta on prior attempts
5. **Orchestrator writes the handoff to disk** and coordinates with the pipeline script to insert a corrective task at the right scope (task iteration for task-review rejections, phase iteration for phase-review rejections).
6. **Coder implements the correction.**
7. **Reviewer re-reviews the correction.** Stateless — the reviewer judges fresh against the requirements and the new diff. It does not carry forward awareness of prior attempts.
8. **Cycle continues** until approved or the task retry budget is exhausted. At task scope, the same mediation flow repeats on each re-review. At phase scope, the corrective's task-level review cycle governs — once the phase-scope corrective's task-level review approves, the phase iteration completes (no phase_review re-run).

**If the orchestrator judges every finding as invalid**, no corrective task is authored. The cycle effectively ends — the hosting iteration (task or phase) advances to completion. The addendum is still written; it records each finding as declined with reason, preserving the audit trail of why the orchestrator overturned the reviewer. This is a meaningful authority given to the orchestrator; it is the reason the mediator pattern exists.

**The `rejected` verdict** (distinct from `changes_requested`) continues to halt the pipeline immediately. The orchestrator does not mediate rejections — a reviewer returning `rejected` signals severity beyond what a corrective cycle is intended to resolve. This matches today's behavior and preserves reviewer authority for the severe case.

### Event wire

Mediation rides on the existing completion events. No new events are added.

- `code_review_completed` and `phase_review_completed` absorb the orchestrator's mediation outcome. The orchestrator signals these events *after* reading the review, forming judgment, writing the addendum, and (if applicable) authoring the corrective handoff.
- Event payload carries the **effective outcome** (the orchestrator's post-mediation decision) plus, when the outcome is `changes_requested`, the path to the orchestrator-authored corrective handoff.
- Mutation writes the effective outcome to state (e.g., `code_review.verdict = effective_outcome`). State becomes authoritative for all downstream routing — walker, gates, UI. Nothing in the pipeline re-derives verdict by re-reading the review doc's frontmatter after the event fires.
- Mutation no longer auto-births a corrective entry from a raw `changes_requested` verdict. Birth is driven by the presence of a handoff path in the payload: when present, a corrective entry is appended to the appropriate `corrective_tasks[]` with `task_handoff.doc_path` pre-populated and status `completed`; when absent (effective outcome = `approved`), no corrective is created and the pipeline advances.

**Document vs. state split.** The review document is the audit artifact; state is the decision record.

- The reviewer's frontmatter fields (`verdict`, `severity`, etc.) are never modified. They preserve the reviewer's raw output.
- The orchestrator adds **additive, namespaced** frontmatter fields alongside the reviewer's: `orchestrator_mediated: true` and `effective_outcome: approved|changes_requested`. These do not overwrite reviewer fields.
- Anyone reading the review document alone can reconstruct the full story: reviewer said X (frontmatter), orchestrator decided Y (frontmatter + addendum).

**Pipeline-script invariants (hard errors).** The pipeline script enforces payload shape at the event boundary:

1. Effective outcome `changes_requested` **must** include a corrective-handoff path. Missing path → hard error.
2. Effective outcome `approved` **must not** include a corrective-handoff path. Present path with approved outcome → hard error.
3. Effective outcome `rejected` matches today's behavior — halts the pipeline, no mediation payload expected.

## What stays the same

- The `corrective_tasks[]` arrays on task and phase iterations. Data shape is unchanged.
- **Corrective tasks are flat siblings, not nested.** When a corrective task's own review rejects, the next corrective is appended to the same task-iteration `corrective_tasks[]` array — not nested inside the prior corrective. Same invariant applies at the phase level. This keeps the array bounded, budget enforcement trivial, and the UI rendering linear.
- **The corrective task's `task_handoff` sub-node is a doc-carrier, pre-completed on birth.** The orchestrator authors the handoff during its mediation before the corrective entry is appended. When the entry is created, `task_handoff.doc_path` is already populated and status is `completed`. The walker never dispatches anything for it. Implementation note: `task_handoff` is **synthetically added** by the mutation to the corrective's `nodes` map alongside the scaffolded body-def nodes (it is not part of the template's `task_loop.body`). This mirrors the explosion script's pattern for original task iterations — see `explode-master-plan.ts` around line 598–610.
- The reviewer's core behavior — it emits a verdict and findings. It only authors the review document. It does not author handoffs or coordinate cycles.
- The executor's contract — read a task handoff, implement it. No awareness of whether it's an original or corrective attempt needed.
- State.json continues to carry the full corrective history for UI rendering.
- **Walker traversal is unchanged.** The walker already traverses `corrective_tasks[]` at the task-iteration level today; the same traversal applies at the phase-iteration level under this redesign. Each corrective entry is walked as a full task using the template's `task_loop.body` node defs — executor → (commit when auto-commit is on) → code review → task gate. Correctives therefore produce their own commits on every attempt; `COMMIT_COMPLETED` routes each commit hash to the active corrective's `commit_hash` field, at both task and phase scopes.
- **Single phase-review pass per phase.** `phase_review` runs once per phase iteration. If it returns `changes_requested`, the orchestrator authors one phase-scope corrective task. That corrective is walked like any task (executor → commit → task-level code review), and the task-level code review runs its own mediation cycle if needed (bounded by the task retry budget). Once the corrective's task-level review is approved, the phase iteration is complete — **phase_review does not re-run**. This is a deliberate simplification: we trust the orchestrator's mediation + the task-level review of the corrective, rather than re-verifying at phase scope. Final review is the backstop for anything that escapes. The outer phase-scope loop can be added later if integration bugs escape in practice; the shape is reversible.

### Reviewer becomes stateless across attempts

Statelessness means **no cross-attempt memory** — the reviewer does not read prior reviews, prior handoffs, or any history of the task's attempts. It does not reason about deltas from a previous submission. Each re-review is judged fresh.

Statelessness does **not** mean starved of within-attempt context. The reviewer still reads whatever the job requires:

- **Task review**: the current task handoff (which inlines the requirements, contracts, and acceptance criteria) and the current diff. Source files when the diff requires surrounding context. This matches today's task-review scope minus the prior-review read.
- **Phase review**: the Phase Plan (exit criteria), all task handoffs for the phase, the Requirements doc (for cross-task integration checks that can't be derived from handoffs alone), the cumulative phase diff, and all task-level code reviews as evidence (not verdict). This matches today's phase-review scope minus the prior-review read.

The orchestrator-authored corrective handoff is self-sufficient: it encodes exactly what this attempt is fixing, with no delta-reasoning required.

As a direct consequence, the "expected corrections" mechanism in the current review workflows goes away (see *What changes* below).

## What changes

- The orchestrator reads review documents and forms judgment — this is a new responsibility.
- The orchestrator authors corrective task handoffs — previously this role was undefined.
- Reviewer documents gain an orchestrator-authored addendum section capturing which findings were actioned vs. declined.
- Phase-level corrective cycles become operational (currently stubbed).
- **The orchestration skill gains a corrective-cycles playbook.** Located at `orchestration/references/corrective-playbook.md`, this reference documents how the orchestrator mediates a `changes_requested` review — reading the review, forming judgment, writing the addendum, authoring the corrective handoff, and signaling the effective outcome. The playbook is self-contained: it inlines the corrective-handoff format directly and does **not** cross-reference `rad-create-plans` or any other planning skill. This is deliberate — the two concerns have different lifecycles (up-front authoring vs. corrective authoring) and decoupling them prevents accidental misdirection.
- **Task-review and phase-review workflows are simplified.** The `Corrective-review check` step and the `Corrective Review Context` section — which instruct the reviewer to read the previous review document to identify "expected corrections" — are removed from both workflows. The verdict-rules note about expected corrections is also removed. Under the new design the reviewer does not read prior reviews; the orchestrator-authored handoff encodes everything the reviewer needs.
- **Addendum** is a new document-convention entry. It is appended to the reviewer's existing review document under a fixed section header (e.g., `## Orchestrator Addendum`). It carries:
  - A budget banner at the top (e.g., `Attempt N of M` — derived from `corrective_tasks[].length` and config limits; no new state counters needed).
  - A per-finding disposition table: each reviewer finding marked `actioned` or `declined`, with a one-line reason.
  - An **effective outcome** line: `approved` or `changes_requested`. This is the orchestrator's final decision, which is what the pipeline acts on.
  - When applicable, a pointer to the authored corrective handoff.
  - The review-document frontmatter gains an optional `orchestrator_mediated: true` flag so the UI can badge mediated reviews without parsing sections. The reviewer's own frontmatter fields (verdict, severity, etc.) are untouched.
  - The addendum is written on **every** mediation cycle, including decline-all. It is never written on approvals.

## Playbook guardrails

The `corrective-playbook.md` prescribes how the orchestrator judges findings. The playbook carries these guardrails:

- **Per-finding inputs.** Read the finding's referenced file/line, the requirement ID it traces to in `REQUIREMENTS.md`, the relevant section of the task handoff, and the source/tests in question. Read-only access to code is not just allowed — it is required to judge fairly.
- **Cross-artifact scan for partial-satisfaction findings.** Some requirements span multiple tasks or phases. Before declining a finding as "out of scope," scan sibling task handoffs, the phase plan, and prior-phase artifacts to check whether the requirement is already satisfied elsewhere. Action the finding if this task's contract owed the piece; decline (with cross-artifact rationale) if the remaining piece legitimately belongs to a future phase/task.
- **Action when:** the reviewer correctly identifies a real deviation from a requirement inlined in the handoff, the fix is bounded within the task's scope, and the finding traces to acceptance criteria the task owes.
- **Decline when:** the finding is outside the task's scope, references a requirement not inlined in the handoff (out-of-contract), asks for speculative improvements beyond the task contract, or misreads the code.
- **Never decline on budget grounds.** If the finding is valid, it is valid regardless of retry count. Budget is orthogonal to finding validity.
- **Default bias: action over decline.** Reviewer authority is the baseline. Declines require explicit, cross-artifact-grounded justification in the addendum.
- **Handoff self-sufficiency.** The authored handoff describes the corrective work without reference to prior attempts or prior reviews. The coder and the re-reviewer see only the current handoff and the current diff.
- **One corrective per cycle.** Bundle all actioned findings into a single handoff.

The playbook also inlines the corrective-handoff format (sections, required frontmatter, prose preamble shape) directly. It does not cross-reference `rad-create-plans`.

## Orchestration skill touchpoints

The redesign ripples through the orchestration skill. The surfaces below need changes during iteration planning. The list has been code-verified against live sources, but **iteration planning must still run a targeted pass across `.claude/skills/` and agent definitions to flag any additional drift before proceeding.**

### Agent definitions

- `.claude/agents/orchestrator.md` — currently states *"Never write, create, or modify any file — read-only"* and *"Write access: NONE (files)"*. Update to reflect the narrow write surface (addenda + corrective handoffs only; still never source or tests). Mediation flow summary belongs here.

### Orchestration skill docs

- `skills/orchestration/SKILL.md` — add `corrective-playbook.md` to the reference table, orchestrator row.
- `skills/orchestration/references/context.md` — update the orchestrator row: the "Never writes files" claim is no longer accurate; replace with the narrow write surface.
- `skills/orchestration/references/pipeline-guide.md` — add a brief pointer to the playbook under the spawning / mediation flow. No structural change.
- `skills/orchestration/references/action-event-reference.md` — extend the `code_review_completed` and `phase_review_completed` event rows with the effective-outcome and corrective-handoff-path payload shape. Extend action #4 (`spawn_code_reviewer`) and action #6 (`spawn_phase_reviewer`) descriptions with a one-line note that the orchestrator mediation step sits between reviewer completion and event signaling.
- `skills/orchestration/references/document-conventions.md` — extend the Filename Patterns table with corrective task handoff rows (task-scope and phase-scope named-sentinel). Extend the Corrective Filename Suffix section to include Task Handoffs plus the phase-scope exception. Extend the Frontmatter Field Reference with: `orchestrator_mediated`, `effective_outcome`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`.
- `skills/orchestration/references/validation-guide.md` — no change expected.
- `skills/orchestration/references/corrective-playbook.md` — **new file**. See *Playbook guardrails* above for contents.

### Pipeline engine (scripts/lib)

All changes here ride the same theme: from mutation-owned corrective birth (auto-scaffolded, empty nodes, verdict-driven) to orchestrator-owned birth (pre-completed handoff, path-driven, effective-outcome-driven).

- `scripts/lib/mutations.ts`:
  - **`CODE_REVIEW_COMPLETED` handler (line ~624).** Stop auto-birthing a corrective from raw `changes_requested`. Birth is driven by the presence of a corrective-handoff path in the payload. When a handoff path is provided, append a corrective entry whose body-def nodes are scaffolded via `findTaskLoopBodyDefs`, and additionally **synthesize a `task_handoff` sub-node** in the corrective's `nodes` map with `status: completed` and `doc_path: <provided>`. The explosion script uses this same synthesis pattern for original task iterations (`task_handoff` is not in the template body). State's `code_review.verdict` records the effective outcome, not the reviewer's raw verdict.
  - **`PHASE_REVIEW_COMPLETED` handler (line ~339).** The entire phase-iteration reset block (lines ~391–441 — resets `phase_planning`, `task_loop`, `phase_review`, `phase_gate` back to `not_started`; `phase_report` was retired in Iter 8) becomes obsolete. Under the new design phase-level correction is a single appended task, not a phase re-plan. Replace with: (a) scaffold body-def nodes into the new corrective entry via `findTaskLoopBodyDefs`, (b) synthesize the pre-completed `task_handoff` sub-node with the supplied doc_path, (c) append to `phase_iteration.corrective_tasks[]`. Nothing else on the phase iteration is reset. `phase_review` is not re-run; once the corrective's task-level review approves, the phase iteration completes. The `previous_review` preservation comment at line ~416 goes away with the block.
  - **`COMMIT_COMPLETED` handler (line ~843).** Currently routes `commit_hash` to either the task iteration or its active task-level corrective. Under the new design, phase-scope correctives live on `phase_iteration.corrective_tasks[]` (not inside a task iteration) and also produce commits. Extend the handler to route commit hashes correctly when the active commit target is a phase-scope corrective.
  - **`resolveNodeState` (lines ~54–62).** The comment *"Phase-level corrective tasks (from phase_review_completed) have nodes: {}"* is stale — under the new design phase-level correctives carry pre-seeded `task_handoff` nodes. Update the routing logic + comment to reflect that phase-level correctives are routed identically to task-level correctives.
  - **`findTaskLoopBodyDefs` helper (line ~609).** Still useful for scaffolding the full task-body under a corrective entry; just confirm it scaffolds `task_handoff` to `completed` with the supplied doc_path rather than `not_started`.
- `scripts/lib/dag-walker.ts`:
  - **Empty-nodes halt stub (lines ~171–184).** The stub that halts when `fepDef.kind === 'for_each_phase'` and corrective `nodes: {}` is removed entirely. Under the new design phase-level correctives carry pre-seeded nodes just like task-level ones.
  - **Corrective-completion behavior (lines ~207–210) stays as today.** When all corrective body nodes finish, the walker marks the hosting iteration `completed`. This is correct at both task and phase scopes under the simpler model — task-scope completion ends the task iteration; phase-scope completion ends the phase iteration with no phase_review re-run.
- `scripts/lib/context-enrichment.ts`:
  - **`execute_task` enrichment (lines ~148–156).** Reads `handoff_doc` from `taskIter.nodes['task_handoff']` — does not route to the active corrective entry's `task_handoff`. Under the new design the coder on a corrective attempt will receive the original handoff path, not the orchestrator-authored corrective handoff. Route to the active corrective's `task_handoff` when one exists. Needs to handle both task-scope correctives (on `taskIter.corrective_tasks[]`) and phase-scope correctives (on `phaseIter.corrective_tasks[]`).
  - **`spawn_code_reviewer` enrichment — phase-scope corrective routing (lines ~158–174).** Today's logic looks up the active corrective on `taskIter.corrective_tasks[]` only. When the walker dispatches `spawn_code_reviewer` while inside a phase-scope corrective, `head_sha` and `is_correction`/`corrective_index` must instead be resolved against `phaseIter.corrective_tasks[]`. Extend the enrichment so both scopes are handled.
  - `phase_head_sha` computation is unchanged. `phase_review` runs once per phase (before any phase-scope correctives exist), so the existing computation remains correct.
- `scripts/lib/frontmatter-validators.ts`:
  - Keep the existing reviewer-verdict validation (reviewer still writes it).
  - Add validation rules for orchestrator-added fields on `code_review_completed` / `phase_review_completed` events: `effective_outcome` required + enum-checked, `orchestrator_mediated` required when mediation occurred. Fail-fast on malformed orchestrator output so the orchestrator can correct on the next turn.

### Code-review skill

- `skills/code-review/task-review/workflow.md`:
  - Remove the `Corrective-review check` step, the `Corrective Review Context` section, and the verdict-rules note about expected corrections.
  - Extend the save-path section to cover phase-scope correctives: when reviewing a phase-scope corrective task (handoff named `TASK-P{NN}-PHASE-C{N}.md`), the review doc uses the parallel named-sentinel form `CODE-REVIEW-P{NN}-PHASE-C{N}.md`.
- `skills/code-review/phase-review/workflow.md`:
  - Remove the `Corrective-review check` step (step 5), the `Corrective Review Context` section, the verdict-rules note about expected corrections, and the "Previous Phase Review" entry from the Inputs table.
  - **Stale inputs cleanup (pre-existing drift, surface while we're here).** The Inputs table lists `PRD`, `Architecture`, and `Design` documents which do not exist under the cheaper-execution pipeline (they were collapsed into Requirements + Master Plan in earlier iterations). Remove these rows.
  - **Add Requirements to Inputs.** The phase reviewer needs `{NAME}-REQUIREMENTS.md` to perform cross-task integration and exit-criteria checks. Currently only the Master Plan is listed; the Requirements doc should be explicit.
  - Save-path conventions unchanged at phase-review scope (`PHASE-REVIEW-P{NN}-{TITLE}-C{N}.md` still follows the simple `-C{N}` rule).

## Test surface

Code-verified test map, grouped by blast radius. Detailed rework happens during iteration planning; this is the scope picture.

**High-impact rework (core corrective-flow tests):**

- `scripts/tests/mutations.test.ts` — CODE/PHASE_REVIEW_COMPLETED handler tests shift from auto-birth-on-verdict to birth-on-handoff-path semantics.
- `scripts/tests/mutations-phase-corrective.test.ts` — entire file tests the phase-iteration-reset logic that disappears. Rewrite for append-only semantics.
- `scripts/tests/corrective-integration.test.ts` — end-to-end corrective flows, comprehensive rework.
- `scripts/tests/contract/09-corrective-cycles.test.ts` — contract test for corrective cycles; iter-12 already flagged this for heavy expansion.
- `scripts/tests/dag-walker.test.ts` — the three `it.skip()`'d phase-corrective walker tests (stubbed in Iter 7; lines ~1591, ~1624, ~1666). Un-skip and re-assert against append-based walking.

**Medium-impact (payload/event-shape ripples):**

- `scripts/tests/mutations-negative-path.test.ts` — add hard-error coverage for the new pipeline-script invariants (approved + handoff, changes_requested without handoff).
- `scripts/tests/verdict-validation.test.ts` — add `effective_outcome` / `orchestrator_mediated` frontmatter validation.
- `scripts/tests/engine.test.ts`, `scripts/tests/event-routing-integration.test.ts` — event → mutation wiring with new payload fields.
- `scripts/tests/pre-reads.test.ts` — effective-outcome frontmatter reads.
- `scripts/tests/pipeline.test.ts`, `scripts/tests/main.test.ts` — CLI argument parsing for new flags.
- `scripts/tests/contract/05-frontmatter-validation.test.ts`, `scripts/tests/contract/06-state-mutations.test.ts` — new validation and mutation contracts.
- `scripts/tests/context-enrichment.test.ts` — confirm corrective context fields stay correct; specifically verify the `handoff_doc` lookup routes to the active corrective entry.

**UI — additive rendering:**

- `ui/components/dag-timeline/*.test.ts` — corrective-flow rendering (`dag-corrective-task-group`, `dag-iteration-panel`, `dag-timeline`, `dag-loop-node`, `dag-timeline-helpers`). Phase-level correctives become operational; addendum-enriched review docs may surface a new mediated-badge.
- `ui/components/dag-timeline/dag-timeline-legacy-render.test.ts` — backwards-compat canary; must not regress on legacy state.json.

**Installer — retry-limit config (iter-12 already scoped):**

- `installer/lib/config-generator.test.js`, `installer/lib/prompts/pipeline-limits.test.js`.

**Out-of-band harness:**

- `prompt-tests/plan-pipeline-e2e` — end-to-end prompt scenario runner. Iteration planning should confirm fixtures still match the new event payloads.

## Corrective handoff conventions

Corrective handoffs are structurally tasks — same shape, same executor contract — regardless of whether they were triggered by a task-level or phase-level review. They all live in the project's `tasks/` folder.

**Naming:**

- Task-scope corrective: `{NAME}-TASK-P{NN}-T{NN}-{TITLE}-C{N}.md` — inherits the parent task's phase and task numbers; `C{N}` is the corrective-attempt index (1-based, matches `corrective_tasks[].length`).
- Phase-scope corrective: `{NAME}-TASK-P{NN}-PHASE-C{N}.md` — `PHASE` occupies the T-slot as a named sentinel since phase-scope correctives don't belong to a specific task.

**Scope per cycle:** One corrective handoff per mediation cycle. The orchestrator bundles all actioned findings from a single review into a single handoff. If the re-review also requests changes, the next cycle authors another single corrective. This keeps `corrective_tasks[]` flat, bounded, and easy to reason about for budget enforcement.

**Corrective-of-corrective.** When a corrective task's own review returns `changes_requested`, the same mediation flow runs on that new review. The resulting handoff is appended flat to the *same* `corrective_tasks[]` array at the hosting iteration — never nested inside the prior corrective. Budget counter is simply the array length. The invariant holds identically at task and phase scopes.

**Frontmatter fields.** The corrective handoff carries these fields in addition to the standard handoff frontmatter, to make the handoff self-describing for audit and UI:

- `corrective_index`: integer, 1-based, matches `corrective_tasks[].length` at time of authoring.
- `corrective_scope`: `task` or `phase`.
- `budget_max`: integer, the retry limit in effect at authoring time. Same value (`max_retries_per_task` from `orchestration.yml`) applies at both scopes — it just bounds the length of whichever `corrective_tasks[]` array the corrective lives in.
- `budget_remaining`: integer, retries left after this attempt (derived, informational).

The reviewer ignores these fields — its stateless contract is preserved. They exist for the orchestrator's audit trail, the UI's budget-banner rendering, and any downstream human reader who opens the file without state.json context.

## Retry limits and halting

A single budget value — `max_retries_per_task` from `orchestration.yml` — applies at both scopes. It bounds the length of each `corrective_tasks[]` array independently: a task iteration's array is capped by the budget, and a phase iteration's array is capped by the same budget. No new configurable knob is added for phase scope. The simpler model removes the outer phase-review re-run loop; the inner task-level review cycle is identical at both scopes.

**Budget ownership is split:**

- **Orchestrator respects the budget as a soft contract.** Before mediating, it reads the relevant `corrective_tasks[].length` and the budget value from config. If the budget is already exhausted and another `changes_requested` review arrives, the orchestrator does not author a handoff; it signals a halt outcome with an operator-facing message describing what went unaddressed.
- **Mutation enforces the budget as a hard invariant.** Even if the orchestrator signals a corrective-handoff path when the budget is blown, the mutation rejects the append and halts the pipeline. This keeps the limit as a state-machine guard regardless of orchestrator behavior.
- **Budget state is derived, not stored.** `Attempt N of M` is computed from existing `corrective_tasks[].length` plus config — no new counter fields on the iteration state.

When a budget exhausts at either scope, graph status moves to halted and the halt reason carries the operator-facing message authored by the orchestrator during its final mediation pass. The operator decides how to proceed manually.

## UI implications

Because corrective activity is captured in state.json (corrective_task entries, addendum-enriched review docs, halt status), the UI renders the corrective narrative naturally. No UI redesign is required for this change — the data shape the UI already consumes grows richer, not different.  We need to look at the UI and see if the phase corrective cycles need to be added into the UI.

## Out of scope

The following are **explicitly out of scope** for this redesign. Any related code surface is untouched by this work. They are not open threads and not deferred — they are not part of this design at all.

- **Final-level corrective cycles.** Final review has no retry mechanism and will not gain one in this work. Any future addition of final-level correctives is a separate design.
- **Adversarial review modes.** Looser, fresh-eyes review modes that catch what strict-conformance reviews miss by design are not in scope.
- **Orchestrator upward-flip authority.** The orchestrator does not elevate `approved` → `changes_requested`. Reviewer approvals propagate untouched. The orchestrator only engages when the reviewer flags findings.
- **Orchestrator verdict-override beyond filtering.** The orchestrator's authority is limited to declining individual findings (up to and including declining all of them, which collapses to effective `approved`). It does not author verdicts independently of the reviewer's raw output.
