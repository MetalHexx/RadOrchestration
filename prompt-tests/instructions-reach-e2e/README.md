# instructions-reach-e2e

Prompt-harness regression that measures whether project-level instruction files — `CLAUDE.md`, `AGENTS.md`, and `.github/copilot-instructions.md` — placed at the **project (run folder) root** reach the `@planner` and `@coder` subagents the orchestration pipeline spawns.

The hypothesis under test: orchestration's spawn-prompt construction (see `.claude/agents/orchestrator.md` lines 46-64) inlines only the `## Repository Skills Available` manifest, and only for the planner. No other context — including these instruction files — is explicitly forwarded to subagents. Whether subagents see them at all therefore depends entirely on Claude Code's own CLAUDE.md auto-load behavior, which is the empirical question this harness answers.

## What it tests

For each of three planted instruction files at the project root:

```
<run-folder>/
  ├── CLAUDE.md                           ← marker: MARKER-CLAUDEMD-7G3K9P
  ├── AGENTS.md                           ← marker: MARKER-AGENTSMD-5Q8L2N
  └── .github/copilot-instructions.md     ← marker: MARKER-COPILOT-4R6T1J
```

each file contains a scoped rule that, if honored by the subagent, MUST inject the marker token into the agent's output. The harness drives the planner via the standard `default.yml` chain and spawns `@coder` directly against a pre-baked handoff, then greps each agent's output for the corresponding marker.

Reach is determined by the resulting matrix:

| Subagent | What it produces | Marker greped from | Marker token |
|---|---|---|---|
| `@planner` (Requirements + Master Plan spawns) | Requirements + Master Plan docs | the emitted Master Plan body | `MARKER-CLAUDEMD-7G3K9P` |
| `@coder` (one direct handoff invocation) | `src/reverse.js` + `src/__tests__/reverse.test.js` | both source files | `MARKER-AGENTSMD-5Q8L2N` and `MARKER-COPILOT-4R6T1J` |

Marker present ⇒ that file was visible to that subagent. Marker absent ⇒ it was not.

## How to run

1. Open a fresh Claude Code session at the repo root.
2. Paste `_runner.md` into the session as the kickoff.
3. The session bootstraps the run folder (copying the canary instruction files, brainstorming doc, package.json, and source seeds into it), drives the planner via `pipeline.js` to the plan-approval gate, spawns `@coder` against the pre-baked handoff, then writes the reach matrix into `run-notes.md` and the supporting greps into `lint-report.md`.

The session must NOT approve the gate. The halt at `request_plan_approval` is intentional.

## Fixture

| Fixture | Source | Shape |
|---------|--------|-------|
| `instructions-canary` | `fixtures/instructions-canary/` | One-function ESM utility (`reverseString`). Carries three planted instruction files at the project root (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`), each with a distinctive marker token and a scoped rule that, if honored, surfaces the marker in the agent's output. Also ships a pre-baked task handoff at `tasks/INSTRUCTIONS-CANARY-TASK-P01-T01-REVERSE.md`, two empty source seeds at `src/reverse.js` and `src/__tests__/reverse.test.js`, and a `package.json` setting `"type": "module"` for ESM. The handoff itself does NOT mention the markers or the instruction files. |

## Pass criteria

This harness is **descriptive, not prescriptive**. It always produces a reach matrix; the matrix itself is the artifact.

The expected reach matrix at first baseline (the working hypothesis):

| Subagent | CLAUDE.md marker | AGENTS.md marker | copilot-instructions.md marker |
|---|---|---|---|
| `@planner` | absent | n/a | n/a |
| `@coder` | n/a | absent | absent |

The committed baseline `run-notes.md` records the actual matrix observed at run time. A future run that flips a row from absent → present (or vice versa) is a behavior change worth investigating — either the orchestration pipeline started forwarding instruction files into spawn prompts, or Claude Code's auto-load behavior changed, or model behavior shifted.

Hard fails — the run is broken, surface to the operator (independent of the reach matrix outcome):

- Pipeline halts on a non-`request_plan_approval` action.
- `lint-requirements.mjs` or `lint-master-plan.mjs` returns `ok: false` against the emitted docs.
- The pre-baked coder handoff is not found at the expected path or `@coder` fails to emit the prescribed source files.
- The coder's read log shows reads of upstream planning docs (`*-BRAINSTORMING.md`, `*-REQUIREMENTS.md`, `*-MASTER-PLAN.md`, `phases/*`) — that would violate `rad-execute-coding-task`'s handoff-only contract, orthogonal to what this test measures but a regression worth catching.

## Token cost

- 2× `@planner` invocations (Requirements + Master Plan) — Opus tier.
- 1× `@coder` invocation (Sonnet) — Sonnet tier.

Same Opus footprint as `plan-pipeline-e2e` plus one Sonnet coder call. Do not loop the harness without intent.

## Inaugural baseline

To commit the inaugural baseline:

1. Run the harness with a project name of `baseline-instructions-canary-<YYYY-MM-DD>`.
2. Confirm both linters return `ok: true` and the reach matrix is filled in for all four cells (planner CLAUDE.md, coder AGENTS.md, coder copilot, plus the read-log cross-check column).
3. Stage only `output/instructions-canary/baseline-instructions-canary-<YYYY-MM-DD>/lint-report.md` and `run-notes.md`.
4. Commit with a message describing the baseline date and observed reach matrix.

The `.gitignore` exception re-includes only `lint-report.md` and `run-notes.md` under `baseline-*` folders. All other run artifacts (`state.json`, emitted docs, brainstorming copy, copied instruction files, generated source) stay untracked and regenerate on the next run.
