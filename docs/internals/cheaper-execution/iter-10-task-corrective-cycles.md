# Iter 10 — Task-level corrective cycles (orchestrator mediation)

> **Scope**: task-level corrective cycles only. Phase-level corrective cycles (`PHASE_REVIEW_COMPLETED` handler rewire, phase-scope corrective filename sentinel, phase-scope enrichment, phase-corrective walker tests) are explicitly **iter-11**. Final-level correctives are out of scope for the refactor entirely.
>
> **Design source of truth**: [`../CORRECTIVE-CYCLES-REDESIGN.md`](../CORRECTIVE-CYCLES-REDESIGN.md) covers both iter-10 and iter-11. This companion is the task-level slice — everything the planner needs to author the iter-10 plan without re-reading the redesign. The redesign remains the ambient architectural reference for terminology and cross-iteration alignment.
>
> **Validation status**: code-surface references below were validated against live code at planning time. If you re-use this companion later, re-run the grep/glob pass — pipeline lib files drift ≈40 lines per merged iteration.

## Overview

Today the `CODE_REVIEW_COMPLETED` mutation auto-births a corrective task iteration any time the reviewer's raw verdict is `changes_requested` — then an undefined actor synthesizes a corrective handoff from broad context. The legacy `tactical-planner` that used to fill that role is gone, and the gap has been limping along because the coder compensates with its own context-gathering.

Iter 10 closes the gap by elevating the orchestrator from a deterministic dispatcher into an **active mediator** for task-level reviews:

