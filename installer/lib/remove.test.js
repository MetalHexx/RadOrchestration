import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeManifestFiles } from './remove.js';

function seed(map) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-'));
  for (const [rel, body] of Object.entries(map)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
  return root;
}

test('removeManifestFiles removes exactly the files the manifest lists', () => {
  const root = seed({
    'agents/coder.md': 'a',
    'skills/rad-x/SKILL.md': 'b',
    'skills/rad-x/refs/r.md': 'c',
  });
  const manifest = { files: [
    { bundlePath: 'agents/coder.md', sha256: '' },
    { bundlePath: 'skills/rad-x/SKILL.md', sha256: '' },
    { bundlePath: 'skills/rad-x/refs/r.md', sha256: '' },
  ] };
  const result = removeManifestFiles(manifest, root);
  assert.strictEqual(result.removedCount, 3);
  assert.ok(!fs.existsSync(path.join(root, 'agents', 'coder.md')));
  assert.ok(!fs.existsSync(path.join(root, 'skills', 'rad-x', 'SKILL.md')));
});

test('removeManifestFiles prunes empty parent directories created by the install', () => {
  const root = seed({
    'agents/coder.md': 'a',
    'skills/rad-x/SKILL.md': 'b',
    'skills/rad-x/refs/r.md': 'c',
  });
  const manifest = { files: [
    { bundlePath: 'agents/coder.md', sha256: '' },
    { bundlePath: 'skills/rad-x/SKILL.md', sha256: '' },
    { bundlePath: 'skills/rad-x/refs/r.md', sha256: '' },
  ] };
  removeManifestFiles(manifest, root);
  assert.ok(!fs.existsSync(path.join(root, 'agents')), 'agents/ should be pruned when empty');
  assert.ok(!fs.existsSync(path.join(root, 'skills', 'rad-x')), 'rad-x/ should be pruned when empty');
  assert.ok(!fs.existsSync(path.join(root, 'skills')), 'skills/ should be pruned when empty');
});

test('removeManifestFiles never enumerates the filesystem — files outside the manifest survive', () => {
  const root = seed({
    'agents/coder.md': 'a',
    'agents/USER-OWNED.md': 'mine',
    'skills/rad-x/SKILL.md': 'b',
  });
  const manifest = { files: [
    { bundlePath: 'agents/coder.md', sha256: '' },
    { bundlePath: 'skills/rad-x/SKILL.md', sha256: '' },
  ] };
  removeManifestFiles(manifest, root);
  assert.ok(fs.existsSync(path.join(root, 'agents', 'USER-OWNED.md')), 'user-owned file outside manifest must survive');
  // agents/ must NOT be pruned because USER-OWNED.md is still there.
  assert.ok(fs.existsSync(path.join(root, 'agents')), 'agents/ must survive while it still has user-owned content');
});

test('removeManifestFiles is idempotent — missing files are skipped without error', () => {
  const root = seed({ 'agents/a.md': 'a' });
  const manifest = { files: [
    { bundlePath: 'agents/a.md', sha256: '' },
    { bundlePath: 'agents/already-gone.md', sha256: '' },
  ] };
  const result = removeManifestFiles(manifest, root);
  assert.strictEqual(result.removedCount, 1, 'only the file that existed counted as removed');
});
