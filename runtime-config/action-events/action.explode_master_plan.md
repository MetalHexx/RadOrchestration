---
kind: action
name: explode_master_plan
title: Explode master plan
description: Run the deterministic explosion script to emit per-phase and per-task docs and seed the phase loop.
category: agent-spawn
completion_event: explosion_completed
---

Invoke the explosion subcommand — no agent spawn. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" plan explode` with `--project-dir`, `--master-plan`, and `--project-name`. The script parses the approved Master Plan, emits per-phase and per-task docs into `phases/` and `tasks/`, and pre-seeds `state.graph.nodes.phase_loop.iterations[]` with `doc_path` on each phase and task iteration.

If `phases/` or `tasks/` already contain anything, the script first moves the existing contents into `backups/{ISO-timestamp}/` before re-seeding.

Disambiguate the result by envelope shape. `ok: true` with `data.error` present is a parse failure — extract `{ line, expected, found, message }` from `data.error`, format as a JSON string, and signal `explosion_failed --parse-error '<json>'`. `ok: false` with `error.type: system_error` is a real failure — route through `rad-log-error`. On clean success, signal `explosion_completed`.
