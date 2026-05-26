# GitHub Copilot CLI — Plugin System Reference

> **Type:** Research / reference. Evergreen.
> **Scope:** GitHub Copilot CLI (the local `copilot` CLI) plugin model — install layout, manifest schemas, hook contract, marketplace catalogs, runtime behavior.
> **Last verified:** 2026-05-19 against `docs.github.com/en/copilot/...`. The docs evolve; re-verify before relying on a contract documented as "silent" or "undocumented".
> **Audience:** Contributors authoring or maintaining a Copilot CLI plugin in this repo, or planning a port from another plugin platform.

This document captures what the official Copilot CLI documentation and live marketplace JSON say about the plugin system. Where the docs are silent or where an implementation behavior is only indirectly attested, that is called out explicitly so a planner knows where a smoke test is required before relying on a behavior.

For the canonical official docs, see the URL bookmark list at the end.

---

## 1. Install model and on-disk layout

### Plugin install destination on the user's machine

- **Marketplace installs:** `~/.copilot/installed-plugins/<MARKETPLACE-NAME>/<PLUGIN-NAME>/`
- **Direct GitHub installs (no marketplace):** `~/.copilot/installed-plugins/_direct/<SOURCE-ID>/`
- **Marketplace catalog cache:** `~/.cache/copilot/marketplaces/` (Linux) or `~/Library/Caches/copilot/marketplaces/` (macOS), overridable via `COPILOT_CACHE_HOME`.
- **CLI home root:** `~/.copilot/` is the root, relocatable via `COPILOT_HOME`.

The plugin install path is **flat — no version segment**. An upgrade overwrites in place; there is no peer per-version directory the installer can compare against.

### Cache-and-read behavior

> "When you install a plugin its components are cached and the CLI reads from the cache for subsequent sessions. To pick up changes made to a local plugin install it again."

Plugin components are loaded at CLI start from the cached payload. **Changes to plugin files (including `hooks.json`) made during a live session are not picked up until the next session.** A plugin that rewrites its own `hooks.json` to alter behavior won't see that change take effect mid-session.

### Marketplace catalog locations a plugin author can ship from

Two documented locations:

- **Primary:** `.github/plugin/marketplace.json` in the catalog repo.
- **Secondary:** `.claude-plugin/marketplace.json` — Copilot CLI also reads this path for cross-platform interop.

The docs do not document any schema difference between the two locations, nor a precedence rule when both exist. Treat the secondary as a fallback and ship to one primary location unless you've validated both are honored.

