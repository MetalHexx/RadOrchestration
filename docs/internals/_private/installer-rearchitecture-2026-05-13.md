# Installer Rearchitecture — Design Document

**Date:** 2026-05-13
**Status:** Design aligned. Execution on a fresh branch after the in-flight installer-decouple PR merges.
**Author:** brainstormed wave-by-wave during the smoke-test-followup PR session.

---

## Context

Today's installer layout has accumulated cruft from incremental decisions:

- `installer/src/` is misnamed — semantically it's a publish-time staging area, not source code, but the name reads as "source."
- A dogfood loop was bolted onto the build CLI with its own staging hopper at the repo root, dogfood-prior manifest tracking, and bespoke deploy semantics — paralleling the installer's real deploy code path instead of using it.
- A single `installer/` package serves both the user-facing npm flow AND (via the bundled `radorch.mjs`'s `plugin-bootstrap` subcommand) the Claude plugin's SessionStart flow. The two flows share enough to look like one but diverge enough to fight each other.
- `cli/` (the source of `radorch.mjs`) carries an `install` command that is wired into the CLI but **never invoked in any production install path** — it's vestigial.
- Canonical content (`agents/`, `skills/`, `hooks/`) is scattered loose at the repo root, mixed with generated artifacts (`.claude/`, `.github/`, `claude/`, `copilot-cli/`, `copilot-vscode/`), build outputs, and packages.

This document captures the target architecture aligned wave-by-wave during a brainstorming session that surfaced after a smoke-test-followup PR exposed the deeper layout debt.

---

## Target layout

```
.
├── canonical/
│   ├── agents/                              # 8 system agents (orchestrator, planner, coder, ...)
│   └── skills/                              # all rad-* skills (incl. rad-orchestration/scripts/pipeline.js)
│
├── cli/                                     # radorch CLI source (TypeScript)
│                                            #   bundled into the rad-orchestration skill at install time
│
├── ui/                                      # Next.js dashboard
│                                            #   deployed to ~/.radorch/ui/ by both installers
│
└── installers/
    │
    ├── shared/
    │   ├── adapters/                        # adapter library — canonical → per-harness projection
    │   └── build-helpers/                   # emit-cli-bundle, emit-ui-bundle, run-adapters
    │
    ├── standard/                            # user-facing npm installer ("rad-orchestration")
    │   ├── package.json
    │   ├── index.js                         # wizard (interactive) or --yes (headless) entry
    │   ├── lib/
    │   │   ├── wizard.js
    │   │   ├── banner.js
    │   │   ├── theme.js
    │   │   ├── cli.js
    │   │   ├── help.js
    │   │   ├── config-generator.js
    │   │   ├── checks/
    │   │   │   └── tooling.js               # FR-17 git/gh tooling checks
    │   │   └── install/                     # per-installer install state machine
    │   │       ├── install-harness.js
    │   │       ├── install-files.js
    │   │       ├── remove-files.js
    │   │       ├── catalog.js
    │   │       ├── expand-tokens.js
    │   │       ├── install-json.js
    │   │       ├── base-files.js            # writes ~/.radorch/{config.yml, registry.yml, .harness}
    │   │       ├── user-data-paths.js
    │   │       └── harness-paths.js
    │   ├── build-scripts/
    │   │   └── build.js                     # pack-time build (adapters, cli bundle, ui standalone)
    │   ├── manifests/
    │   │   └── <harness>/
    │   │       └── v*.json                  # COMMITTED — per-harness upgrade catalog (release history)
    │   ├── dist/                            # gitignored — npm pack staging area
    │   │   ├── <harness>/
    │   │   │   ├── agents/
    │   │   │   ├── skills/
    │   │   │   ├── manifests/
    │   │   │   └── package.json
    │   │   └── ui/                          # built next-standalone, copied from /ui/ at pack time
    │   └── tests/
    │
    ├── claude-plugin/                       # SessionStart-invoked installer (was /plugin/)
    │   ├── package.json                     # publishes as the Claude marketplace plugin
    │   ├── index.js                         # entry invoked by SessionStart hook
    │   │                                    #   (replaces `radorch plugin-bootstrap`)
    │   ├── .claude-plugin/
    │   │   └── plugin.json                  # marketplace manifest
    │   ├── hooks/
    │   │   └── hooks.json                   # SessionStart hook config (moved from /hooks/)
    │   ├── lib/
    │   │   └── install/                     # per-installer install state machine
    │   │       ├── install-files.js
    │   │       ├── remove-files.js
    │   │       ├── catalog.js
    │   │       ├── expand-tokens.js
    │   │       ├── install-json.js
    │   │       ├── hash-check.js            # claude-plugin only — drift detection
    │   │       ├── bootstrap-lock.js        # claude-plugin only — serializes concurrent sessions
    │   │       ├── install-log.js           # claude-plugin only — jsonl install log
    │   │       ├── user-data-paths.js
    │   │       └── harness-paths.js
    │   ├── build-scripts/
    │   │   └── build.js
    │   ├── manifests/
    │   │   └── v*.json                      # COMMITTED — single stream, no harness subfolder
    │   ├── dist/                            # gitignored — marketplace tarball staging
    │   └── tests/
    │
    ├── copilot-cli-plugin/                  # placeholder — future Copilot CLI plugin installer
    └── copilot-vscode-plugin/               # placeholder — future Copilot VS Code plugin installer
```

---

## Per-folder responsibilities

### `/canonical/`
The system's source of truth for multi-harness content. Hand-authored agents and skills. Every installer reads from here.

- `/canonical/agents/` — 8 system agents (bare-named: `orchestrator.md`, `planner.md`, etc.).
- `/canonical/skills/` — all rad-* skills, including `rad-orchestration/scripts/pipeline.js` (the bundled pipeline runtime).

Why not also `/ui/` or `/cli/`? Because both are self-contained npm packages with their own build systems and `package.json`, and they deploy to different destinations (`~/.radorch/ui/`, embedded inside the rad-orchestration skill). Their boundary is the npm-package boundary, not the canonical-content boundary.

Why not also `/hooks/`? Because `hooks/hooks.json` is Claude-plugin-specific — only the claude-plugin installer consumes it. Moves to `installers/claude-plugin/hooks/`.

### `/cli/`
Source of `radorch.mjs` — the runtime utility belt that ships inside the `rad-orchestration` skill.

After the rearchitecture, radorch sheds:
- `install` (deleted entirely — vestigial, never invoked in production install paths)
- `plugin-bootstrap` (absorbed into `installers/claude-plugin/` as that installer's entry point)
- `cli/src/lib/upgrade/*` (folds into `installers/claude-plugin/lib/install/` since plugin-bootstrap was its only real consumer)

radorch keeps and grows: `doctor`, `where`, `harness use/list`, `ui start/stop/status`, `gate approve plan/final`. Over time, additional skill scripts consolidate into radorch subcommands so there's one binary at `~/.claude/skills/rad-orchestration/scripts/radorch.mjs` that handles all runtime ops.

At build time, each installer's `build-scripts/build.js` calls `shared/build-helpers/emit-cli-bundle.js`, which runs `npm run bundle` in `/cli/` and writes the output into the installer's `dist/.../skills/rad-orchestration/scripts/radorch.mjs`.

### `/ui/`
Next.js dashboard. Stays at repo root because:
- It's a self-contained npm package with `package.json` + Next.js build system.
- It deploys to `~/.radorch/ui/` (not into a harness folder), shared across all installers.
- Both `installers/standard/` and `installers/claude-plugin/` consume it via the same `emit-ui-bundle` helper.

### `/installers/`
Top-level monorepo of installer variants + shared installer code.

- **`shared/adapters/`** — pure transformation library. Takes canonical agents/skills, projects per-harness frontmatter, emits files. Stateless. Used by every installer's build-scripts.
- **`shared/build-helpers/`** — small helpers like `emit-cli-bundle.js`, `emit-ui-bundle.js`, `run-adapters.js`. Each is a thin wrapper around a step that every installer's build-scripts repeats.
- **`standard/`** — user-facing legacy installer. One npm tarball ships all three harnesses; wizard selects which to deploy. Mutually-exclusive harness selection. Owns `lib/install/` for its install state machine, including `base-files.js` for `config.yml`/`registry.yml`/`.harness` skeleton.
- **`claude-plugin/`** — SessionStart-invoked headless installer (formerly `/plugin/`). Ships only the claude variant. Adds plugin-specific lib modules (`hash-check`, `bootstrap-lock`, `install-log`) that legacy doesn't need.
- **`copilot-cli-plugin/`** and **`copilot-vscode-plugin/`** — placeholder folders for future plugin-style installers if/when Copilot supports an analogous SessionStart-style hook surface.

Each installer is a separately publishable npm package with its own `package.json`, version cadence, and tarball. They share canonical content and shared/ helpers but otherwise live independently.

---

## Key flow walkthroughs

### Standard installer install flow (end-user)

1. User runs `npx rad-orchestration` (or `npx ./<tarball>`).
2. `installers/standard/index.js` runs the wizard (or `--yes` headless mode), collects harness selection.
3. The bundled tarball already contains `installers/standard/dist/<harness>/` with adapter-projected agents/skills, bundled `radorch.mjs`, built UI, and the manifest catalog.
4. `installers/standard/lib/install/install-harness.js` reads `~/.radorch/install.json` to detect prior install version.
5. On upgrade: loads prior version's manifest from `dist/<harness>/manifests/v<prior>.json`, calls `removeManifestFiles` to clean up old files at their templated destinations.
6. Loads current version's manifest, calls `installManifestFiles` to copy from `dist/<harness>/` to `~/.claude/` or `~/.copilot/` (and `~/.radorch/` for shared assets).
7. Writes skeleton config files via `base-files.js`.
8. Stamps `~/.radorch/install.json`.

### Claude plugin install flow (SessionStart hook)

1. User installs the Claude plugin via marketplace.
2. Claude Code SessionStart hook fires, configured by `installers/claude-plugin/hooks/hooks.json`.
3. Hook invokes `node <plugin-install-root>/index.js` (replacing today's `radorch.mjs plugin-bootstrap`).
4. `installers/claude-plugin/index.js` acquires bootstrap lock via `bootstrap-lock.js`.
5. Detects modified user files via `hash-check.js`; if drift found, prompts for confirmation.
6. Same manifest-driven remove + install sequence as standard, but with claude-plugin's lib/install/.
7. Appends a JSONL line to `~/.radorch/logs/install.log` via `install-log.js`.

### Build flow (pack time, per installer)

1. `installers/standard/build-scripts/build.js` runs:
   - `shared/build-helpers/run-adapters.js` projects canonical → `dist/<harness>/{agents, skills}/`
   - `shared/build-helpers/emit-cli-bundle.js` bundles `/cli/` → `dist/<harness>/skills/rad-orchestration/scripts/radorch.mjs`
   - `shared/build-helpers/emit-ui-bundle.js` builds `/ui/` standalone → `dist/ui/`
   - Generates current-version manifest with sha256s + destinationPaths; writes to both `manifests/<harness>/v<current>.json` (committed) and `dist/<harness>/manifests/v<current>.json`
   - Copies all prior `manifests/<harness>/v*.json` into `dist/<harness>/manifests/` so the tarball contains the full release-history catalog
2. `npm pack` reads `installers/standard/dist/` and produces the tarball.

Same pattern for `installers/claude-plugin/build-scripts/build.js`, except the manifest catalog is a single stream (no harness subfolder) and the plugin's `.claude-plugin/plugin.json` and `hooks/hooks.json` get copied into `dist/` too.

### Dogfooding (developer inner loop)

**No dedicated dogfood machinery.** Dogfooding is just "run the installer locally":

```
cd installers/standard && node build-scripts/build.js          # populate dist/
node index.js --yes --harness claude --bundle-root ./dist/     # install from local dist/
```

If finer-grained iteration is desired (e.g., only re-emit skills, skip UI rebuild), each installer's `build.js` can accept flags. But the inner loop fundamentally uses the same install code path that end users use. No `.dogfood/` folder, no `dogfood-prior-*.json` cache, no parallel deploy logic.

---

## Decisions & rationale

Captured in the order they were aligned during the brainstorming session. Each decision was the focus of one "wave" — a single architectural question resolved before moving to the next.

### Decision 1: Canonical content moves under `/canonical/`
- `/canonical/agents/` and `/canonical/skills/` only.
- `/hooks/` moves to `installers/claude-plugin/hooks/` — it's plugin-specific.
- `/ui/` and `/cli/` stay at repo root — they're npm packages with their own build systems.
- **Rationale:** scattering canonical content at the repo root mixes it with generated artifacts, build outputs, and packages. Naming the source-of-truth folder explicitly removes ambiguity.

### Decision 2: radorch.mjs sheds install + plugin-bootstrap
- `install` deleted entirely (vestigial — wired into the CLI but never called in production install paths).
- `plugin-bootstrap` folds into `installers/claude-plugin/` as that installer's entry point.
- `cli/src/lib/upgrade/*` folds into `installers/claude-plugin/lib/install/` (it was only consumed by plugin-bootstrap + a single util in doctor).
- **Rationale:** install logic belongs to installers, not the runtime CLI. After the shed, radorch is a pure runtime utility belt that grows over time as additional skill scripts consolidate into it.

### Decision 3: `/ui/` stays at root, not under `/canonical/`
- **Rationale:** UI is consumed by both installers and deploys to `~/.radorch/ui/`. Promoting it under `/canonical/` (which is skill-content scope) conflates concerns. UI is canonical-shaped but lives at root as its own self-contained package.

### Decision 4: Each installer owns its own install state machine
- `installers/standard/lib/install/` and `installers/claude-plugin/lib/install/` each contain a full state machine.
- No `installers/shared/install-lib/` — sharing was considered and rejected.
- **Rationale:** the two installers will diverge (claude-plugin needs hash-check/lock/log; standard needs config.yml skeleton writes). Phase 1 of the in-flight PR deliberately created independent copies. Keeping them per-installer preserves self-containment and lets each evolve without coupling.

### Decision 5: Manifest catalogs live inside each installer
- `installers/standard/manifests/<harness>/v*.json` (per-harness streams).
- `installers/claude-plugin/manifests/v*.json` (single stream).
- **Rationale:** each installer's upgrade catalog must ship inside its own npm tarball so end users at any prior version have access to clean upgrade paths. `npm pack` only packs files within the package root, so the catalog has to live there. A shared `installers/shared/manifests/` would be unreachable from each installer's `files` array.

### Decision 6: Standard installer ships all three harnesses in one tarball
- Wizard selects which to deploy. Mutually-exclusive Copilot harness selection (vscode OR cli, not both).
- **Rationale:** smallest user surface (`npx rad-orchestration` works for everyone) vs three separate npm packages with lockstep versions.

### Decision 7: Shared build helpers in `installers/shared/build-helpers/`
- `emit-cli-bundle.js`, `emit-ui-bundle.js`, `run-adapters.js`.
- Each installer's `build-scripts/build.js` is a thin orchestrator.
- **Rationale:** meaningful overlap between the two installer build pipelines (both bundle cli, both build ui, both run adapters). Sharing the per-step helpers avoids duplication without coupling the orchestration logic.

### Decision 8: No dogfood machinery
- `scripts/build.js`, `dogfood-prior-<harness>.json`, `/dist/staging/` all deleted.
- Dogfooding = "run the installer locally with --bundle-root pointing at the freshly built `dist/`."
- **Rationale:** dogfooding is just a local execution of the real install code path. Bolting on a parallel deploy mechanism with its own state tracking duplicated machinery and created naming friction (`/dist/`, `/.dogfood/`, `scripts/dist/` — all confusing).

---

## Migration scope

Substantial, but each piece is well-defined:

| Source | Destination | Notes |
|---|---|---|
| `/agents/` | `/canonical/agents/` | Move; update references in adapters, tests, CLAUDE.md. |
| `/skills/` | `/canonical/skills/` | Move; update references. |
| `/hooks/` | `installers/claude-plugin/hooks/` | Move; update `scripts/build-plugin.js` (becomes `installers/claude-plugin/build-scripts/build.js`). |
| `/installer/` | `installers/standard/` | Rename; restructure subfolders per the target layout. |
| `/installer/src/` | `installers/standard/dist/` | Rename — was misnamed as `src/`; gitignored except manifests. |
| Manifest catalogs that lived in `/installer/src/<h>/manifests/` | `installers/standard/manifests/<h>/` | Pull out of `dist/`, commit to git separately. Each build copies committed manifests into `dist/<h>/manifests/`. |
| `/plugin/` | `installers/claude-plugin/` | Rename; gains entry point that replaces `radorch plugin-bootstrap`. |
| `/cli/src/commands/install.ts`, `install/skeleton.ts`, `install/harness-bundles.ts` | **Delete** | Vestigial — wired into CLI but never invoked in production. |
| `/cli/src/commands/plugin-bootstrap/` | `installers/claude-plugin/` (logic absorbed into `index.js` + `lib/install/`) | radorch loses this subcommand. |
| `/cli/src/lib/upgrade/` | `installers/claude-plugin/lib/install/` | Folds with plugin-bootstrap. |
| `/adapters/` | `installers/shared/adapters/` | Move; pure library, no behavior change. |
| `/scripts/build.js` and dogfood machinery | **Delete** | Per Decision 8. |
| `/scripts/build-plugin.js` | `installers/claude-plugin/build-scripts/build.js` | Move; gains shared helper imports. |
| `/scripts/build-*.test.js` | Distributed to their respective installer's `tests/` | Move with the scripts they cover. |
| Shared bundle/UI emit logic | `installers/shared/build-helpers/` | Extract from current `installer/scripts/sync-source.js` and `scripts/build-plugin.js`. |

References across the codebase update with every move — tests, CLAUDE.md, docs, build scripts, package.json `files` arrays.

---

## Non-goals (explicit scope cuts)

- **No dedicated dogfood architecture.** Inner-loop development uses the same install code path as end users (Decision 8).
- **No shared install-lib package.** Each installer keeps its own `lib/install/` (Decision 4).
- **No splitting `installers/standard/` into per-harness npm packages.** One tarball, wizard selects (Decision 6).
- **No top-level `dist/` at the repo root.** Each installer's `dist/` lives under its own folder; `cli/dist/` and `ui/.next/` stay where they are (package-local).
- **No changes to `radorch.mjs`'s naming or location post-deploy.** Still ships inside `<harness-root>/skills/rad-orchestration/scripts/radorch.mjs`.
- **No retroactive rewrite of past committed manifests.** The append-only catalog continues from wherever it lands at rearchitecture commit time; older versions stay where they are in committed history.
- **`/cli/` does not move under `/canonical/`.** Reason captured in Decision 1.

---

## Sequencing

The rearchitecture executes as a separate branch after the in-flight installer-decouple PR merges. That PR contains the validated foundation (`destinationPath` routing-as-data, `installer/lib/install/` port, bridge deletion) that the rearchitecture builds on. The rearchitecture branch starts from main post-merge and lands the full layout shift in one coherent set of changes.
