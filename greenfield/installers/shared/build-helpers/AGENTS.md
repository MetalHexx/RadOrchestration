# build-helpers Module

## Purpose

This folder contains five mechanical helpers that emit bundles and run token-expansion transforms. These helpers are installer-blind and reusable across every installer variant.

## Installer-Blindness Rule (Critical)

**No file in this folder may contain:**

- Hardcoded installer names (`claude-plugin`, `standard`, etc.)
- Hardcoded destination paths (`~/.radorch/`, `${CLAUDE_PLUGIN_ROOT}`, etc.)
- Hardcoded token maps or config values

**Every installer-specific value flows in as a parameter.** This ensures the helpers remain universal and maintainable as new installer variants are added.

## Helper Contract Shape

Each helper exports a function with signature:

```javascript
async function helperName(opts: {
  source: string,          // input directory path
  target: string,          // output directory path
  [key: string]: unknown   // variant-specific knobs
}) => Promise<void>
```

## Five Helpers

**`emit-cli-bundle`**
- Produces the bundled CLI executable
- Reads from the `cli/` codebase
- Emits to installer-specified target path
- Parameters: `source`, `target`, `version`, `platform`

**`emit-pipeline-bundle`**
- Produces the pipeline runtime bundle
- Reads from `harness-files/skills/rad-orchestration/scripts/`
- Emits to installer-specified target path
- Parameters: `source`, `target`, `minify`

**`emit-hook-bundle`**
- Produces the esbuilt hook bundle (e.g., `bootstrap.mjs`)
- Reads hook source and inlined dependencies
- Emits to installer-specified target path
- Parameters: `source`, `target`, `entrypoint`

**`emit-ui-bundle`**
- Produces the dashboard UI bundle
- Reads from the `ui/` codebase
- Emits to installer-specified target path
- Parameters: `source`, `target`, `production`

**`expand-tokens`**
- Performs variable substitution in template files
- Reads token definitions from caller-provided map
- Emits expanded files to target directory
- Parameters: `source`, `target`, `tokens` (object of key-value pairs)

## Seam

These helpers consume output from the adapter engine (`harness-adapters/output/`) but do **not** contain adapter knowledge. The installers invoke these helpers with paths pointing to the adapter output, abstracting the adapter complexity away.

## Coding Standards

- Helpers are deterministic and produce identical output given identical inputs
- Error messages clearly reference the helper name and the failing operation
- All transforms are reversible or at least auditable (logs are always produced)
- No global state; all state flows through function parameters

## Further Reading

- `installers/AGENTS.md` — overview of the installer module structure
