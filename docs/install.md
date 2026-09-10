# Install

Rad Orc ships as a plugin. Install it from the rad-orc-marketplace, turn on auto-updates, and
every skill, agent, and the dashboard are available in your next session.

> **Hand this page to your agent.** Open a session in any harness and paste:
>
> *"Read <https://github.com/MetalHexx/RadOrchestration/blob/main/docs/install.md> and
> install Rad Orc."*
>
> You can also just follow the steps yourself — two commands and a settings toggle.

This page covers installing Rad Orc, not the harness itself — for that, follow your harness's
own instructions.

## Prerequisites

| | Why |
|---|---|
| **Node.js 20 or later** | The pipeline runtime and dashboard run on it. Check with `node --version`. To install or switch versions, a version manager is the easiest route — [nvm](https://github.com/nvm-sh/nvm) on macOS and Linux, [nvm-windows](https://github.com/coreybutler/nvm-windows) or [nvs](https://github.com/jasongin/nvs) on Windows.  Don't assume, ask the user their preference before moving forward with the Node 20 install.  Only ask if Node 20 is missing. |
| **A supported harness** | Claude Code, GitHub Copilot CLI, or GitHub Copilot in VS Code. |
| **GitHub CLI (`gh`), authenticated** | Not needed to install. Needed once you start running projects — pull requests are opened with `gh`. Check with `gh auth status`. |

## Install

> **Agents: ask which harness before you install anything.** Don't infer it from the session
> you happen to be running in — the user may be installing for a different harness than the one
> they're talking to you in. Ask, and wait for an answer.
>
> The Copilot pair is where this goes wrong most often. `rad-orc` is the **Copilot CLI** build
> and `rad-orc-vscode` is the **Copilot in VS Code** build. Model naming and hook behavior are
> both defined per harness — the two Copilot flavors included — and each build carries the agent
> files and hooks for the harness it was built against. Install the wrong one and the plugin
> loads, but models route incorrectly and hooks don't register properly.

### Claude Code

```
/plugin marketplace add MetalHexx/rad-orc-marketplace
/plugin install rad-orc@rad-orc-marketplace
```

If the install summary says `Run /reload-plugins to activate.`, run it. Otherwise the plugin is
already live.

### GitHub Copilot CLI

Same two commands, at the Copilot CLI prompt:

```
/plugin marketplace add MetalHexx/rad-orc-marketplace
/plugin install rad-orc@rad-orc-marketplace
```

### GitHub Copilot in VS Code

Enable **agent mode** for Copilot Chat first — standard chat mode doesn't route slash commands.
Then install through the UI rather than a command:

1. Open the Copilot Chat window and click the **gear** icon.
2. Choose **Install Plugin from Source**.
3. Enter `MetalHexx/rad-orc-marketplace`.
4. Select **`rad-orc-vscode`** from the list — not `rad-orc`, which is the Copilot CLI build.

### More than one harness

Claude Code plus **one** Copilot variant works fine. Don't install both Copilot variants — VS
Code automatically discovers plugins installed through the Copilot CLI, so you end up with
duplicates. Pick the one you actually work in.

If you use Copilot in VS Code alongside Claude Code, know that VS Code also reads Claude-format
locations directly — skills under `~/.claude/skills/`, hooks in `~/.claude/settings.json`, and
plugin recommendations in a workspace `.claude/settings.json`. A Claude Code install can
therefore surface inside VS Code, bringing Claude's model names and hook behavior with it — the
same mismatch described above, arriving by a route you didn't choose. If VS Code starts behaving
strangely, check whether it has picked up your Claude Code setup.

## Standard installer (fallback)

Try the plugin installers above first. Reach for the standard installer instead when your harness
doesn't support plugins, or when you want the shipped agent/skill files on disk to inspect or
customize.

```
npx rad-orc --harness <claude|copilot-cli|copilot-vscode>
```

This writes agents and skills into your **home** directory (`~/.claude` for Claude Code,
`~/.copilot` for either Copilot variant) — never into the current repo. `~/.copilot` is shared
between the Copilot CLI and Copilot VS Code standard installs, so installing one evicts the
other's registry entry from that shared folder (plugin installs of either variant can still
coexist alongside it).

