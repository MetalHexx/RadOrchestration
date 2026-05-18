# migration/

## Purpose

One-shot scripts that performed the legacy → greenfield migration during the installer refactor. They populated `greenfield/harness-files/` from the legacy repo-root `agents/` + `skills/` trees and gated cutover with a parity check between the legacy adapter pipeline and the new engine output.

Neither script is wired into CI, the pre-commit hook, or any permanent workflow. They are historical artifacts kept for reference until the refactor fully cuts over.

## How it works

**`run.mjs` — legacy → greenfield population**

Walks `<repo>/agents/*.md`, strips each file's leading `---\n…\n---` frontmatter block, and writes `greenfield/harness-files/agents/<name>.md` as `{{FRONTMATTER}}\n\n<body>`. The per-harness YAML siblings (`<name>.claude.yml`, etc.) were hand-authored separately — `run.mjs` does not emit them.

Walks `<repo>/skills/<skill>/**` recursively and copies every file verbatim into `greenfield/harness-files/skills/<skill>/...`. Skill frontmatter stays inline; the engine does no projection on skills. The engine's directory skip-list (`__tests__`, `node_modules`, `.next`, `dist`, `dist-bundle`, `vitest.config.*`, `.test.*` / `.spec.*` files) is mirrored here at traversal time so the migration never copies a file the engine would later refuse.

For every text-file copy (`.md`, `.txt`, `.js`, `.mjs`, `.cjs`, `.ts`, `.json`, `.yml`, `.sh`), runs a literal `.claude/skills/` → `${SKILLS_ROOT}/` substitution. Other harness-rooted references (`.copilot/`, `.github/`, `.agents/`, `~/.radorch/`) are left untouched — those refer to runtime destinations the author owns, not the canonical skills root. Token resolution is the downstream installer-bundler's job, not the engine's.

**`parity-check.mjs` — legacy vs engine output gate**

Runs the legacy build per harness (`node scripts/build.js --harness=<h>` → `dist/staging/<h>/`), then the new engine (`node greenfield/harness-adapters/engine/build.js` → `greenfield/harness-adapters/output/<h>/`). Walks both `{agents,skills}` subtrees, builds a normalized content map keyed by relative path, and diffs the two maps. Exits 0 only when every harness's non-accepted diff is empty.

Accepted deviations are documented inline in the script header (whitespace, YAML key order, `${SKILLS_ROOT}` / `${PLUGIN_ROOT}` token passthrough vs legacy literal substitution, legacy top-level instructions and settings the engine intentionally doesn't emit, `__tests__` vs `tests/` skip-list philosophy, etc.).

## Coding conventions

- Both scripts are self-contained — only Node built-ins, no shared helpers, no `package.json`.
- Both write log lines via `process.stdout.write` and exit with a meaningful code; no logger or progress UI.
- Path resolution is anchored to `REPO_ROOT = resolve(__dirname, '..', '..')`. Do not rely on the current working directory.

## Rules for making updates

- Do not extend either script for new behavior. They are retirement artifacts. If a future migration is needed, write a new script under a new name with its own purpose statement.
- If the engine's skip-list (`greenfield/harness-adapters/engine/index.js`) ever changes, `run.mjs`'s mirror set is now frozen — the migration already ran. Note the drift in any cleanup PR but don't re-sync.
- Safe to delete this folder entirely once the refactor cuts over and no further parity sign-off is expected.
