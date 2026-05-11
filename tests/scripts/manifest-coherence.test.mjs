// tests/scripts/manifest-coherence.test.mjs
//
// Asserts that each per-harness manifest at
// installer/src/<harness>/manifests/v<version>.json is internally coherent
// with what was emitted into installer/src/<harness>/:
//
//   • Every manifest entry's recorded sha256 matches the file on disk now.
//   • Every shipped file (excluding build artifacts) has a manifest entry.
//   • No manifest entry references a missing file.
//
// All hashes are computed at test time. There is no pinned fixture, so this
// test is platform-stable: line-ending or other byte-level differences across
// platforms produce a consistent (manifest, file) pair generated in the same
// run, and only true incoherence (manifest disagreeing with disk) fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const LEGACY_HARNESSES = ['claude', 'copilot-cli', 'copilot-vscode'];

function sha256OfFile(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

// Files that are emitted into the bundle by upstream copies (e.g. local tsc /
// esbuild dropping into scripts/dist*) but are not authored ship content. They
// won't appear in the manifest and shouldn't trigger the "missing manifest
// entry" assertion.
//
// The bundle-level `package.json` at the bundle root is treated the same way:
// it carries only the delivering version field consumed by runPluginBootstrap
// and is not a file the bootstrap library copies into the user's filesystem.
function isBuildArtifact(relPath) {
  return /^skills\/rad-orchestration\/scripts\/(dist|dist-bundle|node_modules)\//.test(relPath) ||
         /^skills\/rad-orchestration\/scripts\/.*\.log$/.test(relPath) ||
         relPath === 'skills/rad-orchestration/scripts/package-lock.json' ||
         relPath === 'package.json';
}

function walkRelative(rootDir) {
  const out = [];
  const recurse = (rel) => {
    const abs = path.join(rootDir, rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? path.posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) recurse(childRel);
      else out.push(childRel);
    }
  };
  recurse('');
  return out;
}

for (const harness of LEGACY_HARNESSES) {
  test(`manifest at installer/src/${harness}/manifests/v*.json is coherent with shipped files`, () => {
    const bundleRoot = path.join(repoRoot, 'installer', 'src', harness);
    const manifestsDir = path.join(bundleRoot, 'manifests');
    assert.ok(fs.existsSync(manifestsDir), `manifests dir missing for ${harness}`);

    const manifestFiles = fs.readdirSync(manifestsDir).filter((f) => f.endsWith('.json'));
    assert.ok(manifestFiles.length > 0, `no manifest catalog file under ${manifestsDir}`);

    for (const manifestFile of manifestFiles) {
      const manifestPath = path.join(manifestsDir, manifestFile);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(manifest.harness, harness, `manifest ${manifestFile} harness field mismatch`);
      assert.ok(Array.isArray(manifest.files), `manifest ${manifestFile} has no files array`);

      const manifestEntries = new Map(manifest.files.map((f) => [f.bundlePath, f]));

      // Forward direction: every manifest entry must point to an existing
      // file whose current sha256 matches. The orchestration.yml entry is
      // deliberately skipped — its `ownership: 'user-config'` means the
      // installer overwrites it on install, so the runtime hash is allowed
      // to diverge.
      for (const entry of manifest.files) {
        if (entry.ownership === 'user-config') continue;
        const filePath = path.join(bundleRoot, entry.bundlePath);
        assert.ok(
          fs.existsSync(filePath),
          `${harness} manifest references missing file: ${entry.bundlePath}`,
        );
        const observed = sha256OfFile(filePath);
        assert.equal(
          observed,
          entry.sha256,
          `${harness} manifest sha mismatch at ${entry.bundlePath}`,
        );
      }

      // Reverse direction: every shipped file (excluding build artifacts and
      // the manifest tree itself) must have a manifest entry.
      const shipped = walkRelative(bundleRoot)
        .filter((rel) => !rel.startsWith('manifests/'))
        .filter((rel) => !isBuildArtifact(rel));
      for (const rel of shipped) {
        assert.ok(
          manifestEntries.has(rel),
          `${harness} shipped file has no manifest entry: ${rel}`,
        );
      }
    }
  });
}
