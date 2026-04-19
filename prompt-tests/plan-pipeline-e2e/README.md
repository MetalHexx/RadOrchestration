# plan-pipeline-e2e

End-to-end regression harness for the `default.yml` planning chain.

## What it tests

The full planning pipeline on a fresh project, from first CLI event to the `plan_approval_gate` halt:

```
requirements_started → spawn_requirements (@planner) →
  master_plan_started → spawn_master_plan (@planner) →
    explosion_started → explode_master_plan (script) →
      plan_approval_gate  ← HALT
```

Drift in any of these surfaces is caught:
- Planner Requirements-mode output structure and ID sequencing
- Planner Master-Plan-mode output structure, phase/task counts, requirement cross-refs
- Explosion-script parser (ingests the planner's master-plan prose)
- Pipeline engine action routing for the planning chain on `default.yml`

## How to run

1. Open a fresh Claude Code session at the repo root.
2. Paste `_runner.md` into the session as the kickoff.
3. Provide the fixture name (default: `rainbow-hello`).
4. The session drives the pipeline to the halt point and writes two reports into the run folder.

The session must NOT approve the gate. The halt IS the success condition.

## Fixtures

| Fixture | Source | Shape |
|---------|--------|-------|
| `rainbow-hello` | `fixtures/rainbow-hello/BRAINSTORMING.md` (copied from `orchestration-projects/RAINBOW-HELLO/RAINBOW-HELLO-BRAINSTORMING.md`) | Small — rainbow ASCII "HELLO WORLD" CLI. Small enough to keep the planner run cheap; real enough to exercise FR/NFR/AD/DD patterns and multi-phase plans. |

## Pass criteria

After the halt:

1. `state.graph.nodes.requirements.status === "completed"`
2. `state.graph.nodes.master_plan.status === "completed"` and `master_plan.parse_retry_count === 0`
3. `state.graph.nodes.explode_master_plan.status === "completed"`
4. `state.graph.nodes.plan_approval_gate.gate_active === true`
5. Per-phase iterations exist under `state.graph.nodes.phase_loop.iterations[]` with pre-seeded `phase_planning` child steps whose `doc_path` points to a real file under `phases/`
6. Per-task iterations likewise, with `task_handoff` child steps pointing under `tasks/`
7. Both linters (`tools/lint-requirements.mjs`, `tools/lint-master-plan.mjs`) return `ok: true` against the emitted docs
8. `lint-report.md` and `run-notes.md` present in the run folder

If any of the above fails, the run is a regression — stop, surface to the operator, do not hide it under a green report.

## Inaugural baseline

The first-ever committed run lives at `output/rainbow-hello/baseline-<timestamp>/`. The inaugural baseline's `lint-report.md` and `run-notes.md` are the only files committed from the run folder. The repo-root `.gitignore` re-includes them via a fixture-specific exception on `output/rainbow-hello/baseline-*/...`. Future fixtures will need their own gitignore exceptions.
