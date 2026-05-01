# corrective-mediation-e2e — How to Run and Verify

A friendly walkthrough for running this test end-to-end. No prior knowledge of the orchestration pipeline required.

## What this test is

In our pipeline, when the code reviewer returns `changes_requested` on a task, the **orchestrator** (the top-level coordinator) now mediates. It reads the review, judges each finding, appends an addendum to the review doc, and authors a self-contained corrective Task Handoff that a coder can execute from scratch.

This test exercises the **full corrective-cycle flow** on a tiny broken fixture:

1. A task ships with broken code (`getColors()` returns the wrong array order).
2. A code review flagged the bug (pre-seeded in the fixture — already on disk).
3. The orchestrator mediates: judges the finding, writes an addendum, authors a corrective handoff.
4. A `@coder` is spawned on the corrective handoff and fixes the code.
5. A `@reviewer` re-reviews the fix and returns `approved`.
6. The pipeline's state reflects a completed corrective cycle.

## What this test is supposed to accomplish

It's a regression alarm that covers a surface the unit tests can't reach on their own:

- **Orchestrator prompt drift** — the orchestrator stops following the mediation playbook (sloppy addendum, delta language leaking into the corrective handoff, wrong effective-outcome judgments).
- **Stateless-reviewer contract leaks** — the re-review accidentally references the prior review instead of evaluating the corrective output on its own merits.
- **Engine / mutation routing drift** — the new frontmatter contract (`orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`) isn't routed correctly, so the corrective task is birthed wrong or not at all.
- **UI drift** — the new frontmatter fields or the `## Orchestrator Addendum` section don't render in the UI, OR a legacy (pre–iter-10) project state regresses.

A passing run gives you confidence that the mediation flow works end-to-end and that the UI handles both new and legacy shapes.

## What the automated run costs

The test spawns a real `@coder` agent and a real `@reviewer` agent. The mediation judgment itself runs in the orchestrator session (no extra subagent). Expect Opus-tier LLM spend comparable to a small task cycle. Don't loop the harness without intent.

## Prerequisites

**Tooling.** Install Node.js 20+ (check `node --version`). Clone this repo and open a terminal at the repo root.

**Dependencies.** Run this once:

```bash
# orchestration scripts — required
cd .claude/skills/rad-orchestration/scripts && npm install && cd -

# UI — only required if you want to do the optional UI smoke at the end
cd ui && npm install && cd -
```

**UI environment file (optional).** If you'll boot the UI for the post-run smoke check, create `ui/.env.local` with these two lines (absolute paths):

```
WORKSPACE_ROOT=<absolute path to this repo root>
ORCH_ROOT=<absolute path to .claude inside this repo>
```

See `installer/lib/env-generator.js` for the canonical template. The UI reads these variables to find the orchestration config and project storage location.

**Port 3000.** If you'll boot the UI, make sure port 3000 is free so Next.js doesn't port-hop to 3001 / 3002:

- Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -ti:3000 | xargs kill -9`

## Run the automated test

1. Open a **fresh** Claude Code session at the repo root. "Fresh" means a new session with no prior context from other work — otherwise session state can interfere with how the run plays out.

2. Open `prompt-tests/corrective-mediation-e2e/_runner.md` in your editor and copy its **entire contents**.

3. Paste the contents into the Claude Code session as your first message. Claude will read the instructions and act as the simulated orchestrator — copying the fixture to a fresh run folder, bootstrapping the pipeline, mediating the review in-session (writing the addendum, authoring the corrective Task Handoff), spawning `@coder` to fix the code, spawning `@reviewer` to re-review, and halting when the corrective re-review returns `approved`.

4. **Fixture**: the default is `broken-colors` (already configured in `_runner.md`). No change needed unless you explicitly want a different fixture.

5. Let the run finish. Typical duration: 5–15 minutes (one coder call + one reviewer call + bookkeeping + the in-session mediation judgment).

6. When the session halts, it will have written `run-notes.md` into the run folder. Ask the session for the exact path and open it.

**If the session errors out** (pipeline returns `success: false`, validator rejects the addendum frontmatter, mutation throws, halt_reason appears unexpectedly), stop and surface to whoever is tracking the iteration. The test exists to catch exactly this class of break.

## Verify the automated run

You're verifying four things: the pass criteria are satisfied, the orchestrator's mediation judgment is coherent, the corrective handoff is self-contained, and the re-review is stateless.

### Read the run notes

Open `output/broken-colors/<run-folder>/run-notes.md`. Verify:

- All 8 pass criteria are listed and marked satisfied.
- Final `code_review.verdict` is `approved`.
- `corrective_tasks.length` is 1 (the fixture is designed to converge in one corrective cycle).
- `graph.status` is `in_progress` — the harness halts before phase_review, which is correct. It does NOT say `halted`.

### Inspect the Orchestrator Addendum

The mediation appended an `## Orchestrator Addendum` section to the review doc. Open `output/broken-colors/<run-folder>/reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md` and check the bottom of the file:

