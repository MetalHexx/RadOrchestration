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
| 0 | Prerequisites (auto-resolution bug) | In progress | 2026-04-17 | — |
| 1 | Document formats (Requirements + Execution Plan) | Not started | — | — |
| 2 | Explosion script + state pre-seeding | Not started | — | — |
| 3 | New process template (`cheaper.yml`) | Not started | — | — |
| 4 | Corrective cycle redesign | Not started | — | — |
| 5 | Final review + cleanup phase | Not started | — | — |
| 6 | UI polish (optional) | Not started | — | — |
| 7 | `full.yml` retirement | Not started | — | — |

**Overall**: 0 / 8 iterations complete. Design frozen 2026-04-16.

**Legend**: Not started → In progress → Blocked → Complete

---

## Branches & Worktrees

**Parent branch**: `feat/process-refactor`
**Integration branch**: `feat/cheaper-execution` — created 2026-04-17 off `feat/process-refactor` @ `86c6616`.

**Per-iteration state:**

| Iter | Branch | Worktree Path | State | Merge Commit | PR |
|------|--------|---------------|-------|--------------|-----|
| 0 | `feat/iter-0-prereqs` | `C:\dev\orchestration\v3-worktrees\feat-iter-0-prereqs` | Worktree active | — | — |
| 1 | — | — | Not created | — | — |
| 2 | — | — | Not created | — | — |
| 3 | — | — | Not created | — | — |
| 4 | — | — | Not created | — | — |
| 5 | — | — | Not created | — | — |
| 6 | — | — | Not created | — | — |
| 7 | — | — | Not created | — | — |

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

---

## Retrospective Notes

Optional. Once an iteration completes, a short retrospective paragraph can land here capturing what was harder or easier than expected. Useful for calibrating future iteration estimates.

_(none yet)_
