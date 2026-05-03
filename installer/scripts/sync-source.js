// installer/scripts/sync-source.js
// Publish-time per-harness bundle emitter. Replaces the previous direct
// copy of .claude/ → installer/src/.claude/. Uses the same runAdapter code
// path as the contributor build CLI and CI.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAdapters } from '../../adapters/discover.js';
import { runAdapter } from '../../adapters/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Names excluded from UI source sync (build artifacts, deps, env files). */
const UI_EXCLUDES = new Set(['node_modules', '.next', '.env.local', '.env']);

/**
 * Copies UI source into installer/src/ui/ (unchanged behavior).
 *
 * @param {string} source - Absolute path to the source directory
 * @param {string} target - Absolute path to the destination directory
 * @param {Set<string>} [excludes] - Optional set of directory/file names to skip
 */
export function syncSource(source, target, excludes) {
  fs.rmSync(target, { recursive: true, force: true });
  const options = { recursive: true };
  if (excludes) options.filter = (src) => !excludes.has(path.basename(src));
  fs.cpSync(source, target, options);
  console.log(`Synced ${path.basename(source)}/ → src/${path.basename(target)}/`);
}

/**
 * Runs every discovered adapter and writes installer/src/<harness>/ bundles.
 * Each adapter produces a self-contained folder at installer/src/<harness>/
 * containing the transformed files and a manifest.json.
 *
 * Uses outputRoot=installer/src/ and targetDir=adapter.name so that runAdapter
 * writes files to installer/src/<harness>/ and the manifest to
 * installer/src/<harness>/manifest.json (single level, no double-nesting).
 *
 * @param {{ repoRoot: string, version: string }} opts
 */
export async function emitBundles({ repoRoot, version }) {
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  const installerSrc = path.join(repoRoot, 'installer', 'src');

  for (const adapter of adapters) {
    const bundleDir = path.join(installerSrc, adapter.name);
    fs.rmSync(bundleDir, { recursive: true, force: true });
    fs.mkdirSync(bundleDir, { recursive: true });

    // Override adapter.targetDir to be the harness name so runAdapter writes:
    //   files  → outputRoot/<adapter.name>/  (= installer/src/<harness>/)
    //   manifest → outputRoot/<adapter.name>/manifest.json
    const bundleAdapter = { ...adapter, targetDir: adapter.name };
    const { fileCount } = await runAdapter(bundleAdapter, {
      canonicalRoot: repoRoot,
      outputRoot: installerSrc,
      version,
    });
    console.log(`Emitted bundle ${adapter.name}: ${fileCount} files → installer/src/${adapter.name}/`);
  }
}

// Only execute when run directly.
if (process.argv[1] === __filename) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const installerPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'installer', 'package.json'), 'utf8'));
  await emitBundles({ repoRoot, version: installerPkg.version });
  syncSource(
    path.resolve(__dirname, '../../ui'),
    path.resolve(__dirname, '../src/ui'),
    UI_EXCLUDES,
  );
}
