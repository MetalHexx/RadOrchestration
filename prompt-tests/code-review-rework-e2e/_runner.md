# Code-Review Rework E2E — Runner Prompt

> **Token cost.** This run invokes `@coder` (T2 corrective task) and `@reviewer` (task-level review, phase review, final review) subagents — real Opus-tier spend. Orchestrator mediation runs in this session; no extra subagent for it.

---

## Mission

Drive the full orchestrator pipeline from "task 2 committed" through final-review-approved. Exercises all three review modes established by iter-12 (task / phase / final) plus orchestrator mediation at task scope. The phase review is expected to be `approved` as a backstop — the cross-task drift introduced deliberately at T2 is caught at task scope first and repaired before the walker reaches phase_review.

Behave as a **simulated orchestrator**. Signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not edit `state.json` directly, and honour the two-step `_started` → action-return protocol. Mediation happens out-of-band: read the review, judge findings, write the `## Orchestrator Addendum` + additive frontmatter, author the corrective Task Handoff, then signal the event.

Full routing reference lives at `.claude/skills/orchestration/references/pipeline-guide.md` and `action-event-reference.md`. Load `corrective-playbook.md` now — iter-12 added the **Tiered Conformance Model** and **Finding Disposition by Status** sections, both directly relevant to this mission.

---

## How state routes — sidebar

The fixture's `state.json` has `task_loop.iterations[1].commit` completed and the walker poised to emit `spawn_code_reviewer` for T2. Signal `start` first — the walker advances to the next pending action (`spawn_code_reviewer`). The T2 review doc does NOT exist on disk yet; you spawn `@reviewer` with the task-review workflow, which authors it.

After task scope approves, the walker advances to `spawn_phase_reviewer` and eventually `spawn_final_reviewer`. Both reviewers are spawned via `@reviewer` subagent with the spawn context's `phase_first_sha` / `phase_head_sha` or `project_base_sha` / `project_head_sha` threaded through.

---

## Inputs

| Input | Value | Notes |
|-------|-------|-------|
| Fixture name | `conformance-tiered` | `prompt-tests/code-review-rework-e2e/fixtures/conformance-tiered/` |
| Run folder | `prompt-tests/code-review-rework-e2e/output/conformance-tiered/baseline-conformance-tiered-<YYYY-MM-DD>/` | Use today's date. The `baseline-conformance-tiered-` prefix is required for the `.gitignore` exception to re-include `run-notes.md`. |

All paths are relative to the repo root unless noted.

---

## Setup

1. Choose a run-folder name: `baseline-conformance-tiered-<YYYY-MM-DD>` (e.g., `baseline-conformance-tiered-2026-04-21` for the inaugural run). This name becomes `state.project.name` — the engine derives the project name from `path.basename(--project-dir)`.

2. Create the run folder and copy the fixture into it:
   ```
   prompt-tests/code-review-rework-e2e/output/conformance-tiered/<RUN-FOLDER>/
   ```
   Copy the entire contents of `prompt-tests/code-review-rework-e2e/fixtures/conformance-tiered/` into the run folder, preserving subdirectory structure (`phases/`, `tasks/`, `reports/`, `src/`). The fixture ships `state.json`, `template.yml`, `orchestration.yml`, and all project documents.

   > The `state.json` is pre-seeded — do NOT invoke the installer. The engine detects the existing `state.json` on `--event start`.

3. Set your `<run-folder>` variable — every `pipeline.js` call uses `--project-dir <run-folder>` AND `--config <run-folder>/orchestration.yml`. The fixture ships a local `orchestration.yml` with `auto_commit: never` + `auto_pr: never` so commit_gate and pr_gate route to their `false` branches. Without `--config`, the engine falls back to the global `orchestration.yml` and the cycle drifts off-script.

---

## Drive the cycle

### Step 1 — Bootstrap (resume)

