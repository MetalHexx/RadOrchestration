# Iter 6 — Prompt regression harness

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Planner-agent output is non-deterministic by design — small prompt tweaks and skill-workflow edits can change what gets produced without regressing any structural test. Once Iters 4-5 are in, the planning pipeline is exercisable end-to-end (brainstorm → Requirements → Master Plan → exploded phase/task files) on a fresh project. This iteration scaffolds an operator-run regression harness that exercises that full chain against a fixed fixture, captures outputs, runs structural linters, and leaves artifacts for human comparison run-over-run.

The harness deliberately sits *outside* `.claude/` at `/prompt-tests/` — it has no reason to load on every Claude session, it's driven by an operator pasting a runner prompt into a fresh session, and it's intentionally agent-driven (not shell-scripted) because planner subagents don't have standalone CLI entry points.

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
  - Frontmatter presence: `project`, `type: requirements`, `status`, `requirement_count`, `created`
  - Every heading matching `^### (FR|NFR|AD|DD)-\d+:` has a body description sentence
  - Every block fits within ~500 token estimate (whitespace-count heuristic, or `tiktoken` if available)
  - `requirement_count` frontmatter matches the actual block count
  - No gaps or duplicates per ID sequence
- `tools/lint-master-plan.mjs` (~80 lines) validates:
  - Frontmatter: `project`, `type: master_plan`, `total_phases`, `total_tasks`
  - Phase headings match `^## P\d{2}:`; task headings match `^### P\d{2}-T\d{2}:`
  - Phase descriptions ≤3 sentences; task descriptions ≤2 sentences (best-effort)
  - Referential integrity: every `FR-N` / `NFR-N` / `AD-N` / `DD-N` tag cited in the Master Plan resolves to a block in the companion Requirements doc in the same output directory
  - Optional coverage: every Requirements ID is referenced by ≥1 task (warn-level, not error)
- `plan-pipeline-e2e/_runner.md` is a declarative prompt that drives an operator's fresh Claude session to:
  1. Pick fixture (default: `rainbow-hello`) and create `output/<fixture>/<YYYY-MM-DD-HHMMSS>/`
  2. Spawn Requirements agent with fixture's `BRAINSTORMING.md` → write `REQUIREMENTS.md`
  3. Spawn Master Plan agent with `REQUIREMENTS.md` → write `MASTER-PLAN.md`
  4. Invoke the explosion script (Iter 5) against `MASTER-PLAN.md` → emit `exploded/phases/` + `exploded/tasks/`
  5. Run both linters → write `lint-report.md`
  6. Emit `run-notes.md` skeleton with a human-review checklist
- Run the harness once against rainbow-hello and capture the output folder as `output/rainbow-hello/baseline-<timestamp>/` with a narrower `.gitignore` exception so it's tracked.

## Scope Deliberately Untouched

- No orchestrator involvement. The harness does not call the v5 pipeline CLI — it invokes the planner subagents directly.
- No executor / code-reviewer validation. Running exploded tasks through the executor to verify downstream consumption is a separate future harness behavior, intentionally out of scope for this v1.
- No CI integration. This is operator-run, human-reviewed. Automation is a future concern.
- No gating — linter findings are informational, never halt a run.
- Multiple fixtures beyond rainbow-hello — additive in later work; rainbow-hello is small and sufficient for a v1 baseline.

## UI Impact

- **Active-project rendering**: none. The harness doesn't produce pipeline state; it exercises planner subagents against fixtures.
- **Legacy-project read-only rendering**: none.
- **UI surfaces touched**: none.
- **UI tests**: none. The harness is isolated outside `.claude/` and doesn't invoke the UI.

## Code Surface

- New folder tree (all files new): `prompt-tests/`, `prompt-tests/tools/`, `prompt-tests/plan-pipeline-e2e/`, `prompt-tests/plan-pipeline-e2e/fixtures/rainbow-hello/`, `prompt-tests/plan-pipeline-e2e/output/rainbow-hello/`
- `.gitignore` (repo root) — add `/prompt-tests/**/output/**` with a narrower exception for any explicit baseline run
- Fixture source (copied): `C:\dev\orchestration-projects\RAINBOW-HELLO\RAINBOW-HELLO-BRAINSTORMING.md` → `prompt-tests/plan-pipeline-e2e/fixtures/rainbow-hello/BRAINSTORMING.md`
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

## Open Questions

- **Runner fidelity vs. drift**: the `_runner.md` prompt invokes planner subagents. If those subagents' skill workflows change in later iterations, the runner may need updates. Should the runner pin a specific commit SHA of the skill workflows, or always track latest? Lean "always latest" — the harness exists to catch drift, not immunize against it.
- **Token-count estimation in lint-requirements.mjs**: pure whitespace heuristic (fast, approximate) or optional `tiktoken` (accurate, adds dependency)? Iteration planner picks; defer to simplest option unless accuracy matters.
- **Baseline output git-tracked or not**: tracking it enables diff-based comparison across versions but inflates repo size. The design allows narrower `.gitignore` exceptions. Iteration planner decides whether to track just `lint-report.md` and `run-notes.md`, or the full output tree.
- **Master Plan frontmatter tag**: lint-master-plan.mjs expects `type: master_plan` per the Iter 2 contract. Double-check this matches the actual Iter 2 outcome before running the harness.
