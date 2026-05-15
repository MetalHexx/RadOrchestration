// tests/scripts/committed-catalog-structure.test.mjs
//
// Walks every committed per-version manifest under <repoRoot>/manifests/
// and asserts each entry has well-formed required fields. This guards
// historical and current versions structurally without requiring bundle
// coherence — historical manifests reference release-time bytes that no
// longer exist in the current runtime tree, so the coherence test in
// manifest-coherence.test.mjs is scoped to the current version only. This
// test fills the gap.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const committedManifestsRoot = path.join(repoRoot, 'manifests');
const SHA256_RE = /^[a-f0-9]{64}$/;
const VERSION_FILENAME_RE = /^v\d+\.\d+\.\d+(-[\w.]+)?\.json$/;

function listHarnesses() {
  if (!fs.existsSync(committedManifestsRoot)) return [];
  return fs.readdirSync(committedManifestsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

const harnesses = listHarnesses();

test('committed manifest catalog exists at repo root', () => {
  assert.ok(harnesses.length > 0, `expected at least one harness under ${committedManifestsRoot}`);
});

for (const harness of harnesses) {
  const harnessDir = path.join(committedManifestsRoot, harness);
  const versionFiles = fs.readdirSync(harnessDir).filter((f) => f.endsWith('.json'));

  for (const versionFile of versionFiles) {
    test(`manifests/${harness}/${versionFile} has well-formed structure`, () => {
      assert.match(
        versionFile,
        VERSION_FILENAME_RE,
        `${versionFile} does not match v<semver>.json shape`,
      );

      const manifest = JSON.parse(fs.readFileSync(path.join(harnessDir, versionFile), 'utf8'));
      assert.equal(manifest.harness, harness, `harness field mismatch in ${versionFile}`);
      assert.ok(typeof manifest.version === 'string' && manifest.version.length > 0,
        `version field missing or empty in ${versionFile}`);
      assert.equal(
        `v${manifest.version}.json`,
        versionFile,
        `version field (${manifest.version}) does not match filename ${versionFile}`,
      );
      assert.ok(Array.isArray(manifest.files), `files array missing in ${versionFile}`);
      assert.ok(manifest.files.length > 0, `files array is empty in ${versionFile}`);

      for (const entry of manifest.files) {
        const context = `${versionFile} entry ${JSON.stringify(entry.bundlePath)}`;
        assert.ok(
          typeof entry.bundlePath === 'string' && entry.bundlePath.length > 0,
          `${context}: bundlePath must be a non-empty string`,
        );
        assert.ok(
          typeof entry.sourcePath === 'string' && entry.sourcePath.length > 0,
          `${context}: sourcePath must be a non-empty string`,
        );
        assert.ok(
          typeof entry.destinationPath === 'string' && entry.destinationPath.length > 0,
          `${context}: destinationPath must be a non-empty string`,
        );
        assert.match(entry.sha256, SHA256_RE, `${context}: sha256 must be 64 hex chars`);
        assert.ok(
          entry.ownership === 'orchestration-system' || entry.ownership === 'user-config',
          `${context}: ownership must be 'orchestration-system' or 'user-config' (got ${JSON.stringify(entry.ownership)})`,
        );
        assert.equal(entry.harness, harness, `${context}: entry harness must match catalog harness`);
        assert.equal(entry.version, manifest.version, `${context}: entry version must match catalog version`);
      }
    });
  }
}
