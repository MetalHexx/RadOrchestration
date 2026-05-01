# Plan Pipeline E2E — Runner Prompt

> **Token cost.** This run invokes the `@planner` subagent **twice** (Requirements, then Master Plan). That is real Opus-tier spend. Do not loop the harness without intent. If a previous run's output is still valid for your purpose, reuse it.

---

## Mission

You are driving the `default.yml` pipeline end-to-end against a fixed brainstorming fixture so the project gets a regression signal on planner prompts and the explosion script.

Behave as a **simulated orchestrator**. The same rules the production orchestrator operates under apply here: signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not make planning decisions yourself, do not edit state.json, do not skip the two-step `_started` → action return protocol. The only differences: you spawn no agents beyond `@planner`, and you **halt when the pipeline returns `action: "request_plan_approval"`** rather than presenting the gate to a human.

Full routing reference lives at `.claude/skills/rad-orchestration/references/pipeline-guide.md` and `action-event-reference.md` — load them if you are not already carrying that context.

## Inputs

| Input | Default | Notes |
|-------|---------|-------|
| Fixture name | `rainbow-hello` | Matches `prompt-tests/plan-pipeline-e2e/fixtures/<fixture>/BRAINSTORMING.md` |
| Project name | `baseline-<fixture>-<YYYY-MM-DD>` or `<UPPER-KEBAB-CASE>` | For inaugural/tracked baseline runs, use `baseline-<fixture>-<YYYY-MM-DD>` (lowercase, `baseline-` prefix; e.g. `baseline-rainbow-hello-2026-04-19`) — this pattern is **required** for the `.gitignore` exception to re-include `lint-report.md` + `run-notes.md`. For ad-hoc re-runs (non-baseline, untracked), the project-name shape is flexible (UPPER-KEBAB-CASE or lowercase both work); whatever you pick becomes `state.project.name`. The inaugural baseline in this PR used the baseline-<fixture>-<date> convention. **This becomes `state.project.name`** — the engine sets it to `path.basename(--project-dir)`, so the run-folder name IS the project name. |
| Run folder | `prompt-tests/plan-pipeline-e2e/output/<fixture>/<project-name>/` | Use the stable project name as the folder name (e.g. `output/rainbow-hello/RAINBOW-HELLO-HARNESS-2026-04-19/`). Distinguish re-runs by bumping the date suffix or appending `-v2`, not by embedding a timestamp. Only `lint-report.md` and `run-notes.md` inside a `baseline-*`-named folder escape the `.gitignore`; everything else stays untracked. |

> **How project name is passed to the engine.** There is no `--name` CLI flag. The engine reads `path.basename(--project-dir)` on the `start` event and writes it into `state.project.name`. All downstream doc filenames (e.g. `<PROJECT-NAME>-REQUIREMENTS.md`) derive from that value. Choosing a stable, descriptive folder name is therefore the only way to get readable doc names.

All paths below are relative to the repo root unless noted.

## Setup (bootstrap)

Hand-roll the minimum project scaffold — do **NOT** invoke the installer and do **NOT** pre-seed `state.json` or `orchestration.yml`. The pipeline engine creates state.json lazily on the first event.

1. Choose a project name. For inaugural baseline runs (tracked, committed), use `baseline-<fixture>-<YYYY-MM-DD>` (e.g. `baseline-rainbow-hello-2026-04-19`). For ad-hoc re-runs, use any stable identifier (UPPER-KEBAB-CASE like `RAINBOW-HELLO-HARNESS-2026-04-19` or lowercase — both work). This name doubles as the run-folder basename and becomes `state.project.name` — the engine derives the project name from `path.basename(--project-dir)` at `start` time, so there is no separate flag to pass.
2. Create the run folder (named after the project name) and the three subdirs the explosion script will write into:
   ```
   prompt-tests/plan-pipeline-e2e/output/<fixture>/<PROJECT-NAME>/
     ├── phases/
     ├── tasks/
     └── backups/
   ```
   Example: `output/rainbow-hello/RAINBOW-HELLO-HARNESS-2026-04-19/`
