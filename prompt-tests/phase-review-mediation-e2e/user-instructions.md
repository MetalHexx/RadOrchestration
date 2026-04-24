# phase-review-mediation-e2e — How to Run and Verify

A friendly walkthrough for running this test end-to-end. No prior knowledge of the orchestration pipeline required.

## What this test is

In our pipeline, when the phase reviewer returns `changes_requested` on a phase, the **orchestrator** (the top-level coordinator) mediates. It reads the phase review, scans across the phase's Task Handoffs + cumulative diff, judges each finding, appends an addendum to the phase review doc, and authors a self-contained **phase-sentinel** corrective Task Handoff (`{NAME}-TASK-P{NN}-PHASE-C{N}.md`) that a coder can execute from scratch. The corrective entry lands under `phaseIter.corrective_tasks[]` (not the last taskIter's). Under Iter 11's single-pass clause, `phase_review` does not re-run once the corrective's task-level code review approves — the phase iteration simply completes.

This test exercises the **full phase-scope corrective-cycle flow** on a tiny two-task fixture with a cross-task contract drift:

1. T1 (`makeColors()`) and T2 (`greet()`) each ship with clean code + an approved task-level review.
2. The phase review is pre-seeded on disk with `verdict: changes_requested` — the T1/T2 outputs disagree on the element shape (strings vs. objects with `.name`), so `greet(makeColors())` produces `'Hello, undefined, ...'` instead of the FR-2 required `'Hello, red, ...'`.
3. The orchestrator mediates: judges the finding, writes an addendum on the phase review doc, authors `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`.
4. A `@coder` is spawned on the phase-sentinel corrective handoff and fixes `src/greet.js`.
5. A `@reviewer` re-reviews the fix and returns `approved` — the re-review doc is saved at `reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md`.
6. The pipeline's state reflects a completed phase-scope corrective cycle; the Phase 1 iteration is `completed`.

## What this test is supposed to accomplish

It's a regression alarm that covers a surface the unit tests can't reach on their own:

- **Orchestrator phase-scope prompt drift** — the orchestrator stops following the Phase-Scope Mediation section of the playbook (cross-artifact scan missed, delta language leaking into the phase-sentinel corrective handoff, wrong budget banner).
- **Stateless phase-reviewer contract leaks** — the task-level re-review accidentally references the original phase review doc instead of evaluating the corrective output on its own merits.
- **Engine / mutation routing drift** — the new `PHASE_REVIEW_COMPLETED` birth-on-handoff-path path isn't routed correctly; the corrective lands under taskIter instead of phaseIter; the reset block comes back.
- **Filename / state-shape drift** — the phase-sentinel corrective handoff and its task-level code review use the wrong filename form; phaseIter.corrective_tasks carries the wrong node scaffold.
- **UI drift** — the new `(Phase-C{N})` document-sidebar suffix or the corrective-task group rendering at phase scope regresses. Exercised via the separate `fully-hydrated/` showcase fixture.

A passing run gives confidence that the phase-scope mediation flow works end-to-end and that the UI handles both task-scope and phase-scope corrective stacks.

## What the automated run costs

The test spawns a real `@coder` agent and a real `@reviewer` agent. The mediation judgment itself runs in the orchestrator session (no extra subagent). Expect Opus-tier LLM spend comparable to a small task cycle. Don't loop the harness without intent.

## Prerequisites

**Tooling.** Install Node.js 20+ (check `node --version`). Clone this repo and open a terminal at the repo root.

**Dependencies.** Run this once:

```bash
# orchestration scripts — required
cd .claude/skills/orchestration/scripts && npm install && cd -

# UI — required if you will do the UI smoke check at the end
cd ui && npm install && cd -
```

**UI environment file.** The UI reads two variables from `ui/.env.local`. Create or update it to:

```
WORKSPACE_ROOT=<absolute path to the fixtures directory>
ORCH_ROOT=.claude
```

The fixtures directory is `prompt-tests/phase-review-mediation-e2e/fixtures/` — pointing `WORKSPACE_ROOT` there lets the UI list `fully-hydrated` (and the copied-out `colors-greet-mismatch` run folder if you want to open it too) as projects. See `installer/lib/env-generator.js` for the canonical template.

