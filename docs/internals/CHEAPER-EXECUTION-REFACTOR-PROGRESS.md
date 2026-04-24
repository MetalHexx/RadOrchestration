# Cheaper Execution Refactor — Progress Tracker

Companion to [`CHEAPER-EXECUTION-REFACTOR.md`](./CHEAPER-EXECUTION-REFACTOR.md). That doc is the stable design reference — do not edit it during execution unless agreed upon by the user. **This doc is the mutable one.**

---

## Instructions for Agents Maintaining This Doc

1. **Append-only log**: add a new dated entry under "Progression Log" whenever meaningful work lands (iteration completed, task completed, prerequisite cleared, deviation decided, branch created, merge landed). Do not rewrite prior entries.
2. **Update status at the top**: when an iteration starts or completes, update the "Status at a Glance" and "Branches & Worktrees" tables to reflect the new state. Those tables are the only places where in-place edits are expected.
3. **Track git state**: when a worktree is created, a branch is pushed, or a merge lands, update the "Branches & Worktrees" table alongside the progression log entry. Merge commit hashes and PR URLs belong there.
4. **Record deviations**: if an execution decision diverges from the design in `CHEAPER-EXECUTION-REFACTOR.md`, capture it under "Deviations from Design" with date, what changed, and why. Do **not** edit the design doc to match — the design captures brainstorming-time intent; deviations are the execution-time delta.
5. **Record new open items**: if a question surfaces during execution that couldn't be resolved, add it under "Open Items Surfaced During Execution" with date and context. These are for a future brainstorming cycle, not for live rewriting of the design.
6. **Link artifacts**: every log entry that corresponds to a commit, PR, or code-review report should link to it. Prefer absolute paths or URLs.
7. **Keep entries tight**: a log entry is what landed + where to find it, not a retelling. 3–5 lines is plenty. Deep rationale belongs in commit messages and PR descriptions.
8. **Clean up worktrees**: once an iteration branch has been merged into the integration branch and verified, remove the worktree and update the "Branches & Worktrees" table to reflect the cleanup.

---

## Git Workflow

This refactor uses a multi-branch, worktree-per-iteration strategy to isolate work and keep the main integration branch clean.

**Branch hierarchy:**

```
feat/process-refactor          (parent — final merge target)
  └── feat/cheaper-execution       (integration branch for this refactor)
        ├── feat/cheaper-execution/iter-0-prereqs      (per-iteration branch)
        ├── feat/cheaper-execution/iter-1-doc-formats
        ├── feat/cheaper-execution/iter-2-explosion
        ... etc.
```

**Lifecycle per iteration:**

1. **Branch**: create `feat/cheaper-execution/iter-<N>-<slug>` off `feat/cheaper-execution`.
2. **Worktree**: check that branch out into a dedicated worktree path so iteration work doesn't disturb the main checkout.
3. **Work**: execute the iteration. Tests, code, reviews — all confined to the worktree.
4. **Verify**: full test suite passes; any code review required by the iteration scope is complete.
5. **Merge**: merge the iteration branch back into `feat/cheaper-execution`. Prefer merge commits for traceability (not squash) unless the iteration is genuinely one logical change.
6. **Clean up**: remove the worktree; delete the iteration branch locally and on origin.
7. **Log**: append a progression entry and update the "Branches & Worktrees" table.

**Final cutover** (after all iterations have landed on `feat/cheaper-execution` and are verified end-to-end):

- Open a PR from `feat/cheaper-execution` → `feat/process-refactor`.
- After merge, delete `feat/cheaper-execution`.
- Log the cutover in the progression log with the merge commit hash and PR URL.

**Worktree naming convention** (suggested, not required):

Worktrees live outside the main checkout — e.g., `C:\dev\orchestration-worktrees\cheaper-iter-<N>-<slug>`. Keep them in a parallel folder, not nested inside the main repo.

---

## Status at a Glance

| Iteration | Description | Status | Started | Completed |
|-----------|-------------|--------|---------|-----------|
| 0 | Prerequisites (auto-resolution bug + corrective filename) | Complete | 2026-04-17 | 2026-04-17 |
| 1 | Document formats (Requirements + Execution Plan) | Complete | 2026-04-17 | 2026-04-17 |
| 2 | Rename Execution Plan → Master Plan | Complete | 2026-04-18 | 2026-04-18 |
| 3 | Remove upstream planning (PRD/Research/Design/Architecture) | Complete | 2026-04-18 | 2026-04-18 |
| 4 | Requirements pipeline node | Complete | 2026-04-18 | 2026-04-18 |
| 5 | Explosion script + state.json pre-seeding | Complete | 2026-04-19 | 2026-04-19 |
| 6 | Prompt regression harness | Complete | 2026-04-19 | 2026-04-19 |
| 7 | Remove per-phase/per-task planning | Complete | 2026-04-19 | 2026-04-20 |
| 8 | phase_review absorbs phase_report | Complete | 2026-04-20 | 2026-04-20 |
| 9 | Complete `default.yml` | Complete | 2026-04-20 | 2026-04-20 |
| 10 | Task-level corrective cycles (orchestrator mediation) | Merged | 2026-04-20 | 2026-04-20 |
| 11 | Phase-level corrective cycles | Complete | 2026-04-21 | 2026-04-21 |
| 12 | Code-review rework (task/phase/final) | Merged | 2026-04-21 | 2026-04-21 |
| 13 | Execute-coding-task rework | Complete | 2026-04-21 | 2026-04-21 |
| 14 | Rad-plan-audit overhaul | Not started | — | — |
| 15 | Explosion-retry configurability | Not started | — | — |
| 16 | Repository deep clean | Not started | — | — |
| 17 | Public-facing docs refresh | Not started | — | — |

**Overall**: 13 / 18 iterations complete (Iter 13 awaiting merge; Branches table carries the merge state). Status table reflects the current iteration numbering; historical progression-log entries for "Iteration 0" and "Iteration 1" refer to the same iterations in their original numbering (no shift). Iteration numbers 2+ have been renumbered across two design passes — the gutting-first realignment (2026-04-18) and the corrective-cycles redesign that inserted task- and phase-level corrective iterations at slots 10 and 11 (2026-04-20). See [`CHEAPER-EXECUTION-REFACTOR.md`](./CHEAPER-EXECUTION-REFACTOR.md) for the authoritative timeline.

**Legend**: Not started → In progress → Blocked → Complete

---

## Branches & Worktrees

**Parent branch**: `feat/process-refactor`
**Integration branch**: `feat/cheaper-execution` — created 2026-04-17 off `feat/process-refactor` @ `86c6616`.

**Per-iteration state:**

