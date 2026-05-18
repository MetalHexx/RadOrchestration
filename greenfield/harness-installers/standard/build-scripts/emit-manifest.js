// greenfield/harness-installers/standard/build-scripts/emit-manifest.js —
// Walks a dist/<harness>/ output tree, computes sha256 per file, and writes
// manifests/<harness>/v<version>.json with the per-harness installable tree
// only (no user-data assets per AD-3). Atomic write per NFR-3.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// User-data assets that belong to post-install state-machine steps, not the
// installable harness tree (AD-3). Any bundlePath starting with one of these
// prefixes is excluded from the manifest.
const USER_DATA_PREFIXES = ['orchestration.yml', 'templates/', 'ui/'];

/**
 * Recursively collects all file paths under `dir`, returning absolute paths.
 *
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
function walkDir(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Emits a per-harness manifest JSON file.
 *
 * Walks `harnessOutputDir`, filters out user-data assets, computes sha256 for
 * each surviving file, and writes:
 *   `{manifestDir}/v{version}.json`
 *
 * Shape: { version, channel, files: [{ bundlePath, destinationPath, sha256 }] }
 * Files are sorted by bundlePath for stable diffs. No `ownership` field (AD-3).
 * Write is atomic via tmp+rename (NFR-3).
 *
 * @param {{ harnessOutputDir: string, harness: string, version: string, manifestDir: string }} opts
 */
export async function emitManifest({ harnessOutputDir, harness, version, manifestDir }) {
  const allFiles = walkDir(harnessOutputDir);

  const files = [];
  for (const absPath of allFiles) {
    // POSIX-normalise the relative path regardless of platform (Windows uses \).
    const rel = path.relative(harnessOutputDir, absPath);
    const bundlePath = rel.split(path.sep).join('/');

    // AD-3: skip user-data assets.
    if (USER_DATA_PREFIXES.some((prefix) => bundlePath === prefix || bundlePath.startsWith(prefix))) {
      continue;
    }

    const buf = fs.readFileSync(absPath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const destinationPath = '${HARNESS_ROOT}/' + bundlePath;

    files.push({ bundlePath, destinationPath, sha256 });
  }

  // Stable diffs — sort by bundlePath.
  files.sort((a, b) => a.bundlePath < b.bundlePath ? -1 : a.bundlePath > b.bundlePath ? 1 : 0);

  const manifest = { version, channel: 'legacy-installer', files };
  const outPath = path.join(manifestDir, `v${version}.json`);
  const tmpPath = outPath + '.tmp';

  // Atomic write: write to tmp then rename (NFR-3).
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, outPath);
}
