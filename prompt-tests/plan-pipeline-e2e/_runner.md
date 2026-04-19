# Plan Pipeline E2E — Runner Prompt

> **Token cost.** This run invokes the `@planner` subagent **twice** (Requirements, then Master Plan). That is real Opus-tier spend. Do not loop the harness without intent. If a previous run's output is still valid for your purpose, reuse it.

---

## Mission

You are driving the `default.yml` pipeline end-to-end against a fixed brainstorming fixture so the project gets a regression signal on planner prompts and the explosion script.

Behave as a **simulated orchestrator**. The same rules the production orchestrator operates under apply here: signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not make planning decisions yourself, do not edit state.json, do not skip the two-step `_started` → action return protocol. The only differences: you spawn no agents beyond `@planner`, and you **halt when the pipeline returns `action: "request_plan_approval"`** rather than presenting the gate to a human.

Full routing reference lives at `.claude/skills/orchestration/references/pipeline-guide.md` and `action-event-reference.md` — load them if you are not already carrying that context.

## Inputs

| Input | Default | Notes |
|-------|---------|-------|
| Fixture name | `rainbow-hello` | Matches `prompt-tests/plan-pipeline-e2e/fixtures/<fixture>/BRAINSTORMING.md` |
| Run folder | `prompt-tests/plan-pipeline-e2e/output/<fixture>/baseline-<YYYY-MM-DD-HHMMSS>/` | Use `baseline-*` prefix only for inaugural or operator-requested baselines; ad-hoc runs use `run-*`. Only `baseline-*/lint-report.md` and `baseline-*/run-notes.md` escape the `.gitignore`. |
| Project name | Derived from `path.basename(runFolder)` | The pipeline uses the folder name as `state.project.name` |

All paths below are relative to the repo root unless noted.

## Setup (bootstrap)

Hand-roll the minimum project scaffold — do **NOT** invoke the installer and do **NOT** pre-seed `state.json` or `orchestration.yml`. The pipeline engine creates state.json lazily on the first event.

1. Compute a timestamp in the operator's local time as `YYYY-MM-DD-HHMMSS` and choose a prefix (`baseline-` vs `run-`) per the table above.
2. Create the run folder and the three subdirs the explosion script will write into:
   ```
   prompt-tests/plan-pipeline-e2e/output/<fixture>/<prefix><timestamp>/
     ├── phases/
     ├── tasks/
     └── backups/
   ```
3. Copy the fixture brainstorming doc into the run folder, renaming it to match project naming conventions (`<PROJECT-NAME>-BRAINSTORMING.md`, where `<PROJECT-NAME>` is the uppercase run-folder name):
   ```
   prompt-tests/plan-pipeline-e2e/fixtures/<fixture>/BRAINSTORMING.md
     → prompt-tests/plan-pipeline-e2e/output/<fixture>/<prefix><timestamp>/<PROJECT-NAME>-BRAINSTORMING.md
   ```
   The `@planner` agent in Requirements mode discovers this file by convention.

Do NOT create `state.json`, `orchestration.yml`, or `template.yml` yourself. The engine writes `state.json` on the first `start` event and snapshots `template.yml` from the global templates folder.

## Drive the pipeline

Invoke `pipeline.js` from the repo root (the entry auto-installs dependencies on first run). The run folder you created is `--project-dir` for every call.

> **Config quirk — read once, then act.** The system-wide config at `.claude/skills/orchestration/config/orchestration.yml` currently has `default_template: "ask"`. When the resolver sees `ask` with no project-local `template.yml` and no CLI `--template`, it falls through to `full.yml` — **not** `default.yml`. You must pass `--template default` on the first call so the engine snapshots the lean planning template into the run folder. Subsequent calls inherit `template_id` from state and do not need the flag.

Initial call — use `--event start` to scaffold state. The engine rejects any non-`start` event when `state.json` does not yet exist.

```
node .claude/skills/orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/plan-pipeline-e2e/output/<fixture>/<prefix><timestamp> \
  --template default
```

The first `start` scaffolds `state.json` + snapshots `template.yml` into the run folder and returns `action: "spawn_requirements"`. From there proceed per the two-step protocol (signal `requirements_started`, get `spawn_requirements` back, spawn the planner, signal `requirements_completed --doc-path <path>`). The two-step protocol is documented on each action row of the routing table.

Loop per the Action Routing Table:

- On `spawn_requirements` / `spawn_master_plan` — spawn `@planner` with the action's context. The agent writes the output doc per `rad-create-plans`; capture the `doc_path` from its return. Then signal the paired `*_completed` event with `--doc-path <absolute-path>`.
- On `explode_master_plan` — shell out to the explosion script per action #2a in the routing table. On exit 0 signal `explosion_completed`; on exit 2 signal `explosion_failed --parse-error '<json>'` (same structured payload the script emits). On exit 1 **halt and surface to the operator** — do not invent a recovery.
- On any other action that implies an agent spawn other than `@planner` (executor, reviewer, tactical-planner, source-control) — the default template does not emit those. If you see one, the pipeline is on the wrong template. Halt and surface.
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
