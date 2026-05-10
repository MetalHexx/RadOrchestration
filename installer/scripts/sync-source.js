// installer/scripts/sync-source.js
// Publish-time per-harness bundle emitter. Replaces the previous direct
// copy of .claude/ → installer/src/.claude/. Uses the same runAdapter code
// path as the contributor build CLI and CI.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverAdapters } from '../../adapters/discover.js';
import { runAdapter } from '../../adapters/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Names excluded from UI source sync (build artifacts, deps, env files). */
const UI_EXCLUDES = new Set(['node_modules', '.next', '.env.local', '.env']);

/** Absolute path to the rad-orchestration scripts folder (bundle source). */
const scriptsDir = path.resolve(__dirname, '../../skills/rad-orchestration/scripts');

/**
 * Compiles the pipeline bundle and copies it into the given target path.
 * Preserves the shebang and executable bit. (FR-6, AD-5, NFR-2)
 *
 * @param {string} destPath - Absolute path to the destination pipeline.js
 */
export function emitPipelineBundle(destPath) {
  execSync(`npm run bundle -- --out=${destPath}`, {
    cwd: scriptsDir,
    stdio: 'pipe',
  });
  try {
    fs.chmodSync(destPath, 0o755);
  } catch {
    // chmod is a no-op on Windows; ignore silently
  }
}

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
 * containing the transformed files and a per-version manifest catalog under
 * installer/src/<harness>/manifests/v<version>.json.
 *
 * Uses outputRoot=installer/src/ and targetDir=adapter.name so that runAdapter
 * writes files to installer/src/<harness>/ and the manifest to
 * installer/src/<harness>/manifests/v<version>.json (single level, no double-nesting).
 *
 * @param {{ repoRoot: string, version: string }} opts
 */
export async function emitBundles({ repoRoot, version }) {
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  const installerSrc = path.join(repoRoot, 'installer', 'src');

  for (const adapter of adapters) {
    const bundleDir = path.join(installerSrc, adapter.name);
    // Scoped clean — wipe the bundle's emitted subpaths but preserve the
    // per-version manifest catalog so prior releases stay shipped.
    fs.mkdirSync(bundleDir, { recursive: true });
    for (const entry of fs.readdirSync(bundleDir)) {
      if (entry === 'manifests') continue;
      fs.rmSync(path.join(bundleDir, entry), { recursive: true, force: true });
    }

    // Override adapter.targetDir to be the harness name so runAdapter writes:
    //   files  → outputRoot/<adapter.name>/  (= installer/src/<harness>/)
    //   manifest → outputRoot/<adapter.name>/manifests/v<version>.json
    const bundleAdapter = { ...adapter, targetDir: adapter.name };
    const { fileCount } = await runAdapter(bundleAdapter, {
      canonicalRoot: repoRoot,
      outputRoot: installerSrc,
      version,
      packageVersion: version,
    });

    // Compile the pipeline bundle fresh and overwrite the verbatim-copied
    // pipeline.js in this harness installer bundle. Ensures every
    // installer/src/<harness>/ ships the esbuild bundle, not whatever bytes
    // happen to be in the canonical scripts/pipeline.js at copy time.
    const bundleDest = path.join(
      installerSrc, adapter.name,
      'skills', 'rad-orchestration', 'scripts', 'pipeline.js',
    );
    if (fs.existsSync(path.dirname(bundleDest))) {
      emitPipelineBundle(bundleDest);
      // Re-hash the freshly bundled pipeline.js and update the manifest
      // entry so the manifest stays coherent with what's actually on disk.
      // Without this, the manifest's sha256 records the canonical (pre-
      // bundle) bytes while the on-disk file is the esbuild output.
      const manifestPath = path.join(
        installerSrc, adapter.name, 'manifests', `v${version}.json`,
      );
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const bundledHash = crypto.createHash('sha256')
          .update(fs.readFileSync(bundleDest))
          .digest('hex');
        const entry = manifest.files.find(
          (f) => f.bundlePath === 'skills/rad-orchestration/scripts/pipeline.js',
        );
        if (entry) {
          entry.sha256 = bundledHash;
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        }
      }
    }

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
