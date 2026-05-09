import path from 'node:path';
import { ensureDir, writeFileAtomic } from '../../lib/fs-helpers.js';
import { installPaths } from '../../lib/paths.js';
import { HarnessName } from '../../framework/harness.js';

/**
 * Iter-1 placeholder: each harness gets a marker bundle directory with a stub README.
 * Real asset packing lands in iter #08 (manifest-aware install).
 */
export async function writeHarnessBundles(root: string): Promise<void> {
  const p = installPaths(root);
  await ensureDir(p.harnessesDir);
  for (const h of HarnessName) {
    const dir = path.join(p.harnessesDir, h);
    await ensureDir(dir);
    await writeFileAtomic(path.join(dir, 'BUNDLE.md'), `# ${h}\n\nPlaceholder bundle written by radorch install (iter 1).\n`);
  }
}
