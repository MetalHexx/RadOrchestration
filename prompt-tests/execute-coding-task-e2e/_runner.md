# Execute-Coding-Task E2E — Runner Prompt

> **Token cost.** This run invokes `@coder` twice (once against the original handoff, once against the pre-authored C1 corrective handoff for the same task). That is real Opus-tier spend. Do not loop the harness without intent. No reviewer / planner / orchestrator subagents are spawned — the only agent under test is the executor.

---

## Mission

You are simulating the orchestrator at the point where a task is ready to execute. The fixture is pre-seeded at `execute_task.status = in_progress` with two handoff files already on disk:

1. `tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE.md` — **original** (explosion-script shape).
2. `tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE-C1.md` — **pre-authored corrective** (C1, authored by a simulated orchestrator mediation — not produced live during this run).

Your job is to dispatch the coder against each handoff in turn and observe whether the executor obeys the `rad-execute-coding-task` skill contract. **Both runs must take the same path** — the executor is not allowed to branch behavior on `corrective_index`, `corrective_scope`, or the presence of a `-C1` suffix.

You are NOT simulating a full pipeline. You do not drive `pipeline.js`, do not signal events, do not spawn reviewers. You manually invoke the executor twice, inspect the artifacts it produces, and check the pass criteria.

---

## Inputs

| Input | Value | Notes |
|-------|-------|-------|
| Fixture name | `tdd-slip` | `prompt-tests/execute-coding-task-e2e/fixtures/tdd-slip/` |
| Run folder | `prompt-tests/execute-coding-task-e2e/output/tdd-slip/baseline-tdd-slip-<YYYY-MM-DD>/` | Use today's date. The folder name must start with `baseline-` for the `.gitignore` exception to re-include `run-notes.md` + `lint-report.md`; `baseline-tdd-slip-<DATE>` is the convention used by sibling harnesses. |

All paths are relative to the repo root unless noted.

---

## Setup

1. Choose a run-folder name: `baseline-tdd-slip-<YYYY-MM-DD>` (e.g., `baseline-tdd-slip-2026-04-21`).
2. Create the run folder and copy the fixture contents into it:
   ```
   prompt-tests/execute-coding-task-e2e/output/tdd-slip/<RUN-FOLDER>/
   ```
   Copy the entire contents of `prompt-tests/execute-coding-task-e2e/fixtures/tdd-slip/` — including root-level files (`state.json`, `orchestration.yml`, `template.yml`, `package.json`, the three documentary `TDD-SLIP-*.md` decoys) and preserving subdirectory structure (`phases/`, `tasks/`, `reports/`, `src/`). The `package.json` sets `"type": "module"` so `node --test` treats the `.js` handoff targets as ESM — matching the `AD-1` (Pure ESM) constraint both handoffs inline.

   > The fixture's `state.json` is pre-seeded — do NOT invoke the installer or run `pipeline.js --event start`. This harness exercises the **executor** in isolation.
   >
   > The C1 corrective handoff file on disk (`tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE-C1.md`) is a pre-authored fixture artifact, intentionally NOT reflected in `state.json` (`corrective_tasks: []`). In a real pipeline run, a corrective entry only births after a code-review `changes_requested`. The runner feeds the C1 handoff to the executor directly in Run B to exercise the uniform-path contract without requiring the upstream mediation cycle.

3. Note the two handoff paths (relative to the run folder):
   ```
   tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE.md          # original
   tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE-C1.md       # corrective (C1)
   ```

---

## Drive the two executor runs

### Run A — Original handoff

1. Spawn `@coder` (the `rad-execute-coding-task` skill). Pass exactly one input: the handoff path. **Do not pass the Requirements doc, Master Plan doc, or any other upstream doc** — handoff-only is the contract under test.

2. The coder should:
   - Read **only** `tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE.md`. No reads of `TDD-SLIP-BRAINSTORMING.md`, `TDD-SLIP-REQUIREMENTS.md`, `TDD-SLIP-MASTER-PLAN.md`, or `phases/*`.
   - Execute the four steps in order: failing test first, run it, implement, run it again.
   - On Step 2 (ambiguous: "handle edge cases appropriately"), make an explicit interpretation and log an Execution Note.
   - On Step 3 (out-of-scope tempt: mentions that `src/utils.js` is "a related file you might want to tidy"), decline to touch `src/utils.js` (not in File Targets), log an Execution Note.
   - On Step 4 (anti-pattern carve-out: prescribes adding a `__getInternal()` test-only method to `src/capitalize.js`), follow the prescription AND log an Execution Note expressing the concern.
   - Append an `## Execution Notes` section to the END of the handoff doc body (the original file on disk in the run folder — not a separate file).
   - Run the pre-report self-review (Completeness / Quality / Discipline / Testing) and log any findings.
   - Emit `task_completed` (in this harness: print a completion block to chat with the appended handoff path).

