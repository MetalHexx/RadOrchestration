# Install Refactor — Design Document

**Date:** 2026-05-13 (updated 2026-05-16)
**Status:** Design aligned. The adapter subsystem has its own companion: [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md). Execution runs as a project series, all staged under `greenfield/`: the adapter subsystem rebuilds first, the installer subsystem rebuilds next (same greenfield pattern), and a final cutover iteration deletes the old root folders and promotes `greenfield/*` to the repo root.

---

## Context

The current installer layout carries cruft from incremental decisions:

- `installer/src/` is misnamed — semantically a publish-time staging area, not source code.
- A dogfood loop sits on top of the build CLI with its own staging hopper at the repo root, paralleling the installer's real deploy code path instead of using it.
- A single `installer/` package serves both the user-facing npm flow and (via the bundled `radorch.mjs`'s `plugin-bootstrap` subcommand) the Claude plugin's SessionStart flow. The two flows share enough to look like one but diverge enough to fight each other.
- `cli/` carries an `install` command wired into the CLI but never invoked in any production install path — vestigial.
- Source content (`agents/`, `skills/`) sits loose at the repo root, mixed with generated artifacts (`.claude/`, `.github/`), build outputs, and packages.

This document captures the target architecture for the installer + bundler side. The adapter subsystem has its own companion at [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md), referenced wherever it touches the broader layout.

---

## Target layout

```
.
├── harness-files/                            # source-of-truth content
│   ├── agents/                               #   body files + per-harness frontmatter ymls
│   ├── skills/                               #   skills with inline (LCD-authored) frontmatter
│   └── AGENTS.md
│                                             #   Authoring details: ~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/
│
├── harness-adapters/                         # translation subsystem
│   ├── engine/                               #   harness-blind translator
│   ├── adapters/                             #   per-harness adapter modules
│   │   ├── claude/
│   │   ├── copilot-vscode/
│   │   └── copilot-cli/
│   ├── output/                               #   .gitignored; translated harness-shape files
│   └── AGENTS.md
│                                             #   Subsystem details: ~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/
│
├── cli/                                      # radorch CLI source (TypeScript)
│                                             #   bundled into the rad-orchestration skill at install time
│
├── ui/                                       # Next.js dashboard
│                                             #   deployed to ~/.radorch/ui/ by both installers
│
└── installers/
    │
    ├── shared/
    │   └── build-helpers/                    # emit-cli-bundle, emit-ui-bundle
    │                                         #   (adapter knowledge lives in harness-adapters/, not here)
    │
    ├── standard/                             # user-facing npm installer ("rad-orchestration")
    │   ├── package.json
    │   ├── index.js                          # wizard (interactive) or --yes (headless) entry
    │   ├── lib/
    │   │   ├── wizard.js
    │   │   ├── banner.js
    │   │   ├── theme.js
    │   │   ├── cli.js
    │   │   ├── help.js
    │   │   ├── config-generator.js
    │   │   ├── checks/
    │   │   │   └── tooling.js                # FR-17 git/gh tooling checks
    │   │   └── install/                      # per-installer install state machine
    │   │       ├── install-harness.js
    │   │       ├── install-files.js
    │   │       ├── remove-files.js
    │   │       ├── catalog.js
    │   │       ├── expand-tokens.js
    │   │       ├── install-json.js
    │   │       ├── base-files.js             # writes ~/.radorch/{config.yml, registry.yml, .harness}
    │   │       ├── user-data-paths.js
    │   │       └── harness-paths.js
    │   ├── build-scripts/
    │   │   └── build.js                      # pack-time build (consumes harness-adapters/output/, cli bundle, ui standalone)
    │   ├── manifests/
    │   │   └── <harness>/
    │   │       └── v*.json                   # COMMITTED — per-harness upgrade catalog (release history)
    │   ├── dist/                             # gitignored — npm pack staging area
    │   │   ├── <harness>/
    │   │   │   ├── agents/
    │   │   │   ├── skills/
    │   │   │   ├── manifests/
    │   │   │   └── package.json
    │   │   └── ui/                           # built next-standalone, copied from /ui/ at pack time
    │   └── tests/
    │
    ├── claude-plugin/                        # SessionStart-invoked installer
    │   ├── package.json                      # publishes as the Claude marketplace plugin
    │   ├── index.js                          # entry invoked by SessionStart hook
    │   ├── .claude-plugin/
    │   │   └── plugin.json                   # marketplace manifest
    │   ├── hooks/
    │   │   └── hooks.json                    # SessionStart hook config
    │   ├── lib/
    │   │   └── install/                      # per-installer install state machine
    │   │       ├── install-files.js
    │   │       ├── remove-files.js
    │   │       ├── catalog.js
    │   │       ├── expand-tokens.js
    │   │       ├── install-json.js
    │   │       ├── hash-check.js             # claude-plugin only — drift detection
    │   │       ├── bootstrap-lock.js         # claude-plugin only — serializes concurrent sessions
    │   │       ├── install-log.js            # claude-plugin only — jsonl install log
    │   │       ├── user-data-paths.js
    │   │       └── harness-paths.js
    │   ├── build-scripts/
    │   │   └── build.js
    │   ├── manifests/
    │   │   └── v*.json                       # COMMITTED — single stream, no harness subfolder
    │   ├── dist/                             # gitignored — marketplace tarball staging
    │   └── tests/
    │
    ├── copilot-cli-plugin/                   # placeholder — future Copilot CLI plugin installer
    └── copilot-vscode-plugin/                # placeholder — future Copilot VS Code plugin installer
```

The new structure stages under `greenfield/` across multiple project iterations while old folders at the repo root stay frozen and keep shipping. Cutover — deleting old folders and moving `greenfield/*` to root — is its own iteration, executed only after every greenfield subsystem (adapters + installers) is feature-complete and validated. Staging mechanics for the adapter side are in [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md).

---

## Adapter & engine subsystem

The translation subsystem under `harness-adapters/` has its own companion doc, [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md), covering its design and motivation in full. Headlines:

- **Adapter is a pure translation layer.** The engine is harness-blind; adapters declare per-harness rules (filename templates, body-token replacements) as small modules.
- **Per-harness frontmatter is hand-authored.** Each agent has one yml per harness alongside its body file in `harness-files/agents/`. No projection logic, no neutral schema, no tool/model dictionaries in adapters.
- **Body files use a `{{FRONTMATTER}}` token.** The engine substitutes it with the matching per-harness yml at translation time.
- **Skills keep frontmatter inline** (lowest-common-denominator authored across harnesses).
- **Engine output is just translated files** — no manifest at this layer. Each installer-bundler produces its own install-shape manifest downstream.
- **Destination-shaped body tokens pass through the adapter unchanged.** References to install destinations in body text (today: `${PLUGIN_ROOT}` in three UI skills; latent: hardcoded `.claude/skills/...` references in the planning skills) are resolved by the installer-bundler, not the adapter. The adapter handles harness vocabulary; the installer handles destination.

---

## Per-folder responsibilities

### `/harness-files/`
Source of truth for multi-harness content. Hand-authored agents and skills. Every adapter reads from here.

- `harness-files/agents/<name>.md` — body only, with `{{FRONTMATTER}}` token at top
- `harness-files/agents/<name>.<harness>.yml` — per-harness frontmatter (one yml per agent per harness)
- `harness-files/skills/<skill>/SKILL.md` — full file with inline frontmatter
- `harness-files/skills/<skill>/...` — subfolders (scripts, references, templates) copied verbatim
- `harness-files/AGENTS.md` — module-level orientation for contributors

UI and CLI stay at the repo root rather than under `harness-files/` because both are self-contained npm packages with their own build systems and deploy to non-harness destinations. Hooks (`hooks.json`) live under the claude-plugin installer because hooks are plugin-specific.

### `/harness-adapters/`
Translation subsystem. See [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md).

### `/cli/`
Source of `radorch.mjs` — the runtime utility belt that ships inside the `rad-orchestration` skill.

radorch is a pure runtime utility belt: `doctor`, `where`, `harness use/list`, `ui start/stop/status`, `gate approve plan/final`. It should **not** contain:
- An `install` subcommand — install logic belongs to installers, not the runtime CLI.
- A `plugin-bootstrap` subcommand — the claude-plugin installer's entry point handles SessionStart bootstrapping directly.
- `cli/src/lib/upgrade/*` — upgrade logic lives inside the claude-plugin installer (`installers/claude-plugin/lib/install/`), its only real consumer.

### `/ui/`
Next.js dashboard. Lives at repo root: a self-contained npm package, deployed to `~/.radorch/ui/` (not into a harness folder), shared across all installers. Both installers consume it via the same `emit-ui-bundle` helper.

### `/installers/`
Top-level monorepo of installer variants and shared installer helpers.

- **`shared/build-helpers/`** — small helpers like `emit-cli-bundle.js`, `emit-ui-bundle.js`. Adapter knowledge is **not** here; it lives in `harness-adapters/`. Installers consume the adapter engine's output tree as input.
- **`standard/`** — user-facing legacy installer. One npm tarball ships all three harnesses; the wizard selects which to deploy. Mutually-exclusive Copilot harness selection. Owns `lib/install/` for its install state machine, including `base-files.js` for `config.yml`/`registry.yml`/`.harness` skeleton.
- **`claude-plugin/`** — SessionStart-invoked headless installer. Ships only the claude variant. Adds plugin-specific lib modules (`hash-check`, `bootstrap-lock`, `install-log`) that legacy doesn't need.
- **`copilot-cli-plugin/`** and **`copilot-vscode-plugin/`** — placeholders for future plugin-style installers.

Each installer is a separately publishable npm package with its own `package.json`, version cadence, and tarball.

---

## Key flow walkthroughs

### Standard installer install flow (end-user)

1. User runs `npx rad-orchestration` (or `npx ./<tarball>`).
2. `installers/standard/index.js` runs the wizard (or `--yes` headless mode) and collects harness selection.
3. The bundled tarball contains `installers/standard/dist/<harness>/` with translated agents/skills (sourced from `harness-adapters/output/<harness>/` at pack time), the bundled `radorch.mjs`, the built UI, and the manifest catalog.
4. `installers/standard/lib/install/install-harness.js` reads `~/.radorch/install.json` to detect prior install version.
5. On upgrade: loads prior version's manifest from `dist/<harness>/manifests/v<prior>.json`, calls `removeManifestFiles` to clean up old files at their templated destinations.
6. Loads current version's manifest, calls `installManifestFiles` to copy from `dist/<harness>/` to `~/.claude/` or `~/.copilot/` (and `~/.radorch/` for shared assets).
7. Writes skeleton config files via `base-files.js`.
8. Stamps `~/.radorch/install.json`.

### Claude plugin install flow (SessionStart hook)

1. User installs the Claude plugin via marketplace.
2. Claude Code's SessionStart hook fires, configured by `installers/claude-plugin/hooks/hooks.json`.
3. The hook invokes `node <plugin-install-root>/index.js`.
4. `installers/claude-plugin/index.js` acquires a bootstrap lock via `bootstrap-lock.js`.
5. `hash-check.js` detects modified user files; on drift it prompts for confirmation.
6. Same manifest-driven remove + install sequence as standard, with claude-plugin's `lib/install/`.
7. Appends a JSONL line to `~/.radorch/logs/install.log` via `install-log.js`.

### Build flow (pack time, per installer)

1. The adapter engine runs first: `harness-files/` → `harness-adapters/output/<harness>/` (translated files).
2. `installers/<name>/build-scripts/build.js` runs:
   - Reads translated files from `harness-adapters/output/<harness>/`
   - `shared/build-helpers/emit-cli-bundle.js` bundles `/cli/` → `dist/<harness>/skills/rad-orchestration/scripts/radorch.mjs`
   - `shared/build-helpers/emit-ui-bundle.js` builds `/ui/` standalone → `dist/ui/`
   - Generates the per-installer manifest with sha256s and destination paths; writes to both `manifests/<harness>/v<current>.json` (committed) and `dist/<harness>/manifests/v<current>.json`
   - Copies all prior `manifests/<harness>/v*.json` into `dist/<harness>/manifests/` so the tarball contains the full release-history catalog
3. `npm pack` reads `installers/<name>/dist/` and produces the tarball.

Same pattern for `installers/claude-plugin/build-scripts/build.js`, except the manifest catalog is a single stream (no harness subfolder) and the plugin's `.claude-plugin/plugin.json` and `hooks/hooks.json` get copied into `dist/` too.

### Dogfooding (developer inner loop)

No dedicated dogfood machinery. The inner loop runs the adapter engine and then the real install code path:

```
cd harness-adapters && node engine/build.js                       # populate harness-adapters/output/
cd installers/standard && node build-scripts/build.js             # build tarball staging
node installers/standard/index.js --yes --harness claude --bundle-root ./dist/
```

The adapter engine separates `harness-files/ → output/` (translation) from `output/ → installable tarball` (packaging), so each step runs independently for tight iteration.

---

## Decisions & rationale

### Decision 1: Source content lives under `/harness-files/`
- `harness-files/agents/` holds body files plus per-harness frontmatter ymls.
- `harness-files/skills/` holds skills with inline frontmatter (LCD authored).
- `/hooks/` lives under `installers/claude-plugin/hooks/` — it's plugin-specific.
- `/ui/` and `/cli/` stay at repo root — they're self-contained npm packages with their own build systems.
- Adapter-side details: [INSTALL-REFACTOR-ADAPTERS](~/.radorch/projects/INSTALL-REFACTOR-ADAPTERS/INSTALL-REFACTOR-ADAPTERS-BRAINSTORMING.md).
- **Rationale:** "harness-files" names the role: files that get harness-adapted. Keeping them in one folder separates source content from generated artifacts and packages.

### Decision 2: Adapter subsystem owns translation; installers own packaging
- `harness-adapters/` produces translated harness-shape files; `installers/<name>/` packages them into install shapes.
- The boundary between subsystems is `harness-adapters/output/`.
- **Rationale:** translation (per-harness content shape) and packaging (per-install-target shape) are distinct concerns. Separating them lets the adapter subsystem stay harness-blind and the installer subsystem stay install-shape-focused.

### Decision 3: radorch.mjs is a pure runtime utility belt
- No `install` subcommand. No `plugin-bootstrap`. No `cli/src/lib/upgrade/*`.
- Install logic lives in installers; upgrade logic lives in the claude-plugin installer.
- **Rationale:** install logic belongs to installers, not the runtime CLI.

### Decision 4: `/ui/` stays at root, not under `/harness-files/`
- **Rationale:** UI is consumed by both installers and deploys to `~/.radorch/ui/`. It's a self-contained npm package, not harness-translated content.

### Decision 5: Each installer owns its own install state machine
- `installers/standard/lib/install/` and `installers/claude-plugin/lib/install/` each contain a full state machine.
- **Rationale:** the two installers diverge meaningfully (claude-plugin needs hash-check / lock / log; standard needs config.yml skeleton writes). Independent copies preserve self-containment without coupling them through a shared library.

### Decision 6: Manifest catalogs live inside each installer
- `installers/standard/manifests/<harness>/v*.json` (per-harness streams).
- `installers/claude-plugin/manifests/v*.json` (single stream).
- **Rationale:** each installer's upgrade catalog ships inside its own npm tarball so end users at any prior version have access to clean upgrade paths.

### Decision 7: Standard installer ships all three harnesses in one tarball
- The wizard selects which to deploy. Mutually-exclusive Copilot harness selection (vscode OR cli, not both).
- **Rationale:** smallest user surface (`npx rad-orchestration` works for everyone) versus three separate npm packages with lockstep versions.

### Decision 8: Shared build helpers stay narrow; adapters are not shared
- `installers/shared/build-helpers/` holds `emit-cli-bundle.js`, `emit-ui-bundle.js`.
- Adapter code is **not** here — it lives in `harness-adapters/`. Installers consume the engine's output tree.
- **Rationale:** clean boundary — translation belongs to `harness-adapters/`; packaging belongs to `installers/`.

### Decision 9: No dogfood machinery
- No `scripts/build.js`, no `dogfood-prior-<harness>.json`, no `/dist/staging/`.
- Dogfooding runs the adapter engine and then the installer locally with `--bundle-root` pointing at the freshly built `dist/`.
- **Rationale:** dogfooding is a local execution of the real code paths. A parallel deploy mechanism with its own state tracking adds complexity and naming friction without delivering value.

### Decision 10: Greenfield staging during rebuild
- The new structure lives under `greenfield/` until the rebuild is feature-complete.
- Old folders stay untouched during transition; `/agents/` and `/skills/` are frozen for the duration.
- At cutover, old folders get deleted and `greenfield/` contents move to root.
- **Rationale:** the old system keeps shipping while the new system grows in isolation. The freeze + cutover boundary keeps the working tree stable and the cutover clean.

### Decision 11: Destination-token substitution is an installer responsibility
- The adapter subsystem is install-destination-blind. It translates harness vocabulary (tool names, frontmatter shape, filename conventions) and passes destination-shaped tokens through the body unchanged.
- Installer-bundlers resolve any destination-shaped tokens in body text per their target layout — `${PLUGIN_ROOT}` (where the harness install root lives), and potentially `${SKILLS_ROOT}` (path to skills inside an install) once the latent hardcoded-path cases are tokenized.
- Each installer knows its own destination: legacy npm installs at `~/.claude` / `~/.copilot`, the Claude plugin installs under `${CLAUDE_PLUGIN_ROOT}` (a runtime env var), future installers do whatever they do.
- **Rationale:** the same Claude adapter output can serve both the legacy installer and the plugin installer because each runs its own destination pass. Mixing destination knowledge into the adapter would re-couple translation to packaging — the exact layering this rearchitecture exists to fix. Known surface today: `${PLUGIN_ROOT}` in three UI skills. Latent fix to handle during installer rebuild: tokenize the hardcoded `.claude/skills/...` references in the planning skills.

---

## Migration scope

| Source | Destination | Notes |
|---|---|---|
| `/agents/` | `greenfield/harness-files/agents/` | Copy bodies; strip existing frontmatter; replace with `{{FRONTMATTER}}` token. Hand-author per-harness ymls alongside, using current `/adapters/<harness>/adapter.js` as the reference for each harness's expected frontmatter shape. |
| `/skills/` | `greenfield/harness-files/skills/` | Copy verbatim (frontmatter stays inline, LCD authored). |
| `/hooks/` | `installers/claude-plugin/hooks/` | Move; update build script (becomes `installers/claude-plugin/build-scripts/build.js`). |
| `/installer/` | `installers/standard/` | Rename; restructure subfolders per the target layout. |
| `/installer/src/` | `installers/standard/dist/` | Rename — currently misnamed as `src/`; gitignored except manifests. |
| Manifest catalogs in `/installer/src/<h>/manifests/` | `installers/standard/manifests/<h>/` | Pull out of `dist/`, commit to git separately. |
| `/plugin/` | `installers/claude-plugin/` | Rename; the installer's `index.js` becomes the SessionStart entry point. |
| `/cli/src/commands/install.ts`, `install/skeleton.ts`, `install/harness-bundles.ts` | **Delete** | Vestigial. |
| `/cli/src/commands/plugin-bootstrap/` | `installers/claude-plugin/` (logic absorbed into `index.js` + `lib/install/`) | radorch loses this subcommand. |
| `/cli/src/lib/upgrade/` | `installers/claude-plugin/lib/install/` | Folds with plugin-bootstrap. |
| `/adapters/` | Read-only reference during migration; deleted at cutover. The new adapter subsystem lives in `greenfield/harness-adapters/`. The existing adapter code is the source of truth for per-harness frontmatter shapes while authoring the new ymls. |
| `/scripts/build.js` and dogfood machinery | **Delete** | Per Decision 9. |
| `/scripts/build-plugin.js` | `installers/claude-plugin/build-scripts/build.js` | Move; gains shared helper imports. |
| `/scripts/build-*.test.js` | Distributed to each installer's `tests/` | Move with the scripts they cover. |
| Shared bundle/UI emit logic | `installers/shared/build-helpers/` | Extract from current `installer/scripts/sync-source.js` and `scripts/build-plugin.js`. |

References across the codebase update with every move — tests, CLAUDE.md, docs, build scripts, package.json `files` arrays.

---

## Non-goals

- **No dedicated dogfood architecture.** Inner-loop development uses the same code paths as end users (Decision 9).
- **No shared install-lib package.** Each installer keeps its own `lib/install/` (Decision 5).
- **No shared adapter library inside `installers/`.** Adapter knowledge lives in `harness-adapters/` (Decision 8).
- **No splitting `installers/standard/` into per-harness npm packages.** One tarball, wizard selects (Decision 7).
- **No top-level `dist/` at the repo root.** Each installer's `dist/` lives under its own folder; `cli/dist/` and `ui/.next/` stay where they are (package-local). `harness-adapters/output/` is gitignored too.
- **No changes to `radorch.mjs`'s naming or location post-deploy.** It still ships inside `<harness-root>/skills/rad-orchestration/scripts/radorch.mjs`.
- **No retroactive rewrite of past committed manifests.** The append-only catalog continues from wherever it lands at rearchitecture commit time.
- **`/cli/` does not move under `/harness-files/`.** Reason captured in Decision 4.

---

## Sequencing

The rearchitecture executes on a fresh branch, staged under `greenfield/`, after the in-flight installer-decouple PR merges. That PR contains the validated foundation (`destinationPath` routing-as-data, `installer/lib/install/` port, bridge deletion) that the rearchitecture builds on. The greenfield branch starts from main post-merge.

Old code at the repo root stays untouched during the rebuild — `/agents/`, `/skills/`, `/adapters/`, `/installer/`, `/plugin/` continue to ship while new code grows in isolation. At cutover (rebuild feature-complete), old folders get deleted and `greenfield/` contents move to root in one coherent commit.

An iteration plan that breaks the rebuild into concrete implementation steps will be authored separately.
