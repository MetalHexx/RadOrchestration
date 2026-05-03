import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { detectModifiedFiles, hexSha256OfBytes } from './hash-check.js';

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function fixtureRoot(map) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hash-'));
  for (const [rel, body] of Object.entries(map)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
  return root;
}

test('hexSha256OfBytes computes hex sha256', () => {
  assert.strictEqual(hexSha256OfBytes(Buffer.from('abc')), sha256('abc'));
});

test('detectModifiedFiles returns empty list when every file matches manifest sha256', () => {
  const root = fixtureRoot({ 'agents/a.md': 'one', 'skills/s/SKILL.md': 'two' });
  const manifest = { files: [
    { bundlePath: 'agents/a.md', sha256: sha256('one') },
    { bundlePath: 'skills/s/SKILL.md', sha256: sha256('two') },
  ] };
  assert.deepStrictEqual(detectModifiedFiles(manifest, root), []);
});

test('detectModifiedFiles flags every file whose on-disk content differs from manifest sha256', () => {
  const root = fixtureRoot({ 'agents/a.md': 'one', 'skills/s/SKILL.md': 'changed' });
  const manifest = { files: [
    { bundlePath: 'agents/a.md', sha256: sha256('one') },
    { bundlePath: 'skills/s/SKILL.md', sha256: sha256('two') },
  ] };
  assert.deepStrictEqual(detectModifiedFiles(manifest, root), ['skills/s/SKILL.md']);
});

test('detectModifiedFiles sorts mismatched paths alphabetically (DD-2)', () => {
  const root = fixtureRoot({ 'z.md': 'changed', 'a.md': 'changed' });
  const manifest = { files: [
    { bundlePath: 'z.md', sha256: sha256('orig') },
    { bundlePath: 'a.md', sha256: sha256('orig') },
  ] };
  assert.deepStrictEqual(detectModifiedFiles(manifest, root), ['a.md', 'z.md']);
});

test('detectModifiedFiles ignores manifest entries whose file no longer exists on disk', () => {
  const root = fixtureRoot({ 'agents/a.md': 'one' });
  const manifest = { files: [
    { bundlePath: 'agents/a.md', sha256: sha256('one') },
    { bundlePath: 'agents/missing.md', sha256: sha256('xxx') },
  ] };
  // Missing-on-disk is a no-op for the modified-file check — uninstall
  // skips it later, install overwrites; neither is a "user edited it" case.
  assert.deepStrictEqual(detectModifiedFiles(manifest, root), []);
});
