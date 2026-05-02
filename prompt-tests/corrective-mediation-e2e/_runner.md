# Corrective Mediation E2E — Runner Prompt

> **Token cost.** This run invokes `@coder` (execute corrective task) and `@reviewer` (re-review) subagents. That is real Opus-tier spend. Do not loop the harness without intent. The mediation judgment itself runs in this (orchestrator) session — no additional subagent is spawned for it.

---

## Mission

You are the orchestrator in the middle of a corrective cycle. The fixture is pre-seeded at the moment the code reviewer has returned `verdict: changes_requested` and the pipeline is waiting for you to mediate. Your session doubles as the simulated orchestrator — perform the mediation in-session, author the corrective Task Handoff, signal the pipeline, then drive the corrective execution and re-review to `approved`.

Behave as a **simulated orchestrator**. The same rules the production orchestrator operates under apply here: signal events to `pipeline.js`, read `result.action` from stdout JSON, route exactly per the Action Routing Table, do not edit `state.json` directly, do not skip the two-step `_started` → action-return protocol. The only difference: this harness **halts once the corrective's re-review returns `approved`** rather than driving phase_review or final_approval_gate.

Full routing reference lives at `.claude/skills/rad-orchestration/references/pipeline-guide.md` and `action-event-reference.md`. Load `corrective-playbook.md` now — it is the authoritative mediation guide for this session.

---

## How state routes — sidebar

The fixture's `state.json` has `code_review.status = in_progress` with the review doc already on disk at `reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md`. The pipeline's `start` event is a no-op in this state — the walker does NOT re-emit an action for a node whose status is already `in_progress`, so `start` returns `action: null`. That is the correct "mediation entry point" signal: the pipeline is waiting for the orchestrator to signal `code_review_completed` (with mediation fields in the review-doc frontmatter) as the completion of the already-spawned review.

The orchestrator's mediation happens **out-of-band** of any pipeline event: read the review doc, judge the findings, write the `## Orchestrator Addendum`, append the additive frontmatter fields (`orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path`), and author the corrective Task Handoff under `tasks/`. Only after all of that is done does the orchestrator signal `code_review_completed --doc-path <review-doc>`. No new event type is introduced — mediation is reflected solely through the frontmatter fields the pipeline reads from the review doc.

---

## Inputs

| Input | Value | Notes |
|-------|-------|-------|
| Fixture name | `broken-colors` | `prompt-tests/corrective-mediation-e2e/fixtures/broken-colors/` |
| Run folder | `prompt-tests/corrective-mediation-e2e/output/broken-colors/baseline-broken-colors-<YYYY-MM-DD>/` | Use today's date. The `baseline-broken-colors-` prefix is required for the `.gitignore` exception to re-include `run-notes.md`. |

All paths below are relative to the repo root unless noted.

---

## Setup

1. Choose a run-folder name: `baseline-broken-colors-<YYYY-MM-DD>` (e.g., `baseline-broken-colors-2026-04-20` for the inaugural run). This name becomes `state.project.name` — the engine derives the project name from `path.basename(--project-dir)`.

2. Create the run folder and copy the fixture into it:
   ```
   prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER>/
   ```
   Copy the entire contents of `prompt-tests/corrective-mediation-e2e/fixtures/broken-colors/` into the run folder, preserving subdirectory structure (`phases/`, `tasks/`, `reports/`, `src/`). The fixture already contains `state.json`, `template.yml`, `orchestration.yml`, and all project documents.

   > The `state.json` is pre-seeded — do NOT invoke the installer or run `--event start` fresh. Skip step 3 of the plan-pipeline harness setup. The engine will detect the existing `state.json` when you signal `start`, and the walker will resume from the current graph position.

3. Set your `<run-folder>` variable — every `pipeline.js` call uses `--project-dir <run-folder>` AND `--config <run-folder>/orchestration.yml`. The fixture ships a local `orchestration.yml` with `auto_commit: never` and `auto_pr: never` so the conditional `commit_gate` and `pr_gate` route to their `false` branches. Without `--config`, the engine falls back to the global `.claude/skills/rad-orchestration/config/orchestration.yml` which has `auto_commit: ask` and the corrective cycle will request a real commit — not what the harness wants.

---

## Drive the corrective cycle

### Step 1 — Bootstrap (resume at in-progress node)

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event start \
  --project-dir prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER> \
  --config prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER>/orchestration.yml
```

Expected return: `{ "action": null, "context": {}, "mutations_applied": [], ... }`. This is the correct resume signal — the walker does NOT emit an action for a node already in `in_progress` status, so `start` is effectively a state-load + schema-validate no-op. You do NOT spawn a reviewer subagent; the review doc already exists on disk. Proceed to Step 2 (mediation).

If the pipeline returns anything other than `action: null` (e.g., `spawn_code_reviewer`, an error, or a different action), halt and surface to the operator — the fixture state is off-script.

### Step 2 — Recognize resume

Read the pre-seeded review doc at:
```
<run-folder>/reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md
```

Verify it has:
- `verdict: changes_requested`
- No `orchestrator_mediated` field yet (the fixture is pre-mediation)
- One finding: F-1, ordering mismatch in `src/colors.js`

### Step 3 — Mediate per the playbook

Load `.claude/skills/rad-orchestration/references/corrective-playbook.md` if not already in context.

**Budget check first**: read `max_retries_per_task` from `state.json` (`config.limits.max_retries_per_task`, default 5). Count `corrective_tasks.length` in `state.json` at `graph.nodes.phase_loop.iterations[0].task_loop.iterations[0].corrective_tasks` — it should be 0 (empty). Budget is not exhausted.

**Judge each finding**:

- F-1 — Ordering Mismatch: read `<run-folder>/src/colors.js`. Verify the finding is accurate (the function returns `['orange', 'red', 'yellow']`). Trace to FR-1 in `BROKEN-COLORS-REQUIREMENTS.md`. Confirm the fix is bounded to `src/colors.js` (within the task's File Targets). Disposition: **action**.

**Append `## Orchestrator Addendum`** to the review doc (after all existing content):