**Port 3000.** Make sure port 3000 is free before booting the UI so Next.js doesn't port-hop to 3001 / 3002:

- Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -ti:3000 | xargs kill -9`

## Run the automated test

1. Open a **fresh** Claude Code session at the repo root. "Fresh" means a new session with no prior context from other work — otherwise session state can interfere with how the run plays out.

2. Open `prompt-tests/phase-review-mediation-e2e/_runner.md` in your editor and copy its **entire contents**.

3. Paste the contents into the Claude Code session as your first message. Claude will act as the simulated orchestrator — copying the fixture to a fresh run folder, bootstrapping the pipeline, mediating the phase review in-session (writing the addendum, authoring the phase-sentinel corrective Task Handoff), spawning `@coder` to fix `src/greet.js`, spawning `@reviewer` for the task-level re-review, and halting when the re-review returns `approved` and the walker advances past Phase 1.

4. **Fixture**: the default is `colors-greet-mismatch` (already configured in `_runner.md`). No change needed.

5. Let the run finish. Typical duration: 5-15 minutes (one coder call + one reviewer call + bookkeeping + the in-session mediation judgment).

6. When the session halts, it will have written `run-notes.md` into the run folder. Ask the session for the exact path and open it.

**If the session errors out** (pipeline returns `success: false`, validator rejects the addendum frontmatter, mutation throws, halt_reason appears unexpectedly), stop and surface to whoever is tracking the iteration. The test exists to catch exactly this class of break.

## Verify the automated run

You're verifying four things: the 10 pass criteria are satisfied, the orchestrator's mediation judgment is coherent at phase scope, the phase-sentinel corrective handoff is self-contained, and the task-level re-review is stateless.

### Read the run notes

Open `output/colors-greet-mismatch/<run-folder>/run-notes.md`. Verify:

- All 10 pass criteria listed and marked satisfied.
- Final `phase_loop.iterations[0].status` is `completed`.
- `phase_loop.iterations[0].nodes.phase_review.status` is `completed` (NOT reset to `not_started`) and its `verdict` equals the orchestrator's `effective_outcome`.
- `phase_loop.iterations[0].nodes.phase_planning.status` is `completed` (NOT reset). `nodes.task_loop.iterations.length` is 2 (the T1 + T2 history was not cleared).
- `phase_loop.iterations[0].corrective_tasks.length` is 1 (the fixture is designed to converge in one phase-scope corrective cycle).
- `graph.status` is `in_progress` — the harness halts before Phase 2 / final_review, which is correct.

### Skim the phase review addendum for coherence

The mediation appended an `## Orchestrator Addendum` section to the phase review doc. Open `output/colors-greet-mismatch/<run-folder>/reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md` and check the bottom of the file:

- The `## Orchestrator Addendum` section is present after the original review content.
- Budget banner reads `Attempt 1 of 5`.
- The disposition table has one row for finding `F-1` with disposition `action` and a coherent reason. The reason should (a) trace to FR-2 and/or the phase exit criterion, (b) explain why the fix is bounded to `src/greet.js` (FR-1 pins `makeColors()`'s string shape), and (c) explain why this is phase-scope (spans both Task Handoffs' integrated behavior).
- `Effective Outcome: changes_requested` line is present.
- `Corrective Handoff: tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md` line is present.
- The frontmatter at the top of the file was extended with: `orchestrator_mediated: true`, `effective_outcome: changes_requested`, `corrective_handoff_path: tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`. Reviewer's original `verdict` and `exit_criteria_met` fields are untouched.

Coherence is the key check here. If the reason text reads like a templated auto-fill, ignores the cross-task nature of the drift, or confuses task-scope vs phase-scope, flag it.

### Inspect the phase-sentinel corrective Task Handoff

The orchestrator authored a fresh handoff at `output/colors-greet-mismatch/<run-folder>/tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`. Open it and check:

