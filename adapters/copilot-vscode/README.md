# `copilot-vscode` — GitHub Copilot in VS Code Adapter

Target harness: **GitHub Copilot in VS Code** (`.agent.md` agent files,
`SKILL.md` skill files).
Target folder at repo root: `.github/` (gitignored, dogfood-only).

## Capability surfaces — sources

| Surface | Grounded in `frontmatter-research.md` |
|---|---|
| Filename rule (`<name>.agent.md` for agents, `SKILL.md` for skills) | §2.A and §2.B |
| Agent frontmatter projection (lowercase tools, `(copilot)`-suffixed model, `target: vscode`) | §2.A |
| Skill frontmatter projection (pass-through; `allowed-tools` emitted but ignored) | §2.B and §6.2 |
| Tool-name dictionary (PascalCase → lowercase aliases) | §2.A "Tool naming convention" and §5.5 |
| Model alias map (`(copilot)`-suffixed display names) | §6.6 |

## Behavior notes

- **`allowed-tools` is emitted but VS Code silently ignores it** (§6.2). The
  field is preserved for cross-harness portability — Copilot CLI reading the
  same `SKILL.md` honors it. Tool restrictions for VS Code are governed by
  the parent agent's `tools:` array.
- **Model strings use the `(copilot)`-suffixed display name** (§6.6). VS
  Code's resolver tries the verbatim string first and strips the trailing
  `(...)` on fallback, so the suffix is tolerated and unambiguously
  identifies the Copilot-hosted variant when the same model name is offered
  by multiple vendors.
- **`target: vscode` is added to agent frontmatter** (§2.A). This restricts
  the agent to the VS Code environment so a single `<name>.agent.md` file
  shipped into both `.github/agents/` (CLI target dir) and a VS Code
  workspace doesn't double-fire.
- **`rad-*` skill names are preserved** unchanged — VS Code does
  not auto-namespace plugin-installed skills (§6.1).
