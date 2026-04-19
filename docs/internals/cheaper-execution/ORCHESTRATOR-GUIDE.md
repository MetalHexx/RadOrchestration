# Orchestrator Guide — Cheaper Execution Refactor

Workflow for the **outer Claude session** that plans each iteration of the Cheaper Execution Refactor. A separate worktree session (launched at the end via `/create-worktree-plan-mode`) executes the plan.

The two sessions are decoupled by design:

- **Outer session** reads this guide + the root design doc + the progress tracker + the iteration companion. Plans the iteration. Produces a self-contained plan file.
- **Inner session** reads only (A) its plan file and (B) the inner-session kickoff prompt that launches it. It does NOT read this guide, the companion, or the root design doc. No indirection, no multi-source-of-truth.

Everything the inner session needs to execute the iteration must be inlined into the plan file by the outer session. If the outer session wouldn't have it without reading the companion, the plan file needs to carry it.

Kickoff prompt to start a fresh outer session:

> Continue the Cheaper Execution Refactor. Follow `docs/internals/cheaper-execution/ORCHESTRATOR-GUIDE.md` from Step 1.

**Start the session in normal mode, NOT plan mode.** Steps 1–5 may include amending the iteration companion and committing to `feat/cheaper-execution`, which plan mode forbids. Enter plan mode (Shift+Tab) only at Step 6, to write the plan file. Exit plan mode before Step 7 to invoke `/create-worktree-plan-mode`.

Integration branch (baseline for every iteration): `feat/cheaper-execution`.

---

## Your role (outer session)

1. Intake the prior iteration (if one landed since your last session).
2. Identify and validate the next iteration against live code.
3. Brainstorm scope with the user.
4. Produce an execution-ready, self-contained plan file at `~/.claude/plans/<slug>.md`.
5. Launch a worktree session via `/create-worktree-plan-mode` with the standard inner kickoff prompt.
6. Wait. When the iteration lands, loop to step 1.

You do NOT code, review, or commit the iteration.

---

## Step 1 — Bootstrap (every session, fresh reads)

Re-read from disk, not memory (compaction resilience):

- `docs/internals/CHEAPER-EXECUTION-REFACTOR.md` — stable design; do not edit.
- `docs/internals/CHEAPER-EXECUTION-REFACTOR-PROGRESS.md` — the mutable tracker. Source of truth for what landed, deviations, open items.
- `docs/internals/cheaper-execution/iter-NN-<slug>.md` — companion for the next iteration, identified via the first `Not started` row in the tracker's "Status at a Glance."

If any of these has moved or been renamed, stop and ask the user.

## Step 2 — Prior-iteration intake

If the tracker shows an iteration merged more recently than you're aware of:

- `git fetch` and sync `feat/cheaper-execution`.
- Read the merge commit, the PR description, and the iteration's Progression Log + Deviations entries.
- Post a short chat summary of what landed, flag any unresolved Deviations / Open Items.
- Ask the user whether anything from the prior iteration should shift the next iteration's scope.

Skip only if no new iteration has landed since your last outer session.

## Step 3 — Validate the companion doc against live code

Load-bearing step. Iter 2's companion had stale references that would have burned the executor if not caught here.

- Grep / glob every file path, line number, and symbol named in the companion's **Code Surface** and **Ripples** sections.
- For each mismatch, do NOT silently fix it in the plan file. Amend the companion doc itself so it matches live code, then commit the amendment to `feat/cheaper-execution` before creating the iteration worktree (so the worktree inherits the corrected companion).
- **Keep companion amendments concise and high-signal.** The companion is a brief — bullets, line numbers, named symbols, terse rationale. The plan file is where you expand. Don't restate intent already captured in the surrounding companion text. If an amendment runs more than a few lines, you're probably writing the plan in the wrong file.
- **Do NOT touch the progress tracker during planning.** The tracker is for execution outcomes (what the inner session did), not planning decisions. Companion amendments — whether reference drift or scope changes — live in the companion commit message, full stop. Deviation entries only land in the tracker when *execution* diverges from the plan file, and the inner session writes them.
- Collect any scope questions surfaced by validation for the brainstorm step.

## Step 4 — Brainstorm with the user

- Present validation findings and scope questions well formatted and easy to read.  Keep it high-level and conversational. The user is not expected to understand super detailed technical nuances.  Follow their lead on how deep to go on each point. The goal is shared understanding and buy-in on the iteration scope, not a technical audit.
- Use `AskUserQuestion` only when a discrete choice between concrete options is required.  Make sure they have an option to respond if your options dont align with their thinking.
- Lock: scope, additions/removals, smoke-test approach, whether the companion needs further amendment.

## Step 5 — High-level summary in chat (required)

Before writing the detailed plan file, post a short bullet summary in chat:
- What the iteration does (3–6 bullets).
- Any deviations from the companion and why.
- Rough test-fixture blast radius.

Let the user validate direction first. Do not skip.

## Step 6 — Enter plan mode, write the plan file