- The `## Orchestrator Addendum` section is present after the original review content.
- Budget banner reads `Attempt 1 of 5`.
- The disposition table has one row for finding `F-1` with disposition `action` and a coherent reason (should trace to FR-1 and note the fix is bounded to `src/colors.js`).
- `Effective Outcome: changes_requested` line is present.
- `Corrective Handoff: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md` line is present.
- The frontmatter at the top of the file was extended with: `orchestrator_mediated: true`, `effective_outcome: changes_requested`, `corrective_handoff_path: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`.

Coherence is the key check here. If the reason text reads like a templated auto-fill or references "what the previous coder missed" (delta language), flag it.

### Inspect the corrective Task Handoff

The orchestrator authored a fresh handoff at `output/broken-colors/<run-folder>/tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`. Open it and check:

- Frontmatter has `corrective_index: 1`, `corrective_scope: task`, `budget_max: 5`, `budget_remaining: 4`.
- The body is **self-contained** — it reads as if describing the task from scratch. It should not contain phrases like "previous attempt", "prior review", "first attempt", "the reviewer noticed", or anything that implies "this is a correction." A coder reading it cold should be able to implement the task without loading any other document.
- Corrective steps are concrete and coder-executable.

### Verify the stateless re-review

The re-review was written to a different file (the filename in `run-notes.md`, typically `BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS-C1.md`). Open it and grep for prior-review references:

- No occurrences of "previous review", "prior review", or "first attempt" in the body.
- The re-review evaluates the fixed `src/colors.js` on its own merits and returns `approved`.

If the re-review mentions the prior review, the stateless-reviewer contract leaked — that's a real finding, not a nit.

## Boot the UI (smoke verification)

This check confirms the UI renders the new corrective-cycle fields AND doesn't regress on legacy projects.

```bash
cd ui && npm run build && npm run dev
```

Open `http://localhost:3000`. Point the UI at the harness run folder's parent (set or confirm `projects.base_path` in `.claude/skills/rad-orchestration/config/orchestration.yml` to include `prompt-tests/corrective-mediation-e2e/output/`). Then verify:

1. **Document viewer** — open the review doc (`reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md`) in the UI. The new frontmatter fields should render: `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`. No fields silently dropped.

2. **Markdown viewer** — the `## Orchestrator Addendum` section renders correctly inside the review doc's markdown view (heading, table, etc.).

3. **DAG timeline** — the corrective task group renders as `C1` under the task loop iteration. The node is visible and labeled.

4. **Legacy regression check** — point the UI at any pre–iter-10 completed project state.json (any existing project under `C:\dev\orchestration-projects\` for example). The DAG timeline should render clean with no missing-node warnings, no layout regressions, and no new console errors. This check exists because the iter-10 changes expanded the state shape; a legacy project's state.json doesn't have the new fields, and we need to make sure the UI degrades gracefully rather than crashing.

## Report your result

If everything looks right, reply `hand-verification clean` to whoever's tracking this.

If anything looks off — incoherent addendum, self-referential corrective handoff, a re-review that references the prior review, missing frontmatter fields in the UI, a legacy project that regresses — surface it. Include the run folder path and a short description of what looked wrong. A broken run caught here is much cheaper than a broken run caught after the iteration lands.