| Iter | Branch | Worktree Path | State | Merge Commit | PR |
|------|--------|---------------|-------|--------------|-----|
| 0 | `feat/iter-0-prereqs` | `C:\dev\orchestration\v3-worktrees\feat-iter-0-prereqs` | Merged | (see commit 08bf2ff lineage) | — |
| 1 | `feat/iter-1-doc-formats` | `C:\dev\orchestration\v3-worktrees\feat-iter-1-doc-formats` | Merged | `08bf2ff` | #51 |
| 2 | `feat/iter-2-rename-to-master-plan` | `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan` | Awaiting merge | — | [#53](https://github.com/MetalHexx/RadOrchestration/pull/53) |
| 3 | `feat/iter-3-remove-upstream-planning` | `C:\dev\orchestration\v3-worktrees\feat-iter-3-remove-upstream-planning` | Awaiting merge | — | [#54](https://github.com/MetalHexx/RadOrchestration/pull/54) |
| 4 | `feat/iter-4-requirements-pipeline-node` | `C:\dev\orchestration\v3-worktrees\feat-iter-4-requirements-pipeline-node` | Awaiting merge | — | [#55](https://github.com/MetalHexx/RadOrchestration/pull/55) |
| 5 | `feat/iter-5-explosion-script` | `C:\dev\orchestration\v3-worktrees\feat-iter-5-explosion-script` | Merged | `4500203` | [#56](https://github.com/MetalHexx/RadOrchestration/pull/56) |
| 6 | `feat/iter-6-prompt-harness` | `C:\dev\orchestration\v3-worktrees\feat-iter-6-prompt-harness` | Merged | `82333f1` | [#57](https://github.com/MetalHexx/RadOrchestration/pull/57) |
| 7 | `feat/iter-7-remove-per-phase-task-planning` | `C:\dev\orchestration\v3-worktrees\feat-iter-7-remove-per-phase-task-planning` | Merged | `ff05ce2` | [#58](https://github.com/MetalHexx/RadOrchestration/pull/58) |
| 8 | `feat/iter-8-phase-review-absorbs-phase-report` | `C:\dev\orchestration\v3-worktrees\feat-iter-8-phase-review-absorbs-phase-report` | Merged | `d5d45f3` | [#59](https://github.com/MetalHexx/RadOrchestration/pull/59) |
| 9 | `feat/iter-9-complete-default-yml` | `C:\dev\orchestration\v3-worktrees\feat-iter-9-complete-default-yml` | Merged | `4ee1ea1` | [#60](https://github.com/MetalHexx/RadOrchestration/pull/60) |
| 10 | `feat/iter-10-task-corrective-cycles` | `C:\dev\orchestration\v3-worktrees\feat-iter-10-task-corrective-cycles` | Merged | `3b85095` | [#61](https://github.com/MetalHexx/RadOrchestration/pull/61) |
| 11 | `feat/iter-11-phase-corrective-cycles` | `C:\dev\orchestration\v3-worktrees\feat-iter-11-phase-corrective-cycles` | Merged | `6140a9a` | [#62](https://github.com/MetalHexx/RadOrchestration/pull/62) |
| 12 | `feat/iter-12-code-review-rework` | `C:\dev\orchestration\v3-worktrees\feat-iter-12-code-review-rework` | Merged | `1030620` | [#64](https://github.com/MetalHexx/RadOrchestration/pull/64) |
| 13 | `feat/iter-13-executor-rework` | `C:\dev\orchestration\v3-worktrees\feat-iter-13-executor-rework` | Awaiting merge | — | [#65](https://github.com/MetalHexx/RadOrchestration/pull/65) |
| 14 | — | — | Not created | — | — |
| 15 | — | — | Not created | — | — |
| 16 | — | — | Not created | — | — |

**State values**: `Not created` → `Worktree active` → `Awaiting merge` → `Merged` → `Worktree removed`

**Final cutover to parent:**

| From | To | Merge Commit | PR | Date |
|------|-----|--------------|-----|------|
| `feat/cheaper-execution` | `feat/process-refactor` | — | — | — |

---

## Progression Log

Append new entries at the bottom. Format:

```
### YYYY-MM-DD — <Iteration N | Prereq | Deviation | Note> — <Short title>
- What landed / what changed
- Links: <commit hashes, PR URLs, report paths>
- Follow-ups if any
```

### 2026-04-16 — Design frozen

- `CHEAPER-EXECUTION-REFACTOR.md` published in `docs/internals/`, capturing the full design.
- Progress tracker (this doc) created with git workflow: parent `feat/process-refactor` → integration `feat/cheaper-execution` → per-iteration worktree branches.
- Next up: create `feat/cheaper-execution` off `feat/process-refactor`, then start Iteration 0 (prerequisite auto-resolution bug) in its own worktree.

### 2026-04-17 — Integration branch created

- Created `feat/cheaper-execution` off `feat/process-refactor` @ `86c6616` and switched to it.
- Next up: Iteration 0 — create worktree + branch `feat/cheaper-execution/iter-0-prereqs` and address the corrective-cycle auto-resolution bug (§8).

### 2026-04-17 — Iteration 0 — Auto-resolution bug fix + corrective-filename standardization

- Branch: `feat/iter-0-prereqs` off `feat/cheaper-execution` @ `e42d945` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-0-prereqs`). Branch name differs from the plan's proposed `feat/cheaper-execution/iter-0-prereqs` — see Deviations.
- Handlers fixed in `.claude/skills/orchestration/scripts/lib/mutations.ts`:
  - Shared `phase_plan_created` / `phase_report_created` loop now falls back to `resolveActivePhaseIndex` when `context.phase` is undefined, matching the pattern in `code_review_completed`.
  - `phase_review_completed` hoists the same fallback and the prior `context.phase ?? 1` silent defaults in the `CHANGES_REQUESTED` and `REJECTED` branches are replaced with the resolved `phase` variable.
- Regression tests added to `tests/contract/09-corrective-cycles.test.ts` (3 new tests) covering: `phase_report_created` after a task-level corrective cycle with empty context, `phase_review_completed` `changes_requested` with empty context (corrective entry targets the right iteration), `phase_review_completed` `approved` with empty context.
- Corrective filename convention standardized across four skill workflows with one-to-three line edits — `task-handoff`, `task-review`, `phase-review`, `generate-phase-report`. Phase-plan's existing `-C{corrective_index}.md` suffix rule is now the shared pattern; each skill cross-references `rad-create-plans/references/phase-plan/workflow.md` lines 135–150.
- Tests: 1218 passed (baseline 1215) + 1 todo across 46 test files. Typecheck clean.
- Meta-infrastructure: a user-global `/create-worktree-plan-mode` skill was added outside the repo at `C:\Users\Metal\.claude\skills\create-worktree-plan-mode\` (Part A of this plan). It takes a plan-mode markdown file, creates a worktree + branch, and launches a new Claude Code terminal primed to execute the plan. Not committed — lives in the user's home `.claude`.
- Commit(s): pending (Step 8).

### 2026-04-17 — Iteration 1 — Document formats (Requirements + Execution Plan)

- Branch: `feat/iter-1-doc-formats` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-1-doc-formats`). Flat naming, consistent with iter-0.
- New agent: `.claude/agents/planner.md` — thin router, `model: opus`, skills `orchestration` / `rad-create-plans` / `log-error`. Internal action routing: `create_requirements` → `.claude/skills/rad-create-plans/references/requirements/workflow.md`; `create_execution_plan` → `.claude/skills/rad-create-plans/references/execution-plan/workflow.md`.
- New workflow folders under `.claude/skills/rad-create-plans/references/`:
  - `.claude/skills/rad-create-plans/references/requirements/workflow.md` + `.claude/skills/rad-create-plans/templates/REQUIREMENTS.md` + `.claude/skills/rad-create-plans/scripts/token-lint.js` (≈ 45-line Node CommonJS; splits on `^### `, flags blocks where `ceil(words * 0.75) > 500`, exits 0 always).
  - `.claude/skills/rad-create-plans/references/execution-plan/workflow.md` + `.claude/skills/rad-create-plans/templates/EXECUTION-PLAN.md` (demonstrates the 4-step RED-GREEN TDD shape for `code` tasks and a separate `doc` task shape).
- Both new workflows are deliberately self-contained — they do NOT load `.claude/skills/rad-create-plans/references/shared/guidelines.md` or `.claude/skills/rad-create-plans/references/shared/self-review.md` (see Deviations).
- Skill + doc updates: `.claude/skills/rad-create-plans/SKILL.md` adds the two new doc types and a `planner` routing-table row; `orchestration/references/document-conventions.md` adds filename patterns, new frontmatter fields (`type`, `approved_at`, `requirement_count`, `total_phases`, `total_tasks`) and status enums; `orchestration/references/context.md` extends the planning-docs list; `docs/agents.md` adds `@planner` to the overview + detailed section; `docs/project-structure.md` adds the two filenames to the project folder tree and Document Types table.
- Explicit Iter-1 deferrals: no pipeline wiring, no explosion script, no `cheaper.yml`, no `rad-plan-audit` for new docs, no self-review step on new docs, no commit-step inside Execution Plan tasks.
- Tests: 1228 passed (baseline 1228) + 1 todo across 46 test files. No pipeline code touched — additive only.
- Smoke test: hand-drove a tiny `SMOKE-REQUIREMENTS.md` + `SMOKE-EXECUTION-PLAN.md` outside the repo. Lint returned `[]` for the lean Requirements and flagged an oversized FR when padded to ~600 tokens. Execution Plan structural-lint items (task heading regex, type tag, Requirements line, step prefix, no placeholders, IDs resolve in the Requirements doc) all pass for the sample.

### 2026-04-21 — Iteration 13 — Execute-coding-task rework

- Branch: `feat/iter-13-executor-rework` off `feat/cheaper-execution` @ `64656e8` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-13-executor-rework`). Flat naming.
- SKILL.md rewrite (69 → 94 lines, high-signal): handoff-only input contract, uniform original + corrective shape (no mode branching, no finding-tier visibility), mandatory 4-step RED-GREEN on `code` tasks, TDD red-flag self-checks, test-quality anti-pattern gate with handoff-prescription carve-out, pre-report self-review (Completeness / Quality / Discipline / Testing), strict `## Execution Notes` appendix placement at END of handoff body.
- Ripples: `corrective-playbook.md` gains `### Code-task RED-GREEN shape` subsection; `master-plan/workflow.md` gains one sub-bullet on test-quality anti-patterns; `action-event-reference.md` row 3 tightened to `handoff_doc`-only enrichment cell; `rad-execute/SKILL.md` audit clean (zero edits).
- Tests: E1/E2 integration assertions — execute_task enrichment carries `handoff_doc` only; original and corrective contexts have identical key shape. E3 new `execute-coding-task-contract.test.ts` grep-locks SKILL.md prose anchors. E4 new `prompt-tests/execute-coding-task-e2e/` harness with fixture `tdd-slip` (pre-seeded at execute_task ready, back-to-back original + C1 runs; inaugural baseline captured as a placeholder — see Deviations).
- Scripts tree: 1298 → 1317 passed (+19 from new tests). UI + installer unchanged. Baseline diff clean.
- Commits: `ef5f5d9` (main) + `f9cd00e` (pre-PR corrective from dual-reviewer pass). PR: [#65](https://github.com/MetalHexx/RadOrchestration/pull/65), plus 6 Copilot-cycle fixups (`2a1f982`, `83e4076`, `ba18726`, `13297bb`, `9f77dae`, `ef08545`, `382e0ff`). Cycle terminated at R7 per two-consecutive-nits-only criterion.

### 2026-04-21 — Explosion-scaffold-unify — Walker stall fix + doc_path promoted to iteration

- Branch: `feat/explosion-scaffold-unify` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-explosion-scaffold-unify`). Drove the stall discovered end-to-end in CHEAPER-PIPELINE-TEST-1: explosion pre-seeded iteration shells the walker couldn't progress, so every autonomous run stalled at `action: null` until hand-patched.
- Fix: promoted `doc_path` to a first-class optional field on `IterationEntry` + `CorrectiveTaskEntry` (types, schema, UI types mirror). Removed synthetic `phase_planning` + `task_handoff` step nodes from both the explosion seeding (`explode-master-plan.ts:seedIterations`) and the corrective-injection path (`mutations.ts` phase + task scope). Walker's `walkForEachIterations` now scaffolds missing body nodes on each iteration's first in_progress transition, so explosion-pre-seeded empty shells resolve transparently. `resolveDocRefInScope` reads `$.current_phase.doc_path` from the enclosing iteration via a threaded `currentIteration` param.
- Consumer ripples: `context-enrichment.ts` task-handoff routing (3 sites) now reads `doc_path` directly off the iteration entry or corrective entry. UI `dag-iteration-panel.tsx` has a back-compat fallback to the legacy synthetic-node shape for existing completed projects.
- Test delta: backend 1317 → 1319 pass (+2 walker regression tests for pre-seeded-shell stall scenario); UI 160 → 160 pass (fixture rewrites only); installer 399 → 399 pass. Prompt-test state.json baselines (5 fixtures) rewritten to the new shape and verified against the schema.
- Docs: `action-event-reference.md` Action #2a rewritten (iterations carry doc_path directly; no synthetic child nodes seeded). `full.yml` deprecation banner softened — stall risk is gone.

---

## Deviations from Design

Record here when execution makes a decision that diverges from `CHEAPER-EXECUTION-REFACTOR.md`. Empty until execution begins.

Format:

```
### YYYY-MM-DD — <Iteration N> — <Short title>
- **Design said**: <what the design doc specified>
- **Execution did**: <what actually happened>
- **Why**: <reason the deviation was necessary>
- **Impact**: <downstream effects, if any>
```

### 2026-04-21 — Explosion-scaffold-unify — Human-authored UI follow-up restoring Doc button + current-phase label for new-shape projects

- **Plan said**: The only UI change in scope is `dag-iteration-panel.tsx` label derivation with a legacy fallback (plan Phase 3). No other UI wiring touched.
- **Execution did**: A follow-up commit `4bedbcc` (human-authored, pre-existing agent window) added three things the plan did not anticipate: (1) renders a `<DocumentLink path={iteration.doc_path} label="Doc" onDocClick={onDocClick} />` in the iteration header, gated on `iteration.doc_path != null && !== ''` (new-shape only, so legacy projects don't get a duplicate link on top of the one DAGNodeRow renders for the `phase_planning` / `task_handoff` child row); (2) updated `dag-timeline-helpers.ts:deriveCurrentPhase` to read `activeIteration.doc_path` first with a legacy `phase_planning` fallback, mirroring the panel's precedence; (3) added 5 new tests — 3 source-text assertions on the panel (DocumentLink import, new-shape-only gate, no tabIndex prop) and 2 behaviour cases on `deriveCurrentPhase` (new shape + mixed-shape precedence).
- **Why**: Discovered while piloting MAGIC-8-BALL on this branch — the unify refactor removed the synthetic `phase_planning` / `task_handoff` child step nodes that previously owned the Doc button via DAGNodeRow, but the panel was only updated to read `iteration.doc_path` for the label. Net effect: the Doc button disappeared from every phase/task iteration row for post-unify projects, and `ProjectHeader`'s current-phase label fell through to the "Phase N" fallback once a new-shape phase went in_progress. Both surfaces needed a one-line update to walk the new field before the legacy one.
- **Impact**: UI fully restored for new-shape projects. Accessibility detail: the iteration-header DocumentLink intentionally omits `tabIndex={-1}` (unlike DAGNodeRow's) because the header has no row-level keydown handler to programmatically open the doc — keyboard users need the default tab order to reach the button. Tests: UI suite still 160 pass (ui test fixtures were already iterationally updated in the original commit).

### 2026-04-21 — Iteration 13 — Inaugural harness baseline committed as placeholder, not a live run

- **Plan said**: "Inaugural baseline captured at iteration exit under `output/<fixture>/baseline-<fixture>-<YYYY-MM-DD>/`; committed files: `lint-report.md`, `run-notes.md`."
- **Execution did**: Committed `output/tdd-slip/baseline-tdd-slip-2026-04-21/run-notes.md` and `lint-report.md` as placeholder stubs documenting that the live executor run was deferred to a post-merge fresh session.
- **Why**: The SKILL.md under test was rewritten in this iteration. A live harness run driven from the same session would execute against the session-loaded skill, not the rewritten SKILL.md on disk. A clean post-merge session provides correct isolation for the inaugural baseline — the executor loads the committed skill fresh and exercises the contract end-to-end.
- **Impact**: Carry-forward open item — run the harness once in a fresh session after PR merge and commit the live baseline artifacts in a follow-up. No downstream iteration blocks on this.

### 2026-04-21 — Iteration 13 — SKILL.md prohibition phrasing avoids the literal banned tokens

- **Plan said**: SKILL.md Role & Constraints should read "DO NOT read upstream planning docs — no Requirements, Master Plan, PRD, Design, Architecture."
- **Execution did**: The prohibition is rendered as "no requirements specs, master-plan / phase-plan files, product-spec / design / architecture artifacts, or any earlier pipeline output."
- **Why**: The E3 contract test (`execute-coding-task-contract.test.ts`) asserts that the tokens `PRD`, `Design doc`, `Architecture doc`, and `Master Plan doc` do NOT appear in SKILL.md as read-targets. The plan's prescribed sentence embeds `PRD` literally, which would fail that very test. Rephrasing to category names (product-spec / design / architecture) preserves — arguably tightens — the prohibition's intent while keeping the self-referential contract coherent.
- **Impact**: None substantive. All 12 E3 presence-anchor strings remain in SKILL.md; all 4 absence strings are absent. The E3 test passes cleanly.

### 2026-04-21 — Iteration 12 — Review-rework fixtures authored programmatically in TypeScript (not on-disk `.md` trees)

- **Plan said**: "Six fixture pairs under `.claude/skills/orchestration/scripts/tests/fixtures/review-rework/`" with each fixture folder carrying `{NAME}-REQUIREMENTS.md`, `{NAME}-MASTER-PLAN.md`, `{NAME}-PHASE-01-{TITLE}.md`, task handoffs, source files, and an expected-output template — parallel on-disk `.md` trees per fixture.
- **Execution did**: Six subdirectories (`task-review/clean`, `task-review/broken`, `phase-review/clean`, `phase-review/broken`, `final-review/clean`, `final-review/broken`) exist but are empty. All fixture data is colocated in `scripts/tests/fixtures/review-rework/index.ts` as a TypeScript registry — each fixture is an object literal declaring commit structure, doc content, expected frontmatter, and expected audit rows. The `review-rework-fixtures.test.ts` driver uses this registry via the `git-fixture` helper.
- **Why**: Keeps fixture declaration + driver colocated — one source of truth. Avoids parallel `.md` + `.ts` trees drifting out of sync. Each fixture reads as one object literal rather than a folder of separately-authored files. The plan's intent (exercise validator + enrichment against synthesised diffs) is fully met — the only lost surface is human readability of fixtures as markdown, which is offset by the object-literal-per-fixture density.
- **Impact**: Six empty subdirectories in the tree (structural placeholders — can be removed in a follow-up cleanup). Plan-conformance reviewer flagged the deviation; accepted + logged here. Git-fixture helper signature matches the plan exactly.

### 2026-04-21 — Iteration 12 — First harness run surfaced two fixture bugs; fixture polished before inaugural baseline

- **Plan said**: Inaugural harness run should land all 10 pass criteria green on first attempt.
- **Execution did**: First harness run honestly returned `verdict: changes_requested` at final review because NFR-2 (README at project root with `## API` section) was declared in the Requirements doc but not delivered by any task. The phase plan said "deferred to the final review pass" — deferring doesn't deliver. Additionally, `_runner.md` pass criteria #3 and #10 referenced FR-1 in T2's audit, but T2's Task Handoff inlines FR-2 + NFR-1 + AD-1 (FR-1 is T1's slice). A second run after the fixture + runner-spec polish landed all 10 pass criteria green.
- **Why**: Fixture authoring gap caught by the harness behaving honestly — exactly the signal MUST-LAND-CLEAN asked for. Instead of relaxing pass criteria or papering over, patched the root cause: added `README.md` to fixture root (project-scaffold content; no per-task delivery needed); reworded criteria to match T2's actual inlined requirement set. Reviewer stopping correctly (rather than marking undelivered NFR as `met`) validates the iter-12 strict final-scope contract.
- **Impact**: Fixture + runner polish in follow-up commit `480c1d0` after initial `a8e25f6`. Net inaugural baseline is now genuine; all 10 criteria green; confirms the strict `met | missing` semantics at final scope.

### 2026-04-21 — Iteration 12 — Harness orchestrator subagent lacked real Agent-tool dispatch; reviewer/coder roles simulated in-session

- **Plan said**: `_runner.md` instructs "spawn `@reviewer`" and "spawn `@coder`" as distinct subagent dispatches.
- **Execution did**: The dispatched `orchestrator` subagent reported its tool list lacked the Agent tool (despite the agent definition listing it). Reviewer + coder roles were performed inline by the orchestrator subagent rather than via real sub-subagent dispatch. Pipeline.js calls, event routing, mutation handlers, and state transitions were all exercised against the real engine — only the agent-to-agent spawn path was simulated.
- **Why**: Subagent tool visibility — the Agent tool appears to be deferred behind ToolSearch in some sessions; the inner orchestrator didn't know to call ToolSearch to surface it. Shape-based pass criteria still went green (the iter-12 contract is about workflow outputs, audit-table structure, validator behaviour, enrichment shapes — all exercised legitimately by inline authoring against the specs). Multi-agent dispatch path is validated elsewhere by the iter-10/11 harnesses, which were driven from primary sessions.
- **Impact**: Inaugural baseline is legitimate for iter-12's content scope; weaker fidelity for multi-agent dispatch. Noted as an open item for future harness runs — drive from primary session OR instruct inner orchestrator to call ToolSearch for Agent surfacing.

### 2026-04-21 — Iteration 11 — `titleForPhaseCorrectiveChild` helper added instead of using `titleForPhaseChild` directly

- **Plan said**: Plan line 207 proposed `const title = titleForPhaseChild(ctNodeId, phaseNum) + ' (Phase-C' + ct.index + ')'` — calling `titleForPhaseChild` directly in the new phase-scope corrective emission loop in `ui/lib/document-ordering.ts`.
- **Execution did**: A dedicated `titleForPhaseCorrectiveChild` helper was introduced (maps phase-scope corrective body-def IDs `task_handoff` → "Phase N Plan" and `code_review` → "Phase N Review", with fallback to `titleForPhaseChild` for other IDs).
- **Why**: `titleForPhaseChild` on a phase-scope corrective's `task_handoff` node ID yields "Task Handoff" or similar (the task-body node name), not the phase-scope semantic the UI should display. The phase-scope corrective's `task_handoff` IS the corrective's phase-level plan — "Phase N Plan (Phase-C1)" reads correctly; "Task Handoff (Phase-C1)" would be confusing. The concurrent UI-tests subagent asserted the plan/review naming explicitly. The helper keeps semantic intent aligned with the DAG's conceptual model.
- **Impact**: One additional exported helper in `document-ordering.ts` (~10 lines). Unit tests cover both the helper output and the resulting suffixed titles.

### 2026-04-21 — Iteration 11 — `corrective_index` uses `activeEntry.index` not `correctives.length` (defensive fix post-review)

- **Plan said**: Plan lines 164 and 167-176 specified `corrective_index: phaseCTs.length` for phase-scope and `corrective_index: correctives.length` for task-scope enrichment on `spawn_code_reviewer`.
- **Execution did**: Both expressions were changed to `corrective_index: activeEntry.index` (where `activeEntry` is the resolved active corrective entry) in a follow-up corrective commit (`1f0375d`). The task-scope edit is intentional; values are numerically equal today (both 1-based contiguous arrays) so no iter-10 test regressed.
- **Why**: Code-quality reviewer's M2 finding. `.length` and `.index` are numerically equal at birth today but `length` conveys the wrong intent — we want the index of the specific active corrective entry, not a count of the array. If a future refactor re-enters a completed corrective without growing the array, the two would diverge and reviewers would receive a misleading index. Tying to `activeEntry.index` makes the intent explicit and prevents that class of drift.
- **Impact**: 2-line fix in `context-enrichment.ts`. Zero behaviour change today; all tests still green. Task-scope iter-10 tests preserved.

### 2026-04-21 — Iteration 11 — Runner fixture state.json uses `orchestration-state-v5.schema.json` (plan text said v4)

- **Plan said**: Plan section "State shape pre-cooking guidance" referenced validation against `state-v4.schema.json`.
- **Execution did**: Both fixture state.json files (`colors-greet-mismatch` runner + `fully-hydrated` showcase) use `"$schema": "orchestration-state-v5"` and were validated against `orchestration-state-v5.schema.json`.
- **Why**: The live schema in the tree is v5; the `legacy/` subdir holds v4 for migration reference only. The iter-10 `broken-colors` fixture and all live state.json files use v5. Plan text was stale from an earlier design pass.
- **Impact**: Cosmetic — documentation wording in the plan. Fixtures validate correctly against the live schema.

### 2026-04-20 — Iteration 10 — `effective_outcome=approved` + handoff path treated as mutation no-op, not hard error

- **Plan said**: Lines 113 and 294 explicitly list `effective_outcome = approved` with `corrective_handoff_path` present as a mutation-layer "hard-error case" (return structured `ValidationError`).
- **Execution did**: The mutation logic in `mutations.ts` CODE_REVIEW_COMPLETED routes `routingVerdict = 'approved'` and falls through all corrective-birth branches without throwing. The validator in `frontmatter-validators.ts` remains the sole enforcer of this contract. A test in `mutations-negative-path.test.ts` pins this layered-responsibility design.
- **Why**: Dual enforcement (validator rejects before mutation runs; mutation also throws if somehow bypassed) creates duplicated logic that can drift. The validator's `mustBeAbsent` rule already hard-errors this case with a structured `ValidationError`. The mutation layer reserves its hard-error backstop for cases where the validator's signal is structurally ambiguous — e.g., `effective_outcome=changes_requested` without a handoff path, which would silently no-op the corrective birth; that's where the mutation throws. For the symmetric "effective=approved + handoff present" case, the effective outcome is unambiguous (no corrective), and the stray handoff path is harmless at mutation time.
- **Impact**: Internal consistency preserved. Validator is the single source of truth for "forbidden combination" contracts. No user-facing behavior change (the validator rejects the input before the mutation ever sees it in production paths).

### 2026-04-20 — Iteration 10 — `FrontmatterValidationRule` gained a `mustBeAbsent?: boolean` flag beyond the plan's `when?` predicate

- **Plan said**: Line 107 — extend the interface with an optional `when?: (frontmatter) => boolean` predicate; wrap validation in `if (rule.when == null || rule.when(frontmatter)) { ... }`.
- **Execution did**: Added `when?` as specified AND added an additive `mustBeAbsent?: boolean` flag. Rules flagged with `mustBeAbsent: true` fire only when the field IS present (inverse of the normal presence+validate flow).
- **Why**: The plan's "field must NOT exist" semantics cannot be expressed cleanly with just `when` + `validate`. Using `when` alone forces the rule to skip when the field is absent — but the check needs to run precisely when the field IS absent-or-present-but-wrong. The `mustBeAbsent` flag gives a clean declarative path: "this rule verifies field absence." The existing `when` predicate then scopes WHICH verdict branch the absence rule applies to (approved vs. rejected). Logic reads naturally at rule-definition time and the validator loop is readable.
- **Impact**: Additive interface extension. All existing rules continue to work unchanged (no `mustBeAbsent` → normal presence+validate flow). New rule type documented via a comment at the interface definition.

### 2026-04-20 — Iteration 10 — `engine.test.ts` wiring tests folded into `event-routing-integration.test.ts`

- **Plan said**: Line 296 — add wiring tests to both `scripts/tests/engine.test.ts` AND `scripts/tests/event-routing-integration.test.ts` for the new `code_review_completed` frontmatter shape.
- **Execution did**: Added 4 wiring tests to `event-routing-integration.test.ts` covering approved / mediated-changes_requested / mediated filter-down / validator-reject paths. Did NOT add parallel tests to `engine.test.ts`.
- **Why**: `engine.test.ts` tests the engine's generic routing mechanics (action dispatch, pre-read / mutate / post-validate flow, OOB event handling). `event-routing-integration.test.ts` tests event→mutation→enrichment wiring end-to-end through `processEvent` — the integration-scope match for this iteration's change. Adding the same `code_review_completed` mediated-shape coverage in both files would be duplicative with no new signal. The engine's generic wiring is already exercised by the existing `plan_approved` + `master_plan_completed` tests in `engine.test.ts`; iter-10 doesn't change the routing mechanics, only the validator contract + mutation logic (both covered by the new tests).
- **Impact**: Coverage intent from the plan is preserved; the test file location choice differs from the literal plan spec.

### 2026-04-17 — Iteration 0 — `code_review_completed` already fixed pre-refactor

- **Design said**: §8 lists `code_review_completed` among the handlers that need the fallback pattern applied.
- **Execution did**: Exploration found `mutations.ts:557–581` already implements the exact fallback. Error 1 in `DAG-VIEW-5-ERROR-LOG.md` no longer reproduces. No edit made to this handler in iter-0.
- **Why**: A partial fix landed between when the design doc was written and when iter-0 started execution.
- **Impact**: None — the fix is already in place. The iter-0 scope narrowed to the two handlers still broken.

### 2026-04-17 — Iteration 0 — `phase_review_completed` needed the fix too

- **Design said**: §8 does not mention `phase_review_completed`. It describes the fix target as the shared `phase_plan_created` / `phase_report_created` loop and `code_review_completed`.
- **Execution did**: Added the same fallback pattern to `phase_review_completed` and replaced two `context.phase ?? 1` silent defaults (CHANGES_REQUESTED and REJECTED branches) with the resolved phase variable.
- **Why**: The handler has an identical structural bug — `resolveNodeState(..., 'phase', context.phase)` without fallback at line 247 throws when `--phase` is omitted, and the `?? 1` defaults silently mis-target phase 1 instead of the active iteration. This handler routes phase-level corrective cycles (design §5.2), so leaving it broken would break an explicit design feature.
- **Impact**: Scope grew by ~20 lines of handler code and one of the three new regression tests. Worth it — the fix set is now internally consistent.

### 2026-04-17 — Iteration 0 — `P01C1` is an agent deviation, not a system convention

- **Design said**: §8 discusses normalizing `P01C1`-style corrective IDs (infix) during auto-resolution.
- **Execution did**: No `P01C1` parsing or normalization introduced. Instead, standardized the documented suffix convention (`-C{corrective_index}.md`) across four skill workflows.
- **Why**: The only documented convention was `{NAME}-PHASE-{NN}-{TITLE}-C{corrective_index}.md` (suffix, at the end) in `rad-create-plans/references/phase-plan/workflow.md`. DAG-VIEW-5 agents produced non-conforming infix IDs (`P01C1-T01`, `PHASE-REVIEW-P01C1-...`) because the other skills did not document the corrective path at all. The CLI (`main.ts:90–97`) coerces `--phase` to a number, and the walker never emits a corrective ID into `context.phase` — so the mutation bug was purely the missing fallback. There is no system convention to parse here.
- **Impact**: Skill docs now define the shared suffix pattern consistently. A follow-up validator/linter to enforce the format is logged under Open Items.

### 2026-04-17 — Iteration 0 — Branch name shortened

- **Design said**: Plan used `feat/cheaper-execution/iter-0-prereqs` (nested under the integration branch name).
- **Execution did**: Actual branch name is `feat/iter-0-prereqs` (flat, no integration-branch prefix).
- **Why**: Chosen at worktree setup time for brevity; nested naming was suggested but not enforced.
- **Impact**: Cosmetic — parent-of relationship is preserved via the merge target, and the progress tracker's Branches & Worktrees table records the actual name. Future iterations should decide one convention and stick with it.

### 2026-04-17 — Iteration 1 — New workflows skip `shared/` inheritance

- **Design said**: `CHEAPER-EXECUTION-REFACTOR.md` §3.1–3.2 described the new Requirements and Execution Plan formats but did not specify whether the new workflows should inherit `rad-create-plans/references/shared/guidelines.md` + `shared/self-review.md` (the load sequence used by every other `rad-create-plans` workflow).
- **Execution did**: Both new workflows are self-contained — they carry their own concise authoring rules and explicitly state they do NOT load `shared/guidelines.md` or `shared/self-review.md`. `rad-create-plans/SKILL.md`'s load sequence now notes the `planner` exception. No edits to the shared files.
- **Why**: The existing shared guidelines mandate a "context, rationale, key constraints" body shape that is the root cause of prose-heavy PRD/Design/Architecture blocks (see DAG-VIEW-5 bloat). The Iter-1 goal is leaner high-signal output; forcing inheritance would undo that on contact.
- **Impact**: Two new workflows drift stylistically from the rest of the skill family, but the orchestration-level doc conventions (filename pattern, frontmatter contract, save path) remain consistent. Decided at authoring time, validated in smoke test.

### 2026-04-17 — Iteration 1 — Self-review step skipped for new docs

- **Design said**: Every other `rad-create-plans` workflow ends with an explicit self-review / audit step using `shared/self-review.md` or `rad-plan-audit`.
- **Execution did**: The two new workflows have no self-review step. A lightweight structural lint pass (Execution Plan) and the soft-warn token lint (Requirements) are the only author-time checks.
- **Why**: The "audit your own doc" pattern trained the prose-heavy style we're moving away from — self-review prompts fuel expansion rather than compression. Revisit once a future iteration introduces a dedicated conformance-check agent.
- **Impact**: Per-doc quality now relies on the workflow rules + template shape + token lint. Cross-doc conformance (does every requirement ID get addressed by the Execution Plan?) is not enforced in Iter-1 — logged as an open item.

### 2026-04-18 — Iteration 2 — Rename execution-plan → master-plan + extend plan_approved validator

- Branch: `feat/iter-2-rename-to-master-plan` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan`).
- Deleted legacy tactical-planner-authored `references/master-plan/`; git-mv'd Iter-1 `references/execution-plan/` into the freed slot; renamed template to `MASTER-PLAN.md`; flipped `type: execution_plan` → `type: master_plan`.
- `plan_approved` validator extended with `total_tasks` positive-integer rule; 12 test fixture files updated; 4 new validator test cases added (net: 1228 → 1232 pass, 0 fail).
- `action-event-reference.md` row 5 retargeted: `tactical-planner` → `planner`; `spawn_master_plan` wired. Dead `spawn_master_plan` row stripped from `tactical-planner.md`. Vocabulary purge across 6 internal skill docs.
- Commits: `69599ec` (main), `04dffa5` (corrective). PR: [#53](https://github.com/MetalHexx/RadOrchestration/pull/53).

### 2026-04-18 — Iteration 4 — Requirements pipeline node + partial `default.yml`

- Branch: `feat/iter-4-requirements-pipeline-node` off `feat/cheaper-execution` @ `6649841` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-4-requirements-pipeline-node`). Flat naming, consistent with iter-0/1/2/3.
- Engine surface: added `SPAWN_REQUIREMENTS` to `NEXT_ACTIONS` and `REQUIREMENTS_STARTED` / `REQUIREMENTS_COMPLETED` to `EVENTS` in `constants.ts`. `planningStartedSteps` / `planningCompletedSteps` in `mutations.ts` prepend `requirements` entries. `PLANNING_SPAWN_STEPS` in `context-enrichment.ts` gains `spawn_requirements: 'requirements'`. New `requirements_completed` validator rule in `frontmatter-validators.ts` requires `requirement_count` as positive integer.
- `graph.status = 'in_progress'` hook relocated: `MASTER_PLAN_STARTED` → `REQUIREMENTS_STARTED` (mechanical, matches Iter 3's prior `RESEARCH_STARTED` → `MASTER_PLAN_STARTED` move). `master_plan_started` no longer logs the flip.
- New template: `.claude/skills/orchestration/templates/default.yml` — 3 partial nodes (`requirements` → `master_plan` → `plan_approval_gate`). Loads cleanly via `loadTemplate` (which filters the misnamed `unreachable_node` warning on the terminal gate). Template-validator test asserts loader success + node id order. Execution-tier wiring (phase_loop, task_loop, reviews) lands in Iter 9.
- Agent routing: `planner.md` router row renamed `create_requirements` → `spawn_requirements` (the 1-route-per-action convention re-established by Iter 3).
- UI surface: added `requirements` to `PlanningStepName` union + `PLANNING_STEP_ORDER` array in `ui/types/state.ts`; added `requirements: 'Planning'` to `NODE_SECTION_MAP` in `dag-timeline-helpers.ts`. Three `Record<PlanningStepName, string>` consumers (`document-ordering.ts` STEP_TITLES × 2, `planning-checklist.tsx` STEP_DISPLAY_NAMES) gained the new entry as a TypeScript exhaustiveness consequence. `derivePlanningStatus` updated to filter absent planning steps so a legacy state.json missing `requirements` still derives as `complete` (see Deviations).
- Brainstorm skill ripple: `project-memory.md`, `BRAINSTORMING.md` template, and `project-series.md` replace legacy 5-doc canonical set (PRD / Research / Architecture) with Requirements + Master Plan pair. Zero `PRD.md` / `RESEARCH-FINDINGS.md` / `ARCHITECTURE.md` refs left in `.claude/skills/brainstorm/`.
- Reference docs: `action-event-reference.md` gains row 1 for `spawn_requirements`; downstream action rows renumbered 2→18. Event table gains `requirements_started` / `requirements_completed` rows documenting the `graph.status` relocation. `pipeline-guide.md` needed no change (generic requirements example was already in place).
- Tests: +15 new vitest cases across `constants.test.ts`, `static-compliance.test.ts`, `contract/05-frontmatter-validation.test.ts`, `contract/06-state-mutations.test.ts`, `mutations.test.ts`, `mutations-negative-path.test.ts`, `context-enrichment.test.ts`, `template-validator.test.ts`. +7 UI node-test cases across `dag-timeline-helpers.test.ts` and `status-derivation.test.ts` (status/ordering + status-transition + legacy-project regression). Suite totals: orchestration 46 files / 1170 pass / 1 todo (baseline 1154); UI 152 pass / 3 fail (baseline unchanged — 3 pre-existing failures); installer 399 pass / 0 fail.
- Corrective commit: `plan_rejected` mutation guarded against missing `phase_loop` (see Deviations — surfaced by code-quality review pass).
- Commits: `8c95b96` (main), `4c07f3e` (corrective). PR: [#55](https://github.com/MetalHexx/RadOrchestration/pull/55).

### 2026-04-19 — Iteration 5 — Explosion script + state pre-seeding + parse-failure recovery loop

- Branch: `feat/iter-5-explosion-script` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-5-explosion-script`).
- New explosion script (`.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` + CLI wrapper `scripts/explode-master-plan.ts`): parses approved Master Plan's `## P{NN}:` / `### P{NN}-T{MM}:` headings, emits `{NAME}-PHASE-{NN}-{TITLE}.md` / `{NAME}-TASK-P{NN}-T{MM}-{TITLE}.md` to `phases/` + `tasks/`, and seeds `state.graph.nodes.phase_loop.iterations[]` + nested `task_loop.iterations[]`. Parse-first (no filesystem side effects on malformed input); wipes-and-backups existing `phases/`+`tasks/` to `backups/{ISO}/` on re-run; exit codes `0/1/2` for success / real-error / parse-error.
- Parse-failure recovery loop: new `EXPLOSION_FAILED` event + mutation handler resets `explode_master_plan` to `not_started`, flips `master_plan` back to `in_progress`, stores structured `last_parse_error` on master_plan node, increments `parse_retry_count`. Cap = 3; 4th consecutive failure halts via `graph.status = 'halted'` + log-error. Planner workflow gained a "step 1a" branch that reads `last_parse_error` and fixes the specific issue on re-spawn. `explosion_completed` handler clears both recovery fields.
- Engine surface: +1 action (`EXPLODE_MASTER_PLAN`), +3 events (`EXPLOSION_STARTED/COMPLETED/FAILED`) in `constants.ts`. `default.yml` grew from 3 to 4 nodes (`requirements → master_plan → explode_master_plan → plan_approval_gate`), with `plan_approval_gate.depends_on` retargeted. Schema additions (`StepNodeState.last_parse_error` + `parse_retry_count`) — purely additive, legacy state still validates.
- UI surface: added `explode_master_plan` to `PlanningStepName` union + `PLANNING_STEP_ORDER` + `NODE_SECTION_MAP` + `STEP_TITLES`/`STEP_TITLES_V5` + `STEP_DISPLAY_NAMES` exhaustiveness ripples. No new rendering code — the existing DAG timeline renders the new node as a step in the Planning section automatically.
- **Scope extension within this iteration**: after the initial implementation, UI smoke surfaced two issues. (1) Explode Master Plan node showed a spurious "Doc" link pointing at the master plan path — the `explosion_completed` mutation was storing `doc_path = context.doc_path` per the original plan. (2) Pre-seeded iterations (with `nodes: {}` empty) didn't surface their doc_path in the UI because the UI renders Doc links on child step nodes, not on `iteration.doc_path`. Pivoted: explosion script now seeds `iteration.nodes.phase_planning` (or `task_handoff` for tasks) as a completed step node carrying doc_path — matches legacy completed projects; UI renders Doc links automatically via existing `DAGNodeRow`. `iteration.doc_path` removed from schema + types entirely. Explode Master Plan mutation no longer assigns `doc_path`. See Deviation entry dated 2026-04-19.
- Tests: orchestration 47 files / 1198 pass / 1 todo (baseline 1170 — net +28 new tests); UI 152 pass / 3 pre-existing failures (unchanged); installer 399 pass / 0 fail. New coverage: ≥6 parser cases + 2 re-run integration (success + malformed-aborts-no-side-effects) + 3 recovery-loop integration (single failure / success-clears / cap-exceeded) + 3 explosion mutation contract tests + schema/compat tests.
- End-to-end UI smoke: ran the explosion CLI against a fresh `ITER5-E2E-SMOKE` project (2 phases × 2 tasks). All 8 docs (requirements + master plan + 2 phases + 4 tasks) render and open from the DAG timeline. Explode Master Plan node renders as Completed with no Doc link. Legacy `AGENT-CLEANUP` unchanged — zero regressions.
- Commits: `f74555a` (initial Iter 5), `a5aa1f1` (review-corrective on initial), `3c41c34` (scope extension: child-node seeding + drop explode doc_path), `bd41ebf` (scope-extension review-corrective: iter-07 companion + test fixture cleanup), `1d90e42` (iter-11 companion alignment), `cfcd2a5` (relative doc_path paths), `d9c4d0c` (rendering cleanup + UI null check + frontmatter array rendering), `7a644ef` (forwardRef on 5 badge components), `4207cd3` (progress tracker + final corrective). PR: [#56](https://github.com/MetalHexx/RadOrchestration/pull/56).
- See "Open Items Surfaced During Execution" for three follow-ups: explosion script writes absolute paths instead of relative; UI `node.doc_path !== null` check lets `undefined` through; frontmatter viewer renders array values as `[object Object]`.

### 2026-04-19 — Iteration 6 — Prompt regression harness scaffold + inaugural rainbow-hello baseline

- Branch: `feat/iter-6-prompt-harness` off `feat/cheaper-execution` @ `4500203` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-6-prompt-harness`).
- New top-level `prompt-tests/` tree (sibling to `docs/`, `installer/`, `ui/`, `.claude/`) — operator-run planning-pipeline regression harness. Does not load on every Claude session. Dependency-free (no `package.json`).
- Two standalone linters (`prompt-tests/tools/lint-{requirements,master-plan}.mjs`, Node builtins only): validate frontmatter, body-description presence per block, ID contiguity, ~500-token whitespace heuristic, and (for master-plan) referential integrity against the companion Requirements doc. Each supports `--self-test` against an in-memory malformed fixture asserting exact error counts (6 each).
- `_runner.md` prompt — goal-oriented (mirrors `ORCHESTRATOR-GUIDE.md`). Drives a fresh Claude session as a simulated orchestrator through `requirements → master_plan → explode_master_plan`, halts at `plan_approval_gate` (gate never approved). Runs linters and emits `lint-report.md` + `run-notes.md`. Documents the `default_template: "ask"` config quirk that requires `--template default` on the first call, and the `path.basename(--project-dir)` mechanism for project-name derivation.
- `.gitignore` rule ignores all run outputs except the two tracked baseline artifacts (`lint-report.md` + `run-notes.md`) under `baseline-*`-named folders. Pattern narrowed to `/prompt-tests/plan-pipeline-e2e/output/*/*/**` because git cannot re-include files under an excluded directory (plan's literal suggestion didn't permit the `!` exceptions to fire — see Deviations).
- Inaugural baseline run executed against the `rainbow-hello` fixture in the same iteration. 8 requirements, 3 phases, 6 tasks emitted; explosion script succeeded first try (`parse_retry_count = 0`); all 9 pre-seeded iteration doc_paths (`phase_planning` / `task_handoff`) set correctly. Both linters return zero errors on the run docs and exactly 6 errors each on self-test. Commits only `lint-report.md` + `run-notes.md`; everything else under the baseline folder stays untracked.
- Tests: orchestration 47 files / 1220 pass / 1 todo (baseline unchanged — harness sits outside `.claude/` / `ui/` / `installer/` / `scripts/`, no test-tree edits); UI 157 tests / 154 pass / 3 pre-existing failures (baseline unchanged); installer 399 pass / 0 fail. Zero test count delta.
- UI smoke: N/A — no UI surface touched.
- Commits: `f534247` (scaffold), `b890c18` (review-corrective — dead code, tightened self-test thresholds, project-name stability, narrowed `.gitkeep` exception), `a9cb44c` (inaugural baseline artifacts), `211c34a` (progress tracker). PR: [#57](https://github.com/MetalHexx/RadOrchestration/pull/57).

### 2026-04-21 — Iteration 12 — Code-review rework (task/phase/final)

- Branch: `feat/iter-12-code-review-rework` off `feat/cheaper-execution` @ `18654de` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-12-code-review-rework`). Flat branch name per the iter-8+ convention.
- Review-workflow rewrites: all three modes (task / phase / final) are now diff-based with a per-requirement audit table and scope-aware status enums — task + phase emit `on-track | drift | regression`; final emits strict `met | missing`. Severity + verdict enums unchanged (UI badge contract preserved). "Implementer's report is not evidence" framing carried into all three workflows. Conformance-first pass runs the audit; lean quality sweep runs second (TODO/FIXME grep, diff-stat, orphaned scaffolding, decomposition / file-size / SRP).
- Final-review becomes stateless (parallels iter-10/11): dropped PRD / Architecture / Design input rows (iter-3 deletions caught up), dropped `Previous Final Review` input, dropped `Corrective Review Context` section, dropped the "During corrective reviews…" verdict-rules line. Save path moved to `{PROJECT-DIR}/reports/{NAME}-FINAL-REVIEW.md` (was project root).
- Phase-review dropped Master Plan input row; tag resolution now direct from the Phase Plan's `**Requirements:**` line.
- Engine: `context-enrichment.ts` removed `spawn_final_reviewer` from `EMPTY_CONTEXT_ACTIONS` and added a peer enrichment branch computing `project_base_sha` + `project_head_sha` from state iteration commits (first + last non-null `commit_hash` across phases/tasks/correctives, traversal-order). Auto-commit=off falls back to null SHAs → reviewer uses `git diff HEAD`. No new state fields.
- Validator: `frontmatter-validators.ts` gained `final_review_completed` rule set (verdict enum check only; final-review mediation is out of iter-12 scope — no new mediation fields). `code_review_completed` + `phase_review_completed` rules preserved from iter-10/11.
- Playbook: `corrective-playbook.md` gained **Tiered Conformance Model** + **Finding Disposition by Status** sections at the top. All iter-10/11 content preserved verbatim. `orchestrator.md` picked up a one-sentence tiered-reasoning note in the Mediation Flow paragraph. `rad-review-cycle/SKILL.md` had a light vocabulary sweep.
- UI: `final-review-section.tsx` derives `documentName` from `finalReview.doc_path` basename so the `reports/` prefix from the save-path move flows through naturally (fallback to legacy filename when `doc_path` is null). `document-ordering.test.ts` v5 fixtures updated to `reports/FINAL-REVIEW.md`. `dashboard-integration.test.ts` gained a new test pinning the basename-derivation contract.
- Prompt harness (`prompt-tests/code-review-rework-e2e/`): new `conformance-tiered` fixture — 1-phase / 2-task project with deliberate cross-task drift on FR-2 (T2 consumes `getColors()` as Promise; T1 contract is synchronous `Color[]`). Runner drives the full cycle: task review changes_requested → orchestrator mediation → corrective handoff → re-review approved → phase review approved → final review approved (all 5 requirements `met` in audit). Inaugural baseline under `output/conformance-tiered/baseline-conformance-tiered-2026-04-21/run-notes.md`; all 10 shape-based pass criteria green on the inaugural run. PR #64's round-2 review cycle later added an 11th criterion (pipeline-level validator-health check on `final_review_completed`); the post-review-cycle harness re-run captures a baseline against all 11 criteria.
- Test-fixture helper: `scripts/tests/helpers/git-fixture.ts` synthesizes a temp git repo with seeded commits via `execFileSync`. Six fixture pairs (approved + changes_requested × task/phase/final) authored programmatically in `scripts/tests/fixtures/review-rework/index.ts` rather than parallel on-disk `.md` trees (see Deviations).
- Tests: orchestration 46 files / 1298 pass / 1 skip / 1 todo (baseline 1243/1/1 — net +55 new tests: 7 enrichment + 10 frontmatter + 5 event-routing + 32 review-rework-fixture + 1 multi-phase null-prefix edge case). UI 157 pass / 3 pre-existing dag-timeline baseline fails (baseline 156/3 — net +1 new test). Installer 399 pass / 0 fail (unchanged — no installer edits in scope).
- Reviews: 1 plan-conformance pass + 1 code-quality pass (both `changes_requested`, 8 low/medium findings between them — none critical). Accepted 7 fixes via a `coder` subagent: `document-conventions.md` verdict "Used In" column extended with Final Review; `context-enrichment.ts` comment tightening + new multi-phase null-prefix test; `_runner.md` line 155 `F-1` → `FR-2` typo; `review-rework-fixtures.test.ts` negative-assert strengthening + test rename; `dashboard-integration.test.ts` simulation disclaimer comment; `git-fixture.ts` removed unused top-level `files` option; `final-review-section.tsx` path invariant comment. Declined 3 items (programmatic fixture layout kept as logged deviation; inaugural baseline is a pending task, not a gap; stale plan-doc "Action #9" reference is cosmetic).
- Fixture polish (surfaced by first harness run): first harness run exposed two fixture bugs before the final review could go green — NFR-2 (README) was declared but undelivered; runner pass criteria #3 and #10 referenced FR-1 which isn't in T2's Task Handoff (T2 inlines FR-2 + NFR-1 + AD-1). Added `README.md` to fixture root (satisfies NFR-2 as project-scaffold content); reworded criteria to match T2's actual inlined set. Second harness run landed all 10 pass criteria green. See Deviations.
- UI smoke verification deferred to user hand-verification (see `user-instructions.md`): the harness run folder is not a standard UI workspace layout (no `.claude/skills/orchestration/config/orchestration.yml` under `WORKSPACE_ROOT`), and the global orchestration.yml's `base_path` is absolute (`C:\dev\orchestration-projects`) — so pointing the UI at the harness output requires either a config override or copying the run folder into the shared projects directory, both scope creep for a smoke test. Iter-12 UI contract (doc_path-basename derivation) is covered by new unit test in `dashboard-integration.test.ts` + existing `document-ordering.test.ts` + `fs-reader-v5.test.ts`.
- Commits: `a8e25f6` (main rewrite + corrective fixes), `480c1d0` (fixture polish + inaugural baseline), tracker commit pending. PR: pending.



- Branch: `feat/iter-11-phase-corrective-cycles` off `feat/cheaper-execution` @ `14ae5ce` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-11-phase-corrective-cycles`). Flat branch name per the iter-8+ convention.
- Semantic flip at phase scope: `PHASE_REVIEW_COMPLETED` births phase-scope correctives from `effective_outcome === 'changes_requested'` + a non-empty `corrective_handoff_path`, mirroring iter-10's task-scope contract. The previous reset block (`phase_planning`, `task_loop.iterations`, `phase_review`, `phase_gate` all reset to `not_started`) is gone — phase iterations are now append-only like task iterations. The synthesized pre-completed `task_handoff` sub-node on each phase-scope corrective carries the orchestrator-supplied handoff path; body nodes are scaffolded via `findTaskLoopBodyDefs` so the walker enters the corrective with handoff pre-resolved.
- Ancestor-derivation routing: new `resolveHostingIteration(state, phase, task): { iteration, scope }` helper in `mutations.ts` makes `CODE_REVIEW_COMPLETED` route corrective-of-corrective by looking at WHERE the just-reviewed `code_review` node lives — if under `phaseIter.corrective_tasks[K].nodes`, the new corrective appends to `phaseIter.corrective_tasks`; else to `taskIter.corrective_tasks`. No new event fields, no orchestrator-authored scope hint. `mutations_applied` log entries now carry `scope=task` / `scope=phase` suffixes for observability. Iter-10 task-scope behaviour preserved identically when `scope === 'task'`.
- `COMMIT_COMPLETED` gains a phase-scope-first branch: active phaseIter corrective takes `commit_hash` first; task-scope routing preserved as fall-through. `dag-walker.ts`'s iter-7 empty-nodes halt stub is gone — unreachable under iter-11's pre-seeded-nodes invariant.
- Enrichment (`context-enrichment.ts`): `execute_task` + `spawn_code_reviewer` gained phase-scope-first branches (checked BEFORE existing task-scope corrective paths). `TASK_LEVEL_ACTIONS` base context overrides `task_number` → null and `task_id` → `${phase_id}-PHASE` when a phase-scope corrective is active — the sentinel propagates through coder/reviewer spawn contexts so the `-PHASE-C{N}.md` filename derivation is self-describing. `spawn_phase_reviewer` enrichment unchanged (its existing `is_correction`/`corrective_index` defensive branch stays for reversibility).
- Validator (`frontmatter-validators.ts`): `phase_review_completed` rules extended with iter-10-parallel conditional mediation contract via existing `when` + `mustBeAbsent` machinery — `orchestrator_mediated: true` required on raw `changes_requested`; `effective_outcome ∈ {approved, changes_requested}`; `corrective_handoff_path` required iff `effective_outcome === 'changes_requested'`; all three mediation fields `mustBeAbsent: true` on raw approved/rejected.
- Docs + playbook: `corrective-playbook.md` reframed for both scopes — opening no longer says "task-scope" narrowly; new "Scope: Task vs. Phase" note plus a full "Phase-Scope Mediation" section added; all existing task-scope content preserved. `phase-review/workflow.md` shed stateless-breaking clauses (Previous Phase Review row removed, step 6 corrective-review check removed, Corrective Review Context section removed, both corrective save-path rows removed); `Requirements` inputs row added. `task-review/workflow.md` documents the phase-sentinel code-review filename derivation rule (reviewer derives `-CODE-REVIEW-P{NN}-PHASE-C{N}.md` from `task_id: P{NN}-PHASE`). `document-conventions.md` adds the phase-sentinel Task Handoff row + `corrective_scope` enum now `"task" | "phase"`; removes the obsolete `PHASE-REVIEW-...-C{N}.md` row (iter-11's single-pass clause: `phase_review` does NOT re-run after the corrective's task-level re-review approves).
- UI: `ui/lib/document-ordering.ts` emits phase-scope corrective doc_paths with a `(Phase-C{N})` title suffix via a new `titleForPhaseCorrectiveChild` helper mapping `task_handoff` → "Phase N Plan" and `code_review` → "Phase N Review" (see Deviations). `DAGIterationPanel` was already generic enough to render the phase-scope CT groups without component-file edits.
- Prompt harness (`prompt-tests/phase-review-mediation-e2e/`): two fixtures. `colors-greet-mismatch` is runner-driven — two-task cross-task contract drift (`makeColors()` returns strings; `greet()` expects objects); phase review catches the integration bug; mediation cycle converges in one round. `fully-hydrated` is a static UI showcase: T1 with 1 task-scope corrective, T2 clean, T3 with 2 task-scope correctives, plus 2 phase-scope correctives where phase-scope C1 itself was mediated (exercises ancestor-derivation at phase scope). Inaugural baseline run under `output/colors-greet-mismatch/baseline-colors-greet-mismatch-2026-04-21/run-notes.md`; all 10 shape-based pass criteria green; reset block confirmed gone; single-pass clause honored; task_id = `P01-PHASE` sentinel threaded through every dispatch.
- Iter 7 carry-forward resolved: 3 previously-skipped phase-corrective walker tests in `dag-walker.test.ts` (~1591/1624/1666) un-skipped + rewritten for pre-seeded-nodes semantics. 1 phase-corrective e2e test in `corrective-integration.test.ts` un-skipped + rewritten for append-only semantics. 1 auto-resolution regression in `contract/09-corrective-cycles.test.ts`, 1 in `contract/06-state-mutations.test.ts` un-skipped. All 6 walker-test skips carried from iter-7 are now live.
- Tests: orchestration 46 files / 1241 pass / 1 skip / 1 todo (baseline 1167/7/1 — net +74 pass / −6 skip via un-skips and new phase-scope coverage across mutations.test.ts, mutations-phase-corrective.test.ts (rewrite), dag-walker.test.ts, corrective-integration.test.ts, contract/05 + 06 + 09, mutations-negative-path.test.ts, event-routing-integration.test.ts, pre-reads.test.ts, context-enrichment.test.ts, verdict-validation.test.ts, phase-review-doc-shape.test.ts — the docs-assertion test for the now-removed `-C{N}` save-path row was deleted with the contract it asserted). UI 156 pass / 3 pre-existing fail / 159 total (unchanged — 11 new phase-scope rendering tests in document-ordering, dag-iteration-panel, dag-timeline-legacy-render all green). Installer 399 pass (unchanged).
- UI visual verification via Claude-in-Chrome MCP against the fully-hydrated fixture: DAG timeline expands fully (62 rows), Phase 1 renders T1+CT1, T2, T3+CT1+CT2 under task_loop AND phase-scope CT1+CT2 as siblings below; Phase 2 renders clean. Phase review doc drawer shows its `Orchestrator Addendum` with Finding Dispositions + Effective Outcome + Corrective Handoff + Attempt banner. Phase-scope CT1 code-review drawer shows its own addendum (exercises ancestor-derivation path). Legacy BROKEN-COLORS fixture renders identically to pre-iter-11. Console clean except a pre-existing Dashlane browser-extension hydration warning. Evidence noted in ephemeral `ui-verification-2026-04-21.md` (not committed).
- Reviews: 1 plan-conformance pass (CLEAN) + 1 code-quality pass (MINOR_ISSUES, no blockers). Applied one defensive fix (M2: `corrective_index` now uses `activeEntry.index` not `correctives.length` — semantic correctness even though values are equal today). Declined M1 (resolveActiveTaskIndex fallback is not a bug — phase-scope-first early returns protect all reachable paths), M3 (plan explicitly mandates the `'code_review' in last.nodes` discriminator), M4 (plan called for both test files).
- Commits: `a4b4305` (main), `1f0375d` (M2 defensive fix), `a4e22ef` (inaugural harness baseline), `5f54265` (tracker). PR: [#62](https://github.com/MetalHexx/RadOrchestration/pull/62).

### 2026-04-20 — Iteration 10 — Task-level corrective cycles (orchestrator mediation)

- Branch: `feat/iter-10-task-corrective-cycles` off `feat/cheaper-execution` @ `4ca7a58` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-10-task-corrective-cycles`). Flat branch name (not nested `feat/cheaper-execution/iter-10`) per the iter-8 convention to avoid git ref-tree collisions.
- Semantic flip: `CODE_REVIEW_COMPLETED` births task-scope correctives from `effective_outcome === 'changes_requested'` + a non-empty `corrective_handoff_path` (both supplied by the orchestrator's mediation addendum on the review doc), not from the reviewer's raw `verdict`. The synthesized `task_handoff` sub-node on each corrective (`{ kind: 'step', status: 'completed', doc_path: <C1 path>, retries: 0 }`) mirrors the Iter-5 explosion-seeding shape so the walker enters the corrective with handoff pre-resolved. `code_review.verdict` state field now records the `effective_outcome` when mediated; raw verdicts (approved / rejected) pass through unchanged.
- Validator conditional contract (`frontmatter-validators.ts`): `FrontmatterValidationRule` gained `when?: (frontmatter) => boolean` per plan + an additive `mustBeAbsent?: boolean` flag (needed for "field must NOT exist" semantics — see Deviations). On `code_review_completed`: raw `changes_requested` requires `orchestrator_mediated: true` + `effective_outcome`; handoff path required iff `effective_outcome = changes_requested`; mediation fields forbidden on raw `approved`/`rejected`. Every invalid combination produces a structured `ValidationError`.
- Enrichment: `execute_task` now prefers the active task-scope corrective's `task_handoff.doc_path` for the `handoff_doc` context field, falling through to the original iteration's handoff when no corrective is active. `spawn_code_reviewer` unchanged (phase-scope branch is Iter-11 carve).
- Orchestrator agent + skill docs: narrow write-surface opened (orchestrator.md + context.md) — `Write`/`Edit`/`TodoWrite` added to tools; unconditional "never writes files" replaced with scoped permission to (a) append `## Orchestrator Addendum` section + additive frontmatter to existing Code Review docs and (b) author corrective Task Handoffs under `tasks/`. New `references/corrective-playbook.md` is the self-contained mediation guide (engagement rules, per-finding judgment inputs, cross-artifact scan, action/decline criteria, addendum shape, corrective handoff format, budget, `/clear` context-hygiene clause). `action-event-reference.md` + `pipeline-guide.md` cross-linked; `document-conventions.md` gained the task-scope corrective Task Handoff filename row + 7 new frontmatter fields.
- Stateless reviewer: `code-review/task-review/workflow.md` lost the Corrective-review check (step 4), the Corrective Review Context section, the expected-corrections verdict note, and both `Previous Code Review` + `Corrective Task Handoff` Inputs rows. Reviewer now stateless across attempts — re-review is written to a `-C{N}` suffixed doc with no access to the prior review.
- Prompt harness (`prompt-tests/corrective-mediation-e2e/`): new `broken-colors` fixture (1 phase / 1 task / 1 FR; pre-seeded state at `code_review.status = in_progress` with raw changes_requested review). Fixture ships a local `orchestration.yml` with `auto_commit: never` + `auto_pr: never` so the conditional `commit_gate` + `pr_gate` route to their false branches; runner passes `--config <run-folder>/orchestration.yml` on every pipeline call. Inaugural baseline at `output/broken-colors/baseline-broken-colors-2026-04-20/run-notes.md` committed — smoke-verified end-to-end against real `pipeline.js` in-session (hand-simulated `@coder` fix + re-review to keep token spend bounded; all 8 shape-based pass criteria green: corrective birthed, handoff_doc routes to C1, `is_correction: true` + `corrective_index: 1` surfaced on re-review enrichment, re-review verdict approved, walker advances past task_gate). Retroactive `user-instructions.md` added to `plan-pipeline-e2e/` establishing the hand-verification pattern.
- Iter 7 carry-forward resolved: multi-round corrective-context persistence extended in place in `corrective-integration.test.ts` "multiple retries then approval" test — `enrichActionContext('execute_task', ...)` assertions after each corrective birth verify `handoff_doc` resolves to the active C{N} handoff; `spawn_code_reviewer` enrichment returns the correct `corrective_index` per round. No new test file.
- Tests: orchestration 46 files / 1165 pass / 7 skip / 1 todo (baseline 46/1126/7/1 — net +39 pass across mutations, corrective-integration, context-enrichment, pre-reads, verdict-validation, and contract suites 05/06/09 + event-routing-integration Iter-10 wiring tests). UI 156 pass / 3 pre-existing fail / 159 total (unchanged). Installer 399 pass / 0 fail (unchanged).
- Reviews: 1 plan-conformance pass (`changes_requested` — flagged 2 items) + 1 code-quality pass (`changes_requested` — flagged 1 critical). Corrections absorbed in `cd645e8`: (1) `_runner.md` Step 1 expected return corrected from `action: spawn_code_reviewer` to `action: null` (walker does NOT re-emit actions for in-progress nodes — the smoke confirmed this; prior wording would have caused a future operator to incorrectly halt a correct run), (2) 4 Iter-10 wiring tests added to `event-routing-integration.test.ts` covering approved / mediated-changes_requested / mediated filter-down / validator-reject paths.
- Commits: `06f05de` (main), `cd645e8` (review correctives), `c2e24c8` (tracker). PR: [#61](https://github.com/MetalHexx/RadOrchestration/pull/61).

### 2026-04-20 — Iteration 9 — Complete `default.yml`

- Branch: `feat/iter-9-complete-default-yml` off `feat/cheaper-execution` @ `89cc1d2`. Execution-phase node tree copied 1:1 from post-Iter-8 `full.yml` — `gate_mode_selection` → `phase_loop { task_loop { task_executor → commit_gate → code_review → task_gate } → phase_review → phase_gate }` → `final_review` → `pr_gate` → `final_approval_gate`. `default.yml` not stamped `status: deprecated` (canonical template); header description updated.
- Engine fallback flipped `"full"` → `"default"` at the five plan-enumerated sites (`template-resolver.ts` jsdoc + hardcoded fallback, `state-io.ts` `DEFAULT_CONFIG`, two `template-resolver.test.ts` assertions, `ui/app/process-editor/page.tsx` `templateId`). Scope Boundary held — ~35 `'full'` fixture references across mutations/walker/integration tests untouched per plan.
- Deletions: `templates/quick.yml` + `tests/quick-template.test.ts` gone; UI fixture tests (`template-serializer.test.ts`, `template-layout.test.ts`) swapped second fixture `quick.yml` → `default.yml`; `rad-plan/SKILL.md` full/quick picker collapsed to a single "use default" fallback; minor comment/config ripples in `orchestration.yml`, `orchestration/SKILL.md`, `mutations.ts`, `prompt-tests/plan-pipeline-e2e/_runner.md`.
- Test surgery: `e2e-template-selection.test.ts` fully rewritten around default.yml resolution (with `full.yml` escape-hatch cases retained); `template-loader.test.ts` gained a `default.yml shape` describe block; added a keystone end-to-end smoke test driving a mock project on default.yml from `start` through `final_approved` to `display_complete` with every top-level node reaching `completed`.
- Tests: orchestration 46 files / 1126 pass / 7 skip / 1 todo (baseline 47/1122/7/1 — net +4 pass after `quick`-test removals are offset by default.yml shape + smoke + resolution cases). UI 156 / 3 pre-existing fail / 159 total (unchanged — the three failing tests all reference full.yml's pre-Iter-8 shape, carry-forward). Installer 399 pass (unchanged — no template references).
- Retained deliberate (per plan): `full.yml` stays on disk as a deprecated escape hatch; v4 migrator (`migrate-to-v5.ts` + its test files) left hardcoded to `'full'` since v4 states legitimately came from full.yml (Iter 16 scope); `ui/lib/template-api-helpers.test.ts` generic `isValidTemplateId('quick')` string-validation left as-is.
- Reviews: 1 conformance pass + 1 quality pass (both clean, no must-fix). Copilot cycle R1→R4 on PR #60 exited on R4 clean — R1 surfaced 4 comments (2 portability/comment fixes applied; 2 declined as architectural pushback against the Iter 5/7 explosion-seeding design and against adding abstraction for a single-consumer helper), R2+R3 each a single nit fixed in one commit.
- Commits: `ba2053a` (main) + tracker + 3 small Copilot-cycle fixes. PR: [#60](https://github.com/MetalHexx/RadOrchestration/pull/60).

### 2026-04-20 — Iteration 8 — phase_review absorbs phase_report

- Branch: `feat/iter-8-phase-review-absorbs-phase-report` off `feat/cheaper-execution` @ `f29c3db` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-8-phase-review-absorbs-phase-report`). Structured summary shape = option (b) — phase-report's 7 sections threaded INTO phase-review's template, named "Corrections Applied" section empty-on-first-review.
- Engine retirement: deleted `.claude/skills/generate-phase-report/` (SKILL + template); stripped `GENERATE_PHASE_REPORT` action + `PHASE_REPORT_STARTED`/`PHASE_REPORT_CREATED` events from `constants.ts` (17 → 16 actions, 31 → 29 events); removed `phaseExecDocSteps` block + `phase_report` from the `CHANGES_REQUESTED` reset list in `mutations.ts`; dropped `generate_phase_report` from `PHASE_LEVEL_ACTIONS` and stripped `phase_report_doc` from `spawn_phase_reviewer` enrichment in `context-enrichment.ts`; `full.yml` lost its `phase_report` body node (`phase_review.depends_on` → `[task_loop]`).
- Skill expansion: `code-review/phase-review/{workflow,template}.md` rewritten. Workflow gained an Aggregate-phase-data step (pulls Task Results, Files Changed, Issues & Resolutions, Carry-Forward); Inputs table lost Iter-3 residue (PRD / Architecture / Design rows). Template now emits 13 sections ending with Corrections Applied / Carry-Forward / Recommendations. One artifact, `type: phase_review`, drop-in replacement for both prior docs. (Note: Master Plan Adjustment Recommendations section was dropped by user in `aa2cc82` — not part of the final absorbed shape.)
- Deletions with intent: **Iter-0 `phase_report_created` fallback-behavior regression test in `contract/09-corrective-cycles.test.ts` deleted alongside the handler** (intentional removal, not regression — consumer of the deleted mutation vanished). Sweep also retired Phase Report rows in `document-conventions.md` and the stale `Action #8` number in phase-review workflow header.
- Tests: orchestration 47 files / 1123 pass / 7 skip / 1 todo (baseline 46/1119/7/1 — net +1 file, +4 pass; 25-test shape suite `phase-review-doc-shape.test.ts` added, offsetting ~20 removed dead-action/event cases). UI 156 pass / 3 pre-existing fail / 159 total (baseline unchanged; two new dag-timeline-legacy-render tests cover legacy `phase_report` body-node rendering + new-shape render). Installer 399 pass / 0 fail (unchanged).
- Reviews: 1 conformance pass (green) + 1 independent quality pass (3 findings + 2 nits applied) + 5 Copilot rounds. Exit on R5 clean + adversarial-R5 nits-only. Pre-emptive adversarial reviewer between Copilot rounds caught 4 findings before Copilot did (R1 severity vocab match, R2 orchestrator.md narrative, R3 tracker placeholder, R4 MPA ripple). Declined items: two `~1` parentless-commit edge-case comments (R1 C2/C3) as pre-existing workflow text from base branch `ff05ce2`, one severity-taxonomy inline-note suggestion (R3 C1) as redundant hygiene.
- Carry-forward to Iter 17 (public docs refresh): `docs/agents.md`, `docs/templates.md`, `docs/skills.md`, `docs/internals/scripts.md` all retain stale Phase Report references — explicitly deferred per plan.
- Commits: `9255084` (main), `b3e4428` (review-corrective), `c053b68` (tracker), `c49a7c9` (PR link fill-in), `da83279` (pre-emptive Copilot-style fixes), `20ce0a1` (Copilot Round 2 corrective), `aa2cc82` (user-authored: drop Master Plan Adjustment Recommendations section), `ed505d2` (Copilot Round 3 corrective — CRLF regex + template-section-delete ripple), `85c09d5` (tracker SHA fill-in), `79bb1ba` (MPA ripple in action-event-reference + tracker bullet), plus this tracker-finalization commit. PR: [#59](https://github.com/MetalHexx/RadOrchestration/pull/59).

### 2026-04-20 — Iteration 7 — Remove per-phase/per-task planning (tactical-planner + phase-plan/task-handoff + UI discoverProjects parallelization)

- Branch: `feat/iter-7-remove-per-phase-task-planning` off `feat/cheaper-execution` @ `5f3ae07` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-7-remove-per-phase-task-planning`).
- Deleted the tactical-planner agent + `rad-create-plans/references/{phase-plan,task-handoff,shared}/` workflow folders. Removed 2 actions (`CREATE_PHASE_PLAN`, `CREATE_TASK_HANDOFF`) + 4 events (`PHASE_PLANNING_STARTED`, `PHASE_PLAN_CREATED`, `TASK_HANDOFF_STARTED`, `TASK_HANDOFF_CREATED`) from `constants.ts`; trimmed `phaseExecStartedSteps` + removed the `TASK_HANDOFF_CREATED` handler in `mutations.ts`; removed `create_phase_plan` + `create_task_handoff` special-case blocks from `context-enrichment.ts` (the `execute_task` block still reads the explosion-seeded `taskIter.nodes['task_handoff'].doc_path`). `dag-walker.ts:171–179` phase-level corrective re-planning branch stubbed with an explicit `throw` pointing at Iter 12.
- Templates: stripped dead `phase_planning` / `task_handoff` body nodes from `full.yml` + `quick.yml` (depends_on references retargeted; Iter 9 will delete `quick.yml`).
- Doc migrations + ripples: corrective-filename `-C{N}.md` section moved from `phase-plan/workflow.md` into `orchestration/references/document-conventions.md`; 3 cross-refs updated (code-review phase-review + task-review workflows, generate-phase-report SKILL). 5 enumerated edits to `rad-create-plans/SKILL.md` (frontmatter, intro, When-to-Use, Load Sequence → routing-only, routing table). `orchestration/SKILL.md` action count updated `20 → 17`. `orchestrator.md` action-table references updated `20 → 17` (2 sites). `action-event-reference.md` rows + event signaling table trimmed; `document-conventions.md:49` author field `tactical-planner-agent → explosion-script`; `context.md:18` agent row removed; `prompt-tests/plan-pipeline-e2e/_runner.md:70` tactical-planner sentinel dropped; `document-metadata.tsx:49` + `.test.ts` comment phrasing tidied. Retained `frontmatter-validators.ts` `phase_plan_created` rule with an explanatory "dead-but-intentional" comment (docs still exist, downstream consumers still read them).
- UI perf fix (folded in during planning-time smoke): `ui/lib/fs-reader.ts` `discoverProjects` parallelized via `Promise.all(entries.map(...))` with per-project `try/catch` so one malformed state.json can't poison the list (`hasBrainstorming` resolution moved inside the per-project try for ordering robustness). Also fixed `getConfigPath` `path.join → path.resolve` so absolute `ORCH_ROOT` resolves correctly (aligns with `installer/lib/env-generator.js`'s documented contract). New regression tests: malformed-isolation / order-stability / 50-project fixture (`fs-reader-discover-parallel.test.ts`); legacy DAG renders with `phase_planning` + `task_handoff` body nodes + forward-compat (`dag-timeline-legacy-render.test.ts`).
- Test surgery: deleted `parity.test.ts` (~1620 lines of narrative coverage redundant with contract + integration suites); `it.skip()` 4 walker-corrective tests (`dag-walker.test.ts` ×3, `corrective-integration.test.ts` ×1) with explicit Iter-12 pointer comments; 2 additional engine-level tests skipped (`contract/06-state-mutations.test.ts:344`, `contract/09-corrective-cycles.test.ts:96`) that drive the full engine and hit the stubbed walker branch; action/event reference trims across `mutations.test.ts`, `mutations-negative-path.test.ts`, `context-enrichment.test.ts`, `execution-integration.test.ts`, `event-routing-integration.test.ts`, `engine.test.ts`, and contract suites 02–10. New integration test asserts a scratch project drives `requirements → master_plan → explode_master_plan` → executor reads pre-seeded task-handoff and completes the task with zero authoring events.
- Tests: orchestration 46 files / 1120 pass / 6 skip / 1 todo (baseline 1220/0/1 — net –100 pass / +6 skip / –94 total; over-trim accepted by all 4 review rounds as legitimate removal of dead action/event references, no retained-behavior coverage lost). UI 156 pass / 3 pre-existing fail / +2 tests (baseline 154/3/157). Installer 399 pass (unchanged).
- UI smoke (run from worktree against user's 107-project workspace): project list renders in **~37ms** (baseline 10–15s hang — >250× improvement); legacy `AGENT-CLEANUP` project DAG renders with 5 `phase_planning` + `task_handoff` body nodes intact; only pre-existing skeleton hydration warning in console (not Iter-7 related).
- Review cycles: 3 initial reviewers (conformance / code-quality / Copilot-style) + 3 follow-up rounds (Copilot-style nits + conformance recheck + final sanity) with corrective coders between each round. Net: 4 review rounds, ~11 small fixes absorbed inline (dead imports, stale action counts, comment/path consistency, ordering robustness).
- Merge commit: `ff05ce2`. PR: [#58](https://github.com/MetalHexx/RadOrchestration/pull/58).

### 2026-04-19 — Iter 15 inserted (Repository deep clean), public docs refresh shifts to Iter 16

- During Iter 7 planning, the cumulative-residue risk after 14 "delete + ripple as you go" iterations surfaced as worth a dedicated sweep before the public-facing docs refresh consumes the codebase as its source of truth.
- New companion: `docs/internals/cheaper-execution/iter-15-repository-deep-clean.md` — light-on-detail intent doc; the outer planner audits the codebase fresh at iteration time and produces the self-contained execution plan. Inner-session scope: apply enumerated findings AND look for additional tidying opportunities while editing each surface.
- Existing public-docs companion renamed: `iter-14-public-docs.md` → `iter-16-public-docs.md` (filename was already inconsistent with the "Iter 15" label in the design doc — the rename to iter-15 had been skipped when Iter 14 explosion-retry was inserted; this fixes both issues at once).
- Design doc + this tracker updated to show 17 total iterations.

### 2026-04-18 — Iteration 3 — Remove upstream planning (PRD / Research / Design / Architecture)

- Branch: `feat/iter-3-remove-upstream-planning` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-3-remove-upstream-planning`).
- Deleted 4 agent files (`product-manager.md`, `architect.md`, `ux-designer.md`, `research.md`) and 4 `rad-create-plans` reference folders (`prd/`, `research/`, `design/`, `architecture/`).
- Added `status?: 'deprecated'` to `TemplateHeader`; added early-return deprecated-skip in `template-validator.ts`; stamped both `full.yml` and `quick.yml` as `status: deprecated` (see Deviations — quick.yml also carried the legacy stages).
- Stripped 4 `SPAWN_*` actions and 8 `*_STARTED`/`*_COMPLETED` events from `constants.ts`; trimmed `planningStartedSteps`/`planningCompletedSteps` in `mutations.ts` to `master_plan` only; `PLANNING_SPAWN_STEPS` in `context-enrichment.ts` reduced to `{spawn_master_plan: 'master_plan'}`.
- Vocabulary purge across 6 internal skill docs. Deleted 77 legacy planning-chain tests; added 2 new `describe('deprecated templates')` cases in `template-validator.test.ts`. Updated 6 `ui/lib/template-serializer.test.ts` tests to reference surviving template nodes.
- Tests: orchestration 46 files / 1155 pass / 1 todo (baseline 1232 — net −77 legacy + 2 new); UI 152 pass / 3 fail (baseline unchanged); installer 399 pass / 0 fail.
- PR: [#54](https://github.com/MetalHexx/RadOrchestration/pull/54).

### 2026-04-18 — Iteration 2 — Three planning-time amendments to the companion doc

- **Design said**: Iter-02 companion Scope steps 1–7 covered folder delete/rename, frontmatter flip, validator extension, and `planner.md` router update. Ripples listed five internal docs for "execution plan" vocabulary purge, including `action-event-reference.md` and `pipeline-guide.md`.
- **Execution did (planning-time, pre-code)**: Companion amended in three ways. (1) Added Scope step 8 retargeting `action-event-reference.md:15` from `tactical-planner` → `planner` for `spawn_master_plan` — the orchestrator reads this row as its action→agent source of truth; updating only `planner.md`'s internal router changes what @planner *can* do when spawned but not *who* gets spawned, so the exit criterion ("`@planner` invoked … produces `{NAME}-MASTER-PLAN.md`") could not hold without this edit. (2) Corrected Ripples: `pipeline-guide.md` dropped (zero matches today), `action-event-reference.md` reframed as agent retarget not vocabulary purge (zero `execution_plan` matches today). (3) Added two missing purge surfaces discovered at plan time: `rad-create-plans/references/requirements/workflow.md:50` and `rad-plan-audit/references/audit-rubric.md:44`.
- **Why**: All three emerged from a plan-time grep/read pass validating the companion's Scope + Ripples + Code Surface against live code. Companion doc now matches ground truth so the coder session doesn't hit the same discovery drift.
- **Impact**: Iter-2 scope grew by one agent-retarget line, two purge-file edits. Tactical-planner agent file + its `create_phase_plan` / `create_task_handoff` router rows stay for Iter 7.

### 2026-04-18 — Iteration 3 — quick.yml stamped deprecated (plan assumed it was clean)

- **Design said**: "quick.yml — not stamped deprecated. Only full.yml carries the legacy 4-stage chain; quick.yml is a separate template and stays as-is."
- **Execution did**: quick.yml was also stamped `status: deprecated` with a matching banner comment. Additionally, `ui/lib/template-serializer.test.ts` had 6 tests updated to reference surviving nodes (master_plan, plan_approval_gate) instead of deleted ones (research, architecture).
- **Why**: quick.yml contains live `research` (action: `spawn_research`) and `architecture` (action: `spawn_architecture`) nodes. Both actions and their events were deleted from `constants.ts` and `mutations.ts` in Steps 6–7. Without the deprecated stamp, quick.yml would pass structural validation but fail at runtime when the engine tried to dispatch its first event. The plan's assumption that quick.yml was clean was incorrect. Quality review surfaced the issue.
- **Impact**: Both templates are now engine-deprecated pending Iter 9 (`default.yml`). The validator correctly skips both. No UI changes.

### 2026-04-18 — Iteration 3 — graph.status in_progress relocation

- **Design said**: Step 7 said "keep `MASTER_PLAN_STARTED`" without specifying the `graph.status = 'in_progress'` side-effect previously attached to `RESEARCH_STARTED`.
- **Execution did**: The `graph.status = 'in_progress'` hook moved from `RESEARCH_STARTED` to `MASTER_PLAN_STARTED`, because `master_plan` is now the first planning step.
- **Why**: Behavior-preserving mechanical consequence — without the move, no event would ever set `graph.status` to `in_progress` after the planning tier starts.
- **Impact**: Covered by updated test in `contract/06-state-mutations.test.ts`.

### 2026-04-18 — Iteration 4 — `plan_rejected` guarded against missing `phase_loop`

- **Plan said**: Scope deliberately left phase/task loop nodes for Iter 9. The plan's list of critical files did not include `plan_rejected` mutation edits.
- **Execution did**: Added an existence guard before touching `phase_loop` in the `plan_rejected` mutation handler (`mutations.ts`). Previously the handler unconditionally asserted `phase_loop.kind === 'for_each_phase'` and would throw on any `default.yml`-scaffolded project — crashing on a legitimate user "reject" action. Added a regression test that mimics a default.yml state (deletes `phase_loop` from the fixture) and confirms the mutation runs cleanly.
- **Why**: Iter 4's goal is "a fresh project on default.yml walks planning end-to-end." plan_rejected is a valid exit from that walk. Code-quality review surfaced the latent crash before PR.
- **Impact**: 2-line change in mutations.ts + 1 new test. No behavioural change for full.yml / quick.yml projects (phase_loop still gets reset).

### 2026-04-18 — Iteration 4 — Exhaustiveness ripples on `PlanningStepName` widening

- **Plan said**: Step 7 noted that `document-ordering.ts` and `status-derivation.ts` "pick up the new entry automatically once the array is updated. No edits to those two files."
- **Execution did**: Three files were touched as required exhaustiveness ripples when `PlanningStepName` gained `requirements`: `ui/lib/document-ordering.ts` (STEP_TITLES + STEP_TITLES_V5 records), `ui/components/planning/planning-checklist.tsx` (STEP_DISPLAY_NAMES record), and a semantic fix in `ui/lib/status-derivation.ts`. Each `Record<PlanningStepName, string>` consumer requires every union member as a TypeScript compile-time constraint. The `status-derivation.ts` edit is semantic (filter absent planning steps) to prevent a legacy-project regression: a pre-Iter-4 state.json scaffolded from full.yml has no `requirements` node, and the original "every step completed" check would treat the absent node as `not_started` and never derive `complete`.
- **Why**: Plan assumed the consumers only depended on the array iteration. They also depend on the union's exhaustiveness. Legacy-project regression was caught by a new UI test targeting that scenario.
- **Impact**: Three minor file edits (one-line additions to two records, one-line addition to a third, filter guard in status-derivation) plus four UI tests covering the legacy state.json case. Type surface stays clean.

### 2026-04-18 — Iteration 4 — Partial `default.yml` validates via loader, not `validateTemplate`

- **Plan said**: "Validator confirms partial templates pass — a 3-node `step → step → gate` is legal. No `template-validator.ts` changes needed."
- **Execution did**: No change to `template-validator.ts`. The template-validator's `unreachable_node` check actually rejects any node that has `depends_on` and is not referenced by any sibling — which catches legitimate terminal leaves like `plan_approval_gate`. But `template-loader.ts` already filters `unreachable_node` errors with an explanatory comment ("in practice, terminal steps in each scope are valid leaf nodes"). The new `template-validator.test.ts` test for `default.yml` uses `loadTemplate` (engine's actual call path) and separately asserts `validateTemplate`'s hard-error list excludes `unreachable_node`.
- **Why**: Plan assumed the validator would pass `step → step → gate` outright. It doesn't — but the engine tolerates the warning at load time, so the partial template loads and runs correctly anyway. No change to production behaviour, only to how the Iter 4 regression test is written.
- **Impact**: Test phrasing differs slightly from the plan's sketch. Engine behaviour is unchanged.

### 2026-04-19 — Iteration 5 — Child step node seeding replaces `iteration.doc_path`

- **Design said**: Iter 5 companion introduced a new `iteration.doc_path` field as the "mechanical seam that unlocks Iter 7's removal of the per-iteration authoring agents." The explosion script would seed each iteration's `doc_path` directly; Iter 7 would later pivot the UI + enrichment to read from it.
- **Execution did**: After the initial implementation passed tests, the UI smoke surfaced that no rendering code consumes `iteration.doc_path` — the UI renders Doc links via `DAGNodeRow` on child step nodes inside `iteration.nodes`, and `iteration.nodes: {}` left nothing to render. Pivoted: explosion script now seeds each iteration's `nodes` with a completed `phase_planning` (or `task_handoff`) step node carrying `doc_path`. Matches what legacy completed projects look like; the existing UI renders Doc links with zero code change. `iteration.doc_path` removed from schema + scripts types + UI types + all tests. `explosion_completed` mutation also stopped writing `doc_path` on the explode node (was set to master plan path — redundant + rendered as a spurious Doc link in the UI). Iter 7 companion + Iter 11 companion updated in the same pass to reference the new `taskIter.nodes['task_handoff'].doc_path` path.
- **Why**: The Iter 7 "mechanical seam" is preserved — the explosion script still pre-populates what the authoring agents would have populated; Iter 7 can still delete those agents. But it does so by filling in the existing node shape rather than introducing a new field, so the UI "just works" through the existing rendering path. Two sources of truth collapsed to one.
- **Impact**: Iter 7's scope narrows — no UI rewire needed, just agent deletion + enrichment path confirmation. Commit `3c41c34` (main pivot) + `bd41ebf` + `1d90e42` (companion + test alignment) + `<pending>` (relative-paths fix for seeded doc_paths).

### 2026-04-19 — Iteration 6 — `.gitignore` pattern narrowed to enable `!` re-include

- **Plan said**: `/prompt-tests/**/output/**` with narrower `!` exceptions for `.gitkeep`, `lint-report.md`, `run-notes.md`.
- **Execution did**: Widest ignore rule replaced with `/prompt-tests/plan-pipeline-e2e/output/*/*/**` (ignores files two levels deep into a run folder rather than the entire `output/` subtree). The `.gitkeep` exception was also later narrowed from `**/.gitkeep` to `*/.gitkeep` at review-fix time to stop re-including nested run-folder `.gitkeep`s.
- **Why**: Git cannot re-include files whose ancestor directory is matched by a directory-style pattern. The plan's literal glob would have suppressed `output/<fixture>/baseline-*/` entirely, making the `!` exceptions inert. Narrowing the base pattern leaves `output/` and `output/<fixture>/` un-ignored so the `!lint-report.md` / `!run-notes.md` exceptions resolve correctly. The narrowing also scopes the rule to the `plan-pipeline-e2e` behavior — future harness behaviors will need their own gitignore lines.
- **Impact**: Cosmetic. `git check-ignore -v` confirms the intended files are tracked and everything else in the run folder stays untracked. The `.gitignore` carries an inline comment explaining the constraint.

### 2026-04-17 — Iteration 1 — Commit step omitted from Execution Plan tasks

- **Design said**: Plan described `code` tasks with a 4-step RED-GREEN TDD shape and left open whether a commit step should be appended.
- **Execution did**: No commit step in the task shape. Task type `code` is exactly four steps: failing test, run (expect fail), implement, run (expect pass). Each step is tagged with the requirement ID it addresses.
- **Why**: The existing source-control step in the pipeline is heavy (spawns a separate agent, re-evaluates diffs). Forcing an inline commit step risks duplicating or conflicting with that cadence. Decision deferred until the source-control cost is better understood.
- **Impact**: Commit cadence stays with whatever pipeline node owns it (today: the source-control skill). Logged as an open item for a future iteration.

---

## Open Items Surfaced During Execution

Questions or decisions that came up during execution and couldn't be resolved in place. These feed a future brainstorming cycle — do not answer them here.

Format:

```
### YYYY-MM-DD — <Short question>
- **Context**: <where this came up>
- **Why unresolved**: <what's blocking the decision>
- **Suggested owner**: <who should decide, if known>
```

### 2026-04-17 — Validator/linter for corrective filenames

- **Context**: Iteration 0 standardized the `-C{corrective_index}.md` suffix across four skill workflows (task-handoff, task-review, phase-review, phase-report). A linter that rejects non-conforming names (e.g., infix `P01C1-T01`, arbitrary `-fix` suffix) would prevent the DAG-VIEW-5-style deviations from recurring before they land in `docs/`, `reports/`, or `tasks/`.
- **Why unresolved**: Out of scope for Iteration 0 (fix-only). Candidate home: `validator.ts` (state.json validation) or a pre-commit check on the `docs/` / `reports/` / `tasks/` tree. Design decision needed on runtime vs. tooling enforcement.
- **Suggested owner**: A future iteration or a standalone micro-task; not urgent while the skill docs are the primary enforcement point.

### 2026-04-17 — Commit step inclusion in Execution Plan tasks

- **Context**: Iteration 1 deliberately omits a commit step from the `code` task shape (4 steps: failing test → run fail → implement → run pass). The user noted that the current source-control step has been heavy — revisit whether commit cadence should live inline in the task or continue to live in a dedicated pipeline node.
- **Why unresolved**: Needs measurement of the existing source-control step's actual cost before deciding whether inlining commits buys anything or just duplicates work. Also interacts with the future `commit_gate` pipeline node sketched in the refactor doc.
- **Suggested owner**: A future iteration — probably alongside the Iter-3 `cheaper.yml` template work, once the full execution path is observable end-to-end.
- **2026-04-18 resolution**: Addressed by Iter 11 (Execute-coding-task rework). Decision: commit cadence stays owned by the existing source-control step; executor does not commit directly. Rationale documented in the iteration companion.

### 2026-04-17 — Cross-doc conformance check (Execution Plan vs. Requirements)

- **Context**: Iteration 1 ships the two new doc formats without any author-time check that every FR/NFR/AD/DD in `REQUIREMENTS.md` is addressed by at least one task in `EXECUTION-PLAN.md`. Coverage is enforced only implicitly (workflow guidance, YAGNI inline tagging). `rad-plan-audit` was explicitly scoped out of Iter-1.
- **Why unresolved**: Needs a design decision on whether the check lives as a standalone skill / agent mode (mirrors `rad-plan-audit`) or as a cheap CLI script invoked by the planner's workflow. Also overlaps with the future conformance-check agent mentioned in the design doc.
- **Suggested owner**: A later iteration, possibly the one that introduces a conformance-check agent.
- **2026-04-18 resolution**: Absorbed into the Rad-plan-audit overhaul iteration (currently Iter 14). The audit is rewritten for a single purpose — Requirements ↔ Master Plan conformance. Both forward coverage (every Requirements ID cited by ≥1 Master Plan task) and backward resolution (every Master Plan tag resolves to a block) land in that iteration.

### 2026-04-20 — Multi-round corrective-context persistence test (Iter 7 carry-forward)

- **Context**: Iter 7 deleted the `create_task_handoff` enrichment block and the test `'corrective fields persist across consecutive changes_requested verdicts'` in `contract/09-corrective-cycles.test.ts` that verified `is_correction` / `previous_review` fields still resolve on the second corrective cycle. `context-enrichment.test.ts` covers the `spawn_code_reviewer` single-round case (~lines 683–698) but no test exercises multi-round persistence at task scope.
- **Why unresolved**: Low risk for Iter 7 since the `spawn_code_reviewer` enrichment path itself is unchanged. But the gap is real — a regression in corrective_index accumulation across retries would go uncaught.
- **Suggested owner**: Iter 8 (phase_review absorbs phase_report), Iter 10 (task-level corrective cycles), or Iter 12 (code-review rework) — whichever first touches the corrective cycle shape. Under the corrective-cycles redesign, Iter 10 is the most natural landing spot since the mediation wiring directly governs `corrective_index` accumulation.
- **2026-04-20 resolution**: Resolved in Iter 10. The "multiple retries then approval" test in `corrective-integration.test.ts` (the 2-corrective drive) was extended in place with `enrichActionContext('execute_task', ...)` assertions after each corrective birth — verifying `handoff_doc` resolves to the active C{N} path across rounds — plus `spawn_code_reviewer` enrichment assertions that `corrective_index` advances correctly per round. No new test file was added; the extension folded into the existing multi-corrective driver. Regression on `corrective_index` accumulation or `handoff_doc` routing across rounds would now fail this test.

### 2026-04-20 — `.agents/skills/pipeline-changes/references/pipeline-internals.md` ripple unexecuted (Iter 7 carry-forward)

- **Context**: Iter 7 companion + plan listed updating this file's Mermaid diagrams to replace `task_handoff_created` + `phase_plan_created` event refs. The file does not exist anywhere in this worktree or the integration branch — likely lives in a different worktree or was renamed/moved in a prior iteration and the companion wasn't updated.
- **Why unresolved**: File physically unavailable during Iter 7 execution. Documentation-only (Mermaid diagrams) with no executable consequence.
- **Suggested owner**: Iter 16 (repository deep clean) or Iter 17 (public-facing docs refresh) — both of those sweep cumulative residue and would naturally pick up a stale Mermaid reference if/when the file reappears.

### 2026-04-20 — `fs-reader.ts` discoverProjects concurrency cap (Iter 7 Copilot review C1)

- **Context**: Iter 7 parallelized `discoverProjects` via `Promise.all(entries.map(...))` — unbounded concurrency. Copilot flagged theoretical EMFILE / IO-contention risk at large workspace sizes.
- **Why unresolved**: 107 projects renders in ~37ms with no issues. The risk surfaces at ~1000+ projects on OSes with strict file-descriptor limits (Linux default 1024; Windows default >10k). Iter 7's plan explicitly deferred "sidebar virtualization + project-count cap" to a later iteration. A bounded semaphore (e.g. concurrency = 20) would be trivial but premature without observable evidence of the EMFILE risk.
- **Suggested owner**: A future UI-performance iteration, or fold into Iter 16 (repository deep clean) if sweeping similar scale concerns.

### 2026-04-20 — Stale Action # references in review workflows (Iter 8 adversarial R5)

- **Context**: During Iter 8 R5 adversarial review, three pre-existing stale action-number references surfaced — `.claude/agents/reviewer.md:3` (task review "Action #6" / phase review "Action #8" / final review "Action #9"), `.claude/skills/code-review/task-review/workflow.md:3` ("Action #6"), `.claude/skills/code-review/final-review/workflow.md:3` ("Action #9"). Post-Iter-8 the correct numbers are #4 / #5 / #6.
- **Why unresolved**: These files were not touched by Iter 8 and the stale references predate it (inherited from Iter 3/4/7 renumbering cycles). Copilot did not flag them across all 5 rounds. Fixing them in-iteration would expand scope beyond `phase_review absorbs phase_report` and trigger another Copilot review against unrelated files.
- **Suggested owner**: Iter 17 (public-facing docs refresh) — natural landing spot since that iteration sweeps documentation for cumulative residue. Three one-line edits.

### 2026-04-19 — Prompt-harness linter frontmatter coverage (Iter 6 Copilot R6-3 / R6-5)

- **Context**: During PR #57's round-6 Copilot review, two comments asked the Iter-6 linters to add `author` + `approved_at` (requirements) and `status` + `created` + `author` (master plan) to `REQUIRED_FRONTMATTER`. Declined in-iteration because the Iter 6 companion (`docs/internals/cheaper-execution/iter-06-prompt-harness.md`) explicitly marks those fields as informational-only and instructs the linter to ignore them.
- **Why unresolved**: The plan's scope boundary is deliberate — the linters validate the load-bearing contract only. Broadening coverage would re-open the "which fields are load-bearing" question that the Iter 6 design locked. A separate iteration can revisit if the template contract tightens.
- **Suggested owner**: A future iteration — likely alongside Iter 14 (Rad-plan-audit overhaul) or whichever later work retightens the frontmatter contract on the template side.

### 2026-04-21 — Iteration-scoped "rework" in long-lived artifact names (Iter 12)

- **Context**: Iter 12 introduced `prompt-tests/code-review-rework-e2e/`, `scripts/tests/fixtures/review-rework/`, and `scripts/tests/review-rework-fixtures.test.ts`. The word "rework" is iteration-scoped — describes the iter-12 action, not an enduring property of the artifact. Once iter-12 merges, these artifacts continue to be the active code-review coverage for the project, and "rework" will read as historical rather than descriptive.
- **Why unresolved**: Rename blocked by sandbox-permission denial during iter-12 execution. Renaming crosses folder-move boundaries that the sandbox classified as scope creep. Suggested target names: `prompt-tests/code-review-e2e/`, `scripts/tests/fixtures/code-review/`, `scripts/tests/code-review-fixtures.test.ts`. Also requires path-reference updates in `_runner.md`, `README.md`, `user-instructions.md`, `run-notes.md`, imports in the test file, `.gitignore`, and this tracker entry.
- **Suggested owner**: A post-merge cleanup commit on `feat/cheaper-execution` (small, mechanical — git mv + one grep-and-replace pass), OR Iter 16 (Repository deep clean), whichever comes first.

### 2026-04-21 — Harness orchestrator subagent Agent-tool surfacing (Iter 12 carry-forward)

- **Context**: Iter 12's code-review-rework-e2e runner instructs the orchestrator role to "spawn @reviewer" / "spawn @coder" subagents. When the runner is driven by a subagent-level orchestrator (rather than the primary session), the Agent tool may not be surfaced, forcing inline role simulation — which weakens multi-agent-dispatch fidelity of the baseline.
- **Why unresolved**: Not an iter-12 architectural concern — the iter-12 contract (workflow outputs, audit-table shape, validator rules, enrichment contracts) is validated by inline authoring against specs. But as a harness-run hygiene rule, the runner's preamble should say: "If driving via a subagent, the orchestrator must call `ToolSearch select:Agent` at session start to surface the Agent tool for `@reviewer` + `@coder` dispatch. Alternatively, drive from the primary session."
- **Suggested owner**: A later iteration that re-runs the harness with real multi-agent dispatch, OR Iter 16/17 for harness-documentation hygiene.

### 2026-04-20 — `full.yml` banner wording stale post-Iter-9

- **Context**: `full.yml:2` banner says "Remains the default template fallback until Iter 9; kept for backwards compatibility." Post-Iter-9 the fallback is now `default.yml` and `full.yml` is a deprecated escape hatch only — the "Remains the default template fallback" phrasing is factually wrong. Surfaced during Iter-9 quality review.
- **Why unresolved**: Iter 9 plan explicitly said "The existing `status: deprecated` stamp + banner comments stay exactly as they are" to avoid scope creep into a file the iteration deliberately didn't touch. One-line fix but not worth violating the scope-boundary discipline for.
- **Suggested owner**: Iter 16 (Repository deep clean) or Iter 17 (public docs refresh) — whichever next re-sweeps template files for vocabulary consistency.

---

## Retrospective Notes

Optional. Once an iteration completes, a short retrospective paragraph can land here capturing what was harder or easier than expected. Useful for calibrating future iteration estimates.

_(none yet)_