At this point, tell the user you're ready to write the plan and ask them to enter plan mode (Shift+Tab). Plan mode is needed so that the plan file is the only write, and so the user approves the plan via `ExitPlanMode` before anything launches.

Plan file path: `~/.claude/plans/<slug>.md`. The file must be self-contained — the inner session will never read the companion or root design. If a fact matters to execution, state it in the plan.

The plan should cover, in whatever structure reads well:

- **Where to work**: integration target `feat/cheaper-execution`, iteration branch `feat/iter-N-<slug>` (flat — git refuses nested names under an existing ref), worktree path `C:\dev\orchestration\v3-worktrees\feat-iter-N-<slug>`.
- **What to change**: files + line numbers + the edits to make. Call out anything deliberately out of scope so the executor doesn't over-reach.
- **What to test**: affected test and fixture files, the grep command the executor runs at the start to confirm the fixture set (fixtures drift — give them the search, not just the answer), new tests required. Baseline-first — the executor's first action is running the full suite across all three trees and saving `baseline-tests.log`:
  - `.claude/skills/orchestration/scripts/` — `npm test` (vitest)
  - `ui/` — `npm test` (`node --test --import tsx`)
  - `installer/` — `npm test` (`node --test --experimental-test-module-mocks`)
- **What good looks like**: automated asserts (test counts, greps for removed vocabulary, folder/symbol checks) plus a manual smoke drive if the iteration changes behavior at a user- or orchestrator-visible surface.
- **UI smoke (REQUIRED for any iteration touching `ui/`)**: unit tests cover correctness; the browser smoke catches rendering regressions. The plan must include an explicit step that:
  - Writes `ui/.env.local` with `WORKSPACE_ROOT=<absolute path to workspace>` and `ORCH_ROOT=.claude` (one line each). The installer normally writes this — see `installer/lib/env-generator.js` for the canonical format. Inline the snippet in the plan so the inner session doesn't have to rediscover it.
  - Builds + boots the dev server (`cd ui && npm run build && npm run dev`).
  - Opens the dev server URL in a browser and verifies: the new surface renders correctly; status transitions / interactions work; a pre-existing legacy state.json still renders cleanly (no missing-node warnings, no layout regressions); zero new console errors vs. baseline.
  - Captures a screenshot or terse note for the PR description.
- **Worktree Workflow**: paste the boilerplate below verbatim at the end of the plan, substituting the iteration branch name. This is the orchestration procedure for the inner session, and it's the same every iteration.

### Worktree Workflow boilerplate (paste verbatim, addressed to the inner session)

> 1. Review this plan end-to-end. If anything reads as critically flawed or inconsistent with the live repo, STOP and surface to the user — do not patch silently.
> 2. Dispatch an Opus-level `coder-senior` subagent to execute this plan. Multiple subagents if the iteration is large; use judgement.
> 3. Capture baseline tests FIRST, before any edits. Save `baseline-tests.log` in the worktree root with baseline SHA + pass/fail/todo totals at the top.
> 4. After coding, commit all changes to the worktree branch with a clear message.
> 5. Review pass #1 — plan conformance. Dispatch a `reviewer` subagent with this plan + `git diff feat/cheaper-execution...HEAD`. Report any step unexecuted or out-of-scope change. Diff-based review ensures you're reviewing what was actually written.
> 6. Review pass #2 — code quality. Dispatch a second reviewer subagent with the same diff. Flag quality issues (unnecessary abstractions, dead code, inconsistent naming, missing test updates, scope creep).
> 7. Corrective dispatch. A new `coder-senior` subagent receives the two reviews and decides which items to apply. It must NOT blindly trust reviewer findings — exercise judgement. Stop and alert the user on any complicated / risky / ambiguous correction before acting on it.
> 8. Update `docs/internals/CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`: append a Progression Log entry (3–5 lines, high-signal, link commits and PR), append a Deviation entry if execution diverged from this plan, update the "Status at a Glance" and "Branches & Worktrees" tables.
> 9. DO NOT edit `docs/internals/CHEAPER-EXECUTION-REFACTOR.md`. All divergence lives in the progress tracker.
> 10. Push the iteration branch to origin and open a PR from `feat/iter-N-<slug>` → `feat/cheaper-execution`. Do NOT merge locally. PR body summarizes what landed and links the progression log entry.
> 11. Enter the automated PR-review cycle (Copilot reviewer):
>     - **Poll state authoritatively.** Use `/loop 1m` (not 5m — tighter is cheaper than you think). The **authoritative** unresolved-comment count is GraphQL `reviewThreads` filtered to `isResolved:false` + Copilot author — `gh api repos/.../pulls/N/reviews` lags for inline-only posts. In the browser, the "re-request review" recycle button absent + "awaiting-review-Copilot" tooltip present = Copilot busy; recycle back = done.
>     - **Validate every comment before acting.** Don't trust Copilot blindly. For each, read surrounding code, check the claim is actually true in the current tree, and consider blast radius of the proposed fix. Specifically: **decline fixes that butcher the architecture** — duplicating logic across modules to save a perf nit, removing a real typo-guard regex to fix a hypothetical false-positive, etc. A diff that makes one thing better and two things worse is a regression.
>     - **Stay in scope.** Out-of-scope / too complex / too risky → log in the progress tracker's "Open Items Surfaced During Execution" (only if it's a genuine carry-forward affecting a later iteration — don't log every nit), reply explaining, resolve. If what *looks* out of scope is actually a small fix via an existing pattern (e.g. add to `OUT_OF_BAND_EVENTS`), fix it — revisit "scope creep" calls when Copilot re-raises.
>     - **Right-size the subagent.** 1-line consistency / docstring / typo / unused-import fixes → `coder-junior`. Routine 5–30 line in-scope fixes → `coder`. Complex or architecturally-significant changes → `coder-senior`. **Always** follow with a `reviewer` subagent on the diff before replying (even for tiny fixes — enforces the quality floor). If the junior's output is sloppy, step up a tier and redo.
>     - **Parallelize re-review with follow-up.** Click the re-request recycle button **immediately after pushing the fix commit** — before posting replies and resolving threads. Copilot's review (5–15 min latency) runs in parallel with your follow-up bookkeeping.
>     - **Pre-emptive audit on plateau.** After 2–3 rounds converge into the same nit patterns (idempotency guards, input shape validation, consistency gaps), dispatch a `reviewer` with the instruction "scan for remaining instances of these patterns" and batch-fix in one commit. Shortens the remaining tail.
>     - **Termination criterion.** Exit when (a) Copilot returns clean, OR (b) two consecutive rounds are nits-only / clean (no new bugs, no architectural findings), OR (c) remaining comments are all noise/out-of-scope (logged). A PR in "clean with triaged residual noise" is mergeable — don't chase a mirror-perfect PR. The old "5 cycle cap" is a ceiling, not a target; the nits-only rule is tighter and usually fires first.
>
> Exit when the PR is in a clean state (or remaining comments have been triaged into the progress log) AND the progress tracker is updated. Leave the worktree in place for the user to verify, merge, and clean up.

