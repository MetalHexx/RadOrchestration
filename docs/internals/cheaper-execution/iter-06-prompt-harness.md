# Iter 6 — Prompt regression harness

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → **amend this companion directly** (Iter 5 set the precedent — planning-time corrections live here, not in the progress tracker). Do not plan on stale assumptions.

## Overview

Planner-agent output is non-deterministic by design — small prompt tweaks and skill-workflow edits can change what gets produced without regressing any structural test. Once Iters 4-5 are in, the planning pipeline is exercisable end-to-end (brainstorm → Requirements → Master Plan → exploded phase/task files) on a fresh project. This iteration scaffolds an operator-run regression harness that exercises that full chain against a fixed fixture, captures outputs, runs structural linters, and leaves artifacts for human comparison run-over-run.

The harness deliberately sits *outside* `.claude/` at `/prompt-tests/`. It has no reason to load on every Claude session, and it's driven by an operator pasting a runner prompt into a fresh Claude session.

**Architectural shape (locked in planning)**: the runner prompt turns the operator's session into a *simulated orchestrator* that drives the **pipeline script** — same surface a real orchestrator uses. Planner subagents (`@planner`) are **not** invoked directly; the engine spawns them per its event-driven action contract. This preserves end-to-end fidelity: the harness regresses on the planner workflows AND the orchestration glue (engine wiring, action-event contract, ORCHESTRATOR-GUIDE conventions) at the same time.

**Template**: the harness uses **`default.yml`** (production template — Iter 5 left it as a 4-node planning chain ending at `plan_approval_gate`). The harness halts at the gate (it never approves) — that gate is the natural stopping point because the explosion runs *before* it, materializing the phase/task files for human review. As `default.yml` grows in Iter 9+, the halt-at-gate behavior keeps the harness scoped to planning regardless.

After this iteration: the harness exists, is exercisable, and has a baseline output committed for rainbow-hello. Future iterations that touch planner prompts or the explosion script have an easy regression check to run before declaring their iteration done.

## Scope

- The `/prompt-tests/` folder does not exist yet — create from scratch at the repo root (`<repo>/prompt-tests/`, sibling to `/docs/`, `/installer/`, `/ui/`, `/.claude/`).
- Folder layout:
  ```
  prompt-tests/
    README.md                       # harness purpose + how to add a new behavior
    tools/
      lint-requirements.mjs         # structural linter for Requirements docs
      lint-master-plan.mjs           # structural linter for Master Plans
    plan-pipeline-e2e/              # first behavior folder
      README.md                     # what this behavior tests
      _runner.md                    # prompt the operator pastes into a fresh session
      fixtures/
        rainbow-hello/
          BRAINSTORMING.md          # copied from C:\dev\orchestration-projects\RAINBOW-HELLO\RAINBOW-HELLO-BRAINSTORMING.md (rename normalized)
      output/
        rainbow-hello/
          .gitkeep                  # keep folder under git; actual run outputs are gitignored
  ```
- `.gitignore` rule at repo root: `/prompt-tests/**/output/**` except `.gitkeep` scaffolding. Explicit baseline runs (e.g., the inaugural one at end of this iteration) can be kept by adding a narrower `.gitignore` exception.
- `tools/lint-requirements.mjs` (~60 lines) validates:
  - Frontmatter presence (load-bearing): `project`, `type: requirements`, `status`, `requirement_count`, `created`. Template also carries `author` + `approved_at` — linter ignores those (informational only).
  - Every heading matching `^### (FR|NFR|AD|DD)-\d+:` has a body description sentence.
  - Every block fits within ~500 token estimate via **whitespace heuristic** (`Math.ceil(words * 0.75) > 500` flags). No `tiktoken` dependency — keep linters dependency-free.
  - `requirement_count` frontmatter matches the actual block count.
  - No gaps or duplicates per ID sequence.
