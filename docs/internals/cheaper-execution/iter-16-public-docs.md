# Iter 14 — Public-facing docs refresh

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

All prior iterations deliberately deferred updates to root-level public-facing documentation under `/docs/`. This iteration catches everything up in one coherent pass. The scope is bounded: only top-level `/docs/*.md` files (not `/docs/internals/` — those are internal dev notes updated within their relevant iteration's ripples). The ten root public docs describe user-facing concepts — agent roster, pipeline flow, template structure, configuration, etc. — and they've drifted from reality through Iters 2-13.

There is no pipeline-engine work in this iteration. It's purely documentation: grep for removed concepts, replace with current-reality language, make sure cross-references between docs stay consistent. The payoff is that external readers (operators, new contributors) landing in `/docs/` after this iteration see a coherent picture of the post-refactor system, not a half-retired one.

## Scope

- Update `/docs/agents.md`:
  - Remove from roster: `product-manager`, `architect`, `ux-designer`, `research`, `tactical-planner`.
  - Confirm: `planner`, `coder`, `coder-senior`, `coder-junior`, `reviewer`, `orchestrator`, `source-control`, `brainstormer`, and any other retained agents are accurate.
  - Update `planner` description to cover both modes: Requirements authoring AND Master Plan authoring (inlined planning artifact).
- Update `/docs/pipeline.md`:
  - Remove references to the 5-upstream-doc flow (PRD → Research → Design → Architecture → Master Plan).
  - Replace with the Requirements → Master Plan → Explode → phase/task execution flow.
  - Update any tier / status-transition diagrams to match `default.yml`'s shape.
- Update `/docs/templates.md`:
  - `default.yml` is the canonical template. `full.yml` listed as deprecated (kept for legacy state.json rendering). `quick.yml` removed.
  - Remove any language describing quick/full as user-selectable template choices.
- Update `/docs/configuration.md`:
  - Add entries for `max_phase_review_retries` and `max_final_review_retries` (Iter 12 additions).
  - Update state.json reference to mention pre-seeded iterations and `is_cleanup` marker.
- Update `/docs/skills.md`:
  - Remove: `generate-phase-report` (Iter 8 deletion).
  - Update: `rad-create-plans` (no longer includes PRD/Research/Design/Architecture/Master-Plan/Phase-Plan/Task-Handoff/Shared workflows; only Requirements + Master Plan).
  - Update: `code-review` (describe task/phase/final modes with diff-based inputs).
  - Update: `execute-coding-task` (handoff-only input + correction mode + TDD/DRY/YAGNI).
  - Update: `rad-plan-audit` (single purpose: Requirements ↔ Master Plan conformance).
  - Confirm: `brainstorm`, `source-control`, `configure-system`, `log-error`, `run-tests`, `create-agent`, `create-skill`, `rad-plan`, `rad-execute`, `rad-execute-parallel`, `rad-review-cycle` — reflect current state.
- Update `/docs/project-structure.md`:
  - Document type list — remove PRD / Research / Design / Architecture / Phase-Plan-authored / Task-Handoff-authored entries. Add Requirements + Master Plan.
  - Note that phase-plan and task-handoff files on disk are explosion-script outputs (not agent-authored).
  - Update folder layout diagram to reflect pre-seeded state.json and exploded phase/task files.
- Update `/docs/getting-started.md`:
  - Prerequisite / installation instructions — update any references to `quick.yml` template choice.
  - Update the initial-project walkthrough to flow: brainstorm → Requirements → Master Plan → approval → execution.
- Update `/docs/guides.md`: audit for references to removed concepts; update.
- Update `/docs/dashboard.md`: update any UI description of planning-phase nodes to reflect current list (`requirements`, `master_plan`, `explode_master_plan`, plus any retained phase/task loop descriptions).
- Update `/docs/source-control.md`: usually safe from refactor churn, but confirm no references to removed agents.
- Update root `README.md`: any top-of-repo description referencing removed agents, removed doc types, or `quick.yml`.

## Scope Deliberately Untouched

- `/docs/internals/*.md` — internal dev notes. Any refactor-driven updates to these land in the relevant iteration's ripples. Iter 14 does NOT touch internals.
- Pipeline code, skill code, templates, schemas — all stable by Iter 14.
- `docs/internals/CHEAPER-EXECUTION-REFACTOR.md` + companions — these ARE this refactor's own authoring notes; they're updated by the refactor itself, not by Iter 14.

## UI Impact

- **Active-project rendering**: none. This iteration is doc-only.
- **Legacy-project read-only rendering**: none.
- **UI surfaces touched**: none — `/docs/` is markdown doc content; the UI doesn't render it.
- **UI tests**: none.

## Code Surface

- `/docs/agents.md`
- `/docs/configuration.md`
- `/docs/dashboard.md`
- `/docs/getting-started.md`
- `/docs/guides.md`
- `/docs/pipeline.md`
- `/docs/project-structure.md`
- `/docs/skills.md`
- `/docs/source-control.md`
- `/docs/templates.md`
- `README.md` (repo root; verify it exists and needs updates)

## Dependencies

- **Depends on**: Iter 13 — the system should be in its terminal refactored state before refreshing public docs.
- **Blocks**: nothing — this is the tail iteration.

## Testing Discipline

- **Baseline first**: full suite + log + SHA. No code change expected; delta should be zero.
- **Re-run before exit**: full suite green; diff against baseline. Zero test count delta.
- **Grep-based doc hygiene check** before exit — run each of these and confirm zero matches outside `docs/internals/cheaper-execution/` and this refactor's own docs:
  - `grep -rn "product-manager\|architect\.md\|ux-designer\|tactical-planner\|research\.md" docs/`
  - `grep -rn "PRD\b\|\bResearch\b.*doc\|Design Doc\|Architecture Doc" docs/` (tune regex during planning; "research" and "design" may appear in legitimate contexts)
  - `grep -rn "quick\.yml\|quick template" docs/`
  - `grep -rn "generate-phase-report\|phase_report" docs/`

## Exit Criteria

- Full test suite green vs. baseline (delta = zero).
- Every `/docs/*.md` at root level and `README.md` reflect the post-refactor reality.
- Grep hygiene checks return zero matches for removed concepts.
- Cross-references between public docs (e.g., `docs/agents.md` → `docs/skills.md` links) still resolve and make sense.
- A new reader could land on `/docs/getting-started.md` and walk through `/docs/pipeline.md` + `/docs/templates.md` + `/docs/agents.md` without encountering a removed concept.

## Open Questions

- **Tone / audience continuity**: these docs have an established voice. Aim for minimal-diff — update language to match reality, don't rewrite stylistically.
- **Screenshots / diagrams**: if any `/docs/*.md` embeds images showing the legacy pipeline, they need regeneration or replacement. Audit during planning.
- **Cross-repo doc mentions**: is any of this surface mirrored in the installer's README or the UI's README? Audit `installer/README.md` and `ui/README.md` (if present) — probably small/negligible, but verify.
- **`docs/skills.md` length**: this one's likely to gain bulk with updates across many skills. Keep it a list / table, not prose.
