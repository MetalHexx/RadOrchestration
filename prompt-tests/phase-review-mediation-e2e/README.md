# phase-review-mediation-e2e

End-to-end regression harness for the orchestrator's **phase-scope** mediation corrective cycle introduced in Iter 11.

## What it tests

The orchestrator's mediation behavior when a phase reviewer returns `verdict: changes_requested`. Mirrors the task-scope `corrective-mediation-e2e/` harness from Iter 10, at phase scope. The full cycle:

```
phase_review (in_progress, changes_requested) →
  orchestrator reads review →
    loads corrective-playbook.md (Phase-Scope Mediation section) →
      judges each finding (cross-artifact scan across Tasks in the phase) →
        appends ## Orchestrator Addendum to phase review doc →
          appends additive frontmatter (orchestrator_mediated, effective_outcome, corrective_handoff_path) →
            authors phase-sentinel corrective Task Handoff (tasks/…-PHASE-C1.md) →
              signals phase_review_completed →
                pipeline births phase-scope corrective task entry →
                  execute_task (@coder) →
                    code_review_completed (approved) ← HALT
```

The runner fixture is pre-seeded at the mediation entry point: `phase_review.status = in_progress`, the phase review doc already on disk with `verdict: changes_requested` and no Orchestrator Addendum yet. `start` returns `action: null` because the walker does not re-emit actions for in-progress nodes — that `null` is the correct "mediation entry point" signal. The orchestrator then performs its mediation out-of-band (read phase review → write addendum + additive frontmatter → author phase-sentinel corrective Task Handoff) before signaling `phase_review_completed`.

Drift in any of these surfaces is caught:

- Orchestrator mediation judgment quality at phase scope (playbook-prompt drift on the Phase-Scope Mediation section)
- Addendum and additive frontmatter authoring on `phase_review` docs
- Phase-sentinel corrective Task Handoff filename, placement, and self-sufficiency
- Pipeline `phase_review_completed` event routing when `effective_outcome` is supplied (birth-on-handoff-path)
- Phase-scope corrective task birth under `phaseIter.corrective_tasks[]` (not `taskIter.corrective_tasks[]`)
- Context enrichment routing `handoff_doc` / `task_id: P{NN}-PHASE` to the phase-scope corrective
- Task-level re-review filename form `{NAME}-CODE-REVIEW-P{NN}-PHASE-C{N}.md`
- Stateless phase reviewer contract (phase review workflow sheds cross-attempt memory; Requirements row added, Previous Phase Review row removed)
- UI rendering of phase-scope corrective stacks (`fully-hydrated/` showcase fixture)

## How to run

1. Open a fresh Claude Code session at the repo root.
2. Paste `_runner.md` into the session as the kickoff.
3. The session drives the phase-scope corrective cycle to `approved` and writes `run-notes.md` into the run folder.

The session must NOT drive Phase 2 or `final_review` downstream of the corrective approval. Once the corrective's re-review returns `approved` and the pipeline advances past the Phase 1 iteration, the harness records final state and halts.

## Fixtures

| Fixture | Source | Shape |
|---------|--------|-------|
| `colors-greet-mismatch` | `fixtures/colors-greet-mismatch/` (runner-driven; pre-seeded at phase_review in_progress) | Two-task cross-task contract drift. T1 exports `makeColors()` returning strings; T2's `greet()` expects objects. Both task-level code reviews approve in isolation; the phase review catches the integration mismatch and opens the phase-scope corrective cycle. |
| `fully-hydrated` | `fixtures/fully-hydrated/` (static UI showcase; NOT runner-driven) | Pre-cooked `state.json` + all on-disk docs. Phase 1 holds T1 (1 task-scope corrective), T2 (clean), T3 (2 task-scope correctives), and 2 phase-scope correctives — the first of which was itself mediated after its task-level code review returned `changes_requested` (exercises ancestor-derivation at phase scope). Phase 2 holds 1 clean task. Exists so the implementing agent can Claude-in-Chrome-verify maximum rendering density + regression-check a no-corrective phase. |

## Pass criteria (runner fixture)

After the phase-scope corrective cycle converges:

1. `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length >= 1` AND final corrective's `task_handoff.status === 'completed'` AND `task_handoff.doc_path` matches `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C{N}.md`.
2. Phase review doc contains `## Orchestrator Addendum` with budget banner (`Attempt N of M`), Finding Dispositions table, `Effective Outcome:` line, `Corrective Handoff:` line.
3. Phase review doc frontmatter has `orchestrator_mediated: true`, `effective_outcome ∈ {approved, changes_requested}`, `corrective_handoff_path` iff effective_outcome = changes_requested. `exit_criteria_met` untouched.
4. Phase-sentinel corrective handoff file exists with frontmatter `corrective_index: 1`, `corrective_scope: phase`, `budget_max` + `budget_remaining` set, body self-contained (no prior-attempt references).
5. **Phase-iteration reset block is GONE**: `phase_loop.iterations[0].nodes['phase_review'].status === 'completed'` (NOT reset); its `verdict` = effective_outcome; `nodes['phase_planning'].status === 'completed'` (NOT reset); `nodes['task_loop'].iterations` unchanged (NOT cleared).
6. Task-level re-review doc body does NOT reference the prior phase review (grep heuristic: no "previous review", "phase review said", "first attempt", "prior review").
7. `phase_loop.iterations[0].corrective_tasks[0].status === 'completed'` AND `phase_loop.iterations[0].status === 'completed'`. Graph not halted.
8. Only ONE `PHASE-REVIEW-…md` doc on disk (no `-C{N}.md` corrective form). Walker does NOT re-dispatch `spawn_phase_reviewer` after corrective's task-review approves.
9. Budget intact: `phaseIter.corrective_tasks.length <= max_retries_per_task`; converges in 1 cycle.
10. Task-level re-review save-path uses phase sentinel: filename matches `CODE-REVIEW-P01-PHASE-C1.md`.

If any criterion fails, the run is a regression — stop, surface to the operator, do not hide it under a green report.

## Inaugural baseline

The first-ever committed run lives at `output/colors-greet-mismatch/baseline-colors-greet-mismatch-2026-04-21/`. Only `run-notes.md` is committed from the run folder. The repo-root `.gitignore` re-includes it via a fixture-specific exception on `output/colors-greet-mismatch/baseline-*/run-notes.md`.

## Hand-verification

See `user-instructions.md` for the operator second-eyes pass after the automated run. Covers run-notes inspection, addendum + phase-sentinel corrective handoff coherence, and an independent UI smoke check against the `fully-hydrated/` showcase fixture.
