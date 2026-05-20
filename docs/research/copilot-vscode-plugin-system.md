# GitHub Copilot in VS Code — Plugin / Customization System Reference

> **Type:** Research / reference. Evergreen.
> **Scope:** GitHub Copilot **inside VS Code** — customization surfaces (instructions, prompts, custom agents, skills, hooks, MCP, agent plugins), distribution channels, and on-disk layout. CLI-side details (`copilot` binary) are covered in the sibling doc; this doc references but does not restate them.
> **Last verified:** 2026-05-19 against `code.visualstudio.com/docs/copilot/...` and `github.com/microsoft/vscode-docs`. The Copilot-in-VSCode story moved heavily between v1.110 (Mar 2026) and v1.114 (April 2026); re-verify anything tagged "Preview" before locking design.
> **Audience:** Contributors planning an installer adapter for Copilot-in-VSCode, or porting from the Copilot CLI installer.

This document captures what the official VS Code Copilot docs and microsoft/vscode-docs source say about customization and plugin distribution. Where the docs are silent or partially specified, that is called out explicitly so a planner knows where empirical validation is required.

Sibling doc with the CLI-side contracts: [docs/research/copilot-cli-plugin-system.md](./copilot-cli-plugin-system.md).

---

## 1. Customization surfaces — what users can ship

VS Code Copilot exposes a layered customization model. Each layer has its own file shape, file location, and stability tier. The full set:

| Surface | File / location | Stability | Notes |
|---|---|---|---|
| Custom instructions (always-on) | `.github/copilot-instructions.md` | GA | One file per workspace. |
| AGENTS.md instructions | `AGENTS.md` at workspace root (nested optional) | GA root; nested = experimental | Toggled via `chat.useAgentsMdFile` (root) and `chat.useNestedAgentsMdFiles` (nested). |
| CLAUDE.md instructions | `CLAUDE.md` at workspace root, `.claude/CLAUDE.md`, or `~/.claude/CLAUDE.md` | GA | Toggled via `chat.useClaudeMdFile`. |
| Conditional instructions | `.github/instructions/*.instructions.md` (workspace) or user profile dir | GA | Frontmatter `applyTo` glob gates application. |
| Prompt files (reusable templates) | `.github/prompts/*.prompt.md` (workspace) or user profile dir | GA | Invoked by `/<promptname>` in chat. |
| Custom agents (was: chat modes) | `.github/agents/*.agent.md` (workspace) or `.claude/agents/`, `~/.copilot/agents/` | GA | Renamed from `.chatmode.md` per docs dated 2026-05-13. |
| Skills | `<plugin>/skills/<name>/SKILL.md` (plugin-shipped) or `~/.copilot/skills/`, `~/.claude/skills/` | GA | `SKILL.md` is the literal filename; skill name in frontmatter must match directory and be plain kebab-case. |
| Agent hooks | `.github/hooks/*.json` (workspace), `~/.copilot/hooks/`, `~/.claude/settings.json`, plugin-bundled, agent-scoped (`hooks` field in `.agent.md` frontmatter) | Preview | "Configuration format and behavior might change in future releases." |
| MCP servers | `.vscode/mcp.json` (workspace), user-profile MCP config, or plugin-bundled `.mcp.json` | GA core; auto-discovery experimental | Workspace MCP config shape: top-level `servers` object. |
| Agent plugins (bundles) | Installed plugins cached under `agentPlugins/github.com/<org>/<repo>/`; recommendable via `.claude/settings.json` or `.github/copilot/settings.json` | Preview | Bundles all of the above into one installable. Shipped in VS Code 1.110 (March 4, 2026). |

### Custom instructions — file shape

- `.github/copilot-instructions.md` is plain Markdown, no frontmatter required. Single file, workspace-scoped, always applied.
- `*.instructions.md` files support optional YAML frontmatter:
  ```yaml
  ---
  name: 'Display Name'
  description: 'Short description'
  applyTo: '**/*.ts,**/*.tsx'
  ---
  ```
  `applyTo` is a comma-separated glob; `**` matches everything. For `.claude/rules` files, the equivalent field is `paths` (array form).
- Organization-level instructions are detected automatically by VS Code if `github.copilot.chat.organizationInstructions.enabled` is on; they show in the Chat Instructions menu alongside personal/workspace instructions.
- Scope priority (highest to lowest): **Personal (user) → Repository → Organization.** Multiple files combine, but the docs do not guarantee a merge order between sources.

### Prompt files — file shape