```bash
node .claude/skills/orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/code-review-rework-e2e/output/conformance-tiered/<RUN-FOLDER> \
  --config prompt-tests/code-review-rework-e2e/output/conformance-tiered/<RUN-FOLDER>/orchestration.yml
```

Expected return: `{ "action": "spawn_code_reviewer", ... }` with spawn context carrying `phase_number: 1`, `task_number: 2`, `task_id: "P01-T02"`, and `head_sha: null` (auto-commit is off — the reviewer falls back to `git diff HEAD` + untracked files).

### Step 2 — T2 task review (expected: changes_requested with drift)

Signal `code_review_started` (two-step protocol), then spawn `@reviewer` with the task-review workflow. The reviewer reads the Task Handoff at `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING.md`, examines the diff, and emits a review doc at `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md`.

**Expected outcome:**
- `verdict: changes_requested`
- Audit table: FR-1 on-track, FR-2 drift (severity medium) — cross-task contract mismatch. The T2 source consumes `getColors()` assuming a `Promise<Color[]>` return, but T1's contract (per the Requirements doc) is synchronous `Color[]`.
- One `drift` row maps to FR-2 in the audit table.

### Step 3 — Orchestrator mediation (in-session)

Load `.claude/skills/orchestration/references/corrective-playbook.md`. Apply the **Tiered Conformance Model** + **Finding Disposition by Status** sections:

- **Budget check**: `phaseIter.iterations[0].task_loop.iterations[1].corrective_tasks.length === 0`. Budget not exhausted.
- **Per-finding judgment**: FR-2 drift row traces to the Task Handoff's inlined FR-2 contract. Disposition: `action (drift)`. On-track row (FR-1): `decline (on-track) — tracking for later scope`.
- Author addendum + additive frontmatter on the existing review doc.
- Author corrective Task Handoff at `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md` with `corrective_index: 1`, `corrective_scope: task`, `budget_max: 5`, `budget_remaining: 4`.

### Step 4 — Signal `code_review_completed` (first attempt)

```bash
node .claude/skills/orchestration/scripts/pipeline.js \
  --event code_review_completed \
  --project-dir <...> \
  --config <...>/orchestration.yml \
  --doc-path reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md
```

Expected return: `{ "action": "execute_task", ... }` — the pipeline births a corrective task entry and routes back to execute_task.

### Step 5 — Two-step execute_task (corrective)

Signal `execution_started`, spawn `@coder` with the corrective handoff. The coder updates `src/greet.ts` to consume `getColors()` synchronously. Signal `task_completed`.

Expected next action: `spawn_code_reviewer` (commit_gate routes to false branch).

### Step 6 — T2 re-review (expected: approved)

Signal `code_review_started`, spawn a fresh `@reviewer` (stateless — no prior review doc loaded). The reviewer emits a new doc at `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md`.

**Expected outcome:**
- `verdict: approved`
- All audit rows `on-track` (FR-1 + FR-2).

Signal `code_review_completed` with `--doc-path <path-to-C1-review>`. Expected next action: walker advances to `spawn_phase_reviewer` (task gate auto-approves in autonomous mode).

### Step 7 — Phase review (expected: approved, exit_criteria_met: true)

Signal `phase_review_started`, spawn `@reviewer` with phase-review workflow. Context carries `phase_first_sha: null`, `phase_head_sha: null` (auto-commit off — fallback to `git diff HEAD`). Reviewer emits `reports/CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md`.

**Expected outcome:**
- `verdict: approved`
- `exit_criteria_met: true`
- All phase-scoped requirements on-track.

Signal `phase_review_completed`. Expected next action: walker advances to `spawn_final_reviewer`.

### Step 8 — Final review (expected: approved, all met)

Signal `final_review_started`, spawn `@reviewer` with final-review workflow. Context carries `project_base_sha: null`, `project_head_sha: null`. Reviewer emits `reports/CONFORMANCE-TIERED-FINAL-REVIEW.md` (iter-12 save-path change — **not** at project root).

