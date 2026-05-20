# lib/install/

## Purpose

Install state machine for the Copilot in VS Code plugin. `bootstrap.mjs` imports these modules at build time; esbuild inlines them into the bundled hook. No file in this folder ships as a standalone artifact in the plugin payload.

## How it works

**`run-install.js` — `runInstall(opts)`**

Entry point. `opts` shape: `{ pluginRoot: string, radHome?: string, force?: boolean, stderr?: (msg:string)=>void }`.

Flow:
1. Resolves paths via `userDataPaths({ radHome })`.
2. Reads `${pluginRoot}/plugin.json` for `deliveringVersion` (falls back to `${pluginRoot}/package.json` if `plugin.json` is absent or has no `version` field).
3. Reads `install.json` via `loadRegistry`; always returns a valid `{ harnesses: {} }` shape even when the file is absent or malformed.
4. Checks for the pipeline sentinel at `${pluginRoot}/skills/rad-orchestration/scripts/radorch.mjs`.
5. **Three-partner bidirectional coexistence**: emits a warning if any of `copilot-cli`, `copilot-vscode`, or `copilot-cli-plugin` is present alongside `copilot-vscode-plugin`, naming every partner in the message. The warning for `copilot-cli-plugin` includes the model-routing failure-mode prose: CLI-shaped model identifiers are not recognized by VS Code's resolver, and load-order ambiguity may let either plugin's agent files win at runtime.
6. **Same-version fast path**: if prior version matches delivering version and sentinel exists and `!opts.force`, logs `noop` and returns.
7. **Downgrade noop**: if `cmpSemver(deliveringVersion, installedVersionBefore) < 0` and `!opts.force`, logs `downgrade-noop` and returns.
8. **Upgrade or fresh install**: reads the prior manifest from the new payload's bundled per-version catalog (`loadManifest(pluginRoot, priorVersion)`) — VS Code's flat `agentPlugins/` install path has no peer per-version directory from a prior install, so the manifest must come from the new payload; removes prior manifest files via `removeManifestFiles`, installs new files via `installManifestFiles`, copies `${pluginRoot}/ui` to `paths.ui` if present, writes updated `ij` via `writeInstallJson`, and returns `action: 'upgrade-complete'` or `'fresh-install'`.
9. Logs every outcome (including errors) via `appendInstallLog`.

Returns `{ action, deliveringVersion, installedVersionBefore }`.

**`install-json.js`**

- `readInstallJson(file)` — reads and parses; returns `null` if absent.
- `writeInstallJson(file, value)` — atomic write-then-rename (`${file}.tmp-<pid>-<timestamp>`); strips `state_schema_version` from every write.
- `isCurrentShape(ij)` — returns `true` if `ij.harnesses` is a non-null object (structural detection; no version field consulted).
- `loadRegistry(installJsonPath)` — robust loader; returns `{ harnesses: {} }` on any read/parse failure.
- `buildCopilotVscodePluginEntry(version)` — returns `{ version, channel: 'copilot-vscode-plugin', installed_at, last_writer_version }`.

Note: unlike the CLI plugin, there is no `migrateInstallJson` here. The VS Code plugin's install key (`copilot-vscode-plugin`) is new; no legacy shape predates it. `loadRegistry` handles the absent-or-malformed case.

**`install-files.js` — `installManifestFiles(manifest, pluginRoot, opts)`**

Iterates `manifest.files`. For each entry, expands `${RAD_HOME}` tokens in `entry.destinationPath` via `paths.root`, guards against destination escape (`!dest.startsWith(paths.root)` throws — NFR-1), creates parent dirs, and copies.

**`remove-files.js` — `removeManifestFiles(manifest, opts)`**

Removes every non-`user-config` entry. Skips paths under `paths.projects`. After removals, prunes empty parent directories upward toward `paths.root`.

**`install-log.js` — `appendInstallLog(file, { action, deliveringVersion, installedVersionBefore }, opts)`**

Best-effort append (entire body is in a `try/catch`; never throws). Valid `action` values are the six members of `INSTALL_LOG_ACTIONS`: `fresh-install`, `upgrade-complete`, `noop`, `downgrade-noop`, `cancelled-modified-files`, `error`. Each log line is a JSON object with `at`, `channel`, `action`, `delivering_version`, `installed_version_before`.

**`catalog.js` — `loadManifest(pluginRoot, version)`**

Reads `${pluginRoot}/manifests/v${version}.json`. Throws if absent. The manifest is always read from the new payload's bundled catalog because VS Code's flat `agentPlugins/` install path has no peer per-version directory from a prior install.

**`bootstrap-marker.js`**

- `readMarker(markerPath)` — reads and parses; returns `null` if absent or unparseable.
- `writeMarker(markerPath, marker)` — atomic write via tmp+rename.

The marker carries three states: `{ status: "success", version, at }`, `{ status: "error", version, at }`, or absent. `bootstrap.mjs` uses it for idempotency: success + version-match → silent noop; error or version-mismatch → fall through to `runInstall`. The marker lives under `~/.radorch/` (not under the `agentPlugins/` install root) because VS Code overwrites the OS-specific `agentPlugins/` path on upgrade, which would destroy a marker stored there.

**`user-data-paths.js` — `userDataPaths(opts)`**

Returns a path bundle derived from `opts.radHome ?? path.join(os.homedir(), '.radorch')`: `root`, `installJson`, `orchestrationYml`, `templates`, `ui`, `projects`, `logs`, `installLog`, `bootstrapMarker` (path to `~/.radorch/.copilot-vscode-plugin-bootstrap.json`).

## Coding conventions

- Atomic writes only: `writeInstallJson` and `writeMarker` both use write-to-tmp then `fs.renameSync`. No in-place overwrites of state files.
- Log writes are best-effort: `appendInstallLog` wraps its entire body in `try/catch` and never propagates failures to the caller.
- Destination escape guard: every file copy in `installManifestFiles` checks that the resolved destination starts with `paths.root` before writing.
- No global state: all context flows through function parameters; `radHome` is always injected, never read from the environment inside this folder (env reads happen in `bootstrap.mjs` only).
- Shape detection is structural: `loadRegistry` checks for the presence of `harnesses`, not a version literal.
- Three-partner coexistence warning names all potential partners (`copilot-cli`, `copilot-vscode`, `copilot-cli-plugin`) and includes the model-routing failure-mode prose when `copilot-cli-plugin` is present.

## Rules for making updates

- The six `INSTALL_LOG_ACTIONS` values are a closed set. Adding a new action requires updating the `Set` in `install-log.js` and ensuring callers pass the new string.
- `userDataPaths` is the single source of truth for all `~/.radorch/` sub-paths. Add new paths here rather than constructing them ad-hoc in callers.
- All modules are imported by `bootstrap.mjs` and bundled by esbuild; they must stay ESM compatible (`"type": "module"` in the parent `package.json`). Do not introduce dynamic `require` calls.
- Tests in `tests/` exercise this module; run them after any change here.
- The manifest lookup always reads from the new payload's bundled catalog. Never attempt to read from a peer per-version directory — VS Code's flat `agentPlugins/` path has no such peer.

## Seam to bootstrap.mjs

`bootstrap.mjs` is the sole importer of this folder's modules. They are bundled by esbuild at build time and do not appear as separate files in the plugin payload.

## Seam to userDataPaths

`userDataPaths` is the single anchor for every `~/.radorch/` path — including the bootstrap marker, which lives there rather than in the `agentPlugins/` install root because that root is overwritten by VS Code on upgrade.
