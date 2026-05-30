import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installManifestFiles } from '../../lib/install/install-files.js';
import { removeManifestFiles } from '../../lib/install/remove-files.js';

const poisoned = { files: [{ bundlePath: 'repo-registry.yml', destinationPath: '${RAD_HOME}/repo-registry.yml', sha256: 'x' }] };

test('install refuses a manifest entry targeting a registry file', () => {
  assert.throws(() => installManifestFiles(poisoned, '/bundle', 'claude'), /repo-registry/);
});
test('remove refuses a manifest entry targeting a registry file', () => {
  assert.throws(() => removeManifestFiles(poisoned, 'claude'), /repo-registry/);
});
