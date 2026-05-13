# Post-Merge Acceptance Runbook — GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN

This runbook is executed by the operator on a fresh machine (or a clean Claude Code profile with no pre-existing `~/.radorch/`) after the iteration's plugin artifact has been merged to the default branch of `MetalHexx/RadOrchestration`. It satisfies FR-28 (acceptance-criteria spike validation). The chain cannot be executed inside the iteration's task suite because step 1 below requires Claude's plugin manager to clone the default branch — that is only true once the iteration's PR has merged.

## Halt-and-fix-forward gate

Every step below is a hard gate. If any step fails, halt the runbook, capture the failing observable in this order — the failing command, the actual output, the expected output — and fix forward on a follow-up branch against the same iteration scope (AD-16). Do not revert; the artifact tree is the committed source of truth (AD-25).

UI rendering errors or empty state inside the dashboard are NOT a gate (FR-28). Distribution and runtime are what is being validated.

## Eleven-step acceptance chain

1. `/plugin marketplace add MetalHexx/RadOrchestration` — Claude clones the repo, finds `.claude-plugin/marketplace.json`, registers the marketplace. Expected: success message. (FR-4, AD-7)
2. `/plugin install rad-orchestration` — Claude copies the plugin folder into its cache. Expected: success message. (FR-5, AD-1, AD-25)
3. New Claude Code session opens. SessionStart hook fires. Expected: `~/.radorch/projects/`, `registry.yml`, `config.yml`, `install.json` all created. (FR-9, FR-10, AD-2, AD-11)
4. `/rad-orchestration:ui-start`. Expected: skill body invokes `node ${CLAUDE_PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs ui start`; CLI spawns detached UI server, writes PID file at `~/.radorch/runtime/ui.pid`, emits URL on stdout; skill output reports the URL to the user. (FR-11, FR-14, FR-17, AD-5, AD-12, NFR-5, NFR-7, DD-1, DD-2, DD-4)
5. Operator opens URL in a browser. Expected: UI loads. UI rendering errors / empty state are NOT a gate (FR-28).
6. Operator closes the Claude Code session. Expected: UI keeps running; PID still alive. (NFR-4)
7. Operator opens a new Claude Code session. Expected: UI URL still reachable.
8. `/rad-orchestration:ui-status`. Expected: `running: true`, with URL. (FR-13, FR-16, AD-12)
9. `/rad-orchestration:ui-stop`. Expected: UI terminates; PID file removed. (FR-12, FR-15, AD-12)
10. `/rad-orchestration:ui-status` again. Expected: `running: false`. (FR-13, FR-16)
11. `/plugin uninstall rad-orchestration`. Expected: plugin code dir removed by Claude; `~/.radorch/` left intact. (FR-23, AD-2, AD-17)

## Iter-01 coexistence verification

After step 11, in a separate shell, run `radorch install` (the iter-01 npm-installed CLI, if present). Confirm it still bootstraps successfully and writes its `.harness` pointer. Then re-install the plugin (`/plugin install rad-orchestration`) and verify the plugin CLI's `last_writer_version` check accepts both code paths writing to the same `~/.radorch/`. (FR-24, AD-15, FR-19)

## Sign-off

On full success — every link in the chain green, iter-01 backup verified — the iteration is shipped. Record the runbook execution date and the machine OS/Claude Code version in the iteration's progress tracker.