- `tools/lint-master-plan.mjs` (~80 lines) validates:
  - Frontmatter (load-bearing): `project`, `type: master_plan`, `total_phases`, `total_tasks`. Template also carries `status`, `created`, `author` — informational only.
  - Phase headings match `^## P\d{2}:`; task headings match `^### P\d{2}-T\d{2}:`.
  - Phase descriptions ≤3 sentences; task descriptions ≤2 sentences (best-effort).
  - Referential integrity: every `FR-N` / `NFR-N` / `AD-N` / `DD-N` tag cited in the Master Plan resolves to a block in the companion Requirements doc in the same output directory.
  - Optional coverage: every Requirements ID is referenced by ≥1 task (warn-level, not error).
- `plan-pipeline-e2e/_runner.md` is a **goal-oriented** prompt that turns an operator's fresh Claude session into a single-purpose orchestrator. High-level shape (the inner-session planner decides exact wording):
  1. Pick fixture (default: `rainbow-hello`) and create the run folder at `output/<fixture>/<YYYY-MM-DD-HHMMSS>/`. **This folder doubles as the project working dir** — the pipeline reads/writes its state.json and emitted docs here.
  2. Bootstrap the project: copy fixture's `BRAINSTORMING.md` in, scaffold `orchestration.yml` pointing at `default.yml`, initialize state.json. *(The inner planner figures out the cleanest bootstrap path — likely mirroring whatever the installer does in non-interactive mode, or hand-rolling the minimum scaffold.)*
  3. Drive the pipeline script through the planning chain. The runner trusts the engine — it fires the initial event, then for each `next_action` returned, spawns `@planner` per the action-event contract, captures the agent's output, and dispatches the completion event.
  4. **Halt at `plan_approval_gate`** (engine reports `awaiting_approval`). The runner does NOT approve.
  5. Run both linters against the emitted Requirements + Master Plan + exploded docs → write `lint-report.md`.
  6. Emit `run-notes.md` with a human-review checklist (prompt-quality drift, doc shape sanity, anything the linters can't see).
- **Pass criteria for a run** (asserted by the runner before exit):
  - `state.json` shows `requirements`, `master_plan`, `explode_master_plan` all `completed`; `plan_approval_gate` in `awaiting_approval`.
  - `phases/` + `tasks/` populated; counts match Master Plan frontmatter (`total_phases`, `total_tasks`).
  - Each pre-seeded iteration has its `nodes.phase_planning` (or `nodes.task_handoff`) child step carrying a valid `doc_path`.
  - `master_plan.parse_retry_count` is 0 (the recovery loop never fired — clean planner output).
  - Both linters return zero errors.
  - Anything else → run is flagged for human review in `run-notes.md`.
- Run the harness once against rainbow-hello and commit `lint-report.md` + `run-notes.md` from that run as the **inaugural baseline** (narrower `.gitignore` exception). Full state.json + emitted docs stay gitignored — they regenerate on every run.

## Scope Deliberately Untouched

- **No executor / code-reviewer validation.** Running exploded tasks through the executor to verify downstream consumption is a separate future harness behavior, intentionally out of scope for this v1.
- **No CI integration.** This is operator-run, human-reviewed. Automation is a future concern.
- **No gating** — linter findings are informational, never halt a run. The runner *asserts* on the load-bearing pass criteria (state.json shape + linter zero-error), but only to flag for review, not to halt the operator's session.
- **Multiple fixtures beyond rainbow-hello** — additive in later work; rainbow-hello is small and sufficient for a v1 baseline.
- **No bypass of the engine.** The runner drives the pipeline script — it does not invoke `@planner` standalone. Bypassing the engine would defeat the purpose (regress the planner workflows but miss orchestration-glue regressions).
- **Token budget**: a full rainbow-hello run hits the planner agent twice (Requirements + Master Plan) plus driving the engine. Operators should know this is real spend — call out in `prompt-tests/README.md` so nobody runs it 10x in a tight loop without intent.

## UI Impact

- **Active-project rendering**: none. The harness doesn't produce pipeline state; it exercises planner subagents against fixtures.
- **Legacy-project read-only rendering**: none.
- **UI surfaces touched**: none.
- **UI tests**: none. The harness is isolated outside `.claude/` and doesn't invoke the UI.

## Code Surface

- New folder tree (all files new): `prompt-tests/`, `prompt-tests/tools/`, `prompt-tests/plan-pipeline-e2e/`, `prompt-tests/plan-pipeline-e2e/fixtures/rainbow-hello/`, `prompt-tests/plan-pipeline-e2e/output/rainbow-hello/`
- `.gitignore` (repo root) — add `/prompt-tests/**/output/**` with a narrower exception for the inaugural baseline run's `lint-report.md` + `run-notes.md` (full state.json + emitted docs stay gitignored — they regenerate)
- Fixture source (copied): `C:\dev\orchestration-projects\RAINBOW-HELLO\RAINBOW-HELLO-BRAINSTORMING.md` → `prompt-tests/plan-pipeline-e2e/fixtures/rainbow-hello/BRAINSTORMING.md`
- **Project bootstrap surface** (the inner planner figures out the cleanest invocation): the runner needs to scaffold a fresh project — `orchestration.yml` (template = `default.yml`), an initial `state.json`, and the fixture's `BRAINSTORMING.md` in place. Mirror whatever the installer does in non-interactive mode if such a flag exists; otherwise hand-roll the minimum scaffold based on what the engine expects on first event dispatch.
- **Pipeline script invocation**: the engine CLI lives at `.claude/skills/orchestration/scripts/main.ts` (verify at plan time). The runner invokes it per the same event-dispatch contract a real orchestrator uses.
- Tests: none inside `.claude/`. Harness is its own thing.

## Dependencies

- **Depends on**: Iter 4 (Requirements pipeline node) + Iter 5 (explosion script). The harness exercises that full chain.
- **Blocks**: Iter 7 — not strictly, but having the harness in place gives regression signal during the remaining iterations that touch planner prompts, skills, or the explosion script.

## Testing Discipline

- **Baseline first**: full suite + log + SHA. This iteration touches nothing inside `.claude/` or `scripts/`, so the baseline should match the post-iteration run exactly.
- **Re-run before exit**: full suite green; diff against baseline. Expect zero test count delta.
- **Harness-specific baseline**: the *first* harness run against rainbow-hello produces the tracked baseline. Each subsequent run (during later iterations) gets a timestamped folder and is diffed manually against the baseline.

## Exit Criteria

- Full test suite green vs. baseline (delta = zero — harness is outside test tree).
- `/prompt-tests/` folder exists with the structure above.
- Both linter scripts run standalone against a malformed fixture and produce actionable error messages.
- Both linter scripts run against a well-formed Requirements + Master Plan pair from the harness's inaugural run and pass with zero errors.
- The inaugural harness run against rainbow-hello completes end-to-end; outputs exist in the tracked baseline folder; `run-notes.md` reflects a valid human-review checklist.

## Open Questions — resolved at planning time

All four original questions locked during Iter 6 planning. Kept here for the execution record:

- ✅ **Runner fidelity vs. drift**: always-latest. The harness's job is to *catch* drift, not immunize against it. No SHA pin.
- ✅ **Token-count estimation**: whitespace heuristic only (`Math.ceil(words * 0.75)`). No `tiktoken` dependency — harness stays zero-dep.
- ✅ **Baseline git-tracked scope**: inaugural run commits `lint-report.md` + `run-notes.md` only via a narrower `.gitignore` exception. Full state.json + emitted docs stay gitignored — they regenerate every run.
- ✅ **Master Plan frontmatter tag**: confirmed `type: master_plan` matches Iter 2 outcome (template at `.claude/skills/rad-create-plans/references/master-plan/templates/MASTER-PLAN.md` line 3).

## Open Questions — surfaced at planning time (for inner planner)

- **Bootstrap scaffold**: how does the runner initialize a fresh project's `orchestration.yml` + `state.json`? Options: (a) invoke the installer in non-interactive mode if a flag exists, (b) hand-roll a minimum scaffold. Inner planner investigates at plan time and picks the cleanest path.
- **State halt detection**: how does the runner know the engine has reached `awaiting_approval` vs. an intermediate pending state? The pipeline script's stdout + `state.graph.nodes.plan_approval_gate.status` should both indicate it — inner planner confirms the exact signal.
