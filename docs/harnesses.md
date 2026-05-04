# Harnesses

The orchestration system runs inside AI coding assistants — referred to here as harnesses. This page covers per-harness install, the slash-command surface that works across all supported harnesses, and honest per-harness gotchas. Where a feature works on one harness and not another, this page says so.

## Compatibility

| Harness | Install / entry point | Status | Dashboard launch |
|---|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` then run `claude` in your repo | Supported | Yes |
| GitHub Copilot in VS Code | Install the GitHub Copilot extension; enable agent mode | Supported | Coming soon |
| GitHub Copilot CLI | Install per GitHub instructions; run the Copilot CLI binary | Supported | Coming soon |

More coming soon.

## Per-Harness Install and Entry Points

### Claude Code

Install the CLI globally:

```bash
npm install -g @anthropic-ai/claude-code
```

Then open a terminal in your repository root and run:

```bash
claude
```

Slash commands appear directly in the Claude Code conversation prompt. Type `/` to see available commands.

### Copilot VS Code

Install the GitHub Copilot extension from the VS Code Marketplace. In VS Code settings, enable **agent mode** for Copilot Chat. Once agent mode is active, open the Copilot Chat panel, switch to agent mode, and type slash commands in the chat input.

### Copilot CLI

Install the GitHub Copilot CLI following the [GitHub instructions](https://docs.github.com/en/copilot/github-copilot-in-the-cli). Navigate to your repository root and launch the Copilot CLI binary. Slash commands are entered at the CLI prompt.

## Slash-Command Surface

The same six slash commands work on every supported harness:

- `/rad-brainstorm`
- `/rad-plan`
- `/rad-plan-quick`
- `/rad-execute`
- `/rad-execute-parallel`
- `/rad-configure-system`

Behavior is the same in every harness with one notable per-harness difference in `/rad-execute-parallel`. That command runs the plan in a dedicated worktree and branch. How a new session is opened for the worktree depends on the harness:

- **Claude Code** — launches a fresh `claude` session pointed at the new worktree directory.  Your project will automatically start executing.
- **Copilot VS Code** — opens a new VS Code window for the worktree.
  - The project will not automatically execute in vscode.  You can start the project by typing `/rad-execute <PROJECT-NAME>`
- **Copilot CLI** — opens a new terminal session in the worktree directory.  Your project will automatically start executing.

## Per-Harness Gotchas

- **`/rad-execute-parallel <PROJECT-NAME>` session launch differs per harness.** See the Slash-Command Surface section above for the exact behavior. If the new window or session does not open automatically, navigate to the worktree directory manually and launch the harness there.
- **Copilot VS Code requires agent mode.** Standard Copilot Chat mode does not expose slash-command routing; agent mode is required. If a slash command appears unrecognized, confirm agent mode is enabled.
- **Copilot CLI path setup.** The CLI binary must be on your `PATH`. If commands are not found after installation, restart your terminal or add the install location to `PATH` manually.
- **Claude Code session persistence.** Claude Code sessions are single-window. If you close the window mid-execution, re-run `/rad-execute <PROJECT-NAME>` from a new session; the pipeline resumes from where it left off.

## Launch from the Dashboard

The dashboard's Launch projects feature can start brainstorming, planning, and execution by launching a Claude Code session with the right slash command. That surface is currently Claude-Code-only — parity for Copilot VS Code and Copilot CLI is coming soon. For the full description, see the Launch-projects feature on [dashboard.md](dashboard.md).
