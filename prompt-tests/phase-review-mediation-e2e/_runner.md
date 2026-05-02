# Phase-Review Mediation E2E — Runner Prompt

> **Token cost.** This run invokes `@coder` (execute the phase-scope corrective task) and `@reviewer` (re-review) subagents. That is real Opus-tier spend. Do not loop the harness without intent. The mediation judgment itself runs in this (orchestrator) session — no additional subagent is spawned for it.

---

## Mission

You are the orchestrator in the middle of a **phase-scope** corrective cycle. The fixture is pre-seeded at the moment the phase reviewer has returned `verdict: changes_requested` and the pipeline is waiting for you to mediate. Your session doubles as the simulated orchestrator — perform the mediation in-session, author the phase-sentinel corrective Task Handoff, signal the pipeline, then drive the corrective execution and its task-level re-review to `approved`.

Behave as a **simulated orchestrator**. The same rules the production orchestrator operates under apply here: signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not edit `state.json` directly, do not skip the two-step `_started` → action-return protocol. The only difference: this harness **halts once the phase-scope corrective's task-level re-review returns `approved` and the walker advances past the Phase 1 iteration**. It does not drive Phase 2 or `final_review` — the fixture is single-phase for scope control.

Full routing reference lives at `.claude/skills/rad-orchestration/references/pipeline-guide.md` and `action-event-reference.md`. Load `corrective-playbook.md` now — both the **Scope: Task vs. Phase** note and the **Phase-Scope Mediation** section apply here.

---

## How state routes — sidebar

The fixture's `state.json` has `phase_review.status = in_progress` with the phase review doc already on disk at:
```
reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md
```
Both task iterations in `task_loop.iterations` are `completed` with `verdict: approved` on each task-level code review. The pipeline's `start` event is a no-op in this state — the walker does NOT re-emit an action for a node whose status is already `in_progress`, so `start` returns `action: null`. That is the correct "mediation entry point" signal: the pipeline is waiting for the orchestrator to signal `phase_review_completed` (with mediation fields in the phase-review-doc frontmatter) as the completion of the already-spawned phase review.

The orchestrator's mediation happens **out-of-band** of any pipeline event: read the phase review doc, judge the findings, write the `## Orchestrator Addendum`, append the additive frontmatter fields (`orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`), and author the phase-sentinel corrective Task Handoff under `tasks/`. Only after all of that is done does the orchestrator signal `phase_review_completed --doc-path <phase-review-doc>`. No new event type is introduced — mediation is reflected solely through the frontmatter fields the pipeline reads from the phase review doc.

