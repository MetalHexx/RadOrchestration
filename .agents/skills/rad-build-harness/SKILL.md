---
name: rad-build-harness
description: 'Refresh the local dogfood harness for a contributor by running the matching npm build script. Use when asked to "build the harness", "rebuild .claude", "refresh the copilot bundle", "run the adapter build", or after editing canonical agents/ or skills/ at repo root. Asks which harness to target (claude-code / copilot-vscode / copilot-cli / all) and runs npm run build:<harness> from repo root.'
---

# rad-build-harness

A contributor convenience for refreshing the local dogfood harness after edits to canonical `agents/` or `skills/` at the repo root. Asks which harness to build, runs the matching npm script, and surfaces the result.

## When to Use This Skill

- After editing canonical `agents/` or `skills/` and the harness needs to pick up the changes.
- Right after a fresh clone, before launching Claude Code or any Copilot harness against the repo.
- When switching the contributor's working harness (e.g., from Claude Code to Copilot CLI).
- When the runtime harness folder (`.claude/` or `.github/agents/` and `.github/skills/`) looks stale or out of sync with `agents/` and `skills/`.

## Prerequisites

- Node.js installed (the build CLI uses Node built-ins — no `npm install` required).
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).

## Workflow

### 1. Resolve repo root

The build CLI must run from repo root. Resolve it with:

```bash
git rev-parse --show-toplevel
```

Use that as the cwd for the build command in step 4.

### 2. Ask which harness

Use `AskUserQuestion` with these four options:

| Label | Description |
|-------|-------------|
| `claude-code` | Builds into `.claude/` for Claude Code. |
| `copilot-vscode` | Builds into `.github/agents/` and `.github/skills/` for GitHub Copilot in VS Code. |
| `copilot-cli` | Builds into `.github/agents/` and `.github/skills/` for GitHub Copilot CLI. |
| `all` | Runs every adapter sequentially. |

### 3. Map the answer to an npm script

| Answer | Command |
|--------|---------|
| `claude-code` | `npm run build:claude` |
| `copilot-vscode` | `npm run build:copilot-vscode` |
| `copilot-cli` | `npm run build:copilot-cli` |
| `all` | `npm run build:all` |

Note: the npm script for Claude is `build:claude`, not `build:claude-code`.

### 4. Run the build

Invoke the chosen command from repo root via the Bash tool.

### 5. Report the result

On success, surface the one-line per-harness output the build CLI prints, e.g.:

```
Built claude: 12 agents, 18 skills → .claude/
```

On failure, surface the exit code and the error output verbatim — do not paper over a non-zero exit.

## Verbose mode

If a contributor wants to see every file the adapter emits, set `BUILD_VERBOSE=1`:

```bash
BUILD_VERBOSE=1 npm run build:claude
```

This is sourced by `adapters/run.js` and prints one line per emitted file.
