import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadYml } from '../index.js';

test('loadYml accepts a parseable yml with name + description and returns { data, raw }', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yml-ok-'));
  try {
    const p = join(root, 'good.yml');
    writeFileSync(p, 'name: foo\ndescription: a thing\nmodel: opus\n');
    const { data, raw } = await loadYml(p);
    assert.strictEqual(data.name, 'foo');
    assert.strictEqual(data.description, 'a thing');
    assert.strictEqual(raw, 'name: foo\ndescription: a thing\nmodel: opus', 'raw is pre-trimmed of trailing newlines');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('loadYml errors when the file is missing, with the exact path in the message', async () => {
  await assert.rejects(loadYml('/no/such/path/agent.claude.yml'),
    /\/no\/such\/path\/agent\.claude\.yml/, 'message names the missing path (DD-7, FR-16)');
});

test('loadYml errors on parse failure, on missing name, and on missing description', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yml-bad-'));
  try {
    const a = join(root, 'unparseable.yml'); writeFileSync(a, ': : : not yaml');
    await assert.rejects(loadYml(a), /unparseable\.yml/, 'parse error names path');
    const b = join(root, 'no-name.yml'); writeFileSync(b, 'description: hi\n');
    await assert.rejects(loadYml(b), /no-name\.yml.*name/i, 'missing-name error names path + field (DD-7, FR-15)');
    const c = join(root, 'no-desc.yml'); writeFileSync(c, 'name: hi\n');
    await assert.rejects(loadYml(c), /no-desc\.yml.*description/i, 'missing-description error names path + field (DD-7, FR-15)');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
