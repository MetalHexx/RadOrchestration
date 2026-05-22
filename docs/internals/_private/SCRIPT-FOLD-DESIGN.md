# Script-Fold — Design Document

**Date:** 2026-05-21
**Status:** Series in progress; iteration 1 brainstormed and ready for planning.

---

## Premise

Canonical skills today ship per-skill helper scripts in `harness-files/skills/<name>/scripts/`. Agents call them from SKILL.md via a constellation of path tokens (`${SKILLS_ROOT}`, `{orchRoot}`, `{skillRoot}`); install and discovery costs scale with the number of scripts.

The `SCRIPT-FOLD` series folds every user-facing helper script into the `radorch` CLI as a subcommand, rewriting each skill's call sites to the established `${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs <subcommand>` form already proven in the three rad-ui-* skills. One binary, one call form, one help surface.

The series is staged smallest-to-heaviest so the first iteration locks in the consolidation pattern and the CLI module rules (`cli/AGENTS.md`) before the heavier folds inherit them. Pipeline runtime — the largest single fold — is isolated as its own final iteration for focused review.

This document is a thin index. Every design decision, scope boundary, and rationale lives in the iteration's brainstorming doc; downstream agents should read the brainstorm for the iteration they're working on, not extend this file.

---

## Series at a glance

| # | Iteration | Scope | Status | Brainstorm |
|---|-----------|-------|--------|------------|
| 1 | `SCRIPT-FOLD-1` | rad-source-control (`git-commit`, `gh-pr`) + `cli/AGENTS.md` | Brainstormed | [SCRIPT-FOLD-1-BRAINSTORMING.md](~/.radorch/projects/SCRIPT-FOLD-1/SCRIPT-FOLD-1-BRAINSTORMING.md) |
| 2 | `SCRIPT-FOLD-2` | rad-execute + rad-execute-parallel (`gather-context`, `find-projects`, `create-worktree`, `inject-theme`, `launch-claude`) | Not yet brainstormed | — |
| 3 | `SCRIPT-FOLD-3` | rad-orchestration (`explode-master-plan`, `list-repo-skills`) + rad-create-plans (`token-lint`) | Not yet brainstormed | — |
| 4 | `SCRIPT-FOLD-4` | rad-orchestration (`pipeline` — heavy runtime, isolated) | Not yet brainstormed | — |

---

## Cross-cutting considerations

Each iteration's brainstorm must address these. They emerged from iteration #1 and apply to every subsequent fold.

- **`--help` text.** Every new subcommand declares a one-line `description` + per-flag short help. Commander auto-generates the rendering; no separate help registry.
- **`radorch doctor` checks.** When a subcommand depends on an external binary or a runtime artifact, add a corresponding check in `cli/src/commands/doctor/checks.ts`. Reuse the existing categories (Environment / Install / Plugin / Tooling) or add a new one only when the existing four don't fit.
- **`${PLUGIN_ROOT}` call form.** SKILL.md rewrites use `${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs <subcommand>`. The token is already translated correctly by every installer; no `harness-adapters/` or `harness-installers/` changes are expected unless a fold introduces a new token or a hook-context call site (VS Code's `bake-paths.js` scopes to `skills/` only).
- **PR atomicity.** Each iteration's PR contains: subcommand implementation + tests, SKILL.md call-site rewrites, doctor-check additions, and deletion of the folded scripts. No coexistence window.

---

## Future work (post-series)

Once every subcommand emits radorch's standard envelope, downstream consumers (notably the pipeline) can read result fields directly from radorch's stdout instead of waiting for the agent to relay them via emitted markdown blocks. Eliminating the agent-as-relay step is the natural endgame for this series — cleaner data flow, fewer failure modes — and warrants its own follow-up project once `SCRIPT-FOLD-4` lands.

---

## Related design lineage

- [GLOBAL-WORKSPACES-01-CLI-SCAFFOLD](~/.radorch/projects/GLOBAL-WORKSPACES-01-CLI-SCAFFOLD/GLOBAL-WORKSPACES-01-CLI-SCAFFOLD-BRAINSTORMING.md) — established the `radorch` CLI architecture (layered, max-strict TS, commander, JSON envelope, hybrid noun-grouping). Reserved "fold the pipeline runtime into radorch" as future Wave 9; this series begins to redeem that reservation.
- [INSTALL-REFACTOR-DESIGN](./INSTALL-REFACTOR-DESIGN.md) — established the harness-files / harness-adapters / harness-installers layout and the `${PLUGIN_ROOT}` token resolution path the SKILL.md call rewrites depend on.