- Filename uses the `-PHASE-C1` sentinel form (not `-T01-...-C1`).
- Frontmatter has `corrective_index: 1`, `corrective_scope: phase`, `budget_max: 5`, `budget_remaining: 4`.
- The body is **self-contained** — it reads as if describing the task from scratch. It should not contain phrases like "previous attempt", "prior review", "first attempt", "phase review said", "the reviewer noticed", or anything that implies "this is a correction." A coder reading it cold should be able to implement the fix without loading any other document.
- Concrete steps: edit `src/greet.js` to treat names as strings; cross-reference FR-2's expected output.

### Verify the stateless task-level re-review

The task-level re-review is saved at `output/colors-greet-mismatch/<run-folder>/reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md` (note the `-PHASE-C1` sentinel form). Open it and grep for prior-review references:

- No occurrences of "previous review", "prior review", "first attempt", "phase review said".
- The re-review evaluates the fixed `src/greet.js` on its own merits (and possibly the integrated behavior with `src/colors.js`) and returns `approved`.

If the re-review mentions the phase review, the stateless-reviewer contract leaked — that's a real finding, not a nit.

## Independent UI smoke check (maximum density via `fully-hydrated`)

The implementing agent's Claude-in-Chrome MCP run should already have caught rendering issues against the `fully-hydrated/` showcase fixture. This pass is a human second-eyes check that catches UX judgment calls (density, alignment, suffix readability) that programmatic DOM assertions can miss.

1. Confirm port 3000 is free (see Prerequisites).

2. Confirm `ui/.env.local` points `WORKSPACE_ROOT` at `prompt-tests/phase-review-mediation-e2e/fixtures/` (absolute path).

3. Boot the UI:
   ```bash
   cd ui && npm run build && npm run dev
   ```

4. Open `http://localhost:3000`. Select the `fully-hydrated` project.

5. **DAG timeline**. Expect to see:
   - Phase 1 iteration card with three tasks. T1 shows one `Corrective Task 1` accordion. T2 is clean (no corrective group). T3 shows two corrective accordions (`Corrective Task 1`, `Corrective Task 2`).
   - Below the task_loop, the Phase 1 iteration renders two phase-scope corrective accordions (`Corrective Task 1`, `Corrective Task 2`) whose children correspond to the phase-sentinel handoff and code review docs.
   - Phase 2 iteration card renders clean (no corrective groups).
   - No missing-node warnings. No console errors. No layout regressions.

6. **Document sidebar**. Expect every fixture doc to appear with the correct suffix:
   - Task-scope correctives carry the `(CT{N})` suffix on their handoff + review entries.
   - Phase-scope correctives carry the `(Phase-C{N})` suffix.
   - Read the suffix rendering for readability — if `(Phase-C1)` is cramped, collides with the base title, or reads as `(Phase−C1)` (with wrong hyphen char) flag it as a UX finding.

7. **Open the phase review doc** (`FULLY-HYDRATED-PHASE-REVIEW-P01-CORE.md`) in the UI. The addendum's `Corrective Handoff:` pointer + the extended frontmatter (`orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`) should render cleanly.

8. **Open a phase-sentinel code review doc** (`FULLY-HYDRATED-CODE-REVIEW-P01-PHASE-C1.md`). Its Orchestrator Addendum section (pointing at Phase-C2) should render — this view exercises the ancestor-derivation UX path.

9. **Legacy regression check** (optional but recommended). Point the UI at a pre-iter-11 completed project state.json (e.g., any project under `C:\dev\orchestration-projects\`). The DAG timeline should render clean with no missing-node warnings, no layout regressions, and no new console errors. This check exists because Iter 11 extended the state shape; a legacy project's state.json doesn't have phase-scope `corrective_tasks[]` populated, and the UI must degrade gracefully.

## Report your result

If everything looks right, reply `hand-verification clean` to whoever's tracking this.

If anything looks off — incoherent phase-scope addendum, self-referential phase-sentinel corrective handoff, a task-level re-review that references the phase review, missing frontmatter fields in the UI, a `(Phase-C{N})` suffix that is hard to read, a legacy project that regresses — surface it. Include the run folder path and a short description of what looked wrong. A broken run caught here is much cheaper than a broken run caught after the iteration lands.