1. When a reviewer returns `changes_requested`, the orchestrator reads the review, judges each finding, and **writes a disposition addendum** into the review doc (appended section + additive frontmatter fields — the reviewer's raw verdict is never overwritten).
2. If at least one finding is actioned, the orchestrator **authors a fresh, self-contained corrective Task Handoff** under `tasks/` and references its path via the review doc's frontmatter.
3. The pipeline's `CODE_REVIEW_COMPLETED` handler switches from **birth-on-raw-verdict** to **birth-on-handoff-path**: corrective entries are appended only when `effective_outcome = changes_requested` *and* a `corrective_handoff_path` is present. The new entry's `task_handoff` sub-node is synthesized pre-completed with that path.
4. The coder executes the orchestrator-authored handoff (not a delta on prior attempts). The reviewer re-reviews stateless — no prior-review reads. The task-review skill sheds its `Corrective-review check` step and `Corrective Review Context` section accordingly.
5. Budget unchanged: `max_retries_per_task` (default `5` per `orchestration.yml`) bounds `corrective_tasks[].length` at the task-iteration scope. Orchestrator respects it as a soft contract; the mutation enforces it as a hard invariant.

The commit is architectural but contained. The orchestrator's read-only constraint relaxes to a **narrow write surface**: review-doc addenda and corrective Task Handoff files. It continues to never write, modify, or produce project source or tests — code authorship stays with coder agents.

## Scope

**In scope (task-level mediation):**

- **New reference**: `.claude/skills/orchestration/references/corrective-playbook.md` — self-contained guide for the orchestrator on how to mediate a `changes_requested` review. Inlines: the per-finding judgment guardrails (action-when / decline-when / cross-artifact scan / never-decline-on-budget / default-bias-action); the addendum section shape (budget banner + disposition table + effective-outcome line + handoff pointer); the corrective Task Handoff format (frontmatter contract + preamble + corrective-steps shape); the budget soft-contract. No cross-reference to `rad-create-plans` — deliberately decoupled.
- **Orchestrator agent**: `.claude/agents/orchestrator.md` — lift the blanket "Never write files" constraint to a narrow write surface (addendum to existing review doc + corrective Task Handoff files under `tasks/`; still never source, tests, or planning docs). Add a 3-5 line mediation-flow summary that routes to the playbook.
- **Skill refs**:
  - `orchestration/SKILL.md` — add the playbook to the reference table, orchestrator row.
  - `orchestration/references/context.md` — update the `@orchestrator` row: replace "Never writes files" with the narrow write surface.
  - `orchestration/references/pipeline-guide.md` — brief pointer to the playbook under the spawning / review-completion flow.
  - `orchestration/references/action-event-reference.md` — extend the **`code_review_completed`** event row with the new frontmatter contract (reviewer's raw verdict + orchestrator's additive fields). Add a one-line mediation note to action #4 (`spawn_code_reviewer`). **Phase-review event row defers to iter-11.**
  - `orchestration/references/document-conventions.md`:
    - Filename Patterns: add task-scope corrective Task Handoff row: `tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}-C{N}.md`.
    - Corrective Filename Suffix section: extend to include Task Handoffs. **Phase-scope sentinel (`TASK-P{NN}-PHASE-C{N}.md`) defers to iter-11.**
    - Frontmatter Field Reference: add `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`.
- **Pipeline engine** (`.claude/skills/orchestration/scripts/lib/`):
  - `mutations.ts` — rewrite the `CODE_REVIEW_COMPLETED` handler (current line ~624). Birth-on-handoff-path: when frontmatter carries `effective_outcome = changes_requested` and `corrective_handoff_path` is non-empty, scaffold a corrective entry via `findTaskLoopBodyDefs` (line ~609) **and** synthesize a pre-completed `task_handoff` sub-node in the corrective's `nodes` map with `status: completed` + `doc_path: <path>`. Write the effective outcome to `code_review.verdict` (state is authoritative for routing; reviewer's raw verdict lives only on the doc for audit). Budget enforcement stays at the same check point — exhausted budget with a supplied handoff path is a hard error (mutation-side backstop to the orchestrator's soft contract).
  - `context-enrichment.ts` — `execute_task` enrichment (lines ~148-156) today reads `handoff_doc` from `taskIter.nodes['task_handoff']`. Under iter-10 it must route to the active task-scope corrective's `task_handoff.doc_path` when one exists. `spawn_code_reviewer` enrichment (lines ~158-174) stays as-is for task-scope (the phase-scope branch extension defers to iter-11).
  - `frontmatter-validators.ts` — extend `code_review_completed` rules with the conditional contract (see "Frontmatter contract" below). Today the rule set enforces only `verdict`. The new rules fail-fast on malformed orchestrator output so the pipeline returns a structured error the orchestrator can self-correct on the next turn.
- **Code-review skill** (`.claude/skills/code-review/task-review/workflow.md`):
  - Remove step 4 "Corrective-review check" (line 31) — reviewer is stateless across attempts.
  - Remove section "Corrective Review Context" (lines 70-76).
  - Remove verdict-rules line 98 "During corrective reviews, deviations matching previous review issues are expected corrections and do not affect the verdict."
  - Leave the `Previous Code Review` Inputs row (line 23) but clarify that it is present only as spawn context/audit reference — the reviewer does **not** read it. Or remove the row if cleaner; decide at planning time. The row does no harm but contradicts statelessness on a casual read.
- **Frontmatter contract** (single-source-of-truth validation enforced at the `code_review_completed` event boundary, conditional on reviewer's raw verdict):
  - `verdict = approved` → `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path` all absent. Pipeline advances. (Same as today.)
  - `verdict = changes_requested` →
    - `orchestrator_mediated = true` required
    - `effective_outcome` required (`approved` | `changes_requested`) — `rejected` is the reviewer's call only, not orchestrator's
    - If `effective_outcome = changes_requested` → `corrective_handoff_path` required, non-empty string pointing at an existing file under `tasks/`
    - If `effective_outcome = approved` → `corrective_handoff_path` must be absent
  - `verdict = rejected` → `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path` all absent. Pipeline halts. (Same as today — reviewer authority for severe rejections.)
- **UI**: no UI changes in iter-10. The review doc's `## Orchestrator Addendum` section renders through the existing markdown viewer; new scalar frontmatter fields render through the existing frontmatter viewer. Legacy `state.json` continues to render unchanged. A decorative "mediated" badge was considered and deferred — the addendum is the real audit artifact, and a later UI pass will design visual signals from evidence once real mediated reviews exist to look at.
- **Prompt harness behavior** (new folder under `prompt-tests/`): `prompt-tests/corrective-mediation-e2e/` — mirrors the existing `plan-pipeline-e2e/` shape (README + `_runner.md` + `fixtures/` + `output/`). Exercises the end-to-end corrective-mediation flow against a pre-seeded fixture. Commits the inaugural baseline (`lint-report.md` equivalent + `run-notes.md`) under `output/<fixture>/baseline-*/`. Updates `.gitignore` to re-include the baseline artifacts under the new behavior folder. See "Prompt Harness Behavior" section below for fixture design and pass criteria.

**Scope Deliberately Untouched (iter-10 out of scope):**

- `PHASE_REVIEW_COMPLETED` handler at line ~339 — iter-11.
- `COMMIT_COMPLETED` handler phase-scope routing at line ~843 — iter-11.
- `dag-walker.ts` lines 171-184 empty-nodes halt stub — iter-11.
- `resolveNodeState` comment at line ~54 ("Phase-level corrective tasks ... have nodes: {}") — iter-11.
- `context-enrichment.ts` `spawn_code_reviewer` phase-scope corrective branch (lines ~158-174) — iter-11.
- `code-review/phase-review/workflow.md` edits (Corrective-review check, Corrective Review Context, Requirements Inputs row) — iter-11.
- Phase-scope corrective filename sentinel — iter-11.
- `mutations-phase-corrective.test.ts` full rewrite — iter-11.
- `dag-walker.test.ts` three `it.skip()` phase-corrective tests (lines ~1591, ~1624, ~1666) — iter-11.
- Executor input-contract narrowing (drop `Previous Code Review` / `Corrective Task Handoff` rows from task-handoff skill Inputs) — iter-13.
- Installer retry-limit configurability — iter-12 (already scoped).

**Explicitly not part of this refactor at all:**

- Final-level corrective cycles. Final review has no retry mechanism and will not gain one.
- Adversarial review modes.
- Orchestrator upward-flip authority (approved → changes_requested). Reviewer approvals propagate untouched.
- Orchestrator authoring verdicts independently of reviewer output.

## UI Impact

**No UI code changes in iter-10.** The UI is naturally compatible with the mediated-review shape because everything new rides existing viewers:

- Review-doc `## Orchestrator Addendum` section renders through the existing markdown viewer.
- New scalar frontmatter fields (`orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`) render through the existing frontmatter viewer's scalar path.
- Task-scope corrective tasks already render via `dag-corrective-task-group.tsx` — iter-10 populates them from a new source but the shape the UI consumes is unchanged.
- Legacy `state.json` (no mediation fields) renders exactly as today — this is the canary to protect during smoke.

A decorative "mediated" badge was considered at planning time and explicitly deferred: partial signal (only fires on mediated reviews), not actionable (just opens the doc, which the existing Doc link already does), and the real audit trail is the addendum. A future iteration (iter-12 or later, once mediated reviews exist to look at) will revisit UI signals from evidence rather than speculation.

Phase-corrective UI rendering (`dag-iteration-panel` group for phase-scope correctives) is iter-11 territory and explicitly untouched here.

## Code Surface

Validated line numbers as of `feat/cheaper-execution` @ `7a74b1a` (post iter-9 merge). Planner must re-validate before authoring the plan if additional merges have landed.

**New files:**

- `.claude/skills/orchestration/references/corrective-playbook.md` — canonical mediation guide (see "Playbook contents" below).

**Existing files to edit:**

| File | Location | Change |
|---|---|---|
| `.claude/agents/orchestrator.md` | lines 16, 28-35 | Lift "Never write files" blanket; describe narrow write surface (review-doc addendum + corrective Task Handoff); add 3-5 line mediation-flow summary routing to the playbook. |
| `.claude/skills/orchestration/SKILL.md` | reference table ~line 15-21 | Add `corrective-playbook.md` row, Orchestrator role. |
| `.claude/skills/orchestration/references/context.md` | line 17 (`@orchestrator` row) | Replace "**Never writes files.**" with narrow-write-surface language (addendum + corrective Task Handoff; never source, tests, planning docs). |
| `.claude/skills/orchestration/references/pipeline-guide.md` | spawning/review section | Pointer to the playbook when handling `code_review_completed`. One-paragraph addition. |
| `.claude/skills/orchestration/references/action-event-reference.md` | `code_review_completed` event row (~line 48); action #4 `spawn_code_reviewer` (~line 15) | Event row: document the new frontmatter contract (reviewer's raw `verdict` + orchestrator's additive `orchestrator_mediated` / `effective_outcome` / `corrective_handoff_path`). Action row: one-line note that mediation sits between reviewer completion and event signaling. |
| `.claude/skills/orchestration/references/document-conventions.md` | Filename Patterns table (~line 9-18); Corrective Suffix section (~line 20-33); Frontmatter Field Reference (~line 35-56) | Add task-scope corrective Task Handoff row. Extend Corrective Suffix section to include Task Handoffs. Add 7 new frontmatter fields: `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`. |
| `.claude/skills/orchestration/scripts/lib/mutations.ts` | `CODE_REVIEW_COMPLETED` handler starting line 624 (verdict routing at line 689-719 is where the rewrite concentrates) | Flip to birth-on-handoff-path. Synthesize pre-completed `task_handoff` sub-node. Mirror the explosion script's synthesis pattern (see `explode-master-plan.ts` lines 598-610). Write `effective_outcome` (fallback to `verdict` on approved/rejected) to `code_review.verdict` in state. Keep budget enforcement as a hard backstop. |
| `.claude/skills/orchestration/scripts/lib/context-enrichment.ts` | `execute_task` enrichment lines 148-156 | When an active task-scope corrective exists (`taskIter.corrective_tasks[].find(ct => ct.status in ('not_started', 'in_progress'))`), return its `task_handoff.doc_path` as `handoff_doc`. Else fall through to today's lookup. |
| `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` | `VALIDATION_RULES.code_review_completed` (~line 52-58) | Replace the single `verdict` rule with the conditional contract described under "Frontmatter contract" above. May require extending the rule shape from "list of required fields" to "conditional rule set" — call out in the plan whether this is an extension of `FrontmatterValidationRule` or a custom validator function registered per event. |
| `.claude/skills/code-review/task-review/workflow.md` | step 4 (line 31); Corrective Review Context section (lines 70-76); verdict-rules note (line 98); optionally Inputs row at line 23 | Remove the three corrective-related references. Clarify or remove the `Previous Code Review` Inputs row (decide at planning time). Keep everything else. |

**Helpers to reference but not modify:**

- `mutations.ts` `findTaskLoopBodyDefs` (line 609) — unchanged; still scaffolds the corrective's body nodes.
- `mutations.ts` `resolveNodeState` task-scope corrective branch (lines 70-78) — unchanged; already routes mutations to the active corrective's nodes map once populated.
- `scripts/lib/explode-master-plan.ts` lines 598-610 — reference pattern for synthesizing the pre-completed `task_handoff` sub-node.

## Dependencies

- **Depends on**: Iter 9 — `default.yml` now carries the full execution-phase node graph (`task_loop → task_executor → commit → code_review → task_gate`) so task-level corrective cycles have a working pipeline to exercise end-to-end.
- **Blocks**: Iter 11 — phase-level mediation extends iter-10's mediator pattern (same mutation shape, same playbook, same validator pattern) to phase scope. Iter 11 inherits iter-10's `task_handoff` synthesis pattern and the playbook's corrective-handoff format.
- **Downstream ripple**: Iter 12 (code-review rework) carries forward the mediated-review doc shape and the frontmatter contract; iter-13 (executor contract narrowing) closes the `Previous Code Review` / `Corrective Task Handoff` inputs once this iter confirms they are no longer needed.

## Playbook contents

`corrective-playbook.md` is self-contained and carries, in whatever structure reads well:

- **When the orchestrator engages**: only on `verdict = changes_requested`. Approved reviews propagate untouched; rejected reviews halt. The orchestrator never flips approved → changes_requested.
- **Per-finding judgment inputs**: read the referenced file/line, the traced requirement ID in `REQUIREMENTS.md`, the relevant handoff section, and the source/test in question. Read-only access to code is mandatory for fair judgment.
- **Cross-artifact scan**: before declining a finding as out-of-scope, scan sibling Task Handoffs, the Phase Plan, and prior-phase artifacts. Action if this task's contract owed the piece; decline (with cross-artifact rationale) if the remaining piece legitimately belongs to a future phase/task.
- **Action when**: reviewer correctly identifies a real deviation from an inlined requirement, fix is bounded to the task's scope, finding traces to acceptance criteria the task owes.
- **Decline when**: finding is outside the task's scope, references a requirement not inlined in the handoff (out-of-contract), asks for speculative improvements, or misreads the code.
- **Never decline on budget grounds**. Validity is orthogonal to retry count. Budget-blown + valid findings = honest halt.
- **Default bias: action over decline.** Reviewer authority is the baseline. Declines require explicit cross-artifact-grounded justification.
- **Addendum shape** (markdown section appended to the review doc under `## Orchestrator Addendum`): budget banner (`Attempt N of M` — computed as `corrective_tasks.length + 1` vs. `max_retries_per_task`); per-finding disposition table (finding-id, action|decline, one-line reason); effective outcome line (`approved` | `changes_requested`); when applicable, `Corrective Handoff: tasks/{filename}`. Addendum is written on every mediation cycle, including decline-all. Never written on approvals.
- **Corrective Task Handoff format**: same structural shape as an original Task Handoff. Self-contained — no reference to prior attempts or prior reviews. Fields specific to correctives (inlined here so the playbook is the single authoring reference):
  - Filename: `tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}-C{N}.md` where `N` is `corrective_tasks.length + 1` at authoring time.
  - Frontmatter adds: `corrective_index` (integer, 1-based), `corrective_scope: task`, `budget_max` (integer), `budget_remaining` (integer, informational).
  - Body: prose preamble about the original task's intent, followed by the corrective steps. No delta reasoning — coder writes fresh code.
- **Bundling**: one corrective handoff per mediation cycle. All actioned findings land in a single handoff; flat append to `corrective_tasks[]` on the next cycle.
- **Budget**: before mediating, read `corrective_tasks.length` and `max_retries_per_task` from config. If budget exhausted and another `changes_requested` review arrives, do NOT author a handoff. Signal `effective_outcome = changes_requested` with no handoff path AND an operator-facing halt message; the mutation's hard invariant converts this into a pipeline halt.
- **Handoff self-sufficiency**: the authored handoff describes corrective work without reference to prior attempts. Coder and re-reviewer see only the current handoff and the current diff.

## Prompt Harness Behavior (`corrective-mediation-e2e`)

New prompt-test behavior that gives the iteration end-to-end regression protection against mediation drift. Unit tests catch engine bugs; this catches **orchestrator prompt-content drift** — the kind that only surfaces when a real Claude session reads the playbook, judges findings, and authors artifacts that flow through the real pipeline.

### Why this is testable

The existing `plan-pipeline-e2e/_runner.md` is a kickoff prompt pasted into a fresh Claude Code session. That session **is** the orchestrator — it reads state, signals events to `pipeline.js`, routes actions, and spawns subagents (`@planner`, `@reviewer`, `@coder`). Under iter-10, the same simulated session gains the mediator role: the mediation step is work the session does **in its own context** (read the review, load `corrective-playbook.md`, write the addendum, author the corrective handoff, signal `code_review_completed` with the populated frontmatter). Real files in, real files out. The only subagent spawns in a happy-path cycle are the coder-on-corrective and the re-reviewer.

### Folder shape

```
prompt-tests/corrective-mediation-e2e/
  README.md            # why this exists, how to run, pass criteria
  _runner.md           # kickoff prompt for the simulated orchestrator session
  fixtures/
    <fixture-name>/    # pre-seeded project at the "rejected first attempt" moment
      BRAINSTORMING.md
      {NAME}-REQUIREMENTS.md
      {NAME}-MASTER-PLAN.md
      phases/{NAME}-PHASE-01-...md
      tasks/{NAME}-TASK-P01-T01-...md     # handoff specifies the intended behavior
      reports/{NAME}-CODE-REVIEW-P01-T01-...md  # pre-authored, verdict: changes_requested
      src/...          # broken first-attempt implementation
      state.json       # all planning nodes + task_executor + commit + code_review completed
  output/
    <fixture-name>/    # runtime — regenerated each run; only baseline-* committed
```

### Fixture design

One fixture in iter-10. Smallest possible self-contained broken unit. Recommended shape (plan-time decision; name TBD):

- **Task handoff**: "Implement a `getColors()` function in `src/colors.js` that returns `['red', 'orange', 'yellow']` in that exact order." One FR, one acceptance criterion, one file target.
- **Broken first attempt** (pre-committed in the fixture): returns the colors in the wrong order (e.g., `['orange', 'red', 'yellow']`).
- **Pre-authored review doc**: `verdict: changes_requested`, `severity: medium`, one finding referencing the file + line + the ordering mismatch. Crisp enough that the orchestrator can trivially action it.
- **Pre-seeded state.json**: `requirements`, `master_plan`, `explode_master_plan` all completed; `phase_loop.iterations[0].task_loop.iterations[0]` has `task_executor`, `commit`, `code_review` all completed with `code_review.verdict = changes_requested` (pre-iter-10 state shape, so the fixture models the "previously-working" pipeline at the moment of rejection).

**`source_control.auto_commit: never`** in the fixture config — avoids requiring the harness to make real commits. Reviewer operates on `git diff HEAD` + untracked files. Simplifies setup significantly at the cost of not exercising the commit path, which is already covered by unit tests.

### `_runner.md` kickoff (goal-oriented, not step-by-step)

The simulated session is told:

1. You are the orchestrator in the middle of a corrective cycle. The fixture has been pre-seeded: a task was attempted, a reviewer has already returned `changes_requested`. Your job is to mediate and drive the cycle to `approved`.
2. Load `.claude/skills/orchestration/references/corrective-playbook.md`. Read the review doc. For each finding, judge action vs. decline per the playbook's guardrails.
3. Write the `## Orchestrator Addendum` section into the review doc. Add the additive frontmatter fields (`orchestrator_mediated: true`, `effective_outcome: ...`, and `corrective_handoff_path` iff applicable).
4. If at least one finding was actioned, author the corrective Task Handoff under `tasks/{NAME}-TASK-P01-T01-{TITLE}-C1.md` per the playbook's handoff format.
5. Signal `code_review_completed --doc-path <review-doc-path>` via `pipeline.js`. The pipeline pre-reads the frontmatter; if the validator rejects it, read the structured error and fix the frontmatter, then re-signal.
6. Route the returned actions. Expect `execute_task` on the corrective → `@coder` → `invoke_source_control_commit` (skipped under `auto_commit: never`) → `spawn_code_reviewer` → re-review.
7. Continue until `approved` or the graph halts. Write `run-notes.md` summarizing each step, including every agent spawn, every event signaled, every judgment call made during mediation.

### Pass criteria

Shape-based (accommodates non-determinism in reviewer/coder output):

1. **Graph reaches approved**: `state.graph.nodes.phase_loop.iterations[0].task_loop.iterations[0].corrective_tasks.length >= 1` and the final `code_review.verdict === 'approved'` (effective outcome).
2. **Addendum present**: review doc (or one of the corrective review docs) contains a `## Orchestrator Addendum` section with the budget banner line, the disposition table, and an effective-outcome line.
3. **Additive frontmatter**: review doc frontmatter has `orchestrator_mediated: true`, `effective_outcome` ∈ `{approved, changes_requested}`, and `corrective_handoff_path` iff `effective_outcome === 'changes_requested'`.
4. **Corrective handoff file exists**: `tasks/{NAME}-TASK-P01-T01-{TITLE}-C1.md` present with frontmatter `corrective_index: 1`, `corrective_scope: task`, `budget_max` and `budget_remaining` set.
5. **Synthesized task_handoff sub-node**: `corrective_tasks[0].nodes.task_handoff.status === 'completed'`, `corrective_tasks[0].nodes.task_handoff.doc_path === '<path-to-authored-handoff>'`.
6. **Reviewer statelessness honored**: the re-review doc's body contains no cross-references to the prior review (simple grep check for "previous review", "prior review", "first attempt", etc. — heuristic but useful).
7. **No graph halts**: `state.graph.status !== 'halted'` and `corrective_tasks[0].status === 'completed'`.
8. **Budget intact**: `corrective_tasks.length <= max_retries_per_task`; should converge in 1 cycle on the happy-path fixture.

### Cost profile

Per run on the happy-path fixture: 1 mediator step (in-session, no spawn) + 1 `@coder` (corrective attempt) + 1 `@reviewer` (re-review) = **~2 Opus agent spawns**. Slightly cheaper than `plan-pipeline-e2e` (which spawns `@planner` twice). If the first corrective fix misses, +2 (another coder + another reviewer). Still well within "operator-run on demand" discipline.

### Baseline commit

On inaugural run, commit:

- `prompt-tests/corrective-mediation-e2e/output/<fixture>/baseline-<fixture>-YYYY-MM-DD/run-notes.md`
- Optionally a trimmed `state-snapshot.json` reflecting the final graph (large; decide at plan time whether to commit it or just reference it from `run-notes.md`).

Update the repo-root `.gitignore` with a re-include rule for `prompt-tests/corrective-mediation-e2e/output/<fixture>/baseline-*/...`, matching the existing pattern for `plan-pipeline-e2e`.

### Honest caveats

- **Reviewer + coder non-determinism.** Fixture is engineered to make the rejection and fix trivially deterministic, but reviewer wording will vary. Pass criteria are shape-based for that reason.
- **Tests prompt content, not engine logic.** Unit tests still own the pipeline-engine behavior. This harness owns "does the orchestrator produce coherent artifacts given the playbook."
- **Orchestrator's Edit/Write tools must be enabled.** iter-10's agent-definition change adds those to the allowed-tools list; the harness verifies the narrowed write surface actually functions.
- **Not for CI.** Costs Opus per run. Re-run when the playbook, the orchestrator agent definition, the mediation-relevant skill workflows, or the frontmatter-validator contract change.

### Harness and pipeline failures are blockers, not suggestions

**This is the iteration's get-out-of-jail-free card — and the whole point is that we don't use it.** If the harness run fails, or the pipeline emits an error mid-run, or the frontmatter validator rejects orchestrator output and no self-correction recovers it, or the mutation hard-errors, or any structural pass criterion fails to land green — **stop and resolve the root cause before merging**. Possible failure modes to take seriously rather than paper over:

- Validator rejects orchestrator-authored frontmatter → real contract gap in `frontmatter-validators.ts` or real authoring-prompt gap in `corrective-playbook.md`. Fix the contract or fix the playbook. Don't relax the pass criterion.
- Mutation hard-errors on an unexpected payload shape → either the pipeline invariant is too strict or the orchestrator is producing wrong output. Diagnose which; fix that one.
- Walker gets stuck or dispatches to a wrong node → routing bug in the new handler, or a state-shape assumption broken by the synthesized `task_handoff` sub-node. Investigate the walker path, not the pass criteria.
- Coder on the corrective attempt can't execute the handoff → handoff is missing self-sufficiency (e.g., references prior review, underspecified corrective steps). Tighten the playbook's handoff-format guidance until the handoff is coder-executable standalone.
- Re-reviewer produces an unstable verdict → either the fix genuinely didn't land (coder issue) or the reviewer is reading context it shouldn't (stateless-contract leak). Diagnose which.
- Any "odd" run-notes content (agent loops, re-reads of stale docs, confusion about which corrective is active) → likely a prompt-content issue in the playbook, agent definition, or a skill workflow. Resolve before shipping.

Rule of thumb for execution: **a failing harness run in this iteration is a signal, not a nuisance.** It's catching the exact class of drift the harness exists to catch, at the exact moment it's cheapest to fix. Do not ship iter-10 with a failing or skipped harness run. If resolution requires extending scope (a playbook guardrail, an agent-definition clause, a validator branch), log the deviation in `CHEAPER-EXECUTION-REFACTOR-PROGRESS.md` and land the fix. Do not log it as "open item" for a later iteration — a corrective-cycles iteration that ships with a broken corrective-cycle harness is not done.

## Testing Discipline

Baseline-first. Capture `baseline-tests.log` across all three trees before any edits:

- `.claude/skills/orchestration/scripts/` — `npm test` (vitest)
- `ui/` — `npm test` (`node --test --import tsx`)
- `installer/` — `npm test` (`node --test --experimental-test-module-mocks`)

Test surfaces, by blast radius:

**High-impact rework (core corrective-flow tests):**

- `scripts/tests/mutations.test.ts` — `code_review_completed` handler tests (lines 501-562) shift from auto-birth-on-verdict to birth-on-handoff-path semantics. Ensure all three branches (approved / changes_requested+handoff / changes_requested+no-handoff / rejected) have coverage. `findTaskLoopBodyDefs` error-handling test (line ~1006-1007) still applies.
- `scripts/tests/corrective-integration.test.ts` — task-corrective flows (lines 353-497 cover single, multiple, budget, rejected). Rewrite for handoff-path-driven birth; add a synthesized `task_handoff` assertion on each corrective entry. Phase-corrective test at lines 508-563 stays skipped (iter-11).
- `scripts/tests/contract/09-corrective-cycles.test.ts` — contract expansion for the birth-on-handoff-path contract. Auto-resolution tests (lines 78-127) remain valid; add a test asserting no corrective is birthed when `effective_outcome = approved`.
- `scripts/tests/context-enrichment.test.ts` — `handoff_doc` lookup tests. Today `execute_task` enrichment is tested in `contract/03-action-contexts.test.ts` (confirm at plan time). Add a case: active task-scope corrective → `handoff_doc` resolves to the corrective's `task_handoff.doc_path`.

**Medium-impact (validation / event wiring):**

- `scripts/tests/verdict-validation.test.ts` and/or `scripts/tests/contract/05-frontmatter-validation.test.ts` — add conditional-rule coverage for `code_review_completed`: all three verdict branches × valid + invalid orchestrator-field combinations.
- `scripts/tests/mutations-negative-path.test.ts` — hard-error coverage for:
  - `effective_outcome = changes_requested` with no `corrective_handoff_path` → hard error
  - `effective_outcome = approved` with `corrective_handoff_path` present → hard error
  - Budget exhausted with supplied handoff path → hard error (halt)
- `scripts/tests/engine.test.ts`, `scripts/tests/event-routing-integration.test.ts` — event → mutation wiring with the new frontmatter shape.
- `scripts/tests/pre-reads.test.ts` — verify pre-reads surfaces the new frontmatter fields onto event context.
- `scripts/tests/contract/06-state-mutations.test.ts` — new mutation contracts for handoff-path-driven birth.

**Phase-scope test surfaces untouched in iter-10:**

- `scripts/tests/mutations-phase-corrective.test.ts` — leave as-is; iter-11 rewrites.
- `scripts/tests/dag-walker.test.ts` — the three `it.skip()` phase-corrective walker tests (lines ~1591, ~1624, ~1666) stay skipped; iter-11.

**UI:**

- No UI code changes in iter-10 (see UI Impact). Legacy-render canary (`dag-timeline-legacy-render.test.ts`) must still pass unchanged — if it regresses, something in the pipeline output shape drifted and needs investigation before merge.

**Installer:**

- No changes. `max_retries_per_task` is already configurable via `installer/lib/prompts/pipeline-limits.test.js` — iter-12 handles any retry-limit config rework.

**Prompt harness** (`prompt-tests/corrective-mediation-e2e/`): see dedicated "Prompt Harness Behavior" section above. Runs end-to-end against a pre-seeded fixture, commits the inaugural baseline. Operator-driven; not part of `npm test`.

**End-to-end smoke (required — iteration changes orchestrator behavior):**

Scratch project with a deliberately broken first coder attempt. Round-trip:

1. Original task handoff executes → coder deliberately leaves a bug → reviewer returns `changes_requested` with one actionable finding.
2. Orchestrator mediates: reads the review, appends addendum, authors a corrective Task Handoff under `tasks/`, writes frontmatter fields on the review doc (`orchestrator_mediated: true`, `effective_outcome: changes_requested`, `corrective_handoff_path: tasks/...`).
3. Pipeline's `code_review_completed` mutation fires: corrective entry appears in state with pre-completed `task_handoff` sub-node pointing at the new file.
4. Walker dispatches `execute_task` on the corrective; enrichment routes `handoff_doc` to the corrective handoff.
5. Coder implements the fix; commit fires; `spawn_code_reviewer` dispatches; reviewer re-reviews stateless and approves.
6. Task iteration completes. Task gate advances.
7. UI smoke (behavioral only — no new UI code): addendum visible in the doc viewer; corrective task group renders `C1`; legacy `state.json` renders unchanged.

Second smoke variant: orchestrator declines all findings on mediation → no corrective handoff authored → `effective_outcome = approved` → pipeline advances as if the reviewer had approved. Addendum is still written (audit trail). No corrective entry appears.

Third smoke variant: budget exhaustion (set `max_retries_per_task: 1` in the scratch config) → after one corrective that re-fails, orchestrator signals `changes_requested` with no handoff path and a halt message → pipeline halts cleanly.

## Exit Criteria

- All three suites green vs. baseline (orchestration vitest, UI node-test, installer node-test).
- `corrective-playbook.md` exists under `orchestration/references/` and is linked from `orchestration/SKILL.md` and `orchestrator.md`.
- Orchestrator agent definition and `context.md` reflect the narrow write surface. The `NEVER write files` text is gone.
- `CODE_REVIEW_COMPLETED` mutation births correctives from handoff paths, never from raw reviewer verdict. State's `code_review.verdict` records the effective outcome.
- `frontmatter-validators.ts` enforces the conditional contract; all malformed-frontmatter cases return structured errors.
- `context-enrichment.ts` `execute_task` routes `handoff_doc` to the active task-scope corrective's pre-completed `task_handoff`.
- Task-review workflow is stateless across attempts (no Corrective-review check, no Corrective Review Context, no expected-corrections verdict note).
- `document-conventions.md` lists the task-scope corrective Task Handoff filename row + 7 new frontmatter fields.
- Scratch-project smoke completes all three variants (happy-path correction / decline-all / budget-exhaustion halt).
- UI smoke (no new UI code): addendum reads cleanly; legacy state.json renders unchanged; corrective task group renders correctly.
- **Prompt harness** `corrective-mediation-e2e/` exists with one fixture, inaugural baseline committed, all shape-based pass criteria green. `.gitignore` re-include rule added for the new behavior.
- No phase-scope handler / walker / workflow / test file touched — carve is clean for iter-11.

## Open Questions

All planning-time ambiguity resolved with the user at brainstorm time (2026-04-20):

- **Signaling mechanism**: frontmatter-only. No new CLI flags. Pipeline pre-reads fields; validator fail-fast on contract breach; orchestrator self-corrects on the next turn.
- **UI mediated badge**: deferred. Partial signal, not actionable, and the addendum section is the real audit artifact. A future iteration will revisit UI once mediated reviews exist to design from.
- **Budget**: `max_retries_per_task` from `orchestration.yml` (default 5). Unchanged, no new knob.
- **Companion shape**: flesh out for execution-readiness; plan file remains self-contained for the inner session.

Carry-forwards (decide at planning time, not blockers):

- Whether to remove or just clarify the `Previous Code Review` Inputs row in `task-review/workflow.md` (line 23). Removing is cleaner; keeping-with-clarification is lower blast radius.
- Exact shape of the frontmatter-validator extension: add conditional branching inside the existing `FrontmatterValidationRule` loop, or register a custom per-event validator function. The second option scales better if iter-11 adds phase-scope rules.
