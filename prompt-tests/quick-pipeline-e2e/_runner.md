# Quick Pipeline E2E — Runner Prompt

> **Token cost.** This run invokes the `@planner` subagent **twice** (Requirements, then Master Plan). That is real Opus-tier spend. Do not loop the harness without intent. If a previous run's output is still valid for your purpose, reuse it.

---

## Mission

You are driving the `quick.yml` pipeline end-to-end against a fixed brainstorming fixture so the project gets a regression signal on planner prompts and the explosion script under quick mode.

Behave as a **simulated orchestrator**. The same rules the production orchestrator operates under apply here: signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not make planning decisions yourself, do not edit state.json, do not skip the two-step `_started` → action return protocol. The only differences: you spawn no agents beyond `@planner`, and you **halt when the pipeline returns `action: "request_plan_approval"`** rather than presenting the gate to a human.

Full routing reference lives at `.claude/skills/rad-orchestration/references/pipeline-guide.md` and `action-event-reference.md`.

## Inputs

| Input | Default | Notes |
|-------|---------|-------|
| Fixture name | `rainbow-hello-quick` | Matches `prompt-tests/quick-pipeline-e2e/fixtures/<fixture>/BRAINSTORMING.md` |
| Project name | `baseline-<fixture>-<YYYY-MM-DD>` or `<UPPER-KEBAB-CASE>` | For inaugural baseline runs use `baseline-<fixture>-<YYYY-MM-DD>` (e.g. `baseline-rainbow-hello-quick-2026-05-02`). The inaugural-baseline-name pattern is required for the `.gitignore` exception to re-include `lint-report.md` + `run-notes.md`. |
| Run folder | `prompt-tests/quick-pipeline-e2e/output/<fixture>/<project-name>/` | Use the stable project name as the folder name. |

All paths below are relative to the repo root unless noted.

## Setup (bootstrap)

Hand-roll the minimum project scaffold — do **NOT** invoke the installer and do **NOT** pre-seed `state.json` or `orchestration.yml`. The pipeline engine creates state.json lazily on the first event.

1. Choose a project name; for the first committed baseline use `baseline-rainbow-hello-quick-2026-05-02` (or current date).
2. Create the run folder and the three subdirs the explosion script will write into:
   ```
   prompt-tests/quick-pipeline-e2e/output/<fixture>/<PROJECT-NAME>/
     ├── phases/
     ├── tasks/
     └── backups/
   ```
3. Copy the fixture brainstorming doc into the run folder, renaming it to match project naming conventions (`<PROJECT-NAME>-BRAINSTORMING.md`).

## Drive the pipeline

Invoke `pipeline.js` from the repo root. Initial call uses `--event start` and `--template quick`:

```
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/quick-pipeline-e2e/output/<fixture>/<PROJECT-NAME> \
  --template quick
```

From the first `start`, proceed per the two-step protocol:

- On `spawn_requirements` / `spawn_master_plan` — spawn `@planner` with the action's context and signal the paired `*_completed` event with `--doc-path <absolute-path>`.
- On `explode_master_plan` — shell out to the explosion script per the routing table; on exit 0 signal `explosion_completed`; on exit 2 signal `explosion_failed --parse-error '<json>'`; on exit 1 halt and surface.
- The two-step `_started` → action-return protocol is mandatory. Do not short-circuit it even though you are simulating.

**Halt signal**: `result.action === "request_plan_approval"`. Do not signal `plan_approved`.

Because quick.yml drops `code_review`, `task_gate`, `phase_review`, and `phase_gate` on the execution side, none of those actions should appear before the halt. If any of those fires, the harness state is off-script — halt and surface to the operator.

## Assert pass criteria

Mirror `plan-pipeline-e2e/_runner.md`:

### `lint-report.md`
Run both linters against the emitted docs and capture stdout verbatim:

```
node prompt-tests/tools/lint-requirements.mjs <run-folder>/<PROJECT-NAME>-REQUIREMENTS.md
node prompt-tests/tools/lint-master-plan.mjs <run-folder>/<PROJECT-NAME>-MASTER-PLAN.md
node prompt-tests/tools/lint-requirements.mjs --self-test
node prompt-tests/tools/lint-master-plan.mjs --self-test
```

Include both doc-lint outputs (with the JSON summary line), both self-test outputs, and one sentence summarizing pass/fail.

### `run-notes.md`
- Run folder path + timestamp + project name
- Fixture used
- Pipeline final `result.action` + `state.graph.nodes.plan_approval_gate.gate_active` (read from state.json, do not edit it)
- `state.graph.template_id` confirmed as `quick`
- Counts: phases emitted, tasks emitted, requirement count
- Short human-review checklist mirroring `plan-pipeline-e2e/_runner.md`'s notes section.

## Exit

**Do not approve the gate.** The run ends when `lint-report.md` and `run-notes.md` are written. If a baseline run, surface the two file paths to the operator so they can commit them — the `.gitignore` exception rules only re-include those two filenames under `baseline-*` folders.
