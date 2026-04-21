# Code-Review Rework E2E Harness

End-to-end harness exercising the iter-12 code-review rework across all three review modes in a single run. The `conformance-tiered` fixture drives the orchestrator pipeline from "task 2 just-committed" through final-review-approved, exercising:

- **Task-scope review** — first T2 review (changes_requested with drift) → orchestrator mediation → corrective handoff → T2 re-review (approved).
- **Phase-scope review** — single-pass phase review (approved, since cross-task drift was resolved at task scope).
- **Final-scope review** — strict conformance pass against every project requirement.

See `_runner.md` for the runner prompt driving the cycle. `user-instructions.md` covers operator hand-verification after the automated run completes.

## Pass criteria (10)

See `_runner.md` → Pass Criteria for the shape-based exit checks. All 10 must be green or the run halts and surfaces to the operator — do not relax criteria.

## Folder layout

```
code-review-rework-e2e/
  README.md                        # This document
  _runner.md                       # Runner prompt (drives the cycle)
  user-instructions.md             # Operator hand-verification
  fixtures/
    conformance-tiered/            # 1-phase, 2-task fixture pre-seeded at "T2 just-committed"
  output/
    conformance-tiered/
      .gitkeep
      baseline-conformance-tiered-YYYY-MM-DD/
        run-notes.md               # Inaugural baseline committed; subsequent runs ignored per .gitignore
```

The runner copies the fixture into the run folder, drives the pipeline via `pipeline.js`, captures every state transition and review-doc path, and writes `run-notes.md` at exit.
