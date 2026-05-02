# `claude` — Claude Code Adapter

This adapter targets [Claude Code](https://code.claude.com) (Anthropic CLI). Because the
orchestration system's canonical format _is_ the Claude Code format, every capability surface
here is an identity transform — no translation required.

## Grounding

All harness specifics are sourced from `frontmatter-research.md`:

| Capability surface | Research section |
|---|---|
| `filenameRule` — agent: `<name>.md`, skill: `SKILL.md` (literal) | §1.A (filename pattern row), §1.B (filename pattern row) |
| `agentFrontmatter` — identity (canonical = Claude shape) | §1.A (required + optional frontmatter) |
| `skillFrontmatter` — identity; preserves `rad-*` prefix | §1.B (frontmatter table) |
| `toolDictionary` — PascalCase names map to themselves | §1.A (tools field, PascalCase list) |
| `modelAliases` — `haiku`→`haiku`, `sonnet`→`sonnet`, `opus`→`opus` | §6.6 (Claude column, row 1) |

## Target directory

`.claude` — agents land at `.claude/agents/<name>.md`, skills at `.claude/skills/<name>/SKILL.md`.

## Notes

- `toolDictionary` includes the `Agent` alias (synonym for `Task`) in addition to the ten tools
  exercised in the test suite, for completeness.
- `modelAliases` exposes only the three tier aliases (`haiku`, `sonnet`, `opus`). Fully-qualified
  model IDs are passed through unchanged by the harness runner and do not require mapping here.