A known issue: when `plugin.json` lives at `.github/plugin/plugin.json`, **direct GitHub installs** (`copilot plugin install OWNER/REPO`) may silently fail to discover it — they probe the repo root. See [issue #2390](https://github.com/github/copilot-cli/issues/2390). The marketplace install path is unaffected.

---

## 2. `plugin.json` schema

### Required fields

- `name` — string, kebab-case, letters/numbers/hyphens only, max 64 chars. No underscores, no uppercase.

### Optional metadata

- `description` — string, max 1024 chars.
- `version` — string, semver format. Documentation only shows semver; alternate formats are undocumented.
- `author` — object with required `name`, optional `email` and `url`.
- `homepage`, `repository`, `license`, `keywords` (`string[]`), `category`, `tags` (`string[]`).

### Component path fields (all optional, with conventional defaults)

- `agents` — `string | string[]`, default `agents/`. Path(s) to agent directories (`.agent.md` files).
- `skills` — `string | string[]`, default `skills/`. Path(s) to skill directories (`SKILL.md` files).
- `commands` — `string | string[]`, no documented default.
- `hooks` — `string | object`. Path to a hooks config file, or an inline hooks object. When this field is absent, the CLI checks `hooks.json` and then `hooks/hooks.json` inside the plugin directory (both paths probed, in that order).
- `mcpServers`, `lspServers` — `string | object`, conventional defaults `.mcp.json` and `lsp.json` respectively.

### What `plugin.json` is **not**

`plugin.json` is purely the Copilot manifest. It carries **no** npm-shaped fields (`bin`, `scripts`, `dependencies`). If the plugin is published as an npm package, that package's own `package.json` is a separate file.

### Behavior on malformed `plugin.json`

The docs are silent on what Copilot CLI does for missing required fields, unknown fields, or invalid types. The marketplace catalog supports a per-entry `strict` flag (default `true`) for "full schema and validation rules" vs relaxed validation, but that is a marketplace-entry property, not a plugin.json property.

Empirically, when `plugin.json` is in a location the loader doesn't probe (issue #2390 above), components fail to load **silently** — no error is surfaced. Plan for silent failure modes and provide your own observability.

---

## 3. `hooks.json` schema

### Top-level structure

```json
{
  "version": 1,
  "disableAllHooks": false,
  "hooks": {
    "<eventName>": [ /* hook entries */ ]
  }
}
```

- `version: 1` is required.
- `disableAllHooks` pauses execution without deleting configuration.

### Hook entry shape (type: command)

```json
{
  "type": "command",
  "bash": "./scripts/handler.sh",
  "powershell": "./scripts/handler.ps1",
  "command": "node ./scripts/handler.mjs",
  "cwd": ".github/hooks",
  "env": { "FOO": "bar" },
  "timeoutSec": 10
}
```

- **At least one** of `bash`, `powershell`, or `command` must be present. `command` is the cross-platform fallback used when neither `bash` nor `powershell` is set.
- `cwd` — optional working directory. **No documented default**; the safe planner-assumption is "behavior is undefined when `cwd` is omitted — always set it." **Empirically confirmed:** `cwd` resolves relative to the CLI process's working directory (where the user launched the CLI), **not** the plugin install directory. Do not use `cwd` to locate bundled scripts — use `%COPILOT_PLUGIN_ROOT%` in the `command` string instead (see §4 below).
- `env` — object, supports variable expansion.
- `timeoutSec` — number, **default 30**.
- **No** `failOnError` / `continueOnError` field is documented.
- **No** `args` field — the command string is the whole invocation.

### Multiple hooks on the same event

> "When the same event appears in multiple sources, all hook entries from all sources are run."
> "If multiple hooks of the same type are configured, they execute in order."

Sequential, in discovery order. No concurrency. For `preToolUse` specifically, "if any hook returns `\"deny\"`, the tool is blocked."

### Supported events

Both camelCase (native) and PascalCase (VS Code-compatible) variants are accepted:

| camelCase | PascalCase | When it fires |
|---|---|---|
| `sessionStart` | `SessionStart` | New or resumed interactive session. Docs note it "fires only for new interactive sessions… do not fire on resume" — verify empirically if you depend on resume behavior. |
| `sessionEnd` | `SessionEnd` | Session terminates. |
| `userPromptSubmitted` | `UserPromptSubmit` | User submits a prompt. Fires on every prompt; no "first prompt only" filter. |
| `preToolUse` | `PreToolUse` | Before a tool is invoked. Can return `permissionDecision` (`allow`/`deny`/`ask`) and `modifiedArgs`. |
| `postToolUse` | `PostToolUse` | After a tool completes successfully. |
| `postToolUseFailure` | `PostToolUseFailure` | After a tool invocation fails. |
| `preCompact` | `PreCompact` | Before context compaction. |
| `agentStop` | `Stop` | Agent terminates. Can return `decision` (`block`/`allow`) and `reason`. |
| `subagentStart` | *(camelCase only)* | Subagent spawned. |
| `subagentStop` | `SubagentStop` | Subagent completes. |
| `errorOccurred` | `ErrorOccurred` | Error condition. |
| `permissionRequest` | *(camelCase only, CLI only)* | Permission gate. Can return `behavior` (`allow`/`deny`), `message`, and `interrupt`. |
| `notification` | *(camelCase only, CLI only)* | User-facing notification. |

Stdin payload field-naming follows the convention used in the event name (camelCase keys vs `hook_event_name` PascalCase keys, ISO 8601 vs Unix-ms timestamps).

---

## 4. Hook script invocation contract

### How hooks run

For the **local CLI**, hooks "run on the developer's local machine in the same shell as the CLI" — no sandbox. They inherit the user's full environment, shell, filesystem permissions, and network reachability. The `bash` and `powershell` fields imply shell-string invocation through the platform shell. The hook runs to completion before subsequent prompt-processing stages continue (the documented `timeoutSec` only makes sense if the runtime blocks on the hook process).

### Stdin: structured JSON payload

Each event receives a structured JSON document on stdin. A representative payload (preToolUse, camelCase form):

```typescript
{
  sessionId: string;
  timestamp: number;            // Unix ms
  cwd: string;
  toolName: string;
  toolArgs: unknown;
}
```

`userPromptSubmitted` / `sessionStart` receive "timestamp, current working directory, and full prompt text." The PascalCase variant adds `hook_event_name` and uses ISO 8601 timestamps.

### Concrete payload examples

**`sessionStart` (camelCase):**
```json
{
  "sessionId": "abc123",
  "timestamp": 1704614400000,
  "cwd": "/path/to/project",
  "source": "startup",
  "initialPrompt": "optional"
}
```

`source` is one of `"startup"`, `"resume"`, or `"new"`. `initialPrompt` is optional.

**`userPromptSubmitted` (camelCase):**
```json
{
  "sessionId": "abc123",
  "timestamp": 1704614400000,
  "cwd": "/path/to/project",
  "prompt": "The user's prompt text"
}
```

### Stdout: event-dependent decision protocol

Stdout is parsed as JSON on exit code 0, but interpretation varies by event:

- `preToolUse`: stdout JSON may contain `permissionDecision` (`allow`/`deny`/`ask`), `modifiedArgs`, `permissionDecisionReason`.
- `agentStop` / `subagentStop`: `decision` (`block`/`allow`), `reason`.
- `permissionRequest`: `behavior` (`allow`/`deny`), `message`, `interrupt`.
- `userPromptSubmitted`: **"The output of this hook is ignored."** Stdout is not a control surface; only side effects (and exit code) matter.

### Exit code semantics — fail-open by default

| Exit code | Behavior |
|---|---|
| `0` | Success. stdout parsed as hook output JSON if present. |
| `2` | Treated as a warning. stderr surfaced to the user. The run continues. For `permissionRequest`, exit 2 is treated as `{"behavior":"deny"}`. For `postToolUseFailure`, exit 2 is treated as additional context. |
| Other non-zero | "Logged as a hook failure. The run continues (fail-open)." |

The system is **fail-open**: a throwing script that exits non-zero (other than 2) will not block the prompt — it will be logged as a hook failure and prompt processing continues. Uncaught exceptions in Node scripts behave the same way.

### Timeout

`timeoutSec`, default **30**. The docs do not explicitly document on-timeout behavior; combined with the fail-open posture above, a timeout is logged as a failure and the run continues.

### Self-modifying `hooks.json` mid-session

> "Changes to hook configurations are loaded when the CLI starts."

**Explicitly not supported as a live update.** A hook that rewrites its own `hooks.json` will not see the change take effect until the user starts a new session (or reinstalls/updates the plugin). The idempotent-marker-file pattern is the right design for one-shot bootstrap behaviors — keep the hook entry registered, and have the script fast-path to a no-op when a marker file is present.

### Injected environment variables

**Empirically confirmed** (dumped via `cmd /c set` in a live `userPromptSubmitted` hook). Copilot CLI injects these into every hook process:

| Variable | Example value | Notes |
|---|---|---|
| `COPILOT_PLUGIN_ROOT` | `~/.copilot/installed-plugins/<marketplace>/<plugin>` | Plugin install directory. **Primary var for locating bundled scripts.** |
| `PLUGIN_ROOT` | same as above | Alias; same value. |
| `CLAUDE_PLUGIN_ROOT` | same as above | Cross-platform alias; same value. |
| `COPILOT_PLUGIN_DATA` | `~/.copilot/plugin-data/<marketplace>/<plugin>` | Per-plugin persistent data directory. |
| `COPILOT_PROJECT_DIR` | current project path | The project the user has open. |
| `COPILOT_CLI` | `1` | Flag indicating CLI hook context. |
| `COPILOT_CLI_BINARY_VERSION` | e.g., `1.0.48` | Running CLI version. |
| `COPILOT_LOADER_PID` | process ID | PID of the CLI loader process. |

**How to use `COPILOT_PLUGIN_ROOT` in hook commands (Windows):**

Hook commands run through `cmd.exe` on Windows, so `%VAR%` expansion applies:

```json
{
  "type": "command",
  "command": "node \"%COPILOT_PLUGIN_ROOT%\\hooks\\bootstrap.mjs\""
}
```

This resolves to the absolute path of the bundled script regardless of the user's working directory. **This is the correct pattern for all plugin-bundled hook scripts.**

> **Note:** The `cwd` field is resolved relative to the CLI's working directory (NOT the plugin root), making it unreliable for locating plugin-bundled scripts. Use `%COPILOT_PLUGIN_ROOT%` in the `command` string instead.

### Permissions

Hooks have the invoking user's full permissions — write access to `~/`, the workspace, `~/.copilot/installed-plugins/`, anywhere the user can write. Nothing is sandboxed for local CLI hooks. The docs note one operational requirement: "Verify the script you are calling from your hook is executable (`chmod +x script.sh`)."

---

## 5. Plugin lifecycle: install, update, reload

### What `copilot plugin install` and `copilot plugin update` do

The docs are sparse here. What is documented:

- Plugin payload lives under `~/.copilot/installed-plugins/<marketplace>/<plugin>/` (flat, no version segment).
- Per-plugin metadata is in `~/.copilot/config.json` — issue #2390 reveals one concrete data point: the `cache_path` per plugin is read from there, and the workaround for plugin.json location issues is "manually editing `~/.copilot/config.json` to append `/.github/plugin` to the cache path."

The docs are **silent on**: rename-swap vs in-place overwrite during update, persistent-file safety outside the plugin dir, mid-session effect of an update.

User-shipped persistent files **outside** the plugin install dir (e.g., `~/.radorc/`, project workspaces) are untouched — this is implied by the install-isolation model but not stated as a guarantee. **Plan accordingly:** anything the plugin writes outside `~/.copilot/installed-plugins/<your-plugin>/` will survive uninstall/update, so be conservative.

### Does `userPromptSubmitted` fire reliably after `plugin update`?

Combined evidence from the docs: hook config is loaded at CLI start, and "to pick up changes made to a local plugin install it again." The straightforward read: after `plugin update`, the user must **start a new session** for hook changes to take effect. `userPromptSubmitted` will fire on the next prompt of the next session, not necessarily the next prompt of the current session.

This reinforces the marker-file approach: the bootstrap should never depend on hook registry mutations being visible mid-session. **Empirical confirmation before locking** is recommended.

### Is there a post-install / post-update hook event?

**Not documented.** The full event list contains no plugin-lifecycle event. `sessionStart` is the closest analog (fires when a new or resumed session begins) but is not specifically tied to install/update completion. `userPromptSubmitted` is the most reliable trigger for a one-shot install-time bootstrap because it fires synchronously before any agent/skill activity for the user's first prompt of the next session.

---

## 6. Marketplace catalogs

### Source field shapes

The plugin reference enumerates these forms for the `source` field on a marketplace entry:

| Form | Example | Use |
|---|---|---|
| Relative path (string) | `"./plugins/my-plugin"` | Plugin lives inside the catalog repo. |
| GitHub shorthand (string) | `"OWNER/REPO"` | Top-level repo. |
| GitHub subdir (string) | `"OWNER/REPO:PATH/TO/PLUGIN"` | Plugin at a subpath of the repo. |
| Git URL (string) | `"https://github.com/o/r.git"` | Arbitrary git source. |
| Structured object | `{ "source": "github", "repo": "owner/repo", "path": "...", "ref": "..." }` | Most-attested form in real marketplaces. |

### `source: npm` belongs to VS Code agent-plugins, NOT Copilot CLI

Community summaries (notably the DeepWiki page for `github/awesome-copilot`) describe `external.json` entries with shapes like:

```json
{ "source": "npm", "package": "@scope/pkg", "version": "1.0.0" }
{ "source": "pip", "package": "<name>", "version": "<version>" }
{ "source": "url", "url": "https://..." }
```

These shapes are **part of the VS Code agent-plugins ecosystem**, not the Copilot CLI plugin model. The Copilot CLI plugin reference does not document `source: npm` as a valid source form. Inspection of live Copilot CLI marketplaces (`github/copilot-plugins`, `github/awesome-copilot`'s plugin catalog) confirms that **only relative-path strings and `source: github` objects appear in production** — no npm, pip, or url entries against a Copilot CLI plugin runtime.

**Planner takeaway:** if a port from VS Code or Claude is contemplating npm-based distribution, that path is not available on Copilot CLI under the current docs and live marketplace evidence. The attested distribution forms for Copilot CLI plugins are:

- **Relative path** — plugin lives inside the marketplace-catalog repo.
- **`source: github` object** — `{ "source": "github", "repo": "OWNER/REPO", "path": "...", "ref": "..." }`. The most-attested form in live Copilot CLI marketplaces.
- **Git URL** — arbitrary git source (`source: url` with a full git URL, or a bare git URL string). Useful for GHES-portable distribution since `source: github` resolves against github.com only.
- **Enterprise-Managed Plugins (May 2026 channel)** — a separate attested distribution channel where an enterprise admin curates plugins centrally and they appear in the user's CLI without per-user `plugin install`. Uses the same plugin payload contract (`plugin.json`, `hooks.json`, agents/skills dirs); the distribution mechanism is the management channel rather than the local marketplace catalog. The same `source: github`-style entries appear inside the enterprise's catalog; relative-path entries do not apply since there is no per-user catalog repo.

### Schema differences and precedence between `.github/plugin/` and `.claude-plugin/`

Both locations are read. The docs do not document any schema difference, nor a precedence rule when both exist. **Treat behavior as undefined when both files exist** and ship to one location unless you've validated both. Issue #2390 hints that file-discovery quirks in this area are real.

### Filtering of incompatible entries

**Not documented.** No statement about Copilot filtering Claude-shaped entries when reading from `.claude-plugin/marketplace.json`. Entries appear to be parsed under one shared schema regardless of source dir.

---

## 7. Cloud-agent surface

For the **cloud agent** (Copilot's remote-execution sandbox), hooks behave differently from the local CLI:

- **Plugin-contributed hooks are not loaded.** Only the workspace's own `.github/hooks/*.json` is read.
- **`powershell` entries are ignored.** Linux only.
- **Working directory:** `/workspace` (cloned repo) or `/root`.
- **Filesystem:** "Ephemeral. Files written by hooks are discarded when the job ends."
- **Network:** Restricted by the cloud-agent firewall; only GitHub/Copilot hosts reachable by default.
- **Interactivity:** Fully non-interactive.
- **Per-hook default timeout:** 30s.
- **Injected env vars:** `GITHUB_COPILOT_API_TOKEN`, `GITHUB_COPILOT_GIT_TOKEN`, `COPILOT_AGENT_PROMPT`, `HOME` (set to `/root`). `GITHUB_TOKEN` is **not** set in the sandbox.

**Implication for plugin authors:** any orchestration component depending on a plugin-shipped hook will not run in cloud-agent mode under the current docs. Plugin behaviors that need cloud-agent parity must duplicate themselves into the workspace's `.github/hooks/` — there is no plugin-payload bridge.

---

## 8. Agent / skill loading model

### Load timing

The docs imply session-start loading via the cache behavior: components are cached at install time and loaded at CLI start. The docs do not explicitly distinguish lazy-vs-eager dispatch; only the cache-at-session-start contract is documented.

### User-vs-plugin shadowing

Documented load order for **agents and skills**, first-found-wins, dedup by ID (agents) / `name` (skills):

1. `~/.copilot/agents/` (user level)
2. `<project>/.github/agents/`
3. parent-dir `.github/agents/`
4. `~/.claude/agents/`
5. `<project>/.claude/agents/`
6. parent `.claude/agents/`
7. **plugin `agents/` dirs (by install order)**
8. remote org/enterprise

A user-level file at `~/.copilot/agents/coder.md` will **shadow** a plugin-shipped `coder` agent. This is important for cross-channel coexistence: if a machine has both a plugin install and a direct-to-`~/.copilot/` install of the same content, the direct install always wins.

**MCP servers are the documented exception:** same-name MCP servers use **last-wins** precedence with the plugin overriding existing installs.

### Plugin namespacing

**No namespacing.** Agents and skills are addressed by bare ID/name regardless of source — the reference describes a single flat dedup pool, not a `<plugin>:<skill>` syntax. An `@coder` dispatch references the same name whether the agent comes from a plugin or the user's directory. (This is a notable simplification vs Claude Code's plugin model, where plugin-installed skills are namespaced `<plugin>:<skill>`.)

---

## 9. Structural validation, signing, integrity

### Install-time validation

- `strict` marketplace-entry field (default `true`): "plugins must conform to the full schema and validation rules. When `false`, relaxed validation is used." The full schema is not enumerated for what "must conform" means at install time.
- Empirically (issue #2390): when `plugin.json` is in a non-standard location, "skills and agents defined by the plugin are never loaded" — **silent failure**, no install-time error. The install command succeeds even when the payload is structurally non-functional; structural failure surfaces only as "components do not appear."

### Checksums / signatures

**Not documented.** No mention of tarball checksums, signatures, or integrity verification.

---

## 10. Behaviors that surprise developers porting from another plugin platform

- **No nested `"hooks"` sub-array inside event entries.** Each event name maps directly to an array of hook objects: `{ "userPromptSubmitted": [{ "type": "command", ... }] }`. The Claude Code hooks format wraps entries in a `{ "hooks": [...] }` object — this structure is **invalid** in Copilot CLI and will cause the hooks to silently not fire. This is the most likely root cause when hooks appear wired up but never execute.
- **`COPILOT_PLUGIN_ROOT` IS injected** — and so are `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_DATA`, and `COPILOT_PROJECT_DIR`. Use `%COPILOT_PLUGIN_ROOT%` in the hook `command` string (cmd.exe expands it on Windows) to reference bundled scripts by absolute path. The `cwd` field resolves relative to the CLI working directory (NOT the plugin root) and should not be used to locate plugin-bundled scripts.
- **No mid-session reload.** Self-modifying-hook patterns are dead — use idempotent marker files.
- **Fail-open on non-zero exit (other than 2).** A misbehaving hook does not break the user's session, but it also won't surface loudly. Persist failure state in a marker file if observability matters.
- **`userPromptSubmitted` stdout is ignored.** Bootstrap hooks signal success/failure only via exit code and side effects.
- **Hook event names support dual casing.** Both camelCase native and PascalCase VS-Code-compatible variants are accepted.
- **Plugin naming:** kebab-case, letters/numbers/hyphens, max 64 chars. No underscore, no uppercase.
- **`SKILL.md`** is the literal expected filename (capitalized). Agents use `.agent.md` suffix.
- **`source: npm` is NOT a Copilot CLI plugin feature.** It belongs to the VS Code agent-plugins ecosystem. Real Copilot CLI marketplaces in `github/copilot-plugins` and `github/awesome-copilot` use relative paths and `source: github` object form exclusively. The Enterprise-Managed Plugins channel uses the same shape. There is no npm-based distribution path on Copilot CLI under the current docs.
- **`plugin.json` at `.github/plugin/plugin.json` triggers issue #2390 for direct GitHub installs.** Either ship at repo root or constrain users to the marketplace install path.
- **Cloud agent loads only `.github/hooks/*.json`** — plugin hooks are not loaded in cloud sandbox.
- **Filesystem and line-endings:** the docs do not document charset/line-ending sensitivity. Hook scripts have a documented `chmod +x` requirement — Windows-cloned plugins may need explicit attention to executable bits if the user runs Copilot CLI on macOS/Linux.

---

## 11. Open questions requiring empirical validation

These behaviors are silent or under-specified in the canonical docs. Smoke-test them against a throwaway plugin before locking a design that depends on the answer.

1. **Default `cwd`** when omitted from a hook entry. **Empirically resolved:** `cwd` resolves relative to the CLI process's working directory (where the user launched the CLI). Omitting `cwd` is equivalent to `cwd: "."` relative to the CLI launch dir. Use `%COPILOT_PLUGIN_ROOT%` in the command string to reference plugin-bundled scripts.
2. **Precedence** when both `.github/plugin/marketplace.json` and `.claude-plugin/marketplace.json` exist in the same repo.
3. **`source: github` resolution against GHES hosts.** Does Copilot CLI's `source: github` with `repo: ORG/REPO` resolve against the user's authenticated GHES host, or only against github.com? No live marketplace entry has been observed against GHES, so this is unattested either way. A focused smoke test against a throwaway GHES-like setup (or a real GHES dev tenant if available) closes this. **This is the one open empirical question the publish-wiring iteration's brainstorm should pick up** — both plugins' distribution decisions depend on the answer.
4. **`userPromptSubmitted` firing after `copilot plugin update`** — is it reliable on the user's first prompt of the next session, or only after a fresh `copilot` invocation?
5. **Agent / skill user-vs-plugin shadowing resolution timing** — at load time or at dispatch time? Affects post-update behavior.
6. **Behavior on malformed `plugin.json`** — silent skip, warning, or error? Affects observability design.
7. **Mid-session `hooks.json` rewrites — does anything change if the plugin is reinstalled mid-session?** The docs imply not; confirm.
8. **Cloud-agent runtime feature detection** — is there a documented way for a hook to know "I'm running in the cloud sandbox right now," beyond inspecting `HOME=/root` or other env-var heuristics?

---

## 12. Reference URLs

### Plugin reference and schemas
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating

### Hooks reference and behavior
- https://docs.github.com/en/copilot/reference/hooks-configuration
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- https://docs.github.com/en/copilot/tutorials/copilot-cli-hooks
- https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-hooks

### Marketplace reference
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing

### Configuration directory and environment variables
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli
- https://deepwiki.com/github/copilot-cli/5.2-environment-variables

### CLI command surface
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference

### Live marketplace examples (concrete schema-in-the-wild)
- https://github.com/github/copilot-plugins/blob/main/.github/plugin/marketplace.json
- https://github.com/github/awesome-copilot/blob/main/.github/plugin/marketplace.json
- https://github.com/github/awesome-copilot/blob/main/plugins/external.json
- https://deepwiki.com/github/awesome-copilot/8.1-plugin-architecture-and-marketplace

### Known issues worth tracking
- https://github.com/github/copilot-cli/issues/2390 — `plugin.json` discovery failure for direct GitHub installs at `.github/plugin/`
- https://github.com/github/copilot-cli/issues/1510 — remote plugin source support in marketplace listings
- https://github.com/github/copilot-cli/issues/1157 — global hooks configuration feature request
- https://github.com/github/copilot-cli/issues/3088 — `copilot plugin marketplace list` repo-override behavior

### Community syntheses (useful for cross-checking)
- https://www.kenmuse.com/blog/creating-agent-plugins-for-vs-code-and-copilot-cli/
- https://code.visualstudio.com/docs/copilot/customization/agent-plugins
- https://chris-ayers.com/posts/agent-skills-plugins-marketplace/
