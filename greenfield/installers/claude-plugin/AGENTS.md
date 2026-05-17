# claude-plugin Module

## Purpose

This folder is a self-contained npm package that produces the publishable Claude marketplace plugin. It assembles adapters, runtime config, hooks, and CLI into a single deliverable.

## Committed Source Layout

- `package.json` — npm package metadata; defines `build` and test scripts
- `.claude-plugin/` — Claude plugin manifest and metadata
- `hooks/` — hook implementations (`bootstrap.mjs`, `drift-check.mjs`) and registration manifest
- `lib/install/` — install state machine modules; consumed at build time by bootstrap
- `build-scripts/` — build orchestration; produces the final plugin payload
- `manifests/` — manifest templates and configuration
- `tests/` — unit and integration tests for the plugin

## Build Output Convention

- `output/` — gitignored; produced by `build-scripts/build.js` at build time
- Contains the final plugin tarball and intermediate artifacts
- Never committed; regenerated fresh on every build

## Inputs Consumed (But Not Owned)

The package reads—but never modifies—content from upstream modules:

- `harness-adapters/output/claude/` — compiled agents and skills for the Claude harness
- `runtime-config/` — harness-neutral system configuration and templates
- `cli/` — CLI codebase (assembled by a separate build process)
- `ui/` — dashboard UI (assembled by a separate build process)
- `harness-files/skills/rad-orchestration/scripts/*.ts` — pipeline runtime TypeScript source (bundled into the plugin)

## Seams

**Upstream boundary:** Adapter subsystem
- The build consumes `harness-adapters/output/claude/` as read-only input
- Adapter knowledge is not embedded here; the build script simply packages whatever the adapters produce

**Downstream boundary:** npm publish
- The final tarball is published to the npm registry for marketplace distribution
- Publication is a separate step outside the build script

## Coding Standards

- Build scripts are deterministic and idempotent
- All inputs are clearly documented in build metadata
- Tests verify the final plugin structure and hook functionality
- No hardcoded paths; all paths are resolved relative to module root

## Further Reading

- `hooks/AGENTS.md` — hook lifecycle, bundling strategy, and responsibilities
- `lib/install/AGENTS.md` — install state machine module patterns and coding standards
