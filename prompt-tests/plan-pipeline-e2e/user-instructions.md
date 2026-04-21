# plan-pipeline-e2e — Operator Hand-Verification

Run AFTER the automated `_runner.md` completes. The automated run halts at `request_plan_approval` and writes `lint-report.md` + `run-notes.md`. This checklist verifies what the automated run cannot: the semantic quality of the planner's output.

## Before the run

- Kill any existing occupant of port 3000 so the UI dev server doesn't port-hop to 3001 or 3002.
  - On Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`.
  - On Unix: `lsof -ti:3000 | xargs kill -9`.

## Inspect planner output

- Open the emitted `<PROJECT-NAME>-REQUIREMENTS.md` in the run folder. Is each FR/NFR/AD/DD block coherent? Do the IDs sequence correctly (FR-1, FR-2, ... with no gaps)? Is the total count in frontmatter accurate?
- Open the emitted `<PROJECT-NAME>-MASTER-PLAN.md`. Does the phase/task decomposition match the project's scope from the brainstorming fixture? Are the requirement IDs cited sensibly in each task?
- Scan `phases/` and `tasks/`. Are the files well-formed (no raw placeholder tokens, no parse errors visible in `state.json`)?
- Open `lint-report.md`. Zero errors on both Requirements + Master Plan linters. Both self-tests should exit 0 with expected errors.

## Boot the UI (optional smoke)

```bash
cd ui && npm run build && npm run dev
```

The UI needs a `.env.local` file — see the installer's `lib/ui-builder.js` or `lib/prompts/ui-install.js` for the template variables and expected values.

Point the UI at the run folder's parent (whatever `projects.base_path` the dev instance resolves to). The DAG timeline should render:

- Seeded planning nodes (requirements, master_plan, explode_master_plan, plan_approval_gate) as completed.
- Per-phase iterations with their seeded `phase_planning` child steps as Doc links.
- Per-task iterations with their seeded `task_handoff` child steps as Doc links.

## Report

If anything looks wrong (incoherent planner output, layout regression, missing docs, lint errors on otherwise-valid output), surface to the iteration agent before treating the iteration as done. Otherwise reply "hand-verification clean."
