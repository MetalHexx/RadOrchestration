import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFESTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../manifests');

test('every committed manifest carries version, channel, and a files array (FR-32, DD-12)', () => {
  const files = fs.readdirSync(MANIFESTS_DIR).filter((f) => /^v.+\.json$/.test(f));
  assert.ok(files.length >= 1, 'at least one v*.json manifest committed');
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, f), 'utf8'));
    assert.match(m.version, /^[0-9]+\.[0-9]+\.[0-9]+/, `${f}: version is semver`);
    assert.strictEqual(m.channel, 'copilot-cli-plugin', `${f}: channel matches FR-32`);
    assert.ok(Array.isArray(m.files), `${f}: files is an array`);
    for (const entry of m.files) {
      assert.match(entry.destinationPath, /\$\{RAD_HOME\}/, `entry has \${RAD_HOME} token`);
      assert.ok(typeof entry.sourcePath === 'string' && entry.sourcePath.length > 0);
      assert.ok(['installer-owned', 'user-config'].includes(entry.ownership));
    }
  }
});

test('orchestration.yml entry carries user-config ownership (FR-11)', () => {
  const files = fs.readdirSync(MANIFESTS_DIR).filter((f) => /^v.+\.json$/.test(f));
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, f), 'utf8'));
    const orch = m.files.find((e) => e.sourcePath === 'orchestration.yml');
    assert.ok(orch, `${f}: orchestration.yml entry exists`);
    assert.strictEqual(orch.ownership, 'user-config', `${f}: orchestration.yml is user-config`);
  }
});
