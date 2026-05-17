# install Module

## Purpose

This folder contains install state machine modules that orchestrate the multi-stage setup process. These modules are consumed by `bootstrap.mjs` at build time, inlined into the bundled hook, and never shipped as separate files in the plugin payload.

## No-Ship Rule

Modules in this folder are **build-time only**. They do not appear as individual files in the final plugin—they exist in source, are imported by `bootstrap.mjs`, and are bundled into a single `bootstrap.mjs` file via esbuild. This design keeps the plugin payload clean and the hook self-contained.

## Coding Standards

**Atomic `install.json` writes:**
- All writes to the `install.json` state file use write-then-rename (tmp + atomic rename)
- This ensures the state file is never left in a partial or corrupted state
- No overwrite-in-place; always tmp-then-rename

**Log writes:**
- Best-effort wrapped in try/catch
- Failures to write logs do not halt the install
- Log file is for debugging only; install correctness does not depend on it

**Sentinel-driven self-heal:**
- Each install stage checks for its sentinel file before execution
- If a sentinel exists, the stage is skipped (idempotence)
- On successful completion, the stage writes its sentinel
- This enables re-entrant execution and recovery from crashes

**Six-action install-log vocabulary:**
- `mkdir` — directory creation
- `symlink` — symlink creation
- `write` — file write (config, manifest, etc.)
- `extract` — archive extraction
- `build` — build execution
- `cleanup` — temporary file removal

All install actions are logged with timestamp and result (success/failure/skipped).

## Seam

`bootstrap.mjs` is the only importer of modules in this folder. When `bootstrap.mjs` is built, esbuild inlines all imported code from `lib/install/` into the final bundle.

## Coding Patterns

- Each module exports a single async function following the signature: `async function installStage(ctx: InstallContext) => Promise<void>`
- Modules use `InstallContext` for state management, path resolution, and logging
- No global state; all context flows through parameters
- Error handling is explicit; errors are caught and logged, not re-thrown unless critical

## Further Reading

- `hooks/AGENTS.md` — hook lifecycle and bundling strategy
