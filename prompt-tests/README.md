# prompt-tests/

Operator-driven regression harness for planner subagent outputs and the planning-tier pipeline glue.

Planner output is non-deterministic by design: small prompt tweaks or skill-workflow edits can shift structure without regressing any structural test. Unit tests catch engine bugs. This harness catches **planner behavioral drift** — the kind that only shows up end-to-end against a real fixture.

The harness sits at the repo root (sibling to `docs/`, `installer/`, `ui/`, `.claude/`) by design. It does not load on every Claude session, has no CI integration, and is not part of the `.claude/` skill tree. Operators run it on demand.

## Behaviors

| Folder | What it exercises |
|--------|-------------------|
| [`plan-pipeline-e2e/`](./plan-pipeline-e2e/) | `default.yml` planning chain end-to-end — Requirements → Master Plan → explosion script. Halts at `plan_approval_gate`. |

## Running a behavior

1. Open a fresh Claude Code session at the repo root.
2. Paste the contents of `<behavior>/_runner.md` into the session as the kickoff prompt.
3. Pass the fixture name as input (default `rainbow-hello`).
4. Let the session drive the pipeline to its documented halt point and write the reports.

No runner executes on its own. The `_runner.md` file is authored as a prompt for a Claude session acting as a simulated orchestrator.

## Token cost — read before you loop

Each pass of `plan-pipeline-e2e` invokes `@planner` **twice** (Requirements, Master Plan). That is real Opus spend per run. Do not loop the harness for cosmetic verification. Re-run only when a planner prompt, skill workflow, or explosion-script change actually warrants a new baseline.

## Adding a new behavior

Mirror `plan-pipeline-e2e/`: a behavior folder with its own `README.md`, `_runner.md`, `fixtures/`, and `output/`. Keep `_runner.md` goal-oriented — describe what the simulated orchestrator session should accomplish, not every exact CLI invocation. The engine's `next_action` returns plus the Action Routing Table (`.claude/skills/orchestration/references/action-event-reference.md`) handle the step-by-step decisions.

All run outputs under `output/` are gitignored by default (see the repo-root `.gitignore`). Narrower `!` exceptions re-include operator-committed baselines; everything else regenerates on each run.

## Design reference

Iteration design rationale lives at `docs/internals/cheaper-execution/iter-06-prompt-harness.md`. The harness is scope-locked there; broader architectural context for the refactor lives in `docs/internals/CHEAPER-EXECUTION-REFACTOR.md` and `CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`.

## Tools

- `tools/lint-requirements.mjs` — structural linter for `{PROJECT}-REQUIREMENTS.md` docs
- `tools/lint-master-plan.mjs` — structural linter for `{PROJECT}-MASTER-PLAN.md` docs, with cross-reference against the companion requirements doc

Both are dependency-free Node `.mjs` scripts. Each supports `--self-test` mode against an in-memory malformed fixture to demonstrate actionable error messages.