## Step 7 — Exit plan mode, launch the worktree

- Exit plan mode.
- Invoke `/create-worktree-plan-mode` with the plan file path.
- Confirm when the skill prompts:
  - **Base branch**: `feat/cheaper-execution`.
  - **Branch name**: `feat/iter-N-<slug>` (flat).
- The skill's default kickoff prompt ("Read your plan at {path} and execute it end-to-end per the plan") is sufficient. The Worktree Workflow section inside the plan is what drives the inner session.

## Step 8 — Wait

- Do not poll.
- When the user returns saying the iteration PR has merged (or invokes the kickoff prompt again), re-bootstrap from Step 1.

---

## Anti-patterns

- Editing `CHEAPER-EXECUTION-REFACTOR.md` during execution. All runtime divergence goes into the progress tracker.
- Silently papering over stale companion references in the plan. Fix the companion; log the deviation.
- Linking the plan file out to the companion or root design. The plan must be self-contained.
- Writing a local `git merge` step into the plan. Always a PR from iteration branch → `feat/cheaper-execution`.
- Nested branch names (`feat/cheaper-execution/iter-N-...`). Git ref-tree collision. Use flat `feat/iter-N-<slug>`.
- Starting the iteration without capturing `baseline-tests.log` first.
- Skipping the high-level summary in chat before writing the detailed plan.
- Running the three test trees from a single root script. There isn't one today — each directory has its own `npm test`; concatenate the logs.
- Skipping the `reviewer` subagent after a `coder-junior` fix because the change is "too small." Always review — it's how the quality floor stays honest.
- Posting replies / resolving threads / updating the tracker BEFORE clicking Copilot re-request. Serializes the wait. Click re-request first, then do the follow-up.
- Using the progress tracker as a scratch pad for every mid-iteration fix. It's for project milestones + deviations + carry-forward open items. Commit messages are the durable record for individual fixes.

---

## Quick reference (outer session)

| Concept | Value |
|---|---|
| Root design doc | `docs/internals/CHEAPER-EXECUTION-REFACTOR.md` (outer-session read only; never edit) |
| Progress tracker | `docs/internals/CHEAPER-EXECUTION-REFACTOR-PROGRESS.md` (updated by inner session at iteration exit; outer reads for intake) |
| Per-iteration companions | `docs/internals/cheaper-execution/iter-NN-<slug>.md` (outer-session read only; amend if live code drifted) |
| This guide | `docs/internals/cheaper-execution/ORCHESTRATOR-GUIDE.md` (outer-session only — never reference from the plan file) |
| Integration branch | `feat/cheaper-execution` |
| Iteration branch pattern | `feat/iter-N-<slug>` (flat) |
| Worktree path pattern | `C:\dev\orchestration\v3-worktrees\feat-iter-N-<slug>` |
| Worktree launcher | `/create-worktree-plan-mode` |
| Plan file home | `~/.claude/plans/<slug>.md` (self-contained; inner session's only read) |
