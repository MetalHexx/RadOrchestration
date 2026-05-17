# hooks Module

## Purpose

This folder contains the two hook implementations that ship in the plugin payload, enabling one-shot install and persistent cross-channel drift detection.

## Hooks Overview

**`bootstrap.mjs` (UserPromptSubmit hook)**
- Lifecycle: one-shot, self-uninstalling on successful completion
- Responsibility: orchestrate the install state machine, create `install.json`, populate initial workspace content
- Integration: esbuilt and bundled with inlined `lib/install/*` modules
- Execution: triggered on user's first interaction with the plugin

**`drift-check.mjs` (SessionStart hook)**
- Lifecycle: persistent, never self-uninstalls
- Responsibility: detect and report discrepancies between installed content and workspace state
- Integration: shipped verbatim (no bundling required)
- Execution: triggered on every session start to maintain consistency

## Registration Manifest

`hooks.json` registers both hooks with Claude's hook system. Changes to hook signatures or event names require updates here.

## Bundle/Verbatim Split

- `bootstrap.mjs` — esbuilt with `lib/install/*` modules inlined; produces a single self-contained file
- `drift-check.mjs` — copied verbatim into the plugin payload
- `hooks.json` — copied verbatim into the plugin payload

## Seam to Install State Machine

`lib/install/` contains the atomic state machine modules that `bootstrap.mjs` imports at build time. These modules are never shipped as separate files in the plugin payload—they exist only in source and are inlined into the final `bootstrap.mjs` bundle.

## Coding Standards

- Hook code is minimal and focused on orchestration; heavy lifting is delegated to `lib/install/`
- Error handling is defensive; transient failures are logged and retried
- No synchronous file operations without careful error handling
- Hook lifecycle (self-uninstall vs. persistent) is enforced by the hook implementation, not by external configuration

## Further Reading

- `lib/install/AGENTS.md` — install state machine module design and atomic write patterns
