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
 * Allowlist for `skills/rad-orchestration/scripts/` contents in each emitted
 * bundle (FR-21). The published `radorch` npm package ships only the runtime
 * artifacts: the esbuild `pipeline.js` bundle plus a handful of operational
 * helpers. Everything else under `scripts/` — TypeScript sources, lockfiles,
 * dev configs, lib/, tests/, node_modules/ — is dev-only and must not ship.
 */
const SCRIPTS_BUNDLE_KEEP = new Set([
  'pipeline.js',
  'radorch.mjs',
  'list-repo-skills.mjs',
  'setup-hooks.js',
]);

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
 * Compiles the CLI bundle and copies it into the given target path.
 * Reuses cli/scripts/bundle.mjs via npm to keep the bundle config in one place.
 * Preserves the executable bit on POSIX (no-op on Windows).
 *
 * @param {string} repoRoot - Absolute path to the repository root
 * @param {string} destPath - Absolute path to the destination radorch.mjs
 */
export function emitCliBundle(repoRoot, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  execSync(`npm run bundle -- --out=${destPath}`, { cwd: path.join(repoRoot, 'cli'), stdio: 'pipe' });
  try { fs.chmodSync(destPath, 0o755); } catch { /* no-op on Windows */ }
}

/**
 * Builds the Next.js standalone UI and copies it into installer/src/ui/ (AD-2).
 * Mirrors the layout that scripts/build-plugin.js's ui-standalone step
 * already produces for the plugin payload.
 *
 * @param {string} repoRoot - Absolute path to the repository root
 */
export function emitSharedUi(repoRoot) {
  const uiDir = path.join(repoRoot, 'ui');
  execSync('npm run build-standalone', { cwd: uiDir, stdio: 'pipe' });
  const dest = path.join(repoRoot, 'installer', 'src', 'ui');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(uiDir, '.next', 'standalone'), dest, { recursive: true });
  fs.cpSync(path.join(uiDir, '.next', 'static'), path.join(dest, '.next', 'static'), { recursive: true });
  const pub = path.join(uiDir, 'public');
  if (fs.existsSync(pub)) fs.cpSync(pub, path.join(dest, 'public'), { recursive: true });
}

/**
 * Recursively enumerates all files under `dir`, returning paths relative to
 * `baseDir`. Used to walk installer/src/ui/ for manifest augmentation.
 *
 * @param {string} dir      - Absolute path to the directory to walk
 * @param {string} baseDir  - Absolute path used to compute relative paths
 * @returns {string[]}      - Array of forward-slash relative paths
 */
function walkDir(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results;
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

    // Emit the CLI bundle into this harness's skill folder alongside pipeline.js.
    // The CLI now ships inside the rad-orchestration skill (FR-XX) so each
    // harness install carries its own copy. runAdapter doesn't see it (the
    // canonical scripts/ folder has no radorch.mjs — it's a build artifact),
    // so insert the manifest entry here if missing; otherwise update sha256.
    const cliRelPath = 'skills/rad-orchestration/scripts/radorch.mjs';
    const cliDest = path.join(
      installerSrc, adapter.name, ...cliRelPath.split('/'),
    );
    if (fs.existsSync(path.dirname(cliDest))) {
      emitCliBundle(repoRoot, cliDest);
      const manifestPath = path.join(
        installerSrc, adapter.name, 'manifests', `v${version}.json`,
      );
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const cliHash = crypto.createHash('sha256')
          .update(fs.readFileSync(cliDest))
          .digest('hex');
        const existing = manifest.files.find((f) => f.bundlePath === cliRelPath);
        if (existing) {
          existing.sha256 = cliHash;
        } else {
          manifest.files.push({
            bundlePath: cliRelPath,
            sourcePath: cliRelPath,
            ownership: 'orchestration-system',
            version: manifest.version ?? version,
            harness: adapter.name,
            sha256: cliHash,
          });
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      }
    }

    // Trim the bundled `skills/rad-orchestration/scripts/` tree (FR-21):
    // keep only the runtime artifacts listed in SCRIPTS_BUNDLE_KEEP. Drop
    // TypeScript sources, lockfiles, dev configs, and the entire lib/,
    // tests/, node_modules/ subtrees from what ships to end users.
    const scriptsBundleDir = path.join(
      installerSrc, adapter.name, 'skills', 'rad-orchestration', 'scripts',
    );
    if (fs.existsSync(scriptsBundleDir)) {
      for (const entry of fs.readdirSync(scriptsBundleDir)) {
        if (!SCRIPTS_BUNDLE_KEEP.has(entry)) {
          fs.rmSync(path.join(scriptsBundleDir, entry), { recursive: true, force: true });
        }
      }
      // Re-key the manifest catalog to drop entries for the removed files.
      // Without this, runPluginBootstrap (and the modified-file hash check)
      // would treat the absent files as locally modified.
      const manifestPath = path.join(
        installerSrc, adapter.name, 'manifests', `v${version}.json`,
      );
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const beforeCount = manifest.files.length;
        manifest.files = manifest.files.filter((f) => {
          const bp = f.bundlePath;
          if (!bp.startsWith('skills/rad-orchestration/scripts/')) return true;
          const rest = bp.slice('skills/rad-orchestration/scripts/'.length);
          // Allow only top-level files in SCRIPTS_BUNDLE_KEEP — drop anything
          // nested under removed subdirectories (lib/, tests/, node_modules/).
          if (rest.includes('/')) return false;
          return SCRIPTS_BUNDLE_KEEP.has(rest);
        });
        if (manifest.files.length !== beforeCount) {
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        }
      }
    }

    // Emit a per-bundle `package.json` that carries the delivering version.
    // `runPluginBootstrap` reads `<pluginRoot>/package.json` for its version,
    // so the legacy installer needs every bundle to surface this field.
    const bundlePkgPath = path.join(installerSrc, adapter.name, 'package.json');
    fs.writeFileSync(
      bundlePkgPath,
      JSON.stringify(
        { name: `@rad-orchestration/${adapter.name}-bundle`, version, private: true },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    console.log(`Emitted bundle ${adapter.name}: ${fileCount} files → installer/src/${adapter.name}/`);
  }

  // Augment every per-harness manifest with entries for the shared ui assets
  // that were emitted by emitSharedUi before this function was called. The CLI
  // no longer ships as a shared asset — each harness's emitBundles step emits
  // its own copy into skills/rad-orchestration/scripts/radorch.mjs above.
  // Each entry follows the same manifest shape as harness-specific files:
  // bundlePath, sourcePath, ownership, version, harness, sha256.
  const sharedAssetDirs = [
    path.join(installerSrc, 'ui'),
  ];

  for (const adapter of adapters) {
    const manifestPath = path.join(
      installerSrc, adapter.name, 'manifests', `v${version}.json`,
    );
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const assetDir of sharedAssetDirs) {
      const relPaths = walkDir(assetDir, installerSrc);
      for (const relPath of relPaths) {
        const absPath = path.join(installerSrc, relPath);
        const sha256 = crypto.createHash('sha256')
          .update(fs.readFileSync(absPath))
          .digest('hex');
        manifest.files.push({
          bundlePath: relPath,
          sourcePath: relPath,
          ownership: 'orchestration-system',
          version,
          harness: adapter.name,
          sha256,
        });
      }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

// Only execute when run directly.
if (process.argv[1] === __filename) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const installerPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'installer', 'package.json'), 'utf8'));
  emitSharedUi(repoRoot);
  await emitBundles({ repoRoot, version: installerPkg.version });
}
