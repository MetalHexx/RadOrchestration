# `copilot-cli` — GitHub Copilot CLI Adapter

Target harness: **GitHub Copilot CLI** (`copilot` standalone CLI).
Target folder at repo root: `.github/` (gitignored, dogfood-only).

## Capability surfaces — sources

| Surface | Grounded in `frontmatter-research.md` |
|---|---|
| Filename rule (`<name>.agent.md` for agents, `SKILL.md` for skills) | §3.A and §3.B |
| Agent frontmatter projection (lowercase tools, dot-versioned model id, single-string model) | §3.A |
| Skill frontmatter projection (`allowed-tools` honored — `shell`, `bash`) | §3.B |
| Tool-name dictionary (PascalCase → lowercase aliases — same alias system as VS Code) | §3.A and §5.5 |
| Model alias map (`claude-haiku-4.5`, `claude-sonnet-4.6`, `claude-opus-4.7`) | §6.6 |

## Behavior notes

- **`model:` MUST be a single string, never an array.** The CLI rejects
  array syntax (research §3.A, [copilot-cli #2133](https://github.com/github/copilot-cli/issues/2133)).
  The adapter coerces an array model field to its first element before
  tier-alias resolution.
- **Display-name form is rejected.** Passing `"Claude Opus 4.7 (copilot)"`
  to the CLI yields the warning `"<name> is not available; will use current
  model instead"` ([copilot-cli #1752](https://github.com/github/copilot-cli/issues/1752),
  [#2099](https://github.com/github/copilot-cli/issues/2099)). The adapter's
  tier-alias map produces the dot-versioned hyphenated form the CLI accepts.
- **No `target:` field is injected.** Research §3.A documents
  `target: github-copilot`, but the CLI and VS Code adapters both target
  `.github/agents/<name>.agent.md` and the file contents are otherwise
  identical — the runtime difference lives in the model alias map (e.g.
  `claude-opus-4.7` here vs. `Claude Opus 4.7 (copilot)` for VS Code) and
  the tool dictionary, not in a frontmatter discriminator. The adapter
  implementation and `adapter.test.js` deliberately omit the field; this
  section reflects the shipped projection.
- **`rad-*` skill names are preserved** unchanged — the CLI does
  not auto-namespace skills installed outside of plugins (§6.1).
