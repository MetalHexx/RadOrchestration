# `_template` — Adapter Scaffold

Copy this folder to `adapters/<harness-name>/` to add a new harness. The leading
underscore tells the discovery walker (`adapters/discover.js`) to skip this
folder so it is never built or shipped.

Every adapter implements the five capability surfaces declared in
`adapters/types.d.ts`:

1. `filenameRule({kind, canonicalName})` — emit the harness-specific output filename
2. `agentFrontmatter(canonical)` — project canonical agent frontmatter
3. `skillFrontmatter(canonical)` — project canonical skill frontmatter
4. `toolDictionary` — Claude PascalCase tool names → harness tool vocabulary
5. `modelAliases` — `{haiku, sonnet, opus}` → harness model id

## Grounding

Every per-harness specific (filename, frontmatter, tool aliases, model strings)
must be sourced from `frontmatter-research.md`. The README of every concrete
adapter under `adapters/` MUST cite the specific section that grounds each
capability surface. Do not invent harness behavior — if the research has a
gap, escalate per the research-uncertainty resolution policy in the
Brainstorming doc before shipping.

## Tests

Each adapter ships unit tests covering each capability surface in its own
folder (no shared test fixtures). See `adapter.test.js` for the surface list
every adapter test file must exercise.
