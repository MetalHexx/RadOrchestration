# FUTURE-HARNESSES — Adapter Interface Validation Memo

This memo validates the v1 adapter interface (the five capability surfaces in
`types.d.ts`) against OpenCode and Cursor by walking each surface for each
harness. **No code lands here** — this is a design memo. If a surface
cannot be expressed in the v1 interface, that's flagged as a v1 interface
change.

Sources: per-harness specifics for OpenCode are grounded in
`frontmatter-research.md` §4 (agent + skill format), §5 (matrix), §6.6
(model aliases). Cursor is the explicit research gap (no §-coverage) — the
memo names the open questions rather than guessing.

## OpenCode

| Capability surface | OpenCode shape | Source |
|---|---|---|
| Filename rule | `<name>.md` for agents (no `.agent.md` qualifier); `SKILL.md` literal for skills | §4.A and §4.B |
| Agent frontmatter projector | Map canonical `model: opus` → `model: anthropic/claude-opus-4-7`; `tools:` PascalCase comma-string → object form `{bash: true, edit: true}` (§4.A "Tool naming convention"); `mode: subagent` for non-primary agents | §4.A and §6.6 (OpenCode column) |
| Skill frontmatter projector | Pass-through `name`, `description`, optional `license` / `compatibility` / `metadata`; drop `allowed-tools`, `disable-model-invocation`, `user-invocable`, `arguments`, `model` (not honored per §4.B) | §4.B and §5.3 |
| Tool-name dictionary | All-lowercase: `Read→read`, `Write→write`, `Edit→edit`, `Bash→bash`, `Grep→grep`, `Glob→glob`, `TodoWrite→todowrite`, `WebFetch→webfetch`, `WebSearch→websearch`, `Task→task` | §4.A and §5.5 (OpenCode column) |
| Model alias map | `provider/<api-id>` form: `haiku → anthropic/claude-haiku-4-5`, `sonnet → anthropic/claude-sonnet-4-6`, `opus → anthropic/claude-opus-4-7` | §6.6 (OpenCode column) |

**Verdict:** the v1 interface accommodates OpenCode without any change.
Adding OpenCode is a `adapters/opencode/` folder drop-in.

## Cursor

Cursor is **not covered** by `frontmatter-research.md`. Adding Cursor at the
research stage is a prerequisite to authoring an `adapters/cursor/` adapter.
The open questions a Cursor research pass must answer are:

| Capability surface | Open question |
|---|---|
| Filename rule | What filename pattern do Cursor agents and skills use? Is it `.agent.md` like Copilot, `.md` like Claude/OpenCode, or a Cursor-specific convention? |
| Agent frontmatter projector | Which canonical fields does Cursor honor? Does it have an equivalent of `target:`, `tools:`, `model:`? |
| Skill frontmatter projector | Does Cursor honor the Agent Skills `SKILL.md` standard? If so, which fields beyond `name` / `description`? |
| Tool-name dictionary | What is Cursor's tool vocabulary? PascalCase like Claude, lowercase aliases like Copilot/OpenCode, or its own convention? |
| Model alias map | Which model identifier format does Cursor accept? Does it accept Claude API ids, vendor-suffixed display names, or its own format? |

**Verdict:** the v1 interface is presumed sufficient for Cursor, but the
presumption can only be confirmed once §-coverage exists. Until then, the
`Cursor (coming soon)` wizard option remains aspirational and disabled
(per the Brainstorming Goal 3 rationale).

## Conclusion

No v1 interface change is required for either harness. OpenCode is a clean
drop-in once anyone wants to author the adapter; Cursor is gated on a
research pass, not an interface gap. The five capability surfaces remain
the right level of abstraction.
