# `harness-dogfood/`

## Purpose

Thin shared dev-tooling layer that bridges the adapter pipeline, the manifest-driven deploy library, and user-level harness paths. Not a module — no runtime code lands here.

## How it works

The dogfood build flow runs `harness-adapters/engine`'s discovery, stages each adapter's output under `dist/staging/<harness>/`, then deploys to `~/.claude/` or `~/.copilot/` via the in-folder manifest library. Per-build, the script reads its prior manifest from `dist/dogfood-prior-<harness>.json`, removes those files, copies the fresh manifest, and saves the new prior.

## Coding conventions

No imports from `harness-installers/*/lib/install/` — the in-folder library is the contract. No `package.json` is added here; the folder consumes only Node built-ins and (transitively) `harness-adapters/engine`'s package.

## Rules for making updates

Adding a new harness: register it in `harness-adapters/adapters/`; the dogfood build picks it up automatically via discovery. Changing the in-folder library: update both `install-files.js` / `remove-files.js` and the matching `*.test.mjs` here in the same commit.

## Seams to neighbors

`harness-adapters/` for adapter discovery and per-adapter staging; `harness-files/` as the canonical source the adapters read. (The pipeline runtime is no longer bundled by this loop — it lives in the CLI at `cli/src/lib/pipeline-engine/` and is emitted by the standard installer's `emit-cli-bundle` step.)
