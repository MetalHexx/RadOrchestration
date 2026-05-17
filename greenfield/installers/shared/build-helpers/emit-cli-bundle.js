// emit-cli-bundle.js — Single-file ESM bundle of a CLI source root via esbuild.
// Installer-blind: source root and outfile path are parameters; chmod mode is
// a tunable knob with a sane default. Never creates intermediate dist/ folders
// (no-litter discipline, NFR-4). On Windows, chmod is silently a no-op.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {{ source: string, target: string, entryPoint?: string, mode?: number }} opts
 */
export async function emitCliBundle(opts) {
  const { source, target, mode = 0o755 } = opts;
  const entryPoint = opts.entryPoint ?? path.join(source, 'src', 'bin', 'radorch.ts');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: target,
    banner: { js: '#!/usr/bin/env node' },
    logLevel: 'warning',
  });
  try { fs.chmodSync(target, mode); } catch { /* Windows: no POSIX mode */ }
}
