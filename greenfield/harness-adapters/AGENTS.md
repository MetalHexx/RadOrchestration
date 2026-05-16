# Harness-Adapters Subsystem

## Purpose

The harness-adapters subsystem provides harness-blind translation from canonical source agents and skills (in `harness-files/`) to per-harness-adapted output (in `output/<adapter.name>/`). It abstracts the differences between AI coding harnesses—Claude Code, GitHub Copilot in VS Code, GitHub Copilot CLI—so that a single canonical agent and skill source can be deployed to all harnesses with per-harness filename, frontmatter, and body-token transformations.

## How the Engine Works

The translation engine operates in three phases:

1. **Adapter Discovery** — Walk the `adapters/` directory to enumerate registered harnesses. Each adapter declares a harness name (e.g., `claude`, `copilot-vscode`).
2. **Single-Pass Translation** — For each adapter, iterate once through all agents and skills in the canonical `harness-files/` source. For each agent or skill, apply the adapter's filename, frontmatter, and body-token transformations.
3. **Output Writing** — Write translated artifacts to `output/<adapter.name>/` mirroring the source directory structure. The engine clears each adapter's output subtree before writing, ensuring no stale files persist across runs.

No caching, no intermediate manifests, no destination-shaped artifacts: the engine produces harness-shaped files only.

## Adapter Contract

Each adapter must export exactly three fields. No tool dictionary, no model alias map, no frontmatter projector, no custom destination logic, no manifest emitter.

- **`name`** (string) — The harness identifier (e.g., `"claude"`, `"copilot-vscode"`). Used as the output subdirectory name under `output/`.
- **`filenames`** (object) — Maps content kinds to template strings containing the canonical-name substitution token `{name}`. Keys are **content kinds** (`agent`, `skill`); values are **template strings** where `{name}` is replaced with the canonical agent or skill name when writing output. Example: `{ agent: '{name}.md', skill: 'SKILL.md' }`. The engine substitutes `{name}` with the canonical agent or skill name when writing files to the output directory.
- **`bodyTokens`** (object) — A flat string-to-string substitution map applied to body text after frontmatter substitution. Day-one adapters declare `bodyTokens: {}` (no replacements). The field is reserved as a future extension point — if harness vocabulary drift later requires body-text substitutions (e.g., tool-name prefixes), they can be added here without engine changes.

Everything outside these three fields is the engine's responsibility or a downstream concern. Adapters do not declare tools, model aliases, frontmatter projection rules, or manifest emission — those are either engine-standard or installer-bundler-owned per AD-8.

## Engine-Owned Dev-Artifact Skip-List

The engine maintains a hardcoded, non-tunable skip-list of development artifacts. These patterns are excluded from source iteration and never translated:

- `__tests__`
- `node_modules`
- `.next`
- `dist`
- `dist-bundle`
- `*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}`
- `vitest.config.{ts,js,mjs}`
- `tsconfig.tsbuildinfo`

This list is engine-owned and cannot be overridden, extended, or per-adapter customized. It is updated by the engine maintainers only, not by harness authors.

## How to Add a Harness

To register a new harness:

1. Copy `adapters/_template/` to `adapters/<new-harness>/` (where `<new-harness>` is the harness identifier, e.g., `my-new-editor`).
2. Fill the three contract fields in the adapter module:
   - Set `name` to the harness identifier.
   - Implement `filenames` to define how source filenames map to output names.
   - Implement `bodyTokens` to define which tokens are substituted and what values they receive.
3. In the canonical `harness-files/agents/` directory, author one `<agent-name>.<new-harness>.yml` **frontmatter yml** for **every** agent body in `harness-files/agents/`. A missing yml for any `(agent, adapter)` pair is a **hard build error** — the engine does not skip or fall back to the canonical `.md` body.
4. Test the adapter by running the engine with the new harness registered. The engine will translate all agents and skills, write them to `output/<new-harness>/`, and report any errors.

## Destination-Token Passthrough Boundary

Certain tokens in agent and skill bodies are destination placeholders intended for the installer-bundler subsystem, not the harness-adapters engine. These tokens pass through translated output unchanged:

- `${SKILLS_ROOT}` — Placeholder for the skills directory path at install time.
- `${PLUGIN_ROOT}` — Placeholder for the plugin root directory at install time.
- Any other `${...}` tokens not defined in the adapter's `bodyTokens` map.

The engine does not resolve these tokens; it preserves them verbatim. The installer-bundler (per AD-8) is responsible for resolving these placeholders during the bundling phase, after translation is complete. Harness adapters must not define or consume these tokens.
