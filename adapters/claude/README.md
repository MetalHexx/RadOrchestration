# `claude` — Claude Code Adapter (Identity Transform)

Target harness: **Claude Code** (Anthropic CLI).
Target folder at repo root: `.claude/` (gitignored, dogfood-only).

Canonical authoring shape *is* Claude shape, so this adapter is an identity
transform on every capability surface. It exists to (a) prove the adapter
interface, (b) give the build script symmetry across harnesses, and (c) emit
the per-file metadata stream alongside the bundle for MULTI-HARNESS-2's
reconciliation system to consume.

## Capability surfaces — sources

| Surface | Grounded in `frontmatter-research.md` |
|---|---|
| Filename rule (`<name>.md` for agents, literal `SKILL.md` for skills) | §1.A and §1.B |
| Agent frontmatter projection (identity) | §1.A |
| Skill frontmatter projection (identity) | §1.B |
| Tool-name dictionary (Claude PascalCase → identity) | §1.A "Optional frontmatter — `tools`" and §5.5 row 1 |
| Model alias map (`haiku` / `sonnet` / `opus`) | §1.A "Optional frontmatter — `model`" and §6.6 Claude column |

## What this adapter does NOT do

- Does not transform the body of agents or skills.
- Does not modify or rename `rad-*` skills.
- Does not ship `settings.json` or any top-level instructions.
