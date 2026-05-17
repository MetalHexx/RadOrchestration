// emit-hook-bundle.js — Plugin-specific by nature, but lives in shared/
// for discipline-consistency with the other emit-helpers. Bundles
// bootstrap.mjs with deps inlined, copies drift-check.mjs / hooks.json /
// hooks/AGENTS.md verbatim.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {{ source: string, target: string, libRoot?: string }} opts
 *  - source: hooks/ folder containing bootstrap.mjs + drift-check.mjs +
 *    hooks.json + AGENTS.md
 *  - target: output hooks/ folder under the installer's output/
 *  - libRoot: parent folder containing the lib/install/* modules that
 *    bootstrap.mjs imports; defaults to <source>/../lib so esbuild
 *    resolves them naturally.
 */
export async function emitHookBundle(opts) {
  const { source, target } = opts;
  fs.mkdirSync(target, { recursive: true });
  const bootstrapEntry = path.join(source, 'bootstrap.mjs');
  const bootstrapOut = path.join(target, 'bootstrap.mjs');
  // esbuild preserves the source's shebang automatically; do NOT add one via
  // banner — that yielded a double shebang (banner + source) and Node
  // rejected line 2 as a SyntaxError when the hook fired. Source's shebang
  // is the single source of truth.
  await build({
    entryPoints: [bootstrapEntry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: bootstrapOut,
    logLevel: 'warning',
  });
  for (const verbatim of ['drift-check.mjs', 'hooks.json', 'AGENTS.md']) {
    const src = path.join(source, verbatim);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(target, verbatim));
    }
  }
}