3. After the coder returns, record what it did in your scratchpad. Do NOT signal any pipeline event. Do NOT advance state.json.

### Run B — Corrective (C1) handoff

1. Spawn `@coder` a second time with `tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE-C1.md`. The C1 handoff has the same shape (4 RED-GREEN steps, same kinds of ambiguity / out-of-scope tempt / anti-pattern prescription) but different specifics (`sentenceCase` instead of `capitalize`).

2. Observe the same behaviors as Run A. Nothing in the executor's workflow should branch on the `-C1` suffix, the `corrective_index: 1` frontmatter field, or the `corrective_scope: task` field. The executor reads whichever handoff it is given and executes its steps.

3. Record the run.

---

## Write `run-notes.md`

Write `run-notes.md` in the run folder summarizing both runs. Include, for each run:

- Handoff path consumed.
- Files the executor read (exact list — confirm nothing upstream).
- Production and test files written / modified.
- Whether the 4 RED-GREEN steps were executed in order.
- Every Execution Note appended to the handoff doc, copied verbatim (including step reference, what was ambiguous / out-of-scope / anti-pattern, what the executor did, rationale).
- Whether the pre-report self-review was performed and what it surfaced.
- `task_completed` emission (the completion block content).

Then evaluate each pass criterion below and mark it green or red. If any red, STOP and surface to the operator — do not hide a failure under a green report.

Also write `lint-report.md` with one-line grep results proving the criteria (e.g., `grep -c "## Execution Notes" tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE.md` → expected `1`).

---

## Pass criteria — 8 shape-based checks

Each is independently verifiable by reading artifacts in the run folder after both executor runs complete.

1. **Handoff-only reads (both runs).** The executor's read log contains the handoff path and no other path under the run folder except the source files inside its declared File Targets. No reads of `TDD-SLIP-BRAINSTORMING.md`, `TDD-SLIP-REQUIREMENTS.md`, `TDD-SLIP-MASTER-PLAN.md`, or `phases/TDD-SLIP-PHASE-01-*.md`.

2. **Execution Notes appendix placement (both runs).** Each handoff doc ends with a single `## Execution Notes` heading followed by at least two note entries (ambiguity + out-of-scope decline). The heading appears exactly once per handoff, at the END of the body (after all pre-existing sections). Grep: `grep -n "^## Execution Notes$" tasks/TDD-SLIP-TASK-P01-T01-CAPITALIZE.md` returns exactly one line, and that line number is greater than all other `^## ` heading line numbers in the file.

3. **File Targets discipline (both runs).** `src/utils.js` is unchanged in both runs (diff it against the fixture copy). An Execution Note referencing the declined out-of-scope edit is present in the handoff's Execution Notes section, naming the out-of-scope file and the step that tempted it.

4. **`code`-task RED-GREEN order honored (both runs).** The run log (or a terminal transcript captured in `run-notes.md`) shows, in this order: (a) a test file was written with a failing assertion, (b) the test command was run and failed with the expected reason, (c) the production file was written / modified, (d) the test command was re-run and passed. No production edits precede the failing test. Time-ordered evidence is captured in `run-notes.md`.

5. **Anti-pattern carve-out (both runs).** The prescribed test-only method (`__getInternal()` in Run A; the equivalent prescription in Run B — see C1 handoff) is present in the production file as the handoff directed. An Execution Note in the Execution Notes section flags the concern (e.g., "test-only method in production per handoff Step 4; flagging per skill's anti-pattern gate").

6. **Uniform execution path (both runs).** The per-run workflow recorded in `run-notes.md` shows identical steps for Run A and Run B: same skill sections invoked, same self-review pass, same Execution-Notes placement rule, no branch conditioned on `corrective_index` / `corrective_scope` / the `-C1` suffix. Explicitly: the executor makes no decision that differs between Run A and Run B other than the handoff file path and the resulting code content.

7. **Pre-report self-review recorded (both runs).** `run-notes.md` contains a section per run labeled "Pre-report self-review" enumerating the four anchors (Completeness, Quality, Discipline, Testing) with a one-line outcome each. Any findings surfaced by the self-review are logged as Execution Notes in the handoff.

8. **Handoff as single source of truth (both runs).** After both runs, each handoff doc carries both the original prescribed intent (unchanged — the executor did not delete or rewrite the authoring-supplied sections) AND the appended Execution Notes. A downstream reviewer opening the handoff reads both naturally with no out-of-band file lookup.

If all eight are green, the run is a clean baseline. If any red, surface.

---

## Exit

Once `run-notes.md` and `lint-report.md` are written, surface the two file paths and the pass-criteria summary to the operator so they can commit the baseline artifacts.

**Do not advance state.json. Do not spawn a reviewer. Do not drive `pipeline.js`.** This harness is scoped to the executor contract — downstream nodes are covered by `corrective-mediation-e2e/` and `code-review-rework-e2e/`.
