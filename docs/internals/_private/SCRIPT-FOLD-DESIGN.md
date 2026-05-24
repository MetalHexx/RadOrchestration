# Script-Fold — Design Document

**Date:** 2026-05-23
**Status:** Series complete; iterations 1–5 landed.

---

## Premise

The pre-fold shape shipped per-skill helper scripts in `harness-files/skills/<name>/scripts/`, called from SKILL.md via a constellation of path tokens; install and discovery costs scaled with the number of scripts.

The `SCRIPT-FOLD` series folds every user-facing helper script into the `radorch` CLI as a subcommand, rewriting each skill's call sites to the established `${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs <subcommand>` form already proven in the three rad-ui-* skills. One binary, one call form, one help surface.

The series is staged smallest-to-heaviest so the first iteration locks in the consolidation pattern and the CLI module rules (`cli/AGENTS.md`) before the heavier folds inherit them. Pipeline runtime — the largest single fold — spans iterations 4 and 5, deliberately split for the planning-focus reasons documented below.

This document is a thin index. Every design decision, scope boundary, and rationale lives in the iteration's brainstorming doc; downstream agents should read the brainstorm for the iteration they're working on, not extend this file.

---

## Series at a glance

| # | Iteration | Scope | Status | Brainstorm |
|---|-----------|-------|--------|------------|
| 1 | `SCRIPT-FOLD-1` | rad-source-control (`git-commit`, `gh-pr`) + `cli/AGENTS.md` | Landed | [SCRIPT-FOLD-1-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-1/SCRIPT-FOLD-1-BRAINSTORMING.md) |
| 2 | `SCRIPT-FOLD-2` | rad-execute + rad-execute-parallel (`gather-context`, `find-projects`, `create-worktree`, `inject-theme`, `launch-claude`) | Landed | [SCRIPT-FOLD-2-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-2/SCRIPT-FOLD-2-BRAINSTORMING.md) |
| 3 | `SCRIPT-FOLD-3` | rad-orchestration (`explode-master-plan`, `list-repo-skills`) + rad-create-plans (`token-lint` deleted) | Landed | [SCRIPT-FOLD-3-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-3/SCRIPT-FOLD-3-BRAINSTORMING.md) |
| 4 | `SCRIPT-FOLD-4` | Greenfield copy of the pipeline runtime into the CLI under a new `pipeline signal` subcommand. Old pipeline untouched; cross-skill prose sweep and build-pipeline cleanup deferred to iter 5. | Brainstormed | [SCRIPT-FOLD-4-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-4/SCRIPT-FOLD-4-BRAINSTORMING.md) |
| 5 | `SCRIPT-FOLD-5` | Retirement of the old pipeline + cross-skill prose sweep (~35 surfaces) + build-pipeline ceremony retirement + `.agents/skills/pipeline-changes/` restructuring + distribution-model investigation. Closes the coexistence window iter 4 opens. | Landed | [SCRIPT-FOLD-5-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-5/SCRIPT-FOLD-5-BRAINSTORMING.md) |

---

## Cross-cutting considerations

Each iteration's brainstorm must address these. They emerged from iteration #1 and apply to every subsequent fold.

