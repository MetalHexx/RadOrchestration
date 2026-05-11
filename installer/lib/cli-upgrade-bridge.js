// installer/lib/cli-upgrade-bridge.js — JS shim that loads the CLI's compiled
// upgrade library so the legacy installer can call the same `runPluginBootstrap`
// the plugin SessionStart hook calls. One canonical install/upgrade path,
// shared across the legacy `radorch` CLI and the Claude plugin bootstrap.
//
// The installer is plain JS. The CLI library is TypeScript compiled to
// `cli/dist/commands/plugin-bootstrap/run.js`. This shim re-exports
// `runPluginBootstrap` from that compiled output via an ESM static import.
//
// Note: when the installer is published as the `radorch` npm package, the
// compiled CLI bundle ships alongside it via `installer/scripts/sync-source.js`.
// In the dev/monorepo layout (this worktree) we import directly from
// `../../cli/dist/...`.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the compiled CLI bootstrap module relative to this file. We attempt
// the monorepo layout first; if not present, fall back to the published
// layout where `cli/dist/` is bundled inside the installer package itself.
//
// We use a dynamic import URL string because the location varies between
// development and publish. The path is computed once at module load.
const candidateLocations = [
  // Monorepo / dev worktree
  path.resolve(__dirname, '..', '..', 'cli', 'dist', 'commands', 'plugin-bootstrap', 'run.js'),
  // Published installer-internal copy (sync-source.js places it here at pack time)
  path.resolve(__dirname, '..', 'vendor', 'cli', 'commands', 'plugin-bootstrap', 'run.js'),
];

const resolvedBootstrapModule = candidateLocations.find((p) => fs.existsSync(p));
if (!resolvedBootstrapModule) {
  throw new Error(
    'cli-upgrade-bridge: could not locate compiled runPluginBootstrap module. '
    + 'Run `cd cli && npm run build` (monorepo) or ensure sync-source.js ran (published).',
  );
}

const { runPluginBootstrap } = await import(pathToFileURL(resolvedBootstrapModule).href);

export { runPluginBootstrap };
