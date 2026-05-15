# hooks/

Claude Code hook configuration for the `rad-orchestration` plugin. Canonical files at the repo root are wholesale-copied into the plugin payload at build time (`adapters/run-plugin.js`) and ship inside the plugin tarball under `hooks/`.

The plugin registers two hooks with distinct roles:

| Hook | Event | Script | Lifecycle |
|---|---|---|---|
| Bootstrap | `UserPromptSubmit` | `bootstrap-then-uninstall.mjs` | One fire per install/update, then self-uninstalls |
| Drift detection | `SessionStart` | `drift-check.mjs` | Persistent — fires once per Claude Code session |

## How the bootstrap hook works

The plugin needs to hydrate `~/.radorch/` (the orchestration system's user-data root) once after install and once after every `/plugin update`. After that initial run, the user-data root is stable and there's no further setup work — the hook should disappear and never fire again until the next install or update brings work to do.

That's the contract: **one fire per install or update, then silent**.

The mechanism is a `UserPromptSubmit` hook that wraps `plugin-bootstrap` and removes itself after a successful run.

### Lifecycle

1. **Install or update** — Claude lays down a fresh plugin payload. `hooks/hooks.json` registers `UserPromptSubmit` pointing at `bootstrap-then-uninstall.mjs`.
2. **First prompt the user submits in that session** — Claude fires `UserPromptSubmit`. The wrapper runs:
   - Reads `${CLAUDE_PLUGIN_ROOT}/package.json` for the delivering version.
   - Reads `~/.radorch/install.json` for the installed version (may be absent on fresh install).
   - On version mismatch (or absent install.json) → spawns `plugin-bootstrap` via the bundled `radorch.mjs`.
   - Parses the JSON envelope `plugin-bootstrap` emits on stdout. On `ok:true`, proceeds. On `ok:false`, unparseable output, or non-zero exit → logs to stderr, **skips self-uninstall**, returns non-zero (next prompt retries).
   - On success → rewrites `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` to remove the `UserPromptSubmit` block (`{"hooks": {}}` remains).
3. **Subsequent prompts in the same session** — the hook is still in memory, so it fires until the next session reload. The wrapper short-circuits the spawn on version match and re-runs the self-uninstall (no-op once `UserPromptSubmit` is gone).
4. **Next session reload** (`/reload-plugins` or restart) — Claude reads the edited `hooks.json`. No hooks registered, no further fires.
5. **Next `/plugin update`** — Claude restores canonical `hooks.json` as part of the fresh payload. Loop restarts.

### Why this works across updates

Every `/plugin update` ships a fresh canonical `hooks.json` with `UserPromptSubmit` re-registered, regardless of what the previous version's hooks.json looked like at the end of its life. The self-uninstall only mutates the currently-installed version's payload; the next version's payload comes in clean.

## Dogfood caveat (directory-source marketplaces)

For directory-source marketplaces (`cli/dist/marketplaces/claude/` during local-dev), Claude Code points `CLAUDE_PLUGIN_ROOT` at the source directory live — there is no separate user-owned cache. The wrapper's self-uninstall therefore rewrites this repo's build output at `cli/dist/marketplaces/claude/plugins/rad-orchestration/hooks/hooks.json`.

This is expected. `npm run build:plugin` regenerates the source. Dogfood iteration loop:

```
npm run build:plugin → test once → rebuild → test again
```

For npm-published plugins this caveat does not apply — the cache directory under `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` is user-owned and disposable.

## Drift detection

`rad-orchestration` ships through two independent channels — the Claude Code plugin (`/plugin update rad-orchestration`) and the legacy installer (`npx rad-orchestration`). When the user updates one channel without the other, `~/.radorch/install.json` and the plugin's bundled `radorch.mjs` fall out of sync. The bundled CLI's `checkVersionSkew` (see `cli/src/lib/install-json.ts`) hard-halts when orchestration is actually invoked against drifted state — that's the safety net.

`drift-check.mjs` is the **soft pre-warning**. It runs as a `SessionStart` hook (matchers: `startup` / `resume` / `clear` / `compact` — no `matcher` field means it fires on all four) and compares two version sources:

- `${CLAUDE_PLUGIN_ROOT}/package.json` → the version the plugin payload is delivering.
- `~/.radorch/install.json` → the version the user-data root was last bootstrapped to.

On drift, the hook writes a plain-stdout line of the form `[rad-orchestration drift] …` and exits 0. Per the Anthropic hook contract, plain stdout on a SessionStart hook is injected into Claude's conversation context before the first prompt, so Claude reads the drift notice and surfaces it organically to the user on their first message.

On no drift (or any error — missing env var, missing package.json, missing install.json, malformed JSON) the hook stays silent and exits 0. Drift detection is informational and never blocks.

Unlike the bootstrap hook, `drift-check.mjs` **never self-uninstalls**. It needs to fire every session so it can catch drift introduced between sessions (typically by an out-of-Claude installer run).

The companion installer-side check lives in `installer/lib/drift-check.js`. It reads `~/.claude/plugins/installed_plugins.json` (Claude Code's plugin registry) and warns at the moment of drift creation — when the installer just bootstrapped a version that doesn't match the registered plugin version. Both ends warn so the user sees the message whether they notice the installer's post-install output, the SessionStart context, or both.

## Debugging

When the bootstrap isn't running or `~/.radorch/` isn't hydrating as expected, check:

| File | What it tells you |
|---|---|
| `~/.radorch/install.json` | What bootstrap thinks the installed version is. Created/updated on every successful `fresh-install` or `upgrade-complete`. |
| `~/.radorch/logs/install.log` | Append-only log of every bootstrap invocation. One JSON line per action. `error` entries here mean bootstrap threw. |
| `~/.radorch/logs/cli.log` | Per-CLI-invocation record. `plugin-bootstrap` appears here on every call. |
| `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` | After a successful run, this should be `{"hooks": {}}`. If `UserPromptSubmit` is still present, the self-uninstall failed — check the wrapper's stderr (Claude Code surfaces it on non-zero exit). |

The wrapper itself emits stderr only on errors, with the prefix `[rad-orchestration:bootstrap-then-uninstall]`. Anything before that prefix is from `plugin-bootstrap` itself.

## Files in this folder

| File | Purpose |
|---|---|
| `hooks.json` | Hook registration. `UserPromptSubmit` → `bootstrap-then-uninstall.mjs`, `SessionStart` → `drift-check.mjs`. |
| `bootstrap-then-uninstall.mjs` | Wrapper script. Runs `plugin-bootstrap`, then removes its own `UserPromptSubmit` entry from `hooks.json` (leaves `SessionStart` intact). |
| `drift-check.mjs` | SessionStart hook. Compares plugin version against `~/.radorch/install.json` and emits a plain-stdout drift notice on mismatch. |
| `hooks.test.mjs` | Asserts the canonical `hooks.json` shape. Stripped from the plugin payload at adapter build time. |
| `drift-check.test.mjs` | Unit tests for `drift-check.mjs`. Stripped from the plugin payload at adapter build time. |
| `AGENTS.md` | This file. |
