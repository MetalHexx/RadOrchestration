# shared/hooks/

## Purpose

Single source for the preamble hook shim shared across all installer variants.
Code here is installer-agnostic — it carries no harness-specific names, paths,
or config values.

## Contents

- `session-preamble.mjs` — the preamble hook shim. See below.
- `tests/session-preamble.test.mjs` — Node built-in test runner suite.

## session-preamble.mjs — preamble hook shim

Exports a single pure function `buildHookOutput({ run? })`. Called by the
harness session-start hook entry point in each installer variant.

### What it does

1. Runs the bundled CLI's `session-context` subcommand (injectable via `run`).
2. Parses the canonical envelope `{ ok, data, error }` from stdout.
3. Returns `{ additionalContext }`:
   - **ok:true** → `data.preamble` text is surfaced as `additionalContext`.
   - **ok:false, non-zero status, or unparseable stdout** → a clear one-line
     notice that ambient awareness did not load (including the error message
     when present). The hook never fails silently and never throws.

### Harness context-channel contract

The `additionalContext` key is the cross-harness context-channel:

| Harness | Hook event | Context key |
|---|---|---|
| Claude Code | `SessionStart` | `additionalContext` |
| Copilot (VS Code plugin) | session hook | `additionalContext` |
| Copilot CLI plugin | session hook | `additionalContext` / `hookSpecificOutput` |

### Dual radorch.mjs resolution (AD-10)

The shim resolves the bundled CLI two ways:

1. **Plugin delivery** — `CLAUDE_PLUGIN_ROOT` (Claude / Copilot-VSCode) or `COPILOT_PLUGIN_ROOT` (Copilot CLI) is set; radorch path:
   `${CLAUDE_PLUGIN_ROOT|COPILOT_PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs`
2. **Standard delivery** — both env vars are absent; radorch path is derived relative to this hook file's location (harnessRoot = directory one level up from `hooks/`):
   `<harnessRoot>/skills/rad-orchestration/scripts/radorch.mjs`
   This allows the same hook to work under any harness root (e.g., `~/.claude/`, `~/.copilot/`).

Any spawn failure resolves to the notice path — the hook never blocks or
delays session start.

## Coding conventions

- `buildHookOutput` is a pure function; all inputs flow through parameters.
- No global state; no side effects outside what `run` performs.
- `run` defaults to `spawnSync`; tests inject a synchronous stub.

## Rules for making updates

- This file is the single source of the preamble hook. Do not duplicate it
  inside individual installer variant trees.
- Installer-specific hook entry points (in each `harness-installers/<variant>/hooks/`)
  import or bundle this shim; they do not re-implement it.
- Any change to the `buildHookOutput` signature is a breaking change for all
  callers. Locate every import before modifying the signature.
- Do not reference installer names, harness-specific destination paths that belong
  to a single installer variant, or unsanctioned env vars. The sanctioned harness-specific env vars for plugin path delivery are:
  - `CLAUDE_PLUGIN_ROOT` (Claude Code / Copilot-VSCode harnesses)
  - `COPILOT_PLUGIN_ROOT` (Copilot CLI harness)
