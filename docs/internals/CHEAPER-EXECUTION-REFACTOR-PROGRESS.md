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
| 2 | Rename Execution Plan → Master Plan | Not started | — | — |
| 3 | Remove upstream planning (PRD/Research/Design/Architecture) | Not started | — | — |
| 4 | Requirements pipeline node | Not started | — | — |
| 5 | Explosion script + state.json pre-seeding | Not started | — | — |
| 6 | Prompt regression harness | Not started | — | — |
| 7 | Remove per-phase/per-task planning | Not started | — | — |
| 8 | phase_review absorbs phase_report | Not started | — | — |
| 9 | Complete `default.yml` | Not started | — | — |
| 10 | Code-review rework (task/phase/final) | Not started | — | — |
| 11 | Execute-coding-task rework + correction sections | Not started | — | — |
| 12 | Corrective cycle wiring | Not started | — | — |
| 13 | Rad-plan-audit overhaul | Not started | — | — |
| 14 | Public-facing docs refresh | Not started | — | — |

**Overall**: 2 / 15 iterations complete. Design realigned 2026-04-18 for gutting-first approach.

**Legend**: Not started → In progress → Blocked → Complete

**Note on renumbering**: this status table uses the post-realignment iteration numbering (0-14). The Progression Log entries below for "Iteration 0" and "Iteration 1" refer to the same iterations in their original numbering (no shift). Iteration numbers 2+ are new.

---

## Branches & Worktrees

**Parent branch**: `feat/process-refactor`
**Integration branch**: `feat/cheaper-execution` — created 2026-04-17 off `feat/process-refactor` @ `86c6616`.

**Per-iteration state:**

| Iter | Branch | Worktree Path | State | Merge Commit | PR |
|------|--------|---------------|-------|--------------|-----|
| 0 | `feat/iter-0-prereqs` | `C:\dev\orchestration\v3-worktrees\feat-iter-0-prereqs` | Merged | (see commit 08bf2ff lineage) | — |
| 1 | `feat/iter-1-doc-formats` | `C:\dev\orchestration\v3-worktrees\feat-iter-1-doc-formats` | Merged | `08bf2ff` | #51 |
| 2 | — | — | Not created | — | — |
| 3 | — | — | Not created | — | — |
| 4 | — | — | Not created | — | — |
| 5 | — | — | Not created | — | — |
| 6 | — | — | Not created | — | — |
| 7 | — | — | Not created | — | — |
| 8 | — | — | Not created | — | — |
| 9 | — | — | Not created | — | — |
| 10 | — | — | Not created | — | — |
| 11 | — | — | Not created | — | — |
| 12 | — | — | Not created | — | — |
| 13 | — | — | Not created | — | — |
| 14 | — | — | Not created | — | — |

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

### 2026-04-18 — Design realignment — Gutting-first, per-iteration companions, 15-iteration timeline

- Root doc `CHEAPER-EXECUTION-REFACTOR.md` rewritten from 659 → ~225 lines. Lean: motivation, goals/non-goals, standing design principles, pipeline overview, iteration timeline (2–3 sentences per entry + exit line + companion link), future direction.
- 13 per-iteration companion docs authored under `docs/internals/cheaper-execution/iter-NN-<slug>.md`, one per future iteration (2-14). Each companion uses a standard template: Validation Preface → Overview → Scope → Ripples → Scope Deliberately Untouched → Code Surface → Dependencies → Testing Discipline → Exit Criteria → Open Questions.
- Status table above renumbered: old "Iteration 2" (explosion script) is now "Iteration 5"; "Iteration 3" (new process template) is split across Iterations 7+9; "Iteration 4" (corrective cycle redesign) is now "Iteration 12"; new iterations (rename, remove upstream, requirements node, harness, remove per-phase/task, phase_report absorption, reviewer rework, executor rework, rad-plan-audit, public docs) inserted.
- Key direction changes: full.yml deprecated in place (not coexisting); quick.yml removed; cheaper.yml → default.yml; Iter-1 execution-plan artifact reclassified as the existing "Master Plan" — name preserved to match pipeline vocabulary (`master_plan` node/action/events); only the artifact's content shape and authoring source change. Tactical-planner agent removed; generate-phase-report skill removed.
- Baseline-first testing discipline added as a standing policy across every iteration.
- No code changes; all work in design-doc surface.

