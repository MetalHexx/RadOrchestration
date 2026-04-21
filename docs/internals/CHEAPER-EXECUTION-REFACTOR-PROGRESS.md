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
| 10 | Task-level corrective cycles (orchestrator mediation) | Not started | — | — |
| 11 | Phase-level corrective cycles | Not started | — | — |
| 12 | Code-review rework (task/phase/final) | Not started | — | — |
| 13 | Execute-coding-task rework | Not started | — | — |
| 14 | Rad-plan-audit overhaul | Not started | — | — |
| 15 | Explosion-retry configurability | Not started | — | — |
| 16 | Repository deep clean | Not started | — | — |
| 17 | Public-facing docs refresh | Not started | — | — |

**Overall**: 10 / 18 iterations complete. Status table reflects the current iteration numbering; historical progression-log entries for "Iteration 0" and "Iteration 1" refer to the same iterations in their original numbering (no shift). Iteration numbers 2+ have been renumbered across two design passes — the gutting-first realignment (2026-04-18) and the corrective-cycles redesign that inserted task- and phase-level corrective iterations at slots 10 and 11 (2026-04-20). See [`CHEAPER-EXECUTION-REFACTOR.md`](./CHEAPER-EXECUTION-REFACTOR.md) for the authoritative timeline.

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
| 2 | `feat/iter-2-rename-to-master-plan` | `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan` | Awaiting merge | — | [#53](https://github.com/MetalHexx/RadOrchestation/pull/53) |
| 3 | `feat/iter-3-remove-upstream-planning` | `C:\dev\orchestration\v3-worktrees\feat-iter-3-remove-upstream-planning` | Awaiting merge | — | [#54](https://github.com/MetalHexx/RadOrchestation/pull/54) |
| 4 | `feat/iter-4-requirements-pipeline-node` | `C:\dev\orchestration\v3-worktrees\feat-iter-4-requirements-pipeline-node` | Awaiting merge | — | [#55](https://github.com/MetalHexx/RadOrchestation/pull/55) |
| 5 | `feat/iter-5-explosion-script` | `C:\dev\orchestration\v3-worktrees\feat-iter-5-explosion-script` | Merged | `4500203` | [#56](https://github.com/MetalHexx/RadOrchestation/pull/56) |
| 6 | `feat/iter-6-prompt-harness` | `C:\dev\orchestration\v3-worktrees\feat-iter-6-prompt-harness` | Merged | `82333f1` | [#57](https://github.com/MetalHexx/RadOrchestation/pull/57) |
| 7 | `feat/iter-7-remove-per-phase-task-planning` | `C:\dev\orchestration\v3-worktrees\feat-iter-7-remove-per-phase-task-planning` | Merged | `ff05ce2` | [#58](https://github.com/MetalHexx/RadOrchestation/pull/58) |
| 8 | `feat/iter-8-phase-review-absorbs-phase-report` | `C:\dev\orchestration\v3-worktrees\feat-iter-8-phase-review-absorbs-phase-report` | Awaiting merge | — | [#59](https://github.com/MetalHexx/RadOrchestation/pull/59) |
| 9 | `feat/iter-9-complete-default-yml` | `C:\dev\orchestration\v3-worktrees\feat-iter-9-complete-default-yml` | Awaiting merge | — | [#60](https://github.com/MetalHexx/RadOrchestation/pull/60) |
| 10 | — | — | Not created | — | — |
| 11 | — | — | Not created | — | — |
| 12 | — | — | Not created | — | — |
| 13 | — | — | Not created | — | — |
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

### 2026-04-18 — Iteration 2 — Rename execution-plan → master-plan + extend plan_approved validator

- Branch: `feat/iter-2-rename-to-master-plan` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan`).
- Deleted legacy tactical-planner-authored `references/master-plan/`; git-mv'd Iter-1 `references/execution-plan/` into the freed slot; renamed template to `MASTER-PLAN.md`; flipped `type: execution_plan` → `type: master_plan`.
- `plan_approved` validator extended with `total_tasks` positive-integer rule; 12 test fixture files updated; 4 new validator test cases added (net: 1228 → 1232 pass, 0 fail).
- `action-event-reference.md` row 5 retargeted: `tactical-planner` → `planner`; `spawn_master_plan` wired. Dead `spawn_master_plan` row stripped from `tactical-planner.md`. Vocabulary purge across 6 internal skill docs.
- Commits: `69599ec` (main), `04dffa5` (corrective). PR: [#53](https://github.com/MetalHexx/RadOrchestation/pull/53).

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
- Commits: `8c95b96` (main), `4c07f3e` (corrective). PR: [#55](https://github.com/MetalHexx/RadOrchestation/pull/55).

### 2026-04-19 — Iteration 5 — Explosion script + state pre-seeding + parse-failure recovery loop

- Branch: `feat/iter-5-explosion-script` off `feat/cheaper-execution` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-5-explosion-script`).
- New explosion script (`.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` + CLI wrapper `scripts/explode-master-plan.ts`): parses approved Master Plan's `## P{NN}:` / `### P{NN}-T{MM}:` headings, emits `{NAME}-PHASE-{NN}-{TITLE}.md` / `{NAME}-TASK-P{NN}-T{MM}-{TITLE}.md` to `phases/` + `tasks/`, and seeds `state.graph.nodes.phase_loop.iterations[]` + nested `task_loop.iterations[]`. Parse-first (no filesystem side effects on malformed input); wipes-and-backups existing `phases/`+`tasks/` to `backups/{ISO}/` on re-run; exit codes `0/1/2` for success / real-error / parse-error.
- Parse-failure recovery loop: new `EXPLOSION_FAILED` event + mutation handler resets `explode_master_plan` to `not_started`, flips `master_plan` back to `in_progress`, stores structured `last_parse_error` on master_plan node, increments `parse_retry_count`. Cap = 3; 4th consecutive failure halts via `graph.status = 'halted'` + log-error. Planner workflow gained a "step 1a" branch that reads `last_parse_error` and fixes the specific issue on re-spawn. `explosion_completed` handler clears both recovery fields.
- Engine surface: +1 action (`EXPLODE_MASTER_PLAN`), +3 events (`EXPLOSION_STARTED/COMPLETED/FAILED`) in `constants.ts`. `default.yml` grew from 3 to 4 nodes (`requirements → master_plan → explode_master_plan → plan_approval_gate`), with `plan_approval_gate.depends_on` retargeted. Schema additions (`StepNodeState.last_parse_error` + `parse_retry_count`) — purely additive, legacy state still validates.
- UI surface: added `explode_master_plan` to `PlanningStepName` union + `PLANNING_STEP_ORDER` + `NODE_SECTION_MAP` + `STEP_TITLES`/`STEP_TITLES_V5` + `STEP_DISPLAY_NAMES` exhaustiveness ripples. No new rendering code — the existing DAG timeline renders the new node as a step in the Planning section automatically.
- **Scope extension within this iteration**: after the initial implementation, UI smoke surfaced two issues. (1) Explode Master Plan node showed a spurious "Doc" link pointing at the master plan path — the `explosion_completed` mutation was storing `doc_path = context.doc_path` per the original plan. (2) Pre-seeded iterations (with `nodes: {}` empty) didn't surface their doc_path in the UI because the UI renders Doc links on child step nodes, not on `iteration.doc_path`. Pivoted: explosion script now seeds `iteration.nodes.phase_planning` (or `task_handoff` for tasks) as a completed step node carrying doc_path — matches legacy completed projects; UI renders Doc links automatically via existing `DAGNodeRow`. `iteration.doc_path` removed from schema + types entirely. Explode Master Plan mutation no longer assigns `doc_path`. See Deviation entry dated 2026-04-19.
- Tests: orchestration 47 files / 1198 pass / 1 todo (baseline 1170 — net +28 new tests); UI 152 pass / 3 pre-existing failures (unchanged); installer 399 pass / 0 fail. New coverage: ≥6 parser cases + 2 re-run integration (success + malformed-aborts-no-side-effects) + 3 recovery-loop integration (single failure / success-clears / cap-exceeded) + 3 explosion mutation contract tests + schema/compat tests.
- End-to-end UI smoke: ran the explosion CLI against a fresh `ITER5-E2E-SMOKE` project (2 phases × 2 tasks). All 8 docs (requirements + master plan + 2 phases + 4 tasks) render and open from the DAG timeline. Explode Master Plan node renders as Completed with no Doc link. Legacy `AGENT-CLEANUP` unchanged — zero regressions.
- Commits: `f74555a` (initial Iter 5), `a5aa1f1` (review-corrective on initial), `3c41c34` (scope extension: child-node seeding + drop explode doc_path), `bd41ebf` (scope-extension review-corrective: iter-07 companion + test fixture cleanup), `1d90e42` (iter-11 companion alignment), `cfcd2a5` (relative doc_path paths), `d9c4d0c` (rendering cleanup + UI null check + frontmatter array rendering), `7a644ef` (forwardRef on 5 badge components), `4207cd3` (progress tracker + final corrective). PR: [#56](https://github.com/MetalHexx/RadOrchestation/pull/56).
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
- Commits: `f534247` (scaffold), `b890c18` (review-corrective — dead code, tightened self-test thresholds, project-name stability, narrowed `.gitkeep` exception), `a9cb44c` (inaugural baseline artifacts), `211c34a` (progress tracker). PR: [#57](https://github.com/MetalHexx/RadOrchestation/pull/57).

### 2026-04-20 — Iteration 9 — Complete `default.yml`

- Branch: `feat/iter-9-complete-default-yml` off `feat/cheaper-execution` @ `89cc1d2` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-9-complete-default-yml`). Execution-phase node tree copied 1:1 from post-Iter-8 `full.yml` lines 56–177 — `gate_mode_selection` → `phase_loop { task_loop { task_executor → commit_gate → code_review → task_gate } → phase_review → phase_gate }` → `final_review` → `pr_gate` (conditional w/ `final_pr`) → `final_approval_gate`. `default.yml` header description + comments updated; `status: deprecated` deliberately NOT stamped. `phase_gate.auto_approve_modes: []` matches full.yml (walker verdict-based auto-approve bypasses).
- Engine fallback flipped `"full"` → `"default"` at the five plan-enumerated sites: `template-resolver.ts:7–8,30` (jsdoc + hardcoded fallback), `state-io.ts:32` (`DEFAULT_CONFIG.default_template`), `template-resolver.test.ts` two fallback assertions, `ui/app/process-editor/page.tsx:17` (`templateId`). Two mandatory direct-mirror test cascades also applied: `state-io.test.ts:63` `DEFAULT_CONFIG_VALUES` fixture (mirrors the source const), `template-validator.test.ts:170` default.yml shape assertion (4 nodes → 9 top-level). Scope Boundary held — ~35 other `'full'` fixture references across mutations/walker/integration tests untouched.
- Deletions with intent: `templates/quick.yml` gone; `tests/quick-template.test.ts` (103 lines) deleted; UI fixture tests (`template-serializer.test.ts`, `template-layout.test.ts`) swapped second fixture `QUICK_YAML`/`quickMeta` → `DEFAULT_YAML`/`defaultMeta`; `rad-plan/SKILL.md` full/quick picker collapsed to a single "use default" fallback; ripples in `orchestration.yml:14`, `orchestration/SKILL.md:33`, `mutations.ts:983` comment; `_runner.md` "Config quirk" paragraph removed + line-70 sentence rewritten (default now emits executor/reviewer/source-control actions).
- Test surgery: `e2e-template-selection.test.ts` fully rewritten — all `quick` cases dropped, seven new default.yml tests added (CLI `--template default`, config `'default'`, fallback `''`→`default`, fallback `'ask'`→`default`, `processEvent start` scaffolds `template_id: 'default'` + first action `spawn_requirements`, CLI `--template full` escape hatch, config `'full'` escape hatch), plus the keystone end-to-end smoke test driving a mock project on default.yml from `start` through every event (`requirements_completed`, `master_plan_completed`, `explosion_completed`, `plan_approved`, `task_completed`, `commit_completed`, `code_review_completed`, `task_gate_approved`, `phase_review_completed`, `phase_gate_approved`, `final_review_completed`, `pr_created`, `final_approved`) to `display_complete` with every top-level node reaching `status: completed`. `template-loader.test.ts` gained a `default.yml shape` describe block (6 tests).
- Tests: orchestration 46 files / 1126 pass / 7 skip / 1 todo / 1134 total (baseline 47/1122/7/1/1130 — net −1 file, +4 pass; `-6` from `quick-template.test.ts` delete, `-2` quick-specific cases removed from e2e rewrite, `+6` default.yml shape tests, `+1` end-to-end smoke, `+5` new template-resolution cases). UI 156 pass / 3 pre-existing fail / 159 total (baseline unchanged — the two `template-serializer.test.ts` failures and the `dag-timeline.test.ts` failure all reference full.yml's pre-Iter-8 shape and are untouched by this iteration; carry-forward). Installer 399 pass / 0 fail (unchanged — no template references in installer).
- Retained deliberate (per plan): `full.yml` stays on disk as an escape hatch with existing `status: deprecated` banner intact; v4 migrator (`migrate-to-v5.ts` + its test files) left hardcoded to `'full'` since v4 states legitimately came from full.yml (Iter 16 scope); `ui/lib/template-api-helpers.test.ts:86` generic `isValidTemplateId('quick')` string-validation test left as-is.
- Reviews: 1 conformance pass + 1 independent quality pass, both clean (no must-fix findings). Two nice-to-fix items noted and deliberately left alone — `DOC_STORE` module-scoping in the e2e smoke test (single-test describe, `beforeEach` clears; safe), and the stale `full.yml:2` banner line ("Remains the default template fallback until Iter 9") which is now factually wrong but the plan explicitly said "banner comments stay exactly as they are" (logged as Open Item for cleanup-iteration owner).
- Reviews: 1 conformance pass (clean) + 1 independent quality pass (clean, no must-fix; 2 nice-to-fix items noted and deliberately left as-is per plan scope). Copilot R1→R4 on PR #60: R1 returned 4 comments (2 applied in `ee89e3f` — per-test temp-dir + accurate seeding comment; 2 declined with architectural reasoning — C1 re-adding `phase_planning` would regress the Iter-5/7 explosion-seeding design, C4 helper abstraction would add an unused indirection). R2 nits-only (companion-doc smoke end-state wording, fixed in `cf3e0fd`). R3 nits-only (`findNode` test helper's `children` branch for union completeness, fixed in `3fc3833`). R4 clean — zero new comments. Exit on R4 clean with all 6 threads resolved.
- Commits: `ba2053a` (main implementation), `9ce280a` (tracker), `7250116` (PR link fill-in), `ee89e3f` (R1 fixes), `cf3e0fd` (R2 fix), `3fc3833` (R3 fix), plus this Copilot-cycle summary commit. PR: [#60](https://github.com/MetalHexx/RadOrchestation/pull/60).

### 2026-04-20 — Iteration 8 — phase_review absorbs phase_report

- Branch: `feat/iter-8-phase-review-absorbs-phase-report` off `feat/cheaper-execution` @ `f29c3db` (worktree at `C:\dev\orchestration\v3-worktrees\feat-iter-8-phase-review-absorbs-phase-report`). Structured summary shape = option (b) — phase-report's 7 sections threaded INTO phase-review's template, named "Corrections Applied" section empty-on-first-review.
- Engine retirement: deleted `.claude/skills/generate-phase-report/` (SKILL + template); stripped `GENERATE_PHASE_REPORT` action + `PHASE_REPORT_STARTED`/`PHASE_REPORT_CREATED` events from `constants.ts` (17 → 16 actions, 31 → 29 events); removed `phaseExecDocSteps` block + `phase_report` from the `CHANGES_REQUESTED` reset list in `mutations.ts`; dropped `generate_phase_report` from `PHASE_LEVEL_ACTIONS` and stripped `phase_report_doc` from `spawn_phase_reviewer` enrichment in `context-enrichment.ts`; `full.yml` lost its `phase_report` body node (`phase_review.depends_on` → `[task_loop]`).
- Skill expansion: `code-review/phase-review/{workflow,template}.md` rewritten. Workflow gained an Aggregate-phase-data step (pulls Task Results, Files Changed, Issues & Resolutions, Carry-Forward); Inputs table lost Iter-3 residue (PRD / Architecture / Design rows). Template now emits 13 sections ending with Corrections Applied / Carry-Forward / Recommendations. One artifact, `type: phase_review`, drop-in replacement for both prior docs. (Note: Master Plan Adjustment Recommendations section was dropped by user in `aa2cc82` — not part of the final absorbed shape.)
- Deletions with intent: **Iter-0 `phase_report_created` fallback-behavior regression test in `contract/09-corrective-cycles.test.ts` deleted alongside the handler** (intentional removal, not regression — consumer of the deleted mutation vanished). Sweep also retired Phase Report rows in `document-conventions.md` and the stale `Action #8` number in phase-review workflow header.
- Tests: orchestration 47 files / 1123 pass / 7 skip / 1 todo (baseline 46/1119/7/1 — net +1 file, +4 pass; 25-test shape suite `phase-review-doc-shape.test.ts` added, offsetting ~20 removed dead-action/event cases). UI 156 pass / 3 pre-existing fail / 159 total (baseline unchanged; two new dag-timeline-legacy-render tests cover legacy `phase_report` body-node rendering + new-shape render). Installer 399 pass / 0 fail (unchanged).
- Reviews: 1 conformance pass (green) + 1 independent quality pass (3 findings + 2 nits applied) + 5 Copilot rounds. Exit on R5 clean + adversarial-R5 nits-only. Pre-emptive adversarial reviewer between Copilot rounds caught 4 findings before Copilot did (R1 severity vocab match, R2 orchestrator.md narrative, R3 tracker placeholder, R4 MPA ripple). Declined items: two `~1` parentless-commit edge-case comments (R1 C2/C3) as pre-existing workflow text from base branch `ff05ce2`, one severity-taxonomy inline-note suggestion (R3 C1) as redundant hygiene.
- Carry-forward to Iter 17 (public docs refresh): `docs/agents.md`, `docs/templates.md`, `docs/skills.md`, `docs/internals/scripts.md` all retain stale Phase Report references — explicitly deferred per plan.
- Commits: `9255084` (main), `b3e4428` (review-corrective), `c053b68` (tracker), `c49a7c9` (PR link fill-in), `da83279` (pre-emptive Copilot-style fixes), `20ce0a1` (Copilot Round 2 corrective), `aa2cc82` (user-authored: drop Master Plan Adjustment Recommendations section), `ed505d2` (Copilot Round 3 corrective — CRLF regex + template-section-delete ripple), `85c09d5` (tracker SHA fill-in), `79bb1ba` (MPA ripple in action-event-reference + tracker bullet), plus this tracker-finalization commit. PR: [#59](https://github.com/MetalHexx/RadOrchestation/pull/59).

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
- Merge commit: `ff05ce2`. PR: [#58](https://github.com/MetalHexx/RadOrchestation/pull/58).

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
- PR: [#54](https://github.com/MetalHexx/RadOrchestation/pull/54).

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

### 2026-04-20 — `full.yml` banner wording stale post-Iter-9

- **Context**: `full.yml:2` banner says "Remains the default template fallback until Iter 9; kept for backwards compatibility." Post-Iter-9 the fallback is now `default.yml` and `full.yml` is a deprecated escape hatch only — the "Remains the default template fallback" phrasing is factually wrong. Surfaced during Iter-9 quality review.
- **Why unresolved**: Iter 9 plan explicitly said "The existing `status: deprecated` stamp + banner comments stay exactly as they are" to avoid scope creep into a file the iteration deliberately didn't touch. One-line fix but not worth violating the scope-boundary discipline for.
- **Suggested owner**: Iter 16 (Repository deep clean) or Iter 17 (public docs refresh) — whichever next re-sweeps template files for vocabulary consistency.

---

## Retrospective Notes

Optional. Once an iteration completes, a short retrospective paragraph can land here capturing what was harder or easier than expected. Useful for calibrating future iteration estimates.

_(none yet)_
