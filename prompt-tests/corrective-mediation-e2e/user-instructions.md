# corrective-mediation-e2e — Operator Hand-Verification

Run AFTER the automated `_runner.md` completes. The automated run drives the corrective cycle to `approved` and writes `run-notes.md`. This checklist verifies what the automated run cannot: the semantic quality of the orchestrator's mediation output and the UI rendering of new corrective-cycle fields.

## Before the run

- Kill any existing occupant of port 3000 so the UI dev server doesn't port-hop to 3001 or 3002.
  - On Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`.
  - On Unix: `lsof -ti:3000 | xargs kill -9`.

## Read the run summary

Open `output/broken-colors/<run-folder>/run-notes.md`. Verify:

- All 8 pass criteria are listed and marked satisfied.
- Final `code_review.verdict` is `approved`.
- `corrective_tasks.length` is 1 (the fixture is designed to converge in one corrective cycle).
- `graph.status` is `in_progress` (the harness halts before phase_review; this is correct).

## Inspect the Orchestrator Addendum

Open `output/broken-colors/<run-folder>/reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md`. Verify:

- `## Orchestrator Addendum` section is present after the original review content.
- Budget banner reads `Attempt 1 of 5`.
- Finding disposition table has one row for F-1 with disposition `action` and a coherent reason (traces to FR-1, bounded to `src/colors.js`).
- `Effective Outcome: changes_requested` line is present.
- `Corrective Handoff: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md` line is present.
- Frontmatter has `orchestrator_mediated: true`, `effective_outcome: changes_requested`, `corrective_handoff_path: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`.

## Inspect the corrective Task Handoff

Open `output/broken-colors/<run-folder>/tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`. Verify:

- Frontmatter: `corrective_index: 1`, `corrective_scope: task`, `budget_max: 5`, `budget_remaining: 4`.
- Body is self-contained: describes the task from scratch, no references to "prior attempt", "previous review", "first attempt", or delta reasoning.
- Corrective steps are concrete and coder-executable without loading any other document.

## Verify the stateless re-review

Open the re-review doc (path in `run-notes.md`). Verify:

- No occurrences of "previous review", "prior review", or "first attempt" in the body (grep heuristic).
- The re-review evaluates the fixed `src/colors.js` on its own merits and returns `approved`.

## Boot the UI (smoke verification)

```bash
cd ui && npm run build && npm run dev
```

The UI needs a `.env.local` file to run. If it is missing, check `lib/ui-builder.js` or `lib/prompts/ui-install.js` in the installer for the template variables and expected values.

Point the UI at the harness run folder (set the projects base path to include the `output/broken-colors/` parent). Then verify:

1. **Document viewer** — open the review doc (`reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md`) in the UI. The new frontmatter fields render: `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`, `corrective_index`, `corrective_scope`, `budget_max`, `budget_remaining`. No fields are silently dropped.
2. **Markdown viewer** — the `## Orchestrator Addendum` section renders correctly in the markdown view of the review doc.
3. **DAG timeline** — the corrective task group renders as `C1` under the task loop iteration. The node is visible and labeled.
4. **Legacy regression check** — point the UI at any pre-Iter-10 completed project state.json (any existing project in the workspace). Verify it renders clean: no missing-node warnings, no layout regressions, no new console errors.

## Report

If anything looks wrong — incoherent addendum, self-referential corrective handoff, UI layout regression, missing frontmatter fields, or any criterion from the pass list not met — surface to the iteration agent before the iteration is considered done. Otherwise reply "hand-verification clean."