### 2026-04-18 — Iteration 2 — Planning pass + companion-doc amendments

- Iteration 2 planning-pass complete (no code changes yet). Plan file at `C:\Users\Metal\.claude\plans\lets-get-idempotent-tarjan.md` covers the full execution order, test-fixture blast radius, and the worktree-review-PR loop.
- Three amendments folded into `docs/internals/cheaper-execution/iter-02-rename-to-master-plan.md` (Scope / Ripples / Code Surface / Open Questions). Summary under "Deviations from Design" below.
- Iteration branch will be `feat/iter-2-rename-to-master-plan` (flat naming, consistent with iter-0 / iter-1). Worktree target: `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan`.
- Next up: launch worktree via `/create-worktree-plan-mode`, dispatch coder-senior subagent against the amended companion.

### 2026-04-18 — Naming decision — "Master Plan" name preserved

- **Considered earlier the same day**: renaming the Iter-1 artifact to "Master Doc" to differentiate it from the legacy master-plan concept.
- **Landed on**: keep the name "Master Plan." Legacy tactical-planner-authored Master Plan is replaced with planner-authored inlined Master Plan — same name, different content shape, different authoring source.
- **Why**: matches existing pipeline vocabulary (node id `master_plan`, action `spawn_master_plan`, events `master_plan_started` / `master_plan_completed`) without two-name translation; smaller cognitive surface.
- **Corpus sweep done**: 14 files updated. `Master Doc` → `Master Plan`; `MASTER-DOC.md` → `MASTER-PLAN.md`; `master-doc/` folder → `master-plan/`; `explode_master_doc` action → `explode_master_plan`; `lint-master-doc.mjs` → `lint-master-plan.mjs`. Iter-02 companion file renamed on disk: `iter-02-rename-master-doc.md` → `iter-02-rename-to-master-plan.md`. Grep-hygiene check confirms zero `Master Doc` / `master_doc` residuals.
- **Iter 2 scope tightened**: delete-first-then-rename sequence now explicit (legacy `rad-create-plans/references/master-plan/` deleted first to free the folder name; Iter-1's `references/execution-plan/` renamed into that slot).

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

### 2026-04-18 — Iteration 2 — Three planning-time amendments to the companion doc

- **Design said**: Iter-02 companion Scope steps 1–7 covered folder delete/rename, frontmatter flip, validator extension, and `planner.md` router update. Ripples listed five internal docs for "execution plan" vocabulary purge, including `action-event-reference.md` and `pipeline-guide.md`.
- **Execution did (planning-time, pre-code)**: Companion amended in three ways. (1) Added Scope step 8 retargeting `action-event-reference.md:15` from `tactical-planner` → `planner` for `spawn_master_plan` — the orchestrator reads this row as its action→agent source of truth; updating only `planner.md`'s internal router changes what @planner *can* do when spawned but not *who* gets spawned, so the exit criterion ("`@planner` invoked … produces `{NAME}-MASTER-PLAN.md`") could not hold without this edit. (2) Corrected Ripples: `pipeline-guide.md` dropped (zero matches today), `action-event-reference.md` reframed as agent retarget not vocabulary purge (zero `execution_plan` matches today). (3) Added two missing purge surfaces discovered at plan time: `rad-create-plans/references/requirements/workflow.md:50` and `rad-plan-audit/references/audit-rubric.md:44`.
- **Why**: All three emerged from a plan-time grep/read pass validating the companion's Scope + Ripples + Code Surface against live code. Companion doc now matches ground truth so the coder session doesn't hit the same discovery drift.
- **Impact**: Iter-2 scope grew by one agent-retarget line, two purge-file edits. Tactical-planner agent file + its `create_phase_plan` / `create_task_handoff` router rows stay for Iter 7.

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
- **2026-04-18 resolution**: Addressed by Iter 13 (Rad-plan-audit overhaul). The audit is rewritten for a single purpose — Requirements ↔ Master Plan conformance. Both forward coverage (every Requirements ID cited by ≥1 Master Plan task) and backward resolution (every Master Plan tag resolves to a block) land in the iteration.

---

## Retrospective Notes

Optional. Once an iteration completes, a short retrospective paragraph can land here capturing what was harder or easier than expected. Useful for calibrating future iteration estimates.

_(none yet)_