- **`--help` text.** Every new subcommand declares a one-line `description` + per-flag short help. Commander auto-generates the rendering; no separate help registry.
- **`radorch doctor` checks.** When a subcommand depends on an external binary or a runtime artifact, add a corresponding check in `cli/src/commands/doctor/checks.ts`. Reuse the existing categories (Environment / Install / Plugin / Tooling) or add a new one only when the existing four don't fit.
- **`${PLUGIN_ROOT}` call form.** SKILL.md rewrites use `${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs <subcommand>`. The token is already translated correctly by every installer; no `harness-adapters/` or `harness-installers/` changes are expected unless a fold introduces a new token or a hook-context call site (VS Code's `bake-paths.js` scopes to `skills/` only).
- **PR atomicity.** Each iteration's PR contains: subcommand implementation + tests, SKILL.md call-site rewrites, doctor-check additions, and deletion of the folded scripts. No coexistence window. **Exception**: iter 4 deliberately deviates — see below.

---

## Iterations 4 and 5 — deliberate deviation from PR atomicity

The pipeline runtime fold is the heaviest single fold in the series — roughly 5,000 lines of engine code across seventeen modules, plus ~35 cross-skill prose surfaces, plus build-pipeline ceremony across four installer variants, plus prompt-test runner rewrites, plus a legacy contributor-skill restructuring, plus a distribution-model question. Three cognitively distinct tasks at scales that do not coincide in any other iteration. Holding to PR atomicity would force one planner to interleave them all.

Iterations 4 and 5 split the work:

- **`SCRIPT-FOLD-4`**: greenfield copy of the engine and entry layer into the CLI; new `radorch pipeline signal` subcommand; standard envelope; high-value test cherry-pick; single high-signal contributor-orientation `AGENTS.md` at the new pipeline folder, authored last by the coder grounded in landed code. Old pipeline files, all cross-skill prose, the build-pipeline ceremony, and the legacy contributor skill all stay untouched. Production continues to use the old pipeline by virtue of the unchanged prose. The new pipeline coexists silently — built, tested, invocable, but not yet wired into any production agent path.

- **`SCRIPT-FOLD-5`**: closes the coexistence window. Sweeps every prose surface, retires the old files, dismantles the build-pipeline ceremony, restructures the legacy contributor skill, and investigates distribution-model implications. Strict present-tense prose hygiene throughout — no echoes of the legacy shape in any rewritten surface.

The coexistence window is finite and explicitly bounded — iter 5 carries the closing commitment as a load-bearing scope item, not a deferred-indefinitely follow-on. The PR-atomicity principle still applies to every iteration in the series where scale permits holding to it; iters 4 and 5 are the one exception, grounded in scale.

---

## Future work (post-series)

Once every subcommand emits radorch's standard envelope, downstream consumers (notably the pipeline) can read result fields directly from radorch's stdout instead of waiting for the agent to relay them via emitted markdown blocks. Eliminating the agent-as-relay step is the natural endgame for this series — cleaner data flow, fewer failure modes — and warrants its own follow-up project once `SCRIPT-FOLD-5` lands.

---

## Related design lineage

- [GLOBAL-WORKSPACES-01-CLI-SCAFFOLD](~/.radorch/projects/GLOBAL-WORKSPACES-01-CLI-SCAFFOLD/GLOBAL-WORKSPACES-01-CLI-SCAFFOLD-BRAINSTORMING.md) — established the `radorch` CLI architecture (layered, max-strict TS, commander, JSON envelope, hybrid noun-grouping). Reserved "fold the pipeline runtime into radorch" as future Wave 9; this series begins to redeem that reservation.
- [INSTALL-REFACTOR-DESIGN](./INSTALL-REFACTOR-DESIGN.md) — established the harness-files / harness-adapters / harness-installers layout and the `${PLUGIN_ROOT}` token resolution path the SKILL.md call rewrites depend on.

---

## Iterations 4 and 5 — deliberate deviation from PR atomicity

SCRIPT-FOLD-4 (pipeline runtime fold) ships in two PRs rather than one, departing from the "no coexistence window" rule in Cross-cutting considerations above. The pipeline engine is large enough that splitting implementation from cleanup reduces review surface per round without compromising correctness.

**Status note (iter-4 land time).** The pipeline engine and entry layer land at `cli/src/lib/pipeline-engine/` and `cli/src/commands/pipeline/signal.ts`; the gate-approval commands depend only on the new engine; `cli/tsconfig.json` typechecks against `cli/src/` only. The legacy pipeline files under `harness-files/skills/rad-orchestration/scripts/` stay on disk untouched and continue to serve production prose paths during the coexistence window. SCRIPT-FOLD-5 carries the closing commitment as a load-bearing scope item.

---

## Side project between iterations 4 and 5 — CLI-BEHAVIORAL-TESTS

Between SCRIPT-FOLD-4 (pipeline runtime lands in the CLI) and SCRIPT-FOLD-5 (legacy pipeline implementation retired), a side project — [CLI-BEHAVIORAL-TESTS](~/.radorch/projects/CLI-BEHAVIORAL-TESTS/CLI-BEHAVIORAL-TESTS-BRAINSTORMING.md) — establishes a behavioral-test tier for CLI commands, with the new `pipeline` command as the first adopter. Tests assert on the externally-observable contract (envelope + state.json + side-files) against synthetic per-test fixtures, so the suite stays durable across both pipeline-internal refactors and production-template tuning.

This is intentionally not numbered as a SCRIPT-FOLD iteration: it does not fold any script, does not touch SKILL.md call sites, and does not affect the coexistence window. It runs in parallel with iter-5's legacy cleanup and gives that cleanup behavioral cover before the legacy paths are deleted. The CLI-wide convention it ships is reusable by every command added in later folds.
