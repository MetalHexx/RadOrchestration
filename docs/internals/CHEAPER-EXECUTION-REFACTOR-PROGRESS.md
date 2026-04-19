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
| 5 | Explosion script + state.json pre-seeding | Awaiting merge | 2026-04-19 | 2026-04-19 |
| 6 | Prompt regression harness | Not started | — | — |
| 7 | Remove per-phase/per-task planning | Not started | — | — |
| 8 | phase_review absorbs phase_report | Not started | — | — |
| 9 | Complete `default.yml` | Not started | — | — |
| 10 | Code-review rework (task/phase/final) | Not started | — | — |
| 11 | Execute-coding-task rework + correction sections | Not started | — | — |
| 12 | Corrective cycle wiring | Not started | — | — |
| 13 | Rad-plan-audit overhaul | Not started | — | — |
| 14 | Explosion-retry configurability | Not started | — | — |
| 15 | Public-facing docs refresh | Not started | — | — |

**Overall**: 6 / 16 iterations complete (Iter 5 awaiting PR merge). Design realigned 2026-04-18 for gutting-first approach. Iter 14 (explosion-retry configurability) inserted 2026-04-19 during Iter 5 planning when the retry cap was deferred from baked-in to configurable.

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
| 2 | `feat/iter-2-rename-to-master-plan` | `C:\dev\orchestration\v3-worktrees\feat-iter-2-rename-to-master-plan` | Awaiting merge | — | [#53](https://github.com/MetalHexx/RadOrchestation/pull/53) |
| 3 | `feat/iter-3-remove-upstream-planning` | `C:\dev\orchestration\v3-worktrees\feat-iter-3-remove-upstream-planning` | Awaiting merge | — | [#54](https://github.com/MetalHexx/RadOrchestation/pull/54) |
| 4 | `feat/iter-4-requirements-pipeline-node` | `C:\dev\orchestration\v3-worktrees\feat-iter-4-requirements-pipeline-node` | Awaiting merge | — | [#55](https://github.com/MetalHexx/RadOrchestation/pull/55) |
| 5 | `feat/iter-5-explosion-script` | `C:\dev\orchestration\v3-worktrees\feat-iter-5-explosion-script` | Awaiting merge | — | [#56](https://github.com/MetalHexx/RadOrchestation/pull/56) |
| 6 | — | — | Not created | — | — |
| 7 | — | — | Not created | — | — |
| 8 | — | — | Not created | — | — |
| 9 | — | — | Not created | — | — |
| 10 | — | — | Not created | — | — |
| 11 | — | — | Not created | — | — |
| 12 | — | — | Not created | — | — |
| 13 | — | — | Not created | — | — |
| 14 | — | — | Not created | — | — |
| 15 | — | — | Not created | — | — |

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

### 2026-04-19 — UI `node.doc_path !== null` check lets `undefined` through

- **Context**: Iter 5 UI smoke surfaced a case where a step node with no `doc_path` field at all (vs. `doc_path: null` explicitly) still rendered a broken "Doc" link. `dag-node-row.tsx:80` checked `node.doc_path !== null` which evaluates truthy for `undefined`.
- **2026-04-19 resolution**: Fixed in the Iter 5 scope. `dag-node-row.tsx` check tightened to `doc_path != null && doc_path !== ''` (catches null, undefined, and empty string) with matching fix in the keyboard handler. Regression tests added in `dag-node-row.test.ts`.

### 2026-04-19 — Frontmatter viewer renders array values as `[object Object]`

- **Context**: Iter 5 UI smoke showed that the DocumentDrawer's frontmatter pane rendered the `tasks` array in phase plan frontmatter as the literal string `[object Object],[object Object]` because the viewer coerced values with `String()` unconditionally.
- **2026-04-19 resolution**: Fixed in the Iter 5 scope. `document-metadata.tsx` gained a new `stringifyFrontmatterItem` helper that handles primitives, flat objects (`key: value` pairs), arrays (bulleted list), and nested objects (JSON). NEW `document-metadata.test.ts` covers the helper (9 cases).

---

## Retrospective Notes

Optional. Once an iteration completes, a short retrospective paragraph can land here capturing what was harder or easier than expected. Useful for calibrating future iteration estimates.

_(none yet)_