Because the effective outcome is `changes_requested` with a `corrective_handoff_path`, the `PHASE_REVIEW_COMPLETED` mutation **births a new phase-scope corrective** (appended to `phaseIter.corrective_tasks[]`, NOT to the last taskIter's `corrective_tasks`) with scaffolded task-body nodes and a synthesized pre-completed `task_handoff` sub-node. Then the walker routes through `execute_task` → `commit_gate (false)` → `spawn_code_reviewer` → task-level `code_review_completed (approved)` → task_gate auto-approves → walker marks the phase iteration `completed` and advances past it. Under Iter 11's single-pass clause, phase_review does **not** re-run.

---

## Inputs

| Input | Value | Notes |
|-------|-------|-------|
| Fixture name | `colors-greet-mismatch` | `prompt-tests/phase-review-mediation-e2e/fixtures/colors-greet-mismatch/` |
| Run folder | `prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/baseline-colors-greet-mismatch-<YYYY-MM-DD>/` | Use today's date. The `baseline-colors-greet-mismatch-` prefix is required for the `.gitignore` exception to re-include `run-notes.md`. |

All paths below are relative to the repo root unless noted.

---

## Setup

1. Choose a run-folder name: `baseline-colors-greet-mismatch-<YYYY-MM-DD>` (e.g., `baseline-colors-greet-mismatch-2026-04-21` for the inaugural run). This name becomes `state.project.name` — the engine derives the project name from `path.basename(--project-dir)`.

2. Create the run folder and copy the fixture into it:
   ```
   prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER>/
   ```
   Copy the entire contents of `prompt-tests/phase-review-mediation-e2e/fixtures/colors-greet-mismatch/` into the run folder, preserving subdirectory structure (`phases/`, `tasks/`, `reports/`, `src/`). The fixture already contains `state.json`, `template.yml`, `orchestration.yml`, and all project documents.

   > The `state.json` is pre-seeded — do NOT invoke the installer or run `--event start` fresh. Skip step 3 of the plan-pipeline harness setup. The engine will detect the existing `state.json` when you signal `start`, and the walker will resume from the current graph position.

3. Set your `<run-folder>` variable — every `pipeline.js` call uses `--project-dir <run-folder>` AND `--config <run-folder>/orchestration.yml`. The fixture ships a local `orchestration.yml` with `auto_commit: never` and `auto_pr: never` so the conditional `commit_gate` routes to its `false` branch. Without `--config`, the engine falls back to the global `.claude/skills/rad-orchestration/config/orchestration.yml` which has `auto_commit: ask` and the corrective cycle will request a real commit — not what the harness wants.

---

## Drive the corrective cycle

### Step 1 — Bootstrap (resume at in-progress phase_review)

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER> \
  --config prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER>/orchestration.yml
```

Expected return: `{ "action": null, "context": {}, "mutations_applied": [], ... }`. This is the correct resume signal — the walker does NOT emit an action for a node already in `in_progress` status, so `start` is effectively a state-load + schema-validate no-op. You do NOT spawn a phase reviewer subagent; the phase review doc already exists on disk. Proceed to Step 2 (mediation).

If the pipeline returns anything other than `action: null` (e.g., `spawn_phase_reviewer`, an error, or a different action), halt and surface to the operator — the fixture state is off-script.

### Step 2 — Recognize resume

Read the pre-seeded phase review doc at:
```
<run-folder>/reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md
```

Verify it has:
- `verdict: changes_requested`
- `exit_criteria_met: false`
- No `orchestrator_mediated` / `effective_outcome` / `corrective_handoff_path` field yet (pre-mediation)
- One finding: F-1, cross-task shape mismatch between `src/colors.js` (strings) and `src/greet.js` (expects objects)

### Step 3 — Mediate per the playbook (phase-scope)

Load `.claude/skills/rad-orchestration/references/corrective-playbook.md` — both the **Scope: Task vs. Phase** note near the top and the **Phase-Scope Mediation** section.

**Budget check first**: read `max_retries_per_task` from `state.json` (`config.limits.max_retries_per_task`, default 5). Count `corrective_tasks.length` at `graph.nodes.phase_loop.iterations[0].corrective_tasks` — it should be 0 (empty). Budget is not exhausted.

**Judge each finding** — cross-artifact scan across the phase's Task Handoffs and the two `src/*.js` files:

- F-1 — Cross-Task Shape Mismatch: read `<run-folder>/src/colors.js` and `<run-folder>/src/greet.js`. Verify the finding is accurate (`makeColors()` returns strings, `greet()` accesses `n.name`). Trace to FR-2 in `COLORS-GREET-MISMATCH-REQUIREMENTS.md`: `greet(makeColors())` must produce `'Hello, red, Hello, orange, Hello, yellow'`. Confirm the fix is bounded to `src/greet.js` (FR-1 pins `makeColors()`'s return shape as strings, so the drift lives on the `greet()` side). Disposition: **action**.

**Append `## Orchestrator Addendum`** to the phase review doc (after all existing content):

```markdown
## Orchestrator Addendum

**Attempt 1 of 5**

### Finding Dispositions

| Finding ID | Disposition | Reason |
|------------|-------------|--------|
| F-1 | action | Cross-task shape mismatch traces to FR-2 (phase exit criterion). Fix bounded to `src/greet.js`: treat items as strings, matching FR-1's pinned return shape for `makeColors()`. Phase-scope because the defect spans two Task Handoffs' integrated behavior. |

Effective Outcome: changes_requested
Corrective Handoff: tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md
```

**Append additive frontmatter** to the existing phase review doc frontmatter block. Do NOT modify `verdict` or `exit_criteria_met` — those are the reviewer's raw fields.

```yaml
orchestrator_mediated: true
effective_outcome: changes_requested
corrective_handoff_path: tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md
```

**Author the phase-sentinel corrective Task Handoff** at:
```
<run-folder>/tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md
```

Filename substitutes the `PHASE` sentinel for the `T{NN}-{TITLE}` segment per document-conventions.md — this signals phase-scope. The handoff must be self-contained — no references to prior attempts, no delta reasoning. The coder reads it cold. Frontmatter must include:

- `project: COLORS-GREET-MISMATCH`
- `phase: 1`
- `corrective_index: 1`
- `corrective_scope: phase`
- `budget_max: 5`
- `budget_remaining: 4`

The body describes the integration fix from scratch, pointing at `src/greet.js`, cross-referencing FR-2's expected output. Do not write "fix the bug the reviewer found" or "the previous coder assumed objects" — describe the task as if it were a first-time handoff.

### Step 4 — Signal `phase_review_completed`

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event phase_review_completed \
  --project-dir prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER> \
  --config prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER>/orchestration.yml \
  --doc-path reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md
```

Expected return: `{ "action": "execute_task", ... }`. The pipeline births a phase-scope corrective task entry (appended to `phaseIter.corrective_tasks[]`) and routes to `execute_task`. The enriched context should carry:

- `handoff_doc: tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`
- `task_number: null`
- `task_id: P01-PHASE`
- `is_correction: true`
- `corrective_index: 1`

If the pipeline errors on frontmatter validation, the phase review doc's additive frontmatter is malformed — read the error, fix the fields, and retry. Do not paper over a validator error.

### Step 5 — Two-step execute_task protocol

Signal `execution_started`, then spawn `@coder` with the phase-sentinel corrective handoff at:
```
tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md
```

The coder should update `src/greet.js` from `names.map(n => \`Hello, ${n.name}\`)` to `names.map(n => \`Hello, ${n}\`)`. `src/colors.js` stays as-is. After the coder completes, signal:

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event task_completed \
  --project-dir prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER> \
  --config prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER>/orchestration.yml
```

Expected return with `--config` applied (auto_commit: never): `{ "action": "spawn_code_reviewer" }`. The conditional `commit_gate` in the phase-scope corrective's newly-scaffolded nodes auto-routes to the `false` branch (empty body), so the walker skips the commit step and advances directly to `code_review`. There is no `commit_skipped` event — the conditional branch decision is a pure walker-internal state transition.

> **Config drift warning**: if the pipeline returns `invoke_source_control_commit` instead of `spawn_code_reviewer`, `--config` was not passed (or points at the wrong file) and the engine fell back to the global `orchestration.yml` with `auto_commit: ask`. Halt and surface to the operator — do not signal a `commit_*` event against the harness fixture.

### Step 6 — Spawn `@reviewer` for re-review (stateless)

Signal `code_review_started` and spawn `@reviewer`. The reviewer operates on the current `src/greet.js` (which the coder should have fixed) and the phase-sentinel handoff in `tasks/`. The re-reviewer is **stateless** — load it fresh without the phase review doc and without any task-scope prior reviews. The reviewer should return `verdict: approved` if the fix is correct.

The re-review save-path uses the phase-sentinel form per `task-review/workflow.md` — the reviewer derives this from `task_id` being `P01-PHASE`:
```
reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md
```

After the reviewer writes its doc, signal:

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event code_review_completed \
  --project-dir prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER> \
  --config prompt-tests/phase-review-mediation-e2e/output/colors-greet-mismatch/<RUN-FOLDER>/orchestration.yml \
  --doc-path reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md
```

Expected return: `{ "action": "spawn_final_reviewer" }` (or similar phase-advance action). The task_gate auto-approves in autonomous mode, the walker marks the phase-scope corrective `completed`, the Phase 1 iteration advances to `completed`, and the walker advances past the phase. Under Iter 11's single-pass clause, `phase_review` does **not** re-run.

### Step 7 — Halt

Once the phase-scope corrective's task-level re-review returns `approved` and the walker advances past Phase 1, **halt**. Do NOT drive Phase 2 (`phase_planning_started`, etc.), do NOT signal `final_review_started`, do NOT approve any human gate downstream. The harness exits before Phase 2 and final_review.

Write `run-notes.md` (see Outputs below) and surface the three file paths to the operator:

- Phase review doc (with addendum)
- Phase-sentinel corrective Task Handoff
- Phase-sentinel re-review doc

---

## Handling unexpected returns

- **Pipeline returns `changes_requested` again on re-review**: this would exercise ancestor-derivation (the code_review node lives under `phaseIter.corrective_tasks[0].nodes`, so mediation should append a new corrective to `phaseIter.corrective_tasks`, not taskIter). If the budget is not exhausted, perform another mediation cycle and author `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C2.md`. If `phaseIter.corrective_tasks.length >= max_retries_per_task`, do NOT author another handoff — write the addendum with `Effective Outcome: changes_requested` (no handoff), signal, and expect the pipeline to halt cleanly with a budget-exhausted reason. Surface the halt to the operator.
- **Pipeline errors on mutation**: read the error, do not invent a recovery. Surface to the operator.
- **`@coder` cannot fix the shape mismatch**: the coder is given a self-contained handoff — if it still produces wrong output, the re-reviewer will catch it. Follow the cycle normally; do not hand-edit `src/greet.js` yourself.
- **`spawn_phase_reviewer` returns after the task-level re-review approves**: the Iter 11 single-pass clause has regressed; the walker should not re-dispatch `spawn_phase_reviewer` for this phase iteration. Halt and surface — this is a real finding.

---

## Outputs

Write `run-notes.md` in the run folder summarizing the full run. Include:

- Run folder path, date, fixture name
- Every pipeline call made and its returned `result.action`
- Every agent spawned (`@coder`, `@reviewer`) with the doc path each received
- Every event signaled
- Judgment calls made during orchestrator mediation (finding ID, disposition, reason)
- Final state values read from `state.json`:
  - `graph.status`
  - `phase_loop.iterations[0].status`
  - `phase_loop.iterations[0].nodes.phase_review.status` and `.verdict`
  - `phase_loop.iterations[0].nodes.phase_planning.status` (asserts reset block is GONE)
  - `phase_loop.iterations[0].nodes.task_loop.iterations.length` (asserts `task_loop.iterations` was not cleared)
  - `phase_loop.iterations[0].corrective_tasks.length`
  - `phase_loop.iterations[0].corrective_tasks[0].status`
  - `phase_loop.iterations[0].corrective_tasks[0].nodes.task_handoff.doc_path`
  - `phase_loop.iterations[0].corrective_tasks[0].nodes.code_review.verdict` and `.doc_path`
- Whether all 10 pass criteria are satisfied (check each one explicitly)

---

## Pass criteria (shape-based; copy from README)

1. `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length >= 1` AND final corrective's `task_handoff.status === 'completed'` AND `task_handoff.doc_path` matches `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C{N}.md`.
2. Phase review doc contains `## Orchestrator Addendum` with budget banner (`Attempt N of M`), Finding Dispositions table, `Effective Outcome:` line, `Corrective Handoff:` line.
3. Phase review doc frontmatter has `orchestrator_mediated: true`, `effective_outcome ∈ {approved, changes_requested}`, `corrective_handoff_path` iff effective_outcome = changes_requested. `exit_criteria_met` untouched.
4. Phase-sentinel corrective handoff file exists with frontmatter `corrective_index: 1`, `corrective_scope: phase`, `budget_max` + `budget_remaining` set, body self-contained (no prior-attempt references).
5. **Phase-iteration reset block is GONE**: `phase_loop.iterations[0].nodes['phase_review'].status === 'completed'` (NOT reset); its `verdict` = effective_outcome; `nodes['phase_planning'].status === 'completed'` (NOT reset); `nodes['task_loop'].iterations` unchanged (NOT cleared).
6. Task-level re-review doc body does NOT reference the prior phase review (grep: no "previous review", "phase review said", "first attempt", "prior review").
7. `phase_loop.iterations[0].corrective_tasks[0].status === 'completed'` AND `phase_loop.iterations[0].status === 'completed'`. Graph not halted.
8. Only ONE `PHASE-REVIEW-…md` doc on disk (no `-C{N}.md` corrective form). Walker does NOT re-dispatch `spawn_phase_reviewer` after corrective's task-review approves.
9. Budget intact: `phaseIter.corrective_tasks.length <= max_retries_per_task`; converges in 1 cycle.
10. Task-level re-review save-path uses phase sentinel: filename matches `CODE-REVIEW-P01-PHASE-C1.md`.

---

## Exit

**Do not approve any human gate** downstream of the phase-scope corrective. The harness halts after the corrective's task-level re-review returns `approved` and the walker advances past the Phase 1 iteration. Once `run-notes.md` is written, surface its path and the final state values to the operator so they can commit the baseline artifacts.

If any pass criterion fails, STOP and surface to the operator — do not silently paper over a broken run with a green report. This harness exists to catch real drift.