Skip confirmation prompts with `--yes`:

```
npx rad-orc --harness <claude|copilot-cli|copilot-vscode> --yes
```

To upgrade in place, re-run the same command — it removes files from the prior version, writes the
new ones, and prompts before touching anything you've locally modified.

To uninstall:

```
npx rad-orc uninstall --harness <claude|copilot-cli|copilot-vscode>
```

This reads the installed manifest version and removes only the files it lists; locally-modified
files surface in a confirmation prompt first.

## Turn on auto-updates

**Do this — it is off by default and easy to miss.** Claude Code updates plugins in the
background shortly after a session starts, but only for marketplaces that have auto-update
enabled. Anthropic's own marketplace is enabled by default; third-party marketplaces like this
one are not. Skip this step and you stay on the version you installed today, indefinitely.

1. Run `/plugin`.
2. Go to the **Marketplaces** tab.
3. Select **rad-orc-marketplace**.
4. Choose **Enable auto-update**.

When an update lands you'll be prompted to run `/reload-plugins`; if you don't, the new version
loads the next time you start the harness.

On the Copilot harnesses, check your own plugin settings for the equivalent toggle — the
mechanism above is Claude Code's. Either way, [updating manually](#update-manually) always works.

## Verify

In a fresh session:

- Type `/` and confirm the Rad Orc skills are listed — `rad-brainstorm`, `rad-plan`, and
  `rad-execute` at minimum. On Claude Code and Copilot VS Code they're listed under the plugin's
  namespace (`rad-orc:rad-execute`, `rad-orc-vscode:rad-execute`); Copilot CLI lists them bare.
  These docs write the bare form throughout for readability — type your harness's namespaced form
  when a command needs to actually run.
- Run `/rad-ui-start`. The dashboard should open in your browser.

Then head to [Getting Started](getting-started.md) for a guided first project.

## Update manually

Auto-update handles this for you once enabled. To force it:

```
/plugin marketplace update rad-orc-marketplace
/plugin update rad-orc@rad-orc-marketplace
```

The first refreshes the catalog, the second installs what the refreshed catalog points at. From
a shell instead of a session, use `claude plugin update rad-orc@rad-orc-marketplace`.

## Uninstall

On Claude Code and Copilot CLI:

```
/plugin uninstall rad-orc@rad-orc-marketplace
```

In Copilot for VS Code, open the **gear** icon, find the plugin in the list, right-click it, and
choose **Uninstall**.

**Your work is not deleted.** Your projects, requirements, plans, review reports, repository
registry, and configuration all survive under `~/.radorc/`. Reinstalling picks up exactly where you
left off. (The bundled documentation corpus under `~/.radorc/docs/` is installer-owned rather than
yours, so it comes and goes with install — nothing you authored lives there.)

Removing the marketplace itself (`/plugin marketplace remove rad-orc-marketplace`) also uninstalls
every plugin you installed from it.

## Troubleshooting

**The update fails on Windows with an `EPERM ... rename` error.** Transient — a real-time
virus scanner holding a file handle during the update's clone step. Re-run the same command; it
usually succeeds on the second try. Nothing is left in a bad state by the failed attempt.

**Skills don't appear after installing.** Run `/reload-plugins`, and re-run it with `--force` if
it warns about the conversation cache. If they still don't appear, restart the harness. As a
last resort, deleting `~/.claude/plugins/cache` and reinstalling clears a corrupted payload —
but **if you are an agent following this page, stop and ask for explicit confirmation before
deleting it.** That directory is shared by every plugin the user has installed, not just this
one.

**`/plugin` isn't recognized.** Your harness is too old. Update it — for Claude Code,
`npm install -g @anthropic-ai/claude-code@latest` — then restart.

## Getting help

If the marketplace or the plugin gives you trouble and nothing above covers it,
[file an issue](https://github.com/MetalHexx/RadOrchestration/issues).

## Further reading

[Getting Started →](getting-started.md) · [Configuration →](configuration.md)