- `.prompt.md` files in `.github/prompts/` (workspace default; configurable via `chat.promptFilesLocations`) or user profile.
- Optional YAML frontmatter:
  ```yaml
  ---
  description: 'Short explanation'
  name: 'Display name (shown after /)'
  argument-hint: 'free-text user-input guide'
  agent: 'ask' | 'agent' | 'plan' | '<custom-agent-name>'
  model: '<model name or array>'
  tools: ['toolName', ...]
  ---
  ```
- Invoked via `/<promptname>` in chat, by `Chat: Run Prompt` from the Command Palette, or via the play button when the file is open.
- Settings sync ships user prompts across machines via **Settings Sync: Configure**.

### Custom agents — file shape and migration

- **Filename rename (2026-05-13):** `.chatmode.md` → `.agent.md`. The doc explicitly says: *"If you have existing `.chatmode.md` files, rename them to `.agent.md` to convert them to the new custom agent format."* Functionality unchanged; terminology only.
- Workspace location: `.github/agents/` (Copilot) or `.claude/agents/` (Claude format). User-profile: `~/.copilot/agents/` or VS Code profile-specific.
- Frontmatter fields:
  ```yaml
  ---
  name: 'Display Name'
  description: 'What this agent does'
  argument-hint: 'optional input prompt'
  tools: ['name1', 'name2']         # available tools
  agents: ['subagent1', 'subagent2'] # accessible subagents
  model: 'gpt-5' | ['gpt-5', 'claude-opus-4'] # priority list
  user-invocable: true                # default true
  disable-model-invocation: false     # default false
  handoffs: [...]                     # sequential workflow transitions
  hooks: { ... }                      # scoped hooks (Preview, gated by chat.useCustomAgentHooks)
  ---
  ```
- Body is Markdown — system-prompt content for the agent.
- Settings: `chat.agentFilesLocations` (custom paths), `chat.useCustomizationsInParentRepositories` (monorepo discovery), `github.copilot.chat.organizationCustomAgents.enabled` (org-level), `chat.useCustomAgentHooks` (Preview, hooks inside agent frontmatter).

### Skills — file shape

- `SKILL.md` is the literal expected filename (capitalized), inside a directory whose name matches the skill's `name` frontmatter field. Plain kebab-case only — *"The name must be plain kebab-case without namespace prefixes (for example, `test-runner`, not `myorg/test-runner`)"*. Namespace-prefixed names cause silent load failures.
- Skills can ship inside plugins (under `skills/`) or live free-standing at `~/.copilot/skills/` / `~/.claude/skills/`. Identical loading rules to the CLI — see [the CLI doc, §8](./copilot-cli-plugin-system.md#8-agent--skill-loading-model).

### Hooks — file shape and events (Preview)

Hook files are JSON. Top-level shape:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "type": "command",
        "command": "...",
        "windows": "...",
        "linux": "...",
        "osx": "...",
        "cwd": "...",
        "env": { "KEY": "value" },
        "timeout": 30
      }
    ]
  }
}
```

**Supported events (verbatim from the docs):** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`.

**File-location probe order:**
1. Workspace (Copilot format): `.github/hooks/*.json`
2. Workspace (Claude format): `.claude/settings.json`, `.claude/settings.local.json`
3. User: `~/.copilot/hooks/`, `~/.claude/settings.json`
4. Custom-agent scope: `hooks` field in `.agent.md` frontmatter (Preview)
5. Plugin: `hooks.json` (Copilot format) or `hooks/hooks.json` (Claude format)

**Precedence:** *"Workspace hooks take precedence over user hooks for the same event type."* For `PreToolUse` permission decisions, the most restrictive wins (`deny` > `ask` > `allow`).

**Exit-code semantics — fail-open by default:**

| Exit code | Behavior |
|---|---|
| `0` | Success; stdout parsed as JSON. |
| `2` | Blocking error; processing stops, error shown to the model. |
| Other non-zero | Non-blocking warning; run continues. |

**Settings:** `chat.hookFilesLocations` (custom paths, supports `~` expansion), `chat.useCustomizationsInParentRepositories` (monorepo), `chat.useCustomAgentHooks` (Preview — enables `hooks` field in agent frontmatter).

**Hook event-name normalization:** VS Code accepts both Copilot CLI's lowerCamelCase (`preToolUse`) and PascalCase (`PreToolUse`); CLI-format hooks are normalized internally. The `bash` field is mapped to `osx`/`linux`; `powershell` maps to `windows`. The CLI's `matcher` syntax is parsed but ignored — all hooks run regardless of matcher values. Tool input fields use camelCase (`filePath`, not `file_path`).

