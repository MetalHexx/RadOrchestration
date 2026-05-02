# quick-pipeline-e2e

End-to-end regression harness for the `quick.yml` planning chain.

## What it tests

The quick pipeline's planning half on a fresh project, from first CLI event to the `plan_approval_gate` halt:

```
requirements_started → spawn_requirements (@planner) →
  master_plan_started → spawn_master_plan (@planner) →
    explosion_started → explode_master_plan (script) →
      plan_approval_gate  ← HALT
```

The planning chain is identical to `default.yml` by design (quick is pure subtraction on the execution side), so this harness primarily catches drift that is quick-specific: template-resolver picking up `quick.yml`, `--template quick` flowing through to state, and the wrap-up chain remaining intact post-halt-state on the YAML side.

## How to run

1. Open a fresh Claude Code session at the repo root.
2. Paste `_runner.md` into the session as the kickoff.
3. Provide the fixture name (default: `rainbow-hello-quick`).
4. The session drives the pipeline to the halt point and writes two reports into the run folder.

The session must NOT approve the gate. The halt IS the success condition.

## Fixtures

| Fixture | Source | Shape |
|---------|--------|-------|
| `rainbow-hello-quick` | `fixtures/rainbow-hello-quick/BRAINSTORMING.md` | Same shape as `plan-pipeline-e2e/rainbow-hello`, sized so an Extra Large planner produces a multi-task, multi-phase plan suitable for asserting "multiple tasks execute without per-task review." |

## Pass criteria

After the halt:

1. `state.graph.template_id === "quick"` and the snapshotted `template.yml` in the run folder matches `quick.yml`.
2. `state.graph.nodes.requirements.status === "completed"`
3. `state.graph.nodes.master_plan.status === "completed"` and `master_plan.parse_retry_count === 0`
4. `state.graph.nodes.explode_master_plan.status === "completed"`
5. `state.graph.nodes.plan_approval_gate.gate_active === true`
6. Per-phase iterations exist; per-task iterations likewise.
7. Both linters return `ok: true` against the emitted docs.
8. `lint-report.md` and `run-notes.md` present in the run folder.

Token cost: per `_runner.md`, this run invokes `@planner` at most twice — once for Requirements, once for the Master Plan — matching `plan-pipeline-e2e`'s cost profile (NFR-4).