```markdown
## Orchestrator Addendum

**Attempt 1 of 5**

### Finding Dispositions

| Finding ID | Disposition | Reason |
|------------|-------------|--------|
| F-1 | action | Ordering mismatch directly traces to FR-1 acceptance criterion. Fix is bounded to src/colors.js (task's only File Target). |

Effective Outcome: changes_requested
Corrective Handoff: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md
```

**Append additive frontmatter** to the existing review doc frontmatter block:

```yaml
orchestrator_mediated: true
effective_outcome: changes_requested
corrective_handoff_path: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md
```

**Author the corrective Task Handoff** at:
```
<run-folder>/tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md
```

The handoff must be self-contained — no references to prior attempts, no delta reasoning. The coder reads it cold. Frontmatter must include `corrective_index: 1`, `corrective_scope: task`, `budget_max: 5`, `budget_remaining: 4`.

### Step 4 — Signal `code_review_completed`

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event code_review_completed \
  --project-dir prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER> \
  --config prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER>/orchestration.yml \
  --doc-path reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md
```

Expected return: `{ "action": "execute_task", ... }`. The pipeline births a corrective task entry and routes to `execute_task`.

If the pipeline errors on frontmatter validation, the review doc's frontmatter is malformed — read the error, fix the frontmatter fields, and retry. Do not paper over a validator error.

### Step 5 — Two-step execute_task protocol

Signal `execution_started`, then spawn `@coder` with the corrective handoff at:
```
tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md
```

The coder should fix `src/colors.js` to return `['red', 'orange', 'yellow']`. After the coder completes, signal:

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event task_completed \
  --project-dir prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER> \
  --config prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER>/orchestration.yml
```

Expected return with `--config` applied (auto_commit: never): `{ "action": "spawn_code_reviewer" }`. The conditional `commit_gate` in the corrective's newly-scaffolded nodes auto-routes to the `false` branch (empty body), so the walker skips the commit step and advances directly to `code_review`. There is no `commit_skipped` event — the conditional branch decision is a pure walker-internal state transition.

> **Config drift warning**: if the pipeline returns `invoke_source_control_commit` instead of `spawn_code_reviewer`, `--config` was not passed (or points at the wrong file) and the engine fell back to the global `orchestration.yml` with `auto_commit: ask`. Halt and surface to the operator — do not signal a `commit_*` event against the harness fixture.

### Step 6 — Spawn `@reviewer` for re-review

Signal `code_review_started` and spawn `@reviewer`. The reviewer operates on the current `src/colors.js` (which the coder should have fixed). The re-reviewer is **stateless** — load it fresh without the prior review doc. The reviewer should return `verdict: approved` if the fix is correct.

After the reviewer writes its doc, signal:

```bash
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event code_review_completed \
  --project-dir prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER> \
  --config prompt-tests/corrective-mediation-e2e/output/broken-colors/<RUN-FOLDER>/orchestration.yml \
  --doc-path <path-to-re-review-doc>
```

Expected return: `{ "action": "gate_task" }` (task_gate in autonomous mode auto-approves) or `{ "action": "spawn_phase_reviewer" }` if the task gate auto-approves inline.

### Step 7 — Halt

Once the re-review returns `approved` and the pipeline routes past the task gate, **halt**. Do NOT signal `phase_review_started` or drive the phase_review. The harness exits before the phase review tier.

Write `run-notes.md` (see Outputs below) and surface the two file paths to the operator.

---

## Handling unexpected returns

- **Pipeline returns `changes_requested` again on re-review**: perform another mediation cycle (increment N in the budget banner). If `corrective_tasks.length >= max_retries_per_task`, do NOT author another handoff — write the addendum with `Effective Outcome: changes_requested` (no handoff), signal, and expect the pipeline to halt. Surface the halt to the operator.
- **Pipeline errors on mutation**: read the error, do not invent a recovery. Surface to the operator.
- **`@coder` cannot fix the ordering**: the coder is given a self-contained handoff — if it still produces wrong output, the reviewer will catch it on re-review. Follow the cycle normally; do not hand-edit `src/colors.js` yourself.

---

## Outputs

Write `run-notes.md` in the run folder summarizing the full run. Include:

- Run folder path, date, fixture name
- Every pipeline call made and its returned `result.action`
- Every agent spawned (`@coder`, `@reviewer`) with the doc path each received
- Every event signaled
- Judgment calls made during orchestrator mediation (finding ID, disposition, reason)
- Final state values read from `state.json`:
  - `code_review.verdict` (final, in the corrective's re-review node)
  - `corrective_tasks.length`
  - `graph.status`
- Whether all 8 pass criteria are satisfied (check each one explicitly)

---

## Exit

**Do not approve any human gate** downstream of the corrective mediation. The harness halts after the corrective's re-review returns `approved`. Once `run-notes.md` is written, surface its path and the final state values to the operator so they can commit the baseline artifacts.

If any pass criterion fails, STOP and surface to the operator — do not silently paper over a broken run with a green report. This harness exists to catch real drift.