### MCP servers — file shape

Workspace: `.vscode/mcp.json`. User: opened via `MCP: Open User Configuration` from Command Palette. Plugin-bundled: `.mcp.json` at plugin root, referenced from `plugin.json`'s `mcpServers` field.

```json
{
  "servers": {
    "server-name": {
      "type": "stdio" | "http",
      "command": "...",
      "args": ["..."],
      "env": { "KEY": "value" }
    }
  }
}
```

Note the top-level key is `servers` (VS Code workspace config) versus `mcpServers` (plugin manifest field and `.mcp.json` plugin format). Plugin-bundled MCP servers are *"implicitly trusted when you install the plugin"* — unlike workspace-defined servers which require an explicit trust dialog on first use.

---

## 2. Agent plugins — the distribution layer

Agent plugins are the VS Code equivalent of "install a bundle of customization with one click." Released in VS Code 1.110 (March 4, 2026) as a **Preview** feature. Gated by `chat.plugins.enabled`, which the docs note is *"managed at the organization level"* — organization admins can disable plugin support for managed installs.

A single plugin can bundle: slash commands, skills, custom agents, hooks, and MCP servers — i.e., every customization surface in §1 except the always-on instructions files.

### `plugin.json` schema — shared with Copilot CLI

The manifest format is the **same as Copilot CLI**. See [the CLI doc, §2](./copilot-cli-plugin-system.md#2-pluginjson-schema) for the authoritative schema. The fields VS Code reads, with the same defaults the CLI uses:

**Required:**
- `name` — kebab-case, max 64 chars, no slashes/colons/underscores/uppercase.

**Optional:**
- `description` (≤ 1024 chars), `version` (semver), `author` (object), `skills` (default `skills/`), `agents` (default `agents/`), `hooks` (path or inline object), `mcpServers` (path or inline object).

### Manifest probe order — multi-format compatibility

VS Code auto-detects plugin format by probing four locations in order:

1. `.plugin/plugin.json` (OpenPlugin format)
2. `plugin.json` (at root — Copilot format)
3. `.github/plugin/plugin.json`
4. `.claude-plugin/plugin.json` (Claude format)

**Plugin-root tokens for path references in hook commands and MCP configs:**
- Claude format: `${CLAUDE_PLUGIN_ROOT}` (also set as environment variable)
- OpenPlugin format: `${PLUGIN_ROOT}`
- Copilot format: **no root token defined in the VS Code docs.** *(Single-sourced from `code.visualstudio.com/docs/copilot/customization/agent-plugins`. The CLI reference docs show `%COPILOT_PLUGIN_ROOT%` is injected for hook scripts at CLI runtime — see [the CLI doc, §4](./copilot-cli-plugin-system.md#4-hook-script-invocation-contract) — but VS Code's docs are silent on whether the same variable is injected when VS Code runs the plugin's hooks. Confirm empirically.)*

### Install destinations — on disk

Plugins installed through VS Code's UI (Extensions view or `Chat: Install Plugin From Source`) land in OS-specific cache directories:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Code/agentPlugins/github.com/<org>/<repo>/` |
| Linux | `~/.config/Code/agentPlugins/github.com/<org>/<repo>/` |
| Windows | `%APPDATA%\Code\agentPlugins\github.com\<org>\<repo>\` |

Plugins installed via **Copilot CLI** at `~/.copilot/installed-plugins/<marketplace>/<plugin>/` are **auto-discovered by VS Code** and shown in the *Agent Plugins → Installed* view alongside VS-Code-installed plugins. Direct GitHub installs in `~/.copilot/installed-plugins/_direct/<source-id>/` are also picked up.

This cross-discovery means a single plugin install via Copilot CLI is enough to make the plugin available in both harnesses on the same machine — there is **no duplicate-install protocol** for users who run both. For the rad-orchestration installer, this is a meaningful difference from the CLI-only world: the CLI installer's deployment already populates `~/.copilot/installed-plugins/`, so a parallel VS Code install does not need to re-stage the plugin payload — only the workspace-level recommendation files.

### Distribution channels

| Channel | Mechanism |
|---|---|
| Default marketplaces | `copilot-plugins` (official) and `awesome-copilot` (community) are pre-configured; no setup needed. Browsable from Extensions view with `@agentPlugins` filter, or via `Chat: Plugins` from Command Palette. |
| Additional marketplaces | `chat.plugins.marketplaces` user setting — accepts shorthand `owner/repo`, HTTPS `.git` URLs, SSH `git@host:owner/repo.git`, or `file:///` URIs. **User-level only** — workspace/devcontainer settings for marketplaces are not honored. |
| Workspace recommendations | `extraKnownMarketplaces` and `enabledPlugins` fields in `.claude/settings.json` or `.github/copilot/settings.json`. These register marketplaces and pre-enable plugins automatically for team members opening the workspace. Notification surfaces *"the first time a chat message is sent."* |
| Direct from Git | `Chat: Install Plugin From Source` from Command Palette — accepts any Git URL. VS Code clones into the `agentPlugins` cache. |
| Local development | `chat.pluginLocations` user setting — maps absolute paths to boolean enabled/disabled. Used for in-place development without round-tripping through Git. |
| Via Copilot CLI | Plugins installed by `copilot plugin install …` appear in VS Code automatically — no separate install action needed. |

### VS Code Marketplace ≠ Copilot plugin marketplace

These are two distinct distribution systems and should not be conflated:

- **The Visual Studio Marketplace** (`marketplace.visualstudio.com`) ships traditional VS Code extensions — `.vsix` packages with a `package.json`, JavaScript activation, etc. The GitHub Copilot extension itself comes from here.
- **Copilot plugin marketplaces** (`copilot-plugins`, `awesome-copilot`, or custom catalogs) ship `plugin.json`-described bundles of skills/agents/hooks/MCP servers — purely declarative, no JavaScript code in the install payload.

VS Code surfaces Copilot plugins **through** the Extensions view (with the `@agentPlugins` filter), but they are not VS Code extensions — they are catalog entries hosted in Git repositories. An installer can ship a Copilot plugin without ever interacting with the Visual Studio Marketplace.

### Marketplace catalog source forms

VS Code reads marketplace catalogs from the same locations and shapes documented for Copilot CLI — see [the CLI doc, §6](./copilot-cli-plugin-system.md#6-marketplace-catalogs). The attested source forms (relative path, `source: github` object, Git URL) are the same. `source: npm` is **not** a documented form for VS Code Copilot agent plugins either.

---

## 3. Differences from Copilot CLI — what a porter must change

Most of the contract is shared. The differences that affect an installer adapter:

### Workspace-level configuration files

| Concern | CLI | VS Code |
|---|---|---|
| Plugin recommendations / marketplace registration | (no direct equivalent — users add marketplaces via `copilot plugin marketplace add`) | `.claude/settings.json` **or** `.github/copilot/settings.json` with `extraKnownMarketplaces` and `enabledPlugins` keys |
| Workspace hooks | `.github/hooks/*.json` (per docs) | `.github/hooks/*.json` (same) **plus** `.claude/settings.json` / `.claude/settings.local.json` recognized in Claude format |
| Workspace MCP | (project-local; out of CLI installer's typical scope) | `.vscode/mcp.json` with top-level `servers` key |
| Workspace instructions | `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` | Same — these are shared cross-harness conventions |

### Install destination

- **CLI:** `~/.copilot/installed-plugins/<marketplace>/<plugin>/` (or `_direct/<source-id>/` for direct installs). Single root, relocatable via `COPILOT_HOME`.
- **VS Code:** OS-specific `agentPlugins/github.com/<org>/<repo>/` paths (see §2). Per-OS, not relocatable via env var documented in the public docs.
- **Cross-discovery is one-way:** VS Code auto-imports plugins from `~/.copilot/installed-plugins/`. The CLI does **not** import plugins from VS Code's `agentPlugins/` cache. If you want a single install to serve both, install via the CLI.

### Hook event name casing

Both harnesses accept both casings, but their native preference differs:
- **CLI:** native is **camelCase** (`userPromptSubmitted`, `preToolUse`). PascalCase variants accepted.
- **VS Code:** native is **PascalCase** (`UserPromptSubmit`, `PreToolUse`). camelCase from CLI hook files is normalized at load. Note also the CLI uses `userPromptSubmitted` (past tense) while VS Code uses `UserPromptSubmit` (imperative) — be careful with mixed casing.

### Hook platform-specific command fields

| Field | CLI | VS Code |
|---|---|---|
| Cross-platform default | `command` | `command` |
| POSIX | `bash` | `linux`, `osx` (separate fields) |
| Windows | `powershell` | `windows` |

VS Code maps a CLI-format `bash` field to **both** `osx` and `linux`, and `powershell` to `windows`, so cross-harness hooks remain portable in the dominant case. Authoring fresh hooks for VS Code uses the four-field shape (`command` / `windows` / `linux` / `osx`).

### Hook input field naming

Both harnesses use camelCase in the stdin JSON payload (`filePath`, not `file_path`). CLI also offers a PascalCase variant (with `hook_event_name` and ISO-8601 timestamps) for VS-Code-compatible hooks — see the CLI doc.

### Timeout field

- **CLI:** `timeoutSec` (default 30).
- **VS Code:** `timeout` (default 30, same unit — seconds).

### CLI marketplace `matcher` field

The CLI hook entries can include a `matcher` field to scope to specific tools. **VS Code parses but ignores `matcher`** — all hooks run regardless of value. For installers targeting VS Code primarily, do not depend on matcher-based scoping.

### Preview gating

- **CLI:** Plugins and hooks both ship as documented GA features.
- **VS Code:** Agent plugins are **Preview** (`chat.plugins.enabled`), agent hooks are **Preview**, agent-scoped hooks (in `.agent.md` frontmatter) are also Preview behind `chat.useCustomAgentHooks`. The Agent Customizations editor is Preview.

### Plugin-root environment variable

- **CLI:** `%COPILOT_PLUGIN_ROOT%` is empirically injected into every hook process, along with `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_DATA`, `COPILOT_PROJECT_DIR`. See [the CLI doc, §4](./copilot-cli-plugin-system.md#4-hook-script-invocation-contract).
- **VS Code:** `${CLAUDE_PLUGIN_ROOT}` is documented for Claude-format plugins and is also set as an environment variable. `${PLUGIN_ROOT}` is documented for OpenPlugin format. For **Copilot-format** plugins, no root token is documented and the env-var injection behavior is unstated. **Single-sourced gap — confirm empirically before depending on either token in a Copilot-shape plugin run inside VS Code.**

### What the installer cares about, end-to-end

For an installer adapter shipping into a workspace:

1. **Plugin payload itself** — if installed via Copilot CLI, VS Code auto-discovers it; no second copy needed. If installed only via VS Code, the user only gets it in VS Code, not CLI. The cleanest single-install strategy is the CLI path.
2. **Workspace recommendations** — to surface the plugin to teammates, write `.claude/settings.json` or `.github/copilot/settings.json` with `extraKnownMarketplaces` + `enabledPlugins`.
3. **Workspace instructions / agents / prompts / hooks** — these go to the standard `.github/` (or `.claude/`) locations and are shared cross-harness; the existing installer paths apply unchanged.
4. **MCP servers** — `.vscode/mcp.json` is the workspace config path (note: VS-Code-specific, not shared).
5. **No top-level `settings.json` writes** — the rad-orchestration installer policy (no top-level instruction files, no settings files) still holds; the workspace settings file is the user's, not ours.

---

## 4. Stability snapshot (2026-05-19)

| Surface | Status | Source signal |
|---|---|---|
| `copilot-instructions.md` | GA | No preview disclaimer in current docs. |
| `*.instructions.md` (with `applyTo`) | GA | Same. |
| `AGENTS.md` (root) | GA | Toggled by `chat.useAgentsMdFile`. |
| `AGENTS.md` (nested) | Experimental | `chat.useNestedAgentsMdFiles` flagged experimental. |
| `CLAUDE.md` | GA | Toggled by `chat.useClaudeMdFile`. |
| `.prompt.md` files | GA | No preview marker. |
| Custom agents (`.agent.md`) | GA | Documentation rename completed 2026-05-13; functionality unchanged from prior `.chatmode.md` GA. |
| Skills | GA | Same plugin reference applies to standalone skills. |
| Agent hooks | **Preview** | *"Agent hooks are currently in Preview. The configuration format and behavior might change in future releases."* |
| Agent-scoped hooks (in `.agent.md`) | **Preview** | Gated by `chat.useCustomAgentHooks`. |
| MCP server core | GA | Long-running stable feature. |
| MCP sandbox / auto-discovery extensions | Experimental | Specific sub-features flagged. |
| Agent plugins | **Preview** | Released VS Code 1.110 (March 4, 2026); `chat.plugins.enabled` gates support and is org-controllable. |
| Agent Customizations editor (UI) | **Preview** | Explicitly labeled. |

Re-verify Preview/Experimental surfaces before relying on them in a shipping installer.

---

## 5. What we don't know yet

These are gaps where docs are silent, single-sourced, or contradictory enough that a smoke test against a throwaway plugin (or a recent VS Code Insiders build) is the right next step before locking installer design.

1. **`%COPILOT_PLUGIN_ROOT%` / `${CLAUDE_PLUGIN_ROOT}` injection for Copilot-format plugins running inside VS Code.** The VS Code docs document the variable for Claude-format plugins and silent for Copilot-format. Empirical check: drop a `Copilot`-format plugin with a hook that runs `node -e "console.log(process.env)"`, observe what's injected.
2. **Whether `chat.plugins.marketplaces` honors workspace-scoped values.** Documentation says marketplaces must be configured at "user-level preferences" — but multiple sources contradict on whether workspace `extraKnownMarketplaces` is equivalent. Confirm by trying both.
3. **Plugin update / reload semantics inside VS Code.** The CLI docs are clear that "to pick up changes made to a local plugin install it again" and hooks reload at session start. VS Code's docs do not explicitly state whether reopening the workspace, restarting VS Code, or signing out/in is required to pick up a plugin change. Live edit behavior under `chat.pluginLocations` (local dev) is also unstated.
4. **Hook stdin payload casing inside VS Code when the hook comes from a CLI-shaped plugin.** Docs say tool input uses camelCase; what's unclear is whether the *event name* and timestamp formats follow the source plugin's convention or VS Code's PascalCase normalization.
5. **Org-level `chat.plugins.enabled` enforcement.** If an enterprise admin disables plugins via org policy, what happens to a workspace that recommends plugins via `extraKnownMarketplaces`? Silent skip, blocked load, warning? Affects fallback design for enterprise users.
6. **`.github/copilot/settings.json` vs `.claude/settings.json` precedence.** Both are documented as workspace recommendation locations. Behavior when both exist is unspecified.
7. **The VS Code-shipped plugin install does NOT auto-populate `~/.copilot/installed-plugins/`.** Plugin discovery is one-way (CLI → VS Code), not bidirectional. Whether this is by design or a current limitation is not stated; the installer adapter should not depend on the reverse direction.
8. **Whether `chat.plugins.marketplaces` accepts file:// URIs to local-only catalog repos** for offline / GHES-air-gapped scenarios. Mentioned in passing in some sources but not confirmed in the canonical docs.

---

## 6. Reference URLs

### Customization overview
- https://code.visualstudio.com/docs/copilot/customization/overview
- https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- https://code.visualstudio.com/docs/copilot/customization/prompt-files
- https://code.visualstudio.com/docs/copilot/customization/custom-agents
- https://code.visualstudio.com/docs/copilot/customization/mcp-servers
- https://code.visualstudio.com/docs/copilot/customization/hooks

### Agent plugins (Preview)
- https://code.visualstudio.com/docs/copilot/customization/agent-plugins
- https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/agent-plugins.md
- https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/hooks.md

### Agents in VS Code
- https://code.visualstudio.com/docs/copilot/agents/overview
- https://code.visualstudio.com/docs/copilot/agents/agents-window
- https://code.visualstudio.com/docs/copilot/agents/agent-tools
- https://code.visualstudio.com/docs/copilot/agents/copilot-cli

### Release notes / changelog
- https://code.visualstudio.com/updates/v1_110 — agent plugins ship (March 4, 2026)
- https://developer.microsoft.com/blog/awesome-github-copilot-just-got-a-website-and-a-learning-hub-and-plugins — Awesome Copilot becomes default marketplace (March 16, 2026)

### GitHub Docs (Copilot side)
- https://docs.github.com/en/copilot/get-started/features
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks

### Community syntheses (cross-check)
- https://www.kenmuse.com/blog/creating-agent-plugins-for-vs-code-and-copilot-cli/ — direct VS Code vs CLI comparison
- https://chris-ayers.com/posts/agent-skills-plugins-marketplace/ — skills/plugins/marketplace combined view
- https://awesome-copilot.github.com/learning-hub/installing-and-using-plugins/ — Awesome Copilot learning hub install walkthrough

### Live examples / catalogs
- https://github.com/github/copilot-plugins — official default marketplace
- https://github.com/github/awesome-copilot — community default marketplace, also a Copilot CLI marketplace
- https://github.com/planetscale/vscode-agent-plugin — third-party plugin example (MCP server + skills)

### Known issues worth tracking
- https://github.com/microsoft/vscode/issues/305168 — agent plugin skill files inaccessible from WSL/SSH remote