3. Copy the fixture brainstorming doc into the run folder, renaming it to match project naming conventions (`<PROJECT-NAME>-BRAINSTORMING.md`):
   ```
   prompt-tests/plan-pipeline-e2e/fixtures/<fixture>/BRAINSTORMING.md
     → prompt-tests/plan-pipeline-e2e/output/<fixture>/<PROJECT-NAME>/<PROJECT-NAME>-BRAINSTORMING.md
   ```
   The `@planner` agent in Requirements mode discovers this file by convention.

Do NOT create `state.json`, `orchestration.yml`, or `template.yml` yourself. The engine writes `state.json` on the first `start` event and snapshots `template.yml` from the global templates folder.

## Drive the pipeline

Invoke `pipeline.js` from the repo root (the entry auto-installs dependencies on first run). The run folder you created is `--project-dir` for every call.

Initial call — use `--event start` to scaffold state. The engine rejects any non-`start` event when `state.json` does not yet exist.

```
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/plan-pipeline-e2e/output/<fixture>/<PROJECT-NAME> \
  --template default
```

The first `start` scaffolds `state.json` + snapshots `template.yml` into the run folder and returns `action: "spawn_requirements"`. From there proceed per the two-step protocol (signal `requirements_started`, get `spawn_requirements` back, spawn the planner, signal `requirements_completed --doc-path <path>`). The two-step protocol is documented on each action row of the routing table.

Loop per the Action Routing Table:

- On `spawn_requirements` / `spawn_master_plan` — spawn `@planner` with the action's context. The agent writes the output doc per `rad-create-plans`; capture the `doc_path` from its return. Then signal the paired `*_completed` event with `--doc-path <absolute-path>`.
- On `explode_master_plan` — shell out to the explosion script per action #2a in the routing table. On exit 0 signal `explosion_completed`; on exit 2 signal `explosion_failed --parse-error '<json>'` (same structured payload the script emits). On exit 1 **halt and surface to the operator** — do not invent a recovery.
- On any other action that implies an agent spawn other than `@planner` (executor, reviewer, source-control) — the default template DOES emit these during its execution tier, but this harness halts at the `request_plan_approval` gate BEFORE any of those fire. If you see one of those actions before the halt signal, the harness state is off-script (state file was edited, or the gate was approved out-of-band). Halt and surface.
- The two-step `_started` → action-return protocol is mandatory. Do not short-circuit it even though you are simulating.

**Halt signal**: `result.action === "request_plan_approval"`. Do not signal `plan_approved`. The run has produced everything the harness needs — requirements, master plan, and exploded phase/task files — before the gate.

## Assert pass criteria

When the loop halts at `request_plan_approval`, write two artifacts into the run folder:

### `lint-report.md`

Run both linters and capture their stdout verbatim:

```
node prompt-tests/tools/lint-requirements.mjs <run-folder>/<PROJECT-NAME>-REQUIREMENTS.md
node prompt-tests/tools/lint-master-plan.mjs <run-folder>/<PROJECT-NAME>-MASTER-PLAN.md
```

Also run both linters in self-test mode and confirm they exit 0 and surface their expected errors:

```
node prompt-tests/tools/lint-requirements.mjs --self-test
node prompt-tests/tools/lint-master-plan.mjs --self-test
```

`lint-report.md` should contain: both doc-lint outputs (including the JSON summary line), both self-test outputs, and one sentence summarizing overall pass/fail.

### `run-notes.md`

Short, high-signal. Include:

- Run folder path + timestamp + project name
- Fixture used
- Pipeline final `result.action` + `state.graph.nodes.plan_approval_gate.gate_active` (read from state.json, do not edit it)
- Counts: phases emitted (= `state.graph.nodes.phase_loop.iterations.length`), tasks emitted (sum of per-phase task_loop iterations), requirement count (from Requirements frontmatter)
- A short human-review checklist for the operator to eyeball the planner output (1–2 sentences per phase/task — are titles coherent, are requirement IDs cited sensibly, does the plan match the brainstorming scope).

## Exit

**Do not approve the gate.** The run ends when `lint-report.md` and `run-notes.md` are written. If a baseline run, surface the two file paths to the operator so they can commit them — the `.gitignore` exception rules only re-include those two filenames under `baseline-*` folders; everything else (`state.json`, emitted phase/task docs, brainstorming copy) stays untracked and regenerates on the next run.

If any step halted or surfaced unexpectedly (non-zero pipeline exit, linter errors on otherwise-valid output, unfamiliar action name), stop and surface to the operator — do not silently paper over a broken run with a green report.
