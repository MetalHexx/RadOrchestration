// emit-pipeline-bundle.js — Bundles the pipeline runtime entry (pipeline).
// explode-master-plan folded into the radorch CLI in SCRIPT-FOLD-3.
// Bundles from a TS source root to per-entry .js files under a target folder.
// Absorbs today's bundle.mjs logic from the skill source. v5 entries
// (migrate-to-v5, fix-ghost-v5) retire entirely — they target schema v5
// (current is v6) with zero automated callers.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

export const RUNTIME_ENTRIES = ['pipeline'];

/**
 * @param {{ source: string, target: string }} opts
 */
export async function emitPipelineBundle(opts) {
  const { source, target } = opts;
  fs.mkdirSync(target, { recursive: true });
  for (const entryName of RUNTIME_ENTRIES) {
    const entryPoint = path.join(source, `${entryName}.ts`);
    const outfile = path.join(target, `${entryName}.js`);
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      outfile,
      banner: { js: '#!/usr/bin/env node' },
      logLevel: 'warning',
      loader: { '.json': 'json' },
    });
    try { fs.chmodSync(outfile, 0o755); } catch { /* Windows */ }
  }
}
