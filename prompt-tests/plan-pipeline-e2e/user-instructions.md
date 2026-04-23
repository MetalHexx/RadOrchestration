# plan-pipeline-e2e — How to Run and Verify

A friendly walkthrough for running this test end-to-end. No prior knowledge of the orchestration pipeline required.

## What this test is

This test exercises the **planning half of our pipeline** on a small fixed project (a "rainbow HELLO WORLD" CLI tool). It runs the real `@planner` agent twice — once to produce a Requirements document, once to produce a Master Plan — then runs the deterministic explosion script that splits the master plan into per-phase and per-task files.

## What this test is supposed to accomplish

It's a regression alarm. If anyone changes the planner's prompt, the explosion parser, or the pipeline engine's routing for planning events, this test is designed to catch it. Specifically:

- **Planner drift** — the Requirements and Master Plan docs come out malformed (wrong structure, missing frontmatter, broken IDs, sloppy content).
- **Explosion parser drift** — the script can't parse a reasonable planner output and crashes or produces malformed per-phase / per-task docs.
- **Engine routing drift** — events don't flow through the expected sequence (`requirements_started` → `spawn_requirements` → ... → `plan_approval_gate`).

A passing run gives you confidence that a fresh project would enter the planning phase cleanly.

## What the automated run costs

The test invokes the `@planner` agent twice. Each call is a real Opus-tier LLM spend. Don't loop the harness without intent. If a recent run's output is still valid, reuse it.

## Prerequisites

**Tooling.** Install Node.js 20+ (check `node --version`). Clone this repo and open a terminal at the repo root.

**Dependencies.** Run this once in each subfolder you'll use:

```bash
# orchestration scripts — required
cd .claude/skills/orchestration/scripts && npm install && cd -

# UI — only required if you want to do the optional UI smoke at the end
cd ui && npm install && cd -
```

**UI environment file (optional).** If you plan to boot the UI for the post-run smoke check, create `ui/.env.local` with these two lines (use absolute paths):

```
WORKSPACE_ROOT=<absolute path to this repo root>
ORCH_ROOT=<absolute path to .claude inside this repo>
```

See `installer/lib/env-generator.js` for the canonical template. The UI reads these variables to find your orchestration config and project storage location.

**Port 3000.** If you'll boot the UI, make sure port 3000 is free so Next.js doesn't port-hop to 3001 / 3002:

- Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -ti:3000 | xargs kill -9`

## Run the automated test

1. Open a **fresh** Claude Code session at the repo root. "Fresh" means a new session with no prior context from other work — otherwise session state can interfere with how the run plays out.

2. Open `prompt-tests/plan-pipeline-e2e/_runner.md` in your editor and copy its **entire contents**.

3. Paste the contents into the Claude Code session as your first message. Claude will read the instructions and act as a simulated orchestrator — signaling events to `pipeline.js`, spawning `@planner` when the pipeline asks for it, and halting automatically when the pipeline reaches the `request_plan_approval` human gate.

4. **Fixture**: the default is `rainbow-hello` (already configured in `_runner.md`). No change needed unless you explicitly want a different fixture.

5. Let the run finish. Typical duration: 3–8 minutes (two planner calls + one explosion script + bookkeeping).

6. When the session halts, it will have written two files into the run folder:
   - `lint-report.md` — output of the Requirements and Master Plan linters
   - `run-notes.md` — a short summary of what happened

   Ask the session for the exact path to the run folder and open it.

**If the session errors out** (pipeline returns `success: false`, script crashes, planner output malformed), stop and surface to whoever is tracking the iteration. Don't "fix" it on the fly — the test exists to catch exactly that kind of break.

## Verify the automated run

You're verifying two things: the linters accepted the planner output, AND the planner output makes semantic sense.

### Check the linter report

Open `lint-report.md` in the run folder. Look for:

- **Zero errors** on both the Requirements linter and the Master Plan linter against the real output docs.
- **Both self-tests** (the linters run against their own golden-fail fixtures) exit with the errors they were designed to catch. If the self-tests don't surface their expected errors, the linter itself may be broken — escalate.

### Inspect the planner output

Machine linting covers structural correctness; you're checking semantic quality. Open the run folder:

- `<PROJECT-NAME>-REQUIREMENTS.md` — skim the requirements. Do the FR / NFR / AD / DD blocks read coherently? Do the IDs sequence correctly (FR-1, FR-2, FR-3 with no gaps)? Does the `requirement_count` in frontmatter match the number of blocks in the body?
- `<PROJECT-NAME>-MASTER-PLAN.md` — skim the phase / task decomposition. Does it match the fixture's scope (a small ASCII rainbow HELLO WORLD CLI)? Are requirement IDs cited sensibly in each task's "satisfies" section?
- `phases/` and `tasks/` — check a couple of the emitted per-phase and per-task files. They should be well-formed markdown with no raw placeholder tokens like `{TITLE}` or `{PROJECT-NAME}` leaking through.

### Read the run notes

`run-notes.md` contains a high-signal summary of what the run did. Cross-check that the counts make sense (phases emitted, tasks emitted, requirement count).

## Boot the UI (optional smoke)

Skip this if you're time-boxed; it's a bonus check that the UI renders the run output.

```bash
cd ui && npm run build && npm run dev
```

Open `http://localhost:3000`. Point the UI at the run folder's parent (whatever `projects.base_path` the dev instance resolves to — check `.claude/skills/orchestration/config/orchestration.yml`). The DAG timeline should render:

- The seeded planning nodes (`requirements`, `master_plan`, `explode_master_plan`, `plan_approval_gate`) all marked completed.
- Per-phase iterations, each with a `phase_planning` child step pointing at its emitted file in `phases/` via a clickable Doc link.
- Per-task iterations, each with a `task_handoff` child step pointing at its emitted file in `tasks/`.

Click through a Doc link to confirm the markdown renders.

## Report your result

If everything looks right, reply `hand-verification clean` to whoever's tracking this.

If anything looks off — incoherent planner output, broken links in the UI, linter errors on output that looks fine to you, layout regressions, console errors — surface it. Include the run folder path and a short description of what looked wrong. A broken run caught here is much cheaper than a broken run caught after the iteration lands.
