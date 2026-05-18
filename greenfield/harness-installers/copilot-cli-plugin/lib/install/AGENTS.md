# lib/install/

## Purpose

Install state machine for the Copilot CLI plugin. `bootstrap.mjs` imports these modules at build time; esbuild inlines them into the bundled hook. No file in this folder ships as a standalone artifact in the plugin payload.

## How it works

**`run-install.js` — `runInstall(opts)`**

Entry point. `opts` shape: `{ pluginRoot: string, radHome?: string, force?: boolean, stderr?: (msg:string)=>void }`.

Flow:
1. Resolves paths via `userDataPaths({ radHome })`.
2. Reads `${pluginRoot}/package.json` for `deliveringVersion`.
3. Reads `install.json` via `readInstallJson`; passes it through `migrateInstallJson` to lift any legacy shape into the current unversioned `harnesses`-keyed shape.
4. Checks for the pipeline sentinel at `${pluginRoot}/skills/rad-orchestration/scripts/radorch.mjs`.
5. Emits a coexistence warning if `ij.harnesses.claude` **or** `ij.harnesses['claude-plugin']` is present alongside `copilot-cli-plugin` (bidirectional, names both partners in the warning message).
6. **Same-version fast path**: if prior version matches delivering version and sentinel exists and `!opts.force`, logs `noop` and returns.
7. **Downgrade noop**: if `cmpSemver(deliveringVersion, installedVersionBefore) < 0` and `!opts.force`, logs `downgrade-noop` and returns.
8. **Upgrade or fresh install**: reads the prior manifest from the new payload's bundled per-version catalog (not from a peer per-version directory — Copilot CLI's flat install path has no such peer), removes prior manifest files via `removeManifestFiles`, installs new files via `installManifestFiles`, copies `${pluginRoot}/ui` to `paths.ui` if present, writes updated `ij` via `writeInstallJson`, and returns `action: 'upgrade-complete'` or `'fresh-install'`.
9. Logs every outcome (including errors) via `appendInstallLog`.

Returns `{ action, deliveringVersion, installedVersionBefore }`.

**`install-json.js`**

- `readInstallJson(file)` — reads and parses; returns `null` if absent.
- `writeInstallJson(file, value)` — atomic write-then-rename (`${file}.tmp-<pid>-<timestamp>`); strips `state_schema_version` from every write.
- `isCurrentShape(ij)` — returns `true` if `ij.harnesses` is a non-null object (structural detection; no version field consulted).
- `migrateInstallJson(ij, installKey)` — lifts legacy flat or versioned shapes into current shape; drops `state_schema_version`.
- `buildCopilotCliPluginEntry(version)` — returns `{ version, channel: 'copilot-cli-plugin', installed_at, last_writer_version }`.

**`install-files.js` — `installManifestFiles(manifest, pluginRoot, opts)`**

Iterates `manifest.files`. For each entry, expands `${RAD_HOME}` tokens in `entry.destinationPath` via `paths.root`, guards against destination escape (`!dest.startsWith(paths.root)` throws — NFR-1), creates parent dirs, and copies.

**`remove-files.js` — `removeManifestFiles(manifest, opts)`**

Removes every non-`user-config` entry. Skips paths under `paths.projects`. After removals, prunes empty parent directories upward toward `paths.root`.

**`install-log.js` — `appendInstallLog(file, { action, deliveringVersion, installedVersionBefore }, opts)`**

Best-effort append (entire body is in a `try/catch`; never throws). Valid `action` values are the six members of `INSTALL_LOG_ACTIONS`: `fresh-install`, `upgrade-complete`, `noop`, `downgrade-noop`, `cancelled-modified-files`, `error`. Each log line is a JSON object with `at`, `channel`, `action`, `delivering_version`, `installed_version_before`.

**`catalog.js` — `loadManifest(pluginRoot, version)`**

Reads `${pluginRoot}/manifests/v${version}.json`. Throws if absent. The manifest is always read from the new payload's bundled catalog because Copilot CLI's flat install path has no peer per-version directory from a prior install.

**`user-data-paths.js` — `userDataPaths(opts)`**

Returns a path bundle derived from `opts.radHome ?? path.join(os.homedir(), '.radorch')`: `root`, `installJson`, `orchestrationYml`, `templates`, `ui`, `projects`, `logs`, `installLog`.

## Coding conventions

- Atomic writes only: `writeInstallJson` and the marker-file write in `bootstrap.mjs` both use write-to-tmp then `fs.renameSync`. No in-place overwrites of state files.
- Log writes are best-effort: `appendInstallLog` wraps its entire body in `try/catch` and never propagates failures to the caller.
- Destination escape guard: every file copy in `installManifestFiles` checks that the resolved destination starts with `paths.root` before writing.
- No global state: all context flows through function parameters; `radHome` is always injected, never read from the environment inside this folder (env reads happen in `bootstrap.mjs` only).
- Shape detection is structural: `isCurrentShape` checks for the presence of `harnesses`, not a version literal.
- Coexistence warning names both potential partners (`claude`, `claude-plugin`) — not just one.

## Rules for making updates

- The six `INSTALL_LOG_ACTIONS` values are a closed set. Adding a new action requires updating the `Set` in `install-log.js` and ensuring callers pass the new string.
- `migrateInstallJson` handles known legacy shapes. A new legacy shape needs a new branch; do not silently discard unknown shapes.
- `userDataPaths` is the single source of truth for all `~/.radorch/` sub-paths. Add new paths here rather than constructing them ad-hoc in callers.
- All modules are imported by `bootstrap.mjs` and bundled by esbuild; they must stay ESM compatible (`"type": "module"` in the parent `package.json`). Do not introduce dynamic `require` calls.
- Tests in `tests/` exercise this module; run them after any change here.
- The prior-manifest lookup always reads from the new payload's catalog — never attempt to read from a peer per-version directory that may not exist on a flat Copilot CLI install path.