**Expected outcome:**
- `verdict: approved`
- Audit table enumerates every FR/NFR in `CONFORMANCE-TIERED-REQUIREMENTS.md` with status `met`.
- Body does NOT reference `{NAME}-PRD.md`, `{NAME}-ARCHITECTURE.md`, or `{NAME}-DESIGN.md` (iter-3 deletions).
- Body does NOT reference a previous final review (iter-12 stateless contract).

Signal `final_review_completed --doc-path reports/CONFORMANCE-TIERED-FINAL-REVIEW.md`. The pipeline returns `request_final_approval` (or `display_complete` / `invoke_source_control_pr` depending on config).

### Step 9 — Halt

Do NOT approve the final human gate. The harness exits once `final_review_completed` is signaled successfully. Write `run-notes.md` (see Outputs) and surface the file paths + final state values to the operator.

---

## Pass criteria (shape-based)

1. All four review docs exist at expected save paths:
   - `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md` (first T2 review)
   - `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md` (re-review)
   - `reports/CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md`
   - `reports/CONFORMANCE-TIERED-FINAL-REVIEW.md`
2. **Final-review save path is under `reports/`** — regression-check: the old project-root path (`CONFORMANCE-TIERED-FINAL-REVIEW.md` at repo root) is NOT used.
3. First T2 review: `verdict: changes_requested`, one drift finding on FR-2, audit table shows FR-2 drift + AD-1 on-track + NFR-1 on-track (the three requirements inlined into T2's Task Handoff, in the handoff's authored order).
4. T2 re-review: `verdict: approved`, all audit rows on-track.
5. Phase review: `verdict: approved`, `exit_criteria_met: true`.
6. Final review: `verdict: approved`; audit table enumerates every Requirements-doc FR/NFR/AD/DD with status `met`.
7. Final-review doc body does NOT reference PRD / Architecture / Design docs.
8. Final-review doc does NOT reference a previous final review.
9. State check: `state.graph.nodes.phase_loop.iterations[0].task_loop.iterations[1].corrective_tasks.length === 1` (one task-scope corrective); `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length === 0` (no phase-scope corrective needed).
10. Orchestrator addendum on the first T2 review: the Finding Dispositions table uses parenthesized tier enums per playbook — FR-2 row disposition reads `action (drift)` with reasoning; AD-1 + NFR-1 rows read `decline (on-track)` with "tracking for later scope" in the Reason column.
11. Pipeline-level validator health: the harness signals `final_review_completed` successfully (validator accepts the verdict frontmatter — no `pre_read_validation_error` surfaced on the event); the `final_review` state node transitions to `completed` with `verdict: approved`. This is the iter-12 validator regression guard.

---

## Outputs

Write `run-notes.md` in the run folder summarizing:

- Run folder path, date, fixture name.
- Every `pipeline.js` call made and its returned `result.action`.
- Every agent spawned (`@coder`, `@reviewer`) with the doc path each received.
- Every event signaled.
- Orchestrator judgments (finding ID, disposition verb + status tier, reason).
- SHA derivations observed — for auto-commit=off, both phase and final SHAs should be `null` and the reviewer should fall back to working-tree diffs.
- Review-doc paths + verdict progression (T2 first → T2 re-review → phase → final).
- Final state values:
  - `state.graph.nodes.phase_loop.iterations[0].task_loop.iterations[1].corrective_tasks.length` (expect 1)
  - `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length` (expect 0)
  - `state.graph.status` (expect `in_progress` — halted at `final_approval_gate` per runner Step 9 do-not-approve constraint)
  - `state.pipeline.current_tier` (expect `review` — walker is at the final-review approval gate when halted)
- Which of the 11 pass criteria are green (explicit yes/no for each).

---

## Exit

**Do not approve any human gate.** Once `run-notes.md` is written, surface its path and the final state values to the operator so they can commit the baseline artifacts and complete hand-verification via `user-instructions.md`.

If any pass criterion fails, STOP and surface to the operator — do not silently paper over a broken run with a green report. This harness exists to catch real drift.
