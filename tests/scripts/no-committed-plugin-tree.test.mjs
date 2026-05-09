import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('marketplace/plugins/rad-orchestration/ is no longer committed', () => {
  const dir = path.join(repoRoot, 'marketplace', 'plugins', 'rad-orchestration');
  // Either the directory does not exist, OR it exists but is empty (gitignored staging only).
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  assert.deepEqual(entries, [], `marketplace/plugins/rad-orchestration/ still has committed entries: ${entries.join(', ')}`);
});

test('plugin/package.json declares @rad-orchestration/claude-plugin', () => {
  const pkgFile = path.join(repoRoot, 'plugin', 'package.json');
  assert.ok(fs.existsSync(pkgFile), 'plugin/package.json missing');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  assert.equal(pkg.name, '@rad-orchestration/claude-plugin');
  assert.ok(pkg.version, 'plugin/package.json missing version');
});
